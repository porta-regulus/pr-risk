// Appetite statements, tolerances and KRIs of SP 800-221r1 Table 9 (SPEC.md Sec. 6.10, G2).
import type { RiskDocument } from '../schema/types';

type Statement = NonNullable<NonNullable<RiskDocument['appetite']>['statements']>[number];
type Trigger = NonNullable<NonNullable<Statement['tolerances']>[number]['breachWhen']>;
type Condition = Trigger['conditions'][number];

export type Values = Readonly<Record<string, number>>;

export interface TriggerResult {
  readonly fired: boolean;
  // Metrics that the trigger needs but the values do not hold. A trigger with a
  // missing metric does not fire, and the view says why.
  readonly missing: readonly string[];
}

function holds(condition: Condition, value: number): boolean {
  switch (condition.operator) {
    case '>':
      return value > condition.threshold;
    case '>=':
      return value >= condition.threshold;
    case '<':
      return value < condition.threshold;
    case '<=':
      return value <= condition.threshold;
    case '==':
      return value === condition.threshold;
    default:
      return value !== condition.threshold;
  }
}

export function evaluateTrigger(trigger: Trigger, values: Values): TriggerResult {
  const missing = trigger.conditions.filter((condition) => values[condition.metric] === undefined).map((condition) => condition.metric);
  const results = trigger.conditions.filter((condition) => values[condition.metric] !== undefined).map((condition) => holds(condition, values[condition.metric] ?? Number.NaN));
  const fired = missing.length === 0 && (trigger.combine === 'all' ? results.every(Boolean) : results.some(Boolean));
  return { fired, missing };
}

export interface BoundaryGap {
  readonly metric: string;
  readonly threshold: number;
}

// A value that no condition of the statement covers, because one condition uses ">" and
// another "<" at the same threshold and none includes it (Table 9 example 3 at 5 percent).
export function boundaryGaps(statement: Statement): BoundaryGap[] {
  const triggers = [...(statement.tolerances ?? []).map((item) => item.breachWhen), ...(statement.indicators ?? []).map((item) => item.firesWhen)].filter(
    (trigger): trigger is Trigger => trigger !== undefined,
  );
  const byKey = new Map<string, Set<string>>();
  for (const condition of triggers.flatMap((trigger) => trigger.conditions)) {
    const key = `${condition.metric}\u0000${String(condition.threshold)}`;
    byKey.set(key, (byKey.get(key) ?? new Set()).add(condition.operator));
  }
  const gaps: BoundaryGap[] = [];
  for (const [key, operators] of byKey) {
    const covers = operators.has('>=') || operators.has('<=') || operators.has('==');
    if (operators.has('>') && operators.has('<') && !covers) {
      const [metric = '', threshold = '0'] = key.split('\u0000');
      gaps.push({ metric, threshold: Number(threshold) });
    }
  }
  return gaps;
}

export interface StatementResult {
  readonly tolerances: readonly { readonly id: string; readonly breached: boolean; readonly missing: readonly string[] }[];
  readonly indicators: readonly { readonly id: string; readonly kind: string; readonly fired: boolean; readonly missing: readonly string[] }[];
  // The values sit on a boundary gap and nothing fired. The view flags it.
  readonly inGap: readonly BoundaryGap[];
}

export function evaluateStatement(statement: Statement, values: Values): StatementResult {
  const tolerances = (statement.tolerances ?? [])
    .filter((item) => item.breachWhen !== undefined)
    .map((item) => {
      const result = evaluateTrigger(item.breachWhen as Trigger, values);
      return { id: item.id, breached: result.fired, missing: result.missing };
    });
  const indicators = (statement.indicators ?? [])
    .filter((item) => item.firesWhen !== undefined)
    .map((item) => {
      const result = evaluateTrigger(item.firesWhen as Trigger, values);
      return { id: item.id, kind: item.kind, fired: result.fired, missing: result.missing };
    });
  const nothing = tolerances.every((item) => !item.breached) && indicators.every((item) => !item.fired);
  const inGap = nothing ? boundaryGaps(statement).filter((gap) => values[gap.metric] === gap.threshold) : [];
  return { tolerances, indicators, inGap };
}
