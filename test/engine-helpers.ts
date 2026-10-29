// Small documents for the engine property tests (SPEC.md Sec. 12.3).
import type { Distribution, ResponseOption, Risk, RiskDocument } from '../src/schema';

export const constant = (value: number): Distribution => ({ type: 'constant', value });
export const lognormal = (lower: number, upper: number): Distribution => ({ type: 'lognormal', lower, upper, confidence: 0.9 });
export const pert = (min: number, mode: number, max: number): Distribution => ({ type: 'pert', min, mode, max });

interface RiskInput {
  readonly id: string;
  readonly frequency: Distribution;
  readonly impact: Distribution;
  readonly polarity?: 'negative' | 'positive';
  readonly links?: readonly { driverId: string; q: number }[];
  readonly secondary?: readonly { p: number; impact: Distribution }[];
  readonly onlyWithResponse?: string;
}

export function risk(input: RiskInput): Risk {
  const polarity = input.polarity ?? 'negative';
  const value: Record<string, unknown> = {
    riskId: input.id,
    riskDescription: `Risk ${input.id}`,
    riskCategory: 'Test',
    riskLikelihood: 0,
    riskImpact: 0,
    exposureRating: 0,
    riskResponseType: [polarity === 'negative' ? 'Mitigate' : 'Enhance'],
    riskResponseCost: 0,
    riskResponseDescription: 'Test',
    riskOwnerPointOfContact: 'Test owner',
    status: 'Open',
    registerId: 'G',
    polarity,
    category: { code: 'ict' },
    responseDecision: 'decided',
    estimate: {
      frequency: input.frequency,
      impactPerEvent: input.impact,
      method: 'expert-calibrated',
      rationale: 'test estimate',
      ...(input.secondary === undefined
        ? {}
        : { secondaryImpacts: input.secondary.map((item, i) => ({ description: `secondary ${String(i)}`, probability: item.p, impactPerEvent: item.impact })) }),
    },
  };
  if (input.links !== undefined) value['driverLinks'] = input.links.map((link) => ({ driverId: link.driverId, triggerProbability: link.q }));
  if (input.onlyWithResponse !== undefined) value['onlyWithResponse'] = input.onlyWithResponse;
  return value as unknown as Risk;
}

export function document(
  risks: readonly Risk[],
  extra: { drivers?: readonly { id: string; frequency: Distribution }[]; responses?: readonly ResponseOption[]; threshold?: number; timeframeMonths?: number } = {},
): RiskDocument {
  return {
    schemaVersion: '1.0.0',
    document: { id: 'T', title: 'Test', currency: 'EUR', createdOn: '2026-10-28T00:00:00Z' },
    registers: [
      {
        id: 'G',
        title: 'Test register',
        level: 'organization',
        timeframeMonths: extra.timeframeMonths ?? 12,
        asOf: '2026-10-28',
        method: 'quantitative',
        ...(extra.threshold === undefined ? {} : { reportableEventThreshold: extra.threshold }),
      },
    ],
    drivers: (extra.drivers ?? []).map((driver) => ({ id: driver.id, kind: 'supplier', name: driver.id, frequency: driver.frequency, rationale: 'test driver' })),
    risks: [...risks],
    responses: [...(extra.responses ?? [])],
  };
}

export function variance(values: ArrayLike<number>): number {
  let sum = 0;
  for (let i = 0; i < values.length; i++) sum += values[i] ?? 0;
  const m = sum / values.length;
  let squares = 0;
  for (let i = 0; i < values.length; i++) squares += ((values[i] ?? 0) - m) ** 2;
  return squares / (values.length - 1);
}

export function covariance(a: ArrayLike<number>, b: ArrayLike<number>): number {
  let sa = 0;
  let sb = 0;
  for (let i = 0; i < a.length; i++) {
    sa += a[i] ?? 0;
    sb += b[i] ?? 0;
  }
  const ma = sa / a.length;
  const mb = sb / b.length;
  let sum = 0;
  for (let i = 0; i < a.length; i++) sum += ((a[i] ?? 0) - ma) * ((b[i] ?? 0) - mb);
  return sum / (a.length - 1);
}
