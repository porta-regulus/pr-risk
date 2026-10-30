# PortaRegulus Risk

A free, open-source risk register for the risk components of NIST SP 800-221r1. It helps the IT lead of a company with 50 to 249 staff decide which risk responses to fund, so that the annual loss exceedance curve stays below the risk tolerance curve.

**Status.** All screens of release 1 work. Release 1 waits for the usability test, the expert review and the release checks (AT-5, AT-6 and AT-7). See [docs/HANDOFF.md](docs/HANDOFF.md).

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

## Report a problem or ask for a change

Open an issue at https://github.com/porta-regulus/pr-risk/issues. Do not attach a real risk register. Use the example files in [docs/schema/examples/](docs/schema/examples/).

For a security problem, do not open an issue. Follow [SECURITY.md](SECURITY.md).

To contribute code or text, read [CONTRIBUTING.md](CONTRIBUTING.md).

## Documents

| Document | Content |
|---|---|
| [docs/SPEC.md](docs/SPEC.md) | Requirements for release 1 |
| [docs/adr/](docs/adr/) | Decisions |
| [docs/schema/](docs/schema/) | Exchange schema (JSON Schema 2020-12) and examples |
| [infra/gcp/](infra/gcp/) | Hosting on GCP |
| [SECURITY.md](SECURITY.md) | How to report a vulnerability |
| [docs/release/](docs/release/) | CRA Annex I self-check and OpenSSF Best Practices answers (drafts) |

## Licence

Apache-2.0. See [LICENSE](LICENSE) and [NOTICE](NOTICE).
