import { readFileSync } from 'node:fs';
import { expect, type Page, test } from '@playwright/test';
import { parseCsv } from '../src/import/csv';
import type { RiskDocument } from '../src/schema/types';
import { expectAccessible } from './axe';
import { unfold } from './fold';

// Screen S7 Enterprise view under the production CSP (build task 7). Golden tests G1 (b), G3 and
// G5 of SPEC.md Sec. 12.2, with the axe check and the 375 px width.

const EXAMPLE_1 = 'Enterprise register in words (example 1)';
const EXAMPLE_3 = 'Registers from other tools (example 3)';

function watchProblems(page: Page): string[] {
  const problems: string[] = [];
  page.on('pageerror', (error) => problems.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error' || message.type() === 'warning') problems.push(message.text());
  });
  return problems;
}

async function expectNoOverflow(page: Page): Promise<void> {
  const size = page.viewportSize();
  await page.setViewportSize({ width: 375, height: 812 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(375);
  if (size !== null) await page.setViewportSize(size);
}

async function open(page: Page, example: string, screen: string): Promise<void> {
  await page.goto('/');
  await page.getByRole('button', { name: example }).click();
  await expect(page.getByRole('status').filter({ hasText: 'is open' })).toBeVisible();
  await page.getByRole('button', { name: screen }).click();
  await expect(page.getByRole('heading', { level: 1, name: screen })).toBeFocused();
}

const example1 = JSON.parse(readFileSync(new URL('../docs/schema/examples/example-1-sp800-221r1-fig10-table9.json', import.meta.url), 'utf8')) as RiskDocument;

// Golden test G1 part (b). The ERR view of example 1 renders 10 rows, and every cell text equals
// the CSV fixture of Fig. 10. A response cell has one line per line of the CSV cell. S4 shows
// the same view for registers without a simulation.
for (const screen of ['Enterprise view', 'Prioritize']) {
  test(`G1 (b). ${screen} shows the register ERR of example 1 in the layout of Fig. 10, equal to the CSV`, async ({ page }) => {
    const problems = watchProblems(page);
    const rows = parseCsv(readFileSync(new URL('../docs/schema/fixtures/sp800-221r1-fig10.csv', import.meta.url), 'utf8'), ',');
    const [header, ...body] = rows.filter((row) => row.some((cell) => cell.trim() !== ''));
    await open(page, EXAMPLE_1, screen);
    await expect(page.getByLabel('Register', { exact: true })).toHaveValue('ERR');
    const table = page.locator('table.err');
    await expect(table.locator('thead th')).toHaveText(header ?? []);
    await expect(table.locator('tbody tr')).toHaveCount(10);
    expect(body).toHaveLength(10);
    for (const [r, row] of body.entries()) {
      const cells = table.locator('tbody tr').nth(r).locator('td');
      for (const [c, text] of row.entries()) {
        const lines = text.split(/\r?\n/).map((line) => line.trim()).filter((line) => line !== '');
        if (lines.length > 1) await expect(cells.nth(c).locator('.line')).toHaveText(lines);
        else await expect(cells.nth(c)).toHaveText(text.trim());
      }
    }
    await expectAccessible(page, `${screen} of example 1 with the Fig. 10 view`);
    expect(problems).toEqual([]);
  });
}

// Fig. 11 (p. 42, line 1382). Fig. 11 prints "Medum" for the residual impact of F11-2.
const FIG_11 = {
  'F11-1': { impact: ['High', 'Medium', 'Medium'], likelihood: ['Low', 'Low', 'Low'] },
  'F11-2': { impact: ['High', 'High', 'Medium'], likelihood: ['Medium', 'Medium', 'Low'] },
  'F11-3': { impact: ['High', 'High', 'Medium'], likelihood: ['Medium', 'Medium', 'Medium'] },
} as const;

test('G5. S7 shows the profile of example 1 by objective in the layout of Fig. 11', async ({ page }) => {
  const problems = watchProblems(page);
  await open(page, EXAMPLE_1, 'Enterprise view');
  await unfold(page, /^Enterprise risk profile by objective/);
  const scope = page.getByLabel('Registers in the profile');
  await expect(scope).toHaveValue('');
  const blocks = page.locator('.erp-block');
  await expect(blocks.locator('.erp-kind')).toHaveText(['OPERATIONS OBJECTIVE', 'REPORTING OBJECTIVE', 'OPERATIONS OBJECTIVE']);
  await expect(blocks.locator('.erp-statement')).toHaveText((example1.context?.objectives ?? []).map((objective) => objective.statement));
  for (const [riskId, expected] of Object.entries(FIG_11)) {
    const risk = example1.risks.find((item) => item.riskId === riskId);
    const body = page.locator(`tbody[data-risk="${riskId}"]`);
    await expect(body.locator('tr[data-factor="impact"] th')).toHaveText('Impact');
    await expect(body.locator('tr[data-factor="impact"] td.assessed')).toHaveText([...expected.impact]);
    await expect(body.locator('tr[data-factor="likelihood"] th')).toHaveText('Likelihood');
    await expect(body.locator('tr[data-factor="likelihood"] td.assessed')).toHaveText([...expected.likelihood]);
    await expect(body.locator('td.current-response')).toHaveText(risk?.detail?.implementedResponseDescription ?? 'missing');
    await expect(body.locator('td.proposed-response')).toHaveText(risk?.riskResponseDescription ?? 'missing');
    await expect(body.locator('td.owner')).toHaveText(risk?.riskOwnerPointOfContact ?? 'missing');
  }
  await expect(page.locator('table.portfolio tr[data-register="all"] td.current')).toHaveText('21,750,000');
  await expect(page.locator('table.portfolio tr[data-register="ERP11"] td.previous')).toHaveText('11,000,000');
  await expectAccessible(page, 'S7 of example 1');
  await expectNoOverflow(page);

  await scope.selectOption('ERR');
  await expect(blocks).toHaveCount(0);
  await expect(page.getByText('L-09 1, 2, 3, 4, 5, 6, 7, 9, 10 support no objective', { exact: false })).toBeVisible();
  expect(problems).toEqual([]);
});

test('S7 shows the simulated expected annual loss of example 2 with its standard error', async ({ page }) => {
  const problems = watchProblems(page);
  await open(page, 'SME with numbers (example 2)', 'Enterprise view');
  await unfold(page, 'Portfolio by register and period');
  const corp = page.locator('table.portfolio tr[data-register="CORP"] td.current');
  await expect(corp.locator('.se')).toHaveText(/^Simulated, standard error [\d,]+$/, { timeout: 30_000 });
  const eal = Number((await corp.evaluate((cell) => cell.firstChild?.textContent ?? '')).replaceAll(',', ''));
  expect(Math.abs(eal - 229_648) / 229_648).toBeLessThan(0.05);
  await expect(page.locator('table.portfolio tr[data-register="PROD-A"] td.current .se')).toBeVisible();
  await expect(page.locator('table.entries tr[data-risk="R-07"] .note')).toHaveText('Escalate. At or above the escalation threshold.');
  await expect(page.getByText(/^Simulation of document [0-9a-f]{12}, seed /)).toBeVisible();
  await expectAccessible(page, 'S7 of example 2');
  expect(problems).toEqual([]);
});

// Combined description quoted from SP 800-221r1 lines 1624 to 1625.
const ORG_1 = 'External malicious party uses malicious code to exfiltrate sensitive business-related documents.';

async function merge(page: Page, layout: string, added: string, cost = 'Total of the sources'): Promise<void> {
  for (const id of ['A-1', 'B-1', 'C-1']) await page.getByRole('checkbox', { name: `Select ${id}` }).check();
  await expect(page.getByLabel('Id of the summary entry')).toHaveValue('ORG-1');
  await expect(page.getByLabel('Risk owner')).toHaveValue('Business unit risk manager');
  await page.getByLabel('Combined risk description').fill(ORG_1);
  await page.getByLabel('Different responses').selectOption({ label: layout });
  await page.getByLabel('Response cost').selectOption({ label: cost });
  await page.getByRole('button', { name: 'Merge the 3 selected entries', exact: true }).click();
  await expect(page.getByRole('status').filter({ hasText: added })).toBeVisible();
  await expect(page.locator('section[aria-labelledby="normalize-title"] ul.errors')).toHaveCount(0);
}

const sourcesOf = (page: Page, id: string) => page.locator(`table.summaries tr[data-risk="${id}"] [data-source]`);

test('G3. S7 merges A-1, B-1 and C-1 of example 3 with both layouts of Table 10', async ({ page }) => {
  const problems = watchProblems(page);
  await open(page, EXAMPLE_3, 'Enterprise view');
  await expect(page.getByLabel('Parent register')).toHaveValue('ORG');
  await expect(page.locator('table.entries[data-category="ict"] tbody tr')).toHaveCount(6);
  await expect(page.locator('table.entries tr[data-risk="A-1"] .note')).toHaveText('In ORG-1');
  const warning = page.locator('.warnings').filter({ hasText: 'L-10 ORG-1' });
  await expect(warning).toBeVisible();

  // Review finding 1. An entry that ORG-1 holds cannot go into a second summary, so the
  // portfolio never counts it twice.
  for (const id of ['A-1', 'B-1', 'C-1']) await expect(page.getByRole('checkbox', { name: `Select ${id}` })).toBeDisabled();
  await expect(page.locator('table.portfolio tr[data-register="ORG"] td.current')).toHaveText('310,000');

  // Review finding 2. An entry with placeholder numbers (rule D-Q2) cannot go into a merge.
  const errors = page.locator('section[aria-labelledby="normalize-title"] ul.errors');
  await page.getByRole('checkbox', { name: 'Select GW-1' }).check();
  await page.getByLabel('Combined risk description').fill('Gateway X1 vulnerabilities.');
  await page.getByRole('button', { name: 'Merge the selected entry', exact: true }).click();
  await expect(errors).toHaveText('GW-1 has no estimate yet. Estimate it on the screen Identify and analyze, or do not select it.');
  await expect(page.locator('table.summaries tbody tr')).toHaveCount(1);
  await page.getByRole('checkbox', { name: 'Select GW-1' }).uncheck();

  await page.getByRole('button', { name: 'Remove ORG-1', exact: true }).click();
  await expect(page.getByText('This register has no summary entry.')).toBeVisible();
  await expect(page.locator('table.entries tr[data-risk="A-1"] .note')).toHaveText('');

  // (b) and (e). One row with all responses.
  await merge(page, 'One row with all responses', 'ORG-1 is added to Business unit risk register.');
  const org1 = page.locator('table.summaries tr[data-risk="ORG-1"]');
  await expect(org1.locator('.description')).toHaveText(ORG_1);
  await expect(sourcesOf(page, 'ORG-1')).toHaveCount(3);
  expect(await sourcesOf(page, 'ORG-1').evaluateAll((items) => items.map((item) => item.getAttribute('data-source')))).toEqual(['A-1', 'B-1', 'C-1']);
  await expect(org1.locator('.types')).toHaveText('Mitigate, Accept');
  await expect(org1.locator('.likelihood')).toHaveText('0.1000, 0.2000, 0.3000');
  await expect(org1.locator('.impact')).toHaveText('400,000, 800,000, 2,000,000');
  await expect(org1.locator('.cost .sub')).toHaveText('Total of the sources');
  await expect(warning).toBeVisible();
  await expect(page.getByText(/^Saved as version \d+\./)).toBeVisible();
  await expectAccessible(page, 'S7 of example 3 with a summary entry');

  // (c) and (d). One row per response, with the n = 2 and n = 1 rules of Sec. 8.15.
  await org1.getByRole('button', { name: 'Remove ORG-1', exact: true }).click();
  await merge(page, 'One row per response', 'ORG-1 and ORG-1.2 are added to Business unit risk register.', 'Average weighted by exposure rating');
  const mitigate = page.locator('table.summaries tr[data-risk="ORG-1"]');
  const accept = page.locator('table.summaries tr[data-risk="ORG-1.2"]');
  await expect(mitigate.locator('.types')).toHaveText('Mitigate');
  await expect(sourcesOf(page, 'ORG-1')).toHaveCount(2);
  expect(await sourcesOf(page, 'ORG-1').evaluateAll((items) => items.map((item) => item.getAttribute('data-source')))).toEqual(['A-1', 'B-1']);
  await expect(mitigate.locator('.likelihood')).toHaveText('0.1000, 0.2000, 0.3000');
  await expect(mitigate.locator('.impact')).toHaveText('400,000, 1,200,000, 2,000,000');
  await expect(accept.locator('.types')).toHaveText('Accept');
  expect(await sourcesOf(page, 'ORG-1.2').evaluateAll((items) => items.map((item) => item.getAttribute('data-source')))).toEqual(['C-1']);
  await expect(accept.locator('.likelihood')).toHaveText('0.2000, 0.2000, 0.2000');
  await expect(accept.locator('.impact')).toHaveText('800,000, 800,000, 800,000');
  await expect(mitigate.locator('.cost .sub')).toHaveText('Average weighted by exposure rating');
  await expect(page.locator('.warnings').filter({ hasText: 'L-10' })).toHaveCount(0);
  await expect(page.locator('table.entries tr[data-risk="C-1"] .note')).toHaveText('In ORG-1.2');
  await expectNoOverflow(page);

  // The saved merge is there after the editor navigation goes to another screen and back.
  await expect(page.getByText(/^Saved as version \d+\./)).toBeVisible();
  await page.getByRole('button', { name: 'Identify and analyze', exact: true }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Identify and analyze' })).toBeFocused();
  await page.getByRole('button', { name: 'Enterprise view', exact: true }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Enterprise view' })).toBeFocused();
  await expect(page.locator('table.summaries tbody tr')).toHaveCount(2);
  expect(problems).toEqual([]);
});

test('S7 closes the period of example 1, the portfolio shows the previous labels, and undo takes the close back', async ({ page }) => {
  const problems = watchProblems(page);
  await open(page, EXAMPLE_1, 'Enterprise view');
  const err = page.locator('table.portfolio tr[data-register="ERR"]');
  await expect(err.locator('td.reputation')).toHaveText('High');
  await expect(err.locator('td.reputation-previous')).toHaveText('No label');
  await expect(err.locator('td.mission-previous')).toHaveText('No label');

  await page.getByLabel('Registers', { exact: true }).selectOption({ label: 'Notional Enterprise Risk Register' });
  await page.getByLabel('End of the period').fill('2026-10-31');
  await page.getByRole('button', { name: 'Close the period for 9 open risks', exact: true }).click();
  await expect(page.getByRole('status').filter({ hasText: 'The current assessment of 9 risks is now the previous period, as of 2026-10-31.' })).toBeVisible();
  await expect(page.getByText(/^Saved as version \d+\./)).toBeVisible();
  await expect(err.locator('td.reputation-previous')).toHaveText('High');
  await expect(err.locator('td.mission-previous')).toHaveText('High');
  // Numbers that come from labels are not copied, so the financial previous period stays empty.
  await expect(err.locator('td.previous')).toHaveText('Not recorded');
  await expectAccessible(page, 'S7 after the close of a period');
  await expectNoOverflow(page);

  await page.getByRole('button', { name: 'Undo last change', exact: true }).click();
  await expect(page.getByRole('status').filter({ hasText: /Version \d+ is back\./ })).toBeVisible();
  await expect(err.locator('td.reputation-previous')).toHaveText('No label');
  expect(problems).toEqual([]);
});
