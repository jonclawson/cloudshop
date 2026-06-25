# Create the Worker script with inline bindings
resource "cloudflare_workers_script" "main" {
  account_id  = var.account_id
  script_name = "cloudshop-worker"

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
  # lifecycle {
    # prevent_destroy = true
    # ignore_changes  = [content]
  # }
}

# Enable the workers.dev subdomain routing for this script
resource "cloudflare_workers_script_subdomain" "main" {
  account_id  = var.account_id
  script_name = cloudflare_workers_script.main.script_name
  enabled     = true
}