locals {
  # Construct the Pages URL from the Pages project subdomain
  pages_url = "https://${cloudflare_pages_project.main.subdomain}"

  # Construct the Worker URL from the script name and subdomain
  worker_url = "https://${cloudflare_workers_script.main.script_name}.${cloudflare_workers_script_subdomain.main.name}.workers.dev"
}
