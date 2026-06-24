resource "cloudflare_d1_database" "cloudshop" {
  account_id = var.account_id
  name       = "cloudshop-db-${var.environment}"
}

output "d1_database_id" {
  value = cloudflare_d1_database.cloudshop.id
}
