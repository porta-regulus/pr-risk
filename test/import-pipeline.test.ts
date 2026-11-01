// Build task 4 steps 1 to 3 and done criterion 5. Detection, limits, provenance, merge,
// diff, and fuzz cases (oversized files, deep JSON, __proto__ keys, XSS text, formula prefixes).
import { readFileSync } from 'node:fs';
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { decodeText, parseCsv } from '../src/import/csv';
import { commitImport, detectFormat, MAX_ROWS, prepareImport, type ImportFile } from '../src/import/pipeline';
import { parseCell } from '../src/import/values';
import { canonicalize, documentErrors, type Register, type RiskDocument } from '../src/schema';
import { example, EXAMPLE_1, EXAMPLE_2, EXAMPLE_3 } from './schema-helpers';

const bytesOf = (path: string): Uint8Array => new Uint8Array(readFileSync(new URL(`../docs/schema/${path}`, import.meta.url)));
const file = (fileName: string, bytes: Uint8Array | string): ImportFile => ({ fileName, bytes: typeof bytes === 'string' ? new TextEncoder().encode(bytes) : bytes });

const source1 = example(EXAMPLE_1);
const err = source1.registers.find((register) => register.id === 'ERR') as Register;
const errOnly: RiskDocument = { ...structuredClone(source1), registers: [err], risks: [], provenance: [] };
const IMPORTED_ON = '2026-10-28T09:00:00Z';

describe('format detection', () => {
  it('detects every supported format by content', () => {
    expect(detectFormat(file('a.json', JSON.stringify(example(EXAMPLE_2))))).toBe('native');
    expect(detectFormat(file('rdr.json', bytesOf('vendor/nist-ir8286r1/risk_detail_record_example.json')))).toBe('ir8286-json');
    expect(detectFormat(file('x.json', bytesOf('fixtures/cvd-portal-export.json')))).toBe('cvd-portal-json');
    expect(detectFormat(file('fig10.csv', bytesOf('fixtures/sp800-221r1-fig10.csv')))).toBe('csv');
    expect(detectFormat(file('p.json', '{"plan-of-action-and-milestones":{}}'))).toBe('oscal-poam');
    expect(detectFormat(file('book.xlsx', new Uint8Array([0x50, 0x4b, 0x03, 0x04, 0, 0])))).toBe('xlsx');
    expect(detectFormat(file('x.bin', new Uint8Array([0, 1, 2, 3])))).toBe('unknown');
  });
});

describe('pipeline and provenance', () => {
  it('imports Fig. 10 with the provenance of example 1', () => {
    const preview = prepareImport(errOnly, file('fixtures/sp800-221r1-fig10.csv', bytesOf('fixtures/sp800-221r1-fig10.csv')), { register: err, importedOn: IMPORTED_ON, provenanceId: 'PV-1' });
    expect(preview.errors).toEqual([]);
    const expected = source1.provenance?.[0];
    expect(preview.provenance.sha256).toBe(expected?.sha256);
    expect(preview.provenance.recordCount).toBe(10);
    expect(preview.provenance.columnMapping).toEqual(expected?.columnMapping);
    const doc = commitImport(errOnly, preview);
    expect(documentErrors(doc)).toEqual([]);
    expect(doc.risks).toHaveLength(10);
    expect(doc.changeLog).toHaveLength(10);
  });

  it('imports the CVD Portal export with the hash of example 3', () => {
    const source3 = example(EXAMPLE_3);
    const base: RiskDocument = {
      ...structuredClone(source3),
      registers: source3.registers.filter((register) => register.id !== 'GW') as RiskDocument['registers'],
      risks: source3.risks.filter((risk) => risk.registerId !== 'GW'),
    };
    const preview = prepareImport(base, file('fixtures/cvd-portal-export.json', bytesOf('fixtures/cvd-portal-export.json')), { importedOn: IMPORTED_ON, cvd: { parentRegisterId: 'ORG', asOf: '2026-10-27' } });
    expect(preview.errors).toEqual([]);
    expect(preview.provenance.sha256).toBe(source3.provenance?.find((record) => record.format === 'cvd-portal-json')?.sha256);
    expect(preview.risks.map((risk) => risk.riskId)).toEqual(['GW-1', 'GW-2']);
  });

  it('imports the NIST RDR example and warns about the missing currentRiskAnalysis', () => {
    const csp: Register = { id: 'CSP', title: 'Customer Service Portal', level: 'system', timeframeMonths: 12, asOf: '2021-04-15', method: 'semi-quantitative' };
    const preview = prepareImport({ ...errOnly, registers: [csp] }, file('rdr.json', bytesOf('vendor/nist-ir8286r1/risk_detail_record_example.json')), { register: csp, importedOn: IMPORTED_ON });
    expect(preview.errors).toEqual([]);
    expect(preview.risks.map((risk) => risk.riskId)).toEqual(['17']);
    expect(preview.warnings.some((warning) => warning.includes('currentRiskAnalysis'))).toBe(true);
  });

  it('imports NIST register entries, reads a likelihood above 1 as a percentage and maps unknown status', () => {
    const entry = { riskId: 'N-1', riskDescription: 'Test', riskCategory: 'Access Control', riskLikelihood: 30, riskImpact: 1000, exposureRating: 300, riskResponseType: ['Mitigate'], riskResponseCost: 0, riskResponseDescription: 'Test', riskOwnerPointOfContact: 'Owner', status: 'Updated' };
    const preview = prepareImport(errOnly, file('entries.json', JSON.stringify([entry])), { register: err, importedOn: IMPORTED_ON });
    expect(preview.errors).toEqual([]);
    expect(preview.risks[0]?.riskLikelihood).toBe(0.3);
    expect(preview.risks[0]?.status).toBe('Open');
    expect(preview.risks[0]?.category).toEqual({ code: 'ict', subcode: 'ict.identity' });
    expect(preview.warnings.join(' ')).toMatch(/percentage.*unknown status "Updated"/);
  });
});

describe('whole-document restore', () => {
  it('validates the incoming document on its own, so a backup restores into an empty document', () => {
    const backup = example(EXAMPLE_2);
    const empty: RiskDocument = { ...structuredClone(errOnly), document: { ...errOnly.document, id: 'doc-empty' }, changeLog: [] };
    const preview = prepareImport(empty, file('backup.json', JSON.stringify(backup)), { register: err, importedOn: IMPORTED_ON });
    // The merge misses the drivers, responses and objectives of the backup. The restore has them.
    expect(preview.errors.length).toBeGreaterThan(0);
    expect(preview.documentErrors).toEqual([]);
    expect(() => commitImport(empty, preview)).toThrow('has errors');
    const restored = commitImport(empty, preview, {}, undefined, 'replace');
    expect(canonicalize(restored.risks)).toBe(canonicalize(backup.risks));
    expect(restored.provenance?.at(-1)?.fileName).toBe('backup.json');
  });
});

describe('merge and diff (Sec. 9.7)', () => {
  const fig10 = file('fig10.csv', bytesOf('fixtures/sp800-221r1-fig10.csv'));
  const first = commitImport(errOnly, prepareImport(errOnly, fig10, { register: err, importedOn: IMPORTED_ON }));

  it('a second identical import shows no difference', () => {
    expect(prepareImport(first, fig10, { register: err, importedOn: IMPORTED_ON }).diff).toEqual([]);
  });

  it('a changed cell shows as a diff, and each choice gives the expected result', () => {
    const text = new TextDecoder().decode(fig10.bytes).replace('Retiring staff lead to personnel shortages', 'Retiring staff lead to shortages');
    const preview = prepareImport(first, file('fig10.csv', text), { register: err, importedOn: IMPORTED_ON });
    expect(preview.diff.map((entry) => [entry.id, entry.field])).toEqual([['1', 'riskDescription']]);
    const keep = commitImport(first, preview, { risks: { '1': 'current' } });
    expect(keep.risks.find((risk) => risk.riskId === '1')?.riskDescription).toBe('Retiring staff lead to personnel shortages');
    const take = commitImport(first, preview, { risks: { '1': 'incoming' } });
    expect(take.risks.find((risk) => risk.riskId === '1')?.riskDescription).toBe('Retiring staff lead to shortages');
    const both = commitImport(first, preview, { risks: { '1': 'both' } });
    expect(both.risks.find((risk) => risk.riskId === '1-2')?.riskDescription).toBe('Retiring staff lead to shortages');
    expect(both.risks.find((risk) => risk.riskId === '1')?.riskDescription).toBe('Retiring staff lead to personnel shortages');
  });
});

describe('values', () => {
  it('reads compound, percent and locale numbers', () => {
    expect(parseCell('7.5% (Low)', 'dot')).toEqual({ number: 0.075, percent: true, label: 'Low' });
    expect(parseCell('1.234.567,5', 'comma')).toEqual({ number: 1234567.5 });
    expect(parseCell('1,234,567.5', 'dot')).toEqual({ number: 1234567.5 });
    expect(parseCell('Mod', 'dot')).toEqual({ label: 'Mod' });
  });

  it('reads semicolon files with comma decimals and Windows-1252 text', () => {
    const text = 'Risk Id;Risk Description;Risk Likelihood;Risk Impact;Risk Owner\r\n1;Café réseau;0,1;1.250.000,0;IT\r\n';
    const bytes = Uint8Array.from(text, (ch) => ch.charCodeAt(0));
    expect(decodeText(bytes).encoding).toBe('windows-1252');
    const preview = prepareImport(errOnly, file('x.csv', bytes), { register: err, importedOn: IMPORTED_ON });
    expect(preview.risks[0]?.riskDescription).toBe('Café réseau');
    expect([preview.risks[0]?.riskLikelihood, preview.risks[0]?.riskImpact, preview.risks[0]?.exposureRating]).toEqual([0.1, 1_250_000, 125_000]);
  });
});

describe('fuzz and limits (done criterion 5)', () => {
  it('refuses a file larger than 10 MB', () => {
    const preview = prepareImport(errOnly, file('big.csv', new Uint8Array(10 * 1024 * 1024 + 1).fill(65)));
    expect(preview.errors[0]?.rule).toBe('LIMIT');
  });

  it(`refuses more than ${String(MAX_ROWS)} rows`, () => {
    const text = `Risk Id,Risk Description,Risk Owner\n${Array.from({ length: MAX_ROWS + 1 }, (_, i) => `${String(i)},x,y`).join('\n')}`;
    expect(prepareImport(errOnly, file('rows.csv', text), { register: err }).errors[0]?.rule).toBe('LIMIT');
  });

  it('refuses deep JSON and __proto__ keys, and pollutes nothing', () => {
    expect(prepareImport(errOnly, file('deep.json', `${'['.repeat(40)}{"riskId":1}${']'.repeat(40)}`), { register: err }).errors[0]?.rule).toBe('LIMIT');
    const polluted = '[{"riskId":"P","__proto__":{"polluted":true},"riskDescription":"x"}]';
    expect(prepareImport(errOnly, file('p.json', polluted), { register: err }).errors[0]?.message).toContain('__proto__');
    expect(({} as Record<string, unknown>)['polluted']).toBeUndefined();
  });

  it('refuses a damaged ZIP before SheetJS reads it', () => {
    const preview = prepareImport(errOnly, file('bomb.xlsx', new Uint8Array([0x50, 0x4b, 0x03, 0x04, ...new Uint8Array(1000)])), { register: err });
    expect(preview.format).toBe('xlsx');
    expect(preview.errors[0]?.message).toContain('not a valid XLSX');
  });

  it('keeps XSS strings and formula prefixes as plain text', () => {
    fc.assert(
      fc.property(fc.constantFrom('<img src=x onerror=alert(1)>', '<script>alert(1)</script>', '=HYPERLINK("http://x")', '+1+1', '-2+3', '@SUM(A1)', '\tx'), (payload) => {
        const quoted = `"${payload.replace(/"/g, '""')}"`;
        const text = `Risk Id,Risk Description,Risk Owner\n1,${quoted},Owner\n`;
        const preview = prepareImport(errOnly, file('x.csv', text), { register: err, importedOn: IMPORTED_ON });
        expect(preview.risks[0]?.riskDescription).toBe(payload.trim());
      }),
    );
  });

  it('never throws on random CSV text or random bytes', () => {
    fc.assert(
      fc.property(fc.oneof(fc.string({ unit: 'binary', maxLength: 400 }).map((text) => new TextEncoder().encode(text)), fc.uint8Array({ maxLength: 400 })), (bytes) => {
        const preview = prepareImport(errOnly, { fileName: 'fuzz.csv', bytes }, { register: err, importedOn: IMPORTED_ON });
        expect(Array.isArray(preview.errors)).toBe(true);
      }),
      { numRuns: 300 },
    );
    const rows = parseCsv('a,"b\nc",d\r\n"e""f",g');
    expect(rows).toEqual([
      ['a', 'b\nc', 'd'],
      ['e"f', 'g'],
    ]);
  });
});

describe('NIST XLSX files of IR 8286 Rev. 1 (done criterion 4)', () => {
  const xlsx = (name: string): ImportFile => ({ fileName: name, bytes: new Uint8Array(readFileSync(new URL(`fixtures/nist-xlsx/${name}`, import.meta.url))) });

  it('are the files NIST published', async () => {
    const { sha256Hex } = await import('../src/schema');
    expect(sha256Hex(xlsx('RiskRegisterTemplate_20240109.xlsx').bytes)).toBe('9bcd6b9c3c5366a8b66783d56a884aa73f1314ec29e991f852022c1bd5d46423');
    expect(sha256Hex(xlsx('RiskRegisterExampleFig7_20240109.xlsx').bytes)).toBe('53f180c98faf28df65894074087742da7e584e66a2c9661e4fce2b49ee778fff');
  });

  it('the template gives a header with leading spaces and no risks', () => {
    const preview = prepareImport(errOnly, xlsx('RiskRegisterTemplate_20240109.xlsx'), { register: err, importedOn: IMPORTED_ON });
    expect(preview.format).toBe('xlsx');
    expect(preview.errors).toEqual([]);
    expect(preview.risks).toEqual([]);
    expect(preview.warnings.some((warning) => warning.includes('start or end with a space'))).toBe(true);
  });

  it('the Fig. 7 example gives 5 risks with "7.5% (Low)" cells and the "Updated" warning', () => {
    const blank: RiskDocument = { ...errOnly, strategy: {} };
    const preview = prepareImport(blank, xlsx('RiskRegisterExampleFig7_20240109.xlsx'), { register: err, importedOn: IMPORTED_ON });
    expect(preview.errors).toEqual([]);
    expect(preview.risks).toHaveLength(5);
    const first = preview.risks[0];
    expect([first?.riskLikelihood, first?.riskImpact, first?.exposureRating, first?.exposureRatingLabel]).toEqual([0.75, 0.1, 0.075, 'Low']);
    expect(first?.category).toEqual({ code: 'ict', subcode: 'ict.physical-environmental' });
    expect(preview.risks.map((risk) => risk.riskId)).toEqual(['1', '2', '3', '4', '5']);
    expect(preview.risks[3]?.polarity).toBe('positive');
    expect(preview.risks[1]?.riskResponseCost).toBe(3_700_000);
    expect(preview.risks[4]?.status).toBe('Open');
    expect(preview.warnings.some((warning) => warning.includes('unknown status "Updated"'))).toBe(true);
  });

  it('refuses a ZIP whose directory declares more than 50 MB', async () => {
    const { zipUncompressedSize } = await import('../src/import/xlsx');
    const bytes = new Uint8Array(xlsx('RiskRegisterTemplate_20240109.xlsx').bytes);
    expect(zipUncompressedSize(bytes)).toBeGreaterThan(0);
    // Patch the uncompressed size of the first directory entry to 60 MB.
    const view = new DataView(bytes.buffer);
    let end = bytes.length - 22;
    while (view.getUint32(end, true) !== 0x06054b50) end -= 1;
    view.setUint32(view.getUint32(end + 16, true) + 24, 60 * 1024 * 1024, true);
    const preview = prepareImport(errOnly, { fileName: 'bomb.xlsx', bytes }, { register: err });
    expect(preview.errors[0]?.message).toContain('50 MB');
  });
});
