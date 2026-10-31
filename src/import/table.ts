// Rows of a CSV or XLSX sheet to native risks (SPEC.md Sec. 9.4, rules D-Q1 to D-Q3 of Sec. 7.3).
import { rankOf } from '../schema/rules';
import type { Register, Risk, RiskDocument, ScaleBand } from '../schema/types';
import { findHeaderRow, mapColumns, type Target } from './columns';
import { valueAt } from './stated';
import {
  guessCategory,
  guessLocale,
  looksPositive,
  parseCell,
  parseLocaleNumber,
  parseOpexCapex,
  parseResponseTypes,
  parseStatus,
  type CategoryGuess,
  type NumberLocale,
} from './values';

export interface TableOptions {
  // Target register when the file has no register column.
  readonly register?: Register;
  // Fields of registers that the file names but the document does not hold.
  readonly newRegister?: (id: string) => Register;
  readonly asOf?: string;
  readonly locale?: NumberLocale;
  readonly columnOverrides?: Readonly<Record<string, Target | null>>;
  // Per riskId, set by the user in the preview.
  readonly polarity?: Readonly<Record<string, 'negative' | 'positive'>>;
  readonly defaults?: {
    readonly riskCategory?: string;
    readonly category?: CategoryGuess;
    readonly riskResponseDescription?: string;
  };
}

export interface TableResult {
  readonly risks: Risk[];
  readonly registers: Register[];
  readonly warnings: string[];
  readonly columnMapping: Record<string, string>;
  // Per riskId, the JSON Pointers of the fields that the row states (Sec. 9.7).
  readonly stated: Record<string, readonly string[]>;
  readonly unmapped: readonly string[];
  readonly unmatchedLabels: { readonly likelihood: string[]; readonly impact: string[]; readonly exposure: string[] };
}

const DEFAULTED_ORDER = [
  '/riskId',
  '/riskLikelihood',
  '/riskImpact',
  '/exposureRating',
  '/riskCategory',
  '/category',
  '/polarity',
  '/riskResponseType',
  '/riskResponseCost',
  '/riskResponseDescription',
  '/riskOwnerPointOfContact',
  '/status',
] as const;

// Fields that a row holds only when the file states them.
const OPTIONAL_STATED = [
  '/priority',
  '/impacts/financial/opex/label',
  '/impacts/financial/capex/label',
  '/impacts/reputation/label',
  '/impacts/mission/label',
  '/detail/implementedResponseDescription',
  '/objectiveIds',
  '/reviewDue',
] as const;

function bandOf(bands: readonly ScaleBand[] | undefined, label: string | undefined): ScaleBand | undefined {
  if (bands === undefined || label === undefined) return undefined;
  const sorted = [...bands].sort((a, b) => a.lower - b.lower);
  const rank = rankOf(sorted, label);
  return rank === undefined ? undefined : sorted[rank];
}

const lines = (text: string): string =>
  text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line !== '')
    .join('; ');

export function tableToRisks(doc: RiskDocument, rows: readonly (readonly string[])[], options: TableOptions = {}): TableResult {
  const warnings: string[] = [];
  const headerIndex = findHeaderRow(rows);
  if (headerIndex < 0) throw new Error('No header row found. A header row needs at least 3 known column names in the first 20 rows.');
  const headers = rows[headerIndex] ?? [];
  if (headers.some((header) => header !== header.trim())) warnings.push('Some header cells start or end with a space, as in the NIST XLSX template. Headers are trimmed.');
  const mapping = mapColumns(headers, options.columnOverrides);
  const body = rows.slice(headerIndex + 1).filter((row) => row.some((cell) => cell.trim() !== ''));
  const column = new Map([...mapping.columns].map(([index, target]) => [target, index]));
  const cell = (row: readonly string[], target: Target): string | undefined => {
    const index = column.get(target);
    const value = index === undefined ? undefined : row[index];
    return value === undefined || value.trim() === '' ? undefined : value;
  };
  const numericCells = body.flatMap((row) => (['likelihood', 'impact', 'exposure', 'riskResponseCost'] as const).map((target) => cell(row, target) ?? ''));
  const locale = options.locale ?? guessLocale(numericCells) ?? 'dot';
  const scales = doc.strategy?.scales;
  const unmatched = { likelihood: new Set<string>(), impact: new Set<string>(), exposure: new Set<string>() };
  const existingRegisters = new Set(doc.registers.map((register) => register.id));
  const newRegisters = new Map<string, Register>();
  const asOf = options.asOf ?? new Date().toISOString().slice(0, 10);
  const statedRows: string[][] = [];

  const risks = body.map((row, index): Risk => {
    const defaulted = new Set<string>();
    const registerId = cell(row, 'registerId')?.trim() ?? options.register?.id;
    if (registerId === undefined) throw new Error('The file has no register column. Choose a target register.');
    if (!existingRegisters.has(registerId) && !newRegisters.has(registerId) && registerId !== options.register?.id) {
      newRegisters.set(
        registerId,
        options.newRegister?.(registerId) ?? { id: registerId, title: registerId, level: 'system', timeframeMonths: 12, asOf, method: 'qualitative' },
      );
    }
    let riskId = cell(row, 'riskId')?.trim();
    if (riskId === undefined) {
      riskId = String(index + 1);
      defaulted.add('/riskId');
    }
    const description = lines(cell(row, 'riskDescription') ?? '');
    const responseText = cell(row, 'riskResponseDescription');

    let polarity: 'negative' | 'positive' = options.polarity?.[riskId] ?? 'negative';
    const typeText = cell(row, 'riskResponseType');
    if (options.polarity?.[riskId] === undefined) {
      const positiveTypes = typeText === undefined ? [] : parseResponseTypes(typeText, 'positive').types;
      if (positiveTypes.some((type) => type !== 'Accept')) polarity = 'positive';
      else if (looksPositive(description)) {
        polarity = 'positive';
        warnings.push(`Row ${riskId} names an opportunity, so it is imported as a positive risk. The file has no polarity column. Check it in the preview.`);
      }
    }

    // Labels and numbers. A cell can hold a number, a label, or both ("7.5% (Low)").
    const read = (target: 'likelihood' | 'impact' | 'exposure') => {
      const text = cell(row, target);
      return text === undefined ? {} : parseCell(text, locale);
    };
    const l = read('likelihood');
    const i = read('impact');
    const e = read('exposure');
    let likelihoodLabel = l.label;
    let likelihood = l.number;
    if (likelihood !== undefined && likelihood > 1 && l.percent !== true) {
      // Scores such as 1 to 5 are labels, never probabilities.
      likelihoodLabel = String(likelihood);
      likelihood = undefined;
    }
    const lBand = bandOf(scales?.likelihood, likelihoodLabel);
    const iBand = bandOf(scales?.impact, i.label);
    const eBand = bandOf(scales?.exposure, e.label);
    if (likelihoodLabel !== undefined && lBand === undefined) unmatched.likelihood.add(likelihoodLabel);
    if (i.label !== undefined && iBand === undefined) unmatched.impact.add(i.label);
    if (e.label !== undefined && eBand === undefined) unmatched.exposure.add(e.label);
    if (likelihood === undefined && lBand !== undefined) {
      likelihood = lBand.representative;
      defaulted.add('/riskLikelihood');
    }
    let impact = i.number;
    let exposure = e.number;
    if (exposure === undefined && eBand !== undefined) {
      exposure = eBand.representative;
      defaulted.add('/exposureRating');
    }
    if (impact === undefined && iBand !== undefined) {
      impact = iBand.representative;
      defaulted.add('/riskImpact');
    }
    if (exposure === undefined && likelihood !== undefined && impact !== undefined) exposure = Math.round(likelihood * impact);
    if (impact === undefined && exposure !== undefined && likelihood !== undefined && likelihood > 0) {
      impact = Math.round(exposure / likelihood);
      defaulted.add('/riskImpact');
    }
    const placeholder = likelihood === undefined || impact === undefined || exposure === undefined;
    if (placeholder) {
      // Rule D-Q2. Placeholders, listed as defaulted.
      for (const field of ['/riskLikelihood', '/riskImpact', '/exposureRating']) defaulted.add(field);
      likelihood ??= 0;
      impact ??= 0;
      exposure = Math.round(likelihood * impact);
    }

    let riskCategory = cell(row, 'riskCategory')?.trim();
    if (riskCategory === undefined) {
      riskCategory = options.defaults?.riskCategory ?? 'Uncategorized';
      defaulted.add('/riskCategory');
    }
    const category = guessCategory(riskCategory) ?? options.defaults?.category ?? { code: 'ict' as const };
    defaulted.add('/category');

    let types: string[] = [];
    if (typeText !== undefined) {
      const parsed = parseResponseTypes(typeText, polarity);
      types = parsed.types;
      if (parsed.unknown.length > 0) warnings.push(`Row ${riskId} has unknown response words: ${parsed.unknown.join(', ')}.`);
    }
    let decision: 'decided' | 'pending' = 'decided';
    if (types.length === 0) {
      defaulted.add('/riskResponseType');
      if (responseText !== undefined) types = [polarity === 'negative' ? 'Mitigate' : 'Realize'];
      else {
        types = ['Accept'];
        decision = 'pending';
      }
    }
    const costText = cell(row, 'riskResponseCost');
    let cost = costText === undefined ? undefined : parseLocaleNumber(costText, locale);
    if (cost === undefined || decision === 'pending') {
      cost = 0;
      defaulted.add('/riskResponseCost');
    }
    let responseDescription = responseText === undefined ? undefined : lines(responseText);
    if (responseDescription === undefined) {
      responseDescription = options.defaults?.riskResponseDescription ?? 'Not in the source file.';
      defaulted.add('/riskResponseDescription');
    }
    const ownerText = cell(row, 'riskOwnerPointOfContact');
    let owner = ownerText === undefined ? undefined : lines(ownerText);
    if (owner === undefined) {
      owner = 'Unassigned';
      defaulted.add('/riskOwnerPointOfContact');
    }
    const statusText = cell(row, 'status');
    const status = parseStatus(statusText ?? 'Open');
    if (statusText === undefined) defaulted.add('/status');
    else if (!status.known) warnings.push(`Row ${riskId} has the unknown status "${statusText.trim()}". It is imported as Open.`);

    const risk: Record<string, unknown> = {
      riskId,
      registerId,
      polarity,
      riskDescription: description,
      riskCategory,
      category,
      riskLikelihood: likelihood,
      riskImpact: impact,
      exposureRating: exposure,
      riskResponseType: types,
      riskResponseCost: cost,
      riskResponseDescription: responseDescription,
      riskOwnerPointOfContact: owner,
      status: status.status,
      responseDecision: decision,
    };
    const priority = cell(row, 'priority');
    if (priority !== undefined && /^\d+$/.test(priority.trim())) risk['priority'] = Number(priority.trim());
    if (likelihoodLabel !== undefined) risk['riskLikelihoodLabel'] = likelihoodLabel;
    if (i.label !== undefined) risk['riskImpactLabel'] = i.label;
    if (e.label !== undefined) risk['exposureRatingLabel'] = e.label;
    const impacts: Record<string, unknown> = {};
    const financial = cell(row, 'financialImpact');
    if (financial !== undefined) {
      const split = parseOpexCapex(financial);
      const parts: Record<string, unknown> = {};
      if (split.opex !== undefined) parts['opex'] = { label: split.opex };
      if (split.capex !== undefined) parts['capex'] = { label: split.capex };
      if (Object.keys(parts).length === 0) parts['opex'] = { label: financial.trim() };
      impacts['financial'] = parts;
    }
    const reputation = cell(row, 'reputationImpact');
    if (reputation !== undefined) impacts['reputation'] = { label: reputation.trim() };
    const mission = cell(row, 'missionImpact');
    if (mission !== undefined) impacts['mission'] = { label: mission.trim() };
    if (Object.keys(impacts).length > 0) risk['impacts'] = impacts;
    const implemented = cell(row, 'implementedResponseDescription');
    if (implemented !== undefined) risk['detail'] = { implementedResponseDescription: lines(implemented) };
    const objectives = cell(row, 'objectiveIds');
    if (objectives !== undefined) risk['objectiveIds'] = objectives.split(/[,;]/).map((part) => part.trim()).filter((part) => part !== '');
    const review = cell(row, 'reviewDue')?.trim();
    if (review !== undefined) {
      if (/^\d{4}-\d{2}-\d{2}$/.test(review)) risk['reviewDue'] = review;
      else warnings.push(`Row ${riskId} has the review date "${review}", which is not a YYYY-MM-DD date. It is left out.`);
    }
    risk['defaultedFields'] = DEFAULTED_ORDER.filter((field) => defaulted.has(field));

    // The fields that the row states. A take incoming changes only these (Sec. 9.7).
    const stated: string[] = [];
    if (cell(row, 'registerId') !== undefined) stated.push('/registerId');
    if (cell(row, 'riskDescription') !== undefined) stated.push('/riskDescription');
    // The numbers go together (rule V-07). Placeholders are not stated.
    if (!placeholder) {
      stated.push('/riskLikelihood', '/riskImpact', '/exposureRating');
      for (const label of ['riskLikelihoodLabel', 'riskImpactLabel', 'exposureRatingLabel']) if (label in risk) stated.push(`/${label}`);
    }
    for (const field of ['/riskCategory', '/riskResponseDescription', '/riskOwnerPointOfContact']) if (!defaulted.has(field)) stated.push(field);
    if (statusText !== undefined && status.known) stated.push('/status');
    if (!defaulted.has('/riskResponseType')) {
      // The polarity and the cost go with the response type (rules V-04 and V-09).
      stated.push('/riskResponseType', '/responseDecision');
      if (types.some((type) => type !== 'Accept')) stated.push('/polarity');
      if (!defaulted.has('/riskResponseCost')) stated.push('/riskResponseCost');
    }
    if (options.polarity?.[riskId] !== undefined && !stated.includes('/polarity')) stated.push('/polarity');
    for (const pointer of OPTIONAL_STATED) if (valueAt(risk, pointer) !== undefined) stated.push(pointer);
    statedRows.push(stated);
    return risk as unknown as Risk;
  });

  // Ids must be unique. When the same id appears in rows of different registers, prefix each
  // with its register suffix. An id that the document already holds is a match for the merge.
  const ids = risks.map((risk) => risk.riskId);
  const collides = ids.some((id, index) => ids.indexOf(id) !== index);
  if (collides) {
    for (const risk of risks) risk.riskId = `${risk.registerId.split('-').at(-1) ?? risk.registerId}-${risk.riskId}`;
    warnings.push(`Risk Id values repeat, so each is prefixed with its register suffix (${risks.slice(0, 3).map((risk) => risk.riskId).join(', ')}).`);
  }
  for (const [kind, labels] of Object.entries(unmatched)) {
    if (labels.size > 0) warnings.push(`These ${kind} labels are not on the strategy scale: ${[...labels].join(', ')}. Map each to a band.`);
  }
  if (mapping.unmapped.length > 0) warnings.push(`These columns are not imported: ${mapping.unmapped.join(', ')}.`);
  // A column that holds only labels maps to the label field in the provenance record.
  const columnMapping: Record<string, string> = { ...mapping.record };
  const labelPointer = { likelihood: '/riskLikelihoodLabel', impact: '/riskImpactLabel', exposure: '/exposureRatingLabel' } as const;
  for (const target of ['likelihood', 'impact', 'exposure'] as const) {
    const index = column.get(target);
    if (index === undefined) continue;
    const values = body.map((row) => row[index] ?? '').filter((text) => text.trim() !== '').map((text) => parseCell(text, locale));
    if (values.length > 0 && values.every((value) => value.number === undefined)) columnMapping[(headers[index] ?? '').trim()] = labelPointer[target];
  }
  return {
    risks,
    registers: [...newRegisters.values()],
    warnings,
    columnMapping,
    stated: Object.fromEntries(risks.map((risk, index) => [risk.riskId, statedRows[index] ?? []])),
    unmapped: mapping.unmapped,
    unmatchedLabels: { likelihood: [...unmatched.likelihood], impact: [...unmatched.impact], exposure: [...unmatched.exposure] },
  };
}
