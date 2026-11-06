# PortaRegulus Risk, release 1 specification

| Item | Value |
|---|---|
| Working name | PortaRegulus Risk (code name `pr-risk`). Final name is open question Q1. Do not use "Risklet" (ADR-0003 C5). |
| Version | 1.1, 2026-10-27. Restructured on the table of contents of NIST SP 800-221r1 ipd. Scope confirmed by the product owner in [ADR-0005](adr/0005-release-1-scope-by-toc.md). |
| Licence | Apache-2.0 for code, schema and help text. CC BY 4.0 for the catalogue (ADR-0003). |
| Publisher | PortaRegulus, listed on www.portaregulus.com. Separate from CVD Portal. |
| Decisions | [ADR-0001](adr/0001-primary-user-and-decision.md) user and decision. [ADR-0002](adr/0002-gap-against-free-alternatives.md) gap. [ADR-0003](adr/0003-license-and-cra-status.md) licence and CRA. [ADR-0004](adr/0004-local-first-data-and-threat-model.md) data location and threat model. |
| Schema | [schema/risk-register.schema.json](schema/risk-register.schema.json), JSON Schema 2020-12, with 3 examples, fixtures, NIST vendor copies and [schema/validate.py](schema/validate.py) |
| Reference model | [reference/sim_reference.py](reference/sim_reference.py), a NumPy statistical oracle for Sec. 8 |
| Build plan | [HANDOFF.md](HANDOFF.md) |

## 1. Summary

The app is a free, local-first browser app for the risk components of NIST SP 800-221r1 ipd. Its scope is the risk itself and the features that the SP 800-221r1 table of contents names. It does not do compliance checklists or regulation mappings.

The app supports one decision (ADR-0001). The IT lead of an EU company with 50 to 249 staff prepares which risk responses to fund in the next budget cycle, so that the annual loss exceedance curve stays under the tolerance curve. The management body approves the decision record.

Every SP 800-221r1 risk component that is data, analysis or a view is in release 1 (Sec. 3). Components that are organisational process or culture are out. Five features are not in any free tool (ADR-0002).
1. Shared drivers (one supplier, one control, one asset). They make several risks occur in the same simulated year and let one response change several risks (Sec. 2.4.1 and 3.3.2).
2. Positive risks that compete for the same budget as negative risks (Sec. 2.4.6, 3.8 and 5.4.3).
3. Algorithmic optimization (Sec. 5.3.2). An exact search over all affordable response portfolios picks the one with the highest net benefit that stays within tolerance.
4. A forecast and outcome log with Brier scores, which tests the analysis after the fact (Sec. 2.4.3).
5. One exchange document that is valid NIST IR 8286 JSON and maps to OSCAL POA&M (Sec. 2.4.5).

## 2. Assumptions

| # | Assumption | If wrong |
|---|---|---|
| A1 | The user can give calibrated 90% ranges after a 5-minute explanation and one worked example. | The usability test (AT-5) fails. Add a calibration exercise before the first estimate. |
| A2 | One currency per document. | Multi-currency needs FX rates per date. Out of scope. |
| A3 | Budget is set once a year and covers first-year cash. | Reopen ADR-0001. |
| A4 | Shared drivers couple frequencies only. A driver event does not change the size of the loss. | Severity coupling is release 2 (Sec. 8.7). |
| A5 | Estimates are annual. Every register uses 12 months unless the user sets another value. | The model supports 1 to 60 months. Release 1 screens show 12 only. |
| A6 | The NIST IR 8286 Rev. 1 JSON schemas stay as published until the final SP 800-221r1. | The vendored copies are pinned by SHA-256. A NIST change is a schema version change (Sec. 7.7). |
| A7 | No real SME risk register was available when this spec was written. The CSV and XLSX importer is designed from public templates. | Gate G-A before build task 4 ends (HANDOFF.md). |
| A8 | Section and line numbers refer to SP 800-221r1 ipd of October 2026. | NIST renumbers between drafts (Appendix D). Concept ids in Sec. 3.1 stay stable. |

### Challenged assumptions

1. **"Golden tests reproduce Figs. 10 and 15" assumes the NIST artefacts are valid. They are not.** The NIST RDR example fails the NIST RDR schema, because the schema requires `currentRiskAnalysis` but never defines it (jsonschema 4.25.1, `schema/validate.py` prints the error). Fig. 10 rates row 7 equal or higher than row 6 on every input but gives it a lower exposure. Fig. 11 prints "Medum". The golden tests reproduce the content exactly and assert these defects as known findings.
2. **"Agrees with pyfair" is a weak oracle.** pyfair computes risk as loss event frequency times loss magnitude per trial, a product and not a compound count. Its "PERT" is not the standard PERT (for min 0, mode 0.5, max 1 it gives Beta(4,4), the standard form gives Beta(3,3)). It seeds the global NumPy state. The property tests use exact results instead (Sec. 12.3).
3. **A greedy funding rule is not good enough.** In the reference runs on example 2, a greedy rule (tolerance first, then value per euro) funded O-3 and O-6 and left an expected annual loss of EUR 189 514. The simple fiscal method of SP 800-221r1 Sec. 5.3.2 reached EUR 136 519 with the same budget and no breach. Release 1 therefore uses an exact search over all affordable portfolios (Sec. 8.11).
4. **A tolerance curve says nothing below its first point.** A first draft held T(x) at the first point's probability for smaller losses. Frequent small losses (risk R-09 in example 2) then gave a false breach. Below the first point there is no limit (Sec. 8.9).

## 3. Scope by the SP 800-221r1 table of contents

### 3.1 Release 1 status of every ToC entry

Type M is a module (the user does something with it). Type R is a rule that every module obeys. Type C is content (help text). Status In means fully in release 1, Partial means in with the stated limit, Out means not in release 1, Help means help text only.

| ToC | Title | Type | Release 1 | Where |
|---|---|---|---|---|
| ES | Executive Summary | C | Help | S1 help |
| 1 | Introduction | C | Help | |
| 1.1 | Purpose and Scope | M | In | 6.4 (ICT disciplines in scope) |
| 1.2 | Document Structure | C | Not applicable | |
| 2 | Introduction to ICTRM and Challenges with ERM Integration | C | Help | |
| 2.1 | Comparing ICTRM and ERM | M | In | 6.1 |
| 2.2 | ICTRM Life Cycle | M | In | 5, 6.2 |
| 2.3 | ICTRM and ERM Integration | M | In | 6.1 |
| 2.4 | Shortcomings of Typical Approaches to ICTRM | C | Help | 6.3 |
| 2.4.1 | Increasing System and Ecosystem Complexity | R | In | 6.3, 8.7 |
| 2.4.2 | Lack of Standardized Measures | R | In | 6.3 |
| 2.4.3 | Informal Analysis Methods | R | In | 6.3, 8.14 |
| 2.4.4 | Overly Focused on the System Level | R | In | 6.3 |
| 2.4.5 | Gap Between ICTRM Output and ERM Input | R | In | 7 |
| 2.4.6 | Impact of Opportunities (Positive Risks) Not Pursued | R | In | 6.12 |
| 3 | ICT Risk Considerations | C | Help | |
| 3.1 | Identify the Context | M | In | 6.4 |
| 3.1.1 | Risk Governance | M | Partial | 6.4. Roles list only. No RACI workflow. |
| 3.2 | Risk Culture | M | Out | 3.2 |
| 3.2.1 | Risk Capacity, Risk Appetite and Risk Tolerance | M | In | 6.5 |
| 3.2.2 | Risk Management Strategy | M | In | 6.6 |
| 3.3 | Identify the Risks | M | In | 6.7 |
| 3.3.1 | Inventory and Valuation of Assets | M | In | 6.7.2 |
| 3.3.2 | Determination of Potential Threats | M | In | 6.7.3 |
| 3.3.3 | Determination of Exploitable and Susceptible Conditions | M | In | 6.7.4, 9.5 |
| 3.3.4 | Evaluation of Potential Consequences | M | In | 6.7.5, 8.4 |
| 3.3.5 | Risk Register Use | M | In | 6.7.6, 7 |
| 3.4 | Analyze the Risks | M | In | 6.8 |
| 3.4.1 | Risk Analysis Types | M | In | 6.8 |
| 3.4.2 | Techniques for Estimating Likelihood and Impact | M | Partial | 6.8. Calibrated ranges, three-point, Monte Carlo. No Bayesian analysis, no event tree. |
| 3.5 | Prioritize Risks | M | In | 6.9, 8.13 |
| 3.6 | Plan and Execute Risk Response Strategies | M | In | 6.10, 8.10 |
| 3.7 | Monitor, Evaluate, and Adjust Risk Management | M | In | 6.11, 8.14 |
| 3.7.1 | Adjusting Risk Response Based on Additional Information | M | In | 6.11 |
| 3.8 | Managing Positive Risks as Part of Integrated Risk Management | M | In | 6.12 |
| 4 | Building ERRs and ERPs from ICTRM-Specific Risk Registers | C | Help | |
| 4.1 | Creating and Maintaining Enterprise-Level ICT Risk Registers | M | In | 6.1, 6.15 |
| 4.2 | Creating the Enterprise Risk Register (ERR) | M | In | 6.13 |
| 4.3 | Developing the Enterprise Risk Profile (ERP) | M | Partial | 6.13. Fig. 11 view in. Table 7 sub-columns (net revenue, capital, free cash flow, stakeholder split) out. |
| 4.4 | Translating the ERP to Inform Leadership Decisions | M | In | 4, 6.13 |
| 5 | Enterprise Strategy for ICT Risk Coordination | C | Help | |
| 5.1 | Risk Integration and Coordination Activities | M | Partial | 6.14. Exchange between levels by file. Table 8 workflow out. |
| 5.1.1 | Detailed Risk Integration Strategy | M | In | 6.14 |
| 5.1.2 | Risk Monitoring and Communication Activities | M | Partial | 6.11, 6.14. KRIs, acceptance and exception records. No calendars or notifications. |
| 5.2 | Aggregation and Normalization of Risk Registers | M | In | 6.15 |
| 5.2.1 | Aggregation of ICT Risk Information | M | In | 6.15 |
| 5.2.2 | Normalization of Risk Register Information | M | In | 6.15, 8.15 |
| 5.2.3 | Integrating Risk Register Details | M | In | 6.15 |
| 5.3 | Adjusting Risk Responses | M | In | 6.16 |
| 5.3.1 | Factors Influencing Prioritization | M | In | 6.16 |
| 5.3.2 | ICT Risk Optimization | M | Partial | 8.11, 8.12. Algorithmic, fiscal and operational methods. Forced ranking out. |
| 5.3.3 | ICT Risk Priorities at Each Enterprise Level | M | In | 6.16 |
| 5.4 | Enterprise Adjustments Based on ICT Risk Results | M | In | 6.17 |
| 5.4.1 | Adjustments to ICT Program Budget Allocation | M | In | 6.17, 8.11 |
| 5.4.2 | Adjustments to Risk Appetite and Risk Tolerance | M | In | 6.17 |
| 5.4.3 | Reviewing Whether Constraints Are Overly Stringent | M | In | 6.17 |
| 5.4.4 | Adjustments to Priority | M | In | 6.16, 6.17 |
| 6 | Conclusion | C | Not applicable | |
| Ref. | References | C | Help | 13 |
| A | Acronyms and Abbreviations | C | Help | Glossary |
| B | Notional Example of a Risk Detail Record (RDR) | M | In | 6.18, 7.4 |
| C | Federal Agency-Specific Guidelines for ICTRM | M | Out | 3.2 |
| D | Change Log | R | In | 6.18, 7.7 |

Count. 63 entries, 45 M, 7 R, 11 C. Of the 45 M entries, 37 are In, 6 are Partial and 2 are Out. All 7 rules are In.

Stable concept ids. Every ToC entry has an id of the form `ictrm.<section>` (for example `ictrm.3.2.1`). The help text and the code use the id. One table in the code maps the id to the section number of a given draft, so a NIST renumbering changes one table only.

### 3.2 Out of scope for release 1

From the ToC.
1. Sec. 3.2 Risk Culture. Culture is organisational behaviour. A local single-user app cannot measure it reliably.
2. Sec. 3.1.1 Table 1 as a RACI workflow. Release 1 stores roles as a list only.
3. Sec. 3.4.2 Bayesian analysis and event tree analysis.
4. Sec. 4.3 Table 7 sub-columns (net revenue, capital, free cash flow, reputation by stakeholder, mission by product, philanthropy and share value).
5. Sec. 5.1 Table 8 as a workflow, and Sec. 5.1.2 calendars, reminders and notifications.
6. Sec. 5.3.2 forced ranking optimization with weighted business drivers.
7. Appendix C federal content. The target users are in the EU.
8. Sec. 3.2.1 guided questions that set capacity, appetite statements and tolerance points from the answers of the management body. Release 2 (Sec. 6.5 item 6 and `docs/release-2/appetite-questions.md`).

Not in the ToC, so out.
1. Regulation and framework mappings per risk (NIS2, CRA Annex I, CSF 2.0 subcategories). Responses can still name informative references (Sec. 3.6).
2. Accounts, sync, multi-user editing, any backend (ADR-0004).
3. CRA Art. 13(2) product risk assessment and conformity checklists (ADR-0001).
4. Any network call at run time. No live KEV, EPSS or NVD feeds.
5. AI features, MCP server, automatic de-duplication suggestions.
6. Business impact analysis per IR 8286D. Assets carry criticality and value, which is the BIA input Sec. 3.3.1 needs.
7. Multi-currency documents.
8. Discounting and NPV of response costs.
9. Metalog distributions, copulas, severity coupling between risks.
10. Calibration training quiz.
11. A PDF library. Records print through the browser.
12. Languages other than English. All strings are externalised.
13. Phone layout. Release 1 targets screens 1024 px wide and larger.
14. CISO Assistant adapter.
15. Encrypted IndexedDB.
16. Tolerance curves for gains.

## 4. User, decision and decision record

ADR-0001 defines the user and the decision. The decision record is the output for Sec. 4.4. It is one printable page, two at most.

| Section | Content | SP 800-221r1 |
|---|---|---|
| Header | Organization, registers in scope, as-of date, currency, seed, trials, engine version, document hash | 3.2.2 |
| Appetite | Capacity. Tolerance curve points. Approved by and on. | 3.2.1 |
| Before | LEC of the roll-up against the tolerance curve. Expected annual loss (EAL) and gain (EAG). P(loss above capacity). Tolerance gap. | 3.7, 4.3 |
| Funded portfolio | The responses in the best portfolio. First-year cash, annualised cost, annual benefit with its Monte Carlo standard error, net benefit. Marginal value of each response (net benefit lost if it is dropped). | 5.3.2, 5.4.1 |
| Alternatives | The next 3 portfolios with their net benefit and tolerance status. The fiscal baseline portfolio. The best portfolio at budget minus 20% and plus 20%. | 5.3.2, 5.4.1 |
| Not funded | Every candidate not in the best portfolio, with the reason (over budget, alternative of a funded option, adds less than it costs, excluded by leadership). | 5.3.2 |
| After | Same metrics as Before, with the funded portfolio applied. | 3.6 |
| Objectives view | Exposure before and after, grouped by the four enterprise objectives. | 4.3 |
| Accepted residual risk | Every leaf risk with response Accept or decision pending, with owner, reason and acceptance record. | 5.1.2 |
| Approval | Lines for management body names, signatures and date. | 4.4, 5.1.2 |
| Method note | Ranges are calibrated estimates. Matrices are display only (Cox 2008). Numbers carry Monte Carlo error. | 2.4.3 |

### 4.1 Report layout

The decision record and every printed report use the layout of the Coalition Risk Intelligence Briefing "How AI Impacts Cyber Risk" (October 2026, Sec. 13). That report puts the conclusion, the evidence and the forecast for each risk in one table on page 1, and gives a source under every table and chart.

1. Page 1 starts with a summary of three sentences or fewer, then a status table. Columns are Risk or register, Status, Evidence, and After funding.
2. Status is a coloured dot and one of the words "Within tolerance", "Breach" or "Clear breach" (Sec. 8.9). Colour is never the only signal (WCAG 2.2 criterion 1.4.1).
3. Evidence gives EAL with its standard error, P(at least one event), and the estimate basis. The basis comes from `estimate.method`: "Own data" for data-derived, "Mixed" for mixed, "Expert range" for expert-calibrated.
4. Every table and chart has a title, a number ("Figure 1", "Table 1") and a source line under it. For simulated numbers the source line gives the document hash, seed, trials and engine version.
5. Every number that comes from outside the document has a numbered note. The notes are at the end, with title and link.
6. Each funded response is an action box with owner, first-year cash and the date it must be in place.
7. A box "Limits of these numbers" states three limits. Estimates are calibrated ranges. Results carry Monte Carlo error. Matrices are display only (Sec. 8.13).
8. Numbered section headings (01, 02, ...) and a running footer with the report title and page number.
9. The decision record stays within 2 A4 pages. The layout rules do not change the content table above.

## 5. Screens by life cycle step

The screens follow the six steps of the ICTRM life cycle (Sec. 2.2, Fig. 2), plus a start screen and the enterprise view. A screen that does not change the decision record is out of scope.

| # | Screen | Life cycle step | ToC | Main elements |
|---|---|---|---|---|
| S1 | Start | | ES, 2.4.5 | Open, import, create, export, storage status, last-export date, remove all data |
| S2 | Context and strategy | 1 Identify the context | 1.1, 3.1, 3.1.1, 3.2.1, 3.2.2 | Mission, objectives, functions, disciplines, roles. Capacity, tolerance curve editor, appetite and tolerance statements. Scales, budget, thresholds, review cycle. |
| S3 | Identify and analyze | 2 Identify, 3 Analyze | 3.3 to 3.4.2, App. B | Register tree. Asset inventory. Risk table. Risk editor with tabs Scenario, Estimate, Drivers, Detail (RDR), Evidence, Links. Catalogue picker. |
| S4 | Prioritize | 4 Prioritize | 3.5, 3.8 Fig. 8 | LEC per register and roll-up with tolerance curve. Percentiles. Contribution table. Two-sided matrix (display only) with lint markers. |
| S5 | Respond and optimize | 5 Plan and execute | 3.6, 5.3, 5.4.1 | Drivers. Response options with costs, effects, control types and reserves. Budget. Optimization method. Ranked portfolios. Before and after LEC. Print decision record. |
| S6 | Monitor and adjust | 6 Monitor, evaluate, adjust | 3.7, 3.7.1, 5.1.2, 5.4.2 | KPIs and KRIs with observations. Review triggers. Acceptance records. Tolerance what-if. Forecast freeze, outcome entry, Brier score. |
| S7 | Enterprise view | Integration | 4.1 to 4.4, 5.2 | ERR (Fig. 10 layout). ERP by objective (Fig. 11 layout). Aggregation, merge and normalization. Portfolio view by register and period. |

Steps to complete (S2 to S7). A panel under the save bar leads a first-time user through the AT-5 task (Sec. 12.5) in plain words. It is help text (Sec. 12.5, Help).
1. The steps, in this order. 2 objectives with a statement. A tolerance curve with 3 or more points. 1 or more risks that are not Closed. An owner, an estimate and 1 or more objectives for each risk that is not Closed. A driver that 2 risks link to (optional). The first-year budget. 2 or more response options, 1 of them a candidate or selected. The run and the print of the decision record.
2. The app ticks a step from the saved document. It cannot tick the run and the print, because they do not change the document. The first required step that is not done is "Next" and shows how to do it. The other steps show it on request. The state of each step is also a word, so colour is never the only signal.
3. Each step has a button that saves, opens the screen of the step, and moves the focus to the heading of its section.
4. A closed panel stays closed on the other screens until the page loads again. The panel does not print. It shows no number for an estimate (hard rule 2).
5. S1 tells a new user to create a document and then open "Context and strategy".

Estimate entry words (S3). From the calibration method of Hubbard and Seiersen, *How to Measure Anything in Cybersecurity Risk*, 2nd ed., Wiley 2023.
1. "How many times per year does this happen, not counting events caused through the drivers below? Give a range you are 90% sure of." A toggle allows "once every N years". The app converts and swaps the bounds.
2. "When it happens once, what is the loss? Give a range you are 90% sure of." For a positive risk the word is "gain".
3. "Is there a hard maximum, for example a legal cap? Use minimum, most likely, maximum instead." This switches to PERT (the three-point estimate of IR 8286Ar1 Sec. 2.3.2.2).
4. "Can one event cause a second loss, for example customer claims after a disclosure? Add a secondary impact with its probability." (Sec. 3.4.2 lines 966 to 970.)
5. Live feedback under the fields. Median, P(at least one event in 12 months), expected annual impact.
6. Help text names the four cognitive biases of Sec. 3.3.2 (overconfidence, groupthink, following trends, availability bias) and explains the equivalent-bet test against overconfidence.

## 6. Risk components

Each subsection names its SP 800-221r1 source, what the app does, the schema fields and the tests.

### 6.1 Levels and integration (Sec. 2.1, 2.3, 4.1)

1. Registers form a tree with three levels, `system`, `organization` and `enterprise` (Fig. 1). The default for a new document is one organization register with system registers under it, because most target users have two levels.
2. A parent register shows its own entries and the roll-up of its subtree. The roll-up LEC is computed per trial over the subtree (Sec. 8.2). It is never a sum of child curves, because Sec. 5.3 says the composite "is something besides, and not necessarily equivalent to, the sum of the risk analyses".
3. An organization register can hold summary entries that merge child entries (Sec. 6.15). Summary entries never enter the simulation, so no risk is counted twice.
4. Registers move between levels as files (export at the child, import at the parent). This is the release 1 form of the Sec. 4.1 information flow.
5. Schema. `registers[]` with `id`, `level`, `parentRegisterId`, `kind`, `method`, `timeframeMonths`, `asOf`, `reportableEventThreshold`.

### 6.2 Life cycle (Sec. 2.2)

The six steps order the screens (Sec. 5). The register row shows which steps are complete for each risk (identified, analysed, prioritised, response decided, monitored). The app does not enforce an order.

### 6.3 Rules from Sec. 2.4

| Rule | Source | What the app enforces |
|---|---|---|
| R-2.4.1 | Complexity, interdependence, cascading risks | Shared drivers (Sec. 8.7), secondary impacts (Sec. 8.4), links between risks (Sec. 6.7.3). Lint L-06 flags a driver with one link. |
| R-2.4.2 | Lack of standardized measures | One scale set per document in `strategy.scales`. Money in one currency. Probability as a fraction of a stated timeframe. Rule V-11 rejects labels that are not on the scale. |
| R-2.4.3 | Informal analysis methods | Every estimate needs a method and a rationale of at least 10 characters (schema). Measured values after controls are stored (`detail.measured`). Forecasts and outcomes are logged and scored (Sec. 8.14). |
| R-2.4.4 | Overly focused on the system level | Every risk should name at least one enterprise objective (`objectiveIds`). Lint L-09 flags a risk without one. Roll-up to the top register. |
| R-2.4.5 | Gap between ICTRM output and ERM input | One exchange schema, valid IR 8286 JSON (Sec. 7). |
| R-2.4.6 | Opportunities not pursued | Positive risks are first-class entries (Sec. 6.12). |

### 6.4 Context and governance (Sec. 1.1, 3.1, 3.1.1)

1. `context.mission`, `context.externalContext`, `context.internalContext`, `context.stakeholders`.
2. `context.objectives[]` with `kind` from the four ERP objectives of Sec. 2.3 and 4.1 (strategic, operations, reporting, compliance) and a `statement`. Risks refer to them by `objectiveIds`.
3. `context.functions[]`, the mission- and business-critical functions of Sec. 5.1.1, with a criticality label. Assets refer to them, and an asset shows the highest criticality of the functions it supports, because "Those assets inherit the criticality/priority of the functions they support" (line 1469).
4. `context.disciplines[]`, the ICT risk disciplines in scope (Sec. 1.1 and 6 name cybersecurity, privacy, supply chain, OT, IoT and AI).
5. `governance.roles[]`, the Table 1 roles that exist in the company, with level, holder and responsibilities. A 50-person company fills 3 or 4 rows. No workflow uses the roles in release 1.

### 6.5 Capacity, appetite and tolerance (Sec. 3.2.1)

1. `appetite.capacity`, the "maximum amount of risk that the entity can absorb" (COSO, quoted in Sec. 3.2.1), as an amount with a rationale. The app shows P(loss above capacity), because "exceeding risk capacity could have dire consequences" (Sec. 3.7).
2. `appetite.toleranceCurve`, the quantitative tolerance for annual loss (Sec. 8.9).
3. `appetite.statements[]`, one per appetite statement. Each holds tolerances, controls and indicators in the shape of Table 9 (Sec. 6.11). A tolerance can have a machine-readable `breachWhen` trigger.
4. Table 2 gives five example pairs. The help text shows them as templates.
5. Identifying an emerging or horizon risk is a trigger to review appetite and tolerance (Sec. 3.3, lines 726 to 735). The app shows a review banner when a risk with `horizon` emerging or horizon is added.
6. Release 2. Guided questions on S2 let the management body set capacity, draft statements and tolerance points by answers of one click. The answers go into `appetite.elicitation` (schema 1.2.0). The full rules are in `docs/release-2/appetite-questions.md`.

### 6.6 Risk management strategy (Sec. 3.2.2)

| Field | Meaning | Source |
|---|---|---|
| `strategy.scales` | The common scale for likelihood, impact and exposure labels, with numeric representatives | "Establishing a common scale for assessing levels of risk will support consistent risk estimation" |
| `strategy.reviewFrequencyMonths`, `reportingFrequencyMonths` | Review and reporting cycle | "guidelines regarding the mechanisms and frequency of risk reporting" |
| `strategy.budget` | First-year cash for responses, CapEx and OpEx ceilings, fiscal year start | "guidance on ceilings for capital expenditures (CapEx) and operating expenses (OpEx)" |
| `strategy.inclusionThreshold` | Exposure below which a risk need not stay in the register | Sec. 3.5 lines 1056 to 1060 |
| `strategy.escalationThreshold` | Exposure at or above which a risk must appear in the parent register | Sec. 5.2.2 and 5.3.3 |
| `strategy.optimizationMethod` | algorithmic, fiscal or operational | Sec. 5.3.2 |

### 6.7 Identify the risks (Sec. 3.3 to 3.3.5)

#### 6.7.1 Scenario

1. The risk description is cause and effect, "if X occurs, then Y happens" (Table 3, Sec. 3.3.4). The editor offers the five scenario parts of Sec. 3.3.5 (threat source, threat event, vulnerability, assets, harmful impact) and writes them into the RDR fields.
2. `horizon` is current, emerging or horizon (Sec. 3.3).
3. The catalogue picker offers the 119 Risklet catalogue names (Sec. 6.7.7) and 3 opportunity templates from NIST text. A template gives text and category only, never numbers.

#### 6.7.2 Assets and valuation (Sec. 3.3.1)

`assets[]` with kind (information, software, hardware, service, people, facility, process), `external` and `provider` for assets outside direct control, owner, criticality and sensitivity labels, supported functions, and `value` with an amount, a basis (replacement cost, revenue dependency, contract penalty, regulatory, other) and a rationale. Sec. 3.3.1 says "The value of an asset extends beyond its replacement cost", so the basis is required with the amount. Risks refer to assets by `assetIds`. An asset that several risks share is a candidate driver (Sec. 8.7). The app suggests one when 2 or more risks name the same asset.

#### 6.7.3 Threats and opportunities (Sec. 3.3.2)

1. `threatSourceType` from SP 800-30r1 Table D-2 (adversarial, accidental, structural, environmental). The RDR fields hold the actor and the threat event as text.
2. For a positive risk, the RDR field `threatSourcesActors` holds the source of the opportunity (Sec. 3.8).
3. **Combinations.** Sec. 3.3.2 suggests "a third risk in the register that considers the likelihood and impact of an outage that affects both services at once". A third row double-counts when rows are summed. The app models the shared cause as a driver instead, and the simulation produces the joint outage (Sec. 8.7). `linkedRisks` with relation `combination-of` documents the link.
4. **Cascades.** "one primary risk event may trigger a secondary and even a tertiary event". The app models a cascade inside one risk as a secondary impact (Sec. 8.4), and across risks as `linkedRisks` with relation `cascades-to`.

#### 6.7.4 Exploitable and susceptible conditions (Sec. 3.3.3)

The RDR field `vulnerabilityPredisposingConditions` holds the condition. `evidence[]` holds what supports it (CVD Portal submission, audit finding, incident, document). The CVD Portal importer creates evidence from vulnerability exports (Sec. 9.5). New evidence on a risk sets its status to "Review needed" (Sec. 6.11).

#### 6.7.5 Consequences (Sec. 3.3.4)

1. Primary and secondary impacts as RDR text, and as numbers in `estimate.impactPerEvent` and `estimate.secondaryImpacts` (Sec. 8.4).
2. `impacts` holds the Table 6 split (financial OpEx and CapEx, reputation, mission) plus safety (Sec. 2.1 line 344 names safety as an ERM purpose). Each has a label on the common scale and an optional amount.

#### 6.7.6 Register use (Sec. 3.3.5)

The register has the Fig. 4 and Table 3 columns. The NIST names and meanings are kept (Sec. 7.2 and 7.3). Current values are stored. Planned values after response are in `detail.planned` (Fig. 15 rows "after controls will be"). Measured values after the response is in place are in `detail.measured`. Lines 857 to 860 mention residual and target residual risk, and Fig. 11 has a Residual column. Both map to `detail.planned`.

#### 6.7.7 Categories

The category is the cause domain. The impacts hold the consequences. A ransomware attack is category `ict` with financial and reputation impacts.

| Code | Meaning | Release 1 subcodes |
|---|---|---|
| `ict` | Cause is in ICT, including attacks, failures and errors | `ict.malware`, `ict.fraud`, `ict.data-exfiltration`, `ict.availability`, `ict.vulnerability`, `ict.supply-chain`, `ict.identity`, `ict.misconfiguration`, `ict.physical-environmental`, `ict.insider`, `ict.ai` |
| `financial` | Markets, customers, credit, liquidity | `financial.revenue`, `financial.cost`, `financial.liquidity`, `financial.credit` |
| `legal` | Law, regulation, contract, litigation | `legal.regulatory`, `legal.privacy`, `legal.contract`, `legal.ip`, `legal.litigation` |
| `operational` | People, process, facilities, suppliers outside ICT | `operational.people`, `operational.process`, `operational.supplier`, `operational.facilities` |
| `strategic` | Strategy, competition, innovation | `strategic.market`, `strategic.innovation`, `strategic.partnership` |
| `safety` | Harm to people (SP 800-82r4 ipd for OT) | `safety.product`, `safety.workplace`, `safety.ot-process` |
| `reputation` | Stakeholder perception event with no other primary cause | `reputation.customer`, `reputation.public`, `reputation.regulator` |

The schema accepts any subcode that starts with a valid code. The app warns on subcodes outside this list.

| Source label | Code and subcode |
|---|---|
| Fig. 10 "Operational Risk", "Financial Risk", "Strategic Risk", "Compliance Risk" | `operational`, `financial`, `strategic`, `legal` |
| NIST XLSX Fig. 7 SP 800-53 family names | `ict` with subcode by family. PE to `ict.physical-environmental`, SI to `ict.malware`, CP to `ict.availability`, SC to `ict.data-exfiltration`, SA to `ict.supply-chain`, AC and IA to `ict.identity`, CM to `ict.misconfiguration` |
| CVD Portal export | `ict.vulnerability` |
| Risklet catalogue Malware | `ict.malware` |
| Supply Chain, DevOps, Container, Development, Vendor (except row 54) | `ict.supply-chain` |
| Access, Identity, Authentication, Remote Access | `ict.identity` |
| Data, Source Code, Document, HR | `ict.data-exfiltration` |
| Infrastructure, Network, Storage, Database, Backup, Email, Systems, Edge Computing | `ict.availability`, except "Network Segmentation Failure", "Network Sensor Blind Spots" and "Load Balancer Configuration Drift" to `ict.misconfiguration` |
| Cloud, Configuration, Change, Automation | `ict.misconfiguration` |
| Security, Web, API, Endpoint, Mobile, IoT, Blockchain | `ict.vulnerability`. "Security" is a catch-all in the source (15 rows). The importer asks the user to confirm each. |
| Physical | `ict.physical-environmental` |
| AI, Emerging Tech | `ict.ai` |
| Business | `ict.fraud` |
| Compliance | `legal.regulatory`, except row 61 to `legal.privacy` and row 64 to `legal.contract` |
| Staffing | `operational.people` |
| Row 54 "Vendor Bankruptcy/Closure" | `operational.supplier` |

Opportunity templates (the catalogue has none), each quoted from NIST.
1. "A strategic opportunity to hire a famous technologist to establish a new satellite communications initiative." (SP 800-221r1 Fig. 10 item 2)
2. "Construction of a new alternate data center improves the resilience of financial infrastructure and reduces the likelihood of an interruption." (SP 800-221r1 lines 844 to 846)
3. "Adopting a new cloud-based authentication platform introduces moderate implementation risks but presents a high-likelihood opportunity to reduce credential-based incidents by 40 % and improve user access efficiency." (SP 800-221r1 Sec. 3.8)

### 6.8 Analyze (Sec. 3.4, 3.4.1, 3.4.2)

1. `register.method` is qualitative, semi-quantitative or quantitative (Sec. 3.4.1). A register can move from qualitative to quantitative risk by risk.
2. Quantitative estimates are calibrated 90% ranges, PERT three-point estimates or constants, with secondary impacts and drivers (Sec. 8.3 and 8.4).
3. "The estimation of the likelihood and impact of a risk event should account for existing and planned controls" (Sec. 3.4.2). The current estimate includes controls in place. Planned controls are response options with effects (Sec. 6.10).
4. "a consistent timeframe should be used for estimating the likelihood of each risk" (Sec. 3.4.2). `register.timeframeMonths` fixes it.
5. Monte Carlo is the engine (Sec. 8). Bayesian analysis and event tree analysis are out of scope.

### 6.9 Prioritize (Sec. 3.5)

1. `priority` is an integer from 1. The app proposes priorities from expected annual loss for negative risks, highest first. The user can override with `priorityOverride` and a reason (Sec. 6.16).
2. Risks below `strategy.inclusionThreshold` are marked "below threshold" and can be archived (lines 1056 to 1060).
3. The matrix of Fig. 5 and the semi-quantitative matrix of Fig. 6 are display only (Sec. 8.13).

### 6.10 Respond (Sec. 3.6)

| Field | Meaning | Source |
|---|---|---|
| `responseType` | Table 4 types for negative risks, Table 5 types for positive risks | Tables 4, 5 |
| `controlTypes[]` | preventative, deterrent, detective, corrective, compensating | Sec. 3.6 control list |
| `informativeReferences[]` | Free text, for example "CSF 2.0 PR.AA-03" or "SP 800-53r5 IA-2(1)" | "including a particular informative reference ... may help guide and describe risk response" |
| `costs.oneOff`, `costs.annual`, `costs.lifetimeYears` | Costs of the response | Table 3 Risk Response Cost |
| `costs.reserveAmount` | Risk reserve set aside in year 1, released if the target risk does not occur | Sec. 3.6, 3.7.1 |
| `effects[]` | The estimate of a risk or a driver after the response | Fig. 15 "after controls will be" |
| `introducesRisks[]` | New risks the response causes. Each such risk has `onlyWithResponse`. | Sec. 3.6 lines 1072 to 1074, "adding multi-factor authentication ... may introduce a new risk of decreased productivity" |
| `forced` | require or exclude, with reason and who decided | Sec. 5.3.2 operational optimization and mandatory requirements |
| `decision` | Who decided, when, why | Sec. 5.1.2 |

Sec. 5.1.1 gives a decision rule that the app shows as a suggestion. If exposure is within tolerance, the risk may be accepted. If not, mitigate or transfer. If no cost-effective response exists, avoid. If the tolerance itself must change, raise an exception (Sec. 6.14).

### 6.11 Monitor, evaluate and adjust (Sec. 3.7, 3.7.1, 5.1.2)

1. **KPIs and KRIs.** Each appetite statement holds tolerances, controls, KPIs, leading KRIs and lagging KRIs (Table 9). A tolerance has `breachWhen`, an indicator has `firesWhen`. Both are triggers with conditions (metric, operator, threshold, unit) combined by all or any. The user enters observations. The app evaluates the triggers on the latest observation and shows fired, not fired or no data.
2. **Review triggers (Sec. 3.7.1).** A risk goes to status "Review needed" when new evidence is imported for it, when a KRI linked to its appetite statement fires or a tolerance of that statement breaches, when its `reviewDue` date passes, or when a new emerging or horizon risk appears in its category. A breach of the tolerance curve is a result of the roll-up, not of one risk, so it starts no review. When the app sets the status itself, the change log entry has the app as actor and lists the reasons in `reasons` (Sec. 6.18).
3. **Risk reserves (Sec. 3.7.1).** The record shows each reserve with its probability of use and the expected amount released at year end.
4. **Capacity.** P(loss above capacity) on every result screen (Sec. 3.7).
5. **Forecasts.** The forecast and outcome log tests whether the analysis was right (Sec. 8.14).

### 6.12 Positive risks (Sec. 2.4.6, 3.8)

1. `polarity` positive. Response types from Table 5. Gains are positive amounts in `estimate.impactPerEvent`.
2. A register can be an opportunity register (`kind` opportunity), because "the organization could manage an opportunity risk register separately" (Sec. 3.8).
3. The two-sided matrix of Fig. 8 shows negative risks on the left and positive risks mirrored on the right, display only.
4. "the residual risk uncertainty of not realizing the opportunity" (line 1224) is shown as 1 minus P(at least one realization).
5. Positive risks never enter the loss exceedance curve. Their expected gain counts in the net benefit of a portfolio (Sec. 8.11), because risk optimization is "to minimize negative and maximize positive consequences" (Sec. 5.3.2, ISO 31073).
6. `linkedRisks` with relation `trade-off` joins a positive risk to the negative risks it brings (Sec. 5.4.3, "identify individual negative risks so that they can be matched to their corresponding positive risks").

### 6.13 ERR, ERP and leadership decisions (Sec. 4.2, 4.3, 4.4)

1. **ERR view (Fig. 10).** Columns ID, Pri., Risk Description, Risk Category, Financial Impact (OpEx, CapEx), Reputation Impact, Mission Impact, Likelihood, Exposure Rating, Risk Response, Risk Owner, Status. Golden test G1.
2. **ERP view (Fig. 11).** One block per enterprise objective, headed "<KIND> OBJECTIVE" and the statement. Rows per risk with Impact and Likelihood, each with Last, Current and Residual. Then Current Risk Response (`detail.implementedResponseDescription`), Proposed Risk Response (`riskResponseDescription`) and Risk Owner. Last comes from `previousAssessment`, Residual from `detail.planned`. Golden test G5.
3. **Portfolio view (Table 7, partial).** Rows are the registers of the tree (Enterprise, then each child). Columns are current and previous period, with EAL for the financial profile and the highest reputation and mission labels. The previous period comes from `previousAssessment`. "Close the period" on S7 copies the current assessment of each open risk in scope into it. It copies labels and the impact split, and numbers only when they are not in `defaultedFields`, because the previous assessment has no `defaultedFields` (hard rule 2). The Table 7 sub-columns are out of scope (Sec. 3.2).
4. **Breakdown (Fig. 12).** The category tree (code, subcode, risk) is the risk breakdown structure.
5. **Leadership decisions (Sec. 4.4).** The decision record (Sec. 4).

### 6.14 Coordination (Sec. 5.1, 5.1.1, 5.1.2)

1. **Acceptance records.** `acceptance` on a risk with kind `acceptance` or `tolerance-exception`, who accepted, when, until when, and why. Sec. 5.1.2 says "the communication of risk has been accepted, which implicitly accepts the risk itself (e.g., through an exception process)". An acceptance past `validUntil` sets the risk to "Review needed".
2. **Audit findings.** Evidence of kind `audit-finding`. Several low-severity findings in different systems that share a category are flagged together, because "lower-severity findings may spread through multiple systems to create risk in aggregate" (Sec. 5.1.2).
3. **Response suggestion.** The Sec. 5.1.1 rule of Sec. 6.10.
4. **Exchange.** Child registers go to the parent as files (Sec. 6.1). The Table 8 workflow is out of scope.

### 6.15 Aggregation and normalization (Sec. 5.2.1, 5.2.2, 5.2.3)

1. **Aggregation.** The parent view lists all child entries grouped by category, with source tags of the form register letter and number (for example A-1) as in line 1595.
2. **Normalization actions (Table 10).** De-duplicate and combine (merge selected rows into one summary entry with `sourceRefs`). Reprioritize (`priorityOverride`). Resolve disparities (layout `one-row-per-response` or `one-row-all-responses`). Adjudicate key risks (escalation threshold).
3. **Three-point roll-up** of the summary values (Sec. 8.15).
4. **Integrating details (Sec. 5.2.3).** Raw child entries stay visible from the summary entry. Response cost roll-up is the total by default, or the weighted average if the user chooses it. The weight of each source cost is the exposure rating of the source, so a source with a larger expected loss or gain counts more. When every exposure rating is 0, the weighted average is the plain mean. The result is rounded to whole currency units. `rollUp.responseCostRule` records the weighted average. Without it the cost is the total. The summary owner is an organization-level person. Status values are the common enum.
5. **Response consistency (Sec. 5.3).** Lint L-10 flags summary entries whose sources have different response types, so leaders can "clarify which treatment is the appropriate response".

### 6.16 Adjusting responses and priorities (Sec. 5.3, 5.3.1, 5.3.3, 5.4.4)

1. `priorityOverride` with priority, who, when, reason and factors from Sec. 5.3.1 (mission, financial, reputation, legal requirement, shareholder sentiment, merger or valuation, quick win, leadership priority).
2. Priorities in child registers are provisional (Sec. 5.3.3). A parent summary entry can carry its own priority. The child keeps its own.
3. The record lists all overrides made since the last review (Sec. 5.4.4).

### 6.17 Enterprise adjustments (Sec. 5.4, 5.4.1, 5.4.2, 5.4.3)

1. **Budget allocation (5.4.1).** The optimization (Sec. 8.11) with budget sensitivity at minus 20% and plus 20%. "Quantitative methods offer specific calculations that enable risk practitioners to simulate risk likelihood and financial impact before and after implementation" is exactly what S5 does. A driver response (one control for many risks) is the "centrally fund" case.
2. **Appetite and tolerance (5.4.2).** A what-if editor shows the result with a changed tolerance curve, without a new simulation (the per-trial totals are kept). Saving a change moves the old curve into `appetite.history` with date, person and reason.
3. **Constraints overly stringent (5.4.3).** Lint L-11 flags a tolerance curve that the LEC never comes near (LEC below 25% of T at every grid point), and a positive risk with no Realize, Share or Enhance option. Trade-off links are in Sec. 6.12.
4. **Priority (5.4.4).** Sec. 6.16.

### 6.18 RDR and change log (Appendix B, Appendix D)

1. The RDR is the Detail tab of the risk editor and the RDR export (Sec. 7.4). The print view lists the 36 Fig. 15 rows in Fig. 15 order.
2. `changeLog[]` records every change (time, actor, entity, JSON Pointer path, before, after). A change that the app makes itself also has `reasons`, each with a fixed `key` and a `text` for people. Schema versions follow Sec. 7.7. Concept ids follow Sec. 3.1.

## 7. Data exchange schema

### 7.1 Design

1. One JSON document holds context, governance, strategy, registers, appetite, assets, drivers, risks, responses, forecasts, simulation settings, provenance and change log.
2. Each risk is `allOf` the NIST IR 8286 Rev. 1 risk register schema (`$id` `https://csrc.nist.gov/csrc/media/schema/olir/risk_register.v2.schema.json`). Every risk entry is a valid IR 8286 entry. Extensions sit next to the NIST fields. `unevaluatedProperties` is false, so misspelt fields fail.
3. The risk detail uses the NIST IR 8286 Rev. 1 RDR property definitions by `$ref`. It holds only the RDR fields that the register entry does not already hold. The export builds the full RDR (Sec. 7.4).
4. The NIST schemas are vendored in `schema/vendor/nist-ir8286r1/` and resolved by `$id`. SHA-256 values are in Sec. 13.
5. Polarity constrains the response types with `if` and `then` (Table 4 for negative, Table 5 for positive).
6. Rules that JSON Schema cannot express are semantic rules (Sec. 7.6).
7. `format` (`date`, `date-time`) is an annotation only. Neither the Ajv validators in the app nor `schema/validate.py` check it, so both give the same verdict (AT-1). A wrong date string passes the schema. Release 1 accepts this. A date check in the import step is open question Q7.

### 7.2 Field reference

| Field | IR 8286 register | IR 8286 RDR | OSCAL POA&M (Sec. 7.5) | SP 800-221r1 |
|---|---|---|---|---|
| `riskId` | `riskId` | `riskIdNumbers` | `risk.uuid` (UUIDv5), prop | Table 3 |
| `registerId` | none | `systemAffected` default | prop | Fig. 1 |
| `priority`, `priorityOverride` | none (N4) | none | props | Table 3, 5.3.1 |
| `polarity` | none (N5) | none | prop | 2.4.6, 3.8 |
| `riskDescription` | same | `riskScenarioDescription` default | `risk.title` | Table 3 |
| `riskCategory`, `category` | `riskCategory` | `riskCategory` | props | Table 3 |
| `riskLikelihood` | same | `likelihoodBeforeControls` | facet `likelihood`, state initial | Table 3 |
| `riskImpact` | same | `impactBeforeControls` | facet `impact`, state initial | Table 3 |
| `exposureRating` | same | `exposureRatingBeforeControls` | facet `risk`, state initial | Table 3 |
| `*Label` fields | none (N9) | in `currentRiskAnalysis` | facet values | Fig. 10, 11 |
| `impacts` | none (N9) | none | props | Table 6 |
| `riskResponseType`, `riskResponseCost`, `riskResponseDescription` | same | `plannedRiskResponse`, `plannedResponseCost`, `plannedRiskResponseDescription` | remediation | Tables 3, 4, 5 |
| `riskOwnerPointOfContact` | same | same | prop | Table 3 |
| `status` | same | none | `risk.status` mapped, prop exact | Table 3 |
| `responseDecision`, `acceptance` | none | none | props | 5.1.2 |
| `objectiveIds`, `assetIds`, `horizon`, `threatSourceType` | none | `assetsAffected`, `threatSourcesActors` text | props | 2.4.4, 3.3 |
| `estimate` | none (N8) | in `currentRiskAnalysis` | props, group `estimate` | 3.4 |
| `driverLinks`, `linkedRisks`, `onlyWithResponse` | none | in `dependencies` | props | 2.4.1, 3.3.2, 3.6 |
| `previousAssessment` (with `impacts` since 1.1.0) | none | none | props | 4.3 |
| `detail.*` | none | same names | `description`, `statement`, props | Fig. 15 |
| `detail.planned` | none | `likelihoodAfterControlsWillBe`, `impactAfterControls`, `expectedExposureRating` | facets, state adjusted | Fig. 15, Fig. 11 Residual |
| `detail.measured` | none | `actualResponseCost`, `likelihoodAfterControlsAreInPlaceWillBe`, `impactAfterControlsAreInPlace`, `finalExposureRating` | remediation props | Fig. 15 |
| `detail.implementedResponseDescription`, `detail.residualResponseAsImplemented` | none (N17) | none | props | Fig. 11, Fig. 15 |
| `sourceRefs`, `rollUp` (with `responseCostRule` since 1.1.0) | none | suffix of `riskIdNumbers` | props | 5.2.1, 5.2.2, 5.2.3 |
| `evidence` | none | `sourceOfRiskInformation` | props | 3.3.3 |
| `reviewDue` | none | `followUpDate` default | `risk.deadline` | Fig. 15 |
| `defaultedFields` | none | none | prop | |

### 7.3 Numeric meaning of the NIST fields

NIST gives units in descriptions only. "Likelihood (%)" holds a fraction in both NIST examples (0.1 in the RDR JSON example, 0.75 in the XLSX Fig. 7 example). "Impact ($)" holds money in the JSON schema but a fraction in the XLSX example.

| Field | Meaning | Quantitative registers | Qualitative registers |
|---|---|---|---|
| `riskLikelihood` | P(at least one event in the register timeframe), 0 to 1 | Simulated share of trials with N at least 1 | Representative value of the likelihood label |
| `riskImpact` | Mean annual impact given at least one event, in document currency | EAL divided by `riskLikelihood` | Rule D-Q1 or D-Q3 |
| `exposureRating` | Expected annual loss or gain | `riskLikelihood` times `riskImpact`, rounded | Rule D-Q1 or D-Q3 |

`riskLikelihood` times `riskImpact` equals `exposureRating`, as the NIST RDR example implies (0.1 times 1 500 000 = 150 000). Rule V-07 checks it within 1 currency unit.

1. **D-Q1.** If an exposure label exists, `exposureRating` is its representative and `riskImpact` is `exposureRating` divided by `riskLikelihood`. The exposure label is the expert's judgement and stays primary (Fig. 10).
2. **D-Q2.** A risk without estimates holds 0 in the three numeric fields and lists them in `defaultedFields`. The RDR `currentRiskAnalysis` then says "Not estimated. Numeric fields are placeholders." Export asks the user to confirm (rule E-02).
3. **D-Q3.** If only likelihood and impact labels exist (Fig. 11), `exposureRating` is the product of their representatives.

### 7.4 IR 8286 projection

The reference code is `project_register` and `project_rdr` in `schema/validate.py`. The TypeScript code must give equal output for the three examples.

1. **Register entry.** The 11 NIST fields, copied. The export file is a JSON array.
2. **RDR.** One object per risk in a second array.

| RDR field | Value |
|---|---|
| `riskIdNumbers` | `riskId`, plus the text `; sources ` and the source labels when `sourceRefs` exist |
| `systemAffected` | `detail.systemAffected`, else the register title |
| `organizationOrBusinessUnit` | `detail` value, else `document.organization`, else empty |
| `riskScenarioDescription` | `detail` value, else `riskDescription` |
| `assetsAffected` to `otherScenarioDetails` (8 fields) | `detail` value, else empty string |
| `riskCategory` | `riskCategory` |
| `currentRiskAnalysis` | `detail` value, else generated text (method, ranges, secondary impacts, drivers, seed, trials, or labels) |
| `likelihoodBeforeControls`, `impactBeforeControls`, `exposureRatingBeforeControls` | the three current values |
| `plannedRiskResponse`, `plannedRiskResponseDescription`, `plannedResponseCost` | the three response fields |
| `resourceRequirementsForPlannedRisk` | `detail` value, else empty |
| `likelihoodAfterControlsWillBe`, `impactAfterControls`, `expectedExposureRating` | `detail.planned`. For quantitative risks the engine first writes them from a run with all `selected` and `implemented` responses. Else the current values. |
| `actualResponseCost` | `detail.measured.actualResponseCost`, else 0 |
| `likelihoodAfterControlsAreInPlaceWillBe`, `impactAfterControlsAreInPlace`, `finalExposureRating` | `detail.measured`, else the current values. Before a response is in place, the measured state is the current state. |
| `riskOwnerPointOfContact` | same |
| `dateOfRiskIdentification`, `currentStatusDate` | `detail` value, else register `asOf` |
| `sourceOfRiskInformation` | `detail` value, else "Risk register entry" |
| `dependencies` | `detail` value, else one line per driver link |
| `followUpDate` | `detail` value, else `reviewDue`, else empty |
| `comments` | `detail.comments` if present |

### 7.5 OSCAL POA&M mapping

Target is OSCAL 1.2.3 (release of 2026-08-07, `oscal_poam_schema.json`, JSON Schema draft-07).

| OSCAL element | Value |
|---|---|
| `uuid` | UUIDv5 of `document.id` in a fixed namespace UUID stored in the code |
| `metadata` | title, last-modified, version, `oscal-version` 1.2.3, one party for the organization |
| `risks[]` | One per risk. `uuid` is UUIDv5 of `document.id/riskId`. `title` is `riskDescription`. `description` is the scenario. `statement` is the primary impact or a generated sentence. `status` maps Open to `open`, In treatment to `remediating`, Monitored to `open`, Accepted to `deviation-approved`, Review needed to `investigating`, Closed to `closed`. |
| `characterizations[0].facets` | System `http://csrc.nist.gov/ns/oscal`, names `likelihood`, `impact`, `risk`, value as label or number, prop `state` initial. A second set with state adjusted from `detail.planned`. |
| `characterizations[1].facets` | System `https://www.portaregulus.com/ns/risk`, names `likelihood-probability`, `impact-conditional-mean`, `expected-annual-impact`, `polarity` |
| `remediations[]` | The NIST response (lifecycle `planned` if decided, else `recommendation`) and each response option that affects this risk or its drivers, with props for type, costs, control types and references |
| `deadline` | `reviewDue` at midnight UTC |
| `props` | Namespace `https://www.portaregulus.com/ns/risk`. Every remaining scalar field, one prop per field, `group` for objects. |
| `poam-items[]` | One per risk, `related-risks` to the risk uuid |
| `back-matter.resources[0]` | Title `pr-risk-document`, `base64` of the RFC 8785 canonical native document, prop `sha256` |

Import uses the payload when its hash matches (lossless path). Else it imports the mapped elements (native path) and lists the fields that came back empty. AT-4 tests both.

Encoding rules, settled in the build (`src/oscal/poam.ts`).
1. The namespace UUID for UUIDv5 is `b3f6d0a2-5c1e-4e8a-9f42-7d2c6a1e9b50`. It never changes.
2. OSCAL prop values must be one line without leading or trailing space. A plain string that fits goes as is. A number gets class `number`. Every other value is JSON text with class `json`. Detail fields use `group` "detail".
3. Titles are one line. Line breaks become spaces in the title, and the exact text stays in a prop.
4. Each characterization names the app as its origin. The app is a `software` component in `local-definitions`, and the POA&M has a `system-id` (RFC 4122) instead of `import-ssp`.
5. The response of the NIST register entry is the remediation with prop `role` "nist-response". Response options are remediations with prop `role` "response-option".
6. On the native path every risk field comes back. Context, strategy, appetite, assets, drivers, responses, forecasts, simulation settings, provenance and change log do not, and the import report says so. Registers that are not in the open document are created with default fields.

### 7.6 Semantic rules and lint

Errors (V) block save or import. Warnings (L) show in the UI and in the record annex. `schema/validate.py` implements the V rules that need no simulation.

| Id | Rule |
|---|---|
| V-01 | Ids are unique per kind. |
| V-02 | `parentRegisterId` exists. The register tree has no cycle. |
| V-03 | `registerId` of a risk exists. |
| V-04 | Response types match polarity. |
| V-05 | Driver links refer to existing drivers. |
| V-06 | `sourceRefs` refer to existing risks. A risk is not its own source. |
| V-07 | `exposureRating` equals `riskLikelihood` times `riskImpact` within 1 currency unit. |
| V-08 | In a quantitative register, every leaf risk has an `estimate`. |
| V-09 | `responseDecision` pending implies response `["Accept"]` with cost 0. |
| V-10 | Lognormal lower is below upper. PERT min, mode, max are in order. |
| V-11 | Every label (current, previous, planned, measured, impacts, previous impacts) is on `strategy.scales`. |
| V-12 | Tolerance curve loss strictly ascending, probability strictly descending. |
| V-13 | Frequency upper bound at most 100 per year. Trials 1 000 to 1 000 000. |
| V-14 | Response effects target an existing risk or driver. Bundles list existing options. |
| V-15 | Forecast window end after start. Outcome on or after window end. |
| V-16 | `objectiveIds` exist in `context.objectives`. |
| V-17 | `assetIds` exist in `assets`. |
| V-18 | `linkedRisks` refer to other existing risks. |
| V-19 | `onlyWithResponse` names a response whose `introducesRisks` lists the risk, and the reverse. |
| V-20 | Asset `supportsFunctionIds` exist in `context.functions`. |
| V-21 | Forecasts refer to existing risks. |
| L-01 | Two risks are in matrix order opposite to their EAL, which differ by a factor of 2 or more (Cox 2008). |
| L-02 | A lognormal range with upper divided by lower above 1 000. |
| L-03 | Dominance. Risk A is rated equal or higher than risk B on every ordinal input, higher on at least one, but has a lower exposure label. |
| L-04 | An exposure label does not match the band of the numeric exposure. |
| L-05 | Owner empty, "Unassigned" or "TBD". |
| L-06 | A driver with fewer than 2 links. |
| L-07 | A risk with `defaultedFields`. |
| L-08 | More than 5% of trials with a clipped rate (Sec. 8.5). |
| L-09 | A risk with no `objectiveIds` (rule R-2.4.4). |
| L-10 | A summary entry whose sources have different response types (Sec. 5.3). |
| L-11 | Tolerance never binding, or a positive risk with no Realize, Share or Enhance option (Sec. 5.4.3). |

### 7.7 Schema versioning

1. `schemaVersion` is semantic. The `$id` contains the version. Version `1.1.0` adds three optional fields, `previousAssessment.impacts`, `rollUp.responseCostRule` and `changeLog[].reasons`. Version `1.2.0` (release 2) adds the optional object `appetite.elicitation` (Sec. 6.5 item 6). A `1.0.0` or `1.1.0` document is also a valid `1.2.0` document, so the schema accepts all three values and the app needs no migration. The app writes `1.2.0` when it saves. It refuses a newer minor version, for example `1.3.0`, because that can hold fields that the app does not know.
2. A new optional field is a minor version. A changed meaning or a new required field is a major version.
3. The app reads the current and the previous major version and migrates the previous one on import, with a provenance record.
4. When NIST publishes the final SP 800-221r1 or new IR 8286 schemas, vendor the new files, keep the old ones, add a migration test, and update the concept id table (Sec. 3.1).

## 8. Risk math

### 8.1 Principles

1. Ranges, not points.
2. Matrices are display only (Sec. 8.13).
3. Same document, seed and engine version give the same numbers.
4. Every number in the record shows its Monte Carlo standard error.
5. Aggregate per trial, then build curves. Never add curves or percentiles.

### 8.2 Model

For each trial t = 1 to T, in this order.

```
for each driver d:
    lambda_d,t  ~ F_d                      (driver rate, events per year)
    D_d,t       ~ Poisson(min(lambda_d,t, 700))
for each leaf risk r (estimate present, no sourceRefs, and onlyWithResponse funded if set):
    lambda_r,t  ~ F_r                      (background rate, events per year)
    B_r,t       ~ Poisson(min(lambda_r,t, 700))
    M_r,d,t     ~ Binomial(D_d,t, q_r,d)   for each driver link
    N_r,t       =  B_r,t + sum over d of M_r,d,t
    X_r,t,k     =  primary + secondaries   for k = 1 to N_r,t (Sec. 8.4)
    S_r,t       =  sum over k of X_r,t,k
for each register g:
    L_g,t = sum of S_r,t over negative leaf risks in the subtree of g
    W_g,t = sum of S_r,t over positive leaf risks in the subtree of g
```

If the register timeframe is m months, all annual rates are multiplied by m / 12 before sampling.

### 8.3 Inputs

| Input | Unit | Distributions | Limits |
|---|---|---|---|
| Risk background frequency | events per year | lognormal (90% interval), PERT, constant | upper at most 100, lower above 0 for lognormal |
| Driver frequency | driver events per year | same | same |
| Trigger probability q | probability that one driver event causes one event of the risk | number | 0 to 1 |
| Impact per event | currency | lognormal (90% interval), PERT, constant | above 0 |
| Secondary impact | probability and impact per event | number and distribution | probability 0 to 1 |

Background frequency means events that are not caused through the linked drivers. The UI shows the implied total frequency, E[lambda_r] plus the sum of q_r,d times E[lambda_d].

### 8.4 Distributions and secondary impacts

**Lognormal from a 90% interval (L, U).** With z = 1.6448536269514722.

```
mu    = (ln L + ln U) / 2
sigma = (ln U - ln L) / (2 z)
X     = exp(mu + sigma * Phi^-1(u))
E[X]  = exp(mu + sigma^2 / 2),   E[X^2] = exp(2 mu + 2 sigma^2)
```

The divisor 3.29 often quoted is 2 z rounded (Hubbard and Seiersen 2023). Use the exact z.

**PERT from (a, m, b), lambda = 4.** Malcolm et al. (1959), Operations Research 7(5) 646, DOI 10.1287/opre.7.5.646. This is the three-point estimate of IR 8286Ar1 Sec. 2.3.2.2 with mean (O + 4M + P) / 6.

```
alpha = 1 + 4 (m - a) / (b - a),  beta = 1 + 4 (b - m) / (b - a)
X     = a + (b - a) Y,  Y = G1 / (G1 + G2),  G1 ~ Gamma(alpha, 1),  G2 ~ Gamma(beta, 1)
E[X]  = (a + 4 m + b) / 6,  Var[X] = (E[X] - a)(b - E[X]) / 7
```

Gamma by Marsaglia and Tsang (2000), valid because alpha and beta are at least 1. If a equals b, X is a.

**Constant.** X equals the value.

**Secondary impacts (Sec. 3.3.2, 3.4.2).** Each event of the risk draws its primary impact P. Then each secondary impact j happens with probability p_j and adds S_j.

```
X      = P + sum_j B_j S_j,  B_j ~ Bernoulli(p_j)
E[X]   = E[P] + sum_j p_j E[S_j]
E[X^2] = E[P^2] + 2 E[P] sum_j p_j E[S_j] + sum_j p_j E[S_j^2] + sum_{j != k} p_j p_k E[S_j] E[S_k]
```

This keeps the primary and the secondary loss of one scenario in one row, which Sec. 3.4.2 asks for ("Secondary loss events should be captured with primary loss events"). It avoids the double count of separate rows (NIST comment N12).

### 8.5 Counts

Poisson by inversion with one uniform u (Devroye 1986, Non-Uniform Random Variate Generation, p. 505).

```
x = 0; p = exp(-lambda); s = p
while u > s and x < lambda + 20 sqrt(lambda) + 50:
    x = x + 1; p = p * lambda / x; s = s + p
return x
```

Sampled rates above 700 are set to 700 and counted (lint L-08). Binomial thinning M ~ Binomial(D, q) is the count of D uniforms below q.

### 8.6 Random numbers

1. **Stream key.** One stream per (entity kind, entity id, variable), for example `risk|R-01|rate`. Variables are `rate`, `count`, `impact` and `thin|<driverId>` for risks, and `rate`, `count` for drivers.
2. **Stream seed.** SHA-256 of the UTF-8 string `<seed>|<stream key>`. The first 16 bytes give four little-endian uint32 values s0 to s3 for xoshiro128** (Blackman and Vigna 2018, reference code at prng.di.unimi.it). If all four are 0, set s0 to 0x9E3779B9. Use a pure TypeScript SHA-256, because WebCrypto is async.
3. **Trial word.** Each stream yields exactly one 32-bit word w per trial.
4. **Draws inside a trial.** All draws of one variable in one trial come from mulberry32 seeded with w. The impact stream draws the primary impact, then for each secondary impact one Bernoulli uniform and, if it hits, the secondary draw.

```
// xoshiro128** next(), all values uint32
result = rotl(Math.imul(s1, 5), 7); result = Math.imul(result, 9) >>> 0
t = s1 << 9
s2 ^= s0; s3 ^= s1; s1 ^= s2; s0 ^= s3; s2 ^= t; s3 = rotl(s3, 11)

// mulberry32 next()
a = (a + 0x6D2B79F5) | 0
t = Math.imul(a ^ (a >>> 15), 1 | a)
t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
return (t ^ (t >>> 14)) >>> 0

// uniform in (0, 1) with 53 bits
hi = next() >>> 5; lo = next() >>> 6
u  = (hi * 67108864 + lo + 0.5) / 9007199254740992
```

5. **Normal quantile.** Wichura (1988), AS 241 PPND16, Applied Statistics 37(3) 477-484.
6. **Determinism.** Integer streams are identical in every engine. `Math.exp` and `Math.log` may differ in the last bit between engines (ECMA-262 does not fix them). Results are bit-identical in one engine and agree within 1e-9 relative across engines.
7. **Common random numbers.** Adding, removing or changing one risk does not change the draws of any other risk. Portfolio comparisons therefore measure differences, not noise.

### 8.7 Shared drivers (common shock)

The driver model is the common-shock model of Lindskog and McNeil (2003), ASTIN Bulletin 33(2) 209-238, DOI 10.2143/AST.33.2.503691. It needs no correlation matrix, which users cannot calibrate.

Exact results for a constant driver rate lambda_d and constant background rates (test oracles).

```
E[N_r]        = lambda_r + q_r lambda_d
Var[N_r]      = lambda_r + q_r lambda_d
Cov[N_1, N_2] = q_1 q_2 lambda_d
```

What drivers do, from the reference runs on example 2 (ADR-0002).
1. Drivers do not change any expected value.
2. They move probability mass to years with several events and to years with none. With the example estimates, P99 of annual loss changed by less than 1% against independent copies with the same marginals, which is within Monte Carlo noise. With strong coupling (trigger probability 0.9, driver rate 0.1 to 0.6 per year) P99 rose 17% and P(loss above EUR 3 M) rose from 0.115 to 0.135.
3. The main value is structure. One response on a driver changes several risks at once, and the optimization sees the combined effect.
4. Limit (A4). A driver event changes the count, not the size, of the linked losses.

### 8.8 Outputs

| Output | Formula |
|---|---|
| P(at least one event) of risk r | share of trials with N_r,t at least 1 |
| EAL or EAG of risk r | mean of S_r,t |
| Mean annual impact given an event | EAL divided by P(at least one event) |
| Register LEC | LEC_g(x) = share of trials with L_g,t above x |
| Percentiles | P50, P90, P95, P99, P99.6 of L_g,t |
| P(loss above capacity) | LEC_root(capacity) |
| Contribution of risk r | mean of S_r,t over trials in which L_root,t is above its P95, divided by mean of L_root,t over the same trials |
| Standard error of a probability p | sqrt(p (1 - p) / T) |
| Standard error of a mean | sample standard deviation divided by sqrt(T) |

Grid for curves. 200 points, log-spaced from max(1, capacity / 1000) to max(10 times capacity, largest L_root,t). Without a capacity, use the largest tolerance curve loss.

### 8.9 Tolerance curve

Points (x_i, p_i), loss ascending, probability strictly descending (V-12). For a loss x the tolerance T(x) is as follows.
1. For x below x_1, T(x) = 1. The curve sets no limit below its first point (challenged assumption 4).
2. Between points, log10 T is linear in log10 x.
3. Above x_n, continue the last segment's slope in log-log space, with a floor of 1e-6.

Three measures.
1. **Gap.** Max over the grid of LEC(x) - T(x), and 0 if negative. Gap above 0 is a breach.
2. **Clear breach.** LEC(x) minus 2 standard errors is above T(x) at some grid point. The optimization ranks with this test, because the point estimate flips for borderline portfolios.
3. **Excess area.** Sum over the grid of max(0, LEC(x) - T(x)) times the grid step in log10 loss. It ranks portfolios that all breach.

Default points for a new document, shown as a starting point and not as advice. (2% of capacity, 0.5), (10%, 0.2), (33%, 0.05), (100%, 0.01). Release 2 adds guided questions that replace these points with the answers of the management body (`docs/release-2/appetite-questions.md`).

### 8.10 Responses

1. An effect replaces the frequency, the impact per event, or both, of one risk or one driver, with a new distribution. This matches the RDR "after controls" fields.
2. Annualised cost = one-off / lifetime + annual + reserve times P(at least one event of any effect target, in the run with the response funded). First-year cash = one-off + annual + reserve. No discounting.
3. Two options that affect the same target are alternatives. A portfolio never holds both. To combine them, the user makes a bundle option with `bundleOf` and states the combined effect.
4. Transfer (insurance) is an effect on the impact per event that models the retained loss. The rationale states deductible and limit.
5. A risk with `onlyWithResponse` enters the simulation only when that response is in the portfolio. Its losses count against the response (Sec. 3.6 lines 1072 to 1074).
6. For positive risks, Realize, Share and Enhance are effects that raise frequency or gain.

### 8.11 Algorithmic optimization

Inputs. Options with status `candidate` or `selected`, without `forced.action` exclude. Budget B (`strategy.budget.firstYearCash`). Ranking trials T_r = 20 000. Confirmation trials 100 000. One seed for all runs.

```
portfolios = all sets of options that
             hold every forced.require option,
             hold no two alternatives,
             have first-year cash <= B
if count(portfolios) > 256: use the greedy fallback (below) and say so in the record
base = simulate([], T_r)
for each portfolio P:
    m           = simulate(P, T_r)
    benefit(P)  = (EAL_base - EAL_m) + (EAG_m - EAG_base)
    cost(P)     = sum of annualised costs
    net(P)      = benefit(P) - cost(P)
    clear(P)    = clear breach of the tolerance curve (Sec. 8.9)
rank: portfolios without a clear breach first, by net benefit, highest first
      then portfolios with a clear breach, by excess area, smallest first
confirm in rank order at 100 000 trials. Drop a portfolio that breaches there (Gap > 0).
Keep the first two confirmed portfolios.
near-tie: if both are within tolerance and net(1) - net(2) < 2 SE(net(1) - net(2)),
          mark "too close to call" and pick the lower first-year cash, then the lower ids
```

SE of the difference uses 10 consecutive batches of the paired per-trial values of (L_2 - L_1) + (W_1 - W_2), with costs as constants. Paired values are valid because of common random numbers (Sec. 8.6).

The record also shows, for the best portfolio, the marginal value of each option (net benefit lost and tolerance gap if the option is dropped), the next 3 portfolios, and the best portfolio at budget minus 20% and plus 20%.

**Greedy fallback** above 256 portfolios. Start from the forced options. Repeatedly add the affordable option with the largest cut in excess area per euro of annualised cost while a clear breach exists, then the largest (benefit - cost) / cost, until no option adds more than it costs. The record says that the result is not guaranteed optimal. Release 1 targets at most 12 candidate options per decision, which keeps most cases under 256.

**Worked example.** Example 2 (`schema/examples/example-2-sme-quantitative.json`), seed 20261207, 100 000 trials, numbers from the reference model. The TypeScript engine must agree within Monte Carlo error.

| State | EAL (EUR) | EAG (EUR) | LEC(250 000) vs T | LEC(1 000 000) vs T | P(loss above 3 M capacity) | Gap |
|---|---|---|---|---|---|---|
| Before | 229 723 | 53 775 | 0.2057 vs 0.20 | 0.0591 vs 0.05 | 0.0094 | 0.0210 |

With B = EUR 60 000 there are 21 feasible portfolios. O-2, O-4 and O-7 all change the R-01 impact, so they are alternatives.

| Rank | Portfolio | First-year cash | Annualised cost | Annual benefit | Net benefit | EAL | LEC(250 000) | LEC(1 000 000) |
|---|---|---|---|---|---|---|---|---|
| 1 | O-4 insurance, O-5 CRA evidence pack | 48 000 | 34 667 | 109 784 | 75 117 | 159 110 | 0.1721 | 0.0265 |
| 2 | O-4, O-6 HSM | 51 000 | 27 000 | 90 879 | 63 879 | 138 844 | 0.1637 | 0.0198 |
| 3 | O-1 MSP access, O-4 | 39 000 | 29 000 | 87 924 | 58 924 | 141 738 | 0.1524 | 0.0216 |
| 4 | O-1, O-2 backups | 54 000 | 24 000 | 81 618 | 57 618 | 148 044 | 0.1595 | 0.0241 |
| 5 | O-1, O-3 MFA, O-4 (fiscal baseline) | 55 000 | 36 000 | 93 257 | 57 257 | 136 519 | 0.1432 | 0.0191 |

What the record tells management.
1. **The best portfolio is O-4 and O-5.** O-4 closes the tolerance gap. Without it the gap returns (0.0204) and net benefit falls by EUR 51 094. O-5 is an opportunity. It adds EUR 24 023 net, more than any security option that still fits the budget. This is Sec. 2.4.6 in practice. Opportunities compete for the same euros.
2. **The fiscal method of Sec. 5.3.2 gives EUR 17 860 less net benefit per year.** It funds the options of the largest risks first (O-3, O-4, O-1). Its expected loss is lowest (EUR 136 519), but it pays more for less.
3. **O-3 (MFA) carries a cost the user might miss.** It introduces R-09 (lockouts), with an expected annual loss of EUR 8 445. Alone, O-3 gives a net benefit of EUR 12 563, not the EUR 21 000 its effects suggest.
4. **Budget sensitivity.** At EUR 48 000 the same portfolio wins. At EUR 72 000 the best portfolio adds O-1, with net benefit EUR 79 853.
5. **Stability.** Seeds 20261207, 1, 2 and 3 all select O-4 and O-5 after confirmation.

These numbers come from illustrative estimates. They show how the record reads, not what an SME should buy.

### 8.12 Fiscal and operational methods

1. **Fiscal (Sec. 5.3.2).** "A straightforward ranking of risks in descending order from most impactful to least. Risk managers tally the total risk response costs until funding is exhausted." The app ranks leaf negative risks by EAL. For each risk it adds the options that act on the risk or on one of its drivers, cheapest first, until the budget is exhausted, skipping alternatives. The record always shows this baseline next to the algorithmic result.
2. **Operational (Sec. 5.3.2).** Leadership marks options `forced` require or exclude, with a reason. The algorithmic search then runs inside those choices. A required option that exceeds the budget is listed as "required but over budget".
3. **Forced ranking** with weighted business drivers is out of scope.
4. **Unfunded risks.** "each method must include a process for how to respond to those scenarios when funding is not available" (Sec. 5.3.2). Every risk whose options are not funded is listed under accepted residual risk and needs an acceptance record before the decision record is final.

### 8.13 Risk matrices, display only

The app shows a 5 by 5 matrix (Fig. 5) and the two-sided matrix (Fig. 8) because users and auditors expect them. It never ranks, funds or filters with them.

Reasons.
1. Cox (2008), "What's Wrong with Risk Matrices?", Risk Analysis 28(2) 497-512, DOI 10.1111/j.1539-6924.2008.01030.x. Matrices compare correctly only a small share of risk pairs, can rank smaller risks above larger ones, can be "worse than useless" when frequency and severity are negatively correlated, and give ambiguous results for the same inputs.
2. SP 800-30r1 Table I-2 (the source of Fig. 5) has identical rows for High and Very High likelihood.
3. SP 800-221r1 Fig. 10 rows 6 and 7. Row 7 is equal or higher on every input (CapEx M against L, reputation Mod against Low, mission and likelihood equal) but has a lower exposure. Lint L-03 finds exactly this pair and no other.

Cell rules. Likelihood bands from `riskLikelihood` with SP 800-30r1 Table G-3 ranges (0 to 0.04, 0.05 to 0.20, 0.21 to 0.79, 0.80 to 0.95, 0.96 to 1). Impact bands from `riskImpact` as a share of capacity (below 1%, 1 to 5%, 5 to 20%, 20 to 50%, 50% and above), an editable default. Cell colours from SP 800-30r1 Table I-2. Every matrix has the caption "Display only. Ranking and funding use the simulation (Cox 2008)."

### 8.14 Forecasts and Brier score

**Freeze.** "Freeze forecasts" creates one forecast per leaf risk. The window starts on the register `asOf` date and lasts the register timeframe. The event is "at least one event with impact at or above the reportable threshold θ". The probability f is the simulated share of trials with such an event. The record stores seed, trials, engine version and `inputsSha256`. That is the SHA-256 of the RFC 8785 JSON of one object with the keys `estimate`, `driverLinks` (empty array if none), `drivers` (the linked driver objects in link order), `timeframeMonths`, `eventThreshold`, `seed`, `trials` and `engineVersion`. The forecast id is `F-<year of windowEnd>-<riskId>`. The window ends on the day before the start date plus the timeframe. The probability is rounded to 4 decimals. A frozen forecast is never edited.

**Resolve.** After `windowEnd`, the user records `occurred`, the date, the evidence and, optionally, the observed annual impact.

**Scores** over n resolved forecasts.

```
BS     = (1/n) sum (f_i - o_i)^2                     Brier (1950), MWR 78(1) 1-3
obar   = (1/n) sum o_i
BSS    = 1 - BS / (obar (1 - obar))                  undefined when obar is 0 or 1
bins k = 10 equal-width bins of f
REL    = (1/n) sum_k n_k (fbar_k - obar_k)^2         Murphy (1973), J. Appl. Meteor. 12(4) 595-600
RES    = (1/n) sum_k n_k (obar_k - obar)^2
UNC    = obar (1 - obar)
BS     ~ REL - RES + UNC (exact when all f in a bin are equal, the app shows the difference)
SE(BS) = sd((f_i - o_i)^2) / sqrt(n)
```

The screen shows BS with a 95% interval. A second metric is the hit rate of the 90% annual impact interval (target 0.9). Weak point, stated plainly. 15 risks at a base rate of 5 to 10% give about one positive outcome per year, so one SME's score is noise for years. Release 1 still stores every forecast, so the data exists when pooling arrives.

### 8.15 Qualitative registers and three-point roll-up

1. No simulation. These registers show the matrix, the labels and the lint.
2. Three-point roll-up for summary entries (Sec. 5.2.2 lines 1637 to 1641). For each column separately, optimistic is the lowest source value, pessimistic the highest, most likely the mean of the others. For n = 2, most likely is the mean of both. For n = 1, all three equal the value. For positive risks, optimistic is the highest value. `riskLikelihood` and `riskImpact` of the summary take the most likely values. The rule takes likelihood and impact from different rows (NIST comment N13).
3. Table 10 disparity layouts. `one-row-per-response` writes one row per distinct response type. `one-row-all-responses` writes one row with all distinct types in order of first occurrence.

### 8.16 Precision and performance

| Item | Target |
|---|---|
| Default trials | 100 000 |
| Simulation speed | 100 000 trials, 50 leaf risks, 5 drivers, under 3 s in a Web Worker in current Chrome on a 2023 mid-range laptop |
| Optimization | 256 portfolios at 20 000 trials plus confirmation, under 90 s |
| Memory | Under 200 MB for the default case |
| Cancel | Every run can be cancelled within 200 ms |

## 9. Import and export

### 9.1 Common import pipeline

1. **Read** the file in a Web Worker with the limits of ADR-0004 D1.
2. **Detect** the format by content. Native JSON has `schemaVersion`. IR 8286 JSON has `riskId` or `riskIdNumbers`. OSCAL has `plan-of-action-and-milestones`. CVD Portal JSON has `meta.count` and `data[].vulnerabilityType`. Else CSV or XLSX by extension and magic bytes.
3. **Map** to native objects. Fill missing required fields with explicit defaults and list them in `defaultedFields`.
4. **Validate** with the compiled schema and the V rules.
5. **Preview** counts, defaulted fields, warnings and a diff against the open document (Sec. 9.7).
6. **Commit** only on confirmation, with a provenance record (format, file name, SHA-256, record count, column mapping, warnings).

### 9.2 Native JSON

Validate, migrate if the major version is the previous one, then merge or replace.

### 9.3 NIST IR 8286 JSON

| Input | Handling |
|---|---|
| One register entry or an array | One risk each |
| One RDR or an array | Register fields from the RDR (Sec. 7.4 in reverse). Detail from the other fields. `planned` and `measured` from the after-control fields. |
| Both | Join by `riskId` equal to `riskIdNumbers` |

Defaults. Polarity negative unless the response type is Realize, Share or Enhance. Category from the mapping table, else the user picks. Status Open. Currency is asked once. `riskLikelihood` above 1 is read as a percentage, with a warning.

### 9.4 CSV and XLSX

**Status. Unvalidated against real SME registers (assumption A7).** Designed from the NIST IR 8286 Rev. 1 XLSX template, SP 800-221r1 Fig. 4, Fig. 10 and Fig. 11, and the CISO Assistant, SimpleRisk and Eramba export columns. Gate G-A in HANDOFF.md.

1. **Parsing.** CSV per RFC 4180 with UTF-8, UTF-8 with BOM and Windows-1252 detection. Delimiter detection for comma, semicolon and tab. XLSX through SheetJS Community Edition from cdn.sheetjs.com, pinned by hash. Merged cells are unmerged into each cell of the range.
2. **Header row.** The first row in the first 20 rows where at least 3 cells match a synonym.
3. **Header normalisation.** Trim, collapse spaces, lower case, remove punctuation. The NIST template has leading spaces in 10 of 11 header cells.
4. **Synonyms.**

| Target | Synonyms |
|---|---|
| `riskId` | id, risk id, ref, reference, risk no, nr, number |
| `priority` | pri, priority, rank |
| `riskDescription` | risk description, description, risk, risk title, title, scenario, risk statement |
| `riskCategory` | risk category, category, type, risk type, domain |
| `riskLikelihood` or label | risk likelihood, likelihood, probability, prob, chance, frequency |
| `riskImpact` or label | risk impact, impact, consequence, severity, magnitude |
| `exposureRating` or label | exposure rating, exposure, risk score, score, risk level, rating, inherent risk |
| `impacts.financial` | financial impact, opex, capex |
| `impacts.reputation.label` | reputation impact, reputational impact |
| `impacts.mission.label` | mission impact, operational impact |
| `objectiveIds` | objective, enterprise objective |
| `riskResponseType` | risk response type, response type, treatment, treatment option, strategy |
| `riskResponseCost` | risk response cost, cost, treatment cost, budget |
| `riskResponseDescription` | risk response description, risk response, response, treatment plan, mitigation, actions, controls, proposed risk response |
| `detail.implementedResponseDescription` | current risk response, current controls, existing controls |
| `riskOwnerPointOfContact` | risk owner point of contact, risk owner, owner, responsible, accountable |
| `status` | status, state |
| `reviewDue` | review date, next review, due date, follow-up date |

5. **Values.**
   1. Numbers in "1.234,56" and "1,234.56" forms. The user confirms the locale once.
   2. Percent strings to fractions.
   3. Compound cells such as "7.5% (Low)" give a number and a label (NIST XLSX Fig. 7).
   4. `OpEx: M CapEx: L` gives two financial labels (Fig. 10).
   5. Scores such as 1 to 5 or 1 to 25 are labels, never probabilities. The importer never divides a score by its maximum.
   6. Response words map to the NIST enum. For negative risks, treat, reduce, reduction and mitigate map to Mitigate. Tolerate, retain and accept map to Accept. Terminate and avoid map to Avoid. Transfer, share and insure map to Transfer.
   7. Unknown status values ("Updated" in the NIST XLSX) become Open with a warning.
   8. A file has no polarity column. A row is positive if its response type is Realize, Share or Enhance, or if its description names an opportunity. The second case gives a warning, and the user can change it in the preview.
   9. Without a response type column, a row with response text gets Mitigate (negative) or Realize (positive). A row without response text gets Accept with decision pending (rule V-09). Both are listed in `defaultedFields`.
   10. When the same risk id appears for different registers, each id gets the register suffix as a prefix (A-1, B-1, C-1 for SYS-A, SYS-B, SYS-C). An id that the document already holds is a merge match (Sec. 9.7).
   11. SP 800-53 family codes in brackets set the category, for example "(PE)". The NIST Fig. 7 file writes "(IS)" for SI.
6. **Scale step.** The user maps each distinct label to a band of `strategy.scales`. The app proposes SP 800-30r1 bands for likelihood and asks for money anchors for impact.
7. **Saved mappings** per header signature, in IndexedDB and in the provenance record.

### 9.5 CVD Portal vulnerability export (Sec. 3.3.3 evidence)

Input is the JSON of `GET /api/v1/vulnerabilities/export` (CVD Portal, `src/app/api/v1/vulnerabilities/export/route.ts`). The user downloads the file in CVD Portal. The app makes no API call.

| Rule | Detail |
|---|---|
| Grouping | One risk per (productIdentifier, vulnerabilityType). productName when productIdentifier is null. |
| Register id | The first segment of productIdentifier in capitals (gw-x1 gives GW). The full identifier if that id is taken. The register `scope` records the product for re-import. |
| Risk id | Register id, then a number in the order of the vulnerability type names (GW-1 AUTH_BYPASS, GW-2 SQL_INJECTION). |
| Register | One system register per product, created on first import |
| Description | "If an attacker exploits a reported <type> vulnerability in <product>, then customer data or device control is compromised. Evidence <n> reports, <k> open." |
| Evidence | One entry per submission. kind `cvd-portal-submission`, ref `cvdp:<id>`, severity, status, created date |
| Dropped fields | `description`, `stepsToReproduce`, `impact`. Never stored (ADR-0004 I4). |
| Numbers | Not estimated (rule D-Q2) |
| Re-import | Match by (productIdentifier, vulnerabilityType). Update evidence. Set status "Review needed". Never overwrite estimates. |
| Capped export | If `meta.capped` is true, warn that the export is incomplete. |

### 9.6 OSCAL POA&M

Export and import per Sec. 7.5. CI validates exports with NIST oscal-cli `poam validate`.

### 9.7 Merge and diff

Imports into an open document show a diff (field, current, incoming) per entity matched by id. Per risk the user can keep current, take incoming, or keep both (incoming gets a new id). Per register the user can keep current or take incoming. A register has no keep both, because its risks refer to its id. The change log records the result. A matched entity without a changed field adds no change log entry.

A CSV, XLSX or NIST IR 8286 file holds only some fields of a risk. For a matched risk, the incoming version is the current risk with the fields that the file states. Take incoming and keep both use this version, and the diff shows only these fields.
1. An empty cell, a missing column and an importer default do not replace a current value. To clear a field, edit the risk. An RDR changes only the planned and measured values that it holds.
2. The likelihood, impact and exposure numbers change together (rule V-07). Placeholder numbers (rule D-Q2) do not change them.
3. The polarity changes with a stated response type other than Accept (rule V-04). The cost changes only with a stated response type (rule V-09).
4. A label that the file states changes, also when its numbers are placeholders. A label that the file does not state stays only while its number stays.
5. A stated field takes its defaulted mark from the file. All other fields keep their mark.
6. The category is a guess from the category text, so it never replaces a current category.

### 9.8 Exports

| Export | Content |
|---|---|
| Native JSON | Whole document, RFC 8785 key order, optional encryption (ADR-0004 I2) |
| IR 8286 JSON | Two arrays, register entries and RDRs. Every object validates against the vendored NIST schema. |
| OSCAL POA&M JSON | Sec. 7.5 |
| CSV | NIST columns first, then extensions. CSV injection guard (ADR-0004 T4). |
| Decision record, ERR, ERP, RDR | Print views |

Rule E-01. Export refuses to write an IR 8286 file that fails validation. Rule E-02. If risks with defaulted numbers exist, export asks the user to confirm or to leave them out.

## 10. Non-functional requirements

1. **Platform.** Static single-page app. TypeScript strict. Vite. React or Preact, chosen in build task 1 by bundle size. Charts as plain SVG. IndexedDB through a thin wrapper. Simulation, optimization and parsing in Web Workers. Service worker for offline use.
2. **Browsers and accessibility.** Current and previous major versions of Chrome, Edge, Firefox and Safari. WCAG 2.2 level AA. Every chart has a table equivalent. Keyboard access for every action.
3. **Durability.** Request persistent storage on first save. Show the last-export date on every screen and a banner after 7 days. Autosave with a version counter and 20 undo versions. "Remove all data from this browser" after typed confirmation.

## 11. Security, supply chain and steward measures

1. **Dependencies.** At most 8 runtime dependencies, each with a reason in `DEPENDENCIES.md`. Lockfile committed. `npm ci --ignore-scripts` in CI. Dependabot or Renovate.
2. **Headers and CSP.** Exactly as in ADR-0004, checked by a CI test.
3. **SBOM.** CycloneDX 1.6 JSON for the built bundle on every release.
4. **Signing and provenance.** GitHub artifact attestations (SLSA build provenance) and Sigstore-signed assets. `gh attestation verify` in the release checklist.
5. **OpenSSF Scorecard.** On every push to main and weekly. Target 7.0 or higher at each release. Binary-Artifacts, Dangerous-Workflow, Token-Permissions, Pinned-Dependencies, SAST (CodeQL), Security-Policy, License, Dependency-Update-Tool, Vulnerabilities, Signed-Releases, Fuzzing (fast-check) and CI-Tests should reach 10. Code-Review and Branch-Protection need a second maintainer. Maintained scores 0 for the first 90 days, so create the repository early.
6. **OpenSSF Best Practices badge**, level passing, before release 1.
7. **Security policy.** `SECURITY.md` with a contact and a CVD policy. This is the Art. 24(1) steward policy (ADR-0003).
8. **CRA Annex I self-check** of the app, voluntary, published before release.

## 12. Acceptance tests

### 12.1 AT-1 Every export validates against the NIST IR 8286 schemas

For every risk in every test document, the register projection validates against the vendored `risk_register_schema.json` and the RDR projection against `risk_detail_record_schema.json`. Test documents are the 3 examples, the golden fixtures, and 1 000 random valid documents from a fast-check generator. Validation runs with Ajv 2020 in Node and with `schema/validate.py`. Both pass.

### 12.2 AT-2 Golden tests

| Id | Source | Fixture | Pass condition |
|---|---|---|---|
| G1 | Fig. 10 (p. 39, line 1320) | `schema/fixtures/sp800-221r1-fig10.csv`, register ERR of example 1 | (a) The CSV import gives the ERR register and risks 1 to 10 of example 1, except provenance time and the hand-written `notes`. (b) The ERR view renders 10 rows with every cell text equal to the CSV. (c) Row 2 is positive, the others negative. (d) Lint L-03 reports exactly one pair, row 7 over row 6. (e) IR 8286 export validates. |
| G2 | Table 9 (p. 50, line 1533) | `appetite.statements` of example 1 | (a) The Table 9 view renders 6 rows by 3 examples, text equal to the fixture. (b) Example 1 with counts 2 above 10 days, 1 above 14, 1 above 15 fires the leading KRI, the tolerance and the lagging KRI. Example 3 with (1.6 h, 6%) fires leading KRI 1 only. (2.5 h, 4%) fires leading KRI 2 only. (2.5 h, 6%) fires leading KRI 1, the lagging KRI and the tolerance. (2.5 h, 5%) fires nothing, and the view flags the Table 9 boundary gap. |
| G3 | Table 10 (p. 53, line 1617) and lines 1637 to 1641 | `schema/fixtures/table10-system-registers.csv`, example 3 | (a) Import gives A-1, B-1, C-1 with the exact Table 10 texts. (b) Merge with `one-row-all-responses` gives ORG-1 with the text of lines 1624 to 1625, sources A-1, B-1, C-1, types Mitigate then Accept, likelihood (0.10, 0.20, 0.30), impact (400 000, 800 000, 2 000 000). (c) `one-row-per-response` gives two rows, Mitigate (A-1, B-1) and Accept (C-1). (d) The n = 1 and n = 2 rules of Sec. 8.15. (e) Lint L-10 flags ORG-1. |
| G4 | Fig. 15 (p. 67, line 2105) and the IR 8286 Rev. 1 RDR example | `schema/vendor/nist-ir8286r1/risk_detail_record_example.json` | (a) The NIST example fails the NIST schema with the single error "'currentRiskAnalysis' is a required property". (b) After import and export, the RDR validates. (c) All 34 fields of the NIST example are unchanged. Only `currentRiskAnalysis` is added. (d) The RDR print view lists the 36 Fig. 15 rows in order. `schema/validate.py` already passes (a) to (c). |
| G5 | Fig. 11 (p. 42, line 1382) | Register ERP11 and risks F11-1 to F11-3 of example 1 | (a) The ERP view renders 3 blocks headed "OPERATIONS OBJECTIVE", "REPORTING OBJECTIVE", "OPERATIONS OBJECTIVE" with the statements of `context.objectives`. (b) Impact and Likelihood rows show Last, Current and Residual equal to Fig. 11, with "Medium" for the F11-2 residual impact that Fig. 11 prints as "Medum". (c) Current Risk Response, Proposed Risk Response and Risk Owner text equal the fixture. (d) IR 8286 export validates. |

### 12.3 AT-3 Property-based tests against exact results

fast-check generates parameters. Each case runs the engine with a fixed seed and T = 200 000 unless stated. Tolerance is 4 standard errors (false failure rate under 1e-4 per comparison). Fixed seeds make every run deterministic.

| Id | Property | Exact result | Tolerance |
|---|---|---|---|
| P1 | Constant rate lambda, lognormal impact | E[S] = lambda E[X]. P(S = 0) = exp(-lambda). | 4 SE |
| P2 | Constant rate, discretised impact | Panjer (1981), ASTIN Bulletin 12(1) 22-26. f_S(0) = exp(-lambda (1 - f_X(0))). f_S(k) = (lambda / k) sum_j j f_X(j) f_S(k - j). | 4 sqrt(p(1-p)/T) plus the discretisation bound at 20 loss points |
| P3 | Lognormal rate, constant impact c | E[N] = exp(mu_l + sigma_l^2 / 2). Var[N] = E[N] + (exp(sigma_l^2) - 1) E[N]^2. E[S] = c E[N]. | 4 SE |
| P4 | Lognormal rate, lognormal impact | E[S] = E[lambda] E[X]. Var[S] = E[lambda] E[X^2] + Var[lambda] E[X]^2. | 4 SE for the mean, 5% relative for the variance at T = 1 000 000 |
| P5 | One driver, two risks, constant rates | Cov[N1, N2] = q1 q2 lambda_d. Marginals as in Sec. 8.7. | 4 sqrt((Var N1 Var N2 + Cov^2) / T) |
| P6 | q = 0 for all links | Per-trial results bit-equal to a run without the driver | Exact |
| P7 | Add an unrelated risk | Every other risk's per-trial S vector bit-equal | Exact |
| P8 | PERT impact | E[X] = (a + 4m + b) / 6. Var[X] = (E[X] - a)(b - E[X]) / 7. | 4 SE |
| P9 | Lognormal from (L, U) | 5% of draws below L, 5% above U | 4 sqrt(0.05 x 0.95 / T) |
| P10 | Positive risks | Never change any register LEC | Exact |
| P11 | Same document and seed | Identical in one engine. Within 1e-9 relative between Node and Chromium. | As stated |
| P12 | Uniform stream | Chi-square of 1 000 000 uniforms in 1 000 bins, p above 1e-4. Lag-1 correlation below 0.005 in absolute value. | As stated |
| P13 | Secondary impact with constant primary c, one secondary (p, constant s) | P(X = c + s) = p. E[X] = c + p s. | 4 SE |
| P14 | Risk with `onlyWithResponse` | Absent from every run without the response. With it, its per-trial vector is bit-equal to a run where the risk is unconditional. | Exact |
| P15 | Reserve | Annualised cost equals one-off / lifetime + annual + reserve times the simulated trigger probability of the same run | Exact |
| P16 | Optimizer | Never returns a portfolio with lower confirmed net benefit than the fiscal baseline when both are within tolerance. Adding an option that costs more than another option with the same effects never changes the result. | Exact |

Cross-check (not a pass condition). The TypeScript engine and `reference/sim_reference.py` agree on example 2 within 4 standard errors for EAL, P(N at least 1) per risk and LEC at the 4 tolerance points, and both select O-4 and O-5 with B = 60 000.

### 12.4 AT-4 Round trip without field loss

1. Export each example to OSCAL POA&M.
2. `oscal-cli poam validate` passes. The OSCAL 1.2.3 draft-07 JSON schema also passes.
3. **Lossless path.** Import. The result is deep-equal to the original after RFC 8785 canonicalisation, except `changeLog` and the new provenance record.
4. **Native path.** Remove the payload and import. Every field in the OSCAL column of Sec. 7.2 is recovered exactly. The import report lists the other fields.
5. A CISO Assistant round trip is not lossless by design. It is a release 2 adapter with a documented loss list.

### 12.5 AT-5 Usability

| Item | Rule |
|---|---|
| Users | 5 people who match ADR-0001. Not PortaRegulus staff or customers of its paid products. |
| Task | Create a first register. Context with at least 2 objectives. At least 5 risks (at least 1 from the catalogue, 1 own, 1 positive), each with frequency range, impact range, owner and objective. At least 1 driver with 2 links. A tolerance curve with 3 or more points. At least 2 response options. Run the optimization. Print the decision record. |
| Help | None. Any moderator intervention fails the session. In-app help text is allowed. |
| Measure | Time from app open to printed record. Screen recording. Think-aloud. |
| Pass | All 5 finish in under 30 minutes without help. |
| On failure | Fix the cause and test with a new user. Never re-test the same user. |
| Ethics | Written consent. The app collects nothing. Recordings deleted after 90 days. |

### 12.6 AT-6 Expert review

One practising CISO and one auditor with ISO/IEC 27001 lead auditor qualification and NIS2 audit experience. The ENISA "Technical Competence Requirements for CRA Notified Bodies" (June 2026) is a useful profile for the CRA part. Material is the decision record, the ERR and ERP views and the IR 8286 export of example 2, and of one register each reviewer builds.

| Checklist item | Expected result in release 1 |
|---|---|
| NIS2 Art. 21(2)(a) risk analysis policy evidence | Met |
| NIS2 Art. 20(1) management body approval evidence | Met |
| Reg. 2024/2690 Annex 2.1.1 to 2.1.4, as good practice where not binding | Met, except the 2.1.4 review cadence, which is a process outside the app |
| CRA Art. 13(2) and (3) | Partial by design (ADR-0001). Gaps logged as release 2 input. |
| CRA Annex I Part I point 1, point 2 introduction, Part II points 1 and 2 | Partial by design. CVD Portal evidence per risk. |

Pass. Both reviewers sign that the NIS2 items have no blocking finding. CRA findings are logged.

### 12.7 AT-7 Release integrity

Every release has a CycloneDX 1.6 SBOM, a build provenance attestation that `gh attestation verify` accepts, Sigstore-signed assets with published SHA-256 values, and an OpenSSF Scorecard of 7.0 or higher on the default branch.

## 13. Raw sources

| Source | Location | Note |
|---|---|---|
| NIST SP 800-221r1 ipd, October 2026 | https://doi.org/10.6028/NIST.SP.800-221r1.ipd | Comment period 22 October to 7 December 2026, ictrm@nist.gov |
| NIST IR 8286 Rev. 1 (December 2025) and supplemental JSON | https://csrc.nist.gov/pubs/ir/8286/r1/final, vendored in `schema/vendor/nist-ir8286r1/` | SHA-256 register schema ff85e9c917bce3e7646b974c7b8b62ba9fcf5d90d12906e6f46be4d3653b2e69, RDR schema bf9b8c0f888fc2421d094ec697cc8977347ae66d7cfc236e89bd027a23750d60, RDR example 8b7a5630c60df9bc696a479a4d12785bd20987cfe0bc6345d9a58b060fc427da. The original IR 8286 was withdrawn on 18 December 2025. |
| NIST IR 8286Ar1, 8286B-upd1, 8286Cr1, 8286D-upd1 | https://csrc.nist.gov/pubs/ir/8286/a/r1/final and siblings | 8286Ar1 Sec. 2.3.2.2 three-point, 2.3.2.4 Monte Carlo |
| NIST SP 800-30r1 Appendices D to I | https://nvlpubs.nist.gov/nistpubs/Legacy/SP/nistspecialpublication800-30r1.pdf | Table D-2 threat sources, G-3 likelihood, I-2 matrix |
| NIST CSF 2.0 | NIST CPRT JSON export https://csrc.nist.gov/extensions/nudp/services/json/nudp/framework/version/csf_2_0_0/export/json?element=all | Informative references for responses only |
| OSCAL 1.2.3 POA&M schema | Release asset `oscal_poam_schema.json` of usnistgov/OSCAL v1.2.3 (2026-08-07) | Facet names likelihood, impact, risk, severity |
| Cox (2008) | Risk Analysis 28(2) 497-512, DOI 10.1111/j.1539-6924.2008.01030.x | Sec. 8.13 |
| Lindskog and McNeil (2003) | ASTIN Bulletin 33(2) 209-238 | Sec. 8.7 |
| Brier (1950), Murphy (1973) | MWR 78(1) 1-3, J. Appl. Meteor. 12(4) 595-600 | Sec. 8.14 |
| Cyentia IRIS 2025 and IRIS 2026 Xtreme | https://www.cyentia.com/iris (IRIS 2026 Xtreme PDF from the product owner, not in this repository) | Help text sanity ranges only (ADR-0003). Revenue under USD 100 M, median loss USD 357 000, P95 USD 9.1 M. Typical firm P(incident in 12 months) 9.3% in 2024. US-centric. |
| Coalition, Risk Intelligence Briefing "How AI Impacts Cyber Risk", October 2026 | https://cdn.intelligencebank.com/us/share/NMXD/JV39v/dJBKl/original/AI+Report+Design (PDF, 20 pages) | Layout model for Sec. 4.1. Help text sanity ranges only. Coalition claims frequency 1.4% to 1.6% per year since 2022, 2.39% at the 2021 peak (Figure 1). BEC average loss under USD 30 000 (p. 9). FTF average severity USD 140 000 (p. 10). Half-year claims frequency 2023 to 2025 is BEC 0.34% to 0.52%, FTF 0.41% to 0.54%, ransomware 0.28% to 0.35% (Figures 2 to 4). The report does not say whether half-year values are annualised. Portfolio bias, because policyholders pass underwriting and get security tools (p. 7). US-centric. The publisher sells cyber insurance. |
| Claims reports that Coalition cites | Coalition Cyber Claims Report 2026, NetDiligence Cyber Claims Study 2026, Chubb 2026 EMEA Cyber Claims Report, Marsh US and Canada cyber claims 2025 (links in the Coalition notes, p. 19) | Candidates for sanity ranges, not yet read. Coalition reports that Chubb saw SMB claims frequency rise 86% in Europe in 2025 (p. 6). |
| Risklet catalogue | `Risklet Risks.xlsx` from the product owner, not in this repository. `tools/risklet_catalogue.py` writes the names to `src/catalogue/risklet.json` (SHA-256 of the workbook 30def58346d7a40634927fd5630788ee2aeed3e4ea7fe54433b47fb8e4ee8e8a). | 119 names with 39 category labels. No scores. Ignore the side block next to rows 3 to 8. A "row" in Sec. 6.7.7 is the RISK ID. |
| CVD Portal export | CVD Portal source, `src/app/api/v1/vulnerabilities/export/route.ts` | Sec. 9.5 |
| Earlier plan | `RMS-PLAN-NIST-800-221r1.md` | Superseded by Sec. 3.1. Its multi-tenant server design is replaced by ADR-0004. |
| Other provided material | Files from the product owner, not in this repository | ISO/IEC 27001 FDIS 6.1.2 and 6.1.3, ISO/IEC DIS 27004 (measures for KRIs), NCSC CAF 4.0 objective A2, DSIT AI Risk Management Toolkit (8 September 2026), NIST SP 1326 (supplier due diligence), SP 800-82r4 ipd (OT safety impacts), ENISA NIS360 (May 2026). ISO texts are copyrighted. Cite clause numbers only. |

## 14. Comments for NIST (ictrm@nist.gov, before 7 December 2026)

Use the NIST comment template (E editorial, T technical, G general). Page and line refer to SP 800-221r1 ipd. Comments on the IR 8286 JSON files are in scope, because lines 2106 to 2107 point to them as the digital form of Fig. 4 and Fig. 15.

| # | Type | Location | Comment | Suggested change |
|---|---|---|---|---|
| N1 | T | Lines 2106-2107, IR 8286 Rev. 1 RDR schema | `required` lists `currentRiskAnalysis`, but `properties` does not define it. The NIST RDR example fails the NIST schema (jsonschema 4.25.1, draft 2020-12). | Add `currentRiskAnalysis` as a string property (Fig. 15 row "Current risk analysis"). |
| N2 | E | Same files | The RDR example declares `./risk_detail_record.v1.schema.json`. The schema `$id` is `.../olir/risk_detail_record.v3.schema.json`, the register schema `$id` is `.../risk_register.v2.schema.json`. Neither resolves. | Publish the schemas at their `$id` and align versions. |
| N3 | T | Fig. 4, register schema | The schema describes one entry. No container, no register metadata (level, scope, timeframe, currency, as-of date, scales). | Add a register schema with an array of entries and the metadata. |
| N4 | T | Table 3, Fig. 4 (line 854) | Priority is in Table 3 but not in the schema. | Add `priority`. |
| N5 | T | Sec. 2.4.6, 3.8, Tables 4 and 5, line 1321 | No polarity field. Fig. 10 item 2 is positive only by the text. The response enum mixes Table 4 and Table 5 types. | Add `polarity`. Constrain response types by polarity. |
| N6 | T | Table 3, schemas | Amounts fixed to "$" in descriptions. | Add an ISO 4217 `currency`. |
| N7 | T | Table 3, lines 1010-1011 | "Likelihood (%)" holds fractions in both NIST examples (0.1, 0.75). Line 1010 asks for a consistent timeframe, but no field records it. | State the unit (probability 0 to 1) and add a timeframe field. |
| N8 | T | Sec. 3.4.1 footnote 14, Sec. 3.4.2, lines 1637-1641 | The text recommends ranges, Monte Carlo and three-point estimates. The schema holds single points only. | Add an optional estimate object (distribution, bounds, confidence level). |
| N9 | T | Table 6, Fig. 10, Fig. 11 | The ERR and ERP elements (Table 6 impacts, Last, Current and Residual) have no JSON form. Qualitative values cannot be stored, because the fields are numbers. | Publish ERR and ERP schemas. Allow a label with an optional number and a scale reference. |
| N10 | T | Fig. 10 rows 6 and 7 (p. 39) | Row 7 is rated equal or higher than row 6 on every input (CapEx M vs L, reputation Mod vs Low, mission Low vs Low, likelihood Mod vs Mod), but its exposure is Low and row 6 is Mod. Fig. 10 also lacks the Response Type and Cost columns of Table 3. | Correct the values or explain the rule. Add the two columns. Cite Cox (2008) in Sec. 3.5. |
| N11 | E | Line 1009, lines 857-860, Fig. 11 | The text refers to a "Residual Risk column" that Fig. 4 and Table 3 lack. Fig. 11 has a Residual column. | Add residual and target residual columns to Fig. 4 and Table 3. |
| N12 | T | Lines 966-968 | "each permutation should be individually included in the risk register". If rows are summed, the primary loss is counted once per permutation. | Model one scenario with primary and secondary loss parts. |
| N13 | T | Lines 1637-1641 | The three-point roll-up is undefined for 1 or 2 sources, widens with more registers whatever the uncertainty, treats "best case" wrongly for positive risks, and takes likelihood and impact from different rows. Sec. 5.3 (lines 1690-1691) itself says the composite is not the sum of the analyses. | Define n below 3 and positive risks. Recommend simulation-based aggregation with shared causes. |
| N14 | T | Table 9 Example 3 (p. 50) | "must not exceed two hours and may affect no more than 5 %" reads as AND or OR. Under OR, the second leading KRI is already a breach. KRIs use "more than 5 %" and "fewer than 5 %", so exactly 5 % is not covered. | State the logic and use consistent bounds. Give a machine-readable form. |
| N15 | E | Table 9 Example 1 | The tolerance counts from "discovery". The KRIs do not name the start event. "Severity score of 10" does not name the CVSS version. | Name the start event and the CVSS version. |
| N16 | G | Sec. 3.5, Figs. 5 and 6 | SP 800-30r1 Table I-2 (Fig. 5) has identical rows for High and Very High likelihood. Matrices are used for prioritisation without a caution. | Add a caution and prefer quantitative analysis for prioritisation (Cox 2008). |
| N17 | E | Fig. 15 (p. 67) | Fig. 15 has "Residual risk response as implemented", which the schema lacks. "Planned residual risk response" offers only Table 4 types. `likelihoodAfterControlsAreInPlaceWillBe` mixes "measured" and "will be". | Align Fig. 15 and the schema. Allow Table 5 types. Rename the field. |
| N18 | E | IR 8286 Rev. 1 XLSX Fig. 7 example | "Risk Impact" holds fractions while the JSON schema says dollars. Row 2 shows "80% (High)" for 0.9 times 0.9 (0.81). Status "Updated" is not defined. 10 of 11 header cells start with a space. Typos "delploys", "desigs", "Decommision", "Conduct mitigation to SaaS provider". | Correct the file and align units. |
| N19 | T | Register schema required list | Response fields are required at identification time. | Allow "Undecided" or make the response fields optional. |
| N20 | E | Both schemas | Date fields are plain strings. | Add `"format": "date"`. |
| N21 | T | IR 8286Ar1 Sec. 2.3.2.2 (cited by footnote 13) | With sigma = (P - O) / 6 = 7 500, the stated intervals (39 000 to 66 000, 25 500 to 79 500, 12 000 to 93 000) imply sigma = 13 500. The upper value 93 000 exceeds the stated worst case 80 000. The interval is for the loss, not the mean (footnote 32). | Correct the numbers, call it a prediction interval, suggest a lognormal for losses. |
| N22 | G | Sec. 3.7, Sec. 2.4.3 | No guidance on checking whether estimates were right. | Recommend recording forecasts and outcomes and scoring them (Brier 1950). |
| N23 | G | Sec. 3.8, Fig. 8 | Positive and negative risks appear in one heatmap only. | Show a loss exceedance curve for negative risks and a separate gain view for positive risks. |
| N24 | E | Table 2 (p. 17, line 654) and Table 9 Example 3 | Two nearly identical appetite statements for customer-facing websites have different tolerances (4 hours in Table 2, 2 hours in Table 9) with no explanation. | Align or explain. |
| N25 | E | Fig. 11 (p. 42, line 1382) | The response type is "REDUCTION", which is not a Table 4 type (Mitigate). Row 2 Residual Impact reads "Medum". | Use Table 4 terms. Correct the typo. |
| N26 | T | Sec. 3.3.2 lines 782-784 | A third register row for "an outage that affects both services at once" double-counts when rows are aggregated. | Model the shared cause once and derive the joint event, for example with a common-shock model. |
| N27 | T | Sec. 5.3.2 line 1762 | Fiscal optimization ranks risks by impact and funds until money runs out. It ignores how much each response reduces risk per unit cost. In a worked example (this specification, Sec. 8.11) it gave EUR 17 860 less net benefit per year than an exact portfolio search with the same budget. | Say that fiscal ranking is a baseline and recommend ranking response portfolios by risk reduction per cost within tolerance. |

## 15. Open questions for PortaRegulus

| # | Question | Default if no answer |
|---|---|---|
| Q1 | Product name | "PortaRegulus Risk" |
| Q2 | Origin for the hosted app | `risk.portaregulus.com`, with a landing page on www.portaregulus.com |
| Q3 | Does PortaRegulus own the Risklet catalogue (119 names)? | Answered 2026-10-29. Yes. The 119 names ship under CC BY 4.0 in `src/catalogue/risklet.json`. |
| Q4 | Real SME registers for the importer (assumption A7) | Gate G-A blocks the end of build task 4 |
| Q5 | Second maintainer for Code-Review and Branch-Protection (Scorecard) | Without one, Scorecard 7.0 is at risk |
| Q6 | Who sends the NIST comments, and under which name | Answered 2026-10-30. The product owner has sent the comments. |
| Q7 | Check `date` and `date-time` values on import, as a V rule or in the import step | A V rule in task 4, with the same check added to `schema/validate.py` |
| Q8 | Drivers are shared by all registers. Which timeframe scales a driver rate when registers have different timeframes? | The first register without a parent. The engine says so in the record. |
| Q9 | Ship a table of cited reference ranges (claims frequency and loss per event type) in the S3 estimate help | Help text only, with the source and its bias. Never prefilled into an estimate (hard rule 2). |
