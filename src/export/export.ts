// Exports of SPEC.md Sec. 9.8. Native JSON, NIST IR 8286 JSON (rules E-01, E-02) and CSV.
import { canonicalize } from '../schema/canonical';
import { nistExportErrors } from '../schema/document';
import { projectRdr, projectRegister, REGISTER_FIELDS } from '../schema/project';
import type { Finding, Risk, RiskDocument } from '../schema/types';

// Whole document in RFC 8785 key order.
export function exportNative(doc: RiskDocument): string {
  return canonicalize(doc);
}

const NUMERIC = ['/riskLikelihood', '/riskImpact', '/exposureRating', 'riskLikelihood', 'riskImpact', 'exposureRating'];

export function hasDefaultedNumbers(risk: Risk): boolean {
  return (risk.defaultedFields ?? []).some((field) => NUMERIC.includes(field));
}

export type DefaultedChoice = 'include' | 'exclude';

export type Ir8286Export =
  | { readonly ok: true; readonly registerEntries: string; readonly riskDetailRecords: string; readonly riskIds: readonly string[] }
  | { readonly ok: false; readonly confirm: readonly string[] }
  | { readonly ok: false; readonly errors: readonly Finding[] };

// Rule E-02 asks the user about risks with placeholder numbers. Rule E-01 refuses a file
// that fails the vendored NIST schemas.
export function exportIr8286(doc: RiskDocument, defaulted?: DefaultedChoice): Ir8286Export {
  const placeholders = doc.risks.filter(hasDefaultedNumbers).map((risk) => risk.riskId);
  if (placeholders.length > 0 && defaulted === undefined) return { ok: false, confirm: placeholders };
  const risks = defaulted === 'exclude' ? doc.risks.filter((risk) => !placeholders.includes(risk.riskId)) : doc.risks;
  const selected: RiskDocument = { ...doc, risks };
  const errors = nistExportErrors(selected);
  if (errors.length > 0) return { ok: false, errors };
  return {
    ok: true,
    registerEntries: `${JSON.stringify(risks.map(projectRegister), null, 2)}\n`,
    riskDetailRecords: `${JSON.stringify(risks.map((risk) => projectRdr(doc, risk)), null, 2)}\n`,
    riskIds: risks.map((risk) => risk.riskId),
  };
}

// OWASP CSV Injection. A cell that starts with one of these characters gets a leading quote.
const FORMULA_START = /^[=+\-@\t\r]/;

export function guardCell(text: string): string {
  return FORMULA_START.test(text) ? `'${text}` : text;
}

function csvCell(value: unknown): string {
  let text: string;
  if (value === undefined || value === null) text = '';
  else if (typeof value === 'string') text = value;
  else if (typeof value === 'number' || typeof value === 'boolean') text = String(value);
  else if (Array.isArray(value) && value.every((item) => typeof item === 'string')) text = value.join('; ');
  else text = JSON.stringify(value);
  const guarded = guardCell(text);
  return /[",\r\n]/.test(guarded) ? `"${guarded.replace(/"/g, '""')}"` : guarded;
}

const EXTENSION_COLUMNS = [
  'registerId',
  'polarity',
  'priority',
  'category',
  'riskLikelihoodLabel',
  'riskImpactLabel',
  'exposureRatingLabel',
  'responseDecision',
  'objectiveIds',
  'assetIds',
  'reviewDue',
  'defaultedFields',
] as const;

// NIST columns first, then extensions. CRLF line ends (RFC 4180).
export function exportCsv(doc: RiskDocument): string {
  const columns = [...REGISTER_FIELDS, ...EXTENSION_COLUMNS];
  const rows = doc.risks.map((risk) => columns.map((column) => csvCell((risk as unknown as Record<string, unknown>)[column])).join(','));
  return `${[columns.join(','), ...rows].join('\r\n')}\r\n`;
}
