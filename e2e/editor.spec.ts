import { expect, test } from '@playwright/test';
import { expectAccessible } from './axe';

// The full editor of redesign phase 4 (docs/ux/redesign-plan.md Sec. 3.3). A side menu, a
// state line on each screen, sections that fold and one response option at a time.
test('the full editor has a side menu, a state line, folded tables and one option at a time', async ({ page }) => {
  const problems: string[] = [];
  page.on('pageerror', (error) => problems.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error' || message.type() === 'warning') problems.push(message.text());
  });

  await page.goto('/');
  await page.getByRole('button', { name: 'SME with numbers (example 2)', exact: true }).click();
  await page.getByRole('button', { name: 'Prioritize', exact: true }).click();
  const menu = page.getByRole('navigation', { name: 'Screens' });
  await expect(menu.getByRole('button', { name: 'Prioritize', exact: true })).toHaveAttribute('aria-current', 'page');
  await expect(page.getByRole('list', { name: 'State of this screen' })).toContainText('The simulation ranks 9 of 9 open risks.');
  // Every required step of example 2 is done, so the steps panel starts closed.
  await expect(page.locator('details.steps')).not.toHaveAttribute('open');

  // The matrix is display only and starts folded. Its heading stays in the outline.
  const matrix = page.getByRole('region', { name: 'Matrix, display only' });
  await expect(matrix.getByRole('heading', { level: 2 })).toBeVisible();
  await expect(matrix.getByText('Display only. Ranking and funding use the simulation (Cox 2008).')).toBeHidden();
  await matrix.locator(':scope > details > summary').click();
  await expect(matrix.getByText('Display only. Ranking and funding use the simulation (Cox 2008).')).toBeVisible();
  // A section folds too.
  const ranking = page.getByRole('region', { name: 'Risks by expected annual loss' });
  await ranking.locator(':scope > details > summary').click();
  await expect(ranking.locator('table')).toBeHidden();
  await expectAccessible(page, 'S4 with a folded section');

  // S5 shows one response option at a time.
  await menu.getByRole('button', { name: 'Respond and optimize', exact: true }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Respond and optimize' })).toBeFocused();
  const tabs = page.getByRole('group', { name: 'Response options to edit' });
  await expect(tabs.getByRole('button')).toHaveCount(7);
  await expect(page.locator('.editor-one')).toHaveCount(1);
  await expect(page.getByRole('group', { name: /^O-1 / })).toBeVisible();
  await tabs.getByRole('button', { name: /^O-4 / }).click();
  await expect(tabs.getByRole('button', { name: /^O-4 / })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByRole('group', { name: /^O-4 / })).toBeVisible();
  await expect(page.getByRole('group', { name: /^O-1 / })).toBeHidden();
  await expectAccessible(page, 'S5 with one option');

  // At 375 px the menu is one button that opens the list of screens.
  await page.setViewportSize({ width: 375, height: 812 });
  const button = menu.getByRole('button', { name: 'Screen 4 of 6, Respond and optimize', exact: true });
  await expect(button).toHaveAttribute('aria-expanded', 'false');
  await expect(menu.getByRole('button', { name: 'Monitor and adjust', exact: true })).toBeHidden();
  await button.click();
  await menu.getByRole('button', { name: 'Monitor and adjust', exact: true }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Monitor and adjust' })).toBeFocused();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(375);
  await expectAccessible(page, 'S6 at 375 px');

  // S7 prints its folded tables. Print opens every section, and the editor wrapper stays.
  await page.setViewportSize({ width: 1280, height: 900 });
  await menu.getByRole('button', { name: 'Enterprise view', exact: true }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Enterprise view' })).toBeFocused();
  await page.evaluate(() => window.dispatchEvent(new Event('beforeprint')));
  await page.emulateMedia({ media: 'print' });
  await expect(page.locator('table.portfolio')).toBeVisible();
  await expect(page.locator('.erp-block').first()).toBeVisible();
  await expect(menu).toBeHidden();
  await expect(page.locator('.save-bar')).toBeHidden();
  await page.emulateMedia({ media: 'screen' });
  await page.evaluate(() => window.dispatchEvent(new Event('afterprint')));
  await expect(page.locator('table.portfolio')).toBeHidden();
  expect(problems).toEqual([]);
});
