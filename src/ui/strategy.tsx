// S2 strategy part (SPEC.md Sec. 6.6). Scales, review and reporting cycle, budget,
// thresholds and the optimization method.
import type { RiskDocument } from '../schema/types';
import { draftList, withSection, withValue } from './edit';
import { NumberField, SelectField, TextField } from './fields';

type Strategy = NonNullable<RiskDocument['strategy']>;
type Scales = NonNullable<Strategy['scales']>;
type Band = NonNullable<Scales['likelihood']>[number];
type Budget = NonNullable<Strategy['budget']>;
type Update = (change: (doc: RiskDocument) => RiskDocument) => void;

const SCALES: readonly (readonly [keyof Scales, string, string])[] = [
  ['likelihood', 'Likelihood scale', 'Probability of at least one event in the register timeframe, from 0 to 1.'],
  ['impact', 'Impact scale', 'Loss or gain per event, in the document currency.'],
  ['exposure', 'Exposure scale', 'Expected annual impact, in the document currency.'],
];

function ScaleEditor({ name, label, help, bands, onChange }: { readonly name: string; readonly label: string; readonly help: string; readonly bands: readonly Band[]; readonly onChange: (bands: Band[]) => void }) {
  const setBand = (index: number, band: Band | undefined): void => {
    onChange(band === undefined ? bands.filter((_, i) => i !== index) : bands.map((old, i) => (i === index ? band : old)));
  };
  return (
    <div class="scale">
      <h4 id={`${name}-title`}>{label}</h4>
      <p class="hint">{help} A scale needs 2 bands or more. A label in use by a risk must stay (rule V-11).</p>
      {bands.length > 0 && (
        <div class="table-box">
          <table aria-labelledby={`${name}-title`}>
            <thead>
              <tr>
                <th scope="col">Label</th>
                <th scope="col">Lower</th>
                <th scope="col">Upper</th>
                <th scope="col">Representative</th>
                <th scope="col">
                  <span class="visually-hidden">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {bands.map((band, i) => {
                const row = `${label} band ${String(i + 1)}`;
                return (
                  <tr key={i}>
                    <td>
                      <TextField id={`${name}-${String(i)}-label`} label={`${row} label`} hiddenLabel value={band.label} onChange={(text) => {
                          setBand(i, { ...band, label: text });
                        }} />
                    </td>
                    {(['lower', 'upper', 'representative'] as const).map((field) => (
                      <td key={field}>
                        <NumberField id={`${name}-${String(i)}-${field}`} label={`${row} ${field}`} hiddenLabel min={0} value={band[field]} onChange={(value) => {
                            setBand(i, withValue(band, field, value));
                          }} />
                      </td>
                    ))}
                    <td>
                      <button type="button" class="quiet" aria-label={`Remove ${row}`} onClick={() => {
                          setBand(i, undefined);
                        }}>
                        Remove
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      <button type="button" class="quiet" onClick={() => {
          // An unfilled band. The schema refuses it until the numbers are typed.
          onChange([...bands, { label: '' } as Band]);
        }}>
        Add a band to the {label.toLowerCase()}
      </button>
    </div>
  );
}

export function StrategySection({ doc, update }: { readonly doc: RiskDocument; readonly update: Update }) {
  const strategy: Strategy = doc.strategy ?? {};
  const currency = doc.document.currency;
  const set = <K extends keyof Strategy>(key: K, value: Strategy[K] | undefined): void => {
    update((current) => withSection(current, 'strategy', withValue(current.strategy, key, value)));
  };
  const setBudget = <K extends keyof Budget>(key: K, value: Budget[K] | undefined): void => {
    update((current) => withSection(current, 'strategy', withValue(current.strategy, 'budget', withValue(current.strategy?.budget, key, value))));
  };
  const money = (key: 'firstYearCash' | 'capexCeiling' | 'opexCeiling', label: string) => (
    <div class="field">
      <NumberField id={`budget-${key}`} label={`${label} (${currency})`} min={0} value={strategy.budget?.[key]} onChange={(value) => {
          setBudget(key, value);
        }} />
    </div>
  );

  return (
    <section aria-labelledby="strategy-title" class="panel">
      <h2 id="strategy-title">Risk management strategy</h2>

      <h3>Scales</h3>
      <p class="muted">"Establishing a common scale for assessing levels of risk will support consistent risk estimation" (Sec. 3.2.2). Labels map to numbers through the representative value.</p>
      {SCALES.map(([key, label, help]) => (
        <ScaleEditor key={key} name={`scale-${key}`} label={label} help={help} bands={strategy.scales?.[key] ?? []} onChange={(bands) => {
            set('scales', withValue(strategy.scales, key, draftList<NonNullable<Scales['likelihood']>>(bands)));
          }} />
      ))}

      <h3>Review and reporting</h3>
      <div class="field-row">
        <div class="field">
          <NumberField id="review-months" label="Review every (months)" integer min={1} max={36} value={strategy.reviewFrequencyMonths} onChange={(value) => {
              set('reviewFrequencyMonths', value);
            }} />
        </div>
        <div class="field">
          <NumberField id="reporting-months" label="Report every (months)" integer min={1} max={36} value={strategy.reportingFrequencyMonths} onChange={(value) => {
              set('reportingFrequencyMonths', value);
            }} />
        </div>
      </div>

      <h3>Budget</h3>
      <div class="field-row">
        {money('firstYearCash', 'First-year cash for responses')}
        {money('capexCeiling', 'CapEx ceiling')}
        {money('opexCeiling', 'OpEx ceiling')}
        <div class="field">
          <TextField id="budget-fiscal-start" label="Fiscal year start" type="date" value={strategy.budget?.fiscalYearStart} onChange={(value) => {
              setBudget('fiscalYearStart', value);
            }} />
        </div>
      </div>

      <h3>Thresholds and method</h3>
      <div class="field-row">
        <div class="field">
          <NumberField
            id="inclusion-threshold"
            label={`Inclusion threshold (${currency})`}
            hint="Exposure below which a risk need not stay in the register (Sec. 3.5)."
            min={0}
            value={strategy.inclusionThreshold}
            onChange={(value) => {
              set('inclusionThreshold', value);
            }}
          />
        </div>
        <div class="field">
          <NumberField
            id="escalation-threshold"
            label={`Escalation threshold (${currency})`}
            hint="Exposure at or above which a risk must appear in the parent register (Sec. 5.2.2)."
            min={0}
            value={strategy.escalationThreshold}
            onChange={(value) => {
              set('escalationThreshold', value);
            }}
          />
        </div>
        <div class="field">
          <SelectField
            id="optimization-method"
            label="Optimization method"
            hint="Sec. 5.3.2. Algorithmic ranks every affordable portfolio by simulation."
            emptyLabel="Not set"
            value={strategy.optimizationMethod}
            options={[
              ['algorithmic', 'Algorithmic'],
              ['fiscal', 'Fiscal'],
              ['operational', 'Operational'],
            ]}
            onChange={(value) => {
              set('optimizationMethod', value);
            }}
          />
        </div>
      </div>
    </section>
  );
}
