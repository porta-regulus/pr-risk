// IndexedDB storage in Chromium (SPEC.md Sec. 10 item 3, ADR-0004 I5).
import { expect, it } from 'vitest';
import example2 from '../../docs/schema/examples/example-2-sme-quantitative.json';
import type { RiskDocument } from '../../src/schema';
import {
  deleteDocument,
  exportOverdue,
  listDocuments,
  listVersions,
  loadDocument,
  openDb,
  recordExport,
  removeAll,
  restoreLastValid,
  saveDocument,
  storageStatus,
  storedProblem,
  type StoredDocument,
  undo,
  UNDO_VERSIONS,
} from '../../src/storage/db';

const doc = example2 as unknown as RiskDocument;
const withTitle = (title: string): RiskDocument => ({ ...doc, document: { ...doc.document, title } });

it('saves versions, keeps 20 for undo, and undo goes back through all of them', async () => {
  await removeAll();
  const db = await openDb();
  for (let i = 1; i <= 25; i++) await saveDocument(db, withTitle(`Version ${String(i)}`), `2026-10-28T00:00:${String(i).padStart(2, '0')}Z`);
  expect((await loadDocument(db, doc.document.id))?.version).toBe(25);
  const versions = await listVersions(db, doc.document.id);
  expect(versions).toHaveLength(UNDO_VERSIONS);
  expect(versions[0]).toBe(25);
  expect(versions.at(-1)).toBe(6);
  for (let expected = 24; expected >= 6; expected--) {
    const undone = await undo(db, doc.document.id);
    expect(undone?.doc.document.title).toBe(`Version ${String(expected)}`);
    expect(undone?.version).toBe(expected);
  }
  expect(await undo(db, doc.document.id)).toBeUndefined();
  expect((await loadDocument(db, doc.document.id))?.doc.document.title).toBe('Version 6');
  // A save after undo drops the versions after the current one.
  const saved = await saveDocument(db, withTitle('Edit after undo'));
  expect(saved.version).toBe(7);
  expect(await listVersions(db, doc.document.id)).toEqual([7, 6]);
  expect((await undo(db, doc.document.id))?.doc.document.title).toBe('Version 6');
  db.close();
});

it('refuses an invalid document', async () => {
  const db = await openDb();
  const broken = { ...doc, risks: [{ ...doc.risks[0], polarity: 'sideways' }] } as unknown as RiskDocument;
  await expect(saveDocument(db, broken)).rejects.toThrow('not valid');
  db.close();
});

it('records the export date and shows the reminder after 7 days', async () => {
  const db = await openDb();
  await recordExport(db, doc.document.id, '2026-10-20T00:00:00Z');
  const stored = await loadDocument(db, doc.document.id);
  expect(stored?.lastExportOn).toBe('2026-10-20T00:00:00Z');
  expect(exportOverdue(stored ?? {}, new Date('2026-10-26T00:00:00Z'))).toBe(false);
  expect(exportOverdue(stored ?? {}, new Date('2026-10-28T00:00:01Z'))).toBe(true);
  expect(exportOverdue({})).toBe(true);
  await saveDocument(db, withTitle('after export'));
  expect((await loadDocument(db, doc.document.id))?.lastExportOn).toBe('2026-10-20T00:00:00Z');
  db.close();
});

it('lists, deletes and removes everything', async () => {
  const db = await openDb();
  expect((await listDocuments(db)).map((item) => item.id)).toEqual([doc.document.id]);
  await deleteDocument(db, doc.document.id);
  expect(await listDocuments(db)).toEqual([]);
  await saveDocument(db, doc);
  await removeAll(db);
  const fresh = await openDb();
  expect(await listDocuments(fresh)).toEqual([]);
  fresh.close();
  const status = await storageStatus();
  expect(typeof status.persisted).toBe('boolean');
});

// A change outside the app, for example in the developer tools or by a browser extension.
const putRaw = (db: IDBDatabase, record: unknown): Promise<void> =>
  new Promise((resolve, reject) => {
    const tx = db.transaction('documents', 'readwrite');
    tx.objectStore('documents').put(record);
    tx.oncomplete = () => {
      resolve();
    };
    tx.onerror = () => {
      reject(tx.error ?? new Error('put failed'));
    };
  });

it('finds a damaged record and restores the last valid version (CRA Annex I gap F4)', async () => {
  await removeAll();
  const db = await openDb();
  await saveDocument(db, withTitle('Valid 1'), '2026-10-30T00:00:01Z');
  await saveDocument(db, withTitle('Valid 2'), '2026-10-30T00:00:02Z');
  const stored = await loadDocument(db, doc.document.id);
  if (stored === undefined) throw new Error('not saved');
  expect(storedProblem(stored)).toBeUndefined();
  expect(storedProblem({ ...stored, version: Number.NaN })).toBe('The stored record has no valid version number.');
  expect(storedProblem({ ...stored, id: 'another-id' })).toBe('The stored record has the id of another document.');

  await putRaw(db, { ...stored, lastExportOn: '2026-10-29T00:00:00Z', doc: { ...stored.doc, risks: 'none' } });
  const damaged = await loadDocument(db, doc.document.id);
  if (damaged === undefined) throw new Error('not stored');
  expect(storedProblem(damaged)).toMatch(/^Rule .+\. \/risks /);

  const restored = await restoreLastValid(db, doc.document.id, '2026-10-30T00:00:03Z');
  expect(restored?.version).toBe(2);
  expect(restored?.doc.document.title).toBe('Valid 2');
  expect(restored?.lastExportOn).toBe('2026-10-29T00:00:00Z');
  const reloaded = await loadDocument(db, doc.document.id);
  if (reloaded === undefined) throw new Error('not restored');
  expect(storedProblem(reloaded)).toBeUndefined();
  // Undo still works from the restored version.
  expect((await undo(db, doc.document.id))?.doc.document.title).toBe('Valid 1');
  db.close();
});

it('restores nothing when no kept version is valid', async () => {
  await removeAll();
  const db = await openDb();
  const record: StoredDocument = { id: 'doc-without-versions', title: 'Only a damaged copy', version: 1, savedOn: '2026-10-30T00:00:00Z', doc: { ...doc, document: { ...doc.document, id: 'doc-without-versions' } } };
  await putRaw(db, { ...record, doc: { ...record.doc, registers: 7 } });
  expect(await restoreLastValid(db, record.id)).toBeUndefined();
  const still = await loadDocument(db, record.id);
  if (still === undefined) throw new Error('not stored');
  expect(storedProblem(still)).toMatch(/^Rule /);
  db.close();
});
