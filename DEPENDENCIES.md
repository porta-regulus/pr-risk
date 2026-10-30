# Dependencies

Every dependency needs a row here before it enters `package.json` (HANDOFF.md rule 5). Versions are exact. `npm ci --ignore-scripts` installs them, so no install script of a dependency runs.

## In the bundle

These are the only packages that reach the user's browser.

| Package | Version | Licence | Why | Network code |
|---|---|---|---|---|
| preact | 11.1.0 | MIT | UI rendering. Chosen over React by bundle size (build task 1). The empty app is 5.1 kB gzip in total. React and React DOM alone are about 45 kB gzip. | None |
| xlsx (SheetJS Community Edition) | 0.20.3 | Apache-2.0 | XLSX import, in the import worker only. Installed from https://cdn.sheetjs.com/xlsx-0.20.3/xlsx-0.20.3.tgz, pinned by the sha512 in `package-lock.json`. Not the npm `xlsx@0.18.5`, which has CVE-2023-30533 and CVE-2024-22363. The ZIP directory is checked before SheetJS reads a file. | None |
| ajv | 8.20.0 | MIT | Only two small runtime helpers (`ajv/dist/runtime/ucs2length`, `ajv/dist/runtime/equal`) reach the bundle. They are imported by the standalone validators that `scripts/gen-schema.mjs` generates at build time. The app never compiles a schema at run time (ADR-0004 E1). The generated validators are 47 kB gzip. | None |

## Build and test only

| Package | Version | Licence | Why |
|---|---|---|---|
| vite | 8.3.5 | MIT | Build and preview server |
| typescript | 6.0.3 | Apache-2.0 | Type check. Not 7.x, because typescript-eslint 8.72 supports TypeScript below 6.1 only. |
| vitest | 5.0.5 | MIT | Unit tests |
| fast-check | 4.10.2 | MIT | Property tests (SPEC.md Sec. 12.3) |
| @playwright/test | 1.64.1 | Apache-2.0 | Browser tests, header test, offline test |
| eslint | 10.13.0 | MIT | Lint, including the no-eval, no-HTML and no-network rules |
| @eslint/js | 10.0.1 | MIT | ESLint base rules |
| typescript-eslint | 8.72.1 | MIT | Type-aware lint rules |
| globals | 17.13.0 | MIT | Global names for ESLint (browser, service worker, Node) |
| @types/node | 24.19.2 | MIT | Node types for build scripts and tests |
| @vitest/browser-playwright | 5.0.5 | MIT | Runs `test/browser/` in Chromium, so the engine is checked in a real Web Worker (build task 3, done criterion 5) |
| json-schema-to-typescript | 16.0.0 | MIT | TypeScript types from the exchange schema (`npm run gen:schema`). It reads the vendored NIST schemas, never the network. |
| @axe-core/playwright | 4.14.0 | MPL-2.0 | WCAG 2.2 level A and AA check in the Playwright tests (build task 5, done criterion 3, `e2e/axe.ts`). It pulls `axe-core` 4.14.0 (MPL-2.0). Test only, never in the bundle. |
| @cyclonedx/cyclonedx-npm | 6.0.1 | Apache-2.0 | CycloneDX 1.6 SBOM on release. It pulls `libxmljs2` and `node-gyp` for XML output. We write JSON only, and `--ignore-scripts` means the native part is never built. |

## CI tools that are not npm packages

| Tool | Version | Licence | Why | Pin |
|---|---|---|---|---|
| oscal-cli (metaschema-framework) | 3.2.0 | CC0-1.0 | Validates the OSCAL POA&M exports (AT-4) | SHA-256 e001b353ee245da6f4ff0ad930c4dfaa88083c63243ca004bd5f5bcef44e8ec8 of the Maven Central zip |
| gitleaks | 8.30.1 | MIT | Scans every commit of every branch for secrets (`scripts/secret-scan.sh`). The script also finds archives by content, such as a saved Terraform plan without an extension. Offline, it sends nothing. | SHA-256 551f6fc83ea457d62a0d98237cbad105af8d557003051f41f3e7ca7b3f2470eb of the GitHub release tarball `gitleaks_8.30.1_linux_x64.tar.gz` |
| OSCAL POA&M JSON schema | 1.2.3 | Public domain (NIST) | Test-time schema check of the exports | SHA-256 f4fd94487408a9589954b5b92d88965c984d4f79b85365cc574b860898759437, in `test/fixtures/oscal/` |

## Docs checks (Python, CI only)

`tools/requirements-docs.txt` pins `jsonschema`, `referencing` and `numpy` and their dependencies with SHA-256 hashes for Python 3.12 on Linux x86_64. CI installs them with `--require-hashes`.

## Maintainer tools (not in CI)

| Tool | Version | Licence | Why |
|---|---|---|---|
| openpyxl | 3.1.5 | MIT | `tools/risklet_catalogue.py` reads `Risklet Risks.xlsx` of the product owner and writes `src/catalogue/risklet.json`. Run by hand when the catalogue changes. |

## Planned

None.
