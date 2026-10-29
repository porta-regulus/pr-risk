# Static hosting of pr-risk on GCP (ADR-0006).
# Private EU bucket -> backend bucket with Cloud CDN and the ADR-0004 headers ->
# global external Application Load Balancer with a Google-managed certificate.
# No database and no compute. The app keeps all user data in the browser.

locals {
  header_config   = jsondecode(file("${path.module}/../../deploy/headers.json"))
  default_headers = local.header_config["default"]
  # One backend bucket per path that needs other headers (today only /sw.js).
  path_headers = { for p, h in local.header_config["paths"] : p => merge(local.default_headers, h) }
}

data "google_project" "this" {
  project_id = var.project_id
}

resource "google_project_service" "apis" {
  for_each = toset([
    "compute.googleapis.com",
    "iam.googleapis.com",
    "iamcredentials.googleapis.com",
    "logging.googleapis.com",
    "storage.googleapis.com",
    "sts.googleapis.com",
  ])
  service            = each.value
  disable_on_destroy = false
}

# ---------------------------------------------------------------- bucket

resource "google_storage_bucket" "site" {
  name                        = "${var.project_id}-site"
  location                    = upper(var.region)
  storage_class               = "STANDARD"
  uniform_bucket_level_access = true
  # Never public. A public bucket serves the app on storage.googleapis.com,
  # an origin shared with every other public bucket (ADR-0004 decision 3).
  public_access_prevention = "enforced"

  # Without a main page, "/" returns the XML object listing (found live on 2026-10-28).
  website {
    main_page_suffix = "index.html"
  }

  versioning {
    enabled = true
  }

  lifecycle_rule {
    condition {
      num_newer_versions = 10
      with_state         = "ARCHIVED"
    }
    action {
      type = "Delete"
    }
  }

  depends_on = [google_project_service.apis]
}

# ---------------------------------------------------------------- backends

resource "google_compute_backend_bucket" "site" {
  name                    = "pr-risk-site"
  description             = "pr-risk static bundle with the ADR-0004 headers"
  bucket_name             = google_storage_bucket.site.name
  enable_cdn              = true
  compression_mode        = "AUTOMATIC"
  custom_response_headers = [for name, value in local.default_headers : "${name}: ${value}"]

  # FORCE_CACHE_ALL is required for a private bucket. Each deploy invalidates the cache.
  # The API ignores max_ttl in this mode, so it is not set.
  cdn_policy {
    cache_mode         = "FORCE_CACHE_ALL"
    default_ttl        = 3600
    client_ttl         = 300
    request_coalescing = true
  }
}

resource "google_compute_backend_bucket" "path" {
  for_each = local.path_headers

  name                    = "pr-risk-path-${substr(sha256(each.key), 0, 8)}"
  description             = "Headers for ${each.key}"
  bucket_name             = google_storage_bucket.site.name
  enable_cdn              = true
  compression_mode        = "AUTOMATIC"
  custom_response_headers = [for name, value in each.value : "${name}: ${value}"]

  cdn_policy {
    cache_mode         = "FORCE_CACHE_ALL"
    default_ttl        = 3600
    client_ttl         = 0
    request_coalescing = true
  }
}

# The load balancer reads the private bucket with this Google-managed account.
# It exists only after the first backend bucket of the project exists.
# legacyObjectReader can read objects but not list them. objectViewer, which the
# Cloud CDN guide names, can also list the bucket.
resource "google_storage_bucket_iam_member" "lb_read" {
  bucket = google_storage_bucket.site.name
  role   = "roles/storage.legacyObjectReader"
  member = "serviceAccount:service-${data.google_project.this.number}@https-lb.iam.gserviceaccount.com"

  depends_on = [google_compute_backend_bucket.site]
}

# ---------------------------------------------------------------- load balancer

resource "google_compute_global_address" "site" {
  name       = "pr-risk-ip"
  ip_version = "IPV4"

  depends_on = [google_project_service.apis]
}

resource "google_compute_managed_ssl_certificate" "site" {
  name = "pr-risk-cert"

  managed {
    domains = [var.domain]
  }
}

resource "google_compute_ssl_policy" "modern" {
  name            = "pr-risk-tls"
  profile         = "MODERN"
  min_tls_version = "TLS_1_2"
}

resource "google_compute_url_map" "https" {
  name            = "pr-risk-https"
  default_service = google_compute_backend_bucket.site.id

  host_rule {
    hosts        = [var.domain]
    path_matcher = "app"
  }

  path_matcher {
    name            = "app"
    default_service = google_compute_backend_bucket.site.id

    dynamic "path_rule" {
      for_each = google_compute_backend_bucket.path
      content {
        paths   = [path_rule.key]
        service = path_rule.value.id
      }
    }
  }
}

resource "google_compute_target_https_proxy" "site" {
  name             = "pr-risk-https"
  url_map          = google_compute_url_map.https.id
  ssl_certificates = [google_compute_managed_ssl_certificate.site.id]
  ssl_policy       = google_compute_ssl_policy.modern.id
}

resource "google_compute_global_forwarding_rule" "https" {
  name                  = "pr-risk-https"
  target                = google_compute_target_https_proxy.site.id
  ip_address            = google_compute_global_address.site.id
  port_range            = "443"
  load_balancing_scheme = "EXTERNAL_MANAGED"
}

resource "google_compute_url_map" "http_redirect" {
  name = "pr-risk-http-redirect"

  default_url_redirect {
    https_redirect         = true
    redirect_response_code = "MOVED_PERMANENTLY_DEFAULT"
    strip_query            = false
  }
}

resource "google_compute_target_http_proxy" "redirect" {
  name    = "pr-risk-http-redirect"
  url_map = google_compute_url_map.http_redirect.id
}

resource "google_compute_global_forwarding_rule" "http" {
  name                  = "pr-risk-http"
  target                = google_compute_target_http_proxy.redirect.id
  ip_address            = google_compute_global_address.site.id
  port_range            = "80"
  load_balancing_scheme = "EXTERNAL_MANAGED"
}

# ADR-0004 assumption 1. Keep no visitor IP addresses in request logs.
resource "google_logging_project_exclusion" "lb_requests" {
  name        = "pr-risk-no-request-logs"
  description = "Do not store load balancer request logs (ADR-0004 assumption 1, ADR-0006)."
  filter      = "resource.type=\"http_load_balancer\""

  depends_on = [google_project_service.apis]
}

# ---------------------------------------------------------------- release deploys

resource "google_iam_workload_identity_pool" "github" {
  workload_identity_pool_id = "github"
  display_name              = "GitHub Actions"

  depends_on = [google_project_service.apis]
}

# Only the production environment of a v* tag in our repository gets a token.
resource "google_iam_workload_identity_pool_provider" "github" {
  workload_identity_pool_id          = google_iam_workload_identity_pool.github.workload_identity_pool_id
  workload_identity_pool_provider_id = "pr-risk-release"
  display_name                       = "pr-risk release tags"

  attribute_mapping = {
    "google.subject"       = "assertion.sub"
    "attribute.repository" = "assertion.repository"
    "attribute.ref"        = "assertion.ref"
  }

  attribute_condition = join(" && ", [
    "assertion.repository_owner_id == '${var.github_owner_id}'",
    "assertion.repository == '${var.github_repository}'",
    "assertion.environment == 'production'",
    "assertion.ref.startsWith('refs/tags/v')",
  ])

  oidc {
    issuer_uri = "https://token.actions.githubusercontent.com"
  }
}

resource "google_service_account" "deployer" {
  account_id   = "pr-risk-deployer"
  display_name = "pr-risk release deployer"
}

resource "google_service_account_iam_member" "deployer_wif" {
  service_account_id = google_service_account.deployer.name
  role               = "roles/iam.workloadIdentityUser"
  member             = "principalSet://iam.googleapis.com/${google_iam_workload_identity_pool.github.name}/attribute.repository/${var.github_repository}"
}

resource "google_storage_bucket_iam_member" "deployer_write" {
  bucket = google_storage_bucket.site.name
  role   = "roles/storage.objectUser"
  member = google_service_account.deployer.member
}

resource "google_project_iam_custom_role" "cdn_invalidator" {
  role_id     = "prRiskCdnInvalidator"
  title       = "pr-risk CDN invalidator"
  description = "Clear the Cloud CDN cache after a deploy. Nothing else."
  permissions = [
    "compute.globalOperations.get",
    "compute.urlMaps.get",
    "compute.urlMaps.invalidateCache",
  ]
}

resource "google_project_iam_member" "deployer_invalidate" {
  project = var.project_id
  role    = google_project_iam_custom_role.cdn_invalidator.id
  member  = google_service_account.deployer.member
}
