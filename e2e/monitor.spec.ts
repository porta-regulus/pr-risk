import { expect, type Page, test } from '@playwright/test';
import { expectAccessible } from './axe';

// Screen S6 Monitor and adjust under the production CSP (build task 6). Golden test G2 (b) on
// recorded observations, the automatic review triggers, acceptance records, the tolerance
// what-if and the forecast log. The clock is fixed, so the windows of example 2 do not depend
// on the run date.

function watchProblems(page: Page): string[] {
  const problems: string[] = [];
  page.on('pageerror', (error) => problems.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error' || message.type() === 'warning') problems.push(message.text());
  });
  return problems;
}

async function record(page: Page, statement: string, values: Readonly<Record<string, number>>): Promise<void> {
  const box = page.locator(`[data-statement="${statement}"]`);
  for (const [metric, value] of Object.entries(values)) await box.getByLabel(new RegExp(`^${metric}`)).fill(String(value));
  await box.getByRole('button', { name: `Record the observation of ${statement}` }).click();
}

const state = (page: Page, statement: string, item: string) => page.locator(`[data-statement="${statement}"] tr[data-item="${item}"] .item-state`);

async function expectStates(page: Page, statement: string, states: Readonly<Record<string, string>>): Promise<void> {
  for (const [item, text] of Object.entries(states)) await expect(state(page, statement, item), item).toHaveText(text);
}

// The change log entries that the app wrote itself, from the stored documents.
async function appEntries(page: Page): Promise<string[]> {
  return page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const open = indexedDB.open('pr-risk');
      open.onsuccess = () => {
        resolve(open.result);
      };
      open.onerror = () => {
        reject(new Error(String(open.error)));
      };
    });
    const stored = await new Promise<{ doc: { changeLog?: { actor?: string; entityId: string }[] } }[]>((resolve, reject) => {
      const all = db.transaction('documents').objectStore('documents').getAll();
      all.onsuccess = () => {
        resolve(all.result as { doc: { changeLog?: { actor?: string; entityId: string }[] } }[]);
      };
      all.onerror = () => {
        reject(new Error(String(all.error)));
      };
    });
    db.close();
    return stored.flatMap((item) => (item.doc.changeLog ?? []).filter((entry) => entry.actor?.startsWith('PortaRegulus Risk (automatic review)') === true).map((entry) => `${entry.entityId} ${entry.actor ?? ''}`));
  });
}

async function expectNoOverflow(page: Page): Promise<void> {
  const size = page.viewportSize();
  await page.setViewportSize({ width: 375, height: 812 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(375);
  if (size !== null) await page.setViewportSize(size);
}

test('S6 evaluates the Table 9 triggers on recorded observations (G2 b) and starts reviews itself', async ({ page }) => {
  const problems = watchProblems(page);
  await page.clock.setFixedTime(new Date('2026-10-30T09:00:00Z'));
  await page.goto('/');
  await page.getByRole('button', { name: 'NIST Fig. 10 and Table 9 (example 1)' }).click();
  await page.getByRole('button', { name: 'Monitor and adjust' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Monitor and adjust' })).toBeFocused();
  await expect(state(page, 'T9-EX1', 'T9-EX1-LKRI')).toHaveText('No data');
  await expect(page.getByText('No review trigger holds today.')).toBeVisible();
  await expectAccessible(page, 'S6 of example 1');

  // Example 1. 2 computers above 10 days, 1 mission-critical system above 14, 1 computer above 15.
  await record(page, 'T9-EX1', { computers_unpatched_cvss10_over_10_days: 2, mission_critical_systems_unpatched_cvss10_over_14_days: 1, computers_unpatched_cvss10_over_15_days: 1 });
  await expectStates(page, 'T9-EX1', { 'T9-EX1-TOL': 'Breached', 'T9-EX1-LKRI': 'Fires', 'T9-EX1-GKRI': 'Fires', 'T9-EX1-KPI': 'Not checked' });
  await expect(page.getByText(/^Saved as version \d+\./)).toBeVisible();

  // Example 3, in the order of Table 9. T9-EX3 covers ict and operational. LKRI1 fires, so the
  // app sets the open operational risks to Review needed after the save. Risk 8 is closed.
  const none = { 'T9-EX3-TOL': 'Not breached', 'T9-EX3-LKRI1': 'Does not fire', 'T9-EX3-LKRI2': 'Does not fire', 'T9-EX3-GKRI': 'Does not fire' };
  const review = page.getByRole('region', { name: 'Risks with a review trigger' });
  const statuses = review.locator('tbody td:nth-child(3)');
  const operational = ['1', '2', '3', '4', 'F11-1', 'F11-3'];
  await record(page, 'T9-EX3', { outage_hours: 1.6, customers_affected_percent: 6 });
  await expectStates(page, 'T9-EX3', { ...none, 'T9-EX3-LKRI1': 'Fires' });
  await expect(page.getByText('The app set 1, 2, 3, 4, F11-1, F11-3 to Review needed. Undo last change takes this back.')).toBeVisible();
  await expect(review.locator('tbody th')).toHaveText(operational);
  await expect(statuses).toHaveText(operational.map(() => 'Review needed'));
  await expect(page.getByText(/^Saved as version \d+\./)).toBeVisible();
  expect(await appEntries(page)).toEqual(operational.map((id) => `${id} PortaRegulus Risk (automatic review). T9-EX3-LKRI1 of appetite statement T9-EX3 fires on the observation of 2026-10-30.`));

  // Undo takes the change back, and the same reason does not act again in this visit.
  await page.getByRole('button', { name: 'Undo last change' }).click();
  await expect(page.getByText(/Version \d+ is back\./)).toBeVisible();
  await expect(statuses).toHaveText(operational.map(() => 'Open'));
  await page.waitForTimeout(1_000);
  await expect(statuses).toHaveText(operational.map(() => 'Open'));
  await expect(page.getByText(/^Saved as version \d+\. Version \d+ is back\./)).toBeVisible();
  await expect(page.getByText(/^The app set/)).toHaveCount(0);
  expect(await appEntries(page)).toEqual([]);

  // A new reason acts. LKRI2 fires on the next observation.
  await record(page, 'T9-EX3', { outage_hours: 2.5, customers_affected_percent: 4 });
  await expectStates(page, 'T9-EX3', { ...none, 'T9-EX3-LKRI2': 'Fires' });
  await expect(statuses).toHaveText(operational.map(() => 'Review needed'));
  await expect(page.getByText(/^Saved as version \d+\./)).toBeVisible();
  expect(await appEntries(page)).toHaveLength(operational.length);
  // The status is Review needed already, so the next reason writes nothing.
  await record(page, 'T9-EX3', { outage_hours: 2.5, customers_affected_percent: 6 });
  await expectStates(page, 'T9-EX3', { ...none, 'T9-EX3-LKRI1': 'Fires', 'T9-EX3-GKRI': 'Fires', 'T9-EX3-TOL': 'Breached' });
  await expect(review.locator('tbody tr').first()).toContainText('T9-EX3-LKRI1 and T9-EX3-GKRI of appetite statement T9-EX3 fire on the observation of 2026-10-30.');
  await expect(page.getByText(/^Saved as version \d+\./)).toBeVisible();
  expect(await appEntries(page)).toHaveLength(operational.length);

  // At 5 percent nothing fires, and the screen flags the boundary gap of Table 9.
  await record(page, 'T9-EX3', { outage_hours: 2.5, customers_affected_percent: 5 });
  await expectStates(page, 'T9-EX3', none);
  await expect(page.locator('[data-statement="T9-EX3"] .banner')).toContainText('The latest value 5 of customers_affected_percent is in a boundary gap.');
  await expect(page.getByText('No review trigger holds today.')).toBeVisible();
  await expectAccessible(page, 'S6 with a boundary gap');
  await expectNoOverflow(page);

  // The observations survive a reload.
  await expect(page.getByText(/^Saved as version \d+\./)).toBeVisible();
  await page.reload();
  await page.getByRole('button', { name: 'Monitor and adjust' }).click();
  await expectStates(page, 'T9-EX1', { 'T9-EX1-TOL': 'Breached' });
  await expect(page.locator('[data-statement="T9-EX3"] .banner')).toBeVisible();
  expect(problems).toEqual([]);
});

test('S6 tests a tolerance curve, freezes forecasts and scores them after the window', async ({ page }) => {
  const problems = watchProblems(page);
  await page.clock.setFixedTime(new Date('2026-10-30T09:00:00Z'));
  await page.goto('/');
  await page.getByRole('button', { name: 'SME with numbers (example 2)' }).click();
  // The editor navigation reaches S6 too.
  await page.getByRole('button', { name: 'Prioritize' }).click();
  await page.getByRole('navigation', { name: 'Screens' }).getByRole('button', { name: 'Monitor and adjust' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Monitor and adjust' })).toBeFocused();

  // KRI-1 of example 2 fires (210 days since the last restore test), so on opening the app sets
  // the ict risks to Review needed.
  await expect(state(page, 'AP-1', 'KRI-1')).toHaveText('Fires');
  await expect(page.getByText('The app set R-01, R-02, R-03, R-04, R-07, R-08, R-09 to Review needed. Undo last change takes this back.')).toBeVisible();
  const acceptances = page.getByRole('region', { name: 'Acceptance records' });
  await expect(acceptances.getByRole('row', { name: /^R-05/ })).toContainText('Valid');

  // The what-if uses the kept totals of one run.
  await expect(page.getByText('Simulated with 100,000 trials.')).toBeVisible({ timeout: 30_000 });
  const result = page.getByRole('region', { name: 'What-if result' });
  await expect(result.getByRole('row', { name: /^Status/ })).toHaveText(/Clear breach.*Clear breach/);
  // An empty field shows the problem and keeps the screen working.
  await page.getByLabel('What-if point 2 loss').fill('');
  await expect(page.getByText('The loss of point 2 must be more than 0.')).toBeVisible();
  await expect(result.getByRole('row', { name: /^Status/ })).toHaveText(/Clear breach.*Not valid/);
  await page.getByLabel('What-if point 2 loss').fill('250000');
  for (const [i, p] of [0.99, 0.4, 0.1, 0.02].entries()) await page.getByLabel(`What-if point ${String(i + 1)} probability`).fill(String(p));
  await expect(result.getByRole('row', { name: /^Status/ })).toHaveText(/Clear breach.*Within tolerance/);
  await expect(page.getByRole('figure', { name: /against the what-if curve/ })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Save the what-if curve' })).toBeDisabled();
  await page.getByLabel('Changed by').fill('IT lead');
  await page.getByLabel('Reason for the change').fill('The board accepts more small losses.');
  await page.getByRole('button', { name: 'Save the what-if curve' }).click();
  await expect(page.getByText('The old curve is in the history.')).toBeVisible();
  await expect(page.getByRole('region', { name: 'Tolerance curve history' })).toContainText('The board accepts more small losses.');
  await expect(result.getByRole('row', { name: /^Status/ })).toHaveText(/Within tolerance.*Within tolerance/);

  // Freeze. R-01 has a frozen forecast for this window already, and R-09 exists only with O-3.
  const log = page.getByRole('region', { name: 'Forecast log' });
  await expect(log.locator('tbody tr')).toHaveCount(2);
  await page.getByRole('button', { name: 'Freeze 7 forecasts' }).click();
  await expect(log.locator('tbody tr')).toHaveCount(9);
  await expect(log.getByRole('row', { name: /^F-2027-R-02/ })).toContainText('2026-10-27 to 2027-10-26');
  await expect(page.getByRole('button', { name: 'Freeze 0 forecasts' })).toBeDisabled();
  await expect(page.getByRole('region', { name: 'Brier score', exact: true })).toContainText('Scores of 1 resolved forecast.');
  await expect(page.getByText(/^Saved as version \d+\./)).toBeVisible();
  await expectAccessible(page, 'S6 of example 2');
  await expectNoOverflow(page);

  // A year later the windows have ended. The acceptance of R-05 expired on 2027-10-20.
  await page.clock.setFixedTime(new Date('2027-11-01T09:00:00Z'));
  await page.getByRole('button', { name: 'Back to start' }).click();
  await page.getByRole('button', { name: 'Monitor and adjust' }).click();
  await expect(acceptances.getByRole('row', { name: /^R-05/ })).toContainText('Expired');
  await expect(page.getByRole('region', { name: 'Risks with a review trigger' })).toContainText('The acceptance expired on 2027-10-20.');
  await expect(page.getByText('The app set R-05 to Review needed. Undo last change takes this back.')).toBeVisible();
  await expect(log.getByRole('row', { name: /^F-2027-R-01/ })).toContainText('Due. Record the outcome.');
  const outcome = page.getByRole('group', { name: 'Outcome of F-2027-R-01' });
  await outcome.getByLabel('Did the event occur?').selectOption('yes');
  await outcome.getByLabel('Observed annual impact (optional)').fill('42000');
  await outcome.getByLabel('Evidence').fill('Incident report IR-7.');
  await expectAccessible(page, 'S6 with outcome forms');
  await outcome.getByRole('button', { name: 'Record the outcome of F-2027-R-01' }).click();
  await expect(log.getByRole('row', { name: /^F-2027-R-01/ })).toContainText('Occurred, recorded on 2027-11-01.');
  const brier = page.getByRole('region', { name: 'Brier score', exact: true });
  await expect(brier).toContainText('Scores of 2 resolved forecasts.');
  // (0.2186^2 + (1 - 0.1055)^2) / 2 = 0.4240. The stored F-2027-R-01 has no impact interval.
  await expect(brier.getByRole('row', { name: /^Brier score/ }).first()).toContainText('0.4240');
  await expect(brier.getByRole('row', { name: /^Hit rate/ })).toContainText('No resolved forecast has both an interval and an observed annual impact');
  // A frozen forecast has the 90% interval. No event means an annual impact of 0, inside it.
  const r02 = page.getByRole('group', { name: 'Outcome of F-2027-R-02' });
  await r02.getByLabel('Did the event occur?').selectOption('no');
  await r02.getByLabel('Observed annual impact (optional)').fill('0');
  await r02.getByRole('button', { name: 'Record the outcome of F-2027-R-02' }).click();
  await expect(brier).toContainText('Scores of 3 resolved forecasts.');
  await expect(brier.getByRole('row', { name: /^Hit rate/ })).toContainText('100.0%');
  await expect(page.getByText(/^Saved as version \d+\./)).toBeVisible();
  expect(problems).toEqual([]);
});
