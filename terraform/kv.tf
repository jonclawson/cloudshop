# resource "cloudflare_workers_kv_namespace" "cache" {
#   account_id = var.account_id
#   title      = "cloudshop-kv-${var.environment}"
# }

# output "kv_namespace_id" {
#   value = cloudflare_workers_kv_namespace.cache.id
# }
