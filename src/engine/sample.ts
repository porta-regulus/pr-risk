// Samplers of SPEC.md Sec. 8.4 and 8.5. Every draw comes from one Mulberry32.
import type { Distribution } from '../schema/types';
import { normalQuantile } from './normal';
import type { Mulberry32 } from './rng';

export const Z90 = 1.6448536269514722;
export const RATE_CAP = 700;

export interface Sampler {
  sample(rng: Mulberry32): number;
  readonly mean: number;
  readonly meanSquare: number;
  // Set when the sampler draws nothing, so the caller can skip the reseed.
  readonly constant?: number;
}

// Marsaglia and Tsang (2000), for shape at least 1.
export function gamma(shape: number, rng: Mulberry32): number {
  const d = shape - 1 / 3;
  const c = 1 / Math.sqrt(9 * d);
  for (;;) {
    let x: number;
    let v: number;
    do {
      x = normalQuantile(rng.uniform());
      v = 1 + c * x;
    } while (v <= 0);
    v = v * v * v;
    const u = rng.uniform();
    if (u < 1 - 0.0331 * x * x * x * x) return d * v;
    if (Math.log(u) < 0.5 * x * x + d * (1 - v + Math.log(v))) return d * v;
  }
}

export function sampler(distribution: Distribution): Sampler {
  if (distribution.type === 'lognormal') {
    const lower = distribution.lower ?? Number.NaN;
    const upper = distribution.upper ?? Number.NaN;
    const mu = (Math.log(lower) + Math.log(upper)) / 2;
    const sigma = (Math.log(upper) - Math.log(lower)) / (2 * Z90);
    return {
      sample: (rng) => Math.exp(mu + sigma * normalQuantile(rng.uniform())),
      mean: Math.exp(mu + (sigma * sigma) / 2),
      meanSquare: Math.exp(2 * mu + 2 * sigma * sigma),
    };
  }
  if (distribution.type === 'pert') {
    const a = distribution.min ?? Number.NaN;
    const m = distribution.mode ?? Number.NaN;
    const b = distribution.max ?? Number.NaN;
    const mean = (a + 4 * m + b) / 6;
    const variance = ((mean - a) * (b - mean)) / 7;
    if (b === a) return { sample: () => a, mean: a, meanSquare: a * a, constant: a };
    const alpha = 1 + (4 * (m - a)) / (b - a);
    const beta = 1 + (4 * (b - m)) / (b - a);
    return {
      sample: (rng) => {
        const g1 = gamma(alpha, rng);
        const g2 = gamma(beta, rng);
        return a + (b - a) * (g1 / (g1 + g2));
      },
      mean,
      meanSquare: variance + mean * mean,
    };
  }
  const value = distribution.value ?? Number.NaN;
  return { sample: () => value, mean: value, meanSquare: value * value, constant: value };
}

// Poisson by inversion with one uniform (Devroye 1986, p. 505).
// exp(-lambda) is kept for the next call, because a constant rate repeats it.
let lastLambda = Number.NaN;
let lastExp = Number.NaN;

export function poisson(lambda: number, u: number): number {
  if (lambda !== lastLambda) {
    lastLambda = lambda;
    lastExp = Math.exp(-lambda);
  }
  let x = 0;
  let p = lastExp;
  let s = p;
  const limit = lambda + 20 * Math.sqrt(lambda) + 50;
  while (u > s && x < limit) {
    x += 1;
    p = (p * lambda) / x;
    s += p;
  }
  return x;
}
