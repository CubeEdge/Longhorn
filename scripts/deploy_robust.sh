#!/bin/bash

# Robust Deployment Script (No Compression, Pauses)

# Ensure we are in the project root
cd "$(dirname "$0")/.."

# Server Configuration
SERVER_HOST="mini"
REMOTE_PATH="/Users/admin/Documents/server/Longhorn"

echo "🚀 Deploying Longhorn to $SERVER_HOST (Robust Mode)..."

# 1. Sync Server Code
echo "📤 Syncing Server Code..."
rsync -av --delete \
    --exclude='node_modules' \
    --exclude='.env' \
    --exclude='*.db' \
    --exclude='*.db-shm' \
    --exclude='*.db-wal' \
    --exclude='data' \
    --exclude='.DS_Store' \
    --exclude='*.log' \
    --exclude='uploads' \
    --exclude='thumbnails' \
    --exclude='cache' \
    server/ $SERVER_HOST:$REMOTE_PATH/server/

echo "zzz Pausing for stability..."
sleep 2

# 2. Sync Client Code
echo "📤 Syncing Client Code..."
rsync -av --delete \
    --exclude='node_modules' \
    --exclude='dist' \
    --exclude='.DS_Store' \
    --exclude='*.log' \
    client/ $SERVER_HOST:$REMOTE_PATH/client/

echo "zzz Pausing for stability..."
sleep 2

# 3. Execute Remote Build & Restart
echo "🔄 Executing Remote Build & Restart..."
ssh -t $SERVER_HOST "/bin/zsh -l -c \"
    set -e
    
    echo '📂 Navigating to project directory: $REMOTE_PATH'
    cd $REMOTE_PATH

    echo '📦 Building client...'
    cd client
    rm -rf dist node_modules/.vite
    npm install
    npm run build

    echo '🔄 Restarting server...'
    cd ../server
    npm install
    
    pm2 reload longhorn --update-env || pm2 start index.js --name longhorn -i max
    pm2 save

    echo '✅ Deployment Complete!'
\""
