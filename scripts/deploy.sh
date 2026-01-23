#!/bin/bash

# Ensure we are in the project root
cd "$(dirname "$0")/.."

# Server Configuration
SERVER_HOST="mini"
REMOTE_PATH="/Users/admin/Documents/server/Longhorn"

echo "🚀 Deploying Longhorn to $SERVER_HOST..."

# 1. Sync Server Code (excluding data/config)
echo "📤 Syncing Server Code..."
rsync -avzc --delete \
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

# 2. Sync Client Code
echo "📤 Syncing Client Code..."
rsync -avzc --delete \
    --exclude='node_modules' \
    --exclude='dist' \
    --exclude='.DS_Store' \
    --exclude='*.log' \
    client/ $SERVER_HOST:$REMOTE_PATH/client/

# 3. Execute Remote Build & Restart
echo "🔄 Executing Remote Build & Restart..."
ssh -t $SERVER_HOST "/bin/zsh -l -c \"
    set -e
    
    echo '📂 Navigating to project directory: $REMOTE_PATH'
    cd $REMOTE_PATH

    echo '📦 Building client...'
    cd client
    npm install  # Ensure deps are installed
    npm run build

    echo '🔄 Restarting server...'
    cd ../server
    npm install  # Ensure server deps (ffmpeg logic might need generic generic, but sharp handles it)
    # Force sharp rebuild if needed (optional but safe)
    # npm rebuild sharp 
    
    # Enforce Cluster Mode & Zero Downtime Reload
    # 'reload' allows 0-second downtime updates if running in cluster mode
    pm2 reload longhorn --update-env || pm2 start index.js --name longhorn -i max
    
    # Start or reload watcher
    pm2 describe longhorn-watcher > /dev/null 2>&1 && pm2 reload longhorn-watcher || pm2 start $REMOTE_PATH/scripts/deploy-watch.sh --name longhorn-watcher
    
    # Ensure PM2 restarts on system reboot
    pm2 save

    echo '✅ Deployment Complete!'
\""
