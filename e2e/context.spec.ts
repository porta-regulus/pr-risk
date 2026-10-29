import { readFileSync } from 'node:fs';
import { expect, type Page, test } from '@playwright/test';
import { expectAccessible } from './axe';

// Screen S2 under the production CSP. Golden test G2 parts (a) and (b), autosave, rule V-12,
// undo and the tolerance curve starting points.
interface Item {
  readonly kind?: string;
  readonly text: string;
}
interface Statement {
  readonly id: string;
  readonly appetite: string;
  readonly tolerances?: readonly Item[];
  readonly controls?: readonly string[];
  readonly indicators?: readonly Item[];
}
const example1 = JSON.parse(readFileSync(new URL('../docs/schema/examples/example-1-sp800-221r1-fig10-table9.json', import.meta.url), 'utf8')) as {
  appetite: { statements: Statement[] };
};
const statements = example1.appetite.statements;
const ofKind = (statement: Statement, kind: string): string[] => (statement.indicators ?? []).filter((item) => item.kind === kind).map((item) => item.text);
// The 6 rows of Table 9, written out here apart from the app code.
const expectedRows: ((statement: Statement) => string[])[] = [
  (statement) => [statement.appetite],
  (statement) => (statement.tolerances ?? []).map((item) => item.text),
  (statement) => [...(statement.controls ?? [])],
  (statement) => ofKind(statement, 'kpi'),
  (statement) => ofKind(statement, 'leading-kri'),
  (statement) => ofKind(statement, 'lagging-kri'),
];

async function check(page: Page, statement: string, values: Readonly<Record<string, number>>): Promise<void> {
  const box = page.locator(`[data-statement="${statement}"]`);
  for (const [metric, value] of Object.entries(values)) await box.getByLabel(new RegExp(`^${metric}`)).fill(String(value));
}

const result = (page: Page, statement: string) => page.locator(`[data-statement="${statement}"] .check-result`);

test('S2 shows Table 9, checks triggers, autosaves, refuses V-12 and undoes', async ({ page }) => {
  const problems: string[] = [];
  page.on('pageerror', (error) => problems.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error' || message.type() === 'warning') problems.push(message.text());
  });

  await page.goto('/');
  await page.getByRole('button', { name: 'NIST Fig. 10 and Table 9 (example 1)' }).click();
  await expect(page.getByRole('status').filter({ hasText: 'is open' })).toBeVisible();
  await page.getByRole('button', { name: 'Context and strategy' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Context and strategy' })).toBeFocused();
  await expect(page.getByText('Saved as version 1.')).toBeVisible();
  await expectAccessible(page, 'S2');

  // G2 (a). 6 rows by 3 examples, text equal to the fixture.
  const table = page.getByRole('table', { name: 'Appetite statements in the layout of Table 9' });
  await expect(table.locator('tbody tr')).toHaveCount(6);
  await expect(table.locator('thead th')).toHaveCount(1 + statements.length);
  for (const [row, items] of expectedRows.entries()) {
    for (const [column, statement] of statements.entries()) {
      const cell = table.locator('tbody tr').nth(row).locator('td').nth(column);
      const expected = items(statement);
      if (expected.length === 1) await expect(cell).toHaveText(expected[0] ?? '');
      else if (expected.length === 0) await expect(cell).toHaveText('None');
      else await expect(cell.locator('li')).toHaveText(expected);
    }
  }

  // G2 (b). Example 1 fires the leading KRI, the tolerance and the lagging KRI.
  await check(page, 'T9-EX1', { computers_unpatched_cvss10_over_10_days: 2, mission_critical_systems_unpatched_cvss10_over_14_days: 1, computers_unpatched_cvss10_over_15_days: 1 });
  await expect(result(page, 'T9-EX1').locator('li')).toHaveText(['Leading KRI T9-EX1-LKRI fires', 'Lagging KRI T9-EX1-GKRI fires', 'Tolerance T9-EX1-TOL is breached']);
  // Example 3. With one value missing, nothing is checked, and the screen says so.
  await check(page, 'T9-EX3', { outage_hours: 2.5 });
  await expect(result(page, 'T9-EX3')).toContainText('Not checked, because a value is missing. Leading KRI T9-EX3-LKRI1 needs customers_affected_percent');
  await expect(result(page, 'T9-EX3')).not.toContainText('Nothing fires');
  const ex3 = async (hours: number, percent: number): Promise<void> => {
    await check(page, 'T9-EX3', { outage_hours: hours, customers_affected_percent: percent });
  };
  await ex3(1.6, 6);
  await expect(result(page, 'T9-EX3').locator('li')).toHaveText(['Leading KRI T9-EX3-LKRI1 fires']);
  await ex3(2.5, 4);
  await expect(result(page, 'T9-EX3').locator('li')).toHaveText(['Leading KRI T9-EX3-LKRI2 fires']);
  await ex3(2.5, 6);
  await expect(result(page, 'T9-EX3').locator('li')).toHaveText(['Leading KRI T9-EX3-LKRI1 fires', 'Lagging KRI T9-EX3-GKRI fires', 'Tolerance T9-EX3-TOL is breached']);
  await ex3(2.5, 5);
  await expect(result(page, 'T9-EX3')).toContainText('Nothing fires.');
  await expect(result(page, 'T9-EX3')).toContainText('The value 5 of customers_affected_percent is in a boundary gap.');

  // Autosave of a context field.
  await page.getByLabel('Mission', { exact: true }).fill('Keep the plant running safely.');
  await expect(page.getByText('Saved as version 2.')).toBeVisible();

  // Capacity and the starting points of SPEC.md Sec. 8.9.
  await page.getByLabel('Capacity (USD)').fill('1000000');
  await page.getByLabel('Rationale for the capacity').fill('One year of free cash flow.');
  await page.getByRole('button', { name: 'Use the starting points from capacity' }).click();
  await expect(page.getByLabel('Point 1 loss')).toHaveValue('20000');
  await expect(page.getByLabel('Point 4 probability')).toHaveValue('0.01');
  await expect(page.getByText(/^Saved as version \d+\./)).toBeVisible();

  // Rule V-12. A probability that rises refuses the save and shows the rule.
  await page.getByLabel('Point 2 probability').fill('0.9');
  await expect(page.getByText('Not saved. Correct the errors below.')).toBeVisible();
  await expect(page.locator('.errors')).toContainText('V-12');
  await page.getByLabel('Point 2 probability').fill('0.2');
  await expect(page.getByText(/^Saved as version \d+\./)).toBeVisible();

  // Text that is not a number refuses the save, and leaving is refused until it is discarded.
  await page.getByLabel('Capacity (USD)').fill('1e');
  await expect(page.getByText('Not saved. These fields do not hold a number: Capacity (USD).')).toBeVisible();
  await page.getByRole('button', { name: 'Back to start' }).click();
  await expect(page.getByText('Correct the changes, or discard them, before you go to another screen.')).toBeVisible();
  await page.getByRole('button', { name: 'Discard unsaved changes' }).click();
  await expect(page.getByLabel('Capacity (USD)')).toHaveValue('1000000');
  await expect(page.getByText(/^Saved as version \d+\./)).toBeVisible();

  // Leaving at once after an edit saves the edit first.
  await page.getByLabel('Mission', { exact: true }).fill('Keep the plant safe.');
  await page.getByRole('button', { name: 'Back to start' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'PortaRegulus Risk' })).toBeVisible();

  // The edits survive a reload.
  await page.reload();
  await page.getByRole('button', { name: 'Context and strategy' }).click();
  await expect(page.getByLabel('Mission', { exact: true })).toHaveValue('Keep the plant safe.');
  await expect(page.getByLabel('Capacity (USD)')).toHaveValue('1000000');

  // Undo goes back one saved version at a time.
  const version = Number((await page.getByText(/^Saved as version \d+\./).textContent())?.match(/\d+/)?.[0]);
  await page.getByRole('button', { name: 'Undo last change' }).click();
  await expect(page.getByText(`Version ${String(version - 1)} is back.`)).toBeVisible();

  await page.getByRole('button', { name: 'Back to start' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'PortaRegulus Risk' })).toBeVisible();
  expect(problems, 'errors, warnings and CSP violations').toEqual([]);
});

// SPEC.md Sec. 6.5 item 4. The five pairs of SP 800-221r1 Table 2 are templates for a statement.
test('S2 adds a statement from a Table 2 template', async ({ page }) => {
  await page.goto('/');
  await page.getByLabel('Title', { exact: true }).fill('Template check');
  await page.getByRole('button', { name: 'Create', exact: true }).click();
  await expect(page.getByRole('status').filter({ hasText: 'is created.' })).toBeVisible();
  await page.getByRole('button', { name: 'Context and strategy' }).click();
  await page.getByText('Examples from SP 800-221r1 Table 2').click();
  await expectAccessible(page, 'S2 with the Table 2 examples open');
  await page.getByRole('button', { name: 'Use the Government Agency example as a new statement' }).click();
  const table = page.getByRole('table', { name: 'Appetite statements in the layout of Table 9' });
  await expect(table).toContainText('Mission-critical systems must be protected from known ICT vulnerabilities.');
  await expect(table).toContainText('within 14 days of discovery');
  await expect(page.getByText(/^Saved as version \d+\./)).toBeVisible();
});
