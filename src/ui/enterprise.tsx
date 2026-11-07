// Screen S7 Enterprise view (SPEC.md Sec. 5, 6.13, 6.15, 6.16). The enterprise risk register in
// the layout of SP 800-221r1 Fig. 10, the enterprise risk profile by objective in the layout of
// Fig. 11, the aggregation and normalization of Table 10 with summary entries, and the
// portfolio view by register and period of Table 7. The views read the stored numbers and
// labels, so the screen runs no simulation.
import { useState } from 'preact/hooks';
import { childEntries, type ChildEntry, mergeResult, parentRegisters, referencesTo, summaryEntries, withMerge, withoutRisk } from '../enterprise/normalize';
import { closePeriod, periodRisks } from '../enterprise/period';
import { type Assessed, type ErpBlock, erpBlocks, isPlaceholder, portfolioRow, withoutObjective } from '../enterprise/profile';
import type { PriorityNumbers } from '../engine/prioritize';
import type { DisparityLayout, ResponseCostRule } from '../import/rollup';
import { lint } from '../schema/rules';
import type { Register, Risk, RiskDocument } from '../schema/types';
import { nextId, withValue } from './edit';
import { DocumentScreen, type ScreenName, type Update } from './editor';
import { ErrView } from './err';
import { Explain } from './explain';
import { InvalidFields, NumberField, SelectField, TextField, useInvalid } from './fields';
import { registerTree } from './identify';
import { useEngine } from './jobs';
import { simulationKey } from './prioritize';
import { money, probability, sourceLine } from './report';
import { CODES } from './risk-editor';
import { Section } from './section';

const CODE_TEXT: ReadonlyMap<string, string> = new Map(CODES);

const LAYOUTS: readonly (readonly [DisparityLayout, string])[] = [
  ['one-row-all-responses', 'One row with all responses'],
  ['one-row-per-response', 'One row per response'],
];

const COST_RULES: readonly (readonly [ResponseCostRule, string])[] = [
  ['total', 'Total of the sources'],
  ['exposure-weighted-average', 'Average weighted by exposure rating'],
];

export function assessedText(value: Assessed | undefined, factor: 'impact' | 'likelihood'): string {
  if (value?.label !== undefined) return value.label;
  if (value?.value === undefined) return 'Not set';
  return factor === 'impact' ? money(value.value) : probability(value.value);
}

// The stored number of an entry, with its label. A placeholder is not an estimate.
function entryText(doc: RiskDocument, risk: Risk, field: 'riskLikelihood' | 'riskImpact' | 'exposureRating'): string {
  const label = field === 'riskLikelihood' ? risk.riskLikelihoodLabel : field === 'riskImpact' ? risk.riskImpactLabel : risk.exposureRatingLabel;
  if (isPlaceholder(doc, risk)) return label ?? 'Not estimated';
  const number = field === 'riskLikelihood' ? probability(risk[field]) : money(risk[field]);
  return label === undefined ? number : `${label} (${number})`;
}

const registerOptions = (doc: RiskDocument): (readonly [string, string])[] => registerTree(doc.registers).map(({ register }) => [register.id, register.title] as const);

function ErpTable({ block, index }: { readonly block: ErpBlock; readonly index: number }) {
  const caption = `erp-caption-${String(index)}`;
  return (
    <div class="table-box erp-block" tabIndex={0} role="region" aria-labelledby={caption} data-objective={block.objective.id}>
      <table class="erp">
        <caption id={caption}>
          <span class="erp-kind">{block.heading}</span> <span class="erp-statement">{block.objective.statement}</span>
        </caption>
        <thead>
          <tr>
            <th scope="col" rowSpan={2}>
              Risk Description
            </th>
            <th scope="col" rowSpan={2}>
              Exposure Factors
            </th>
            <th scope="colgroup" colSpan={3}>
              Assessment
            </th>
            <th scope="col" rowSpan={2}>
              Current Risk Response
            </th>
            <th scope="col" rowSpan={2}>
              Proposed Risk Response
            </th>
            <th scope="col" rowSpan={2}>
              Risk Owner
            </th>
          </tr>
          <tr>
            <th scope="col">Last</th>
            <th scope="col">Current</th>
            <th scope="col">Residual</th>
          </tr>
        </thead>
        {block.rows.map((row) => (
          <tbody key={row.risk.riskId} data-risk={row.risk.riskId}>
            <tr data-factor="impact">
              <td rowSpan={2}>{row.risk.riskDescription}</td>
              <th scope="row">Impact</th>
              {row.impact.map((value, i) => (
                <td key={i} class="assessed">
                  {assessedText(value, 'impact')}
                </td>
              ))}
              <td rowSpan={2} class="current-response">
                {row.currentResponse}
              </td>
              <td rowSpan={2} class="proposed-response">
                {row.proposedResponse}
              </td>
              <td rowSpan={2} class="owner">
                {row.owner}
              </td>
            </tr>
            <tr data-factor="likelihood">
              <th scope="row">Likelihood</th>
              {row.likelihood.map((value, i) => (
                <td key={i} class="assessed">
                  {assessedText(value, 'likelihood')}
                </td>
              ))}
            </tr>
          </tbody>
        ))}
      </table>
    </div>
  );
}

function ErpView({ doc }: { readonly doc: RiskDocument }) {
  const [chosen, setChosen] = useState<string>();
  const scope = doc.registers.some((register) => register.id === chosen) ? chosen : undefined;
  const blocks = erpBlocks(doc, scope);
  const missing = withoutObjective(doc, scope);
  return (
    <Section id="erp" title="Enterprise risk profile by objective" folded help="enterprise.erp">
      <div class="field">
        <SelectField id="erp-register" label="Registers in the profile" help="enterprise.erp-register" value={scope} emptyLabel="All registers" options={registerOptions(doc)} onChange={setChosen} />
      </div>
      <p class="hint">
        A register includes the registers below it, and a summary entry stands for its sources. Last comes from the previous assessment, Current from the register entry and Residual
        from the planned values in the Detail tab. Closed risks are not in the profile.
      </p>
      <Explain id="erp-table" topic="enterprise.erp-table" name="the profile tables" visible="How to read the profile" />
      {blocks.length === 0 ? (
        <p class="muted">No risk of these registers supports an objective. Link the risks to the objectives in the Links tab on the screen Identify and analyze.</p>
      ) : (
        blocks.map((block, index) => <ErpTable key={block.objective.id} block={block} index={index} />)
      )}
      {missing.length > 0 && (
        <p class="warnings">
          L-09 {missing.map((risk) => risk.riskId).join(', ')} {missing.length === 1 ? 'supports' : 'support'} no objective, so the profile does not show{' '}
          {missing.length === 1 ? 'it' : 'them'}.
        </p>
      )}
    </Section>
  );
}

function EntryTable({
  doc,
  code,
  entries,
  selected,
  onToggle,
}: {
  readonly doc: RiskDocument;
  readonly code: string;
  readonly entries: readonly ChildEntry[];
  readonly selected: ReadonlySet<string>;
  readonly onToggle: (riskId: string, on: boolean) => void;
}) {
  const caption = `entries-${code}`;
  return (
    <div class="table-box" tabIndex={0} role="region" aria-labelledby={caption}>
      <table class="entries" data-category={code}>
        <caption id={caption}>
          {CODE_TEXT.get(code) ?? code}, {entries.length} {entries.length === 1 ? 'entry' : 'entries'}
        </caption>
        <thead>
          <tr>
            <th scope="col">Select</th>
            <th scope="col">Source</th>
            <th scope="col">Register</th>
            <th scope="col">Risk Description</th>
            <th scope="col">Likelihood</th>
            <th scope="col">Impact</th>
            <th scope="col">Exposure</th>
            <th scope="col">Response</th>
            <th scope="col">Risk Owner</th>
            <th scope="col">Note</th>
          </tr>
        </thead>
        <tbody>
          {entries.map(({ risk, summarizedBy, escalate }) => (
            <tr key={risk.riskId} data-risk={risk.riskId}>
              <td>
                <input
                  type="checkbox"
                  aria-label={`Select ${risk.riskId}`}
                  disabled={summarizedBy.length > 0}
                  checked={selected.has(risk.riskId) && summarizedBy.length === 0}
                  onChange={(event) => {
                    onToggle(risk.riskId, event.currentTarget.checked);
                  }}
                />
              </td>
              <td class="id">{risk.riskId}</td>
              <td>{risk.registerId}</td>
              <td>{risk.riskDescription}</td>
              <td>{entryText(doc, risk, 'riskLikelihood')}</td>
              <td>{entryText(doc, risk, 'riskImpact')}</td>
              <td>{entryText(doc, risk, 'exposureRating')}</td>
              <td>{risk.riskResponseType.join(', ')}</td>
              <td>{risk.riskOwnerPointOfContact}</td>
              <td class="note">
                {summarizedBy.length > 0 && <span class="line">In {summarizedBy.join(', ')}</span>}
                {escalate && <span class="line escalate">Escalate. At or above the escalation threshold.</span>}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function MergeForm({ doc, parent, update }: { readonly doc: RiskDocument; readonly parent: Register; readonly update: Update }) {
  const groups = childEntries(doc, parent.id);
  // An entry that a summary entry holds cannot go into a second merge.
  const known = new Set(groups.flatMap((group) => group.entries.filter((entry) => entry.summarizedBy.length === 0).map((entry) => entry.risk.riskId)));
  const [picked, setPicked] = useState<ReadonlySet<string>>(new Set());
  const selected = new Set([...picked].filter((id) => known.has(id)));
  const defaultId = nextId(
    `${parent.id}-`,
    doc.risks.map((risk) => risk.riskId),
  );
  const [id, setId] = useState<string>();
  const [description, setDescription] = useState('');
  const [owner, setOwner] = useState<string>();
  const [layout, setLayout] = useState<DisparityLayout>('one-row-all-responses');
  const [costRule, setCostRule] = useState<ResponseCostRule>('total');
  const [response, setResponse] = useState('');
  const [priority, setPriority] = useState<number>();
  const [problems, setProblems] = useState<readonly string[]>([]);
  const [note, setNote] = useState<string>();
  const [report, invalid] = useInvalid();
  const threshold = doc.strategy?.escalationThreshold;
  const escalations = groups.flatMap((group) => group.entries).filter((entry) => entry.escalate).length;

  const merge = (): void => {
    const sources = doc.risks.filter((risk) => selected.has(risk.riskId));
    const result = mergeResult(doc, {
      sources,
      options: {
        id: (id ?? defaultId).trim(),
        registerId: parent.id,
        riskDescription: description.trim(),
        riskOwnerPointOfContact: (owner ?? parent.owner ?? '').trim(),
        layout,
        costRule,
        ...(response.trim() === '' ? {} : { riskResponseDescription: response.trim() }),
        ...(priority === undefined ? {} : { priority }),
      },
    });
    if ('problems' in result) {
      setProblems(result.problems);
      setNote(undefined);
      return;
    }
    update((current) => withMerge(current, result.rows));
    setProblems([]);
    setPicked(new Set());
    setId(undefined);
    setDescription('');
    setResponse('');
    setPriority(undefined);
    setNote(`${result.rows.map((row) => row.riskId).join(' and ')} ${result.rows.length === 1 ? 'is' : 'are'} added to ${parent.title}.`);
  };

  return (
    <>
      <h3>Entries of the child registers by category</h3>
      {threshold !== undefined && (
        <p class="hint">
          The escalation threshold is {money(threshold)} {doc.document.currency}. An entry with an exposure at or above it must appear in the parent register.{' '}
          {escalations === 0 ? 'No entry needs a summary entry.' : `${String(escalations)} ${escalations === 1 ? 'entry needs' : 'entries need'} a summary entry.`}
        </p>
      )}
      {groups.length === 0 ? (
        <p class="muted">The child registers hold no entry.</p>
      ) : (
        <>
          <Explain id="entries-table" topic="enterprise.entries-table" name="the tables of child entries" visible="How to read these tables" />
          {groups.map((group) => (
          <EntryTable
            key={group.code}
            doc={doc}
            code={group.code}
            entries={group.entries}
            selected={selected}
            onToggle={(riskId, on) => {
              setPicked((current) => {
                const next = new Set(current);
                if (on) next.add(riskId);
                else next.delete(riskId);
                return next;
              });
            }}
          />
          ))}
        </>
      )}
      <h3>De-duplicate and combine</h3>
      <p class="hint">
        Merge the selected entries into one summary entry of {parent.title}. Likelihood and impact take the optimistic, most likely and pessimistic values of the sources. The response
        cost is the total of the sources, or their average weighted by exposure rating. Summary entries never enter the simulation, so no risk counts twice.
      </p>
      <InvalidFields.Provider value={report}>
        <div class="field-row">
          <div class="field">
            <TextField id="merge-id" label="Id of the summary entry" help="enterprise.merge-id" value={id ?? defaultId} onChange={setId} />
          </div>
          <div class="field">
            <TextField
              id="merge-owner"
              label="Risk owner"
              hint="A person at the level of this register with the accountability and authority to manage the risk."
              help="enterprise.merge-owner"
              value={owner ?? parent.owner ?? ''}
              onChange={setOwner}
            />
          </div>
          <div class="field">
            <SelectField
              id="merge-layout"
              label="Different responses"
              hint="Choose how to show entries that have different responses."
              help="enterprise.merge-layout"
              value={layout}
              options={LAYOUTS}
              onChange={(value) => {
                setLayout(value ?? 'one-row-all-responses');
              }}
            />
          </div>
          <div class="field">
            <SelectField
              id="merge-cost"
              label="Response cost"
              hint="The weighted average counts a source with a larger exposure rating more. When every exposure rating is 0, it is the plain mean."
              help="enterprise.merge-cost"
              value={costRule}
              options={COST_RULES}
              onChange={(value) => {
                setCostRule(value ?? 'total');
              }}
            />
          </div>
          <div class="field">
            <NumberField id="merge-priority" label="Priority" help="enterprise.merge-priority" integer min={1} value={priority} onChange={setPriority} />
          </div>
          <div class="field wide">
            <TextField
              id="merge-description"
              label="Combined risk description"
              hint="One description for the scenario that the entries describe in different words."
              help="enterprise.merge-description"
              multiline
              value={description}
              onChange={setDescription}
            />
          </div>
          <div class="field wide">
            <TextField id="merge-response" label="Risk response description" hint="Leave it empty to name the sources." help="enterprise.merge-response" multiline value={response} onChange={setResponse} />
          </div>
        </div>
      </InvalidFields.Provider>
      <div class="button-row">
        <button type="button" disabled={invalid} onClick={merge}>
          Merge the {selected.size === 0 ? 'selected entries' : selected.size === 1 ? 'selected entry' : `${String(selected.size)} selected entries`}
        </button>
        <Explain id="merge" topic="enterprise.merge" name="Merge the selected entries" />
      </div>
      {problems.length > 0 && (
        <ul class="errors">
          {problems.map((problem) => (
            <li key={problem}>{problem}</li>
          ))}
        </ul>
      )}
      <p role="status" class="muted">
        {note}
      </p>
    </>
  );
}

const threeText = (point: { readonly optimistic: number; readonly mostLikely: number; readonly pessimistic: number } | undefined, value: number, format: (n: number) => string): string =>
  point === undefined ? format(value) : [point.optimistic, point.mostLikely, point.pessimistic].map(format).join(', ');

function SummaryTable({ doc, parent, update }: { readonly doc: RiskDocument; readonly parent: Register; readonly update: Update }) {
  const summaries = summaryEntries(doc, parent.id);
  const findings = lint(doc).filter((finding) => finding.rule === 'L-10' && (finding.riskIds ?? []).some((id) => summaries.some((risk) => risk.riskId === id)));
  const setPriority = (riskId: string, value: number | undefined): void => {
    update((current) => ({ ...current, risks: current.risks.map((risk) => (risk.riskId === riskId ? withValue(risk, 'priority', value) : risk)) }));
  };
  return (
    <>
      <h3>Summary entries of {parent.title}</h3>
      {summaries.length === 0 ? (
        <p class="muted">This register has no summary entry.</p>
      ) : (
        <>
        <Explain id="summary-table" topic="enterprise.summary-table" name="the table of summary entries" visible="How to read this table" />
        <div class="table-box" tabIndex={0} role="region" aria-labelledby="summary-caption">
          <table class="summaries">
            <caption id="summary-caption">
              Summary entries with the optimistic, most likely and pessimistic values of their sources. Likelihood and impact of the entry take the most likely values.
            </caption>
            <thead>
              <tr>
                <th scope="col">ID</th>
                <th scope="col">Risk Description</th>
                <th scope="col">Response</th>
                <th scope="col">Likelihood</th>
                <th scope="col">Impact</th>
                <th scope="col">Exposure</th>
                <th scope="col">Response cost</th>
                <th scope="col">Priority</th>
                <th scope="col">Risk Owner</th>
                <th scope="col">Sources</th>
                <th scope="col">Action</th>
              </tr>
            </thead>
            <tbody>
              {summaries.map((risk) => {
                const used = referencesTo(doc, risk.riskId);
                return (
                  <tr key={risk.riskId} data-risk={risk.riskId}>
                    <td class="id">{risk.riskId}</td>
                    <td class="description">{risk.riskDescription}</td>
                    <td class="types">{risk.riskResponseType.join(', ')}</td>
                    <td class="likelihood">{threeText(risk.rollUp?.likelihood, risk.riskLikelihood, probability)}</td>
                    <td class="impact">{threeText(risk.rollUp?.impact, risk.riskImpact, money)}</td>
                    <td>{money(risk.exposureRating)}</td>
                    <td class="cost">
                      {money(risk.riskResponseCost)}
                      <span class="sub">{risk.rollUp?.responseCostRule === 'exposure-weighted-average' ? 'Average weighted by exposure rating' : 'Total of the sources'}</span>
                    </td>
                    <td>
                      <NumberField
                        id={`summary-priority-${risk.riskId}`}
                        label={`Priority of ${risk.riskId}`}
                        hiddenLabel
                        integer
                        min={1}
                        value={risk.priority}
                        onChange={(value) => {
                          setPriority(risk.riskId, value);
                        }}
                      />
                    </td>
                    <td>{risk.riskOwnerPointOfContact}</td>
                    <td>
                      <ul class="cell-list sources">
                        {(risk.sourceRefs ?? []).map((ref) => {
                          const source = doc.risks.find((item) => item.registerId === ref.registerId && item.riskId === ref.riskId);
                          return (
                            <li key={`${ref.registerId}/${ref.riskId}`} data-source={ref.riskId}>
                              {ref.label ?? ref.riskId}
                              {source !== undefined && (
                                <span class="sub">
                                  {source.riskResponseType.join(', ')}. Likelihood {entryText(doc, source, 'riskLikelihood')}, impact {entryText(doc, source, 'riskImpact')}.
                                </span>
                              )}
                            </li>
                          );
                        })}
                      </ul>
                    </td>
                    <td>
                      <button
                        type="button"
                        class="quiet"
                        disabled={used.length > 0}
                        title={used.length > 0 ? `Used by ${used.join(', ')}` : undefined}
                        onClick={() => {
                          update((current) => withoutRisk(current, risk.riskId));
                        }}
                      >
                        Remove {risk.riskId}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        </>
      )}
      {findings.length > 0 && (
        <ul class="warnings">
          {findings.map((finding, i) => (
            <li key={i}>
              {finding.rule} {finding.message}. Leaders clarify which treatment is the appropriate response.
            </li>
          ))}
        </ul>
      )}
      <p class="hint">A priority in a child register is provisional. A summary entry carries its own priority. Leadership overrides a priority on the screen Prioritize.</p>
    </>
  );
}

function NormalizePanel({ doc, update }: { readonly doc: RiskDocument; readonly update: Update }) {
  const parents = parentRegisters(doc);
  const [chosen, setChosen] = useState<string>();
  const parent = parents.find((register) => register.id === chosen) ?? parents[0];
  return (
    <Section id="normalize" title="Aggregate and normalize" help="enterprise.normalize" folded>
      <p class="hint">
        A parent register lists the entries of the registers below it, combines identical or similar entries into a summary entry,
        resolves different responses and shows the entries that must go to the parent.
      </p>
      {parent === undefined ? (
        <p class="muted">No register has a child register. Add a register below another one on the screen Identify and analyze.</p>
      ) : (
        <>
          <div class="field">
            <SelectField
              id="normalize-parent"
              label="Parent register"
              help="enterprise.normalize-parent"
              value={parent.id}
              options={parents.map((register) => [register.id, register.title] as const)}
              onChange={(value) => {
                if (value !== undefined) setChosen(value);
              }}
            />
          </div>
          <MergeForm key={parent.id} doc={doc} parent={parent} update={update} />
          <SummaryTable doc={doc} parent={parent} update={update} />
        </>
      )}
    </Section>
  );
}

// The scope value for every register. No register id can hold "*".
const ALL = '*';
const DATE = /^\d{4}-\d{2}-\d{2}$/;

const localDate = (now = new Date()): string => new Date(now.getTime() - now.getTimezoneOffset() * 60_000).toISOString().slice(0, 10);

// SPEC.md Sec. 6.13 item 3. The previous period of the ERP and the portfolio comes from here.
function PeriodPanel({ doc, update }: { readonly doc: RiskDocument; readonly update: Update }) {
  const [scope, setScope] = useState(ALL);
  const [asOf, setAsOf] = useState(localDate);
  const [note, setNote] = useState<string>();
  const tree = registerTree(doc.registers);
  const registerId = tree.some(({ register }) => register.id === scope) ? scope : undefined;
  const count = periodRisks(doc, registerId).length;
  const close = (): void => {
    update((current) => closePeriod(current, registerId, asOf).doc);
    setNote(`The current assessment of ${String(count)} ${count === 1 ? 'risk' : 'risks'} is now the previous period, as of ${asOf}.`);
  };
  return (
    <Section id="period" title="Close the period" help="enterprise.period" folded>
      <p class="hint">
        At the end of a period, the current assessment of each open risk becomes its previous assessment. It replaces the previous assessment that the risk has. The column Last of the
        profile and the previous period of the portfolio then show it. Labels and the impact split are copied. Numbers that are placeholders or that come from labels are not copied,
        because a copy would read as an estimate. Undo last change takes the close back.
      </p>
      <div class="field-row">
        <div class="field">
          <SelectField
            id="period-scope"
            label="Registers"
            hint="A register includes the registers below it."
            help="enterprise.period-scope"
            value={scope}
            options={[[ALL, 'All registers'] as const, ...tree.map(({ register, depth }) => [register.id, `${'. '.repeat(depth)}${register.title}`] as const)]}
            onChange={(value) => {
              setScope(value ?? ALL);
              setNote(undefined);
            }}
          />
        </div>
        <div class="field">
          <TextField
            id="period-as-of"
            label="End of the period"
            help="enterprise.period-as-of"
            type="date"
            value={asOf}
            onChange={(value) => {
              setAsOf(value);
              setNote(undefined);
            }}
          />
        </div>
      </div>
      <div class="button-row">
        <button type="button" disabled={count === 0 || !DATE.test(asOf)} onClick={close}>
          Close the period for {count} open {count === 1 ? 'risk' : 'risks'}
        </button>
        <Explain id="close-period" topic="enterprise.close-period" name="Close the period" />
      </div>
      <p role="status" class="muted">
        {note}
      </p>
    </Section>
  );
}

interface Simulation {
  readonly numbers?: PriorityNumbers;
  readonly running: boolean;
  readonly error?: string;
}

function PortfolioView({ doc, simulation }: { readonly doc: RiskDocument; readonly simulation: Simulation }) {
  const { numbers } = simulation;
  const tree = registerTree(doc.registers);
  const roots = tree.filter((item) => item.depth === 0).length;
  const shift = roots > 1 ? 1 : 0;
  const rows: { readonly id: string | undefined; readonly title: string; readonly level: string; readonly depth: number }[] = [
    ...(roots > 1 ? [{ id: undefined, title: 'All registers', level: 'all', depth: 0 }] : []),
    ...tree.map(({ register, depth }) => ({ id: register.id, title: register.title, level: register.level, depth: depth + shift })),
  ];
  const currency = doc.document.currency;
  return (
    <Section id="portfolio" title="Portfolio by register and period" folded help="enterprise.portfolio">
      <p class="hint">
        A register includes the registers below it. The financial profile is the expected annual loss of the
        negative risks. With a simulation it is the simulated value with its standard error, as on the screen Prioritize, and the entries without an estimate show apart. Without a
        simulation it is the sum of the exposure ratings, because expected values add up. The previous period comes from the previous assessments. The reputation and mission
        profiles give the highest label on the impact scale.
      </p>
      <Explain id="portfolio-table" topic="enterprise.portfolio-table" name="the portfolio table" visible="How to read this table" />
      <div class="table-box" tabIndex={0} role="region" aria-labelledby="portfolio-caption">
        <table class="portfolio">
          <caption id="portfolio-caption">Risk profile of each register. Money in {currency}.</caption>
          <thead>
            <tr>
              <th scope="col" rowSpan={2}>
                Register
              </th>
              <th scope="colgroup" colSpan={2}>
                Financial risk profile
              </th>
              <th scope="colgroup" colSpan={2}>
                Reputation risk profile
              </th>
              <th scope="colgroup" colSpan={2}>
                Mission risk profile
              </th>
              <th scope="col" rowSpan={2}>
                Entries
              </th>
            </tr>
            <tr>
              {[0, 1, 2].flatMap((profile) => [
                <th scope="col" key={`${String(profile)}-current`}>
                  Current period
                </th>,
                <th scope="col" key={`${String(profile)}-previous`}>
                  Previous period
                </th>,
              ])}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const profile = portfolioRow(doc, row.id);
              const curve = row.id === undefined ? numbers?.state : numbers?.registers.find((register) => register.registerId === row.id);
              const run = curve === undefined || profile.simulatedEntries === 0 ? undefined : { eal: curve.eal, se: curve.ealSe };
              const others = profile.entries - profile.simulatedEntries;
              return (
                <tr key={row.id ?? ''} data-register={row.id ?? 'all'}>
                  <th scope="row" style={{ paddingLeft: `${String(row.depth * 1.25)}rem` }}>
                    {row.title}
                    <span class="sub">{row.level}</span>
                  </th>
                  <td class="current">
                    {run === undefined ? (
                      <>
                        {money(profile.current)}
                        {profile.simulatedEntries > 0 && simulation.running && <span class="sub">The simulation runs.</span>}
                      </>
                    ) : (
                      <>
                        {money(run.eal)}
                        <span class="sub se">Simulated, standard error {money(run.se)}</span>
                        {others > 0 && (
                          <span class="sub">
                            Not in the simulation: {others} {others === 1 ? 'entry' : 'entries'} with {money(profile.otherExposure)} by exposure rating
                          </span>
                        )}
                      </>
                    )}
                  </td>
                  <td class="previous">
                    {profile.previousEntries === 0 ? 'Not recorded' : money(profile.previous)}
                    {profile.previousEntries > 0 && profile.previousEntries < profile.entries && (
                      <span class="sub">
                        {profile.previousEntries} of {profile.entries} entries
                      </span>
                    )}
                  </td>
                  <td class="reputation">{profile.reputation ?? 'No label'}</td>
                  <td class="reputation-previous">{profile.previousReputation ?? 'No label'}</td>
                  <td class="mission">{profile.mission ?? 'No label'}</td>
                  <td class="mission-previous">{profile.previousMission ?? 'No label'}</td>
                  <td class="entries">
                    {profile.entries}
                    {profile.defaulted > 0 && <span class="sub">{profile.defaulted} with defaulted numbers</span>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {simulation.error !== undefined && <p class="save-error">The simulation failed. {simulation.error}</p>}
      {numbers !== undefined && <p class="source">{sourceLine(numbers)}</p>}
    </Section>
  );
}

function EnterpriseBody({ doc, update }: { readonly doc: RiskDocument; readonly update: Update }) {
  // The run of screen S4, for the simulated expected annual loss of each register.
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
  const numbers = key !== undefined && job.resultKey === key ? job.result : undefined;
  return (
    <>
      <div class="print-view">
        <ErrView doc={doc} number={1} />
      </div>
      <div class="print-view">
        <ErpView doc={doc} />
      </div>
      <NormalizePanel doc={doc} update={update} />
      <div class="print-view">
        <PortfolioView doc={doc} simulation={{ ...(numbers === undefined ? {} : { numbers }), running: job.running, ...(job.error === undefined ? {} : { error: job.error }) }} />
      </div>
      <PeriodPanel doc={doc} update={update} />
      <div class="button-row">
        <button
          type="button"
          class="quiet"
          onClick={() => {
            window.print();
          }}
        >
          Print the register, the profile and the portfolio
        </button>
        <Explain id="print" topic="enterprise.print" name="Print the register, the profile and the portfolio" />
      </div>
    </>
  );
}

export function EnterpriseScreen({ id, onNavigate }: { readonly id: string; readonly onNavigate: (screen: ScreenName) => void }) {
  return (
    <DocumentScreen
      id={id}
      screen="enterprise"
      title="Enterprise view"
      lede="See the registers as tables, merge the entries of child registers and compare the registers by period."
      onNavigate={onNavigate}
    >
      {(doc, update) => <EnterpriseBody doc={doc} update={update} />}
    </DocumentScreen>
  );
}
