// Plain-data results that cross the worker boundary (no typed arrays of every trial).
import type { RiskDocument } from '../schema/types';
import { contributions, exceedance, lossGrid, PERCENTILES, quantile, riskStats, sortedCopy, standardError, type RiskStats } from './metrics';
import type { Measured } from './optimize';

export interface RunSummary {
  readonly trials: number;
  readonly seed: number;
  readonly active: readonly string[];
  readonly eal: number;
  readonly ealSe: number;
  readonly eag: number;
  readonly gap: number;
  readonly excessArea: number;
  readonly clearBreach: boolean;
  readonly percentiles: readonly { readonly q: number; readonly loss: number }[];
  readonly lec: readonly { readonly loss: number; readonly probability: number }[];
  readonly risks: readonly RiskStats[];
  readonly contributions: Readonly<Record<string, number>>;
  readonly clippedShare: number;
}

export function summarize(doc: RiskDocument, m: Measured): RunSummary {
  const sorted = sortedCopy(m.loss);
  return {
    trials: m.run.trials,
    seed: m.run.seed,
    active: m.run.active,
    eal: m.eal,
    ealSe: standardError(m.loss),
    eag: m.eag,
    gap: m.gap,
    excessArea: m.area,
    clearBreach: m.clear,
    percentiles: PERCENTILES.map((q) => ({ q, loss: quantile(sorted, q) })),
    lec: Array.from(lossGrid(doc, sorted), (loss) => ({ loss, probability: exceedance(sorted, loss) })),
    risks: riskStats(m.run),
    contributions: Object.fromEntries(contributions(m.run, m.loss)),
    clippedShare: m.run.sampledRates === 0 ? 0 : m.run.clippedRates / m.run.sampledRates,
  };
}
