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

echo "🔄 Restarting Server..."
cd ../server
npm install # Install/update server deps if any
# Try restart, if fails (process not found), then start
pm2 restart index || pm2 start index.js --name index

echo "✅ Update successfully completed!"
