import { readdirSync, readFileSync } from 'node:fs';
import type { RiskDocument } from '../src/schema';

const root = new URL('../', import.meta.url);

export function readJson(path: string): unknown {
  return JSON.parse(readFileSync(new URL(path, root), 'utf8'));
}

export const EXAMPLE_NAMES = readdirSync(new URL('docs/schema/examples/', root)).filter((name) => name.endsWith('.json')).sort();

export function example(name: string): RiskDocument {
  return readJson(`docs/schema/examples/${name}`) as RiskDocument;
}

export const EXAMPLE_1 = 'example-1-sp800-221r1-fig10-table9.json';
export const EXAMPLE_2 = 'example-2-sme-quantitative.json';
export const EXAMPLE_3 = 'example-3-imports-table10.json';

export function nistRdrExample(): Record<string, unknown> {
  const rdr = readJson('docs/schema/vendor/nist-ir8286r1/risk_detail_record_example.json') as Record<string, unknown>;
  delete rdr['$schema'];
  return rdr;
}
