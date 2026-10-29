terraform {
  required_version = ">= 1.9"

  required_providers {
    google = {
      source  = "hashicorp/google"
      version = "~> 7.0"
    }
  }

  # terraform init -backend-config="bucket=<project id>-tfstate"
  backend "gcs" {
    prefix = "pr-risk"
  }
}

provider "google" {
  project = var.project_id
  region  = var.region
}
