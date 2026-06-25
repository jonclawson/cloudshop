# Pages Project Outputs
output "pages_project_id" {
  description = "ID of the Cloudflare Pages project"
  value       = cloudflare_pages_project.main.id
}

output "pages_project_name" {
  description = "Name of the Cloudflare Pages project"
  value       = cloudflare_pages_project.main.name
}

output "pages_url" {
  description = "The default URL of the Cloudflare Pages project"
  value       = local.pages_url
}

# Worker Outputs
output "worker_script_id" {
  description = "ID of the Cloudflare Worker script"
  value       = cloudflare_workers_script.main.id
}

output "worker_name" {
  description = "Name of the Cloudflare Worker script"
  value       = cloudflare_workers_script.main.script_name
}

output "worker_url" {
  description = "The default URL of the Cloudflare Worker"
  value       = local.worker_url
}
