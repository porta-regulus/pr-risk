// Appetite statements in the layout of SP 800-221r1 Table 9, and a check of trigger values
// (SPEC.md Sec. 6.5, golden test G2). The check stores nothing. Observations belong to S6.
import { useState } from 'preact/hooks';
import { boundaryGaps, evaluateStatement, type Values } from '../monitor/triggers';
import type { RiskDocument } from '../schema/types';
import { Explain } from './explain';
import { IgnoreInvalid, NumberField } from './fields';

type Statement = NonNullable<NonNullable<RiskDocument['appetite']>['statements']>[number];

// The 6 rows of Table 9, in its order.
export const TABLE9_ROWS: readonly (readonly [string, (statement: Statement) => readonly string[]])[] = [
  ['Risk appetite statement', (statement) => [statement.appetite]],
  ['Risk tolerance statement', (statement) => (statement.tolerances ?? []).map((item) => item.text)],
  ['Controls', (statement) => statement.controls ?? []],
  ['Key performance indicators', (statement) => (statement.indicators ?? []).filter((item) => item.kind === 'kpi').map((item) => item.text)],
  ['Leading key risk indicators', (statement) => (statement.indicators ?? []).filter((item) => item.kind === 'leading-kri').map((item) => item.text)],
  ['Lagging key risk indicators', (statement) => (statement.indicators ?? []).filter((item) => item.kind === 'lagging-kri').map((item) => item.text)],
];

function Cell({ items }: { readonly items: readonly string[] }) {
  if (items.length === 0) return <span class="muted">None</span>;
  if (items.length === 1) return <>{items[0]}</>;
  return (
    <ul class="cell-list">
      {items.map((item, i) => (
        <li key={i}>{item}</li>
      ))}
    </ul>
  );
}

export function Table9View({ statements }: { readonly statements: readonly Statement[] }) {
  return (
    <>
    <Explain id="appetite-table" topic="context.appetite-table" name="the table of appetite statements" visible="How to read this table" />
    {/* Focusable, so a keyboard can scroll the table on a narrow screen (WCAG 2.1.1). */}
    <div class="table-box" tabIndex={0} role="region" aria-label="Appetite statements, scroll box">
      <table class="table9" aria-label="Appetite statements side by side">
        <thead>
          <tr>
            <th scope="col">Row</th>
            {statements.map((statement) => (
              <th scope="col" key={statement.id}>
                {statement.title ?? statement.id}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {TABLE9_ROWS.map(([name, items]) => (
            <tr key={name}>
              <th scope="row">{name}</th>
              {statements.map((statement) => (
                <td key={statement.id}>
                  <Cell items={items(statement)} />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
    </>
  );
}

// The metrics of a statement's triggers, in order of first use.
export function metricsOf(statement: Statement): { metric: string; unit?: string }[] {
  const seen = new Map<string, string | undefined>();
  const triggers = [...(statement.tolerances ?? []).map((item) => item.breachWhen), ...(statement.indicators ?? []).map((item) => item.firesWhen)];
  for (const condition of triggers.flatMap((trigger) => trigger?.conditions ?? [])) {
    if (!seen.has(condition.metric)) seen.set(condition.metric, condition.unit);
  }
  return [...seen].map(([metric, unit]) => (unit === undefined ? { metric } : { metric, unit }));
}

export const KIND_TEXT: Readonly<Record<string, string>> = { kpi: 'KPI', 'leading-kri': 'Leading KRI', 'lagging-kri': 'Lagging KRI' };

export function TriggerCheck({ statement }: { readonly statement: Statement }) {
  const [values, setValues] = useState<Values>({});
  const metrics = metricsOf(statement);
  if (metrics.length === 0) return <p class="muted">This statement has no machine-readable trigger.</p>;
  const result = evaluateStatement(statement, values);
  const fired = [
    ...result.indicators.filter((item) => item.fired).map((item) => `${KIND_TEXT[item.kind] ?? item.kind} ${item.id} fires`),
    ...result.tolerances.filter((item) => item.breached).map((item) => `Tolerance ${item.id} is breached`),
  ];
  // A trigger with a missing value is not checked. It must not read as "does not fire".
  const unchecked = [
    ...result.indicators.filter((item) => item.missing.length > 0).map((item) => ({ name: `${KIND_TEXT[item.kind] ?? item.kind} ${item.id}`, missing: item.missing })),
    ...result.tolerances.filter((item) => item.missing.length > 0).map((item) => ({ name: `Tolerance ${item.id}`, missing: item.missing })),
  ];
  const checked = result.indicators.length + result.tolerances.length - unchecked.length;
  const entered = Object.keys(values).length > 0;
  const gaps = boundaryGaps(statement);
  return (
    <div class="check-box" data-statement={statement.id}>
      <IgnoreInvalid>
        <div class="field-row">
          {metrics.map(({ metric, unit }) => (
            <div class="field" key={metric}>
              <NumberField
                id={`check-${statement.id}-${metric}`}
                label={unit === undefined ? metric : `${metric} (${unit})`}
                help="context.trigger-value"
                value={values[metric]}
                onChange={(value) => {
                  const others = Object.entries(values).filter(([name]) => name !== metric);
                  setValues(Object.fromEntries(value === undefined ? others : [...others, [metric, value]]));
                }}
              />
            </div>
          ))}
        </div>
      </IgnoreInvalid>
      <div role="status" aria-live="polite" class="check-result">
        {!entered ? (
          <p class="muted">Type values to see which indicators fire and which tolerances are breached.</p>
        ) : fired.length > 0 ? (
          <ul>
            {fired.map((text) => (
              <li key={text}>{text}</li>
            ))}
          </ul>
        ) : checked === 0 ? null : (
          <p>{unchecked.length === 0 ? 'Nothing fires.' : 'Nothing fires among the checked triggers.'}</p>
        )}
        {entered && unchecked.length > 0 && (
          <p class="unchecked">
            Not checked, because a value is missing. {unchecked.map((item) => `${item.name} needs ${item.missing.join(' and ')}`).join('. ')}.
          </p>
        )}
        {result.inGap.map((gap) => (
          <p class="banner" key={gap.metric}>
            The value {String(gap.threshold)} of {gap.metric} is in a boundary gap. One trigger uses "above" and another "below" {String(gap.threshold)}, and none includes it. Change one operator to include the value.
          </p>
        ))}
      </div>
      {gaps.length > 0 && result.inGap.length === 0 && (
        <p class="muted">
          Boundary gap: {gaps.map((gap) => `${gap.metric} at ${String(gap.threshold)}`).join(', ')}. No trigger covers this value.
        </p>
      )}
    </div>
  );
}
