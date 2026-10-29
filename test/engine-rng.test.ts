// SPEC.md Sec. 8.6 random numbers and the AS 241 normal quantile. Bit vectors come from
// the separate Python implementation in tools/engine_reference.py.
import { describe, expect, it } from 'vitest';
import { Mulberry32, normalQuantile, stream, Xoshiro128, Z90 } from '../src/engine';
import { readJson } from './schema-helpers';

interface Reference {
  rng: {
    xoshiro1234: number[];
    mulberry: Record<string, number[]>;
    streams: Record<string, { state: number[]; words: number[] }>;
  };
  normal: [number, number][];
}

const reference = readJson('test/fixtures/engine-reference.json') as Reference;

describe('integer streams', () => {
  it('xoshiro128** equals the Python implementation', () => {
    const rng = new Xoshiro128(1, 2, 3, 4);
    expect(reference.rng.xoshiro1234.map(() => rng.next())).toEqual(reference.rng.xoshiro1234);
  });

  it('mulberry32 equals the Python implementation', () => {
    for (const [seed, words] of Object.entries(reference.rng.mulberry)) {
      const rng = new Mulberry32(Number(seed));
      expect(words.map(() => rng.next()), seed).toEqual(words);
    }
  });

  it('stream seeding by SHA-256 equals the Python implementation', () => {
    for (const [key, expected] of Object.entries(reference.rng.streams)) {
      const words = stream(20261207, key);
      expect(expected.words.map(() => words.next()), key).toEqual(expected.words);
    }
  });

  it('uniforms are inside (0, 1)', () => {
    const rng = new Mulberry32(0);
    for (let i = 0; i < 100_000; i++) {
      const u = rng.uniform();
      expect(u > 0 && u < 1).toBe(true);
    }
  });
});

describe('P12 uniform stream quality', () => {
  it('chi-square of 1 000 000 uniforms in 1 000 bins has p above 1e-4, lag-1 correlation below 0.005', () => {
    const words = stream(20261207, 'test|P12|uniform');
    const rng = new Mulberry32();
    const n = 1_000_000;
    const bins = new Float64Array(1000);
    let previous = 0;
    let sum = 0;
    let sumSquares = 0;
    let sumLag = 0;
    for (let i = 0; i < n; i++) {
      const u = rng.reseed(words.next()).uniform();
      bins[Math.floor(u * 1000)] = (bins[Math.floor(u * 1000)] ?? 0) + 1;
      sum += u;
      sumSquares += u * u;
      if (i > 0) sumLag += u * previous;
      previous = u;
    }
    const expected = n / 1000;
    const chi = bins.reduce((acc, count) => acc + (count - expected) ** 2 / expected, 0);
    // Wilson and Hilferty (1931) normal approximation, 999 degrees of freedom.
    const k = 999;
    const z = ((chi / k) ** (1 / 3) - (1 - 2 / (9 * k))) / Math.sqrt(2 / (9 * k));
    expect(z).toBeLessThan(normalQuantile(1 - 1e-4));
    const m = sum / n;
    const variance = sumSquares / n - m * m;
    const lag = (sumLag / (n - 1) - m * m) / variance;
    expect(Math.abs(lag)).toBeLessThan(0.005);
  });
});

describe('AS 241 normal quantile', () => {
  it('equals statistics.NormalDist within 1e-14 relative', () => {
    for (const [p, x] of reference.normal) {
      const tolerance = 1e-14 * Math.max(1, Math.abs(x));
      expect(Math.abs(normalQuantile(p) - x), String(p)).toBeLessThanOrEqual(tolerance);
    }
  });

  it('gives z = 1.6448536269514722 at 0.95 and is symmetric', () => {
    expect(Math.abs(normalQuantile(0.95) - Z90)).toBeLessThan(1e-15);
    for (const p of [0.001, 0.1, 0.3, 0.49]) expect(normalQuantile(p)).toBe(-normalQuantile(1 - p));
  });
});
