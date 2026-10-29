// IndexedDB storage (ADR-0004 decision 1, SPEC.md Sec. 10 item 3). The working copy of
// every document stays in this browser. Autosave keeps 20 versions for undo.
import { documentErrors } from '../schema/document';
import type { RiskDocument } from '../schema/types';

const DB_NAME = 'pr-risk';
const DB_VERSION = 1;
export const UNDO_VERSIONS = 20;
export const EXPORT_REMINDER_DAYS = 7;

export interface StoredDocument {
  readonly id: string;
  readonly title: string;
  // The kept version that doc is. After an undo it is lower than the newest kept version.
  readonly version: number;
  readonly savedOn: string;
  readonly lastExportOn?: string;
  readonly doc: RiskDocument;
}

interface VersionRecord {
  readonly key: string;
  readonly id: string;
  readonly version: number;
  readonly doc: RiskDocument;
}

const request = <T>(req: IDBRequest<T>): Promise<T> =>
  new Promise((resolve, reject) => {
    req.onsuccess = () => {
      resolve(req.result);
    };
    req.onerror = () => {
      reject(req.error ?? new Error('IndexedDB request failed'));
    };
  });

const done = (tx: IDBTransaction): Promise<void> =>
  new Promise((resolve, reject) => {
    tx.oncomplete = () => {
      resolve();
    };
    tx.onerror = () => {
      reject(tx.error ?? new Error('IndexedDB transaction failed'));
    };
    tx.onabort = () => {
      reject(tx.error ?? new Error('IndexedDB transaction aborted'));
    };
  });

export function openDb(): Promise<IDBDatabase> {
  const req = indexedDB.open(DB_NAME, DB_VERSION);
  req.onupgradeneeded = () => {
    const db = req.result;
    if (!db.objectStoreNames.contains('documents')) db.createObjectStore('documents', { keyPath: 'id' });
    if (!db.objectStoreNames.contains('versions')) db.createObjectStore('versions', { keyPath: 'key' }).createIndex('byDocument', 'id');
  };
  return request(req).then((db) => {
    // A delete of the database (remove all) must not wait for this connection.
    db.onversionchange = () => {
      db.close();
    };
    return db;
  });
}

const versionKey = (id: string, version: number): string => `${id}\u0000${String(version).padStart(10, '0')}`;

// Saves a valid document as a new version and keeps the last 20 versions. A save after an
// undo removes the versions after the current one, as in an editor.
export async function saveDocument(db: IDBDatabase, doc: RiskDocument, now = new Date().toISOString()): Promise<StoredDocument> {
  const errors = documentErrors(doc);
  if (errors.length > 0) throw new Error(`The document is not valid: ${errors[0]?.message ?? ''}`);
  const tx = db.transaction(['documents', 'versions'], 'readwrite');
  const documents = tx.objectStore('documents');
  const versions = tx.objectStore('versions');
  const previous = (await request(documents.get(doc.document.id))) as StoredDocument | undefined;
  const stored: StoredDocument = {
    id: doc.document.id,
    title: doc.document.title,
    version: (previous?.version ?? 0) + 1,
    savedOn: now,
    ...(previous?.lastExportOn === undefined ? {} : { lastExportOn: previous.lastExportOn }),
    doc,
  };
  documents.put(stored);
  versions.put({ key: versionKey(stored.id, stored.version), id: stored.id, version: stored.version, doc } satisfies VersionRecord);
  versions.delete(IDBKeyRange.lowerBound(versionKey(stored.id, stored.version), true));
  const oldest = stored.version - UNDO_VERSIONS;
  if (oldest >= 1) versions.delete(IDBKeyRange.bound(versionKey(stored.id, 0), versionKey(stored.id, oldest)));
  await done(tx);
  return stored;
}

export async function loadDocument(db: IDBDatabase, id: string): Promise<StoredDocument | undefined> {
  return (await request(db.transaction('documents').objectStore('documents').get(id))) as StoredDocument | undefined;
}

export async function listDocuments(db: IDBDatabase): Promise<StoredDocument[]> {
  const all = (await request(db.transaction('documents').objectStore('documents').getAll())) as StoredDocument[];
  return all.sort((a, b) => (a.savedOn < b.savedOn ? 1 : -1));
}

// The versions kept for undo, newest first.
export async function listVersions(db: IDBDatabase, id: string): Promise<number[]> {
  const records = (await request(db.transaction('versions').objectStore('versions').index('byDocument').getAll(id))) as VersionRecord[];
  return records.map((record) => record.version).sort((a, b) => b - a);
}

// Undo makes the previous kept version current. It writes no new version, so repeated undo
// goes back through all 20 kept versions.
export async function undo(db: IDBDatabase, id: string, now = new Date().toISOString()): Promise<StoredDocument | undefined> {
  const tx = db.transaction(['documents', 'versions'], 'readwrite');
  const documents = tx.objectStore('documents');
  const current = (await request(documents.get(id))) as StoredDocument | undefined;
  const previous = current === undefined ? undefined : ((await request(tx.objectStore('versions').get(versionKey(id, current.version - 1)))) as VersionRecord | undefined);
  let stored: StoredDocument | undefined;
  if (current !== undefined && previous !== undefined) {
    stored = { ...current, title: previous.doc.document.title, version: previous.version, savedOn: now, doc: previous.doc };
    documents.put(stored);
  }
  await done(tx);
  return stored;
}

export async function recordExport(db: IDBDatabase, id: string, now = new Date().toISOString()): Promise<void> {
  const tx = db.transaction('documents', 'readwrite');
  const store = tx.objectStore('documents');
  const current = (await request(store.get(id))) as StoredDocument | undefined;
  if (current !== undefined) store.put({ ...current, lastExportOn: now });
  await done(tx);
}

export async function deleteDocument(db: IDBDatabase, id: string): Promise<void> {
  const tx = db.transaction(['documents', 'versions'], 'readwrite');
  tx.objectStore('documents').delete(id);
  tx.objectStore('versions').delete(IDBKeyRange.bound(versionKey(id, 0), versionKey(id, Number.MAX_SAFE_INTEGER)));
  await done(tx);
}

// True when the export reminder banner shows: never exported, or longer ago than 7 days.
export function exportOverdue(stored: Pick<StoredDocument, 'lastExportOn'>, now = new Date()): boolean {
  if (stored.lastExportOn === undefined) return true;
  return now.getTime() - new Date(stored.lastExportOn).getTime() > EXPORT_REMINDER_DAYS * 86_400_000;
}

export interface StorageStatus {
  readonly persisted: boolean;
  readonly usage?: number;
  readonly quota?: number;
}

// navigator.storage is missing in some browsers and in insecure contexts.
const storageManager = (): Partial<StorageManager> | undefined => ('storage' in navigator ? navigator.storage : undefined);

export async function storageStatus(): Promise<StorageStatus> {
  const manager = storageManager();
  const persisted = typeof manager?.persisted === 'function' ? await manager.persisted() : false;
  const estimate = typeof manager?.estimate === 'function' ? await manager.estimate() : undefined;
  return { persisted, ...(estimate?.usage === undefined ? {} : { usage: estimate.usage }), ...(estimate?.quota === undefined ? {} : { quota: estimate.quota }) };
}

// Asks the browser to keep the data (WebKit removes it after 7 days without a visit otherwise).
export async function requestPersistence(): Promise<boolean> {
  const manager = storageManager();
  return typeof manager?.persist === 'function' ? manager.persist() : false;
}

// "Remove all data from this browser" (ADR-0004 I5). IndexedDB, caches and the service worker.
export async function removeAll(db?: IDBDatabase): Promise<void> {
  db?.close();
  await new Promise<void>((resolve, reject) => {
    const req = indexedDB.deleteDatabase(DB_NAME);
    req.onsuccess = () => {
      resolve();
    };
    req.onerror = () => {
      reject(req.error ?? new Error('The database could not be deleted'));
    };
    req.onblocked = () => {
      resolve();
    };
  });
  if ('caches' in globalThis) for (const name of await caches.keys()) await caches.delete(name);
  if ('serviceWorker' in navigator) for (const registration of await navigator.serviceWorker.getRegistrations()) await registration.unregister();
  try {
    localStorage.clear();
  } catch {
    // Storage can be blocked. Nothing to remove then.
  }
}
