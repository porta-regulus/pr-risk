// Aggregation and normalization of SP 800-221r1 Sec. 5.2 and Table 10 (SPEC.md Sec. 6.15,
// golden test G3). A parent register lists the entries of its child registers by category,
// merges selected entries into summary entries with the three-point roll-up of Sec. 8.15, and
// flags the entries that the escalation threshold sends to the parent register.
import { subtree } from '../engine/metrics';
import { summarize, type SummaryOptions } from '../import/rollup';
import { isPlaceholder } from './profile';
import type { Register, Risk, RiskDocument } from '../schema/types';

const IDENTIFIER = /^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/;

// Registers with at least one child register.
export function parentRegisters(doc: RiskDocument): Register[] {
  return doc.registers.filter((register) => doc.registers.some((child) => child.parentRegisterId === register.id));
}

// Summary entries of a register, newest last.
export function summaryEntries(doc: RiskDocument, registerId: string): Risk[] {
  return doc.risks.filter((risk) => risk.registerId === registerId && (risk.sourceRefs ?? []).length > 0);
}

export interface ChildEntry {
  readonly risk: Risk;
  // Summary entries in any register that hold this entry as a source. A second summary of the
  // same entry would count it twice, so the entry cannot go into another merge.
  readonly summarizedBy: readonly string[];
  // At or above the escalation threshold, and no summary entry of the parent holds it.
  readonly escalate: boolean;
}

export interface CategoryGroup {
  readonly code: Risk['category']['code'];
  readonly entries: readonly ChildEntry[];
}

// Sec. 6.15 item 1. The entries of every register below the parent, grouped by category code
// (SP 800-221r1 lines 1619 to 1620 call the category "a practical key for the initial sorting
// exercise"), then by subcode and id. A risk that a response causes is not an entry yet.
export function childEntries(doc: RiskDocument, parentId: string): CategoryGroup[] {
  const below = subtree(doc, parentId);
  below.delete(parentId);
  const summaries = doc.risks.filter((risk) => (risk.sourceRefs ?? []).length > 0);
  const threshold = doc.strategy?.escalationThreshold;
  const entries = doc.risks
    .filter((risk) => below.has(risk.registerId) && risk.onlyWithResponse === undefined)
    .map((risk): ChildEntry => {
      const summarizedBy = summaries.filter((summary) => (summary.sourceRefs ?? []).some((ref) => ref.registerId === risk.registerId && ref.riskId === risk.riskId)).map((summary) => summary.riskId);
      const inParent = summaries.some((summary) => summary.registerId === parentId && summarizedBy.includes(summary.riskId));
      const escalate = threshold !== undefined && risk.status !== 'Closed' && risk.exposureRating >= threshold && !inParent;
      return { risk, summarizedBy, escalate };
    })
    .sort(
      (a, b) =>
        a.risk.category.code.localeCompare(b.risk.category.code) ||
        (a.risk.category.subcode ?? '').localeCompare(b.risk.category.subcode ?? '') ||
        a.risk.riskId.localeCompare(b.risk.riskId, 'en', { numeric: true }),
    );
  const groups: CategoryGroup[] = [];
  for (const entry of entries) {
    const last = groups.at(-1);
    if (last?.code === entry.risk.category.code) groups[groups.length - 1] = { code: last.code, entries: [...last.entries, entry] };
    else groups.push({ code: entry.risk.category.code, entries: [entry] });
  }
  return groups;
}

export interface Merge {
  readonly sources: readonly Risk[];
  readonly options: SummaryOptions;
}

// Summary entries in any register that hold the risk as a source.
export function heldBy(doc: RiskDocument, risk: Risk): string[] {
  return doc.risks.filter((item) => (item.sourceRefs ?? []).some((ref) => ref.registerId === risk.registerId && ref.riskId === risk.riskId)).map((item) => item.riskId);
}

const listText = (ids: readonly string[]): string => ids.join(', ');

// The summary entries of a merge, or the reasons why the merge cannot run. An entry that a
// summary entry holds already, or an entry with only placeholder numbers (rule D-Q2), cannot
// go into a merge, because the profile would count it twice or show a placeholder as a value.
export function mergeResult(doc: RiskDocument, merge: Merge): { readonly rows: Risk[] } | { readonly problems: string[] } {
  const { sources, options } = merge;
  const problems: string[] = [];
  if (sources.length === 0) problems.push('Select at least one entry.');
  if (!IDENTIFIER.test(options.id)) problems.push('The id must start with a letter or a digit and hold only letters, digits, dots, hyphens and underscores.');
  if (options.riskDescription.trim() === '') problems.push('Write the combined risk description.');
  if (options.riskOwnerPointOfContact.trim() === '') problems.push('Name the risk owner at the level of the parent register.');
  if (new Set(sources.map((source) => source.polarity)).size > 1) problems.push('Select only negative or only positive entries.');
  for (const source of sources) {
    const held = heldBy(doc, source);
    if (held.length > 0) problems.push(`${source.riskId} is in ${listText(held)} already. Do not select it, or remove ${listText(held)} first.`);
  }
  const unknown = sources.filter((source) => isPlaceholder(doc, source)).map((source) => source.riskId);
  if (unknown.length > 0) {
    const one = unknown.length === 1;
    problems.push(`${listText(unknown)} ${one ? 'has' : 'have'} no estimate yet. Estimate ${one ? 'it' : 'them'} on the screen Identify and analyze, or do not select ${one ? 'it' : 'them'}.`);
  }
  if (problems.length > 0) return { problems };
  const rows = summarize(sources, options);
  const taken = new Set(doc.risks.map((risk) => risk.riskId));
  const repeated = rows.map((row) => row.riskId).filter((id) => taken.has(id));
  if (repeated.length > 0) return { problems: [`The id ${repeated.join(', ')} is in use.`] };
  return { rows };
}

// Adds the summary entries of a merge after the other risks. The sources stay as they are.
export function withMerge(doc: RiskDocument, rows: readonly Risk[]): RiskDocument {
  return { ...doc, risks: [...doc.risks, ...rows] };
}

// What refers to a risk, so that removing it would leave a reference to nothing.
export function referencesTo(doc: RiskDocument, riskId: string): string[] {
  return [
    ...doc.risks.filter((item) => (item.sourceRefs ?? []).some((ref) => ref.riskId === riskId) || (item.linkedRisks ?? []).some((link) => link.riskId === riskId)).map((item) => item.riskId),
    ...(doc.responses ?? []).filter((option) => option.effects.some((effect) => effect.targetKind === 'risk' && effect.targetId === riskId) || (option.introducesRisks ?? []).includes(riskId)).map((option) => option.id),
    ...(doc.forecasts ?? []).filter((forecast) => forecast.riskId === riskId).map((forecast) => forecast.id),
  ];
}

export function withoutRisk(doc: RiskDocument, riskId: string): RiskDocument {
  return { ...doc, risks: doc.risks.filter((risk) => risk.riskId !== riskId) };
}
