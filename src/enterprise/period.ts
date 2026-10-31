// Closing a period (SPEC.md Sec. 6.13 items 2 and 3). The current assessment of each open risk
// in scope becomes its previous assessment, so the ERP column Last of Fig. 11 and the previous
// period of Table 7 show it. It replaces the previous assessment that the risk had.
import { subtree } from '../engine/metrics';
import type { Risk, RiskDocument } from '../schema/types';

type Previous = NonNullable<Risk['previousAssessment']>;

const NUMBERS = ['riskLikelihood', 'riskImpact', 'exposureRating'] as const;
const LABELS = ['riskLikelihoodLabel', 'riskImpactLabel', 'exposureRatingLabel'] as const;

// The risks that a close changes. A closed risk has no current period, and a risk that a
// response causes exists only with that response. A source of a summary entry is in scope,
// because its own register shows its profile.
export function periodRisks(doc: RiskDocument, registerId?: string): Risk[] {
  const registers = registerId === undefined ? undefined : subtree(doc, registerId);
  return doc.risks.filter((risk) => (registers === undefined || registers.has(risk.registerId)) && risk.status !== 'Closed' && risk.onlyWithResponse === undefined);
}

// The previous assessment that the current one gives. A number in defaultedFields is a
// placeholder (rule D-Q2) or comes from a label (rules D-Q1 and D-Q3). The previous assessment
// has no defaultedFields, so a copy would read as an estimate (hard rule 2). The label and the
// impact split are copied. Undefined when nothing is left to copy.
export function previousOf(risk: Risk, asOf: string): Previous | undefined {
  const defaulted = new Set(risk.defaultedFields ?? []);
  const previous: { -readonly [K in keyof Previous]: Previous[K] } = { asOf };
  for (const field of NUMBERS) if (!defaulted.has(`/${field}`)) previous[field] = risk[field];
  for (const field of LABELS) {
    const label = risk[field];
    if (label !== undefined && label !== '') previous[field] = label;
  }
  if (risk.impacts !== undefined) previous.impacts = risk.impacts;
  return Object.keys(previous).length === 1 ? undefined : previous;
}

export function closePeriod(doc: RiskDocument, registerId: string | undefined, asOf: string): { readonly doc: RiskDocument; readonly closed: number } {
  const inScope = new Set(periodRisks(doc, registerId));
  let closed = 0;
  const risks = doc.risks.map((risk) => {
    if (!inScope.has(risk)) return risk;
    closed += 1;
    const { previousAssessment: _old, ...rest } = risk;
    const previous = previousOf(risk, asOf);
    return previous === undefined ? rest : { ...rest, previousAssessment: previous };
  });
  return { doc: { ...doc, risks }, closed };
}
