import type { HelpTexts } from './types';

// Screen S3 Identify and analyze. Registers, risks, the risk editor, assets, drivers and the
// estimate fields that the other screens also use.
const HS = 'Hubbard and Seiersen, How to Measure Anything in Cybersecurity Risk, 2nd ed., 2023.';
const RDR = 'NIST SP 800-221r1 App. B.';
const REGISTER = 'NIST SP 800-221r1 Sec. 3.3.5 and Fig. 4.';
const COMMON_SHOCK = 'Lindskog and McNeil, Common Poisson Shock Models, ASTIN Bulletin 33(2), 2003.';

export const IDENTIFY_HELP = {
  // Registers.
  'identify.registers': {
    what: 'A register is a list of risks for one part of the company. Registers form a tree with up to three levels, system, organization and enterprise.',
    why: 'A parent register shows its own risks and the combined result of all registers under it. The app simulates the combined result, so no risk is counted twice.',
    example: 'One organization register for the company, with one system register for the web shop and one for the office network.',
    source: 'NIST SP 800-221r1 Sec. 2.1, 2.3 and 4.1, and Fig. 1.',
  },
  'identify.register-title': {
    what: 'The name of the register as it shows in the tree and in the reports.',
    example: 'Web shop.',
  },
  'identify.register-level': {
    what: 'The level of the register. System is one system or service. Organization is the company or one business unit. Enterprise is the top of a group of companies.',
    why: 'Most small companies need two levels, organization and system.',
    source: 'NIST SP 800-221r1 Sec. 2.1 and Fig. 1.',
  },
  'identify.register-parent': {
    what: 'The register one level above this register. A top level register has no parent.',
    why: 'The results of this register go into the results of the parent.',
    source: 'NIST SP 800-221r1 Sec. 4.1.',
  },
  'identify.register-method': {
    what: 'How the register measures its risks. Qualitative uses labels such as Low and High. Semi-quantitative uses labels with number ranges. Quantitative uses ranges of numbers for frequency and loss.',
    why: 'A quantitative register needs an estimate for each risk before you can save it. A qualitative register can get estimates one risk at a time.',
    source: 'NIST SP 800-221r1 Sec. 3.4.1.',
  },
  'identify.register-timeframe': {
    what: 'The period, in months, that each likelihood in this register refers to.',
    why: 'All risks in one register must use the same period. If not, you cannot compare their likelihoods. The result shows the probability of one or more events in this period.',
    example: 'Type 12 for one year.',
    source: 'NIST SP 800-221r1 Sec. 3.4.2.',
  },
  'identify.register-as-of': {
    what: 'The date on which the risks in this register were last reviewed.',
    why: 'A reader can see how old the data is.',
  },
  'identify.register-threshold': {
    what: 'The smallest loss of one event that counts as a reportable event in this register.',
    why: 'A forecast on the screen Monitor and adjust counts only the events at or above this amount. Without a threshold, each event counts.',
    example: 'If the management body wants to know about each event that costs 10 000 or more, type 10000.',
  },
  'identify.register-owner': {
    what: 'The person or role who keeps this register up to date.',
    example: 'IT manager.',
  },
  'identify.register-scope': {
    what: 'What this register includes and what it does not include.',
    why: 'A clear scope prevents gaps and prevents two registers that hold the same risk.',
    example: 'The web shop, its payment link and its hosting. Not the office network.',
    source: 'NIST SP 800-221r1 Sec. 3.1.',
  },

  // Risk table and new risks.
  'identify.risks': {
    what: 'The risks in the register that you selected in the tree. Select Edit to open a risk in the editor below the table.',
    why: 'The exposure column shows the result of the estimate. If a risk has no estimate, the column shows the value from the labels or Not estimated.',
    source: REGISTER,
  },
  'identify.risk-description': {
    what: 'One sentence that gives the cause and the effect of the risk. Use the form "If X occurs, then Y happens".',
    why: 'Cause and effect make it clear what you measure, and what a response can change.',
    example: 'If ransomware encrypts the order database, then the web shop stops for several days.',
    source: 'NIST SP 800-221r1 Sec. 3.3.4 and Table 3.',
  },
  'identify.polarity': {
    what: 'Negative means a threat that can cause a loss. Positive means an opportunity that can bring a gain.',
    why: 'For a positive risk, the app asks for a gain, not a loss. The matrix shows positive risks on the right side.',
    source: 'NIST SP 800-221r1 Sec. 3.8.',
  },
  'identify.catalogue': {
    what: 'A list of ready risk names in groups, from the Risklet catalogue and from NIST examples of opportunities.',
    why: 'A template saves time and gives a name and a category. It gives no frequency and no loss. You must estimate them for your company.',
    source: 'NIST SP 800-221r1 Sec. 3.3 and 3.8.',
  },
  'identify.add-template': {
    what: 'Adds a new risk to the selected register with the text and the category of the template. Then the risk opens in the editor.',
    why: 'After you add it, write the description as cause and effect, and give the owner and the estimate.',
  },

  // Risk editor, tab Scenario.
  'identify.risk-editor': {
    what: 'The editor of one risk. Its tabs are Scenario, Estimate, Drivers, Detail, Evidence and Links. Detail holds the full risk detail record. Links holds the objectives, the assets and the other risks.',
    why: 'The scenario and the estimate are enough to start. The other tabs make the risk detail record complete for an audit or for the next level.',
    source: 'NIST SP 800-221r1 Sec. 3.3 to 3.4.2 and App. B.',
  },
  'identify.horizon': {
    what: 'Current means the risk exists now. Emerging means it starts to show. Horizon means it can come in the future.',
    why: 'An emerging or horizon risk is a reason to check your appetite statements and tolerance curve again. Do this on the screen Context and strategy.',
    source: 'NIST SP 800-221r1 Sec. 3.3.',
  },
  'identify.threat-source-type': {
    what: 'The type of source that causes the risk. Adversarial is a person or group with intent. Accidental is an error by a person. Structural is a failure of equipment or software. Environmental is a natural event or a failure of a service outside your control.',
    example: 'A criminal group is adversarial. A power cut at the data center is environmental.',
    source: 'NIST SP 800-30 Rev. 1 Table D-2.',
  },
  'identify.category': {
    what: 'The area where the cause of the risk is. The category is the cause, not the effect. The effects go under Consequences by kind.',
    example: 'A ransomware attack has the category ICT, even when the main loss is financial.',
  },
  'identify.subcategory': {
    what: 'A more exact area inside the category.',
    why: 'Subcategories let you see where many risks come from, for example many supply chain risks.',
    example: 'ICT, malware.',
  },
  'identify.nist-category': {
    what: 'The risk category as free text, as in the NIST risk register.',
    why: 'The app keeps this text for an export to NIST formats. Use the same words in all registers.',
    source: REGISTER,
  },
  'identify.risk-owner': {
    what: 'The person or role who is responsible for this risk and its response.',
    why: 'A risk with no owner often gets no response.',
    example: 'Head of operations.',
    source: REGISTER,
  },
  'identify.risk-status': {
    what: 'Where the risk is in its life cycle. Open, In treatment, Monitored, Accepted, Review needed or Closed.',
    why: 'New evidence sets the status to Review needed, so that someone checks the risk again.',
    source: REGISTER,
  },
  'identify.scenario-parts': {
    what: 'Five short texts that describe the scenario in steps. Who or what causes it, what happens, which weakness lets it happen, which assets it hits, and the harm.',
    why: 'The parts help you see which response can break the chain, and they fill the risk detail record.',
    source: 'NIST SP 800-221r1 Sec. 3.3.5.',
  },
  'identify.threat-source': {
    what: 'The person, group or thing that causes the event. For a positive risk, the source of the opportunity.',
    example: 'A criminal group that sells ransomware.',
    source: 'NIST SP 800-221r1 Sec. 3.3.2 and 3.8.',
  },
  'identify.threat-event': {
    what: 'What happens when the source acts.',
    example: 'A phishing email installs ransomware on an office computer.',
    source: 'NIST SP 800-221r1 Sec. 3.3.2.',
  },
  'identify.vulnerability': {
    what: 'The weakness or condition that lets the event cause harm.',
    example: 'Backups are on a disk that the office network can write to.',
    source: 'NIST SP 800-221r1 Sec. 3.3.3.',
  },
  'identify.assets-affected': {
    what: 'The information, systems, people or services that the event hits.',
    example: 'Order database and file server.',
    source: 'NIST SP 800-221r1 Sec. 3.3.1.',
  },
  'identify.primary-impact': {
    what: 'The main harm when the event occurs. For a positive risk, the main benefit.',
    example: 'The web shop takes no orders for 3 to 10 days.',
    source: 'NIST SP 800-221r1 Sec. 3.3.4.',
  },
  'identify.consequences': {
    what: 'The effects of the risk on each kind of value, financial, reputation, mission and safety. Each kind gets a label on the impact scale, and you can add an amount and a note.',
    why: 'The category gives the cause. These rows give the effects. One risk can have effects of several kinds.',
    source: 'NIST SP 800-221r1 Sec. 2.1 and 3.3.4, and Table 6.',
  },
  'identify.consequence-label': {
    what: 'The label on the common impact scale for this kind of effect.',
    why: 'The labels are for display. Ranking and funding use the simulation of the estimate.',
  },
  'identify.consequence-amount': {
    what: 'An optional amount in money for this kind of effect.',
    why: 'The amount documents the split of the loss. The simulation uses the estimate on the tab Estimate, not this amount.',
  },
  'identify.consequence-note': {
    what: 'A short note that explains the label or the amount.',
    example: 'Two large customers said they would leave after a second outage.',
  },

  // Risk editor, tab Estimate.
  'identify.rating': {
    what: 'Labels from the common scales of likelihood, impact and exposure, as they show in a risk matrix.',
    why: 'Without an estimate, the labels give the numbers of the risk. An exposure label is used before an impact label. With an estimate, the simulation gives the numbers. A matrix is for display only. Ranking and funding use the simulation.',
    source: 'NIST SP 800-221r1 Sec. 2.4.2 and 3.5.',
  },
  'identify.rating-likelihood': {
    what: 'The label for how probable the risk is in the timeframe of the register.',
    source: 'NIST SP 800-221r1 Sec. 2.4.2.',
  },
  'identify.rating-impact': {
    what: 'The label for how large the effect of one event is.',
    source: 'NIST SP 800-221r1 Sec. 2.4.2.',
  },
  'identify.rating-exposure': {
    what: 'The label for the combined size of the risk, likelihood and impact together.',
    why: 'If you set an exposure label, the app uses it before the impact label to give the numbers of the risk.',
    source: 'NIST SP 800-221r1 Sec. 2.4.2.',
  },
  'identify.add-estimate': {
    what: 'Adds empty fields for the frequency and the loss of one event.',
    why: 'With an estimate, the simulation gives the numbers of the risk. Only then can the risk be in the ranking and the funding. The app does not fill in numbers. You give them.',
    source: 'NIST SP 800-221r1 Sec. 3.4.2.',
  },
  'identify.remove-estimate': {
    what: 'Removes the frequency, the loss and the secondary impacts of this risk.',
    why: 'After this, the labels give the numbers of the risk, and the risk is not in the simulation. A quantitative register does not show this button, because each risk there needs an estimate.',
  },
  'identify.frequency': {
    what: 'How many times per year the event happens. Do not count events that a linked driver causes, because the driver adds them.',
    why: 'The simulation draws a number of events for each simulated year from this range.',
    example: 'If you think it happens between once in 10 years and once a year, type 0.1 and 1.',
    source: HS,
  },
  'identify.impact-per-event': {
    what: 'The loss from one event. For a positive risk, the gain from one event.',
    why: 'The simulation draws one loss for each event. Include costs for recovery, lost sales, fines and claims.',
    example: 'If one event costs between 5 000 and 80 000, type 5000 and 80000.',
    source: HS,
  },
  'identify.estimate-form': {
    what: 'How you give the estimate. A range you are 90% sure of. Once every N years, for rare events, which only the frequency has. Minimum, most likely and maximum, when there is a hard maximum such as a legal cap. One fixed value, when you know the number.',
    why: 'A 90% range becomes a lognormal distribution. Minimum, most likely and maximum become a PERT distribution. If you change the form, the app clears the numbers.',
    source: 'Hubbard and Seiersen, How to Measure Anything in Cybersecurity Risk, 2nd ed., 2023. NIST IR 8286A Rev. 1 Sec. 2.3.2.2.',
  },
  'identify.estimate-lower': {
    what: 'The low end of a range that you are 90% sure contains the true value. There is a 5% probability that the true value is lower.',
    why: 'Most people give ranges that are too narrow. Test your range with a bet. Compare a bet on your range with a bet that wins with a 90% probability. If you prefer the second bet, make the range wider.',
    source: HS,
  },
  'identify.estimate-upper': {
    what: 'The high end of a range that you are 90% sure contains the true value. There is a 5% probability that the true value is higher.',
    why: 'Large losses are rare but important. Do not make the upper end too low.',
    source: HS,
  },
  'identify.estimate-every-short': {
    what: 'The shortest time, in years, that you expect between two events.',
    why: 'The app changes the years to events per year. The shortest time gives the highest frequency.',
    example: 'If you think it happens between once in 2 years and once in 20 years, type 2 here. Type 20 in the longest time.',
    source: HS,
  },
  'identify.estimate-every-long': {
    what: 'The longest time, in years, that you expect between two events.',
    why: 'The longest time gives the lowest frequency.',
    source: HS,
  },
  'identify.estimate-min': {
    what: 'The lowest value that is possible.',
    source: 'NIST IR 8286A Rev. 1 Sec. 2.3.2.2.',
  },
  'identify.estimate-mode': {
    what: 'The value that you think is the most probable. It must be between the minimum and the maximum.',
    source: 'NIST IR 8286A Rev. 1 Sec. 2.3.2.2.',
  },
  'identify.estimate-max': {
    what: 'The highest value that is possible, for example a legal cap or a contract limit.',
    why: 'The simulation never goes above this value.',
    source: 'NIST IR 8286A Rev. 1 Sec. 2.3.2.2.',
  },
  'identify.estimate-value': {
    what: 'One value that does not change from year to year.',
    why: 'Use it only for a number you know, for example a fixed contract penalty. A fixed value shows no uncertainty.',
  },
  'identify.secondary-impacts': {
    what: 'A second loss that one event can cause, with the probability that it occurs.',
    why: 'The simulation adds the second loss only in the events where it occurs. A cascade to a different risk is a link on the tab Links.',
    example: 'Customer claims after a data leak.',
    source: 'NIST SP 800-221r1 Sec. 3.3.4 and 3.4.2.',
  },
  'identify.secondary-description': {
    what: 'A short name for the second loss.',
    example: 'Fine from the data protection authority.',
  },
  'identify.secondary-probability': {
    what: 'The probability, from 0 to 1, that one event causes this second loss.',
    example: 'If 1 event in 5 leads to claims, type 0.2.',
  },
  'identify.secondary-range': {
    what: 'The loss of the second impact when it occurs.',
    source: HS,
  },
  'identify.estimate-method': {
    what: 'Where the numbers come from. Expert range is the judgement of people who know the area. Own data is your own records of events and costs. Mixed is both.',
    why: 'An analysis must say how it got its numbers, so that a reader can trust or check it.',
    source: 'NIST SP 800-221r1 Sec. 2.4.3.',
  },
  'identify.estimated-by': {
    what: 'The names or roles of the people who gave the estimate.',
    why: 'A reader knows whom to ask. The forecasts on the screen Monitor and adjust later show how good the estimates were.',
  },
  'identify.estimated-on': {
    what: 'The date of the estimate.',
    why: 'An old estimate may need a review.',
  },
  'identify.estimate-rationale': {
    what: 'Why you chose these ranges, in 10 characters or more.',
    why: 'A written reason makes the estimate open to review.',
    example: 'Two outages in 6 years. Each cost between 4 and 9 days of sales.',
    source: 'NIST SP 800-221r1 Sec. 2.4.3.',
  },
  'identify.estimate-sources': {
    what: 'The reports, records or data that support the estimate, one on each line.',
    example: 'Incident log 2020 to 2025.',
  },

  // Risk editor, tab Drivers.
  'identify.driver-link': {
    what: 'A driver that can cause events of this risk.',
    why: 'The frequency on the tab Estimate counts only the events that the drivers do not cause. The app adds the events from the driver.',
    source: COMMON_SHOCK,
  },
  'identify.trigger-probability': {
    what: 'The probability, from 0 to 1, that one event of the driver causes one event of this risk.',
    example: 'If 1 supplier outage in 2 stops your web shop, type 0.5.',
    source: COMMON_SHOCK,
  },
  'identify.driver-link-rationale': {
    what: 'Why the driver causes events of this risk, and why you chose this probability.',
  },

  // Risk editor, tab Detail.
  'identify.detail': {
    what: 'All text fields of the NIST risk detail record. The scenario parts are on the tab Scenario.',
    why: 'The risk detail record is the full history of one risk. The app exports it in the NIST format.',
    source: 'NIST SP 800-221r1 App. B and Fig. 15.',
  },
  'identify.detail-system': { what: 'The system or service that the risk is in.', source: RDR },
  'identify.detail-unit': { what: 'The part of the company that the risk is in.', source: RDR },
  'identify.detail-scenario': { what: 'The full story of the risk scenario in your own words.', source: RDR },
  'identify.detail-vectors': { what: 'The routes by which the threat reaches the asset, for example email or a remote access service.', source: RDR },
  'identify.detail-secondary': { what: 'A text description of the second losses. The numbers of the second losses are on the tab Estimate.', source: RDR },
  'identify.detail-other': { what: 'Other facts about the scenario that do not fit the other fields.', source: RDR },
  'identify.detail-analysis': { what: 'A short text of the current result of the analysis.', source: RDR },
  'identify.detail-resources': { what: 'The people, money and time that the planned response needs.', source: RDR },
  'identify.detail-source': { what: 'Where the information about the risk comes from, for example an audit or an incident.', source: RDR },
  'identify.detail-dependencies': { what: 'Other risks, projects or suppliers that this risk depends on.', source: RDR },
  'identify.detail-comments': { what: 'Other notes about the risk.', source: RDR },
  'identify.detail-implemented': { what: 'The response that is now in place.', source: RDR },
  'identify.detail-identified': { what: 'The date when the risk was first found.', source: RDR },
  'identify.detail-status-date': { what: 'The date of the last change of the status.', source: RDR },
  'identify.detail-follow-up': { what: 'The date of the next review of the risk.', source: RDR },

  // Risk editor, tab Evidence.
  'identify.evidence': {
    what: 'Facts that support the weakness or the estimate, for example a vulnerability report, an audit finding or an incident.',
    why: 'When you add evidence, the status of the risk changes to Review needed, so that someone checks the estimate again.',
    source: 'NIST SP 800-221r1 Sec. 3.3.3.',
  },
  'identify.evidence-kind': {
    what: 'The type of evidence. CVD Portal submission, audit finding, incident, KEV, EPSS score or document.',
    why: 'KEV means the vulnerability is on a list of vulnerabilities that attackers use now. EPSS is a score for the probability of an attack on a vulnerability.',
  },
  'identify.evidence-ref': {
    what: 'A reference that lets a reader find the evidence.',
    example: 'Audit report 2026, finding 4.',
  },
  'identify.evidence-summary': { what: 'What the evidence shows, in one or two sentences.', example: 'The backup server has a known exploited flaw with no patch yet.' },
  'identify.evidence-severity': {
    what: 'The severity that the source gives.',
    example: 'High, or CVSS 8.1.',
  },
  'identify.evidence-status': {
    what: 'The state of the evidence in its source.',
    example: 'Open, fixed or accepted.',
  },
  'identify.evidence-date': { what: 'The date of the evidence, for example the date of the finding or the incident.' },

  // Risk editor, tab Links.
  'identify.objectives': {
    what: 'The company objectives that this risk can stop or help.',
    why: 'The enterprise risk profile groups risks by objective. A risk with no objective gets a warning.',
    source: 'NIST SP 800-221r1 Sec. 4.3 and Fig. 11.',
  },
  'identify.risk-assets': {
    what: 'The assets from the asset inventory that this risk hits.',
    why: 'When two or more risks hit the same asset, the app suggests a shared driver.',
    source: 'NIST SP 800-221r1 Sec. 3.3.1.',
  },
  'identify.linked-risks': {
    what: 'Links from this risk to other risks. A link is a record for the reader. It does not change the simulation.',
    why: 'Use a secondary impact for a cascade inside one risk. Use a link for a cascade to a different risk. Use a driver for a shared cause.',
    source: 'NIST SP 800-221r1 Sec. 3.3.2.',
  },
  'identify.link-relation': {
    what: 'Cascades to means this risk can start the other risk. Combination of means this risk joins other risks. Trade-off with means a decision that lowers one risk raises the other.',
    source: 'NIST SP 800-221r1 Sec. 3.3.2.',
  },
  'identify.link-risk': { what: 'The other risk of the link.', why: 'The relation reads from this risk to the other risk.' },
  'identify.link-note': {
    what: 'Why the two risks are linked.',
    example: 'A stop of the web shop for more than a week causes the loss of key customers.',
  },

  // Asset inventory.
  'identify.assets': {
    what: 'A list of the assets that your risks can hit, with their value and the basis of the value.',
    why: 'The value of an asset is often more than its replacement cost, so each value needs a basis. An asset gets the criticality of the functions that it supports.',
    source: 'NIST SP 800-221r1 Sec. 3.3.1.',
  },
  'identify.asset-id': {
    what: 'A short unique code of the asset. You cannot change it after a risk uses the asset.',
    example: 'A-3.',
  },
  'identify.asset-name': { what: 'The name of the asset.', example: 'Customer database.' },
  'identify.asset-kind': { what: 'The type of asset. Information, software, hardware, service, people, facility or process.' },
  'identify.asset-owner': { what: 'The person or role who is responsible for the asset.' },
  'identify.asset-criticality': {
    what: 'How important the asset is for the work of the company, as a word or a label.',
    example: 'High.',
    source: 'NIST SP 800-221r1 Sec. 3.3.1.',
  },
  'identify.asset-sensitivity': {
    what: 'How much harm occurs when the information in the asset becomes known to the wrong people.',
    example: 'Confidential.',
    source: 'NIST SP 800-221r1 Sec. 3.3.1.',
  },
  'identify.asset-external': {
    what: 'Select this when a different company runs or holds the asset.',
    why: 'You have less control of an external asset, so the provider becomes part of the risk.',
    example: 'A hosted email service.',
    source: 'NIST SP 800-221r1 Sec. 3.3.1.',
  },
  'identify.asset-provider': { what: 'The company that runs or holds the asset.', example: 'The name of your cloud provider.' },
  'identify.asset-functions': {
    what: 'The business functions that need this asset.',
    why: 'An asset gets the criticality of the most critical function that it supports.',
    source: 'NIST SP 800-221r1 Sec. 3.3.1.',
  },
  'identify.asset-value': {
    what: 'The value of the asset in money.',
    why: 'When you type a value, you must also give the basis.',
    source: 'NIST SP 800-221r1 Sec. 3.3.1.',
  },
  'identify.asset-basis': {
    what: 'How you got the value. Replacement cost, revenue that depends on the asset, a contract penalty, a regulatory amount, or other.',
    why: 'The value of an asset is often more than its replacement cost.',
    source: 'NIST SP 800-221r1 Sec. 3.3.1.',
  },
  'identify.asset-rationale': {
    what: 'Why the value has this amount.',
    example: 'The shop makes 3 000 a day and needs this database.',
  },

  // Drivers.
  'identify.drivers': {
    what: 'A driver is a shared cause of events in several risks, for example an outage of one supplier.',
    why: 'Each driver event reaches each linked risk with a trigger probability. The simulation then shows joint losses in the same year and counts no loss twice. One response option on a driver changes all linked risks.',
    example: 'An outage of the hosting company can stop the web shop and the email at the same time.',
    source: 'NIST SP 800-221r1 Sec. 2.4.1 and 3.3.2. Lindskog and McNeil, Common Poisson Shock Models, ASTIN Bulletin 33(2), 2003.',
  },
  'identify.driver-id': {
    what: 'A short unique code of the driver. You cannot change it after a risk or a response uses the driver.',
    example: 'D-1.',
  },
  'identify.driver-name': { what: 'The name of the shared cause.', example: 'Outage of the hosting company.' },
  'identify.driver-kind': { what: 'The type of shared cause. Supplier, control failure, asset, threat or other.' },
  'identify.driver-description': { what: 'What the driver is and how it causes events of the linked risks.' },
  'identify.driver-frequency': {
    what: 'How many driver events happen per year. For a control, one event is one failure of the control.',
    why: 'The linked risks get events from the driver in addition to their own events.',
    example: 'If you think the supplier fails between once in 5 years and twice a year, type 0.2 and 2.',
    source: HS,
  },
  'identify.driver-rationale': {
    what: 'Why you chose this frequency, in 10 characters or more.',
    example: 'The supplier had 3 outages in the last 4 years.',
  },
} as const satisfies HelpTexts;
