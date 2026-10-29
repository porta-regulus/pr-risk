// AT-1 (SPEC.md Sec. 12.1). Generated valid documents pass the schema, the V rules and
// the NIST IR 8286 schemas after projection. With AT1_CORPUS set, the documents and the
// TypeScript projections are written to that file, and tools/at1_check.py checks the
// same documents with docs/schema/validate.py.
import { writeFileSync } from 'node:fs';
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { documentErrors, nistExportErrors, projectRdr, projectRegister, type RiskDocument } from '../src/schema';
import { documentArbitrary } from './arbitraries';

const RUNS = 1000;
const SEED = 20261207;

describe('AT-1 with 1 000 generated documents', () => {
  it('every document and every projection is valid', () => {
    const corpus: { doc: RiskDocument; projections: Record<string, { register: unknown; rdr: unknown }> }[] = [];
    fc.assert(
      fc.property(documentArbitrary, (doc) => {
        expect(documentErrors(doc)).toEqual([]);
        expect(nistExportErrors(doc)).toEqual([]);
        corpus.push({
          doc,
          projections: Object.fromEntries(doc.risks.map((risk) => [risk.riskId, { register: projectRegister(risk), rdr: projectRdr(doc, risk) }])),
        });
      }),
      { numRuns: RUNS, seed: SEED, endOnFailure: true },
    );
    expect(corpus).toHaveLength(RUNS);
    const target = process.env['AT1_CORPUS'];
    if (target !== undefined && target !== '') writeFileSync(target, JSON.stringify(corpus));
  });
});
