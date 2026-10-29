import { expect, test } from '@playwright/test';
import { expectAccessible } from './axe';

// Screen S3 under the production CSP. A new document gets a quantitative register, an asset
// and a risk with a calibrated estimate. Rule V-08 holds the save until the estimate is
// complete. The NIST numbers then come from the simulation.
test('S3 adds a risk with an estimate and saves its simulated numbers', async ({ page }) => {
  const problems: string[] = [];
  page.on('pageerror', (error) => problems.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error' || message.type() === 'warning') problems.push(message.text());
  });

  await page.goto('/');
  await page.getByLabel('Title', { exact: true }).fill('Pilot register');
  await page.getByLabel('Organization').fill('Pilot GmbH');
  await page.getByRole('button', { name: 'Create', exact: true }).click();
  await expect(page.getByRole('status').filter({ hasText: '"Pilot register" is created.' })).toBeVisible();
  await page.getByRole('button', { name: 'Identify and analyze' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Identify and analyze' })).toBeFocused();

  // The register becomes quantitative, and an asset joins the inventory.
  await page.getByLabel('Method').selectOption('quantitative');
  await page.getByRole('button', { name: 'Add an asset' }).click();
  await page.getByText(/^A-1 New asset/).click();
  await page.getByLabel('Name', { exact: true }).fill('Web shop');
  await page.getByLabel('Kind', { exact: true }).selectOption('service');
  await expect(page.getByText(/^Saved as version \d+\./)).toBeVisible();

  // A new risk. Without an estimate a quantitative register refuses the save (V-08).
  await page.getByLabel('Risk description').fill('If the web shop is down for a day, then orders are lost.');
  await page.getByRole('button', { name: 'Add risk to Pilot GmbH register' }).click();
  await expect(page.getByRole('heading', { level: 2, name: 'Risk R-1' })).toBeVisible();
  await expect(page.locator('.errors')).toContainText('V-08');

  // Scenario tab.
  await page.getByLabel('Risk owner').fill('Head of IT');
  await page.getByLabel('Subcategory').selectOption('ict.availability');
  await page.getByLabel('Horizon').selectOption('emerging');
  await expect(page.getByText('An emerging or horizon risk is a trigger to review appetite and tolerance')).toBeVisible();

  // Estimate tab, reached with the arrow keys.
  await page.getByRole('tab', { name: 'Scenario' }).focus();
  await page.keyboard.press('ArrowRight');
  await expect(page.getByRole('tab', { name: 'Estimate' })).toBeFocused();
  await page.getByRole('button', { name: 'Add an estimate' }).click();
  await page.locator('#risk-R-1-frequency-form').selectOption('every');
  await page.getByLabel('Shortest time between events (years)').fill('2');
  await page.getByLabel('Longest time between events (years)').fill('10');
  await expect(page.getByText('Stored as 0.1 to 0.5 events per year.')).toBeVisible();
  await page.getByLabel('Lower bound (EUR)').fill('5000');
  await page.getByLabel('Upper bound (EUR)').fill('200000');
  await page.getByLabel('Rationale (10 characters or more)').fill('Two outages in five years at the hosting provider.');
  await expect(page.locator('.feedback')).toContainText('Probability of at least one event in 12 months');
  await expect(page.getByText(/^Saved as version \d+\./)).toBeVisible();
  await expectAccessible(page, 'S3 with the estimate tab open');

  // Links tab. The asset is linked.
  await page.getByRole('tab', { name: 'Links' }).click();
  await page.getByLabel('A-1 Web shop').check();
  await expect(page.getByText(/^Saved as version \d+\./)).toBeVisible();

  // The table shows the simulated exposure, not a placeholder.
  const row = page.getByRole('row').filter({ hasText: 'R-1' });
  await expect(row).not.toContainText('Not estimated');
  const exposure = await row.locator('td').nth(5).textContent();
  expect(Number(exposure?.replace(/,/g, ''))).toBeGreaterThan(0);

  // The work survives a reload, and the other screen opens from the navigation.
  await page.reload();
  await page.getByRole('button', { name: 'Identify and analyze' }).click();
  await expect(page.getByRole('row').filter({ hasText: 'If the web shop is down for a day' })).toContainText(exposure ?? '');
  await page.getByRole('button', { name: 'Context and strategy' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Context and strategy' })).toBeVisible();
  expect(problems, 'errors, warnings and CSP violations').toEqual([]);
});
