// One distribution field of the estimate (SPEC.md Sec. 5 estimate words, Sec. 8.3 and 8.4).
// A 90% range is a lognormal, minimum, most likely, maximum is a PERT, and a fixed value is a
// constant. A change of form clears the numbers, because the app never invents them.
import { useState } from 'preact/hooks';
import type { Distribution } from '../schema/types';
import { NumberField, SelectField } from './fields';

type Form = 'range' | 'every' | 'pert' | 'constant';

const empty = (form: Form): Distribution =>
  form === 'pert' ? { type: 'pert' } : form === 'constant' ? { type: 'constant' } : { type: 'lognormal', confidence: 0.9 };

const formOf = (value: Distribution | undefined): Form => (value?.type === 'pert' ? 'pert' : value?.type === 'constant' ? 'constant' : 'range');

// "Once every N years" (Sec. 5 item 1). The app converts to events per year and swaps the
// bounds, because a longer return period is a lower rate.
const toYears = (rate: number | undefined): number | undefined => (rate === undefined || rate <= 0 ? undefined : Math.round((1 / rate) * 1e6) / 1e6);
const toRate = (years: number | undefined): number | undefined => (years === undefined || years <= 0 ? undefined : 1 / years);

const set = (value: Distribution, key: 'lower' | 'upper' | 'min' | 'mode' | 'max' | 'value', number: number | undefined): Distribution => {
  const { [key]: _old, ...rest } = value;
  return number === undefined ? rest : { ...rest, [key]: number };
};

export function DistributionField({
  id,
  legend,
  question,
  unit,
  value,
  onChange,
  frequency,
}: {
  readonly id: string;
  readonly legend: string;
  readonly question: string;
  readonly unit: string;
  readonly value: Distribution | undefined;
  readonly onChange: (value: Distribution) => void;
  // A frequency also takes "once every N years".
  readonly frequency?: boolean;
}) {
  const [every, setEvery] = useState(false);
  const stored = formOf(value);
  const form: Form = stored === 'range' && every ? 'every' : stored;
  const current = value ?? empty(form);
  const options: (readonly [Form, string])[] = [
    ['range', `A range you are 90% sure of (${unit})`],
    ...(frequency === true ? [['every', 'Once every N years, a range you are 90% sure of'] as const] : []),
    ['pert', 'Minimum, most likely, maximum'],
    ['constant', 'One fixed value'],
  ];
  const number = (key: 'lower' | 'upper' | 'min' | 'mode' | 'max' | 'value', label: string) => (
    <div class="field">
      <NumberField id={`${id}-${key}`} label={label} min={0} value={current[key]} onChange={(n) => {
          onChange(set(current, key, n));
        }} />
    </div>
  );
  return (
    <fieldset class="distribution">
      <legend>{legend}</legend>
      <p class="hint">{question}</p>
      <SelectField
        id={`${id}-form`}
        label="Form of the estimate"
        value={form}
        options={options}
        onChange={(next) => {
          const chosen = next ?? 'range';
          setEvery(chosen === 'every');
          if (formOf(empty(chosen)) !== stored || value === undefined) onChange(empty(chosen));
        }}
      />
      {form === 'pert' && <p class="hint">Use this form when there is a hard maximum, for example a legal cap.</p>}
      <div class="field-row">
        {form === 'range' && (
          <>
            {number('lower', `Lower bound (${unit})`)}
            {number('upper', `Upper bound (${unit})`)}
          </>
        )}
        {form === 'every' && (
          <>
            <div class="field">
              <NumberField id={`${id}-every-short`} label="Shortest time between events (years)" min={0} value={toYears(current.upper)} onChange={(years) => {
                  onChange(set(current, 'upper', toRate(years)));
                }} />
            </div>
            <div class="field">
              <NumberField id={`${id}-every-long`} label="Longest time between events (years)" min={0} value={toYears(current.lower)} onChange={(years) => {
                  onChange(set(current, 'lower', toRate(years)));
                }} />
            </div>
          </>
        )}
        {form === 'pert' && (
          <>
            {number('min', `Minimum (${unit})`)}
            {number('mode', `Most likely (${unit})`)}
            {number('max', `Maximum (${unit})`)}
          </>
        )}
        {form === 'constant' && number('value', `Value (${unit})`)}
      </div>
      {form === 'every' && current.lower !== undefined && current.upper !== undefined && (
        <p class="hint">
          Stored as {formatNumber(current.lower, 3)} to {formatNumber(current.upper, 3)} events per year.
        </p>
      )}
    </fieldset>
  );
}

// Money keeps 6 significant digits. Rates, years and probabilities are estimates, so 3 digits.
export function formatNumber(value: number, digits = 6): string {
  if (!Number.isFinite(value)) return String(value);
  const abs = Math.abs(value);
  if (abs !== 0 && (abs < 0.001 || abs >= 1e9)) return value.toExponential(2);
  return value.toLocaleString('en', { maximumSignificantDigits: abs < 1 ? 3 : digits });
}
