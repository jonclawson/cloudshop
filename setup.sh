#!/bin/bash
# Initial setup script for Cloudshop development

echo "🚀 Cloudshop Development Setup"
echo "=============================="

# Check prerequisites
echo ""
echo "Checking prerequisites..."

if ! command -v node &> /dev/null; then
  echo "❌ Node.js is not installed. Please install Node.js 18+"
  exit 1
fi
echo "✅ Node.js $(node --version)"

if ! command -v docker &> /dev/null; then
  echo "❌ Docker is not installed. Please install Docker Desktop"
  exit 1
fi
echo "✅ Docker installed"

if ! command -v wrangler &> /dev/null; then
  echo "⚠️  Wrangler CLI not found. Installing globally..."
  npm install -g wrangler@latest
fi
echo "✅ Wrangler $(wrangler --version)"

# Install dependencies
echo ""
echo "Installing dependencies..."
npm install

cd worker
echo "📦 Installing worker dependencies..."
npm install
cd ..

cd pages
echo "📦 Installing pages dependencies..."
npm install
cd ..

echo ""
echo "✅ Setup complete!"
echo ""
echo "Next steps:"
echo "1. Start development: npm run dev"
echo "2. In a new terminal: cd worker && npm run dev"
echo "3. In another terminal: cd pages && npm run dev"
echo "4. Open http://localhost:5173 in your browser"
echo ""
echo "For testing: npm run test:e2e"
echo "For admin sync: Visit http://localhost:5173/admin/sync-products"
