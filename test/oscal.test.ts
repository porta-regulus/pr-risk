// Build task 8 and AT-4 (SPEC.md Sec. 7.5 and 12.4). OSCAL 1.2.3 POA&M export validates
// against the NIST draft-07 schema, the lossless path restores the document, and the
// native path restores every risk field.
import { readFileSync, writeFileSync } from 'node:fs';
import Ajv from 'ajv';
import { describe, expect, it } from 'vitest';
import { exportPoam, importPoam } from '../src/oscal/poam';
import { sha1Hex, uuidv5 } from '../src/oscal/uuid';
import { canonicalize, sha256Hex } from '../src/schema';
import { EXAMPLE_NAMES, example } from './schema-helpers';

const schemaBytes = readFileSync(new URL('fixtures/oscal/oscal_poam_schema.json', import.meta.url));
const ajv = new Ajv({ strict: false, allErrors: true, validateFormats: false });
const validatePoam = ajv.compile(JSON.parse(schemaBytes.toString('utf8')) as object);
const LAST_MODIFIED = '2026-10-28T09:00:00Z';

describe('SHA-1 and UUIDv5', () => {
  it('give the published test vectors', () => {
    expect(sha1Hex('')).toBe('da39a3ee5e6b4b0d3255bfef95601890afd80709');
    expect(sha1Hex('abc')).toBe('a9993e364706816aba3e25717850c26c9cd0d89d');
    expect(uuidv5('6ba7b810-9dad-11d1-80b4-00c04fd430c8', 'python.org')).toBe('886313e1-3b8a-5372-9b90-0c9aee199e5d');
  });

  it('the schema file is the OSCAL 1.2.3 release asset', () => {
    expect(sha256Hex(new Uint8Array(schemaBytes))).toBe('f4fd94487408a9589954b5b92d88965c984d4f79b85365cc574b860898759437');
  });
});

for (const name of EXAMPLE_NAMES) {
  describe(`AT-4 ${name}`, () => {
    const doc = example(name);
    const poam = exportPoam(doc, { lastModified: LAST_MODIFIED });
    // CI job "oscal" validates these files with NIST oscal-cli (AT-4 item 2).
    const out = process.env['OSCAL_OUT'];
    if (out !== undefined && out !== '') writeFileSync(`${out}/${name.replace('.json', '-poam.json')}`, JSON.stringify(poam, null, 1));

    it('validates against the OSCAL 1.2.3 POA&M schema', () => {
      const valid = validatePoam(poam);
      expect(valid ? [] : validatePoam.errors?.slice(0, 5)).toEqual([]);
    });

    it('is the same for the same document', () => {
      expect(canonicalize(exportPoam(doc, { lastModified: LAST_MODIFIED }))).toBe(canonicalize(poam));
    });

    it('lossless path restores the document exactly', () => {
      const result = importPoam(JSON.parse(JSON.stringify(poam)), doc, '2026-10-28');
      expect(result.path).toBe('lossless');
      if (result.path === 'lossless') expect(canonicalize(result.document)).toBe(canonicalize(doc));
    });

    it('native path restores every risk field and reports the rest', () => {
      const stripped = structuredClone(poam) as { 'plan-of-action-and-milestones': Record<string, unknown> };
      delete stripped['plan-of-action-and-milestones']['back-matter'];
      const result = importPoam(stripped, { ...doc, risks: [] }, '2026-10-28');
      expect(result.path).toBe('native');
      if (result.path === 'native') {
        expect(result.risks.map((risk) => canonicalize(risk))).toEqual(doc.risks.map((risk) => canonicalize(risk)));
        expect(result.registers).toEqual([]);
        expect(result.report.join(' ')).toContain('not in the mapped elements');
      }
    });

    it('a changed payload falls back to the native path', () => {
      const changed = structuredClone(poam) as { 'plan-of-action-and-milestones': { 'back-matter': { resources: { props: { value: string }[] }[] } } };
      const prop = changed['plan-of-action-and-milestones']['back-matter'].resources[0]?.props[0];
      if (prop !== undefined) prop.value = '0'.repeat(64);
      expect(importPoam(changed, doc, '2026-10-28').path).toBe('native');
    });
  });
}

describe('OSCAL through the import pipeline', () => {
  it('replaces an empty document with the lossless payload, keeping only the new provenance and change log apart', async () => {
    const { commitImport, prepareImport } = await import('../src/import/pipeline');
    for (const name of EXAMPLE_NAMES) {
      const doc = example(name);
      const text = JSON.stringify(exportPoam(doc, { lastModified: LAST_MODIFIED }));
      const empty = { ...doc, registers: doc.registers, risks: [], provenance: [] };
      const preview = prepareImport(empty, { fileName: 'poam.json', bytes: new TextEncoder().encode(text) }, { importedOn: LAST_MODIFIED });
      expect(preview.format).toBe('oscal-poam');
      expect(preview.errors).toEqual([]);
      const restored = commitImport(empty, preview, {}, undefined, 'replace');
      const strip = (value: typeof doc) => {
        const { changeLog, provenance, ...rest } = value;
        return canonicalize({ ...rest, provenance: (provenance ?? []).slice(0, (doc.provenance ?? []).length) });
      };
      expect(strip(restored)).toBe(strip(doc));
      expect(restored.provenance?.at(-1)?.format).toBe('oscal-poam');
    }
  });
});
