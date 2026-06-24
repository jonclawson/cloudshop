# Create the Worker script
resource "cloudflare_workers_script" "main" {
  account_id = var.account_id
  name       = "cloudshop-worker"

  # Content is a placeholder - Wrangler will deploy the actual code
  content = "export default { fetch: () => new Response('Worker deployed', { status: 200 }) }"

  # Prevent accidental destruction and ignore content changes (Wrangler manages content)
  lifecycle {
    prevent_destroy = true
    ignore_changes  = [content]
  }
}

# Bind D1 database to Worker
resource "cloudflare_worker_environment_binding" "db" {
  account_id       = var.account_id
  script_name      = cloudflare_workers_script.main.name
  binding_name     = "DB"
  type             = "d1"
  environment_name = var.environment
  d1_database_id   = cloudflare_d1_database.cloudshop.id
}

# Bind R2 bucket to Worker
resource "cloudflare_worker_environment_binding" "r2" {
  account_id       = var.account_id
  script_name      = cloudflare_workers_script.main.name
  binding_name     = "R2"
  type             = "r2"
  environment_name = var.environment
  bucket_name      = cloudflare_r2_bucket.uploads.name
}

# Bind KV namespace to Worker (optional)
resource "cloudflare_worker_environment_binding" "kv" {
  account_id       = var.account_id
  script_name      = cloudflare_workers_script.main.name
  binding_name     = "KV"
  type             = "kv_namespace"
  environment_name = var.environment
  namespace_id     = cloudflare_workers_kv_namespace.rate_limiting.id
}

# Bind public environment variables
resource "cloudflare_worker_environment_binding" "env_vars" {
  for_each = var.worker_env_vars

  account_id       = var.account_id
  script_name      = cloudflare_workers_script.main.name
  binding_name     = each.key
  type             = "plain_text"
  environment_name = var.environment
  plain_text       = each.value
}

# Bind secret environment variables
resource "cloudflare_worker_environment_binding" "secrets" {
  for_each = {
    JWT_SECRET          = var.jwt_secret
    STRIPE_SECRET_KEY   = var.stripe_secret_key
    PRINTFUL_API_KEY    = var.printful_api_key
    MAILCHANNELS_API_KEY = var.mailchannels_api_key
  }

  account_id       = var.account_id
  script_name      = cloudflare_workers_script.main.name
  binding_name     = each.key
  type             = "secret_text"
  environment_name = var.environment
  secret_text      = each.value
}

output "worker_script_id" {
  value = cloudflare_workers_script.main.id
}

output "worker_name" {
  value = cloudflare_workers_script.main.name
}

output "worker_url" {
  value = "https://api.${var.domain}"
}
