output "ip_address" {
  description = "Set a DNS A record for the domain to this address, DNS only (not proxied)."
  value       = google_compute_global_address.site.address
}

output "github_variables" {
  description = "Repository variables for .github/workflows/release.yml."
  value = {
    GCP_WORKLOAD_IDENTITY_PROVIDER = google_iam_workload_identity_pool_provider.github.name
    GCP_DEPLOY_SERVICE_ACCOUNT     = google_service_account.deployer.email
    GCP_SITE_BUCKET                = google_storage_bucket.site.name
    GCP_URL_MAP                    = google_compute_url_map.https.name
    SITE_URL                       = "https://${var.domain}"
  }
}
