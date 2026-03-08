#!/bin/bash

# ==========================================
# Ultra-Fast Deployment Script
# Fast Mode (default): Incremental sync (~3-5s)
# Full Mode (--full): Complete rebuild (~60s)
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
FORCE_SERVER_SYNC=false

for arg in "$@"; do
    case $arg in
        --full) FAST_MODE=false ;;
        --git) SYNC_GIT=true ;;
        --force-server) FORCE_SERVER_SYNC=true ;;
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
# Server Sync (Backend) - Incremental
# ------------------------------------------
# 检查 server 是否有实质变更（排除日志和临时文件）
SERVER_CHANGED=false
if [ "$FORCE_SERVER_SYNC" = true ]; then
    SERVER_CHANGED=true
else
    # 对比本地和远程的 package.json 和关键文件
    LOCAL_PKG_HASH=$(md5 -q server/package.json 2>/dev/null || echo "")
    REMOTE_PKG_HASH=$(ssh -o ConnectTimeout=5 $SERVER_HOST "md5 -q $REMOTE_PATH/server/package.json 2>/dev/null || echo ''" 2>/dev/null || echo "")
    
    if [ "$LOCAL_PKG_HASH" != "$REMOTE_PKG_HASH" ]; then
        SERVER_CHANGED=true
    fi
fi

if [ "$SERVER_CHANGED" = true ]; then
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
        --exclude='backups' \
        server/ $SERVER_HOST:$REMOTE_PATH/server/ || error "Server rsync failed"
else
    log "⏭️  Server unchanged, skipping sync"
fi

# ------------------------------------------
# Client Deployment: Fast Mode vs Full Mode
# ------------------------------------------
if [ "$FAST_MODE" = true ]; then
    # ===== FAST MODE: Local Build + Dist Sync =====
    log "⚡ FAST MODE: Local build + dist sync"
    
    # 检查 client 是否有变更（通过 git status 或文件哈希）
    CLIENT_CHANGED=true
    if [ -d "client/dist" ] && [ -f ".deploy_cache/client_hash" ]; then
        CURRENT_HASH=$(find client/src -type f -name "*.ts" -o -name "*.tsx" -o -name "*.css" -o -name "*.json" | grep -v node_modules | sort | xargs md5 -q 2>/dev/null | md5 -q)
        CACHED_HASH=$(cat .deploy_cache/client_hash 2>/dev/null || echo "")
        if [ "$CURRENT_HASH" = "$CACHED_HASH" ] && [ -d "client/dist/assets" ]; then
            CLIENT_CHANGED=false
            log "⏭️  Client unchanged, using cached build"
        fi
    fi
    
    if [ "$CLIENT_CHANGED" = true ]; then
        log "🔨 Building client locally..."
        cd client
        npm run build || error "Local build failed"
        cd ..
        
        # 保存哈希缓存
        mkdir -p .deploy_cache
        find client/src -type f -name "*.ts" -o -name "*.tsx" -o -name "*.css" -o -name "*.json" | grep -v node_modules | sort | xargs md5 -q 2>/dev/null | md5 -q > .deploy_cache/client_hash
    fi
    
    log "📤 Syncing dist to server..."
    # 使用压缩和并行传输加速
    rsync -avz --delete --compress-level=6 \
        --exclude='*.map' \
        client/dist/ $SERVER_HOST:$REMOTE_PATH/client/dist/ || error "Dist sync failed"
    
    log "🔄 Restarting server..."
    
    # 只在 server 代码变更时才执行 npm install
    NPM_INSTALL_CMD=""
    if [ "$SERVER_CHANGED" = true ]; then
        NPM_INSTALL_CMD="npm install --no-audit --no-fund --quiet &&"
    fi
    
    ssh -t $SERVER_HOST "/bin/zsh -l -c \"
        set -e
        cd $REMOTE_PATH/server
        $NPM_INSTALL_CMD
        pm2 reload longhorn --update-env || pm2 start index.js --name longhorn
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
echo "   Server Sync: $([ "$SERVER_CHANGED" = true ] && echo "✅ Updated" || echo "⏭️  Skipped")"
if [ "$FAST_MODE" = true ]; then
    echo "   Client Build: $([ "$CLIENT_CHANGED" = true ] && echo "✅ Rebuilt" || echo "⏭️  Cached")"
fi
echo ""
echo "💡 Tips:"
echo "   • Use --force-server to force server sync"
echo "   • Use --full for complete rebuild"
echo "   • Delete .deploy_cache to clear build cache"
