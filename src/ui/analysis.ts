// NIST numbers and live feedback for a risk (SPEC.md Sec. 5 estimate words, 7.3 and 8.8).
// With an estimate, riskLikelihood, riskImpact and exposureRating come from the simulation. Each risk has its own random streams (Sec. 8.6 item 7), so a run of one risk
// with its drivers gives exactly the numbers that a run of the whole document gives.
import { canonicalize } from '../schema/canonical';
import type { Distribution, Risk, RiskDocument } from '../schema/types';
import { ENGINE_VERSION } from '../engine/index';
import { mean, shareAtLeastOne } from '../engine/metrics';
import { sampler } from '../engine/sample';
import { simulate } from '../engine/simulate';

export const DEFAULT_TRIALS = 100_000;
const NUMERIC = ['/riskLikelihood', '/riskImpact', '/exposureRating'];
// Rule D-Q2 writes this text for a risk without estimates.
export const NOT_ESTIMATED = 'Not estimated. Numeric fields are placeholders.';

export interface RiskNumbers {
  readonly probability: number;
  readonly expectedAnnual: number;
  readonly riskLikelihood: number;
  readonly riskImpact: number;
  readonly exposureRating: number;
}

// Sec. 8.8 and 7.3. Likelihood with 4 decimals, impact and exposure in whole currency units,
// exposure as the product of the stored likelihood and impact (rule V-07).
export function riskNumbers(doc: RiskDocument, riskId: string): RiskNumbers | undefined {
  const risk = doc.risks.find((item) => item.riskId === riskId);
  if (risk?.estimate === undefined || (risk.sourceRefs ?? []).length > 0) return undefined;
  const linked = new Set((risk.driverLinks ?? []).map((link) => link.driverId));
  const alone: RiskDocument = { ...doc, risks: [risk], drivers: (doc.drivers ?? []).filter((driver) => linked.has(driver.id)) };
  const run = simulate(alone, {
    trials: doc.simulation?.trials ?? DEFAULT_TRIALS,
    seed: doc.simulation?.seed ?? 0,
    active: risk.onlyWithResponse === undefined ? [] : [risk.onlyWithResponse],
  });
  const result = run.risks.get(riskId);
  if (result === undefined) return undefined;
  const probability = shareAtLeastOne(result.counts);
  const expectedAnnual = mean(result.annual);
  const riskLikelihood = Math.round(probability * 10_000) / 10_000;
  const riskImpact = probability > 0 ? Math.round(expectedAnnual / probability) : 0;
  return { probability, expectedAnnual, riskLikelihood, riskImpact, exposureRating: Math.round(riskLikelihood * riskImpact) };
}

// A document with an estimate needs a seed. A new seed is random, and it is stored, so every
// later run of the document gives the same numbers.
export function withSimulationSettings(doc: RiskDocument, random = (): number => crypto.getRandomValues(new Uint32Array(1))[0] ?? 0): RiskDocument {
  if (doc.simulation !== undefined || !doc.risks.some((risk) => risk.estimate !== undefined)) return doc;
  return { ...doc, simulation: { seed: random(), trials: DEFAULT_TRIALS, engineVersion: ENGINE_VERSION } };
}

const inputsOf = (doc: RiskDocument, risk: Risk): string => {
  const linked = new Set((risk.driverLinks ?? []).map((link) => link.driverId));
  const register = doc.registers.find((item) => item.id === risk.registerId);
  return canonicalize([
    risk.estimate ?? null,
    risk.driverLinks ?? [],
    risk.onlyWithResponse ?? null,
    register?.timeframeMonths ?? null,
    register?.reportableEventThreshold ?? null,
    (doc.drivers ?? []).filter((driver) => linked.has(driver.id)),
    doc.registers.find((item) => item.parentRegisterId === undefined)?.timeframeMonths ?? null,
    doc.simulation ?? null,
    risk.onlyWithResponse === undefined ? null : (doc.responses ?? []).find((option) => option.id === risk.onlyWithResponse) ?? null,
  ]);
};

type Numbers = Pick<RiskNumbers, 'riskLikelihood' | 'riskImpact' | 'exposureRating'>;

// The risk with these numbers. Simulated numbers are no longer defaulted. Numbers from
// labels stay listed in defaultedFields, as the importer lists them (Sec. 9.4). The list
// keeps its order, and missing numeric fields go first.
function withNumbers(risk: Risk, numbers: Numbers, fromLabels = false): Risk {
  const listed = risk.defaultedFields ?? [];
  const defaulted = fromLabels ? [...NUMERIC.filter((field) => !listed.includes(field)), ...listed] : listed.filter((field) => !NUMERIC.includes(field));
  const { defaultedFields: _defaulted, ...rest } = risk;
  const detail = risk.detail?.currentRiskAnalysis === NOT_ESTIMATED ? (({ currentRiskAnalysis: _text, ...other }) => other)(risk.detail) : risk.detail;
  return {
    ...rest,
    riskLikelihood: numbers.riskLikelihood,
    riskImpact: numbers.riskImpact,
    exposureRating: numbers.exposureRating,
    ...(defaulted.length === 0 ? {} : { defaultedFields: defaulted }),
    ...(detail === undefined || Object.keys(detail).length === 0 ? {} : { detail }),
  };
}

// Rules D-Q1 and D-Q3 of SPEC.md Sec. 7.3 for a risk without an estimate. The likelihood is
// the representative of its label. An exposure label gives the exposure (D-Q1), else an
// impact label gives the impact (D-Q3). Without enough labels there is no result.
export function labelNumbers(doc: RiskDocument, risk: Risk): Numbers | undefined {
  const scales = doc.strategy?.scales;
  type Band = NonNullable<NonNullable<typeof scales>['likelihood']>[number];
  const band = (bands: readonly Band[] | undefined, label: string | undefined): Band | undefined =>
    label === undefined ? undefined : bands?.find((item) => item.label === label || (item.aliases ?? []).includes(label));
  const likelihood = band(scales?.likelihood, risk.riskLikelihoodLabel)?.representative;
  if (likelihood === undefined) return undefined;
  const exposure = band(scales?.exposure, risk.exposureRatingLabel)?.representative;
  if (exposure !== undefined) {
    const impact = likelihood > 0 ? Math.round(exposure / likelihood) : 0;
    return { riskLikelihood: likelihood, riskImpact: impact, exposureRating: likelihood > 0 ? exposure : 0 };
  }
  const impact = band(scales?.impact, risk.riskImpactLabel)?.representative;
  return impact === undefined ? undefined : { riskLikelihood: likelihood, riskImpact: impact, exposureRating: Math.round(likelihood * impact) };
}

const labelInputs = (doc: RiskDocument, risk: Risk): string =>
  canonicalize([risk.riskLikelihoodLabel ?? null, risk.riskImpactLabel ?? null, risk.exposureRatingLabel ?? null, doc.strategy?.scales ?? null]);

// Sets the NIST numbers of every risk whose inputs differ from the saved version, or whose
// numbers are still placeholders (rule D-Q2). A risk with an estimate takes the simulation,
// in any register, because a register moves to quantitative risk by risk (Sec. 6.8). A
// risk without an estimate takes its labels (D-Q1, D-Q3). Numbers that labels cannot give
// stay as they are, so nothing typed or imported is lost.
export function withNistNumbers(saved: RiskDocument, draft: RiskDocument): RiskDocument {
  const risks = draft.risks.map((risk) => {
    const before = saved.risks.find((item) => item.riskId === risk.riskId);
    if (risk.estimate === undefined) {
      if (before !== undefined && labelInputs(saved, before) === labelInputs(draft, risk)) return risk;
      const numbers = labelNumbers(draft, risk);
      return numbers === undefined ? risk : withNumbers(risk, numbers, true);
    }
    const placeholder = (risk.defaultedFields ?? []).some((field) => NUMERIC.includes(field));
    if (!placeholder && before !== undefined && inputsOf(saved, before) === inputsOf(draft, risk)) return risk;
    const numbers = riskNumbers(draft, risk.riskId);
    return numbers === undefined ? risk : withNumbers(risk, numbers);
  });
  return risks.some((risk, i) => risk !== draft.risks[i]) ? { ...draft, risks } : draft;
}

// True when the numbers of the distribution allow a simulation (rules V-10 and V-13 aside).
export function usable(distribution: Distribution | undefined): boolean {
  if (distribution === undefined) return false;
  const finite = (...values: (number | undefined)[]): boolean => values.every((value) => value !== undefined && Number.isFinite(value) && value >= 0);
  if (distribution.type === 'lognormal') return finite(distribution.lower, distribution.upper) && (distribution.lower ?? 0) > 0 && (distribution.lower ?? 0) < (distribution.upper ?? 0);
  if (distribution.type === 'pert') return finite(distribution.min, distribution.mode, distribution.max) && (distribution.min ?? 0) <= (distribution.mode ?? 0) && (distribution.mode ?? 0) <= (distribution.max ?? 0);
  return finite(distribution.value);
}

export interface Feedback {
  readonly numbers?: RiskNumbers;
  // Events per year with the drivers, E[lambda_r] plus the sum of q E[lambda_d] (Sec. 8.3).
  readonly totalFrequency: number;
  readonly medianFrequency?: number;
  readonly medianImpact?: number;
  readonly meanImpact: number;
}

const median = (distribution: Distribution): number | undefined => {
  if (distribution.type === 'lognormal' && distribution.lower !== undefined && distribution.upper !== undefined) return Math.sqrt(distribution.lower * distribution.upper);
  if (distribution.type === 'constant') return distribution.value;
  return undefined;
};

// Live feedback under the estimate fields (SPEC.md Sec. 5 item 5).
export function feedback(doc: RiskDocument, riskId: string): Feedback | undefined {
  const risk = doc.risks.find((item) => item.riskId === riskId);
  const estimate = risk?.estimate;
  if (risk === undefined || estimate === undefined || !usable(estimate.frequency) || !usable(estimate.impactPerEvent)) return undefined;
  if ((estimate.secondaryImpacts ?? []).some((item) => !usable(item.impactPerEvent) || !(item.probability >= 0 && item.probability <= 1))) return undefined;
  const drivers = new Map((doc.drivers ?? []).map((driver) => [driver.id, driver]));
  const viaDrivers = (risk.driverLinks ?? []).reduce((sum, link) => {
    const driver = drivers.get(link.driverId);
    return driver === undefined ? sum : sum + link.triggerProbability * sampler(driver.frequency).mean;
  }, 0);
  const secondary = (estimate.secondaryImpacts ?? []).reduce((sum, item) => sum + item.probability * sampler(item.impactPerEvent).mean, 0);
  const numbers = riskNumbers(doc, riskId);
  const medianFrequency = median(estimate.frequency);
  const medianImpact = median(estimate.impactPerEvent);
  return {
    ...(numbers === undefined ? {} : { numbers }),
    totalFrequency: sampler(estimate.frequency).mean + viaDrivers,
    ...(medianFrequency === undefined ? {} : { medianFrequency }),
    ...(medianImpact === undefined ? {} : { medianImpact }),
    meanImpact: sampler(estimate.impactPerEvent).mean + secondary,
  };
}

const sameInputs = (a: RiskDocument, riskA: Risk, b: RiskDocument, riskB: Risk): boolean =>
  inputsOf(a, riskA) === inputsOf(b, riskB) && labelInputs(a, riskA) === labelInputs(b, riskB);

// After a save, the open draft takes the numbers that the save computed, for every risk whose
// inputs did not change since. Without this, the next save would write the old numbers back.
export function withNumbersFrom(saved: RiskDocument, current: RiskDocument): RiskDocument {
  // The first save of an estimate adds the simulation settings (seed). The draft takes them too.
  const draft = current.simulation === undefined && saved.simulation !== undefined ? { ...current, simulation: saved.simulation } : current;
  const byId = new Map(saved.risks.map((risk) => [risk.riskId, risk]));
  const risks = draft.risks.map((risk) => {
    const source = byId.get(risk.riskId);
    if (source === undefined || source === risk || !sameInputs(saved, source, draft, risk)) return risk;
    const numbersSame =
      source.riskLikelihood === risk.riskLikelihood &&
      source.riskImpact === risk.riskImpact &&
      source.exposureRating === risk.exposureRating &&
      canonicalize(source.defaultedFields ?? []) === canonicalize(risk.defaultedFields ?? []) &&
      source.detail?.currentRiskAnalysis === risk.detail?.currentRiskAnalysis;
    if (numbersSame) return risk;
    const { defaultedFields: _defaulted, ...rest } = risk;
    const { currentRiskAnalysis: _text, ...otherDetail } = risk.detail ?? {};
    const detail = source.detail?.currentRiskAnalysis === undefined ? otherDetail : { ...otherDetail, currentRiskAnalysis: source.detail.currentRiskAnalysis };
    return {
      ...rest,
      riskLikelihood: source.riskLikelihood,
      riskImpact: source.riskImpact,
      exposureRating: source.exposureRating,
      ...(source.defaultedFields === undefined ? {} : { defaultedFields: source.defaultedFields }),
      ...(Object.keys(detail).length === 0 ? {} : { detail }),
    };
  });
  return risks.some((risk, i) => risk !== draft.risks[i]) ? { ...draft, risks } : draft;
}
