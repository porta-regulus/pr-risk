// S2 appetite part (SPEC.md Sec. 6.5 and 8.9). Capacity, tolerance curve, and appetite
// statements with tolerances, controls and indicators in the shape of Table 9.
import type { RiskDocument } from '../schema/types';
import { defaultTolerancePoints, draftList, nextId, type TolerancePoint, withSection, withValue } from './edit';
import { Explain } from './explain';
import { Checkboxes, LinesField, NumberField, SelectField, TextField } from './fields';
import { More } from './section';
import { Table9View, TriggerCheck } from './table9';
import { TABLE_2, templateStatement } from './templates';

type Appetite = NonNullable<RiskDocument['appetite']>;
type Statement = NonNullable<Appetite['statements']>[number];
type Tolerance = NonNullable<Statement['tolerances']>[number];
type Indicator = NonNullable<Statement['indicators']>[number];
type Trigger = NonNullable<Tolerance['breachWhen']>;
type Condition = Trigger['conditions'][number];
type Update = (change: (doc: RiskDocument) => RiskDocument) => void;

const OPERATORS: readonly (readonly [Condition['operator'], string])[] = [
  ['>', 'above'],
  ['>=', 'at or above'],
  ['<', 'below'],
  ['<=', 'at or below'],
  ['==', 'equal to'],
  ['!=', 'not equal to'],
];
const KINDS: readonly (readonly [Indicator['kind'], string])[] = [
  ['kpi', 'KPI'],
  ['leading-kri', 'Leading KRI'],
  ['lagging-kri', 'Lagging KRI'],
];
const CATEGORIES: readonly (readonly [NonNullable<Statement['categoryCodes']>[number], string])[] = [
  ['ict', 'ICT'],
  ['financial', 'Financial'],
  ['legal', 'Legal'],
  ['operational', 'Operational'],
  ['strategic', 'Strategic'],
  ['safety', 'Safety'],
  ['reputation', 'Reputation'],
];

// A row the user has added but not filled in yet. The schema refuses it, so the screen
// shows the error and saves nothing until the row is complete.
const unfilled = <T,>(value: Partial<T>): T => value as T;

const replaceAt = <T,>(items: readonly T[], index: number, item: T | undefined): T[] =>
  item === undefined ? items.filter((_, i) => i !== index) : items.map((old, i) => (i === index ? item : old));

function TriggerEditor({ id, label, trigger, onChange }: { readonly id: string; readonly label: string; readonly trigger: Trigger | undefined; readonly onChange: (trigger: Trigger | undefined) => void }) {
  if (trigger === undefined) {
    return (
      <button type="button" class="quiet" onClick={() => {
          onChange({ combine: 'all', conditions: [unfilled<Condition>({ operator: '>' })] });
        }}>
        Add a trigger to {label}
      </button>
    );
  }
  const setCondition = (index: number, condition: Condition | undefined): void => {
    const conditions = replaceAt(trigger.conditions, index, condition);
    onChange(conditions.length === 0 ? undefined : { ...trigger, conditions: draftList<Trigger['conditions']>(conditions) });
  };
  return (
    <div class="trigger">
      <SelectField
        id={`${id}-combine`}
        label={`Trigger of ${label} fires when`}
        help="context.trigger-combine"
        value={trigger.combine}
        options={[
          ['all', 'all conditions hold'],
          ['any', 'any condition holds'],
        ]}
        onChange={(combine) => {
          onChange({ ...trigger, combine: combine ?? 'all' });
        }}
      />
      <Explain id={`${id}-conditions`} topic="context.trigger-conditions" name={`Conditions of ${label}`} />
      <div class="table-box">
        <table>
          <thead>
            <tr>
              <th scope="col">Metric</th>
              <th scope="col">Operator</th>
              <th scope="col">Threshold</th>
              <th scope="col">Unit</th>
              <th scope="col">
                <span class="visually-hidden">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {trigger.conditions.map((condition, i) => {
              const row = `${label} condition ${String(i + 1)}`;
              return (
                <tr key={i}>
                  <td>
                    <TextField id={`${id}-c${String(i)}-metric`} label={`${row} metric`} hiddenLabel value={condition.metric} onChange={(metric) => {
                        setCondition(i, { ...condition, metric });
                      }} />
                  </td>
                  <td>
                    <SelectField id={`${id}-c${String(i)}-operator`} label={`${row} operator`} hiddenLabel value={condition.operator} options={OPERATORS} onChange={(operator) => {
                        setCondition(i, { ...condition, operator: operator ?? '>' });
                      }} />
                  </td>
                  <td>
                    <NumberField id={`${id}-c${String(i)}-threshold`} label={`${row} threshold`} hiddenLabel value={condition.threshold} onChange={(threshold) => {
                        setCondition(i, withValue(condition, 'threshold', threshold));
                      }} />
                  </td>
                  <td>
                    <TextField id={`${id}-c${String(i)}-unit`} label={`${row} unit`} hiddenLabel value={condition.unit} onChange={(unit) => {
                        setCondition(i, withValue(condition, 'unit', unit));
                      }} />
                  </td>
                  <td>
                    <button type="button" class="quiet" aria-label={`Remove ${row}`} onClick={() => {
                        setCondition(i, undefined);
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
      <div class="button-row">
        <button type="button" class="quiet" onClick={() => {
            onChange({ ...trigger, conditions: draftList<Trigger['conditions']>([...trigger.conditions, unfilled<Condition>({ operator: '>' })]) });
          }}>
          Add a condition
        </button>
        <button type="button" class="quiet" onClick={() => {
            onChange(undefined);
          }}>
          Remove the trigger
        </button>
      </div>
      <TextField id={`${id}-note`} label="Interpretation note" help="context.trigger-note" value={trigger.interpretationNote} onChange={(note) => {
          onChange(withValue(trigger, 'interpretationNote', note));
        }} />
    </div>
  );
}

function StatementEditor({ statement, onChange }: { readonly statement: Statement; readonly onChange: (statement: Statement | undefined) => void }) {
  const id = `st-${statement.id}`;
  const tolerances = statement.tolerances ?? [];
  const indicators = statement.indicators ?? [];
  const set = <K extends keyof Statement>(key: K, value: Statement[K] | undefined): void => {
    onChange(withValue(statement, key, value));
  };
  return (
    <details class="editor">
      <summary>Edit {statement.title ?? statement.id}</summary>
      <TextField id={`${id}-title`} label="Title" help="context.statement-title" value={statement.title} onChange={(title) => {
          set('title', title);
        }} />
      <TextField id={`${id}-appetite`} label="Risk appetite statement" help="context.statement-appetite" multiline value={statement.appetite} onChange={(appetite) => {
          onChange({ ...statement, appetite });
        }} />
      <Checkboxes legend="Risk categories" name={`${id}-categories`} help="context.statement-categories" options={CATEGORIES} value={statement.categoryCodes ?? []} onChange={(codes) => {
          set('categoryCodes', codes);
        }} />

      <h4>Risk tolerance statements</h4>
      {tolerances.map((tolerance, i) => (
        <div class="sub-editor" key={i}>
          <TextField id={`${id}-tol${String(i)}-id`} label="Tolerance ID" help="context.tolerance-id" value={tolerance.id} onChange={(value) => {
              set('tolerances', replaceAt(tolerances, i, { ...tolerance, id: value }));
            }} />
          <TextField id={`${id}-tol${String(i)}-text`} label="Tolerance statement" help="context.tolerance-text" multiline value={tolerance.text} onChange={(text) => {
              set('tolerances', replaceAt(tolerances, i, { ...tolerance, text }));
            }} />
          <TriggerEditor id={`${id}-tol${String(i)}-trigger`} label={`tolerance ${tolerance.id}`} trigger={tolerance.breachWhen} onChange={(breachWhen) => {
              set('tolerances', replaceAt(tolerances, i, withValue(tolerance, 'breachWhen', breachWhen)));
            }} />
          <button type="button" class="quiet" onClick={() => {
              set('tolerances', replaceAt(tolerances, i, undefined));
            }}>
            Remove tolerance {tolerance.id}
          </button>
        </div>
      ))}
      <button type="button" class="quiet" onClick={() => {
          set('tolerances', [...tolerances, unfilled<Tolerance>({ id: nextId(`${statement.id}-TOL`, tolerances.map((item) => item.id)) })]);
        }}>
        Add a tolerance
      </button>

      <LinesField id={`${id}-controls`} label="Controls, one per line" help="context.controls" value={statement.controls ?? []} onChange={(controls) => {
          set('controls', controls);
        }} />

      <h4>Indicators</h4>
      {indicators.map((indicator, i) => (
        <div class="sub-editor" key={i}>
          <div class="field-row">
            <div class="field">
              <TextField id={`${id}-ind${String(i)}-id`} label="Indicator ID" help="context.indicator-id" value={indicator.id} onChange={(value) => {
                  set('indicators', replaceAt(indicators, i, { ...indicator, id: value }));
                }} />
            </div>
            <div class="field">
              <SelectField id={`${id}-ind${String(i)}-kind`} label="Kind" help="context.indicator-kind" value={indicator.kind} options={KINDS} onChange={(kind) => {
                  set('indicators', replaceAt(indicators, i, { ...indicator, kind: kind ?? 'kpi' }));
                }} />
            </div>
          </div>
          <TextField id={`${id}-ind${String(i)}-text`} label="Indicator" help="context.indicator-text" multiline value={indicator.text} onChange={(text) => {
              set('indicators', replaceAt(indicators, i, { ...indicator, text }));
            }} />
          <TriggerEditor id={`${id}-ind${String(i)}-trigger`} label={`indicator ${indicator.id}`} trigger={indicator.firesWhen} onChange={(firesWhen) => {
              set('indicators', replaceAt(indicators, i, withValue(indicator, 'firesWhen', firesWhen)));
            }} />
          <button type="button" class="quiet" onClick={() => {
              set('indicators', replaceAt(indicators, i, undefined));
            }}>
            Remove indicator {indicator.id}
          </button>
        </div>
      ))}
      <button type="button" class="quiet" onClick={() => {
          set('indicators', [...indicators, unfilled<Indicator>({ id: nextId(`${statement.id}-IND`, indicators.map((item) => item.id)), kind: 'leading-kri' })]);
        }}>
        Add an indicator
      </button>

      <button type="button" class="danger" onClick={() => {
          onChange(undefined);
        }}>
        Remove statement {statement.title ?? statement.id}
      </button>
    </details>
  );
}

export function AppetiteSection({ doc, update }: { readonly doc: RiskDocument; readonly update: Update }) {
  const appetite: Appetite = doc.appetite ?? {};
  const currency = doc.document.currency;
  const points: readonly TolerancePoint[] = appetite.toleranceCurve?.points ?? [];
  const statements = appetite.statements ?? [];
  const setAppetite = <K extends keyof Appetite>(key: K, value: Appetite[K] | undefined): void => {
    update((current) => withSection(current, 'appetite', withValue(current.appetite, key, value)));
  };
  const setCapacity = (change: { readonly amount?: number | undefined; readonly rationale?: string | undefined }): void => {
    const next = { ...(appetite.capacity ?? {}), ...change };
    const clean = withValue(withValue(next, 'amount', next.amount), 'rationale', next.rationale);
    setAppetite('capacity', clean as Appetite['capacity']);
  };
  type Curve = NonNullable<Appetite['toleranceCurve']>;
  const setCurve = (change: { readonly points?: readonly TolerancePoint[]; readonly approvedBy?: string; readonly approvedOn?: string }): void => {
    const old = appetite.toleranceCurve;
    const next = { ...old, ...change, points: draftList<Curve['points']>(change.points ?? points) };
    // Without points there is no curve, so its approval goes too.
    setAppetite('toleranceCurve', next.points.length === 0 ? undefined : withValue(withValue(next as Curve, 'approvedBy', next.approvedBy), 'approvedOn', next.approvedOn));
  };
  const setPoint = (index: number, point: TolerancePoint | undefined): void => {
    setCurve({ points: replaceAt(points, index, point) });
  };
  const capacity = appetite.capacity?.amount;

  return (
    <section aria-labelledby="appetite-title" class="panel">
      <h2 id="appetite-title">Capacity, appetite and tolerance</h2>
      <Explain id="appetite-section" topic="context.appetite" name="Capacity, appetite and tolerance" visible="About this section" />

      <h3>Risk capacity</h3>
      <p class="muted">The maximum amount of risk that the organization can absorb. Screen S4 shows the probability of an annual loss above it.</p>
      <div class="field-row">
        <div class="field">
          <NumberField id="capacity-amount" label={`Capacity (${currency})`} help="context.capacity" min={0} value={capacity} onChange={(amount) => {
              setCapacity({ amount });
            }} />
        </div>
        <div class="field wide">
          <TextField id="capacity-rationale" label="Rationale for the capacity" help="context.capacity-rationale" value={appetite.capacity?.rationale} onChange={(rationale) => {
              setCapacity({ rationale });
            }} />
        </div>
      </div>

      <h3>Tolerance curve</h3>
      <p class="muted" id="curve-help">
        The highest probability per year that you accept for an annual loss above each amount. Losses go up and probabilities go down from row to row (rule V-12). The curve sets no limit below its first point.
      </p>
      <Explain id="tolerance-curve" topic="context.tolerance-curve" name="Tolerance curve" />
      <div class="table-box">
        <table aria-describedby="curve-help">
          <thead>
            <tr>
              <th scope="col">Annual loss above ({currency})</th>
              <th scope="col">Highest accepted probability</th>
              <th scope="col">
                <span class="visually-hidden">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {points.map((point, i) => (
              <tr key={i}>
                <td>
                  <NumberField id={`point-${String(i)}-loss`} label={`Point ${String(i + 1)} loss`} hiddenLabel min={0} value={point.loss} onChange={(loss) => {
                      setPoint(i, withValue(point, 'loss', loss));
                    }} />
                </td>
                <td>
                  <NumberField id={`point-${String(i)}-probability`} label={`Point ${String(i + 1)} probability`} hiddenLabel min={0} max={1} value={point.maxExceedanceProbability} onChange={(probability) => {
                      setPoint(i, withValue(point, 'maxExceedanceProbability', probability));
                    }} />
                </td>
                <td>
                  <button type="button" class="quiet" aria-label={`Remove point ${String(i + 1)}`} onClick={() => {
                      setPoint(i, undefined);
                    }}>
                    Remove
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div class="button-row">
        <button type="button" class="quiet" onClick={() => {
            setCurve({ points: [...points, unfilled<TolerancePoint>({})] });
          }}>
          Add a point
        </button>
        <button type="button" class="quiet" disabled={capacity === undefined || capacity <= 0} onClick={() => {
            if (capacity !== undefined) setCurve({ points: defaultTolerancePoints(capacity) });
          }}>
          Use the starting points from capacity
        </button>
      </div>
      <Explain id="curve-starting-points" topic="context.curve-starting-points" name="Use the starting points from capacity" />
      <p class="hint">The starting points are 2%, 10%, 33% and 100% of capacity at probabilities 0.5, 0.2, 0.05 and 0.01. They are a starting point, not advice.</p>
      {points.length > 0 && (
        <div class="field-row">
          <div class="field">
            <TextField id="curve-approved-by" label="Approved by" help="context.curve-approved-by" value={appetite.toleranceCurve?.approvedBy} onChange={(approvedBy) => {
                setCurve({ approvedBy });
              }} />
          </div>
          <div class="field">
            <TextField id="curve-approved-on" label="Approved on" help="context.curve-approved-on" type="date" value={appetite.toleranceCurve?.approvedOn} onChange={(approvedOn) => {
                setCurve({ approvedOn });
              }} />
          </div>
        </div>
      )}

      <More id="statements" label={`Appetite and tolerance statements (optional, ${String(statements.length)})`}>
        <h3>Appetite and tolerance statements</h3>
        <Explain id="statements" topic="context.statements" name="Appetite and tolerance statements" />
        {statements.length === 0 ? (
          <p class="muted">No statement yet. Each statement holds tolerances, controls and indicators in one table.</p>
        ) : (
          <Table9View statements={statements} />
        )}
        {statements.map((statement, i) => (
          <div class="statement" key={i}>
            <h4>Check values for {statement.title ?? statement.id}</h4>
            <TriggerCheck statement={statement} />
            <StatementEditor statement={statement} onChange={(next) => {
                setAppetite('statements', replaceAt(statements, i, next));
              }} />
          </div>
        ))}
        <button type="button" class="quiet" onClick={() => {
            const id = nextId('AS-', statements.map((item) => item.id));
            setAppetite('statements', [...statements, unfilled<Statement>({ id, title: `Statement ${id}` })]);
          }}>
          Add a statement
        </button>
        <details class="help">
          <summary>Example statements to start from</summary>
          <p class="hint">
            Five example pairs from NIST, quoted exactly. Use one as a starting point, then change the words to fit your organization and add the triggers that measure the
            tolerance.
          </p>
          <Explain id="use-example" topic="context.use-example" name="Example statements" />
          {TABLE_2.map((template) => (
            <div class="sub-editor" key={template.enterprise}>
              <p>
                <strong>{template.enterprise}</strong>
              </p>
              <p>Risk appetite. {template.appetite}</p>
              <p>Risk tolerance. {template.tolerance}</p>
              <button type="button" class="quiet" onClick={() => {
                  setAppetite('statements', [...statements, templateStatement(statements, template)]);
                }}>
                Use the {template.enterprise} example as a new statement
              </button>
            </div>
          ))}
        </details>
      </More>
    </section>
  );
}
