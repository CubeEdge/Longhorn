#!/bin/bash

# API 测试快捷脚本
# 预定义常用的 API 测试命令

case "$1" in
    "backup")
        echo "🔍 测试备份状态 API..."
        curl -s "https://opware.kineraw.com/api/admin/backup/status" -w "\nHTTP_CODE: %{http_code}\n" | tail -20
        ;;
    "tickets")
        echo "🔍 测试工单 API..."
        curl -s "https://opware.kineraw.com/api/service/inquiry-tickets?time_scope=30d&page=1&page_size=50" -H "Authorization: Bearer test" -w "\nHTTP_CODE: %{http_code}\n" | head -100
        ;;
    "health")
        echo "🔍 测试服务健康状态..."
        curl -s -I "https://opware.kineraw.com/api/health" | head -10
        ;;
    "help"|*)
        echo "🔧 API 测试工具"
        echo "用法: ./apitest.sh [命令]"
        echo ""
        echo "可用命令:"
        echo "  backup   - 测试备份状态 API"
        echo "  tickets  - 测试工单 API"
        echo "  health   - 测试服务健康状态"
        echo "  help     - 显示此帮助"
        ;;
esac