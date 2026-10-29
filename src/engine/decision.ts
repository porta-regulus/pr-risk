// The numbers of the decision record (SPEC.md Sec. 4). One job runs the optimization at the
// budget and at minus and plus 20% (Sec. 6.17 item 1), the fiscal baseline (Sec. 8.12), and
// the before and after states. Every row of the record is measured again at the confirmation
// trials with one seed, so the rows compare with common random numbers (Sec. 8.6).
import { canonicalSha256 } from '../schema/canonical';
import type { RiskDocument } from '../schema/types';
import { exceedance, lossGrid, PERCENTILES, quantile, riskStats, sortedCopy, standardError, tolerance, toleranceAt, type RiskStats } from './metrics';
import {
  batchSe,
  CONFIRM_TRIALS,
  conflicts,
  evaluate,
  firstYearCash,
  fiscal,
  measure,
  optimize,
  RANKING_TRIALS,
  targetsOf,
  type Evaluation,
  type Marginal,
  type Measured,
} from './optimize';
import { createCache } from './simulate';
import { ENGINE_VERSION } from './version';

export type ToleranceStatus = 'within' | 'breach' | 'clear';

// The document hash of the record. SHA-256 of the RFC 8785 form without the change log, so
// a save that only adds log entries keeps the hash.
export const documentHash = (doc: RiskDocument): string => canonicalSha256({ ...doc, changeLog: undefined });

// Sec. 8.9. A gap above 0 is a breach. A clear breach holds also after 2 standard errors.
export const statusOf = (gap: number, clear: boolean): ToleranceStatus => (clear ? 'clear' : gap > 0 ? 'breach' : 'within');

export interface RiskRow extends RiskStats {
  readonly polarity: 'negative' | 'positive';
  // The risk alone against the tolerance curve. Positive risks have no tolerance status.
  readonly status?: ToleranceStatus;
}

export interface StateNumbers {
  readonly ids: readonly string[];
  readonly eal: number;
  readonly ealSe: number;
  readonly eag: number;
  readonly eagSe: number;
  readonly pAboveCapacity?: number;
  readonly gap: number;
  readonly status: ToleranceStatus;
  readonly percentiles: readonly {
    readonly q: number;
    readonly loss: number;
  }[];
  // The roll-up LEC on the grid of the state before funding, so both curves share one axis.
  readonly lec: readonly {
    readonly loss: number;
    readonly probability: number;
  }[];
  // The LEC at each tolerance point, with its standard error and the tolerance there.
  readonly atPoints: readonly {
    readonly loss: number;
    readonly probability: number;
    readonly se: number;
    readonly tolerance: number;
  }[];
  readonly risks: readonly RiskRow[];
}

export interface PortfolioRow {
  readonly ids: readonly string[];
  readonly cash: number;
  readonly cost: number;
  readonly benefit: number;
  // Batch-means standard error of the benefit, paired with the state before funding.
  readonly benefitSe: number;
  readonly net: number;
  readonly eal: number;
  readonly eag: number;
  readonly gap: number;
  readonly status: ToleranceStatus;
}

export interface NotFunded {
  readonly id: string;
  readonly reason: 'excluded' | 'required-over-budget' | 'alternative' | 'over-budget' | 'adds-less' | 'breach' | 'too-close';
  readonly text: string;
}

export interface ObjectiveRow {
  readonly kind: 'strategic' | 'operations' | 'reporting' | 'compliance';
  readonly risks: number;
  readonly notEstimated: number;
  readonly ealBefore: number;
  readonly ealAfter: number;
  readonly eagBefore: number;
  readonly eagAfter: number;
}

export interface DecisionRecord {
  readonly hash: string;
  readonly engineVersion: string;
  readonly seed: number;
  readonly trials: number;
  readonly rankingTrials: number;
  readonly budget: number;
  readonly method: 'exact' | 'greedy';
  readonly count: number;
  readonly notes: readonly string[];
  readonly tooCloseToCall: boolean;
  readonly before: StateNumbers;
  readonly after: StateNumbers;
  readonly best: PortfolioRow;
  readonly alternatives: readonly PortfolioRow[];
  readonly fiscal: PortfolioRow;
  readonly lower: { readonly budget: number; readonly row: PortfolioRow };
  readonly upper: { readonly budget: number; readonly row: PortfolioRow };
  readonly marginal: Readonly<Record<string, Marginal>>;
  readonly notFunded: readonly NotFunded[];
  readonly requiredOverBudget: readonly string[];
  readonly objectives: readonly ObjectiveRow[];
}

export interface DecisionOptions {
  readonly budget: number;
  readonly seed: number;
  readonly trials?: number;
  readonly confirmTrials?: number;
  readonly onProgress?: (done: number, total: number) => void;
}

const OBJECTIVE_KINDS = ['strategic', 'operations', 'reporting', 'compliance'] as const;

export function state(doc: RiskDocument, m: Measured, ids: readonly string[], grid: Float64Array): StateNumbers {
  const sorted = sortedCopy(m.loss);
  const points = doc.appetite?.toleranceCurve?.points ?? [];
  const capacity = doc.appetite?.capacity?.amount;
  const stats = new Map(riskStats(m.run).map((item) => [item.riskId, item]));
  const risks: RiskRow[] = [...m.run.risks.values()].flatMap((risk) => {
    const item = stats.get(risk.riskId);
    if (item === undefined) return [];
    if (risk.polarity === 'positive' || points.length === 0) return [{ ...item, polarity: risk.polarity }];
    const alone = tolerance(doc, sortedCopy(risk.annual));
    return [
      {
        ...item,
        polarity: risk.polarity,
        status: statusOf(alone.gap, alone.clearBreach),
      },
    ];
  });
  return {
    ids,
    eal: m.eal,
    ealSe: standardError(m.loss),
    eag: m.eag,
    eagSe: standardError(m.gain),
    ...(capacity === undefined ? {} : { pAboveCapacity: exceedance(sorted, capacity) }),
    gap: m.gap,
    status: statusOf(m.gap, m.clear),
    percentiles: PERCENTILES.map((q) => ({ q, loss: quantile(sorted, q) })),
    lec: Array.from(grid, (loss) => ({
      loss,
      probability: exceedance(sorted, loss),
    })),
    atPoints: [...points]
      .sort((a, b) => a.loss - b.loss)
      .map((point) => {
        const p = exceedance(sorted, point.loss);
        return {
          loss: point.loss,
          probability: p,
          se: Math.sqrt((p * (1 - p)) / sorted.length),
          tolerance: toleranceAt(points, point.loss),
        };
      }),
    risks,
  };
}

function row(base: Measured, e: Evaluation): PortfolioRow {
  const m = e.measured;
  if (m === undefined) throw new Error('A record row needs the measured run');
  const benefitSe = batchSe(m.loss.length, (t) => (base.loss[t] ?? 0) - (m.loss[t] ?? 0) + ((m.gain[t] ?? 0) - (base.gain[t] ?? 0)));
  return {
    ids: e.ids,
    cash: e.cash,
    cost: e.cost,
    benefit: e.benefit,
    benefitSe,
    net: e.net,
    eal: e.eal,
    eag: e.eag,
    gap: e.gap,
    status: statusOf(e.gap, e.clear),
  };
}

const money = (value: number): string => Math.round(value).toLocaleString('en');

function reasons(doc: RiskDocument, best: Evaluation, budget: number, required: readonly string[], tooClose: boolean, check: (ids: readonly string[]) => Evaluation): NotFunded[] {
  const options = (doc.responses ?? []).filter((option) => option.status === 'candidate' || option.status === 'selected');
  const funded = options.filter((option) => best.ids.includes(option.id));
  const out: NotFunded[] = [];
  for (const option of options) {
    if (best.ids.includes(option.id)) continue;
    const id = option.id;
    if (option.forced?.action === 'exclude') {
      out.push({
        id,
        reason: 'excluded',
        text: `Excluded by leadership. ${option.forced.reason}`,
      });
      continue;
    }
    if (required.includes(id)) {
      out.push({
        id,
        reason: 'required-over-budget',
        text: 'Required, but the required options together are over the budget.',
      });
      continue;
    }
    const rival = funded.find((other) => conflicts(targetsOf(option), targetsOf(other)));
    if (rival !== undefined) {
      out.push({
        id,
        reason: 'alternative',
        text: `Alternative of the funded option ${rival.id}. Both change the same target.`,
      });
      continue;
    }
    if (best.cash + firstYearCash(option) > budget) {
      out.push({
        id,
        reason: 'over-budget',
        text: `Over budget. With it the first-year cash is ${money(best.cash + firstYearCash(option))}.`,
      });
      continue;
    }
    const added = check([...best.ids, id].sort());
    const change = added.net - best.net;
    if (best.gap === 0 && added.gap > 0)
      out.push({
        id,
        reason: 'breach',
        text: 'With it the roll-up breaches the tolerance curve.',
      });
    else if (change <= 0)
      out.push({
        id,
        reason: 'adds-less',
        text: `Adds less than it costs. Net benefit changes by ${money(change)} per year.`,
      });
    else if (tooClose)
      out.push({
        id,
        reason: 'too-close',
        text: 'Too close to call. The portfolio with the lower first-year cash wins.',
      });
    else
      out.push({
        id,
        reason: 'adds-less',
        text: `Not in the best confirmed portfolio. Net benefit with it changes by ${money(change)} per year.`,
      });
  }
  return out;
}

function objectives(doc: RiskDocument, before: StateNumbers, after: StateNumbers): ObjectiveRow[] {
  const kinds = new Map((doc.context?.objectives ?? []).map((objective) => [objective.id, objective.kind]));
  const valueOf = (numbers: StateNumbers): Map<string, RiskRow> => new Map(numbers.risks.map((risk) => [risk.riskId, risk]));
  const b = valueOf(before);
  const a = valueOf(after);
  return OBJECTIVE_KINDS.map((kind) => {
    // A risk that a response introduces counts only when that response is funded.
    const risks = doc.risks.filter(
      (risk) => (risk.objectiveIds ?? []).some((id) => kinds.get(id) === kind) && (risk.onlyWithResponse === undefined || after.ids.includes(risk.onlyWithResponse)),
    );
    const sum = (map: Map<string, RiskRow>, polarity: 'negative' | 'positive'): number =>
      risks.filter((risk) => risk.polarity === polarity).reduce((total, risk) => total + (map.get(risk.riskId)?.expectedAnnual ?? 0), 0);
    return {
      kind,
      risks: risks.length,
      notEstimated: risks.filter((risk) => risk.estimate === undefined).length,
      ealBefore: sum(b, 'negative'),
      ealAfter: sum(a, 'negative'),
      eagBefore: sum(b, 'positive'),
      eagAfter: sum(a, 'positive'),
    };
  });
}

export function decisionRecord(doc: RiskDocument, options: DecisionOptions): DecisionRecord {
  const { budget, seed } = options;
  const trials = options.trials ?? RANKING_TRIALS;
  const confirmTrials = options.confirmTrials ?? CONFIRM_TRIALS;
  const steps = 7;
  let done = 0;
  const step = (): void => {
    done += 1;
    options.onProgress?.(done, steps);
  };
  const run = (amount: number) => optimize(doc, { budget: amount, seed, trials, confirmTrials });
  const result = run(budget);
  step();
  const lower = run(budget * 0.8);
  step();
  const upper = run(budget * 1.2);
  step();
  const fiscalIds = fiscal(doc, budget, confirmTrials, seed).sort();
  step();

  const cache = createCache(confirmTrials, seed);
  const base = measure(doc, confirmTrials, seed, [], cache);
  const check = (ids: readonly string[]): Evaluation => evaluate(doc, base, ids, confirmTrials, seed, true, cache);
  const best = check(result.best.ids);
  const grid = lossGrid(doc, sortedCopy(base.loss));
  const before = state(doc, base, [], grid);
  const bestMeasured = best.measured;
  if (bestMeasured === undefined) throw new Error('The best portfolio has no measured run');
  const after = state(doc, bestMeasured, best.ids, grid);
  step();
  // The next 3 of the ranking, in rank order of their confirmation numbers.
  const alternatives = result.runnersUp
    .slice(0, 3)
    .map((item) => row(base, check(item.ids)))
    .sort((a, b) => Number(a.status === 'clear') - Number(b.status === 'clear') || b.net - a.net);
  const fiscalRow = row(base, check(fiscalIds));
  step();
  const record: DecisionRecord = {
    hash: documentHash(doc),
    engineVersion: ENGINE_VERSION,
    seed,
    trials: confirmTrials,
    rankingTrials: trials,
    budget,
    method: result.method,
    count: result.count,
    notes: result.notes,
    tooCloseToCall: result.tooCloseToCall,
    before,
    after,
    best: row(base, best),
    alternatives,
    fiscal: fiscalRow,
    lower: { budget: budget * 0.8, row: row(base, check(lower.best.ids)) },
    upper: { budget: budget * 1.2, row: row(base, check(upper.best.ids)) },
    // Net benefit lost and the gap if one option is dropped, at the confirmation trials.
    marginal: Object.fromEntries(
      best.ids.map((id) => {
        const without = check(best.ids.filter((other) => other !== id));
        return [
          id,
          {
            netLossIfDropped: best.net - without.net,
            gapIfDropped: without.gap,
          },
        ];
      }),
    ),
    notFunded: reasons(doc, best, budget, result.requiredOverBudget, result.tooCloseToCall, check),
    requiredOverBudget: result.requiredOverBudget,
    objectives: objectives(doc, before, after),
  };
  step();
  return record;
}
