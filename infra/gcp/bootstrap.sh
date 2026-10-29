#!/usr/bin/env bash
# One-time setup of the GCP project and the Terraform state bucket (ADR-0006).
# Run it as a person with rights to create projects and link billing.
#
#   gcloud auth login
#   BILLING_ACCOUNT=XXXXXX-XXXXXX-XXXXXX infra/gcp/bootstrap.sh
#
# Optional: PROJECT_ID (default pr-risk-prod), REGION (default europe-west1),
# ORG_ID or FOLDER_ID for the parent, BUDGET (default 50EUR, in the currency of
# the billing account).
set -euo pipefail

PROJECT_ID="${PROJECT_ID:-pr-risk-prod}"
REGION="${REGION:-europe-west1}"
BUDGET="${BUDGET:-50EUR}"
BILLING_ACCOUNT="${BILLING_ACCOUNT:?Set BILLING_ACCOUNT. See: gcloud billing accounts list}"

parent=()
if [[ -n "${FOLDER_ID:-}" ]]; then parent=(--folder="$FOLDER_ID"); fi
if [[ -n "${ORG_ID:-}" ]]; then parent=(--organization="$ORG_ID"); fi

if ! gcloud projects describe "$PROJECT_ID" >/dev/null 2>&1; then
  gcloud projects create "$PROJECT_ID" --name="PortaRegulus Risk" "${parent[@]}"
fi
gcloud billing projects link "$PROJECT_ID" --billing-account="$BILLING_ACCOUNT"

gcloud services enable --project="$PROJECT_ID" \
  billingbudgets.googleapis.com cloudresourcemanager.googleapis.com \
  compute.googleapis.com iam.googleapis.com iamcredentials.googleapis.com \
  logging.googleapis.com serviceusage.googleapis.com storage.googleapis.com sts.googleapis.com

state="gs://${PROJECT_ID}-tfstate"
if ! gcloud storage buckets describe "$state" >/dev/null 2>&1; then
  gcloud storage buckets create "$state" --project="$PROJECT_ID" --location="$REGION" \
    --uniform-bucket-level-access --public-access-prevention
fi
gcloud storage buckets update "$state" --versioning

# A free app must not run up a bill unseen. Alerts at 50, 90 and 100 percent.
gcloud billing budgets create --billing-project="$PROJECT_ID" --billing-account="$BILLING_ACCOUNT" \
  --display-name="pr-risk ${PROJECT_ID}" --budget-amount="$BUDGET" \
  --filter-projects="projects/${PROJECT_ID}" \
  --threshold-rule=percent=0.5 --threshold-rule=percent=0.9 --threshold-rule=percent=1.0

echo "Next: terraform -chdir=infra/gcp init -backend-config=bucket=${PROJECT_ID}-tfstate"
