// IR 8286 projection (SPEC.md Sec. 7.4) and RDR import (Sec. 9.3).
// A 1 to 1 port of project_register, analysis_text, project_rdr and import_rdr in
// docs/schema/validate.py. Test test/schema-parity.test.ts checks equal output.
import { capitalize, formatG } from './pyformat';
import type { Distribution, NistRegisterEntry, Register, Risk, RiskDetail, RiskDocument } from './types';

export const REGISTER_FIELDS = [
  'riskId',
  'riskDescription',
  'riskCategory',
  'riskLikelihood',
  'riskImpact',
  'exposureRating',
  'riskResponseType',
  'riskResponseCost',
  'riskResponseDescription',
  'riskOwnerPointOfContact',
  'status',
] as const;

export type NistRdr = Record<string, unknown>;

// Python dict.get(key, default). A key that is present wins, also when its value is empty.
function get<T extends object, K extends keyof T, D>(object: T | undefined, key: K, fallback: D): NonNullable<T[K]> | D {
  if (object !== undefined && Object.hasOwn(object, key)) return object[key] as NonNullable<T[K]>;
  return fallback;
}

function registerOf(doc: RiskDocument, risk: Risk): Register {
  const register = doc.registers.find((item) => item.id === risk.registerId);
  if (register === undefined) throw new Error(`Risk ${risk.riskId} has an unknown register ${risk.registerId}`);
  return register;
}

export function projectRegister(risk: Risk): NistRegisterEntry {
  const entry: Record<string, unknown> = {};
  for (const field of REGISTER_FIELDS) entry[field] = risk[field];
  return entry as unknown as NistRegisterEntry;
}

function describe(distribution: Distribution): string {
  if (distribution.type === 'lognormal') {
    return `lognormal 90% interval ${formatG(distribution.lower ?? Number.NaN)} to ${formatG(distribution.upper ?? Number.NaN)}`;
  }
  if (distribution.type === 'pert') {
    return `PERT ${formatG(distribution.min ?? Number.NaN)}, ${formatG(distribution.mode ?? Number.NaN)}, ${formatG(distribution.max ?? Number.NaN)}`;
  }
  return `constant ${formatG(distribution.value ?? Number.NaN)}`;
}

// Python prints None for a missing value.
const pyText = (value: number | undefined): string => (value === undefined ? 'None' : String(value));

export function analysisText(doc: RiskDocument, risk: Risk): string {
  const register = registerOf(doc, risk);
  const estimate = risk.estimate;
  if (estimate !== undefined) {
    const links = (risk.driverLinks ?? [])
      .map((link) => `${link.driverId} (${formatG(link.triggerProbability)})`)
      .join(', ');
    const secondary = (estimate.secondaryImpacts ?? [])
      .map(
        (item) =>
          ` Secondary impact '${item.description}' with probability ${formatG(item.probability)}, ${describe(item.impactPerEvent)}.`,
      )
      .join('');
    const simulation = doc.simulation;
    return (
      `Quantitative, ${String(register.timeframeMonths)} months. Frequency per year ${describe(estimate.frequency)}. ` +
      `Impact per event ${describe(estimate.impactPerEvent)} ${doc.document.currency}. ` +
      `Drivers ${links || 'none'}.${secondary} Seed ${pyText(simulation?.seed)}, ${pyText(simulation?.trials)} trials.`
    );
  }
  const labels = (
    [
      ['likelihood', risk.riskLikelihoodLabel],
      ['impact', risk.riskImpactLabel],
      ['exposure', risk.exposureRatingLabel],
    ] as const
  )
    .filter(([, label]) => Boolean(label))
    .map(([name, label]) => `${name} ${label ?? ''}`);
  if (labels.length > 0) {
    return `${capitalize(register.method)}. Labels on the strategy scale, ${labels.join(', ')}.`;
  }
  const defaulted = risk.defaultedFields ?? [];
  if (defaulted.includes('riskLikelihood') || defaulted.includes('/riskLikelihood')) {
    return 'Not estimated. Numeric fields are placeholders.';
  }
  return `${capitalize(register.method)}. Point values as entered.`;
}

export function projectRdr(doc: RiskDocument, risk: Risk): NistRdr {
  const register = registerOf(doc, risk);
  const detail: RiskDetail = risk.detail ?? {};
  const planned = detail.planned ?? {};
  const measured = detail.measured ?? {};
  const driverNames = new Map((doc.drivers ?? []).map((driver) => [driver.id, driver.name]));
  const dependencies = (risk.driverLinks ?? [])
    .map((link) => `Shared driver ${link.driverId} ${driverNames.get(link.driverId) ?? ''}`.trim())
    .join('; ');
  let ids = risk.riskId;
  if (risk.sourceRefs !== undefined && risk.sourceRefs.length > 0) {
    ids += `; sources ${risk.sourceRefs.map((source) => source.label || `${source.registerId}-${source.riskId}`).join(', ')}`;
  }
  const rdr: NistRdr = {
    riskIdNumbers: ids,
    systemAffected: get(detail, 'systemAffected', register.title),
    organizationOrBusinessUnit: get(detail, 'organizationOrBusinessUnit', get(doc.document, 'organization', '')),
    riskScenarioDescription: get(detail, 'riskScenarioDescription', risk.riskDescription),
    assetsAffected: get(detail, 'assetsAffected', ''),
    threatSourcesActors: get(detail, 'threatSourcesActors', ''),
    threatVectors: get(detail, 'threatVectors', ''),
    threatEvents: get(detail, 'threatEvents', ''),
    vulnerabilityPredisposingConditions: get(detail, 'vulnerabilityPredisposingConditions', ''),
    primaryAdverseImpact: get(detail, 'primaryAdverseImpact', ''),
    secondaryAdverseImpacts: get(detail, 'secondaryAdverseImpacts', ''),
    otherScenarioDetails: get(detail, 'otherScenarioDetails', ''),
    riskCategory: risk.riskCategory,
    currentRiskAnalysis: get(detail, 'currentRiskAnalysis', analysisText(doc, risk)),
    likelihoodBeforeControls: risk.riskLikelihood,
    impactBeforeControls: risk.riskImpact,
    exposureRatingBeforeControls: risk.exposureRating,
    plannedRiskResponse: risk.riskResponseType,
    plannedRiskResponseDescription: risk.riskResponseDescription,
    resourceRequirementsForPlannedRisk: get(detail, 'resourceRequirementsForPlannedRisk', ''),
    plannedResponseCost: risk.riskResponseCost,
    likelihoodAfterControlsWillBe: get(planned, 'likelihood', risk.riskLikelihood),
    impactAfterControls: get(planned, 'impact', risk.riskImpact),
    expectedExposureRating: get(planned, 'exposureRating', risk.exposureRating),
    actualResponseCost: get(measured, 'actualResponseCost', 0),
    likelihoodAfterControlsAreInPlaceWillBe: get(measured, 'likelihood', risk.riskLikelihood),
    impactAfterControlsAreInPlace: get(measured, 'impact', risk.riskImpact),
    finalExposureRating: get(measured, 'exposureRating', risk.exposureRating),
    riskOwnerPointOfContact: risk.riskOwnerPointOfContact,
    dateOfRiskIdentification: get(detail, 'dateOfRiskIdentification', register.asOf),
    sourceOfRiskInformation: get(detail, 'sourceOfRiskInformation', 'Risk register entry'),
    currentStatusDate: get(detail, 'currentStatusDate', register.asOf),
    dependencies: get(detail, 'dependencies', dependencies),
    followUpDate: get(detail, 'followUpDate', get(risk, 'reviewDue', '')),
  };
  if (Object.hasOwn(detail, 'comments')) rdr['comments'] = detail.comments;
  return rdr;
}

const RDR_DETAIL_KEYS = [
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
  'resourceRequirementsForPlannedRisk',
  'dateOfRiskIdentification',
  'sourceOfRiskInformation',
  'currentStatusDate',
  'dependencies',
  'followUpDate',
  'comments',
  'currentRiskAnalysis',
] as const;

// SPEC.md Sec. 9.3. A NIST RDR becomes a native risk. Fields that the RDR does not
// hold get defaults, and defaultedFields lists them.
export function importRdr(rdr: NistRdr, registerId: string): Risk {
  const detail: Record<string, unknown> = {};
  for (const key of RDR_DETAIL_KEYS) if (Object.hasOwn(rdr, key)) detail[key] = rdr[key];
  detail['planned'] = {
    likelihood: rdr['likelihoodAfterControlsWillBe'],
    impact: rdr['impactAfterControls'],
    exposureRating: rdr['expectedExposureRating'],
  };
  detail['measured'] = {
    actualResponseCost: rdr['actualResponseCost'],
    likelihood: rdr['likelihoodAfterControlsAreInPlaceWillBe'],
    impact: rdr['impactAfterControlsAreInPlace'],
    exposureRating: rdr['finalExposureRating'],
  };
  return {
    riskId: rdr['riskIdNumbers'],
    registerId,
    polarity: 'negative',
    riskDescription: rdr['riskScenarioDescription'],
    riskCategory: rdr['riskCategory'],
    category: { code: 'ict' },
    riskLikelihood: rdr['likelihoodBeforeControls'],
    riskImpact: rdr['impactBeforeControls'],
    exposureRating: rdr['exposureRatingBeforeControls'],
    riskResponseType: Object.hasOwn(rdr, 'plannedRiskResponse') ? rdr['plannedRiskResponse'] : ['Accept'],
    riskResponseCost: rdr['plannedResponseCost'],
    riskResponseDescription: rdr['plannedRiskResponseDescription'],
    riskOwnerPointOfContact: rdr['riskOwnerPointOfContact'],
    status: 'Open',
    responseDecision: 'decided',
    detail,
    defaultedFields: ['/polarity', '/category', '/status'],
  } as unknown as Risk;
}
