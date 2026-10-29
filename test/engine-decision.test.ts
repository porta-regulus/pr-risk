// The decision record numbers (SPEC.md Sec. 4) against the worked example of Sec. 8.11.
// The spec numbers come from the NumPy reference model. The engine has other random streams,
// so each number must agree within 4 combined standard errors, not exactly.
import { describe, expect, it } from 'vitest';
import { decisionRecord, type PortfolioRow } from '../src/engine';
import { example, EXAMPLE_2 } from './schema-helpers';

const doc = example(EXAMPLE_2);
const record = decisionRecord(doc, { budget: 60_000, seed: 20261207 });
// The reference has the same standard error as the engine, so the combined error is sqrt(2) se.
const near = (actual: number, expected: number, se: number): boolean => Math.abs(actual - expected) <= 4 * Math.SQRT2 * se;

interface SpecRow {
  readonly ids: string[];
  readonly cash: number;
  readonly cost: number;
  readonly benefit: number;
  readonly net: number;
  readonly eal: number;
}

// SPEC.md Sec. 8.11, ranks 1 to 5 at B = 60 000.
const SPEC_ROWS: readonly SpecRow[] = [
  {
    ids: ['O-4', 'O-5'],
    cash: 48_000,
    cost: 34_667,
    benefit: 109_784,
    net: 75_117,
    eal: 159_110,
  },
  {
    ids: ['O-4', 'O-6'],
    cash: 51_000,
    cost: 27_000,
    benefit: 90_879,
    net: 63_879,
    eal: 138_844,
  },
  {
    ids: ['O-1', 'O-4'],
    cash: 39_000,
    cost: 29_000,
    benefit: 87_924,
    net: 58_924,
    eal: 141_738,
  },
  {
    ids: ['O-1', 'O-2'],
    cash: 54_000,
    cost: 24_000,
    benefit: 81_618,
    net: 57_618,
    eal: 148_044,
  },
  {
    ids: ['O-1', 'O-3', 'O-4'],
    cash: 55_000,
    cost: 36_000,
    benefit: 93_257,
    net: 57_257,
    eal: 136_519,
  },
];

function expectRow(row: PortfolioRow, spec: SpecRow): void {
  expect(row.ids).toEqual(spec.ids);
  expect(row.cash).toBe(spec.cash);
  // Costs are constants unless an option holds a reserve.
  expect(Math.abs(row.cost - spec.cost)).toBeLessThan(0.01 * spec.cost);
  expect(near(row.benefit, spec.benefit, row.benefitSe), `benefit ${String(row.benefit)} against ${String(spec.benefit)}`).toBe(true);
  expect(near(row.net, spec.net, row.benefitSe), `net ${String(row.net)} against ${String(spec.net)}`).toBe(true);
}

describe('decision record of example 2 at B = 60 000 (SPEC.md Sec. 8.11)', () => {
  it('names the run', () => {
    expect(record.seed).toBe(20261207);
    expect(record.trials).toBe(100_000);
    expect(record.rankingTrials).toBe(20_000);
    expect(record.count).toBe(21);
    expect(record.method).toBe('exact');
    expect(record.hash).toMatch(/^[0-9a-f]{64}$/);
  });

  it('before. EAL, EAG, LEC at the tolerance points, P(loss above capacity) and the gap', () => {
    const before = record.before;
    expect(near(before.eal, 229_723, before.ealSe)).toBe(true);
    expect(near(before.eag, 53_775, before.eagSe)).toBe(true);
    const at = new Map(before.atPoints.map((point) => [point.loss, point]));
    for (const [loss, p] of [
      [250_000, 0.2057],
      [1_000_000, 0.0591],
    ] as const) {
      const point = at.get(loss);
      expect(point).toBeDefined();
      expect(near(point?.probability ?? 0, p, point?.se ?? 0), `LEC(${String(loss)})`).toBe(true);
    }
    expect(at.get(250_000)?.tolerance).toBeCloseTo(0.2, 12);
    expect(at.get(1_000_000)?.tolerance).toBeCloseTo(0.05, 12);
    const p = record.before.pAboveCapacity ?? 0;
    expect(near(p, 0.0094, Math.sqrt((p * (1 - p)) / record.trials))).toBe(true);
    expect(before.gap).toBeGreaterThan(0.012);
    expect(before.gap).toBeLessThan(0.03);
    expect(before.status).not.toBe('within');
  });

  it('funds O-4 and O-5, and the roll-up is within tolerance after', () => {
    expectRow(record.best, SPEC_ROWS[0] as SpecRow);
    expect(near(record.after.eal, 159_110, record.after.ealSe)).toBe(true);
    expect(record.after.status).toBe('within');
    expect(record.after.ids).toEqual(['O-4', 'O-5']);
  });

  it('the alternatives are the next ranks of the spec table', () => {
    expectRow(record.alternatives[0] as PortfolioRow, SPEC_ROWS[1] as SpecRow);
    for (const row of record.alternatives) {
      const spec = SPEC_ROWS.slice(1).find((item) => item.ids.join() === row.ids.join());
      expect(spec, row.ids.join('+')).toBeDefined();
      if (spec !== undefined) expectRow(row, spec);
    }
  });

  it('the fiscal baseline is O-1, O-3, O-4, about 17 860 below the best net benefit', () => {
    expectRow(record.fiscal, SPEC_ROWS[4] as SpecRow);
    expect(near(record.best.net - record.fiscal.net, 17_860, Math.hypot(record.best.benefitSe, record.fiscal.benefitSe))).toBe(true);
  });

  it('marginal values. Without O-4 the gap returns and net benefit falls by about 51 094', () => {
    const o4 = record.marginal['O-4'];
    const o5 = record.marginal['O-5'];
    expect(near(o4?.netLossIfDropped ?? 0, 51_094, record.best.benefitSe)).toBe(true);
    expect(o4?.gapIfDropped).toBeGreaterThan(0.01);
    expect(near(o5?.netLossIfDropped ?? 0, 24_023, record.best.benefitSe)).toBe(true);
  });

  it('budget sensitivity. At 48 000 the same portfolio wins, at 72 000 O-1 joins', () => {
    expect(record.lower.budget).toBe(48_000);
    expect(record.lower.row.ids).toEqual(['O-4', 'O-5']);
    expect(record.upper.budget).toBe(72_000);
    expect(record.upper.row.ids).toEqual(['O-1', 'O-4', 'O-5']);
    expect(near(record.upper.row.net, 79_853, record.upper.row.benefitSe)).toBe(true);
  });

  it('gives a reason for every candidate that is not funded', () => {
    const candidates = (doc.responses ?? []).filter((option) => option.status === 'candidate' || option.status === 'selected').map((option) => option.id);
    expect(record.notFunded.map((item) => item.id).sort()).toEqual(candidates.filter((id) => !record.best.ids.includes(id)).sort());
    // O-2 and O-7 change the R-01 impact, as O-4 does.
    for (const id of ['O-2', 'O-7']) expect(record.notFunded.find((item) => item.id === id)?.reason).toBe('alternative');
  });

  it('the objectives view sums the risks of each objective kind', () => {
    expect(record.objectives.map((row) => row.kind)).toEqual(['strategic', 'operations', 'reporting', 'compliance']);
    const total = record.objectives.reduce((sum, row) => sum + row.ealBefore, 0);
    expect(total).toBeGreaterThan(0);
    for (const row of record.objectives) expect(row.ealAfter).toBeLessThanOrEqual(row.ealBefore + 1e-6);
  });
});
