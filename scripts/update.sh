#!/bin/bash

# This script is intended to be run ON the production server
# Usage: ./update.sh

echo "🚀 Starting Local Update..."

# Ensure we are in the project root (assuming script is in root)
cd "$(dirname "$0")"

echo "⬇️ Pulling latest code..."
git pull

echo "📦 Installing/Update Dependencies & Building Client..."
cd client
npm install
npm run build

echo "🔄 Restarting Server (Cluster Mode)..."
cd ..

# Create logs directory if not exists
mkdir -p logs

# Stop old processes and start with cluster config
pm2 delete longhorn 2>/dev/null || true
pm2 delete index 2>/dev/null || true
pm2 start ecosystem.config.js

echo "✅ Update successfully completed!"
echo "📊 PM2 Status:"
pm2 list
