// Build task 2, done criteria 2 and 3. The TypeScript projections give byte-equal
// RFC 8785 JSON to docs/schema/validate.py, and G4 passes. The Python outputs are in
// test/fixtures/python-parity.json, which CI regenerates (tools/python_parity.py).
import { describe, expect, it } from 'vitest';
import {
  canonicalize,
  documentErrors,
  formatG,
  importRdr,
  labelFields,
  nistExportErrors,
  nistRdrErrors,
  projectRdr,
  projectRegister,
  semanticErrors,
  type Risk,
  type RiskDocument,
} from '../src/schema';
import { EXAMPLE_NAMES, example, nistRdrExample, readJson } from './schema-helpers';

interface Parity {
  examples: Record<string, { semanticErrors: string[]; risks: Record<string, { register: unknown; rdr: unknown }> }>;
  g4: { document: RiskDocument; rdr: Record<string, unknown> };
  formatG: [number, string][];
  labelFields: { risk: Risk; fields: [string, string, string][] };
}

const parity = readJson('test/fixtures/python-parity.json') as Parity;

describe('IR 8286 projection parity with validate.py', () => {
  it('covers the same examples', () => {
    expect(Object.keys(parity.examples).sort()).toEqual(EXAMPLE_NAMES);
  });

  for (const name of EXAMPLE_NAMES) {
    describe(name, () => {
      const doc = example(name);
      const python = parity.examples[name];

      it('passes the schema, the V rules and AT-1', () => {
        expect(python?.semanticErrors).toEqual([]);
        expect(documentErrors(doc)).toEqual([]);
        expect(semanticErrors(doc)).toEqual([]);
        expect(nistExportErrors(doc)).toEqual([]);
      });

      for (const risk of doc.risks) {
        it(`risk ${risk.riskId} projects byte-equal to Python`, () => {
          const expected = python?.risks[risk.riskId];
          expect(expected).toBeDefined();
          expect(canonicalize(projectRegister(risk))).toBe(canonicalize(expected?.register));
          expect(canonicalize(projectRdr(doc, risk))).toBe(canonicalize(expected?.rdr));
        });
      }
    });
  }
});

describe('G4 Fig. 15 RDR round trip (SPEC.md Sec. 12.2)', () => {
  const original = nistRdrExample();

  it('(a) the NIST example fails the NIST schema with one error, the missing currentRiskAnalysis', () => {
    const errors = nistRdrErrors(original);
    expect(errors).toHaveLength(1);
    expect(errors[0]?.message).toContain("must have required property 'currentRiskAnalysis'");
  });

  it('(b) and (c) after import and export the RDR validates, 34 fields unchanged, only currentRiskAnalysis added', () => {
    const doc = structuredClone(parity.g4.document);
    doc.risks = [importRdr(original, 'NE')];
    expect(documentErrors(doc)).toEqual([]);
    const rdr = projectRdr(doc, doc.risks[0] ?? (undefined as never));
    expect(nistRdrErrors(rdr)).toEqual([]);
    expect(Object.keys(original)).toHaveLength(34);
    for (const [key, value] of Object.entries(original)) expect(rdr[key], key).toEqual(value);
    expect(Object.keys(rdr).filter((key) => !(key in original))).toEqual(['currentRiskAnalysis']);
    expect(canonicalize(rdr)).toBe(canonicalize(parity.g4.rdr));
  });
});

describe('Rule V-11 label fields (schema 1.1.0 adds previousAssessment.impacts)', () => {
  it('lists the same labels in the same order as validate.py label_fields', () => {
    expect(labelFields(parity.labelFields.risk)).toEqual(parity.labelFields.fields);
    expect(parity.labelFields.fields.map(([field]) => field)).toContain('previousAssessment.impacts.reputation');
  });
});

describe('Python format(x, "g")', () => {
  it('matches Python for every fixture value', () => {
    const wrong = parity.formatG.filter(([value, text]) => formatG(value) !== text);
    expect(wrong.map(([value, text]) => `${String(value)} -> ${formatG(value)}, Python ${text}`)).toEqual([]);
    expect(parity.formatG.length).toBeGreaterThan(2000);
  });
});
