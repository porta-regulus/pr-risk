import { readFileSync } from 'node:fs';
import { writeFile } from 'node:fs/promises';
import { expect, test, type Page } from '@playwright/test';
import { parseCsv } from '../src/import/csv';
import { expectAccessible } from './axe';

function watchProblems(page: Page): string[] {
  const problems: string[] = [];
  page.on('pageerror', (error) => problems.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error' || message.type() === 'warning') problems.push(message.text());
  });
  return problems;
}

async function openExample2(page: Page): Promise<void> {
  await page.goto('/');
  await page.getByRole('button', { name: 'SME with numbers (example 2)' }).click();
  await expect(page.getByRole('button', { name: 'Respond and optimize' })).toBeEnabled();
}

// Screen S4 under the production CSP. Example 2 simulates in the engine worker, and the
// numbers agree with SPEC.md Sec. 8.11 within Monte Carlo error (test/engine-decision.test.ts).
test('S4 shows the loss exceedance, the ranking and the display-only matrix of example 2', async ({ page }) => {
  const problems = watchProblems(page);
  await openExample2(page);
  await page.getByRole('button', { name: 'Prioritize' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Prioritize' })).toBeFocused();
  await expect(page.getByText('Simulated with 100,000 trials.')).toBeVisible();
  await expect(page.getByText(/^Roll-up of all registers/)).toContainText('Clear breach');
  await expect(page.getByRole('figure', { name: /Loss exceedance of the roll-up/ })).toBeVisible();
  const ranking = page.getByRole('region', { name: 'Risks by expected annual loss' });
  await expect(ranking.locator('tbody tr').first()).toContainText('R-01');
  await expect(page.getByText('Display only. Ranking and funding use the simulation (Cox 2008).')).toBeVisible();
  // R-09 exists only with O-3, so the matrix leaves it out.
  await expect(page.locator('table.matrix')).not.toContainText('R-09');
  await page.getByText('Override a priority').click();
  await expectAccessible(page, 'S4 of example 2');

  // The proposal ranks within each register. Example 2 has R-05 at 6, so the button applies 5.
  await page.getByRole('button', { name: 'Use the proposed priorities' }).click();
  await expect(page.getByText('The priorities are equal to the proposal.')).toBeVisible();
  await expect(page.getByText(/^Saved as version \d+\./)).toBeVisible();
  expect(problems).toEqual([]);
});

// Screen S5 and the decision record (build task 5, done criterion 4). The record of example 2
// shows every section of SPEC.md Sec. 4 and prints on 2 A4 pages at most.
test('S5 finds the best portfolio of example 2 and prints the decision record on 2 A4 pages', async ({ page }, testInfo) => {
  const problems = watchProblems(page);
  await openExample2(page);
  await page.getByRole('button', { name: 'Respond and optimize' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Respond and optimize' })).toBeFocused();
  await page.locator('summary', { hasText: /^O-4 Cyber insurance/ }).click();
  await expect(page.locator('#option-O-4-oneoff')).toBeVisible();
  await expectAccessible(page, 'S5 with an option editor open');

  await page.getByRole('button', { name: 'Find the best portfolio' }).click();
  const ranked = page.getByRole('region', { name: 'Ranked portfolios' });
  await expect(ranked.getByRole('row', { name: /^Best O-4, O-5/ })).toBeVisible({ timeout: 30_000 });
  await expect(ranked.getByRole('row', { name: /^Fiscal baseline O-1, O-3, O-4/ })).toBeVisible();
  await expect(ranked.getByRole('row', { name: /^Best at 72,000 O-1, O-4, O-5/ })).toBeVisible();

  const record = page.locator('article.record');
  await expect(record).toBeVisible();
  for (const heading of ['01 Summary', '02 Appetite', '03 Before and after', '04 Funded portfolio', '05 Alternatives', '06 Not funded', '07 Objectives view', '08 Accepted residual risk', '09 Approval', '10 Method note']) {
    await expect(record.getByRole('heading', { level: 3, name: heading })).toBeVisible();
  }
  await expect(record.getByText('Document hash', { exact: true })).toBeVisible();
  await expect(record.getByRole('row', { name: /^Fiscal baseline/ })).toBeVisible();
  await expect(record.getByRole('row', { name: /^Best at 48,000/ })).toBeVisible();
  await expect(record.getByText('Limits of these numbers', { exact: true })).toBeVisible();
  await expect(record).toContainText('Alternative of the funded option O-4');
  await expect(record).toContainText('Draft. 4 accepted residual risks need an acceptance record');
  await expectAccessible(page, 'S5 with the decision record');

  // At phone width the tables scroll in their boxes, and the page does not.
  const size = page.viewportSize();
  await page.setViewportSize({ width: 375, height: 812 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(375);
  if (size !== null) await page.setViewportSize(size);

  // The print view shows the record only, and it fits on 2 A4 pages.
  await page.emulateMedia({ media: 'print' });
  await expect(page.locator('.save-bar')).toBeHidden();
  await expect(page.getByRole('heading', { level: 2, name: 'Response options' })).toBeHidden();
  const pdf = await page.pdf({ preferCSSPageSize: true, printBackground: true });
  const file = testInfo.outputPath('decision-record.pdf');
  await writeFile(file, pdf);
  await testInfo.attach('decision-record.pdf', { path: file, contentType: 'application/pdf' });
  const pages = pdf.toString('latin1').match(/\/Type\s*\/Page(?![s\w])/g) ?? [];
  expect(pages.length).toBeGreaterThan(0);
  expect(pages.length).toBeLessThanOrEqual(2);
  // A reader without Helvetica, Arial or Liberation Sans gets a wider font. The record must
  // still fit. Verdana (macOS, Windows) and DejaVu Sans (Linux) are among the widest.
  await page.evaluate(() => {
    document.body.style.setProperty('font-family', 'Verdana, "DejaVu Sans", sans-serif', 'important');
  });
  const wide = await page.pdf({ preferCSSPageSize: true, printBackground: true });
  expect((wide.toString('latin1').match(/\/Type\s*\/Page(?![s\w])/g) ?? []).length).toBeLessThanOrEqual(2);
  await page.evaluate(() => {
    document.body.style.removeProperty('font-family');
  });
  await page.emulateMedia({ media: 'screen' });

  // An acceptance changes the document, so the record waits for a new run.
  await page.getByRole('button', { name: 'Record the acceptance of R-02' }).click();
  // An empty acceptance cannot be saved, so it can neither run nor print a record.
  await expect(page.getByText('Correct the errors in the save bar first.', { exact: false })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Find the best portfolio' })).toBeDisabled();
  await expect(record).toBeHidden();
  await page.locator('#accept-R-02-by').fill('Managing directors');
  await page.locator('#accept-R-02-rationale').fill('The loss stays below the tolerance at every point.');
  await expect(page.getByText('The document changed after the run. Run again before you print.')).toBeVisible();
  await expect(record).toBeHidden();
  await expect(page.getByText(/^Saved as version \d+\./)).toBeVisible();
  await page.getByRole('button', { name: 'Find the best portfolio' }).click();
  await expect(record).toContainText('Draft. 3 accepted residual risks need an acceptance record', { timeout: 30_000 });
  await expect(record).toContainText('Accepted by Managing directors');
  expect(problems).toEqual([]);
});

// Golden test G1 part (b) (SPEC.md Sec. 12.2). The ERR view of example 1 renders 10 rows,
// and every cell text equals the CSV fixture of Fig. 10. A response cell has one line per
// line of the CSV cell.
test('G1 (b). The register ERR of example 1 renders in the layout of Fig. 10, equal to the CSV', async ({ page }) => {
  const problems = watchProblems(page);
  const rows = parseCsv(readFileSync(new URL('../docs/schema/fixtures/sp800-221r1-fig10.csv', import.meta.url), 'utf8'), ',');
  const [header, ...body] = rows.filter((row) => row.some((cell) => cell.trim() !== ''));
  await page.goto('/');
  await page.getByRole('button', { name: 'NIST Fig. 10 and Table 9 (example 1)' }).click();
  await expect(page.getByRole('status').filter({ hasText: 'is open' })).toBeVisible();
  await page.getByRole('button', { name: 'Prioritize' }).click();
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
  await expectAccessible(page, 'S4 of example 1 with the Fig. 10 view');
  expect(problems).toEqual([]);
});
