// Read, migrate and validate a native document (SPEC.md Sec. 7.6, 7.7, 9.2).
import type { ErrorObject } from 'ajv';
import { validateDocument, validateNistRdr, validateNistRegisterEntry } from './generated/validators.js';
import type { StandaloneValidator } from './generated/validators.js';
import { projectRdr, projectRegister } from './project';
import { semanticErrors } from './rules';
import type { Finding, RiskDocument } from './types';

// The version that the app writes. 1.1.0 and 1.2.0 add optional fields only, so a 1.0.0
// or 1.1.0 document is also a valid 1.2.0 document and needs no migration (Sec. 7.7 item 2).
export const SCHEMA_VERSION = '1.2.0';
// ADR-0004 D1.
export const MAX_DOCUMENT_BYTES = 10 * 1024 * 1024;
export const MAX_JSON_DEPTH = 32;

export type ReadResult =
  | { readonly ok: true; readonly doc: RiskDocument; readonly migratedFrom?: string }
  | { readonly ok: false; readonly errors: readonly Finding[] };

function schemaFindings(rule: string, errors: readonly ErrorObject[] | null | undefined): Finding[] {
  return (errors ?? []).map((error) => ({
    rule,
    message: `${error.instancePath || '/'} ${error.message ?? error.keyword}${
      error.keyword === 'additionalProperties' || error.keyword === 'unevaluatedProperties'
        ? ` (${String((error.params as Record<string, unknown>)['additionalProperty'] ?? (error.params as Record<string, unknown>)['unevaluatedProperty'])})`
        : ''
    }`,
  }));
}

function check(validator: StandaloneValidator, rule: string, value: unknown): Finding[] {
  return validator(value) ? [] : schemaFindings(rule, validator.errors);
}

export function depthOf(value: unknown): number {
  let max = 0;
  const stack: [unknown, number][] = [[value, 1]];
  for (let next = stack.pop(); next !== undefined; next = stack.pop()) {
    const [item, depth] = next;
    if (item === null || typeof item !== 'object') continue;
    max = Math.max(max, depth);
    for (const child of Object.values(item)) stack.push([child, depth + 1]);
  }
  return max;
}

// Release 1 reads major version 1 only. The previous major version is migrated here
// when release 2 changes the schema (Sec. 7.7 item 3).
export function migrate(value: unknown): { doc: unknown; migratedFrom?: string } | { error: Finding } {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    return { error: { rule: 'SCHEMA', message: 'The file is not a JSON object' } };
  }
  const version = (value as Record<string, unknown>)['schemaVersion'];
  const [major, minor] = typeof version === 'string' ? version.split('.') : [];
  const [ownMajor, ownMinor] = SCHEMA_VERSION.split('.');
  if (major !== ownMajor) {
    return { error: { rule: 'SCHEMA', message: `Schema version ${String(version)} is not supported. This app reads ${ownMajor ?? ''}.0.0 to ${SCHEMA_VERSION}.` } };
  }
  // A newer minor version can hold fields that this app does not know.
  if (Number(minor) > Number(ownMinor)) {
    return { error: { rule: 'SCHEMA', message: `Schema version ${String(version)} is newer than this app. This app reads ${ownMajor ?? ''}.0.0 to ${SCHEMA_VERSION}. Use a newer version of the app.` } };
  }
  return { doc: value };
}

// Ajv records the properties that unevaluatedProperties has seen in a plain object.
// A key such as "__proto__" or "constructor" then reads as seen and passes. No schema
// property has such a name, so the screen rejects them first (ADR-0004 E2).
export function unsafeKeyPaths(value: unknown): string[] {
  const paths: string[] = [];
  const stack: [unknown, string][] = [[value, '']];
  for (let next = stack.pop(); next !== undefined; next = stack.pop()) {
    const [item, path] = next;
    if (item === null || typeof item !== 'object') continue;
    for (const [key, child] of Object.entries(item)) {
      if (key in Object.prototype) paths.push(`${path}/${key}`);
      stack.push([child, `${path}/${key}`]);
    }
  }
  return paths;
}

export function schemaErrors(value: unknown): Finding[] {
  const unsafe = unsafeKeyPaths(value);
  if (unsafe.length > 0) return unsafe.map((path) => ({ rule: 'SCHEMA', message: `${path} is not an allowed property name` }));
  return check(validateDocument, 'SCHEMA', value);
}

// Every check that blocks save or import: JSON Schema, then the V rules.
export function documentErrors(value: unknown): Finding[] {
  const errors = schemaErrors(value);
  return errors.length > 0 ? errors : semanticErrors(value as RiskDocument);
}

export function readDocument(text: string): ReadResult {
  if (text.length > MAX_DOCUMENT_BYTES) {
    return { ok: false, errors: [{ rule: 'LIMIT', message: 'The file is larger than 10 MB' }] };
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch (error) {
    return { ok: false, errors: [{ rule: 'JSON', message: error instanceof Error ? error.message : 'Invalid JSON' }] };
  }
  if (depthOf(parsed) > MAX_JSON_DEPTH) {
    return { ok: false, errors: [{ rule: 'LIMIT', message: `The JSON is nested deeper than ${String(MAX_JSON_DEPTH)} levels` }] };
  }
  const migrated = migrate(parsed);
  if ('error' in migrated) return { ok: false, errors: [migrated.error] };
  const errors = documentErrors(migrated.doc);
  if (errors.length > 0) return { ok: false, errors };
  const doc = migrated.doc as RiskDocument;
  return migrated.migratedFrom === undefined ? { ok: true, doc } : { ok: true, doc, migratedFrom: migrated.migratedFrom };
}

// AT-1. Every risk projects to a valid NIST register entry and a valid NIST RDR.
export function nistExportErrors(doc: RiskDocument): Finding[] {
  return doc.risks.flatMap((risk) => [
    ...check(validateNistRegisterEntry, 'AT-1', projectRegister(risk)).map((item) => ({ ...item, message: `${risk.riskId} register ${item.message}`, riskIds: [risk.riskId] })),
    ...check(validateNistRdr, 'AT-1', projectRdr(doc, risk)).map((item) => ({ ...item, message: `${risk.riskId} RDR ${item.message}`, riskIds: [risk.riskId] })),
  ]);
}

export function nistRdrErrors(rdr: unknown): Finding[] {
  return check(validateNistRdr, 'NIST', rdr);
}
