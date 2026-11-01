// Observations of KPIs and KRIs, review triggers and acceptance records of screen S6
// (SPEC.md Sec. 6.11 items 1 and 2, Sec. 6.14 item 1).
import type { Risk, RiskDocument } from '../schema/types';
import { evaluateStatement, evaluateTrigger, type BoundaryGap, type Values } from './triggers';

type Statement = NonNullable<NonNullable<RiskDocument['appetite']>['statements']>[number];
type Tolerance = NonNullable<Statement['tolerances']>[number];
type Indicator = NonNullable<Statement['indicators']>[number];
type Trigger = NonNullable<Tolerance['breachWhen']>;
export type Observation = NonNullable<Tolerance['observations']>[number];

const triggerOf = (item: Tolerance | Indicator): Trigger | undefined => ('breachWhen' in item ? item.breachWhen : 'firesWhen' in item ? item.firesWhen : undefined);

export const valuesOf = (observation: Observation): Values =>
  Object.fromEntries(Object.entries(observation.values).filter((entry): entry is [string, number] => typeof entry[1] === 'number'));

// The latest observation by date. On the same date, the one recorded last.
export function latestObservation(item: Tolerance | Indicator): Observation | undefined {
  let latest: Observation | undefined;
  for (const observation of item.observations ?? []) if (latest === undefined || observation.observedOn >= latest.observedOn) latest = observation;
  return latest;
}

export interface ItemState {
  // Fired for an indicator, breached for a tolerance. No data when there is no observation,
  // or when the latest observation does not hold every metric of the trigger.
  readonly state: 'fired' | 'not-fired' | 'no-data';
  readonly observation?: Observation;
  readonly missing: readonly string[];
}

// Sec. 6.11 item 1. The trigger evaluated on the latest observation.
export function itemState(item: Tolerance | Indicator): ItemState {
  const trigger = triggerOf(item);
  const observation = latestObservation(item);
  if (trigger === undefined || observation === undefined) return { state: 'no-data', missing: [] };
  const result = evaluateTrigger(trigger, valuesOf(observation));
  if (result.missing.length > 0) return { state: 'no-data', observation, missing: result.missing };
  return { state: result.fired ? 'fired' : 'not-fired', observation, missing: [] };
}

// One observation of a statement goes to every tolerance and indicator whose trigger uses one
// of its metrics, with the values of those metrics only.
export function withObservation(statement: Statement, observation: Observation): Statement {
  const add = <T extends Tolerance | Indicator>(item: T): T => {
    const metrics = new Set((triggerOf(item)?.conditions ?? []).map((condition) => condition.metric));
    const values = Object.fromEntries(Object.entries(valuesOf(observation)).filter(([metric]) => metrics.has(metric)));
    if (Object.keys(values).length === 0) return item;
    const entry: Observation = { observedOn: observation.observedOn, values, ...(observation.note === undefined || observation.note === '' ? {} : { note: observation.note }) };
    return { ...item, observations: [...(item.observations ?? []), entry] };
  };
  return {
    ...statement,
    ...(statement.tolerances === undefined ? {} : { tolerances: statement.tolerances.map(add) }),
    ...(statement.indicators === undefined ? {} : { indicators: statement.indicators.map(add) }),
  };
}

// The latest value of each metric over the items of a statement.
export function latestValues(statement: Statement): Values {
  const dated = new Map<string, readonly [string, number]>();
  for (const item of [...(statement.tolerances ?? []), ...(statement.indicators ?? [])]) {
    const observation = latestObservation(item);
    if (observation === undefined) continue;
    for (const [metric, value] of Object.entries(valuesOf(observation))) {
      const seen = dated.get(metric);
      if (seen === undefined || observation.observedOn >= seen[0]) dated.set(metric, [observation.observedOn, value]);
    }
  }
  return Object.fromEntries([...dated].map(([metric, [, value]]) => [metric, value]));
}

// The latest values sit on a Table 9 boundary gap and nothing fires (golden test G2 (b)).
export function latestInGap(statement: Statement): readonly BoundaryGap[] {
  return evaluateStatement(statement, latestValues(statement)).inGap;
}

// The appetite statements of a risk, by its category (Sec. 6.5 item 3).
export function statementsOf(doc: RiskDocument, risk: Risk): Statement[] {
  return (doc.appetite?.statements ?? []).filter((statement) => (statement.categoryCodes ?? []).includes(risk.category.code));
}

export type AcceptanceState = 'valid' | 'expired' | 'open-ended';

// Sec. 6.14 item 1. An acceptance past validUntil has expired.
export function acceptanceState(risk: Risk, today: string): AcceptanceState | undefined {
  const acceptance = risk.acceptance;
  if (acceptance === undefined) return undefined;
  if (acceptance.validUntil === undefined) return 'open-ended';
  return acceptance.validUntil < today ? 'expired' : 'valid';
}

export interface ReviewReason {
  readonly kind: 'tolerance' | 'kri' | 'review-due' | 'acceptance-expired' | 'emerging';
  // A fixed name of the reason. The change log keeps it, so a reason acts once also when its
  // text changes in a later version of the app.
  readonly key: string;
  readonly text: string;
}

// The reason of a breached tolerance or a fired KRI, named by the observation that breaches or
// fires it. A second observation on the same date gets its number, so it is a new reason.
function itemReason(kind: 'tolerance' | 'kri', statement: Statement, item: Tolerance | Indicator): ReviewReason[] {
  const { state, observation } = itemState(item);
  if (state !== 'fired' || observation === undefined) return [];
  const sameDay = (item.observations ?? []).filter((other) => other.observedOn === observation.observedOn);
  const n = sameDay.indexOf(observation) + 1;
  const name = sameDay.length === 1 ? `the observation of ${observation.observedOn}` : `observation ${String(n)} of ${observation.observedOn}`;
  const text = kind === 'kri' ? `${item.id} of appetite statement ${statement.id} fires on ${name}.` : `${capitalized(name)} breaches ${item.id} of appetite statement ${statement.id}.`;
  return [{ kind, key: `${kind}/${statement.id}/${item.id}/${observation.observedOn}/${String(n)}`, text }];
}

const capitalized = (text: string): string => text.charAt(0).toUpperCase() + text.slice(1);

export interface ReviewTrigger {
  readonly riskId: string;
  readonly reasons: readonly ReviewReason[];
}

const NEW_HORIZONS = new Set(['emerging', 'horizon']);

// The date a risk became emerging or horizon, from the change log: the entry that added it as
// such, or the entry that changed its horizon to one of them.
export function emergedOn(doc: RiskDocument, riskId: string): string | undefined {
  let found: string | undefined;
  for (const entry of doc.changeLog ?? []) {
    if (entry.entityKind !== 'risk' || entry.entityId !== riskId) continue;
    const after = entry.after as { horizon?: string } | undefined;
    const before = entry.before as { horizon?: string } | undefined;
    if (after?.horizon !== undefined && NEW_HORIZONS.has(after.horizon) && (before === undefined || before.horizon === undefined || !NEW_HORIZONS.has(before.horizon))) {
      found = entry.at.slice(0, 10);
    }
  }
  return found;
}

// Sec. 6.11 item 2 and Sec. 6.14 item 1. The reasons why each risk needs a review now. A
// closed risk needs none. A breached tolerance is a reason too (answer of the product owner,
// 2026-10-31), because a KRI only warns before the tolerance breaches. "New" for an emerging
// or horizon risk means after the as-of date of the other risk's register, because that date
// is the last assessment.
export function reviewTriggers(doc: RiskDocument, today: string): ReviewTrigger[] {
  const asOf = new Map(doc.registers.map((register) => [register.id, register.asOf]));
  // One reason per breached tolerance and per fired KRI. An item without a new observation
  // keeps its reason, so the app does not act on it again.
  const fired = new Map(
    (doc.appetite?.statements ?? []).map((statement) => [
      statement.id,
      [
        ...(statement.tolerances ?? []).flatMap((item) => itemReason('tolerance', statement, item)),
        ...(statement.indicators ?? []).flatMap((item) => (item.kind === 'kpi' ? [] : itemReason('kri', statement, item))),
      ],
    ]),
  );
  const emerged = doc.risks
    .filter((risk) => risk.horizon !== undefined && NEW_HORIZONS.has(risk.horizon))
    .flatMap((risk) => {
      const on = emergedOn(doc, risk.riskId);
      return on === undefined ? [] : [{ risk, on }];
    });
  const out: ReviewTrigger[] = [];
  for (const risk of doc.risks) {
    if (risk.status === 'Closed') continue;
    const reasons: ReviewReason[] = [];
    for (const statement of statementsOf(doc, risk)) {
      reasons.push(...(fired.get(statement.id) ?? []));
    }
    if (risk.reviewDue !== undefined && risk.reviewDue < today) reasons.push({ kind: 'review-due', key: `review-due/${risk.reviewDue}`, text: `The review was due on ${risk.reviewDue}.` });
    const until = risk.acceptance?.validUntil ?? '';
    if (acceptanceState(risk, today) === 'expired') reasons.push({ kind: 'acceptance-expired', key: `acceptance-expired/${until}`, text: `The acceptance expired on ${until}.` });
    const since = asOf.get(risk.registerId) ?? '';
    for (const item of emerged) {
      if (item.risk.riskId === risk.riskId || item.risk.category.code !== risk.category.code || !(item.on > since)) continue;
      reasons.push({ kind: 'emerging', key: `emerging/${item.risk.riskId}/${item.on}`, text: `${item.risk.riskId} is a new ${item.risk.horizon ?? ''} risk in the same category since ${item.on}.` });
    }
    if (reasons.length > 0) out.push({ riskId: risk.riskId, reasons });
  }
  return out;
}

// The actor of the change log entries that the app writes itself. A person never has it.
export const APP_ACTOR = 'PortaRegulus Risk (automatic review)';

export const reasonKey = (riskId: string, reason: Pick<ReviewReason, 'key'>): string => `${riskId} ${reason.key}`;

// The reviews that the app starts itself (Sec. 6.11 item 2, Sec. 6.14 item 1). A risk with the
// status "Review needed" gets none. A reason acts once, so a person ends the review with
// another status. A new observation, review date, acceptance end or risk is a new reason.
// done holds the keys of reasons that acted earlier, also when undo took the change back.
export function automaticReviews(doc: RiskDocument, today: string, done: ReadonlySet<string> = new Set()): ReviewTrigger[] {
  const status = new Map(doc.risks.map((risk) => [risk.riskId, risk.status]));
  // The reasons that the app acted on before. The change log keeps their keys.
  const acted = new Set(
    (doc.changeLog ?? []).flatMap((entry) => (entry.entityKind === 'risk' && entry.actor === APP_ACTOR ? (entry.reasons ?? []).map((reason) => reasonKey(entry.entityId, reason)) : [])),
  );
  return reviewTriggers(doc, today).flatMap((trigger) => {
    if (status.get(trigger.riskId) === 'Review needed') return [];
    const reasons = trigger.reasons.filter((reason) => !done.has(reasonKey(trigger.riskId, reason)) && !acted.has(reasonKey(trigger.riskId, reason)));
    return reasons.length === 0 ? [] : [{ riskId: trigger.riskId, reasons }];
  });
}

// Sets "Review needed" with one change log entry per risk. The entry has the app as actor and
// lists the reasons, so nobody takes it for the change of a person.
export function withAutomaticReview(doc: RiskDocument, reviews: readonly ReviewTrigger[], at: string): RiskDocument {
  const reasons = new Map(reviews.map((review) => [review.riskId, review.reasons]));
  const entries: NonNullable<RiskDocument['changeLog']> = [];
  const risks = doc.risks.map((risk) => {
    const [first, ...rest] = (reasons.get(risk.riskId) ?? []).map(({ key, text }) => ({ key, text }));
    if (first === undefined || risk.status === 'Review needed') return risk;
    const after: Risk = { ...risk, status: 'Review needed' };
    entries.push({ at, actor: APP_ACTOR, reasons: [first, ...rest], entityKind: 'risk', entityId: risk.riskId, path: '', before: risk, after });
    return after;
  });
  return entries.length === 0 ? doc : { ...doc, risks, changeLog: [...(doc.changeLog ?? []), ...entries] };
}
