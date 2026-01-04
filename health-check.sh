#!/bin/bash
# Longhorn 服务健康检查和自动恢复脚本

COLOR_GREEN='\033[0;32m'
COLOR_RED='\033[0;31m'
COLOR_YELLOW='\033[1;33m'
COLOR_NC='\033[0m' # No Color

echo "========================================="
echo "Longhorn 服务健康检查"
echo "========================================="

# 检查后端服务 (端口 4000)
check_backend() {
    if lsof -Pi :4000 -sTCP:LISTEN -t >/dev/null 2>&1; then
        echo -e "${COLOR_GREEN}✓ 后端服务运行正常 (端口 4000)${COLOR_NC}"
        return 0
    else
        echo -e "${COLOR_RED}✗ 后端服务未运行${COLOR_NC}"
        return 1
    fi
}

# 检查前端服务 (端口 3001)
check_frontend() {
    if lsof -Pi :3001 -sTCP:LISTEN -t >/dev/null 2>&1; then
        echo -e "${COLOR_GREEN}✓ 前端服务运行正常 (端口 3001)${COLOR_NC}"
        return 0
    else
        echo -e "${COLOR_RED}✗ 前端服务未运行${COLOR_NC}"
        return 1
    fi
}

# 检查数据库完整性
check_database() {
    echo "检查数据库完整性..."
    
    # 检查必需的列
    required_columns=("last_login")
    
    for col in "${required_columns[@]}"; do
        if sqlite3 server/longhorn.db "PRAGMA table_info(users);" | grep -q "$col"; then
            echo -e "${COLOR_GREEN}✓ 数据库列 '$col' 存在${COLOR_NC}"
        else
            echo -e "${COLOR_YELLOW}⚠ 数据库列 '$col' 缺失，正在添加...${COLOR_NC}"
            sqlite3 server/longhorn.db "ALTER TABLE users ADD COLUMN $col TEXT;" 2>/dev/null
            sqlite3 server/longhorn.db "UPDATE users SET $col = datetime('now') WHERE $col IS NULL;"
            echo -e "${COLOR_GREEN}✓ 已添加并初始化 '$col' 列${COLOR_NC}"
        fi
    done
}

# 启动后端服务
start_backend() {
    echo -e "${COLOR_YELLOW}正在启动后端服务...${COLOR_NC}"
    cd server
    npm run dev > /dev/null 2>&1 &
    cd ..
    sleep 3
    if check_backend; then
        echo -e "${COLOR_GREEN}✓ 后端服务启动成功${COLOR_NC}"
    else
        echo -e "${COLOR_RED}✗ 后端服务启动失败${COLOR_NC}"
    fi
}

# 启动前端服务
start_frontend() {
    echo -e "${COLOR_YELLOW}正在启动前端服务...${COLOR_NC}"
    cd client
    npm run dev > /dev/null 2>&1 &
    cd ..
    sleep 3
    if check_frontend; then
        echo -e "${COLOR_GREEN}✓ 前端服务启动成功${COLOR_NC}"
    else
        echo -e "${COLOR_RED}✗ 前端服务启动失败${COLOR_NC}"
    fi
}

# 主检查流程
main() {
    # 1. 检查数据库
    check_database
    echo ""
    
    # 2. 检查后端
    if ! check_backend; then
        read -p "是否启动后端服务? (y/n) " -n 1 -r
        echo
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            start_backend
        fi
    fi
    echo ""
    
    # 3. 检查前端
    if ! check_frontend; then
        read -p "是否启动前端服务? (y/n) " -n 1 -r
        echo
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            start_frontend
        fi
    fi
    
    echo ""
    echo "========================================="
    echo "健康检查完成"
    echo "========================================="
    echo "访问地址: http://localhost:3001"
}

main
