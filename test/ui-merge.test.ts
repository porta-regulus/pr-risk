// The merge choice of an import on screen S1 (SPEC.md Sec. 9.7, src/ui/merge.ts). Diff rows per
// matched entity, the field merge of a file with only some fields, the choice mapping for
// commitImport, the register choice, and the change log of each choice.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { commitImport, prepareImport, type ImportFile } from '../src/import/pipeline';
import { parseCsv } from '../src/import/csv';
import { importIr8286 } from '../src/import/ir8286';
import { statedVersion } from '../src/import/stated';
import { tableToRisks } from '../src/import/table';
import { documentErrors, type Risk, type RiskDocument } from '../src/schema';
import { fieldParts, importChoices, mergeEntities, mergeResultText, unchangedRisks, valueText } from '../src/ui/merge';
import { example, EXAMPLE_3 } from './schema-helpers';

const IMPORTED_ON = '2026-10-30T09:00:00Z';
const TABLE10 = readFileSync(new URL('../docs/schema/fixtures/table10-system-registers.csv', import.meta.url), 'utf8');
// A newer Table 10 file. A-1 has a new likelihood, B-1 a new impact, C-1 a new response type.
const CHANGED = TABLE10.replace(',0.1,2000000,', ',0.15,2000000,').replace(',0.3,400000,', ',0.3,450000,').replace('Accept,General counsel', 'Mitigate,General counsel');
const csv = (text: string): ImportFile => ({ fileName: 'table10-newer.csv', bytes: new TextEncoder().encode(text) });

const doc3 = example(EXAMPLE_3);
const previewOf = (doc: RiskDocument, text: string) => prepareImport(doc, csv(text), { register: doc.registers[0], importedOn: IMPORTED_ON });
const riskOf = (doc: RiskDocument, id: string) => doc.risks.find((risk) => risk.riskId === id);

describe('valueText', () => {
  it('shows each value exactly, and names a missing value', () => {
    expect(valueText(undefined)).toBe('Not set');
    expect(valueText(null)).toBe('Not set');
    expect(valueText('')).toBe('Empty text');
    expect(valueText([])).toBe('Empty list');
    expect(valueText(['Mitigate', 'Accept'])).toBe('Mitigate, Accept');
    expect(valueText(0.15)).toBe('0.15');
    expect(valueText(false)).toBe('false');
    expect(valueText({ subcode: 'ict.identity', code: 'ict' })).toBe('code ict, subcode ict.identity');
    expect(valueText({})).toBe('{}');
    expect(valueText({ lec: [1, 2] })).toBe('{"lec":[1,2]}');
    expect(valueText([{ id: 'E-1' }])).toBe('[{"id":"E-1"}]');
  });

  it('splits a field name before each capital', () => {
    expect(fieldParts('riskResponseDescription')).toEqual(['risk', 'Response', 'Description']);
    expect(fieldParts('notes')).toEqual(['notes']);
  });
});

describe('diff rows per entity', () => {
  it('groups the diff of a newer Table 10 file per matched risk, with only the fields that the file holds', () => {
    const preview = previewOf(doc3, CHANGED);
    expect(preview.errors).toEqual([]);
    expect(preview.partial).toBe(true);
    const entities = mergeEntities(doc3, preview);
    expect(entities.map((entity) => [entity.kind, entity.id])).toEqual([
      ['risk', 'A-1'],
      ['risk', 'B-1'],
      ['risk', 'C-1'],
    ]);
    expect(entities[0]?.title).toBe(riskOf(doc3, 'A-1')?.riskDescription);
    // The CSV has no notes and no category subcode, so these fields are not in the diff.
    expect(entities[0]?.rows).toEqual([
      { field: 'exposureRating', current: '200000', incoming: '300000' },
      { field: 'riskLikelihood', current: '0.1', incoming: '0.15' },
    ]);
    expect(entities[1]?.rows).toEqual([
      { field: 'exposureRating', current: '120000', incoming: '135000' },
      { field: 'riskImpact', current: '400000', incoming: '450000' },
    ]);
    expect(entities[2]?.rows).toEqual([{ field: 'riskResponseType', current: 'Accept', incoming: 'Mitigate' }]);
  });

  it('shows no change when the source CSV of example 3 comes back', () => {
    const preview = previewOf(doc3, TABLE10);
    expect(preview.diff).toEqual([]);
    expect(unchangedRisks(doc3, preview)).toBe(3);
  });
});

describe('take incoming from a file with only some fields', () => {
  const preview = previewOf(doc3, CHANGED);
  const committed = commitImport(doc3, preview, { risks: { 'C-1': 'both' } });

  it('changes only the fields that the file holds', () => {
    const before = riskOf(doc3, 'B-1');
    expect(riskOf(committed, 'B-1')).toEqual({ ...before, riskImpact: 450000, exposureRating: 135000 });
    expect(riskOf(committed, 'B-1')?.notes).toBe(before?.notes);
    expect(riskOf(committed, 'B-1')?.category).toEqual({ code: 'ict', subcode: 'ict.data-exfiltration' });
  });

  it('gives keep both the current fields with the values of the file', () => {
    expect(riskOf(committed, 'C-1')).toEqual(riskOf(doc3, 'C-1'));
    expect(riskOf(committed, 'C-1-2')).toEqual({ ...riskOf(doc3, 'C-1'), riskId: 'C-1-2', riskResponseType: ['Mitigate'] });
  });

  it('lists the fields that each CSV row states', () => {
    const csvText = [
      'Register,Risk Id,Risk Description,Risk Likelihood,Risk Impact,Risk Response Type,Risk Response Cost,Status',
      'SYS-A,1,Text,0.1,1000,Exploit,500,Open',
      'SYS-A,2,Text,0.1,1000,Accept,,Unknown word',
      'SYS-A,3,,,,,,',
      'SYS-A,4,Text,High,High,,,',
    ].join('\n');
    const result = tableToRisks(doc3, parseCsv(csvText), { register: doc3.registers[0] });
    expect(result.stated.get('1')).toEqual([
      '/registerId',
      '/riskDescription',
      '/riskLikelihood',
      '/riskImpact',
      '/exposureRating',
      '/status',
      '/riskResponseType',
      '/responseDecision',
      '/polarity',
      '/riskResponseCost',
    ]);
    // Accept does not fix the polarity. An empty cell and an unknown status are not stated.
    expect(result.stated.get('2')).toEqual(['/registerId', '/riskDescription', '/riskLikelihood', '/riskImpact', '/exposureRating', '/riskResponseType', '/responseDecision']);
    // Placeholder numbers (rule D-Q2) are not stated. Example 3 has no scales, so the labels give
    // no numbers, but the row states the labels.
    expect(result.stated.get('3')).toEqual(['/registerId']);
    expect(result.stated.get('4')).toEqual(['/registerId', '/riskDescription', '/riskLikelihoodLabel', '/riskImpactLabel']);
  });

  it('keeps the fields that a NIST IR 8286 entry does not hold', () => {
    const a1 = riskOf(doc3, 'A-1');
    const entry = {
      riskId: 'A-1',
      riskDescription: a1?.riskDescription,
      riskCategory: 'Information disclosure',
      riskLikelihood: 0.15,
      riskImpact: 2000000,
      exposureRating: 300000,
      riskResponseType: ['Mitigate'],
      riskResponseCost: 0,
      riskResponseDescription: a1?.riskResponseDescription,
      riskOwnerPointOfContact: 'Merger project lead',
      status: 'Open',
    };
    const nist = prepareImport(doc3, { fileName: 'a1.json', bytes: new TextEncoder().encode(JSON.stringify([entry])) }, { ir8286RegisterId: 'SYS-A', importedOn: IMPORTED_ON });
    expect(nist.errors).toEqual([]);
    // The entry states the four fields that the CSV import defaulted, so they lose the defaulted
    // mark. The polarity follows Mitigate, and the IR 8286 import marks it as defaulted.
    expect(mergeEntities(doc3, nist)[0]?.rows).toEqual([
      { field: 'defaultedFields', current: '/riskCategory, /category, /riskResponseCost, /riskResponseDescription, /status', incoming: '/category, /polarity' },
      { field: 'exposureRating', current: '200000', incoming: '300000' },
      { field: 'riskLikelihood', current: '0.1', incoming: '0.15' },
    ]);
    const merged = commitImport(doc3, nist);
    expect(riskOf(merged, 'A-1')?.notes).toBe(a1?.notes);
    expect(riskOf(merged, 'A-1')?.category).toEqual(a1?.category);
  });

  it('changes only the planned and measured values that an RDR states', () => {
    const a1 = riskOf(doc3, 'A-1') as Risk;
    const detail = { planned: { likelihood: 0.05, likelihoodLabel: 'Low', impact: 2000000, exposureRating: 100000 }, measured: { actualResponseCost: 1000 } };
    const doc = { ...doc3, risks: doc3.risks.map((risk) => (risk.riskId === 'A-1' ? { ...risk, detail } : risk)) };
    const rdr = { riskIdNumbers: 'A-1', comments: 'New comment', likelihoodAfterControlsWillBe: 0.02 };
    const nist = prepareImport(doc, { fileName: 'rdr.json', bytes: new TextEncoder().encode(JSON.stringify([rdr])) }, { ir8286RegisterId: 'SYS-A', importedOn: IMPORTED_ON });
    expect(nist.errors).toEqual([]);
    const merged = riskOf(commitImport(doc, nist), 'A-1');
    // The RDR has no other planned or measured value, so the others stay. The label of the changed number goes.
    expect(merged?.detail).toEqual({ planned: { likelihood: 0.02, impact: 2000000, exposureRating: 100000 }, measured: { actualResponseCost: 1000 }, comments: 'New comment' });
    expect(merged?.riskLikelihood).toBe(a1.riskLikelihood);
  });

  it('changes the cost only with a stated response type (rule V-09)', () => {
    const doc: RiskDocument = {
      ...doc3,
      risks: doc3.risks.map((risk) => (risk.riskId === 'A-1' ? { ...risk, responseDecision: 'pending', riskResponseType: ['Accept'], riskResponseCost: 0 } : risk)),
    };
    const files = [
      [{ riskId: 'A-1', riskResponseCost: 5000 }],
      [{ riskIdNumbers: 'A-1', plannedResponseCost: 5000 }],
    ];
    for (const items of files) {
      const nist = prepareImport(doc, { fileName: 'cost.json', bytes: new TextEncoder().encode(JSON.stringify(items)) }, { ir8286RegisterId: 'SYS-A', importedOn: IMPORTED_ON });
      expect(nist.errors).toEqual([]);
      expect(riskOf(commitImport(doc, nist), 'A-1')).toMatchObject({ responseDecision: 'pending', riskResponseType: ['Accept'], riskResponseCost: 0 });
    }
  });

  it('keeps the stated fields of a risk id that is an object property name', () => {
    const ids = ['__proto__', 'constructor', 'toString'];
    const entries = ids.map((riskId) => ({ riskId, riskDescription: `Risk ${riskId}` }));
    const rdr = { riskIdNumbers: 'hasOwnProperty', comments: 'From an RDR' };
    const result = importIr8286([...entries, rdr], 'SYS-A');
    for (const id of ids) expect(result.stated.get(id)).toEqual(['/riskDescription']);
    expect(result.stated.get('hasOwnProperty')).toEqual(['/detail/comments']);
    expect(result.stated.size).toBe(4);
  });
});

describe('statedVersion', () => {
  const current = {
    ...riskOf(doc3, 'A-1'),
    riskLikelihoodLabel: 'Low',
    riskImpactLabel: 'High',
    impacts: { financial: { opex: { label: 'Low', amount: 5000 } } },
    defaultedFields: ['/riskCategory', '/riskImpact'],
  } as Risk;
  const incoming = {
    ...current,
    riskLikelihood: 0.15,
    exposureRating: 300000,
    impacts: { financial: { opex: { label: 'High' } } },
    defaultedFields: ['/riskCategory', '/riskLikelihood'],
  } as Risk;
  const result = statedVersion(current, incoming, ['/riskLikelihood', '/riskImpact', '/exposureRating', '/impacts/financial/opex/label']);

  it('keeps a label only while its number stays', () => {
    expect(result.riskLikelihood).toBe(0.15);
    expect(result.riskLikelihoodLabel).toBeUndefined();
    expect(result.riskImpactLabel).toBe('High');
  });

  it('sets a nested field and keeps the fields next to it', () => {
    expect(result.impacts).toEqual({ financial: { opex: { label: 'High', amount: 5000 } } });
  });

  it('takes the defaulted mark of a stated field from the file', () => {
    expect(result.defaultedFields).toEqual(['/riskCategory', '/riskLikelihood']);
  });
});

describe('choice mapping', () => {
  it('defaults a changed risk to incoming, as commitImport does, and maps each choice of the user', () => {
    const preview = previewOf(doc3, CHANGED);
    expect(importChoices(doc3, preview, {})).toEqual({ risks: { 'A-1': 'incoming', 'B-1': 'incoming', 'C-1': 'incoming' }, registers: {} });
    expect(importChoices(doc3, preview, { risks: { 'A-1': 'current', 'C-1': 'both' } }).risks).toEqual({ 'A-1': 'current', 'B-1': 'incoming', 'C-1': 'both' });
  });

  it('keeps a matched risk without a change as it is, and gives a new risk no choice', () => {
    const first = commitImport(doc3, previewOf(doc3, CHANGED));
    const extra = `${CHANGED.replace(',0.3,450000,', ',0.35,450000,').trimEnd()}\nSYS-D,7,A new risk for the test.,0.1,1000,Mitigate,Owner\n`;
    const preview = previewOf(first, extra);
    // The prefix rule gives the new row the id D-7. Only B-1 changed since the first import.
    expect(preview.risks.map((risk) => risk.riskId)).toEqual(['A-1', 'B-1', 'C-1', 'D-7']);
    expect(mergeEntities(first, preview).map((entity) => entity.id)).toEqual(['B-1']);
    // A choice for a risk without a change has no effect.
    const choices = importChoices(first, preview, { risks: { 'A-1': 'both', 'B-1': 'current' } });
    expect(choices.risks).toEqual({ 'A-1': 'current', 'B-1': 'current', 'C-1': 'current' });
    expect(unchangedRisks(first, preview)).toBe(2);
    expect(mergeResultText('t.csv', preview, choices)).toBe('1 risk from t.csv is saved. 1 risk keeps its current version. 2 risks have no change.');
  });

  it('gives no choice and no change log entry when the file has no change', () => {
    const first = commitImport(doc3, previewOf(doc3, CHANGED));
    const again = previewOf(first, CHANGED);
    expect(again.diff).toEqual([]);
    expect(unchangedRisks(first, again)).toBe(3);
    const choices = importChoices(first, again, {});
    expect(choices.risks).toEqual({ 'A-1': 'current', 'B-1': 'current', 'C-1': 'current' });
    // commitImport also skips a risk without a change when it gets no choice.
    for (const committed of [commitImport(first, again, choices), commitImport(first, again)]) {
      expect(committed.risks).toEqual(first.risks);
      expect(committed.changeLog).toEqual(first.changeLog);
      expect(committed.provenance).toHaveLength((first.provenance ?? []).length + 1);
    }
    expect(mergeResultText('table10-newer.csv', again, choices)).toBe('0 risks from table10-newer.csv are saved. 3 risks have no change.');
  });
});

describe('register choice', () => {
  // A native copy of example 3 with a new title for SYS-A and a new as-of date for SYS-B.
  const changedDoc: RiskDocument = {
    ...structuredClone(doc3),
    registers: doc3.registers.map((register) =>
      register.id === 'SYS-A' ? { ...register, title: 'Merger file share, new' } : register.id === 'SYS-B' ? { ...register, asOf: '2026-12-31' } : register,
    ) as RiskDocument['registers'],
  };
  const preview = prepareImport(doc3, { fileName: 'doc3.json', bytes: new TextEncoder().encode(JSON.stringify(changedDoc)) }, { importedOn: IMPORTED_ON });
  const registerOf = (doc: RiskDocument, id: string) => doc.registers.find((register) => register.id === id);

  it('shows each changed register with its title', () => {
    expect(mergeEntities(doc3, preview)).toEqual([
      { kind: 'register', id: 'SYS-A', title: 'Merger project file share', rows: [{ field: 'title', current: 'Merger project file share', incoming: 'Merger file share, new' }] },
      { kind: 'register', id: 'SYS-B', title: 'Sales department systems', rows: [{ field: 'asOf', current: '2026-10-27', incoming: '2026-12-31' }] },
    ]);
    expect(importChoices(doc3, preview, {}).registers).toEqual({ ORG: 'current', 'SYS-A': 'incoming', 'SYS-B': 'incoming', 'SYS-C': 'current', CSP: 'current', GW: 'current' });
  });

  it('keeps current or takes incoming per register, and logs only the register that changes', () => {
    const choices = importChoices(doc3, preview, { registers: { 'SYS-A': 'current' } });
    const committed = commitImport(doc3, preview, choices, 'Risk manager');
    expect(documentErrors(committed)).toEqual([]);
    expect(registerOf(committed, 'SYS-A')).toEqual(registerOf(doc3, 'SYS-A'));
    expect(registerOf(committed, 'SYS-B')?.asOf).toBe('2026-12-31');
    // A taken register stays in its place.
    expect(committed.registers.map((register) => register.id)).toEqual(doc3.registers.map((register) => register.id));
    expect(committed.risks).toEqual(doc3.risks);
    expect(committed.changeLog).toEqual([
      ...(doc3.changeLog ?? []),
      { at: IMPORTED_ON, entityKind: 'register', entityId: 'SYS-B', path: '', actor: 'Risk manager', before: registerOf(doc3, 'SYS-B'), after: registerOf(committed, 'SYS-B') },
    ]);
    expect(mergeResultText('doc3.json', preview, choices)).toBe(`0 risks from doc3.json are saved. ${String(doc3.risks.length)} risks have no change. 1 register is updated. 1 register keeps its current version.`);
  });

  it('takes incoming for a changed register by default', () => {
    const committed = commitImport(doc3, preview);
    expect(registerOf(committed, 'SYS-A')?.title).toBe('Merger file share, new');
    expect(registerOf(committed, 'SYS-B')?.asOf).toBe('2026-12-31');
  });
});

describe('commit with one choice per risk', () => {
  const preview = previewOf(doc3, CHANGED);
  const choices = importChoices(doc3, preview, { risks: { 'A-1': 'current', 'B-1': 'incoming', 'C-1': 'both' } });
  const committed = commitImport(doc3, preview, choices, 'Risk manager');

  it('stores a valid document with the result of each choice', () => {
    expect(documentErrors(committed)).toEqual([]);
    // Keep current. A-1 is unchanged.
    expect(riskOf(committed, 'A-1')).toEqual(riskOf(doc3, 'A-1'));
    // Take incoming. B-1 has the values of the file.
    expect(riskOf(committed, 'B-1')).toEqual(preview.risks.find((risk) => risk.riskId === 'B-1'));
    expect(riskOf(committed, 'B-1')?.riskImpact).toBe(450000);
    // Keep both. C-1 is unchanged, and the incoming risk has the new id C-1-2.
    expect(riskOf(committed, 'C-1')).toEqual(riskOf(doc3, 'C-1'));
    expect(riskOf(committed, 'C-1-2')).toEqual({ ...preview.risks.find((risk) => risk.riskId === 'C-1'), riskId: 'C-1-2' });
    expect(committed.risks).toHaveLength(doc3.risks.length + 1);
    expect(committed.provenance?.at(-1)?.fileName).toBe('table10-newer.csv');
  });

  it('records the result of each choice in the change log', () => {
    const log = committed.changeLog ?? [];
    expect(log.map((entry) => entry.entityId)).toEqual(['B-1', 'C-1-2']);
    expect(log.some((entry) => entry.entityId === 'A-1')).toBe(false);
    const [b1, c12] = log;
    expect(b1).toMatchObject({ at: IMPORTED_ON, entityKind: 'risk', path: '', actor: 'Risk manager', before: riskOf(doc3, 'B-1'), after: riskOf(committed, 'B-1') });
    expect(c12).toMatchObject({ at: IMPORTED_ON, entityKind: 'risk', path: '', actor: 'Risk manager', after: riskOf(committed, 'C-1-2') });
    expect(c12 !== undefined && 'before' in c12).toBe(false);
  });

  it('tells the user what the merge did', () => {
    expect(mergeResultText('table10-newer.csv', preview, choices)).toBe('2 risks from table10-newer.csv are saved. 1 risk keeps its current version.');
    expect(mergeResultText('table10-newer.csv', preview, importChoices(doc3, preview, { risks: { 'A-1': 'current', 'B-1': 'current', 'C-1': 'current' } }))).toBe(
      '0 risks from table10-newer.csv are saved. 3 risks keep their current version.',
    );
    expect(mergeResultText('table10-newer.csv', preview, importChoices(doc3, preview, { risks: { 'A-1': 'current', 'B-1': 'current' } }))).toBe('1 risk from table10-newer.csv is saved. 2 risks keep their current version.');
  });
});
