// Guided questions on screen S2 (SPEC.md Sec. 6.5 item 6, docs/release-2/appetite-questions.md).
// One stage at a time. Each answer goes into appetite.elicitation at once, so autosave, undo and
// the change log work as for every other field. The curve and the statements change only in
// stage 5. The logic is in guided.ts.
import { useEffect, useRef, useState } from 'preact/hooks';
import type { RiskDocument } from '../schema/types';
import type { Update } from './editor';
import { Explain } from './explain';
import { NumberField, TextField } from './fields';
import {
  CAPACITY_STEPS,
  clearSession,
  type CriterionAnswer,
  type CrossCheckAnswer,
  crossCheckAmounts,
  crossCheckAnswer,
  crossCheckPoint,
  flaggedPoint,
  guidedCurve,
  nearestStep,
  ONE_IN,
  openPoint,
  type PointState,
  type SearchAnswer,
  SEARCH_ANSWERS,
  startSession,
  statesOf,
  today,
  withCriterion,
  withCrossCheck,
  withEventText,
  withGuidedCapacity,
  withGuidedResult,
  withoutGuidedCapacity,
  withoutLastAnswer,
  withSearchAnswer,
  withSessionNote,
} from './guided';

type Stage = 'intro' | 'capacity' | 'criteria' | 'tolerance' | 'cross-check' | 'result';
type Objective = NonNullable<NonNullable<RiskDocument['context']>['objectives']>[number];

const STAGES: readonly (readonly [Exclude<Stage, 'intro'>, string])[] = [
  ['capacity', 'Capacity'],
  ['criteria', 'Criteria'],
  ['tolerance', 'Tolerance points'],
  ['cross-check', 'Cross-check'],
  ['result', 'Result'],
];

const CRITERION_ANSWERS: readonly (readonly [CriterionAnswer, string])[] = [
  ['acceptable', 'Acceptable'],
  ['painful', 'Painful'],
  ['not-acceptable', 'Not acceptable'],
  ['unknown', 'Do not know'],
];

const SEARCH_LABELS: readonly (readonly [SearchAnswer, string])[] = [
  ['accept', 'Accept'],
  ['not-accept', 'Not accept'],
  ['unknown', 'Do not know'],
];

// The stage of each document stays when undo remounts the screen.
const openStage = new Map<string, Stage>();

const amount = (value: number): string => value.toLocaleString('en');
const chance = (oneIn: number): string => `1 in ${String(oneIn)}`;

// selected. A key stays pressed for the saved answer, and null means no answer yet. Without
// selected the keys are plain buttons, because each click is a new answer (stage 3).
function AnswerKeys<T extends string>({ label, labelledBy, options, selected, disabled, onAnswer }: {
  readonly label?: string;
  readonly labelledBy?: string;
  readonly options: readonly (readonly [T, string])[];
  readonly selected?: T | null;
  readonly disabled?: boolean;
  readonly onAnswer: (answer: T) => void;
}) {
  return (
    <div class="answers" role="group" aria-label={label} aria-labelledby={labelledBy}>
      {options.map(([key, text]) => (
        <button type="button" class="quiet" key={key} aria-pressed={selected === undefined ? undefined : selected === key} disabled={disabled} onClick={() => {
            onAnswer(key);
          }}>
          {text}
        </button>
      ))}
    </div>
  );
}

function CapacityStage({ doc, update, onNext }: { readonly doc: RiskDocument; readonly update: Update; readonly onNext: () => void }) {
  const currency = doc.document.currency;
  const elicitation = doc.appetite?.elicitation;
  const [value, setValue] = useState<number | undefined>(elicitation?.capacity ?? doc.appetite?.capacity?.amount);
  const [rationale, setRationale] = useState('');
  const known = value !== undefined && value > 0;
  // The slider starts in the middle of its range when no amount is known (rule 7).
  const index = known ? nearestStep(value) : Math.floor(CAPACITY_STEPS.length / 2);
  const clears = known && elicitation?.capacity !== undefined && elicitation.capacity !== value && (elicitation.points ?? []).length > 0;
  return (
    <>
      <p class="question">Which loss in one year forces you to cut staff, break a loan covenant or close?</p>
      <p class="hint">Ask finance. Add cash, unused credit and insurance cover. This is a fact about the company, not a wish.</p>
      <div class="field">
        <label for="guided-capacity-slider">Capacity of the company ({currency})</label>
        <input
          type="range"
          id="guided-capacity-slider"
          min={0}
          max={CAPACITY_STEPS.length - 1}
          step={1}
          value={index}
          aria-valuetext={known ? `${amount(value)} ${currency}` : 'Not set'}
          aria-describedby="guided-capacity-value"
          onInput={(event) => {
            setValue(CAPACITY_STEPS[Number(event.currentTarget.value)]);
          }}
        />
        <span class="hint" id="guided-capacity-value">
          {known ? `${amount(value)} ${currency}` : 'Not set. Move the slider or type the amount.'}
        </span>
      </div>
      <div class="field-row">
        <div class="field">
          <NumberField id="guided-capacity" label={`Or type the amount (${currency})`} help="context.guided-capacity" min={0} value={value} onChange={setValue} />
        </div>
        <div class="field">
          <TextField id="guided-rationale" label="How did you find this amount? (optional)" help="context.guided-rationale" value={rationale} onChange={setRationale} />
        </div>
      </div>
      {clears && <p class="hint">A new capacity clears the answers to the tolerance questions, because their amounts come from the capacity.</p>}
      <div class="button-row">
        <button type="button" disabled={!known} onClick={() => {
            if (known) update((current) => withGuidedCapacity(current, value, rationale));
            onNext();
          }}>
          Next
        </button>
        <button type="button" class="quiet" onClick={() => {
            update(withoutGuidedCapacity);
            onNext();
          }}>
          Do not know yet
        </button>
      </div>
      <Explain id="guided-capacity-unknown" topic="context.guided-capacity-unknown" name="Do not know yet" />
    </>
  );
}

function CriterionEditor({ objective, doc, update }: { readonly objective: Objective; readonly doc: RiskDocument; readonly update: Update }) {
  const saved = (doc.appetite?.elicitation?.criteria ?? []).find((item) => item.objectiveId === objective.id);
  const [event, setEvent] = useState(saved?.event ?? '');
  const id = `guided-event-${objective.id}`;
  return (
    <fieldset class="sub-editor">
      <legend>
        {objective.id}. {objective.statement}
      </legend>
      <TextField id={id} label="Event for this objective" help="context.guided-event" hint="One event that hurts this objective. Example. Your main customer system is down for 3 days." value={event} onChange={(text) => {
          setEvent(text);
          update((current) => withEventText(current, objective.id, text));
        }} />
      <AnswerKeys
        label={`Answer for ${objective.id}`}
        options={CRITERION_ANSWERS}
        selected={saved?.answer ?? null}
        disabled={event.trim() === ''}
        onAnswer={(answer) => {
          update((current) => withCriterion(current, objective.id, event, answer));
        }}
      />
    </fieldset>
  );
}

function CriteriaStage({ doc, update }: { readonly doc: RiskDocument; readonly update: Update }) {
  const objectives = (doc.context?.objectives ?? []).filter((objective) => objective.statement.trim() !== '');
  if (objectives.length === 0) {
    return <p>No objective has a statement yet. Add objectives under Objectives above, or go to the next stage.</p>;
  }
  return (
    <>
      <p class="question">For each objective, write one event that hurts it. Then ask the management body if the event is acceptable.</p>
      <p class="hint">A "Not acceptable" answer gives a draft appetite statement in stage 5. Example statements to start from are under the appetite statements below.</p>
      {objectives.map((objective) => (
        <CriterionEditor key={objective.id} objective={objective} doc={doc} update={update} />
      ))}
    </>
  );
}

function pointText(state: PointState, currency: string): string {
  switch (state.status) {
    case 'set':
      return `${amount(state.loss ?? 0)} ${currency}`;
    case 'empty':
      return 'Not set. The answer was "Do not know".';
    case 'open':
      return state.answers.length === 0 ? 'Not asked yet' : `In progress, ${String(state.answers.length)} of ${String(SEARCH_ANSWERS)} answers`;
    case 'waiting':
      return 'Not asked yet';
  }
}

function ToleranceStage({ doc, update }: { readonly doc: RiskDocument; readonly update: Update }) {
  const currency = doc.document.currency;
  const elicitation = doc.appetite?.elicitation;
  const states = statesOf(elicitation);
  const open = openPoint(states);
  // The last answer removes the answer keys. Focus then goes to the line that says so, not to
  // the page (WCAG 2.4.3).
  const done = useRef<HTMLParagraphElement>(null);
  const wasOpen = useRef(open !== undefined);
  useEffect(() => {
    if (wasOpen.current && open === undefined) done.current?.focus();
    wasOpen.current = open !== undefined;
  }, [open]);
  if (elicitation?.capacity === undefined) {
    return <p>The tolerance questions need the capacity, because every amount comes from it. Go back to stage 1, or go on to the result.</p>;
  }
  const answered = states.some((state) => state.status !== 'waiting' && state.answers.length > 0);
  return (
    <>
      {open === undefined ? (
        <p class="question" tabIndex={-1} ref={done}>
          All 4 points have an answer.
        </p>
      ) : (
        <>
          <p class="hint">
            Point {ONE_IN.indexOf(open.oneIn) + 1} of {ONE_IN.length}. Question {open.answers.length + 1} of {SEARCH_ANSWERS}.
          </p>
          <p class="question" id="guided-tolerance-question" aria-live="polite">
            Do you accept a {chance(open.oneIn)} chance this year that losses from ICT risks reach {amount(open.question ?? 0)} {currency} or more?
          </p>
          <Explain id="guided-tolerance" topic="context.guided-tolerance-question" name="Tolerance questions" />
          <AnswerKeys labelledBy="guided-tolerance-question" options={SEARCH_LABELS} onAnswer={(answer) => {
              update((current) => withSearchAnswer(current, answer));
            }} />
        </>
      )}
      <ul class="cell-list">
        {states.map((state) => (
          <li key={state.oneIn}>
            {chance(state.oneIn)}. {pointText(state, currency)}
          </li>
        ))}
      </ul>
      <div class="button-row">
        <button type="button" class="quiet" disabled={!answered} onClick={() => {
            update(withoutLastAnswer);
          }}>
          Take back the last answer
        </button>
      </div>
    </>
  );
}

const CROSS_CHECK_LABELS = (half: string, double: string): readonly (readonly [CrossCheckAnswer, string])[] => [
  ['below-half', `Less than ${half}`],
  ['half-to-double', `${half} to ${double}`],
  ['above-double', `More than ${double}`],
  ['unknown', 'Do not know'],
];

function CrossCheckStage({ doc, update }: { readonly doc: RiskDocument; readonly update: Update }) {
  const currency = doc.document.currency;
  const elicitation = doc.appetite?.elicitation;
  const states = statesOf(elicitation);
  const point = crossCheckPoint(states);
  if (point === undefined) {
    return <p>The cross-check needs a tolerance point that is set. Go on to the result.</p>;
  }
  const { half, double } = crossCheckAmounts(point);
  const answer = crossCheckAnswer(elicitation, states);
  return (
    <>
      <p class="question" id="guided-cross-check-question">
        How much per year would you pay to remove a {chance(point.oneIn)} chance of losing {amount(point.loss)} {currency} or more?
      </p>
      <Explain id="guided-cross-check" topic="context.guided-cross-check" name="Cross-check" />
      <AnswerKeys
        labelledBy="guided-cross-check-question"
        options={CROSS_CHECK_LABELS(`${amount(half)} ${currency}`, `${amount(double)} ${currency}`)}
        selected={answer ?? null}
        onAnswer={(next) => {
          update((current) => withCrossCheck(current, next));
        }}
      />
      {answer === 'above-double' && (
        <p class="hint" role="status">
          This is a flag, not an error. The management body pays more than 2 times the expected loss to remove this chance, so the point can be too high. Look at it again in the result.
        </p>
      )}
    </>
  );
}

function ResultStage({ doc, update }: { readonly doc: RiskDocument; readonly update: Update }) {
  const currency = doc.document.currency;
  const elicitation = doc.appetite?.elicitation;
  const states = statesOf(elicitation);
  const set = guidedCurve(states).length;
  const flagged = flaggedPoint(elicitation, states);
  const preview = withGuidedResult(doc);
  const participants = elicitation?.participants ?? '';
  const [note, setNote] = useState<string>();
  const missing = set === 0 ? 'No tolerance point is set.' : set === 1 ? 'Only 1 tolerance point is set. The schema needs 2, so the app does not change the curve. Type this point in the tolerance curve below and add more points.' : set < 3 ? `${String(set)} tolerance points are set. The curve needs 3 points or more. Add the missing points in the tolerance curve below.` : undefined;
  return (
    <>
      <p>
        <strong>Draft.</strong> The result is a draft until the management body approves the tolerance curve in the fields "Approved by" and "Approved on" below.
      </p>
      {states.length > 0 && (
        <div class="table-box" tabIndex={0} role="region" aria-label="Tolerance points from the answers">
          <table>
            <caption>Tolerance points from the answers.</caption>
            <thead>
              <tr>
                <th scope="col">Chance per year</th>
                <th scope="col">Annual loss above ({currency})</th>
                <th scope="col">Note</th>
              </tr>
            </thead>
            <tbody>
              {states.map((state) => (
                <tr key={state.oneIn}>
                  <td>{chance(state.oneIn)}</td>
                  <td>{state.loss === undefined ? 'Not set' : amount(state.loss)}</td>
                  <td>{flagged === state.oneIn ? 'Check again. The board pays more than 2 times the expected loss to remove this chance.' : state.status === 'set' ? '' : pointText(state, currency)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {missing !== undefined && <p class="hint">{missing}</p>}
      {preview.statementsAdded > 0 && <p>{preview.statementsAdded === 1 ? '1 event is' : `${String(preview.statementsAdded)} events are`} not acceptable. Each gets a draft appetite statement.</p>}
      <div class="field-row">
        <div class="field">
          <TextField id="guided-held-on" label="Date of the session" help="context.guided-held-on" type="date" value={elicitation?.heldOn} onChange={(heldOn) => {
              update((current) => withSessionNote(current, { heldOn }));
            }} />
        </div>
        <div class="field wide">
          <TextField id="guided-participants" label="Who took part" help="context.guided-participants" hint="Names and roles, for example the managing directors and the IT lead." value={participants} onChange={(text) => {
              update((current) => withSessionNote(current, { participants: text }));
            }} />
        </div>
      </div>
      <div class="button-row">
        <button
          type="button"
          disabled={participants.trim() === '' || (preview.pointsWritten === 0 && preview.statementsAdded === 0)}
          onClick={() => {
            update((current) => withGuidedResult(current).doc);
            const points = preview.pointsWritten === 0 ? 'The tolerance curve did not change.' : `${String(preview.pointsWritten)} points are in the tolerance curve below. It needs approval.`;
            const statements =
              preview.statementsAdded === 0 ? '' : preview.statementsAdded === 1 ? ' 1 draft statement is added. Complete its trigger.' : ` ${String(preview.statementsAdded)} draft statements are added. Complete the trigger of each.`;
            setNote(`${points}${statements}`);
          }}
        >
          Use these answers
        </button>
        {participants.trim() === '' && <span class="hint">Type who took part first.</span>}
      </div>
      <Explain id="guided-use-answers" topic="context.guided-use-answers" name="Use these answers" />
      {note !== undefined && <p role="status">{note}</p>}
    </>
  );
}

export function GuidedQuestions({ doc, update }: { readonly doc: RiskDocument; readonly update: Update }) {
  const key = doc.document.id;
  const elicitation = doc.appetite?.elicitation;
  const [stage, setStage] = useState<Stage>(openStage.get(key) ?? 'intro');
  const heading = useRef<HTMLHeadingElement>(null);
  const moved = useRef(false);
  useEffect(() => {
    openStage.set(key, stage);
    if (moved.current) heading.current?.focus();
  }, [key, stage]);
  const go = (next: Stage): void => {
    moved.current = true;
    setStage(next);
  };
  const index = STAGES.findIndex(([name]) => name === stage);
  const previous = STAGES[index - 1]?.[0];
  const following = STAGES[index + 1]?.[0];

  return (
    <section aria-labelledby="guided-title" class="panel">
      <h2 id="guided-title">Guided questions for the management body</h2>
      <Explain id="guided-section" topic="context.guided-questions" name="Guided questions for the management body" visible="About this section" />
      {stage === 'intro' ? (
        <>
          <p class="muted">
            Run these questions with your management body in one session of about 30 minutes. Most answers are one click, and each answer is saved at once. The questions go from the capacity of the
            company to the tolerance curve. The curve and the statements change only when you click "Use these answers" at the end. The result is a draft until the management body approves it.
          </p>
          {elicitation === undefined ? (
            <button type="button" onClick={() => {
                update((current) => startSession(current, today()));
                go('capacity');
              }}>
              Start the guided questions
            </button>
          ) : (
            <>
              <p>The session of {elicitation.heldOn} has answers.</p>
              <div class="button-row">
                <button type="button" onClick={() => {
                    go('capacity');
                  }}>
                  Continue the session
                </button>
                <button type="button" class="quiet" onClick={() => {
                    update((current) => startSession(clearSession(current), today()));
                    go('capacity');
                  }}>
                  Start again without the answers
                </button>
              </div>
              <Explain id="guided-start-again" topic="context.guided-start-again" name="Start again without the answers" />
            </>
          )}
        </>
      ) : (
        <>
          <h3 id="guided-stage" tabIndex={-1} ref={heading}>
            Stage {index + 1} of {STAGES.length}. {STAGES[index]?.[1]}
          </h3>
          {stage === 'capacity' && (
            <CapacityStage doc={doc} update={update} onNext={() => {
                go('criteria');
              }} />
          )}
          {stage === 'criteria' && <CriteriaStage doc={doc} update={update} />}
          {stage === 'tolerance' && <ToleranceStage doc={doc} update={update} />}
          {stage === 'cross-check' && <CrossCheckStage doc={doc} update={update} />}
          {stage === 'result' && <ResultStage doc={doc} update={update} />}
          <div class="button-row">
            {previous !== undefined && (
              <button type="button" class="quiet" onClick={() => {
                  go(previous);
                }}>
                Back
              </button>
            )}
            {following !== undefined && stage !== 'capacity' && (
              <button type="button" onClick={() => {
                  go(following);
                }}>
                Next
              </button>
            )}
            <button type="button" class="quiet" onClick={() => {
                go('intro');
              }}>
              Close the questions
            </button>
          </div>
        </>
      )}
    </section>
  );
}
