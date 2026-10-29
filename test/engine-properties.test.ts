// Property tests P1 to P16 of SPEC.md Sec. 12.3. Tolerance is 4 standard errors.
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import {
  annualizedCost,
  evaluate,
  fiscal,
  measure,
  Mulberry32,
  optimize,
  sampler,
  simulate,
  stream,
  triggerProbability,
  Z90,
} from '../src/engine';
import type { ResponseOption } from '../src/schema';
import { constant, covariance, document, lognormal, pert, risk, variance } from './engine-helpers';
import { example, EXAMPLE_2 } from './schema-helpers';

const T = 200_000;
const SEED = 20261207;
const RUNS = 4;

const meanOf = (values: ArrayLike<number>): number => {
  let sum = 0;
  for (let i = 0; i < values.length; i++) sum += values[i] ?? 0;
  return sum / values.length;
};
const se = (values: ArrayLike<number>): number => Math.sqrt(variance(values) / values.length);
const share = (values: ArrayLike<number>, test: (x: number) => boolean): number => {
  let hits = 0;
  for (let i = 0; i < values.length; i++) if (test(values[i] ?? 0)) hits += 1;
  return hits / values.length;
};
const pSe = (p: number, n: number): number => Math.sqrt((p * (1 - p)) / n);
const lognormalMoments = (lower: number, upper: number) => {
  const mu = (Math.log(lower) + Math.log(upper)) / 2;
  const sigma = (Math.log(upper) - Math.log(lower)) / (2 * Z90);
  return { mu, sigma, mean: Math.exp(mu + sigma ** 2 / 2), meanSquare: Math.exp(2 * mu + 2 * sigma ** 2) };
};
const only = <T>(value: T | undefined): T => {
  if (value === undefined) throw new Error('missing value');
  return value;
};

describe('P1 constant rate, lognormal impact', () => {
  it('E[S] = lambda E[X] and P(S = 0) = exp(-lambda)', () => {
    fc.assert(
      fc.property(fc.double({ min: 0.05, max: 5, noNaN: true }), fc.double({ min: 1000, max: 50_000, noNaN: true }), fc.double({ min: 1.5, max: 20, noNaN: true }), (lambda, lower, ratio) => {
        const run = simulate(document([risk({ id: 'A', frequency: constant(lambda), impact: lognormal(lower, lower * ratio) })]), { trials: T, seed: SEED });
        const s = only(run.risks.get('A')).annual;
        const expected = lambda * lognormalMoments(lower, lower * ratio).mean;
        expect(Math.abs(meanOf(s) - expected)).toBeLessThan(4 * se(s));
        const p0 = Math.exp(-lambda);
        expect(Math.abs(share(s, (x) => x === 0) - p0)).toBeLessThan(4 * pSe(p0, T));
      }),
      { numRuns: RUNS, seed: SEED },
    );
  });
});

describe('P2 constant rate, discretised impact (Panjer 1981)', () => {
  it('the distribution of S on the lattice equals the Panjer recursion', () => {
    // X is 1 or 2: a constant primary 1 and one secondary impact 1 with probability p.
    fc.assert(
      fc.property(fc.double({ min: 0.2, max: 3, noNaN: true }), fc.double({ min: 0.05, max: 0.95, noNaN: true }), (lambda, p) => {
        const run = simulate(document([risk({ id: 'A', frequency: constant(lambda), impact: constant(1), secondary: [{ p, impact: constant(1) }] })]), { trials: T, seed: SEED });
        const s = only(run.risks.get('A')).annual;
        const fx = [0, 1 - p, p];
        const fs = [Math.exp(-lambda)];
        for (let k = 1; k <= 20; k++) {
          let sum = 0;
          for (let j = 1; j <= Math.min(2, k); j++) sum += j * (fx[j] ?? 0) * (fs[k - j] ?? 0);
          fs.push((lambda / k) * sum);
        }
        fs.forEach((expected, k) => {
          expect(Math.abs(share(s, (x) => x === k) - expected), `k=${String(k)}`).toBeLessThan(4 * pSe(expected, T) + 1e-12);
        });
      }),
      { numRuns: RUNS, seed: SEED },
    );
  });
});

describe('P3 lognormal rate, constant impact', () => {
  it('E[S] = c E[N] and Var[N] = E[N] + (exp(sigma^2) - 1) E[N]^2', () => {
    fc.assert(
      fc.property(fc.double({ min: 0.05, max: 1, noNaN: true }), fc.double({ min: 1.5, max: 10, noNaN: true }), fc.double({ min: 100, max: 1e6, noNaN: true }), (lower, ratio, c) => {
        const run = simulate(document([risk({ id: 'A', frequency: lognormal(lower, lower * ratio), impact: constant(c) })]), { trials: T, seed: SEED });
        const result = only(run.risks.get('A'));
        const { sigma, mean } = lognormalMoments(lower, lower * ratio);
        expect(Math.abs(meanOf(result.annual) - c * mean)).toBeLessThan(4 * se(result.annual));
        const expectedVar = mean + (Math.exp(sigma ** 2) - 1) * mean ** 2;
        expect(Math.abs(variance(result.counts) - expectedVar) / expectedVar).toBeLessThan(0.05);
      }),
      { numRuns: RUNS, seed: SEED },
    );
  });
});

describe('P4 lognormal rate, lognormal impact', () => {
  it('E[S] = E[lambda] E[X] within 4 SE, Var[S] within 5% at 1 000 000 trials', () => {
    const rate = lognormalMoments(0.2, 1.2);
    const impact = lognormalMoments(10_000, 40_000);
    const run = simulate(document([risk({ id: 'A', frequency: lognormal(0.2, 1.2), impact: lognormal(10_000, 40_000) })]), { trials: 1_000_000, seed: SEED });
    const s = only(run.risks.get('A')).annual;
    expect(Math.abs(meanOf(s) - rate.mean * impact.mean)).toBeLessThan(4 * se(s));
    const rateVar = rate.meanSquare - rate.mean ** 2;
    const expectedVar = rate.mean * impact.meanSquare + rateVar * impact.mean ** 2;
    expect(Math.abs(variance(s) - expectedVar) / expectedVar).toBeLessThan(0.05);
  });
});

describe('P5 one driver, two risks, constant rates', () => {
  it('Cov[N1, N2] = q1 q2 lambda_d and E[N_r] = lambda_r + q_r lambda_d', () => {
    fc.assert(
      fc.property(
        fc.double({ min: 0.1, max: 3, noNaN: true }),
        fc.double({ min: 0.05, max: 1, noNaN: true }),
        fc.double({ min: 0.05, max: 1, noNaN: true }),
        fc.double({ min: 0.1, max: 1, noNaN: true }),
        fc.double({ min: 0.1, max: 1, noNaN: true }),
        (lambdaD, l1, l2, q1, q2) => {
          const doc = document(
            [
              risk({ id: 'A', frequency: constant(l1), impact: constant(1), links: [{ driverId: 'D', q: q1 }] }),
              risk({ id: 'B', frequency: constant(l2), impact: constant(1), links: [{ driverId: 'D', q: q2 }] }),
            ],
            { drivers: [{ id: 'D', frequency: constant(lambdaD) }] },
          );
          const run = simulate(doc, { trials: T, seed: SEED });
          const n1 = only(run.risks.get('A')).counts;
          const n2 = only(run.risks.get('B')).counts;
          const v1 = l1 + q1 * lambdaD;
          const v2 = l2 + q2 * lambdaD;
          const cov = q1 * q2 * lambdaD;
          expect(Math.abs(covariance(n1, n2) - cov)).toBeLessThan(4 * Math.sqrt((v1 * v2 + cov * cov) / T));
          expect(Math.abs(meanOf(n1) - v1)).toBeLessThan(4 * Math.sqrt(v1 / T));
          expect(Math.abs(meanOf(n2) - v2)).toBeLessThan(4 * Math.sqrt(v2 / T));
        },
      ),
      { numRuns: RUNS, seed: SEED },
    );
  });
});

describe('P6, P7, P10, P11, P14 exact properties', () => {
  const base = [
    risk({ id: 'A', frequency: lognormal(0.1, 2), impact: pert(1000, 5000, 40_000), links: [{ driverId: 'D', q: 0.3 }] }),
    risk({ id: 'B', frequency: constant(0.7), impact: lognormal(2000, 90_000), secondary: [{ p: 0.2, impact: constant(10_000) }] }),
  ];
  const drivers = [{ id: 'D', frequency: lognormal(0.2, 1) }];

  it('P6 q = 0 for all links equals a run without the driver, trial by trial', () => {
    const zero = document([risk({ id: 'A', frequency: lognormal(0.1, 2), impact: pert(1000, 5000, 40_000), links: [{ driverId: 'D', q: 0 }] })], { drivers });
    const none = document([risk({ id: 'A', frequency: lognormal(0.1, 2), impact: pert(1000, 5000, 40_000) })]);
    const a = simulate(zero, { trials: 20_000, seed: SEED });
    const b = simulate(none, { trials: 20_000, seed: SEED });
    expect(only(a.risks.get('A')).annual).toEqual(only(b.risks.get('A')).annual);
  });

  it('P7 adding an unrelated risk changes no other risk', () => {
    const a = simulate(document(base, { drivers }), { trials: 20_000, seed: SEED });
    const b = simulate(document([...base, risk({ id: 'C', frequency: constant(3), impact: constant(5) })], { drivers }), { trials: 20_000, seed: SEED });
    for (const id of ['A', 'B']) expect(only(b.risks.get(id)).annual).toEqual(only(a.risks.get(id)).annual);
  });

  it('P10 positive risks never change a register LEC', () => {
    const a = measure(document(base, { drivers }), 20_000, SEED, []);
    const b = measure(document([...base, risk({ id: 'P', polarity: 'positive', frequency: constant(2), impact: constant(9000), links: [{ driverId: 'D', q: 0.5 }] })], { drivers }), 20_000, SEED, []);
    expect(b.loss).toEqual(a.loss);
    expect(b.eag).toBeGreaterThan(0);
  });

  it('P11 the same document and seed give identical results', () => {
    const a = simulate(document(base, { drivers }), { trials: 20_000, seed: SEED });
    const b = simulate(document(base, { drivers }), { trials: 20_000, seed: SEED });
    for (const id of ['A', 'B']) expect(only(b.risks.get(id)).annual).toEqual(only(a.risks.get(id)).annual);
  });

  it('P14 a risk with onlyWithResponse is absent without the response and unconditional with it', () => {
    const option: ResponseOption = {
      id: 'O',
      title: 'Option',
      responseType: 'Mitigate',
      costs: { oneOff: 0, annual: 100, lifetimeYears: 1 },
      status: 'candidate',
      effects: [{ targetKind: 'risk', targetId: 'B', frequency: constant(0.1), rationale: 'test effect' }],
      introducesRisks: ['C'],
    };
    const caused = risk({ id: 'C', frequency: lognormal(0.5, 4), impact: constant(300), onlyWithResponse: 'O' });
    const unconditional = risk({ id: 'C', frequency: lognormal(0.5, 4), impact: constant(300) });
    const doc = document([...base, caused], { drivers, responses: [option] });
    expect(simulate(doc, { trials: 5000, seed: SEED }).risks.has('C')).toBe(false);
    const withOption = simulate(doc, { trials: 20_000, seed: SEED, active: ['O'] });
    const plain = simulate(document([...base, unconditional], { drivers }), { trials: 20_000, seed: SEED });
    expect(only(withOption.risks.get('C')).annual).toEqual(only(plain.risks.get('C')).annual);
  });
});

describe('P8 and P9 samplers', () => {
  const draws = (dist: Parameters<typeof sampler>[0], n: number): Float64Array => {
    const words = stream(SEED, 'test|sampler');
    const rng = new Mulberry32();
    const draw = sampler(dist);
    const out = new Float64Array(n);
    for (let i = 0; i < n; i++) out[i] = draw.sample(rng.reseed(words.next()));
    return out;
  };

  it('P8 PERT has mean (a + 4m + b) / 6 and variance (E - a)(b - E) / 7', () => {
    fc.assert(
      fc.property(fc.tuple(fc.double({ min: 0, max: 1e6, noNaN: true }), fc.double({ min: 0, max: 1e6, noNaN: true }), fc.double({ min: 0, max: 1e6, noNaN: true })), (values) => {
        const [a, m, b] = [...values].sort((x, y) => x - y) as [number, number, number];
        fc.pre(b - a > 1);
        const x = draws(pert(a, m, b), T);
        const mean = (a + 4 * m + b) / 6;
        const expectedVar = ((mean - a) * (b - mean)) / 7;
        expect(Math.abs(meanOf(x) - mean)).toBeLessThan(4 * Math.sqrt(expectedVar / T));
        expect(Math.abs(variance(x) - expectedVar) / expectedVar).toBeLessThan(0.03);
      }),
      { numRuns: RUNS, seed: SEED },
    );
  });

  it('P9 lognormal from (L, U) puts 5% below L and 5% above U', () => {
    fc.assert(
      fc.property(fc.double({ min: 0.01, max: 1e5, noNaN: true }), fc.double({ min: 1.01, max: 1000, noNaN: true }), (lower, ratio) => {
        const upper = lower * ratio;
        const x = draws(lognormal(lower, upper), T);
        const bound = 4 * pSe(0.05, T);
        expect(Math.abs(share(x, (v) => v < lower) - 0.05)).toBeLessThan(bound);
        expect(Math.abs(share(x, (v) => v > upper) - 0.05)).toBeLessThan(bound);
      }),
      { numRuns: RUNS, seed: SEED },
    );
  });
});

describe('P13 secondary impact', () => {
  it('P(X = c + s) = p and E[X] = c + p s', () => {
    fc.assert(
      fc.property(fc.double({ min: 100, max: 1e5, noNaN: true }), fc.double({ min: 100, max: 1e5, noNaN: true }), fc.double({ min: 0.02, max: 0.98, noNaN: true }), (c, s, p) => {
        const lambda = 2;
        const doc = document([risk({ id: 'A', frequency: constant(lambda), impact: constant(c), secondary: [{ p, impact: constant(s) }] })], { threshold: c + s / 2 });
        const result = only(simulate(doc, { trials: T, seed: SEED }).risks.get('A'));
        let events = 0;
        let hits = 0;
        for (let t = 0; t < T; t++) {
          events += result.counts[t] ?? 0;
          hits += result.above[t] ?? 0;
        }
        expect(Math.abs(hits / events - p)).toBeLessThan(4 * pSe(p, events));
        expect(Math.abs(meanOf(result.annual) - lambda * (c + p * s))).toBeLessThan(4 * se(result.annual));
      }),
      { numRuns: RUNS, seed: SEED },
    );
  });
});

describe('P15 reserve', () => {
  it('annualised cost = one-off / lifetime + annual + reserve x the trigger probability of the same run', () => {
    const doc = example(EXAMPLE_2);
    const reserved = (doc.responses ?? []).filter((option) => (option.costs.reserveAmount ?? 0) > 0);
    expect(reserved.length).toBeGreaterThan(0);
    for (const option of reserved) {
      const m = measure(doc, 20_000, SEED, [option.id]);
      let hits = 0;
      for (let t = 0; t < m.run.trials; t++) {
        const hit = option.effects.some((effect) =>
          effect.targetKind === 'driver' ? (m.run.drivers.get(effect.targetId)?.[t] ?? 0) >= 1 : (m.run.risks.get(effect.targetId)?.counts[t] ?? 0) >= 1,
        );
        if (hit) hits += 1;
      }
      const p = hits / m.run.trials;
      expect(triggerProbability(option, m.run)).toBe(p);
      const costs = option.costs;
      expect(annualizedCost(option, m.run)).toBe(costs.oneOff / costs.lifetimeYears + costs.annual + (costs.reserveAmount ?? 0) * p);
    }
  });
});

describe('P16 optimizer', () => {
  const doc = example(EXAMPLE_2);

  it('never returns less confirmed net benefit than the fiscal baseline when both are within tolerance', () => {
    const result = optimize(doc, { budget: 60_000, seed: SEED });
    const big = measure(doc, 100_000, SEED, []);
    const baseline = evaluate(doc, big, fiscal(doc, 60_000, 100_000, SEED).sort(), 100_000, SEED);
    if (!baseline.clear && !result.best.clear) expect(result.best.net).toBeGreaterThanOrEqual(baseline.net);
  }, 120_000);

  it('a dearer copy of an option with the same effects never changes the result', () => {
    const plain = optimize(doc, { budget: 60_000, seed: SEED });
    const copy = structuredClone(doc);
    const source = (copy.responses ?? []).find((option) => option.id === plain.best.ids[0]);
    if (source === undefined) throw new Error('no option to copy');
    copy.responses?.push({ ...structuredClone(source), id: 'O-COPY', costs: { ...source.costs, annual: source.costs.annual + 1000 } });
    expect(optimize(copy, { budget: 60_000, seed: SEED }).best.ids).toEqual(plain.best.ids);
  }, 120_000);
});
