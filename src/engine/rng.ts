// Random numbers of SPEC.md Sec. 8.6. Integer streams are identical in every engine.
import { sha256 } from '../schema/sha256';

// xoshiro128** (Blackman and Vigna 2018). One 32-bit word per trial per stream.
// The state is a typed array, so V8 keeps it as raw 32-bit integers.
export class Xoshiro128 {
  private readonly s = new Int32Array(4);

  constructor(s0: number, s1: number, s2: number, s3: number) {
    this.s[0] = s0;
    this.s[1] = s1;
    this.s[2] = s2;
    this.s[3] = s3;
  }

  next(): number {
    const s = this.s;
    const s0 = s[0] ?? 0;
    const s1 = s[1] ?? 0;
    let s2 = s[2] ?? 0;
    let s3 = s[3] ?? 0;
    const x = Math.imul(s1, 5);
    const result = Math.imul((x << 7) | (x >>> 25), 9) >>> 0;
    const t = s1 << 9;
    s2 ^= s0;
    s3 ^= s1;
    s[1] = s1 ^ s2;
    s[0] = s0 ^ s3;
    s[2] = s2 ^ t;
    s[3] = (s3 << 11) | (s3 >>> 21);
    return result;
  }

  // The next count words in one loop with the state in local variables. Same words as
  // count calls of next(), and faster in the simulation loop.
  fill(count: number): Uint32Array {
    const out = new Uint32Array(count);
    const s = this.s;
    let s0 = s[0] ?? 0;
    let s1 = s[1] ?? 0;
    let s2 = s[2] ?? 0;
    let s3 = s[3] ?? 0;
    for (let i = 0; i < count; i++) {
      const x = Math.imul(s1, 5);
      out[i] = Math.imul((x << 7) | (x >>> 25), 9);
      const t = s1 << 9;
      s2 ^= s0;
      s3 ^= s1;
      s1 ^= s2;
      s0 ^= s3;
      s2 ^= t;
      s3 = (s3 << 11) | (s3 >>> 21);
    }
    s[0] = s0;
    s[1] = s1;
    s[2] = s2;
    s[3] = s3;
    return out;
  }
}

// The stream for one (entity kind, entity id, variable), for example "risk|R-01|rate".
export function stream(seed: number, key: string): Xoshiro128 {
  const digest = sha256(new TextEncoder().encode(`${String(seed)}|${key}`));
  const view = new DataView(digest.buffer, digest.byteOffset, 16);
  let s0 = view.getUint32(0, true);
  const s1 = view.getUint32(4, true);
  const s2 = view.getUint32(8, true);
  const s3 = view.getUint32(12, true);
  if ((s0 | s1 | s2 | s3) === 0) s0 = 0x9e3779b9;
  return new Xoshiro128(s0, s1, s2, s3);
}

// mulberry32. All draws of one variable in one trial, seeded with that trial's word.
export class Mulberry32 {
  private readonly a = new Int32Array(1);

  constructor(seed = 0) {
    this.a[0] = seed;
  }

  reseed(seed: number): this {
    this.a[0] = seed;
    return this;
  }

  next(): number {
    const a = ((this.a[0] ?? 0) + 0x6d2b79f5) | 0;
    this.a[0] = a;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return (t ^ (t >>> 14)) >>> 0;
  }

  // Uniform in (0, 1) with 53 bits. Never 0 and never 1.
  uniform(): number {
    const hi = this.next() >>> 5;
    const lo = this.next() >>> 6;
    return (hi * 67108864 + lo + 0.5) / 9007199254740992;
  }
}
