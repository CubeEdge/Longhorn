#!/bin/bash

# sync-remote-db.sh
# 通过 HTTP 隧道同步数据库到远程服务器 (适用于无法直连 IP 的情况)

echo "☁️  Longhorn 远程数据库同步工具 (Cloudflare Tunnel 版)"
echo "------------------------------------------------"

# 1. 询问目标地址
read -p "请输入远程服务器地址 (默认 https://opware.kineraw.com): " SERVER_URL
SERVER_URL=${SERVER_URL:-"https://opware.kineraw.com"}

# 2. 询问 Admin Token (需要手动获取或登录)
# 为了简化，我们先尝试登录获取 Token
echo ""
echo "🔐 需要管理员权限验证"
read -p "请输入管理员用户名 (默认 admin): " USERNAME
USERNAME=${USERNAME:-"admin"}
read -s -p "请输入管理员密码: " PASSWORD
echo ""

# 3. 自动登录获取 Token
echo "🔄 正在登录..."
LOGIN_RES=$(curl -s -X POST "$SERVER_URL/api/login" \
  -H "Content-Type: application/json" \
  -d "{\"username\": \"$USERNAME\", \"password\": \"$PASSWORD\"}")

# 提取 Token (简单 grep 提取，或者提醒用户手动输入)
TOKEN=$(echo $LOGIN_RES | grep -o '"token":"[^"]*' | cut -d'"' -f4)

if [ -z "$TOKEN" ]; then
    echo "❌ 登录失败，无法获取 Token。响应内容："
    echo $LOGIN_RES
    exit 1
fi

echo "✅ 登录成功！"

# 4. 上传数据库
echo "🚀 正在通过隧道上传数据库..."
curl -X POST "$SERVER_URL/api/admin/restore-db" \
  -H "Authorization: Bearer $TOKEN" \
  -F "database=@server/longhorn.db"

echo ""
echo "------------------------------------------------"
if [ $? -eq 0 ]; then
    echo "✅ 上传命令已发送。如果服务器返回 success，则同步完成。"
    echo "服务器可能会自动重启，请稍等片刻后刷新网页验证。"
else
    echo "❌ 上传失败，请检查网络。"
fi
