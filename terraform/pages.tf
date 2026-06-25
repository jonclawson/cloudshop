# Create Cloudflare Pages project linked to GitHub repository
resource "cloudflare_pages_project" "main" {
  production_branch = "main"
  account_id = var.account_id
  name       = "cloudshop-pages"

  # GitHub repository integration
  # source = {
  #   type = "github"

  #   config {
  #     owner             = "your-github-org"  # TODO: Replace with actual org
  #     repo_name         = "cloudflare_app"   # Repository name
  #     production_branch = "main"
  #   }
  # }

  # Build configuration
  # build_config = {
  #   build_command   = "cd pages && npm run build"
  #   destination_dir = "dist"
  # }

  # Environment variables
  deployment_configs = {
    production = {
      env_vars = {
        VITE_API_BASE_URL = {
          type = "plain_text"
          value = "${var.worker_url}"
        }
        VITE_USE_MOCKS    = {
          type = "plain_text"
          value = "false"
        }
        VITE_STRIPE_PUBLISHABLE_KEY = {
          type = "secret_text"
          value = var.stripe_publishable_key
        }
      }

    }

    preview = {
      env_vars = {
        VITE_API_BASE_URL = {
          type = "plain_text"
          value = "${var.worker_url}"
        }
        VITE_USE_MOCKS    = {
          type = "plain_text"
          value = "false"
        }
        VITE_STRIPE_PUBLISHABLE_KEY = {
          type = "secret_text"
          value = var.stripe_publishable_key
        }
      }

    }
  }

  # Prevent accidental destruction
  lifecycle {
    # prevent_destroy = true
  }
}

output "pages_project_id" {
  value = cloudflare_pages_project.main.id
}

output "pages_project_name" {
  value = cloudflare_pages_project.main.name
}

output "pages_production_url" {
  value = "https://${cloudflare_pages_project.main.name}.pages.dev"
}

output "pages_url" {
  value = "${var.site_url}"
}
