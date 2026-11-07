import type { HelpTexts } from './types';

// Screen S2 Context and strategy. Context, roles, guided questions, appetite and strategy.
export const CONTEXT_HELP = {
  'context.context': {
    what: 'The facts about your company that every later step uses. They are the mission, the context, the stakeholders, the disciplines in scope, the objectives and the critical functions.',
    why: 'A risk is an effect on an objective. Without the context, the app cannot show which events matter to the company.',
    source: 'NIST SP 800-221r1 Sec. 1.1 and 3.1.',
  },
  'context.mission': {
    what: 'One or two sentences on what your company does and for whom.',
    why: 'You measure each risk against the mission and the objectives. A clear mission makes it easier to see which events matter.',
    example: 'We build and service packaging machines for food producers in the EU.',
    source: 'NIST SP 800-221r1 Sec. 3.1.',
  },
  'context.external-context': {
    what: 'The conditions outside the company that change your risks. For example the market, the law, the suppliers and the threats.',
    why: 'An external change can make a new risk or change the size of a known risk. The text helps the reader of the decision record see why.',
    example: 'Two large customers ask for proof of ICT security in each new contract.',
    source: 'NIST SP 800-221r1 Sec. 3.1.',
  },
  'context.internal-context': {
    what: 'The conditions inside the company that change your risks. For example the size, the systems, the people and the culture.',
    why: 'The internal context shows what the company can do to respond to a risk, and what it cannot do.',
    example: 'We have 45 staff and one IT person. Most systems are cloud services.',
    source: 'NIST SP 800-221r1 Sec. 3.1.',
  },
  'context.stakeholders': {
    what: 'The persons and groups that the risks affect or that have a say in them. Type one on each line.',
    why: 'The stakeholders tell you whose loss to count and who must see the decision record.',
    example: 'Customers, the bank, the owners, the staff.',
    source: 'NIST SP 800-221r1 Sec. 3.1.',
  },
  'context.disciplines': {
    what: 'The kinds of ICT risk that this register covers.',
    why: 'The disciplines set the scope. A risk outside the scope belongs in another register or needs a new discipline here.',
    example: 'A company that sells connected devices selects Cybersecurity, Privacy and Internet of Things.',
    source: 'NIST SP 800-221r1 Sec. 1.1 and 6.',
  },
  'context.other-disciplines': {
    what: 'Kinds of ICT risk in scope that are not in the list above. Type one on each line.',
    why: 'The list above has the disciplines that NIST names. Add the others here, so that the scope is complete.',
    example: 'Cloud services.',
    source: 'NIST SP 800-221r1 Sec. 1.1.',
  },
  'context.objectives': {
    what: 'The objectives of the company that risks can affect. Each objective has an ID, a kind and a statement. The kind is strategic, operations, reporting or compliance. The column Risks shows how many risks refer to the objective.',
    why: 'Each risk must name at least one objective, so that the enterprise sees why the risk matters. You cannot remove an objective or change its ID while a risk refers to it.',
    example: 'OBJ-1, Operations. Deliver 98 out of 100 orders on time.',
    source: 'NIST SP 800-221r1 Sec. 2.3 and 4.1.',
  },
  'context.functions': {
    what: 'The business functions that the company needs most, each with a criticality label. The column Assets shows how many assets support the function.',
    why: 'An asset gets the highest criticality of the functions that it supports. This tells you which assets to protect first.',
    example: 'F-1, Order intake, criticality High.',
    source: 'NIST SP 800-221r1 Sec. 5.1.1.',
  },
  'context.roles': {
    what: 'The risk roles that exist in your company. Each row has the role, its level, the person who holds it and the responsibilities. The level goes from enterprise oversight down to one system.',
    why: 'The roles show who decides on risk and who does the work. The app keeps the list only. No step of the app uses it to send tasks.',
    example: 'Risk owner for ICT, level Organization, holder the IT lead.',
    source: 'NIST SP 800-221r1 Sec. 3.1.1 and Table 1.',
  },
  'context.guided-questions': {
    what: 'A set of short questions for the management body. The answers give the capacity, draft appetite statements and the points of the tolerance curve.',
    why: 'The tolerance curve must come from the management body, not from the app. The questions let the body give it in one short meeting. Most answers are one click.',
    source: 'NIST SP 800-221r1 Sec. 3.2.1. Hubbard and Seiersen, How to Measure Anything in Cybersecurity Risk, 2nd ed., 2023.',
  },
  'context.guided-start-again': {
    what: 'Deletes all answers of the last session and starts a new session with the date of today.',
    why: 'The tolerance curve and the appetite statements do not change. Only a new click on "Use these answers" changes them. Use Undo last change to get the old answers back.',
  },
  'context.guided-capacity': {
    what: 'The loss in one year that forces the company to cut staff, break a loan covenant or close. Move the slider or type the amount.',
    why: 'Every amount in the tolerance questions comes from the capacity. Only the order of size matters here.',
    example: 'Cash of 300000 plus unused credit of 200000 gives a capacity of about 500000.',
    source: 'NIST SP 800-221r1 Sec. 3.2.1.',
  },
  'context.guided-rationale': {
    what: 'A short note on how you found the capacity. It is optional.',
    why: 'A reader of the decision record can then check the amount.',
    example: 'Cash and credit line from the last balance sheet, told by the finance lead.',
  },
  'context.guided-capacity-unknown': {
    what: 'Removes the capacity of the guided questions and goes on to the next stage.',
    why: 'Without a capacity the app cannot ask the tolerance questions. You can answer the criteria and come back to the capacity later.',
  },
  'context.guided-event': {
    what: 'One event that hurts this objective. After you type it, ask the management body if the event is acceptable.',
    why: 'Each "Not acceptable" answer gives a draft appetite statement when you use the answers at the end.',
    example: 'Your main customer system is down for 3 days.',
    source: 'NIST SP 800-221r1 Sec. 3.2.1 and Table 2.',
  },
  'context.guided-tolerance-question': {
    what: 'The app asks 3 questions for each of 4 chances per year. The chances are 1 in 100, 1 in 20, 1 in 5 and 1 in 2. Each answer moves the amount up or down. The third answer gives the highest loss that the body accepts at that chance.',
    why: 'The 4 amounts become the points of the tolerance curve. "Do not know" leaves a point empty.',
    source: 'Hubbard and Seiersen, How to Measure Anything in Cybersecurity Risk, 2nd ed., 2023.',
  },
  'context.guided-cross-check': {
    what: 'A second question on one tolerance point. It asks how much the body pays each year to remove the chance of that loss.',
    why: 'The expected loss of the point is the loss times its chance. If the body pays more than 2 times this amount, the point is maybe too high. The app shows a flag, not an error.',
  },
  'context.guided-held-on': {
    what: 'The date when the management body answered the questions.',
    why: 'The decision record shows when the management body set the appetite.',
  },
  'context.guided-participants': {
    what: 'The names and roles of the persons who answered.',
    why: 'The answers are valid only if the right persons gave them. The app needs this field before it uses the answers.',
    example: 'Anna Berg, managing director. Tom Vos, IT lead.',
  },
  'context.guided-use-answers': {
    what: 'Writes the tolerance points from the answers into the tolerance curve below. It also adds a draft appetite statement for each "Not acceptable" event.',
    why: 'The new points replace the old points of the curve. The curve is a draft until the management body approves it in "Approved by" and "Approved on". Use Undo last change to go back.',
    source: 'NIST SP 800-221r1 Sec. 3.2.1.',
  },
  'context.appetite': {
    what: 'The risk that the company can take and the risk that it wants to take. Capacity is the maximum loss that the company can absorb. Appetite is the risk that it accepts to reach its objectives. Tolerance is the limit for each kind of risk.',
    why: 'The simulation compares the annual loss of all risks with the tolerance curve. The search for the best portfolio uses this comparison.',
    source: 'NIST SP 800-221r1 Sec. 3.2.1.',
  },
  'context.capacity': {
    what: 'The maximum loss in one year that the company can absorb. Above it, the company must cut staff, break a loan covenant or close.',
    why: 'The analysis shows the probability of an annual loss above the capacity. The starting points of the tolerance curve also come from it.',
    example: 'Cash plus unused credit plus insurance cover.',
    source: 'NIST SP 800-221r1 Sec. 3.2.1 and 3.7.',
  },
  'context.capacity-rationale': {
    what: 'How you found the capacity, in one or two sentences.',
    why: 'A reader of the decision record can then check the amount.',
    example: 'Cash and credit line from the 2026 balance sheet, told by the finance lead.',
    source: 'NIST SP 800-221r1 Sec. 3.2.1.',
  },
  'context.tolerance-curve': {
    what: 'Each row is one point. It gives an annual loss and the highest probability per year that you accept for a loss above that amount. Higher losses must have lower probabilities.',
    why: 'The simulation shows the probability of each annual loss for all risks together. Where that line goes above the tolerance curve, the risk is too high. The search ranks the portfolios that stay under the curve first.',
    example: 'If you accept a loss above 50000 at most once in 10 years, type 50000 and 0.1.',
    source: 'NIST SP 800-221r1 Sec. 3.2.1. Hubbard and Seiersen, How to Measure Anything in Cybersecurity Risk, 2nd ed., 2023.',
  },
  'context.curve-starting-points': {
    what: 'Replaces all points of the curve with 4 points from the capacity. They are 2, 10, 33 and 100 percent of the capacity at the probabilities 0.5, 0.2, 0.05 and 0.01.',
    why: 'The points let you see a result at once. They are not advice. Replace them with the answers of the management body, for example from the guided questions.',
  },
  'context.curve-approved-by': {
    what: 'The person or body that approved the tolerance curve.',
    why: 'The decision record shows who approved the curve. Without a name it says nobody yet, and the curve stays a draft.',
    example: 'Management board.',
  },
  'context.curve-approved-on': {
    what: 'The date when the curve was approved.',
    why: 'The decision record shows the date next to the name, so a reader knows when the curve became valid.',
  },
  'context.statements': {
    what: 'Appetite statements in words about the risk that the company accepts. Each statement holds tolerances, controls and indicators. The table shows all statements together.',
    why: 'A statement makes the appetite clear to staff. A tolerance with a trigger lets the app show when a measured value goes past the limit.',
    source: 'NIST SP 800-221r1 Sec. 3.2.1 and Table 9.',
  },
  'context.statement-title': {
    what: 'A short name for the appetite statement.',
    why: 'The table of statements and the screen Monitor and adjust show this name next to the ID of the statement.',
    example: 'Website availability.',
  },
  'context.statement-appetite': {
    what: 'The risk that the company accepts in this area, in one or two sentences.',
    example: 'We accept short outages of the web shop in exchange for fast releases.',
    source: 'NIST SP 800-221r1 Sec. 3.2.1 and Table 2.',
  },
  'context.statement-categories': {
    what: 'The kinds of risk that the statement covers. Select one or more.',
    why: 'When a tolerance breaks or a KRI fires, the app sets the risks of these categories to Review needed. The enterprise can also collect the statements of all registers by kind.',
  },
  'context.tolerance-id': {
    what: 'A short code for the tolerance, unique in this statement.',
    why: 'The check results and the review reasons name the tolerance by this code.',
    example: 'AS-1-TOL1, which the app proposes for the first tolerance of statement AS-1.',
  },
  'context.tolerance-text': {
    what: 'The limit for this risk in words, measurable if possible.',
    example: 'The web shop is not down for more than 4 hours in a row.',
    source: 'NIST SP 800-221r1 Sec. 3.2.1 and Table 2.',
  },
  'context.trigger-combine': {
    what: 'Tells if the trigger fires when all conditions are true or when one condition is true.',
    why: 'Use all conditions for a strict limit that needs two facts together. Use any condition when each fact alone is a warning.',
  },
  'context.trigger-conditions': {
    what: 'Each row is one condition. It names a metric, an operator, a threshold and a unit. The trigger fires when the conditions are true.',
    why: 'A trigger turns a tolerance or an indicator into a check. You can type a measured value under "Check values" to test it. The check saves nothing.',
    example: 'Outage hours, above, 4, hours.',
    source: 'NIST SP 800-221r1 Table 9.',
  },
  'context.trigger-note': {
    what: 'A note on how to read the trigger, for example where the metric comes from.',
    example: 'Outage hours come from the monitor of the hosting company.',
  },
  'context.controls': {
    what: 'The controls that keep the risk inside the tolerance. Type one on each line.',
    example: 'Second web server in another data center.',
    source: 'NIST SP 800-221r1 Table 9.',
  },
  'context.indicator-id': {
    what: 'A short code for the indicator, unique in this statement.',
    why: 'The check results and the review reasons name the indicator by this code.',
    example: 'AS-1-IND1, which the app proposes for the first indicator of statement AS-1.',
  },
  'context.indicator-kind': {
    what: 'A KPI (key performance indicator) measures performance. A leading KRI (key risk indicator) warns before a loss. A lagging KRI measures a loss that happened.',
    why: 'Leading indicators give time to act. Lagging indicators show if the tolerance holds.',
    source: 'NIST SP 800-221r1 Sec. 5.1.2 and Table 9.',
  },
  'context.indicator-text': {
    what: 'What the indicator measures, in words.',
    example: 'Number of failed backups each week.',
  },
  'context.use-example': {
    what: 'Five example pairs of an appetite statement and a tolerance statement from NIST, quoted exactly. The button below each example adds it as a new statement.',
    why: 'The words are a starting point. Change them to fit your company and add the trigger that measures the tolerance. A similar NIST example gives 2 hours for a website tolerance.',
    source: 'NIST SP 800-221r1 Table 2, p. 17, line 654. The 2 hours come from Table 9, example 3. Our comment N24 to NIST asks NIST to align the two values.',
  },
  'context.strategy': {
    what: 'The rules for how the company measures and reports risk. They are the scales, the review cycle, the budget, the thresholds and the method that selects response options.',
    why: 'The same rules for all risks make the results comparable.',
    source: 'NIST SP 800-221r1 Sec. 3.2.2.',
  },
  'context.scale-bands': {
    what: 'Each row is one band of the scale. It has a label, a lower limit, an upper limit and a representative value. The representative value is the number that the app uses for the label.',
    why: 'A label such as High then means the same number in every risk. If a risk uses a label that is not on the scale, the app shows an error.',
    example: 'Label Medium, lower 0.1, upper 0.3, representative 0.2.',
    source: 'NIST SP 800-221r1 Sec. 2.4.2 and 3.2.2.',
  },
  'context.review-months': {
    what: 'The number of months between two reviews of the register.',
    why: 'It tells the risk owners how often to look at the register again. The app keeps it in the document.',
    example: 'Type 6 for a review two times each year.',
    source: 'NIST SP 800-221r1 Sec. 3.2.2.',
  },
  'context.reporting-months': {
    what: 'The number of months between two reports to the management body or to the parent register.',
    why: 'It tells the risk owners how often to report. The app keeps it in the document.',
    example: 'Type 3 for a report each quarter.',
    source: 'NIST SP 800-221r1 Sec. 3.2.2.',
  },
  'context.budget-first-year-cash': {
    what: 'The money available for response options in the first year.',
    why: 'The search for the best portfolio uses only the portfolios whose first-year cash fits in this amount.',
    source: 'NIST SP 800-221r1 Sec. 3.2.2 and 5.4.1.',
  },
  'context.budget-capex': {
    what: 'The highest amount for investments, for example new hardware or a project.',
    why: 'It records the limit that the management body sets for investments. The search for the best portfolio uses the first-year cash only.',
    source: 'NIST SP 800-221r1 Sec. 3.2.2.',
  },
  'context.budget-opex': {
    what: 'The highest amount for running costs each year, for example licences and services.',
    why: 'It records the limit that the management body sets for running costs. The search for the best portfolio uses the first-year cash only.',
    source: 'NIST SP 800-221r1 Sec. 3.2.2.',
  },
  'context.budget-fiscal-start': {
    what: 'The first day of your financial year.',
    why: 'The decision record uses it as the date by which the selected response options are in place.',
    source: 'NIST SP 800-221r1 Sec. 3.2.2.',
  },
  'context.inclusion-threshold': {
    what: 'The exposure below which a risk need not stay in the register. For a risk with an estimate, the exposure is its expected annual loss.',
    why: 'It keeps the register short. The ranking table marks a risk below this amount, but you can keep the risk.',
    source: 'NIST SP 800-221r1 Sec. 3.5.',
  },
  'context.escalation-threshold': {
    what: 'The exposure at or above which a risk must also appear in the parent register. For a risk with an estimate, the exposure is its expected annual loss.',
    why: 'Large risks then reach the level of the company that can fund the response. The screen Enterprise view marks each such entry.',
    source: 'NIST SP 800-221r1 Sec. 5.2.2 and 5.3.3.',
  },
  'context.optimization-method': {
    what: 'How the app selects response options within the budget. Algorithmic runs the simulation for each affordable portfolio and ranks the portfolios. Fiscal takes the risks by expected annual loss, highest first, and funds their cheapest options until the money ends. Operational is the algorithmic search inside the options that leadership requires or excludes.',
    why: 'The decision record always shows the fiscal result next to the algorithmic result.',
    source: 'NIST SP 800-221r1 Sec. 5.3.2.',
  },
  'context.appetite-table': {
    what: 'The appetite statements side by side, one column for each statement. The rows are the appetite, the tolerances, the controls, the KPIs, the leading KRIs and the lagging KRIs.',
    why: 'This layout makes it easy to see if each statement has a tolerance, a control and an indicator.',
    source: 'NIST SP 800-221r1 Table 9.',
  },
  'context.trigger-value': {
    what: 'A test value for a metric that a tolerance or an indicator of this statement uses. The app does not keep the value.',
    why: 'Type values to see which indicators fire and which tolerances break before you rely on the statement. Record real values on the screen Monitor and adjust.',
    source: 'NIST SP 800-221r1 Table 9.',
  },
} as const satisfies HelpTexts;
