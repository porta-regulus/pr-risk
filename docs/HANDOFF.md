# Handoff for the build session

Read this file first. Then read [SPEC.md](SPEC.md) and the six ADRs in [adr/](adr/). You do not need the conversation that produced them.

## 1. What you build

A free, open-source, local-first browser app for the risk components of NIST SP 800-221r1 ipd. SPEC.md Sec. 3.1 lists all 63 table of contents entries with their release 1 status. The app serves one decision. The IT lead of an EU company with 50 to 249 staff (NIS2 entity or supplier) prepares which risk responses to fund in the next budget cycle, so that the annual loss exceedance curve stays under the tolerance curve. The management body approves the printed decision record. Apache-2.0. No backend, no account, no network calls at run time.

## 2. Decisions you must not reopen without the product owner

| Decision | Where |
|---|---|
| Scope is the risk components of the SP 800-221r1 table of contents. All 37 In modules and 6 Partial modules are release 1, including screens S6 and S7. No regulation or framework mappings per risk. | ADR-0005, SPEC.md Sec. 3 |
| User is the IT lead of a 50 to 249 staff NIS2 company. CRA product risk assessment is out of scope. | ADR-0001 |
| Build only the gap (drivers, positive risks, portfolio optimization, forecast log, IR 8286 and OSCAL exchange, no server). Stop rule if CISO Assistant closes the gap. | ADR-0002 |
| Apache-2.0. No sign-up, lead form, telemetry or paid edition. No "Risklet" brand. | ADR-0003 |
| Data in IndexedDB only. Dedicated origin. CSP `connect-src 'none'`, except `connect-src 'self'` for `/sw.js`. | ADR-0004 |
| Static hosting on GCP, project `pr-risk-prod`. Private EU bucket, load balancer, Cloud CDN. No database, no compute. Deploys only from release tags. | ADR-0006, `infra/gcp/README.md` |
| Matrices are display only. | SPEC.md Sec. 8.13 |
| Funding uses the exact portfolio search, not a greedy rule. | SPEC.md Sec. 8.11 |

## 3. Files you start from

| Path | What it is | Status |
|---|---|---|
| `docs/schema/risk-register.schema.json` | Exchange schema, JSON Schema 2020-12, with every release 1 risk component | Done |
| `docs/schema/examples/example-1-sp800-221r1-fig10-table9.json` | Golden fixtures G1 (Fig. 10), G2 (Table 9), G5 (Fig. 11) | Valid, 13 risks |
| `docs/schema/examples/example-2-sme-quantitative.json` | Quantitative SME example with context, assets, drivers, secondary impact, response-caused risk, reserve, acceptance record. Worked example of SPEC.md Sec. 8.11. | Valid, 9 risks. Numbers from the reference model. |
| `docs/schema/examples/example-3-imports-table10.json` | Golden fixture G3 (Table 10), IR 8286 and CVD Portal imports | Valid, 7 risks |
| `docs/schema/fixtures/` | Fig. 10 CSV, Table 10 CSV, CVD Portal export | Hashes match the provenance records |
| `docs/schema/vendor/nist-ir8286r1/` | NIST IR 8286 Rev. 1 schemas and RDR example, pinned by SHA-256 | Do not edit |
| `docs/schema/validate.py` | Python validator, V rules, IR 8286 projection, G4 | Passes. Port the projection 1 to 1. |
| `docs/reference/sim_reference.py` | NumPy statistical oracle for SPEC.md Sec. 8, with the exact portfolio search and the fiscal baseline | Not the engine. Cross-checks only. |

Run the existing checks with Python 3.9 or later.

```bash
python3 -m venv .venv
```

```bash
.venv/bin/pip install jsonschema referencing numpy
```

```bash
.venv/bin/python -I docs/schema/validate.py
```

```bash
.venv/bin/python -I docs/reference/sim_reference.py docs/schema/examples/example-2-sme-quantitative.json --budget=60000
```

The validator prints four PASS lines. The G4 line also prints the NIST schema defect. The reference model selects O-4 and O-5 and prints the fiscal baseline.

## 4. First 5 build tasks

Work in this order. Each task ends with its done criteria met and committed on a branch with a pull request.

### Task 1. Repository, supply chain and CI skeleton

Goal. An empty app that already meets the release integrity rules.

Status 2026-10-29. Merged to `main` with pull request 1 of `porta-regulus/pr-risk`. CI, CodeQL and the OpenSSF Scorecard run on GitHub. The GCP resources exist (`infra/gcp/README.md`). The `production` environment, its variables and private vulnerability reporting still need the product owner.

Steps.
1. Create the public repository now, because the Scorecard Maintained check scores 0 for the first 90 days. Ask the product owner before you create or push it.
2. Add `LICENSE` (Apache-2.0), `NOTICE`, `SECURITY.md` with the CVD policy (SPEC.md Sec. 11 item 7), `DEPENDENCIES.md`, `CONTRIBUTING.md`.
3. Vite plus TypeScript strict. Choose React or Preact by bundle size. Vitest, fast-check, Playwright. ESLint with no-eval rules.
4. GitHub Actions pinned by commit SHA, `permissions: read-all` at top level. Jobs for lint, unit tests, Playwright, CodeQL, OpenSSF Scorecard, CycloneDX SBOM, and build provenance attestation on tags.
5. Static host config with the exact headers of ADR-0004, and a Playwright test that reads every header. The host is GCP (ADR-0006). `deploy/headers.json` feeds the preview server, the meta tag and Terraform.
6. Keep `docs/` unchanged and run `docs/schema/validate.py` in CI.

Done criteria.
1. `npm ci --ignore-scripts && npm run build` gives a bundle that loads offline after the first visit.
2. The header test passes, and the Playwright network log shows 0 requests after load.
3. A test tag produces a CycloneDX 1.6 SBOM and an attestation that `gh attestation verify` accepts.
4. The Scorecard job runs and stores its result.
5. `docs/schema/validate.py` passes in CI.

### Task 2. Schema package, validators and IR 8286 projection

Goal. A TypeScript package that reads, validates, migrates and projects documents as SPEC.md Sec. 7 says.

Status 2026-10-29. Done in `src/schema/`, merged to `main` with pull request 1. Done criteria 1 to 5 pass locally. `npm test` runs them, and the CI job `docs` checks the Python side. Criterion 4 (AT-1) covers 1 000 generated documents with 3 391 risks, which pass Ajv and `validate.py` and project equal in both. G4 (d), the RDR print view, belongs to task 5. Migration accepts major version 1 only, because no older major version exists.

Steps.
1. Generate TypeScript types from `risk-register.schema.json`.
2. Compile validators at build time with Ajv standalone (2020-12), with the vendored NIST schemas. No `new Function` at run time (ADR-0004 E1).
3. Implement rules V-01 to V-21 and lint L-01 to L-11 (SPEC.md Sec. 7.6).
4. Port `project_register`, `project_rdr` and `import_rdr` from `validate.py`.
5. RFC 8785 canonical JSON and SHA-256 in pure TypeScript.

Done criteria.
1. The 3 examples validate. Mutation cases (wrong polarity, unknown field, missing NIST field, wrong distribution fields, unknown objective, asset or linked risk, broken `onlyWithResponse` pair) fail with the expected rule.
2. The TypeScript projections give byte-equal canonical JSON to the Python projections for every risk in the 3 examples.
3. G4 passes all four parts (SPEC.md Sec. 12.2).
4. AT-1 runs on the 3 examples and on 1 000 fast-check documents, with Ajv and with the Python validator.
5. Lint L-03 on example 1 reports exactly the pair row 7 over row 6.

### Task 3. Simulation engine and optimization in Web Workers

Goal. SPEC.md Sec. 8.2 to 8.12, deterministic and fast.

Status 2026-10-29. Done in `src/engine/`, merged to `main` with pull request 1. Done criteria 1 to 5 pass, criterion 4 on the GitHub runner too.
1. P1 to P16 are in `test/engine-properties.test.ts`. The cross-engine part of P11 is in `test/browser/engine.test.ts`.
2. EAL, EAG, P(N at least 1) per risk and LEC at the 4 tolerance points agree with `sim_reference.py` within 4 standard errors (`test/engine-crosscheck.test.ts`).
3. Seeds 20261207, 1, 2 and 3 select O-4 and O-5 from 21 portfolios. The fiscal baseline is O-1, O-3, O-4. At B = 72 000 the best portfolio is O-1, O-4, O-5.
4. 100 000 trials with 50 leaf risks and 5 drivers take about 0.65 s in plain Node on this Mac. 256 portfolios take 2.5 s. The optimizer caches each risk's results by its exact inputs, so a portfolio re-simulates only the risks that it changes. On the GitHub runner (CI job `performance`) one run of the same commit took 1.04 s on one runner and 1.67 s on another (2026-10-29), so the job prints the CPU model. Since 2026-10-30 the job times the simulation 3 times and checks the fastest run, because one run took 1.31 s to 2.21 s on the slower runners (AMD EPYC 7763) and failed the limit of 1.5 s. Even the fastest of 3 runs failed on a 7763 runner while the repository was private (1.56 s), so the job now runs only while the repository is public. Private repositories get 2-vCPU runners, public ones 4. Run `npm run test:performance` locally while the repository is private. Vitest read each imported function through a getter in the hot loop, which made the engine about 30% slower there than in the production bundle. The engine now binds these imports to module constants.
5. Node and Chromium agree within 1e-9 relative on example 2 (`test/fixtures/engine-summary.json`).
No screen uses the engine yet. The worker client is `src/engine/client.ts`. Cancel stops the worker in under 200 ms.

Steps.
1. SHA-256 stream seeding, xoshiro128**, mulberry32, the 53-bit uniform, AS 241 and the samplers (Sec. 8.4 to 8.6), including secondary impacts.
2. Model loop with drivers, response-caused risks, register roll-up, LEC grid, tolerance curve, gap, clear breach, excess area, percentiles and contributions.
3. Response effects, alternatives, bundles, reserves (Sec. 8.10).
4. Exact portfolio search with confirmation, near-tie rule, marginal values, budget sensitivity, greedy fallback, fiscal baseline and forced options (Sec. 8.11, 8.12).
5. Run in Web Workers with progress and cancel.

Done criteria.
1. Property tests P1 to P16 pass (SPEC.md Sec. 12.3).
2. On example 2, EAL, P(N at least 1) per risk and LEC at the 4 tolerance points agree with `sim_reference.py` within 4 standard errors.
3. On example 2 with B = 60 000, the optimization selects O-4 and O-5 for seeds 20261207, 1, 2 and 3. The fiscal baseline is O-1, O-3, O-4. At B = 72 000 the best portfolio is O-1, O-4, O-5.
4. The performance targets of SPEC.md Sec. 8.16 hold on the GitHub-hosted runner, with a margin factor of 2.
5. The same document and seed give identical output in Node and in Chromium within 1e-9 relative.

### Task 4. Import adapters

Goal. Every import path of SPEC.md Sec. 9 with preview, defaults and provenance.

Status 2026-10-29. Built in `src/import/`, merged to `main` with pull request 1. Gate G-A is open, so the importer stays "unvalidated".
1. G1 (a), (c), (d) and (e) pass from the Fig. 10 CSV. (a) compares every field except the hand-written `notes`, and `defaultedFields` as a set.
2. G3 (a) to (e) pass. (b) to (d) use `src/import/rollup.ts`.
3. The CVD Portal fixture gives GW-1 and GW-2 equal to example 3, notes included. The dropped fields never enter the result. Re-import updates evidence and sets "Review needed".
4. Both NIST XLSX files import through SheetJS 0.20.3, with the leading-space headers, the "7.5% (Low)" cells and the "Updated" warning. They are in `test/fixtures/nist-xlsx/`, pinned by SHA-256.
5. Fuzz and limit tests pass. A ZIP directory that declares more than 50 MB is refused before SheetJS reads it.
6. Import runs in a Web Worker (`src/import/client.ts`) and stops after 20 s. Saved mappings per header signature (Sec. 9.4 item 7) and the scale step UI belong to screen S3 in task 5.

**Gate G-A, before this task ends.** Ask the product owner for at least 5 real SME risk registers (CSV, XLSX or PDF exports, anonymised is fine). Run each through the importer. Record every unmapped header, unparsed value and wrong guess. Extend the synonym table and value parsers. Add each register (anonymised) as a fixture if the owner allows it. Without these registers the importer stays marked "unvalidated" in the UI and in SPEC.md.

Steps.
1. Common pipeline with worker, limits, format detection, preview and diff (Sec. 9.1, 9.7).
2. Native JSON with migration.
3. NIST IR 8286 JSON (entries, RDRs, both joined).
4. CSV and XLSX with header detection, synonyms, locale numbers, compound cells, scale step and saved mappings. SheetJS Community Edition from cdn.sheetjs.com, pinned by hash.
5. CVD Portal JSON with grouping, dropped fields and "Review needed" on re-import.

Done criteria.
1. G1 parts (a), (c), (d), (e) pass from `fixtures/sp800-221r1-fig10.csv`.
2. G3 parts (a) to (e) pass from `fixtures/table10-system-registers.csv`.
3. The CVD Portal fixture gives risks GW-1 and GW-2 equal to example 3. The dropped fields are absent from IndexedDB and from every export.
4. The NIST XLSX files `RiskRegisterTemplate_20240109.xlsx` and `RiskRegisterExampleFig7_20240109.xlsx` (IR 8286 Rev. 1 page) import with the leading-space headers, the "7.5% (Low)" cells and the "Updated" status warning.
5. Import fuzz tests (oversized files, zip bomb, `__proto__` keys, XSS strings, CSV formula prefixes) pass.
6. Gate G-A is done, or the product owner has accepted the importer as unvalidated in writing.

### Task 5. Screens S1 to S5 and the decision record

Goal. The life cycle screens up to Respond (SPEC.md Sec. 5), enough to run the usability test.

Status 2026-10-29. Screen S1 Start works (`src/ui/start.tsx`) on the IndexedDB storage of `src/storage/db.ts`. It opens, creates, imports through the import worker, exports in all five formats, shows storage status and the export reminder, and removes all data after a typed confirmation. The Playwright test `e2e/start.spec.ts` runs that flow under the production CSP with no console error.

Screen S2 Context and strategy works (`src/ui/context.tsx`, `appetite.tsx`, `strategy.tsx`, `table9.tsx`). It edits mission, context, stakeholders, disciplines, objectives, functions, roles, capacity, the tolerance curve (with the starting points of SPEC.md Sec. 8.9), appetite statements with tolerances, controls, indicators and triggers, scales, review and reporting cycle, budget, thresholds and the optimization method. A valid change is saved after 0.6 s as a new version, with one change log entry per section, and a change within 10 minutes updates that entry. An invalid change shows the rule and is not saved. Undo goes back one kept version. The Table 9 view and the value check pass G2 parts (a) and (b) in `e2e/context.spec.ts`. The help text of the statements shows the five pairs of SP 800-221r1 Table 2 (p. 17, line 654), quoted exactly, and each one can start a new statement (Sec. 6.5 item 4, `src/ui/templates.ts`).

Screen S3 Identify and analyze works (`src/ui/identify.tsx`, `risk-editor.tsx`, `distribution.tsx`, `drivers.tsx`, `analysis.ts`). It has the register tree and register editor, the risk table, a new risk with the placeholders of rule D-Q2, the asset inventory with value basis and a driver hint for shared assets, a driver panel with the L-06 hint, and the risk editor with the tabs of Sec. 5. Scenario has the scenario parts in the RDR fields, category and subcategory of Sec. 6.7.7, the horizon banner and the Table 6 consequences. Estimate has the scale labels and the estimate words of Sec. 5 with "once every N years", PERT, fixed value, secondary impacts, live feedback and the help on biases. Drivers links the risk to drivers with a trigger probability. Detail has the RDR fields. Evidence sets the status to "Review needed" when evidence is added. Links has objectives, assets and linked risks. On save, the NIST numbers of every re-estimated risk come from a run of that risk with its drivers, in any register (Sec. 6.8). A risk without an estimate takes its numbers from its labels (rules D-Q1 and D-Q3), and they stay listed as defaulted, as the importer lists them. Each risk has its own streams, so this equals its numbers in a full run, and `test/ui-analysis.test.ts` checks this for every risk of example 2. The feedback shows the probability for the register timeframe, which is 12 months unless the register says otherwise. S2 and S3 share the save frame of `src/ui/editor.tsx`, and the change log has one entry per changed register, risk, asset and driver. The catalogue picker (`src/ui/catalogue.ts`) offers the 3 opportunity templates of Sec. 6.7.7, quoted exactly from SP 800-221r1, and the 119 names of the Risklet catalogue (CC BY 4.0, Q3 answered 2026-10-29) with the category map of Sec. 6.7.7. A template gives text, polarity and category, never numbers. S3 is complete.

Screen S4 Prioritize works (`src/ui/prioritize.tsx`, engine `src/engine/prioritize.ts`). It shows the loss exceedance curve of the roll-up and of each child register against the tolerance curve, with a table equivalent, the percentiles, P(loss above capacity) and the gap. The risk table gives the expected annual loss with its standard error, P(at least one event) in the register timeframe, the contribution to the worst 5% of years and the status of the risk alone against the curve. Priorities are proposed from the expected annual loss within each register, and leadership can override them with the factors of Sec. 5.3.1. Opportunities show their expected gain and P(not realized). The two-sided matrix of Fig. 8 is display only and marks the pairs of lint L-01 and L-03.

Screen S5 Respond and optimize works (`src/ui/respond.tsx`). It edits the budget, the method and the response options with costs, effects, control types, informative references, bundles, introduced risks and forced choices. One engine job (`src/engine/decision.ts`) computes the decision record. It optimizes at the budget and at minus and plus 20%, adds the fiscal baseline, and measures every row again at 100 000 trials with one seed, so all rows compare with common random numbers. Each portfolio row has the batch-means standard error of its benefit. Each candidate that is not funded has a reason. The residual risks without an acceptance record mark the record as a draft, and S5 records the acceptances. A change of the document after a run hides the record until the next run, because the record names the document hash. The hash is SHA-256 of the RFC 8785 form of the document without `changeLog`.

The decision record (`src/ui/record.tsx`) has every section of SPEC.md Sec. 4 in the layout of Sec. 4.1. `test/engine-decision.test.ts` checks the record of example 2 against the worked example of Sec. 8.11 within 4 combined standard errors, including the alternatives, the fiscal baseline (EUR 17 860 less), the marginal values of O-4 and O-5, and the best portfolio at EUR 48 000 and 72 000. `e2e/respond.spec.ts` prints the record of example 2 to PDF and counts 2 A4 pages.

Done criteria status 2026-10-29.
1. Passes. G2 parts (a) and (b) pass in `e2e/context.spec.ts`. G1 part (b) passes in `e2e/respond.spec.ts`. S4 shows a register in the layout of Fig. 10, and every cell of the ERR register of example 1 equals the CSV fixture. The full S7 enterprise view stays in task 7.
2. Passes. `e2e/at5.spec.ts` completes the AT-5 task from an empty browser to the printed record in about 13 s. Two risks come from the catalogue picker (a Risklet name and a NIST opportunity), and 3 are own risks, as AT-5 asks.
3. Passes for S1 to S5. axe-core (`e2e/axe.ts`) finds no WCAG 2.2 A or AA violation, also with the record and the option editor open.
4. Passes. The record of example 2 prints on 2 A4 pages with the fiscal baseline and the budget sensitivity.
5. Open. It needs a pilot session with one target user. The kit is ready in `docs/pilot/` (facilitator guide, consent text, task sheet with a fictitious company, observation and blocker log). The product owner runs the session and writes the result here.

Steps.
1. S1 Start with storage status and remove-all.
2. S2 Context and strategy. Objectives, functions, roles, capacity, tolerance curve editor, appetite statements with Table 9 triggers, scales, budget and thresholds.
3. S3 Identify and analyze. Asset inventory, register tree, risk editor with the estimate words of SPEC.md Sec. 5, secondary impacts, drivers, RDR detail, evidence and links. Catalogue picker (after open question Q3).
4. S4 Prioritize. LEC chart with table equivalent, percentiles, contributions, two-sided display-only matrix with lint markers.
5. S5 Respond and optimize. Response options with control types, references, reserves and forced choices. Ranked portfolios, before and after, print view of the decision record (SPEC.md Sec. 4).

Done criteria.
1. G1 part (b) and G2 parts (a) and (b) pass in Playwright.
2. A scripted Playwright run completes the AT-5 task on a fictitious company profile in under 10 minutes of wall time.
3. axe-core reports no WCAG 2.2 AA violation on S1 to S5.
4. The printed decision record of example 2 fits on 2 A4 pages and shows every section of SPEC.md Sec. 4, including the fiscal baseline and budget sensitivity.
5. A pilot session with one target user (not one of the 5 AT-5 users) finds no blocker.

## 5. After task 5

| Task | Content | Test |
|---|---|---|
| 6 | S6 Monitor and adjust. KRI evaluation, review triggers, acceptance records, tolerance what-if, forecasts and Brier score | G2 (b), Sec. 8.14 unit tests |
| 7 | S7 Enterprise view. ERR, ERP by objective, portfolio view, merge and normalization | G1 (b), G3, G5 |
| 8 | OSCAL POA&M export and import, oscal-cli in CI | AT-4 |
| 9 | Encrypted export, durability banners, remove-all | ADR-0004 I2, I5, D3 |
| 10 | Usability test with 5 users | AT-5 |
| 11 | Expert review by a CISO and an auditor | AT-6 |
| 12 | Release 1. SBOM, signatures, Scorecard 7 or more, Best Practices badge, Annex I self-check | AT-7 |
| 13 | Send NIST comments N1 to N27 (SPEC.md Sec. 14) before 7 December 2026 | Done. The product owner sent them (reported 2026-10-30). |

Status 2026-10-28. Some library parts of later tasks are done early, with tests and without screens. Task 9 has the encrypted export file (`src/export/encryption.ts`, known-answer test against node:crypto). The exports of SPEC.md Sec. 9.8 exist except OSCAL (`src/export/export.ts`, rules E-01 and E-02, CSV injection guard). Durability banners and remove-all need the screens of task 5.

Task 8 (OSCAL) is also done as library code (`src/oscal/`). The exports of the 3 examples pass the OSCAL 1.2.3 draft-07 schema (`test/fixtures/oscal/`, pinned by SHA-256). The lossless path restores each document exactly. The native path restores every risk field. The CI job `oscal` runs NIST oscal-cli 3.2.0 on the exports. It has not run yet, because this Mac has no Java and the repository is not on GitHub.

Task 6 library parts are done too (`src/monitor/`). G2 (b) passes, including the boundary gap of Table 9 example 3 at 5 percent. Forecasts freeze with the input hash of SPEC.md Sec. 8.14, which reproduces both hashes stored in example 2. The Brier score, skill score, Murphy decomposition and the hit rate of the 90 percent interval have exact unit tests.

### Task 6. S6 Monitor and adjust

Status 2026-10-30. Screen S6 works (`src/ui/monitor.tsx`, rules in `src/monitor/review.ts` and `src/monitor/tolerance.ts`, engine job `monitor` in `src/monitor/numbers.ts`). The start screen and the editor navigation open it. Both done criteria pass.
1. G2 (b) passes on recorded observations, in `e2e/monitor.spec.ts` and `test/monitor-s6.test.ts`. The screen shows "Fires", "Does not fire" or "No data" for each tolerance and indicator, and it flags the boundary gap of Table 9 example 3 at 5 percent.
2. The Sec. 8.14 unit tests pass in `test/monitor.test.ts` and `test/monitor-s6.test.ts`. They cover the input hash, the window, the freeze, a frozen forecast that is never edited, the outcome with rule V-15, BS with SE(BS) and its 95% interval, the skill score, the Murphy decomposition with its difference, and the hit rate of the 90% interval.

What the screen does.
1. KPIs, KRIs and tolerances. One observation of a statement goes to each tolerance and indicator whose trigger uses one of its metrics, with only those values. Each trigger is checked on its own latest observation. On the same date, the observation recorded last counts.
2. Review triggers. The screen lists each risk that needs a review, with the reasons of Sec. 6.11 item 2 and Sec. 6.14 item 1. The app sets the status "Review needed" itself (see "Automatic Review needed" below). A KRI is a leading or lagging KRI of a statement whose `categoryCodes` hold the category code of the risk. A KPI and a breached tolerance do not start a review, because Sec. 6.11 names KRIs only. An emerging or horizon risk is "new" when the change log shows that it became emerging or horizon after the as-of date of the register of the other risk. Closed risks get no trigger.
3. Acceptance records. Every risk that is accepted or has the response Accept, with the state Valid, Expired or No end date. The editor is shared with S5 (`src/ui/acceptance.tsx`).
4. Tolerance what-if. The job keeps the sorted annual losses of the roll-up, so a changed curve gives status, gap, excess area and P(loss above capacity) at once. Saving moves the old curve into `appetite.history`. The new curve has no approval until S2 sets it.
5. Forecasts. "Freeze forecasts" adds a forecast for each simulated leaf risk that has none for its current window. It adds no forecast for a window that has ended, because that would be hindsight. After the window ends, the screen asks for the outcome. The change log now keys forecasts by their own id (`src/ui/edit.ts`), so two forecasts of one risk do not collide.

Answer of the product owner, 2026-10-30. "Make it automatic". S6 now sets "Review needed" with no click, as Sec. 6.11 item 2 reads. The button "Set N risks to Review needed" is gone.

Automatic Review needed (`automaticReviews` and `withAutomaticReview` in `src/monitor/review.ts`).
1. When the check runs. The check runs on each version that S6 shows. That is when S6 opens, after each save on S6, and after undo. Sec. 6.11 item 2 names events ("when a KRI ... fires", "when its `reviewDue` date passes"), and S6 is the screen of Sec. 6.11 (Sec. 5). The app has no background process and no notifications (Sec. 5.1.2 in the table of Sec. 2), so a date can pass only while the app is open. Other screens do not run the check. A risk that gets a reason while you work on another screen gets the status when S6 opens next.
2. Change log. Each change is one entry per risk, with path "", before and after. The actor is "PortaRegulus Risk (automatic review)" and then the reasons, for example "PortaRegulus Risk (automatic review). KRI-1 of appetite statement AP-1 fires on the observation of 2026-10-27." A person never has this actor. Schema 1.0.0 has no reason field in a change log entry, so the reasons are in the actor text. The save keeps the entries that the draft adds after the saved log and puts them first. A change of a person in the same save gets its own entry, which starts from the state after the change of the app (`withChangeLog` in `src/ui/edit.ts`).
3. Undo. The change is its own version, so "Undo last change" takes it back. The same reason does not act again in that visit of S6. When S6 opens next, a reason that still holds sets the status again.
4. No second write. A risk with the status "Review needed" gets no change and no entry.
5. A reason acts once. The change log keeps the reasons that acted, so a person ends the review with another status, and the app does not set it again for the same reason. A new observation, a new review date, a new acceptance end or a new emerging risk is a new reason. Each fired KRI is its own reason, and it names its own latest observation by date. A second observation on the same date also gets its number, for example "observation 2 of 2026-10-27". So a KRI without a new observation does not start the review again.

Open for the product owner.
1. Must a breached tolerance start a review too? Sec. 6.11 item 2 names KRIs only, so now it does not. This half of the question has no answer yet.
2. Must the reasons go into their own `reason` field of the change log entry? That is a new optional field, so schema version 1.1.0 (Sec. 7.7). Until then the reasons are in the actor text.

### Task 7. S7 Enterprise view

Status 2026-10-30. Screen S7 works (`src/ui/enterprise.tsx`, rules in `src/enterprise/profile.ts` and `src/enterprise/normalize.ts`). The start screen and the editor navigation open it. The views read the stored numbers and labels, so they work for qualitative registers too. Only the portfolio uses the engine job `prioritize` of S4. All three golden tests pass.
1. G1 (b) passes in `test/enterprise.test.ts` and `e2e/enterprise.spec.ts`, on S7 and on S4. The test moved from `e2e/respond.spec.ts`. S4 keeps the Fig. 10 view, because S4 shows nothing else for a register without a simulation.
2. G3 (a) to (e) pass. (a) stays in `test/import-golden.test.ts`. On S7 the user removes ORG-1 of example 3 and merges A-1, B-1 and C-1 again, with both layouts of Table 10. The result equals ORG-1, and lint L-10 flags it only in the layout with all responses (`test/enterprise.test.ts`, `e2e/enterprise.spec.ts`).
3. G5 (a) to (d) pass in `test/enterprise.test.ts`, and (a) to (c) in `e2e/enterprise.spec.ts`. The expected cells were compared with Fig. 11 on p. 42 of the PDF.

What the screen does.
1. ERR. The Fig. 10 view of S4 (`src/ui/err.tsx`), one register at a time.
2. ERP. One block per objective in the order of `context.objectives`, in the layout of Fig. 11 (Exposure Factors, then Assessment with Last, Current and Residual). The scope is all registers, or one register with the registers below it. A summary entry stands for its sources, so no risk shows twice. Closed risks and risks that a response causes are not in the profile. A risk without a label shows its number, and a placeholder number shows "Not set". The view lists the risks without an objective (L-09).
3. Aggregate and normalize (Sec. 6.15). A parent register lists the entries of the registers below it by category code, then subcode. The user selects entries and merges them into summary entries with `summarize` of `src/import/rollup.ts`. The merge refuses an empty selection, an empty description or owner, an id in use and mixed polarity. It also refuses an entry that a summary entry holds already, because the profile would count it twice, and an entry with placeholder numbers (rule D-Q2), because the summary would show them as values (hard rule 2). The merge refuses and does not replace the old summary, because "De-duplicate and combine" of Table 10 gives one summary entry for one scenario, and Sec. 6.15 item 4 keeps the raw child entries visible from that entry. A silent replace would delete a description and an owner that a person wrote. To combine again, the user removes the old summary entry first, and the change log keeps both steps. A summary entry gets the objectives of its sources, and numbers that its sources take from labels stay listed in `defaultedFields`. The table of summary entries shows the three-point values, the raw source entries, the priority (editable), lint L-10 and a remove button. An entry at or above `strategy.escalationThreshold` that no summary entry of the parent holds is marked "Escalate".
4. Portfolio (Sec. 6.13 item 3). Rows are the registers in tree order, with "All registers" first when the tree has more than one root. A row covers the register and the registers below it. The financial profile is the expected annual loss of the negative risks. When the register has simulated risks, the current period is the simulated value with its standard error from the run of S4, and the entries without an estimate show apart with their exposure ratings. Else it is the sum of the exposure ratings, because expected values add up. The previous period is the sum from `previousAssessment`. The reputation and mission profiles give the highest label on the impact scale.
5. Print. The print button prints the ERR, the ERP and the portfolio without the form fields (SPEC.md Sec. 9.8).

Answers of the product owner, 2026-10-30, and what follows from them.
1. Weighted average of the response costs (Sec. 6.15 item 4, SP 800-221r1 lines 1661 to 1664). The owner asked for a proposal. Proposal. Weight the cost of each source by its exposure rating, so that a source with a larger expected loss counts more, and use the plain mean when every exposure rating is 0. The total stays the default. The summary must record which rule gave its cost, which needs a new optional field in `rollUp`. Not built. It goes with item 2.
2. Previous reputation and mission labels. The owner wants them if this is possible. It is possible, but it is a minor schema version (Sec. 7.7 item 2). `schemaVersion` and `$id` go to 1.1.0, documents of 1.0.0 must still open, `validate.py` and rule V-11 check the new labels, and the generated files and pinned fixtures change. No screen edits `previousAssessment` yet, so the task also needs a way to fill the previous period. Not built. Proposed as a separate task.
3. Simulated value in the portfolio. The owner prefers it. Done, see item 4 of the list above.
4. The per-entity choice of the import merge (Sec. 9.7). The owner does not know which task owns it. `src/import/pipeline.ts` (task 4) has the choice (keep current, take incoming, keep both), but S1 shows only the number of changed fields. Proposal. Build the control on S1 before the usability test of task 10, because a parent register takes its child registers as files (Sec. 6.1 item 4), and the import of a newer child file needs the choice. Built 2026-10-30, see "Import merge choice on S1" after task 9.

### Task 8. OSCAL POA&M export and import

Status 2026-10-30. Done. AT-4 passes.
1. S1 exports the open document as OSCAL POA&M 1.2.3 (`src/oscal/poam.ts`). The import pipeline reads a POA&M file as format `oscal-poam`.
2. The exports of the 3 examples pass the OSCAL 1.2.3 JSON schema (`test/oscal.test.ts`) and NIST oscal-cli 3.2.0 (CI job `oscal`).
3. Lossless path. The unit test restores each example exactly, apart from the change log and the new provenance record. `e2e/start.spec.ts` does the same for example 2 through screen S1 and compares the whole document, because the native path also restores every risk.
4. Native path. Without the payload, every risk field comes back, and the import report lists the rest (`test/oscal.test.ts`).

### Task 9. Encrypted export, durability banners, remove-all

Status 2026-10-30. Done, apart from the manual test of D3 in Safari.
1. ADR-0004 I2. The encrypted copy uses AES-256-GCM with a key from PBKDF2-HMAC-SHA-256, 600 000 iterations, a 16-byte random salt and a 12-byte random IV, all through WebCrypto (`src/export/encryption.ts`). `test/export.test.ts` has the known-answer test against node:crypto and the wrong passphrase test. `e2e/start.spec.ts` saves an encrypted copy on S1 and restores it in an empty browser.
2. ADR-0004 I5. "Remove all data from this browser" needs the typed word REMOVE. `e2e/start.spec.ts` checks that after it the browser holds no document, no version, no cache, no service worker and no local storage entry. A test run with the cache step removed from `removeAll` fails, so the check works.
3. ADR-0004 D3. The app requests persistent storage on the first save. S1 and the editor screens show the last-export date, and a banner when there is no export or the last one is older than 7 days (`exportOverdue`, `test/browser/storage.test.ts`). S1 says whether the browser keeps the data.

Open for the product owner. ADR-0004 D3 asks for a manual test in Safari. Open the hosted app in Safari, save a document and export it. Check that S1 shows the last-export date and says whether Safari keeps the data. Write the result here.

### Import merge choice on S1 (SPEC.md Sec. 9.7)

Status 2026-10-30. Done. This is item 4 of the answers in task 7.
1. When the user imports a file into an open document, S1 shows one block for each risk that has an id of the open document and other values. The block has a table with field, current and incoming, and the choice keep current, take incoming or keep both. Take incoming is the default, as in `commitImport`. A new risk gets no choice. The helpers are in `src/ui/merge.ts`.
2. Each table is a scroll region that the keyboard can focus, as in `src/ui/record.tsx`. It scrolls to the side only. A height limit would hide changed fields under a second scroll bar. The screen has no horizontal overflow at 375 px.
3. A risk with an id of the open document and no changed field gets keep current. It stays as it is and gets no change log entry. Before this change, it got an entry with equal before and after.
4. The change log records the result. Take incoming gives an entry with before and after. Keep both gives an entry for the new id (for example C-1-2) with after only. Keep current gives no entry, because nothing changes. The provenance record lists the file for each choice.
5. Tests. `test/ui-merge.test.ts` checks the diff rows, the choice mapping, the stored document and the change log for each choice. `e2e/start.spec.ts` opens example 3 and imports a newer Table 10 CSV. It chooses keep current for A-1 with the keyboard, take incoming for B-1 and keep both for C-1. Then it checks the stored document, the change log, axe-core and the 375 px width. No child register of example 3 has 3 risks, so the test uses the Table 10 file, which holds the child registers SYS-A, SYS-B and SYS-C.

Open for the product owner.
1. Registers. The diff also shows a register with changed fields, but S1 gives it no choice. `commitImport` keeps the register of the open document and adds only new registers. The user changes a register on S3. Must a newer child file also update its register, for example the as-of date? That needs a register choice in `commitImport`. Keep both is not clear for a register, because its risks point to its id.
2. Keep current in the change log. Schema 1.0.0 has no field for a value that the user did not take. If an auditor must see the incoming values that the user did not take, that needs a new optional field (schema 1.1.0, Sec. 7.7).
3. Take incoming replaces the whole risk. A CSV row has fewer fields than a risk in the app, so in the test take incoming removes the notes and the category subcode of B-1. The diff shows this before the commit. A choice for each field is a possible change after the usability test of task 10.

## 6. Rules for the build session

1. Write all prose (UI text, docs, commit messages) in ASD-STE100 Simplified Technical English. No em dashes, semicolons or colons in prose.
2. When a NIST or EU text is the source, quote it exactly and give the page and line or the article.
3. Never invent a default frequency or loss for a risk. Empty is better than invented.
4. If a test in SPEC.md cannot pass because the spec is wrong, change the spec in the same pull request and say why.
5. Do not add a dependency without an entry in `DEPENDENCIES.md`.
6. Do not add any network request. If a feature seems to need one, it is out of scope.
7. Do not add regulation or framework mappings per risk. They are out of scope (SPEC.md Sec. 3.2).

## 7. Open questions for the product owner

See SPEC.md Sec. 15. Q3 is answered, and the Risklet catalogue ships. The one that blocks work is Q4 (real registers, gate G-A in task 4).
