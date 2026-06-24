resource "cloudflare_workers_kv_namespace" "rate_limiting" {
  account_id = var.account_id
  title      = "cloudshop-kv-${var.environment}"
}

output "kv_namespace_id" {
  value = cloudflare_workers_kv_namespace.rate_limiting.id
}
