// Build task 3, done criterion 5 and step 5, in Chromium. The engine runs in a Web Worker,
// gives the stored Node summary within 1e-9 relative, reports progress and cancels fast.
import { expect, it } from 'vitest';
import doc from '../../docs/schema/examples/example-2-sme-quantitative.json';
import { CancelledError, runJob } from '../../src/engine/client';
import type { RiskDocument } from '../../src/schema';
import { differences } from '../close';
import stored from '../fixtures/engine-summary.json';

const example = doc as unknown as RiskDocument;

it('Chromium gives the Node summary of example 2 within 1e-9 relative', async () => {
  const job = runJob({ kind: 'simulate', doc: example, trials: 20_000, seed: 20261207, active: [] });
  const summary = JSON.parse(JSON.stringify(await job.result)) as unknown;
  expect(differences(summary, stored, 1e-9)).toEqual([]);
}, 60_000);

it('the optimization reports progress and selects O-4 and O-5', async () => {
  const progress: number[] = [];
  const job = runJob({ kind: 'optimize', doc: example, budget: 60_000, seed: 20261207 }, (done) => progress.push(done));
  const result = await job.result;
  expect(result.best.ids).toEqual(['O-4', 'O-5']);
  expect(progress.at(-1)).toBe(21);
}, 120_000);

it('a running job stops within 200 ms of cancel', async () => {
  const job = runJob({ kind: 'simulate', doc: example, trials: 1_000_000, seed: 1, active: [] });
  await new Promise((resolve) => setTimeout(resolve, 300));
  const start = performance.now();
  job.cancel();
  await expect(job.result).rejects.toBeInstanceOf(CancelledError);
  expect(performance.now() - start).toBeLessThan(200);
}, 60_000);
