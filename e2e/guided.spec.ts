import { expect, test } from '@playwright/test';
import { expectAccessible } from './axe';
import { openMore } from './fold';

// The guided questions of screen S2 (SPEC.md Sec. 6.5 item 6,
// docs/release-2/appetite-questions.md) under the production CSP. The capacity slider by
// keyboard, one-click answers, "Do not know", the cross-check flag, the result in the curve and
// a draft statement, axe-core, the 375 px width, and the help text of decision O4 on S4.
test('S2 guided questions set the tolerance curve and a draft statement from one-click answers', async ({ page }) => {
  const problems: string[] = [];
  page.on('pageerror', (error) => problems.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error' || message.type() === 'warning') problems.push(message.text());
  });

  await page.goto('/');
  await page.getByRole('button', { name: 'SME with numbers (example 2)', exact: true }).click();
  await expect(page.getByRole('status').filter({ hasText: 'is open' })).toBeVisible();
  await page.getByRole('button', { name: 'Context and strategy', exact: true }).click();
  await page.getByRole('button', { name: 'Start the guided questions', exact: true }).click();
  const panel = page.locator('section[aria-labelledby="guided-title"]');
  const next = panel.getByRole('button', { name: 'Next', exact: true });

  // Stage 1. The slider starts at the capacity of example 2 and moves by keyboard (WCAG 2.1.1).
  await expect(page.getByRole('heading', { name: 'Stage 1 of 5. Capacity' })).toBeFocused();
  const slider = page.getByLabel('Capacity of the company (EUR)');
  await expect(slider).toHaveAttribute('aria-valuetext', '3,000,000 EUR');
  await slider.focus();
  await page.keyboard.press('ArrowRight');
  await expect(slider).toHaveAttribute('aria-valuetext', '5,000,000 EUR');
  await expect(page.getByLabel('Or type the amount (EUR)')).toHaveValue('5000000');
  await page.getByLabel('Or type the amount (EUR)').fill('3000000');
  await next.click();

  // Stage 2. One event for an objective and one click.
  await expect(page.getByRole('heading', { name: 'Stage 2 of 5. Criteria' })).toBeFocused();
  const orders = panel.getByRole('group', { name: /^OBJ-O1\./ });
  const notAcceptable = orders.getByRole('button', { name: 'Not acceptable', exact: true });
  await expect(notAcceptable).toBeDisabled();
  await orders.getByLabel('Event for this objective').fill('Orders stop for 3 days.');
  await notAcceptable.click();
  await expect(notAcceptable).toHaveAttribute('aria-pressed', 'true');
  await next.click();

  // Stage 3. The first range is capacity / 15 to 2 times capacity.
  await expect(page.getByRole('heading', { name: 'Stage 3 of 5. Tolerance points' })).toBeFocused();
  const question = panel.locator('#guided-tolerance-question');
  await expect(question).toHaveText('Do you accept a 1 in 100 chance this year that losses from ICT risks reach 1,100,000 EUR or more?');
  const answer = async (...answers: ('Accept' | 'Not accept' | 'Do not know')[]): Promise<void> => {
    for (const name of answers) await panel.getByRole('button', { name, exact: true }).click();
  };
  await answer('Accept', 'Accept');
  await panel.getByRole('button', { name: 'Take back the last answer', exact: true }).click();
  await expect(question).toHaveText('Do you accept a 1 in 100 chance this year that losses from ICT risks reach 2,600,000 EUR or more?');
  await answer('Not accept', 'Accept');
  // "Do not know" leaves 1 in 20 empty. 1 in 5 searches below 1 in 100.
  await answer('Do not know');
  await expect(question).toHaveText('Do you accept a 1 in 5 chance this year that losses from ICT risks reach 380,000 EUR or more?');
  await expectAccessible(page, 'S2 guided questions, stage 3');
  const size = page.viewportSize();
  await page.setViewportSize({ width: 375, height: 812 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(375);
  if (size !== null) await page.setViewportSize(size);
  await answer('Accept', 'Accept', 'Accept', 'Not accept', 'Not accept', 'Not accept');
  // The answer keys are gone, so focus moves to the line that says so (WCAG 2.4.3).
  await expect(panel.getByText('All 4 points have an answer.')).toBeFocused();
  await next.click();

  // Stage 4. 1 in 20 is empty, so the cross-check asks about 1 in 100. E is 21 000.
  await expect(page.getByRole('heading', { name: 'Stage 4 of 5. Cross-check' })).toBeFocused();
  await expect(panel.locator('#guided-cross-check-question')).toHaveText('How much per year would you pay to remove a 1 in 100 chance of losing 2,100,000 EUR or more?');
  await panel.getByRole('button', { name: 'More than 42,000 EUR', exact: true }).click();
  await expect(panel.getByRole('status')).toContainText('This is a flag, not an error.');
  await next.click();

  // Stage 5. The draft, the flag, and the note of who took part before anything changes.
  await expect(page.getByRole('heading', { name: 'Stage 5 of 5. Result' })).toBeFocused();
  const rows = panel.getByRole('table').locator('tbody tr');
  await expect(rows.nth(0)).toContainText('2,100,000');
  await expect(rows.nth(0)).toContainText('Check again.');
  await expect(rows.nth(1)).toContainText('Not set');
  await expect(rows.nth(2)).toContainText('1,700,000');
  await expect(rows.nth(3)).toContainText('70,000');
  const use = panel.getByRole('button', { name: 'Use these answers', exact: true });
  await expect(use).toBeDisabled();
  await panel.getByLabel('Who took part').fill('Managing directors and IT lead');
  await expectAccessible(page, 'S2 guided questions, stage 5');
  await use.click();
  await expect(panel.getByRole('status')).toHaveText('3 points are in the tolerance curve below. It needs approval. 1 draft statement is added. Complete its trigger.');

  // The curve has the 3 points, loss ascending, and no approval. The old curve is in the history.
  await openMore(page);
  await expect(page.getByLabel('Point 1 loss')).toHaveValue('70000');
  await expect(page.getByLabel('Point 1 probability')).toHaveValue('0.5');
  await expect(page.getByLabel('Point 2 loss')).toHaveValue('1700000');
  await expect(page.getByLabel('Point 3 loss')).toHaveValue('2100000');
  await expect(page.getByLabel('Point 3 probability')).toHaveValue('0.01');
  await expect(page.getByLabel('Approved by')).toHaveValue('');
  await expect(page.getByRole('table', { name: 'Appetite statements side by side' })).toContainText('The management body does not accept this event. Orders stop for 3 days.');
  await expect(page.getByText(/^Saved as version \d+\./)).toBeVisible();

  // Decision O4. S4 lists the event and points to the tolerance what-if.
  await page.getByRole('button', { name: 'Prioritize', exact: true }).click();
  await expect(page.getByText('Simulated with 100,000 trials.')).toBeVisible({ timeout: 30_000 });
  await page.getByText('Events that the management body does not accept').click();
  await expect(page.locator('details.help').filter({ hasText: 'Events that the management body does not accept' })).toContainText('Orders stop for 3 days.');
  await expectAccessible(page, 'S4 with the not acceptable events');
  expect(problems, 'errors, warnings and CSP violations').toEqual([]);
});
