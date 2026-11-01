// The frame of every screen that edits the open document (S2 and later). A valid change is
// saved in this browser after a short pause (SPEC.md Sec. 10 item 3), with change log entries
// (Sec. 6.18) and the NIST numbers of re-estimated risks (Sec. 7.3). An invalid change shows
// its errors and is not saved. Leaving saves a pending valid change first.
import { type ComponentChildren, Fragment } from 'preact';
import { useCallback, useEffect, useRef, useState } from 'preact/hooks';
import { documentErrors } from '../schema/document';
import type { Finding, RiskDocument } from '../schema/types';
import { exportOverdue, loadDocument, openDb, saveDocument, storedProblem, type StoredDocument, undo } from '../storage/db';
import { runJob } from '../engine/client';
import type { RiskNumbers } from '../engine/numbers';
import { simulationTargets, withNistNumbers, withNumbersFrom, withSimulationSettings } from './analysis';
import { documentChanges, withChangeLog } from './edit';
import { InvalidFields } from './fields';
import { completionSteps, type StepState } from './steps';
import { VersionNotice } from './version-notice';

export type Update = (change: (doc: RiskDocument) => RiskDocument) => void;
export type ScreenName = 'start' | 'context' | 'identify' | 'prioritize' | 'respond' | 'monitor' | 'enterprise';

const SCREENS: readonly (readonly [Exclude<ScreenName, 'start'>, string])[] = [
  ['context', 'Context and strategy'],
  ['identify', 'Identify and analyze'],
  ['prioritize', 'Prioritize'],
  ['respond', 'Respond and optimize'],
  ['monitor', 'Monitor and adjust'],
  ['enterprise', 'Enterprise view'],
];

const SAVE_DELAY_MS = 600;

const STEP_STATES: Readonly<Record<StepState, string>> = { done: 'Done', next: 'Next', todo: 'To do', optional: 'Optional', last: 'Last step' };

// A closed steps panel stays closed on the other screens until the page loads again.
let stepsClosed = false;
// The section that a step opens after the screen changes.
let pendingSection: string | undefined;

// Scrolls to a section and moves the focus to its heading, so keyboard and screen reader
// users start there too. The heading stops below the sticky save bar, which is higher when it
// wraps or shows errors.
function showSection(id: string): boolean {
  const target = document.getElementById(id);
  if (target === null) return false;
  if (!target.hasAttribute('tabindex')) target.setAttribute('tabindex', '-1');
  const bar = document.querySelector('.save-bar')?.getBoundingClientRect().height ?? 0;
  window.scrollTo(0, target.getBoundingClientRect().top + window.scrollY - bar - 8);
  target.focus({ preventScroll: true });
  return true;
}

// SPEC.md Sec. 5. The steps of the AT-5 task in plain words, ticked from the saved document.
// Colour is never the only signal, so each step also has its state as a word.
function StepsPanel({ doc, screen, onGo }: { readonly doc: RiskDocument; readonly screen: Exclude<ScreenName, 'start'>; readonly onGo: (screen: Exclude<ScreenName, 'start'>, section: string) => void }) {
  const [open, setOpen] = useState(!stepsClosed);
  const { steps, done, required } = completionSteps(doc);
  return (
    <details
      class="steps panel"
      open={open}
      onToggle={(event) => {
        const next = event.currentTarget.open;
        stepsClosed = !next;
        setOpen(next);
      }}
    >
      <summary>
        Steps to complete: {done} of {required} done
      </summary>
      <p class="muted">Do the steps in this order. The app ticks a step when the saved document shows it.</p>
      <ol>
        {steps.map((step) => (
          <li key={step.key} class={`step step-${step.state}`} aria-current={step.state === 'next' ? 'step' : undefined}>
            <p>
              <span class="step-state">{STEP_STATES[step.state]}</span> <strong>{step.title}</strong>
            </p>
            {step.state !== 'done' && (
              <>
                {step.state === 'next' ? (
                  <p>{step.how}</p>
                ) : (
                  <details class="help">
                    <summary>How to do this step</summary>
                    <p>{step.how}</p>
                  </details>
                )}
                {step.missing !== undefined && <p class="hint">{step.missing}</p>}
                <button type="button" class="quiet" onClick={() => {
                    onGo(step.screen, step.section);
                  }}>
                  {step.screen === screen ? 'Show me where' : `Go to ${SCREENS.find(([name]) => name === step.screen)?.[1] ?? step.screen}`}
                </button>
              </>
            )}
          </li>
        ))}
      </ol>
    </details>
  );
}

const isoSeconds = (date = new Date()): string => date.toISOString().replace(/\.\d{3}Z$/, 'Z');

// The saved form of a draft: a seed when the first estimate appears, the NIST numbers of
// re-estimated risks, and the change log. The screen passes the simulated numbers from the
// engine worker. Without them, the simulations run here.
export function prepareSave(saved: RiskDocument, draft: RiskDocument, at: string, simulated?: Readonly<Record<string, RiskNumbers>>): RiskDocument {
  return withChangeLog(saved, withNistNumbers(saved, withSimulationSettings(draft), simulated), at);
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
  // blocked is true while a number field holds text that is not a number.
  readonly children: (doc: RiskDocument, update: Update, status: { readonly blocked: boolean }) => ComponentChildren;
}) {
  const [db, setDb] = useState<IDBDatabase>();
  const [stored, setStored] = useState<StoredDocument>();
  const [draft, setDraft] = useState<RiskDocument>();
  const [errors, setErrors] = useState<readonly Finding[]>([]);
  const [failure, setFailure] = useState<string>();
  // The stored record failed the check on open (storedProblem). The screen then edits nothing.
  const [damaged, setDamaged] = useState<string>();
  const [note, setNote] = useState<string>();
  const [saving, setSaving] = useState(false);
  // Number fields whose text is not a number. The document still holds the old value, so
  // the screen saves nothing until the text is a number again or is discarded.
  const [invalid, setInvalid] = useState<ReadonlyMap<string, string>>(new Map());
  // A new value remounts the fields, so discard and undo also reset their typed text.
  const [revision, setRevision] = useState(0);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  // The latest saved version and draft. A save reads them when it starts, so a save that
  // waited for a long simulation never builds on an old version.
  const base = useRef<StoredDocument>(undefined);
  const latest = useRef<RiskDocument>(undefined);
  // Saves run one after the other.
  const queue = useRef<Promise<void>>(Promise.resolve());

  const showDraft = (doc: RiskDocument): void => {
    latest.current = doc;
    setDraft(doc);
  };
  const showStored = (doc: StoredDocument): void => {
    base.current = doc;
    setStored(doc);
  };

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
      const loaded = await loadDocument(database, id);
      setDb(database);
      const problem = loaded === undefined ? undefined : storedProblem(loaded);
      if (problem !== undefined) {
        setDamaged(problem);
      } else if (loaded !== undefined) {
        showStored(loaded);
        showDraft(loaded.doc);
      }
    });
    return () => {
      open?.close();
    };
  }, [id]);

  // A new screen starts at the top, with focus on its title for screen reader users. A step
  // of the steps panel starts at its section.
  const ready = stored !== undefined;
  useEffect(() => {
    if (!ready) return;
    const section = pendingSection;
    pendingSection = undefined;
    if (section !== undefined && showSection(section)) return;
    window.scrollTo(0, 0);
    document.getElementById('screen-title')?.focus();
  }, [ready]);

  const dirty = stored !== undefined && draft !== undefined && documentChanges(stored.doc, draft).length > 0;
  const blocked = invalid.size > 0;

  // Saves the latest valid draft. The simulations of re-estimated risks run in the engine
  // worker, so the page stays responsive however long they take (SPEC.md Sec. 8.16).
  const saveNow = (): Promise<boolean> => {
    const run = async (): Promise<void> => {
      const saved = base.current;
      const next = latest.current;
      if (db === undefined || saved === undefined || next === undefined) return;
      if (documentChanges(saved.doc, next).length === 0 || documentErrors(next).length > 0) return;
      setSaving(true);
      try {
        const settled = withSimulationSettings(next);
        const targets = simulationTargets(saved.doc, settled);
        const simulated = targets.length === 0 ? {} : await runJob({ kind: 'riskNumbers', doc: settled, riskIds: targets }).result;
        const written = await saveDocument(db, prepareSave(saved.doc, settled, isoSeconds(), simulated));
        setFailure(undefined);
        showStored(written);
        const current = latest.current;
        showDraft(current === next || current === undefined ? written.doc : withNumbersFrom(written.doc, current));
      } finally {
        setSaving(false);
      }
    };
    // True when the save worked or had nothing to do.
    const result = queue.current.then(run).then(
      () => true,
      (error: unknown) => {
        setFailure(error instanceof Error ? error.message : String(error));
        return false;
      },
    );
    queue.current = result.then(() => undefined);
    return result;
  };

  useEffect(() => {
    if (stored === undefined || draft === undefined || !dirty) {
      setErrors([]);
      return undefined;
    }
    const found = documentErrors(draft);
    setErrors(found);
    if (found.length > 0 || blocked) return undefined;
    timer.current = setTimeout(() => {
      timer.current = undefined;
      void saveNow();
    }, SAVE_DELAY_MS);
    return () => {
      clearTimeout(timer.current);
      timer.current = undefined;
    };
  }, [stored, draft, dirty, blocked]);

  if (damaged !== undefined) {
    return (
      <main class="screen">
        <h1>{title}</h1>
        <p class="message message-error" role="alert">
          The stored copy of this document is damaged, so this screen does not open it. {damaged} Go back to the start screen to restore the last valid version.
        </p>
        <button type="button" onClick={() => {
            onNavigate('start');
          }}>
          Back to start
        </button>
      </main>
    );
  }

  if (db === undefined || stored === undefined || draft === undefined) {
    return (
      <main class="screen">
        <p role="status">Opening the document.</p>
      </main>
    );
  }

  const update: Update = (change) => {
    setNote(undefined);
    const current = latest.current;
    if (current !== undefined) showDraft(change(current));
  };

  const undoLast = (): void => {
    if (dirty || blocked) {
      showDraft(stored.doc);
      setRevision((value) => value + 1);
      setNote('The unsaved changes are discarded.');
      return;
    }
    queue.current = queue.current.then(async () => {
      const back = await undo(db, id);
      if (back === undefined) {
        setNote('No older version is kept.');
        return;
      }
      showStored(back);
      showDraft(back.doc);
      setRevision((value) => value + 1);
      setNote(`Version ${String(back.version)} is back.`);
    }).catch((error: unknown) => {
      setFailure(error instanceof Error ? error.message : String(error));
    });
  };

  // Leaving saves a pending valid change first, and waits for a save that runs. A change
  // that cannot be saved stays, and the screen says so, because leaving would drop it.
  const leave = (target: ScreenName, section?: string): void => {
    if (blocked || (dirty && documentErrors(draft).length > 0)) {
      setNote('Correct the changes, or discard them, before you go to another screen.');
      return;
    }
    clearTimeout(timer.current);
    timer.current = undefined;
    void saveNow().then((ok) => {
      if (!ok) return;
      pendingSection = section;
      onNavigate(target);
    });
  };

  const saveText = blocked
    ? `Not saved. These fields do not hold a number: ${[...invalid.values()].join(', ')}.`
    : errors.length > 0
      ? 'Not saved. Correct the errors below.'
      : dirty || saving
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

      <VersionNotice />
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

      <StepsPanel doc={stored.doc} screen={screen} onGo={(target, section) => {
          if (target === screen) showSection(section);
          else leave(target, section);
        }} />

      <InvalidFields.Provider value={reportInvalid}>
        <Fragment key={revision}>{children(draft, update, { blocked })}</Fragment>
      </InvalidFields.Provider>
    </main>
  );
}
