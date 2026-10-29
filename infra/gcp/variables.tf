variable "project_id" {
  description = "GCP project that hosts the static app. Created by bootstrap.sh."
  type        = string
  default     = "pr-risk-prod"
}

variable "region" {
  description = "EU region of the site bucket."
  type        = string
  default     = "europe-west1"
}

variable "domain" {
  description = "Dedicated origin of the app (ADR-0004 decision 3, SPEC.md Q2)."
  type        = string
  default     = "risk.portaregulus.com"
}

variable "github_repository" {
  description = "Only release tags of this repository can deploy."
  type        = string
  default     = "porta-regulus/pr-risk"
}

variable "github_owner_id" {
  description = "Numeric id of the GitHub organization. It does not change when the organization is renamed."
  type        = string
  default     = "307946060"
}
