terraform {
  required_version = ">= 1.0"
  required_providers {
    cloudflare = {
      source  = "cloudflare/cloudflare"
      version = "~> 4.0"
    }
  }

  cloud {
    organization = var.tf_cloud_organization

    workspaces {
      name = "cloudshop"
    }
  }
}

provider "cloudflare" {
  api_token = var.cloudflare_api_token
}

variable "tf_cloud_organization" {
  description = "Terraform Cloud organization name"
  type        = string
  sensitive   = true
}

variable "cloudflare_api_token" {
  description = "Cloudflare API Token"
  type        = string
  sensitive   = true
}

variable "account_id" {
  description = "Cloudflare Account ID"
  type        = string
}

variable "domain" {
  description = "Your domain"
  type        = string
  default     = "cloudshop.example.com"
}

variable "environment" {
  description = "Environment (development, production)"
  type        = string
  default     = "production"
}
