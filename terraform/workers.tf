# Placeholder for Workers deployment
# Will be configured via wrangler CLI or GitHub Actions

output "worker_url" {
  value = "https://cloudshop-worker.${var.domain}"
}

output "pages_url" {
  value = "https://cloudshop.${var.domain}"
}
