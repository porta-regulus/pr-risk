// Screen S6 Monitor and adjust (SPEC.md Sec. 5, 6.11, 6.14, 6.17 item 2, 8.14). Observations of
// KPIs and KRIs with their triggers, review triggers, acceptance records, the tolerance what-if
// on the kept per-trial totals, and the forecast log with the Brier score.
import type { ComponentChildren } from 'preact';
import { useEffect, useRef, useState } from 'preact/hooks';
import { exceedance, lossGrid, type TolerancePoint } from '../engine/metrics';
import { brierScores, withForecasts, withOutcome } from '../monitor/forecasts';
import type { MonitorNumbers } from '../monitor/numbers';
import { acceptanceState, APP_ACTOR, automaticReviews, itemState, latestInGap, reasonKey, reviewTriggers, withAutomaticReview, withObservation, type ItemState } from '../monitor/review';
import { checkCurve, curveProblems, samePoints, withPoints, withToleranceChange } from '../monitor/tolerance';
import { canonicalize } from '../schema/canonical';
import type { Risk, RiskDocument } from '../schema/types';
import { AcceptanceEditor } from './acceptance';
import { withSection } from './edit';
import { DocumentScreen, type ScreenName, type Update } from './editor';
import { InvalidFields, NumberField, SelectField, TextField, useInvalid } from './fields';
import { useEngine } from './jobs';
import { LecChart, money, percent, probability, sourceLine, StatusText } from './report';
import { KIND_TEXT, metricsOf } from './table9';

type Statement = NonNullable<NonNullable<RiskDocument['appetite']>['statements']>[number];
type Trigger = NonNullable<NonNullable<Statement['tolerances']>[number]['breachWhen']>;
type Forecast = NonNullable<RiskDocument['forecasts']>[number];

const today = (): string => new Date().toISOString().slice(0, 10);
const isoSeconds = (): string => new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');
const isDate = (text: string): boolean => /^\d{4}-\d{2}-\d{2}$/.test(text);

// The parts of the document that change the run of S6. The tolerance curve and the capacity
// do not, because the what-if reads them from the kept totals.
export function monitorKey(doc: RiskDocument): string | undefined {
  if (doc.simulation === undefined || !doc.risks.some((risk) => risk.estimate !== undefined)) return undefined;
  return canonicalize({
    registers: doc.registers.map((register) => [register.id, register.parentRegisterId ?? null, register.asOf, register.timeframeMonths, register.reportableEventThreshold ?? null]),
    drivers: doc.drivers ?? [],
    risks: doc.risks.map((risk) => [risk.riskId, risk.registerId, risk.polarity, risk.estimate ?? null, risk.driverLinks ?? null, risk.onlyWithResponse ?? null]),
    simulation: doc.simulation,
    currency: doc.document.currency,
  });
}

const OPERATOR_TEXT: Readonly<Record<string, string>> = { '>': 'above', '>=': 'at or above', '<': 'below', '<=': 'at or below', '==': 'equal to', '!=': 'not equal to' };

export function triggerText(trigger: Trigger): string {
  return trigger.conditions
    .map((condition) => `${condition.metric} ${OPERATOR_TEXT[condition.operator] ?? condition.operator} ${String(condition.threshold)}${condition.unit === undefined ? '' : ` ${condition.unit}`}`)
    .join(trigger.combine === 'all' ? ' and ' : ' or ');
}

function StateText({ state, tolerance }: { readonly state: ItemState; readonly tolerance: boolean }) {
  if (state.state === 'no-data') {
    return (
      <span class="status">
        No data{state.missing.length > 0 && <span class="sub">Needs {state.missing.join(' and ')}</span>}
      </span>
    );
  }
  const fired = state.state === 'fired';
  return (
    <span class={`status ${fired ? 'status-clear' : 'status-within'}`}>
      <span class="dot" aria-hidden="true" />
      {tolerance ? (fired ? 'Breached' : 'Not breached') : fired ? 'Fires' : 'Does not fire'}
    </span>
  );
}

function ObservationForm({ statement, update }: { readonly statement: Statement; readonly update: Update }) {
  const metrics = metricsOf(statement);
  const [observedOn, setObservedOn] = useState(today());
  const [values, setValues] = useState<Readonly<Record<string, number>>>({});
  const [note, setNote] = useState('');
  const [report, invalid] = useInvalid();
  // A new key remounts the fields, so they are empty after a record.
  const [round, setRound] = useState(0);
  const id = `obs-${statement.id}`;
  if (metrics.length === 0) return <p class="muted">This statement has no machine-readable trigger, so it takes no observation.</p>;
  const ready = isDate(observedOn) && Object.keys(values).length > 0 && !invalid;
  return (
    <fieldset class="sub-editor" key={round}>
      <legend>Record an observation for {statement.id}</legend>
      <InvalidFields.Provider value={report}>
        <div class="field-row">
          <div class="field">
            <TextField id={`${id}-on`} label="Observed on" type="date" value={observedOn} onChange={setObservedOn} />
          </div>
          {metrics.map(({ metric, unit }) => (
            <div class="field" key={metric}>
              <NumberField
                id={`${id}-${metric}`}
                label={unit === undefined ? metric : `${metric} (${unit})`}
                value={values[metric]}
                onChange={(value) => {
                  const others = Object.entries(values).filter(([name]) => name !== metric);
                  setValues(Object.fromEntries(value === undefined ? others : [...others, [metric, value]]));
                }}
              />
            </div>
          ))}
        </div>
      </InvalidFields.Provider>
      <TextField id={`${id}-note`} label="Note" value={note} onChange={setNote} />
      <div class="button-row">
        <button
          type="button"
          disabled={!ready}
          onClick={() => {
            const observation = { observedOn, values, ...(note.trim() === '' ? {} : { note: note.trim() }) };
            update((current) =>
              withSection(current, 'appetite', {
                ...current.appetite,
                statements: (current.appetite?.statements ?? []).map((item) => (item.id === statement.id ? withObservation(item, observation) : item)),
              }),
            );
            setValues({});
            setNote('');
            setRound((value) => value + 1);
          }}
        >
          Record the observation of {statement.id}
        </button>
        {!ready && <span class="hint">Give a date and at least one value.</span>}
      </div>
    </fieldset>
  );
}

function StatementMonitor({ statement, number, update }: { readonly statement: Statement; readonly number: number; readonly update: Update }) {
  const items = [
    ...(statement.tolerances ?? []).map((item) => ({ id: item.id, name: 'Tolerance', text: item.text, trigger: item.breachWhen, state: itemState(item), tolerance: true })),
    ...(statement.indicators ?? []).map((item) => ({ id: item.id, name: KIND_TEXT[item.kind] ?? item.kind, text: item.text, trigger: item.firesWhen, state: itemState(item), tolerance: false })),
  ];
  const gaps = latestInGap(statement);
  const title = `${statement.id}${statement.title === undefined ? '' : ` ${statement.title}`}`;
  return (
    <div class="statement" data-statement={statement.id}>
      <h3>{title}</h3>
      <div class="table-box" tabIndex={0} role="region" aria-label={`Indicators of ${statement.id}`}>
        <table>
          <caption>
            Table {number}. Tolerances and indicators of {statement.id}, on the latest observation.
          </caption>
          <thead>
            <tr>
              <th scope="col">ID</th>
              <th scope="col">Kind</th>
              <th scope="col">Text</th>
              <th scope="col">Trigger</th>
              <th scope="col">Latest observation</th>
              <th scope="col">State</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.id} data-item={item.id}>
                <th scope="row" class="id">{item.id}</th>
                <td>{item.name}</td>
                <td>{item.text}</td>
                <td>{item.trigger === undefined ? <span class="muted">None</span> : triggerText(item.trigger)}</td>
                <td>
                  {item.state.observation === undefined ? (
                    <span class="muted">None</span>
                  ) : (
                    <>
                      {item.state.observation.observedOn}.{' '}
                      {Object.entries(item.state.observation.values)
                        .map(([metric, value]) => `${metric} ${String(value)}`)
                        .join(', ')}
                    </>
                  )}
                </td>
                <td class="item-state">{item.trigger === undefined ? <span class="muted">Not checked</span> : <StateText state={item.state} tolerance={item.tolerance} />}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {gaps.map((gap) => (
        <p class="banner" key={gap.metric}>
          The latest value {String(gap.threshold)} of {gap.metric} is in a boundary gap. One trigger uses "above" and another "below" {String(gap.threshold)}, and none includes it, so nothing
          fires. Change one operator on the screen Context and strategy.
        </p>
      ))}
      <ObservationForm statement={statement} update={update} />
    </div>
  );
}

function IndicatorsPanel({ doc, update }: { readonly doc: RiskDocument; readonly update: Update }) {
  const statements = doc.appetite?.statements ?? [];
  return (
    <section aria-labelledby="indicators-title" class="panel">
      <h2 id="indicators-title">KPIs, KRIs and tolerances</h2>
      <p class="hint">
        Record what you measure. The app checks each trigger on its latest observation and shows "Fires", "Does not fire" or "No data" (Sec. 3.7). A KRI that fires starts a review of
        the risks in the categories of its statement.
      </p>
      {statements.length === 0 ? (
        <p class="muted">No appetite statement yet. Add statements with tolerances and indicators on the screen Context and strategy.</p>
      ) : (
        statements.map((statement, i) => <StatementMonitor key={statement.id} statement={statement} number={i + 1} update={update} />)
      )}
    </section>
  );
}

// The risks that the app set to "Review needed" since this screen opened. Undo removes the
// entries, so the list follows it.
function automaticSince(doc: RiskDocument, since: string): string[] {
  return (doc.changeLog ?? []).filter((entry) => entry.entityKind === 'risk' && entry.actor?.startsWith(APP_ACTOR) === true && entry.at >= since).map((entry) => entry.entityId);
}

function ReviewPanel({ doc, openedAt }: { readonly doc: RiskDocument; readonly openedAt: string }) {
  const triggers = reviewTriggers(doc, today());
  const byId = new Map(doc.risks.map((risk) => [risk.riskId, risk]));
  const set = automaticSince(doc, openedAt);
  return (
    <section aria-labelledby="review-title" class="panel">
      <h2 id="review-title">Review triggers</h2>
      <p class="hint">
        A risk needs a review when a KRI of its appetite statement fires, when its review date passes, when its acceptance expires, or when a new emerging or horizon risk appears in its
        category after the as-of date of its register (Sec. 3.7.1 and 5.1.2). The app then sets the status "Review needed" itself. It checks when this screen opens and after each saved
        change on it. The change log entry names the app and the reasons. Each reason acts once, so a person ends the review with another status. New evidence sets "Review needed" when
        it comes in.
      </p>
      {set.length > 0 && (
        <p role="status">
          The app set {set.join(', ')} to Review needed. Undo last change takes this back.
        </p>
      )}
      {triggers.length === 0 ? (
        <p>No review trigger holds today.</p>
      ) : (
        <div class="table-box" tabIndex={0} role="region" aria-label="Risks with a review trigger">
          <table>
            <thead>
              <tr>
                <th scope="col">ID</th>
                <th scope="col">Description</th>
                <th scope="col">Status</th>
                <th scope="col">Reasons</th>
              </tr>
            </thead>
            <tbody>
              {triggers.map((item) => (
                <tr key={item.riskId}>
                  <th scope="row" class="id">{item.riskId}</th>
                  <td>{byId.get(item.riskId)?.riskDescription}</td>
                  <td>{byId.get(item.riskId)?.status}</td>
                  <td>
                    <ul class="cell-list">
                      {item.reasons.map((reason) => (
                        <li key={reason.text}>{reason.text}</li>
                      ))}
                    </ul>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

const ACCEPTANCE_TEXT = { valid: 'Valid', expired: 'Expired', 'open-ended': 'No end date' } as const;

function AcceptancePanel({ doc, update }: { readonly doc: RiskDocument; readonly update: Update }) {
  const day = today();
  const risks = doc.risks.filter(
    (risk) => risk.status !== 'Closed' && (risk.acceptance !== undefined || risk.status === 'Accepted' || (risk.riskResponseType as readonly string[]).includes('Accept')),
  );
  const state = (risk: Risk) => {
    const value = acceptanceState(risk, day);
    if (value === undefined) return <span class="muted">No record</span>;
    return (
      <span class={`status ${value === 'expired' ? 'status-clear' : 'status-within'}`}>
        <span class="dot" aria-hidden="true" />
        {ACCEPTANCE_TEXT[value]}
      </span>
    );
  };
  return (
    <section aria-labelledby="acceptance-title" class="panel">
      <h2 id="acceptance-title">Acceptance records</h2>
      <p class="hint">
        A record states who accepted the risk or the exception to a tolerance, when, until when and why (Sec. 5.1.2). An acceptance past its end date needs a review.
      </p>
      {risks.length === 0 ? (
        <p class="muted">No risk is accepted and no risk has the response Accept.</p>
      ) : (
        <>
          <div class="table-box" tabIndex={0} role="region" aria-label="Acceptance records">
            <table>
              <thead>
                <tr>
                  <th scope="col">ID</th>
                  <th scope="col">Kind</th>
                  <th scope="col">Accepted by</th>
                  <th scope="col">Accepted on</th>
                  <th scope="col">Valid until</th>
                  <th scope="col">State</th>
                </tr>
              </thead>
              <tbody>
                {risks.map((risk) => (
                  <tr key={risk.riskId}>
                    <th scope="row" class="id">{risk.riskId}</th>
                    <td>{risk.acceptance === undefined ? '' : risk.acceptance.kind === 'acceptance' ? 'Acceptance' : 'Exception to a tolerance'}</td>
                    <td>{risk.acceptance?.acceptedBy}</td>
                    <td>{risk.acceptance?.acceptedOn}</td>
                    <td>{risk.acceptance?.validUntil}</td>
                    <td>{state(risk)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <details class="help">
            <summary>Record or renew an acceptance</summary>
            {risks.map((risk) => (
              <div key={risk.riskId}>
                <p>
                  <strong>{risk.riskId}</strong> {risk.riskDescription.replace(/\.$/, '')}. Owner {risk.riskOwnerPointOfContact}.
                </p>
                <AcceptanceEditor risk={risk} update={update} />
              </div>
            ))}
          </details>
        </>
      )}
    </section>
  );
}

const pointsOf = (doc: RiskDocument): TolerancePoint[] => (doc.appetite?.toleranceCurve?.points ?? []).map((point) => ({ ...point }));

function WhatIfPanel({ doc, update, numbers }: { readonly doc: RiskDocument; readonly update: Update; readonly numbers: MonitorNumbers | undefined }) {
  const saved = pointsOf(doc);
  const [points, setPoints] = useState<TolerancePoint[]>(saved);
  const [changedBy, setChangedBy] = useState('');
  const [reason, setReason] = useState('');
  const [note, setNote] = useState<string>();
  const [round, setRound] = useState(0);
  const [report, invalid] = useInvalid();
  const currency = doc.document.currency;
  if (saved.length === 0) {
    return (
      <section aria-labelledby="whatif-title" class="panel">
        <h2 id="whatif-title">Tolerance what-if</h2>
        <p class="muted">There is no tolerance curve. Set one on the screen Context and strategy first.</p>
      </section>
    );
  }
  const problems = curveProblems(points);
  const changed = !samePoints(points, saved);
  const setPoint = (i: number, key: keyof TolerancePoint, value: number | undefined): void => {
    setNote(undefined);
    setPoints(points.map((point, j) => (j === i ? { ...point, [key]: value ?? Number.NaN } : point)));
  };
  const before = numbers === undefined ? undefined : checkCurve(doc, saved, numbers.losses);
  const after = numbers === undefined || problems.length > 0 ? undefined : checkCurve(doc, points, numbers.losses);
  const grid = numbers === undefined || problems.length > 0 ? [] : Array.from(lossGrid(withPoints(doc, points), numbers.losses));
  const ready = changed && problems.length === 0 && !invalid && changedBy.trim() !== '' && reason.trim() !== '';
  const row = (label: string, value: (check: NonNullable<typeof before>) => ComponentChildren) => (
    <tr>
      <th scope="row">{label}</th>
      <td>{before === undefined ? '' : value(before)}</td>
      <td>{after === undefined ? <span class="muted">Not valid</span> : value(after)}</td>
    </tr>
  );
  return (
    <section aria-labelledby="whatif-title" class="panel">
      <h2 id="whatif-title">Tolerance what-if</h2>
      <p class="hint">
        Change the points to see the result with another tolerance curve. The app keeps the annual losses of the last run, so no new simulation is necessary (Sec. 5.4.2). A saved change
        moves the old curve into the history with the date, the person and the reason.
      </p>
      <InvalidFields.Provider value={report}>
        <div class="table-box" tabIndex={0} role="region" aria-label="What-if points" key={round}>
          <table>
            <thead>
              <tr>
                <th scope="col">Point</th>
                <th scope="col">Loss ({currency})</th>
                <th scope="col">Highest probability of a loss above it</th>
              </tr>
            </thead>
            <tbody>
              {points.map((point, i) => (
                <tr key={i}>
                  <th scope="row">{i + 1}</th>
                  <td>
                    <NumberField
                      id={`whatif-${String(i)}-loss`}
                      label={`What-if point ${String(i + 1)} loss`}
                      hiddenLabel
                      min={0}
                      value={Number.isNaN(point.loss) ? undefined : point.loss}
                      onChange={(value) => {
                        setPoint(i, 'loss', value);
                      }}
                    />
                  </td>
                  <td>
                    <NumberField
                      id={`whatif-${String(i)}-p`}
                      label={`What-if point ${String(i + 1)} probability`}
                      hiddenLabel
                      min={0}
                      max={1}
                      value={Number.isNaN(point.maxExceedanceProbability) ? undefined : point.maxExceedanceProbability}
                      onChange={(value) => {
                        setPoint(i, 'maxExceedanceProbability', value);
                      }}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </InvalidFields.Provider>
      <div class="button-row">
        <button
          type="button"
          class="quiet"
          onClick={() => {
            const last = points.at(-1);
            setPoints([...points, { loss: (last?.loss ?? 1) * 2, maxExceedanceProbability: (last?.maxExceedanceProbability ?? 0.02) / 2 }]);
          }}
        >
          Add a point
        </button>
        <button
          type="button"
          class="quiet"
          disabled={points.length <= 2}
          onClick={() => {
            setPoints(points.slice(0, -1));
          }}
        >
          Remove the last point
        </button>
        <button
          type="button"
          class="quiet"
          disabled={!changed}
          onClick={() => {
            setPoints(saved);
            setRound((value) => value + 1);
          }}
        >
          Start again from the saved curve
        </button>
      </div>
      {problems.length > 0 && (
        <ul class="warnings">
          {problems.map((problem) => (
            <li key={problem}>{problem}</li>
          ))}
        </ul>
      )}
      {numbers === undefined ? (
        <p class="muted">The result shows after the simulation.</p>
      ) : (
        <>
          <div class="table-box" tabIndex={0} role="region" aria-label="What-if result">
            <table>
              <caption>Table {(doc.appetite?.statements ?? []).length + 1}. The roll-up against the saved curve and against the what-if curve, without a new simulation.</caption>
              <thead>
                <tr>
                  <th scope="col">Measure</th>
                  <th scope="col">Saved curve</th>
                  <th scope="col">What-if curve</th>
                </tr>
              </thead>
              <tbody>
                {row('Status', (check) => (
                  <StatusText status={check.status} />
                ))}
                {row('Tolerance gap', (check) => probability(check.gap))}
                {row('Excess area', (check) => check.excessArea.toFixed(4))}
                {before?.pAboveCapacity !== undefined && row('P(loss above capacity)', (check) => probability(check.pAboveCapacity ?? 0))}
              </tbody>
            </table>
          </div>
          {grid.length > 0 && (
            <LecChart
              id="lec-s6"
              number={1}
              title="Loss exceedance of the roll-up against the what-if curve"
              series={[{ name: 'All registers', points: grid.map((loss) => ({ loss, probability: exceedance(numbers.losses, loss) })) }]}
              points={points}
              capacity={doc.appetite?.capacity?.amount}
              currency={currency}
              source={sourceLine(numbers)}
            />
          )}
        </>
      )}
      <fieldset class="sub-editor">
        <legend>Save the what-if curve</legend>
        <div class="field-row">
          <div class="field">
            <TextField id="whatif-by" label="Changed by" value={changedBy} onChange={setChangedBy} />
          </div>
          <div class="field">
            <TextField id="whatif-reason" label="Reason for the change" value={reason} onChange={setReason} />
          </div>
        </div>
        <div class="button-row">
          <button
            type="button"
            disabled={!ready}
            onClick={() => {
              update((current) => withToleranceChange(current, points, { changedOn: today(), changedBy: changedBy.trim(), reason: reason.trim() }));
              setReason('');
              setNote('The old curve is in the history. The new curve needs approval. Set "Approved by" and "Approved on" on the screen Context and strategy.');
            }}
          >
            Save the what-if curve
          </button>
          {!ready && <span class="hint">Change the curve and give your name and the reason.</span>}
        </div>
        {note !== undefined && <p role="status">{note}</p>}
      </fieldset>
      {(doc.appetite?.history ?? []).length > 0 && (
        <div class="table-box" tabIndex={0} role="region" aria-label="Tolerance curve history">
          <table>
            <caption>Earlier tolerance curves.</caption>
            <thead>
              <tr>
                <th scope="col">Changed on</th>
                <th scope="col">Changed by</th>
                <th scope="col">Reason</th>
                <th scope="col">Old points (loss, probability)</th>
              </tr>
            </thead>
            <tbody>
              {(doc.appetite?.history ?? []).map((entry, i) => (
                <tr key={i}>
                  <td>{entry.changedOn}</td>
                  <td>{entry.changedBy}</td>
                  <td>{entry.reason}</td>
                  <td>{entry.points.map((point) => `(${money(point.loss)}, ${String(point.maxExceedanceProbability)})`).join(' ')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function OutcomeForm({ forecast, update }: { readonly forecast: Forecast; readonly update: Update }) {
  const id = `outcome-${forecast.id}`;
  const [occurred, setOccurred] = useState<'yes' | 'no'>();
  const [recordedOn, setRecordedOn] = useState(today());
  const [impact, setImpact] = useState<number>();
  const [evidence, setEvidence] = useState('');
  const [report, invalid] = useInvalid();
  const ready = occurred !== undefined && isDate(recordedOn) && recordedOn >= forecast.windowEnd && !invalid && (impact === undefined || impact >= 0);
  return (
    <fieldset class="sub-editor">
      <legend>Outcome of {forecast.id}</legend>
      <InvalidFields.Provider value={report}>
        <div class="field-row">
          <div class="field">
            <SelectField
              id={`${id}-occurred`}
              label="Did the event occur?"
              value={occurred}
              emptyLabel="Choose"
              options={[
                ['yes', 'Yes'],
                ['no', 'No'],
              ]}
              onChange={setOccurred}
            />
          </div>
          <div class="field">
            <TextField id={`${id}-on`} label="Recorded on" type="date" value={recordedOn} onChange={setRecordedOn} />
          </div>
          <div class="field">
            <NumberField id={`${id}-impact`} label="Observed annual impact (optional)" min={0} value={impact} onChange={setImpact} />
          </div>
        </div>
      </InvalidFields.Provider>
      <TextField id={`${id}-evidence`} label="Evidence" value={evidence} onChange={setEvidence} />
      <button
        type="button"
        disabled={!ready}
        onClick={() => {
          update((current) =>
            withOutcome(current, forecast.id, {
              occurred: occurred === 'yes',
              recordedOn,
              ...(impact === undefined ? {} : { observedAnnualImpact: impact }),
              ...(evidence.trim() === '' ? {} : { evidence: evidence.trim() }),
            }),
          );
        }}
      >
        Record the outcome of {forecast.id}
      </button>
    </fieldset>
  );
}

function ForecastPanel({ doc, update, numbers, simulated }: { readonly doc: RiskDocument; readonly update: Update; readonly numbers: MonitorNumbers | undefined; readonly simulated: boolean }) {
  const day = today();
  const forecasts = doc.forecasts ?? [];
  const taken = new Set(forecasts.map((forecast) => forecast.id));
  const candidates = (numbers?.forecasts ?? []).filter((forecast) => !taken.has(forecast.id) && forecast.windowEnd >= day);
  const due = forecasts.filter((forecast) => forecast.outcome === undefined && forecast.windowEnd < day);
  const scores = brierScores(forecasts);
  const currency = doc.document.currency;
  const noThreshold = doc.registers.filter((register) => register.reportableEventThreshold === undefined);
  const outcomeText = (forecast: Forecast): string =>
    forecast.outcome !== undefined
      ? `${forecast.outcome.occurred ? 'Occurred' : 'Did not occur'}, recorded on ${forecast.outcome.recordedOn}.`
      : forecast.windowEnd < day
        ? 'Due. Record the outcome.'
        : `Open until ${forecast.windowEnd}.`;
  return (
    <section aria-labelledby="forecasts-title" class="panel">
      <h2 id="forecasts-title">Forecasts and Brier score</h2>
      <p class="hint">
        "Freeze forecasts" stores one forecast per leaf risk. The window starts on the as-of date of the register and lasts its timeframe. The event is at least one event with an impact at
        or above the reportable threshold. A frozen forecast is never changed. After the window ends, record what happened (Sec. 8.14).
      </p>
      {noThreshold.length > 0 && (
        <p class="hint">{noThreshold.map((register) => register.id).join(', ')} has no reportable event threshold, so every event counts. Set the threshold on the screen Identify and analyze.</p>
      )}
      <div class="button-row">
        <button
          type="button"
          disabled={candidates.length === 0}
          onClick={() => {
            update((current) => withForecasts(current, candidates, isoSeconds()));
          }}
        >
          Freeze {candidates.length} {candidates.length === 1 ? 'forecast' : 'forecasts'}
        </button>
        {!simulated && <span class="hint">Freezing needs a risk with an estimate and a finished simulation.</span>}
        {simulated && numbers !== undefined && candidates.length === 0 && <span class="hint">Every simulated risk has a forecast for its current window.</span>}
      </div>
      {forecasts.length === 0 ? (
        <p class="muted">No forecast yet.</p>
      ) : (
        <div class="table-box" tabIndex={0} role="region" aria-label="Forecast log">
          <table>
            <caption>Forecast log. f is the probability of at least one event in the window.</caption>
            <thead>
              <tr>
                <th scope="col">ID</th>
                <th scope="col">Risk</th>
                <th scope="col">Window</th>
                <th scope="col">f</th>
                <th scope="col">90% interval of annual impact ({currency})</th>
                <th scope="col">Outcome</th>
              </tr>
            </thead>
            <tbody>
              {forecasts.map((forecast) => (
                <tr key={forecast.id}>
                  <th scope="row" class="id">{forecast.id}</th>
                  <td>{forecast.riskId}</td>
                  <td>
                    {forecast.windowStart} to {forecast.windowEnd}
                  </td>
                  <td>{forecast.probability.toFixed(4)}</td>
                  <td>{forecast.annualImpactInterval90 === undefined ? '' : `${money(forecast.annualImpactInterval90.lower)} to ${money(forecast.annualImpactInterval90.upper)}`}</td>
                  <td>{outcomeText(forecast)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {due.map((forecast) => (
        <OutcomeForm key={forecast.id} forecast={forecast} update={update} />
      ))}
      <h3>Brier score</h3>
      {scores === undefined ? (
        <p class="muted">No forecast has an outcome yet.</p>
      ) : (
        <div class="table-box" tabIndex={0} role="region" aria-label="Brier score">
          <table>
            <caption>Scores of {scores.n} resolved {scores.n === 1 ? 'forecast' : 'forecasts'}. Brier (1950), Murphy (1973). A lower Brier score is better.</caption>
            <tbody>
              <tr>
                <th scope="row">Brier score</th>
                <td>
                  {scores.brier.toFixed(4)}, 95% interval {scores.interval95[0].toFixed(4)} to {scores.interval95[1].toFixed(4)}
                </td>
              </tr>
              <tr>
                <th scope="row">Base rate</th>
                <td>{scores.baseRate.toFixed(4)}</td>
              </tr>
              <tr>
                <th scope="row">Skill score</th>
                <td>{scores.skill === undefined ? 'Not defined, because every outcome is the same' : scores.skill.toFixed(4)}</td>
              </tr>
              <tr>
                <th scope="row">Reliability, resolution, uncertainty</th>
                <td>
                  {scores.reliability.toFixed(4)}, {scores.resolution.toFixed(4)}, {scores.uncertainty.toFixed(4)}
                </td>
              </tr>
              <tr>
                <th scope="row">Brier score minus (reliability - resolution + uncertainty)</th>
                <td>{scores.decompositionGap.toFixed(4)}</td>
              </tr>
              <tr>
                <th scope="row">Hit rate of the 90% impact interval (target 0.9)</th>
                <td>{scores.intervalHitRate === undefined ? 'No resolved forecast has both an interval and an observed annual impact' : percent(scores.intervalHitRate)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      )}
      <p class="hint">
        Weak point. 15 risks with a base rate of 5 to 10% give about one event per year, so the score of one company is noise for years. The app keeps every forecast, so the data is
        ready when scores of many companies can be pooled.
      </p>
    </section>
  );
}

interface Visit {
  readonly openedAt: string;
  // Keys of the reasons that acted in this visit. Undo takes a change back, and the reason
  // does not act again before the screen opens next.
  readonly done: Set<string>;
}

function MonitorBody({ doc, update, blocked, visit }: { readonly doc: RiskDocument; readonly update: Update; readonly blocked: boolean; readonly visit: Visit }) {
  // Sec. 6.11 item 2 and Sec. 6.14 item 1. The check runs on each version that the screen
  // shows: on opening, after a save and after undo. A new log means a new version. The
  // change waits while a field blocks the save, and then follows the next save.
  const log = doc.changeLog;
  useEffect(() => {
    if (blocked) return;
    const reviews = automaticReviews(doc, today(), visit.done);
    if (reviews.length === 0) return;
    for (const review of reviews) for (const reason of review.reasons) visit.done.add(reasonKey(review.riskId, reason));
    update((current) => withAutomaticReview(current, reviews, isoSeconds()));
  }, [log]);
  const key = monitorKey(doc);
  const job = useEngine(
    key,
    () =>
      ({
        kind: 'monitor',
        doc,
        trials: doc.simulation?.trials ?? 100_000,
        seed: doc.simulation?.seed ?? 0,
        createdOn: isoSeconds(),
      }) as const,
  );
  // A result of an older key never freezes a forecast or answers a what-if.
  const numbers = key !== undefined && job.resultKey === key ? job.result : undefined;
  return (
    <div class="monitor">
      <IndicatorsPanel doc={doc} update={update} />
      <ReviewPanel doc={doc} openedAt={visit.openedAt} />
      <AcceptancePanel doc={doc} update={update} />
      <p role="status" class="muted">
        {key === undefined
          ? 'No risk has an estimate yet, so there is no simulation for the what-if and the forecasts.'
          : job.running
            ? 'The simulation runs.'
            : job.error !== undefined
              ? `The simulation failed. ${job.error}`
              : numbers === undefined
                ? ''
                : `Simulated with ${numbers.trials.toLocaleString('en')} trials.`}
      </p>
      <WhatIfPanel doc={doc} update={update} numbers={numbers} />
      <ForecastPanel doc={doc} update={update} numbers={numbers} simulated={key !== undefined} />
    </div>
  );
}

export function MonitorScreen({ id, onNavigate }: { readonly id: string; readonly onNavigate: (screen: ScreenName) => void }) {
  // Kept outside the frame, so undo, which remounts the body, does not reset it.
  const visit = useRef<Visit>({ openedAt: isoSeconds(), done: new Set() });
  return (
    <DocumentScreen
      id={id}
      screen="monitor"
      title="Monitor and adjust"
      lede="Record the indicators, review the risks that need it, keep the acceptances current, test another tolerance curve and score the forecasts."
      onNavigate={onNavigate}
    >
      {(doc, update, { blocked }) => <MonitorBody doc={doc} update={update} blocked={blocked} visit={visit.current} />}
    </DocumentScreen>
  );
}
