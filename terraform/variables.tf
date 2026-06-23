variable "tf_cloud_organization" {
  description = "Terraform Cloud organization name"
  type        = string
  sensitive   = true
}

variable "tf_cloud_workspace" {
  description = "Terraform Cloud workspace name"
  type        = string
  default     = "cloudshop"
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
  description = "Domain for Cloudshop"
  type        = string
  default     = "cloudshop.example.com"
}

variable "environment" {
  description = "Deployment environment"
  type        = string
  default     = "production"
  validation {
    condition     = contains(["development", "production"], var.environment)
    error_message = "Environment must be either 'development' or 'production'."
  }
}

variable "stripe_webhook_secret" {
  description = "Stripe webhook secret"
  type        = string
  sensitive   = true
  default     = ""
}

variable "printful_api_key" {
  description = "Printful API Key"
  type        = string
  sensitive   = true
  default     = ""
}

variable "mailchannels_api_key" {
  description = "Mailchannels API Key"
  type        = string
  sensitive   = true
  default     = ""
}
