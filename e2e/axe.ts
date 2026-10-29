import AxeBuilder from '@axe-core/playwright';
import { expect, type Page } from '@playwright/test';

// Build task 5, done criterion 3. axe-core finds no WCAG 2.2 level A or AA violation.
export async function expectAccessible(page: Page, where: string): Promise<void> {
  const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']).analyze();
  const found = results.violations.map((violation) => `${violation.id} (${violation.impact ?? 'unknown'}): ${violation.nodes.map((node) => node.target.join(' ')).join(', ')}`);
  expect(found, `axe-core violations on ${where}`).toEqual([]);
}
