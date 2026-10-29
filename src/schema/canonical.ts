// RFC 8785 JSON Canonicalization Scheme. Object keys sorted by UTF-16 code units,
// numbers and strings serialized as ECMAScript JSON.stringify does (RFC 8785 Sec. 3.2).
import { sha256Hex } from './sha256';

const LONE_SURROGATE = /[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/;

export function canonicalize(value: unknown): string {
  if (value === null || typeof value === 'boolean') return JSON.stringify(value);
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new TypeError(`RFC 8785 has no form for ${String(value)}`);
    return JSON.stringify(value);
  }
  if (typeof value === 'string') {
    if (LONE_SURROGATE.test(value)) throw new TypeError('RFC 8785 input must be valid Unicode');
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) return `[${value.map((item) => canonicalize(item)).join(',')}]`;
  if (typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>).filter(([, item]) => item !== undefined);
    entries.sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
    return `{${entries.map(([key, item]) => `${canonicalize(key)}:${canonicalize(item)}`).join(',')}}`;
  }
  throw new TypeError(`RFC 8785 has no form for a ${typeof value}`);
}

export function canonicalSha256(value: unknown): string {
  return sha256Hex(canonicalize(value));
}
