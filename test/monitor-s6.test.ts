// Build task 6. The rules behind screen S6: G2 (b) on recorded observations, review triggers,
// acceptance records, the tolerance what-if on the kept totals, and the forecast log of
// SPEC.md Sec. 8.14 (freeze, never edit, resolve, score).
import { describe, expect, it } from 'vitest';
import { measure, sortedCopy, statusOf, tolerance } from '../src/engine';
import { brierScores, freezeForecasts, withForecasts, withOutcome } from '../src/monitor/forecasts';
import { monitorNumbers } from '../src/monitor/numbers';
import { acceptanceState, APP_ACTOR, automaticReviews, emergedOn, itemState, latestInGap, reasonKey, reviewTriggers, withAutomaticReview, withObservation } from '../src/monitor/review';
import { checkCurve, curveProblems, samePoints, withPoints, withToleranceChange } from '../src/monitor/tolerance';
import { documentErrors, type RiskDocument } from '../src/schema';
import { documentChanges, withChangeLog } from '../src/ui/edit';
import { monitorKey, triggerText } from '../src/ui/monitor';
import { example, EXAMPLE_1, EXAMPLE_2 } from './schema-helpers';

type Statement = NonNullable<NonNullable<RiskDocument['appetite']>['statements']>[number];
type Forecast = NonNullable<RiskDocument['forecasts']>[number];

const statementOf = (doc: RiskDocument, id: string): Statement => {
  const found = doc.appetite?.statements?.find((item) => item.id === id);
  if (found === undefined) throw new Error(id);
  return found;
};

// The state of every tolerance and indicator with a trigger, after the observations.
const states = (statement: Statement): Record<string, string> =>
  Object.fromEntries(
    [...(statement.tolerances ?? []), ...(statement.indicators ?? [])]
      .filter((item) => 'breachWhen' in item || 'firesWhen' in item)
      .map((item) => [item.id, itemState(item).state]),
  );

describe('G2 (b) on recorded observations (Sec. 6.11 item 1)', () => {
  const doc = example(EXAMPLE_1);

  it('example 1 with 2 above 10 days, 1 above 14, 1 above 15 fires the leading KRI, the tolerance and the lagging KRI', () => {
    const statement = withObservation(statementOf(doc, 'T9-EX1'), {
      observedOn: '2026-10-30',
      values: { computers_unpatched_cvss10_over_10_days: 2, mission_critical_systems_unpatched_cvss10_over_14_days: 1, computers_unpatched_cvss10_over_15_days: 1 },
    });
    expect(states(statement)).toEqual({ 'T9-EX1-TOL': 'fired', 'T9-EX1-LKRI': 'fired', 'T9-EX1-GKRI': 'fired' });
    // Each item keeps only the values of its own trigger.
    expect(statement.tolerances?.[0]?.observations).toEqual([{ observedOn: '2026-10-30', values: { mission_critical_systems_unpatched_cvss10_over_14_days: 1 } }]);
    // The KPI has no trigger, so it takes no observation.
    expect(statement.indicators?.find((item) => item.kind === 'kpi')?.observations).toBeUndefined();
  });

  it('example 3 fires exactly what Table 9 implies, and the latest observation counts', () => {
    let statement = statementOf(doc, 'T9-EX3');
    const record = (hours: number, percent: number, on = '2026-10-30'): Record<string, string> => {
      statement = withObservation(statement, { observedOn: on, values: { outage_hours: hours, customers_affected_percent: percent } });
      return states(statement);
    };
    const none = { 'T9-EX3-TOL': 'not-fired', 'T9-EX3-LKRI1': 'not-fired', 'T9-EX3-LKRI2': 'not-fired', 'T9-EX3-GKRI': 'not-fired' };
    expect(record(1.6, 6)).toEqual({ ...none, 'T9-EX3-LKRI1': 'fired' });
    expect(record(2.5, 4)).toEqual({ ...none, 'T9-EX3-LKRI2': 'fired' });
    expect(record(2.5, 6)).toEqual({ ...none, 'T9-EX3-LKRI1': 'fired', 'T9-EX3-GKRI': 'fired', 'T9-EX3-TOL': 'fired' });
    expect(latestInGap(statement)).toEqual([]);
    expect(record(2.5, 5)).toEqual(none);
    expect(latestInGap(statement)).toEqual([{ metric: 'customers_affected_percent', threshold: 5 }]);
    // An older date recorded later does not replace the latest observation.
    expect(record(1.6, 6, '2026-09-01')).toEqual(none);
  });

  it('an observation without every metric of a trigger gives no data, with the missing metric', () => {
    const statement = withObservation(statementOf(doc, 'T9-EX3'), { observedOn: '2026-10-30', values: { outage_hours: 3 } });
    const kri = statement.indicators?.find((item) => item.id === 'T9-EX3-LKRI1');
    if (kri === undefined) throw new Error('T9-EX3-LKRI1');
    expect(itemState(kri)).toMatchObject({ state: 'no-data', missing: ['customers_affected_percent'] });
  });

  it('writes the trigger in words', () => {
    const trigger = statementOf(doc, 'T9-EX3').indicators?.find((item) => item.id === 'T9-EX3-LKRI2')?.firesWhen;
    if (trigger === undefined) throw new Error('T9-EX3-LKRI2');
    expect(triggerText(trigger)).toBe('outage_hours above 2 hours and customers_affected_percent below 5 percent');
  });

  it('an observation is a valid change of the appetite section', () => {
    const statement = withObservation(statementOf(doc, 'T9-EX1'), { observedOn: '2026-10-30', values: { computers_unpatched_cvss10_over_10_days: 2 }, note: 'Weekly scan.' });
    const next: RiskDocument = { ...doc, appetite: { ...doc.appetite, statements: (doc.appetite?.statements ?? []).map((item) => (item.id === 'T9-EX1' ? statement : item)) } };
    expect(documentErrors(next)).toEqual([]);
    expect(documentChanges(doc, next).map((change) => change.path)).toEqual(['/appetite']);
  });
});

describe('review triggers (Sec. 6.11 item 2, Sec. 6.14 item 1)', () => {
  const doc = example(EXAMPLE_2);
  const kinds = (d: RiskDocument, today: string): Record<string, string[]> =>
    Object.fromEntries(reviewTriggers(d, today).map((item) => [item.riskId, item.reasons.map((reason) => reason.kind)]));

  it('KRI-1 of example 2 fires, so every ict and operational risk needs a review', () => {
    // 210 days since the last restore test is above 100. AP-1 covers ict and operational.
    const ict = doc.risks.filter((risk) => risk.category.code === 'ict' || risk.category.code === 'operational').map((risk) => risk.riskId);
    expect(ict.length).toBeGreaterThan(0);
    expect(kinds(doc, '2026-10-30')).toEqual(Object.fromEntries(ict.map((id) => [id, ['kri']])));
  });

  it('a passed review date and an expired acceptance trigger a review, a closed risk never does', () => {
    const changed: RiskDocument = {
      ...doc,
      risks: doc.risks.map((risk) =>
        risk.riskId === 'R-06' ? { ...risk, reviewDue: '2027-01-31' } : risk.riskId === 'R-01' ? { ...risk, status: 'Closed' } : risk,
      ),
    };
    const found = kinds(changed, '2027-10-21');
    expect(found['R-05']).toEqual(['acceptance-expired']);
    expect(found['R-06']).toEqual(['review-due']);
    expect(found['R-01']).toBeUndefined();
    expect(kinds(changed, '2027-01-31')['R-06']).toBeUndefined();
  });

  it('a new emerging risk triggers a review of the other risks in its category after the as-of date', () => {
    const r06 = doc.risks.find((risk) => risk.riskId === 'R-06');
    if (r06 === undefined) throw new Error('R-06');
    // R-06 is emerging and strategic. Make R-07 strategic too, so KRI-1 no longer covers it.
    const base: RiskDocument = { ...doc, risks: doc.risks.map((risk) => (risk.riskId === 'R-07' ? { ...risk, category: { code: 'strategic' } } : risk)) };
    expect(kinds(base, '2026-10-30')['R-07']).toBeUndefined();
    const added = (at: string, before?: object): RiskDocument => ({
      ...base,
      changeLog: [{ at, entityKind: 'risk', entityId: 'R-06', path: '', ...(before === undefined ? {} : { before }), after: r06 }],
    });
    // The register as-of date is 2026-10-27, so a risk added on that day is not new.
    expect(emergedOn(added('2026-10-27T10:00:00Z'), 'R-06')).toBe('2026-10-27');
    expect(kinds(added('2026-10-27T10:00:00Z'), '2026-10-30')['R-07']).toBeUndefined();
    expect(kinds(added('2026-10-29T10:00:00Z'), '2026-10-30')['R-07']).toEqual(['emerging']);
    // A change of the horizon from current to emerging counts, a change of other text does not.
    expect(kinds(added('2026-10-29T10:00:00Z', { ...r06, horizon: 'current' }), '2026-10-30')['R-07']).toEqual(['emerging']);
    expect(kinds(added('2026-10-29T10:00:00Z', { ...r06, notes: 'Old.' }), '2026-10-30')['R-07']).toBeUndefined();
    // The emerging risk itself gets no trigger from its own arrival.
    expect(kinds(added('2026-10-29T10:00:00Z'), '2026-10-30')['R-06']).toBeUndefined();
  });

  it('gives the acceptance state of each record', () => {
    const r05 = doc.risks.find((risk) => risk.riskId === 'R-05');
    if (r05?.acceptance === undefined) throw new Error('R-05');
    expect(acceptanceState(r05, '2027-10-21')).toBe('expired');
    const { validUntil: _until, ...open } = r05.acceptance;
    expect(acceptanceState({ ...r05, acceptance: open }, '2099-01-01')).toBe('open-ended');
    const { acceptance: _record, ...bare } = r05;
    expect(acceptanceState(bare, '2026-10-30')).toBeUndefined();
  });
});

describe('automatic Review needed (Sec. 6.11 item 2, Sec. 6.14 item 1)', () => {
  const doc = example(EXAMPLE_2);
  const ICT = ['R-01', 'R-02', 'R-03', 'R-04', 'R-07', 'R-08', 'R-09'];
  const AT = '2026-10-30T09:00:00Z';
  const reviewed = (d: RiskDocument, today = '2026-10-30'): RiskDocument => withAutomaticReview(d, automaticReviews(d, today), AT);
  const appEntries = (d: RiskDocument) => (d.changeLog ?? []).filter((entry) => entry.actor?.startsWith(APP_ACTOR) === true);
  const withStatus = (d: RiskDocument, ids: readonly string[], status: RiskDocument['risks'][number]['status']): RiskDocument => ({
    ...d,
    risks: d.risks.map((risk) => (ids.includes(risk.riskId) ? { ...risk, status } : risk)),
  });

  it('sets every risk with a reason to Review needed, with one change log entry that names the app and the reason', () => {
    const reviews = automaticReviews(doc, '2026-10-30');
    expect(reviews.map((review) => review.riskId)).toEqual(ICT);
    expect(reviews[0]?.reasons.map((reason) => reason.text)).toEqual(['KRI-1 of appetite statement AP-1 fires on the observation of 2026-10-27.']);
    const next = reviewed(doc);
    expect(next.risks.filter((risk) => risk.status === 'Review needed').map((risk) => risk.riskId)).toEqual(ICT);
    expect(documentErrors(next)).toEqual([]);
    const entries = appEntries(next);
    expect(entries.map((entry) => entry.entityId)).toEqual(ICT);
    expect(entries[0]).toMatchObject({
      at: AT,
      actor: 'PortaRegulus Risk (automatic review). KRI-1 of appetite statement AP-1 fires on the observation of 2026-10-27.',
      entityKind: 'risk',
      entityId: 'R-01',
      path: '',
      before: { status: 'Open' },
      after: { status: 'Review needed' },
    });
  });

  it('writes nothing for a risk that has the status Review needed already', () => {
    const next = reviewed(withStatus(doc, ['R-01'], 'Review needed'));
    expect(appEntries(next).map((entry) => entry.entityId)).toEqual(ICT.slice(1));
    // A second check writes nothing, because every risk with a reason has the status now.
    expect(automaticReviews(next, '2026-10-30')).toEqual([]);
    expect(reviewed(next)).toBe(next);
  });

  it('acts once per reason, so a person ends the review, and a new observation acts again', () => {
    const closed = withStatus(reviewed(doc), ICT, 'Monitored');
    expect(automaticReviews(closed, '2026-10-30')).toEqual([]);
    // KRI-1 fires again on a later observation.
    const statement = withObservation(statementOf(closed, 'AP-1'), { observedOn: '2026-11-15', values: { days_since_restore_test: 230 } });
    const later: RiskDocument = { ...closed, appetite: { ...closed.appetite, statements: (closed.appetite?.statements ?? []).map((item) => (item.id === 'AP-1' ? statement : item)) } };
    expect(automaticReviews(later, '2026-11-15').map((review) => review.reasons[0]?.text)).toEqual(ICT.map(() => 'KRI-1 of appetite statement AP-1 fires on the observation of 2026-11-15.'));
  });

  it('skips the reasons that acted in this visit, so undo keeps the change back', () => {
    const done = new Set(automaticReviews(doc, '2026-10-30').flatMap((review) => review.reasons.map((reason) => reasonKey(review.riskId, reason))));
    expect(automaticReviews(doc, '2026-10-30', done)).toEqual([]);
  });

  it('starts reviews for a passed review date and an expired acceptance, and each date is its own reason', () => {
    const due: RiskDocument = { ...doc, risks: doc.risks.map((risk) => (risk.riskId === 'R-06' ? { ...risk, reviewDue: '2027-01-31' } : risk)) };
    const first = reviewed(due, '2027-10-21');
    const texts = Object.fromEntries(appEntries(first).map((entry) => [entry.entityId, entry.actor]));
    expect(texts['R-05']).toBe('PortaRegulus Risk (automatic review). The acceptance expired on 2027-10-20.');
    expect(texts['R-06']).toBe('PortaRegulus Risk (automatic review). The review was due on 2027-01-31.');
    // After the review a person sets a new review date. When it passes, the app acts again.
    const renewed = withStatus(first, ['R-06'], 'Open');
    const moved: RiskDocument = { ...renewed, risks: renewed.risks.map((risk) => (risk.riskId === 'R-06' ? { ...risk, reviewDue: '2028-01-31' } : risk)) };
    expect(automaticReviews(moved, '2027-10-21').map((review) => review.riskId)).not.toContain('R-06');
    expect(automaticReviews(moved, '2028-02-01').find((review) => review.riskId === 'R-06')?.reasons.map((reason) => reason.kind)).toEqual(['review-due']);
  });

  it('the save keeps the entries of the app and writes no second entry for the risks they explain', () => {
    const draft = reviewed(doc);
    const saved = withChangeLog(doc, draft, '2026-10-30T09:00:05Z');
    expect(saved.changeLog).toEqual(draft.changeLog);
    // A change of a person in the same save gets its own entry, after the entries of the app.
    const both: RiskDocument = { ...draft, risks: draft.risks.map((risk) => (risk.riskId === 'R-02' ? { ...risk, notes: 'Checked.' } : risk)) };
    const log = withChangeLog(doc, both, '2026-10-30T09:00:05Z').changeLog ?? [];
    expect(log.filter((entry) => entry.actor === undefined).map((entry) => entry.entityId)).toEqual(['R-02']);
    expect(log.slice(-ICT.length).every((entry) => entry.actor?.startsWith(APP_ACTOR) === true)).toBe(true);
  });

  it('a draft log that is an older copy of the saved log adds no entry', () => {
    const first = withChangeLog(doc, { ...doc, risks: doc.risks.map((risk) => (risk.riskId === 'R-01' ? { ...risk, notes: 'A.' } : risk)) }, '2026-10-30T09:00:00Z');
    // The second save of the same risk within 10 minutes replaces the last entry.
    const second = withChangeLog(first, { ...first, risks: first.risks.map((risk) => (risk.riskId === 'R-01' ? { ...risk, notes: 'B.' } : risk)) }, '2026-10-30T09:01:00Z');
    // A draft that still holds the log of the first save.
    const stale: RiskDocument = { ...second, changeLog: first.changeLog ?? [], risks: second.risks.map((risk) => (risk.riskId === 'R-02' ? { ...risk, notes: 'C.' } : risk)) };
    const log = withChangeLog(second, stale, '2026-10-30T09:02:00Z').changeLog ?? [];
    expect(log.map((entry) => entry.entityId)).toEqual(['R-01', 'R-02']);
  });
});

describe('tolerance what-if (Sec. 6.17 item 2)', () => {
  const doc = example(EXAMPLE_2);
  const seed = doc.simulation?.seed ?? 0;
  const numbers = monitorNumbers(doc, 20_000, seed, '2026-10-30T09:00:00Z');
  const saved = doc.appetite?.toleranceCurve?.points ?? [];

  it('the saved curve gives the measures of a full run, from the kept totals', () => {
    const m = measure(doc, 20_000, seed, []);
    const check = checkCurve(doc, saved, numbers.losses);
    expect(numbers.losses).toEqual(sortedCopy(m.loss));
    expect(check.gap).toBe(m.gap);
    expect(check.excessArea).toBe(m.area);
    expect(check.status).toBe(statusOf(m.gap, m.clear));
    expect(check.pAboveCapacity).toBeGreaterThanOrEqual(0);
  });

  it('a looser curve lowers the gap without a new simulation', () => {
    const looser = saved.map((point) => ({ loss: point.loss, maxExceedanceProbability: Math.min(0.99, point.maxExceedanceProbability * 2) }));
    expect(curveProblems(looser)).toEqual([]);
    const before = checkCurve(doc, saved, numbers.losses);
    const after = checkCurve(doc, looser, numbers.losses);
    expect(before.gap).toBeGreaterThan(0);
    expect(after.gap).toBeLessThan(before.gap);
    expect(after.gap).toBe(tolerance(withPoints(doc, looser), numbers.losses).gap);
  });

  it('refuses a curve that breaks rule V-12', () => {
    expect(curveProblems(saved)).toEqual([]);
    expect(curveProblems([{ loss: 100, maxExceedanceProbability: 0.1 }, { loss: 200, maxExceedanceProbability: 0.2 }])).toEqual([
      'V-12. The loss must go up and the probability must go down from each point to the next.',
    ]);
    expect(curveProblems([{ loss: 100, maxExceedanceProbability: 0.1 }])).toContain('A curve needs at least 2 points.');
  });

  it('an empty field is a change and a problem, not an error', () => {
    const cleared = saved.map((point, i) => (i === 1 ? { ...point, loss: Number.NaN } : point));
    expect(samePoints(saved, saved.map((point) => ({ ...point })))).toBe(true);
    expect(samePoints(cleared, saved)).toBe(false);
    expect(samePoints(saved.slice(0, 2), saved)).toBe(false);
    expect(curveProblems(cleared)).toContain('The loss of point 2 must be more than 0.');
  });

  it('a saved change moves the old curve into the history with date, person and reason', () => {
    const points = saved.map((point) => ({ ...point, maxExceedanceProbability: point.maxExceedanceProbability / 2 }));
    const next = withToleranceChange(doc, points, { changedOn: '2026-10-30', changedBy: 'IT lead', reason: 'Board asked for a stricter curve.' });
    expect(next.appetite?.toleranceCurve).toEqual({ points });
    expect(next.appetite?.history).toEqual([{ changedOn: '2026-10-30', changedBy: 'IT lead', reason: 'Board asked for a stricter curve.', points: saved }]);
    expect(next.appetite?.capacity).toEqual(doc.appetite?.capacity);
    expect(documentErrors(next)).toEqual([]);
  });
});

describe('forecast log (Sec. 8.14)', () => {
  const doc = example(EXAMPLE_2);
  const seed = doc.simulation?.seed ?? 0;

  it('the S6 job gives the forecasts of a plain freeze with the same seed', () => {
    const numbers = monitorNumbers(doc, 20_000, seed, '2026-10-30T09:00:00Z');
    expect(numbers.forecasts).toEqual(freezeForecasts(doc, measure(doc, 20_000, seed, []).run, { createdOn: '2026-10-30T09:00:00Z' }));
    // Rounded to 4 decimals.
    for (const forecast of numbers.forecasts) expect(Math.round(forecast.probability * 10_000) / 10_000).toBe(forecast.probability);
  });

  it('freezes new forecasts, never edits a frozen one, and skips windows that have ended', () => {
    const candidates = monitorNumbers(doc, 20_000, seed, '2026-10-30T09:00:00Z').forecasts;
    const stored = (doc.forecasts ?? []).find((forecast) => forecast.id === 'F-2027-R-01');
    const next = withForecasts(doc, candidates, '2026-10-30T10:00:00Z');
    expect(next.forecasts?.find((forecast) => forecast.id === 'F-2027-R-01')).toBe(stored);
    const added = (next.forecasts ?? []).slice((doc.forecasts ?? []).length);
    expect(added.map((forecast) => forecast.id)).toEqual(candidates.map((forecast) => forecast.id).filter((id) => id !== 'F-2027-R-01'));
    expect(added.every((forecast) => forecast.createdOn === '2026-10-30T10:00:00Z')).toBe(true);
    expect(documentErrors(next)).toEqual([]);
    // A second freeze adds nothing.
    expect(withForecasts(next, candidates, '2026-10-30T11:00:00Z')).toBe(next);
    // After the window ends, a freeze would be hindsight.
    expect(withForecasts(doc, candidates, '2027-10-27T09:00:00Z')).toBe(doc);
    // One change log entry per new forecast.
    const logged = withChangeLog(doc, next, '2026-10-30T10:00:00Z');
    expect((logged.changeLog ?? []).map((entry) => `${entry.entityKind} ${entry.entityId}`)).toEqual(added.map((forecast) => `forecast ${forecast.id}`));
    expect(documentErrors(logged)).toEqual([]);
  });

  it('records an outcome once', () => {
    const outcome = { occurred: true, recordedOn: '2027-10-27', observedAnnualImpact: 42_000, evidence: 'Incident report IR-7.' };
    const next = withOutcome(doc, 'F-2027-R-01', outcome);
    expect(next.forecasts?.find((forecast) => forecast.id === 'F-2027-R-01')?.outcome).toEqual(outcome);
    expect(documentErrors(next)).toEqual([]);
    const again = withOutcome(next, 'F-2027-R-01', { occurred: false, recordedOn: '2027-10-28' });
    expect(again.forecasts?.find((forecast) => forecast.id === 'F-2027-R-01')?.outcome).toEqual(outcome);
    // Rule V-15 refuses an outcome recorded before the window ends.
    expect(documentErrors(withOutcome(doc, 'F-2027-R-01', { occurred: false, recordedOn: '2027-10-25' })).map((error) => error.rule)).toContain('V-15');
    const scores = brierScores(next.forecasts ?? []);
    expect(scores?.n).toBe(2);
    expect(scores?.brier).toBeCloseTo((0.2186 ** 2 + (1 - 0.1055) ** 2) / 2, 12);
  });

  it('a change of text keeps the run of S6, a change of an estimate or an as-of date does not', () => {
    const key = monitorKey(doc);
    expect(key).toBeDefined();
    const { toleranceCurve: _curve, ...appetite } = doc.appetite ?? {};
    expect(monitorKey({ ...doc, appetite })).toBe(key);
    expect(monitorKey({ ...doc, registers: doc.registers.map((register) => ({ ...register, asOf: '2026-11-01' })) as typeof doc.registers })).not.toBe(key);
  });
});

describe('Brier score details (Sec. 8.14)', () => {
  const forecast = (probability: number, occurred: boolean): Forecast => ({
    id: `F-${String(probability)}`,
    riskId: 'R',
    createdOn: '2026-01-01T00:00:00Z',
    windowStart: '2026-01-01',
    windowEnd: '2026-12-31',
    eventDefinition: 'test event',
    eventThreshold: 0,
    probability,
    engineVersion: 'test',
    seed: 1,
    trials: 1000,
    inputsSha256: '0'.repeat(64),
    outcome: { occurred, recordedOn: '2027-01-01' },
  });

  it('SE(BS) is the sample standard deviation of the squared errors over sqrt(n), and the interval is BS plus and minus 1.96 SE, cut to [0, 1]', () => {
    const scores = brierScores([forecast(0.1, false), forecast(0.9, true), forecast(0.5, true), forecast(0.2, false)]);
    const se = Math.sqrt(0.040275 / 3) / 2;
    expect(scores?.brierSe).toBeCloseTo(se, 12);
    expect(scores?.interval95[0]).toBe(0);
    expect(scores?.interval95[1]).toBeCloseTo(0.0775 + 1.96 * se, 12);
    expect(scores?.intervalHitRate).toBeUndefined();
  });

  it('shows the difference when the forecasts in a bin are not equal', () => {
    // f = 0.12 and 0.18 share bin 1. BS 0.4034, REL 0.1225, RES 0, UNC 0.25.
    const scores = brierScores([forecast(0.12, true), forecast(0.18, false)]);
    expect(scores?.brier).toBeCloseTo(0.4034, 12);
    expect(scores?.reliability).toBeCloseTo(0.1225, 12);
    expect(scores?.resolution).toBeCloseTo(0, 12);
    expect(scores?.uncertainty).toBeCloseTo(0.25, 12);
    expect(scores?.decompositionGap).toBeCloseTo(0.0309, 12);
    expect(scores?.skill).toBeCloseTo(1 - 0.4034 / 0.25, 12);
  });

  it('puts f = 1 in the top bin', () => {
    const scores = brierScores([forecast(1, true), forecast(0.95, true)]);
    expect(scores?.reliability).toBeCloseTo(((1 + 0.95) / 2 - 1) ** 2, 12);
    expect(scores?.skill).toBeUndefined();
  });
});
