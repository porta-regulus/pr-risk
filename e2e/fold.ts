import type { Page } from '@playwright/test';

// Opens a folded section of a full editor screen by its heading (docs/ux/redesign-plan.md
// Sec. 3.3). An open section stays open.
export async function unfold(page: Page, heading: string | RegExp): Promise<void> {
  const summary = page.locator('section.fold > details > summary').filter({ has: page.getByRole('heading', { level: 2, name: heading }) });
  await summary.waitFor();
  const open = await summary.evaluate((node) => (node.parentElement as HTMLDetailsElement).open);
  if (!open) await summary.click();
}

// Opens every "More fields (optional)" fold on the page. A fold that the page adds later starts
// closed, so call this again after such a change.
export async function openMore(page: Page): Promise<void> {
  await page.locator('details.more').first().waitFor({ state: 'attached' });
  await page.evaluate(() => {
    for (const node of document.querySelectorAll<HTMLDetailsElement>('details.more')) node.open = true;
  });
}
