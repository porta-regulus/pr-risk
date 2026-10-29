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
  saveDocument,
  storageStatus,
  undo,
  UNDO_VERSIONS,
} from '../../src/storage/db';

const doc = example2 as unknown as RiskDocument;
const withTitle = (title: string): RiskDocument => ({ ...doc, document: { ...doc.document, title } });

it('saves versions, keeps 20 for undo, and undoes to the previous one', async () => {
  await removeAll();
  const db = await openDb();
  for (let i = 1; i <= 25; i++) await saveDocument(db, withTitle(`Version ${String(i)}`), `2026-10-28T00:00:${String(i).padStart(2, '0')}Z`);
  expect((await loadDocument(db, doc.document.id))?.version).toBe(25);
  const versions = await listVersions(db, doc.document.id);
  expect(versions).toHaveLength(UNDO_VERSIONS);
  expect(versions[0]).toBe(25);
  expect(versions.at(-1)).toBe(6);
  const undone = await undo(db, doc.document.id);
  expect(undone?.doc.document.title).toBe('Version 24');
  expect(undone?.version).toBe(26);
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
