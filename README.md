# Cloudshop - Cloudflare Shopping App

A minimalist, print-on-demand shopping cart application built with Cloudflare Workers, Pages, and D1 database.

## Features

- 🛒 Dynamic product catalog with sizes, colors, and variants
- 🎨 User art uploads (custom designs for printing)
- 💳 Stripe payment processing
- 📦 Printful API integration for print-on-demand fulfillment
- 👤 User authentication with JWT refresh tokens
- 📝 Order management and tracking
- 📧 Email notifications (Mailchannels)
- 🧪 Mock integrations for local development
- 📱 Responsive React + TailwindCSS frontend

## Tech Stack

### Core
- **Runtime:** Cloudflare Workers
- **Frontend:** Cloudflare Pages
- **Database:** Cloudflare D1 (SQLite)
- **Storage:** Cloudflare R2
- **Cache:** Cloudflare KV

### Worker (API)
- Hono (latest)
- Drizzle ORM (latest)
- Stripe SDK (latest)
- Printful API client (custom)
- Mailchannels API (custom)

### Pages (Frontend)
- React 19
- Vite + vite-plugin-pages (file-based routing)
- TailwindCSS 4.3
- Shadcn/ui
- use-shopping-cart (latest)

### Development & Deployment
- Docker & Docker Compose
- Wrangler CLI (v3+)
- Terraform (state in Terraform Cloud)
- GitHub Actions
- Playwright (E2E testing)

## Prerequisites

- **macOS/Linux/Windows** (with WSL2)
- **Docker & Docker Compose**
- **Node.js 18+**
- **Wrangler CLI** (`npm install -g wrangler@latest`)
- **Cloudflare Account** (free tier compatible)
- **Terraform Cloud Account** (free tier)
- **Git** with GitHub repository

### API Keys (for deployment, not required for local dev)
- Stripe API Key
- Printful API Key
- Mailchannels API Key
- Cloudflare API Token

## Quick Start

### 1. Install Dependencies

```bash
# Install Wrangler CLI globally
npm install -g wrangler@latest

# Clone and navigate to repo
cd cloudflare_app

# Install root dependencies (if any)
npm install

# Install worker dependencies
cd worker
npm install
cd ..

# Install pages dependencies
cd pages
npm install
cd ..
```

### 2. Start Local Development with Docker

```bash
# Start Docker containers (Wrangler emulation, local D1, R2, KV)
docker compose up

# In a new terminal, start the worker (from /worker directory)
cd worker
wrangler dev

# In another terminal, start the Pages app dev server (from /pages directory)
cd pages
npm run dev
```

**URLs:**
- Pages App: http://localhost:5173
- Worker API: http://localhost:8787
- Mock Mode: Enabled by default (no real API calls)

### 3. Test Locally

```bash
# In project root
npm run test:e2e
```

## Development

### Project Structure

```
cloudflare_app/
├── worker/                    # Hono REST API
│   ├── src/
│   │   ├── index.ts          # Hono app entry
│   │   ├── schema.ts         # Drizzle D1 schema
│   │   ├── db.ts             # D1 connection
│   │   ├── routes/           # API endpoints
│   │   ├── services/         # Business logic (Stripe, Printful, etc.)
│   │   └── middleware/       # Auth, CORS, error handling
│   ├── wrangler.toml         # Cloudflare config
│   └── package.json
│
├── pages/                     # React SPA frontend
│   ├── src/
│   │   ├── main.tsx          # React entry
│   │   ├── pages/            # File-based routes (auto-routed)
│   │   ├── components/       # React components
│   │   ├── services/         # API client, auth context
│   │   └── styles/
│   ├── vite.config.ts        # vite-plugin-pages setup
│   ├── wrangler.toml
│   └── package.json
│
├── terraform/                # Infrastructure as Code
│   ├── cloud.tf              # Terraform Cloud config
│   ├── main.tf               # Provider & D1 database
│   ├── r2.tf                 # R2 bucket
│   ├── kv.tf                 # KV namespace
│   ├── workers.tf            # Worker routes & bindings
│   ├── pages.tf              # Pages deployment
│   ├── variables.tf
│   └── terraform.tfvars      # (in .gitignore)
│
├── tests/                    # Playwright E2E tests
│   ├── auth.spec.ts
│   ├── shopping.spec.ts
│   ├── checkout.spec.ts
│   └── admin.spec.ts
│
├── .github/workflows/        # GitHub Actions
│   ├── deploy-infrastructure.yml
│   ├── deploy-worker.yml
│   ├── deploy-pages.yml
│   └── run-tests.yml
│
├── docker-compose.yml        # Local dev environment
├── .env.development          # Local env vars
├── .env.production           # (in .gitignore) Production secrets
└── README.md
```

### Development Workflow

1. **Make changes** in `worker/src/` or `pages/src/`
2. **Wrangler watches** worker files and hot-reloads
3. **Vite watches** pages files and hot-reloads
4. **Mock integrations** by default (no real API calls)
5. **Run tests** locally with `npm run test:e2e`

### Environment Variables

**Local Development (`.env.development`):**
```
VITE_USE_MOCKS=true
VITE_API_BASE_URL=http://localhost:8787
```

**Production (`.env.production` — in GitHub Secrets):**
```
USE_MOCKS=false
STRIPE_SECRET_KEY=sk_live_...
PRINTFUL_API_KEY=...
MAILCHANNELS_API_KEY=...
```

### Mocking Integrations

By default, local development uses mock implementations:

- **Stripe:** Mock payment intents, success/failure based on test card
- **Printful:** Mock product catalog, sync endpoint returns hardcoded products
- **Mailchannels:** Logs emails to console instead of sending

To use real APIs:
1. Set `VITE_USE_MOCKS=false` in `.env.development`
2. Add real API keys to `.env.development`
3. Restart dev servers

### API Endpoints

**Authentication:**
- `POST /api/auth/signup` — Register
- `POST /api/auth/login` — Login (returns JWT + refresh token)
- `POST /api/auth/refresh` — Issue new JWT
- `POST /api/auth/logout` — Invalidate refresh token

**Products:**
- `GET /api/products` — List all products with variants
- `GET /api/products/:id` — Single product details

**Orders:**
- `POST /api/orders` — Create order (requires auth)
- `GET /api/orders` — List user orders (requires auth)
- `GET /api/orders/:id` — Order details (requires auth)

**Uploads:**
- `POST /api/uploads` — Upload art (multipart, requires auth)
- `GET /api/uploads` — List user uploads (requires auth)
- `DELETE /api/uploads/:id` — Delete upload (requires auth)

**Admin:**
- `POST /api/admin/sync-products` — Manual Printful sync (dev only)

## Deployment

### Fork & Deploy to Your Own Infrastructure

This app is designed to be forked and deployed by anyone to their own Cloudflare account. No hardcoded account data is stored in the code.

**One-time setup:**
1. Fork this repository
2. Create a Terraform Cloud account at terraform.io (free tier)
3. Get your values:
   - **Terraform Cloud:** Organization name, API token
   - **Cloudflare:** Account ID, API token
   - **Stripe, Printful, Mailchannels:** API keys for your accounts
4. Add all values to GitHub Secrets (see table below)
5. Push to main — GitHub Actions will deploy automatically

**All values are organization-specific and must be set via GitHub Secrets — nothing is hardcoded in the repository.**

### Prerequisites

1. **Terraform Cloud Account**
   - Create org at terraform.io
   - Generate API token
   - Add to GitHub Secrets: `TF_API_TOKEN`

2. **Cloudflare Account**
   - Generate API token with Workers, Pages, D1, R2, KV permissions
   - Add to GitHub Secrets: `CF_API_TOKEN`, `CF_ACCOUNT_ID`

3. **Third-party APIs**
   - Stripe account (get API keys)
   - Printful account (get API key)
   - Mailchannels account (get API key)

### GitHub Secrets Required

Add these secrets to your GitHub repository settings. They are used by GitHub Actions workflows for automated deployment.

| Secret | Purpose | Source | Required For |
|--------|---------|--------|--------------|
| `TF_API_TOKEN` | Terraform Cloud authentication |  app.terraform.io | Infrastructure deployment |
| `TF_CLOUD_ORGANIZATION` | Terraform Cloud organization name |  app.terraform.io → Settings → Organization Name | Infrastructure deployment |
| `TF_CLOUD_WORKSPACE` | Terraform Cloud workspace name | Any name (e.g., "cloudshop_cli") | Infrastructure deployment |
| `CF_API_TOKEN` | Cloudflare API authentication | Cloudflare Dashboard → API Tokens | All Cloudflare operations |
| `CF_ACCOUNT_ID` | Cloudflare account identifier | Cloudflare Dashboard → Account ID | All Cloudflare operations |
| `JWT_SECRET` | JWT token signing secret (Worker) | Generate any strong random string | Worker authentication |
| `STRIPE_SECRET_KEY` | Stripe API secret key | Stripe Dashboard → API Keys | Payment processing |
| `STRIPE_PUBLISHABLE_KEY` | Stripe public key | Stripe Dashboard → API Keys | Frontend payment integration |
| `PRINTFUL_API_KEY` | Printful API authentication | Printful Dashboard → API → API Keys | Print-on-demand orders |
| `MAILCHANNELS_API_KEY` | Mailchannels email API key | Mailchannels Dashboard → Verified Account | Email notifications |
| `API_BASE_URL` | Base URL for frontend API calls | Your deployed worker domain | Frontend configuration |

**To add secrets:**
1. Go to GitHub repository → Settings → Secrets and variables → Actions
2. Click "New repository secret"
3. Add each secret from the table above

### Deploy Infrastructure

```bash
cd terraform

# Initialize Terraform Cloud
terraform login  # Enter Terraform Cloud token

# Initialize backend
terraform init

# Review and apply
terraform plan
terraform apply
```

### Deploy via GitHub Actions

1. **Push to `main`** triggers all workflows:
   - `deploy-infrastructure.yml` — Terraform apply
   - `deploy-worker.yml` — Build & publish worker
   - `deploy-pages.yml` — Build & deploy pages
   - `run-tests.yml` — Run Playwright tests

2. **Monitor** in GitHub Actions dashboard

3. **Rollback** via Terraform Cloud UI (if needed)

### Deployment Checklist

- [ ] Cloudflare account created, API token generated
- [ ] Terraform Cloud account created, API token generated
- [ ] All GitHub Secrets added (see table above)
- [ ] D1 migrations tested locally (`docker compose up`)
- [ ] Stripe webhook configured (Cloudflare domain)
- [ ] Printful API tested with real credentials
- [ ] R2 CORS rules verified
- [ ] GitHub repo connected to Terraform Cloud
- [ ] Push to main, verify all workflows succeed
- [ ] Test live deployment (signup, shop, checkout)

## Testing

### Playwright E2E Tests

```bash
# Run all tests
npm run test:e2e

# Run specific test file
npm run test:e2e -- tests/auth.spec.ts

# Run in headed mode (see browser)
npm run test:e2e -- --headed

# Debug mode
npm run test:e2e -- --debug
```

**Test Suite:**
- `auth.spec.ts` — Signup, login, refresh token, logout
- `shopping.spec.ts` — Browse products, filter, upload art, add to cart
- `checkout.spec.ts` — Proceed to checkout, payment, order confirmation
- `admin.spec.ts` — Manual Printful sync

### Local Testing

1. Start Docker & dev servers (see Quick Start)
2. Run `npm run test:e2e`
3. Tests run against http://localhost:5173 (Pages) and http://localhost:8787 (Worker)

## Troubleshooting

### Port Conflicts
- Worker: `wrangler dev` uses port 8787 (configurable in `wrangler.toml`)
- Pages: `npm run dev` uses port 5173 (configurable in `vite.config.ts`)

### D1 Migrations Not Running
- Check `worker/src/schema.ts` for Drizzle schema
- Manually run: `wrangler d1 execute cloudshop --remote --file=./migrations/0001_init.sql`

### Bundle Size Exceeds 1MB
- Check: `npm run build` in worker/ and review bundle analysis
- Strip features in this order:
  1. Mailchannels (email notifications)
  2. Printful dynamic sync (use hardcoded products)
  3. Order history (Stripe only)

### Mock vs Real APIs
- Local: `VITE_USE_MOCKS=true` (default)
- Production: `USE_MOCKS=false` (set in GitHub Secrets)

### Terraform State Issues
- State stored remotely in Terraform Cloud (no local .tfstate)
- To view: Log into terraform.io, check workspace

### Stup CF_API_TOKEN for deployments
Here's how to create the **CF_API_TOKEN** (Cloudflare API Token):
You're right—my bad. The UI has changed. Here's a simpler approach:

**Use a pre-made template instead:**

1. **Log in to Cloudflare Dashboard** at [dash.cloudflare.com](https://dash.cloudflare.com)

2. **Go to API Tokens:**
   - Click your profile icon (bottom left)
   - Select "API Tokens"

3. **Use the "Edit Cloudflare Workers" template:**
   - Click "Create Token"
   - Scroll down and select **"Edit Cloudflare Workers"** (this template includes D1, R2, KV, Pages, etc.)
   - Click "Use Template"

4. **Adjust scope if needed:**
   - Make sure "All accounts" or your specific account is selected
   - Click "Continue to summary"

5. **Create and copy:**
   - Click "Create Token"
   - Copy immediately

6. **Add to GitHub Secrets:**
   - Go to your repo → Settings → Secrets and variables → Actions
   - New secret: `CF_API_TOKEN` = (paste token)

The "Edit Cloudflare Workers" template should have all the permissions needed for Workers, D1, R2, KV, and Pages.

If that template doesn't work either, what **do** you see when you click "Create Token"? That will help me give you the exact steps.

## Contributing

1. Create feature branch
2. Make changes and test locally
3. Run `npm run test:e2e` to validate
4. Commit and push
5. GitHub Actions deploys on merge to main

## Support

See [Cloudflare Docs](https://developers.cloudflare.com) for API references.

---

**Last Updated:** May 2026
