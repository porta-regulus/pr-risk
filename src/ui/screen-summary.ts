// The state line at the top of each full editor screen (docs/ux/redesign-plan.md Sec. 3.3
// item 2). Plain words, counted from the document. The line tells what is there and what needs
// work, so the user does not have to scroll to find out.
import type { RiskDocument } from '../schema/types';
import { hasOwner } from './guided-steps';
import { money } from './report';

export type EditorScreen = 'context' | 'identify' | 'prioritize' | 'respond' | 'monitor' | 'enterprise';

const count = (n: number, one: string, many = `${one}s`): string => `${String(n)} ${n === 1 ? one : many}`;
const hasEstimate = (risk: RiskDocument['risks'][number]): boolean => risk.estimate !== undefined;

export function screenSummary(doc: RiskDocument, screen: EditorScreen, today: string): string[] {
  const currency = doc.document.currency;
  const risks = doc.risks.filter((risk) => risk.status !== 'Closed');
  switch (screen) {
    case 'context': {
      const goals = (doc.context?.objectives ?? []).filter((objective) => objective.statement.trim() !== '').length;
      const points = doc.appetite?.toleranceCurve?.points.length ?? 0;
      const capacity = doc.appetite?.capacity?.amount;
      const budget = doc.strategy?.budget?.firstYearCash;
      return [
        goals === 0 ? 'No goal yet.' : `${count(goals, 'goal')}.`,
        points === 0 ? 'No tolerance curve yet.' : `A tolerance curve with ${count(points, 'point')}.`,
        capacity === undefined ? 'No capacity yet.' : `A capacity of ${money(capacity)} ${currency}.`,
        budget === undefined ? 'No budget yet.' : `A budget of ${money(budget)} ${currency}.`,
      ];
    }
    case 'identify': {
      const noEstimate = risks.filter((risk) => !hasEstimate(risk)).length;
      const noOwner = risks.filter((risk) => !hasOwner(risk)).length;
      const drivers = (doc.drivers ?? []).length;
      return [
        `${count(risks.length, 'open risk')} in ${count(doc.registers.length, 'register')}.`,
        ...(noEstimate === 0 ? [] : [`${count(noEstimate, 'risk needs', 'risks need')} an estimate.`]),
        ...(noOwner === 0 ? [] : [`${count(noOwner, 'risk has', 'risks have')} no owner.`]),
        `${count(drivers, 'shared cause')}.`,
      ];
    }
    case 'prioritize': {
      const estimated = risks.filter(hasEstimate).length;
      const rest = risks.length - estimated;
      return [
        `The simulation ranks ${String(estimated)} of ${count(risks.length, 'open risk')}.`,
        ...(rest === 0 ? [] : [`${count(rest, 'risk needs', 'risks need')} an estimate before it can rank ${rest === 1 ? 'it' : 'them'}.`]),
        (doc.appetite?.toleranceCurve?.points.length ?? 0) === 0 ? 'No tolerance curve yet, so no tolerance check.' : 'The chart compares the losses with the tolerance curve.',
      ];
    }
    case 'respond': {
      const options = doc.responses ?? [];
      const selected = options.filter((option) => option.status === 'selected' || option.status === 'implemented').length;
      const budget = doc.strategy?.budget?.firstYearCash;
      return [
        `${count(options.length, 'response option')}, ${String(selected)} selected or done.`,
        budget === undefined ? 'No budget yet.' : `A budget of ${money(budget)} ${currency}.`,
      ];
    }
    case 'monitor': {
      const statements = (doc.appetite?.statements ?? []).length;
      const due = risks.filter((risk) => risk.reviewDue !== undefined && risk.reviewDue < today).length;
      const accepted = risks.filter((risk) => risk.acceptance !== undefined).length;
      const lapsed = risks.filter((risk) => risk.acceptance?.validUntil !== undefined && risk.acceptance.validUntil < today).length;
      return [
        `${count(statements, 'appetite statement')} with indicators.`,
        due === 0 ? 'No review date has passed.' : `${count(due, 'risk is', 'risks are')} past the review date.`,
        `${count(accepted, 'accepted risk')}${lapsed === 0 ? '' : `, ${String(lapsed)} no longer valid`}.`,
        `${count((doc.forecasts ?? []).length, 'forecast')}.`,
      ];
    }
    case 'enterprise': {
      const top = doc.registers.filter((register) => register.parentRegisterId === undefined).length;
      return [`${count(doc.registers.length, 'register')}, ${String(top)} at the top level.`, `${count(risks.length, 'open risk')} in all registers.`];
    }
  }
}
