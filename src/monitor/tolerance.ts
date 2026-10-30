// Tolerance what-if of screen S6 (SPEC.md Sec. 6.17 item 2). The result with a changed
// tolerance curve comes from the kept per-trial totals, without a new simulation. Saving a
// change moves the old curve into appetite.history with date, person and reason.
import { statusOf, type ToleranceStatus } from '../engine/decision';
import { exceedance, tolerance, type TolerancePoint } from '../engine/metrics';
import type { RiskDocument } from '../schema/types';

type Appetite = NonNullable<RiskDocument['appetite']>;
type CurvePoints = NonNullable<Appetite['toleranceCurve']>['points'];
type CurvePoint = CurvePoints[number];

export interface CurveCheck {
  readonly gap: number;
  readonly clearBreach: boolean;
  readonly excessArea: number;
  readonly status: ToleranceStatus;
  readonly pAboveCapacity?: number;
}

// The document with other curve points, for the measures only.
export function withPoints(doc: RiskDocument, points: readonly TolerancePoint[]): RiskDocument {
  return { ...doc, appetite: { ...doc.appetite, toleranceCurve: { points: points as unknown as CurvePoints } } };
}

// Sec. 8.9 measures of the sorted annual losses of the roll-up against the curve points.
export function checkCurve(doc: RiskDocument, points: readonly TolerancePoint[], sorted: Float64Array): CurveCheck {
  const result = tolerance(withPoints(doc, points), sorted);
  const capacity = doc.appetite?.capacity?.amount;
  return {
    gap: result.gap,
    clearBreach: result.clearBreach,
    excessArea: result.excessArea,
    status: statusOf(result.gap, result.clearBreach),
    ...(capacity === undefined ? {} : { pAboveCapacity: exceedance(sorted, capacity) }),
  };
}

// Rule V-12 and the schema limits, in words for the what-if editor.
export function curveProblems(points: readonly TolerancePoint[]): string[] {
  const problems: string[] = [];
  if (points.length < 2) problems.push('A curve needs at least 2 points.');
  points.forEach((point, i) => {
    if (!(point.loss > 0)) problems.push(`The loss of point ${String(i + 1)} must be more than 0.`);
    if (!(point.maxExceedanceProbability > 0 && point.maxExceedanceProbability <= 1)) problems.push(`The probability of point ${String(i + 1)} must be more than 0 and not more than 1.`);
  });
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1];
    const b = points[i];
    if (a !== undefined && b !== undefined && !(a.loss < b.loss && a.maxExceedanceProbability > b.maxExceedanceProbability)) {
      problems.push('V-12. The loss must go up and the probability must go down from each point to the next.');
      break;
    }
  }
  return problems;
}

export interface CurveChange {
  readonly changedOn: string;
  readonly changedBy: string;
  readonly reason: string;
}

// The new curve has no approval yet. The management body approves it on screen S2.
export function withToleranceChange(doc: RiskDocument, points: readonly TolerancePoint[], change: CurveChange): RiskDocument {
  const appetite = doc.appetite ?? {};
  const old = appetite.toleranceCurve?.points;
  const history = old === undefined ? (appetite.history ?? []) : [...(appetite.history ?? []), { ...change, points: old }];
  const next = points.map((point): CurvePoint => ({ loss: point.loss, maxExceedanceProbability: point.maxExceedanceProbability }));
  return {
    ...doc,
    appetite: {
      ...appetite,
      toleranceCurve: { points: next as unknown as CurvePoints },
      ...(history.length === 0 ? {} : { history }),
    },
  };
}
