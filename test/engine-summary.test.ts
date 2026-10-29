// Build task 3, done criterion 5, Node half. The stored summary of example 2 is the
// common reference for Node and Chromium (test/browser/engine.test.ts).
// Regenerate with: UPDATE_FIXTURES=1 npx vitest run --project node test/engine-summary.test.ts
import { readFileSync, writeFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import { measure } from '../src/engine';
import { summarize } from '../src/engine/summary';
import { differences } from './close';
import { example, EXAMPLE_2 } from './schema-helpers';

const FIXTURE = new URL('fixtures/engine-summary.json', import.meta.url);

it('example 2 at seed 20261207 and 20 000 trials equals the stored summary within 1e-9 relative', () => {
  const doc = example(EXAMPLE_2);
  const summary = JSON.parse(JSON.stringify(summarize(doc, measure(doc, 20_000, 20261207, [])))) as unknown;
  if (process.env['UPDATE_FIXTURES'] === '1') writeFileSync(FIXTURE, `${JSON.stringify(summary, null, 1)}\n`);
  const stored = JSON.parse(readFileSync(FIXTURE, 'utf8')) as unknown;
  expect(differences(summary, stored, 1e-9)).toEqual([]);
});
