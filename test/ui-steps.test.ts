// The panel "Steps to complete" (SPEC.md Sec. 5). Each step is ticked from the saved document.
import { describe, expect, it } from 'vitest';
import type { RiskDocument } from '../src/schema';
import { completionSteps, type StepState } from '../src/ui/steps';
import { example, EXAMPLE_2 } from './schema-helpers';

const states = (doc: RiskDocument): Record<string, StepState> => Object.fromEntries(completionSteps(doc).steps.map((step) => [step.key, step.state]));
const missing = (doc: RiskDocument, key: string): string | undefined => completionSteps(doc).steps.find((step) => step.key === key)?.missing;

function empty(): RiskDocument {
  const doc = structuredClone(example(EXAMPLE_2));
  delete doc.context;
  delete doc.appetite;
  delete doc.drivers;
  delete doc.strategy;
  delete doc.responses;
  doc.risks = [];
  return doc;
}

describe('steps to complete', () => {
  it('starts a new document at the objectives, with the run and the print last', () => {
    const doc = empty();
    expect(completionSteps(doc)).toMatchObject({ done: 0, required: 6 });
    expect(states(doc)).toEqual({
      objectives: 'next',
      tolerance: 'todo',
      risks: 'todo',
      'risk-data': 'todo',
      driver: 'optional',
      budget: 'todo',
      responses: 'todo',
      print: 'last',
    });
    expect(missing(doc, 'objectives')).toBe('0 of 2 objectives have a statement.');
    expect(missing(doc, 'risk-data')).toBe('Add a risk first.');
    expect(missing(doc, 'print')).toBeUndefined();
  });

  it('ticks every step of example 2, so the run and the print are next', () => {
    const doc = example(EXAMPLE_2);
    expect(completionSteps(doc)).toMatchObject({ done: 6, required: 6 });
    expect(Object.values(states(doc))).toEqual(['done', 'done', 'done', 'done', 'done', 'done', 'done', 'next']);
  });

  it('names each open risk without an owner, an estimate or an objective', () => {
    const doc = structuredClone(example(EXAMPLE_2));
    const [r1, r2, , , , r6] = doc.risks;
    if (r1 === undefined || r2 === undefined || r6 === undefined) throw new Error('example 2 changed');
    r2.riskOwnerPointOfContact = ' ';
    delete r6.objectiveIds;
    delete r1.estimate;
    expect(states(doc)['risk-data']).toBe('next');
    expect(missing(doc, 'risk-data')).toBe('These risks need data: R-01, R-02, R-06.');
    expect(states(doc).print).toBe('last');
    // A closed risk needs no data.
    r1.status = 'Closed';
    r2.status = 'Closed';
    r6.status = 'Closed';
    expect(states(doc)['risk-data']).toBe('done');
  });

  it('needs 2 responses, 1 of them a candidate or selected', () => {
    const doc = structuredClone(example(EXAMPLE_2));
    doc.responses = (doc.responses ?? []).map((option) => ({ ...option, status: 'rejected' as const }));
    expect(missing(doc, 'responses')).toBe('No response is a candidate or selected.');
    doc.responses = doc.responses.slice(0, 1);
    expect(missing(doc, 'responses')).toBe('1 of 2 responses.');
  });

  it('keeps the driver optional, so it never blocks the run', () => {
    const doc = structuredClone(example(EXAMPLE_2));
    doc.risks = doc.risks.map((risk) => ({ ...risk, driverLinks: (risk.driverLinks ?? []).filter((link) => link.driverId === 'D-SITE') }));
    expect(states(doc).driver).toBe('optional');
    expect(missing(doc, 'driver')).toBe('No driver is linked to 2 risks.');
    expect(completionSteps(doc)).toMatchObject({ done: 6, required: 6 });
    expect(states(doc).print).toBe('next');
  });

  it('needs 3 points on the tolerance curve', () => {
    const doc = structuredClone(example(EXAMPLE_2));
    const curve = doc.appetite?.toleranceCurve;
    if (curve === undefined) throw new Error('example 2 changed');
    curve.points = [curve.points[0], curve.points[1]];
    expect(states(doc).tolerance).toBe('next');
    expect(missing(doc, 'tolerance')).toBe('The curve has 2 of 3 points.');
  });
});
