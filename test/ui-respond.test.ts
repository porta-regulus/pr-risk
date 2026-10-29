// Rules of screens S4 and S5 that the record and the change log depend on.
import { describe, expect, it } from 'vitest';
import { priorityNumbers } from '../src/engine';
import { documentErrors, type ResponseOption, type RiskDocument } from '../src/schema';
import { documentChanges, withChangeLog } from '../src/ui/edit';
import { proposedPriorities, simulationKey } from '../src/ui/prioritize';
import { residualRisks } from '../src/ui/record';
import { TABLE_2, templateStatement } from '../src/ui/templates';
import { example, EXAMPLE_1, EXAMPLE_2 } from './schema-helpers';

const doc = example(EXAMPLE_2);

describe('S4 priorities (SPEC.md Sec. 6.9 and 6.16)', () => {
  const numbers = priorityNumbers(doc, 20_000, doc.simulation?.seed ?? 0);

  it('ranks by expected annual loss within each register, as the priorities of example 2 do', () => {
    const proposed = proposedPriorities(doc, numbers.state.risks);
    const stored = new Map(doc.risks.filter((risk) => proposed.has(risk.riskId)).map((risk) => [risk.riskId, risk.priority]));
    // Example 2 gives R-05 priority 6. Its register has 5 simulated negative risks, so the proposal is 5.
    expect(Object.fromEntries(proposed)).toEqual({ ...Object.fromEntries(stored), 'R-05': 5 });
  });

  it('a change of text keeps the simulation key, a change of an estimate does not', () => {
    const key = simulationKey(doc);
    expect(key).toBeDefined();
    const text: RiskDocument = { ...doc, risks: doc.risks.map((risk, i) => (i === 0 ? { ...risk, riskDescription: 'Changed text of the risk.', priority: 9 } : risk)) };
    expect(simulationKey(text)).toBe(key);
    const r1 = doc.risks[0];
    if (r1?.estimate === undefined) throw new Error('example 2 risk 1 has an estimate');
    const estimate: RiskDocument = {
      ...doc,
      risks: doc.risks.map((risk, i) => (i === 0 ? { ...risk, estimate: { ...r1.estimate, rationale: 'Another rationale.' } } : risk)),
    } as RiskDocument;
    expect(simulationKey(estimate)).not.toBe(key);
  });

  it('a document without an estimate has no simulation', () => {
    expect(simulationKey({ ...doc, risks: doc.risks.map(({ estimate: _drop, ...risk }) => risk) })).toBeUndefined();
  });
});

describe('S5 residual risks (SPEC.md Sec. 4 and 8.12 item 4)', () => {
  it('lists the risks with Accept or a pending decision that no funded option reaches', () => {
    expect(residualRisks(doc, ['O-4', 'O-5']).map((risk) => risk.riskId)).toEqual(['R-02', 'R-03', 'R-04', 'R-05', 'R-07']);
  });

  it('a risk that a response introduces counts only when that response is funded', () => {
    expect(residualRisks(doc, ['O-1', 'O-3', 'O-4']).some((risk) => risk.onlyWithResponse === 'O-3')).toBe(
      doc.risks.some((risk) => risk.onlyWithResponse === 'O-3' && (risk.riskResponseType.includes('Accept') || risk.responseDecision === 'pending')),
    );
    expect(residualRisks(doc, []).some((risk) => risk.onlyWithResponse !== undefined)).toBe(false);
  });
});

describe('change log of response options (SPEC.md Sec. 6.18)', () => {
  it('a changed option gets one entry with kind response', () => {
    const options = doc.responses ?? [];
    const changed: RiskDocument = { ...doc, responses: options.map((option, i): ResponseOption => (i === 0 ? { ...option, owner: 'CFO' } : option)) };
    const changes = documentChanges(doc, changed);
    expect(changes).toHaveLength(1);
    expect(changes[0]).toMatchObject({ entityKind: 'response', entityId: options[0]?.id });
    expect(withChangeLog(doc, changed, '2026-10-29T12:00:00Z').changeLog?.at(-1)).toMatchObject({ entityKind: 'response' });
  });
});

describe('S2 templates of SP 800-221r1 Table 2 (SPEC.md Sec. 6.5 item 4)', () => {
  it('has the five example pairs, and each one gives a valid statement with a new id', () => {
    expect(TABLE_2.map((template) => template.enterprise)).toEqual([
      'Global Retail Firm',
      'Government Agency',
      'Internet Service Provider',
      'Academic Institution',
      'Healthcare Provider',
    ]);
    let current = example(EXAMPLE_1);
    for (const template of TABLE_2) {
      const statements = current.appetite?.statements ?? [];
      const added = templateStatement(statements, template);
      expect(statements.map((item) => item.id)).not.toContain(added.id);
      current = { ...current, appetite: { ...current.appetite, statements: [...statements, added] } };
    }
    expect(documentErrors(current)).toEqual([]);
  });
});
