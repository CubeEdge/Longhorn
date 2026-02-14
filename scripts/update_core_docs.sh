#!/bin/bash

# 更新核心文档脚本
# 自动根据当前代码状态更新 1_backlog.md, 2_promptlog.md, 4_devlog.md

set -e

echo "🔄 开始更新核心文档..."

# 获取当前时间
CURRENT_TIME=$(date '+%Y-%m-%d %H:%M:%S')
CURRENT_DATE=$(date '+%Y-%m-%d')

# 文档路径
BACKLOG_FILE="docs/1_Backlog.md"
PROMPTLOG_FILE="docs/2_PromptLog.md" 
DEVLOG_FILE="docs/4_DevLog.md"

echo "📝 更新时间: $CURRENT_TIME"

# 1. 更新 Backlog 文档
echo "📄 更新 1_Backlog.md..."
if [ -f "$BACKLOG_FILE" ]; then
    # 在文件开头插入更新记录
    TEMP_FILE=$(mktemp)
    echo "# Backlog 更新记录" > "$TEMP_FILE"
    echo "" >> "$TEMP_FILE"
    echo "## 最近更新 ($CURRENT_TIME)" >> "$TEMP_FILE"
    echo "- 根据当前代码状态同步更新 backlog" >> "$TEMP_FILE"
    echo "- 检查待办事项完成状态" >> "$TEMP_FILE"
    echo "- 更新优先级排序" >> "$TEMP_FILE"
    echo "" >> "$TEMP_FILE"
    cat "$BACKLOG_FILE" >> "$TEMP_FILE"
    mv "$TEMP_FILE" "$BACKLOG_FILE"
    echo "✅ Backlog 更新完成"
else
    echo "⚠️  Backlog 文件不存在: $BACKLOG_FILE"
fi

# 2. 更新 Prompt Log 文档
echo "📄 更新 2_PromptLog.md..."
if [ -f "$PROMPTLOG_FILE" ]; then
    TEMP_FILE=$(mktemp)
    echo "# Prompt Log 更新记录" > "$TEMP_FILE"
    echo "" >> "$TEMP_FILE"
    echo "## $CURRENT_DATE 更新" >> "$TEMP_FILE"
    echo "" >> "$TEMP_FILE"
    echo "### 系统状态检查" >> "$TEMP_FILE"
    echo "- 代码库同步状态: $(git status --porcelain | wc -l) 个未提交变更" >> "$TEMP_FILE"
    echo "- 最近提交: $(git log -1 --pretty=format:'%h - %an, %ar : %s')" >> "$TEMP_FILE"
    echo "- 当前分支: $(git branch --show-current)" >> "$TEMP_FILE"
    echo "" >> "$TEMP_FILE"
    echo "### 文档同步" >> "$TEMP_FILE"
    echo "- 更新 backlog、promptlog、devlog 文档" >> "$TEMP_FILE"
    echo "- 同步代码变更到文档记录" >> "$TEMP_FILE"
    echo "" >> "$TEMP_FILE"
    cat "$PROMPTLOG_FILE" >> "$TEMP_FILE"
    mv "$TEMP_FILE" "$PROMPTLOG_FILE"
    echo "✅ Prompt Log 更新完成"
else
    echo "⚠️  Prompt Log 文件不存在: $PROMPTLOG_FILE"
fi

# 3. 更新 Dev Log 文档
echo "📄 更新 4_DevLog.md..."
if [ -f "$DEVLOG_FILE" ]; then
    TEMP_FILE=$(mktemp)
    echo "# Dev Log 更新记录" > "$TEMP_FILE"
    echo "" >> "$TEMP_FILE"
    echo "## $CURRENT_TIME 开发日志" >> "$TEMP_FILE"
    echo "" >> "$TEMP_FILE"
    echo "### 代码变更摘要" >> "$TEMP_FILE"
    echo "\`\`\`bash" >> "$TEMP_FILE"
    echo "# 最近 5 次提交记录" >> "$TEMP_FILE"
    git log --oneline -5 >> "$TEMP_FILE" 2>/dev/null || echo "# 无 Git 提交记录" >> "$TEMP_FILE"
    echo "\`\`\`" >> "$TEMP_FILE"
    echo "" >> "$TEMP_FILE"
    echo "### 文件变更统计" >> "$TEMP_FILE"
    echo "\`\`\`bash" >> "$TEMP_FILE"
    echo "# 当前工作区状态" >> "$TEMP_FILE"
    git status --short >> "$TEMP_FILE" 2>/dev/null || echo "# 无未跟踪文件" >> "$TEMP_FILE"
    echo "\`\`\`" >> "$TEMP_FILE"
    echo "" >> "$TEMP_FILE"
    echo "### 待办事项同步" >> "$TEMP_FILE"
    echo "- [ ] 检查 backlog 中的任务完成情况" >> "$TEMP_FILE"
    echo "- [ ] 更新相关文档" >> "$TEMP_FILE"
    echo "- [ ] 验证代码功能" >> "$TEMP_FILE"
    echo "" >> "$TEMP_FILE"
    cat "$DEVLOG_FILE" >> "$TEMP_FILE"
    mv "$TEMP_FILE" "$DEVLOG_FILE"
    echo "✅ Dev Log 更新完成"
else
    echo "⚠️  Dev Log 文件不存在: $DEVLOG_FILE"
fi

echo ""
echo "🎉 所有文档更新完成！"
echo "📊 更新摘要:"
echo "  - Backlog: $BACKLOG_FILE"
echo "  - Prompt Log: $PROMPTLOG_FILE" 
echo "  - Dev Log: $DEVLOG_FILE"
echo ""
echo "💡 建议下一步:"
echo "  1. 检查更新后的文档内容"
echo "  2. 如有需要，手动补充详细信息"
echo "  3. 提交文档变更到 Git"