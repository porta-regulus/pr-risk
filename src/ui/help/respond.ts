import type { HelpTexts } from './types';

export const RESPOND_HELP = {
  'respond.budget': {
    what: 'The money that you can spend on response options in the first year, and the method that selects the options.',
    why: 'The search keeps only the portfolios whose first-year cash fits in this budget. The decision record also shows the best portfolio at a budget 20% lower and 20% higher.',
    source: 'NIST SP 800-221r1 Sec. 5.3.2 and 5.4.1.',
  },
  'respond.budget-cash': {
    what: 'The total cash that you can spend in the first year. It includes one-off costs, annual costs and risk reserves.',
    why: 'A portfolio that needs more cash in year 1 than this amount is not affordable. The search does not rank it.',
    example: 'If the management body gives 60000 EUR for security next year, type 60000.',
    source: 'NIST SP 800-221r1 Sec. 5.4.1.',
  },
  'respond.options': {
    what: 'The actions that you can take against your risks, each with its cost and its effect on the estimates.',
    why: 'The app uses only these options when it searches for the best portfolio. You cannot compare an option that has no effect or no cost.',
    source: 'NIST SP 800-221r1 Sec. 3.6.',
  },
  'respond.option-title': {
    what: 'A short name for the response option.',
    why: 'The name shows in the ranked table and in the decision record. The management body reads it there.',
    example: 'Multi-factor authentication for all staff.',
  },
  'respond.option-type': {
    what: 'The kind of response. Mitigate, Transfer, Avoid and Accept are for negative risks. Realize, Share and Enhance are for opportunities.',
    why: 'The type must agree with the polarity of the risk that the option acts on. Transfer is usually insurance, and its effect is the loss that you keep.',
    source: 'NIST SP 800-221r1 Table 4 for negative risks and Table 5 for positive risks.',
  },
  'respond.option-status': {
    what: 'The stage of the option. Candidate and Selected options compete for the budget. Rejected and Implemented options do not.',
    why: 'Set an option to Rejected to keep it in the decision record without the search using it.',
  },
  'respond.option-owner': {
    what: 'The person who is responsible for the option when the company funds it.',
    example: 'IT manager.',
  },
  'respond.option-description': {
    what: 'What the option does, in a few sentences. Say what you buy, what you change and who does the work.',
    why: 'A reader of the decision record must understand the option without asking you.',
  },
  'respond.cost-oneoff': {
    what: 'The cost that you pay one time, at the start. For example a purchase, a setup or a project.',
    why: 'The app spreads it over the lifetime to get the annualised cost. It counts in full in the first-year cash.',
    example: 'Setup and first licences of a backup service, 8000 EUR.',
    source: 'NIST SP 800-221r1 Table 3, risk response cost.',
  },
  'respond.cost-annual': {
    what: 'The cost that you pay each year while the option is in place. For example licences, a service fee or an insurance premium.',
    why: 'It counts each year in the annualised cost and in the first-year cash.',
    source: 'NIST SP 800-221r1 Table 3, risk response cost.',
  },
  'respond.cost-lifetime': {
    what: 'The number of years that the one-off cost serves before you must pay it again.',
    why: 'The app divides the one-off cost by this number to get its part of the annualised cost. A longer lifetime makes the option cheaper per year.',
    example: 'A firewall that you replace after 5 years has a lifetime of 5.',
    source: 'NIST SP 800-221r1 Table 3, risk response cost.',
  },
  'respond.cost-reserve': {
    what: 'Money that you set aside in year 1 to pay for an event of the target risk. You get it back if no target event occurs.',
    why: 'The reserve counts in full in the first-year cash. In the annualised cost, the app multiplies it by the probability that a target event occurs.',
    source: 'NIST SP 800-221r1 Sec. 3.6 and 3.7.1.',
  },
  'respond.effect-target': {
    what: 'The risk or the driver that the option changes. A driver is one cause that many risks share.',
    why: 'The simulation replaces the estimate of this target with the estimate after the response. Two options with the same target are alternatives, and a portfolio never holds both.',
    source: 'NIST SP 800-221r1 Sec. 3.6.',
  },
  'respond.effect-frequency': {
    what: 'How often the events of the target happen per year when the response is in place.',
    why: 'This estimate replaces the current frequency in the simulation when the option is in a portfolio. The difference gives the benefit of the option.',
    example: 'You think that with the response the events happen between once in 20 years and once in 2 years. Type 0.05 and 0.5.',
    source: 'NIST SP 800-221r1 Sec. 3.6.',
  },
  'respond.effect-impact': {
    what: 'The loss or gain of one event when the response is in place. For insurance, it is the loss that you keep after the deductible and the limit.',
    why: 'This estimate replaces the current impact per event in the simulation when the option is in a portfolio.',
    example: 'The deductible is 10000 EUR and the limit is 500000 EUR. You keep the first 10000 EUR of each loss and each part above 500000 EUR. Write the deductible and the limit in the rationale.',
    source: 'NIST SP 800-221r1 Sec. 3.6.',
  },
  'respond.effect-rationale': {
    what: 'Why you think that the response changes the estimate this much. Give the evidence or the reasoning.',
    why: 'A reviewer must be able to check the effect. The decision record prints the rationale next to the effect.',
    example: 'The insurer pays above a deductible of 10000 EUR up to a limit of 500000 EUR.',
  },
  'respond.control-types': {
    what: 'The kinds of control that the option gives. Preventative stops an event. Deterrent makes an attack less attractive. Detective finds an event. Corrective limits the damage. Compensating replaces a control that you cannot use.',
    why: 'A good portfolio often mixes the types. The decision record lists them for each option.',
    source: 'NIST SP 800-221r1 Sec. 3.6.',
  },
  'respond.informative-references': {
    what: 'The controls in other frameworks that this option meets. Put one reference on each line.',
    why: 'Auditors can trace the option to the framework that they check.',
    example: 'CSF 2.0 PR.AA-03.',
    source: 'NIST SP 800-221r1 Sec. 3.6.',
  },
  'respond.bundle': {
    what: 'The options that this option combines. A bundle states the effect of the options together.',
    why: 'Two options that change the same target are alternatives, so a portfolio never holds both. A bundle lets the search compare the combination as one option.',
  },
  'respond.introduces-risks': {
    what: 'The new risks that the option causes. Such a risk goes into the simulation only when this option is in the portfolio.',
    why: 'The losses of an introduced risk count against the option, so its benefit is not too high.',
    example: 'Multi-factor authentication can cause lockouts that stop work.',
    source: 'NIST SP 800-221r1 Sec. 3.6.',
  },
  'respond.forced-choice': {
    what: 'A choice of leadership that the search must obey. Require puts the option in every portfolio. Exclude keeps it out of every portfolio.',
    why: 'Use it for a legal duty or a decision that is already made. The search then finds the best portfolio inside these choices.',
    source: 'NIST SP 800-221r1 Sec. 5.3.2.',
  },
  'respond.forced-reason': {
    what: 'Why leadership requires or excludes the option.',
    why: 'For an excluded option, the decision record prints the reason. A reader then sees that the choice did not come from the simulation.',
    example: 'A customer contract requires encrypted backups.',
    source: 'NIST SP 800-221r1 Sec. 5.3.2.',
  },
  'respond.forced-by': {
    what: 'The person or the body that made the choice.',
    why: 'The document keeps the name with the choice, so a reviewer knows whom to ask.',
    example: 'Managing director.',
  },
  'respond.run': {
    what: 'The portfolios that fit in the budget, ranked by the simulation.',
    why: 'Portfolios that stay under your tolerance curve come first, by net benefit. A matrix cannot rank portfolios, so the ranking uses the simulation only.',
    source: 'NIST SP 800-221r1 Sec. 5.3.2 and 5.4.1.',
  },
  'respond.find-best-portfolio': {
    what: 'Runs the simulation for each portfolio that fits in the budget, and ranks the portfolios.',
    why: 'The best portfolio stays under your tolerance curve and has the highest net benefit. The run uses only a document that the app can save. If you change the document after the run, run it again.',
    source: 'NIST SP 800-221r1 Sec. 3.6 and 5.3.2.',
  },
  'respond.print-record': {
    what: 'Prints the decision record. It shows the risks before and after, the best portfolio and the alternatives. It also shows the options that are not funded and the accepted residual risk.',
    why: 'The management body signs the printed decision record. The button works only when the run is current, so the decision record always agrees with the document.',
    source: 'NIST SP 800-221r1 Sec. 5.1.2, 5.3.2 and 5.4.1.',
  },
  'respond.ranked-table': {
    what: 'Each row is one portfolio. First-year cash is what you pay in year 1. Annualised cost spreads one-off costs over their lifetime. Annual benefit is the decrease in expected annual loss plus the increase in expected annual gain, with its simulation error. Net benefit is benefit minus annualised cost. Tolerance says if the portfolio stays under your tolerance curve.',
    why: 'The fiscal baseline row shows what the simple method gives. The two rows at other budgets show if more or less money changes the best portfolio.',
    source: 'NIST SP 800-221r1 Sec. 5.3.2 and 5.4.1.',
  },
  'respond.residual': {
    what: 'The risks that the best portfolio does not treat. The company accepts them as they are.',
    why: 'Each of these risks needs an acceptance record before the decision record is final. A person with authority must say who accepts the risk, until when and why.',
    source: 'NIST SP 800-221r1 Sec. 5.1.2 and 5.3.2.',
  },
} as const satisfies HelpTexts;
