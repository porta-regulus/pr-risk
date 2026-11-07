// The panel "Steps to complete" on screens S2 to S7 (SPEC.md Sec. 5). It leads a first-time
// user from the first objective to the printed decision record, in the order of the AT-5 task
// (Sec. 12.5). The app sees each step in the saved document. It cannot see the last step,
// because a run and a print change nothing in the document.
import type { RiskDocument } from '../schema/types';
import type { ScreenName } from './editor';

// done: the document shows the step. next: the first required step that is not done.
// todo: a later required step. optional: a step that the decision record does not need.
// last: the run and the print, before all required steps are done.
export type StepState = 'done' | 'next' | 'todo' | 'optional' | 'last';

export interface Step {
  readonly key: string;
  readonly title: string;
  readonly how: string;
  readonly screen: Exclude<ScreenName, 'start'>;
  // The id of the heading where the step starts on its screen.
  readonly section: string;
  readonly state: StepState;
  // What is still missing, for example the risks that need data.
  readonly missing?: string;
}

export interface Steps {
  readonly steps: readonly Step[];
  readonly done: number;
  readonly required: number;
}

interface Definition {
  readonly key: string;
  readonly title: string;
  readonly how: string;
  readonly screen: Exclude<ScreenName, 'start'>;
  readonly section: string;
  readonly kind: 'required' | 'optional' | 'last';
  // undefined means done. A text says what is missing.
  readonly check: (doc: RiskDocument) => string | undefined;
}

const filled = (text: string | undefined): boolean => text !== undefined && text.trim() !== '';

const openRisks = (doc: RiskDocument) => doc.risks.filter((risk) => risk.status !== 'Closed');

const DEFINITIONS: readonly Definition[] = [
  {
    key: 'objectives',
    title: 'Add your objectives',
    how: 'An objective is a goal of your company, for example "Deliver every order on time". Under Objectives, click "Add an objective". Select the kind and type the statement. Add 1 objective or more.',
    screen: 'context',
    section: 'objectives-title',
    kind: 'required',
    check: (doc) => {
      const count = (doc.context?.objectives ?? []).filter((objective) => filled(objective.statement)).length;
      return count >= 1 ? undefined : 'No objective has a statement.';
    },
  },
  {
    key: 'tolerance',
    title: 'Draw your tolerance curve',
    how: 'The curve shows how much loss per year your company can accept. Each point is an amount of loss and the highest chance per year that you accept for a loss above that amount. Click "Add a point" and type the 2 values. Add 2 points or more. If you know your capacity, type it and click "Use the starting points from capacity". Then check the points. You can also click "Start the guided questions" and answer them with your management body. The answers set the points.',
    screen: 'context',
    section: 'appetite-title',
    kind: 'required',
    check: (doc) => {
      const count = doc.appetite?.toleranceCurve?.points.length ?? 0;
      return count >= 2 ? undefined : `The curve has ${String(count)} of 2 points.`;
    },
  },
  {
    key: 'risks',
    title: 'Add your risks',
    how: 'A risk is an event that can cause a loss or a gain. In "Risk description", type a sentence like "If X occurs, then Y happens", and click "Add risk to". You can also select a template under "Add a risk from the catalogue". For a chance of a gain, set Polarity to "Positive (opportunity)".',
    screen: 'identify',
    section: 'risks-title',
    kind: 'required',
    check: (doc) => (openRisks(doc).length > 0 ? undefined : 'The register has no risk yet.'),
  },
  {
    key: 'risk-data',
    title: 'Give each risk an owner, an estimate and an objective',
    how: 'Click "Edit" next to a risk. On the tab Scenario, type the risk owner. On the tab Estimate, click "Add an estimate". Answer the questions with a range that you are 90% sure of, and type the reason in Rationale. On the tab Links, select 1 or more objectives. Do this for each risk.',
    screen: 'identify',
    section: 'risks-title',
    kind: 'required',
    check: (doc) => {
      const risks = openRisks(doc);
      if (risks.length === 0) return 'Add a risk first.';
      const incomplete = risks
        .filter((risk) => !filled(risk.riskOwnerPointOfContact) || risk.estimate === undefined || (risk.objectiveIds ?? []).length === 0)
        .map((risk) => risk.riskId);
      return incomplete.length === 0 ? undefined : `These risks need data: ${incomplete.join(', ')}.`;
    },
  },
  {
    key: 'driver',
    title: 'Link a shared cause',
    how: 'A driver is one cause that can make 2 or more risks occur in the same year, for example the outage of one supplier. Under Drivers, click "Add a driver" and fill in its fields. Then edit 2 risks. On the tab Drivers of each risk, click "Link a driver". You can skip this step.',
    screen: 'identify',
    section: 'drivers-title',
    kind: 'optional',
    check: (doc) =>
      (doc.drivers ?? []).some((driver) => doc.risks.filter((risk) => (risk.driverLinks ?? []).some((link) => link.driverId === driver.id)).length >= 2)
        ? undefined
        : 'No driver is linked to 2 risks.',
  },
  {
    key: 'budget',
    title: 'Set your budget',
    how: 'Type the cash that you can spend on responses in the first year, in "Budget, first-year cash".',
    screen: 'respond',
    section: 'budget-title',
    kind: 'required',
    check: (doc) => (doc.strategy?.budget?.firstYearCash === undefined ? 'The budget is not set.' : undefined),
  },
  {
    key: 'responses',
    title: 'Add your responses',
    how: 'A response is an action that changes a risk, for example offline backups. Click "Add a response option". Type the title and the costs. Select the risk that the response changes, and say what changes. Add 1 response or more. The app compares each mix that fits the budget with doing nothing.',
    screen: 'respond',
    section: 'options-title',
    kind: 'required',
    check: (doc) => {
      const options = doc.responses ?? [];
      if (options.length === 0) return 'No response yet.';
      return options.some((option) => option.status === 'candidate' || option.status === 'selected') ? undefined : 'No response is a candidate or selected.';
    },
  },
  {
    key: 'print',
    title: 'Find the best portfolio and print the decision record',
    how: 'Click "Find the best portfolio" and wait for the result. Then click "Print the decision record". Give the printed record to the people who approve the budget. The app does not tick this step, because a print does not change the document.',
    screen: 'respond',
    section: 'run-title',
    kind: 'last',
    check: () => 'Not seen by the app.',
  },
];

export function completionSteps(doc: RiskDocument): Steps {
  const missing = DEFINITIONS.map((definition) => definition.check(doc));
  const required = DEFINITIONS.filter((definition) => definition.kind === 'required').length;
  const done = DEFINITIONS.filter((definition, i) => definition.kind === 'required' && missing[i] === undefined).length;
  const next = DEFINITIONS.findIndex((definition, i) => definition.kind === 'required' && missing[i] !== undefined);
  const steps = DEFINITIONS.map((definition, i): Step => {
    const state: StepState =
      definition.kind === 'last'
        ? done === required
          ? 'next'
          : 'last'
        : missing[i] === undefined
          ? 'done'
          : definition.kind === 'optional'
            ? 'optional'
            : i === next
              ? 'next'
              : 'todo';
    const text = missing[i];
    return {
      key: definition.key,
      title: definition.title,
      how: definition.how,
      screen: definition.screen,
      section: definition.section,
      state,
      ...(state === 'done' || definition.kind === 'last' || text === undefined ? {} : { missing: text }),
    };
  });
  return { steps, done, required };
}
