// Screen S3 Identify and analyze (SPEC.md Sec. 5, 6.1, 6.7 and 6.8). Register tree, risk
// table, risk editor and asset inventory. Saving comes from the shared frame in editor.tsx.
import { useState } from 'preact/hooks';
import type { Register, Risk, RiskDocument } from '../schema/types';
import { NOT_ESTIMATED } from './analysis';
import { formatNumber } from './distribution';
import { nextId, withValue } from './edit';
import { DocumentScreen, type ScreenName, type Update } from './editor';
import { Checkboxes, NumberField, SelectField, TextField } from './fields';
import { RiskEditor } from './risk-editor';

type Asset = NonNullable<RiskDocument['assets']>[number];

const today = (): string => new Date().toISOString().slice(0, 10);

// Registers in tree order with their depth, roots first (SPEC.md Sec. 6.1).
export function registerTree(registers: readonly Register[]): { register: Register; depth: number }[] {
  const out: { register: Register; depth: number }[] = [];
  const known = new Set(registers.map((register) => register.id));
  const visit = (parent: string | undefined, depth: number): void => {
    for (const register of registers) {
      const isChild = parent === undefined ? register.parentRegisterId === undefined || !known.has(register.parentRegisterId) : register.parentRegisterId === parent;
      if (isChild && !out.some((item) => item.register.id === register.id)) {
        out.push({ register, depth });
        visit(register.id, depth + 1);
      }
    }
  };
  visit(undefined, 0);
  return out;
}

// A new risk before any analysis (rule D-Q2). The numeric NIST fields are placeholders and
// listed in defaultedFields. The response is the interim Accept with cost 0 (rule V-09).
export function newRisk(doc: RiskDocument, registerId: string, description: string, polarity: Risk['polarity']): Risk {
  return {
    riskId: nextId('R-', doc.risks.map((risk) => risk.riskId)),
    registerId,
    riskDescription: description,
    riskCategory: 'Not set',
    category: { code: 'ict' },
    polarity,
    riskLikelihood: 0,
    riskImpact: 0,
    exposureRating: 0,
    riskResponseType: ['Accept'],
    riskResponseCost: 0,
    riskResponseDescription: 'No response decided yet.',
    riskOwnerPointOfContact: 'Unassigned',
    status: 'Open',
    responseDecision: 'pending',
    horizon: 'current',
    defaultedFields: ['/riskLikelihood', '/riskImpact', '/exposureRating'],
    detail: { currentRiskAnalysis: NOT_ESTIMATED, dateOfRiskIdentification: today() },
  };
}

function RegisterPanel({ doc, update, selected, onSelect }: { readonly doc: RiskDocument; readonly update: Update; readonly selected: Register; readonly onSelect: (id: string) => void }) {
  const tree = registerTree(doc.registers);
  const children = doc.registers.filter((register) => register.parentRegisterId === selected.id);
  const used = doc.risks.some((risk) => risk.registerId === selected.id) || children.length > 0;
  // A parent cannot be the register itself or one of its descendants (rule V-02).
  const descendants = new Set<string>([selected.id]);
  for (let grew = true; grew; ) {
    grew = false;
    for (const register of doc.registers) {
      if (register.parentRegisterId !== undefined && descendants.has(register.parentRegisterId) && !descendants.has(register.id)) {
        descendants.add(register.id);
        grew = true;
      }
    }
  }
  const setRegister = (change: (register: Register) => Register): void => {
    update((current) => ({ ...current, registers: current.registers.map((item) => (item.id === selected.id ? change(item) : item)) as RiskDocument['registers'] }));
  };
  const id = 'register';
  return (
    <section aria-labelledby="registers-title" class="panel">
      <h2 id="registers-title">Registers</h2>
      <ul class="tree">
        {tree.map(({ register, depth }) => (
          <li key={register.id} style={{ paddingLeft: `${String(depth * 1.25)}rem` }}>
            <button type="button" class={register.id === selected.id ? 'tree-item active' : 'tree-item'} aria-current={register.id === selected.id ? 'true' : undefined} onClick={() => {
                onSelect(register.id);
              }}>
              {register.title}
            </button>
            <span class="sub">
              {register.id}, {register.level}, {register.method}, {doc.risks.filter((risk) => risk.registerId === register.id).length} risks
            </span>
          </li>
        ))}
      </ul>
      <button type="button" class="quiet" onClick={() => {
          const created: Register = { id: nextId('REG-', doc.registers.map((item) => item.id)), title: 'New register', level: 'system', parentRegisterId: selected.id, timeframeMonths: 12, asOf: today(), method: 'qualitative' };
          update((current) => ({ ...current, registers: [...current.registers, created] as RiskDocument['registers'] }));
          onSelect(created.id);
        }}>
        Add a register under {selected.title}
      </button>

      <h3>Register {selected.id}</h3>
      <div class="field-row">
        <div class="field wide">
          <TextField id={`${id}-title`} label="Title" value={selected.title} onChange={(title) => {
              setRegister((register) => ({ ...register, title }));
            }} />
        </div>
        <div class="field">
          <SelectField
            id={`${id}-level`}
            label="Level"
            value={selected.level}
            options={[
              ['system', 'System'],
              ['organization', 'Organization'],
              ['enterprise', 'Enterprise'],
            ]}
            onChange={(level) => {
              setRegister((register) => ({ ...register, level: level ?? 'system' }));
            }}
          />
        </div>
        <div class="field">
          <SelectField
            id={`${id}-parent`}
            label="Parent register"
            emptyLabel="None (top level)"
            value={selected.parentRegisterId}
            options={doc.registers.filter((register) => !descendants.has(register.id)).map((register) => [register.id, register.title] as const)}
            onChange={(parent) => {
              setRegister((register) => withValue(register, 'parentRegisterId', parent));
            }}
          />
        </div>
        <div class="field">
          <SelectField
            id={`${id}-method`}
            label="Method"
            hint="Quantitative needs an estimate for every risk (rule V-08)."
            value={selected.method}
            options={[
              ['qualitative', 'Qualitative'],
              ['semi-quantitative', 'Semi-quantitative'],
              ['quantitative', 'Quantitative'],
            ]}
            onChange={(method) => {
              setRegister((register) => ({ ...register, method: method ?? 'qualitative' }));
            }}
          />
        </div>
        <div class="field">
          <NumberField id={`${id}-timeframe`} label="Timeframe (months)" integer min={1} max={60} value={selected.timeframeMonths} onChange={(months) => {
              setRegister((register) => withValue(register, 'timeframeMonths', months));
            }} />
        </div>
        <div class="field">
          <TextField id={`${id}-as-of`} label="As of" type="date" value={selected.asOf} onChange={(asOf) => {
              setRegister((register) => ({ ...register, asOf }));
            }} />
        </div>
        <div class="field">
          <NumberField
            id={`${id}-threshold`}
            label={`Reportable event threshold (${doc.document.currency})`}
            min={0}
            value={selected.reportableEventThreshold}
            onChange={(value) => {
              setRegister((register) => withValue(register, 'reportableEventThreshold', value));
            }}
          />
        </div>
        <div class="field">
          <TextField id={`${id}-owner`} label="Owner" value={selected.owner} onChange={(owner) => {
              setRegister((register) => withValue(register, 'owner', owner));
            }} />
        </div>
      </div>
      <TextField id={`${id}-scope`} label="Scope" value={selected.scope} onChange={(scope) => {
          setRegister((register) => withValue(register, 'scope', scope));
        }} />
      <div class="button-row">
        <button
          type="button"
          class="danger"
          disabled={used || doc.registers.length === 1}
          onClick={() => {
            update((current) => ({ ...current, registers: current.registers.filter((item) => item.id !== selected.id) as RiskDocument['registers'] }));
            onSelect(selected.parentRegisterId ?? doc.registers.find((item) => item.id !== selected.id)?.id ?? '');
          }}
        >
          Remove register {selected.id}
        </button>
        {used && <span class="hint">A register with risks or child registers cannot be removed.</span>}
      </div>
    </section>
  );
}

function RiskTable({ doc, update, register, selected, onSelect }: { readonly doc: RiskDocument; readonly update: Update; readonly register: Register; readonly selected: string | undefined; readonly onSelect: (id: string) => void }) {
  const [description, setDescription] = useState('');
  const [polarity, setPolarity] = useState<Risk['polarity']>('negative');
  const risks = doc.risks.filter((risk) => risk.registerId === register.id);
  const currency = doc.document.currency;
  return (
    <section aria-labelledby="risks-title" class="panel">
      <h2 id="risks-title">Risks in {register.title}</h2>
      {risks.length === 0 ? (
        <p class="muted">No risk in this register yet.</p>
      ) : (
        // Focusable, so a keyboard can scroll the table on a narrow screen (WCAG 2.1.1).
        <div class="table-box" tabIndex={0} role="region" aria-labelledby="risks-title">
          <table aria-labelledby="risks-title">
            <thead>
              <tr>
                <th scope="col">ID</th>
                <th scope="col">Description</th>
                <th scope="col">Category</th>
                <th scope="col">Status</th>
                <th scope="col">Owner</th>
                <th scope="col">Exposure ({currency})</th>
                <th scope="col">
                  <span class="visually-hidden">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {risks.map((risk) => {
                const placeholder = (risk.defaultedFields ?? []).includes('/exposureRating');
                return (
                  <tr key={risk.riskId} aria-current={risk.riskId === selected ? 'true' : undefined}>
                    <td>{risk.riskId}</td>
                    <td>
                      {risk.riskDescription}
                      {risk.polarity === 'positive' && <span class="sub">Opportunity</span>}
                    </td>
                    <td>{risk.category.subcode ?? risk.category.code}</td>
                    <td>{risk.status}</td>
                    <td>{risk.riskOwnerPointOfContact}</td>
                    <td>{placeholder ? <span class="muted">Not estimated</span> : formatNumber(risk.exposureRating)}</td>
                    <td>
                      <button type="button" class="quiet" aria-pressed={risk.riskId === selected} onClick={() => {
                          onSelect(risk.riskId);
                        }}>
                        Edit {risk.riskId}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      <h3>Add a risk</h3>
      <TextField id="new-risk-description" label="Risk description" hint='Cause and effect, "if X occurs, then Y happens".' multiline value={description} onChange={setDescription} />
      <div class="field-row">
        <div class="field">
          <SelectField
            id="new-risk-polarity"
            label="Polarity"
            value={polarity}
            options={[
              ['negative', 'Negative (threat)'],
              ['positive', 'Positive (opportunity)'],
            ]}
            onChange={(value) => {
              setPolarity(value ?? 'negative');
            }}
          />
        </div>
      </div>
      <button type="button" disabled={description.trim() === ''} onClick={() => {
          const risk = newRisk(doc, register.id, description.trim(), polarity);
          update((current) => ({ ...current, risks: [...current.risks, risk] }));
          setDescription('');
          onSelect(risk.riskId);
        }}>
        Add risk to {register.title}
      </button>
    </section>
  );
}

const ASSET_KINDS: readonly (readonly [Asset['kind'], string])[] = [
  ['information', 'Information'],
  ['software', 'Software'],
  ['hardware', 'Hardware'],
  ['service', 'Service'],
  ['people', 'People'],
  ['facility', 'Facility'],
  ['process', 'Process'],
];
const BASES: readonly (readonly [NonNullable<Asset['value']>['basis'], string])[] = [
  ['replacement-cost', 'Replacement cost'],
  ['revenue-dependency', 'Revenue dependency'],
  ['contract-penalty', 'Contract penalty'],
  ['regulatory', 'Regulatory'],
  ['other', 'Other'],
];

function AssetPanel({ doc, update }: { readonly doc: RiskDocument; readonly update: Update }) {
  const assets = doc.assets ?? [];
  const currency = doc.document.currency;
  const setAsset = (index: number, asset: Asset | undefined): void => {
    update((current) => {
      const list = current.assets ?? [];
      const next = asset === undefined ? list.filter((_, i) => i !== index) : list.map((old, i) => (i === index ? asset : old));
      return withValue(current, 'assets', next);
    });
  };
  const usedBy = (id: string): string[] => doc.risks.filter((risk) => (risk.assetIds ?? []).includes(id)).map((risk) => risk.riskId);
  return (
    <section aria-labelledby="assets-title" class="panel">
      <h2 id="assets-title">Asset inventory</h2>
      <p class="muted">"The value of an asset extends beyond its replacement cost" (Sec. 3.3.1), so a value needs a basis. Assets inherit the criticality of the functions they support.</p>
      {assets.map((asset, i) => {
        const risks = usedBy(asset.id);
        const id = `asset-${String(i)}`;
        return (
          <details class="editor" key={i}>
            <summary>
              {asset.id} {asset.name || 'New asset'}, {asset.kind}, used by {risks.length} risks
            </summary>
            {risks.length >= 2 && <p class="banner">Risks {risks.join(', ')} share this asset. A shared cause is a candidate driver (Sec. 8.7).</p>}
            <div class="field-row">
              <div class="field">
                {risks.length > 0 ? (
                  <p>
                    <strong>ID</strong> {asset.id}
                  </p>
                ) : (
                  <TextField id={`${id}-id`} label="ID" value={asset.id} onChange={(value) => {
                      setAsset(i, { ...asset, id: value });
                    }} />
                )}
              </div>
              <div class="field wide">
                <TextField id={`${id}-name`} label="Name" value={asset.name} onChange={(name) => {
                    setAsset(i, { ...asset, name });
                  }} />
              </div>
              <div class="field">
                <SelectField id={`${id}-kind`} label="Kind" value={asset.kind} options={ASSET_KINDS} onChange={(kind) => {
                    setAsset(i, { ...asset, kind: kind ?? 'information' });
                  }} />
              </div>
              <div class="field">
                <TextField id={`${id}-owner`} label="Owner" value={asset.owner} onChange={(owner) => {
                    setAsset(i, withValue(asset, 'owner', owner));
                  }} />
              </div>
              <div class="field">
                <TextField id={`${id}-criticality`} label="Criticality" value={asset.criticality} onChange={(value) => {
                    setAsset(i, withValue(asset, 'criticality', value));
                  }} />
              </div>
              <div class="field">
                <TextField id={`${id}-sensitivity`} label="Sensitivity" value={asset.sensitivity} onChange={(value) => {
                    setAsset(i, withValue(asset, 'sensitivity', value));
                  }} />
              </div>
            </div>
            <label class="check">
              <input type="checkbox" checked={asset.external === true} onChange={(event) => {
                  setAsset(i, withValue(asset, 'external', event.currentTarget.checked ? true : undefined));
                }} />
              Outside direct control (external)
            </label>
            {asset.external === true && (
              <TextField id={`${id}-provider`} label="Provider" value={asset.provider} onChange={(provider) => {
                  setAsset(i, withValue(asset, 'provider', provider));
                }} />
            )}
            {(doc.context?.functions ?? []).length > 0 && (
              <Checkboxes
                legend="Functions this asset supports"
                name={`${id}-functions`}
                options={(doc.context?.functions ?? []).map((item) => [item.id, `${item.name} (${item.criticality})`] as const)}
                value={asset.supportsFunctionIds ?? []}
                onChange={(value) => {
                  setAsset(i, withValue(asset, 'supportsFunctionIds', value));
                }}
              />
            )}
            <div class="field-row">
              <div class="field">
                <NumberField id={`${id}-value`} label={`Value (${currency})`} min={0} value={asset.value?.amount} onChange={(amount) => {
                    const next = { ...(asset.value ?? { basis: 'replacement-cost' as const }), ...(amount === undefined ? {} : { amount }) };
                    setAsset(i, withValue(asset, 'value', amount === undefined ? undefined : (next as Asset['value'])));
                  }} />
              </div>
              {asset.value !== undefined && (
                <>
                  <div class="field">
                    <SelectField id={`${id}-basis`} label="Basis of the value" value={asset.value.basis} options={BASES} onChange={(basis) => {
                        if (asset.value !== undefined) setAsset(i, { ...asset, value: { ...asset.value, basis: basis ?? 'other' } });
                      }} />
                  </div>
                  <div class="field wide">
                    <TextField id={`${id}-rationale`} label="Rationale of the value" value={asset.value.rationale} onChange={(rationale) => {
                        if (asset.value !== undefined) setAsset(i, { ...asset, value: withValue(asset.value, 'rationale', rationale) });
                      }} />
                  </div>
                </>
              )}
            </div>
            <button type="button" class="quiet" disabled={risks.length > 0} onClick={() => {
                setAsset(i, undefined);
              }}>
              Remove asset {asset.id}
            </button>
          </details>
        );
      })}
      <button type="button" class="quiet" onClick={() => {
          update((current) => withValue(current, 'assets', [...(current.assets ?? []), { id: nextId('A-', (current.assets ?? []).map((item) => item.id)), name: '', kind: 'information' }]));
        }}>
        Add an asset
      </button>
    </section>
  );
}

function IdentifyBody({ doc, update }: { readonly doc: RiskDocument; readonly update: Update }) {
  const [registerId, setRegisterId] = useState<string | undefined>(undefined);
  const [riskId, setRiskId] = useState<string | undefined>(undefined);
  const register = doc.registers.find((item) => item.id === registerId) ?? registerTree(doc.registers)[0]?.register;
  if (register === undefined) return <p class="muted">The document has no register.</p>;
  const risk = doc.risks.find((item) => item.riskId === riskId && item.registerId === register.id);
  return (
    <>
      <div class="grid">
        <RegisterPanel doc={doc} update={update} selected={register} onSelect={(id) => {
            setRegisterId(id);
            setRiskId(undefined);
          }} />
        <RiskTable doc={doc} update={update} register={register} selected={risk?.riskId} onSelect={setRiskId} />
      </div>
      {risk !== undefined && (
        <RiskEditor key={risk.riskId} doc={doc} risk={risk} update={update} onRemoved={() => {
            setRiskId(undefined);
          }} />
      )}
      <AssetPanel doc={doc} update={update} />
    </>
  );
}

export function IdentifyScreen({ id, onNavigate }: { readonly id: string; readonly onNavigate: (screen: ScreenName) => void }) {
  return (
    <DocumentScreen
      id={id}
      screen="identify"
      title="Identify and analyze"
      lede="Steps 2 and 3 of the life cycle, identify and analyze the risks (Sec. 3.3 and 3.4). Changes are saved in this browser."
      onNavigate={onNavigate}
    >
      {(draft, update) => <IdentifyBody doc={draft} update={update} />}
    </DocumentScreen>
  );
}
