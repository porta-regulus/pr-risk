// Screen S4 Prioritize (SPEC.md Sec. 5, 6.9, 6.12, 6.16, 8.8, 8.13). The loss exceedance curve
// of the roll-up and of each register against the tolerance curve, percentiles, the risks by
// expected annual loss with their contribution to the tail, priorities with overrides, and the
// two-sided matrix. The matrix is display only. Ranking uses the simulation.
import type { PriorityNumbers } from '../engine/prioritize';
import type { RiskRow } from '../engine/decision';
import { canonicalize } from '../schema/canonical';
import { lint } from '../schema/rules';
import type { Risk, RiskDocument } from '../schema/types';
import { numbersSource } from './analysis';
import { withValue } from './edit';
import { DocumentScreen, type ScreenName, type Update } from './editor';
import { Explain } from './explain';
import { Checkboxes, NumberField, TextField } from './fields';
import { ErrView } from './err';
import { registerTree } from './identify';
import { useEngine } from './jobs';
import { LecChart, money, percent, probability, short, sourceLine, StatusText } from './report';
import { More, Section } from './section';

type Override = NonNullable<Risk['priorityOverride']>;

const FACTORS: readonly (readonly [NonNullable<Override['factors']>[number], string])[] = [
  ['mission', 'Mission'],
  ['financial', 'Financial'],
  ['reputation', 'Reputation'],
  ['legal-requirement', 'Legal requirement'],
  ['shareholder-sentiment', 'Shareholder sentiment'],
  ['merger-or-valuation', 'Merger or valuation'],
  ['quick-win', 'Quick win'],
  ['leadership-priority', 'Leadership priority'],
];

const today = (): string => new Date().toISOString().slice(0, 10);

// The parts of the document that change the simulation. Priorities and text do not.
export function simulationKey(doc: RiskDocument): string | undefined {
  if (doc.simulation === undefined || !doc.risks.some((risk) => risk.estimate !== undefined)) return undefined;
  return canonicalize({
    registers: doc.registers.map((register) => [register.id, register.parentRegisterId ?? null, register.timeframeMonths, register.reportableEventThreshold ?? null]),
    drivers: doc.drivers ?? [],
    risks: doc.risks.map((risk) => [risk.riskId, risk.registerId, risk.polarity, risk.estimate ?? null, risk.driverLinks ?? null, risk.onlyWithResponse ?? null]),
    capacity: doc.appetite?.capacity?.amount ?? null,
    curve: doc.appetite?.toleranceCurve?.points ?? null,
    simulation: doc.simulation,
  });
}

// Proposed priorities (Sec. 6.9 item 1). Simulated negative risks by expected annual loss,
// highest first, within each register, because a child register keeps its own priorities
// (Sec. 6.16 item 2). Equal values keep the order of the ids.
export function proposedPriorities(doc: RiskDocument, risks: readonly RiskRow[]): Map<string, number> {
  const registerOf = new Map(doc.risks.map((risk) => [risk.riskId, risk.registerId]));
  const ranked = risks.filter((risk) => risk.polarity === 'negative').sort((a, b) => b.expectedAnnual - a.expectedAnnual || (a.riskId < b.riskId ? -1 : 1));
  const next = new Map<string, number>();
  return new Map(
    ranked.map((risk) => {
      const register = registerOf.get(risk.riskId) ?? '';
      const rank = (next.get(register) ?? 0) + 1;
      next.set(register, rank);
      return [risk.riskId, rank];
    }),
  );
}

// SP 800-30r1 Table G-3 likelihood bands and impact bands as a share of capacity (Sec. 8.13).
const LEVELS = ['Very low', 'Low', 'Moderate', 'High', 'Very high'] as const;
const likelihoodBand = (p: number): number => (p < 0.05 ? 0 : p <= 0.2 ? 1 : p < 0.8 ? 2 : p <= 0.95 ? 3 : 4);
const impactBand = (share: number): number => (share < 0.01 ? 0 : share < 0.05 ? 1 : share < 0.2 ? 2 : share < 0.5 ? 3 : 4);
// SP 800-30r1 Table I-2, rows from very low to very high likelihood, columns by impact.
const LEVEL_OF: readonly (readonly number[])[] = [
  [0, 0, 0, 1, 1],
  [0, 1, 1, 1, 2],
  [0, 1, 2, 2, 3],
  [0, 1, 2, 3, 4],
  [0, 1, 2, 3, 4],
];
const LEVEL_CLASS = ['level-vl', 'level-l', 'level-m', 'level-h', 'level-vh'] as const;

function Matrix({ doc, capacity, flagged }: { readonly doc: RiskDocument; readonly capacity: number | undefined; readonly flagged: ReadonlySet<string> }) {
  if (capacity === undefined || capacity <= 0)
    return <p class="muted">Set the capacity on the screen Context and strategy to show the matrix. Its impact bands are shares of the capacity.</p>;
  const cell = (polarity: Risk['polarity'], l: number, i: number): Risk[] =>
    doc.risks.filter(
      (risk) =>
        risk.polarity === polarity &&
        risk.onlyWithResponse === undefined &&
        numbersSource(doc, risk) !== 'placeholder' &&
        likelihoodBand(risk.riskLikelihood) === l &&
        impactBand(risk.riskImpact / capacity) === i,
    );
  const impacts = [0, 1, 2, 3, 4];
  const renderCell = (polarity: Risk['polarity'], l: number, i: number) => {
    const level = LEVEL_OF[l]?.[i] ?? 0;
    return (
      <td key={`${polarity}-${String(i)}`} class={`cell ${LEVEL_CLASS[level] ?? 'level-vl'}`}>
        <span class="level">{LEVELS[level]}</span>
        {cell(polarity, l, i).map((risk) => (
          <span key={risk.riskId} class="cell-risk">
            {risk.riskId}
            {flagged.has(risk.riskId) && (
              <>
                <span aria-hidden="true">!</span>
                <span class="visually-hidden"> (lint)</span>
              </>
            )}{' '}
          </span>
        ))}
      </td>
    );
  };
  return (
    <div class="table-box" tabIndex={0} role="region" aria-label="Two-sided matrix">
      <table class="matrix">
        <caption>Table 3. Two-sided matrix. Display only. Ranking and funding use the simulation (Cox 2008).</caption>
        <thead>
          <tr>
            <th scope="col" rowSpan={2}>
              Likelihood
            </th>
            <th scope="colgroup" colSpan={5}>
              Negative risks, impact
            </th>
            <th scope="colgroup" colSpan={5}>
              Positive risks, impact
            </th>
          </tr>
          <tr>
            {[...impacts].reverse().map((i) => (
              <th scope="col" key={`n${String(i)}`}>
                {LEVELS[i]}
              </th>
            ))}
            {impacts.map((i) => (
              <th scope="col" key={`p${String(i)}`}>
                {LEVELS[i]}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {[4, 3, 2, 1, 0].map((l) => (
            <tr key={l}>
              <th scope="row">{LEVELS[l]}</th>
              {[...impacts].reverse().map((i) => renderCell('negative', l, i))}
              {impacts.map((i) => renderCell('positive', l, i))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function OverrideEditor({ risk, proposed, update }: { readonly risk: Risk; readonly proposed: number | undefined; readonly update: Update }) {
  const id = `override-${risk.riskId}`;
  const override = risk.priorityOverride;
  const set = (next: Override | undefined): void => {
    update((current) => ({
      ...current,
      risks: current.risks.map((item) => (item.riskId === risk.riskId ? withValue(item, 'priorityOverride', next) : item)),
    }));
  };
  if (override === undefined) {
    return (
      <button
        type="button"
        class="quiet"
        onClick={() => {
          set({
            priority: proposed ?? risk.priority ?? 1,
            setBy: '',
            setOn: today(),
            reason: '',
          });
        }}
      >
        Override the priority of {risk.riskId}
      </button>
    );
  }
  return (
    <fieldset class="sub-editor override">
      <legend>Priority override of {risk.riskId}</legend>
      <div class="field-row">
        <div class="field">
          <NumberField
            id={`${id}-priority`}
            label="Priority"
            help="prioritize.override-priority"
            integer
            min={1}
            value={override.priority}
            onChange={(priority) => {
              if (priority !== undefined) set({ ...override, priority });
            }}
          />
        </div>
        <div class="field">
          <TextField
            id={`${id}-by`}
            label="Set by"
            help="prioritize.override-set-by"
            value={override.setBy}
            onChange={(setBy) => {
              set({ ...override, setBy });
            }}
          />
        </div>
        <div class="field">
          <TextField
            id={`${id}-on`}
            label="Set on"
            help="prioritize.override-set-on"
            type="date"
            value={override.setOn}
            onChange={(setOn) => {
              set({ ...override, setOn });
            }}
          />
        </div>
      </div>
      <TextField
        id={`${id}-reason`}
        label="Reason"
        help="prioritize.override-reason"
        value={override.reason}
        onChange={(reason) => {
          set({ ...override, reason });
        }}
      />
      <Checkboxes
        legend="Factors"
        help="prioritize.override-factors"
        name={`${id}-factors`}
        options={FACTORS}
        value={override.factors ?? []}
        onChange={(factors) => {
          set(withValue(override, 'factors', factors.length === 0 ? undefined : factors));
        }}
      />
      <button
        type="button"
        class="quiet"
        onClick={() => {
          set(undefined);
        }}
      >
        Remove the override of {risk.riskId}
      </button>
    </fieldset>
  );
}

function RiskTables({ doc, update, numbers }: { readonly doc: RiskDocument; readonly update: Update; readonly numbers: PriorityNumbers }) {
  const currency = doc.document.currency;
  const stats = new Map(numbers.state.risks.map((risk) => [risk.riskId, risk]));
  const proposed = proposedPriorities(doc, numbers.state.risks);
  const tree = new Map(registerTree(doc.registers).map((item, i) => [item.register.id, i]));
  const threshold = doc.strategy?.inclusionThreshold;
  const titleOf = new Map(doc.registers.map((register) => [register.id, register.title]));
  const negative = doc.risks.filter((risk) => risk.polarity === 'negative' && risk.onlyWithResponse === undefined);
  const ordered = [...negative].sort(
    (a, b) =>
      (tree.get(a.registerId) ?? 0) - (tree.get(b.registerId) ?? 0) ||
      (proposed.get(a.riskId) ?? Infinity) - (proposed.get(b.riskId) ?? Infinity) ||
      (a.riskId < b.riskId ? -1 : 1),
  );
  const positive = doc.risks.filter((risk) => risk.polarity === 'positive' && risk.onlyWithResponse === undefined);
  const differs = ordered.some((risk) => proposed.has(risk.riskId) && risk.priority !== proposed.get(risk.riskId));
  const months = (risk: Risk): number => doc.registers.find((register) => register.id === risk.registerId)?.timeframeMonths ?? 12;
  return (
    <>
      <Section id="ranking" title="Risks by expected annual loss" help="prioritize.ranking">
        <p class="hint">
          The app proposes priorities from the expected annual loss, highest first, within each register. The contribution is the share of the loss in the
          worst 5% of years. A risk alone against the tolerance curve shows if it breaches the curve by itself.
        </p>
        <div class="button-row">
          <button
            type="button"
            disabled={!differs}
            onClick={() => {
              update((current) => ({
                ...current,
                risks: current.risks.map((risk) => (proposed.has(risk.riskId) ? { ...risk, priority: proposed.get(risk.riskId) as number } : risk)),
              }));
            }}
          >
            Use the proposed priorities
          </button>
          {!differs && <span class="hint">The priorities are equal to the proposal.</span>}
          <Explain id="use-proposed" topic="prioritize.use-proposed" name="Use the proposed priorities" />
        </div>
        <Explain id="ranking-table" topic="prioritize.ranking-table" name="the columns of the table of risks" visible="How to read this table" />
        <div class="table-box" tabIndex={0} role="region" aria-labelledby="ranking-title">
          <table>
            <caption>Table 2. Negative risks, simulated with seed {numbers.seed}.</caption>
            <thead>
              <tr>
                <th scope="col">Proposed</th>
                <th scope="col">Priority</th>
                <th scope="col">ID</th>
                <th scope="col">Description</th>
                <th scope="col">Register</th>
                <th scope="col">Expected annual loss ({currency})</th>
                <th scope="col">P(at least one event)</th>
                <th scope="col">Tail contribution</th>
                <th scope="col">Alone against the curve</th>
              </tr>
            </thead>
            <tbody>
              {ordered.map((risk) => {
                const row = stats.get(risk.riskId);
                const below = threshold !== undefined && numbersSource(doc, risk) !== 'placeholder' && risk.exposureRating < threshold;
                return (
                  <tr key={risk.riskId}>
                    <td>{proposed.get(risk.riskId) ?? <span class="muted">Needs an estimate</span>}</td>
                    <td>
                      {risk.priorityOverride?.priority ?? risk.priority ?? <span class="muted">None</span>}
                      {risk.priorityOverride !== undefined && <span class="sub">Override</span>}
                    </td>
                    <td class="id">{risk.riskId}</td>
                    <td>
                      {risk.riskDescription}
                      {below && <span class="sub">Below threshold</span>}
                    </td>
                    <td>{titleOf.get(risk.registerId) ?? risk.registerId}</td>
                    <td>{row === undefined ? <span class="muted">Not estimated</span> : `${money(row.expectedAnnual)} ± ${money(row.expectedAnnualSe)}`}</td>
                    <td>{row === undefined ? '' : `${probability(row.probability)} in ${String(months(risk))} months`}</td>
                    <td>{row === undefined ? '' : percent(numbers.contributions[risk.riskId] ?? 0)}</td>
                    <td>{row === undefined ? '' : <StatusText status={row.status} />}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <details class="help">
          <summary>Override a priority</summary>
          <p class="hint">Leadership can set a priority with a reason and the factors below. The decision record lists every override.</p>
          <Explain id="override" topic="prioritize.override" name="Override a priority" />
          {ordered.map((risk) => (
            <OverrideEditor key={risk.riskId} risk={risk} proposed={proposed.get(risk.riskId)} update={update} />
          ))}
        </details>
      </Section>

      {positive.length > 0 && (
        <Section id="opportunities" title="Opportunities by expected annual gain" help="prioritize.opportunities">
          <p class="hint">Positive risks never enter the loss curve. Their gain counts in the net benefit of a portfolio.</p>
          <div class="table-box" tabIndex={0} role="region" aria-labelledby="opportunities-title">
            <table>
              <thead>
                <tr>
                  <th scope="col">ID</th>
                  <th scope="col">Description</th>
                  <th scope="col">Expected annual gain ({currency})</th>
                  <th scope="col">P(at least one realization)</th>
                  <th scope="col">P(not realized)</th>
                </tr>
              </thead>
              <tbody>
                {positive.map((risk) => {
                  const row = stats.get(risk.riskId);
                  return (
                    <tr key={risk.riskId}>
                      <td class="id">{risk.riskId}</td>
                      <td>{risk.riskDescription}</td>
                      <td>{row === undefined ? <span class="muted">Not estimated</span> : `${money(row.expectedAnnual)} ± ${money(row.expectedAnnualSe)}`}</td>
                      <td>{row === undefined ? '' : probability(row.probability)}</td>
                      <td>{row === undefined ? '' : probability(1 - row.probability)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Section>
      )}
    </>
  );
}

function PrioritizeBody({ doc, update }: { readonly doc: RiskDocument; readonly update: Update }) {
  const key = simulationKey(doc);
  const job = useEngine(
    key,
    () =>
      ({
        kind: 'prioritize',
        doc,
        trials: doc.simulation?.trials ?? 100_000,
        seed: doc.simulation?.seed ?? 0,
      }) as const,
  );
  const numbers = job.result;
  const currency = doc.document.currency;
  const capacity = doc.appetite?.capacity?.amount;
  const points = doc.appetite?.toleranceCurve?.points ?? [];
  if (key === undefined) {
    return (
      <>
        <section class="panel">
          <p>No risk has an estimate yet. Add a frequency and an impact range to a risk on the screen Identify and analyze. Matrices alone cannot rank risks (Cox 2008).</p>
        </section>
        <ErrView doc={doc} number={1} />
      </>
    );
  }
  const expectedAnnual = new Map((numbers?.state.risks ?? []).map((risk) => [risk.riskId, risk.expectedAnnual]));
  const findings = numbers === undefined ? [] : lint(doc, { expectedAnnual }).filter((finding) => finding.rule === 'L-01' || finding.rule === 'L-03');
  const flagged = new Set(findings.flatMap((finding) => finding.riskIds ?? []));
  const titleOf = new Map(doc.registers.map((register) => [register.id, register.title]));
  // A single root register has the curve of the roll-up, so only the other registers get a line.
  const roots = doc.registers.filter((register) => register.parentRegisterId === undefined);
  const curves = (numbers?.registers ?? []).filter((register) => !(roots.length === 1 && register.registerId === roots[0]?.id));
  return (
    <>
      <p role="status" class="muted">
        {job.running
          ? 'The simulation runs.'
          : job.error !== undefined
            ? `The simulation failed. ${job.error}`
            : numbers === undefined
              ? ''
              : `Simulated with ${numbers.trials.toLocaleString('en')} trials.`}
      </p>
      {numbers !== undefined && (
        <>
          <Section id="lec" title="Loss exceedance" help="prioritize.lec">
            <p>
              Roll-up of all registers: <StatusText status={points.length === 0 ? undefined : numbers.state.status} />. Expected annual loss {money(numbers.state.eal)} ±{' '}
              {money(numbers.state.ealSe)} {currency}.{numbers.state.pAboveCapacity !== undefined && <> P(loss above capacity) {probability(numbers.state.pAboveCapacity)}.</>}
              {points.length > 0 && <> Tolerance gap {probability(numbers.state.gap)}.</>}
            </p>
            <LecChart
              id="lec-s4"
              number={1}
              title="Loss exceedance of the roll-up and of each register, against the tolerance curve"
              series={[
                { name: 'All registers', points: numbers.state.lec },
                ...curves.map((register) => ({
                  name: titleOf.get(register.registerId) ?? register.registerId,
                  points: register.lec,
                })),
              ]}
              points={points}
              capacity={capacity}
              currency={currency}
              source={sourceLine(numbers)}
            />
            <Explain id="lec-chart" topic="prioritize.lec-chart" name="the loss exceedance chart" visible="How to read this chart" />
            <More id="percentiles" label="Percentiles of the annual loss (optional)">
              <Explain id="percentiles" topic="prioritize.percentiles" name="the percentiles" visible="How to read the percentiles" />
              <div class="table-box" tabIndex={0} role="region" aria-label="Percentiles">
                <table>
                  <caption>Table 1. Percentiles of the annual loss of the roll-up ({currency}).</caption>
                  <thead>
                    <tr>
                      {numbers.state.percentiles.map((item) => (
                        <th scope="col" key={item.q}>
                          P{String(Math.round(item.q * 1000) / 10)}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      {numbers.state.percentiles.map((item) => (
                        <td key={item.q}>{short(item.loss)}</td>
                      ))}
                    </tr>
                  </tbody>
                </table>
              </div>
            </More>
            {numbers.registers.length > 1 && (
              <ul class="register-status">
                {numbers.registers.map((register) => (
                  <li key={register.registerId}>
                    {titleOf.get(register.registerId) ?? register.registerId}: expected annual loss {money(register.eal)} {currency}, <StatusText status={register.status} />
                  </li>
                ))}
              </ul>
            )}
            {numbers.clippedShare > 0.05 && <p class="banner">{percent(numbers.clippedShare)} of the trials have a clipped rate (lint L-08). Check the widest frequency ranges.</p>}
            <NotAcceptableEvents doc={doc} />
          </Section>
          <RiskTables doc={doc} update={update} numbers={numbers} />
          <Section id="matrix" title="Matrix, display only" folded help="prioritize.matrix">
            <p class="hint">
              Users and auditors expect a matrix, so the app shows it. A matrix can rank a smaller risk above a larger one (Cox 2008). A mark ! shows a pair that lint L-01 or L-03
              finds.
            </p>
            <Explain id="matrix-table" topic="prioritize.matrix-table" name="the matrix" visible="How to read the matrix" />
            <Matrix doc={doc} capacity={capacity} flagged={flagged} />
            {findings.length > 0 && (
              <ul class="warnings">
                {findings.map((finding, i) => (
                  <li key={i}>
                    {finding.rule} {finding.message}
                  </li>
                ))}
              </ul>
            )}
          </Section>
        </>
      )}
      <ErrView doc={doc} number={4} />
    </>
  );
}

// Decision O4 of docs/release-2/appetite-questions.md. An event that the management body does
// not accept can have a loss that the curve accepts. An event has no link to a risk, so the app
// cannot check this. It lists the events and points to the tolerance what-if of S6.
function NotAcceptableEvents({ doc }: { readonly doc: RiskDocument }) {
  const elicitation = doc.appetite?.elicitation;
  const events = (elicitation?.criteria ?? []).filter((item) => item.answer === 'not-acceptable');
  if (elicitation === undefined || events.length === 0) return null;
  return (
    <details class="help">
      <summary>Events that the management body does not accept</summary>
      <p class="hint">
        The management body marked these events "Not acceptable" in the guided questions of {elicitation.heldOn}. The tolerance curve can still accept the loss of such an event. Find the annual
        loss of each event on the chart. If the curve accepts that loss, change the curve with the tolerance what-if on the screen Monitor and adjust.
      </p>
      <ul class="cell-list">
        {events.map((item, i) => (
          <li key={i}>{item.event}</li>
        ))}
      </ul>
    </details>
  );
}

export function PrioritizeScreen({ id, onNavigate }: { readonly id: string; readonly onNavigate: (screen: ScreenName) => void }) {
  return (
    <DocumentScreen
      id={id}
      screen="prioritize"
      title="Prioritize"
      lede="Compare the risks with the simulation and the tolerance curve, and set the priorities."
      onNavigate={onNavigate}
    >
      {(doc, update) => <PrioritizeBody doc={doc} update={update} />}
    </DocumentScreen>
  );
}
