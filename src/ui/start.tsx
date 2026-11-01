// Screen S1 Start (SPEC.md Sec. 5). Open, create, import, export, storage status,
// last-export date and remove all data. Everything stays in this browser.
import { Fragment } from 'preact';
import { useEffect, useMemo, useState } from 'preact/hooks';
import { decrypt, encrypt, isEncryptedFile } from '../export/encryption';
import { exportCsv, exportIr8286, exportNative } from '../export/export';
import { runImport } from '../import/client';
import { commitImport, type Choice, type DiffEntry, type ImportChoices, type ImportPreview } from '../import/pipeline';
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
  restoreLastValid,
  saveDocument,
  storageStatus,
  storedProblem,
  type StorageStatus,
  type StoredDocument,
} from '../storage/db';
import type { ScreenName } from './editor';
import { downloadText, newDocument, slug } from './files';
import { CHOICE_TEXT, choicesOf, fieldParts, importChoices, mergeEntities, mergeResultText, unchangedRisks, type MergeEntity } from './merge';

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

// An import preview and the stored document version that its diff and errors were made against.
interface Pending {
  readonly preview: ImportPreview;
  readonly fileName: string;
  readonly targetId: string | undefined;
  readonly targetVersion: number | undefined;
}

// The diff is valid only for the document version it was made against (Sec. 9.7).
const isStale = (pending: Pending, target: StoredDocument | undefined): boolean => pending.targetId !== target?.id || pending.targetVersion !== target?.version;
const STALE_TEXT = 'The selected document changed, so the preview is closed. Choose the file again.';

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

// Sec. 9.7. One block per entity of the open document that the file changes, with the
// fields side by side. A risk gets the choice of keep current, take incoming or keep both. A
// register gets keep current or take incoming.
function MergeChoices({
  title,
  entities,
  same,
  partial,
  choices,
  onChoose,
}: {
  readonly title: string;
  readonly entities: readonly MergeEntity[];
  readonly same: number;
  readonly partial: boolean;
  readonly choices: ImportChoices;
  readonly onChoose: (kind: DiffEntry['kind'], id: string, choice: Choice) => void;
}) {
  const risks = entities.filter((entity) => entity.kind === 'risk');
  const registers = entities.filter((entity) => entity.kind === 'register');
  if (entities.length === 0 && same === 0) return null;
  return (
    <section class="merge" aria-labelledby="merge-title">
      <h4 id="merge-title">Ids that {title} already uses</h4>
      {risks.length > 0 && (
        <p class="hint">
          {risks.length} {risks.length === 1 ? 'risk has' : 'risks have'} other values in the file. Choose what to keep for each risk. Keep both adds the incoming risk with a new id.
        </p>
      )}
      {same > 0 && (
        <p class="hint">
          {same} {same === 1 ? 'risk is' : 'risks are'} the same in the file and stay as they are.
        </p>
      )}
      {partial && risks.length > 0 && (
        <p class="hint">The file holds only some fields of a risk. Take incoming and keep both change only the fields that the file holds. All other fields keep their current values.</p>
      )}
      {registers.length > 0 && (
        <p class="hint">
          {registers.length} {registers.length === 1 ? 'register has' : 'registers have'} other values in the file. A register has no keep both, because its risks use its id.
        </p>
      )}
      {entities.map((entity) => {
        const label = `${entity.kind === 'risk' ? 'Risk' : 'Register'} ${entity.id}`;
        const table = (
          <div class="table-box merge-diff" tabIndex={0} role="region" aria-label={`Changed fields of ${label}`}>
            <table>
              <thead>
                <tr>
                  <th scope="col">Field</th>
                  <th scope="col">Current</th>
                  <th scope="col">Incoming</th>
                </tr>
              </thead>
              <tbody>
                {entity.rows.map((row) => (
                  <tr key={row.field}>
                    <th scope="row">
                      {fieldParts(row.field).map((part, i) => (
                        <Fragment key={i}>
                          {i > 0 && <wbr />}
                          {part}
                        </Fragment>
                      ))}
                    </th>
                    <td>{row.current}</td>
                    <td>{row.incoming}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
        const choice = (entity.kind === 'risk' ? choices.risks?.[entity.id] : choices.registers?.[entity.id]) ?? 'incoming';
        return (
          <fieldset class="merge-entity" key={`${entity.kind} ${entity.id}`}>
            <legend>{label}</legend>
            <p class="sub">{entity.title}</p>
            {table}
            <div class="merge-options">
              {choicesOf(entity.kind).map((option) => (
                <label key={option} class="check">
                  <input
                    type="radio"
                    name={`merge-${entity.kind}-${entity.id}`}
                    value={option}
                    checked={choice === option}
                    onChange={() => {
                      onChoose(entity.kind, entity.id, option);
                    }}
                  />
                  {CHOICE_TEXT[option]}
                </label>
              ))}
            </div>
          </fieldset>
        );
      })}
    </section>
  );
}

export function StartScreen({ selectedId, onOpen }: { readonly selectedId?: string | undefined; readonly onOpen: (id: string, screen: Exclude<ScreenName, 'start'>) => void }) {
  const [db, setDb] = useState<IDBDatabase>();
  const [documents, setDocuments] = useState<StoredDocument[]>([]);
  const [currentId, setCurrentId] = useState<string | undefined>(selectedId);
  const [status, setStatus] = useState<StorageStatus>();
  const [message, setMessage] = useState<Message>();
  const [preview, setPreview] = useState<Pending>();
  // The merge choice per matched risk and register (Sec. 9.7). An id that is not here takes incoming.
  const [choices, setChoices] = useState<ImportChoices>({});
  const [busy, setBusy] = useState(false);
  const [passphrase, setPassphrase] = useState('');
  const [openPassphrase, setOpenPassphrase] = useState('');
  const [confirmText, setConfirmText] = useState('');
  const [newTitle, setNewTitle] = useState('');
  const [newOrganization, setNewOrganization] = useState('');
  const [newCurrency, setNewCurrency] = useState('EUR');

  const current = documents.find((item) => item.id === currentId) ?? documents[0];
  // A damaged record is shown, but not opened, merged into or exported (gap F4).
  const problems = useMemo(() => new Map(documents.map((item) => [item.id, storedProblem(item)])), [documents]);
  const damaged = current === undefined ? undefined : problems.get(current.id);
  // With no selected document, or a damaged one, an import starts from a new document and never merges.
  const fresh = current === undefined || damaged !== undefined;

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

  // A preview made against another document, or another version of it, must not be committed.
  useEffect(() => {
    if (preview === undefined || !isStale(preview, current)) return;
    setPreview(undefined);
    setChoices({});
    report('ok', STALE_TEXT);
  }, [current?.id, current?.version, preview]);

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
      const base = current === undefined || fresh ? newDocument(file.name.replace(/\.[^.]+$/, '') || 'Imported register', '', 'EUR') : current.doc;
      // A document always has at least one register. The first one takes rows without a register column.
      const result = await runImport({ doc: base, file: { fileName: file.name, bytes }, options: { register: base.registers[0] } });
      setPreview({ preview: result, fileName: file.name, targetId: current?.id, targetVersion: current?.version });
      setChoices({});
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
      if (isStale(preview, current)) throw new Error(STALE_TEXT);
      // With no open document, a whole document is restored as it is.
      const replace = preview.preview.document !== undefined && (mode === 'replace' || fresh);
      const base = replace || current === undefined || fresh ? (preview.preview.document ?? newDocument(preview.fileName, '', 'EUR')) : current.doc;
      const chosen = replace ? {} : importChoices(base, preview.preview, choices);
      const doc = commitImport(base, preview.preview, chosen, undefined, replace ? 'replace' : 'merge');
      setPreview(undefined);
      setChoices({});
      await store(doc, replace ? `${String(preview.preview.risks.length)} risks from ${preview.fileName} are saved.` : mergeResultText(preview.fileName, preview.preview, chosen));
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

  const restoreValid = guard(async () => {
    if (current === undefined || db === undefined) return;
    const restored = await restoreLastValid(db, current.id);
    await refresh(db, current.id);
    if (restored === undefined) throw new Error('No kept version of this document is valid. Import a saved copy, or delete the document.');
    report('ok', `Version ${String(restored.version)} is restored. It is the last valid version.`);
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

  const warnings = current === undefined || damaged !== undefined ? 0 : lint(current.doc).length;
  // With no open document, a whole document file is restored on its own (no merge).
  const restoreOnly = fresh && preview?.preview.document !== undefined;
  const restoreErrors = preview?.preview.documentErrors?.length ?? 0;
  const entities = current === undefined || damaged !== undefined || preview === undefined ? [] : mergeEntities(current.doc, preview.preview);
  const same = current === undefined || damaged !== undefined || preview === undefined ? 0 : unchangedRisks(current.doc, preview.preview);

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
                        {problems.get(item.id) === undefined ? `${String(item.doc.registers.length)} registers, ${String(item.doc.risks.length)} risks, version ${String(item.version)}` : 'The stored copy is damaged.'}
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
        {current !== undefined && damaged !== undefined && (
          <>
            <p class="message message-error" role="alert">
              The stored copy of {current.title} is damaged. {damaged} The app does not open or export it.
            </p>
            <div class="button-row">
              <button type="button" onClick={restoreValid} disabled={busy}>
                Restore the last valid version
              </button>
            </div>
          </>
        )}
        {current !== undefined && damaged === undefined && (
          <>
            <p class="muted">
              Selected: <strong>{current.title}</strong>. Lint shows {warnings} {warnings === 1 ? 'warning' : 'warnings'}.
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
              <button type="button" onClick={() => {
                  onOpen(current.id, 'monitor');
                }} disabled={busy}>
                Monitor and adjust
              </button>
              <button type="button" onClick={() => {
                  onOpen(current.id, 'enterprise');
                }} disabled={busy}>
                Enterprise view
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
              {!fresh && (
                <MergeChoices
                  title={current.title}
                  entities={entities}
                  same={same}
                  partial={preview.preview.partial === true}
                  choices={choices}
                  onChoose={(kind, id, choice) => {
                    setChoices((old) =>
                      kind === 'risk' ? { ...old, risks: { ...old.risks, [id]: choice } } : { ...old, registers: { ...old.registers, [id]: choice === 'both' ? 'incoming' : choice } },
                    );
                  }}
                />
              )}
              <div class="button-row">
                <button type="button" onClick={commit('merge')} disabled={busy || (restoreOnly ? restoreErrors : preview.preview.errors.length) > 0}>
                  {current === undefined ? 'Save as a new document' : fresh ? 'Save the file as a document' : `Add to ${current.title}`}
                </button>
                {preview.preview.document !== undefined && !fresh && (
                  <button type="button" class="quiet" onClick={commit('replace')} disabled={busy || restoreErrors > 0}>
                    Open as its own document
                  </button>
                )}
                <button type="button" class="quiet" onClick={() => {
                        setPreview(undefined);
                        setChoices({});
                      }}>
                  Cancel
                </button>
              </div>
            </div>
          )}
        </section>

        <section aria-labelledby="export-title" class="panel">
          <h2 id="export-title">Export</h2>
          {current === undefined || damaged !== undefined ? (
            <p class="muted">{current === undefined ? 'Select a document first.' : 'Restore a valid version of the selected document first.'}</p>
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
          {/* ADR-0004 decision 5 and threat I1 (docs/release/annex-i-self-check.md, gaps F1 and F2). */}
          <p>The app does not encrypt the data in this browser. Turn on the disk encryption of this computer, for example BitLocker or FileVault.</p>
          <p>A browser extension that can read all sites can also read this page. For a sensitive register, use a browser profile with no extensions.</p>
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
