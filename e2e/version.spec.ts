import { readFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';
import { expectAccessible } from './axe';

const { version } = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')) as { version: string };
const KEY = 'pr-risk.seenVersion';

// CRA Annex I Part I point 2(c), gap F5, under the production CSP. After a start with another
// version, S1 and the editor frame show a notice of the new version. The user can close it, and
// it then stays closed.
test('shows the notice of a new version on S1 and in the editor frame until the user closes it', async ({ page }) => {
  const problems: string[] = [];
  page.on('pageerror', (error) => problems.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error' || message.type() === 'warning') problems.push(message.text());
  });
  const notice = page.getByRole('status').filter({ hasText: 'is now active' });
  const seen = () => page.evaluate((key) => localStorage.getItem(key), KEY);

  // A first start records the version and shows no notice.
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('PortaRegulus Risk');
  expect(await seen()).toBe(version);
  await expect(notice).toHaveCount(0);

  // The last start ran an older version.
  await page.evaluate((key) => {
    localStorage.setItem(key, '0.9.0');
  }, KEY);
  await page.reload();
  await expect(notice).toContainText(`Version ${version} is now active. See the release notes on GitHub.`);
  await expect(notice.getByRole('link', { name: 'release notes on GitHub' })).toHaveAttribute('href', `https://github.com/porta-regulus/pr-risk/releases/tag/v${version}`);
  await expectAccessible(page, 'S1 with the notice of a new version');

  // The notice shows again on the next start until the user closes it.
  await page.reload();
  await expect(notice).toBeVisible();
  expect(await seen()).toBe('0.9.0');

  // The editor frame shows the same notice. Closing it there closes it on S1 too.
  await page.getByRole('button', { name: 'SME with numbers (example 2)', exact: true }).click();
  await page.getByRole('button', { name: 'Identify and analyze', exact: true }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Identify and analyze' })).toBeFocused();
  await expect(notice).toBeVisible();
  await notice.getByRole('button', { name: 'Close notice', exact: true }).click();
  await expect(notice).toHaveCount(0);
  expect(await seen()).toBe(version);
  await page.getByRole('button', { name: 'Back to start', exact: true }).click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('PortaRegulus Risk');
  await expect(notice).toHaveCount(0);

  // A closed notice stays closed on the next start.
  await page.reload();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('PortaRegulus Risk');
  await expect(notice).toHaveCount(0);

  expect(problems, 'errors, warnings and CSP violations').toEqual([]);
});

// The same rule on S1 alone, closed there.
test('closes the notice of a new version on S1', async ({ page }) => {
  await page.addInitScript((key) => {
    if (sessionStorage.getItem('started') === null) {
      sessionStorage.setItem('started', 'yes');
      localStorage.setItem(key, '0.9.0');
    }
  }, KEY);
  await page.goto('/');
  const notice = page.getByRole('status').filter({ hasText: 'is now active' });
  await expect(notice).toBeVisible();
  await notice.getByRole('button', { name: 'Close notice', exact: true }).click();
  await expect(notice).toHaveCount(0);
  await page.reload();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('PortaRegulus Risk');
  await expect(notice).toHaveCount(0);
});
