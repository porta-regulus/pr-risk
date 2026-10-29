// Golden tests G1 and G3 (SPEC.md Sec. 12.2) and the CVD Portal fixture (build task 4).
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { decodeText, parseCsv } from '../src/import/csv';
import { importCvdPortal } from '../src/import/cvd';
import { summarize, threePoint } from '../src/import/rollup';
import { tableToRisks } from '../src/import/table';
import { documentErrors, lint, nistExportErrors, type Register, type Risk, type RiskDocument } from '../src/schema';
import { example, EXAMPLE_1, EXAMPLE_3 } from './schema-helpers';

const fixture = (name: string): Uint8Array => new Uint8Array(readFileSync(new URL(`../docs/schema/fixtures/${name}`, import.meta.url)));
const rowsOf = (name: string): string[][] => parseCsv(decodeText(fixture(name)).text);

// Notes are written by hand in the examples, and defaultedFields is a set.
function comparable(risk: Risk): Record<string, unknown> {
  const { notes, ...rest } = risk;
  return { ...rest, defaultedFields: [...(risk.defaultedFields ?? [])].sort() };
}

describe('G1 Fig. 10 from fixtures/sp800-221r1-fig10.csv', () => {
  const source = example(EXAMPLE_1);
  const err = source.registers.find((register) => register.id === 'ERR') as Register;
  const empty: RiskDocument = { ...structuredClone(source), registers: [err], risks: [] };
  const result = tableToRisks(empty, rowsOf('sp800-221r1-fig10.csv'), { register: err });
  const doc: RiskDocument = { ...empty, risks: result.risks };

  it('(a) gives risks 1 to 10 of example 1, except provenance time and the hand-written notes', () => {
    const expected = source.risks.filter((risk) => risk.registerId === 'ERR');
    expect(result.risks.map(comparable)).toEqual(expected.map(comparable));
    expect(result.registers).toEqual([]);
  });

  it('(c) row 2 is positive, the others negative, with a warning for row 2', () => {
    expect(result.risks.filter((risk) => risk.polarity === 'positive').map((risk) => risk.riskId)).toEqual(['2']);
    expect(result.warnings.some((warning) => warning.startsWith('Row 2 names an opportunity'))).toBe(true);
  });

  it('(d) lint L-03 reports exactly one pair, row 7 over row 6', () => {
    expect(lint(doc).filter((warning) => warning.rule === 'L-03').map((warning) => warning.riskIds)).toEqual([['7', '6']]);
  });

  it('(e) the document is valid and the IR 8286 export validates', () => {
    expect(documentErrors(doc)).toEqual([]);
    expect(nistExportErrors(doc)).toEqual([]);
  });

  it('records the same column mapping as the example provenance', () => {
    expect(result.columnMapping).toEqual(source.provenance?.[0]?.columnMapping);
  });
});

describe('G3 Table 10 from fixtures/table10-system-registers.csv', () => {
  const source = example(EXAMPLE_3);
  const empty: RiskDocument = { ...structuredClone(source), risks: [] };
  const result = tableToRisks(empty, rowsOf('table10-system-registers.csv'));

  it('(a) gives A-1, B-1 and C-1 with the exact Table 10 texts and numbers', () => {
    const expected = source.risks.filter((risk) => ['A-1', 'B-1', 'C-1'].includes(risk.riskId));
    expect(result.risks.map((risk) => [risk.riskId, risk.registerId, risk.riskDescription, risk.riskLikelihood, risk.riskImpact, risk.exposureRating, risk.riskResponseType, risk.riskOwnerPointOfContact])).toEqual(
      expected.map((risk) => [risk.riskId, risk.registerId, risk.riskDescription, risk.riskLikelihood, risk.riskImpact, risk.exposureRating, risk.riskResponseType, risk.riskOwnerPointOfContact]),
    );
    expect(result.warnings.some((warning) => warning.includes('header cells start or end with a space'))).toBe(true);
    expect(result.columnMapping).toEqual(source.provenance?.[0]?.columnMapping);
  });
});

describe('G3 merge and roll-up (b) to (e)', () => {
  const source = example(EXAMPLE_3);
  const systems = ['A-1', 'B-1', 'C-1'].map((id) => source.risks.find((risk) => risk.riskId === id) as Risk);
  const org1 = source.risks.find((risk) => risk.riskId === 'ORG-1') as Risk;
  const base = {
    id: 'ORG-1',
    registerId: 'ORG',
    riskDescription: org1.riskDescription,
    riskOwnerPointOfContact: org1.riskOwnerPointOfContact,
    priority: 1,
  };

  it('(b) one-row-all-responses gives ORG-1 of example 3', () => {
    const [summary] = summarize(systems, { ...base, layout: 'one-row-all-responses', riskResponseDescription: org1.riskResponseDescription });
    const { notes, ...expected } = org1;
    expect(summary).toEqual(expected);
    expect(summary?.riskResponseType).toEqual(['Mitigate', 'Accept']);
    expect(summary?.rollUp?.likelihood).toEqual({ optimistic: 0.1, mostLikely: 0.2, pessimistic: 0.3 });
    expect(summary?.rollUp?.impact).toEqual({ optimistic: 400_000, mostLikely: 800_000, pessimistic: 2_000_000 });
  });

  it('(c) and (d) one-row-per-response gives Mitigate (A-1, B-1) with the n = 2 rule and Accept (C-1) with the n = 1 rule', () => {
    const rows = summarize(systems, { ...base, layout: 'one-row-per-response' });
    expect(rows.map((row) => [row.riskResponseType, row.sourceRefs?.map((ref) => ref.riskId)])).toEqual([
      [['Mitigate'], ['A-1', 'B-1']],
      [['Accept'], ['C-1']],
    ]);
    expect(rows[0]?.rollUp?.likelihood).toEqual({ optimistic: 0.1, mostLikely: 0.2, pessimistic: 0.3 });
    expect(rows[0]?.rollUp?.impact).toEqual({ optimistic: 400_000, mostLikely: 1_200_000, pessimistic: 2_000_000 });
    expect(rows[1]?.rollUp?.likelihood).toEqual({ optimistic: 0.2, mostLikely: 0.2, pessimistic: 0.2 });
  });

  it('three-point puts the highest value first for positive risks', () => {
    expect(threePoint([1, 5, 3], 'positive')).toEqual({ optimistic: 5, mostLikely: 3, pessimistic: 1 });
  });

  it('(e) lint L-10 flags ORG-1', () => {
    expect(lint(source).filter((warning) => warning.rule === 'L-10').map((warning) => warning.riskIds)).toEqual([['ORG-1']]);
  });
});

describe('CVD Portal export (task 4 done criterion 3)', () => {
  const source = example(EXAMPLE_3);
  const empty: RiskDocument = {
    ...structuredClone(source),
    registers: source.registers.filter((register) => register.id !== 'GW') as RiskDocument['registers'],
    risks: source.risks.filter((risk) => risk.registerId !== 'GW'),
  };
  const raw = fixture('cvd-portal-export.json');
  const json = JSON.parse(new TextDecoder().decode(raw)) as unknown;
  const result = importCvdPortal(empty, json, { parentRegisterId: 'ORG', asOf: '2026-10-27' });

  it('gives GW-1 and GW-2 equal to example 3', () => {
    expect(result.risks).toEqual(source.risks.filter((risk) => risk.registerId === 'GW'));
    expect(result.registers.map((register) => [register.id, register.title, register.parentRegisterId, register.method])).toEqual([['GW', 'Gateway X1 product', 'ORG', 'semi-quantitative']]);
  });

  it('never stores description, stepsToReproduce or impact', () => {
    const text = JSON.stringify(result);
    expect(text).not.toContain('(not imported)');
    for (const key of ['"description"', '"stepsToReproduce"', '"impact"']) expect(text).not.toContain(key);
  });

  it('re-import updates evidence, sets Review needed and keeps the estimates', () => {
    const doc: RiskDocument = { ...empty, registers: [...empty.registers, ...result.registers] as RiskDocument['registers'], risks: [...empty.risks, ...result.risks] };
    const gw2 = doc.risks.find((risk) => risk.riskId === 'GW-2') as Risk;
    Object.assign(gw2, { riskLikelihood: 0.3, riskImpact: 50_000, exposureRating: 15_000 });
    const next = structuredClone(json) as { data: Record<string, unknown>[]; meta: { count: number } };
    next.data.push({ ...next.data[0], id: 'sub_ex_004', status: 'NEW', createdAt: '2026-10-25T10:00:00.000Z' });
    next.meta.count = 4;
    const again = importCvdPortal(doc, next, { asOf: '2026-10-28' });
    expect(again.registers).toEqual([]);
    expect(again.updated.sort()).toEqual(['GW-1', 'GW-2']);
    const updated = again.risks.find((risk) => risk.riskId === 'GW-2') as Risk;
    expect(updated.status).toBe('Review needed');
    expect([updated.riskLikelihood, updated.riskImpact, updated.exposureRating]).toEqual([0.3, 50_000, 15_000]);
    expect(updated.evidence?.map((entry) => entry.ref)).toEqual(['cvdp:sub_ex_001', 'cvdp:sub_ex_002', 'cvdp:sub_ex_004']);
    expect(updated.riskDescription.endsWith('Evidence 3 reports, 2 open.')).toBe(true);
    expect(again.risks.find((risk) => risk.riskId === 'GW-1')?.status).toBe('Open');
  });
});
