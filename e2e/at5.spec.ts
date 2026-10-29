import { writeFile } from 'node:fs/promises';
import { expect, test, type Page } from '@playwright/test';
import { expectAccessible } from './axe';

// Build task 5, done criterion 2. A scripted run of the AT-5 task (SPEC.md Sec. 12.5) on a
// fictitious company, from an empty browser to the printed decision record, in under 10
// minutes. The positive risk comes from the catalogue picker, and the other 4 are own risks.
interface RiskInput {
  readonly description: string;
  // The id of a catalogue template. The description is then the template text.
  readonly template?: string;
  readonly positive?: boolean;
  readonly owner: string;
  readonly objective: 'OBJ-1' | 'OBJ-2';
  readonly frequency: readonly [number, number];
  readonly impact: readonly [number, number];
}

const RISKS: readonly RiskInput[] = [
  {
    description: 'If ransomware encrypts the order system, then deliveries stop for days.',
    owner: 'IT lead',
    objective: 'OBJ-1',
    frequency: [0.05, 0.3],
    impact: [40_000, 600_000],
  },
  { description: 'If the payment provider fails, then card orders stop.', owner: 'Finance lead', objective: 'OBJ-1', frequency: [0.2, 1], impact: [2_000, 30_000] },
  {
    description: 'If a phishing mail changes a supplier bank account, then we pay a fraudster.',
    owner: 'Finance lead',
    objective: 'OBJ-2',
    frequency: [0.1, 0.6],
    impact: [5_000, 80_000],
  },
  {
    description: 'If customer data leaks from the web shop, then the authority fines us.',
    owner: 'Managing director',
    objective: 'OBJ-2',
    frequency: [0.02, 0.2],
    impact: [10_000, 250_000],
  },
  {
    description:
      'Adopting a new cloud-based authentication platform introduces moderate implementation risks but presents a high-likelihood opportunity to reduce credential-based incidents by 40 % and improve user access efficiency.',
    template: 'OPP-3',
    positive: true,
    owner: 'IT lead',
    objective: 'OBJ-1',
    frequency: [0.5, 2],
    impact: [3_000, 20_000],
  },
];

async function saved(page: Page): Promise<void> {
  await expect(page.getByText(/^Saved as version \d+\./)).toBeVisible();
}

async function addRisk(page: Page, n: number, risk: RiskInput): Promise<void> {
  const id = `risk-R-${String(n)}`;
  if (risk.template === undefined) {
    await page.getByLabel('Risk description').fill(risk.description);
    await page.locator('#new-risk-polarity').selectOption(risk.positive === true ? 'positive' : 'negative');
    await page.getByRole('button', { name: /^Add risk to / }).click();
  } else {
    await page.getByLabel('Template', { exact: true }).selectOption(risk.template);
    await page.getByRole('button', { name: /^Add the template to / }).click();
  }
  await expect(page.getByRole('heading', { level: 2, name: `Risk R-${String(n)}` })).toBeVisible();
  await page.getByRole('tab', { name: 'Scenario' }).click();
  await page.locator(`#${id}-owner`).fill(risk.owner);
  await page.getByRole('tab', { name: 'Estimate' }).click();
  await page.getByRole('button', { name: 'Add an estimate' }).click();
  await page.locator(`#${id}-frequency-lower`).fill(String(risk.frequency[0]));
  await page.locator(`#${id}-frequency-upper`).fill(String(risk.frequency[1]));
  await page.locator(`#${id}-impact-lower`).fill(String(risk.impact[0]));
  await page.locator(`#${id}-impact-upper`).fill(String(risk.impact[1]));
  await page.locator(`#${id}-rationale`).fill('Calibrated range from the workshop on 29 October 2026.');
  await page.getByRole('tab', { name: 'Links' }).click();
  await page.getByLabel(new RegExp(`^${risk.objective} `)).check();
  await saved(page);
}

async function linkDriver(page: Page, riskId: string, trigger: number): Promise<void> {
  await page.getByRole('button', { name: `Edit ${riskId}` }).click();
  await page.getByRole('tab', { name: 'Drivers' }).click();
  await page.getByRole('button', { name: 'Link a driver' }).click();
  await page.getByLabel('Trigger probability (0 to 1)').fill(String(trigger));
  await saved(page);
}

async function addOption(page: Page, n: number, title: string, target: string, costs: readonly [number, number, number], impact: readonly [number, number]): Promise<void> {
  const id = `option-O-${String(n)}`;
  await page.getByRole('button', { name: 'Add a response option' }).click();
  await page.locator(`#${id}-title`).fill(title);
  await page.locator(`#${id}-oneoff`).fill(String(costs[0]));
  await page.locator(`#${id}-annual`).fill(String(costs[1]));
  await page.locator(`#${id}-lifetime`).fill(String(costs[2]));
  await page.locator(`#${id}-effect0-target`).selectOption(target);
  const editor = page.locator('details.editor').filter({ has: page.locator(`#${id}-title`) });
  await editor.getByLabel('The response changes the loss per event').check();
  await page.locator(`#${id}-effect0-impact-lower`).fill(String(impact[0]));
  await page.locator(`#${id}-effect0-impact-upper`).fill(String(impact[1]));
  await page.locator(`#${id}-effect0-rationale`).fill('Vendor quote and the loss after the control.');
  await saved(page);
}

test('AT-5 task from an empty browser to the printed decision record in under 10 minutes', async ({ page }, testInfo) => {
  test.setTimeout(10 * 60 * 1000);
  // A step that cannot finish fails fast, so the test never only waits for the 10 minutes.
  page.setDefaultTimeout(20_000);
  const started = Date.now();
  const problems: string[] = [];
  page.on('pageerror', (error) => problems.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error' || message.type() === 'warning') problems.push(message.text());
  });

  // A first register comes with the new document.
  await page.goto('/');
  await page.getByLabel('Title', { exact: true }).fill('Bakery risk register 2027');
  await page.getByLabel('Organization').fill('Fictitious Bakery Ltd');
  await page.getByRole('button', { name: 'Create', exact: true }).click();
  await expect(page.getByRole('status').filter({ hasText: 'is created.' })).toBeVisible();

  // Context with 2 objectives, and a tolerance curve with 4 points.
  await page.getByRole('button', { name: 'Context and strategy' }).click();
  await page.getByRole('button', { name: 'Add an objective' }).click();
  await page.getByLabel('Objective 1 kind').selectOption('operations');
  await page.getByLabel('Objective 1 statement').fill('Deliver every order on time.');
  await page.getByRole('button', { name: 'Add an objective' }).click();
  await page.getByLabel('Objective 2 kind').selectOption('compliance');
  await page.getByLabel('Objective 2 statement').fill('Meet the GDPR and payment rules.');
  await page.getByLabel('Capacity (EUR)').fill('1500000');
  await page.getByLabel('Rationale for the capacity').fill('Cash reserve and the unused credit line.');
  await page.getByRole('button', { name: 'Use the starting points from capacity' }).click();
  await expect(page.getByLabel('Point 4 probability')).toHaveValue('0.01');
  await saved(page);

  // 5 risks with frequency range, impact range, owner and objective, 1 of them positive.
  await page.getByRole('button', { name: 'Identify and analyze' }).click();
  await page.getByLabel('Method').selectOption('quantitative');
  await saved(page);
  for (const [i, risk] of RISKS.entries()) await addRisk(page, i + 1, risk);
  // The template gave the text, the polarity and the category of R-5.
  const r5 = page.getByRole('row').filter({ hasText: 'cloud-based authentication platform' });
  await expect(r5).toContainText('Opportunity');
  await expect(r5).toContainText('ict.identity');

  // 1 driver with 2 links.
  await page.getByRole('button', { name: 'Add a driver' }).click();
  await page.getByText(/^D-1 New driver/).click();
  await page.locator('#driver-0-name').fill('Cloud hosting outage');
  await page.locator('#driver-0-kind').selectOption('supplier');
  await page.locator('#driver-0-frequency-lower').fill('0.1');
  await page.locator('#driver-0-frequency-upper').fill('0.8');
  await page.locator('#driver-0-rationale').fill('The provider had three regional outages in five years.');
  await linkDriver(page, 'R-1', 0.3);
  await linkDriver(page, 'R-2', 0.6);
  await expect(page.getByText('D-1 Cloud hosting outage, linked to 2 risks')).toBeVisible();

  // 2 response options, then the optimization.
  await page.getByRole('button', { name: 'Respond and optimize' }).click();
  await page.locator('#budget-cash').fill('40000');
  await addOption(page, 1, 'Offline backups with restore tests', 'risk|R-1', [12_000, 4_000, 3], [10_000, 150_000]);
  await addOption(page, 2, 'Call-back check for bank account changes', 'risk|R-3', [1_000, 2_000, 3], [1_000, 20_000]);
  await page.getByRole('button', { name: 'Find the best portfolio' }).click();
  const record = page.locator('article.record');
  await expect(record.getByRole('heading', { level: 3, name: '04 Funded portfolio' })).toBeVisible({ timeout: 60_000 });
  await expect(page.getByRole('region', { name: 'Ranked portfolios' }).getByRole('row', { name: /^Best O-/ })).toBeVisible();
  await expectAccessible(page, 'S5 of the AT-5 run');

  // Print the decision record.
  await page.emulateMedia({ media: 'print' });
  const pdf = await page.pdf({ preferCSSPageSize: true, printBackground: true });
  const file = testInfo.outputPath('at5-decision-record.pdf');
  await writeFile(file, pdf);
  await testInfo.attach('at5-decision-record.pdf', { path: file, contentType: 'application/pdf' });
  expect((pdf.toString('latin1').match(/\/Type\s*\/Page(?![s\w])/g) ?? []).length).toBeLessThanOrEqual(2);

  const minutes = (Date.now() - started) / 60_000;
  testInfo.annotations.push({ type: 'wall time', description: `${minutes.toFixed(2)} minutes` });
  expect(minutes).toBeLessThan(10);
  expect(problems, 'errors, warnings and CSP violations').toEqual([]);
});
