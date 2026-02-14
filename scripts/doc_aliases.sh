#!/bin/bash

# 快捷文档更新命令别名
# 使用方法：
# source ./scripts/doc_aliases.sh
# 然后就可以使用 ./doc* 命令

# 核心文档更新 (Backlog/PromptLog/DevLog)
alias ./doclog='./scripts/update_docs.sh core'

# Service 模块文档更新 (PRD/API)  
alias ./docs='./scripts/update_docs.sh service'

# 全部文档更新
alias ./docall='./scripts/update_docs.sh all'

# 显示所有文档命令
alias ./dochelp='./scripts/update_docs.sh help'

echo "📚 文档更新快捷命令已加载！"
echo "可用命令："
echo "  ./doclog  - 更新核心文档 (Backlog/PromptLog/DevLog)"
echo "  ./docs    - 更新 Service 模块文档 (PRD/API)"
echo "  ./docall  - 更新所有文档"
echo "  ./dochelp - 显示帮助信息"
echo ""
echo "💡 使用方法：source ./scripts/doc_aliases.sh"