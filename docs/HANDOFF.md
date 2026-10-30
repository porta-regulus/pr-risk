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
4. 100 000 trials with 50 leaf risks and 5 drivers take about 0.65 s in plain Node on this Mac. 256 portfolios take 2.5 s. The optimizer caches each risk's results by its exact inputs, so a portfolio re-simulates only the risks that it changes. On the GitHub runner (CI job `performance`) one run of the same commit took 1.04 s on one runner and 1.67 s on another (2026-10-29), so the job prints the CPU model. Since 2026-10-30 the job times the simulation 3 times and checks the fastest run, because one run took 1.31 s to 2.21 s on the slower runners (AMD EPYC 7763) and failed the limit of 1.5 s. Vitest read each imported function through a getter in the hot loop, which made the engine about 30% slower there than in the production bundle. The engine now binds these imports to module constants.
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

Task 6 library parts are done too (`src/monitor/`). G2 (b) passes, including the boundary gap of Table 9 example 3 at 5 percent. Forecasts freeze with the input hash of SPEC.md Sec. 8.14, which reproduces both hashes stored in example 2. The Brier score, skill score, Murphy decomposition and the hit rate of the 90 percent interval have exact unit tests. Screen S6 is still to build.

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
