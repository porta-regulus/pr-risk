// NIST IR 8286 Rev. 1 JSON to native risks (SPEC.md Sec. 9.3).
import { importRdr, REGISTER_FIELDS } from '../schema/project';
import type { Risk } from '../schema/types';
import { guessCategory, parseStatus } from './values';

const POSITIVE_TYPES = new Set(['Realize', 'Share', 'Enhance']);
const RDR_ONLY_KEYS = [
  'systemAffected',
  'organizationOrBusinessUnit',
  'riskScenarioDescription',
  'assetsAffected',
  'threatSourcesActors',
  'threatVectors',
  'threatEvents',
  'vulnerabilityPredisposingConditions',
  'primaryAdverseImpact',
  'secondaryAdverseImpacts',
  'otherScenarioDetails',
  'currentRiskAnalysis',
  'resourceRequirementsForPlannedRisk',
  'dateOfRiskIdentification',
  'sourceOfRiskInformation',
  'currentStatusDate',
  'dependencies',
  'followUpDate',
  'comments',
] as const;

// A JSON value as text. Objects and arrays give an empty string.
const str = (value: unknown): string => (typeof value === 'string' ? value : typeof value === 'number' || typeof value === 'boolean' ? String(value) : '');

const isObject = (value: unknown): value is Record<string, unknown> => value !== null && typeof value === 'object' && !Array.isArray(value);

export function isIr8286(value: unknown): boolean {
  const items = Array.isArray(value) ? value : [value];
  return items.length > 0 && items.every((item) => isObject(item) && ('riskId' in item || 'riskIdNumbers' in item));
}

export interface Ir8286Result {
  readonly risks: Risk[];
  readonly warnings: string[];
  readonly recordCount: number;
  // Per riskId, the JSON Pointers of the fields that the file states (Sec. 9.7).
  readonly stated: Record<string, readonly string[]>;
}

// The NIST keys of a register entry or an RDR for the risk fields.
interface NistKeys {
  // Risk field to NIST key, for fields that change alone.
  readonly fields: Readonly<Record<string, string>>;
  readonly numbers: readonly string[];
  readonly type: string;
  readonly cost: string;
}

const ENTRY_KEYS: NistKeys = {
  fields: {
    riskDescription: 'riskDescription',
    riskCategory: 'riskCategory',
    riskResponseDescription: 'riskResponseDescription',
    riskOwnerPointOfContact: 'riskOwnerPointOfContact',
  },
  numbers: ['riskLikelihood', 'riskImpact', 'exposureRating'],
  type: 'riskResponseType',
  cost: 'riskResponseCost',
};

const RDR_KEYS: NistKeys = {
  fields: {
    riskDescription: 'riskScenarioDescription',
    riskCategory: 'riskCategory',
    riskResponseDescription: 'plannedRiskResponseDescription',
    riskOwnerPointOfContact: 'riskOwnerPointOfContact',
  },
  numbers: ['likelihoodBeforeControls', 'impactBeforeControls', 'exposureRatingBeforeControls'],
  type: 'plannedRiskResponse',
  cost: 'plannedResponseCost',
};

// The RDR keys of the planned and measured values in the risk detail.
const RDR_BLOCKS = [
  ['/detail/planned/likelihood', 'likelihoodAfterControlsWillBe'],
  ['/detail/planned/impact', 'impactAfterControls'],
  ['/detail/planned/exposureRating', 'expectedExposureRating'],
  ['/detail/measured/actualResponseCost', 'actualResponseCost'],
  ['/detail/measured/likelihood', 'likelihoodAfterControlsAreInPlaceWillBe'],
  ['/detail/measured/impact', 'impactAfterControlsAreInPlace'],
  ['/detail/measured/exposureRating', 'finalExposureRating'],
] as const;

// The fields that an entry or RDR states, and the detail that an RDR states.
function statedOf(item: Record<string, unknown>, keys: NistKeys, types: readonly string[], rdr?: Record<string, unknown>, detail?: object): string[] {
  const stated = Object.entries(keys.fields)
    .filter(([, key]) => key in item)
    .map(([field]) => `/${field}`);
  // The numbers go together (rule V-07).
  if (keys.numbers.some((key) => key in item)) stated.push('/riskLikelihood', '/riskImpact', '/exposureRating');
  if (keys.type in item) {
    // The polarity and the cost go with the response type (rules V-04 and V-09).
    stated.push('/riskResponseType', '/responseDecision');
    if (types.some((type) => type !== 'Accept')) stated.push('/polarity');
    if (keys.cost in item) stated.push('/riskResponseCost');
  }
  if (rdr !== undefined) {
    // The import makes the planned and measured blocks for each RDR, so only the keys of the RDR are stated.
    for (const key of Object.keys(detail ?? {})) if (key !== 'planned' && key !== 'measured') stated.push(`/detail/${key}`);
    for (const [pointer, key] of RDR_BLOCKS) if (key in rdr) stated.push(pointer);
  }
  return stated;
}

// One register entry or RDR, or an array of them. Entries and RDRs join by riskId = riskIdNumbers.
export function importIr8286(json: unknown, registerId: string): Ir8286Result {
  if (!isIr8286(json)) throw new Error('The file is not NIST IR 8286 JSON. Each object needs riskId or riskIdNumbers.');
  const items = (Array.isArray(json) ? json : [json]) as Record<string, unknown>[];
  const entries = items.filter((item) => 'riskId' in item);
  const rdrs = new Map(items.filter((item) => 'riskIdNumbers' in item).map((item) => [str(item['riskIdNumbers']), item]));
  const warnings: string[] = [];
  const risks: Risk[] = [];
  const stated: Record<string, readonly string[]> = {};

  for (const entry of entries) {
    const id = str(entry['riskId']);
    const missing = REGISTER_FIELDS.filter((field) => !(field in entry));
    if (missing.length > 0) warnings.push(`Entry ${id} has no ${missing.join(', ')}.`);
    const types = Array.isArray(entry['riskResponseType']) ? (entry['riskResponseType'] as string[]) : ['Accept'];
    const defaulted = ['/polarity', '/category'];
    let likelihood = Number(entry['riskLikelihood'] ?? 0);
    if (likelihood > 1) {
      warnings.push(`Entry ${id} has riskLikelihood ${String(likelihood)}, read as a percentage.`);
      likelihood /= 100;
    }
    const status = parseStatus(str(entry['status'] ?? 'Open'));
    if (!status.known) {
      warnings.push(`Entry ${id} has the unknown status "${str(entry['status'])}". It is imported as Open.`);
      defaulted.push('/status');
    }
    const riskCategory = str(entry['riskCategory'] ?? '');
    const risk: Record<string, unknown> = {
      riskId: id,
      riskDescription: str(entry['riskDescription'] ?? ''),
      riskCategory,
      riskLikelihood: likelihood,
      riskImpact: Number(entry['riskImpact'] ?? 0),
      exposureRating: Number(entry['exposureRating'] ?? 0),
      riskResponseType: types,
      riskResponseCost: Number(entry['riskResponseCost'] ?? 0),
      riskResponseDescription: str(entry['riskResponseDescription'] ?? ''),
      riskOwnerPointOfContact: str(entry['riskOwnerPointOfContact'] ?? ''),
      status: status.status,
      registerId,
      polarity: types.some((type) => POSITIVE_TYPES.has(type)) ? 'positive' : 'negative',
      category: guessCategory(riskCategory) ?? { code: 'ict' },
      responseDecision: 'decided',
      defaultedFields: defaulted,
    };
    const rdr = rdrs.get(id);
    if (rdr !== undefined) {
      rdrs.delete(id);
      const detail: Record<string, unknown> = {};
      for (const key of RDR_ONLY_KEYS) if (key in rdr) detail[key] = rdr[key];
      detail['planned'] = { likelihood: rdr['likelihoodAfterControlsWillBe'], impact: rdr['impactAfterControls'], exposureRating: rdr['expectedExposureRating'] };
      detail['measured'] = {
        actualResponseCost: rdr['actualResponseCost'],
        likelihood: rdr['likelihoodAfterControlsAreInPlaceWillBe'],
        impact: rdr['impactAfterControlsAreInPlace'],
        exposureRating: rdr['finalExposureRating'],
      };
      risk['detail'] = detail;
    }
    const fields = statedOf(entry, ENTRY_KEYS, types, rdr, risk['detail'] as object | undefined);
    stated[id] = status.known && 'status' in entry ? [...fields, '/status'] : fields;
    risks.push(risk as unknown as Risk);
  }
  for (const rdr of rdrs.values()) {
    if (!('currentRiskAnalysis' in rdr)) warnings.push(`RDR ${str(rdr['riskIdNumbers'])} has no currentRiskAnalysis, which the NIST RDR schema requires.`);
    const risk = importRdr(rdr, registerId);
    stated[risk.riskId] = statedOf(rdr, RDR_KEYS, risk.riskResponseType, rdr, risk.detail);
    risks.push(risk);
  }
  if (rdrs.size > 0) warnings.push('Status, polarity and category are not in an RDR and are defaulted.');
  return { risks, warnings, recordCount: items.length, stated };
}
