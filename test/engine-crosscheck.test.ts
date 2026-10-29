// Build task 3, done criteria 2 and 3. The engine agrees with the NumPy oracle
// (docs/reference/sim_reference.py) within 4 standard errors on example 2, and the
// optimization gives the results of SPEC.md Sec. 8.11.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { exceedance, fiscal, measure, optimize, riskStats, sortedCopy, standardError } from '../src/engine';
import { sha256Hex } from '../src/schema';
import { example, EXAMPLE_2, readJson } from './schema-helpers';

interface Oracle {
  exampleSha256: string;
  trials: number;
  seed: number;
  eal: number;
  ealSe: number;
  eag: number;
  eagSe: number;
  risks: Record<string, { p: number; pSe: number; eal: number; ealSe: number }>;
  lec: Record<string, { p: number; se: number }>;
}

const oracle = (readJson('test/fixtures/engine-reference.json') as { oracle: Oracle }).oracle;
const doc = example(EXAMPLE_2);
const within = (a: number, b: number, seA: number, seB: number): boolean => Math.abs(a - b) <= 4 * Math.hypot(seA, seB);

describe('cross-check with the NumPy oracle on example 2', () => {
  it('uses the same example file as the oracle', () => {
    const bytes = new Uint8Array(readFileSync(new URL('../docs/schema/examples/example-2-sme-quantitative.json', import.meta.url)));
    expect(sha256Hex(bytes), 'example 2 changed. Run tools/engine_reference.py').toBe(oracle.exampleSha256);
  });

  const m = measure(doc, oracle.trials, oracle.seed, []);
  const sorted = sortedCopy(m.loss);

  it('EAL and EAG agree within 4 standard errors', () => {
    expect(within(m.eal, oracle.eal, standardError(m.loss), oracle.ealSe)).toBe(true);
    expect(within(m.eag, oracle.eag, standardError(m.gain), oracle.eagSe)).toBe(true);
  });

  it('P(N at least 1) and EAL per risk agree within 4 standard errors', () => {
    const stats = riskStats(m.run);
    expect(stats.map((item) => item.riskId).sort()).toEqual(Object.keys(oracle.risks).sort());
    for (const item of stats) {
      const reference = oracle.risks[item.riskId];
      if (reference === undefined) throw new Error(item.riskId);
      expect(within(item.probability, reference.p, item.probabilitySe, reference.pSe), `${item.riskId} p`).toBe(true);
      expect(within(item.expectedAnnual, reference.eal, item.expectedAnnualSe, reference.ealSe), `${item.riskId} EAL`).toBe(true);
    }
  });

  it('LEC at the 4 tolerance points agrees within 4 standard errors', () => {
    for (const [loss, reference] of Object.entries(oracle.lec)) {
      const p = exceedance(sorted, Number(loss));
      const se = Math.sqrt((p * (1 - p)) / oracle.trials);
      expect(within(p, reference.p, se, reference.se), `LEC(${loss})`).toBe(true);
    }
  });
});

describe('optimization results of SPEC.md Sec. 8.11 (done criterion 3)', () => {
  for (const seed of [20261207, 1, 2, 3]) {
    it(`B = 60 000, seed ${String(seed)} selects O-4 and O-5`, () => {
      const result = optimize(doc, { budget: 60_000, seed });
      expect(result.method).toBe('exact');
      expect(result.count).toBe(21);
      expect(result.best.ids).toEqual(['O-4', 'O-5']);
    }, 120_000);
  }

  it('the fiscal baseline at B = 60 000 is O-1, O-3, O-4', () => {
    expect(fiscal(doc, 60_000, 100_000, 20261207).sort()).toEqual(['O-1', 'O-3', 'O-4']);
  });

  it('at B = 72 000 the best portfolio is O-1, O-4, O-5', () => {
    expect(optimize(doc, { budget: 72_000, seed: 20261207 }).best.ids).toEqual(['O-1', 'O-4', 'O-5']);
  }, 120_000);
});
