#!/bin/bash

# Server Configuration
SERVER_USER="admin"
SERVER_HOST="opware.kineraw.com"
PROJECT_PATH="/Users/admin/Documents/server/Longhorn"

echo "🚀 Deploying Longhorn to $SERVER_HOST..."

ssh -t $SERVER_USER@$SERVER_HOST "
    set -e
    
    echo '📂 Navigating to project directory: $PROJECT_PATH'
    cd \"$PROJECT_PATH\"

    echo '⬇️ Pulling latest code...'
    git pull

    echo '📦 Building client...'
    cd client
    npm run build

    echo '🔄 Restarting server...'
    cd ../server
    # Try restart, if fails (process not found), then start
    pm2 restart index || pm2 start index.js --name index

    echo '✅ Remote deployment commands executed successfully!'
"
