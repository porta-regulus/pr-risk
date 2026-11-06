// Guided questions for capacity, appetite and tolerance (SPEC.md Sec. 6.5 item 6, rules in
// docs/release-2/appetite-questions.md). Pure functions. The screen part is guided-questions.tsx.
// appetite.elicitation holds only the answers. Every amount comes again from its capacity and
// the answers, so the record has no amount that can disagree with the answers.
import { samePoints, withToleranceChange } from '../monitor/tolerance';
import type { RiskDocument } from '../schema/types';
import { draftList, nextId, type TolerancePoint, withSection, withValue } from './edit';

type Appetite = NonNullable<RiskDocument['appetite']>;
export type Elicitation = NonNullable<Appetite['elicitation']>;
export type ElicitationPoint = NonNullable<Elicitation['points']>[number];
export type OneIn = ElicitationPoint['oneIn'];
export type SearchAnswer = ElicitationPoint['answers'][number];
export type Criterion = NonNullable<Elicitation['criteria']>[number];
export type CriterionAnswer = Criterion['answer'];
export type CrossCheckAnswer = NonNullable<Elicitation['crossCheck']>['answer'];
type Statement = NonNullable<Appetite['statements']>[number];

// Rule 5. The order of the points.
export const ONE_IN: readonly OneIn[] = [100, 20, 5, 2];
// Rule 4 and decision O1. A search starts with the range from 1/30 of the upper limit to the
// upper limit. 3 answers set a point.
export const SEARCH_RANGE = 30;
export const SEARCH_ANSWERS = 3;
// Stage 1. The steps of the capacity slider, 1-2-5 on a log scale.
export const CAPACITY_STEPS: readonly number[] = [10_000, 20_000, 50_000, 100_000, 200_000, 500_000, 1_000_000, 2_000_000, 5_000_000, 10_000_000];

// Rule 4. 2 significant digits, so the board reads a plain number such as 120 000.
export const roundAmount = (value: number): number => Number(value.toPrecision(2));

const midpoint = (lower: number, upper: number): number => roundAmount(Math.sqrt(lower * upper));

// The slider step nearest to an amount on a log scale.
export function nearestStep(amount: number): number {
  let best = 0;
  CAPACITY_STEPS.forEach((step, i) => {
    if (Math.abs(Math.log(step / amount)) < Math.abs(Math.log((CAPACITY_STEPS[best] ?? step) / amount))) best = i;
  });
  return best;
}

// set: 3 answers gave the loss. empty: the board answered "Do not know" (rule 6).
// open: the next question asks about this point. waiting: an earlier point is still open.
export type PointStatus = 'set' | 'empty' | 'open' | 'waiting';

export interface PointState {
  readonly oneIn: OneIn;
  readonly status: PointStatus;
  readonly answers: readonly SearchAnswer[];
  // set. The tolerance loss of the point.
  readonly loss?: number;
  // open. The amount of the next question.
  readonly question?: number;
}

// Rules 4 to 6. The state of the 4 searches from the capacity of the record and the answers.
// Each point is below the last point that is set, so the points meet V-12 by construction.
export function searchPoints(capacity: number, points: readonly ElicitationPoint[]): PointState[] {
  const states: PointState[] = [];
  let limit = 2 * capacity;
  let waiting = false;
  for (const oneIn of ONE_IN) {
    const answers = points.find((point) => point.oneIn === oneIn)?.answers ?? [];
    if (waiting) {
      states.push({ oneIn, status: 'waiting', answers });
      continue;
    }
    let lower = limit / SEARCH_RANGE;
    let upper = limit;
    let empty = false;
    for (const answer of answers.slice(0, SEARCH_ANSWERS)) {
      if (answer === 'unknown') {
        empty = true;
        break;
      }
      const amount = midpoint(lower, upper);
      if (answer === 'accept') lower = amount;
      else upper = amount;
    }
    if (empty) {
      states.push({ oneIn, status: 'empty', answers });
    } else if (answers.length >= SEARCH_ANSWERS) {
      const loss = midpoint(lower, upper);
      states.push({ oneIn, status: 'set', answers, loss });
      limit = loss;
    } else {
      states.push({ oneIn, status: 'open', answers, question: midpoint(lower, upper) });
      waiting = true;
    }
  }
  return states;
}

export const statesOf = (elicitation: Elicitation | undefined): PointState[] =>
  elicitation?.capacity === undefined ? [] : searchPoints(elicitation.capacity, elicitation.points ?? []);

export const openPoint = (states: readonly PointState[]): PointState | undefined => states.find((state) => state.status === 'open');

const setPoints = (states: readonly PointState[]): (PointState & { readonly loss: number })[] =>
  states.filter((state): state is PointState & { readonly loss: number } => state.status === 'set' && state.loss !== undefined);

// Stage 5. The points that are set, loss ascending, as tolerance curve points.
export function guidedCurve(states: readonly PointState[]): TolerancePoint[] {
  return setPoints(states)
    .map((state) => ({ loss: state.loss, maxExceedanceProbability: 1 / state.oneIn }))
    .sort((a, b) => a.loss - b.loss);
}

// Stage 4. The 1 in 20 point, or else the first point that is set.
export function crossCheckPoint(states: readonly PointState[]): (PointState & { readonly loss: number }) | undefined {
  const set = setPoints(states);
  return set.find((state) => state.oneIn === 20) ?? set[0];
}

// Stage 4. E is the loss divided by N. The options are less than E/2, E/2 to 2E and more than 2E.
export function crossCheckAmounts(point: { readonly loss: number; readonly oneIn: OneIn }): { readonly half: number; readonly double: number } {
  const expected = point.loss / point.oneIn;
  return { half: roundAmount(expected / 2), double: roundAmount(expected * 2) };
}

// The stage 4 answer, when it is about the point that stage 4 asks about now.
export function crossCheckAnswer(elicitation: Elicitation | undefined, states: readonly PointState[]): CrossCheckAnswer | undefined {
  const point = crossCheckPoint(states);
  const check = elicitation?.crossCheck;
  return point !== undefined && check?.oneIn === point.oneIn ? check.answer : undefined;
}

// Decision O2. The point to check again, when the board pays more than 2E to remove its chance.
export function flaggedPoint(elicitation: Elicitation | undefined, states: readonly PointState[]): OneIn | undefined {
  return crossCheckAnswer(elicitation, states) === 'above-double' ? crossCheckPoint(states)?.oneIn : undefined;
}

export const today = (): string => new Date().toISOString().slice(0, 10);

function withElicitation(doc: RiskDocument, change: (elicitation: Elicitation) => Elicitation | undefined): RiskDocument {
  const old = doc.appetite?.elicitation ?? { heldOn: today() };
  return withSection(doc, 'appetite', withValue(doc.appetite, 'elicitation', change(old)));
}

export function startSession(doc: RiskDocument, heldOn: string): RiskDocument {
  return doc.appetite?.elicitation === undefined ? withSection(doc, 'appetite', { ...doc.appetite, elicitation: { heldOn } }) : doc;
}

export function clearSession(doc: RiskDocument): RiskDocument {
  return withSection(doc, 'appetite', withValue(doc.appetite, 'elicitation', undefined));
}

export function withSessionNote(doc: RiskDocument, change: { readonly heldOn?: string; readonly participants?: string }): RiskDocument {
  return withElicitation(doc, (elicitation) => {
    let next = elicitation;
    if (change.heldOn !== undefined && change.heldOn !== '') next = { ...next, heldOn: change.heldOn };
    if (change.participants !== undefined) next = withValue(next, 'participants', change.participants.trim() === '' ? undefined : change.participants);
    return next;
  });
}

export const defaultRationale = (heldOn: string): string => `Answer of the management body to the guided questions of ${heldOn}.`;

// Stage 1. A new capacity clears the stage 3 and 4 answers, because their amounts come from the
// old capacity (rule 12).
export function withGuidedCapacity(doc: RiskDocument, amount: number, rationale: string | undefined): RiskDocument {
  const next = withElicitation(doc, (elicitation) => {
    if (elicitation.capacity === amount) return elicitation;
    const cleared = withValue(withValue(elicitation, 'points', undefined), 'crossCheck', undefined);
    return { ...cleared, capacity: amount };
  });
  const heldOn = next.appetite?.elicitation?.heldOn ?? today();
  const text = rationale === undefined || rationale.trim() === '' ? (doc.appetite?.capacity?.rationale ?? defaultRationale(heldOn)) : rationale;
  return withSection(next, 'appetite', { ...next.appetite, capacity: { amount, rationale: text } });
}

// Stage 1, "Do not know yet". Stages 3 and 4 need the capacity, so their answers go too
// (rule 11). The capacity of the document stays as it is.
export function withoutGuidedCapacity(doc: RiskDocument): RiskDocument {
  return withElicitation(doc, (elicitation) => withValue(withValue(withValue(elicitation, 'capacity', undefined), 'points', undefined), 'crossCheck', undefined));
}

// Stage 2. One answer for each objective. A changed answer keeps the draft statement.
export function withCriterion(doc: RiskDocument, objectiveId: string, event: string, answer: CriterionAnswer): RiskDocument {
  return withElicitation(doc, (elicitation) => {
    const criteria = elicitation.criteria ?? [];
    const old = criteria.find((item) => item.objectiveId === objectiveId);
    const item: Criterion = { ...old, objectiveId, event: event.trim(), answer };
    return { ...elicitation, criteria: old === undefined ? [...criteria, item] : criteria.map((entry) => (entry === old ? item : entry)) };
  });
}

// Stage 2. A changed event text of an answered objective.
export function withEventText(doc: RiskDocument, objectiveId: string, event: string): RiskDocument {
  const criteria = doc.appetite?.elicitation?.criteria ?? [];
  if (event.trim() === '' || !criteria.some((item) => item.objectiveId === objectiveId)) return doc;
  return withElicitation(doc, (elicitation) => ({
    ...elicitation,
    criteria: criteria.map((item) => (item.objectiveId === objectiveId ? { ...item, event: event.trim() } : item)),
  }));
}

// A change of the stage 3 answers can change the stage 4 point, so the stage 4 answer goes.
function withPointAnswers(elicitation: Elicitation, oneIn: OneIn, answers: readonly SearchAnswer[]): Elicitation {
  const others = (elicitation.points ?? []).filter((point) => point.oneIn !== oneIn);
  const entry = answers.length === 0 ? [] : [{ oneIn, answers: draftList<ElicitationPoint['answers']>(answers) }];
  const points = [...others, ...entry].sort((a, b) => ONE_IN.indexOf(a.oneIn) - ONE_IN.indexOf(b.oneIn));
  return withValue(withValue(elicitation, 'points', points), 'crossCheck', undefined);
}

// Stage 3. The answer to the question of the open point.
export function withSearchAnswer(doc: RiskDocument, answer: SearchAnswer): RiskDocument {
  const point = openPoint(statesOf(doc.appetite?.elicitation));
  if (point === undefined) return doc;
  return withElicitation(doc, (elicitation) => withPointAnswers(elicitation, point.oneIn, [...point.answers, answer]));
}

// Stage 3. Takes back the last answer.
export function withoutLastAnswer(doc: RiskDocument): RiskDocument {
  const last = [...statesOf(doc.appetite?.elicitation)].reverse().find((state) => state.status !== 'waiting' && state.answers.length > 0);
  if (last === undefined) return doc;
  return withElicitation(doc, (elicitation) => withPointAnswers(elicitation, last.oneIn, last.answers.slice(0, -1)));
}

// Stage 4.
export function withCrossCheck(doc: RiskDocument, answer: CrossCheckAnswer): RiskDocument {
  const point = crossCheckPoint(statesOf(doc.appetite?.elicitation));
  if (point === undefined) return doc;
  return withElicitation(doc, (elicitation) => ({ ...elicitation, crossCheck: { oneIn: point.oneIn, answer } }));
}

export interface GuidedResult {
  readonly doc: RiskDocument;
  // The points that went into the tolerance curve. 0 when fewer than 2 points are set.
  readonly pointsWritten: number;
  readonly statementsAdded: number;
}

const draftStatement = (id: string, event: string): Statement => ({
  id,
  title: event,
  appetite: `The management body does not accept this event. ${event}`,
  tolerances: [{ id: `${id}-TOL1`, text: `Not acceptable. ${event}` }],
});

// Stage 5, rule 13. The points go into the tolerance curve when 2 or more are set, because the
// schema needs 2. An old curve goes into the history, and the new curve has no approval. Each
// "Not acceptable" answer makes one draft statement, only once.
export function withGuidedResult(doc: RiskDocument): GuidedResult {
  const elicitation = doc.appetite?.elicitation;
  if (elicitation === undefined) return { doc, pointsWritten: 0, statementsAdded: 0 };
  const curve = guidedCurve(statesOf(elicitation));
  let next = doc;
  if (curve.length >= 2) {
    const old = next.appetite?.toleranceCurve?.points;
    if (old === undefined) {
      next = withSection(next, 'appetite', { ...next.appetite, toleranceCurve: { points: draftList<NonNullable<Appetite['toleranceCurve']>['points']>(curve) } });
    } else if (!samePoints(old, curve)) {
      next = withToleranceChange(next, curve, { changedOn: elicitation.heldOn, changedBy: elicitation.participants ?? 'Guided questions', reason: 'Guided questions' });
    }
  }
  const statements = [...(next.appetite?.statements ?? [])];
  let added = 0;
  const criteria = (elicitation.criteria ?? []).map((item) => {
    if (item.answer !== 'not-acceptable' || item.statementId !== undefined) return item;
    const id = nextId('AS-', statements.map((statement) => statement.id));
    statements.push(draftStatement(id, item.event));
    added += 1;
    return { ...item, statementId: id };
  });
  if (added > 0) {
    next = withSection(next, 'appetite', { ...next.appetite, statements, elicitation: { ...elicitation, criteria } });
  }
  return { doc: next, pointsWritten: curve.length >= 2 ? curve.length : 0, statementsAdded: added };
}
