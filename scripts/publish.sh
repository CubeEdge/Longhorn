#!/bin/bash

# Longhorn AI 一键发布脚本 (publish.sh)
# 用途: 自动更新日志、记录版本 Hash 并推送到远程仓库

# 颜色定义
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${BLUE}===> Longhorn 一键发布流程开始 <===${NC}"

# 1. 检查是否在 git 目录
if [ ! -d ".git" ]; then
    echo -e "${RED}错误: 当前目录不是 Git 仓库！${NC}"
    exit 1
fi

# 2. 获取提交信息
if [ -z "$1" ]; then
    read -p "请输入本次修改的描述 (Commit Message): " MESSAGE
else
    MESSAGE=$1
fi

if [ -z "$MESSAGE" ]; then
    echo -e "${RED}错误: 提交信息不能为空！${NC}"
    exit 1
fi

# 3. 执行 Git Add
echo -e "${BLUE}正在暂存更改...${NC}"
git add .

# 4. 执行 Commit
echo -e "${BLUE}正在提交代码...${NC}"
git commit -m "$MESSAGE"

# 5. 获取最新 Commit Hash
HASH=$(git rev-parse --short HEAD)
DATE=$(date "+%Y-%m-%d %H:%M")

echo -e "${GREEN}代码已提交，版本号: ${HASH}${NC}"

# 6. 推送到远程
echo -e "${BLUE}正在推送到 GitHub...${NC}"
git push

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓ 推送成功！${NC}"
    echo -e "${YELLOW}提示: 如果 Mac mini 开启了哨兵脚本，更新将在 1 分钟内自动生效。${NC}"
else
    echo -e "${RED}✗ 推送失败，请检查网络或配置。${NC}"
    exit 1
fi

echo -e "${BLUE}===> 发布完成 <===${NC}"
