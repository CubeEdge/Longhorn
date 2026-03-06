#!/bin/bash

# ==========================================
# Optimized Deployment Script
# Fast Mode (default): Local build + dist sync (~10s)
# Full Mode (--full): Atomic tarball deployment (~60s)
# ==========================================

set -e

# Configuration
SERVER_HOST="mini"
REMOTE_PATH="/Users/admin/Documents/server/Longhorn"
TEMP_TAR="deploy_client_$(date +%s).tar.gz"

# Helper for colored output
log() { echo "👉 $1"; }
error() { echo "❌ $1"; exit 1; }

# Change to project root
cd "$(dirname "$0")/.."

# ------------------------------------------
# Parse Arguments
# ------------------------------------------
FAST_MODE=true
SYNC_GIT=false

for arg in "$@"; do
    case $arg in
        --full) FAST_MODE=false ;;
        --git) SYNC_GIT=true ;;
    esac
done

# ------------------------------------------
# Git Sync (Optional)
# ------------------------------------------
if [ "$SYNC_GIT" = true ]; then
    log "🐙 GIT MODE: Committing and Pushing..."
    if [[ -n $(git status -s) ]]; then
        git add .
        git commit -m "WIP: Deployment auto-commit"
    fi
    git push || error "Git push failed"
    log "✅ Git push complete."
fi

echo "🚀 Deploying Longhorn to $SERVER_HOST..."

# ------------------------------------------
# Server Sync (Backend) - Always rsync
# ------------------------------------------
log "📤 Syncing Server Code (Backend)..."
rsync -avc --delete \
    --exclude='node_modules' \
    --exclude='.env' \
    --exclude='*.db*' \
    --exclude='data' \
    --exclude='.DS_Store' \
    --exclude='*.log' \
    --exclude='uploads' \
    --exclude='thumbnails' \
    --exclude='cache' \
    server/ $SERVER_HOST:$REMOTE_PATH/server/ || error "Server rsync failed"

# ------------------------------------------
# Client Deployment: Fast Mode vs Full Mode
# ------------------------------------------
if [ "$FAST_MODE" = true ]; then
    # ===== FAST MODE: Local Build + Dist Sync =====
    log "⚡ FAST MODE: Local build + dist sync"
    
    log "🔨 Building client locally..."
    cd client
    npm run build || error "Local build failed"
    cd ..
    
    log "📤 Syncing dist to server..."
    rsync -av --delete client/dist/ $SERVER_HOST:$REMOTE_PATH/client/dist/ || error "Dist sync failed"
    
    log "🔄 Restarting server..."
    ssh -t $SERVER_HOST "/bin/zsh -l -c \"
        set -e
        cd $REMOTE_PATH/server
        npm install --no-audit --no-fund --quiet
        pm2 reload longhorn --update-env || pm2 start index.js --name longhorn -i max
        pm2 describe longhorn-watcher > /dev/null 2>&1 && pm2 reload longhorn-watcher || true
        pm2 save
        echo '✅ Fast Deployment Complete!'
    \"" || error "Remote restart failed"

else
    # ===== FULL MODE: Atomic Tarball Deployment =====
    log "🐢 FULL MODE: Atomic tarball deployment"
    
    log "📦 Packaging Client Code..."
    tar --exclude='node_modules' \
        --exclude='dist' \
        --exclude='.DS_Store' \
        --exclude='*.log' \
        -czf $TEMP_TAR client || error "Tar command failed"
    
    log "📤 Uploading Client Tarball..."
    rsync -avz $TEMP_TAR $SERVER_HOST:$REMOTE_PATH/ || error "Tarball upload failed"
    
    log "🧹 Swapping Client Code on Remote..."
    ssh $SERVER_HOST "
        set -e
        cd $REMOTE_PATH
        
        # Clean prev temp
        rm -rf /tmp/nm_backup
    
        # Backup modules if they exist
        if [ -d client/node_modules ]; then
            mv client/node_modules /tmp/nm_backup
        fi
        
        # ATOMIC WIPE
        rm -rf client
        
        # Extract
        tar -xzf $TEMP_TAR
        
        # Restore modules
        if [ -d /tmp/nm_backup ]; then
            mkdir -p client
            mv /tmp/nm_backup client/node_modules
        fi
        
        # Cleanup
        rm $TEMP_TAR
    " || error "Remote swap failed"
    
    # Cleanup local tarball
    rm $TEMP_TAR
    
    log "📦 Uploading package.json..."
    scp package.json $SERVER_HOST:$REMOTE_PATH/ || error "Package.json upload failed"
    
    log "🔄 Executing Remote Build & Restart..."
    ssh -t $SERVER_HOST "/bin/zsh -l -c \"
        set -e
        cd $REMOTE_PATH
        
        echo '📦 Building client...'
        cd client
        npm install --no-audit --no-fund --quiet
        npm run build
        
        echo '🔄 Restarting server...'
        cd ../server
        npm install --no-audit --no-fund --quiet
        
        pm2 reload longhorn --update-env || pm2 start index.js --name longhorn -i max
        pm2 describe longhorn-watcher > /dev/null 2>&1 && pm2 reload longhorn-watcher || true
        pm2 save
        echo '✅ Full Deployment Complete!'
    \"" || error "Remote build failed"
fi

echo ""
echo "✨ Deployment successful!"
echo "   Mode: $([ "$FAST_MODE" = true ] && echo "⚡ Fast" || echo "🐢 Full")"
echo "   Server: $SERVER_HOST"
