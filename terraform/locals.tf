locals {
  # Construct the Pages URL from the Pages project subdomain
  pages_url = "https://${cloudflare_pages_project.main.subdomain}"

  # Construct the Worker URL from the script name and account name
  worker_url = "https://${cloudflare_workers_script.main.script_name}.${data.cloudflare_account.main.name}.workers.dev"
}
