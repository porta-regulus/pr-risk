// The decision record (SPEC.md Sec. 4) in the layout of Sec. 4.1. Two A4 pages at most. Every
// table and figure has a number and a source line. Status is a dot and a word.
import type { DecisionRecord, PortfolioRow, RiskRow } from '../engine/decision';
import type { Risk, RiskDocument } from '../schema/types';
import { LecChart, money, probability, sourceLine, STATUS_TEXT, StatusText } from './report';

// The estimate basis of Sec. 4.1 item 3. P(event) is P(at least one event).
const BASIS: Readonly<Record<NonNullable<Risk['estimate']>['method'], string>> = {
  'data-derived': 'own data',
  mixed: 'mixed',
  'expert-calibrated': 'expert range',
};

const KIND_TEXT = {
  strategic: 'Strategic',
  operations: 'Operations',
  reporting: 'Reporting',
  compliance: 'Compliance',
} as const;

const names = (doc: RiskDocument, ids: readonly string[]): string => {
  if (ids.length === 0) return 'No option';
  const titles = new Map((doc.responses ?? []).map((option) => [option.id, option.title]));
  return ids.map((id) => `${id} ${titles.get(id) ?? ''}`.trim()).join(', ');
};

// Leaf risks that stay accepted after the decision (Sec. 4 and 8.12 item 4). A risk with
// Accept or a pending decision, and a risk whose options all stay unfunded.
export function residualRisks(doc: RiskDocument, funded: readonly string[]): Risk[] {
  const options = (doc.responses ?? []).filter((option) => option.status === 'candidate' || option.status === 'selected');
  const chosen = options.filter((option) => funded.includes(option.id));
  const reached = (risk: Risk, list: typeof options): boolean =>
    list.some((option) =>
      option.effects.some((effect) =>
        effect.targetKind === 'risk' ? effect.targetId === risk.riskId : (risk.driverLinks ?? []).some((link) => link.driverId === effect.targetId),
      ),
    );
  return doc.risks.filter((risk) => {
    if ((risk.sourceRefs ?? []).length > 0) return false;
    if (risk.onlyWithResponse !== undefined && !funded.includes(risk.onlyWithResponse)) return false;
    if (risk.riskResponseType.includes('Accept') || risk.responseDecision === 'pending') return !reached(risk, chosen);
    return risk.polarity === 'negative' && reached(risk, options) && !reached(risk, chosen);
  });
}

function summary(doc: RiskDocument, record: DecisionRecord): string[] {
  const currency = doc.document.currency;
  const best = record.best;
  const first =
    best.ids.length === 0
      ? `No option adds more than it costs within the budget of ${money(record.budget)} ${currency}.`
      : `Fund ${names(doc, best.ids)} for ${money(best.cash)} ${currency} first-year cash, within the budget of ${money(record.budget)} ${currency}.`;
  const second = `The roll-up goes from ${STATUS_TEXT[record.before.status].toLowerCase()} to ${STATUS_TEXT[record.after.status].toLowerCase()}, and the expected annual loss falls from ${money(record.before.eal)} to ${money(record.after.eal)} ${currency}.`;
  const same = record.fiscal.ids.join() === best.ids.join();
  const third = same
    ? `The net benefit is ${money(best.net)} ${currency} per year, and the fiscal baseline funds the same options.`
    : `The net benefit is ${money(best.net)} ${currency} per year, ${money(best.net - record.fiscal.net)} ${currency} more than the fiscal baseline.`;
  return [first, second, third];
}

function PortfolioTable({ doc, record, number }: { readonly doc: RiskDocument; readonly record: DecisionRecord; readonly number: number }) {
  const currency = doc.document.currency;
  const rows: [string, PortfolioRow][] = [
    ['Best', record.best],
    ...record.alternatives.map((row, i): [string, PortfolioRow] => [`Rank ${String(i + 2)}`, row]),
    ['Fiscal baseline', record.fiscal],
    [`Best at ${money(record.lower.budget)}`, record.lower.row],
    [`Best at ${money(record.upper.budget)}`, record.upper.row],
  ];
  return (
    <table class="compact">
      <caption>
        Table {number}. Alternatives, the fiscal baseline (Sec. 5.3.2) and the budget at minus and plus 20% ({currency} per year, first-year cash in {currency}).
      </caption>
      <thead>
        <tr>
          <th scope="col">Portfolio</th>
          <th scope="col">Options</th>
          <th scope="col">First-year cash</th>
          <th scope="col">Annualised cost</th>
          <th scope="col">Annual benefit</th>
          <th scope="col">Net benefit</th>
          <th scope="col">Tolerance</th>
        </tr>
      </thead>
      <tbody>
        {rows.map(([label, row]) => (
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
  );
}

export function DecisionRecordView({ doc, record }: { readonly doc: RiskDocument; readonly record: DecisionRecord }) {
  const currency = doc.document.currency;
  const source = sourceLine(record);
  const responses = new Map((doc.responses ?? []).map((option) => [option.id, option]));
  const risks = new Map(doc.risks.map((risk) => [risk.riskId, risk]));
  const after = new Map(record.after.risks.map((risk) => [risk.riskId, risk]));
  const statusRows = [...record.before.risks].sort((a, b) => Number(a.polarity === 'positive') - Number(b.polarity === 'positive') || b.expectedAnnual - a.expectedAnnual);
  const residual = residualRisks(doc, record.best.ids);
  const missing = residual.filter((risk) => risk.acceptance === undefined);
  const overrides = doc.risks.filter((risk) => risk.priorityOverride !== undefined);
  const points = doc.appetite?.toleranceCurve?.points ?? [];
  const capacity = doc.appetite?.capacity;
  const roots = doc.registers.filter((register) => register.parentRegisterId === undefined);
  const children = doc.registers.length - roots.length;
  const asOf =
    doc.registers
      .map((register) => register.asOf)
      .sort()
      .at(-1) ?? '';
  const inPlaceBy = doc.strategy?.budget?.fiscalYearStart;
  const evidence = (row: RiskRow): string => {
    const method = risks.get(row.riskId)?.estimate?.method;
    const word = row.polarity === 'positive' ? 'EAG' : 'EAL';
    return `${word} ${money(row.expectedAnnual)} ± ${money(row.expectedAnnualSe)}, P(event) ${probability(row.probability)}${method === undefined ? '' : `, ${BASIS[method]}`}.`;
  };
  return (
    <article class="record" aria-labelledby="record-title">
      <header class="record-head">
        <p class="kicker">PortaRegulus Risk. Decision record for SP 800-221r1 Sec. 4.4</p>
        <h2 id="record-title">{doc.document.title}</h2>
        <dl class="record-meta">
          <div>
            <dt>Organization</dt>
            <dd>{doc.document.organization ?? 'Not set'}</dd>
          </div>
          <div>
            <dt>Registers in scope</dt>
            <dd>
              {roots.map((register) => register.title).join(', ')}
              {children === 0 ? '' : children === 1 ? ' and 1 child register' : ` and ${String(children)} child registers`}
            </dd>
          </div>
          <div>
            <dt>As of</dt>
            <dd>{asOf}</dd>
          </div>
          <div>
            <dt>Currency</dt>
            <dd>{currency}</dd>
          </div>
          <div>
            <dt>Seed, trials, engine</dt>
            <dd>
              {record.seed}, {record.trials.toLocaleString('en')}, {record.engineVersion}
            </dd>
          </div>
          <div class="hash">
            <dt>Document hash</dt>
            <dd>{record.hash}</dd>
          </div>
        </dl>
        {missing.length > 0 && (
          <p class="record-draft">
            Draft. {missing.length} accepted residual {missing.length === 1 ? 'risk needs' : 'risks need'} an acceptance record before this record is final (Sec. 8.12 item 4).
          </p>
        )}
      </header>

      <section>
        <h3>01 Summary</h3>
        <p class="record-summary">{summary(doc, record).join(' ')}</p>
        <table class="compact status-table">
          <caption>Table 1. Status of the roll-up and of each risk against the tolerance curve.</caption>
          <thead>
            <tr>
              <th scope="col">Risk or register</th>
              <th scope="col">Status</th>
              <th scope="col">Evidence</th>
              <th scope="col">After funding</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <th scope="row">All registers</th>
              <td>
                <StatusText status={points.length === 0 ? undefined : record.before.status} />
              </td>
              <td>
                EAL {money(record.before.eal)} ± {money(record.before.ealSe)}.
                {record.before.pAboveCapacity === undefined ? '' : ` P(loss above capacity) ${probability(record.before.pAboveCapacity)}.`}
              </td>
              <td>
                EAL {money(record.after.eal)}. <StatusText status={points.length === 0 ? undefined : record.after.status} />
              </td>
            </tr>
            {statusRows.map((row) => {
              const later = after.get(row.riskId);
              return (
                <tr key={row.riskId}>
                  <th scope="row">
                    {row.riskId} {risks.get(row.riskId)?.riskDescription ?? ''}
                  </th>
                  <td>{row.polarity === 'positive' ? 'Opportunity' : <StatusText status={row.status} />}</td>
                  <td>{evidence(row)}</td>
                  <td>
                    {later === undefined ? '' : `${row.polarity === 'positive' ? 'EAG' : 'EAL'} ${money(later.expectedAnnual)}. `}
                    {later !== undefined && later.polarity === 'negative' && <StatusText status={later.status} />}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <p class="source">
          Source. {source} EAL and EAG in {currency} per year.
        </p>
      </section>

      <section>
        <h3>02 Appetite</h3>
        <p>
          Capacity {capacity === undefined ? 'not set' : `${money(capacity.amount)} ${currency}. ${capacity.rationale}`} Tolerance curve{' '}
          {points.length === 0
            ? 'not set.'
            : `${points.map((point) => `${money(point.loss)} at ${String(point.maxExceedanceProbability)}`).join(', ')} (loss at maximum probability of a larger annual loss).`}{' '}
          Approved by {doc.appetite?.toleranceCurve?.approvedBy ?? 'nobody yet'}
          {doc.appetite?.toleranceCurve?.approvedOn === undefined ? '' : ` on ${doc.appetite.toleranceCurve.approvedOn}`}.
        </p>
      </section>

      <section>
        <h3>03 Before and after</h3>
        <div class="side-by-side">
          <LecChart
            id="lec-record"
            number={1}
            title="Loss exceedance of the roll-up before and after the funded portfolio, against the tolerance curve"
            series={[
              { name: 'Before', points: record.before.lec },
              { name: 'After', points: record.after.lec },
            ]}
            points={points}
            capacity={capacity?.amount}
            currency={currency}
            source={source}
          />
          <div>
            <table class="compact">
              <caption>Table 2. Metrics of the roll-up before and after funding.</caption>
              <thead>
                <tr>
                  <th scope="col">Metric</th>
                  <th scope="col">Before</th>
                  <th scope="col">After</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <th scope="row">Expected annual loss ({currency})</th>
                  <td>
                    {money(record.before.eal)} ± {money(record.before.ealSe)}
                  </td>
                  <td>
                    {money(record.after.eal)} ± {money(record.after.ealSe)}
                  </td>
                </tr>
                <tr>
                  <th scope="row">Expected annual gain ({currency})</th>
                  <td>
                    {money(record.before.eag)} ± {money(record.before.eagSe)}
                  </td>
                  <td>
                    {money(record.after.eag)} ± {money(record.after.eagSe)}
                  </td>
                </tr>
                {record.before.pAboveCapacity !== undefined && (
                  <tr>
                    <th scope="row">P(loss above capacity)</th>
                    <td>{probability(record.before.pAboveCapacity)}</td>
                    <td>{probability(record.after.pAboveCapacity ?? 0)}</td>
                  </tr>
                )}
                {record.before.atPoints.map((point, i) => (
                  <tr key={point.loss}>
                    <th scope="row">
                      P(loss above {money(point.loss)}), tolerance {probability(point.tolerance)}
                    </th>
                    <td>{probability(point.probability)}</td>
                    <td>{probability(record.after.atPoints[i]?.probability ?? 0)}</td>
                  </tr>
                ))}
                <tr>
                  <th scope="row">Tolerance gap</th>
                  <td>
                    {probability(record.before.gap)}. <StatusText status={points.length === 0 ? undefined : record.before.status} />
                  </td>
                  <td>
                    {probability(record.after.gap)}. <StatusText status={points.length === 0 ? undefined : record.after.status} />
                  </td>
                </tr>
              </tbody>
            </table>
            <p class="source">Source. {source}</p>
          </div>
        </div>
      </section>

      <section>
        <h3>04 Funded portfolio</h3>
        {record.best.ids.length === 0 ? (
          <p>No option is funded.</p>
        ) : (
          <div class="actions-grid">
            {record.best.ids.map((id) => {
              const option = responses.get(id);
              const marginal = record.marginal[id];
              return (
                <div class="action-box" key={id}>
                  <p class="action-title">
                    {id} {option?.title}
                  </p>
                  <p>
                    Owner {option?.owner ?? 'not set'}. First-year cash{' '}
                    {money(option === undefined ? 0 : option.costs.oneOff + option.costs.annual + (option.costs.reserveAmount ?? 0))} {currency}. In place by{' '}
                    {inPlaceBy ?? 'a date not set in the document'}.
                  </p>
                  {marginal !== undefined && (
                    <p>
                      Without it the net benefit falls by {money(marginal.netLossIfDropped)} {currency} and the gap is {probability(marginal.gapIfDropped)}.
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        )}
        <p>
          First-year cash {money(record.best.cash)} {currency}. Annualised cost {money(record.best.cost)} {currency}. Annual benefit {money(record.best.benefit)} ±{' '}
          {money(record.best.benefitSe)} {currency}. Net benefit {money(record.best.net)} {currency} per year.
          {record.tooCloseToCall && ' Too close to call. The lower first-year cash won.'}
        </p>
      </section>

      <section>
        <h3>05 Alternatives</h3>
        <PortfolioTable doc={doc} record={record} number={3} />
        <p class="source">
          Source. {source} {record.count} portfolios ranked at {record.rankingTrials.toLocaleString('en')} trials
          {record.method === 'greedy' ? ' by the greedy fallback, which is not guaranteed optimal' : ''}.
        </p>
      </section>

      <section>
        <h3>06 Not funded</h3>
        {record.notFunded.length === 0 ? (
          <p>Every candidate is funded.</p>
        ) : (
          <table class="compact">
            <caption>Table 4. Candidates that are not in the best portfolio, with the reason.</caption>
            <thead>
              <tr>
                <th scope="col">Option</th>
                <th scope="col">Reason</th>
              </tr>
            </thead>
            <tbody>
              {record.notFunded.map((item) => (
                <tr key={item.id}>
                  <th scope="row">
                    {item.id} {responses.get(item.id)?.title}
                  </th>
                  <td>{item.text}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section>
        <h3>07 Objectives view</h3>
        <table class="compact">
          <caption>Table 5. Expected annual loss and gain by enterprise objective ({currency}). A risk that supports objectives of two kinds counts in both.</caption>
          <thead>
            <tr>
              <th scope="col">Objective</th>
              <th scope="col">Risks</th>
              <th scope="col">EAL before</th>
              <th scope="col">EAL after</th>
              <th scope="col">EAG before</th>
              <th scope="col">EAG after</th>
            </tr>
          </thead>
          <tbody>
            {record.objectives.map((row) => (
              <tr key={row.kind}>
                <th scope="row">{KIND_TEXT[row.kind]}</th>
                <td>
                  {row.risks}
                  {row.notEstimated > 0 && `, ${String(row.notEstimated)} not estimated`}
                </td>
                <td>{money(row.ealBefore)}</td>
                <td>{money(row.ealAfter)}</td>
                <td>{money(row.eagBefore)}</td>
                <td>{money(row.eagAfter)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p class="source">Source. {source}</p>
      </section>

      <section>
        <h3>08 Accepted residual risk</h3>
        {residual.length === 0 ? (
          <p>No risk stays accepted.</p>
        ) : (
          <table class="compact">
            <caption>Table 6. Risks with Accept, a pending decision, or no funded option (Sec. 5.1.2).</caption>
            <thead>
              <tr>
                <th scope="col">Risk</th>
                <th scope="col">Owner</th>
                <th scope="col">Reason</th>
                <th scope="col">Acceptance record</th>
              </tr>
            </thead>
            <tbody>
              {residual.map((risk) => (
                <tr key={risk.riskId}>
                  <th scope="row">
                    {risk.riskId} {risk.riskDescription}
                  </th>
                  <td>{risk.riskOwnerPointOfContact}</td>
                  <td>{risk.acceptance?.rationale ?? (risk.responseDecision === 'pending' ? 'Decision pending.' : 'No option is funded.')}</td>
                  <td>
                    {risk.acceptance === undefined
                      ? 'Missing'
                      : `${risk.acceptance.kind === 'tolerance-exception' ? 'Tolerance exception' : 'Accepted'} by ${risk.acceptance.acceptedBy} on ${risk.acceptance.acceptedOn}${risk.acceptance.validUntil === undefined ? '' : `, until ${risk.acceptance.validUntil}`}`}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {overrides.length > 0 && (
          <p>
            Priority overrides (Sec. 5.4.4).{' '}
            {overrides
              .map(
                (risk) =>
                  `${risk.riskId} to ${String(risk.priorityOverride?.priority)} by ${risk.priorityOverride?.setBy ?? ''} on ${risk.priorityOverride?.setOn ?? ''}, ${risk.priorityOverride?.reason ?? ''}`,
              )
              .join('. ')}
            .
          </p>
        )}
      </section>

      <div class="closing">
        <section class="approval">
          <h3>09 Approval</h3>
          <table class="compact sign">
            <caption>Table 7. Approval by the management body (Sec. 4.4).</caption>
            <thead>
              <tr>
                <th scope="col">Name</th>
                <th scope="col">Role</th>
                <th scope="col">Signature</th>
                <th scope="col">Date</th>
              </tr>
            </thead>
            <tbody>
              {[1, 2, 3].map((line) => (
                <tr key={line}>
                  <td aria-label={`Name ${String(line)}`} />
                  <td aria-label={`Role ${String(line)}`} />
                  <td aria-label={`Signature ${String(line)}`} />
                  <td aria-label={`Date ${String(line)}`} />
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        <section>
          <h3>10 Method note</h3>
          <div class="limits">
            <p class="limits-title">Limits of these numbers</p>
            <ol>
              <li>Ranges are calibrated estimates of people, not measurements.</li>
              <li>Results carry Monte Carlo error. The ± values are one standard error.</li>
              <li>Matrices are display only. Ranking and funding use the simulation (Cox 2008, note 1).</li>
            </ol>
          </div>
          <p class="source">
            {record.notes.join(' ')} The document hash is SHA-256 of the RFC 8785 form of the document without the change log. Annualised cost is one-off cost over lifetime, plus
            annual cost, plus the reserve times the chance that it is used (Sec. 8.10).
          </p>
          <p class="notes">1. Cox, L. A. (2008). What's Wrong with Risk Matrices? Risk Analysis 28(2), 497 to 512. https://doi.org/10.1111/j.1539-6924.2008.01030.x</p>
        </section>
      </div>
    </article>
  );
}
