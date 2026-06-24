resource "cloudflare_r2_bucket" "uploads" {
  account_id = var.account_id
  name = "cloudshop-uploads-${var.environment}"
  location   = "WNAM"  # Western North America
}

output "r2_bucket_name" {
  value = cloudflare_r2_bucket.uploads.name
}

output "r2_bucket_id" {
  value = cloudflare_r2_bucket.uploads.id
}
