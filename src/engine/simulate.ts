// The model loop of SPEC.md Sec. 8.2, with drivers (Sec. 8.7), secondary impacts
// (Sec. 8.4), response effects (Sec. 8.10) and the streams of Sec. 8.6.
import { canonicalize } from '../schema/canonical';
import type { Distribution, Register, Risk, RiskDocument } from '../schema/types';
import { Mulberry32, stream } from './rng';
import { poisson, RATE_CAP, sampler } from './sample';

export interface RunOptions {
  readonly trials: number;
  readonly seed: number;
  // Funded response options, in order. Their effects replace distributions.
  readonly active?: readonly string[];
}

export interface RiskRun {
  readonly riskId: string;
  readonly registerId: string;
  readonly polarity: 'negative' | 'positive';
  // Events per trial.
  readonly counts: Uint32Array;
  // Annual impact per trial, the sum over the events of the trial.
  readonly annual: Float64Array;
  // Events per trial with impact at or above the register's reportable threshold.
  readonly above: Uint32Array;
}

export interface Run {
  readonly trials: number;
  readonly seed: number;
  readonly active: readonly string[];
  readonly risks: ReadonlyMap<string, RiskRun>;
  readonly drivers: ReadonlyMap<string, Uint32Array>;
  // Sampled rates above 700 per year, set to 700 (Sec. 8.5, lint L-08).
  readonly clippedRates: number;
  readonly sampledRates: number;
}

type Part = 'frequency' | 'impactPerEvent';

export function overridesFor(doc: RiskDocument, active: readonly string[]): Map<string, Distribution> {
  const options = new Map((doc.responses ?? []).map((option) => [option.id, option]));
  const overrides = new Map<string, Distribution>();
  for (const id of active) {
    for (const effect of options.get(id)?.effects ?? []) {
      for (const part of ['frequency', 'impactPerEvent'] as const) {
        const value = effect[part];
        if (value !== undefined) overrides.set(`${effect.targetKind}|${effect.targetId}|${part}`, value);
      }
    }
  }
  return overrides;
}

// Sec. 8.2. A leaf risk has an estimate and no sources. A risk caused by a response
// enters only when that response is funded.
export function isSimulated(risk: Risk, active: ReadonlySet<string>): boolean {
  if (risk.estimate === undefined || (risk.sourceRefs ?? []).length > 0) return false;
  return risk.onlyWithResponse === undefined || active.has(risk.onlyWithResponse);
}

// Drivers are shared by every register. Their rates use the timeframe of the first
// register without a parent (open question Q8 when registers differ).
function driverTimeframe(registers: readonly Register[]): number {
  return (registers.find((register) => register.parentRegisterId === undefined) ?? registers[0])?.timeframeMonths ?? 12;
}

// Per-entity results keyed by their exact inputs. Streams depend only on the seed and
// the entity, so equal inputs give bit-equal results (common random numbers, Sec. 8.6).
// The optimization re-simulates only the risks that a portfolio changes.
export interface SimulationCache {
  readonly trials: number;
  readonly seed: number;
  readonly drivers: Map<string, { counts: Uint32Array; clipped: number }>;
  readonly risks: Map<string, { run: RiskRun; clipped: number; sampled: number }>;
}

export function createCache(trials: number, seed: number): SimulationCache {
  return { trials, seed, drivers: new Map(), risks: new Map() };
}

export function simulate(doc: RiskDocument, options: RunOptions & { readonly cache?: SimulationCache }): Run {
  const { trials, seed } = options;
  const cache = options.cache;
  if (cache !== undefined && (cache.trials !== trials || cache.seed !== seed)) throw new Error('The cache belongs to another trial count or seed');
  const active = options.active ?? [];
  const activeSet = new Set(active);
  const overrides = overridesFor(doc, active);
  const chosen = (kind: string, id: string, part: Part, fallback: Distribution): Distribution =>
    overrides.get(`${kind}|${id}|${part}`) ?? fallback;
  const registers = new Map(doc.registers.map((register) => [register.id, register]));
  const rng = new Mulberry32();
  let clippedRates = 0;
  let sampledRates = 0;

  const drivers = new Map<string, Uint32Array>();
  const driverKeys = new Map<string, string>();
  const driverFactor = driverTimeframe(doc.registers) / 12;
  for (const driver of doc.drivers ?? []) {
    const distribution = chosen('driver', driver.id, 'frequency', driver.frequency);
    const key = canonicalize(['driver', driver.id, distribution, driverFactor]);
    driverKeys.set(driver.id, key);
    const cached = cache?.drivers.get(key);
    if (cached !== undefined) {
      drivers.set(driver.id, cached.counts);
      clippedRates += cached.clipped;
      sampledRates += trials;
      continue;
    }
    const frequency = sampler(distribution);
    const rateStream = stream(seed, `driver|${driver.id}|rate`);
    const countStream = stream(seed, `driver|${driver.id}|count`);
    const counts = new Uint32Array(trials);
    let clippedHere = 0;
    for (let t = 0; t < trials; t++) {
      const word = rateStream.next();
      let rate = driverFactor * (frequency.constant ?? frequency.sample(rng.reseed(word)));
      if (rate > RATE_CAP) {
        rate = RATE_CAP;
        clippedHere += 1;
      }
      counts[t] = poisson(rate, rng.reseed(countStream.next()).uniform());
    }
    cache?.drivers.set(key, { counts, clipped: clippedHere });
    clippedRates += clippedHere;
    sampledRates += trials;
    drivers.set(driver.id, counts);
  }

  const risks = new Map<string, RiskRun>();
  for (const risk of doc.risks) {
    if (!isSimulated(risk, activeSet) || risk.estimate === undefined) continue;
    const id = risk.riskId;
    const register = registers.get(risk.registerId);
    const factor = (register?.timeframeMonths ?? 12) / 12;
    const threshold = register?.reportableEventThreshold ?? 0;
    const frequencyDistribution = chosen('risk', id, 'frequency', risk.estimate.frequency);
    const impactDistribution = chosen('risk', id, 'impactPerEvent', risk.estimate.impactPerEvent);
    const secondaryInputs = risk.estimate.secondaryImpacts ?? [];
    const linkInputs = risk.driverLinks ?? [];
    const key = canonicalize([
      'risk',
      id,
      risk.registerId,
      risk.polarity,
      frequencyDistribution,
      impactDistribution,
      secondaryInputs.map((item) => [item.probability, item.impactPerEvent]),
      factor,
      threshold,
      linkInputs.map((link) => [link.driverId, link.triggerProbability, driverKeys.get(link.driverId) ?? null]),
    ]);
    const cached = cache?.risks.get(key);
    if (cached !== undefined) {
      risks.set(id, cached.run);
      clippedRates += cached.clipped;
      sampledRates += cached.sampled;
      continue;
    }
    const frequency = sampler(frequencyDistribution);
    const primary = sampler(impactDistribution);
    const secondaries = secondaryInputs.map((item) => ({ p: item.probability, draw: sampler(item.impactPerEvent) }));
    const links = linkInputs.map((link) => ({
      q: link.triggerProbability,
      counts: drivers.get(link.driverId) ?? new Uint32Array(trials),
      words: stream(seed, `risk|${id}|thin|${link.driverId}`),
    }));
    const rateStream = stream(seed, `risk|${id}|rate`);
    const countStream = stream(seed, `risk|${id}|count`);
    const impactStream = stream(seed, `risk|${id}|impact`);
    const counts = new Uint32Array(trials);
    const annual = new Float64Array(trials);
    const above = new Uint32Array(trials);
    const linkCount = links.length;
    const secondaryCount = secondaries.length;
    const constantRate = frequency.constant;
    let clippedHere = 0;

    for (let t = 0; t < trials; t++) {
      // Every stream gives one word per trial, also when the word is not used.
      const word = rateStream.next();
      let rate = factor * (constantRate ?? frequency.sample(rng.reseed(word)));
      if (rate > RATE_CAP) {
        rate = RATE_CAP;
        clippedHere += 1;
      }
      let n = poisson(rate, rng.reseed(countStream.next()).uniform());
      for (let l = 0; l < linkCount; l++) {
        const link = links[l];
        if (link === undefined) continue;
        rng.reseed(link.words.next());
        const events = link.counts[t] ?? 0;
        for (let k = 0; k < events; k++) if (rng.uniform() < link.q) n += 1;
      }
      const impactWord = impactStream.next();
      let sum = 0;
      let hits = 0;
      if (n > 0) {
        rng.reseed(impactWord);
        for (let k = 0; k < n; k++) {
          let x = primary.sample(rng);
          for (let j = 0; j < secondaryCount; j++) {
            const secondary = secondaries[j];
            if (secondary !== undefined && rng.uniform() < secondary.p) x += secondary.draw.sample(rng);
          }
          sum += x;
          if (x >= threshold) hits += 1;
        }
      }
      counts[t] = n;
      annual[t] = sum;
      above[t] = hits;
    }
    const run: RiskRun = { riskId: id, registerId: risk.registerId, polarity: risk.polarity, counts, annual, above };
    cache?.risks.set(key, { run, clipped: clippedHere, sampled: trials });
    clippedRates += clippedHere;
    sampledRates += trials;
    risks.set(id, run);
  }
  return { trials, seed, active, risks, drivers, clippedRates, sampledRates };
}
