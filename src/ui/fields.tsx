// Labelled form fields for the screens. Every field has a visible label or, inside a
// table, an aria-label (WCAG 2.2 AA, SPEC.md Sec. 10 item 2).
import { type ComponentChildren, createContext } from 'preact';
import { useCallback, useContext, useEffect, useState } from 'preact/hooks';
import { lines } from './edit';

interface Base {
  readonly id: string;
  readonly label: string;
  // Inside a table row the column header is the visible label.
  readonly hiddenLabel?: boolean;
  readonly hint?: string;
}

function Label({ id, label, hiddenLabel, hint }: Base) {
  if (hiddenLabel === true) return null;
  return (
    <>
      <label for={id}>{label}</label>
      {hint !== undefined && (
        <span class="hint" id={`${id}-hint`}>
          {hint}
        </span>
      )}
    </>
  );
}

const described = ({ id, hint, hiddenLabel }: Base) => (hint !== undefined && hiddenLabel !== true ? `${id}-hint` : undefined);

export function TextField(
  props: Base & { readonly value: string | undefined; readonly onChange: (value: string) => void; readonly multiline?: boolean; readonly type?: 'text' | 'date' },
) {
  const { id, label, hiddenLabel, value, onChange, multiline, type } = props;
  const common = {
    id,
    value: value ?? '',
    'aria-label': hiddenLabel === true ? label : undefined,
    'aria-describedby': described(props),
    onInput: (event: Event) => {
      onChange((event.currentTarget as HTMLInputElement | HTMLTextAreaElement).value);
    },
  };
  return (
    <>
      <Label {...props} />
      {multiline === true ? <textarea rows={3} {...common} /> : type === 'date' ? <input type="date" {...common} /> : <input {...common} />}
    </>
  );
}

// A number field reports text that is not a number, with its label, or undefined when the
// text is a number again. A screen that saves uses it to refuse the save, because the
// document still holds the old value. The default ignores reports.
export type InvalidReport = (field: string, label: string | undefined) => void;
const ignore: InvalidReport = () => undefined;
export const InvalidFields = createContext<InvalidReport>(ignore);
// For fields whose value is not part of the document, such as a trigger check.
export function IgnoreInvalid({ children }: { readonly children: ComponentChildren }) {
  return <InvalidFields.Provider value={ignore}>{children}</InvalidFields.Provider>;
}

// Number fields of a form that is not part of the document. Text that is not a number stops
// the form, not the save of the document.
export function useInvalid(): readonly [InvalidReport, boolean] {
  const [fields, setFields] = useState<ReadonlySet<string>>(new Set());
  const report = useCallback((field: string, label: string | undefined) => {
    setFields((current) => {
      if ((label !== undefined) === current.has(field)) return current;
      const next = new Set(current);
      if (label === undefined) next.delete(field);
      else next.add(field);
      return next;
    });
  }, []);
  return [report, fields.size > 0];
}

// Keeps the typed text, so "0." or "1e" can be typed. Calls onChange with a finite number,
// or undefined for an empty field. Other text stays in the field and shows as invalid.
export function NumberField(
  props: Base & { readonly value: number | undefined; readonly onChange: (value: number | undefined) => void; readonly min?: number; readonly max?: number; readonly integer?: boolean },
) {
  const { id, label, hiddenLabel, value, onChange, min, max, integer } = props;
  const [text, setText] = useState(value === undefined ? '' : String(value));
  useEffect(() => {
    // Only an outside change of value (undo, template) replaces the typed text.
    if (text.trim() === '' ? value !== undefined : Number(text) !== value) setText(value === undefined ? '' : String(value));
  }, [value]);
  const parsed = text.trim() === '' ? undefined : Number(text);
  const notNumber = parsed !== undefined && !Number.isFinite(parsed);
  const invalid = notNumber || (parsed !== undefined && ((min !== undefined && parsed < min) || (max !== undefined && parsed > max) || (integer === true && !Number.isInteger(parsed))));
  const report = useContext(InvalidFields);
  useEffect(() => {
    report(id, notNumber ? label : undefined);
    return () => {
      report(id, undefined);
    };
  }, [report, id, label, notNumber]);
  return (
    <>
      <Label {...props} />
      <input
        id={id}
        inputMode="decimal"
        value={text}
        aria-label={hiddenLabel === true ? label : undefined}
        aria-describedby={described(props)}
        aria-invalid={invalid ? 'true' : undefined}
        onInput={(event) => {
          const next = event.currentTarget.value;
          setText(next);
          const number = next.trim() === '' ? undefined : Number(next);
          if (number === undefined) onChange(undefined);
          else if (Number.isFinite(number)) onChange(number);
        }}
      />
    </>
  );
}

export function SelectField<T extends string>(
  props: Base & { readonly value: T | undefined; readonly options: readonly (readonly [T, string])[]; readonly onChange: (value: T | undefined) => void; readonly emptyLabel?: string },
) {
  const { id, label, hiddenLabel, value, options, onChange, emptyLabel } = props;
  return (
    <>
      <Label {...props} />
      <select
        id={id}
        value={value ?? ''}
        aria-label={hiddenLabel === true ? label : undefined}
        aria-describedby={described(props)}
        onChange={(event) => {
          const next = event.currentTarget.value;
          onChange(next === '' ? undefined : (next as T));
        }}
      >
        {emptyLabel !== undefined && <option value="">{emptyLabel}</option>}
        {options.map(([key, text]) => (
          <option key={key} value={key}>
            {text}
          </option>
        ))}
      </select>
    </>
  );
}

export function Checkboxes<T extends string>({
  legend,
  name,
  options,
  value,
  onChange,
}: {
  readonly legend: string;
  readonly name: string;
  readonly options: readonly (readonly [T, string])[];
  readonly value: readonly string[];
  readonly onChange: (value: T[]) => void;
}) {
  return (
    <fieldset class="checks">
      <legend>{legend}</legend>
      {options.map(([key, text]) => (
        <label key={key} class="check">
          <input
            type="checkbox"
            name={name}
            checked={value.includes(key)}
            onChange={(event) => {
              const keep = options.map(([option]) => option).filter((option) => (option === key ? event.currentTarget.checked : value.includes(option)));
              onChange(keep);
            }}
          />
          {text}
        </label>
      ))}
    </fieldset>
  );
}

// One item per line. Keeps the typed text, so an empty new line stays while the user types.
export function LinesField(props: Base & { readonly value: readonly string[]; readonly onChange: (value: string[]) => void }) {
  const { id, label, hiddenLabel, value, onChange } = props;
  const [text, setText] = useState(value.join('\n'));
  useEffect(() => {
    if (lines(text).join('\n') !== value.join('\n')) setText(value.join('\n'));
  }, [value.join('\n')]);
  return (
    <>
      <Label {...props} />
      <textarea
        id={id}
        rows={Math.max(3, value.length + 1)}
        value={text}
        aria-label={hiddenLabel === true ? label : undefined}
        aria-describedby={described(props)}
        onInput={(event) => {
          setText(event.currentTarget.value);
          onChange(lines(event.currentTarget.value));
        }}
      />
    </>
  );
}
