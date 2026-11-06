// The guided mode (docs/ux/redesign-plan.md Sec. 3.1 and 3.2). One task on each page, in the
// order of the AT-5 task. It edits the same document with the same edit functions as the full
// editor, so both modes stay equal. Saving, undo and the change log come from editor.tsx.
import { useEffect, useRef, useState } from 'preact/hooks';
import type { Risk, RiskDocument } from '../schema/types';
import { AppetiteSection } from './appetite';
import { CATALOGUE, CATALOGUE_GROUPS, fromCatalogue, RISKLET_ATTRIBUTION } from './catalogue';
import { DistributionField, formatNumber } from './distribution';
import { DriverPanel } from './drivers';
import { nextId, withSection, withValue } from './edit';
import { DocumentScreen, type ScreenName, type Update } from './editor';
import { Checkboxes, NumberField, SelectField, TextField } from './fields';
import { GuidedQuestions } from './guided-questions';
import { GUIDED_STEPS, guidedStatus, hasOwner, riskComplete } from './guided-steps';
import { newRisk, registerTree } from './identify';
import { DecisionRecordView } from './record';
import { newResponseOption, OptionEditor, RankedPortfolios, ResidualAcceptance, RunButtons, setBudgetCash, usePortfolioRun, type PortfolioRun } from './respond';

type Objective = NonNullable<NonNullable<RiskDocument['context']>['objectives']>[number];
type DriverLink = NonNullable<Risk['driverLinks']>[number];

const KINDS: readonly (readonly [Objective['kind'], string])[] = [
  ['strategic', 'Strategic'],
  ['operations', 'Operations'],
  ['reporting', 'Reporting'],
  ['compliance', 'Compliance'],
];

// Example goals, one of each kind. Words only, no numbers.
const EXAMPLE_GOALS: readonly (readonly [Objective['kind'], string])[] = [
  ['operations', 'Deliver every order on time.'],
  ['compliance', 'Keep customer data private.'],
  ['reporting', 'Report each significant incident on time.'],
  ['strategic', 'Grow sales in a new market this year.'],
];

// The step and the print mark of each document stay while the page is open.
const openStep = new Map<string, number>();
const printedDocs = new Set<string>();

const usedObjective = (doc: RiskDocument, id: string): boolean => doc.risks.some((risk) => (risk.objectiveIds ?? []).includes(id));
const usedRisk = (doc: RiskDocument, id: string): boolean => (doc.responses ?? []).some((option) => option.effects.some((effect) => effect.targetKind === 'risk' && effect.targetId === id));

function CompanyStep({ doc, update }: { readonly doc: RiskDocument; readonly update: Update }) {
  const setInfo = (key: 'title' | 'organization', value: string): void => {
    update((current) => ({ ...current, document: key === 'title' ? { ...current.document, title: value } : withValue(current.document, 'organization', value.trim() === '' ? undefined : value) }));
  };
  return (
    <div class="guided-fields">
      <div class="field">
        <TextField id="guided-title" label="Name of the risk register" value={doc.document.title} onChange={(value) => {
            setInfo('title', value);
          }} />
      </div>
      <div class="field">
        <TextField id="guided-organization" label="Company name" value={doc.document.organization} onChange={(value) => {
            setInfo('organization', value);
          }} />
      </div>
      <div class="field">
        <TextField id="guided-mission" label="What does your company do?" hint="One sentence. For example, we build controllers for industrial machines." value={doc.context?.mission} onChange={(value) => {
            update((current) => withSection(current, 'context', withValue(current.context, 'mission', value.trim() === '' ? undefined : value)));
          }} />
      </div>
      <p class="muted">
        Currency <strong>{doc.document.currency}</strong>. You set it when you created the register. All amounts use it.
      </p>
    </div>
  );
}

function GoalsStep({ doc, update }: { readonly doc: RiskDocument; readonly update: Update }) {
  const objectives = doc.context?.objectives ?? [];
  const [text, setText] = useState('');
  const [kind, setKind] = useState<Objective['kind']>('operations');
  const setObjectives = (next: Objective[]): void => {
    update((current) => withSection(current, 'context', withValue(current.context, 'objectives', next)));
  };
  const add = (k: Objective['kind'], statement: string): void => {
    update((current) => {
      const list = current.context?.objectives ?? [];
      const objective: Objective = { id: nextId('OBJ-', list.map((item) => item.id)), kind: k, statement };
      return withSection(current, 'context', withValue(current.context, 'objectives', [...list, objective]));
    });
  };
  return (
    <div class="guided-fields">
      <fieldset class="guided-choices">
        <legend>Pick from the examples</legend>
        {EXAMPLE_GOALS.map(([k, statement]) => {
          const found = objectives.find((objective) => objective.statement === statement);
          const locked = found !== undefined && usedObjective(doc, found.id);
          return (
            <label class="guided-choice" key={statement}>
              <input
                type="checkbox"
                checked={found !== undefined}
                disabled={locked}
                onChange={(event) => {
                  if (event.currentTarget.checked) add(k, statement);
                  else setObjectives(objectives.filter((objective) => objective.statement !== statement));
                }}
              />
              <span>
                {statement} <span class="muted">{KINDS.find(([key]) => key === k)?.[1]}</span>
              </span>
            </label>
          );
        })}
      </fieldset>
      <div class="guided-row">
        <div class="field wide">
          <TextField id="guided-own-goal" label="Or write your own goal" value={text} onChange={setText} />
        </div>
        <div class="field">
          <SelectField id="guided-own-goal-kind" label="Kind of goal" value={kind} options={KINDS} onChange={(value) => {
              setKind(value ?? 'operations');
            }} />
        </div>
        <button type="button" class="quiet" disabled={text.trim() === ''} onClick={() => {
            add(kind, text.trim());
            setText('');
          }}>
          Add the goal
        </button>
      </div>
      {objectives.length > 0 && (
        <div class="table-box">
          <table>
            <caption>Your goals</caption>
            <thead>
              <tr>
                <th scope="col">ID</th>
                <th scope="col">Goal</th>
                <th scope="col">Kind</th>
                <th scope="col">
                  <span class="visually-hidden">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {objectives.map((objective) => (
                <tr key={objective.id}>
                  <td>{objective.id}</td>
                  <td>{objective.statement || <span class="muted">No text yet</span>}</td>
                  <td>{KINDS.find(([key]) => key === objective.kind)?.[1]}</td>
                  <td>
                    <button type="button" class="quiet" aria-label={`Remove ${objective.id}`} disabled={usedObjective(doc, objective.id)} onClick={() => {
                        setObjectives(objectives.filter((item) => item.id !== objective.id));
                      }}>
                      Remove
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function ToleranceStep({ doc, update }: { readonly doc: RiskDocument; readonly update: Update }) {
  const points = doc.appetite?.toleranceCurve?.points ?? [];
  const currency = doc.document.currency;
  return (
    <div class="guided-fields">
      <GuidedQuestions doc={doc} update={update} />
      {points.length > 0 && (
        <div class="table-box">
          <table>
            <caption>Your tolerance curve now</caption>
            <thead>
              <tr>
                <th scope="col">Total loss in a year above ({currency})</th>
                <th scope="col">Highest chance you accept</th>
              </tr>
            </thead>
            <tbody>
              {points.map((point, i) => (
                <tr key={i}>
                  <td>{formatNumber(point.loss)}</td>
                  <td>1 in {formatNumber(1 / point.maxExceedanceProbability, 3)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <details class="guided-more">
        <summary>Type the curve and the statements yourself</summary>
        <AppetiteSection doc={doc} update={update} />
      </details>
    </div>
  );
}

function RisksStep({ doc, update }: { readonly doc: RiskDocument; readonly update: Update }) {
  const register = registerTree(doc.registers)[0]?.register;
  const [entryId, setEntryId] = useState<string>();
  const [description, setDescription] = useState('');
  const [positive, setPositive] = useState(false);
  if (register === undefined) return <p class="muted">The document has no register.</p>;
  const entry = CATALOGUE.find((item) => item.id === entryId);
  const addRisk = (make: (current: RiskDocument) => Risk): void => {
    update((current) => ({ ...current, risks: [...current.risks, make(current)] }));
  };
  const risks = doc.risks.filter((risk) => risk.status !== 'Closed');
  return (
    <div class="guided-fields">
      <div class="guided-row">
        <div class="field wide">
          <label for="guided-catalogue">Pick a risk from the catalogue</label>
          <select id="guided-catalogue" value={entryId ?? ''} onChange={(event) => {
              const next = event.currentTarget.value;
              setEntryId(next === '' ? undefined : next);
            }}>
            <option value="">Select a risk</option>
            {CATALOGUE_GROUPS.map((group) => (
              <optgroup key={group} label={group}>
                {CATALOGUE.filter((item) => item.group === group).map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.text}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
        </div>
        <button type="button" class="quiet" disabled={entry === undefined} onClick={() => {
            if (entry === undefined) return;
            addRisk((current) => fromCatalogue(newRisk(current, register.id, entry.text, entry.polarity), entry));
            setEntryId(undefined);
          }}>
          Add from the catalogue
        </button>
      </div>
      <p class="source">{RISKLET_ATTRIBUTION}.</p>
      <div class="field">
        <TextField id="guided-own-risk" label="Or describe your own risk" hint='Write it as "If X occurs, then Y happens".' value={description} onChange={setDescription} />
      </div>
      <label class="check">
        <input type="checkbox" checked={positive} onChange={(event) => {
            setPositive(event.currentTarget.checked);
          }} />
        This is a chance of a gain (an opportunity)
      </label>
      <div>
        <button type="button" class="quiet" disabled={description.trim() === ''} onClick={() => {
            const text = description.trim();
            const polarity = positive ? 'positive' : 'negative';
            addRisk((current) => newRisk(current, register.id, text, polarity));
            setDescription('');
            setPositive(false);
          }}>
          Add your risk
        </button>
      </div>
      {risks.length > 0 && (
        <div class="table-box">
          <table>
            <caption>Your risks</caption>
            <thead>
              <tr>
                <th scope="col">ID</th>
                <th scope="col">Risk</th>
                <th scope="col">From</th>
                <th scope="col">Kind</th>
                <th scope="col">
                  <span class="visually-hidden">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {risks.map((risk) => (
                <tr key={risk.riskId}>
                  <td>{risk.riskId}</td>
                  <td>{risk.riskDescription}</td>
                  <td>{risk.catalogueRef === undefined ? 'Your own' : 'Catalogue'}</td>
                  <td>{risk.polarity === 'positive' ? 'Opportunity' : 'Risk'}</td>
                  <td>
                    <button type="button" class="quiet" aria-label={`Remove ${risk.riskId}`} disabled={usedRisk(doc, risk.riskId)} onClick={() => {
                        update((current) => ({ ...current, risks: current.risks.filter((item) => item.riskId !== risk.riskId) }));
                      }}>
                      Remove
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function SizeStep({ doc, update }: { readonly doc: RiskDocument; readonly update: Update }) {
  const risks = doc.risks.filter((risk) => risk.status !== 'Closed');
  const [selected, setSelected] = useState(risks[0]?.riskId);
  const index = Math.max(
    0,
    risks.findIndex((risk) => risk.riskId === selected),
  );
  const risk = risks[index];
  if (risk === undefined) return <p class="muted">Add risks in step 4 first.</p>;
  const setRisk = (change: (current: Risk) => Risk): void => {
    update((current) => ({ ...current, risks: current.risks.map((item) => (item.riskId === risk.riskId ? change(item) : item)) }));
  };
  const currency = doc.document.currency;
  const word = risk.polarity === 'positive' ? 'gain' : 'loss';
  const id = `risk-${risk.riskId}`;
  const objectives = doc.context?.objectives ?? [];
  const estimate = risk.estimate;
  return (
    <div class="guided-fields">
      <div class="guided-tabs" role="group" aria-label="Risks">
        {risks.map((item) => {
          const complete = riskComplete(item);
          return (
            <button type="button" key={item.riskId} class="guided-tab" aria-pressed={item.riskId === risk.riskId} onClick={() => {
                setSelected(item.riskId);
              }}>
              {item.riskId}
              {!complete && (
                <>
                  <span aria-hidden="true" class="guided-flag">
                    {' '}
                    •
                  </span>
                  <span class="visually-hidden"> needs data</span>
                </>
              )}
            </button>
          );
        })}
      </div>
      <h2 class="guided-subtitle">
        {risk.riskId} {risk.riskDescription}
        {risk.polarity === 'positive' && <span class="muted"> (opportunity)</span>}
      </h2>
      <div class="guided-row">
        <div class="field wide">
          <TextField id={`${id}-owner`} label="Who owns this risk?" hint="A role, for example IT lead." value={hasOwner(risk) ? risk.riskOwnerPointOfContact : ''} onChange={(value) => {
              setRisk((current) => ({ ...current, riskOwnerPointOfContact: value.trim() === '' ? 'Unassigned' : value }));
            }} />
        </div>
      </div>
      {objectives.length === 0 ? (
        <p class="hint">Add goals in step 2 first.</p>
      ) : (
        <Checkboxes
          legend="Which goals does it hit?"
          name={`${id}-objectives`}
          options={objectives.map((objective) => [objective.id, `${objective.id} ${objective.statement}`] as const)}
          value={risk.objectiveIds ?? []}
          onChange={(value) => {
            setRisk((current) => withValue(current, 'objectiveIds', value.length === 0 ? undefined : value));
          }}
        />
      )}
      {estimate === undefined ? (
        <div>
          <button type="button" onClick={() => {
              // The form only. The numbers come from the user, never from the app.
              setRisk((current) => ({
                ...current,
                estimate: { frequency: { type: 'lognormal', confidence: 0.9 }, impactPerEvent: { type: 'lognormal', confidence: 0.9 }, method: 'expert-calibrated', rationale: '' },
              }));
            }}>
            Give the ranges
          </button>
        </div>
      ) : (
        <>
          <DistributionField
            id={`${id}-frequency`}
            legend="How often per year?"
            question="Give a range you are 90% sure of. Use decimals for rare events. 0.1 means once in 10 years."
            unit="events per year"
            frequency
            value={estimate.frequency}
            onChange={(frequency) => {
              setRisk((current) => (current.estimate === undefined ? current : { ...current, estimate: { ...current.estimate, frequency } }));
            }}
          />
          <DistributionField
            id={`${id}-impact`}
            legend={`How much ${word} from one event?`}
            question="Give a range you are 90% sure of."
            unit={currency}
            value={estimate.impactPerEvent}
            onChange={(impactPerEvent) => {
              setRisk((current) => (current.estimate === undefined ? current : { ...current, estimate: { ...current.estimate, impactPerEvent } }));
            }}
          />
          <TextField id={`${id}-rationale`} label="Why these ranges? (10 characters or more)" multiline value={estimate.rationale} onChange={(rationale) => {
              setRisk((current) => (current.estimate === undefined ? current : { ...current, estimate: { ...current.estimate, rationale } }));
            }} />
        </>
      )}
      <details class="guided-more">
        <summary>How to give a good range</summary>
        <p>Give a range that holds the true value 9 times in 10. The value is below your low number 1 time in 20 and above your high number 1 time in 20. A wide range is fine. A range that is too narrow is the most common mistake.</p>
        <p>
          Worked example. "How often does ransomware stop our order system?" We had no attack in 10 years, but similar companies report one every 7 to 50 years. So the range is 0.02 to 0.15 per year.
        </p>
      </details>
      <div class="guided-row">
        <button type="button" class="quiet" disabled={index === 0} onClick={() => {
            setSelected(risks[index - 1]?.riskId);
          }}>
          Previous risk
        </button>
        <button type="button" class="quiet" disabled={index >= risks.length - 1} onClick={() => {
            setSelected(risks[index + 1]?.riskId);
          }}>
          Next risk
        </button>
      </div>
    </div>
  );
}

function DriversStep({ doc, update }: { readonly doc: RiskDocument; readonly update: Update }) {
  const drivers = doc.drivers ?? [];
  const risks = doc.risks.filter((risk) => risk.status !== 'Closed');
  const setLinks = (riskId: string, change: (links: DriverLink[]) => DriverLink[]): void => {
    update((current) => ({
      ...current,
      risks: current.risks.map((risk) => {
        if (risk.riskId !== riskId) return risk;
        const next = change(risk.driverLinks ?? []);
        return withValue(risk, 'driverLinks', next.length === 0 ? undefined : next);
      }),
    }));
  };
  return (
    <div class="guided-fields">
      <p class="muted">Example. One IT provider has admin access to your servers. If attackers break in there, they can cause ransomware and a data leak in the same year.</p>
      <DriverPanel doc={doc} update={update} />
      {drivers.map((driver) => (
        <fieldset class="guided-choices" key={driver.id}>
          <legend>
            Risks that {driver.id} {driver.name || 'the new cause'} can cause
          </legend>
          {risks.map((risk) => {
            const link = (risk.driverLinks ?? []).find((item) => item.driverId === driver.id);
            const fieldId = `guided-link-${driver.id}-${risk.riskId}`;
            return (
              <div class="guided-link" key={risk.riskId}>
                <label class="check">
                  <input
                    type="checkbox"
                    checked={link !== undefined}
                    onChange={(event) => {
                      const on = event.currentTarget.checked;
                      // The trigger probability comes from the user, so a new link has none yet.
                      setLinks(risk.riskId, (links) => (on ? [...links, { driverId: driver.id } as DriverLink] : links.filter((item) => item.driverId !== driver.id)));
                    }}
                  />
                  {risk.riskId} {risk.riskDescription}
                </label>
                {link !== undefined && (
                  <div class="field">
                    <NumberField id={fieldId} label={`Chance that one event of ${driver.id} causes ${risk.riskId} (0 to 1)`} min={0} max={1} value={link.triggerProbability} onChange={(q) => {
                        setLinks(risk.riskId, (links) => links.map((item) => (item.driverId === driver.id ? withValue(item, 'triggerProbability', q) : item)));
                      }} />
                  </div>
                )}
              </div>
            );
          })}
        </fieldset>
      ))}
    </div>
  );
}

function OptionsStep({ doc, update }: { readonly doc: RiskDocument; readonly update: Update }) {
  const options = doc.responses ?? [];
  const canAdd = newResponseOption(doc) !== undefined;
  return (
    <div class="guided-fields">
      {options.length === 0 && <p class="muted">No option yet. An option is an action, for example offline backups or an insurance.</p>}
      {options.map((option) => (
        <OptionEditor key={option.id} doc={doc} option={option} update={update} />
      ))}
      <div>
        <button type="button" class="quiet" disabled={!canAdd} onClick={() => {
            update((current) => {
              const option = newResponseOption(current);
              return option === undefined ? current : withValue(current, 'responses', [...(current.responses ?? []), option]);
            });
          }}>
          Add a response option
        </button>
      </div>
      {!canAdd && <p class="hint">An option needs a risk with ranges (step 5) or a shared cause (step 6) to act on.</p>}
    </div>
  );
}

function PlanStep({ doc, update, run }: { readonly doc: RiskDocument; readonly update: Update; readonly run: PortfolioRun }) {
  const currency = doc.document.currency;
  return (
    <div class="guided-fields">
      <div class="guided-row">
        <div class="field">
          <NumberField id="budget-cash" label={`Cash you can spend in the first year (${currency})`} min={0} value={doc.strategy?.budget?.firstYearCash} onChange={(value) => {
              setBudgetCash(update, value);
            }} />
        </div>
      </div>
      <RunButtons run={run} />
      {run.record !== undefined && <RankedPortfolios record={run.record} currency={currency} />}
      {run.record !== undefined && <ResidualAcceptance doc={doc} record={run.record} update={update} />}
    </div>
  );
}

function RecordStep({ doc, run, onPrinted }: { readonly doc: RiskDocument; readonly run: PortfolioRun; readonly onPrinted: () => void }) {
  const { record, stale, ready } = run;
  if (record === undefined || stale || !ready) {
    return <p class="hint">{record === undefined ? 'No plan yet. Do step 8 first.' : 'The document changed after the run. Run step 8 again.'}</p>;
  }
  return (
    <>
      <div class="button-row guided-print">
        <button type="button" onClick={() => {
            onPrinted();
            window.print();
          }}>
          Print the decision record
        </button>
        <span class="muted">Save a copy of the document on the start screen too.</span>
      </div>
      <DecisionRecordView doc={doc} record={record} />
    </>
  );
}

function GuidedBody({ doc, update, blocked }: { readonly doc: RiskDocument; readonly update: Update; readonly blocked: boolean }) {
  const key = doc.document.id;
  const [step, setStep] = useState(openStep.get(key) ?? 0);
  const [menu, setMenu] = useState(false);
  const [printed, setPrinted] = useState(printedDocs.has(key));
  const heading = useRef<HTMLHeadingElement>(null);
  const moved = useRef(false);
  const run = usePortfolioRun(doc, blocked);
  const planDone = run.record !== undefined && !run.stale && run.ready;
  const status = guidedStatus(doc, planDone, printed);
  useEffect(() => {
    openStep.set(key, step);
    if (!moved.current) return;
    window.scrollTo(0, 0);
    heading.current?.focus();
  }, [key, step]);
  const go = (next: number): void => {
    moved.current = true;
    setMenu(false);
    setStep(next);
  };
  const current = GUIDED_STEPS[step] ?? GUIDED_STEPS[0];
  const next = GUIDED_STEPS[step + 1];
  const missing = status[step]?.missing;
  if (current === undefined) return null;
  return (
    <div class="guided">
      <nav class="guided-nav" aria-label="Steps of the guided mode">
        <button type="button" class="guided-menu" aria-expanded={menu} aria-controls="guided-step-list" onClick={() => {
            setMenu(!menu);
          }}>
          Step {step + 1} of {GUIDED_STEPS.length}, {current.title}
        </button>
        <ol id="guided-step-list" class={menu ? 'guided-steps open' : 'guided-steps'}>
          {GUIDED_STEPS.map((item, i) => {
            const done = status[i]?.done ?? false;
            const now = i === step;
            return (
              <li key={item.key}>
                <button type="button" class={`guided-step${now ? ' is-now' : done ? ' is-done' : ''}`} aria-current={now ? 'step' : undefined} onClick={() => {
                    go(i);
                  }}>
                  <span class="guided-num">{String(i + 1).padStart(2, '0')}</span>
                  <span class="guided-name">{item.title}</span>
                  <span class="guided-state">{done && !now ? 'Done' : item.optional === true && !done ? 'Optional' : ''}</span>
                </button>
              </li>
            );
          })}
        </ol>
      </nav>
      <div class="guided-page">
        <header class="guided-head">
          <p class="guided-eyebrow">
            Step {step + 1} of {GUIDED_STEPS.length}
          </p>
          <h1 id="screen-title" ref={heading} tabIndex={-1}>
            {current.heading}
          </h1>
          <p class="lede">{current.lead}</p>
        </header>
        {step === 0 && <CompanyStep doc={doc} update={update} />}
        {step === 1 && <GoalsStep doc={doc} update={update} />}
        {step === 2 && <ToleranceStep doc={doc} update={update} />}
        {step === 3 && <RisksStep doc={doc} update={update} />}
        {step === 4 && <SizeStep doc={doc} update={update} />}
        {step === 5 && <DriversStep doc={doc} update={update} />}
        {step === 6 && <OptionsStep doc={doc} update={update} />}
        {step === 7 && <PlanStep doc={doc} update={update} run={run} />}
        {step === 8 && (
          <RecordStep
            doc={doc}
            run={run}
            onPrinted={() => {
              printedDocs.add(key);
              setPrinted(true);
            }}
          />
        )}
        {missing !== undefined && (
          <p class="guided-missing" role="status">
            {missing}
          </p>
        )}
        <details class="guided-why">
          <summary>Why we ask this</summary>
          <p>{current.why}</p>
        </details>
        <div class="guided-foot">
          {step > 0 && (
            <button type="button" class="quiet" onClick={() => {
                go(step - 1);
              }}>
              Back
            </button>
          )}
          <span class="guided-spacer" />
          {next !== undefined && (
            <button type="button" onClick={() => {
                go(step + 1);
              }}>
              Next, {next.title.toLowerCase()}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export function GuidedScreen({ id, onNavigate }: { readonly id: string; readonly onNavigate: (screen: ScreenName) => void }) {
  return (
    <DocumentScreen id={id} screen="guided" title="Guided mode" lede="" onNavigate={onNavigate}>
      {(draft, update, status) => <GuidedBody doc={draft} update={update} blocked={status.blocked} />}
    </DocumentScreen>
  );
}
