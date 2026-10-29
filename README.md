# PortaRegulus Risk

A free, open-source risk register for the risk components of NIST SP 800-221r1. It helps the IT lead of a company with 50 to 249 staff decide which risk responses to fund, so that the annual loss exceedance curve stays below the risk tolerance curve.

**Status.** Build task 1 of 13. The app shell, supply chain and hosting are in place. The screens come next. See [docs/HANDOFF.md](docs/HANDOFF.md).

## Your data stays with you

1. The app stores all data in your browser (IndexedDB). There is no account and no server database.
2. The app makes no network request after it loads. The Content Security Policy blocks all requests from the page.
3. You move data only with files, through import and export.

## Run it

Hosted at https://risk.portaregulus.com (after the first release).

To run it from the source, use Node.js 22.12 or later.

```bash
npm ci --ignore-scripts
```

```bash
npm run build && npm run preview
```

To self-host, download a release bundle, check it, and serve the files from any web server with the headers in [deploy/headers.json](deploy/headers.json).

```bash
gh attestation verify pr-risk-v0.1.0.tar.gz --repo porta-regulus/pr-risk
```

## Documents

| Document | Content |
|---|---|
| [docs/SPEC.md](docs/SPEC.md) | Requirements for release 1 |
| [docs/adr/](docs/adr/) | Decisions |
| [docs/schema/](docs/schema/) | Exchange schema (JSON Schema 2020-12) and examples |
| [infra/gcp/](infra/gcp/) | Hosting on GCP |
| [SECURITY.md](SECURITY.md) | How to report a vulnerability |

## Licence

Apache-2.0. See [LICENSE](LICENSE) and [NOTICE](NOTICE).
