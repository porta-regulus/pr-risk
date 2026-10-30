// The enterprise risk profile of SP 800-221r1 Fig. 11 (SPEC.md Sec. 6.13 item 2, golden test
// G5) and the portfolio view of Table 7 (Sec. 6.13 item 3). Both read the stored numbers and
// labels of the risks, so they work for qualitative registers too and run no simulation.
import { subtree } from '../engine/metrics';
import { rankOf } from '../schema/rules';
import type { Risk, RiskDocument } from '../schema/types';
import { numbersSource } from '../ui/analysis';

export type Objective = NonNullable<NonNullable<RiskDocument['context']>['objectives']>[number];

const sourceKey = (registerId: string, riskId: string): string => `${registerId}\u0000${riskId}`;

// The risks of a profile, from one register and the registers below it, or from every
// register. A summary entry stands for its sources, so a source of a summary entry in the same
// scope is left out and no risk counts twice (Sec. 6.1 item 3). A risk that a response causes
// exists only with that response, and a closed risk has no exposure.
export function profileRisks(doc: RiskDocument, registerId?: string): Risk[] {
  const registers = registerId === undefined ? undefined : subtree(doc, registerId);
  const inScope = doc.risks.filter((risk) => (registers === undefined || registers.has(risk.registerId)) && risk.onlyWithResponse === undefined && risk.status !== 'Closed');
  const summarized = new Set(inScope.flatMap((risk) => (risk.sourceRefs ?? []).map((ref) => sourceKey(ref.registerId, ref.riskId))));
  return inScope.filter((risk) => !summarized.has(sourceKey(risk.registerId, risk.riskId)));
}

// One assessment value of Fig. 11. The label when there is one, else the number.
export interface Assessed {
  readonly label?: string;
  readonly value?: number;
}

type Three = readonly [Assessed | undefined, Assessed | undefined, Assessed | undefined];

export interface ErpRow {
  readonly risk: Risk;
  // Last, Current and Residual.
  readonly impact: Three;
  readonly likelihood: Three;
  readonly currentResponse: string;
  readonly proposedResponse: string;
  readonly owner: string;
}

export interface ErpBlock {
  readonly objective: Objective;
  readonly heading: string;
  readonly rows: readonly ErpRow[];
}

const assessed = (label: string | undefined, value: number | undefined): Assessed | undefined =>
  label !== undefined && label !== '' ? { label } : value === undefined ? undefined : { value };

// The numbers that an importer or a new risk filled as placeholders (rule D-Q2) are not an
// assessment. Numbers from an estimate, from labels (rules D-Q1 and D-Q3, the source of S3) or
// from the roll-up of a summary entry are.
export function isPlaceholder(doc: RiskDocument, risk: Risk): boolean {
  return risk.rollUp === undefined && numbersSource(doc, risk) === 'placeholder';
}

function current(doc: RiskDocument, risk: Risk, field: 'riskImpact' | 'riskLikelihood', label: string | undefined): Assessed | undefined {
  if (label !== undefined && label !== '') return { label };
  return isPlaceholder(doc, risk) ? undefined : { value: risk[field] };
}

// Last comes from previousAssessment, Current from the register entry and Residual from the
// planned values of the risk detail record (SPEC.md Sec. 6.13 item 2).
export function erpRow(doc: RiskDocument, risk: Risk): ErpRow {
  const last = risk.previousAssessment;
  const planned = risk.detail?.planned;
  return {
    risk,
    impact: [assessed(last?.riskImpactLabel, last?.riskImpact), current(doc, risk, 'riskImpact', risk.riskImpactLabel), assessed(planned?.impactLabel, planned?.impact)],
    likelihood: [
      assessed(last?.riskLikelihoodLabel, last?.riskLikelihood),
      current(doc, risk, 'riskLikelihood', risk.riskLikelihoodLabel),
      assessed(planned?.likelihoodLabel, planned?.likelihood),
    ],
    currentResponse: risk.detail?.implementedResponseDescription ?? '',
    proposedResponse: risk.riskResponseDescription,
    owner: risk.riskOwnerPointOfContact,
  };
}

const priorityOf = (risk: Risk): number => risk.priorityOverride?.priority ?? risk.priority ?? Number.POSITIVE_INFINITY;

// One block per objective, in the order of context.objectives, headed as in Fig. 11. A risk
// that supports two objectives is in both blocks. An objective without a risk has no block.
// In a block, the risks follow their priority.
export function erpBlocks(doc: RiskDocument, registerId?: string): ErpBlock[] {
  const risks = profileRisks(doc, registerId);
  return (doc.context?.objectives ?? []).flatMap((objective) => {
    const rows = risks
      .filter((risk) => (risk.objectiveIds ?? []).includes(objective.id))
      .map((risk, index) => ({ risk, index }))
      .sort((a, b) => priorityOf(a.risk) - priorityOf(b.risk) || a.index - b.index)
      .map(({ risk }) => erpRow(doc, risk));
    return rows.length === 0 ? [] : [{ objective, heading: `${objective.kind.toUpperCase()} OBJECTIVE`, rows }];
  });
}

// Risks of the profile that support no objective (lint L-09). Fig. 11 has no place for them.
export function withoutObjective(doc: RiskDocument, registerId?: string): Risk[] {
  const known = new Set((doc.context?.objectives ?? []).map((objective) => objective.id));
  return profileRisks(doc, registerId).filter((risk) => !(risk.objectiveIds ?? []).some((id) => known.has(id)));
}

// One row of the portfolio view. The financial profile is the expected annual loss. The sum of
// the exposure ratings gives it, because an expected value adds up over risks. With a
// simulation, the screen shows the simulated value of the register with its standard error
// instead, as screen S4 does, and the entries outside the simulation separately. The document
// keeps no reputation or mission label of the previous period, so those profiles have the
// current period only.
export interface PortfolioRow {
  readonly entries: number;
  readonly current: number;
  // Entries in the simulation: risks with an estimate, and summary entries whose sources all
  // have one. The other entries add otherExposure.
  readonly simulatedEntries: number;
  readonly otherExposure: number;
  // Entries whose numbers are placeholders or come from their labels (defaultedFields).
  readonly defaulted: number;
  readonly previous: number;
  // Entries that have a previous assessment with numbers.
  readonly previousEntries: number;
  readonly reputation?: string;
  readonly mission?: string;
}

const DEFAULTED = ['/riskLikelihood', '/riskImpact', '/exposureRating'];

function previousExposure(risk: Risk): number | undefined {
  const last = risk.previousAssessment;
  if (last?.exposureRating !== undefined) return last.exposureRating;
  return last?.riskLikelihood === undefined || last.riskImpact === undefined ? undefined : Math.round(last.riskLikelihood * last.riskImpact);
}

// The label with the highest rank on the impact scale. Undefined without a scale or a label.
function highest(doc: RiskDocument, labels: readonly (string | undefined)[]): string | undefined {
  const bands = [...(doc.strategy?.scales?.impact ?? [])].sort((a, b) => a.lower - b.lower);
  let best: { label: string; rank: number } | undefined;
  for (const label of labels) {
    const rank = label === undefined ? undefined : rankOf(bands, label);
    if (label !== undefined && rank !== undefined && (best === undefined || rank > best.rank)) best = { label, rank };
  }
  return best?.label;
}

function simulated(doc: RiskDocument, risk: Risk): boolean {
  const sources = risk.sourceRefs ?? [];
  if (sources.length === 0) return risk.estimate !== undefined;
  return sources.every((ref) => {
    const source = doc.risks.find((item) => item.registerId === ref.registerId && item.riskId === ref.riskId);
    return source !== undefined && simulated(doc, source);
  });
}

// Negative risks only. Gains of positive risks are on the screens Prioritize and Respond.
export function portfolioRow(doc: RiskDocument, registerId?: string): PortfolioRow {
  const risks = profileRisks(doc, registerId).filter((risk) => risk.polarity === 'negative');
  const others = risks.filter((risk) => !simulated(doc, risk));
  const previous = risks.map(previousExposure).filter((value): value is number => value !== undefined);
  const reputation = highest(
    doc,
    risks.map((risk) => risk.impacts?.reputation?.label),
  );
  const mission = highest(
    doc,
    risks.map((risk) => risk.impacts?.mission?.label),
  );
  return {
    entries: risks.length,
    current: risks.reduce((sum, risk) => sum + risk.exposureRating, 0),
    simulatedEntries: risks.length - others.length,
    otherExposure: others.reduce((sum, risk) => sum + risk.exposureRating, 0),
    defaulted: risks.filter((risk) => (risk.defaultedFields ?? []).some((field) => DEFAULTED.includes(field))).length,
    previous: previous.reduce((sum, value) => sum + value, 0),
    previousEntries: previous.length,
    ...(reputation === undefined ? {} : { reputation }),
    ...(mission === undefined ? {} : { mission }),
  };
}
