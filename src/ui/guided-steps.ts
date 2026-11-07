// The 9 steps of the guided mode (docs/ux/redesign-plan.md Sec. 3.2). The app sees each step
// in the document, except the run and the print, which the screen reports itself.
import type { Risk, RiskDocument } from '../schema/types';

export interface GuidedStep {
  readonly key: string;
  readonly title: string;
  readonly heading: string;
  readonly lead: string;
  readonly why: string;
  readonly optional?: boolean;
}

export const GUIDED_STEPS: readonly GuidedStep[] = [
  {
    key: 'company',
    title: 'Your company',
    heading: 'Your company',
    lead: 'Start with the basics. You can change each answer later.',
    why: 'The name and the currency go on each page of the decision record. NIST SP 800-221r1 calls this the enterprise context.',
  },
  {
    key: 'goals',
    title: 'Your goals',
    heading: 'Your goals',
    lead: 'Pick 1 goal or more. Your risks link to these goals.',
    why: 'Each risk links to one goal or more. The decision record then shows which goals each risk threatens. NIST IR 8286 calls these enterprise objectives.',
  },
  {
    key: 'tolerance',
    title: 'Loss you can take',
    heading: 'How much loss you can take',
    lead: 'Answer these questions with your management body. Most answers are one click.',
    why: 'The answers draw your tolerance curve. The optimization in step 8 compares the simulated loss of all your risks with this curve. NIST SP 800-221r1 Sec. 3.2.1 calls this risk appetite and risk tolerance.',
  },
  {
    key: 'risks',
    title: 'Your risks',
    heading: 'Your risks',
    lead: 'Start with the risks that worry you most. You can add more later. Take ideas from the catalogue, write your own, and add chances of a gain.',
    why: 'A short sentence "If X occurs, then Y happens" makes each risk clear. The catalogue gives a text and a category only. It never gives numbers, because only you know your company.',
  },
  {
    key: 'size',
    title: 'Size each risk',
    heading: 'Size each risk',
    lead: 'One risk at a time. Give an owner, a goal and 2 ranges.',
    why: 'The simulation needs ranges, not single numbers. A range shows how sure you are. NIST IR 8286A calls this risk analysis.',
  },
  {
    key: 'drivers',
    title: 'Shared causes',
    heading: 'Shared causes',
    lead: 'One cause can make 2 risks happen in the same year. You can skip this step.',
    why: 'Without shared causes, the simulation treats all risks as independent and shows too little chance of a very bad year.',
    optional: true,
  },
  {
    key: 'options',
    title: 'What you can do',
    heading: 'What you can do',
    lead: 'Add 1 option or more. The app compares each mix of options that fits the budget with doing nothing.',
    why: 'Each option changes how often a risk happens or how much one event costs. NIST SP 800-221r1 calls these risk responses.',
  },
  {
    key: 'plan',
    title: 'Budget and best plan',
    heading: 'Budget and best plan',
    lead: 'Type your budget. Then the app tests every mix of options that fits.',
    why: 'The app simulates many years for each mix of options. It ranks the mixes by their net benefit and checks each one against your tolerance curve.',
  },
  {
    key: 'record',
    title: 'Decision record',
    heading: 'Decision record',
    lead: 'This is the record for your management body. Print it or save it as PDF.',
    why: 'The record shows the goals, the tolerance, the risks and the decision in one place. The management body signs it.',
  },
];

export interface StepStatus {
  readonly done: boolean;
  // What is still missing, in plain words. Undefined when the step is done or optional.
  readonly missing?: string;
}

const filled = (text: string | undefined): boolean => text !== undefined && text.trim() !== '';
const openRisks = (doc: RiskDocument): Risk[] => doc.risks.filter((risk) => risk.status !== 'Closed');

// A new risk has the owner "Unassigned" (newRisk in identify.tsx). The guided mode asks for a
// real owner.
export const hasOwner = (risk: Risk): boolean => filled(risk.riskOwnerPointOfContact) && risk.riskOwnerPointOfContact !== 'Unassigned';

const hasRange = (value: unknown): boolean => {
  if (value === undefined || value === null || typeof value !== 'object') return false;
  const d = value as { type?: string; lower?: number; upper?: number; value?: number; min?: number; max?: number };
  if (d.type === 'constant') return d.value !== undefined;
  if (d.type === 'pert') return d.min !== undefined && d.max !== undefined;
  return d.lower !== undefined && d.upper !== undefined;
};

export function riskComplete(risk: Risk): boolean {
  const estimate = risk.estimate;
  return hasOwner(risk) && (risk.objectiveIds ?? []).length > 0 && estimate !== undefined && hasRange(estimate.frequency) && hasRange(estimate.impactPerEvent) && estimate.rationale.trim().length >= 10;
}


// planDone: a run gave a record of the current document. printed: the user printed it.
export function guidedStatus(doc: RiskDocument, planDone: boolean, printed: boolean): StepStatus[] {
  const objectives = (doc.context?.objectives ?? []).filter((objective) => filled(objective.statement)).length;
  const points = doc.appetite?.toleranceCurve?.points.length ?? 0;
  const risks = openRisks(doc);
  // The minimum that the simulation and the record need, not the AT-5 task. The AT-5 task
  // sheet asks for more (SPEC.md Sec. 12.5).
  const losses = risks.filter((risk) => risk.polarity !== 'positive').length;
  const incomplete = risks.filter((risk) => !riskComplete(risk)).map((risk) => risk.riskId);
  const linked = (doc.drivers ?? []).some((driver) => doc.risks.filter((risk) => (risk.driverLinks ?? []).some((link) => link.driverId === driver.id)).length >= 2);
  const options = (doc.responses ?? []).filter((option) => option.status === 'candidate' || option.status === 'selected').length;
  const budget = doc.strategy?.budget?.firstYearCash;
  const result = (missing: string | undefined): StepStatus => (missing === undefined ? { done: true } : { done: false, missing });
  return [
    result(filled(doc.document.title) ? undefined : 'Type the name of the register.'),
    result(objectives >= 1 ? undefined : 'Add 1 goal.'),
    result(points >= 2 ? undefined : `The tolerance curve needs 2 points or more. It has ${String(points)}.`),
    result(losses >= 1 ? undefined : 'Add 1 risk of a loss.'),
    result(risks.length === 0 ? 'Add risks in step 4 first.' : incomplete.length === 0 ? undefined : `These risks need data: ${incomplete.join(', ')}.`),
    linked ? { done: true } : { done: false },
    result(options >= 1 ? undefined : 'Add 1 option.'),
    result(budget === undefined ? 'Type the budget.' : planDone ? undefined : 'Click "Find the best portfolio".'),
    printed ? { done: true } : { done: false },
  ];
}
