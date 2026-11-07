import type { HelpTexts } from './types';

// Help texts of the fields of the guided mode. The step texts ("Why we ask this") are in
// ../guided-steps.ts.
export const GUIDED_HELP = {
  'guided.register-name': {
    what: 'The name of this risk document.',
    why: 'The name shows on the start screen and in the file name of each export. It also shows on each page of the printed decision record.',
    example: 'Risk register 2027.',
  },
  'guided.company': {
    what: 'The legal or common name of your company.',
    why: 'The decision record names the company, so the management body and an auditor know whose risks it shows.',
    example: 'Example Machinery GmbH.',
  },
  'guided.mission': {
    what: 'One sentence on what your company does and for whom.',
    why: 'The mission tells which events hurt the company most. A risk that stops the main service is more serious than a risk to a side activity.',
    example: 'We build and service packaging machines for food producers in the EU.',
    source: 'NIST SP 800-221r1 Sec. 3.1.',
  },
  'guided.example-goals': {
    what: 'Four common goals of a small company, one of each kind. Tick each goal that is true for you.',
    why: 'Each risk links to the goals that it threatens. The examples give you a fast start. You can remove a goal while no risk links to it.',
    source: 'NIST SP 800-221r1 Sec. 2.3 and 4.1.',
  },
  'guided.own-goal': {
    what: 'A goal of your company in your own words. Write what the company wants to achieve, not a risk.',
    why: 'A clear goal makes it easy to see which risks matter. The decision record lists each goal with the risks that threaten it.',
    example: 'Ship spare parts within 48 hours.',
  },
  'guided.goal-kind': {
    what: 'The group of the goal. Strategic goals are about growth and direction. Operations goals are about daily work. Reporting goals are about correct reports. Compliance goals are about laws and contracts.',
    why: 'The enterprise risk profile shows the risks of each goal under the kind of the goal. The management body then sees which kind of goal carries the most risk.',
    source: 'NIST SP 800-221r1 Sec. 2.3 and 4.1.',
  },
  'guided.tolerance-table': {
    what: 'The points of your tolerance curve that your answers made. Each row says how often you accept an annual loss above an amount.',
    why: 'Step 8 compares the simulated losses of all your risks with these points. A plan that goes above a point is not within your tolerance.',
    example: '1 in 20 next to 500 000 means this. You accept a year with a loss above 500 000 not more often than once in 20 years.',
    source: 'NIST SP 800-221r1 Sec. 3.2.1.',
  },
  'guided.catalogue': {
    what: 'A list of common ICT risks, in groups. Select one to add it with its text and category.',
    why: 'The catalogue helps you to remember the usual risks. It gives no numbers. Only you know how often a risk can happen to your company and what it costs.',
    source: 'NIST SP 800-221r1 Sec. 3.3.',
  },
  'guided.own-risk': {
    what: 'A risk that the catalogue does not have, in one sentence with a cause and an effect.',
    why: 'A cause and an effect make it clear what can happen and what it does to the company. Then it is easier to estimate.',
    example: 'If our only welder becomes ill for a month, then the delivery of three orders is late.',
    source: 'NIST SP 800-221r1 Sec. 3.3.4.',
  },
  'guided.opportunity': {
    what: 'Tick this when the event brings a gain, not a loss. NIST calls this an opportunity, or a positive risk.',
    why: 'An opportunity competes for the same budget as the protection against losses. The plan can select it when its net benefit is higher.',
    example: 'If we get a security label for our product, then we can sell to two more large customers.',
    source: 'NIST SP 800-221r1 Sec. 2.4.6 and 3.8.',
  },
  'guided.owner': {
    what: 'The role that watches this risk and reports on it. Write a role, not the name of a person.',
    why: 'People often forget a risk that has no owner. A role stays correct when a person leaves.',
    example: 'IT lead, production manager or managing director.',
    source: 'NIST IR 8286 Rev. 1.',
  },
  'guided.risk-goals': {
    what: 'The goals that this risk can stop or delay. Tick one goal or more.',
    why: 'The decision record shows, for each goal, the risks that threaten it. The enterprise risk profile uses the link to group the risks by goal.',
    source: 'NIST SP 800-221r1 Sec. 4.1.',
  },
  'guided.give-ranges': {
    what: 'Opens two fields for ranges. One is for how often the event happens. The other is for the loss of one event. The fields start empty.',
    why: 'The simulation needs your ranges to calculate the loss in a year. The app never fills in a number for you.',
    source: 'NIST SP 800-221r1 Sec. 3.4.2.',
  },
  'guided.rationale': {
    what: 'A short note on where your ranges come from.',
    why: 'Another person can then check the ranges and update them when new facts come in. The decision record shows the note.',
    example: 'Two outages in the last 5 years. The insurer reports similar costs for companies of our size.',
    source: 'NIST SP 800-221r1 Sec. 3.4.2.',
  },
  'guided.driver-links': {
    what: 'Tick each risk that one event of this shared cause can make happen.',
    why: 'Linked risks can then happen in the same year. Without the link, the simulation treats them as independent. It then shows too low a chance of a very bad year.',
    source: 'Lindskog and McNeil, Common Poisson Shock Models, ASTIN Bulletin 33(2), 2003.',
  },
  'guided.trigger-probability': {
    what: 'The chance that one event of the shared cause makes this risk happen, as a number from 0 to 1.',
    why: 'A high number links the risks strongly. A response on the shared cause then lowers all linked risks together.',
    example: 'If you think that 3 of 10 break-ins at the provider cause ransomware at your company, type 0.3.',
  },
  'guided.budget': {
    what: 'The cash that you can spend on response options in the first year, in the currency of the document.',
    why: 'The app tests only the portfolios, the mixes of options, that fit in this amount. A higher budget can give a better plan. The decision record shows the best plan at a budget 20% lower and 20% higher.',
    source: 'NIST SP 800-221r1 Sec. 3.2.2 and 5.4.1.',
  },
} as const satisfies HelpTexts;
