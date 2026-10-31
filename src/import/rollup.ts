// Three-point roll-up and Table 10 disparity layouts (SPEC.md Sec. 8.15, SP 800-221r1
// Sec. 5.2.2 lines 1637 to 1641). Used when system entries are merged into a summary entry.
import type { Risk } from '../schema/types';

export interface ThreePoint {
  readonly optimistic: number;
  readonly mostLikely: number;
  readonly pessimistic: number;
}

// For each column separately. Optimistic is the best value, pessimistic the worst, most
// likely the mean of the others. For n = 2 the mean of both. For n = 1 the value.
// For positive risks the best value is the highest.
export function threePoint(values: readonly number[], polarity: 'negative' | 'positive'): ThreePoint {
  if (values.length === 0) throw new Error('A roll-up needs at least one source value');
  const sorted = [...values].sort((a, b) => a - b);
  const low = sorted[0] ?? 0;
  const high = sorted[sorted.length - 1] ?? 0;
  const middle = sorted.length <= 2 ? sorted : sorted.slice(1, -1);
  const mostLikely = middle.reduce((sum, value) => sum + value, 0) / middle.length;
  return polarity === 'negative' ? { optimistic: low, mostLikely, pessimistic: high } : { optimistic: high, mostLikely, pessimistic: low };
}

export type DisparityLayout = 'one-row-per-response' | 'one-row-all-responses';
export type ResponseCostRule = 'total' | 'exposure-weighted-average';

// SP 800-221r1 lines 1661 to 1664 and SPEC.md Sec. 6.15 item 4. The total is the default. The
// weighted average weights each cost by the exposure rating of its source, so a source with a
// larger expected loss or gain counts more. When every exposure rating is 0, it is the plain
// mean. The result is rounded to whole currency units, as exposureRating is.
export function responseCost(sources: readonly Risk[], rule: ResponseCostRule): number {
  const total = sources.reduce((sum, source) => sum + source.riskResponseCost, 0);
  if (rule === 'total' || sources.length === 0) return total;
  const weights = sources.reduce((sum, source) => sum + source.exposureRating, 0);
  if (weights === 0) return Math.round(total / sources.length);
  return Math.round(sources.reduce((sum, source) => sum + source.riskResponseCost * source.exposureRating, 0) / weights);
}

export interface SummaryOptions {
  readonly id: string;
  readonly registerId: string;
  readonly riskDescription: string;
  readonly riskOwnerPointOfContact: string;
  readonly layout: DisparityLayout;
  readonly riskResponseDescription?: string;
  readonly priority?: number;
  readonly costRule?: ResponseCostRule;
}

function summary(sources: readonly Risk[], id: string, options: SummaryOptions, types: Risk['riskResponseType']): Risk {
  const first = sources[0];
  if (first === undefined) throw new Error('A summary needs at least one source');
  const polarity = first.polarity;
  if (sources.some((source) => source.polarity !== polarity)) throw new Error('Sources of one summary must have the same polarity');
  const likelihood = threePoint(sources.map((source) => source.riskLikelihood), polarity);
  const impact = threePoint(sources.map((source) => source.riskImpact), polarity);
  const sameCategory = sources.every((source) => source.riskCategory === first.riskCategory);
  const risk: Risk = {
    riskId: id,
    registerId: options.registerId,
    polarity,
    riskDescription: options.riskDescription,
    riskCategory: sameCategory ? first.riskCategory : 'Mixed',
    category: sources.every((source) => JSON.stringify(source.category) === JSON.stringify(first.category)) ? first.category : { code: first.category.code },
    riskLikelihood: likelihood.mostLikely,
    riskImpact: impact.mostLikely,
    exposureRating: Math.round(likelihood.mostLikely * impact.mostLikely),
    riskResponseType: types,
    riskResponseCost: responseCost(sources, options.costRule ?? 'total'),
    riskResponseDescription: options.riskResponseDescription ?? `Responses of the sources ${sources.map((source) => source.riskId).join(', ')}.`,
    riskOwnerPointOfContact: options.riskOwnerPointOfContact,
    status: 'Open',
    responseDecision: 'decided',
    sourceRefs: sources.map((source) => ({ registerId: source.registerId, riskId: source.riskId, label: source.riskId })),
    // Without responseCostRule the cost is the total, as in schema 1.0.0. So only the
    // weighted average writes the field, and a summary with the total stays a 1.0.0 entry.
    rollUp: {
      method: 'nist-three-point',
      disparityLayout: options.layout,
      likelihood,
      impact,
      ...(options.costRule === 'exposure-weighted-average' ? { responseCostRule: options.costRule } : {}),
    },
  };
  if (options.priority !== undefined) risk.priority = options.priority;
  // A number that a source takes from its labels stays marked as defaulted (rules D-Q1 and D-Q3).
  const defaulted = (['/riskLikelihood', '/riskImpact'] as const).filter((field) => sources.some((source) => (source.defaultedFields ?? []).includes(field)));
  if (defaulted.length > 0) risk.defaultedFields = [...defaulted, '/exposureRating'];
  // The summary supports every objective of its sources (lint L-09).
  const objectiveIds = [...new Set(sources.flatMap((source) => source.objectiveIds ?? []))];
  if (objectiveIds.length > 0) risk.objectiveIds = objectiveIds;
  return risk;
}

// one-row-all-responses gives one entry with every distinct type in order of first occurrence.
// one-row-per-response gives one entry per distinct type, from the sources that hold it.
export function summarize(sources: readonly Risk[], options: SummaryOptions): Risk[] {
  const types: Risk['riskResponseType'][number][] = [];
  for (const source of sources) for (const type of source.riskResponseType) if (!types.includes(type)) types.push(type);
  if (options.layout === 'one-row-all-responses') return [summary(sources, options.id, options, types as Risk['riskResponseType'])];
  return types.map((type, index) =>
    summary(
      sources.filter((source) => source.riskResponseType.includes(type)),
      index === 0 ? options.id : `${options.id}.${String(index + 1)}`,
      { ...options, riskResponseDescription: options.riskResponseDescription ?? `${type} by the sources that chose it.` },
      [type],
    ),
  );
}
