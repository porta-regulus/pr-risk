// Outputs (SPEC.md Sec. 8.8) and the tolerance curve (Sec. 8.9).
import type { RiskDocument } from '../schema/types';
import type { Run } from './simulate';

export const GRID_POINTS = 200;
export const PERCENTILES = [0.5, 0.9, 0.95, 0.99, 0.996] as const;

export interface TolerancePoint {
  readonly loss: number;
  readonly maxExceedanceProbability: number;
}

function subtree(doc: RiskDocument, registerId: string): Set<string> {
  const ids = new Set([registerId]);
  let changed = true;
  while (changed) {
    changed = false;
    for (const register of doc.registers) {
      if (register.parentRegisterId !== undefined && ids.has(register.parentRegisterId) && !ids.has(register.id)) {
        ids.add(register.id);
        changed = true;
      }
    }
  }
  return ids;
}

// L_g,t (negative) or W_g,t (positive) over the subtree of g. Without g, over every root.
export function registerTotal(doc: RiskDocument, run: Run, polarity: 'negative' | 'positive', registerId?: string): Float64Array {
  const ids =
    registerId === undefined
      ? new Set(doc.registers.filter((register) => register.parentRegisterId === undefined).flatMap((register) => [...subtree(doc, register.id)]))
      : subtree(doc, registerId);
  const total = new Float64Array(run.trials);
  for (const risk of run.risks.values()) {
    if (risk.polarity !== polarity || !ids.has(risk.registerId)) continue;
    for (let t = 0; t < run.trials; t++) total[t] = (total[t] ?? 0) + (risk.annual[t] ?? 0);
  }
  return total;
}

export function mean(values: ArrayLike<number>): number {
  let sum = 0;
  for (let i = 0; i < values.length; i++) sum += values[i] ?? 0;
  return values.length === 0 ? 0 : sum / values.length;
}

// Standard error of a mean, sample standard deviation over sqrt(T).
export function standardError(values: ArrayLike<number>): number {
  const n = values.length;
  if (n < 2) return 0;
  const m = mean(values);
  let squares = 0;
  for (let i = 0; i < n; i++) squares += ((values[i] ?? 0) - m) ** 2;
  return Math.sqrt(squares / (n - 1)) / Math.sqrt(n);
}

export function shareAtLeastOne(counts: ArrayLike<number>): number {
  let hits = 0;
  for (let i = 0; i < counts.length; i++) if ((counts[i] ?? 0) >= 1) hits += 1;
  return counts.length === 0 ? 0 : hits / counts.length;
}

// Quantile with linear interpolation (Hyndman and Fan type 7, the NumPy default).
export function quantile(sorted: Float64Array, q: number): number {
  if (sorted.length === 0) return 0;
  const position = q * (sorted.length - 1);
  const low = Math.floor(position);
  const high = Math.min(low + 1, sorted.length - 1);
  const a = sorted[low] ?? 0;
  const b = sorted[high] ?? 0;
  return a + (position - low) * (b - a);
}

// Share of trials with a loss above x, from the sorted losses.
export function exceedance(sorted: Float64Array, x: number): number {
  let lo = 0;
  let hi = sorted.length;
  while (lo < hi) {
    const mid = (lo + hi) >>> 1;
    if ((sorted[mid] ?? 0) <= x) lo = mid + 1;
    else hi = mid;
  }
  return sorted.length === 0 ? 0 : 1 - lo / sorted.length;
}

// Sec. 8.9. No limit below the first point, log-log interpolation, last slope above.
export function toleranceAt(points: readonly TolerancePoint[], x: number): number {
  const sorted = [...points].sort((a, b) => a.loss - b.loss);
  const xs = sorted.map((point) => Math.log10(point.loss));
  const ps = sorted.map((point) => Math.log10(point.maxExceedanceProbability));
  const lx = Math.log10(x);
  const x0 = xs[0] ?? 0;
  if (lx < x0) return 1;
  if (lx === x0) return 10 ** (ps[0] ?? 0);
  for (let i = 1; i < xs.length; i++) {
    const xi = xs[i] ?? 0;
    if (lx <= xi) {
      const xp = xs[i - 1] ?? 0;
      const pp = ps[i - 1] ?? 0;
      const w = (lx - xp) / (xi - xp);
      return 10 ** (pp + w * ((ps[i] ?? 0) - pp));
    }
  }
  const n = xs.length;
  if (n < 2) return 10 ** (ps[0] ?? 0);
  const slope = ((ps[n - 1] ?? 0) - (ps[n - 2] ?? 0)) / ((xs[n - 1] ?? 0) - (xs[n - 2] ?? 0));
  return Math.max(1e-6, 10 ** ((ps[n - 1] ?? 0) + slope * (lx - (xs[n - 1] ?? 0))));
}

export interface ToleranceResult {
  readonly gap: number;
  readonly clearBreach: boolean;
  readonly excessArea: number;
}

export function capacityOf(doc: RiskDocument): number | undefined {
  const points = doc.appetite?.toleranceCurve?.points ?? [];
  const amount = doc.appetite?.capacity?.amount;
  if (amount !== undefined) return amount;
  return points.length === 0 ? undefined : Math.max(...points.map((point) => point.loss));
}

// The 200-point log grid of Sec. 8.8.
export function lossGrid(doc: RiskDocument, sorted: Float64Array): Float64Array {
  const capacity = capacityOf(doc) ?? Math.max(1, sorted[sorted.length - 1] ?? 1);
  const xMin = Math.max(1, 0.001 * capacity);
  const xMax = Math.max(10 * capacity, sorted.length > 0 ? (sorted[sorted.length - 1] ?? 0) : 10 * capacity);
  const a = Math.log10(xMin);
  const b = Math.log10(xMax);
  const grid = new Float64Array(GRID_POINTS);
  for (let i = 0; i < GRID_POINTS; i++) grid[i] = 10 ** (a + ((b - a) * i) / (GRID_POINTS - 1));
  return grid;
}

export function tolerance(doc: RiskDocument, sorted: Float64Array): ToleranceResult {
  const points = doc.appetite?.toleranceCurve?.points;
  if (points === undefined || points.length === 0) return { gap: 0, clearBreach: false, excessArea: 0 };
  const grid = lossGrid(doc, sorted);
  const step = (Math.log10(grid[GRID_POINTS - 1] ?? 1) - Math.log10(grid[0] ?? 1)) / (GRID_POINTS - 1);
  let gap = Number.NEGATIVE_INFINITY;
  let clearBreach = false;
  let excessArea = 0;
  for (const x of grid) {
    const lec = exceedance(sorted, x);
    const excess = lec - toleranceAt(points, x);
    const se = Math.sqrt((lec * (1 - lec)) / sorted.length);
    gap = Math.max(gap, excess);
    if (excess - 2 * se > 0) clearBreach = true;
    excessArea += Math.max(0, excess) * step;
  }
  return { gap: Math.max(0, gap), clearBreach, excessArea };
}

export function sortedCopy(values: Float64Array): Float64Array {
  return Float64Array.from(values).sort();
}

export interface RiskStats {
  readonly riskId: string;
  readonly probability: number;
  readonly probabilitySe: number;
  readonly probabilityAbove: number;
  readonly expectedAnnual: number;
  readonly expectedAnnualSe: number;
  readonly impactGivenEvent: number;
}

export function riskStats(run: Run): RiskStats[] {
  return [...run.risks.values()].map((risk) => {
    const p = shareAtLeastOne(risk.counts);
    const expectedAnnual = mean(risk.annual);
    return {
      riskId: risk.riskId,
      probability: p,
      probabilitySe: Math.sqrt((p * (1 - p)) / run.trials),
      probabilityAbove: shareAtLeastOne(risk.above),
      expectedAnnual,
      expectedAnnualSe: standardError(risk.annual),
      impactGivenEvent: p > 0 ? expectedAnnual / p : 0,
    };
  });
}

// Mean S_r over trials with the root loss above its P95, over the mean root loss there.
export function contributions(run: Run, loss: Float64Array): Map<string, number> {
  const p95 = quantile(sortedCopy(loss), 0.95);
  const tail: number[] = [];
  for (let t = 0; t < loss.length; t++) if ((loss[t] ?? 0) > p95) tail.push(t);
  const tailLoss = tail.reduce((sum, t) => sum + (loss[t] ?? 0), 0);
  const out = new Map<string, number>();
  for (const risk of run.risks.values()) {
    if (risk.polarity !== 'negative') continue;
    const share = tail.reduce((sum, t) => sum + (risk.annual[t] ?? 0), 0);
    out.set(risk.riskId, tailLoss > 0 ? share / tailLoss : 0);
  }
  return out;
}
