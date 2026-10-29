// The frame of every screen that edits the open document (S2 and later). A valid change is
// saved in this browser after a short pause (SPEC.md Sec. 10 item 3), with change log entries
// (Sec. 6.18) and the NIST numbers of re-estimated risks (Sec. 7.3). An invalid change shows
// its errors and is not saved. Leaving saves a pending valid change first.
import { type ComponentChildren, Fragment } from 'preact';
import { useCallback, useEffect, useRef, useState } from 'preact/hooks';
import { documentErrors } from '../schema/document';
import type { Finding, RiskDocument } from '../schema/types';
import { exportOverdue, loadDocument, openDb, saveDocument, type StoredDocument, undo } from '../storage/db';
import { withNistNumbers, withNumbersFrom, withSimulationSettings } from './analysis';
import { documentChanges, withChangeLog } from './edit';
import { InvalidFields } from './fields';

export type Update = (change: (doc: RiskDocument) => RiskDocument) => void;
export type ScreenName = 'start' | 'context' | 'identify';

const SCREENS: readonly (readonly [Exclude<ScreenName, 'start'>, string])[] = [
  ['context', 'Context and strategy'],
  ['identify', 'Identify and analyze'],
];

const SAVE_DELAY_MS = 600;

const isoSeconds = (date = new Date()): string => date.toISOString().replace(/\.\d{3}Z$/, 'Z');

// The saved form of a draft: a seed when the first estimate appears, the NIST numbers of
// re-estimated risks, and the change log.
export function prepareSave(saved: RiskDocument, draft: RiskDocument, at: string): RiskDocument {
  return withChangeLog(saved, withNistNumbers(saved, withSimulationSettings(draft)), at);
}

export function DocumentScreen({
  id,
  screen,
  title,
  lede,
  onNavigate,
  children,
}: {
  readonly id: string;
  readonly screen: Exclude<ScreenName, 'start'>;
  readonly title: string;
  readonly lede: string;
  readonly onNavigate: (screen: ScreenName) => void;
  readonly children: (doc: RiskDocument, update: Update) => ComponentChildren;
}) {
  const [db, setDb] = useState<IDBDatabase>();
  const [stored, setStored] = useState<StoredDocument>();
  const [draft, setDraft] = useState<RiskDocument>();
  const [errors, setErrors] = useState<readonly Finding[]>([]);
  const [failure, setFailure] = useState<string>();
  const [note, setNote] = useState<string>();
  // Number fields whose text is not a number. The document still holds the old value, so
  // the screen saves nothing until the text is a number again or is discarded.
  const [invalid, setInvalid] = useState<ReadonlyMap<string, string>>(new Map());
  // A new value remounts the fields, so discard and undo also reset their typed text.
  const [revision, setRevision] = useState(0);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  const reportInvalid = useCallback((field: string, label: string | undefined) => {
    setInvalid((current) => {
      if (label === undefined ? !current.has(field) : current.get(field) === label) return current;
      const next = new Map(current);
      if (label === undefined) next.delete(field);
      else next.set(field, label);
      return next;
    });
  }, []);

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

  const dirty = stored !== undefined && draft !== undefined && documentChanges(stored.doc, draft).length > 0;
  const blocked = invalid.size > 0;

  const persist = (database: IDBDatabase, base: StoredDocument, next: RiskDocument): Promise<void> => {
    const prepared = prepareSave(base.doc, next, isoSeconds());
    return saveDocument(database, prepared).then((saved) => {
      setFailure(undefined);
      setStored(saved);
      setDraft((current) => (current === undefined ? current : current === next ? saved.doc : withNumbersFrom(saved.doc, current)));
    });
  };

  useEffect(() => {
    if (db === undefined || stored === undefined || draft === undefined || !dirty) {
      setErrors([]);
      return undefined;
    }
    const found = documentErrors(draft);
    setErrors(found);
    if (found.length > 0 || blocked) return undefined;
    timer.current = setTimeout(() => {
      timer.current = undefined;
      persist(db, stored, draft).catch((error: unknown) => {
        setFailure(error instanceof Error ? error.message : String(error));
      });
    }, SAVE_DELAY_MS);
    return () => {
      clearTimeout(timer.current);
      timer.current = undefined;
    };
  }, [db, stored, draft, dirty, blocked]);

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
    if (dirty || blocked) {
      setDraft(stored.doc);
      setRevision((value) => value + 1);
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
      setRevision((value) => value + 1);
      setNote(`Version ${String(back.version)} is back.`);
    });
  };

  // Leaving saves a pending valid change at once. A change that cannot be saved stays, and
  // the screen says so, because leaving would drop it without a word.
  const leave = (target: ScreenName): void => {
    if (!dirty && !blocked) {
      onNavigate(target);
      return;
    }
    if (blocked || documentErrors(draft).length > 0) {
      setNote('Correct the changes, or discard them, before you go to another screen.');
      return;
    }
    clearTimeout(timer.current);
    timer.current = undefined;
    persist(db, stored, draft)
      .then(() => {
        onNavigate(target);
      })
      .catch((error: unknown) => {
        setFailure(error instanceof Error ? error.message : String(error));
      });
  };

  const saveText = blocked
    ? `Not saved. These fields do not hold a number: ${[...invalid.values()].join(', ')}.`
    : errors.length > 0
      ? 'Not saved. Correct the errors below.'
      : dirty
        ? 'Saving.'
        : `Saved as version ${String(stored.version)}.`;

  return (
    <main class="screen">
      <header class="screen-head">
        <nav aria-label="Screens" class="button-row">
          <button type="button" class="quiet" onClick={() => {
              leave('start');
            }}>
            Back to start
          </button>
          {SCREENS.map(([name, text]) => (
            <button type="button" class="quiet" key={name} aria-current={name === screen ? 'page' : undefined} disabled={name === screen} onClick={() => {
                leave(name);
              }}>
              {text}
            </button>
          ))}
        </nav>
        <h1 id="screen-title" tabIndex={-1}>
          {title}
        </h1>
        <p class="lede">
          {draft.document.title}. {lede}
        </p>
      </header>

      {exportOverdue(stored) && (
        <p class="banner" role="status">
          {stored.lastExportOn === undefined ? 'You have not saved a copy of this document yet.' : 'Your last copy is more than 7 days old.'} Browsers can delete stored data. Export a copy on the start screen.
        </p>
      )}

      <div class="save-bar panel">
        <p role="status" aria-live="polite" class={blocked || errors.length > 0 || failure !== undefined ? 'save-error' : undefined}>
          {failure === undefined ? saveText : `Not saved. ${failure}`} {note}
        </p>
        <p class="muted">Last export: {stored.lastExportOn === undefined ? 'never' : new Date(stored.lastExportOn).toLocaleString()}.</p>
        <button type="button" class="quiet" onClick={undoLast}>
          {dirty || blocked ? 'Discard unsaved changes' : 'Undo last change'}
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

      <InvalidFields.Provider value={reportInvalid}>
        <Fragment key={revision}>{children(draft, update)}</Fragment>
      </InvalidFields.Provider>
    </main>
  );
}
