# Risklet RMS feature plan (NIST SP 800-221r1 ipd)

Status draft v0.1, 2026-10-27. Source document NIST SP 800-221r1 Initial Public Draft, October 2026.

## 1. Decision

Build one Risk Management System (RMS) on the NIST SP 800-221r1 data model. Use three register levels. These are System (product), Organization and Enterprise. Each system has an ICT risk register. The RMS rolls the registers up into an Enterprise Risk Register (ERR). The ERR then feeds an Enterprise Risk Profile (ERP) for leadership.

Every ToC entry of SP 800-221r1 is in section 5. Each entry has one of three types.

| Type | Meaning | Count |
|---|---|---|
| M | Module feature. The user does something with it. | 46 |
| R | Rule. An acceptance criterion that all modules must obey. | 6 |
| C | Content. Help text, glossary or onboarding. Not a feature. | 11 |

## 2. Assumptions

1. The product brand is Risklet. The folder `AIRisklet` is the home of the new code. It is empty today.
2. The first customers are EU manufacturers and SMEs that already use CVD Portal or the PortaRegulus tools. They must comply with CRA and NIS2.
3. "System" in NIST maps to "product with digital elements" in CRA. One CRA product gets one ICT risk register.
4. The Risklet risk catalogue (119 entries, de-duplicated to 75 in `risk-kg`) is the seed risk library.
5. NIST SP 800-221r1 is a draft. Public comments close on 7 December 2026. The final text can change section numbers and fields.
6. Data and process follow NIST IR 8286 JSON templates for the risk register and the Risk Detail Record (RDR). SP 800-221r1 points to them as supplemental material.

## 3. Challenged assumptions

**"Each ToC entry is a feature" is weak.** 17 of 63 entries are not features. Examples are 1.2 Document Structure, 6 Conclusion and Appendix A Acronyms. If you build them as screens, you get empty pages. This plan converts them into rules (R) or help content (C). Section 2.4 lists six shortcomings of typical ICT risk programs. They are more valuable as acceptance criteria than as screens.

**The target is a multi-level enterprise. Your buyers are mostly single-level SMEs.** SP 800-221r1 assumes Enterprise, Organization and System levels with a CRO and an ERM council. A 50-person manufacturer has one level and no CRO. Do not force the hierarchy. Default to two levels (Company and Product). Enable the third level as a setting.

**EU buyers do not ask for NIST.** NIS2 Art. 21, CRA Annex I and ISO 27005 are the purchase triggers. NIST SP 800-221r1 is voluntary US guidance. Use it as the internal engine. Sell the EU mappings on top. Show "NIS2 Art. 21(2)(a) risk analysis" in the UI, not "SP 800-221 Sec. 3.4".

**Do not hard-code section numbers.** The draft can change. Give each concept a stable ID (for example `ictrm.register.exposure`). Map the ID to the section number in one table. Appendix D (Change Log) proves that NIST renumbers between versions.

## 4. Core model

### 4.1 Levels

| Level | NIST name | CRA / SME name | Register |
|---|---|---|---|
| L1 | System | Product or service | ICT risk register |
| L2 | Organization | Business unit or company | Aggregated ICT risk register |
| L3 | Enterprise | Group or holding | ERR, then ERP |

### 4.2 Risk register entry (Table 3)

| Field | Type | Note |
|---|---|---|
| id | string | Sequential per register |
| polarity | enum | negative, positive. Required from release 1 (Sec. 2.4.6, 3.8) |
| priority | int or enum | 1..n or high, moderate, low |
| description | text | "If X occurs, then Y happens" format |
| category | enum | Enterprise-defined list. Key for aggregation |
| likelihood_current | number or bin | Before any new response |
| impact_current | number or bin | Benefit or consequence |
| exposure_current | computed | Likelihood x impact, or FAIR loss distribution |
| response_type | enum list | Negative: accept, transfer, mitigate, avoid. Positive: realize, share, enhance, accept |
| response_cost | money | Estimated |
| response_description | text | |
| owner | user | Accountable person |
| manager | user | Optional risk manager |
| status | enum | Open, in treatment, monitored, closed, accepted by exception |

### 4.3 ERR additions (Table 6)

`impact_financial` (capex and opex split), `impact_reputation`, `impact_mission`. Add `impact_safety` because Sec. 2.1 now names safety as an ERM purpose.

### 4.4 Risk Detail Record (Appendix B, Fig. 15)

System affected, business unit, scenario, assets affected, threat sources (intent, motivation), threat vectors, threat events, vulnerabilities and predisposing conditions, primary and secondary impacts, likelihood/impact/exposure before controls, planned response and cost, expected exposure after controls, actual response and cost, measured exposure after controls, owner, identification date, information source, status date, dependencies, follow-up date, comments, KRIs.

### 4.5 Appetite, tolerance, capacity (Sec. 3.2.1, Table 2, Table 9)

| Object | Form | Example |
|---|---|---|
| Capacity | Money | Maximum loss the company can absorb. 2 M EUR |
| Appetite | Qualitative statement per category | "Low appetite for loss of personal data" |
| Tolerance | Metric + operator + limit + scope | "CVSS 10 on critical products patched within 14 days" |
| KPI | Metric | Percent of vulnerabilities patched |
| Leading KRI | Metric + threshold | Critical vulnerabilities open more than 10 days |
| Lagging KRI | Metric + threshold | Critical vulnerabilities open more than 15 days |

## 5. ToC to feature map

Release key. R1 is the MVP (single company, products, full register). R2 adds aggregation, ERR, ERP and quantitative analysis. R3 adds optimization and governance depth.

| Sec. | ToC entry | Type | Feature | Rel. | Existing asset |
|---|---|---|---|---|---|
| ES | Executive Summary | C | Onboarding page. Explains the register to ERR to ERP flow in 5 screens | R1 | |
| 1 | Introduction | C | Help index | R1 | |
| 1.1 | Purpose and Scope | M | Scope settings. Select ICT domains in scope (cybersecurity, privacy, supply chain, OT, IoT, AI) and frameworks (CSF 2.0, NIS2, CRA, ISO 27001) | R1 | |
| 1.2 | Document Structure | C | Navigation follows the life cycle order | R1 | |
| 2 | Introduction to ICTRM and Challenges with ERM Integration | C | Help article | R1 | |
| 2.1 | Comparing ICTRM and ERM | M | Hierarchy builder. Create Enterprise, Organization and System nodes (Fig. 1). Default 2 levels | R1 | |
| 2.2 | ICTRM Life Cycle | M | Life-cycle workflow. Six steps (Fig. 2) with a stage gate per register cycle | R1 | |
| 2.3 | ICTRM and ERM Integration | M | Roll-up pipeline. System registers feed organization registers. Organization registers feed the ERR (Fig. 3) | R2 | |
| 2.4 | Shortcomings of Typical Approaches to ICTRM | C | Help article. Each sub-item below is a rule | R1 | |
| 2.4.1 | Increasing System and Ecosystem Complexity | M | Dependency graph. Link assets, products, suppliers and risks. Show cascading impact | R2 | risk-kg graph |
| 2.4.2 | Lack of Standardized Measures | R | One scale set per enterprise. All registers must use it. The RMS rejects scores outside the scale | R1 | |
| 2.4.3 | Informal Analysis Methods | R | Every score has a method, a rationale and a data source. No score without them | R1 | |
| 2.4.4 | Overly Focused on the System Level | R | Every risk links to at least one enterprise objective (mission, finance, reputation, safety) | R1 | |
| 2.4.5 | Gap Between ICTRM Output and ERM Input | R | Registers export and import in one schema (IR 8286 JSON). No re-typing between levels | R1 | |
| 2.4.6 | Impact of Opportunities (Positive Risks) Not Pursued | R | Positive risks are first-class entries from R1 | R1 | |
| 3 | ICT Risk Considerations | C | Section help | R1 | |
| 3.1 | Identify the Context | M | Context profile. Mission, objectives, internal and external context, regulations in scope, sector, size, geography | R1 | Risklet questionnaire, risk-kg 21-question profile |
| 3.1.1 | Risk Governance | M | Roles and RACI per level (Table 1). CSF 2.0 GOVERN outcome checklist | R1 | |
| 3.2 | Risk Culture | M | Culture indicators. Owner response time, overdue reviews, exception count, training completion | R3 | |
| 3.2.1 | Risk Capacity, Risk Appetite and Risk Tolerance | M | Appetite workshop. Capacity, appetite statements, measurable tolerances (Sec. 4.5). Auto-flag risks outside tolerance | R1 | Tolerance Vectors (appetite.portaregulus.com), risk-kg appetite logic |
| 3.2.2 | Risk Management Strategy | M | Strategy builder. Scales, response criteria, review frequency, escalation limits, approval authority. Export as policy PDF | R1 | |
| 3.3 | Identify the Risks | M | Scenario builder. Pick from catalogue or write "if X, then Y" | R1 | Risklet catalogue (75 risks) |
| 3.3.1 | Inventory and Valuation of Assets | M | Asset inventory. CIA rating, business value, criticality. Import CSV and SBOM | R1 | CVD Portal products, SBOM |
| 3.3.2 | Determination of Potential Threats | M | Threat library. Sources, actors, vectors, events. DBIR and ENISA mapping | R1 | DBIR 2026 scoring in risk-kg |
| 3.3.3 | Determination of Exploitable and Susceptible Conditions | M | Vulnerability and condition feed. Pull from CVD Portal reports, scanners and audit findings | R2 | CVD Portal |
| 3.3.4 | Evaluation of Potential Consequences | M | Consequence model. Primary and secondary impacts, each permutation as its own entry (Sec. 3.4.2) | R1 | |
| 3.3.5 | Risk Register Use | M | ICT risk register (Sec. 4.2). Workforce view. Owner versus competence gap (NIST SP 1308) | R1 | |
| 3.4 | Analyze the Risks | M | Analysis workspace per risk | R1 | |
| 3.4.1 | Risk Analysis Types | M | Three modes. Qualitative, semi-quantitative, quantitative (FAIR Monte Carlo). Mode set per register | R1 qual/semi, R2 quant | risk-kg FAIR point estimate, fair-monte-carlo-risk-analysis repo |
| 3.4.2 | Techniques for Estimating Likelihood and Impact | M | Estimation helpers. Sub-factors, three-point estimate, benchmark data, calibrated expert input | R2 | |
| 3.5 | Prioritize Risks | M | Risk matrix. Qualitative (Fig. 5) and semi-quantitative (Fig. 6). Ranked list | R1 | risk-kg RiskMatrix (UI pattern) |
| 3.6 | Plan and Execute Risk Response Strategies | M | Response plan. Table 4 types, control types (preventive, deterrent, detective, corrective, compensating), cost, risk reserve, control references, action items with due dates | R1 | risk-kg control mappings and Projects, cra.risk treatment enum |
| 3.7 | Monitor, Evaluate, and Adjust Risk Management | M | MEA cycle (Fig. 7). KPIs, leading and lagging KRIs, review calendar, breach alerts | R1 manual, R2 automated | risk-kg programme KRIs |
| 3.7.1 | Adjusting Risk Response Based on Additional Information | M | Re-assessment triggers. New vulnerability, incident, threat intel or audit finding reopens the risk. Full change history | R2 | CVD Portal events |
| 3.8 | Managing Positive Risks as Part of Integrated Risk Management | M | Opportunity register. Table 5 responses (realize, share, enhance, accept). Two-sided heatmap (Fig. 8) | R1 | |
| 4 | Building ERRs and ERPs from ICTRM-Specific Risk Registers | C | Section help | R2 | |
| 4.1 | Creating and Maintaining Enterprise-Level ICT Risk Registers | M | Organization ICT register built from product registers (Fig. 9 cycle) | R2 | |
| 4.2 | Creating the Enterprise Risk Register (ERR) | M | ERR with split impacts (Sec. 4.3). Drill-down to the RDR | R2 | |
| 4.3 | Developing the Enterprise Risk Profile (ERP) | M | ERP view (Fig. 11). Exposure by objective. Current versus previous period (Table 7) | R2 | |
| 4.4 | Translating the ERP to Inform Leadership Decisions | M | Board pack. PDF and PPTX export. Top risks, trends, decisions needed, decision log | R2 | |
| 5 | Enterprise Strategy for ICT Risk Coordination | C | Section help | R2 | |
| 5.1 | Risk Integration and Coordination Activities | M | Coordination workflow. Table 8 activity points as stages with inputs and outputs | R2 | |
| 5.1.1 | Detailed Risk Integration Strategy | M | Roll-up calendar. Submission deadlines per organization. Reminders | R2 | |
| 5.1.2 | Risk Monitoring and Communication Activities | M | Role dashboards. Notifications. Sign-off records that show the risk is communicated and accepted. Exception process. Audit finding links | R2 | |
| 5.2 | Aggregation and Normalization of Risk Registers | M | Aggregation engine | R2 | |
| 5.2.1 | Aggregation of ICT Risk Information | M | Collect registers. Group by category | R2 | |
| 5.2.2 | Normalization of Risk Register Information | M | Table 10 actions. AI duplicate suggestions, reprioritize against appetite, resolve disparities (one row per response, or one row with all responses), adjudicate key risks. Three-point roll-up of values | R2 | Risklet de-dup (119 to 75) |
| 5.2.3 | Integrating Risk Register Details | M | Traceability. Each ERR row links to its source rows. Raw registers stay visible to managers | R2 | |
| 5.3 | Adjusting Risk Responses | M | Response review board | R3 | |
| 5.3.1 | Factors Influencing Prioritization | M | Weighted criteria. Cost, legal duty, mission value, dependencies | R3 | |
| 5.3.2 | ICT Risk Optimization | M | Optimizer. Select responses that reduce most exposure within budget. Rule for unfunded risks | R3 | |
| 5.3.3 | ICT Risk Priorities at Each Enterprise Level | M | Per-level priority with delegated authority limits | R3 | |
| 5.4 | Enterprise Adjustments Based on ICT Risk Results | M | Adjustment log | R3 | |
| 5.4.1 | Adjustments to ICT Program Budget Allocation | M | Cost-benefit view. Exposure before and after, return on security spend | R3 | FAIR repo |
| 5.4.2 | Adjustments to Risk Appetite and Risk Tolerance | M | Versioned appetite with approval. What-if preview of risks that move in or out of tolerance | R3 | |
| 5.4.3 | Reviewing Whether Constraints Are Overly Stringent | M | Constraint report. Tolerances always breached or never reached. Cost of over-control | R3 | |
| 5.4.4 | Adjustments to Priority | M | Priority override with reason and audit trail | R2 | |
| 6 | Conclusion | C | None | n/a | |
| Ref. | References | C | Framework library with links and crosswalks (NIS2, CRA, ISO 27005, CSF 2.0) | R1 | EU_compliance_MCP |
| A | Acronyms and Abbreviations | C | Glossary with hover tips | R1 | |
| B | Notional Example of a Risk Detail Record (RDR) | M | RDR form per risk (Sec. 4.4). Before, planned and after exposure | R1 | |
| C | Federal Agency-Specific Guidelines for ICTRM | M | Optional "US federal pack" (OMB A-123, A-11). Low priority for the EU market | R3 opt. | |
| D | Change Log | R | Framework versioning. Stable concept IDs, migration when NIST publishes the final | R1 | |

Count check. 63 entries. 46 M, 6 R, 11 C. Parent entries 3.4, 5.2, 5.3 and 5.4 are M because each holds a workspace screen. R1 has 33 entries. 19 are module features. 14 are rules or help content.

## 6. Cross-cutting features (not in the ToC)

| Feature | Why | Rel. |
|---|---|---|
| Multi-tenant, RBAC, SSO | Owners, managers and approvers per level (Sec. 4.2) | R1 |
| Audit trail on every field | Regulators and boards need evidence of decisions | R1 |
| Import and export (IR 8286 JSON, CSV, XLSX, PDF) | Rule 2.4.5 | R1 |
| CVD Portal connector | Vulnerability reports feed 3.3.3 and 3.7.1 | R2 |
| AI assistant (Auto-Assessment) | Draft risks from context, suggest de-duplication. Human approves | R1 basic, R2 full |
| MCP server | Same tools as CVD Portal MCP. Claude can read and update registers | R2 |
| EU regulation mapping | Every risk and response maps to NIS2 Art. 21, CRA Annex I, ISO 27001 Annex A | R1 |

## 7. Existing assets

### 7.1 Live sites (checked 2026-10-27)

| Site | What it is today | Use in RMS |
|---|---|---|
| portaregulus.com | GRC consultancy site. Lists modules M-01 GRC Architecture, M-02 CRA Exposure, M-03 Tolerance Vectors, M-04 Auto-Assessment (Risklet). No NIST reference | Marketing home. Rename modules to RMS modules |
| www.risklet.com | NIS2 risk assessment. Questionnaire, "digital twin", top 10 risks, risk register, policy. One-time report and subscription | Becomes the RMS product site. Sections 3.1 and 3.3 |
| appetite.portaregulus.com | "Risk Appetite & Tolerance Tool". Collects organization, email (magic link) and material loss threshold. Then a matrix session | Section 3.2.1. Material loss threshold is risk capacity |
| cra.portaregulus.com | GRC Architecture (M-01). Hosts the risk-kg graph at graph.cra.portaregulus.com | Dependency graph (2.4.1) |

Issues found on the sites.
1. risklet.com shows "€490, valid until Sept 30, 2025". The offer is 13 months old. Remove it or change it.
2. risklet.com uses two names, "Risklet" and "RiskLM". Use one.
3. portaregulus.com has the footer "© 2024".

### 7.2 Reuse candidates with third-party code

| Repo | Upstream | License | Note |
|---|---|---|---|
| PortaRegulus/fair-monte-carlo-risk-analysis | paolocarner (fork) | MIT | Python. Usable for 3.4.1 quantitative mode. Keep the MIT notice |
| PortaRegulus/EU_compliance_MCP | Ansvar-Systems (fork) | Apache-2.0 | Regulation text for the reference library. Keep the NOTICE file |

### 7.3 risk-kg repository (PortaRegulus/risk-kg)

Four local copies share one history. `OpenRosiCRA` is the newest (branch `feat/cra-sso`, 3 commits ahead of `origin/main`). `origin/main` moved from NIS2 to CRA and orphaned the Easy Wins, Programmes and MSSP pages. The docs (PRD, BACKLOG, SPEC) still describe the NIS2 variant. Stack is FastAPI, Neo4j 5.18, React 18, Vite and Tailwind.

| Area | State today | Reuse |
|---|---|---|
| Risklet source | `docs/Risklet Risks.xlsx`. 119 rows with ID, name and category. No scores | Yes. Keep as provenance |
| 75-risk library | Hard-coded in `frontend/src/demo/graphData.ts`. No category field. 18 groups exist as code comments only. Some stored severity labels contradict the thresholds (r-006, r-016) | Yes. Export to JSON. Add category, polarity and source. Recompute severity |
| Scoring | Base score from seed. Inherent score adds questionnaire deltas. Residual score uses the mean of control coverage and maturity. FAIR point estimate. 18 pytest tests | Yes, as a library. Add tests before reuse |
| Control mappings | 106 CSF 2.0 subcategories. 103 CSF to NIS2 and 17 CSF to IEC 62443 maps. CRA and EN 40000 mappers | Yes. Highest value asset |
| Appetite and tolerance | Score and ALE limits, 3 postures, approver, review cycle. Stored in browser localStorage | Logic only. Move storage to the server |
| Matrix and register UI | 10x10 matrix with appetite zones. Register with search, sort, ALE and residual | UI patterns only |
| Risk record | No owner, category, response type, cost or history. Status is always "open" | No. Replace with the Sec. 4.2 model |
| Positive risks, ERR, ERP, aggregation, RACI, MEA cycle | Missing | Build new |
| Persistence | Most state in localStorage. Backend is mostly read-only. The frontend shows demo data when an API call fails | No |
| Tests and CI | 18 pytest, 4 vitest (vitest is not installed). No CI, no lint | No |

Related code.
1. `cra.risk` (Cloudflare Workers, Hono, D1, Durable Objects). It runs prEN 40000-1-2 Clause 6 as a graph. It has a treatment enum (avoidance, mitigation, acceptance, transfer) and 45 vitest tests.
2. `cra.portaregulus.com` (Workers, D1, GitHub Actions deploy). It holds the CRA SSO, a threat catalogue with residual scores and a `/api/kg` proxy to the risk-kg backend.

### 7.4 Security findings in risk-kg (verified in OpenRosiCRA)

The commit history says this backend runs at graph.cra.portaregulus.com. Fix these before you reuse code or add users.

| # | Finding | Location |
|---|---|---|
| 1 | SSO takes the tenant from the client header `X-CRA-Product`. It does not check the header against the user's products. Any CRA user can select any tenant | `backend/auth/router.py:137` |
| 2 | `/stride/*` routes have no auth dependency. They call the paid MiniMax API | `backend/stride/router.py:144-178` |
| 3 | `/questionnaire/prefill` has no auth and fetches any URL. No private address block. SSRF and cost risk | `backend/questionnaire/router.py:20`, `prefill.py:207` |
| 4 | Default secrets in code. Neo4j password `crarisks123` and `SECRET_KEY` `dev-secret-key-change-in-prod` | `docker-compose.yml`, `backend/config.py:11` |

## 8. Build approach

**Recommendation. Start a new codebase in `AIRisklet` with a relational store. Port the risk-kg library, scoring and mappings as data and packages. Do not extend risk-kg in place.**

Reasons.
1. A risk register is rows with owners, history, approvals and roll-ups. A relational store with an audit table does this well. Neo4j as the system of record makes history and aggregation queries harder.
2. risk-kg keeps most state in localStorage and has no write API for risks. The register core needs a rewrite in any case.
3. The valuable parts (library, scoring, mappings) are data and pure functions. They move without the app.
4. Keep the knowledge graph as a read model for the dependency view (2.4.1). Feed it from the register.

Stack choice is open. Two good options exist.

| Option | For | Against |
|---|---|---|
| A. Cloudflare Workers, Hono, D1 (same as `cra.risk` and `cra.portaregulus.com`) | Shares CRA SSO and KB. Deploy workflows exist. `cra.risk` already has a treatment enum and 45 tests | D1 is SQLite. Large cross-tenant roll-ups need care |
| B. Next.js, Prisma, PostgreSQL (same as `cvdportal`) | Plans, billing, API keys and audit log exist. Strong SQL for aggregation | Separate login from the CRA app unless you add SSO |

## 9. Plan risks

| Risk | Effect | Response |
|---|---|---|
| NIST final text changes fields | Rework of data model | Stable concept IDs. Watch the comment period (closes 2026-12-07) |
| Scope too large for one team | MVP slips | R1 has 19 module features. Aggregation waits for R2 |
| SMEs do not need 3 levels | Low adoption of R2 | Ship R2 to groups and MSSPs first. They run many registers |
| Qualitative scores look arbitrary | Low trust from boards | Rule 2.4.3 and FAIR mode in R2 |
| Brand overlap (Risklet, Tolerance Vectors, risk-kg, CRA Exposure) | Buyer confusion | One product, four modules, one login |
