# OpenSSF Best Practices badge, answers for the passing level

| Item | Value |
|---|---|
| Status | Draft. The product owner makes the entry on https://www.bestpractices.dev with a GitHub account of a project member (HANDOFF.md task 12, D5). |
| Date | 2026-10-30 |
| Checked version | `main` at commit a02d31b |
| Criteria source | `criteria/criteria.yml` of `coreinfrastructure/best-practices-badge`, commit e035b3e. Level passing has 67 criteria. |

The URLs work only after the repository is public. `R` below means https://github.com/porta-regulus/pr-risk.

## 1. Do these before the entry

| # | Step | Criteria |
|---|---|---|
| 1 | Make the repository public (D1). | `repo_public`, `report_archive`, `discussion` |
| 2 | Turn on private vulnerability reporting. | `vulnerability_report_private` |
| 3 | Wait for the first CodeQL run on `main`, and check that it has no open alert. | `static_analysis`, `static_analysis_fixed` |
| 4 | Push the test tag `v0.1.0-rc.2` (D3), so that one release with release notes exists. | `release_notes`, `version_tags` |
| 5 | Confirm that a primary developer meets the 2 knowledge criteria. | `know_secure_design`, `know_common_errors` |

## 2. Answers

MUST criteria must be Met or N/A. SHOULD and SUGGESTED criteria can be Unmet.

### Basics

| Criterion | Level | Answer | Justification and evidence |
|---|---|---|---|
| `description_good` | MUST | Met | The first paragraph of the README says what the app does and for whom. `R#readme` |
| `interact` | MUST | Met | The README tells users how to get the app (Run it), how to report a problem and how to contribute. `R#readme` |
| `contribution` | MUST | Met | Contributions come as pull requests. CONTRIBUTING.md gives the checks and the DCO sign-off. `R/blob/main/CONTRIBUTING.md` |
| `contribution_requirements` | SHOULD | Met | CONTRIBUTING.md lists the rules (writing standard, no network request, tests, dependencies). `R/blob/main/CONTRIBUTING.md` |
| `floss_license` | MUST | Met | Apache-2.0 for code and schema, CC BY 4.0 for catalogue content and help text. |
| `floss_license_osi` | SUGGESTED | Met | Apache-2.0 is OSI approved. |
| `license_location` | MUST | Met | `R/blob/main/LICENSE` |
| `documentation_basics` | MUST | Met | README, SPEC.md and the ADRs. `R/tree/main/docs` |
| `documentation_interface` | MUST | Met | The input and output interface is the exchange format. JSON Schema 2020-12 with examples in `R/tree/main/docs/schema`. SPEC.md Sec. 9 gives the import and export formats. |
| `sites_https` | MUST | Met | GitHub and https://risk.portaregulus.com use HTTPS only, with HSTS. |
| `discussion` | MUST | Met | GitHub issues and pull requests. `R/issues` |
| `english` | SHOULD | Met | All documents are in English, and we accept reports in English. |
| `maintained` | MUST | Met | Active development since October 2026. |

### Change control

| Criterion | Level | Answer | Justification and evidence |
|---|---|---|---|
| `repo_public` | MUST | Met after step 1 | `R` |
| `repo_track` | MUST | Met | Git records each change, its author and its date. |
| `repo_interim` | MUST | Met | Every change goes through a pull request to `main`. `R/pulls?q=is%3Apr` |
| `repo_distributed` | SUGGESTED | Met | Git |
| `version_unique` | MUST | Met | Each release has a tag that must equal the version in `package.json`. The release workflow stops if they differ. `R/blob/main/.github/workflows/release.yml` |
| `version_semver` | SUGGESTED | Met | SemVer, for example `0.1.0-rc.1`. |
| `version_tags` | SUGGESTED | Met | Git tags `v*` start the release workflow. |
| `release_notes` | MUST | Met after step 4 | Each GitHub release has notes with the merged pull requests and the verify commands. `R/releases`. Add a short paragraph on what changed for users, because a list of pull request titles is close to a version control log. |
| `release_notes_vulns` | MUST | N/A | No publicly known vulnerability has been fixed. |

### Reporting

| Criterion | Level | Answer | Justification and evidence |
|---|---|---|---|
| `report_process` | MUST | Met | GitHub issues. `R/issues` |
| `report_tracker` | SHOULD | Met | GitHub issues |
| `report_responses` | MUST | Met | No bug report has been received yet. We answer each one. |
| `enhancement_responses` | SHOULD | Met | No enhancement request has been received yet. |
| `report_archive` | MUST | Met after step 1 | GitHub issues are public and searchable. `R/issues?q=` |
| `vulnerability_report_process` | MUST | Met | `R/blob/main/SECURITY.md` |
| `vulnerability_report_private` | MUST | Met after step 2 | GitHub private vulnerability reporting, or e-mail to security@portaregulus.com. `R/security/advisories/new` |
| `vulnerability_report_response` | MUST | N/A | No vulnerability report in the last 6 months. SECURITY.md promises an answer in 5 working days. |

### Quality

| Criterion | Level | Answer | Justification and evidence |
|---|---|---|---|
| `build` | MUST | Met | `npm ci --ignore-scripts && npm run build` (TypeScript and Vite). |
| `build_common_tools` | SUGGESTED | Met | npm, TypeScript and Vite |
| `build_floss_tools` | SHOULD | Met | All build tools are FLOSS. |
| `test` | MUST | Met | Vitest unit and property tests, Playwright end-to-end tests. CONTRIBUTING.md says how to run them. `R/blob/main/CONTRIBUTING.md` |
| `test_invocation` | SHOULD | Met | `npm test` |
| `test_most` | SUGGESTED | Unmet | The tests cover each screen and each rule of the spec, but the project does not measure branch coverage. |
| `test_continuous_integration` | SUGGESTED | Met | GitHub Actions runs all tests on each pull request and each push to `main`. `R/actions/workflows/ci.yml` |
| `test_policy` | MUST | Met | CONTRIBUTING.md says that new functionality needs automated tests in the same pull request. |
| `tests_are_added` | MUST | Met | For example, pull request 12 added the import merge choice with `test/ui-merge.test.ts` and a Playwright test. `R/pull/12` |
| `tests_documented_added` | SUGGESTED | Met | CONTRIBUTING.md |
| `warnings` | MUST | Met | TypeScript `strict` and ESLint with `typescript-eslint` `strictTypeChecked`. |
| `warnings_fixed` | MUST | Met | CI fails on a lint or type error. ESLint reports 0 errors and 0 warnings on `main`. |
| `warnings_strict` | SUGGESTED | Met | `strictTypeChecked`, `noUncheckedIndexedAccess` and `exactOptionalPropertyTypes`, plus rules that forbid HTML rendering, `eval` and network APIs. |

### Security

| Criterion | Level | Answer | Justification and evidence |
|---|---|---|---|
| `know_secure_design` | MUST | Met after step 5 | The STRIDE threat model shows the design principles in use, for example fail-safe defaults (CSP `default-src 'none'`), least privilege (Permissions-Policy, no network) and economy of mechanism (no server). `R/blob/main/docs/adr/0004-local-first-data-and-threat-model.md` |
| `know_common_errors` | MUST | Met after step 5 | ADR-0004 names the common web errors and their counter, for example XSS (text only, Trusted Types), prototype pollution, CSV injection and clickjacking. |
| `crypto_published` | MUST | Met | AES-256-GCM, PBKDF2-HMAC-SHA-256 and SHA-256, all published and reviewed. |
| `crypto_call` | SHOULD | Met | The app calls WebCrypto only. `R/blob/main/src/export/encryption.ts` |
| `crypto_floss` | MUST | Met | WebCrypto in Chromium and Firefox is FLOSS. |
| `crypto_keylength` | MUST | Met | AES keys are 256 bits. No shorter key is possible. |
| `crypto_working` | MUST | Met | No broken algorithm. GCM with a random 12-byte IV for each file. |
| `crypto_weaknesses` | SHOULD | Met | SHA-1 makes UUIDv5 names in the OSCAL export, because RFC 9562 defines it. It protects nothing. |
| `crypto_pfs` | SHOULD | N/A | The app has no key agreement protocol. The hosting provider ends TLS. |
| `crypto_password_storage` | MUST | N/A | The app has no user accounts and stores no password. The passphrase of an encrypted export is never stored. |
| `crypto_random` | MUST | Met | Salt and IV come from `crypto.getRandomValues`. |
| `delivery_mitm` | MUST | Met | HTTPS with HSTS preload for the hosted app. GitHub releases over HTTPS with Sigstore attestations. |
| `delivery_unsigned` | MUST | Met | `SHA256SUMS` is a subject of the build provenance attestation. The release notes give the commands that check the signature first. |
| `vulnerabilities_fixed_60_days` | MUST | Met | `npm audit` finds 0 vulnerabilities on 2026-10-30. No open advisory. |
| `vulnerabilities_critical_fixed` | SHOULD | Met | SECURITY.md sets a shorter time for an exploited vulnerability. |
| `no_leaked_credentials` | MUST | Met | CI runs gitleaks on the full history of every branch, including archives found by content. `R/blob/main/scripts/secret-scan.sh` |

### Analysis

| Criterion | Level | Answer | Justification and evidence |
|---|---|---|---|
| `static_analysis` | MUST | Met after step 3 | CodeQL on each push to `main`, each pull request and each week. ESLint with type-aware rules on each pull request. `R/actions/workflows/codeql.yml` |
| `static_analysis_common_vulnerabilities` | SUGGESTED | Met | CodeQL security queries for JavaScript and TypeScript. |
| `static_analysis_fixed` | MUST | Met after step 3 | No open alert. |
| `static_analysis_often` | SUGGESTED | Met | Each commit on `main` and each pull request. |
| `dynamic_analysis` | SUGGESTED | Met | fast-check property tests of the importer and the engine, and Playwright tests of the production build under the production CSP. |
| `dynamic_analysis_unsafe` | SUGGESTED | N/A | TypeScript only, a memory-safe language. |
| `dynamic_analysis_enable_assertions` | SUGGESTED | Unmet | The production code has no assertion mode for test runs. |
| `dynamic_analysis_fixed` | MUST | Met | No open finding. |

## 3. Summary

After steps 1 to 5, all MUST criteria are Met or N/A. 2 SUGGESTED criteria stay Unmet, `test_most` and `dynamic_analysis_enable_assertions`. They do not block the passing level. The user paragraph in the release notes is not required, but it makes `release_notes` safe from the "raw output of a version control log" rule.
