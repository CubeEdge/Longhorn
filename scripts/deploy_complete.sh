#!/bin/bash

# ==========================================
# Longhorn 完整部署脚本
# ==========================================

set -e

PROJECT_ROOT="/Users/Kine/Documents/Kinefinity/KineCore/Pool/qoder/Longhorn"
SERVER_HOST="mini"
REMOTE_PATH="/Users/admin/Documents/server/Longhorn"

echo "🚀 开始部署 Longhorn..."

# 步骤 1: 构建前端
echo "👉 步骤 1: 构建前端..."
cd "$PROJECT_ROOT/client"
npm run build
echo "✅ 前端构建完成"

# 步骤 2: 同步服务器代码
echo "👉 步骤 2: 同步服务器代码..."
cd "$PROJECT_ROOT"
rsync -avzc --delete \
    --exclude='node_modules' \
    --exclude='.env' \
    --exclude='*.db*' \
    --exclude='data' \
    --exclude='.DS_Store' \
    --exclude='*.log' \
    server/ $SERVER_HOST:$REMOTE_PATH/server/
echo "✅ 服务器代码同步完成"

# 步骤 3: 同步前端 dist
echo "👉 步骤 3: 同步前端 dist..."
rsync -avz --delete client/dist/ $SERVER_HOST:$REMOTE_PATH/client/dist/
echo "✅ 前端 dist 同步完成"

# 步骤 4: 执行数据库迁移
echo "👉 步骤 4: 执行数据库迁移..."
ssh $SERVER_HOST "/bin/zsh -l -c 'cd $REMOTE_PATH/server && sqlite3 longhorn.db < service/migrations/011_ticket_search_index.sql'"
echo "✅ 数据库迁移完成"

# 步骤 5: 运行批量索引脚本
echo "👉 步骤 5: 运行批量索引脚本..."
ssh $SERVER_HOST "/bin/zsh -l -c 'cd $REMOTE_PATH/server && node scripts/index_all_tickets.js'"
echo "✅ 批量索引完成"

# 步骤 6: 重启服务
echo "👉 步骤 6: 重启服务..."
ssh -t $SERVER_HOST "/bin/zsh -l -c '
    cd $REMOTE_PATH/server
    npm install --no-audit --no-fund --quiet
    pm2 reload longhorn --update-env
    pm2 save
'"
echo "✅ 服务重启完成"

echo ""
echo "✨ 部署完成！"
