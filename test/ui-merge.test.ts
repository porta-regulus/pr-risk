// The merge choice of an import on screen S1 (SPEC.md Sec. 9.7, src/ui/merge.ts). Diff rows per
// matched entity, the choice mapping for commitImport, and the change log of each choice.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { commitImport, prepareImport, type ImportFile } from '../src/import/pipeline';
import { documentErrors, type RiskDocument } from '../src/schema';
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
  it('groups the diff of a newer Table 10 file per matched risk, with current and incoming text', () => {
    const preview = previewOf(doc3, CHANGED);
    expect(preview.errors).toEqual([]);
    const entities = mergeEntities(doc3, preview);
    expect(entities.map((entity) => [entity.kind, entity.id])).toEqual([
      ['risk', 'A-1'],
      ['risk', 'B-1'],
      ['risk', 'C-1'],
    ]);
    const a1 = entities[0];
    expect(a1?.title).toBe(riskOf(doc3, 'A-1')?.riskDescription);
    expect(a1?.rows).toContainEqual({ field: 'riskLikelihood', current: '0.1', incoming: '0.15' });
    expect(a1?.rows).toContainEqual({ field: 'notes', current: riskOf(doc3, 'A-1')?.notes, incoming: 'Not set' });
    expect(entities[1]?.rows).toContainEqual({ field: 'riskImpact', current: '400000', incoming: '450000' });
    expect(entities[2]?.rows).toContainEqual({ field: 'riskResponseType', current: 'Accept', incoming: 'Mitigate' });
  });

  it('shows a matched register with its title, and the merge keeps the current register', () => {
    const changedDoc: RiskDocument = { ...structuredClone(doc3), registers: doc3.registers.map((register) => (register.id === 'SYS-A' ? { ...register, title: 'Merger file share, new' } : register)) as RiskDocument['registers'] };
    const preview = prepareImport(doc3, { fileName: 'doc3.json', bytes: new TextEncoder().encode(JSON.stringify(changedDoc)) }, { importedOn: IMPORTED_ON });
    const entities = mergeEntities(doc3, preview);
    expect(entities).toEqual([{ kind: 'register', id: 'SYS-A', title: 'Merger project file share', rows: [{ field: 'title', current: 'Merger project file share', incoming: 'Merger file share, new' }] }]);
    const committed = commitImport(doc3, preview, importChoices(doc3, preview, {}));
    expect(committed.registers.find((register) => register.id === 'SYS-A')?.title).toBe('Merger project file share');
  });
});

describe('choice mapping', () => {
  it('defaults a changed risk to incoming, as commitImport does, and maps each choice of the user', () => {
    const preview = previewOf(doc3, CHANGED);
    expect(importChoices(doc3, preview, {})).toEqual({ 'A-1': 'incoming', 'B-1': 'incoming', 'C-1': 'incoming' });
    expect(importChoices(doc3, preview, { 'A-1': 'current', 'C-1': 'both' })).toEqual({ 'A-1': 'current', 'B-1': 'incoming', 'C-1': 'both' });
  });

  it('keeps a matched risk without a change as it is, and gives a new risk no choice', () => {
    const first = commitImport(doc3, previewOf(doc3, CHANGED));
    const extra = `${CHANGED.replace(',0.3,450000,', ',0.35,450000,').trimEnd()}\nSYS-D,7,A new risk for the test.,0.1,1000,Mitigate,Owner\n`;
    const preview = previewOf(first, extra);
    // The prefix rule gives the new row the id D-7. Only B-1 changed since the first import.
    expect(preview.risks.map((risk) => risk.riskId)).toEqual(['A-1', 'B-1', 'C-1', 'D-7']);
    expect(mergeEntities(first, preview).map((entity) => entity.id)).toEqual(['B-1']);
    // A choice for a risk without a change has no effect.
    const choices = importChoices(first, preview, { 'A-1': 'both', 'B-1': 'current' });
    expect(choices).toEqual({ 'A-1': 'current', 'B-1': 'current', 'C-1': 'current' });
    expect(unchangedRisks(first, preview)).toBe(2);
    expect(mergeResultText('t.csv', preview, choices)).toBe('1 risk from t.csv is saved. 1 risk keeps its current version. 2 risks have no change.');
  });

  it('gives no choice and no change log entry when the file has no change', () => {
    const first = commitImport(doc3, previewOf(doc3, CHANGED));
    const again = previewOf(first, CHANGED);
    expect(again.diff).toEqual([]);
    expect(unchangedRisks(first, again)).toBe(3);
    const choices = importChoices(first, again, {});
    expect(choices).toEqual({ 'A-1': 'current', 'B-1': 'current', 'C-1': 'current' });
    const committed = commitImport(first, again, choices);
    expect(committed.risks).toEqual(first.risks);
    expect(committed.changeLog).toEqual(first.changeLog);
    expect(committed.provenance).toHaveLength((first.provenance ?? []).length + 1);
    expect(mergeResultText('table10-newer.csv', again, choices)).toBe('0 risks from table10-newer.csv are saved. 3 risks have no change.');
  });
});

describe('commit with one choice per risk', () => {
  const preview = previewOf(doc3, CHANGED);
  const choices = importChoices(doc3, preview, { 'A-1': 'current', 'B-1': 'incoming', 'C-1': 'both' });
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
    expect(mergeResultText('table10-newer.csv', preview, importChoices(doc3, preview, { 'A-1': 'current', 'B-1': 'current', 'C-1': 'current' }))).toBe(
      '0 risks from table10-newer.csv are saved. 3 risks keep their current version.',
    );
    expect(mergeResultText('table10-newer.csv', preview, importChoices(doc3, preview, { 'A-1': 'current', 'B-1': 'current' }))).toBe('1 risk from table10-newer.csv is saved. 2 risks keep their current version.');
  });
});
