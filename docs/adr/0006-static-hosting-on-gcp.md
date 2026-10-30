# ADR-0006 Static hosting on GCP

| Item | Value |
|---|---|
| Status | Accepted |
| Date | 2026-10-27 |
| Deciders | PortaRegulus (product owner) |
| Changes | Names the host of ADR-0004 decision 2(a). Adds one header exception to ADR-0004. Does not change ADR-0003 or ADR-0004 decision 1. |

## Context

The product owner asked to host the app and a database in GCP. A server database conflicts with ADR-0003 (no sign-up) and ADR-0004 (data in the browser, CSP `connect-src 'none'`). The product owner then chose browser-only data, with GCP as the host of the static files, in a new project `pr-risk-prod`.

## Decision

1. **No database.** GCP serves the static bundle only. Register data stays in IndexedDB (ADR-0004 decision 1).
2. **Host.** A private Cloud Storage bucket in `europe-west1`, behind a global external Application Load Balancer with Cloud CDN, a Google-managed certificate and an SSL policy with TLS 1.2 or higher. The backend bucket adds the headers of `deploy/headers.json`. Terraform in `infra/gcp/` is the definition.
3. **Separate project.** `pr-risk-prod` has its own IAM, billing and budget alert. It shares nothing with CVD Portal.
4. **Private bucket.** Only the load balancer service account can read it. A public bucket would serve the app on `storage.googleapis.com`, an origin shared with every public bucket, without our headers (ADR-0004 decision 3).
5. **No request logs.** A log exclusion drops load balancer request logs. PortaRegulus keeps no visitor IP addresses (ADR-0004 assumption 1).
6. **Deploys from release tags only.** GitHub Actions gets a short-lived token through Workload Identity Federation. The provider accepts only the `production` environment of a `v*` tag in `porta-regulus/pr-risk`. The deployer account can write objects in one bucket and clear the CDN cache. Nothing else.
7. **Same files everywhere.** The deploy uploads the attested bundle. A check after the deploy compares the SHA-256 of every live file with the bundle.

## Options considered

| Option | Result | Evidence |
|---|---|---|
| Cloud Run with domain mapping | Rejected | Google says domain mappings "are not production-ready and are not supported at General Availability" because of latency, and TLS 1.0 and 1.1 cannot be disabled. [Cloud Run docs, mapping custom domains](https://docs.cloud.google.com/run/docs/mapping-custom-domains) |
| Firebase Hosting | Rejected | Free and simple, but the same page says it "is not covered by Google Cloud Terms of Service". The global CDN has no EU region setting. |
| Load balancer, Cloud CDN, private bucket | **Chosen** | The option Google recommends for production. Custom response headers per backend bucket. TLS policy control. Private bucket access is documented. [Cloud CDN with a backend bucket](https://docs.cloud.google.com/cdn/docs/setting-up-cdn-with-bucket) |
| Server database (Firestore or Cloud SQL) | Rejected by the product owner | Needs sign-in, a DPA, a new threat model and a new CRA check (ADR-0004 review trigger 1). One breach would expose the weak points of every user. |

## Consequences

1. **Cost.** About EUR 20 per month at low traffic, mostly the forwarding rules. The earlier estimate of EUR 0 was wrong, because it assumed Cloud Run domain mapping or Firebase Hosting.
2. **A service worker exception in the CSP.** A service worker uses the CSP of its own script response. With `connect-src 'none'` it cannot fetch the files that it must cache, and the app does not work offline. Build task 1 found this with `e2e/offline.spec.ts`. `/sw.js` therefore has `connect-src 'self'`. Pages keep `connect-src 'none'`. ADR-0004 records the exception. The backend bucket for `/sw.js` is a second backend bucket on the same storage bucket.
3. **US provider.** Google is a US company. The bucket is in the EU, but CDN edges are global. The files are public code, so this matters only for the request metadata that the edges see. Users who do not accept this can self-host the same bundle (ADR-0004 decision 2b).
4. **DNS stays at Cloudflare, DNS only.** A proxied record would end TLS at Cloudflare and lets Cloudflare features add scripts to the page.
5. **Domain-restricted sharing.** The organization of the project allows IAM grants to its own customer ID only. The grant for Google's load balancer service agent needed a short project exception, removed right after the grant. `infra/gcp/README.md` gives the steps. A later rewrite of the bucket IAM policy may need them again.

## Review triggers

1. The product owner asks again for a server database, sync or accounts. Then ADR-0004 review trigger 1 applies.
2. Google moves Cloud Run domain mapping to General Availability, or the cost of the load balancer becomes a problem.
