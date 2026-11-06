# ADR-0004 Local-first data location and STRIDE threat model of the app

| Item | Value |
|---|---|
| Status | Accepted |
| Date | 2026-10-27 |
| Scope | The app itself, release 1 |
| Changed | 2026-11-06 by the product owner. T3 also lets the user activate a new version at once ("Use the new version now" on S1). A browser that kept one tab open, or only reloaded, stayed on the old version. |

## Decision

1. **Data stays on the user's device.** Release 1 has no backend, no account and no sync. The browser stores the working copy in IndexedDB. The user moves data only through files (import and export).
2. **Two ways to run.** (a) The hosted static build on a dedicated origin, `risk.portaregulus.com`, served from GCP (ADR-0006). (b) The same static bundle, self-hosted by the user on an intranet web server. Both are the same files with the same hashes.
3. **Dedicated origin.** The app does not share an origin with www.portaregulus.com or any page that loads marketing, analytics or tag-manager scripts. Browser storage is per origin. Any script on the same origin can read IndexedDB. A marketing script on the app origin would be able to read every register.
4. **The app makes no network requests at run time.** Content-Security-Policy sets `connect-src 'none'`. All code, fonts and data are in the bundle. A compromised dependency cannot send data out through fetch, XHR, WebSocket or a beacon.
5. **Encryption.** Release 1 offers an optional passphrase-encrypted export file. IndexedDB is not encrypted by the app in release 1. It relies on operating system disk encryption, and the app tells the user so. Encrypted local storage is release 2.

## Why local-first

| Reason | Evidence |
|---|---|
| A risk register is a map for an attacker. It lists unpatched systems, weak suppliers and accepted risks. | SP 800-221r1 lines 885 to 898 list what an RDR holds, for example "underlying vulnerabilities" and "assets threatened". |
| No server means no personal data processing by PortaRegulus. | Keeps condition C2 of ADR-0003 true. No GDPR controller role for register content. |
| No server means no service to operate, patch or report on. | A two-person team can maintain a static bundle. |
| The decision is made once a year by one team. | ADR-0001. Real-time collaboration is not needed for release 1. |

## Costs of this decision, stated plainly

1. **Data loss.** Browsers can evict IndexedDB. WebKit deletes all script-writable storage of a website after 7 days of browser use without a visit, unless the site is installed as a home-screen web app (WebKit "Full Third-Party Cookie Blocking and More", March 2020). Mitigation in SPEC.md Sec. 10 item 3. The app requests `navigator.storage.persist()`, shows the date of the last export, and shows a banner when the last export is older than 7 days.
2. **No shared editing.** Two people cannot edit one register at the same time. They exchange files. The import step shows a diff before it merges (SPEC.md Sec. 9.7).
3. **No server-side audit trail.** The change log lives inside the file. A user who controls the file can change the log. The change log helps against mistakes, not against a dishonest user.

## STRIDE threat model of the app

Assets. A1 the register data in IndexedDB. A2 export files. A3 the build artifacts and their supply chain. A4 the hosted origin and its DNS and TLS. A5 the user's trust in the numbers.

Trust boundaries. B1 the browser sandbox of the app origin. B2 files that enter from outside (imports). B3 the build pipeline from source to hosted files. B4 the network between the user and the hosting provider.

| ID | STRIDE | Threat | Asset | Mitigation in release 1 | Verification |
|---|---|---|---|---|---|
| S1 | Spoofing | A look-alike domain serves a modified copy that collects registers. | A1, A5 | Publish the canonical URL and SHA-256 hashes of every release file. Sign releases (Sigstore). Self-host option for cautious users. The app shows its build hash in the About box. | Release checklist. Hash shown equals the hash in the signed release. |
| S2 | Spoofing | An import file claims to come from CVD Portal or NIST but was crafted by an attacker. | A1, A5 | The import preview shows source, hash, record count and every defaulted field. The user confirms. Provenance is stored in the document. | Import tests with crafted files. |
| T1 | Tampering | A compromised npm dependency or build step injects code that reads or changes registers. | A1, A3 | Few runtime dependencies (SPEC.md Sec. 11 item 1). Lockfile with integrity hashes. `npm ci --ignore-scripts`. Pinned GitHub Actions by commit SHA. Build provenance attestation. CSP `connect-src 'none'` blocks exfiltration even if code is injected. | OpenSSF Scorecard Pinned-Dependencies and Dangerous-Workflow checks. CSP test in CI. |
| T2 | Tampering | A third-party script on the same origin changes IndexedDB. | A1 | Dedicated origin. `script-src 'self'`. No third-party scripts. | CSP header test. Origin check in deployment test. |
| T3 | Tampering | A stale or poisoned service worker cache serves old code after a security fix. | A3, A5 | Service worker caches only hashed file names. The browser's own service worker update check runs on each start, so the app needs no request of its own. A new version activates on the next start, or at once when the user clicks "Use the new version now" on S1 and only one tab of the app is open. S1 holds no unsaved draft, and a second tab blocks the change, so the code never changes under open work. The app shows its version. | Update tests in Playwright (`e2e/update.spec.ts`). |
| T4 | Tampering | A CSV export opened in Excel runs a formula from a risk description (CSV injection). | A2 | Prefix cells that start with `=`, `+`, `-`, `@`, tab or carriage return with a single quote, per OWASP CSV Injection guidance. | Unit test with the six prefixes. |
| R1 | Repudiation | A user denies that they changed an estimate before the decision. | A5 | Append-only change log in the document with time, field path, old value, new value and a free-text author. No cryptographic guarantee in release 1. | Change log test. Documented limit. |
| I1 | Information disclosure | A browser extension with "read all sites" rights reads the register from the page. | A1 | Out of the app's control. The help page tells users to use a browser profile with no extensions for sensitive registers. | Help text review. |
| I2 | Information disclosure | Export files are mailed or left on shared drives. | A2 | Optional encrypted export. AES-256-GCM, key from PBKDF2-HMAC-SHA-256 with 600 000 iterations (OWASP Password Storage Cheat Sheet value for PBKDF2-HMAC-SHA256), 16-byte random salt, 12-byte random IV, all through WebCrypto. | Known-answer test. Wrong passphrase test. |
| I3 | Information disclosure | Telemetry, error reporting or font loading leaks data or usage. | A1 | None in the app. CSP `default-src 'none'` with explicit allow-list of `'self'` only. No external fonts. | CSP test. Network log in Playwright shows zero requests after load. |
| I4 | Information disclosure | The CVD Portal export contains exploit steps that then live in the register. | A1, A2 | The adapter drops `description`, `stepsToReproduce` and `impact`. It keeps id, product, type, severity, status and dates. | Adapter test asserts the dropped fields are absent. |
| I5 | Information disclosure | Data on a shared computer stays in the browser after use. | A1 | "Remove all data from this browser" button with confirmation. It deletes IndexedDB, caches and the service worker. | Playwright test. |
| D1 | Denial of service | A large or crafted import file (XLSX zip bomb, 1 GB CSV, deep JSON) freezes the tab. | A1 | Limits. File size up to 10 MB. Uncompressed XLSX up to 50 MB. Up to 5 000 rows. JSON depth up to 32. Parsing runs in a Web Worker that the app terminates after 20 s. | Fuzz tests with fast-check generators and known zip bomb samples. |
| D2 | Denial of service | A simulation with extreme inputs runs for minutes or exhausts memory. | A5 | Trials up to 1 000 000. Sampled rates clipped at 700 per year and counted. Upper bound of a frequency range up to 100 per year. Simulation in a Web Worker with a Cancel button. | Property tests at the limits. |
| D3 | Denial of service | The browser evicts IndexedDB. | A1 | Persistent storage request, export reminders (see Costs). | Manual test in Safari. |
| E1 | Elevation of privilege | Script injection through text in an imported file (risk description, owner name) rendered as HTML. | A1 | All user text is rendered as text, never as HTML. No Markdown rendering in release 1. Trusted Types policy `require-trusted-types-for 'script'`. No `eval` and no `new Function`. Schema validators are compiled at build time (Ajv standalone), because Ajv compiles with `new Function` at run time. | CSP test. XSS payload corpus in import tests. |
| E2 | Elevation of privilege | Prototype pollution through JSON keys such as `__proto__` in an import file. | A1 | Parse with `JSON.parse`, then validate against the schema with `additionalProperties` false before any merge. Before the schema check, reject every key that names an `Object.prototype` property, such as `__proto__` or `constructor`. Ajv records the properties that `unevaluatedProperties` has seen in a plain object, so these names read as seen and pass (found in build task 2). Use `Map` or `Object.create(null)` for user-keyed objects. XLSX parsing uses the SheetJS Community Edition from cdn.sheetjs.com, pinned by hash. Never the npm `xlsx@0.18.5` package, which has CVE-2023-30533 (prototype pollution) and CVE-2024-22363 (ReDoS). | Import tests with `__proto__` and `constructor` keys. |
| E3 | Elevation of privilege | Clickjacking of the "Remove all data" or "Import and replace" buttons. | A1 | `frame-ancestors 'none'` header on the hosted origin. Self-hosted users must set it in their web server. A meta tag cannot set it. | Header test. Self-host guide. |

## Required HTTP headers on the hosted origin

```
Content-Security-Policy: default-src 'none'; script-src 'self'; style-src 'self'; img-src 'self' data: blob:; font-src 'self'; connect-src 'none'; worker-src 'self'; manifest-src 'self'; form-action 'none'; frame-ancestors 'none'; base-uri 'none'; object-src 'none'; require-trusted-types-for 'script'; trusted-types app-text
Cross-Origin-Opener-Policy: same-origin
Cross-Origin-Resource-Policy: same-origin
Referrer-Policy: no-referrer
Permissions-Policy: camera=(), microphone=(), geolocation=(), usb=(), payment=(), clipboard-read=()
X-Content-Type-Options: nosniff
Strict-Transport-Security: max-age=63072000; includeSubDomains; preload
```

The self-hosted bundle carries the same policy in a `<meta http-equiv>` tag, except `frame-ancestors`, which a meta tag cannot set. The self-host guide gives the header lines for nginx, Apache httpd and Caddy.

### Exception for the service worker script

`/sw.js` gets the same headers, with one change. Its CSP has `connect-src 'self'` in place of `connect-src 'none'`.

A service worker uses the CSP of its own script response. With `connect-src 'none'` it cannot fetch the files that it must cache, and the app does not work offline. Build task 1 found this with the Playwright test `e2e/offline.spec.ts`. The exception allows same-origin requests from the service worker only. Pages keep `connect-src 'none'`. The service worker is generated from `build/sw-template.js` and holds no third-party code. `deploy/headers.json` is the machine-readable copy of these headers, and a unit test keeps it equal to this section.

## Assumptions

1. The hosting provider serves static files only and keeps access logs for 30 days or less. The app sends no data, so logs hold only IP addresses and file paths.
2. Users run a current Chromium, Firefox or Safari release. Chromium supports Trusted Types. Support in Firefox and Safari is recent. The build session must check current support and keep the strict `script-src 'self'` as the main control where Trusted Types is absent.

## Review triggers

1. Any request for sync, sharing or multi-user editing. That needs a server, a new threat model and a new CRA check (ADR-0003 C2).
2. Any new dependency with network or file-parsing code.
