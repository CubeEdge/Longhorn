#!/bin/bash

# ==========================================
# Atomic Deployment Script (Tarball Strategy)
# Prevents "Ghost Code" by ensuring full source replacement
# ==========================================

# 1. Safety First: Exit on any error
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
# 2. Git Check (Optional)
# ------------------------------------------
SYNC_GIT=false
for arg in "$@"; do
    case $arg in
        --git) SYNC_GIT=true ;;
    esac
done

if [ "$SYNC_GIT" = true ]; then
    log "🐙 GIT MODE: Committing and Pushing..."
    if [[ -n $(git status -s) ]]; then
        git add .
        git commit -m "WIP: Deployment auto-commit"
    fi
    git push || error "Git push failed"
    log "✅ Git push complete."
else
    echo "⚠️  FAST MODE: Direct sync only."
fi

echo "🚀 Deploying Longhorn to $SERVER_HOST..."

# ------------------------------------------
# 3. Server Sync (Backend) - Using Rsync
# ------------------------------------------
# Backend files are small, rsync is acceptable here.
log "📤 Syncing Server Code (Backend)..."
rsync -avzc --delete \
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
# 4. Client Sync (Frontend) - ATOMIC TARBALL
# ------------------------------------------
# We use tarball strategy to prevent "partial sync" / zombie files
log "📦 Packaging Client Code..."
tar --exclude='node_modules' \
    --exclude='dist' \
    --exclude='.DS_Store' \
    --exclude='*.log' \
    -czf $TEMP_TAR client || error "Tar command failed"

log "📤 Uploading Client Tarball..."
rsync -avz $TEMP_TAR $SERVER_HOST:$REMOTE_PATH/ || error "Tarball upload failed"

log "🧹 Swapping Client Code on Remote..."
# Remote commands:
# 1. Remove temp backup if exists
# 2. Move node_modules to safe place (preserve dependencies)
# 3. DELETE entire client folder (kill zombies)
# 4. Extract new tarball
# 5. Restore node_modules
# 6. Cleanup tarball
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

# ------------------------------------------
# 5. Root Configuration
# ------------------------------------------
log "uploading package.json..."
scp package.json $SERVER_HOST:$REMOTE_PATH/ || error "Package.json upload failed"


# ------------------------------------------
# 6. Remote Build & Restart
# ------------------------------------------
log "🔄 Executing Remote Build & Restart..."
ssh -t $SERVER_HOST "/bin/zsh -l -c \"
    set -e
    cd $REMOTE_PATH
    
    echo '📦 Building client...'
    cd client
    npm install --no-audit --no-fund --quiet # Fast install check
    npm run build
    
    echo '🔄 Restarting server...'
    cd ../server
    npm install --no-audit --no-fund --quiet
    
    pm2 reload longhorn --update-env || pm2 start index.js --name longhorn -i max
    
    # Restart watcher if exists
    pm2 describe longhorn-watcher > /dev/null 2>&1 && pm2 reload longhorn-watcher || true
    
    pm2 save
    echo '✅ Deployment Complete!'
\"" || error "Remote build failed"
