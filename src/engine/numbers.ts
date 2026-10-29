// NIST numbers of one risk from a run of that risk with its drivers (SPEC.md Sec. 7.3, 8.8).
// Each risk has its own random streams (Sec. 8.6 item 7), so this equals its numbers in a
// run of the whole document.
import type { RiskDocument } from '../schema/types';
import { mean, shareAtLeastOne } from './metrics';
import { simulate } from './simulate';

export const DEFAULT_TRIALS = 100_000;

export interface RiskNumbers {
  readonly probability: number;
  readonly expectedAnnual: number;
  readonly riskLikelihood: number;
  readonly riskImpact: number;
  readonly exposureRating: number;
}

// Likelihood with 4 decimals, impact and exposure in whole currency units, exposure as the
// product of the stored likelihood and impact (rule V-07).
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

export function numbersOf(doc: RiskDocument, riskIds: readonly string[]): Record<string, RiskNumbers> {
  const out: Record<string, RiskNumbers> = {};
  for (const id of riskIds) {
    const numbers = riskNumbers(doc, id);
    if (numbers !== undefined) out[id] = numbers;
  }
  return out;
}
