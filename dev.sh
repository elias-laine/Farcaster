#!/bin/bash
# Quick Start Script for Farcaster Dev Server

cd "$(dirname "$0")" || exit 1

echo "📦 Farcaster Development Server"
echo "================================"
echo ""

# Check if .env.local exists
if [ ! -f .env.local ]; then
  echo "❌ Error: .env.local file not found!"
  echo "   Please create .env.local with your environment variables"
  exit 1
fi

echo "✅ Environment file found"
echo ""

# Check if node_modules exists
if [ ! -d node_modules ]; then
  echo "📥 Installing dependencies..."
  npm install
fi

echo ""
echo "🚀 Starting dev server on http://localhost:5000"
echo "   Press Ctrl+C to stop"
echo ""

# Load .env.local properly
set -a
source .env.local
set +a

echo "✅ Environment variables loaded"
echo ""

# Start the server
NODE_ENV=development npx tsx server/index.ts
