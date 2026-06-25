variable "site_name" {
  description = "Name of the Cloudshop instance"
  type        = string
  default     = "cloudshop"
}
variable "site_url" {
  description = "URL of the Cloudshop instance"
  type        = string
  default     = "https://cloudshop.pages.dev"
}

# variable "tf_cloud_organization" {
#   description = "Terraform Cloud organization name"
#   type        = string
#   sensitive   = true
# }

# variable "tf_cloud_workspace" {
#   description = "Terraform Cloud workspace name"
#   type        = string
#   default     = "cloudshop"
# }
variable "cloudflare_api_token" {
  description = "Cloudflare API Token"
  type        = string
  sensitive   = true
}

variable "account_id" {
  description = "Cloudflare Account ID"
  type        = string
}

variable "worker_url" {
  description = "Domain for Cloudshop"
  type        = string
  default     = "https://cloudshop.workers.dev"
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

variable "jwt_secret" {
  description = "JWT Secret Key for Worker authentication"
  type        = string
  sensitive   = true
}

variable "stripe_secret_key" {
  description = "Stripe Secret Key for payment processing"
  type        = string
  sensitive   = true
  default     = ""
}

variable "stripe_publishable_key" {
  description = "Stripe Publishable Key for front-end"
  type        = string
  default     = ""
}

variable "github_token" {
  description = "GitHub Token for Pages repository linking"
  type        = string
  sensitive   = true
  default     = ""
}

variable "worker_env_vars" {
  description = "Public environment variables for Worker"
  type        = map(string)
  default = {
    ENVIRONMENT = "production"
    USE_MOCKS   = "false"
  }
}

variable "worker_secrets" {
  description = "Secret environment variables for Worker (passed via GitHub secrets)"
  type        = map(string)
  sensitive   = true
  default     = {}
}
