# Terraform + Wrangler Deployment Strategy

This document explains how Terraform and Wrangler work together to manage Cloudflare Workers and Pages resources.

## Architecture Overview

```
GitHub Actions Workflow
    ↓
Terraform Apply
    ├── Creates: cloudflare_workers_script (empty placeholder)
    ├── Creates: cloudflare_worker_environment_binding (all env vars/secrets)
    ├── Creates: cloudflare_pages_project (linked to GitHub repo)
    ├── Creates: D1 database, R2 bucket, KV namespace
    └── Exports: Terraform outputs (IDs, names, URLs)
    ↓
Wrangler Deploy
    ├── Downloads Terraform outputs
    ├── Deploys actual code to Worker (overwrites placeholder)
    └── Deploys Pages build artifacts

```

## Responsibility Split

| Task | Terraform | Wrangler |
|------|-----------|----------|
| Create Worker/Pages resources | ✅ | ❌ |
| Manage environment variables | ✅ | ❌ |
| Manage secrets | ✅ | ❌ |
| Deploy code | ❌ | ✅ |
| Create D1/R2/KV | ✅ | ❌ |
| Manage bindings | ✅ | ❌ |

## Key Design Decisions

### 1. Why Terraform Manages Resource Creation
- **State Management**: Terraform tracks infrastructure state, preventing drift
- **Version Control**: All infrastructure code is in Git
- **Idempotency**: Terraform is idempotent; multiple applies are safe
- **Consistency**: All environment variables are declared in one place

### 2. Why Wrangler Handles Code Deployment
- **Optimization**: Wrangler is optimized for rapid code updates
- **Developer Experience**: Local development uses Wrangler's watch mode
- **Simplicity**: Wrangler knows how to compile TypeScript, optimize bundles
- **Separation of Concerns**: Infrastructure vs. Application

### 3. Lifecycle Rules
Both Worker and Pages resources have `prevent_destroy = true` to protect against accidental deletion.

Worker script has `ignore_changes = [content]` so Terraform doesn't conflict with Wrangler's code deployments.

## Secrets Management Strategy

### Secret Variables
These are passed from GitHub Secrets → Terraform Variables → Cloudflare Bindings:

**Worker Secrets:**
- `JWT_SECRET` — JWT signing key
- `STRIPE_SECRET_KEY` — Stripe secret (server-side)
- `PRINTFUL_API_KEY` — Printful API credentials
- `MAILCHANNELS_API_KEY` — Email service credentials

**Public Environment Variables:**
- `ENVIRONMENT` — "production" or "development"
- `USE_MOCKS` — "true" or "false"

### Security Best Practices
1. All secrets marked `sensitive = true` in Terraform
2. GitHub Secrets never exposed in logs or artifacts
3. Terraform state file is encrypted (managed by Terraform Cloud)
4. Wrangler does not require secrets in wrangler.toml; they come from Terraform bindings

## Deployment Workflow

### 1. Infrastructure Deployment (.github/workflows/deploy-infrastructure.yml)
```yaml
Steps:
1. Checkout code
2. Initialize Terraform
3. Plan Terraform changes
4. Apply Terraform (creates/updates resources)
5. Export outputs to artifact
```

**Environment Variables Passed to Terraform:**
- `TF_VAR_cloudflare_api_token` ← GitHub secret
- `TF_VAR_account_id` ← GitHub secret
- `TF_VAR_jwt_secret` ← GitHub secret
- `TF_VAR_stripe_secret_key` ← GitHub secret
- `TF_VAR_printful_api_key` ← GitHub secret
- `TF_VAR_mailchannels_api_key` ← GitHub secret
- `TF_VAR_github_token` ← GitHub secret (for Pages linking)
- `TF_VAR_stripe_publishable_key` ← GitHub secret

### 2. Worker Deployment (.github/workflows/deploy-worker.yml)
```yaml
Steps:
1. Checkout code
2. Install dependencies
3. Build Worker
4. Download Terraform outputs
5. Extract: worker_script_id, worker_name, d1_database_id, kv_namespace_id
6. Deploy via Wrangler (updates code in existing resource)
```

### 3. Pages Deployment (.github/workflows/deploy-pages.yml)
```yaml
Steps:
1. Checkout code
2. Install dependencies
3. Build Pages
4. Download Terraform outputs
5. Extract: pages_project_name
6. Deploy via Wrangler (updates code in existing project)
```

## Validation & Drift Prevention

### Automated Validation (Pre-Deploy)
In GitHub Actions, before deploying with Wrangler:
```bash
# Verify Terraform state matches expected configuration
terraform refresh
terraform validate

# Verify outputs are accessible
jq -r .worker_script_id.value /tmp/tf-outputs.json
jq -r .pages_project_id.value /tmp/tf-outputs.json
```

### Manual Validation
```bash
# Verify Worker environment bindings
wrangler env list --env production

# Check Terraform state
terraform show

# Verify Cloudflare resources exist
cloudflare list-workers
cloudflare list-pages-projects
```

## Troubleshooting

### Problem: "Worker not found" during Wrangler deploy
**Cause**: Terraform apply failed silently
**Solution**: 
1. Check Terraform apply output in GitHub Actions
2. Verify account_id and cloudflare_api_token are correct
3. Run `terraform apply` manually to see detailed errors

### Problem: Environment variables not appearing in Worker
**Cause**: Wrangler deploy overwrote Terraform bindings
**Solution**: 
1. Do NOT use environment variables in wrangler.toml for production
2. Keep only infrastructure bindings in wrangler.toml
3. All secrets must come from Terraform `cloudflare_worker_environment_binding` resources

### Problem: Pages build fails with missing environment variables
**Cause**: Environment variables not propagated to build
**Solution**:
1. Verify `environment_configs` in `terraform/pages.tf` is correct
2. Check that Terraform outputs include `pages_project_name`
3. Verify GitHub Pages project exists in Cloudflare dashboard

### Problem: Terraform plan shows changes to content every apply
**Cause**: Wrangler's content changes conflict with Terraform tracking
**Solution**: 
1. This is expected behavior because `ignore_changes = [content]` is configured
2. No changes will actually be made to the content
3. If you need to update content, use Wrangler only

## Local Development

### Worker (Local)
```bash
cd worker

# Install dependencies
npm install

# Create .dev.vars.development with secrets (see docker-compose.yml)
# Secrets are injected via GitHub Actions in CI

# Run locally
npm run dev
# or in Docker environment: wrangler dev
```

### Pages (Local)
```bash
cd pages

# Install dependencies
npm install

# Set build environment variables
export VITE_API_BASE_URL=http://localhost:8787
export VITE_USE_MOCKS=true

# Build
npm run build

# Preview
npm run preview
```

## Migration Notes

### Transition from Wrangler-Only to Terraform-Managed

1. **Backup state**:
   ```bash
   terraform state pull > terraform.state.backup
   ```

2. **Import existing resources** (if any exist):
   ```bash
   terraform import cloudflare_workers_script.main <script_id>
   terraform import cloudflare_pages_project.main <project_id>
   ```

3. **Test with plan**:
   ```bash
   terraform plan
   # Should show only new bindings, not resource creation
   ```

4. **Apply gradually**:
   - Deploy to staging first
   - Monitor logs for errors
   - Deploy to production after validation

## References

- [Terraform Cloudflare Provider Docs](https://registry.terraform.io/providers/cloudflare/cloudflare/latest/docs)
- [Wrangler Documentation](https://developers.cloudflare.com/workers/wrangler/)
- [Cloudflare Workers API Docs](https://developers.cloudflare.com/workers/runtime-apis/web-crypto/)
