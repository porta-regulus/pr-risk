// The S3 risk editor (SPEC.md Sec. 5, 6.7 and 6.8). Tabs Scenario, Estimate, Links and
// Detail. Drivers and Evidence follow in the next step of build task 5.
import { useEffect, useState } from 'preact/hooks';
import type { Distribution, Risk, RiskDocument } from '../schema/types';
import { type Feedback, feedback } from './analysis';
import { DistributionField, formatNumber } from './distribution';
import { draftList, withValue } from './edit';
import type { Update } from './editor';
import { Checkboxes, LinesField, NumberField, SelectField, TextField } from './fields';

type Estimate = NonNullable<Risk['estimate']>;
type Secondary = NonNullable<Estimate['secondaryImpacts']>[number];
type Detail = NonNullable<Risk['detail']>;
type Link = NonNullable<Risk['linkedRisks']>[number];
type CategoryCode = Risk['category']['code'];

// SPEC.md Sec. 6.7.7. The schema accepts other subcodes, and the editor keeps them.
export const SUBCODES: Readonly<Record<CategoryCode, readonly string[]>> = {
  ict: ['malware', 'fraud', 'data-exfiltration', 'availability', 'vulnerability', 'supply-chain', 'identity', 'misconfiguration', 'physical-environmental', 'insider', 'ai'],
  financial: ['revenue', 'cost', 'liquidity', 'credit'],
  legal: ['regulatory', 'privacy', 'contract', 'ip', 'litigation'],
  operational: ['people', 'process', 'supplier', 'facilities'],
  strategic: ['market', 'innovation', 'partnership'],
  safety: ['product', 'workplace', 'ot-process'],
  reputation: ['customer', 'public', 'regulator'],
};
const CODES: readonly (readonly [CategoryCode, string])[] = [
  ['ict', 'ICT'],
  ['financial', 'Financial'],
  ['legal', 'Legal'],
  ['operational', 'Operational'],
  ['strategic', 'Strategic'],
  ['safety', 'Safety'],
  ['reputation', 'Reputation'],
];
const STATUSES: readonly (readonly [Risk['status'], string])[] = (['Open', 'In treatment', 'Monitored', 'Accepted', 'Review needed', 'Closed'] as const).map((status) => [status, status] as const);
const RELATIONS: readonly (readonly [Link['relation'], string])[] = [
  ['cascades-to', 'Cascades to'],
  ['combination-of', 'Combination of'],
  ['trade-off', 'Trade-off with'],
];

// The five scenario parts of Sec. 3.3.5, written into the RDR fields.
const SCENARIO_PARTS: readonly (readonly [keyof Detail, string])[] = [
  ['threatSourcesActors', 'Threat source or actor (for a positive risk, the source of the opportunity)'],
  ['threatEvents', 'Threat event'],
  ['vulnerabilityPredisposingConditions', 'Vulnerability or predisposing condition'],
  ['assetsAffected', 'Assets affected'],
  ['primaryAdverseImpact', 'Harmful impact (for a positive risk, the benefit)'],
];
const DETAIL_TEXT: readonly (readonly [keyof Detail, string])[] = [
  ['systemAffected', 'System affected'],
  ['organizationOrBusinessUnit', 'Organization or business unit'],
  ['riskScenarioDescription', 'Risk scenario description'],
  ['threatVectors', 'Threat vectors'],
  ['secondaryAdverseImpacts', 'Secondary adverse impacts'],
  ['otherScenarioDetails', 'Other scenario details'],
  ['currentRiskAnalysis', 'Current risk analysis'],
  ['resourceRequirementsForPlannedRisk', 'Resource requirements for the planned response'],
  ['sourceOfRiskInformation', 'Source of risk information'],
  ['dependencies', 'Dependencies'],
  ['comments', 'Comments'],
  ['implementedResponseDescription', 'Implemented response'],
];
const DETAIL_DATES: readonly (readonly [keyof Detail, string])[] = [
  ['dateOfRiskIdentification', 'Date of risk identification'],
  ['currentStatusDate', 'Current status date'],
  ['followUpDate', 'Follow-up date'],
];

const TABS = ['Scenario', 'Estimate', 'Links', 'Detail'] as const;
type Tab = (typeof TABS)[number];

const replaceAt = <T,>(items: readonly T[], index: number, item: T | undefined): T[] =>
  item === undefined ? items.filter((_, i) => i !== index) : items.map((old, i) => (i === index ? item : old));

function FeedbackBox({ doc, risk }: { readonly doc: RiskDocument; readonly risk: Risk }) {
  const [result, setResult] = useState<Feedback>();
  const currency = doc.document.currency;
  const months = doc.registers.find((register) => register.id === risk.registerId)?.timeframeMonths ?? 12;
  // A run of one risk takes some milliseconds, so it waits for a pause in typing.
  useEffect(() => {
    const timer = setTimeout(() => {
      setResult(feedback(doc, risk.riskId));
    }, 300);
    return () => {
      clearTimeout(timer);
    };
  }, [doc, risk]);
  if (result === undefined) return <p class="hint">Fill in the frequency and the impact to see what they mean.</p>;
  const word = risk.polarity === 'positive' ? 'gain' : 'loss';
  const numbers = result.numbers;
  return (
    <div class="feedback" role="status" aria-live="polite">
      <h4>What the estimate means</h4>
      <ul>
        {result.medianFrequency !== undefined && (
          <li>
            Typical frequency (median) {formatNumber(result.medianFrequency, 3)} events per year
            {result.medianFrequency > 0 && result.medianFrequency < 1 ? `, about once every ${formatNumber(1 / result.medianFrequency, 3)} years` : ''}.
          </li>
        )}
        <li>Mean frequency with the drivers {formatNumber(result.totalFrequency, 3)} events per year.</li>
        {result.medianImpact !== undefined && (
          <li>
            Typical {word} per event (median) {formatNumber(result.medianImpact)} {currency}.
          </li>
        )}
        <li>
          Mean {word} per event with secondary impacts {formatNumber(result.meanImpact)} {currency}.
        </li>
        {numbers !== undefined && (
          <>
            <li>
              Probability of at least one event in {months} months {formatNumber(numbers.probability, 3)}.
            </li>
            <li>
              Expected annual {word} {formatNumber(Math.round(numbers.expectedAnnual))} {currency}.
            </li>
          </>
        )}
      </ul>
    </div>
  );
}

function EstimateTab({ doc, risk, setRisk }: { readonly doc: RiskDocument; readonly risk: Risk; readonly setRisk: (change: (risk: Risk) => Risk) => void }) {
  const currency = doc.document.currency;
  const estimate = risk.estimate;
  const register = doc.registers.find((item) => item.id === risk.registerId);
  const word = risk.polarity === 'positive' ? 'gain' : 'loss';
  if (estimate === undefined) {
    return (
      <div class="tab-body">
        <p class="muted">
          No estimate yet. {register?.method === 'quantitative' ? 'This register is quantitative, so the risk needs an estimate before it can be saved (rule V-08).' : 'A qualitative register can take estimates risk by risk (Sec. 6.8).'}
        </p>
        <button type="button" onClick={() => {
            // The form only. The numbers come from the user, never from the app.
            setRisk((current) => ({
              ...current,
              estimate: { frequency: { type: 'lognormal', confidence: 0.9 }, impactPerEvent: { type: 'lognormal', confidence: 0.9 }, method: 'expert-calibrated', rationale: '' },
            }));
          }}>
          Add an estimate
        </button>
      </div>
    );
  }
  const setEstimate = <K extends keyof Estimate>(key: K, value: Estimate[K] | undefined): void => {
    setRisk((current) => (current.estimate === undefined ? current : { ...current, estimate: withValue(current.estimate, key, value) }));
  };
  const secondaries = estimate.secondaryImpacts ?? [];
  const id = `risk-${risk.riskId}`;
  return (
    <div class="tab-body">
      <DistributionField
        id={`${id}-frequency`}
        legend="Frequency"
        question="How many times per year does this happen, not counting events caused through the drivers? Give a range you are 90% sure of."
        unit="events per year"
        frequency
        value={estimate.frequency}
        onChange={(value: Distribution) => {
          setEstimate('frequency', value);
        }}
      />
      <DistributionField
        id={`${id}-impact`}
        legend={`Impact per event (${word})`}
        question={`When it happens once, what is the ${word}? Give a range you are 90% sure of.`}
        unit={currency}
        value={estimate.impactPerEvent}
        onChange={(value: Distribution) => {
          setEstimate('impactPerEvent', value);
        }}
      />

      <h4>Secondary impacts</h4>
      <p class="hint">Can one event cause a second {word}, for example customer claims after a disclosure? Add a secondary impact with its probability (Sec. 3.4.2).</p>
      {secondaries.map((item, i) => (
        <div class="sub-editor" key={i}>
          <TextField id={`${id}-sec${String(i)}-description`} label="Secondary impact" value={item.description} onChange={(description) => {
              setEstimate('secondaryImpacts', draftList<Secondary[]>(replaceAt(secondaries, i, { ...item, description })));
            }} />
          <NumberField id={`${id}-sec${String(i)}-probability`} label="Probability per event (0 to 1)" min={0} max={1} value={item.probability} onChange={(probability) => {
              setEstimate('secondaryImpacts', replaceAt(secondaries, i, withValue(item, 'probability', probability)));
            }} />
          <DistributionField id={`${id}-sec${String(i)}`} legend="Secondary impact per event" question="Give a range you are 90% sure of." unit={currency} value={item.impactPerEvent} onChange={(impactPerEvent) => {
              setEstimate('secondaryImpacts', replaceAt(secondaries, i, { ...item, impactPerEvent }));
            }} />
          <button type="button" class="quiet" onClick={() => {
              setEstimate('secondaryImpacts', replaceAt(secondaries, i, undefined));
            }}>
            Remove secondary impact {i + 1}
          </button>
        </div>
      ))}
      <button type="button" class="quiet" onClick={() => {
          setEstimate('secondaryImpacts', [...secondaries, { description: '', impactPerEvent: { type: 'lognormal', confidence: 0.9 } } as Secondary]);
        }}>
        Add a secondary impact
      </button>

      <div class="field-row">
        <div class="field">
          <SelectField
            id={`${id}-method`}
            label="Basis of the estimate"
            value={estimate.method}
            options={[
              ['expert-calibrated', 'Expert range'],
              ['data-derived', 'Own data'],
              ['mixed', 'Mixed'],
            ]}
            onChange={(method) => {
              setEstimate('method', method ?? 'expert-calibrated');
            }}
          />
        </div>
        <div class="field">
          <TextField id={`${id}-estimated-by`} label="Estimated by" value={estimate.estimatedBy} onChange={(value) => {
              setEstimate('estimatedBy', value);
            }} />
        </div>
        <div class="field">
          <TextField id={`${id}-estimated-on`} label="Estimated on" type="date" value={estimate.estimatedOn} onChange={(value) => {
              setEstimate('estimatedOn', value);
            }} />
        </div>
      </div>
      <TextField id={`${id}-rationale`} label="Rationale (10 characters or more)" multiline value={estimate.rationale} onChange={(rationale) => {
          setRisk((current) => (current.estimate === undefined ? current : { ...current, estimate: { ...current.estimate, rationale } }));
        }} />
      <LinesField id={`${id}-sources`} label="Sources, one per line" value={estimate.sources ?? []} onChange={(sources) => {
          setEstimate('sources', sources);
        }} />

      <FeedbackBox doc={doc} risk={risk} />

      <details class="help">
        <summary>Help with calibrated estimates</summary>
        <p>Four biases distort estimates (Sec. 3.3.2). Overconfidence gives ranges that are too narrow. Groupthink copies the loudest voice. Following trends rates the risk in the news too high. Availability bias rates what you remember best too high.</p>
        <p>
          The equivalent-bet test helps against overconfidence. Imagine two bets. In bet A you win 1 000 {currency} if the true value is inside your range. In bet B you win 1 000 {currency} with a probability of 90%. If you prefer bet B, your range is too narrow, so widen it. If you prefer bet A, your range is too wide. Change the range until both bets look equal.
        </p>
      </details>

      {register?.method !== 'quantitative' && (
        <button type="button" class="quiet" onClick={() => {
            setRisk((current) => withValue(current, 'estimate', undefined));
          }}>
          Remove the estimate
        </button>
      )}
    </div>
  );
}

export function RiskEditor({ doc, risk, update, onRemoved }: { readonly doc: RiskDocument; readonly risk: Risk; readonly update: Update; readonly onRemoved: () => void }) {
  const [tab, setTab] = useState<Tab>('Scenario');
  const id = `risk-${risk.riskId}`;
  const setRisk = (change: (current: Risk) => Risk): void => {
    update((current) => ({ ...current, risks: current.risks.map((item) => (item.riskId === risk.riskId ? change(item) : item)) }));
  };
  const set = <K extends keyof Risk>(key: K, value: Risk[K] | undefined): void => {
    setRisk((current) => withValue(current, key, value));
  };
  const setDetail = (key: keyof Detail, value: string): void => {
    setRisk((current) => withValue(current, 'detail', withValue(current.detail, key, value === '' ? undefined : value)));
  };
  const detail = risk.detail ?? {};
  const subcodes = SUBCODES[risk.category.code];
  const subcode = risk.category.subcode;
  const subcodeOptions: (readonly [string, string])[] = subcodes.map((item) => [`${risk.category.code}.${item}`, item] as const);
  if (subcode !== undefined && !subcodeOptions.some(([key]) => key === subcode)) subcodeOptions.push([subcode, `${subcode} (not in the release 1 list)`]);

  const others = doc.risks.filter((item) => item.riskId !== risk.riskId);
  const links = risk.linkedRisks ?? [];
  const referencedBy = [
    ...doc.risks.filter((item) => (item.sourceRefs ?? []).some((ref) => ref.riskId === risk.riskId) || (item.linkedRisks ?? []).some((link) => link.riskId === risk.riskId)).map((item) => item.riskId),
    ...(doc.responses ?? []).filter((option) => option.effects.some((effect) => effect.targetKind === 'risk' && effect.targetId === risk.riskId) || (option.introducesRisks ?? []).includes(risk.riskId)).map((option) => option.id),
    ...(doc.forecasts ?? []).filter((forecast) => forecast.riskId === risk.riskId).map((forecast) => forecast.id),
  ];

  const tabButton = (name: Tab, index: number) => (
    <button
      type="button"
      role="tab"
      id={`${id}-tab-${name}`}
      key={name}
      aria-selected={tab === name}
      aria-controls={`${id}-panel`}
      tabIndex={tab === name ? 0 : -1}
      class={tab === name ? 'tab active' : 'tab'}
      onClick={() => {
        setTab(name);
      }}
      onKeyDown={(event) => {
        const step = event.key === 'ArrowRight' ? 1 : event.key === 'ArrowLeft' ? -1 : 0;
        if (step === 0) return;
        const next = TABS[(index + step + TABS.length) % TABS.length] ?? 'Scenario';
        setTab(next);
        document.getElementById(`${id}-tab-${next}`)?.focus();
      }}
    >
      {name}
    </button>
  );

  return (
    <section aria-labelledby={`${id}-title`} class="panel risk-editor">
      <h2 id={`${id}-title`}>
        Risk {risk.riskId}
      </h2>
      <div role="tablist" aria-label={`Parts of risk ${risk.riskId}`} class="tabs">
        {TABS.map(tabButton)}
      </div>
      <div role="tabpanel" id={`${id}-panel`} aria-labelledby={`${id}-tab-${tab}`}>
        {tab === 'Scenario' && (
          <div class="tab-body">
            <TextField id={`${id}-description`} label="Risk description" hint='Cause and effect, "if X occurs, then Y happens" (Table 3).' multiline value={risk.riskDescription} onChange={(value) => {
                setRisk((current) => ({ ...current, riskDescription: value }));
              }} />
            <div class="field-row">
              <div class="field">
                <SelectField
                  id={`${id}-polarity`}
                  label="Polarity"
                  value={risk.polarity}
                  options={[
                    ['negative', 'Negative (threat)'],
                    ['positive', 'Positive (opportunity)'],
                  ]}
                  onChange={(value) => {
                    setRisk((current) => ({ ...current, polarity: value ?? 'negative' }));
                  }}
                />
              </div>
              <div class="field">
                <SelectField
                  id={`${id}-horizon`}
                  label="Horizon"
                  emptyLabel="Not set"
                  value={risk.horizon}
                  options={[
                    ['current', 'Current'],
                    ['emerging', 'Emerging'],
                    ['horizon', 'Horizon'],
                  ]}
                  onChange={(value) => {
                    set('horizon', value);
                  }}
                />
              </div>
              <div class="field">
                <SelectField
                  id={`${id}-threat-type`}
                  label="Threat source type"
                  emptyLabel="Not set"
                  value={risk.threatSourceType}
                  options={[
                    ['adversarial', 'Adversarial'],
                    ['accidental', 'Accidental'],
                    ['structural', 'Structural'],
                    ['environmental', 'Environmental'],
                  ]}
                  onChange={(value) => {
                    set('threatSourceType', value);
                  }}
                />
              </div>
            </div>
            {(risk.horizon === 'emerging' || risk.horizon === 'horizon') && (
              <p class="banner">An emerging or horizon risk is a trigger to review appetite and tolerance (Sec. 3.3). Check the statements on the screen Context and strategy.</p>
            )}
            <div class="field-row">
              <div class="field">
                <SelectField id={`${id}-code`} label="Category" value={risk.category.code} options={CODES} onChange={(code) => {
                    setRisk((current) => ({ ...current, category: { code: code ?? 'ict' } }));
                  }} />
              </div>
              <div class="field">
                <SelectField id={`${id}-subcode`} label="Subcategory" emptyLabel="None" value={subcode} options={subcodeOptions} onChange={(value) => {
                    setRisk((current) => ({ ...current, category: withValue(current.category, 'subcode', value) }));
                  }} />
              </div>
              <div class="field">
                <TextField id={`${id}-nist-category`} label="NIST risk category (text)" value={risk.riskCategory} onChange={(value) => {
                    setRisk((current) => ({ ...current, riskCategory: value }));
                  }} />
              </div>
            </div>
            <div class="field-row">
              <div class="field">
                <TextField id={`${id}-owner`} label="Risk owner" value={risk.riskOwnerPointOfContact} onChange={(value) => {
                    setRisk((current) => ({ ...current, riskOwnerPointOfContact: value }));
                  }} />
              </div>
              <div class="field">
                <SelectField id={`${id}-status`} label="Status" value={risk.status} options={STATUSES} onChange={(value) => {
                    setRisk((current) => ({ ...current, status: value ?? 'Open' }));
                  }} />
              </div>
            </div>
            <fieldset class="scenario">
              <legend>Scenario parts (Sec. 3.3.5)</legend>
              {SCENARIO_PARTS.map(([key, label]) => (
                <TextField key={key} id={`${id}-${key}`} label={label} multiline value={detail[key] as string | undefined} onChange={(value) => {
                    setDetail(key, value);
                  }} />
              ))}
            </fieldset>
          </div>
        )}

        {tab === 'Estimate' && <EstimateTab doc={doc} risk={risk} setRisk={setRisk} />}

        {tab === 'Links' && (
          <div class="tab-body">
            {(doc.context?.objectives ?? []).length === 0 ? (
              <p class="muted">No objectives yet. Add them on the screen Context and strategy. A risk without an objective gets lint L-09.</p>
            ) : (
              <Checkboxes
                legend="Objectives this risk affects"
                name={`${id}-objectives`}
                options={(doc.context?.objectives ?? []).map((objective) => [objective.id, `${objective.id} ${objective.statement}`] as const)}
                value={risk.objectiveIds ?? []}
                onChange={(value) => {
                  set('objectiveIds', value);
                }}
              />
            )}
            {(doc.assets ?? []).length === 0 ? (
              <p class="muted">No assets yet. Add them in the asset inventory on this screen.</p>
            ) : (
              <Checkboxes
                legend="Assets this risk affects"
                name={`${id}-assets`}
                options={(doc.assets ?? []).map((asset) => [asset.id, `${asset.id} ${asset.name}`] as const)}
                value={risk.assetIds ?? []}
                onChange={(value) => {
                  set('assetIds', value);
                }}
              />
            )}
            <h4>Linked risks</h4>
            <p class="hint">A cascade inside one risk is a secondary impact. Use a link for a cascade to another risk, and a driver for a shared cause (Sec. 6.7.3).</p>
            {links.map((link, i) => (
              <div class="field-row" key={i}>
                <div class="field">
                  <SelectField id={`${id}-link${String(i)}-relation`} label={`Link ${String(i + 1)} relation`} value={link.relation} options={RELATIONS} onChange={(relation) => {
                      set('linkedRisks', replaceAt(links, i, { ...link, relation: relation ?? 'cascades-to' }));
                    }} />
                </div>
                <div class="field">
                  <SelectField
                    id={`${id}-link${String(i)}-risk`}
                    label={`Link ${String(i + 1)} risk`}
                    emptyLabel="Choose a risk"
                    value={link.riskId === '' ? undefined : link.riskId}
                    options={others.map((item) => [item.riskId, `${item.riskId} ${item.riskDescription.slice(0, 60)}`] as const)}
                    onChange={(value) => {
                      set('linkedRisks', replaceAt(links, i, { ...link, riskId: value ?? '' }));
                    }}
                  />
                </div>
                <div class="field">
                  <TextField id={`${id}-link${String(i)}-note`} label={`Link ${String(i + 1)} note`} value={link.note} onChange={(note) => {
                      set('linkedRisks', replaceAt(links, i, withValue(link, 'note', note)));
                    }} />
                </div>
                <button type="button" class="quiet" onClick={() => {
                    set('linkedRisks', replaceAt(links, i, undefined));
                  }}>
                  Remove link {i + 1}
                </button>
              </div>
            ))}
            <button type="button" class="quiet" disabled={others.length === 0} onClick={() => {
                set('linkedRisks', [...links, { riskId: '', relation: 'cascades-to' }]);
              }}>
              Add a linked risk
            </button>
          </div>
        )}

        {tab === 'Detail' && (
          <div class="tab-body">
            <p class="muted">The fields of the NIST risk detail record (IR 8286 Appendix B). The scenario parts are on the tab Scenario.</p>
            {DETAIL_TEXT.map(([key, label]) => (
              <TextField key={key} id={`${id}-${key}`} label={label} multiline value={detail[key] as string | undefined} onChange={(value) => {
                  setDetail(key, value);
                }} />
            ))}
            <div class="field-row">
              {DETAIL_DATES.map(([key, label]) => (
                <div class="field" key={key}>
                  <TextField id={`${id}-${key}`} label={label} type="date" value={detail[key] as string | undefined} onChange={(value) => {
                      setDetail(key, value);
                    }} />
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <div class="button-row">
        <button
          type="button"
          class="danger"
          disabled={referencedBy.length > 0}
          title={referencedBy.length > 0 ? `Used by ${referencedBy.join(', ')}` : undefined}
          onClick={() => {
            update((current) => ({ ...current, risks: current.risks.filter((item) => item.riskId !== risk.riskId) }));
            onRemoved();
          }}
        >
          Remove risk {risk.riskId}
        </button>
        {referencedBy.length > 0 && <span class="hint">Used by {referencedBy.join(', ')}, so it cannot be removed.</span>}
      </div>
    </section>
  );
}
