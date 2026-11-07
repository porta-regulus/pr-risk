import { expect, test } from '@playwright/test';
import { expectAccessible } from './axe';

// The panel "Steps to complete" on screens S2 to S7 (SPEC.md Sec. 5) under the production CSP.
test('the steps panel leads a new user, ticks a step and opens the section of a step', async ({ page }) => {
  const problems: string[] = [];
  page.on('pageerror', (error) => problems.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error' || message.type() === 'warning') problems.push(message.text());
  });

  await page.goto('/');
  await expect(page.getByText(/^New here\? Type a title and click Create\./)).toBeVisible();
  await page.getByLabel('Title', { exact: true }).fill('First steps');
  await page.getByRole('button', { name: 'Create', exact: true }).click();
  await expect(page.getByRole('status').filter({ hasText: 'is created.' })).toBeVisible();
  await page.getByRole('button', { name: 'Context and strategy', exact: true }).click();

  const panel = page.locator('details.steps');
  await expect(panel.locator(':scope > summary')).toHaveText('Steps to complete: 0 of 6 done');
  const next = panel.locator('li[aria-current="step"]');
  await expect(next).toContainText('Next Add your objectives');
  await expect(next).toContainText('No objective has a statement.');
  await expectAccessible(page, 'S2 with the steps panel');

  // A step on this screen opens its section and moves the focus to the heading.
  await next.getByRole('button', { name: 'Show me where', exact: true }).click();
  await expect(page.locator('#objectives-title')).toBeFocused();
  // The sticky save bar does not cover the heading.
  const gap = await page.evaluate(() => (document.getElementById('objectives-title')?.getBoundingClientRect().top ?? 0) - (document.querySelector('.save-bar')?.getBoundingClientRect().bottom ?? 0));
  expect(gap).toBeGreaterThanOrEqual(0);

  await page.getByRole('button', { name: 'Add an objective', exact: true }).click();
  await page.getByLabel('Objective 1 statement').fill('Deliver every order on time.');
  await page.getByRole('button', { name: 'Add an objective', exact: true }).click();
  await page.getByLabel('Objective 2 statement').fill('Keep customer data safe.');
  await expect(panel.locator(':scope > summary')).toHaveText('Steps to complete: 1 of 6 done');
  await expect(panel.locator('li.step-done')).toContainText('Add your objectives');
  await expect(next).toContainText('Next Draw your tolerance curve');

  // A step on another screen saves, opens that screen and then the section.
  await panel.locator('li').filter({ hasText: 'Set your budget' }).getByRole('button', { name: 'Go to Respond and optimize', exact: true }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Respond and optimize' })).toBeVisible();
  await expect(page.locator('#budget-title')).toBeFocused();

  // A closed panel stays closed on the next screen. It does not print.
  await page.locator('details.steps > summary').click();
  await page.getByRole('button', { name: 'Prioritize', exact: true }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Prioritize' })).toBeVisible();
  await expect(page.locator('details.steps')).not.toHaveAttribute('open');
  await page.emulateMedia({ media: 'print' });
  await expect(page.locator('details.steps')).toBeHidden();
  expect(problems, 'errors, warnings and CSP violations').toEqual([]);
});
