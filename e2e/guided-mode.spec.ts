import { writeFile } from 'node:fs/promises';
import { expect, test, type Page } from '@playwright/test';
import { expectAccessible } from './axe';

// Redesign phase 3 (docs/ux/redesign-plan.md Sec. 5). The AT-5 task (SPEC.md Sec. 12.5) through
// the guided mode, from an empty browser to the printed decision record. Each step passes
// axe-core and the 375 px width, under the production CSP.
async function saved(page: Page): Promise<void> {
  await expect(page.getByText(/^Saved as version \d+\./)).toBeVisible();
}

async function narrow(page: Page): Promise<void> {
  const size = page.viewportSize();
  await page.setViewportSize({ width: 375, height: 812 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(375);
  if (size !== null) await page.setViewportSize(size);
}

async function step(page: Page, n: number, heading: string): Promise<void> {
  await expect(page.locator('.guided-eyebrow')).toHaveText(`Step ${String(n)} of 9`);
  await expect(page.getByRole('heading', { level: 1, name: heading })).toBeFocused();
}

interface RiskInput {
  readonly owner: string;
  readonly objective: 'OBJ-1' | 'OBJ-2';
  readonly frequency: readonly [number, number];
  readonly impact: readonly [number, number];
}

async function sizeRisk(page: Page, n: number, risk: RiskInput): Promise<void> {
  const id = `risk-R-${String(n)}`;
  await page.getByRole('group', { name: 'Risks' }).getByRole('button', { name: new RegExp(`^R-${String(n)}\\b`) }).click();
  await page.locator(`#${id}-owner`).fill(risk.owner);
  await page.getByRole('group', { name: 'Which goals does it hit?' }).getByLabel(new RegExp(`^${risk.objective} `)).check();
  await page.getByRole('button', { name: 'Give the ranges' }).click();
  await page.locator(`#${id}-frequency-lower`).fill(String(risk.frequency[0]));
  await page.locator(`#${id}-frequency-upper`).fill(String(risk.frequency[1]));
  await page.locator(`#${id}-impact-lower`).fill(String(risk.impact[0]));
  await page.locator(`#${id}-impact-upper`).fill(String(risk.impact[1]));
  await page.locator(`#${id}-rationale`).fill('Calibrated range from the workshop on 29 October 2026.');
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

test('guided mode takes the AT-5 task from an empty browser to the printed decision record', async ({ page }, testInfo) => {
  test.setTimeout(10 * 60 * 1000);
  page.setDefaultTimeout(20_000);
  const problems: string[] = [];
  page.on('pageerror', (error) => problems.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error' || message.type() === 'warning') problems.push(message.text());
  });
  const next = (name: string) => page.locator('.guided-foot').getByRole('button', { name: `Next, ${name}` });

  await page.goto('/');
  await page.getByLabel('Title', { exact: true }).fill('Bakery risk register 2027');
  await page.getByRole('button', { name: 'Create', exact: true }).click();
  await expect(page.getByRole('status').filter({ hasText: 'is created.' })).toBeVisible();
  await page.getByRole('button', { name: 'Guided mode', exact: true }).click();

  // Step 1.
  await step(page, 1, 'Your company');
  await page.getByLabel('Company name').fill('Fictitious Bakery Ltd');
  await page.getByLabel('What does your company do?').fill('We bake bread and sell it in 3 shops and online.');
  await saved(page);
  await expectAccessible(page, 'guided step 1');
  await narrow(page);
  await next('your goals').click();

  // Step 2. Two example goals.
  await step(page, 2, 'Your goals');
  await page.getByLabel(/^Deliver every order on time\./).check();
  await page.getByLabel(/^Keep customer data private\./).check();
  await saved(page);
  await expect(page.locator('.guided-step').nth(1)).not.toContainText('Done');
  await expect(page.locator('.guided-step').nth(0)).toContainText('Done');
  await next('loss you can take').click();

  // Step 3. The guided questions give 4 tolerance points.
  await step(page, 3, 'How much loss you can take');
  await page.getByRole('button', { name: 'Start the guided questions' }).click();
  const panel = page.locator('section[aria-labelledby="guided-title"]');
  const stageNext = panel.getByRole('button', { name: 'Next', exact: true });
  await page.getByLabel('Or type the amount (EUR)').fill('1500000');
  await stageNext.click();
  await stageNext.click();
  for (const name of ['Not accept', 'Accept', 'Accept', 'Not accept', 'Accept', 'Not accept', 'Not accept', 'Accept', 'Accept', 'Not accept', 'Not accept', 'Accept'] as const) {
    await panel.getByRole('button', { name, exact: true }).click();
  }
  await expect(panel.getByText('All 4 points have an answer.')).toBeFocused();
  await stageNext.click();
  await stageNext.click();
  await panel.getByLabel('Who took part').fill('Managing director and finance lead');
  await panel.getByRole('button', { name: 'Use these answers' }).click();
  await saved(page);
  await expect(page.getByRole('table', { name: 'Your tolerance curve now' }).locator('tbody tr')).toHaveCount(4);
  await expectAccessible(page, 'guided step 3');
  await next('your risks').click();

  // Step 4. 2 risks from the catalogue, 1 of them positive, and 3 own risks.
  await step(page, 4, 'Your risks');
  const catalogue = page.getByLabel('Pick a risk from the catalogue');
  const fromCatalogue = page.getByRole('button', { name: 'Add from the catalogue' });
  await catalogue.selectOption('61');
  await fromCatalogue.click();
  await catalogue.selectOption('OPP-3');
  await fromCatalogue.click();
  for (const text of [
    'If ransomware encrypts the order system, then deliveries stop for days.',
    'If the payment provider fails, then card orders stop.',
    'If a phishing mail changes a supplier bank account, then we pay a fraudster.',
  ]) {
    await page.getByLabel('Or describe your own risk').fill(text);
    await page.getByRole('button', { name: 'Add your risk' }).click();
  }
  await saved(page);
  const risks = page.getByRole('table', { name: 'Your risks' });
  await expect(risks.locator('tbody tr')).toHaveCount(5);
  await expect(risks.getByRole('row', { name: /^R-2 / })).toContainText('Opportunity');
  await expect(page.locator('.guided-missing')).toHaveCount(0);
  await expectAccessible(page, 'guided step 4');
  await next('size each risk').click();

  // Step 5. One risk at a time.
  await step(page, 5, 'Size each risk');
  const inputs: readonly RiskInput[] = [
    { owner: 'Managing director', objective: 'OBJ-2', frequency: [0.02, 0.2], impact: [10_000, 250_000] },
    { owner: 'IT lead', objective: 'OBJ-1', frequency: [0.5, 2], impact: [3_000, 20_000] },
    { owner: 'IT lead', objective: 'OBJ-1', frequency: [0.05, 0.3], impact: [40_000, 600_000] },
    { owner: 'Finance lead', objective: 'OBJ-1', frequency: [0.2, 1], impact: [2_000, 30_000] },
    { owner: 'Finance lead', objective: 'OBJ-2', frequency: [0.1, 0.6], impact: [5_000, 80_000] },
  ];
  for (const [i, input] of inputs.entries()) {
    await sizeRisk(page, i + 1, input);
    if (i === 0) {
      await expectAccessible(page, 'guided step 5');
      await narrow(page);
    }
  }
  await expect(page.locator('.guided-missing')).toHaveCount(0);
  await next('shared causes').click();

  // Step 6. 1 shared cause with 2 links.
  await step(page, 6, 'Shared causes');
  await page.getByRole('button', { name: 'Add a driver' }).click();
  await page.getByText(/^D-1 New driver/).click();
  await page.locator('#driver-0-name').fill('Cloud hosting outage');
  await page.locator('#driver-0-kind').selectOption('supplier');
  await page.locator('#driver-0-frequency-lower').fill('0.1');
  await page.locator('#driver-0-frequency-upper').fill('0.8');
  await page.locator('#driver-0-rationale').fill('The provider had three regional outages in five years.');
  await page.getByLabel(/^R-3 If ransomware/).check();
  await page.getByLabel('Chance that one event of D-1 causes R-3 (0 to 1)').fill('0.3');
  await page.getByLabel(/^R-4 If the payment provider/).check();
  await page.getByLabel('Chance that one event of D-1 causes R-4 (0 to 1)').fill('0.6');
  await saved(page);
  await expect(page.getByText('D-1 Cloud hosting outage, linked to 2 risks')).toBeVisible();
  await expectAccessible(page, 'guided step 6');
  await next('what you can do').click();

  // Step 7. 2 response options.
  await step(page, 7, 'What you can do');
  await addOption(page, 1, 'Offline backups with restore tests', 'risk|R-3', [12_000, 4_000, 3], [10_000, 150_000]);
  await addOption(page, 2, 'Call-back check for bank account changes', 'risk|R-5', [1_000, 2_000, 3], [1_000, 20_000]);
  await expect(page.locator('.guided-missing')).toHaveCount(0);
  await next('budget and best plan').click();

  // Step 8. The budget and the optimization.
  await step(page, 8, 'Budget and best plan');
  await page.getByLabel('Cash you can spend in the first year (EUR)').fill('40000');
  await saved(page);
  await page.getByRole('button', { name: 'Find the best portfolio' }).click();
  await expect(page.getByRole('region', { name: 'Ranked portfolios' }).getByRole('row', { name: /^Best O-/ })).toBeVisible({ timeout: 60_000 });
  await expect(page.locator('.guided-missing')).toHaveCount(0);
  await expectAccessible(page, 'guided step 8');
  await narrow(page);
  // Steps 1 to 8 are done, the optional step 6 too.
  for (const i of [0, 1, 2, 3, 4, 5, 6]) await expect(page.locator('.guided-step').nth(i)).toContainText('Done');
  // Step 8 has no record on the page, so it offers no print.
  await expect(page.getByRole('button', { name: 'Print the decision record' })).toHaveCount(0);
  // A number field with text that is not a number keeps the step open.
  const budget = page.getByLabel('Cash you can spend in the first year (EUR)');
  await budget.fill('40k');
  await next('decision record').click();
  await expect(page.getByRole('alert')).toContainText('Correct the number fields');
  await expect(page.locator('.guided-eyebrow')).toHaveText('Step 8 of 9');
  await budget.fill('40000');
  await saved(page);
  await next('decision record').click();

  // Step 9. The record and the print.
  await step(page, 9, 'Decision record');
  const record = page.locator('article.record');
  await expect(record.getByRole('heading', { level: 3, name: '04 Funded portfolio' })).toBeVisible();
  await expectAccessible(page, 'guided step 9');
  await narrow(page);
  await page.emulateMedia({ media: 'print' });
  await expect(page.locator('.guided-nav')).toBeHidden();
  await expect(page.locator('.guided-foot')).toBeHidden();
  await expect(record).toBeVisible();
  const pdf = await page.pdf({ preferCSSPageSize: true, printBackground: true });
  const file = testInfo.outputPath('guided-decision-record.pdf');
  await writeFile(file, pdf);
  await testInfo.attach('guided-decision-record.pdf', { path: file, contentType: 'application/pdf' });
  expect((pdf.toString('latin1').match(/\/Type\s*\/Page(?![s\w])/g) ?? []).length).toBeLessThanOrEqual(2);
  await page.emulateMedia({ media: 'screen' });

  // The full editor opens the same document.
  await page.getByRole('button', { name: 'Open the full editor' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Context and strategy' })).toBeFocused();
  await expect(page.getByLabel('Objective 2 statement')).toHaveValue('Keep customer data private.');
  expect(problems, 'errors, warnings and CSP violations').toEqual([]);
});

test('the guided step list becomes a menu button at 375 px', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto('/');
  await page.getByLabel('Title', { exact: true }).fill('Phone register');
  await page.getByRole('button', { name: 'Create', exact: true }).click();
  await page.getByRole('button', { name: 'Guided mode', exact: true }).click();
  const menu = page.getByRole('button', { name: 'Step 1 of 9, Your company' });
  await expect(menu).toHaveAttribute('aria-expanded', 'false');
  await expect(page.locator('#guided-step-list')).toBeHidden();
  await menu.click();
  await expect(page.locator('#guided-step-list')).toBeVisible();
  await page.locator('.guided-step').nth(3).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Your risks' })).toBeFocused();
  await expect(page.locator('#guided-step-list')).toBeHidden();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(375);
  await expectAccessible(page, 'guided mode at 375 px');
});
