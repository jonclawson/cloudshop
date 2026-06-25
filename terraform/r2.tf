resource "cloudflare_r2_bucket" "uploads" {
  account_id = var.account_id
  name = "cloudshop-uploads-${var.environment}"
  location   = "WNAM"  # Western North America
}

# resource "cloudflare_r2_bucket_cors" "r2_cors" {
#   account_id  = var.account_id
#   bucket_name = cloudflare_r2_bucket.uploads.name
#   rules = [{
#     id              = "AllowPagesApp"
#     allowed = {
#       # origins = [var.site_url] # TODO find url of pages app
#       methods = ["GET", "HEAD"]
#       headers = ["*"]
#     }
#     max_age_seconds = 3600
#   }]
# }

output "r2_bucket_name" {
  value = cloudflare_r2_bucket.uploads.name
}

output "r2_bucket_id" {
  value = cloudflare_r2_bucket.uploads.id
}
