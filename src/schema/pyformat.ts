// Python's format(x, "g") for a float, byte for byte. The generated RDR text of
// SPEC.md Sec. 7.4 must equal the Python reference (docs/schema/validate.py).
// Precision 6, round half to even on the exact binary value, trailing zeros removed.

const PRECISION = 6;

// The exact decimal value of a finite double as digits times 10^exponent.
function exactDecimal(x: number): { digits: string; exponent: number } {
  const view = new DataView(new ArrayBuffer(8));
  view.setFloat64(0, Math.abs(x));
  const high = view.getUint32(0);
  const low = view.getUint32(4);
  const biased = (high >>> 20) & 0x7ff;
  let mantissa = (BigInt(high & 0xfffff) << 32n) | BigInt(low);
  let power: number;
  if (biased === 0) {
    power = -1074;
  } else {
    mantissa |= 1n << 52n;
    power = biased - 1075;
  }
  if (power >= 0) return { digits: (mantissa << BigInt(power)).toString(), exponent: 0 };
  return { digits: (mantissa * 5n ** BigInt(-power)).toString(), exponent: power };
}

function roundDigits(digits: string, keep: number): { digits: string; carry: boolean } {
  const head = digits.slice(0, keep);
  const tail = digits.slice(keep);
  const first = tail.charCodeAt(0) - 48;
  const restZero = /^0*$/.test(tail.slice(1));
  const lastEven = (head.charCodeAt(head.length - 1) - 48) % 2 === 0;
  const up = tail !== '' && (first > 5 || (first === 5 && (!restZero || !lastEven)));
  if (!up) return { digits: head, carry: false };
  const raised = (BigInt(head) + 1n).toString();
  return raised.length > head.length ? { digits: raised.slice(0, keep), carry: true } : { digits: raised, carry: false };
}

// Remove trailing zeros after the decimal point, then a trailing point.
function stripZeros(text: string): string {
  return text.includes('.') ? text.replace(/0+$/, '').replace(/\.$/, '') : text;
}

export function formatG(x: number): string {
  if (Number.isNaN(x)) return 'nan';
  if (!Number.isFinite(x)) return x > 0 ? 'inf' : '-inf';
  const sign = x < 0 || Object.is(x, -0) ? '-' : '';
  if (x === 0) return `${sign}0`;

  const exact = exactDecimal(x);
  const digits = exact.digits.replace(/^0+/, '');
  let exponent = digits.length - 1 + exact.exponent;
  const rounded = roundDigits(digits.padEnd(PRECISION, '0'), PRECISION);
  if (rounded.carry) exponent += 1;
  const significant = rounded.digits;

  if (exponent >= -4 && exponent < PRECISION) {
    let text: string;
    if (exponent >= 0) {
      text = `${significant.slice(0, exponent + 1)}.${significant.slice(exponent + 1)}`;
    } else {
      text = `0.${'0'.repeat(-exponent - 1)}${significant}`;
    }
    return sign + stripZeros(text);
  }
  const mantissa = stripZeros(`${significant[0] ?? ''}.${significant.slice(1)}`);
  const expText = String(Math.abs(exponent)).padStart(2, '0');
  return `${sign}${mantissa}e${exponent < 0 ? '-' : '+'}${expText}`;
}

// Python str.capitalize(). First character upper case, the rest lower case.
export function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1).toLowerCase();
}
