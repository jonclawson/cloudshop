# Create Cloudflare Pages project linked to GitHub repository
resource "cloudflare_pages_project" "main" {
  account_id = var.account_id
  name       = "cloudshop"

  # GitHub repository integration
  source {
    type = "github"

    config {
      owner             = "your-github-org"  # TODO: Replace with actual org
      repo_name         = "cloudflare_app"   # Repository name
      production_branch = "main"
    }
  }

  # Build configuration
  build_config {
    build_command   = "cd pages && npm run build"
    destination_dir = "pages/dist"
  }

  # Environment variables
  environment_configs {
    production {
      environment_variables = {
        VITE_API_BASE_URL = "https://api.${var.domain}"
        VITE_USE_MOCKS    = "false"
      }

      secret_variables = {
        VITE_STRIPE_PUBLISHABLE_KEY = var.stripe_publishable_key
      }
    }

    preview {
      environment_variables = {
        VITE_API_BASE_URL = "http://localhost:8787"
        VITE_USE_MOCKS    = "true"
      }

      secret_variables = {
        VITE_STRIPE_PUBLISHABLE_KEY = var.stripe_publishable_key
      }
    }
  }

  # Prevent accidental destruction
  lifecycle {
    prevent_destroy = true
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
  value = "https://cloudshop.${var.domain}"
}
