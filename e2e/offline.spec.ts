import { expect, test } from '@playwright/test';

// HANDOFF.md task 1, done criteria 1 and 2.
test('makes no requests after load and works offline after the first visit', async ({ page, context }) => {
  const problems: string[] = [];
  page.on('pageerror', (error) => problems.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error' || message.type() === 'warning') problems.push(message.text());
  });

  await page.goto('/');
  const heading = page.getByRole('heading', { level: 1 });
  await expect(heading).toHaveText('PortaRegulus Risk');

  // The first visit installs the service worker, which caches the build.
  await expect.poll(() => page.evaluate(() => navigator.serviceWorker.controller !== null)).toBe(true);

  const requests: string[] = [];
  context.on('request', (request) => requests.push(request.url()));
  await page.getByRole('main').click();
  await page.waitForTimeout(2000);
  expect(requests, 'network requests after load').toEqual([]);

  await context.setOffline(true);
  await page.reload();
  await expect(heading).toHaveText('PortaRegulus Risk');
  await expect(page.getByText(/^Version /)).toBeVisible();

  expect(problems, 'errors, warnings and CSP violations').toEqual([]);
});
