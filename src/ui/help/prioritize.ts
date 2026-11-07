import type { HelpTexts } from './types';

export const PRIORITIZE_HELP = {
  'prioritize.lec': {
    what: 'The result of the simulation for all registers together and for each register. It gives the expected annual loss, the probability of a loss above the capacity and the tolerance gap.',
    why: 'This shows if the total risk stays under the tolerance curve. One risk can be small, but many risks together can go above the curve. A tolerance gap above 0 means that the curve is breached.',
    source: 'NIST SP 800-221r1 Sec. 3.5. Hubbard and Seiersen, How to Measure Anything in Cybersecurity Risk, 2nd ed., 2023.',
  },
  'prioritize.lec-chart': {
    what: 'Each line shows the probability that the loss in one year is more than the amount on the horizontal axis. The line goes down to the right, because large losses are less probable than small losses. Both axes use a log scale, so each grid step is 10 times the step before.',
    why: 'Where a loss line is above the tolerance curve, the probability of that loss is too high for the management body. The vertical line marks the capacity, the largest loss that the company can absorb.',
    example: 'The line passes 10% at 200,000. Then the probability of an annual loss above 200,000 is 1 in 10.',
    source: 'Hubbard and Seiersen, How to Measure Anything in Cybersecurity Risk, 2nd ed., 2023.',
  },
  'prioritize.percentiles': {
    what: 'The annual loss of all registers together at fixed points of the simulation. P90 is the loss that 90% of the simulated years do not go above.',
    why: 'A budget or an insurance limit is easier to set from a percentile than from the full curve.',
    example: 'If P95 is 400,000, then about 1 year in 20 has a loss above 400,000.',
  },
  'prioritize.ranking': {
    what: 'The negative risks with their expected annual loss from the simulation. The app proposes a priority for each risk from this loss.',
    why: 'The simulation compares risks by money, so the ranking does not depend on the bands of a matrix. A priority in a child register is provisional. The parent register can set its own.',
    source: 'NIST SP 800-221r1 Sec. 3.5 and 5.3.3.',
  },
  'prioritize.ranking-table': {
    what: 'Proposed is the rank from the expected annual loss, highest first, in each register. Priority is the priority that the register uses now. The plus or minus value is the error of the simulation. P(at least one event) is the probability of one or more events in the timeframe of the register. Tail contribution is the part of the loss in the worst 5% of years that comes from this risk. Alone against the curve shows if this risk breaches the tolerance curve without the other risks.',
    why: 'A risk with a large tail contribution causes the bad years. This can be true when its expected annual loss is not the highest.',
    source: 'NIST SP 800-221r1 Sec. 3.5.',
  },
  'prioritize.use-proposed': {
    what: 'Copies each proposed priority into the priority of its risk. An override stays and still wins.',
    why: 'Use it when the simulation changed and you want the priorities to follow the new losses. Undo last change takes it back.',
  },
  'prioritize.override': {
    what: 'An override sets a priority that is different from the proposal. It records who set it, when and why.',
    why: 'Leadership can rank a risk higher or lower for a reason that the loss does not show. An example is a legal requirement. The decision record lists every override.',
    source: 'NIST SP 800-221r1 Sec. 5.3.1 and 5.4.4.',
  },
  'prioritize.override-priority': {
    what: 'The priority that leadership sets for this risk. 1 is the highest priority.',
    why: 'This value replaces the proposed priority and the priority of the register.',
  },
  'prioritize.override-set-by': {
    what: 'The name or the role of the person who decided the override.',
    why: 'An auditor must see who is accountable for a priority that is different from the simulation.',
    example: 'Managing director.',
  },
  'prioritize.override-set-on': {
    what: 'The date of the decision.',
    why: 'An old override can need a new review when the risks change.',
  },
  'prioritize.override-reason': {
    what: 'One or two sentences on why the priority is different from the proposal.',
    why: 'Without a reason, the next review cannot check if the override is still correct.',
    example: 'The customer contract requires this fix before the next audit.',
  },
  'prioritize.override-factors': {
    what: 'The types of reason for the override. Select all that apply.',
    why: 'With the factors, you can easily compare overrides across registers and periods.',
    example: 'Legal requirement and quick win.',
    source: 'NIST SP 800-221r1 Sec. 5.3.1.',
  },
  'prioritize.opportunities': {
    what: 'The opportunities, which are the positive risks, with their expected annual gain from the simulation. P(not realized) is the probability that the gain does not come in the timeframe.',
    why: 'Gains never go into the loss curve. They count in the net benefit of a portfolio on the screen Respond and optimize.',
    source: 'NIST SP 800-221r1 Sec. 3.8.',
  },
  'prioritize.matrix': {
    what: 'A matrix of likelihood and impact bands. Negative risks are on the left and positive risks on the right. The matrix is display only.',
    why: 'Users and auditors expect a matrix. But a matrix can put a small risk above a large risk. So the app never ranks or funds with it. Ranking and funding use the simulation.',
    source: 'NIST SP 800-221r1 Sec. 3.8 and Fig. 8. Cox, What\'s Wrong with Risk Matrices?, Risk Analysis 28(2), 2008.',
  },
  'prioritize.matrix-table': {
    what: 'A row is a likelihood band. A column is an impact band, as a part of the capacity. The colour and the word in a cell give the level. A mark ! shows a risk in a pair that lint L-01 or L-03 finds. In such a pair, the matrix order and the loss order are different.',
    why: 'Read the matrix as a picture only. Use the table of risks by expected annual loss to rank.',
    example: 'With a capacity of 1,000,000, an impact of 30,000 is 3% of the capacity and goes in the band Low.',
    source: 'NIST SP 800-30 Rev. 1 Tables G-3 and I-2. NIST SP 800-221r1 Fig. 8.',
  },
  'prioritize.err': {
    what: 'One register as a table, one row for each risk. The columns are those of the enterprise risk register. The cells show the labels and the text that the register holds.',
    why: 'This table is the common form to share a register with leadership and with other registers.',
    source: 'NIST SP 800-221r1 Sec. 4.2 and Fig. 10.',
  },
  'prioritize.err-register': {
    what: 'The register that the table shows.',
    why: 'Each register has its own table. A summary entry shows only in its parent register.',
  },
} as const satisfies HelpTexts;
