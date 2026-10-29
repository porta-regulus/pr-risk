// Forecast log and Brier score (SPEC.md Sec. 8.14).
import { ENGINE_VERSION } from '../engine';
import { quantile, sortedCopy } from '../engine/metrics';
import type { Run } from '../engine/simulate';
import { canonicalSha256 } from '../schema/canonical';
import type { Risk, RiskDocument } from '../schema/types';

type Forecast = NonNullable<RiskDocument['forecasts']>[number];

// SHA-256 of the RFC 8785 JSON of everything that decides the forecast. The key names
// are the ones example 2 uses, so its stored hashes check out.
export function forecastInputs(doc: RiskDocument, risk: Risk, eventThreshold: number, seed: number, trials: number, engineVersion: string): string {
  const drivers = new Map((doc.drivers ?? []).map((driver) => [driver.id, driver]));
  const register = doc.registers.find((item) => item.id === risk.registerId);
  const links = risk.driverLinks ?? [];
  return canonicalSha256({
    estimate: risk.estimate,
    driverLinks: links,
    drivers: links.map((link) => drivers.get(link.driverId)),
    timeframeMonths: register?.timeframeMonths ?? 12,
    eventThreshold,
    seed,
    trials,
    engineVersion,
  });
}

// The last day of a window of m months that starts on start (2025-10-27 + 12 gives 2026-10-26).
export function windowEnd(start: string, months: number): string {
  const [year = 0, month = 1, day = 1] = start.split('-').map(Number);
  const end = new Date(Date.UTC(year, month - 1 + months, day));
  end.setUTCDate(end.getUTCDate() - 1);
  return end.toISOString().slice(0, 10);
}

export interface FreezeOptions {
  readonly createdOn: string;
  readonly engineVersion?: string;
  // Event text per riskId. Default text names the risk and the threshold.
  readonly eventDefinitions?: Readonly<Record<string, string>>;
}

// "Freeze forecasts" makes one forecast per simulated leaf risk. A frozen forecast is never edited.
export function freezeForecasts(doc: RiskDocument, run: Run, options: FreezeOptions): Forecast[] {
  const engineVersion = options.engineVersion ?? `pr-risk engine ${ENGINE_VERSION}`;
  const out: Forecast[] = [];
  for (const risk of doc.risks) {
    const result = run.risks.get(risk.riskId);
    const register = doc.registers.find((item) => item.id === risk.registerId);
    if (result === undefined || register === undefined) continue;
    const threshold = register.reportableEventThreshold ?? 0;
    let hits = 0;
    for (let t = 0; t < run.trials; t++) if ((result.above[t] ?? 0) >= 1) hits += 1;
    const sorted = sortedCopy(result.annual);
    const end = windowEnd(register.asOf, register.timeframeMonths);
    out.push({
      id: `F-${end.slice(0, 4)}-${risk.riskId}`,
      riskId: risk.riskId,
      createdOn: options.createdOn,
      windowStart: register.asOf,
      windowEnd: end,
      eventDefinition:
        options.eventDefinitions?.[risk.riskId] ??
        `At least one event of risk ${risk.riskId} with an impact of ${doc.document.currency} ${String(threshold)} or more between windowStart and windowEnd.`,
      eventThreshold: threshold,
      probability: Math.round((hits / run.trials) * 10_000) / 10_000,
      annualImpactInterval90: { lower: Math.round(quantile(sorted, 0.05)), upper: Math.round(quantile(sorted, 0.95)) },
      engineVersion,
      seed: run.seed,
      trials: run.trials,
      inputsSha256: forecastInputs(doc, risk, threshold, run.seed, run.trials, engineVersion),
    });
  }
  return out;
}

export interface BrierScores {
  readonly n: number;
  readonly brier: number;
  readonly brierSe: number;
  readonly interval95: readonly [number, number];
  readonly baseRate: number;
  // Undefined when every outcome is the same (base rate 0 or 1).
  readonly skill?: number;
  readonly reliability: number;
  readonly resolution: number;
  readonly uncertainty: number;
  // BS minus (REL - RES + UNC). Zero when all forecasts in a bin are equal.
  readonly decompositionGap: number;
  // Share of resolved forecasts with an observed annual impact inside the 90% interval.
  readonly intervalHitRate?: number;
}

// Brier (1950), Murphy (1973) with 10 equal-width bins of f.
export function brierScores(forecasts: readonly Forecast[]): BrierScores | undefined {
  const resolved = forecasts.filter((forecast): forecast is Forecast & { outcome: NonNullable<Forecast['outcome']> } => forecast.outcome !== undefined);
  const n = resolved.length;
  if (n === 0) return undefined;
  const f = resolved.map((forecast) => forecast.probability);
  const o: number[] = resolved.map((forecast) => (forecast.outcome.occurred ? 1 : 0));
  const squared = f.map((p, i) => (p - (o[i] ?? 0)) ** 2);
  const brier = squared.reduce((a, b) => a + b, 0) / n;
  const sd = n > 1 ? Math.sqrt(squared.reduce((a, b) => a + (b - brier) ** 2, 0) / (n - 1)) : 0;
  const brierSe = sd / Math.sqrt(n);
  const baseRate = o.reduce((a, b) => a + b, 0) / n;
  const uncertainty = baseRate * (1 - baseRate);
  const bins = new Map<number, { f: number[]; o: number[] }>();
  f.forEach((p, i) => {
    const k = Math.min(9, Math.floor(p * 10));
    const bin = bins.get(k) ?? { f: [], o: [] };
    bin.f.push(p);
    bin.o.push(o[i] ?? 0);
    bins.set(k, bin);
  });
  let reliability = 0;
  let resolution = 0;
  for (const bin of bins.values()) {
    const fbar = bin.f.reduce((a, b) => a + b, 0) / bin.f.length;
    const obar = bin.o.reduce((a, b) => a + b, 0) / bin.o.length;
    reliability += bin.f.length * (fbar - obar) ** 2;
    resolution += bin.f.length * (obar - baseRate) ** 2;
  }
  reliability /= n;
  resolution /= n;
  const withInterval = resolved.filter((forecast) => forecast.annualImpactInterval90 !== undefined && forecast.outcome.observedAnnualImpact !== undefined);
  const hits = withInterval.filter((forecast) => {
    const value = forecast.outcome.observedAnnualImpact ?? Number.NaN;
    const interval = forecast.annualImpactInterval90;
    return interval !== undefined && value >= interval.lower && value <= interval.upper;
  }).length;
  return {
    n,
    brier,
    brierSe,
    interval95: [Math.max(0, brier - 1.96 * brierSe), Math.min(1, brier + 1.96 * brierSe)],
    baseRate,
    ...(uncertainty > 0 ? { skill: 1 - brier / uncertainty } : {}),
    reliability,
    resolution,
    uncertainty,
    decompositionGap: brier - (reliability - resolution + uncertainty),
    ...(withInterval.length > 0 ? { intervalHitRate: hits / withInterval.length } : {}),
  };
}
