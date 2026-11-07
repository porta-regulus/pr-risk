import type { HelpTexts } from './types';

export const ENTERPRISE_HELP = {
  'enterprise.erp': {
    what: 'The risks of the registers, grouped by the enterprise objective that each risk affects. Each risk shows its impact and its likelihood three times, as Last, Current and Residual.',
    why: 'Leadership reads risk by objective. The three columns show if a risk goes up or down and what the planned response will leave.',
    source: 'NIST SP 800-221r1 Sec. 4.3 and Fig. 11.',
  },
  'enterprise.erp-register': {
    what: 'The registers whose risks the profile shows. A register includes the registers below it.',
    why: 'Choose one business unit to see only its part of the profile.',
  },
  'enterprise.erp-table': {
    what: 'One table for each objective. Last is the assessment of the previous period. Current is the value in the register now. Residual is the planned value after the response, from the Detail tab. Current Risk Response is what is in place. Proposed Risk Response is what the register plans.',
    why: 'Compare Last with Current to see the trend. Compare Current with Residual to see what the proposed response gives.',
    source: 'NIST SP 800-221r1 Fig. 11.',
  },
  'enterprise.normalize': {
    what: 'A parent register lists the entries of the registers below it. You can combine entries that describe the same risk into one summary entry.',
    why: 'Child registers often describe one risk in different words. Leadership needs one entry for each risk, and the escalation threshold shows the entries that must go up.',
    source: 'NIST SP 800-221r1 Sec. 5.2 and Table 10.',
  },
  'enterprise.normalize-parent': {
    what: 'The register that receives the summary entries. The list shows only registers that have a register below them.',
    why: 'The tables below then show the entries of all registers under this register.',
  },
  'enterprise.entries-table': {
    what: 'One table for each risk category with the entries of the child registers. Source is the ID of the entry. Likelihood, Impact and Exposure are the stored values. Note shows the summary entry that already holds the entry, or that the entry must go to the parent register.',
    why: 'Select the entries that describe the same risk, then merge them below. An entry that a summary entry holds cannot be selected again.',
    source: 'NIST SP 800-221r1 Sec. 5.2.1 and 5.2.2.',
  },
  'enterprise.merge-id': {
    what: 'The ID of the new summary entry in the parent register.',
    why: 'The app proposes the next free ID. Change it if your company uses its own numbering.',
    example: 'ORG-1.',
  },
  'enterprise.merge-owner': {
    what: 'The person who owns the summary entry at the level of the parent register.',
    why: 'The owner of a summary entry must have the authority to act for all the source registers.',
    example: 'Head of IT.',
    source: 'NIST SP 800-221r1 Sec. 5.2.3.',
  },
  'enterprise.merge-layout': {
    what: 'What the app does when the selected entries have different response types. One row with all responses makes one entry with every type. One row per response makes one entry for each type.',
    why: 'Different responses to one risk are a disparity that leaders must resolve. Lint L-10 marks such an entry.',
    source: 'NIST SP 800-221r1 Table 10.',
  },
  'enterprise.merge-cost': {
    what: 'How the app calculates the response cost of the summary entry from the costs of the sources.',
    why: 'Use the total when each source pays for its own response. Use the weighted average when the sources share one response.',
    source: 'NIST SP 800-221r1 Sec. 5.2.3, lines 1661 to 1664.',
  },
  'enterprise.merge-priority': {
    what: 'The priority of the summary entry in the parent register. 1 is the highest. Leave it empty to set it later.',
    why: 'The priorities of the child registers are provisional. The parent register sets its own.',
    source: 'NIST SP 800-221r1 Sec. 5.3.3.',
  },
  'enterprise.merge-description': {
    what: 'One description of the risk that the selected entries describe in different words.',
    why: 'Leadership reads this text, so it must be clear without the source entries.',
    example: 'Ransomware stops the production and the order systems for more than 3 days.',
    source: 'NIST SP 800-221r1 lines 1622 to 1625.',
  },
  'enterprise.merge-response': {
    what: 'The response of the summary entry, in words. If you leave it empty, the app names the source entries.',
  },
  'enterprise.merge': {
    what: 'Adds a summary entry to the parent register from the selected entries. For likelihood and impact, the optimistic value is the lowest source value and the pessimistic value is the highest. The most likely value is the mean of the others. The entry takes the most likely value.',
    why: 'For an opportunity, the optimistic value is the highest. The source entries stay in their registers. Summary entries never go into the simulation, so no risk counts twice. Undo last change takes the merge back.',
    source: 'NIST SP 800-221r1 Sec. 5.2.2, lines 1637 to 1641.',
  },
  'enterprise.summary-table': {
    what: 'The summary entries of the parent register. Likelihood and impact show the optimistic, most likely and pessimistic values of the sources. Priority is the priority in the parent register, and you can change it here. Sources lists each source entry with its response and its values.',
    why: 'A summary entry keeps the link to its sources, so a reviewer can check the numbers. Remove is not possible while another entry or a response uses the summary entry.',
    source: 'NIST SP 800-221r1 Sec. 5.2.2, 5.2.3 and 5.3.3.',
  },
  'enterprise.period': {
    what: 'At the end of a period, the app copies the current assessment of each open risk into its previous assessment.',
    why: 'The column Last of the profile and the previous period of the portfolio come from this copy. Do it once for each review period, for example each quarter.',
    source: 'NIST SP 800-221r1 Sec. 4.3, Fig. 11 and Table 7.',
  },
  'enterprise.period-scope': {
    what: 'The registers whose risks the app closes. A register includes the registers below it.',
    why: 'Business units can have different review dates.',
  },
  'enterprise.period-as-of': {
    what: 'The last day of the period that you close.',
    why: 'The previous assessment keeps this date, so the reader knows how old the values are.',
  },
  'enterprise.close-period': {
    what: 'Replaces the previous assessment of each open risk in scope with its current assessment. Labels and the impact split are copied. Placeholder numbers and numbers that come from labels are not copied.',
    why: 'A placeholder must not look like an estimate in the next period. Undo last change takes the close back.',
  },
  'enterprise.portfolio': {
    what: 'One row for each register, with the current and the previous period. A register includes the registers below it.',
    why: 'Leadership sees which part of the company carries the most risk and if it goes up or down.',
    source: 'NIST SP 800-221r1 Sec. 4.3 and Table 7.',
  },
  'enterprise.portfolio-table': {
    what: 'The financial profile is the expected annual loss of the negative risks. With a simulation, it is the simulated value with its standard error, and entries with no estimate show apart. With no simulation, it is the sum of the exposure ratings. The reputation and mission profiles give the highest label on the impact scale. Previous period comes from the last close of the period.',
    why: 'Expected values add up, so the financial profile of a parent register is the sum of its parts. Labels do not add up, so the app shows the highest one.',
    source: 'NIST SP 800-221r1 Table 7, without its sub-columns.',
  },
  'enterprise.print': {
    what: 'Opens the print dialog of the browser with the register table, the profile by objective and the portfolio. All folded sections open for the print.',
    why: 'Use it to bring the enterprise view to a meeting or to save it as a PDF file.',
  },
} as const satisfies HelpTexts;
