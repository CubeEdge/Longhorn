#!/bin/bash

# Longhorn 自动部署哨兵脚本
# 它会每 60 秒检查一次远程仓库，发现更新即自动部署

echo "📡 自动部署哨兵已启动..."

while true; do
  # 1. 获取远程状态 (不拉取代码)
  git fetch --quiet
  
  # 2. 对比本地与远程的分支状态
  LOCAL=$(git rev-parse HEAD)
  REMOTE=$(git rev-parse @{u})
  
  if [ "$LOCAL" != "$REMOTE" ]; then
    echo "🆕 检测到新代码！开始全自动更新..."
    echo "----------------------------------------------------"
    
    # 执行一键部署
    git pull
    npm run deploy
    
    echo "----------------------------------------------------"
    echo "🛡️ 全自动更新完成，继续监控中..."
  fi
  
  # 3. 每 60 秒检查一次
  sleep 60
done
