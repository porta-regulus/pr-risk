// The numbers of screen S4 Prioritize (SPEC.md Sec. 5, 6.9, 8.8). The roll-up and each register
// against the tolerance curve, percentiles, and the contribution of each risk to the tail.
import type { RiskDocument } from '../schema/types';
import { documentHash, statusOf, state, type StateNumbers, type ToleranceStatus } from './decision';
import { contributions, exceedance, lossGrid, mean, registerTotal, sortedCopy, standardError, tolerance } from './metrics';
import { measure } from './optimize';
import { ENGINE_VERSION } from './version';

export interface RegisterCurve {
  readonly registerId: string;
  readonly eal: number;
  readonly ealSe: number;
  readonly status?: ToleranceStatus;
  readonly lec: readonly {
    readonly loss: number;
    readonly probability: number;
  }[];
}

export interface PriorityNumbers {
  readonly hash: string;
  readonly engineVersion: string;
  readonly seed: number;
  readonly trials: number;
  readonly state: StateNumbers;
  readonly registers: readonly RegisterCurve[];
  readonly contributions: Readonly<Record<string, number>>;
  readonly clippedShare: number;
}

export function priorityNumbers(doc: RiskDocument, trials: number, seed: number): PriorityNumbers {
  const m = measure(doc, trials, seed, []);
  const grid = lossGrid(doc, sortedCopy(m.loss));
  const curve = (doc.appetite?.toleranceCurve?.points ?? []).length > 0;
  const registers = doc.registers.flatMap((register): RegisterCurve[] => {
    const total = registerTotal(doc, m.run, 'negative', register.id);
    const hasRisk = [...m.run.risks.values()].some((risk) => risk.polarity === 'negative' && risk.registerId === register.id);
    if (!hasRisk && mean(total) === 0) return [];
    const sorted = sortedCopy(total);
    const result = tolerance(doc, sorted);
    return [
      {
        registerId: register.id,
        eal: mean(total),
        ealSe: standardError(total),
        ...(curve ? { status: statusOf(result.gap, result.clearBreach) } : {}),
        lec: Array.from(grid, (loss) => ({
          loss,
          probability: exceedance(sorted, loss),
        })),
      },
    ];
  });
  return {
    hash: documentHash(doc),
    engineVersion: ENGINE_VERSION,
    seed,
    trials,
    state: state(doc, m, [], grid),
    registers,
    contributions: Object.fromEntries(contributions(m.run, m.loss)),
    clippedShare: m.run.sampledRates === 0 ? 0 : m.run.clippedRates / m.run.sampledRates,
  };
}
