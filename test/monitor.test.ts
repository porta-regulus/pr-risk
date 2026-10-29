// Task 6 library parts. G2 (b) KRI and tolerance triggers of Table 9, the forecast log
// with its input hash, and the Brier score of SPEC.md Sec. 8.14.
import { describe, expect, it } from 'vitest';
import { measure } from '../src/engine';
import { brierScores, forecastInputs, freezeForecasts, windowEnd } from '../src/monitor/forecasts';
import { boundaryGaps, evaluateStatement, type Values } from '../src/monitor/triggers';
import type { RiskDocument } from '../src/schema';
import { example, EXAMPLE_1, EXAMPLE_2 } from './schema-helpers';

type Forecast = NonNullable<RiskDocument['forecasts']>[number];

const statements = example(EXAMPLE_1).appetite?.statements ?? [];
const statement = (id: string) => {
  const found = statements.find((item) => item.id === id);
  if (found === undefined) throw new Error(id);
  return found;
};
const fired = (id: string, values: Values): string[] => {
  const result = evaluateStatement(statement(id), values);
  return [...result.indicators.filter((item) => item.fired).map((item) => item.id), ...result.tolerances.filter((item) => item.breached).map((item) => item.id)];
};

describe('G2 (b) Table 9 triggers', () => {
  it('example 1 with 2 above 10 days, 1 above 14, 1 above 15 fires the leading KRI, the tolerance and the lagging KRI', () => {
    expect(
      fired('T9-EX1', {
        computers_unpatched_cvss10_over_10_days: 2,
        mission_critical_systems_unpatched_cvss10_over_14_days: 1,
        computers_unpatched_cvss10_over_15_days: 1,
      }).sort(),
    ).toEqual(['T9-EX1-GKRI', 'T9-EX1-LKRI', 'T9-EX1-TOL']);
  });

  const ex3 = (hours: number, percent: number) => fired('T9-EX3', { outage_hours: hours, customers_affected_percent: percent }).sort();

  it('example 3 fires exactly what Table 9 implies', () => {
    expect(ex3(1.6, 6)).toEqual(['T9-EX3-LKRI1']);
    expect(ex3(2.5, 4)).toEqual(['T9-EX3-LKRI2']);
    expect(ex3(2.5, 6)).toEqual(['T9-EX3-GKRI', 'T9-EX3-LKRI1', 'T9-EX3-TOL']);
    expect(ex3(2.5, 5)).toEqual([]);
  });

  it('flags the Table 9 boundary gap at 5 percent', () => {
    expect(boundaryGaps(statement('T9-EX3'))).toEqual([{ metric: 'customers_affected_percent', threshold: 5 }]);
    expect(evaluateStatement(statement('T9-EX3'), { outage_hours: 2.5, customers_affected_percent: 5 }).inGap).toEqual([{ metric: 'customers_affected_percent', threshold: 5 }]);
    expect(evaluateStatement(statement('T9-EX3'), { outage_hours: 2.5, customers_affected_percent: 6 }).inGap).toEqual([]);
  });

  it('a missing metric fires nothing and is reported', () => {
    const result = evaluateStatement(statement('T9-EX3'), { outage_hours: 3 });
    expect(result.tolerances[0]).toEqual({ id: 'T9-EX3-TOL', breached: false, missing: ['customers_affected_percent'] });
  });
});

describe('forecast log (Sec. 8.14)', () => {
  const doc = example(EXAMPLE_2);

  it('reproduces the stored input hashes of example 2', () => {
    for (const forecast of doc.forecasts ?? []) {
      const risk = doc.risks.find((item) => item.riskId === forecast.riskId);
      if (risk === undefined) throw new Error(forecast.riskId);
      expect(forecastInputs(doc, risk, forecast.eventThreshold, forecast.seed, forecast.trials, forecast.engineVersion), forecast.id).toBe(forecast.inputsSha256);
    }
  });

  it('a window of 12 months ends the day before the same date', () => {
    expect(windowEnd('2025-10-27', 12)).toBe('2026-10-26');
    expect(windowEnd('2024-02-29', 12)).toBe('2025-02-28');
  });

  it('freezes one forecast per simulated leaf risk, close to the oracle for R-01', () => {
    const m = measure(doc, 100_000, 20261207, []);
    const forecasts = freezeForecasts(doc, m.run, { createdOn: '2026-10-28T09:00:00Z' });
    expect(forecasts.map((forecast) => forecast.riskId)).toEqual([...m.run.risks.keys()]);
    const r01 = forecasts.find((forecast) => forecast.riskId === 'R-01');
    const stored = (doc.forecasts ?? []).find((forecast) => forecast.riskId === 'R-01');
    expect(r01?.id).toBe('F-2027-R-01');
    const se = Math.sqrt((0.1 * 0.9) / 100_000);
    expect(Math.abs((r01?.probability ?? 0) - (stored?.probability ?? 0))).toBeLessThan(4 * Math.SQRT2 * se);
    expect(r01?.annualImpactInterval90?.upper).toBeGreaterThan(0);
  });
});

describe('Brier score (Brier 1950, Murphy 1973)', () => {
  const forecast = (probability: number, occurred: boolean, observed?: number): Forecast => ({
    id: `F-${String(probability)}`,
    riskId: 'R',
    createdOn: '2026-01-01T00:00:00Z',
    windowStart: '2026-01-01',
    windowEnd: '2026-12-31',
    eventDefinition: 'test',
    eventThreshold: 0,
    probability,
    annualImpactInterval90: { lower: 100, upper: 1000 },
    engineVersion: 'test',
    seed: 1,
    trials: 1000,
    inputsSha256: '0'.repeat(64),
    outcome: { occurred, recordedOn: '2027-01-01', ...(observed === undefined ? {} : { observedAnnualImpact: observed }) },
  });

  it('gives the exact score, skill and decomposition for a small set', () => {
    const scores = brierScores([forecast(0.1, false, 50), forecast(0.9, true, 500), forecast(0.5, true, 5000), forecast(0.2, false)]);
    expect(scores?.brier).toBeCloseTo(0.0775, 12);
    expect(scores?.baseRate).toBe(0.5);
    expect(scores?.skill).toBeCloseTo(0.69, 12);
    expect(scores?.reliability).toBeCloseTo(0.0775, 12);
    expect(scores?.resolution).toBeCloseTo(0.25, 12);
    expect(scores?.decompositionGap).toBeCloseTo(0, 12);
    expect(scores?.intervalHitRate).toBeCloseTo(1 / 3, 12);
  });

  it('has no skill score when every outcome is the same, as in example 2', () => {
    const scores = brierScores(example(EXAMPLE_2).forecasts ?? []);
    expect(scores?.n).toBe(1);
    expect(scores?.brier).toBeCloseTo(0.2186 ** 2, 12);
    expect(scores?.skill).toBeUndefined();
  });

  it('gives nothing without resolved forecasts', () => {
    expect(brierScores([])).toBeUndefined();
  });
});
