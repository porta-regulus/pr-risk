# CRA Annex I self-check of PortaRegulus Risk, release 1

| Item | Value |
|---|---|
| Status | Draft. The product owner reviews, signs and publishes it (HANDOFF.md task 12, D6). |
| Date | 2026-10-30 |
| Checked version | `main` at commit a02d31b with the fixes of gaps F1 to F4 and F7, package version `0.1.0-rc.1` |
| Legal source | Regulation (EU) 2024/2847 (CRA), Annex I, https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX:32024R2847 |
| Not legal advice | Have counsel confirm before you publish it. |

## 1. What this document is

1. This is a voluntary self-check (SPEC.md Sec. 11 item 8). ADR-0003 finds that PortaRegulus does not place the app on the market, so Annex I does not apply as a legal duty. PortaRegulus applies the steward measures of Art. 24 on a voluntary basis.
2. This document does not claim conformity. There is no EU declaration of conformity and no CE marking. It uses no harmonised standard, so it claims no presumption of conformity under Art. 27.
3. The cybersecurity risk assessment of Art. 13(2) is the STRIDE threat model in ADR-0004. Each row below names the threat IDs of that model.
4. The check covers the hosted build on `https://risk.portaregulus.com` and the release bundle. Both are the same files (ADR-0004 decision 2).

Ratings.

| Rating | Meaning |
|---|---|
| Met | The evidence exists in the repository and a test or a CI job checks it. |
| Partial | Some of the requirement is met. The gap is in section 4. |
| Not applicable | The requirement does not apply to a static app with no account and no server. The reason is in the row. |
| Open | The control exists, but it works only after the repository is public or after the first release. |

## 2. Part I. Properties of the product

| Point | Requirement (quoted from Annex I) | Rating | Evidence | Gap |
|---|---|---|---|---|
| 1 | "an appropriate level of cybersecurity based on the risks" | Met | ADR-0004 lists 5 assets, 4 trust boundaries and 18 threats, each with a mitigation and a verification. | |
| 2(a) | "without known exploitable vulnerabilities" | Open | `npm audit` finds 0 vulnerabilities in all dependencies on 2026-10-30. The Scorecard check Vulnerabilities compares the dependencies with OSV on each push. Dependabot opens version updates. CodeQL runs on every push and pull request when the repository is public. | F8, F10 |
| 2(b) | "secure by default configuration" and "the possibility to reset the product to its original state" | Met | The strict headers of ADR-0004 apply to every response (`deploy/headers.json`, `test/headers.test.ts`, `e2e/headers.spec.ts`). The app has no setting that weakens them. "Remove all data from this browser" puts the app back in its first state (ADR-0004 I5, `e2e/start.spec.ts`). | |
| 2(c) | "vulnerabilities can be addressed through security updates", with automatic updates as the default, an opt-out, a notice of updates and a postpone option | Partial | The hosted build updates itself. The browser checks the service worker on each start, and a new version activates on the next start (ADR-0004 T3). The start screen shows the version and the build hash. A self-hosted copy changes only when its operator installs a new bundle. | F5 |
| 2(d) | "protection from unauthorised access by appropriate control mechanisms" and "report on possible unauthorised access" | Not applicable | The app has no account, no server and no shared data. The data stays in the browser profile of one user on one device. The operating system account and the browser profile control access. The app cannot see an access from outside its own page, so it cannot report one. ADR-0004 I1 and I5 cover the two local threats. S1 tells users to use a browser profile with no extensions for a sensitive register. | |
| 2(e) | "protect the confidentiality of stored, transmitted or otherwise processed data" | Partial | The app sends no data. CSP `connect-src 'none'` blocks every request from the page (ADR-0004 I3). The optional encrypted export uses AES-256-GCM with a PBKDF2-HMAC-SHA-256 key, 600 000 iterations (ADR-0004 I2, `test/export.test.ts`). The hosted origin uses TLS 1.2 or higher and HSTS. The app does not encrypt IndexedDB in release 1 (ADR-0004 decision 5). S1 says so and tells users to turn on disk encryption. Encrypted storage is planned for release 2. | |
| 2(f) | "protect the integrity of stored, transmitted or otherwise processed data" and "report on corruptions" | Met | Every import passes the schema validator before a merge, and a key that names an `Object.prototype` property is refused (ADR-0004 E2). Every save is validated. Every stored record is checked again when a screen reads it. A damaged record shows the rule that it breaks, is not opened or exported, and S1 offers the last valid kept version (`storedProblem` and `restoreLastValid` in `src/storage/db.ts`, `e2e/start.spec.ts`). Release files have SHA-256 values and Sigstore attestations. The deploy job checks that the live files equal the attested files. An encrypted file with a wrong passphrase or a changed byte fails the GCM tag check. | |
| 2(g) | "process only data ... that are adequate, relevant and limited to what is necessary" | Met | PortaRegulus processes no register data. The app has no telemetry and no account (ADR-0003 C1 and C2). `infra/gcp/main.tf` excludes the request logs of the load balancer. The user decides what to type in the free-text author field of the change log. | |
| 2(h) | "protect the availability of essential and basic functions, also after an incident" | Partial | The app works offline from the service worker cache (`e2e/offline.spec.ts`). Import limits stop large or crafted files (ADR-0004 D1). Simulation limits and a Cancel button stop long runs (D2). The export reminder and the persistent storage request reduce data loss when the browser evicts storage (D3). The manual test of D3 in Safari is not done. | F9 |
| 2(i) | "minimise the negative impact ... on the availability of services provided by other devices or networks" | Met | The app makes no network request after it loads. ESLint forbids the network APIs and a Playwright test counts zero requests. | |
| 2(j) | "limit attack surfaces, including external interfaces" | Met | No server code, no API, no account. 3 runtime dependencies (`ajv`, `preact`, `xlsx`), each with a reason in `DEPENDENCIES.md`. Files are the only input. Permissions-Policy turns off camera, microphone, geolocation, USB, payment and clipboard read. `docs/self-host.md` gives the same headers for a self-hosted copy. | |
| 2(k) | "reduce the impact of an incident using appropriate exploitation mitigation mechanisms" | Met | CSP with `script-src 'self'`, Trusted Types, no `eval` and no `new Function` (ESLint rules), `frame-ancestors 'none'`, COOP and CORP `same-origin`. Import parsing and the simulation run in Web Workers that the app can stop. `docs/self-host.md` gives the same headers for nginx, Apache httpd and Caddy, and `test/self-host.test.ts` keeps them equal to `deploy/headers.json`. | |
| 2(l) | "recording and monitoring relevant internal activity, including the access to or modification of data", with an opt-out | Partial | The change log in the document records each change with time, field path, old value, new value and author (ADR-0004 R1). The app does not record read access, and the change log has no opt-out. | F6 |
| 2(m) | "securely and easily remove on a permanent basis all data and settings" and secure transfer | Met | "Remove all data from this browser" needs the typed word REMOVE. It deletes IndexedDB, caches, the service worker and local storage, and `e2e/start.spec.ts` checks each one. Data moves only as files, and the encrypted export protects them. | |

## 3. Part II. Vulnerability handling

| Point | Requirement (quoted from Annex I) | Rating | Evidence | Gap |
|---|---|---|---|---|
| 1 | "identify and document vulnerabilities and components", with a software bill of materials | Open | `release.yml` makes a CycloneDX 1.6 SBOM of the runtime dependencies for each release and attests it. `DEPENDENCIES.md` lists each dependency with its reason. No release exists yet. | F10 |
| 2 | "address and remediate vulnerabilities without delay", with security updates separate from functionality updates where feasible | Partial | `SECURITY.md` sets 90 days or less for a fix, shorter for an exploited vulnerability. Dependabot version updates are on. `SECURITY.md` says that a security fix comes as its own patch release when this is technically possible. | F8 |
| 3 | "effective and regular tests and reviews of the security" | Partial | CI runs on each pull request and each push to `main`. It runs unit tests, Playwright under the production CSP, header tests, Trusted Types tests, fast-check property tests of import and engine, and a gitleaks scan of the full history. Scorecard runs on each push and each week. Each pull request gets an automatic code review. AT-6 adds a review by a CISO and an auditor. CodeQL runs only when the repository is public. | F8 |
| 4 | "share and publicly disclose information about fixed vulnerabilities" | Met | `SECURITY.md` says that PortaRegulus publishes a GitHub security advisory and requests a CVE when the fix is released, and names the reporter. Not used yet, because no vulnerability is known. | |
| 5 | "put in place and enforce a policy on coordinated vulnerability disclosure" | Met | `SECURITY.md` has the scope, the report channel, the time limits, the advisory step and a safe harbour. | |
| 6 | "facilitate the sharing of information about potential vulnerabilities", including "a contact address" | Partial | `SECURITY.md` gives GitHub private vulnerability reporting and `security@portaregulus.com`. Private vulnerability reporting works only on a public repository. `SECURITY.md` says that PortaRegulus reports a vulnerability in a third-party component to its maintainers. | F8, F11 |
| 7 | "mechanisms to securely distribute updates" | Met | HTTPS with TLS 1.2 or higher and a managed certificate. HSTS with preload. The service worker caches hashed file names only. Each release has SHA-256 values, Sigstore bundles and build provenance that `gh attestation verify` checks. The deploy job compares the live files with the attested files. | |
| 8 | security updates "disseminated without delay", "free of charge", with "advisory messages" | Met | The app and its updates are free for all (ADR-0003 C4). The hosted build gets a fix on the next start. The advisory and the release notes tell users what to do. The app cannot show a security notice, because it makes no network request. `SECURITY.md` and `docs/self-host.md` tell users to watch the releases. | |

## 4. Gaps

| ID | Gap | Point | Action | Owner | Status |
|---|---|---|---|---|---|
| F1 | ADR-0004 decision 5 says that the app tells the user that it does not encrypt IndexedDB and relies on disk encryption of the operating system. No screen says this. | I 2(e) | S1 says it next to the storage status (`src/ui/start.tsx`, `e2e/start.spec.ts`). | Build session | Closed 2026-10-30 |
| F2 | ADR-0004 I1 says that the help tells users to use a browser profile with no extensions for sensitive registers. No screen says this. | I 2(d), 2(e) | S1 says it next to the storage status (`src/ui/start.tsx`, `e2e/start.spec.ts`). | Build session | Closed 2026-10-30 |
| F3 | ADR-0004 says that a self-host guide gives the header lines for nginx, Apache httpd and Caddy. The guide does not exist. Without it, a self-hosted copy has no `frame-ancestors` (ADR-0004 E3). | I 2(j), 2(k) | `docs/self-host.md` has the examples. `test/self-host.test.ts` keeps them equal to `deploy/headers.json`. The Apache httpd and Caddy examples were also checked on a live server. The nginx example was not. | Build session | Closed 2026-10-30 |
| F4 | The app validates a document when it saves it, but not when it opens it. A changed or damaged record in IndexedDB shows without a warning. | I 2(f) | Each read checks the record. S1 and the editor screens show the rule, open and export nothing, and S1 offers the last valid version (`test/browser/storage.test.ts`, `e2e/start.spec.ts`). | Build session | Closed 2026-10-30 |
| F5 | The hosted build updates itself with no opt-out and no postpone. The app shows no notice of a new version. | I 2(c), II 8 | Decide if self-hosting is the documented opt-out. `SECURITY.md` and `docs/self-host.md` now say how users learn about a fix. An in-app notice can come from the service worker, because it needs no new request. | Product owner | Open |
| F6 | The change log records changes, not read access, and it has no opt-out. | I 2(l) | Decide. Recording read access adds personal data about the user, against 2(g). An opt-out would weaken R1 of ADR-0004. A reasoned "not applicable" for read access may be the better answer. | Product owner | Open |
| F7 | `SECURITY.md` does not say that a security fix comes as its own release, or what happens to a report about a third-party component. | II 2, II 6 | `SECURITY.md` has both statements, and says how users learn about a fix. | Build session | Closed 2026-10-30 |
| F8 | While the repository is private, CodeQL does not run, and private vulnerability reporting, secret scanning and Dependabot alerts are off. | I 2(a), II 2, II 3, II 6 | Turn them on when the repository becomes public (HANDOFF.md task 12, plan step 3). | Product owner | Open |
| F9 | The manual test of ADR-0004 D3 in Safari is not done. | I 2(h) | Do the test in task 9 and write the result in HANDOFF.md. | Product owner | Open |
| F10 | No release exists, so no SBOM, attestation or release note exists yet. | I 2(a), II 1 | Check the files of the test tag `v0.1.0-rc.1` (D3). | Product owner | Open |
| F11 | This check assumes that the mailbox `security@portaregulus.com` exists and that a person reads it. | II 6 | Confirm the mailbox and who reads it. | Product owner | Open |

## 5. Sign-off

| Item | Value |
|---|---|
| Reviewed by | |
| Role | |
| Date | |
| Published at | |
| Gaps closed before release | |
| Gaps accepted for release 1, with reason | |
