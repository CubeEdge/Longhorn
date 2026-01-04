#!/bin/bash

# 批量分享集合功能测试脚本

BASE_URL="http://localhost:4000"

echo "=== 批量分享集合API测试 ==="
echo ""

# 1. 登录获取token
echo "1. 登录获取token..."
LOGIN_RESPONSE=$(curl -s -X POST "$BASE_URL/api/login" \
  -H "Content-Type: application/json" \
  -d '{"username": "admin", "password": "admin123"}')

TOKEN=$(echo $LOGIN_RESPONSE | grep -o '"token":"[^"]*' | cut -d'"' -f4)

if [ -z "$TOKEN" ]; then
    echo "❌ 登录失败！"
    echo "响应: $LOGIN_RESPONSE"
    exit 1
fi

echo "✅ 登录成功，Token: ${TOKEN:0:20}..."
echo ""

# 2. 创建分享集合
echo "2. 创建分享集合..."
CREATE_RESPONSE=$(curl -s -X POST "$BASE_URL/api/share-collection" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "paths": ["运营部 (OP)/2026.1.3/20260104_AG6MCC.pdf", "运营部 (OP)/2026.1.3/20260104_clashmeta1.jpg"],
    "name": "测试分享集合",
    "password": "test123",
    "expiresIn": 7
  }')

echo "响应: $CREATE_RESPONSE"

SHARE_TOKEN=$(echo $CREATE_RESPONSE | grep -o '"token":"[^"]*' | cut -d'"' -f4)
SHARE_URL=$(echo $CREATE_RESPONSE | grep -o '"shareUrl":"[^"]*' | cut -d'"' -f4)

if [ -z "$SHARE_TOKEN" ]; then
    echo "❌ 创建分享失败！"
    exit 1
fi

echo "✅ 分享创建成功！"
echo "Token: $SHARE_TOKEN"
echo "URL: $SHARE_URL"
echo ""

# 3. 访问分享集合（无密码 - 应该失败）
echo "3. 测试访问分享（无密码）..."
ACCESS_RESPONSE=$(curl -s "$BASE_URL/api/share-collection/$SHARE_TOKEN")
echo "响应: $ACCESS_RESPONSE"
echo ""

# 4. 访问分享集合（有密码）
echo "4. 测试访问分享（有密码）..."
ACCESS_RESPONSE=$(curl -s "$BASE_URL/api/share-collection/$SHARE_TOKEN?password=test123")
echo "响应: $ACCESS_RESPONSE"
echo ""

# 5. 查看我的分享列表
echo "5. 查看我的分享列表..."
LIST_RESPONSE=$(curl -s "$BASE_URL/api/my-share-collections" \
  -H "Authorization: Bearer $TOKEN")
echo "响应: $LIST_RESPONSE"
echo ""

# 6. 下载分享集合为zip（保存到文件）
echo "6. 下载分享集合为zip..."
curl -s "$BASE_URL/api/share-collection/$SHARE_TOKEN/download?password=test123" \
  -o "test_share_download.zip"

if [ -f "test_share_download.zip" ]; then
    SIZE=$(ls -lh test_share_download.zip | awk '{print $5}')
    echo "✅ 下载成功！文件大小: $SIZE"
    echo "可以用 'unzip test_share_download.zip' 查看内容"
else
    echo "❌ 下载失败！"
fi

echo ""
echo "=== 测试完成 ==="
