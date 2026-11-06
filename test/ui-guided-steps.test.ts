import { describe, expect, it } from 'vitest';
import type { Risk, RiskDocument } from '../src/schema/types';
import { GUIDED_STEPS, guidedStatus, hasOwner, riskComplete } from '../src/ui/guided-steps';
import { newRisk } from '../src/ui/identify';
import { EXAMPLE_2, example } from './schema-helpers';

const empty = (): RiskDocument => {
  const doc = structuredClone(example(EXAMPLE_2));
  return {
    ...doc,
    context: {},
    appetite: {},
    risks: [],
    drivers: [],
    responses: [],
    strategy: {},
  };
};

const ESTIMATE: NonNullable<Risk['estimate']> = {
  frequency: { type: 'lognormal', lower: 0.1, upper: 1, confidence: 0.9 },
  impactPerEvent: { type: 'lognormal', lower: 1000, upper: 9000, confidence: 0.9 },
  method: 'expert-calibrated',
  rationale: 'Ten or more characters.',
};

const sized = (risk: Risk): Risk => ({ ...risk, riskOwnerPointOfContact: 'IT lead', objectiveIds: ['OBJ-1'], estimate: ESTIMATE });

describe('guided steps', () => {
  it('has the 9 steps of the redesign plan, with only shared causes optional', () => {
    expect(GUIDED_STEPS.map((step) => step.title)).toEqual(['Your company', 'Your goals', 'Loss you can take', 'Your risks', 'Size each risk', 'Shared causes', 'What you can do', 'Budget and best plan', 'Decision record']);
    expect(GUIDED_STEPS.filter((step) => step.optional === true).map((step) => step.key)).toEqual(['drivers']);
  });

  it('example 2 has every step done except the run and the print', () => {
    const doc = example(EXAMPLE_2);
    const status = guidedStatus(doc, false, false);
    expect(status.map((item) => item.done)).toEqual([true, true, true, true, true, true, true, false, false]);
    expect(status[7]?.missing).toBe('Click "Find the best portfolio".');
    expect(guidedStatus(doc, true, true).every((item) => item.done)).toBe(true);
  });

  it('says what is missing in plain words', () => {
    const status = guidedStatus(empty(), false, false);
    expect(status[1]?.missing).toBe('Add 2 more goals.');
    expect(status[2]?.missing).toBe('The tolerance curve needs 3 points or more. It has 0.');
    expect(status[3]?.missing).toBe('Still needed: 5 more risks, 1 from the catalogue, 1 of your own, 1 chance of a gain.');
    expect(status[4]?.missing).toBe('Add risks in step 4 first.');
    expect(status[5]).toEqual({ done: false });
    expect(status[6]?.missing).toBe('Add 2 more options.');
    expect(status[7]?.missing).toBe('Type the budget.');
  });

  it('needs 1 catalogue risk, 1 own risk and 1 opportunity among 5 open risks', () => {
    const base = empty();
    const register = base.registers[0].id;
    let doc = base;
    const add = (risk: Risk): void => {
      doc = { ...doc, risks: [...doc.risks, risk] };
    };
    for (let i = 0; i < 4; i++) add(newRisk(doc, register, `If event ${String(i)} occurs, then we lose.`, 'negative'));
    add({ ...newRisk(doc, register, 'If a tender asks for CRA evidence, then we win.', 'positive'), catalogueRef: { catalogue: 'risklet', id: 'OPP-1' } });
    expect(guidedStatus(doc, false, false)[3]).toEqual({ done: true });
    doc = { ...doc, risks: doc.risks.map((risk) => ({ ...risk, catalogueRef: { catalogue: 'risklet', id: '1' } })) };
    expect(guidedStatus(doc, false, false)[3]?.missing).toBe('Still needed: 1 of your own.');
  });

  it('a risk needs a real owner, a goal, both ranges and a rationale', () => {
    const doc = empty();
    const risk = newRisk(doc, doc.registers[0].id, 'If X occurs, then Y happens.', 'negative');
    expect(hasOwner(risk)).toBe(false);
    expect(riskComplete(sized(risk))).toBe(true);
    expect(riskComplete({ ...sized(risk), objectiveIds: [] })).toBe(false);
    const short = sized(risk);
    expect(riskComplete({ ...short, estimate: { ...ESTIMATE, rationale: 'Too short' } })).toBe(false);
    expect(riskComplete({ ...short, estimate: { ...ESTIMATE, impactPerEvent: { type: 'lognormal', confidence: 0.9 } } })).toBe(false);
    const next = { ...doc, risks: [risk] };
    expect(guidedStatus(next, false, false)[4]?.missing).toBe(`These risks need data: ${risk.riskId}.`);
  });
});
