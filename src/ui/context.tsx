// Screen S2 Context and strategy (SPEC.md Sec. 5, 6.4 to 6.6). A valid change is saved in
// this browser after a short pause, with one change log entry per section (Sec. 6.18).
// An invalid change shows its errors and is not saved.
import { useEffect, useState } from 'preact/hooks';
import { documentErrors } from '../schema/document';
import type { Finding, RiskDocument } from '../schema/types';
import { exportOverdue, loadDocument, openDb, saveDocument, type StoredDocument, undo } from '../storage/db';
import { AppetiteSection } from './appetite';
import { changedSections, nextId, withChangeLog, withSection, withValue } from './edit';
import { Checkboxes, LinesField, SelectField, TextField } from './fields';
import { StrategySection } from './strategy';

type Context = NonNullable<RiskDocument['context']>;
type Objective = NonNullable<Context['objectives']>[number];
type BusinessFunction = NonNullable<Context['functions']>[number];
type Role = NonNullable<NonNullable<RiskDocument['governance']>['roles']>[number];
type Update = (change: (doc: RiskDocument) => RiskDocument) => void;

const SAVE_DELAY_MS = 600;

// Sec. 1.1 and 6 of SP 800-221r1 name these disciplines.
const DISCIPLINES = [
  ['cybersecurity', 'Cybersecurity'],
  ['privacy', 'Privacy'],
  ['supply chain', 'Supply chain'],
  ['OT', 'Operational technology (OT)'],
  ['IoT', 'Internet of Things (IoT)'],
  ['AI', 'Artificial intelligence (AI)'],
] as const;
const KNOWN_DISCIPLINES: readonly string[] = DISCIPLINES.map(([key]) => key);

const OBJECTIVE_KINDS: readonly (readonly [Objective['kind'], string])[] = [
  ['strategic', 'Strategic'],
  ['operations', 'Operations'],
  ['reporting', 'Reporting'],
  ['compliance', 'Compliance'],
];
const ROLE_LEVELS: readonly (readonly [Role['level'], string])[] = [
  ['enterprise-oversight', 'Enterprise oversight'],
  ['enterprise-governance', 'Enterprise governance'],
  ['enterprise-management', 'Enterprise management'],
  ['organization', 'Organization'],
  ['system', 'System'],
];

const replaceAt = <T,>(items: readonly T[], index: number, item: T | undefined): T[] =>
  item === undefined ? items.filter((_, i) => i !== index) : items.map((old, i) => (i === index ? item : old));

const isoSeconds = (date = new Date()): string => date.toISOString().replace(/\.\d{3}Z$/, 'Z');

function ContextSection({ doc, update }: { readonly doc: RiskDocument; readonly update: Update }) {
  const context: Context = doc.context ?? {};
  const set = <K extends keyof Context>(key: K, value: Context[K] | undefined): void => {
    update((current) => withSection(current, 'context', withValue(current.context, key, value)));
  };
  const objectives = context.objectives ?? [];
  const functions = context.functions ?? [];
  const disciplines = context.disciplines ?? [];
  const objectiveUse = (id: string): number => doc.risks.filter((risk) => (risk.objectiveIds ?? []).includes(id)).length;
  const functionUse = (id: string): number => (doc.assets ?? []).filter((asset) => (asset.supportsFunctionIds ?? []).includes(id)).length;

  return (
    <section aria-labelledby="context-title" class="panel">
      <h2 id="context-title">Context</h2>
      <TextField id="mission" label="Mission" multiline value={context.mission} onChange={(value) => {
          set('mission', value);
        }} />
      <div class="grid">
        <div class="field">
          <TextField id="external-context" label="External context" multiline value={context.externalContext} onChange={(value) => {
              set('externalContext', value);
            }} />
        </div>
        <div class="field">
          <TextField id="internal-context" label="Internal context" multiline value={context.internalContext} onChange={(value) => {
              set('internalContext', value);
            }} />
        </div>
      </div>
      <LinesField id="stakeholders" label="Stakeholders, one per line" value={context.stakeholders ?? []} onChange={(value) => {
          set('stakeholders', value);
        }} />
      <Checkboxes legend="ICT risk disciplines in scope" name="disciplines" options={DISCIPLINES} value={disciplines} onChange={(value) => {
          set('disciplines', [...value, ...disciplines.filter((item) => !KNOWN_DISCIPLINES.includes(item))]);
        }} />
      <LinesField
        id="other-disciplines"
        label="Other disciplines, one per line"
        value={disciplines.filter((item) => !KNOWN_DISCIPLINES.includes(item))}
        onChange={(value) => {
          set('disciplines', [...disciplines.filter((item) => KNOWN_DISCIPLINES.includes(item)), ...value.filter((item) => !KNOWN_DISCIPLINES.includes(item))]);
        }}
      />

      <h3 id="objectives-title">Objectives</h3>
      <p class="muted">The four kinds of the enterprise risk profile (Sec. 2.3). Risks refer to objectives by ID.</p>
      {objectives.length > 0 && (
        <div class="table-box">
          <table aria-labelledby="objectives-title">
            <thead>
              <tr>
                <th scope="col">ID</th>
                <th scope="col">Kind</th>
                <th scope="col">Statement</th>
                <th scope="col">Risks</th>
                <th scope="col">
                  <span class="visually-hidden">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {objectives.map((objective, i) => {
                const used = objectiveUse(objective.id);
                const row = `Objective ${String(i + 1)}`;
                return (
                  <tr key={i}>
                    <td>
                      {used > 0 ? (
                        objective.id
                      ) : (
                        <TextField id={`objective-${String(i)}-id`} label={`${row} ID`} hiddenLabel value={objective.id} onChange={(value) => {
                            set('objectives', replaceAt(objectives, i, { ...objective, id: value }));
                          }} />
                      )}
                    </td>
                    <td>
                      <SelectField id={`objective-${String(i)}-kind`} label={`${row} kind`} hiddenLabel value={objective.kind} options={OBJECTIVE_KINDS} onChange={(kind) => {
                          set('objectives', replaceAt(objectives, i, { ...objective, kind: kind ?? 'strategic' }));
                        }} />
                    </td>
                    <td>
                      <TextField id={`objective-${String(i)}-statement`} label={`${row} statement`} hiddenLabel value={objective.statement} onChange={(statement) => {
                          set('objectives', replaceAt(objectives, i, { ...objective, statement }));
                        }} />
                    </td>
                    <td>{used}</td>
                    <td>
                      <button type="button" class="quiet" aria-label={`Remove ${row}`} disabled={used > 0} title={used > 0 ? 'Risks refer to this objective.' : undefined} onClick={() => {
                          set('objectives', replaceAt(objectives, i, undefined));
                        }}>
                        Remove
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      <button type="button" class="quiet" onClick={() => {
          set('objectives', [...objectives, { id: nextId('OBJ-', objectives.map((item) => item.id)), kind: 'strategic', statement: '' }]);
        }}>
        Add an objective
      </button>

      <h3 id="functions-title">Mission- and business-critical functions</h3>
      <p class="muted">Assets inherit the highest criticality of the functions they support (Sec. 5.1.1).</p>
      {functions.length > 0 && (
        <div class="table-box">
          <table aria-labelledby="functions-title">
            <thead>
              <tr>
                <th scope="col">ID</th>
                <th scope="col">Function</th>
                <th scope="col">Criticality</th>
                <th scope="col">Assets</th>
                <th scope="col">
                  <span class="visually-hidden">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {functions.map((item, i) => {
                const used = functionUse(item.id);
                const row = `Function ${String(i + 1)}`;
                const put = (next: BusinessFunction): void => {
                  set('functions', replaceAt(functions, i, next));
                };
                return (
                  <tr key={i}>
                    <td>
                      {used > 0 ? (
                        item.id
                      ) : (
                        <TextField id={`function-${String(i)}-id`} label={`${row} ID`} hiddenLabel value={item.id} onChange={(value) => {
                            put({ ...item, id: value });
                          }} />
                      )}
                    </td>
                    <td>
                      <TextField id={`function-${String(i)}-name`} label={`${row} name`} hiddenLabel value={item.name} onChange={(name) => {
                          put({ ...item, name });
                        }} />
                    </td>
                    <td>
                      <TextField id={`function-${String(i)}-criticality`} label={`${row} criticality`} hiddenLabel value={item.criticality} onChange={(criticality) => {
                          put({ ...item, criticality });
                        }} />
                    </td>
                    <td>{used}</td>
                    <td>
                      <button type="button" class="quiet" aria-label={`Remove ${row}`} disabled={used > 0} title={used > 0 ? 'Assets support this function.' : undefined} onClick={() => {
                          set('functions', replaceAt(functions, i, undefined));
                        }}>
                        Remove
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      <button type="button" class="quiet" onClick={() => {
          set('functions', [...functions, { id: nextId('F-', functions.map((item) => item.id)), name: '', criticality: '' }]);
        }}>
        Add a function
      </button>
    </section>
  );
}

function GovernanceSection({ doc, update }: { readonly doc: RiskDocument; readonly update: Update }) {
  const roles = doc.governance?.roles ?? [];
  const setRoles = (next: Role[]): void => {
    update((current) => withSection(current, 'governance', withValue(current.governance, 'roles', next)));
  };
  return (
    <section aria-labelledby="governance-title" class="panel">
      <h2 id="governance-title">Roles</h2>
      <p class="muted">The roles of Table 1 that exist in your organization. A company of 50 people usually fills 3 or 4 rows.</p>
      {roles.length > 0 && (
        <div class="table-box">
          <table aria-labelledby="governance-title">
            <thead>
              <tr>
                <th scope="col">Role</th>
                <th scope="col">Level</th>
                <th scope="col">Holder</th>
                <th scope="col">Responsibilities</th>
                <th scope="col">
                  <span class="visually-hidden">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {roles.map((role, i) => {
                const row = `Role ${String(i + 1)}`;
                const put = (next: Role): void => {
                  setRoles(replaceAt(roles, i, next));
                };
                return (
                  <tr key={i}>
                    <td>
                      <TextField id={`role-${String(i)}-role`} label={`${row} name`} hiddenLabel value={role.role} onChange={(value) => {
                          put({ ...role, role: value });
                        }} />
                    </td>
                    <td>
                      <SelectField id={`role-${String(i)}-level`} label={`${row} level`} hiddenLabel value={role.level} options={ROLE_LEVELS} onChange={(level) => {
                          put({ ...role, level: level ?? 'organization' });
                        }} />
                    </td>
                    <td>
                      <TextField id={`role-${String(i)}-holder`} label={`${row} holder`} hiddenLabel value={role.holder} onChange={(holder) => {
                          put(withValue(role, 'holder', holder));
                        }} />
                    </td>
                    <td>
                      <TextField id={`role-${String(i)}-responsibilities`} label={`${row} responsibilities`} hiddenLabel value={role.responsibilities} onChange={(text) => {
                          put(withValue(role, 'responsibilities', text));
                        }} />
                    </td>
                    <td>
                      <button type="button" class="quiet" aria-label={`Remove ${row}`} onClick={() => {
                          setRoles(replaceAt(roles, i, undefined));
                        }}>
                        Remove
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      <button type="button" class="quiet" onClick={() => {
          setRoles([...roles, { role: '', level: 'organization' }]);
        }}>
        Add a role
      </button>
    </section>
  );
}

export function ContextScreen({ id, onBack }: { readonly id: string; readonly onBack: () => void }) {
  const [db, setDb] = useState<IDBDatabase>();
  const [stored, setStored] = useState<StoredDocument>();
  const [draft, setDraft] = useState<RiskDocument>();
  const [errors, setErrors] = useState<readonly Finding[]>([]);
  const [failure, setFailure] = useState<string>();
  const [note, setNote] = useState<string>();

  // Its own connection, closed on leaving, so "Remove all data" on S1 is never blocked.
  useEffect(() => {
    let open: IDBDatabase | undefined;
    void openDb().then(async (database) => {
      open = database;
      setDb(database);
      const loaded = await loadDocument(database, id);
      setStored(loaded);
      setDraft(loaded?.doc);
    });
    return () => {
      open?.close();
    };
  }, [id]);

  // A new screen starts at the top, with focus on its title for screen reader users.
  const ready = stored !== undefined;
  useEffect(() => {
    if (!ready) return;
    window.scrollTo(0, 0);
    document.getElementById('screen-title')?.focus();
  }, [ready]);

  const dirty = stored !== undefined && draft !== undefined && changedSections(stored.doc, draft).length > 0;

  // Autosave (SPEC.md Sec. 10 item 3). Each save is a new version, so undo can go back.
  useEffect(() => {
    if (db === undefined || stored === undefined || draft === undefined || !dirty) {
      setErrors([]);
      return undefined;
    }
    const found = documentErrors(draft);
    setErrors(found);
    if (found.length > 0) return undefined;
    const timer = setTimeout(() => {
      saveDocument(db, withChangeLog(stored.doc, draft, isoSeconds()))
        .then((saved) => {
          setFailure(undefined);
          setStored(saved);
        })
        .catch((error: unknown) => {
          setFailure(error instanceof Error ? error.message : String(error));
        });
    }, SAVE_DELAY_MS);
    return () => {
      clearTimeout(timer);
    };
  }, [db, stored, draft, dirty]);

  if (db === undefined || stored === undefined || draft === undefined) {
    return (
      <main class="screen">
        <p role="status">Opening the document.</p>
      </main>
    );
  }

  const update: Update = (change) => {
    setNote(undefined);
    setDraft((current) => (current === undefined ? current : change(current)));
  };

  const undoLast = (): void => {
    if (dirty) {
      setDraft(stored.doc);
      setNote('The unsaved changes are discarded.');
      return;
    }
    void undo(db, id).then((back) => {
      if (back === undefined) {
        setNote('No older version is kept.');
        return;
      }
      setStored(back);
      setDraft(back.doc);
      setNote(`Version ${String(back.version)} is back.`);
    });
  };

  const saveText = errors.length > 0 ? 'Not saved. Correct the errors below.' : dirty ? 'Saving.' : `Saved as version ${String(stored.version)}.`;

  return (
    <main class="screen">
      <header class="screen-head">
        <nav aria-label="Screens" class="button-row">
          <button type="button" class="quiet" onClick={onBack}>
            Back to start
          </button>
        </nav>
        <h1 id="screen-title" tabIndex={-1}>
          Context and strategy
        </h1>
        <p class="lede">
          {draft.document.title}. Step 1 of the life cycle, identify the context (Sec. 3.1 and 3.2). Changes are saved in this browser.
        </p>
      </header>

      {exportOverdue(stored) && (
        <p class="banner" role="status">
          {stored.lastExportOn === undefined ? 'You have not saved a copy of this document yet.' : 'Your last copy is more than 7 days old.'} Browsers can delete stored data. Export a copy on the start screen.
        </p>
      )}

      <div class="save-bar panel">
        <p role="status" aria-live="polite" class={errors.length > 0 || failure !== undefined ? 'save-error' : undefined}>
          {failure === undefined ? saveText : `Not saved. ${failure}`} {note}
        </p>
        <p class="muted">Last export: {stored.lastExportOn === undefined ? 'never' : new Date(stored.lastExportOn).toLocaleString()}.</p>
        <button type="button" class="quiet" onClick={undoLast}>
          {dirty ? 'Discard unsaved changes' : 'Undo last change'}
        </button>
        {errors.length > 0 && (
          <ul class="errors">
            {errors.slice(0, 8).map((error, i) => (
              <li key={i}>
                {error.rule} {error.message}
              </li>
            ))}
          </ul>
        )}
      </div>

      <ContextSection doc={draft} update={update} />
      <GovernanceSection doc={draft} update={update} />
      <AppetiteSection doc={draft} update={update} />
      <StrategySection doc={draft} update={update} />
    </main>
  );
}
