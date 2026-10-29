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

type EntityKind = 'register' | 'risk' | 'asset' | 'driver';
type Keyed = { readonly id?: string; readonly riskId?: string };

export interface Change {
  readonly entityKind: 'context' | 'strategy' | 'appetite' | EntityKind;
  readonly entityId: string;
  readonly path: string;
  readonly before?: unknown;
  readonly after?: unknown;
}

const ENTITY_LISTS: readonly (readonly ['registers' | 'risks' | 'assets' | 'drivers', EntityKind])[] = [
  ['registers', 'register'],
  ['risks', 'risk'],
  ['assets', 'asset'],
  ['drivers', 'driver'],
];

const keyOf = (item: Keyed): string => item.riskId ?? item.id ?? '';

// Every change between two versions: one per changed section and one per added, removed or
// changed register, risk, asset or driver. Unchanged objects keep their identity through the
// immutable edits, so most comparisons end at the reference check.
export function documentChanges(before: RiskDocument, after: RiskDocument): Change[] {
  const changes: Change[] = changedSections(before, after).map((section) => ({
    entityKind: section === 'governance' ? 'context' : section,
    entityId: before.document.id,
    path: `/${section}`,
    ...(before[section] === undefined ? {} : { before: before[section] }),
    ...(after[section] === undefined ? {} : { after: after[section] }),
  }));
  for (const [list, entityKind] of ENTITY_LISTS) {
    const old = new Map<string, Keyed>(((before[list] ?? []) as readonly Keyed[]).map((item) => [keyOf(item), item]));
    const next = new Map<string, Keyed>(((after[list] ?? []) as readonly Keyed[]).map((item) => [keyOf(item), item]));
    for (const id of new Set([...old.keys(), ...next.keys()])) {
      const a = old.get(id);
      const b = next.get(id);
      if (a === b || (a !== undefined && b !== undefined && canonicalize(a) === canonicalize(b))) continue;
      changes.push({ entityKind, entityId: id, path: '', ...(a === undefined ? {} : { before: a }), ...(b === undefined ? {} : { after: b }) });
    }
  }
  return changes;
}

const COALESCE_MS = 10 * 60 * 1000;

// SPEC.md Sec. 6.18. One change log entry per change, built on the saved log. A second change
// of the same entity and path by the same actor within 10 minutes updates that entry and keeps
// its "before", so autosave does not add an entry per pause in typing.
export function withChangeLog(saved: RiskDocument, draft: RiskDocument, at: string, actor?: string): RiskDocument {
  const log = [...(saved.changeLog ?? [])];
  for (const change of documentChanges(saved, draft)) {
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
