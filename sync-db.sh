#!/bin/bash

# sync-db.sh
# 这里的用途是把本地 (MBAir) 修复好的数据库覆盖到服务器 (Mac mini)

echo "⚠️  注意：此操作将覆盖服务器上的数据库！"
echo "请确保服务器上的数据（如新注册用户）目前不重要，或者您只是为了同步修复好的部门结构。"
echo ""

read -p "请输入 Mac mini 服务器的 IP 地址 (例如 192.168.50.x): " SERVER_IP
read -p "请输入 Mac mini 的用户名 (例如 admin): " USERNAME
read -p "请输入服务器上的 Longhorn 项目路径 (通常是 ~/Documents/Longhorn): " REMOTE_PATH

# Default path if empty
if [ -z "$REMOTE_PATH" ]; then
    REMOTE_PATH="~/Documents/Longhorn"
fi

echo "🚀 正在发送数据库..."
scp server/longhorn.db "$USERNAME@$SERVER_IP:$REMOTE_PATH/server/longhorn.db"

if [ $? -eq 0 ]; then
    echo "✅ 数据库同步成功！"
    echo "请在服务器上重启服务以生效：pm2 restart longhorn"
else
    echo "❌ 发送失败，请检查密码或网络连通性。"
fi
