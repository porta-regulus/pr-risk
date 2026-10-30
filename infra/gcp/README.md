# GCP hosting of pr-risk

Static hosting only (ADR-0006). There is no database and no compute. User data stays in the browser (ADR-0004).

```
risk.portaregulus.com (DNS only, not proxied)
  -> global external Application Load Balancer, TLS 1.2 or higher, managed certificate
  -> backend bucket with Cloud CDN and the headers of deploy/headers.json
  -> private Cloud Storage bucket in europe-west1
```

## First setup

The product owner does these steps once. Each step creates or changes a cloud resource, so a person does them, not CI.

1. Log in.

```bash
gcloud auth login
```

```bash
gcloud auth application-default login
```

2. Create the project, link billing, make the state bucket and a budget alert. Find the billing account with `gcloud billing accounts list`.

```bash
BILLING_ACCOUNT=XXXXXX-XXXXXX-XXXXXX infra/gcp/bootstrap.sh
```

3. Create the hosting resources.

```bash
terraform -chdir=infra/gcp init -backend-config=bucket=pr-risk-prod-tfstate
```

```bash
terraform -chdir=infra/gcp apply
```

4. In Cloudflare, add an A record `risk` with the `ip_address` output. Set the proxy status to **DNS only**. A proxied record breaks the design. Cloudflare would end TLS, and features such as Web Analytics, Rocket Loader and Email Obfuscation add scripts that the CSP blocks, or that run on the app origin if the CSP changes. Optional, add a CAA record `risk CAA 0 issue "pki.goog"`.

5. Wait until the certificate is `ACTIVE`. This takes 15 to 60 minutes after DNS resolves.

```bash
gcloud compute ssl-certificates describe pr-risk-cert --global --project=pr-risk-prod --format="value(managed.status)"
```

6. In GitHub, create the environment `production` with a required reviewer and a deployment tag rule `v*`. Copy the `github_variables` output into repository variables.

```bash
terraform -chdir=infra/gcp output -json github_variables
```

## Current state

| Item | Value |
|---|---|
| Project | `pr-risk-prod`, in the PortaRegulus Google Cloud organization |
| Created | 2026-10-27 with `bootstrap.sh` and `terraform apply` |
| Load balancer IP | `136.82.106.15` (also `terraform output ip_address`) |
| Budget alert | EUR 50 on the billing account of the bootstrap step |
| Domain | `risk.portaregulus.com`, A record DNS only, managed certificate `ACTIVE` |
| Main page | Not applied on 2026-10-30. `main.tf` sets `main_page_suffix`, but "/" still returns the XML object listing. Run `terraform apply` before the first tag, or the deploy check fails |
| GitHub | On 2026-10-30 the environment `production` and the repository variables do not exist. Do step 6 before the first tag |
| Plan files | Do not commit `terraform plan -out` files. `.gitignore` excludes them |

## Domain-restricted sharing

The organization policy `iam.allowedPolicyMemberDomains` allows IAM grants to the organization's own customer ID only. Google's load balancer service agent is outside that customer, so `terraform apply` fails on `google_storage_bucket_iam_member.lb_read` with "One or more users named in the policy do not belong to a permitted customer".

On 2026-10-27 we used the workaround that Google documents for the legacy constraint. Turn the rule off for this project, grant the role, and turn the rule on again. Do the same if a later change must rewrite the bucket IAM policy.

1. Give yourself `roles/orgpolicy.policyAdmin` on the organization. An organization admin can do this.
2. Set a project policy with `allowAll: true` for `iam.allowedPolicyMemberDomains` on `pr-risk-prod`.
3. Run `terraform apply`.
4. Delete the project policy. Add `--billing-project=<a project with the Org Policy API on>`, because `pr-risk-prod` does not enable that API.
5. Check that the effective policy is the organization's customer ID again, then remove `roles/orgpolicy.policyAdmin`.

## Deploys

A tag `v*` runs `.github/workflows/release.yml`. After the reviewer approves the `production` environment, the deploy job does these steps.

1. It gets a short-lived token through Workload Identity Federation. There is no service account key.
2. It uploads the attested files with `scripts/deploy-gcs.sh` and clears the CDN cache.
3. It checks that every live file has the same SHA-256 as the attested bundle, and that a direct read of the bucket is refused.
4. It runs `e2e/headers.spec.ts` against the live origin.

## Cost

Estimate for low traffic, list prices of October 2026. Check the GCP pricing calculator before you rely on it.

| Item | Cost per month |
|---|---|
| Forwarding rules (2, billed as one block of up to 5) | about EUR 17 |
| Cloud CDN egress, Europe, first 10 TB | about EUR 0.08 per GB |
| Cloud Storage, under 1 GB | under EUR 0.10 |
| Managed certificate, logging with request logs excluded | EUR 0 |

The bootstrap script sets a budget alert at EUR 50.

## Remove everything

```bash
terraform -chdir=infra/gcp destroy
```

The bucket has versioning. Terraform refuses to delete a bucket that holds objects. Empty it first if you really want to remove it.
