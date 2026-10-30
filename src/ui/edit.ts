// Pure edit helpers for the screens. An empty text, list or section is removed, so an
// edit never leaves a value that the schema refuses only because it is empty.
import { canonicalize } from '../schema/canonical';
import type { RiskDocument } from '../schema/types';

export type Section = 'context' | 'governance' | 'strategy' | 'appetite';
export const SECTIONS: readonly Section[] = ['context', 'governance', 'strategy', 'appetite'];

type Appetite = NonNullable<RiskDocument['appetite']>;
export type TolerancePoint = NonNullable<Appetite['toleranceCurve']>['points'][number];

export function isEmpty(value: unknown): boolean {
  if (value === undefined || value === '') return true;
  if (Array.isArray(value)) return value.length === 0;
  if (value !== null && typeof value === 'object') return Object.keys(value).length === 0;
  return false;
}

// A copy of object with key set to value, or without key when value is empty.
export function withValue<T extends object, K extends keyof T & string>(object: T | undefined, key: K, value: T[K] | undefined): T {
  const rest = Object.fromEntries(Object.entries(object ?? {}).filter(([name]) => name !== key)) as T;
  return isEmpty(value) ? rest : { ...rest, [key]: value };
}

export function withSection<K extends Section>(doc: RiskDocument, key: K, value: RiskDocument[K] | undefined): RiskDocument {
  return withValue(doc, key, value);
}

// The generated types encode minItems as tuples. A draft can hold fewer items while the
// user edits, and validation reports it before anything is saved.
export function draftList<L extends readonly unknown[]>(items: readonly L[number][]): L {
  return items as unknown as L;
}

// Lines of a text area, trimmed, without empty lines.
export function lines(text: string): string[] {
  return text
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line !== '');
}

// The next free id with this prefix, for example OBJ-3 after OBJ-1 and OBJ-2.
export function nextId(prefix: string, taken: Iterable<string>): string {
  const used = new Set(taken);
  let n = 1;
  while (used.has(`${prefix}${String(n)}`)) n += 1;
  return `${prefix}${String(n)}`;
}

// SPEC.md Sec. 8.9. Starting points for a new tolerance curve, not advice.
export function defaultTolerancePoints(capacity: number): TolerancePoint[] {
  return [
    [0.02, 0.5],
    [0.1, 0.2],
    [0.33, 0.05],
    [1, 0.01],
  ].map(([share = 0, probability = 0]) => ({ loss: Math.round(capacity * share), maxExceedanceProbability: probability }));
}

export function changedSections(before: RiskDocument, after: RiskDocument): Section[] {
  return SECTIONS.filter((section) => before[section] !== after[section] && canonicalize(before[section] ?? null) !== canonicalize(after[section] ?? null));
}

type EntityKind = 'register' | 'risk' | 'asset' | 'driver' | 'response' | 'forecast';
type Keyed = { readonly id?: string; readonly riskId?: string };

export interface Change {
  readonly entityKind: 'context' | 'strategy' | 'appetite' | EntityKind;
  readonly entityId: string;
  readonly path: string;
  readonly before?: unknown;
  readonly after?: unknown;
}

const ENTITY_LISTS: readonly (readonly ['registers' | 'risks' | 'assets' | 'drivers' | 'responses' | 'forecasts', EntityKind])[] = [
  ['registers', 'register'],
  ['risks', 'risk'],
  ['assets', 'asset'],
  ['drivers', 'driver'],
  ['responses', 'response'],
  ['forecasts', 'forecast'],
];

// A risk is keyed by riskId. A forecast also holds a riskId, but its key is its own id.
const keyOf = (item: Keyed, list: (typeof ENTITY_LISTS)[number][0]): string => (list === 'risks' ? item.riskId : item.id) ?? '';

// Every change between two versions: one per changed section and one per added, removed or
// changed register, risk, asset, driver, response or forecast. Unchanged objects keep their
// identity through the immutable edits, so most comparisons end at the reference check.
export function documentChanges(before: RiskDocument, after: RiskDocument): Change[] {
  const changes: Change[] = changedSections(before, after).map((section) => ({
    entityKind: section === 'governance' ? 'context' : section,
    entityId: before.document.id,
    path: `/${section}`,
    ...(before[section] === undefined ? {} : { before: before[section] }),
    ...(after[section] === undefined ? {} : { after: after[section] }),
  }));
  for (const [list, entityKind] of ENTITY_LISTS) {
    const old = new Map<string, Keyed>(((before[list] ?? []) as readonly Keyed[]).map((item) => [keyOf(item, list), item]));
    const next = new Map<string, Keyed>(((after[list] ?? []) as readonly Keyed[]).map((item) => [keyOf(item, list), item]));
    for (const id of new Set([...old.keys(), ...next.keys()])) {
      const a = old.get(id);
      const b = next.get(id);
      if (a === b || (a !== undefined && b !== undefined && canonicalize(a) === canonicalize(b))) continue;
      changes.push({ entityKind, entityId: id, path: '', ...(a === undefined ? {} : { before: a }), ...(b === undefined ? {} : { after: b }) });
    }
  }
  return changes;
}

type LogEntry = NonNullable<RiskDocument['changeLog']>[number];
const LIST_OF = new Map<string, (typeof ENTITY_LISTS)[number][0]>(ENTITY_LISTS.map(([list, kind]) => [kind, list]));

// The document with each entity in the state that an entry of the whole entity records.
function withEntries(doc: RiskDocument, entries: readonly LogEntry[]): RiskDocument {
  let next = doc;
  for (const entry of entries) {
    const list = LIST_OF.get(entry.entityKind);
    if (list === undefined || entry.path !== '' || !('after' in entry)) continue;
    const items = (next[list] ?? []) as readonly Keyed[];
    next = { ...next, [list]: items.map((item) => (keyOf(item, list) === entry.entityId ? entry.after : item)) };
  }
  return next;
}

const COALESCE_MS = 10 * 60 * 1000;

// SPEC.md Sec. 6.18. One change log entry per change, built on the saved log. A second change
// of the same entity and path by the same actor within 10 minutes updates that entry and keeps
// its "before", so autosave does not add an entry per pause in typing. Entries that the draft
// added after the saved log, such as the automatic reviews of screen S6, come first. The other
// changes start from the state that those entries record. A draft log that does not start
// with the saved log is an older copy of it and adds nothing.
export function withChangeLog(saved: RiskDocument, draft: RiskDocument, at: string, actor?: string): RiskDocument {
  const savedLog = saved.changeLog ?? [];
  const draftLog = draft.changeLog ?? [];
  const own = draftLog.length > savedLog.length && savedLog.every((entry, i) => draftLog[i] === entry) ? draftLog.slice(savedLog.length) : [];
  const log = [...savedLog, ...own];
  for (const change of documentChanges(withEntries(saved, own), draft)) {
    const last = log.at(-1);
    const recent =
      last !== undefined &&
      last.entityKind === change.entityKind &&
      last.entityId === change.entityId &&
      last.path === change.path &&
      last.actor === actor &&
      Date.parse(at) - Date.parse(last.at) < COALESCE_MS;
    const after = 'after' in change ? { after: change.after } : {};
    if (recent) {
      const { after: _old, ...rest } = last;
      log[log.length - 1] = { ...rest, at, ...after };
    } else {
      log.push({ at, entityKind: change.entityKind, entityId: change.entityId, path: change.path, ...(actor === undefined ? {} : { actor }), ...('before' in change ? { before: change.before } : {}), ...after });
    }
  }
  return withValue(draft, 'changeLog', log);
}
