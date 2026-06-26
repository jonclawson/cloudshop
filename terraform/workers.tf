# Fetch the Cloudflare account details to get the account name
data "cloudflare_account" "main" {
  account_id = var.account_id
}

# Create the Worker script with inline bindings
resource "cloudflare_workers_script" "main" {
  account_id  = var.account_id
  script_name = "cloudshop-worker-${var.environment}"

  # Compatibility and module configuration
  compatibility_date = "2024-11-07"
  main_module        = "src/index.ts"
  usage_model        = "bundled"

  # Placeholder content - Wrangler will deploy the actual code
  content = "export default { fetch: () => new Response('Worker deployed', { status: 200 }) }"

  # Bindings for database, storage, KV, and environment variables
  bindings = [
    # D1 Database binding
    {
      name        = "DB"
      type        = "d1"
      database_id = cloudflare_d1_database.cloudshop.id
    },
    # R2 Bucket binding
    {
      name        = "R2"
      type        = "r2_bucket"
      bucket_name = cloudflare_r2_bucket.uploads.name
    },
    # KV Namespace binding
    {
      name         = "KV"
      type         = "kv_namespace"
      namespace_id = cloudflare_workers_kv_namespace.rate_limiting.id
    },
    # R2 Access Key ID binding
    {
      name = "R2_ACCESS_KEY_ID"
      type = "secret_text"
      text = var.r2_access_key_id
    },
    # R2 Secret Access Key binding
    {
      name = "R2_SECRET_ACCESS_KEY"
      type = "secret_text"
      text = var.r2_secret_access_key
    },
    # R2_ACCOUNT_ID = cloudflare account id
    {
      name = "R2_ACCOUNT_ID"
      type = "secret_text"
      text = var.account_id
    },
    # R2_BUCKET_NAME
    {
      name = "R2_BUCKET_NAME"
      type = "plain_text"
      text = cloudflare_r2_bucket.uploads.name
    },
    # Secret: JWT Secret
    {
      name        = "JWT_SECRET"
      type        = "secret_text"
      text        = var.jwt_secret
    },
    # Secret: Stripe Secret Key
    {
      name        = "STRIPE_SECRET_KEY"
      type        = "secret_text"
      text        = var.stripe_secret_key
    },
    # Secret: Printful API Key
    {
      name        = "PRINTFUL_API_KEY"
      type        = "secret_text"
      text        = var.printful_api_key
    },
    # Secret: Mailchannels API Key
    {
      name        = "MAILCHANNELS_API_KEY"
      type        = "secret_text"
      text        = var.mailchannels_api_key
    },
    # Public environment variable: ENVIRONMENT
    {
      name = "ENVIRONMENT"
      type = "plain_text"
      text = var.environment
    },
    # Public environment variable: USE_MOCKS (disabled in production)
    {
      name = "USE_MOCKS"
      type = "plain_text"
      text = var.environment == "production" ? "false" : "true"
    },
  ]

  # Prevent accidental destruction and ignore content changes (Wrangler manages content)
  lifecycle {
    # prevent_destroy = true
    ignore_changes  = [
      content, 
      handlers,
      annotations, 
      migration_tag, 
      named_handlers, 
      placement, 
      placement_mode, 
      placement_status
      ]
  }
}

# Enable the workers.dev subdomain routing for this script
resource "cloudflare_workers_script_subdomain" "main" {
  account_id  = var.account_id
  script_name = cloudflare_workers_script.main.script_name
  enabled     = true
}