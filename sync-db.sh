#!/bin/bash

# Longhorn 数据库同步工具 (MBAir -> Mac mini)
# ---------------------------------------------------------

# 配置信息
REMOTE_HOST="mini" # 使用您的 SSH 别名 (通过 Cloudflare Tunnel)
REMOTE_PATH="/Users/admin/Documents/server/Longhorn/server/longhorn.db"
LOCAL_DB="server/longhorn.db"

echo "🗄️  开始数据库同步流程..."

# 1. 检查本地数据库
if [ ! -f "$LOCAL_DB" ]; then
    echo "❌ 错误: 找不到本地数据库文件 $LOCAL_DB"
    exit 1
fi

echo "🔌 正在尝试通过 SSH 停止 Mac mini 上的 PM2 服务，以确保文件不被占用..."
ssh ${REMOTE_HOST} "pm2 stop longhorn"

echo "📤 正在上传数据库文件 ($LOCAL_DB)..."
scp "$LOCAL_DB" ${REMOTE_HOST}:"$REMOTE_PATH"

if [ $? -eq 0 ]; then
    echo "✅ 数据库传输成功！"
else
    echo "❌ 传输失败，请检查网络连接或权限。"
    ssh ${REMOTE_HOST} "pm2 start longhorn"
    exit 1
fi

echo "🚀 正在重启 Mac mini 上的 PM2 服务..."
ssh ${REMOTE_HOST} "pm2 start longhorn"

echo "----------------------------------------------------"
echo "🎉 数据库同步完成！现在 Mac mini 的数据已与本地一致。"
