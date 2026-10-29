// Samplers of SPEC.md Sec. 8.4 and 8.5. Every draw comes from one Mulberry32.
import type { Distribution } from '../schema/types';
import { normalQuantile } from './normal';
import type { Mulberry32 } from './rng';

export const Z90 = 1.6448536269514722;
export const RATE_CAP = 700;

// Marsaglia and Tsang (2000), for shape at least 1. d and c come from the shape.
export function gammaConstants(shape: number): { d: number; c: number } {
  const d = shape - 1 / 3;
  return { d, c: 1 / Math.sqrt(9 * d) };
}

export function gamma(shape: number, rng: Mulberry32): number {
  const { d, c } = gammaConstants(shape);
  return gammaDraw(d, c, rng);
}

export function gammaDraw(d: number, c: number, rng: Mulberry32): number {
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

const LOGNORMAL = 0;
const PERT = 1;
const CONSTANT = 2;

// One class for every distribution, so the hot loop calls one method and V8 can inline it.
// The arithmetic is the same as SPEC.md Sec. 8.4 in the same order, so results do not change.
export class Sampler {
  readonly mean: number;
  readonly meanSquare: number;
  // Set when the sampler draws nothing, so the caller can skip the reseed.
  readonly constant: number | undefined;
  private readonly kind: number;
  private readonly p0: number;
  private readonly p1: number;
  private readonly p2: number;
  private readonly p3: number;
  private readonly p4: number = 0;
  private readonly p5: number = 0;

  constructor(distribution: Distribution) {
    if (distribution.type === 'lognormal') {
      const lower = distribution.lower ?? Number.NaN;
      const upper = distribution.upper ?? Number.NaN;
      const mu = (Math.log(lower) + Math.log(upper)) / 2;
      const sigma = (Math.log(upper) - Math.log(lower)) / (2 * Z90);
      this.kind = LOGNORMAL;
      [this.p0, this.p1, this.p2, this.p3] = [mu, sigma, 0, 0];
      this.mean = Math.exp(mu + (sigma * sigma) / 2);
      this.meanSquare = Math.exp(2 * mu + 2 * sigma * sigma);
      this.constant = undefined;
      return;
    }
    if (distribution.type === 'pert') {
      const a = distribution.min ?? Number.NaN;
      const m = distribution.mode ?? Number.NaN;
      const b = distribution.max ?? Number.NaN;
      const mean = (a + 4 * m + b) / 6;
      const variance = ((mean - a) * (b - mean)) / 7;
      if (b === a) {
        this.kind = CONSTANT;
        [this.p0, this.p1, this.p2, this.p3] = [a, 0, 0, 0];
        this.mean = a;
        this.meanSquare = a * a;
        this.constant = a;
        return;
      }
      this.kind = PERT;
      const g1 = gammaConstants(1 + (4 * (m - a)) / (b - a));
      const g2 = gammaConstants(1 + (4 * (b - m)) / (b - a));
      [this.p0, this.p1, this.p2, this.p3, this.p4, this.p5] = [a, b - a, g1.d, g1.c, g2.d, g2.c];
      this.mean = mean;
      this.meanSquare = variance + mean * mean;
      this.constant = undefined;
      return;
    }
    const value = distribution.value ?? Number.NaN;
    this.kind = CONSTANT;
    [this.p0, this.p1, this.p2, this.p3] = [value, 0, 0, 0];
    this.mean = value;
    this.meanSquare = value * value;
    this.constant = value;
  }

  sample(rng: Mulberry32): number {
    if (this.kind === LOGNORMAL) return Math.exp(this.p0 + this.p1 * normalQuantile(rng.uniform()));
    if (this.kind === PERT) {
      const g1 = gammaDraw(this.p2, this.p3, rng);
      const g2 = gammaDraw(this.p4, this.p5, rng);
      return this.p0 + this.p1 * (g1 / (g1 + g2));
    }
    return this.p0;
  }
}

export function sampler(distribution: Distribution): Sampler {
  return new Sampler(distribution);
}

// Poisson by inversion with one uniform (Devroye 1986, p. 505).
// exp(-lambda) is kept for the next call, because a constant rate repeats it.
let lastLambda = Number.NaN;
let lastExp = Number.NaN;

export function poisson(lambda: number, u: number): number {
  // exp(-lambda) >= 1 - lambda, so a uniform clearly below 1 - lambda gives 0 events
  // without the exp call. The 1e-12 keeps the test safe from rounding. Results do not change.
  if (u <= 1 - lambda - 1e-12) return 0;
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
