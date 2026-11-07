import { describe, expect, it } from 'vitest';
import { screenSummary } from '../src/ui/screen-summary';
import { EXAMPLE_2, example } from './schema-helpers';

describe('screen summary', () => {
  it('counts example 2 in plain words on each screen', () => {
    const doc = example(EXAMPLE_2);
    const today = '2026-11-07';
    for (const screen of ['context', 'identify', 'prioritize', 'respond', 'monitor', 'enterprise'] as const) {
      const lines = screenSummary(doc, screen, today);
      expect(lines.length).toBeGreaterThan(0);
      for (const line of lines) {
        expect(line).toMatch(/\.$/);
        expect(line).not.toMatch(/Sec\. |Fig\. |[—;:]/);
      }
    }
    expect(screenSummary(doc, 'context', today)[0]).toMatch(/^\d+ goals?\.$/);
    expect(screenSummary(doc, 'respond', today)[0]).toMatch(/^\d+ response options?, \d+ selected or done\.$/);
  });

  it('says what is missing in an empty document', () => {
    const doc = { ...example(EXAMPLE_2), context: {}, appetite: {}, strategy: {}, risks: [], responses: [], drivers: [] };
    expect(screenSummary(doc, 'context', '2026-11-07')).toEqual(['No goal yet.', 'No tolerance curve yet.', 'No capacity yet.', 'No budget yet.']);
    expect(screenSummary(doc, 'identify', '2026-11-07')).toEqual(['0 open risks in 2 registers.', '0 shared causes.']);
    expect(screenSummary(doc, 'respond', '2026-11-07')).toEqual(['0 response options, 0 selected or done.', 'No budget yet.']);
  });

  it('counts the risks past the review date and the lapsed acceptances', () => {
    const doc = example(EXAMPLE_2);
    const [first, second] = doc.risks;
    if (first === undefined || second === undefined) throw new Error('example 2 has risks');
    const risks = [
      { ...first, reviewDue: '2026-01-01' },
      { ...second, acceptance: { kind: 'acceptance' as const, acceptedBy: 'CEO', acceptedOn: '2025-01-01', validUntil: '2026-01-01', rationale: 'Within the tolerance.' } },
      ...doc.risks.slice(2).map(({ reviewDue: _due, acceptance: _accepted, ...risk }) => risk),
    ];
    const lines = screenSummary({ ...doc, risks }, 'monitor', '2026-11-07');
    expect(lines[1]).toBe('1 risk is past the review date.');
    expect(lines[2]).toBe('1 accepted risk, 1 no longer valid.');
  });
});
