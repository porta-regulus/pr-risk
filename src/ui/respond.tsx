// Screen S5 Respond and optimize (SPEC.md Sec. 5, 6.10, 8.10 to 8.12). Response options with
// costs, effects, control types and forced choices, the budget, the ranked portfolios with the
// fiscal baseline and the budget sensitivity, and the decision record to print.
import { useMemo, useState } from 'preact/hooks';
import { documentHash } from '../engine/decision';
import { documentErrors } from '../schema/document';
import type { ResponseOption, RiskDocument } from '../schema/types';
import { DistributionField, formatNumber } from './distribution';
import { nextId, withSection, withValue } from './edit';
import { DocumentScreen, type ScreenName, type Update } from './editor';
import { Checkboxes, LinesField, NumberField, SelectField, TextField } from './fields';
import { useEngine } from './jobs';
import { AcceptanceEditor } from './acceptance';
import { DecisionRecordView, residualRisks } from './record';
import { money, StatusText } from './report';

type Effect = ResponseOption['effects'][number];

const RESPONSE_TYPES: readonly (readonly [ResponseOption['responseType'], string])[] = [
  ['Mitigate', 'Mitigate (negative risk)'],
  ['Transfer', 'Transfer, for example insurance (negative risk)'],
  ['Avoid', 'Avoid (negative risk)'],
  ['Accept', 'Accept'],
  ['Realize', 'Realize (positive risk)'],
  ['Share', 'Share (positive risk)'],
  ['Enhance', 'Enhance (positive risk)'],
];
const STATUSES: readonly (readonly [ResponseOption['status'], string])[] = [
  ['candidate', 'Candidate'],
  ['selected', 'Selected'],
  ['rejected', 'Rejected'],
  ['implemented', 'Implemented'],
];
const CONTROL_TYPES: readonly (readonly [NonNullable<ResponseOption['controlTypes']>[number], string])[] = [
  ['preventative', 'Preventative'],
  ['deterrent', 'Deterrent'],
  ['detective', 'Detective'],
  ['corrective', 'Corrective'],
  ['compensating', 'Compensating'],
];

const replaceAt = <T,>(items: readonly T[], index: number, item: T | undefined): T[] =>
  item === undefined ? items.filter((_, i) => i !== index) : items.map((old, i) => (i === index ? item : old));

const describe = (value: Effect['frequency']): string => {
  if (value === undefined) return 'not set';
  if (value.type === 'constant') return value.value === undefined ? 'not set' : formatNumber(value.value, 3);
  if (value.type === 'pert') return `${formatNumber(value.min ?? NaN, 3)}, ${formatNumber(value.mode ?? NaN, 3)}, ${formatNumber(value.max ?? NaN, 3)}`;
  return `${formatNumber(value.lower ?? NaN, 3)} to ${formatNumber(value.upper ?? NaN, 3)}`;
};

function EffectEditor({
  doc,
  effect,
  id,
  onChange,
  onRemove,
}: {
  readonly doc: RiskDocument;
  readonly effect: Effect;
  readonly id: string;
  readonly onChange: (effect: Effect) => void;
  readonly onRemove: (() => void) | undefined;
}) {
  const currency = doc.document.currency;
  const targets = [
    ...doc.risks.filter((risk) => risk.estimate !== undefined).map((risk) => [`risk|${risk.riskId}`, `Risk ${risk.riskId} ${risk.riskDescription}`] as const),
    ...(doc.drivers ?? []).map((driver) => [`driver|${driver.id}`, `Driver ${driver.id} ${driver.name}`] as const),
  ];
  const risk = effect.targetKind === 'risk' ? doc.risks.find((item) => item.riskId === effect.targetId) : undefined;
  const driver = effect.targetKind === 'driver' ? (doc.drivers ?? []).find((item) => item.id === effect.targetId) : undefined;
  const word = risk?.polarity === 'positive' ? 'gain' : 'loss';
  return (
    <div class="sub-editor">
      <SelectField
        id={`${id}-target`}
        label="Target"
        value={`${effect.targetKind}|${effect.targetId}`}
        options={targets}
        onChange={(value) => {
          const [kind, target] = (value ?? '').split('|');
          if ((kind === 'risk' || kind === 'driver') && target !== undefined)
            onChange({
              targetKind: kind,
              targetId: target,
              rationale: effect.rationale,
            });
        }}
      />
      <p class="hint">
        Now: frequency {describe(risk?.estimate?.frequency ?? driver?.frequency)} events per year
        {risk !== undefined && `, ${word} per event ${describe(risk.estimate?.impactPerEvent)} ${currency}`}. An effect gives the estimate after the response (Sec. 8.10).
      </p>
      <label class="check">
        <input
          type="checkbox"
          checked={effect.frequency !== undefined}
          onChange={(event) => {
            onChange(withValue(effect, 'frequency', event.currentTarget.checked ? { type: 'lognormal', confidence: 0.9 } : undefined));
          }}
        />
        The response changes the frequency
      </label>
      {effect.frequency !== undefined && (
        <DistributionField
          id={`${id}-frequency`}
          legend="Frequency after the response"
          question="How many events per year with the response in place? Give a range you are 90% sure of."
          unit="events per year"
          frequency
          value={effect.frequency}
          onChange={(frequency) => {
            onChange({ ...effect, frequency });
          }}
        />
      )}
      {effect.targetKind === 'risk' && (
        <label class="check">
          <input
            type="checkbox"
            checked={effect.impactPerEvent !== undefined}
            onChange={(event) => {
              onChange(withValue(effect, 'impactPerEvent', event.currentTarget.checked ? { type: 'lognormal', confidence: 0.9 } : undefined));
            }}
          />
          The response changes the {word} per event
        </label>
      )}
      {effect.impactPerEvent !== undefined && (
        <DistributionField
          id={`${id}-impact`}
          legend={`${word === 'gain' ? 'Gain' : 'Loss'} per event after the response`}
          question="For insurance, give the retained loss after deductible and limit. Give a range you are 90% sure of."
          unit={currency}
          value={effect.impactPerEvent}
          onChange={(impactPerEvent) => {
            onChange({ ...effect, impactPerEvent });
          }}
        />
      )}
      <TextField
        id={`${id}-rationale`}
        label="Rationale of the effect (10 characters or more)"
        value={effect.rationale}
        onChange={(rationale) => {
          onChange({ ...effect, rationale });
        }}
      />
      {onRemove !== undefined && (
        <button type="button" class="quiet" onClick={onRemove}>
          Remove this effect
        </button>
      )}
    </div>
  );
}

export function OptionEditor({ doc, option, update }: { readonly doc: RiskDocument; readonly option: ResponseOption; readonly update: Update }) {
  const currency = doc.document.currency;
  const id = `option-${option.id}`;
  const set = (change: (option: ResponseOption) => ResponseOption): void => {
    update((current) => ({
      ...current,
      responses: (current.responses ?? []).map((item) => (item.id === option.id ? change(item) : item)),
    }));
  };
  // A new option opens once. After that the user opens and closes it, so typing the title
  // does not close the form.
  const [startsOpen] = useState(option.title === '');
  const costs = option.costs as Partial<ResponseOption['costs']>;
  const setCost = (key: keyof ResponseOption['costs'], value: number | undefined): void => {
    set((current) => ({
      ...current,
      costs: withValue(current.costs as Partial<ResponseOption['costs']>, key, value) as ResponseOption['costs'],
    }));
  };
  const others = (doc.responses ?? []).filter((item) => item.id !== option.id);
  const usedBy = others.filter((item) => (item.bundleOf ?? []).includes(option.id)).map((item) => item.id);
  const introducible = doc.risks.filter((risk) => risk.onlyWithResponse === undefined || risk.onlyWithResponse === option.id);
  return (
    <details class="editor" open={startsOpen}>
      <summary>
        {option.id} {option.title || 'New option'}, {option.status}, first-year cash {money((costs.oneOff ?? 0) + (costs.annual ?? 0) + (costs.reserveAmount ?? 0))} {currency}
      </summary>
      <div class="field-row">
        <div class="field wide">
          <TextField
            id={`${id}-title`}
            label="Title"
            value={option.title}
            onChange={(title) => {
              set((current) => ({ ...current, title }));
            }}
          />
        </div>
        <div class="field">
          <SelectField
            id={`${id}-type`}
            label="Response type"
            hint="Table 4 for negative risks, Table 5 for positive risks."
            value={option.responseType}
            options={RESPONSE_TYPES}
            onChange={(responseType) => {
              set((current) => ({
                ...current,
                responseType: responseType ?? 'Mitigate',
              }));
            }}
          />
        </div>
        <div class="field">
          <SelectField
            id={`${id}-status`}
            label="Status"
            hint="Only candidates and selected options compete for the budget."
            value={option.status}
            options={STATUSES}
            onChange={(status) => {
              set((current) => ({ ...current, status: status ?? 'candidate' }));
            }}
          />
        </div>
        <div class="field">
          <TextField
            id={`${id}-owner`}
            label="Owner"
            value={option.owner}
            onChange={(owner) => {
              set((current) => withValue(current, 'owner', owner));
            }}
          />
        </div>
      </div>
      <TextField
        id={`${id}-description`}
        label="Description"
        multiline
        value={option.description}
        onChange={(description) => {
          set((current) => withValue(current, 'description', description));
        }}
      />
      <fieldset class="distribution">
        <legend>Costs (Table 3 risk response cost)</legend>
        <div class="field-row">
          <div class="field">
            <NumberField
              id={`${id}-oneoff`}
              label={`One-off cost (${currency})`}
              min={0}
              value={costs.oneOff}
              onChange={(value) => {
                setCost('oneOff', value);
              }}
            />
          </div>
          <div class="field">
            <NumberField
              id={`${id}-annual`}
              label={`Annual cost (${currency})`}
              min={0}
              value={costs.annual}
              onChange={(value) => {
                setCost('annual', value);
              }}
            />
          </div>
          <div class="field">
            <NumberField
              id={`${id}-lifetime`}
              label="Lifetime (years, up to 20)"
              min={0}
              max={20}
              value={costs.lifetimeYears}
              onChange={(value) => {
                setCost('lifetimeYears', value);
              }}
            />
          </div>
          <div class="field">
            <NumberField
              id={`${id}-reserve`}
              label={`Risk reserve (${currency})`}
              hint="Set aside in year 1, released if no target event occurs."
              min={0}
              value={costs.reserveAmount}
              onChange={(value) => {
                setCost('reserveAmount', value);
              }}
            />
          </div>
        </div>
      </fieldset>
      <fieldset class="distribution">
        <legend>Effects</legend>
        {option.effects.map((effect, i) => (
          <EffectEditor
            key={i}
            doc={doc}
            id={`${id}-effect${String(i)}`}
            effect={effect}
            onChange={(next) => {
              set((current) => ({
                ...current,
                effects: replaceAt(current.effects, i, next) as ResponseOption['effects'],
              }));
            }}
            onRemove={
              option.effects.length > 1
                ? () => {
                    set((current) => ({
                      ...current,
                      effects: replaceAt(current.effects, i, undefined) as ResponseOption['effects'],
                    }));
                  }
                : undefined
            }
          />
        ))}
        <button
          type="button"
          class="quiet"
          onClick={() => {
            // The effects list is never empty, so the first effect gives the target of the new one.
            const first = option.effects[0];
            set((current) => ({
              ...current,
              effects: [
                ...current.effects,
                {
                  targetKind: first.targetKind,
                  targetId: first.targetId,
                  rationale: '',
                },
              ],
            }));
          }}
        >
          Add an effect
        </button>
        <p class="hint">
          Two options that change the same target are alternatives. A portfolio never holds both. To combine them, add a bundle option that states the combined effect (Sec. 8.10).
        </p>
      </fieldset>
      <Checkboxes
        legend="Control types (Sec. 3.6)"
        name={`${id}-controls`}
        options={CONTROL_TYPES}
        value={option.controlTypes ?? []}
        onChange={(value) => {
          set((current) => withValue(current, 'controlTypes', value.length === 0 ? undefined : value));
        }}
      />
      <LinesField
        id={`${id}-references`}
        label="Informative references, one per line, for example CSF 2.0 PR.AA-03"
        value={option.informativeReferences ?? []}
        onChange={(value) => {
          set((current) => withValue(current, 'informativeReferences', value.length === 0 ? undefined : value));
        }}
      />
      {others.length > 0 && (
        <Checkboxes
          legend="Bundle of these options"
          name={`${id}-bundle`}
          options={others.map((item) => [item.id, `${item.id} ${item.title}`] as const)}
          value={option.bundleOf ?? []}
          onChange={(value) => {
            set((current) => withValue(current, 'bundleOf', value.length === 0 ? undefined : value));
          }}
        />
      )}
      {introducible.length > 0 && (
        <details class="help">
          <summary>Risks that this option introduces ({(option.introducesRisks ?? []).length})</summary>
          <Checkboxes
            legend="Risks that this option introduces (Sec. 3.6). Such a risk enters the simulation only with this option."
            name={`${id}-introduces`}
            options={introducible.map((risk) => [risk.riskId, `${risk.riskId} ${risk.riskDescription}`] as const)}
            value={option.introducesRisks ?? []}
            onChange={(value) => {
              update((current) => ({
                ...current,
                responses: (current.responses ?? []).map((item) => (item.id === option.id ? withValue(item, 'introducesRisks', value.length === 0 ? undefined : value) : item)),
                risks: current.risks.map((risk) =>
                  value.includes(risk.riskId)
                    ? { ...risk, onlyWithResponse: option.id }
                    : risk.onlyWithResponse === option.id
                      ? withValue(risk, 'onlyWithResponse', undefined)
                      : risk,
                ),
              }));
            }}
          />
        </details>
      )}
      <fieldset class="distribution">
        <legend>Forced choice (Sec. 5.3.2 operational method)</legend>
        <SelectField
          id={`${id}-forced`}
          label="Leadership choice"
          emptyLabel="None, the optimization decides"
          value={option.forced?.action}
          options={[
            ['require', 'Require. Always fund it.'],
            ['exclude', 'Exclude. Never fund it.'],
          ]}
          onChange={(action) => {
            set((current) =>
              withValue(
                current,
                'forced',
                action === undefined
                  ? undefined
                  : {
                      action,
                      reason: current.forced?.reason ?? '',
                      by: current.forced?.by ?? '',
                    },
              ),
            );
          }}
        />
        {option.forced !== undefined && (
          <div class="field-row">
            <div class="field wide">
              <TextField
                id={`${id}-forced-reason`}
                label="Reason"
                value={option.forced.reason}
                onChange={(reason) => {
                  set((current) => (current.forced === undefined ? current : { ...current, forced: { ...current.forced, reason } }));
                }}
              />
            </div>
            <div class="field">
              <TextField
                id={`${id}-forced-by`}
                label="Decided by"
                value={option.forced.by}
                onChange={(by) => {
                  set((current) => (current.forced === undefined ? current : { ...current, forced: { ...current.forced, by } }));
                }}
              />
            </div>
          </div>
        )}
      </fieldset>
      <button
        type="button"
        class="danger"
        disabled={usedBy.length > 0 || (option.introducesRisks ?? []).length > 0}
        onClick={() => {
          update((current) =>
            withValue(
              current,
              'responses',
              (current.responses ?? []).filter((item) => item.id !== option.id),
            ),
          );
        }}
      >
        Remove option {option.id}
      </button>
      {(usedBy.length > 0 || (option.introducesRisks ?? []).length > 0) && <span class="hint">A bundle or an introduced risk uses this option, so it cannot be removed.</span>}
    </details>
  );
}

export type PortfolioRun = ReturnType<typeof usePortfolioRun>;

// The optimization run of S5 and of guided step 8. The run starts only on a click, and a
// document that changed after the run makes the record stale.
export function usePortfolioRun(doc: RiskDocument, blocked: boolean) {
  const options = doc.responses ?? [];
  const budget = doc.strategy?.budget?.firstYearCash;
  const [run, setRun] = useState(0);
  const [active, setActive] = useState(false);
  const runKey = active ? `run-${String(run)}` : undefined;
  const job = useEngine(
    runKey,
    () =>
      ({
        kind: 'decision',
        doc,
        budget: budget ?? 0,
        seed: doc.simulation?.seed ?? 0,
      }) as const,
    0,
  );
  const record = job.result;
  const hash = useMemo(() => (record === undefined ? undefined : documentHash(doc)), [doc, record]);
  const stale = record !== undefined && hash !== record.hash;
  // A draft that cannot be saved never gives a record. Missing costs would reach the engine as
  // NaN, and an empty acceptance would look complete.
  const valid = useMemo(() => documentErrors(doc).length === 0, [doc]);
  const ready = valid && !blocked;
  const canRun = ready && budget !== undefined && doc.simulation !== undefined && options.some((option) => option.status === 'candidate' || option.status === 'selected');
  return {
    job,
    record,
    stale,
    ready,
    canRun,
    start: (): void => {
      setRun((value) => value + 1);
      setActive(true);
    },
    cancel: (): void => {
      setActive(false);
    },
  };
}

export function setBudgetCash(update: Update, value: number | undefined): void {
  update((current) => withSection(current, 'strategy', withValue(current.strategy, 'budget', withValue(current.strategy?.budget ?? {}, 'firstYearCash', value))));
}

// A new empty option that acts on the first estimated risk, or on the first driver. The costs
// and the effect come from the user. Undefined when nothing can be a target yet.
export function newResponseOption(doc: RiskDocument): ResponseOption | undefined {
  const options = doc.responses ?? [];
  const firstTarget = doc.risks.find((risk) => risk.estimate !== undefined);
  const driver = (doc.drivers ?? [])[0];
  if (firstTarget === undefined && driver === undefined) return undefined;
  const target: Effect = firstTarget !== undefined ? { targetKind: 'risk', targetId: firstTarget.riskId, rationale: '' } : { targetKind: 'driver', targetId: driver?.id ?? '', rationale: '' };
  return {
    id: nextId(
      'O-',
      options.map((item) => item.id),
    ),
    title: '',
    responseType: 'Mitigate',
    status: 'candidate',
    costs: {},
    effects: [target],
  } as unknown as ResponseOption;
}

// print is false where the decision record is not on the page, so a print would be empty.
export function RunButtons({ run, print = true }: { readonly run: PortfolioRun; readonly print?: boolean }) {
  const { job, record, stale, ready, canRun } = run;
  return (
    <>
      <div class="button-row">
        <button type="button" disabled={!canRun || job.running} onClick={run.start}>
          Find the best portfolio
        </button>
        {job.running && (
          <button type="button" class="quiet" onClick={run.cancel}>
            Cancel the run
          </button>
        )}
        {print && record !== undefined && !job.running && (
          <button
            type="button"
            disabled={stale || !ready}
            onClick={() => {
              window.print();
            }}
          >
            Print the decision record
          </button>
        )}
      </div>
      {!ready && <p class="hint">Correct the errors in the save bar first. A run and a print use only a document that can be saved.</p>}
      {ready && !canRun && <p class="hint">A run needs a budget, at least one estimate and at least one candidate option.</p>}
      <p role="status" class={job.error === undefined ? 'muted' : 'save-error'}>
        {job.running
          ? `The optimization runs${job.progress === undefined ? '' : `, step ${String(job.progress[0])} of ${String(job.progress[1])}`}.`
          : job.error !== undefined
            ? `The run failed. ${job.error}`
            : stale && ready
              ? 'The document changed after the run. Run again before you print.'
              : ''}
      </p>
    </>
  );
}

export function RankedPortfolios({ record, currency }: { readonly record: NonNullable<PortfolioRun['record']>; readonly currency: string }) {
  return (
    <>
      <div class="table-box" tabIndex={0} role="region" aria-label="Ranked portfolios">
        <table>
          <caption>
            Best portfolio and alternatives at {record.trials.toLocaleString('en')} trials, seed {record.seed}. {record.count} portfolios ranked.
          </caption>
          <thead>
            <tr>
              <th scope="col">Portfolio</th>
              <th scope="col">Options</th>
              <th scope="col">First-year cash ({currency})</th>
              <th scope="col">Annualised cost</th>
              <th scope="col">Annual benefit</th>
              <th scope="col">Net benefit</th>
              <th scope="col">Tolerance</th>
            </tr>
          </thead>
          <tbody>
            {(
              [
                ['Best', record.best],
                ...record.alternatives.map((row, i) => [`Rank ${String(i + 2)}`, row] as const),
                ['Fiscal baseline', record.fiscal],
                [`Best at ${money(record.lower.budget)}`, record.lower.row],
                [`Best at ${money(record.upper.budget)}`, record.upper.row],
              ] as const
            ).map(([label, row]) => (
              <tr key={label}>
                <th scope="row">{label}</th>
                <td>{row.ids.length === 0 ? 'None' : row.ids.join(', ')}</td>
                <td>{money(row.cash)}</td>
                <td>{money(row.cost)}</td>
                <td>
                  {money(row.benefit)} ± {money(row.benefitSe)}
                </td>
                <td>{money(row.net)}</td>
                <td>
                  <StatusText status={row.status} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {record.notes.length > 0 && (
        <ul class="warnings">
          {record.notes.map((note) => (
            <li key={note}>{note}</li>
          ))}
        </ul>
      )}
    </>
  );
}

export function ResidualAcceptance({ doc, record, update }: { readonly doc: RiskDocument; readonly record: NonNullable<PortfolioRun['record']>; readonly update: Update }) {
  const residual = residualRisks(doc, record.best.ids);
  if (residual.length === 0) return null;
  return (
    <section aria-labelledby="residual-title" class="panel">
      <h2 id="residual-title">Accepted residual risk</h2>
      <p class="hint">Each risk that stays accepted needs an acceptance record before the decision record is final (Sec. 8.12 item 4).</p>
      {residual.map((risk) => (
        <div key={risk.riskId}>
          <p>
            <strong>{risk.riskId}</strong> {risk.riskDescription.replace(/\.$/, '')}. Owner {risk.riskOwnerPointOfContact}.
          </p>
          <AcceptanceEditor risk={risk} update={update} />
        </div>
      ))}
    </section>
  );
}

function RespondBody({ doc, update, blocked }: { readonly doc: RiskDocument; readonly update: Update; readonly blocked: boolean }) {
  const currency = doc.document.currency;
  const options = doc.responses ?? [];
  const budget = doc.strategy?.budget?.firstYearCash;
  const run = usePortfolioRun(doc, blocked);
  const { record, stale, ready } = run;
  const canAdd = newResponseOption(doc) !== undefined;
  return (
    <>
      <section aria-labelledby="budget-title" class="panel">
        <h2 id="budget-title">Budget and method</h2>
        <div class="field-row">
          <div class="field">
            <NumberField id="budget-cash" label={`Budget, first-year cash (${currency})`} min={0} value={budget} onChange={(value) => {
                setBudgetCash(update, value);
              }} />
          </div>
          <div class="field">
            <SelectField
              id="budget-method"
              label="Optimization method"
              value={doc.strategy?.optimizationMethod}
              emptyLabel="Not set"
              options={[
                ['algorithmic', 'Algorithmic'],
                ['fiscal', 'Fiscal'],
                ['operational', 'Operational'],
              ]}
              onChange={(method) => {
                update((current) => withSection(current, 'strategy', withValue(current.strategy, 'optimizationMethod', method)));
              }}
            />
          </div>
        </div>
        <p class="hint">
          The algorithmic method compares every affordable set of options. The record always shows the fiscal baseline next to it (Sec. 8.12). For the operational method, mark
          options as required or excluded.
        </p>
      </section>

      <section aria-labelledby="options-title" class="panel">
        <h2 id="options-title">Response options</h2>
        {options.length === 0 && <p class="muted">No response option yet.</p>}
        {options.map((option) => (
          <OptionEditor key={option.id} doc={doc} option={option} update={update} />
        ))}
        <button
          type="button"
          class="quiet"
          disabled={!canAdd}
          onClick={() => {
            update((current) => {
              const option = newResponseOption(current);
              return option === undefined ? current : withValue(current, 'responses', [...(current.responses ?? []), option]);
            });
          }}
        >
          Add a response option
        </button>
        {!canAdd && <span class="hint">A response option needs a risk with an estimate or a driver to act on.</span>}
      </section>

      <section aria-labelledby="run-title" class="panel">
        <h2 id="run-title">Ranked portfolios</h2>
        <RunButtons run={run} />
        {record !== undefined && <RankedPortfolios record={record} currency={currency} />}
      </section>

      {record !== undefined && <ResidualAcceptance doc={doc} record={record} update={update} />}

      {record !== undefined && !stale && ready && <DecisionRecordView doc={doc} record={record} />}
    </>
  );
}

export function RespondScreen({ id, onNavigate }: { readonly id: string; readonly onNavigate: (screen: ScreenName) => void }) {
  return (
    <DocumentScreen
      id={id}
      screen="respond"
      title="Respond and optimize"
      lede="Describe the response options, find the best portfolio within the budget, and print the decision record."
      onNavigate={onNavigate}
    >
      {(doc, update, status) => <RespondBody doc={doc} update={update} blocked={status.blocked} />}
    </DocumentScreen>
  );
}
