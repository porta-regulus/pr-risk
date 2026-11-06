// Guided questions of release 2 (src/ui/guided.ts, docs/release-2/appetite-questions.md).
// The halving search, V-12 by construction, "Do not know", the cross-check and the result.
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { curveProblems } from '../src/monitor/tolerance';
import { documentErrors, type RiskDocument } from '../src/schema';
import {
  clearSession,
  crossCheckAmounts,
  crossCheckPoint,
  type ElicitationPoint,
  flaggedPoint,
  guidedCurve,
  nearestStep,
  ONE_IN,
  openPoint,
  roundAmount,
  type SearchAnswer,
  searchPoints,
  startSession,
  statesOf,
  withCriterion,
  withCrossCheck,
  withEventText,
  withGuidedCapacity,
  withGuidedResult,
  withoutLastAnswer,
  withSearchAnswer,
  withSessionNote,
} from '../src/ui/guided';
import { example, EXAMPLE_2 } from './schema-helpers';

const point = (oneIn: ElicitationPoint['oneIn'], ...answers: SearchAnswer[]): ElicitationPoint => ({ oneIn, answers: answers as unknown as ElicitationPoint['answers'] });

// A session on example 2 with capacity 3 000 000 and the given answers for each point.
function session(answers: readonly SearchAnswer[]): RiskDocument {
  let doc = withGuidedCapacity(startSession(example(EXAMPLE_2), '2026-11-06'), 3_000_000, undefined);
  for (const answer of answers) doc = withSearchAnswer(doc, answer);
  return doc;
}

describe('amounts', () => {
  it('rounds to 2 significant digits and finds the nearest slider step on a log scale', () => {
    expect(roundAmount(1_095_445)).toBe(1_100_000);
    expect(roundAmount(0.0666)).toBe(0.067);
    expect(nearestStep(10_000)).toBe(0);
    expect(nearestStep(3_000_000)).toBe(7);
    expect(nearestStep(1_400_000)).toBe(6);
    expect(nearestStep(1)).toBe(0);
    expect(nearestStep(1e9)).toBe(9);
  });
});

describe('searchPoints (rules 4 to 6)', () => {
  it('starts the first point with capacity / 15 to 2 times capacity and halves the range on a log scale', () => {
    // Range 200 000 to 6 000 000. The questions are the rounded geometric means.
    expect(searchPoints(3_000_000, [])[0]).toEqual({ oneIn: 100, status: 'open', answers: [], question: 1_100_000 });
    expect(searchPoints(3_000_000, [point(100, 'accept')])[0]?.question).toBe(2_600_000);
    expect(searchPoints(3_000_000, [point(100, 'accept', 'not-accept')])[0]?.question).toBe(1_700_000);
    const states = searchPoints(3_000_000, [point(100, 'accept', 'not-accept', 'accept')]);
    expect(states[0]).toEqual({ oneIn: 100, status: 'set', answers: ['accept', 'not-accept', 'accept'], loss: 2_100_000 });
    // The next point searches below the last point that is set. 2 100 000 / 30 to 2 100 000.
    expect(states[1]).toEqual({ oneIn: 20, status: 'open', answers: [], question: 380_000 });
    expect(states.slice(2).map((state) => state.status)).toEqual(['waiting', 'waiting']);
  });

  it('leaves a "Do not know" point empty and takes the upper limit from the last point that is set', () => {
    const states = searchPoints(3_000_000, [point(100, 'accept', 'unknown'), point(20)]);
    expect(states[0]).toEqual({ oneIn: 100, status: 'empty', answers: ['accept', 'unknown'] });
    // No point is set yet, so the upper limit is still 2 times capacity.
    expect(states[1]?.question).toBe(1_100_000);
    expect(guidedCurve(states)).toEqual([]);
  });

  it('gives points that meet V-12 for any capacity and any answers', () => {
    const answer = fc.constantFrom<SearchAnswer>('accept', 'not-accept', 'unknown');
    fc.assert(
      fc.property(fc.double({ min: 1, max: 1e9, noNaN: true }), fc.array(fc.array(answer, { minLength: 3, maxLength: 3 }), { minLength: 4, maxLength: 4 }), (capacity, lists) => {
        const states = searchPoints(capacity, ONE_IN.map((oneIn, i) => point(oneIn, ...(lists[i] ?? []))));
        expect(states.every((state) => state.status === 'set' || state.status === 'empty')).toBe(true);
        let limit = 2 * capacity;
        for (const state of states) {
          if (state.loss === undefined) continue;
          expect(state.loss).toBeGreaterThan(limit / 30);
          expect(state.loss).toBeLessThan(limit);
          limit = state.loss;
        }
        const curve = guidedCurve(states);
        if (curve.length >= 2) expect(curveProblems(curve)).toEqual([]);
      }),
      { numRuns: 500 },
    );
  });

  it('has 8 possible results for each point, about 1.5 times apart', () => {
    const results = new Set<number>();
    for (const a of ['accept', 'not-accept'] as const)
      for (const b of ['accept', 'not-accept'] as const)
        for (const c of ['accept', 'not-accept'] as const) results.add(searchPoints(3_000_000, [point(100, a, b, c)])[0]?.loss ?? 0);
    const sorted = [...results].sort((x, y) => x - y);
    expect(sorted).toHaveLength(8);
    for (let i = 1; i < sorted.length; i++) {
      const ratio = (sorted[i] ?? 0) / (sorted[i - 1] ?? 1);
      expect(ratio).toBeGreaterThan(1.35);
      expect(ratio).toBeLessThan(1.7);
    }
  });
});

describe('edits of the session', () => {
  it('saves each answer, takes back the last answer and keeps the document valid', () => {
    let doc = session(['accept', 'not-accept', 'accept', 'unknown']);
    expect(doc.appetite?.elicitation?.points).toEqual([point(100, 'accept', 'not-accept', 'accept'), point(20, 'unknown')]);
    expect(openPoint(statesOf(doc.appetite?.elicitation))?.oneIn).toBe(5);
    expect(documentErrors(doc)).toEqual([]);
    doc = withoutLastAnswer(doc);
    expect(doc.appetite?.elicitation?.points).toEqual([point(100, 'accept', 'not-accept', 'accept')]);
    expect(openPoint(statesOf(doc.appetite?.elicitation))?.oneIn).toBe(20);
  });

  it('clears the stage 3 and 4 answers when the capacity changes, and writes a rationale', () => {
    let doc = withCrossCheck(session(['accept', 'accept', 'accept']), 'above-double');
    expect(doc.appetite?.elicitation?.crossCheck).toEqual({ oneIn: 100, answer: 'above-double' });
    // The old rationale of example 2 stays when the user types none.
    expect(doc.appetite?.capacity?.rationale).toMatch(/^Cash reserve/);
    doc = withGuidedCapacity(doc, 3_000_000, undefined);
    expect(doc.appetite?.elicitation?.points).toHaveLength(1);
    doc = withGuidedCapacity(doc, 2_000_000, 'Finance, 2026-11-01');
    expect(doc.appetite?.elicitation?.points).toBeUndefined();
    expect(doc.appetite?.elicitation?.crossCheck).toBeUndefined();
    expect(doc.appetite?.capacity).toEqual({ amount: 2_000_000, rationale: 'Finance, 2026-11-01' });
    const fresh = withGuidedCapacity(startSession(clearSession({ ...example(EXAMPLE_2), appetite: {} }), '2026-11-06'), 500_000, ' ');
    expect(fresh.appetite?.capacity?.rationale).toBe('Answer of the management body to the guided questions of 2026-11-06.');
  });

  it('a new answer clears the cross-check, because the point can change', () => {
    const doc = withSearchAnswer(withCrossCheck(session(['accept', 'accept', 'accept']), 'half-to-double'), 'accept');
    expect(doc.appetite?.elicitation?.crossCheck).toBeUndefined();
  });

  it('keeps one answer for each objective and the session note', () => {
    let doc = withCriterion(startSession(example(EXAMPLE_2), '2026-11-06'), 'OBJ-O1', 'Orders stop for 3 days.', 'painful');
    doc = withCriterion(doc, 'OBJ-O1', 'Orders stop for 3 days.', 'not-acceptable');
    doc = withEventText(doc, 'OBJ-O1', 'Orders stop for 4 days.');
    doc = withEventText(doc, 'OBJ-S1', 'Not answered, so not saved.');
    doc = withSessionNote(doc, { participants: 'Managing directors and IT lead' });
    expect(doc.appetite?.elicitation).toEqual({
      heldOn: '2026-11-06',
      participants: 'Managing directors and IT lead',
      criteria: [{ objectiveId: 'OBJ-O1', event: 'Orders stop for 4 days.', answer: 'not-acceptable' }],
    });
    expect(withSessionNote(doc, { participants: '' }).appetite?.elicitation?.participants).toBeUndefined();
  });
});

describe('cross-check (stage 4, decision O2)', () => {
  it('asks about the 1 in 20 point, else the first point that is set, and flags more than 2E', () => {
    const all = statesOf(session(['accept', 'accept', 'accept', 'accept', 'accept', 'accept']).appetite?.elicitation);
    expect(crossCheckPoint(all)?.oneIn).toBe(20);
    const only = statesOf(session(['accept', 'accept', 'accept']).appetite?.elicitation);
    const first = crossCheckPoint(only);
    expect(first?.oneIn).toBe(100);
    // 1 100 000, 2 600 000 and 3 900 000 accepted, so the loss is 4 800 000. 1 in 100, so E is 48 000.
    expect(first?.loss).toBe(4_800_000);
    expect(first && crossCheckAmounts(first)).toEqual({ half: 24_000, double: 96_000 });
    const doc = withCrossCheck(session(['accept', 'accept', 'accept']), 'above-double');
    expect(flaggedPoint(doc.appetite?.elicitation, statesOf(doc.appetite?.elicitation))).toBe(100);
    const calm = withCrossCheck(session(['accept', 'accept', 'accept']), 'half-to-double');
    expect(flaggedPoint(calm.appetite?.elicitation, statesOf(calm.appetite?.elicitation))).toBeUndefined();
  });
});

describe('withGuidedResult (stage 5, rule 13)', () => {
  const answered = (): RiskDocument => {
    let doc = session(['accept', 'not-accept', 'accept', 'not-accept', 'accept', 'not-accept', 'unknown', 'accept', 'accept', 'accept']);
    doc = withCriterion(doc, 'OBJ-O1', 'Orders stop for 3 days.', 'not-acceptable');
    doc = withCriterion(doc, 'OBJ-S1', 'A customer audit finds no update plan.', 'painful');
    return withSessionNote(doc, { participants: 'Managing directors' });
  };

  it('moves the approved curve into the history, writes the new curve without approval and adds draft statements once', () => {
    const before = answered();
    const old = before.appetite?.toleranceCurve?.points;
    const { doc, pointsWritten, statementsAdded } = withGuidedResult(before);
    expect(pointsWritten).toBe(3);
    expect(statementsAdded).toBe(1);
    expect(doc.appetite?.toleranceCurve).toEqual({
      points: [
        { loss: 160_000, maxExceedanceProbability: 0.5 },
        { loss: 200_000, maxExceedanceProbability: 0.05 },
        { loss: 2_100_000, maxExceedanceProbability: 0.01 },
      ],
    });
    expect(doc.appetite?.history).toEqual([{ changedOn: '2026-11-06', changedBy: 'Managing directors', reason: 'Guided questions', points: old }]);
    expect(doc.appetite?.statements?.at(-1)).toEqual({
      id: 'AS-1',
      title: 'Orders stop for 3 days.',
      appetite: 'The management body does not accept this event. Orders stop for 3 days.',
      tolerances: [{ id: 'AS-1-TOL1', text: 'Not acceptable. Orders stop for 3 days.' }],
    });
    expect(doc.appetite?.elicitation?.criteria?.[0]?.statementId).toBe('AS-1');
    expect(documentErrors(doc)).toEqual([]);
    // A second click adds nothing and changes no curve.
    const again = withGuidedResult(doc);
    expect(again.statementsAdded).toBe(0);
    expect(again.doc).toBe(doc);
  });

  it('writes no curve with only 1 point, because the schema needs 2', () => {
    const before = session(['accept', 'accept', 'accept', 'unknown', 'unknown', 'unknown']);
    const { doc, pointsWritten } = withGuidedResult(before);
    expect(pointsWritten).toBe(0);
    expect(doc.appetite?.toleranceCurve).toEqual(before.appetite?.toleranceCurve);
  });

  it('writes a first curve without a history entry', () => {
    const before = session(['accept', 'accept', 'accept', 'accept', 'accept', 'accept']);
    const { toleranceCurve: _old, ...rest } = before.appetite ?? {};
    const { doc } = withGuidedResult({ ...before, appetite: rest });
    expect(doc.appetite?.toleranceCurve?.points).toHaveLength(2);
    expect(doc.appetite?.history).toBeUndefined();
  });
});

describe('schema 1.2.0 appetite.elicitation', () => {
  it('accepts a full record and refuses a fourth answer or an unknown answer', () => {
    const doc = withGuidedResult(withCrossCheck(session(['accept', 'accept', 'accept']), 'unknown')).doc;
    expect(documentErrors({ ...doc, schemaVersion: '1.2.0' })).toEqual([]);
    const four = structuredClone(doc) as { appetite: { elicitation: { points: { answers: string[] }[] } } };
    four.appetite.elicitation.points[0]?.answers.push('accept');
    expect(documentErrors(four as unknown as RiskDocument).length).toBeGreaterThan(0);
    const wrong = structuredClone(doc) as { appetite: { elicitation: { crossCheck: { answer: string } } } };
    wrong.appetite.elicitation.crossCheck.answer = 'maybe';
    expect(documentErrors(wrong as unknown as RiskDocument).length).toBeGreaterThan(0);
  });
});
