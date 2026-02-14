#!/bin/bash

# 文档更新快捷命令集合
# 提供一键更新文档的便捷方式

case "$1" in
    "core")
        echo "🚀 执行核心文档更新..."
        ./scripts/update_core_docs.sh
        ;;
    "service")
        echo "🚀 执行 Service 文档更新..."
        ./scripts/update_service_docs.sh
        ;;
    "all")
        echo "🚀 执行全部文档更新..."
        ./scripts/update_core_docs.sh
        ./scripts/update_service_docs.sh
        ;;
    "help"|*)
        echo "📖 文档更新工具使用说明"
        echo ""
        echo "用法: ./scripts/update_docs.sh [选项]"
        echo ""
        echo "选项:"
        echo "  core     - 更新核心文档 (1_Backlog.md, 2_PromptLog.md, 4_DevLog.md)"
        echo "  service  - 更新 Service 模块文档 (Service_PRD.md, Service_API.md)"
        echo "  all      - 更新所有文档"
        echo "  help     - 显示此帮助信息"
        echo ""
        echo "示例:"
        echo "  ./scripts/update_docs.sh core"
        echo "  ./scripts/update_docs.sh service"
        echo "  ./scripts/update_docs.sh all"
        ;;
esac