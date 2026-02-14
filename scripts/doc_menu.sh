#!/bin/bash

# 交互式文档更新工具
# 提供更友好的命令行界面

show_menu() {
    echo "=================================="
    echo "     📚 文档更新工具"
    echo "=================================="
    echo "1. 更新核心文档 (Backlog/PromptLog/DevLog)"
    echo "2. 更新 Service 模块文档 (PRD/API)"
    echo "3. 更新所有文档"
    echo "4. 显示帮助信息"
    echo "5. 退出"
    echo "=================================="
    echo -n "请选择操作 (1-5): "
}

while true; do
    show_menu
    read choice
    
    case $choice in
        1)
            echo "🚀 执行核心文档更新..."
            ./scripts/update_docs.sh core
            echo "✅ 核心文档更新完成！"
            ;;
        2)
            echo "🚀 执行 Service 文档更新..."
            ./scripts/update_docs.sh service
            echo "✅ Service 文档更新完成！"
            ;;
        3)
            echo "🚀 执行全部文档更新..."
            ./scripts/update_docs.sh all
            echo "✅ 全部文档更新完成！"
            ;;
        4)
            ./scripts/update_docs.sh help
            ;;
        5)
            echo "👋 再见！"
            break
            ;;
        *)
            echo "❌ 无效选择，请输入 1-5"
            ;;
    esac
    
    echo ""
    echo "按回车键继续..."
    read
done