import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { expect, test } from '@playwright/test';

// Screen S1 under the production CSP and Trusted Types: open, create, import, export, remove all.
test('start screen works end to end with no CSP violation', async ({ page }) => {
  const problems: string[] = [];
  page.on('pageerror', (error) => problems.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error' || message.type() === 'warning') problems.push(message.text());
  });

  await page.goto('/');
  await expect(page.getByText('No document is stored in this browser.')).toBeVisible();

  // Open an example.
  await page.getByRole('button', { name: 'SME with numbers (example 2)' }).click();
  await expect(page.getByRole('status').filter({ hasText: 'is open' })).toBeVisible();
  await expect(page.getByText('You have not saved a copy of this document yet.')).toBeVisible();

  // Export the app file. The reminder goes away.
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'App file (JSON)' }).click();
  const download = await downloadPromise;
  const exported = JSON.parse(readFileSync(await download.path(), 'utf8')) as { schemaVersion: string; risks: unknown[] };
  expect(exported.schemaVersion).toBe('1.0.0');
  expect(exported.risks).toHaveLength(9);
  await expect(page.getByText('You have not saved a copy of this document yet.')).toBeHidden();

  // Create a new document and import the Table 10 CSV into it through the import worker.
  await page.getByLabel('Title', { exact: true }).fill('Test register');
  await page.getByLabel('Organization').fill('Example GmbH');
  await page.getByRole('button', { name: 'Create', exact: true }).click();
  await expect(page.getByRole('status').filter({ hasText: '"Test register" is created.' })).toBeVisible();
  const csv = fileURLToPath(new URL('../docs/schema/fixtures/table10-system-registers.csv', import.meta.url));
  await page.setInputFiles('#import-file', csv);
  await expect(page.getByText('Format csv. 3 risks, 3 new registers')).toBeVisible();
  await page.getByRole('button', { name: 'Add to Test register' }).click();
  await expect(page.getByText('3 risks from table10-system-registers.csv are saved.')).toBeVisible();
  await expect(page.getByText('4 registers, 3 risks')).toBeVisible();

  // Remove everything after a typed confirmation.
  const remove = page.getByRole('button', { name: 'Remove all data from this browser' });
  await expect(remove).toBeDisabled();
  await page.getByLabel(/Type REMOVE/).fill('REMOVE');
  await remove.click();
  await expect(page.getByText('All data is removed from this browser.')).toBeVisible();
  await expect(page.getByText('No document is stored in this browser.')).toBeVisible();

  expect(problems, 'errors, warnings and CSP violations').toEqual([]);
});
