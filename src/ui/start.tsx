// Screen S1 Start (SPEC.md Sec. 5). Open, create, import, export, storage status,
// last-export date and remove all data. Everything stays in this browser.
import { useEffect, useState } from 'preact/hooks';
import { decrypt, encrypt, isEncryptedFile } from '../export/encryption';
import { exportCsv, exportIr8286, exportNative } from '../export/export';
import { runImport } from '../import/client';
import { commitImport, type ImportPreview } from '../import/pipeline';
import { exportPoam } from '../oscal/poam';
import { lint } from '../schema/rules';
import type { Finding, RiskDocument } from '../schema/types';
import {
  deleteDocument,
  exportOverdue,
  listDocuments,
  openDb,
  recordExport,
  removeAll,
  requestPersistence,
  saveDocument,
  storageStatus,
  type StorageStatus,
  type StoredDocument,
} from '../storage/db';
import type { ScreenName } from './editor';
import { downloadText, newDocument, slug } from './files';

const EXAMPLES = {
  'example-2': { label: 'SME with numbers (example 2)', load: () => import('../../docs/schema/examples/example-2-sme-quantitative.json') },
  'example-1': { label: 'NIST Fig. 10 and Table 9 (example 1)', load: () => import('../../docs/schema/examples/example-1-sp800-221r1-fig10-table9.json') },
  'example-3': { label: 'Table 10 imports (example 3)', load: () => import('../../docs/schema/examples/example-3-imports-table10.json') },
} as const;

const dateText = (iso: string | undefined): string => (iso === undefined ? 'never' : new Date(iso).toLocaleString());
const megabytes = (bytes: number | undefined): string => (bytes === undefined ? 'unknown' : `${(bytes / 1048576).toFixed(1)} MB`);

interface Message {
  readonly kind: 'ok' | 'error';
  readonly text: string;
}

function ErrorList({ errors }: { readonly errors: readonly Finding[] }) {
  if (errors.length === 0) return null;
  return (
    <ul class="errors">
      {errors.slice(0, 8).map((error, i) => (
        <li key={i}>
          {error.rule} {error.message}
        </li>
      ))}
    </ul>
  );
}

export function StartScreen({ selectedId, onOpen }: { readonly selectedId?: string | undefined; readonly onOpen: (id: string, screen: Exclude<ScreenName, 'start'>) => void }) {
  const [db, setDb] = useState<IDBDatabase>();
  const [documents, setDocuments] = useState<StoredDocument[]>([]);
  const [currentId, setCurrentId] = useState<string | undefined>(selectedId);
  const [status, setStatus] = useState<StorageStatus>();
  const [message, setMessage] = useState<Message>();
  const [preview, setPreview] = useState<{ preview: ImportPreview; fileName: string }>();
  const [busy, setBusy] = useState(false);
  const [passphrase, setPassphrase] = useState('');
  const [openPassphrase, setOpenPassphrase] = useState('');
  const [confirmText, setConfirmText] = useState('');
  const [newTitle, setNewTitle] = useState('');
  const [newOrganization, setNewOrganization] = useState('');
  const [newCurrency, setNewCurrency] = useState('EUR');

  const current = documents.find((item) => item.id === currentId) ?? documents[0];

  const refresh = async (database: IDBDatabase, select?: string): Promise<void> => {
    const list = await listDocuments(database);
    setDocuments(list);
    if (select !== undefined) setCurrentId(select);
    setStatus(await storageStatus());
  };

  useEffect(() => {
    void openDb().then(async (database) => {
      setDb(database);
      await refresh(database);
    });
  }, []);

  const report = (kind: Message['kind'], text: string): void => {
    setMessage({ kind, text });
  };

  const store = async (doc: RiskDocument, text: string): Promise<void> => {
    if (db === undefined) return;
    const saved = await saveDocument(db, doc);
    if (!(status?.persisted ?? false)) await requestPersistence();
    await refresh(db, saved.id);
    report('ok', text);
  };

  // Runs one action at a time and shows its error. Event handlers get a plain function.
  const guard = (work: () => Promise<void>) => (): void => {
    setBusy(true);
    work()
      .catch((error: unknown) => {
        report('error', error instanceof Error ? error.message : String(error));
      })
      .finally(() => {
        setBusy(false);
      });
  };

  const loadExample = (key: keyof typeof EXAMPLES) =>
    guard(async () => {
      const module = await EXAMPLES[key].load();
      await store(module.default as unknown as RiskDocument, `${EXAMPLES[key].label} is open.`);
    });

  const create = guard(async () => {
    if (newTitle.trim() === '') throw new Error('Type a title for the new register.');
    if (!/^[A-Z]{3}$/.test(newCurrency)) throw new Error('Type the currency as three capital letters, for example EUR.');
    await store(newDocument(newTitle.trim(), newOrganization.trim(), newCurrency), `"${newTitle.trim()}" is created.`);
    setNewTitle('');
  });

  const onFile = async (event: Event): Promise<void> => {
    const input = event.currentTarget as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (file === undefined) return;
    setBusy(true);
    try {
      let bytes = new Uint8Array(await file.arrayBuffer());
      const text = new TextDecoder().decode(bytes.subarray(0, 64));
      if (text.includes('pr-risk-encrypted')) {
        const value = JSON.parse(new TextDecoder().decode(bytes)) as unknown;
        if (!isEncryptedFile(value)) throw new Error('The encrypted file is damaged.');
        if (openPassphrase === '') throw new Error('The file is encrypted. Type its passphrase, then choose the file again.');
        bytes = new TextEncoder().encode(await decrypt(value, openPassphrase));
      }
      const base = current?.doc ?? newDocument(file.name.replace(/\.[^.]+$/, '') || 'Imported register', '', 'EUR');
      // A document always has at least one register. The first one takes rows without a register column.
      const result = await runImport({ doc: base, file: { fileName: file.name, bytes }, options: { register: base.registers[0] } });
      setPreview({ preview: result, fileName: file.name });
      setMessage(undefined);
    } catch (error) {
      report('error', error instanceof Error ? error.message : String(error));
    } finally {
      setBusy(false);
    }
  };

  const commit = (mode: 'merge' | 'replace') =>
    guard(async () => {
      if (preview === undefined) return;
      // With no open document, a whole document is restored as it is.
      const replace = preview.preview.document !== undefined && (mode === 'replace' || current === undefined);
      const base = replace || current === undefined ? (preview.preview.document ?? newDocument(preview.fileName, '', 'EUR')) : current.doc;
      const doc = commitImport(base, preview.preview, {}, undefined, replace ? 'replace' : 'merge');
      setPreview(undefined);
      await store(doc, `${String(preview.preview.risks.length)} risks from ${preview.fileName} are saved.`);
    });

  const exportAs = (kind: 'native' | 'encrypted' | 'ir8286' | 'csv' | 'oscal') =>
    guard(async () => {
      if (current === undefined || db === undefined) return;
      const doc = current.doc;
      const name = slug(doc.document.title);
      if (kind === 'native') downloadText(`${name}.json`, exportNative(doc), 'application/json');
      if (kind === 'encrypted') downloadText(`${name}.encrypted.json`, JSON.stringify(await encrypt(exportNative(doc), passphrase)), 'application/json');
      if (kind === 'csv') downloadText(`${name}.csv`, exportCsv(doc), 'text/csv');
      if (kind === 'oscal') downloadText(`${name}.oscal-poam.json`, JSON.stringify(exportPoam(doc), null, 1), 'application/json');
      if (kind === 'ir8286') {
        const result = exportIr8286(doc, 'exclude');
        if (!result.ok) throw new Error('errors' in result ? `The NIST export is not valid: ${result.errors[0]?.message ?? ''}` : 'No risk can be exported.');
        downloadText(`${name}.ir8286-register.json`, result.registerEntries, 'application/json');
        downloadText(`${name}.ir8286-rdr.json`, result.riskDetailRecords, 'application/json');
        if (result.riskIds.length < doc.risks.length) report('ok', `${String(doc.risks.length - result.riskIds.length)} risks with placeholder numbers are left out of the NIST export (rule E-02).`);
      }
      await recordExport(db, current.id);
      await refresh(db, current.id);
      if (kind !== 'ir8286') report('ok', 'The file is saved to your downloads.');
    });

  const remove = (id: string) =>
    guard(async () => {
      if (db === undefined) return;
      await deleteDocument(db, id);
      await refresh(db);
      report('ok', 'The document is deleted from this browser.');
    });

  const removeEverything = guard(async () => {
    if (confirmText !== 'REMOVE') throw new Error('Type REMOVE to confirm.');
    await removeAll(db);
    setDocuments([]);
    setDb(await openDb());
    setConfirmText('');
    report('ok', 'All data is removed from this browser.');
  });

  const warnings = current === undefined ? 0 : lint(current.doc).length;
  // With no open document, a whole document file is restored on its own (no merge).
  const restoreOnly = current === undefined && preview?.preview.document !== undefined;
  const restoreErrors = preview?.preview.documentErrors?.length ?? 0;

  return (
    <main class="screen">
      <header class="screen-head">
        <h1>PortaRegulus Risk</h1>
        <p class="lede">A free risk register for the risk components of NIST SP 800-221r1. Your data stays in this browser. The app sends no data to a server.</p>
      </header>

      {current !== undefined && exportOverdue(current) && (
        <p class="banner" role="status">
          {current.lastExportOn === undefined ? 'You have not saved a copy of this document yet.' : 'Your last copy is more than 7 days old.'} Browsers can delete stored data. Export a copy now.
        </p>
      )}
      {message !== undefined && (
        <p class={`message message-${message.kind}`} role={message.kind === 'error' ? 'alert' : 'status'}>
          {message.text}
        </p>
      )}

      <section aria-labelledby="docs-title" class="panel">
        <h2 id="docs-title">Your documents</h2>
        {documents.length === 0 ? (
          <p class="muted">No document is stored in this browser. Create one, open an example, or import a file.</p>
        ) : (
          <div class="table-box">
            <table>
              <thead>
                <tr>
                  <th scope="col">Document</th>
                  <th scope="col">Saved</th>
                  <th scope="col">Last export</th>
                  <th scope="col">Actions</th>
                </tr>
              </thead>
              <tbody>
                {documents.map((item) => (
                  <tr key={item.id} aria-current={item.id === current?.id ? 'true' : undefined}>
                    <td>
                      <strong>{item.title}</strong>
                      <span class="sub">
                        {item.doc.registers.length} registers, {item.doc.risks.length} risks, version {item.version}
                      </span>
                    </td>
                    <td>{dateText(item.savedOn)}</td>
                    <td>{dateText(item.lastExportOn)}</td>
                    <td class="actions">
                      <button type="button" onClick={() => {
                        setCurrentId(item.id);
                      }} disabled={item.id === current?.id}>
                        {item.id === current?.id ? 'Selected' : 'Select'}
                      </button>
                      <button type="button" class="quiet" onClick={remove(item.id)} disabled={busy}>
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {current !== undefined && (
          <>
            <p class="muted">
              Selected: <strong>{current.title}</strong>. Lint shows {warnings} {warnings === 1 ? 'warning' : 'warnings'}. Screens S6 and S7 come in the next build tasks.
            </p>
            <div class="button-row">
              <button type="button" onClick={() => {
                  onOpen(current.id, 'context');
                }} disabled={busy}>
                Context and strategy
              </button>
              <button type="button" onClick={() => {
                  onOpen(current.id, 'identify');
                }} disabled={busy}>
                Identify and analyze
              </button>
              <button type="button" onClick={() => {
                  onOpen(current.id, 'prioritize');
                }} disabled={busy}>
                Prioritize
              </button>
              <button type="button" onClick={() => {
                  onOpen(current.id, 'respond');
                }} disabled={busy}>
                Respond and optimize
              </button>
            </div>
          </>
        )}
      </section>

      <div class="grid">
        <section aria-labelledby="create-title" class="panel">
          <h2 id="create-title">Create a document</h2>
          <label for="new-title">Title</label>
          <input id="new-title" value={newTitle} onInput={(event) => {
            setNewTitle(event.currentTarget.value);
          }} />
          <label for="new-organization">Organization</label>
          <input id="new-organization" value={newOrganization} onInput={(event) => {
            setNewOrganization(event.currentTarget.value);
          }} />
          <label for="new-currency">Currency</label>
          <input id="new-currency" value={newCurrency} maxLength={3} onInput={(event) => {
            setNewCurrency(event.currentTarget.value.toUpperCase());
          }} />
          <button type="button" onClick={create} disabled={busy}>
            Create
          </button>
          <h3>Or open an example</h3>
          <div class="button-row">
            {(Object.keys(EXAMPLES) as (keyof typeof EXAMPLES)[]).map((key) => (
              <button type="button" class="quiet" key={key} onClick={loadExample(key)} disabled={busy}>
                {EXAMPLES[key].label}
              </button>
            ))}
          </div>
        </section>

        <section aria-labelledby="import-title" class="panel">
          <h2 id="import-title">Import a file</h2>
          <p class="muted">CSV, XLSX, NIST IR 8286 JSON, OSCAL POA&amp;M, a CVD Portal export, or a file from this app. The import shows a preview first.</p>
          <label for="open-passphrase">Passphrase, only for an encrypted file</label>
          <input id="open-passphrase" type="password" autoComplete="current-password" value={openPassphrase} onInput={(event) => {
              setOpenPassphrase(event.currentTarget.value);
            }} />
          <label for="import-file">File</label>
          <input id="import-file" type="file" accept=".csv,.tsv,.txt,.xlsx,.json" onChange={(event) => {
              void onFile(event);
            }} disabled={busy} />
          {preview !== undefined && (
            <div class="preview" aria-live="polite">
              <h3>Preview of {preview.fileName}</h3>
              <p>
                Format {preview.preview.format}. {preview.preview.risks.length} risks, {preview.preview.registers.length} new registers, {preview.preview.diff.length} changed fields.
              </p>
              {restoreOnly ? (
                <ErrorList errors={preview.preview.documentErrors ?? []} />
              ) : (
                <>
                  <ErrorList errors={preview.preview.errors} />
                  {(preview.preview.documentErrors ?? []).length > 0 && <p>The file cannot open as its own document.</p>}
                  <ErrorList errors={preview.preview.documentErrors ?? []} />
                </>
              )}
              {preview.preview.warnings.length > 0 && (
                <ul class="warnings">
                  {preview.preview.warnings.slice(0, 8).map((warning, i) => (
                    <li key={i}>{warning}</li>
                  ))}
                </ul>
              )}
              <div class="button-row">
                <button type="button" onClick={commit('merge')} disabled={busy || (restoreOnly ? restoreErrors : preview.preview.errors.length) > 0}>
                  {current === undefined ? 'Save as a new document' : `Add to ${current.title}`}
                </button>
                {preview.preview.document !== undefined && current !== undefined && (
                  <button type="button" class="quiet" onClick={commit('replace')} disabled={busy || restoreErrors > 0}>
                    Open as its own document
                  </button>
                )}
                <button type="button" class="quiet" onClick={() => {
                        setPreview(undefined);
                      }}>
                  Cancel
                </button>
              </div>
            </div>
          )}
        </section>

        <section aria-labelledby="export-title" class="panel">
          <h2 id="export-title">Export</h2>
          {current === undefined ? (
            <p class="muted">Select a document first.</p>
          ) : (
            <>
              <p class="muted">Files go to your downloads. Keep a copy, because browsers can delete stored data.</p>
              <div class="button-row">
                <button type="button" onClick={exportAs('native')} disabled={busy}>
                  App file (JSON)
                </button>
                <button type="button" class="quiet" onClick={exportAs('ir8286')} disabled={busy}>
                  NIST IR 8286 JSON
                </button>
                <button type="button" class="quiet" onClick={exportAs('csv')} disabled={busy}>
                  CSV
                </button>
                <button type="button" class="quiet" onClick={exportAs('oscal')} disabled={busy}>
                  OSCAL POA&amp;M
                </button>
              </div>
              <label for="passphrase">Passphrase for an encrypted copy (12 characters or more)</label>
              <input id="passphrase" type="password" autoComplete="new-password" value={passphrase} onInput={(event) => {
            setPassphrase(event.currentTarget.value);
          }} />
              <button type="button" class="quiet" onClick={exportAs('encrypted')} disabled={busy || passphrase.length < 12}>
                Encrypted copy
              </button>
            </>
          )}
        </section>

        <section aria-labelledby="storage-title" class="panel">
          <h2 id="storage-title">Storage in this browser</h2>
          <p>
            {status?.persisted === true ? 'The browser keeps this data.' : 'The browser can delete this data when space is low or after 7 days without a visit (Safari).'} Used{' '}
            {megabytes(status?.usage)}.
          </p>
          <label for="remove-confirm">Type REMOVE to delete every document, cache and the offline copy from this browser</label>
          <input id="remove-confirm" value={confirmText} onInput={(event) => {
            setConfirmText(event.currentTarget.value);
          }} />
          <button type="button" class="danger" onClick={removeEverything} disabled={busy || confirmText !== 'REMOVE'}>
            Remove all data from this browser
          </button>
        </section>
      </div>

      <footer class="screen-foot">
        <p>
          Version {__APP_VERSION__}, build {__GIT_SHA__.slice(0, 12)}. Apache-2.0.
        </p>
      </footer>
    </main>
  );
}
