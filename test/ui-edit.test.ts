// Edit helpers of the screens (src/ui/edit.ts): empty values, starting tolerance points of
// SPEC.md Sec. 8.9, and change log entries of Sec. 6.18.
import { describe, expect, it } from 'vitest';
import { documentErrors, type RiskDocument } from '../src/schema';
import { defaultTolerancePoints, lines, nextId, withChangeLog, withSection, withValue } from '../src/ui/edit';
import { example, EXAMPLE_2 } from './schema-helpers';

describe('withValue and withSection', () => {
  it('set a value and remove empty text, lists and sections', () => {
    expect(withValue({ a: 'x', b: 'y' }, 'a', 'z')).toEqual({ a: 'z', b: 'y' });
    expect(withValue({ a: 'x', b: 'y' }, 'a', '')).toEqual({ b: 'y' });
    expect(withValue({ list: ['x'] }, 'list', [])).toEqual({});
    const doc = example(EXAMPLE_2);
    expect('context' in withSection(doc, 'context', {})).toBe(false);
  });

  it('never sets a prototype', () => {
    const target: Record<string, unknown> = {};
    const result = withValue(target, '__proto__', { polluted: true });
    expect(Object.getPrototypeOf(result)).toBe(Object.prototype);
    expect(({} as Record<string, unknown>)['polluted']).toBeUndefined();
  });
});

describe('small helpers', () => {
  it('nextId takes the first free number and lines drops empty lines', () => {
    expect(nextId('OBJ-', ['OBJ-1', 'OBJ-3'])).toBe('OBJ-2');
    expect(lines(' a \n\n b\n')).toEqual(['a', 'b']);
  });
});

describe('starting tolerance points (SPEC.md Sec. 8.9)', () => {
  it('are 2, 10, 33 and 100 percent of capacity and pass rule V-12', () => {
    const points = defaultTolerancePoints(1_000_000);
    expect(points).toEqual([
      { loss: 20_000, maxExceedanceProbability: 0.5 },
      { loss: 100_000, maxExceedanceProbability: 0.2 },
      { loss: 330_000, maxExceedanceProbability: 0.05 },
      { loss: 1_000_000, maxExceedanceProbability: 0.01 },
    ]);
    const doc = example(EXAMPLE_2);
    const withCurve: RiskDocument = { ...doc, appetite: { ...doc.appetite, toleranceCurve: { points: points as [never, never] } } };
    expect(documentErrors(withCurve)).toEqual([]);
  });
});

describe('change log (SPEC.md Sec. 6.18)', () => {
  const saved: RiskDocument = { ...example(EXAMPLE_2), changeLog: [] };
  const edit = (doc: RiskDocument, mission: string): RiskDocument => withSection(doc, 'context', withValue(doc.context, 'mission', mission));

  it('adds one entry per changed section with before and after', () => {
    const draft = withSection(edit(saved, 'First'), 'governance', { roles: [{ role: 'CISO', level: 'organization' }] });
    const logged = withChangeLog(saved, draft, '2026-10-29T10:00:00Z', 'ed');
    expect(logged.changeLog?.map((entry) => [entry.entityKind, entry.path])).toEqual([
      ['context', '/context'],
      ['context', '/governance'],
    ]);
    expect(logged.changeLog?.[0]?.before).toEqual(saved.context);
    expect(logged.changeLog?.[0]?.after).toEqual(draft.context);
    expect(documentErrors(logged)).toEqual([]);
  });

  it('updates the last entry for a second change within 10 minutes and keeps its before', () => {
    const first = withChangeLog(saved, edit(saved, 'First'), '2026-10-29T10:00:00Z');
    const second = withChangeLog(first, edit(first, 'Second'), '2026-10-29T10:05:00Z');
    expect(second.changeLog).toHaveLength(1);
    expect(second.changeLog?.[0]?.at).toBe('2026-10-29T10:05:00Z');
    expect(second.changeLog?.[0]?.before).toEqual(saved.context);
    expect((second.changeLog?.[0]?.after as { mission?: string }).mission).toBe('Second');
    const later = withChangeLog(second, edit(second, 'Third'), '2026-10-29T10:16:00Z');
    expect(later.changeLog).toHaveLength(2);
  });

  it('adds nothing when no section changed', () => {
    expect(withChangeLog(saved, saved, '2026-10-29T10:00:00Z').changeLog ?? []).toEqual([]);
  });
});
