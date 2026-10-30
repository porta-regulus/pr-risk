// The merge choice of an import on screen S1 (SPEC.md Sec. 9.7). The diff rows per matched
// entity, the choices that go to commitImport, and the text after the commit.
import type { Choice, DiffEntry, ImportPreview } from '../import/pipeline';
import { canonicalize } from '../schema/canonical';
import type { RiskDocument } from '../schema/types';

export const CHOICE_TEXT: Readonly<Record<Choice, string>> = {
  current: 'Keep current',
  incoming: 'Take incoming',
  both: 'Keep both',
};

export interface DiffRow {
  readonly field: string;
  readonly current: string;
  readonly incoming: string;
}

// One entity of the open document that the file changes.
export interface MergeEntity {
  readonly kind: DiffEntry['kind'];
  readonly id: string;
  // The risk description or the register title in the open document.
  readonly title: string;
  readonly rows: readonly DiffRow[];
}

const isFlat = (value: unknown): boolean => value === null || ['string', 'number', 'boolean'].includes(typeof value);

// A field value as text. Exact, so the user sees each difference that the diff found. An object
// shows its keys in order with flat values, for example "code ict, subcode ict.identity".
export function valueText(value: unknown): string {
  if (value === undefined || value === null) return 'Not set';
  if (typeof value === 'string') return value === '' ? 'Empty text' : value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (Array.isArray(value) && value.every((item) => typeof item === 'string' || typeof item === 'number')) return value.length === 0 ? 'Empty list' : value.join(', ');
  if (!Array.isArray(value) && typeof value === 'object' && Object.values(value).every(isFlat)) {
    const entries = Object.entries(value).sort(([a], [b]) => (a < b ? -1 : 1));
    if (entries.length > 0) return entries.map(([key, item]) => `${key} ${item === null ? 'null' : String(item)}`).join(', ');
  }
  return canonicalize(value);
}

// A field name with a break point before each capital, so riskLikelihood can wrap as risk Likelihood.
export const fieldParts = (field: string): string[] => field.split(/(?=[A-Z])/);

// The diff grouped per entity, in the order of the diff (registers first, then risks).
export function mergeEntities(doc: RiskDocument, preview: ImportPreview): MergeEntity[] {
  const groups = new Map<string, { kind: DiffEntry['kind']; id: string; rows: DiffRow[] }>();
  for (const entry of preview.diff) {
    const key = `${entry.kind} ${entry.id}`;
    const group = groups.get(key) ?? { kind: entry.kind, id: entry.id, rows: [] };
    group.rows.push({ field: entry.field, current: valueText(entry.current), incoming: valueText(entry.incoming) });
    groups.set(key, group);
  }
  return [...groups.values()].map((group) => ({
    ...group,
    title:
      group.kind === 'risk'
        ? (doc.risks.find((risk) => risk.riskId === group.id)?.riskDescription ?? '')
        : (doc.registers.find((register) => register.id === group.id)?.title ?? ''),
  }));
}

// The choices for commitImport. A changed risk gets the choice of the user, else 'incoming' as
// in commitImport. A matched risk without a change gets 'current', so it adds no entry with
// equal before and after to the change log.
export function importChoices(doc: RiskDocument, preview: ImportPreview, selected: Readonly<Record<string, Choice>>): Record<string, Choice> {
  const existing = new Set(doc.risks.map((risk) => risk.riskId));
  const changed = new Set(preview.diff.filter((entry) => entry.kind === 'risk').map((entry) => entry.id));
  const choices: Record<string, Choice> = {};
  for (const risk of preview.risks) {
    if (!existing.has(risk.riskId)) continue;
    choices[risk.riskId] = changed.has(risk.riskId) ? (selected[risk.riskId] ?? 'incoming') : 'current';
  }
  return choices;
}

// Risks of the file with an id of the open document and no changed field.
export function unchangedRisks(doc: RiskDocument, preview: ImportPreview): number {
  return Object.values(importChoices(doc, preview, {})).filter((choice) => choice === 'current').length;
}

const count = (n: number, one: string, many: string): string => `${String(n)} ${n === 1 ? one : many}`;

// The message after a merge. New risks and risks with 'incoming' or 'both' are saved.
export function mergeResultText(fileName: string, preview: ImportPreview, choices: Readonly<Record<string, Choice>>): string {
  const changed = new Set(preview.diff.filter((entry) => entry.kind === 'risk').map((entry) => entry.id));
  let saved = 0;
  let kept = 0;
  let same = 0;
  for (const risk of preview.risks) {
    const choice = choices[risk.riskId] ?? 'incoming';
    if (choice !== 'current') saved += 1;
    else if (changed.has(risk.riskId)) kept += 1;
    else same += 1;
  }
  return [
    `${count(saved, 'risk', 'risks')} from ${fileName} ${saved === 1 ? 'is' : 'are'} saved.`,
    ...(kept === 0 ? [] : [`${count(kept, 'risk keeps its', 'risks keep their')} current version.`]),
    ...(same === 0 ? [] : [`${count(same, 'risk has', 'risks have')} no change.`]),
  ].join(' ');
}
