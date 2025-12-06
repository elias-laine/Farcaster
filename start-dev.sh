#!/bin/bash

# Development Server Starter for Farcaster App
# This script sets up environment variables and starts the dev server

set -a
source /workspaces/codespaces-blank/Farcaster/.env.local
set +a

cd /workspaces/codespaces-blank/Farcaster

echo "🚀 Starting Farcaster Dev Server"
echo "================================"
echo "Environment:"
echo "  NODE_ENV: $NODE_ENV"
echo "  PORT: $PORT"
echo "  CHAIN_ID: $CHAIN_ID"
echo "  CONTRACT_ADDRESS: $VITE_CONTRACT_ADDRESS"
echo ""
echo "Starting server..."
echo ""

NODE_ENV=development npx tsx server/index.ts
