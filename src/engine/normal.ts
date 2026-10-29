// Normal quantile, Wichura (1988) AS 241 PPND16, Applied Statistics 37(3) 477-484.
// About 16 significant digits for p in (0, 1).
// The coefficients are copied as published, with more digits than a double holds.
/* eslint-disable no-loss-of-precision */

const A = [
  3.387132872796366608, 133.14166789178437745, 1971.5909503065514427, 13731.693765509461125, 45921.953931549871457,
  67265.770927008700853, 33430.575583588128105, 2509.0809287301226727,
] as const;
const B = [
  1, 42.313330701600911252, 687.1870074920579083, 5394.1960214247511077, 21213.794301586595867, 39307.89580009271061,
  28729.085735721942674, 5226.495278852854561,
] as const;
const C = [
  1.42343711074968357734, 4.6303378461565452959, 5.7694972214606914055, 3.64784832476320460504, 1.27045825245236838258,
  0.24178072517745061177, 0.0227238449892691845833, 7.7454501427834140764e-4,
] as const;
const D = [
  1, 2.05319162663775882187, 1.6763848301838038494, 0.68976733498510000455, 0.14810397642748007459,
  0.0151986665636164571966, 5.475938084995344946e-4, 1.05075007164441684324e-9,
] as const;
const E = [
  6.6579046435011037772, 5.4637849111641143699, 1.7848265399172913358, 0.29656057182850489123,
  0.026532189526576123093, 0.0012426609473880784386, 2.71155556874348757815e-5, 2.01033439929228813265e-7,
] as const;
const F = [
  1, 0.59983220655588793769, 0.13692988092273580531, 0.0148753612908506148525, 7.868691311456132591e-4,
  1.8463183175100546818e-5, 1.4215117583164458887e-7, 2.04426310338993978564e-15,
] as const;

type Coefficients = readonly [number, number, number, number, number, number, number, number];

function poly(c: Coefficients, x: number): number {
  return ((((((c[7] * x + c[6]) * x + c[5]) * x + c[4]) * x + c[3]) * x + c[2]) * x + c[1]) * x + c[0];
}

export function normalQuantile(p: number): number {
  if (!(p > 0 && p < 1)) {
    if (p === 0) return Number.NEGATIVE_INFINITY;
    if (p === 1) return Number.POSITIVE_INFINITY;
    return Number.NaN;
  }
  const q = p - 0.5;
  if (Math.abs(q) <= 0.425) {
    const r = 0.180625 - q * q;
    return (q * poly(A, r)) / poly(B, r);
  }
  let r = Math.sqrt(-Math.log(q < 0 ? p : 1 - p));
  let value: number;
  if (r <= 5) {
    r -= 1.6;
    value = poly(C, r) / poly(D, r);
  } else {
    r -= 5;
    value = poly(E, r) / poly(F, r);
  }
  return q < 0 ? -value : value;
}
