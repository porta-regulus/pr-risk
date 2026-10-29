// Funding decision. Algorithmic optimization (SPEC.md Sec. 8.11), greedy fallback,
// fiscal baseline and operational choices (Sec. 8.12), response costs (Sec. 8.10).
// optimize and fiscal follow docs/reference/sim_reference.py step by step.
import type { ResponseOption, RiskDocument } from '../schema/types';
import { mean, registerTotal, sortedCopy, tolerance } from './metrics';
import { createCache, simulate, type Run, type SimulationCache } from './simulate';

export const RANKING_TRIALS = 20_000;
export const CONFIRM_TRIALS = 100_000;
export const PORTFOLIO_LIMIT = 256;
const BATCHES = 10;

export interface Measured {
  readonly eal: number;
  readonly eag: number;
  readonly gap: number;
  readonly area: number;
  readonly clear: boolean;
  readonly loss: Float64Array;
  readonly gain: Float64Array;
  readonly run: Run;
}

export function measure(doc: RiskDocument, trials: number, seed: number, active: readonly string[], cache?: SimulationCache): Measured {
  const run = simulate(doc, cache === undefined ? { trials, seed, active } : { trials, seed, active, cache });
  const loss = registerTotal(doc, run, 'negative');
  const gain = registerTotal(doc, run, 'positive');
  const result = tolerance(doc, sortedCopy(loss));
  return { eal: mean(loss), eag: mean(gain), gap: result.gap, area: result.excessArea, clear: result.clearBreach, loss, gain, run };
}

export function firstYearCash(option: ResponseOption): number {
  return option.costs.oneOff + option.costs.annual + (option.costs.reserveAmount ?? 0);
}

// P(at least one event of any effect target) in the run with the option funded.
export function triggerProbability(option: ResponseOption, run: Run): number {
  let hits = 0;
  for (let t = 0; t < run.trials; t++) {
    const hit = option.effects.some((effect) =>
      effect.targetKind === 'driver'
        ? (run.drivers.get(effect.targetId)?.[t] ?? 0) >= 1
        : (run.risks.get(effect.targetId)?.counts[t] ?? 0) >= 1,
    );
    if (hit) hits += 1;
  }
  return hits / run.trials;
}

// One-off / lifetime + annual + reserve x P(trigger). No discounting.
export function annualizedCost(option: ResponseOption, run?: Run): number {
  const costs = option.costs;
  let cost = costs.oneOff / costs.lifetimeYears + costs.annual;
  if (costs.reserveAmount && run !== undefined) cost += costs.reserveAmount * triggerProbability(option, run);
  return cost;
}

function targetsOf(option: ResponseOption): Set<string> {
  return new Set(option.effects.map((effect) => `${effect.targetKind}|${effect.targetId}`));
}

function conflicts(a: ReadonlySet<string>, b: ReadonlySet<string>): boolean {
  for (const target of a) if (b.has(target)) return true;
  return false;
}

function pool(doc: RiskDocument): ResponseOption[] {
  return (doc.responses ?? []).filter(
    (option) => (option.status === 'candidate' || option.status === 'selected') && option.forced?.action !== 'exclude',
  );
}

export interface Feasible {
  readonly portfolios: string[][];
  // True when more than the limit exist. The list then stops at limit + 1.
  readonly overLimit: boolean;
  readonly requiredOverBudget: string[];
}

// Every set that holds the required options, no two alternatives, and fits the budget.
export function feasiblePortfolios(doc: RiskDocument, budget: number, limit = PORTFOLIO_LIMIT): Feasible {
  const options = pool(doc);
  const targets = new Map(options.map((option) => [option.id, targetsOf(option)]));
  const required = options.filter((option) => option.forced?.action === 'require');
  const free = options.filter((option) => option.forced?.action !== 'require');
  const requiredCash = required.reduce((sum, option) => sum + firstYearCash(option), 0);
  const requiredOverBudget = requiredCash > budget ? required.map((option) => option.id) : [];
  const portfolios: string[][] = [];
  let overLimit = false;

  const walk = (index: number, chosen: ResponseOption[], cash: number): void => {
    if (overLimit) return;
    if (index === free.length) {
      portfolios.push([...required, ...chosen].map((option) => option.id).sort());
      if (portfolios.length > limit) overLimit = true;
      return;
    }
    walk(index + 1, chosen, cash);
    const option = free[index];
    if (option === undefined) return;
    const cost = cash + firstYearCash(option);
    const mine = targets.get(option.id) ?? new Set<string>();
    if (cost <= budget && ![...required, ...chosen].some((other) => conflicts(mine, targets.get(other.id) ?? new Set()))) {
      walk(index + 1, [...chosen, option], cost);
    }
  };
  const requiredConflict = required.some((a, i) => required.slice(i + 1).some((b) => conflicts(targets.get(a.id) ?? new Set(), targets.get(b.id) ?? new Set())));
  if (requiredOverBudget.length === 0 && !requiredConflict) walk(0, [], requiredCash);
  return { portfolios, overLimit, requiredOverBudget };
}

export interface Evaluation {
  readonly ids: string[];
  readonly cash: number;
  readonly cost: number;
  readonly benefit: number;
  readonly net: number;
  readonly eal: number;
  readonly eag: number;
  readonly gap: number;
  readonly area: number;
  readonly clear: boolean;
  // Kept only when needed for the paired standard error.
  readonly measured?: Measured;
}

export function evaluate(
  doc: RiskDocument,
  base: Measured,
  ids: readonly string[],
  trials: number,
  seed: number,
  keep = false,
  cache?: SimulationCache,
): Evaluation {
  const options = new Map((doc.responses ?? []).map((option) => [option.id, option]));
  const m = measure(doc, trials, seed, ids, cache);
  const chosen = ids.map((id) => options.get(id)).filter((option): option is ResponseOption => option !== undefined);
  const cost = chosen.reduce((sum, option) => sum + annualizedCost(option, m.run), 0);
  const benefit = base.eal - m.eal + (m.eag - base.eag);
  const evaluation = {
    ids: [...ids],
    cash: chosen.reduce((sum, option) => sum + firstYearCash(option), 0),
    cost,
    benefit,
    net: benefit - cost,
    eal: m.eal,
    eag: m.eag,
    gap: m.gap,
    area: m.area,
    clear: m.clear,
  };
  return keep ? { ...evaluation, measured: m } : evaluation;
}

// No clear breach first, by net benefit. Then by excess area. Ids break exact ties.
export function compareRank(a: Evaluation, b: Evaluation): number {
  if (a.clear !== b.clear) return a.clear ? 1 : -1;
  if (a.clear && a.area !== b.area) return a.area - b.area;
  if (a.net !== b.net) return b.net - a.net;
  return a.ids.join(',') < b.ids.join(',') ? -1 : a.ids.join(',') > b.ids.join(',') ? 1 : 0;
}

// Batch-means SE of net(a) - net(b), with paired trials. Costs are constants.
export function pairedSe(a: Evaluation, b: Evaluation): number {
  const ma = a.measured;
  const mb = b.measured;
  if (ma === undefined || mb === undefined) throw new Error('pairedSe needs the measured runs');
  const n = ma.loss.length;
  const means: number[] = [];
  let start = 0;
  for (let k = 0; k < BATCHES; k++) {
    const size = Math.floor(n / BATCHES) + (k < n % BATCHES ? 1 : 0);
    let sum = 0;
    for (let t = start; t < start + size; t++) {
      sum += (mb.loss[t] ?? 0) - (ma.loss[t] ?? 0) + ((ma.gain[t] ?? 0) - (mb.gain[t] ?? 0));
    }
    means.push(size > 0 ? sum / size : 0);
    start += size;
  }
  const m = means.reduce((x, y) => x + y, 0) / BATCHES;
  const variance = means.reduce((x, y) => x + (y - m) ** 2, 0) / (BATCHES - 1);
  return Math.sqrt(variance) / Math.sqrt(BATCHES);
}

export interface Marginal {
  readonly netLossIfDropped: number;
  readonly gapIfDropped: number;
}

export interface OptimizationResult {
  readonly method: 'exact' | 'greedy';
  readonly count: number;
  readonly best: Evaluation;
  readonly runnersUp: readonly Evaluation[];
  readonly confirmed: readonly Evaluation[];
  readonly dropped: readonly string[][];
  readonly tooCloseToCall: boolean;
  readonly marginal: ReadonlyMap<string, Marginal>;
  readonly requiredOverBudget: readonly string[];
  readonly notes: readonly string[];
}

export interface OptimizeOptions {
  readonly budget: number;
  readonly seed: number;
  readonly trials?: number;
  readonly confirmTrials?: number;
  readonly limit?: number;
  readonly onProgress?: (done: number, total: number) => void;
}

function strip(evaluation: Evaluation): Evaluation {
  const { measured, ...rest } = evaluation;
  return rest;
}

// Greedy fallback above the limit (Sec. 8.11). Not guaranteed optimal.
function greedy(doc: RiskDocument, base: Measured, budget: number, trials: number, seed: number, cache: SimulationCache): string[] {
  const options = pool(doc);
  const targets = new Map(options.map((option) => [option.id, targetsOf(option)]));
  const chosen = options.filter((option) => option.forced?.action === 'require').map((option) => option.id);
  let current = evaluate(doc, base, chosen, trials, seed, false, cache);
  for (;;) {
    const cash = current.cash;
    const candidates = options.filter(
      (option) =>
        !chosen.includes(option.id) &&
        cash + firstYearCash(option) <= budget &&
        !chosen.some((id) => conflicts(targets.get(id) ?? new Set(), targets.get(option.id) ?? new Set())),
    );
    let bestNext: Evaluation | undefined;
    let bestScore = 0;
    for (const option of candidates) {
      const next = evaluate(doc, base, [...chosen, option.id].sort(), trials, seed, false, cache);
      const added = next.cost - current.cost;
      const score = current.clear
        ? (current.area - next.area) / Math.max(added, 1e-9)
        : (next.benefit - current.benefit - added) / Math.max(added, 1e-9);
      if (score > bestScore) {
        bestScore = score;
        bestNext = next;
      }
    }
    if (bestNext === undefined) return chosen.sort();
    chosen.splice(0, chosen.length, ...bestNext.ids);
    current = bestNext;
  }
}

export function optimize(doc: RiskDocument, options: OptimizeOptions): OptimizationResult {
  const trials = options.trials ?? RANKING_TRIALS;
  const confirmTrials = options.confirmTrials ?? CONFIRM_TRIALS;
  const { budget, seed } = options;
  const feasible = feasiblePortfolios(doc, budget, options.limit ?? PORTFOLIO_LIMIT);
  const notes: string[] = [];
  const rankCache = createCache(trials, seed);
  const confirmCache = createCache(confirmTrials, seed);
  const base = measure(doc, trials, seed, [], rankCache);

  let sets = feasible.portfolios;
  let method: 'exact' | 'greedy' = 'exact';
  if (feasible.overLimit) {
    method = 'greedy';
    notes.push(`More than ${String(options.limit ?? PORTFOLIO_LIMIT)} portfolios. The greedy fallback chose this result, which is not guaranteed optimal.`);
    sets = [greedy(doc, base, budget, trials, seed, rankCache)];
  }
  if (feasible.requiredOverBudget.length > 0) notes.push(`Required but over budget: ${feasible.requiredOverBudget.join(', ')}.`);
  if (sets.length === 0) sets = [[]];

  const evaluations: Evaluation[] = [];
  sets.forEach((ids, index) => {
    evaluations.push(evaluate(doc, base, ids, trials, seed, false, rankCache));
    options.onProgress?.(index + 1, sets.length);
  });
  evaluations.sort(compareRank);

  const big = measure(doc, confirmTrials, seed, [], confirmCache);
  let confirmed: Evaluation[] = [];
  const dropped: string[][] = [];
  for (const candidate of evaluations) {
    const check = evaluate(doc, big, candidate.ids, confirmTrials, seed, true, confirmCache);
    if (!candidate.clear && check.gap > 0) {
      dropped.push(candidate.ids);
      continue;
    }
    confirmed.push(check);
    if (confirmed.length === 2) break;
  }
  notes.push(`Confirmed at ${String(confirmTrials)} trials.`);
  if (dropped.length > 0) notes.push(`Dropped for a breach at confirmation: ${dropped.map((ids) => ids.join('+')).join(', ')}.`);

  let tooCloseToCall = false;
  const [first, second] = confirmed;
  if (first !== undefined && second !== undefined && !first.clear && !second.clear) {
    confirmed.sort(compareRank);
    const [a, b] = confirmed as [Evaluation, Evaluation];
    if (a.net - b.net < 2 * pairedSe(a, b)) {
      tooCloseToCall = true;
      confirmed.sort((x, y) => x.cash - y.cash || (x.ids.join(',') < y.ids.join(',') ? -1 : 1));
      notes.push('Too close to call. The lower first-year cash wins.');
    }
  }
  confirmed = confirmed.map(strip);
  const key = (ids: readonly string[]): string => ids.join(',');
  const done = new Set([...confirmed, ...dropped.map((ids) => ({ ids }))].map((item) => key(item.ids)));
  const ranked = [...confirmed, ...evaluations.filter((item) => !done.has(key(item.ids)))];
  const best = ranked[0] ?? evaluations[0];
  if (best === undefined) throw new Error('No portfolio to rank');

  const marginal = new Map<string, Marginal>();
  for (const id of best.ids) {
    const without = evaluate(doc, base, best.ids.filter((other) => other !== id), trials, seed, false, rankCache);
    marginal.set(id, { netLossIfDropped: Math.round(best.net - without.net), gapIfDropped: Math.round(without.gap * 10000) / 10000 });
  }
  return {
    method,
    count: feasible.overLimit ? feasible.portfolios.length : sets.length,
    best,
    runnersUp: ranked.slice(1, 4),
    confirmed,
    dropped,
    tooCloseToCall,
    marginal,
    requiredOverBudget: feasible.requiredOverBudget,
    notes,
  };
}

// Sec. 8.12 fiscal baseline. Leaf negative risks by expected annual loss, highest first.
// For each, the options that act on the risk or one of its drivers, cheapest first.
export function fiscal(doc: RiskDocument, budget: number, trials: number, seed: number): string[] {
  const base = measure(doc, trials, seed, []);
  const options = (doc.responses ?? []).filter((option) => option.status === 'candidate' || option.status === 'selected');
  const targets = new Map(options.map((option) => [option.id, targetsOf(option)]));
  const links = new Map(doc.risks.map((risk) => [risk.riskId, new Set((risk.driverLinks ?? []).map((link) => link.driverId))]));
  const losses = [...base.run.risks.values()]
    .filter((risk) => risk.polarity === 'negative')
    .map((risk) => ({ id: risk.riskId, eal: mean(risk.annual) }))
    .sort((a, b) => b.eal - a.eal);
  const chosen: string[] = [];
  let spent = 0;
  for (const { id } of losses) {
    const acts = options
      .filter((option) =>
        option.effects.some((effect) => (effect.targetKind === 'risk' && effect.targetId === id) || (effect.targetKind === 'driver' && (links.get(id)?.has(effect.targetId) ?? false))),
      )
      .sort((a, b) => firstYearCash(a) - firstYearCash(b) || (a.id < b.id ? -1 : 1));
    for (const option of acts) {
      if (chosen.includes(option.id) || chosen.some((other) => conflicts(targets.get(option.id) ?? new Set(), targets.get(other) ?? new Set()))) continue;
      if (spent + firstYearCash(option) <= budget) {
        chosen.push(option.id);
        spent += firstYearCash(option);
      }
    }
  }
  return chosen;
}
