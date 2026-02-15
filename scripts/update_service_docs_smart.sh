#!/bin/bash

# 智能Service文档更新脚本
# 基于代码变更自动分析并更新PRD和API文档

set -e

echo "🤖 开始智能分析文档更新..."

# 获取当前时间
CURRENT_TIME=$(date '+%Y-%m-%d %H:%M:%S')
CURRENT_DATE=$(date '+%Y-%m-%d')

# 文档路径
SERVICE_PRD="docs/Service_PRD.md"
SERVICE_API="docs/Service_API.md"

echo "📝 分析时间: $CURRENT_TIME"

# 获取最近一次提交的变更文件
get_changed_files() {
    echo "🔍 分析最近代码变更..."
    CHANGED_FILES=$(git diff --name-only HEAD~1 HEAD 2>/dev/null || echo "")
    if [ -z "$CHANGED_FILES" ]; then
        # 如果没有上一次提交，获取工作区变更
        CHANGED_FILES=$(git diff --name-only HEAD 2>/dev/null || echo "")
    fi
    echo "$CHANGED_FILES"
}

# 分析变更类型
analyze_changes() {
    local files="$1"
    echo "📊 变更分析结果:"
    
    # 统计各类文件变更
    ROUTE_CHANGES=$(echo "$files" | grep -c "routes/" 2>/dev/null || echo "0")
    COMPONENT_CHANGES=$(echo "$files" | grep -c "components/" 2>/dev/null || echo "0")
    SERVICE_CHANGES=$(echo "$files" | grep -c "service/" 2>/dev/null || echo "0")
    MODEL_CHANGES=$(echo "$files" | grep -c -E "(models|schemas)" 2>/dev/null || echo "0")
    API_CHANGES=$(echo "$files" | grep -c -E "\.(js|ts)$" 2>/dev/null || echo "0")
    
    echo "  - 路由文件变更: $ROUTE_CHANGES 个"
    echo "  - 组件文件变更: $COMPONENT_CHANGES 个" 
    echo "  - 服务文件变更: $SERVICE_CHANGES 个"
    echo "  - 数据模型变更: $MODEL_CHANGES 个"
    echo "  - API相关变更: $API_CHANGES 个"
}

# 智能提取变更内容
extract_change_details() {
    local files="$1"
    echo "🔍 提取变更详情..."
    
    # 创建临时分析文件
    ANALYSIS_TEMP=$(mktemp)
    
    # 分析路由变更
    echo "### 路由变更分析" >> "$ANALYSIS_TEMP"
    for file in $files; do
        if [[ "$file" =~ routes/ ]]; then
            echo "#### $file" >> "$ANALYSIS_TEMP"
            # 提取新增的路由和方法
            grep -E "router\.(get|post|put|delete)" "$file" 2>/dev/null | head -5 >> "$ANALYSIS_TEMP" 2>/dev/null || echo "    [无法提取路由信息]" >> "$ANALYSIS_TEMP"
            echo "" >> "$ANALYSIS_TEMP"
        fi
    done
    
    # 分析组件变更
    echo "### 组件变更分析" >> "$ANALYSIS_TEMP"
    for file in $files; do
        if [[ "$file" =~ components/ ]]; then
            echo "#### $file" >> "$ANALYSIS_TEMP"
            # 提取组件功能描述
            grep -E "(功能|实现|用途)" "$file" 2>/dev/null | head -3 >> "$ANALYSIS_TEMP" 2>/dev/null || echo "    [组件功能待分析]" >> "$ANALYSIS_TEMP"
            echo "" >> "$ANALYSIS_TEMP"
        fi
    done
    
    # 分析服务变更
    echo "### 服务变更分析" >> "$ANALYSIS_TEMP"
    for file in $files; do
        if [[ "$file" =~ service/ ]]; then
            echo "#### $file" >> "$ANALYSIS_TEMP"
            # 提取服务功能变更
            git diff HEAD~1 -- "$file" 2>/dev/null | grep -E "^\+" | grep -v "//" | head -10 >> "$ANALYSIS_TEMP" 2>/dev/null || echo "    [服务变更待分析]" >> "$ANALYSIS_TEMP"
            echo "" >> "$ANALYSIS_TEMP"
        fi
    done
    
    cat "$ANALYSIS_TEMP"
    rm "$ANALYSIS_TEMP"
}

# 智能更新PRD文档
update_prd_intelligently() {
    echo "📄 智能更新 Service_PRD.md..."
    
    if [ ! -f "$SERVICE_PRD" ]; then
        echo "❌ PRD文件不存在: $SERVICE_PRD"
        return 1
    fi
    
    TEMP_FILE=$(mktemp)
    
    # 提取当前PRD的基本信息
    VERSION=$(grep -E "^版本:" "$SERVICE_PRD" | head -1 | cut -d: -f2 | xargs || echo "1.0.0")
    TITLE=$(grep -E "^# " "$SERVICE_PRD" | head -1 | sed 's/^# *//' || echo "产品服务闭环系统 - 需求文档")
    
    # 获取变更分析
    CHANGED_FILES=$(get_changed_files)
    analyze_changes "$CHANGED_FILES"
    
    # 创建智能更新内容
    cat > "$TEMP_FILE" << EOF
# $TITLE

**版本**: $VERSION → $(echo $VERSION | awk -F. '{$NF++; print $0}' OFS=.)
**状态**: 待确认
**最后更新**: $CURRENT_TIME

> **智能更新分析**：
> - 基于 $(echo "$CHANGED_FILES" | wc -l | xargs) 个文件的变更自动分析
> - 检测到 $(echo "$CHANGED_FILES" | grep -c "routes/" 2>/dev/null || echo "0") 个路由变更
> - 检测到 $(echo "$CHANGED_FILES" | grep -c "components/" 2>/dev/null || echo "0") 个组件变更
> - 检测到 $(echo "$CHANGED_FILES" | grep -c "service/" 2>/dev/null || echo "0") 个服务变更

## 🔄 本次智能更新内容

### 变更概览
$(analyze_changes "$CHANGED_FILES" | sed 's/^/    /')

### 详细变更分析
$(extract_change_details "$CHANGED_FILES")

### 功能需求更新
#### 新增功能特性
- [ ] 基于代码变更自动识别新增功能
- [ ] 更新用户场景描述
- [ ] 补充业务流程说明

#### 修改的功能逻辑
- [ ] 识别现有功能的变更点
- [ ] 更新相关业务规则
- [ ] 调整用户操作流程

### 非功能性需求
- [ ] 性能要求更新
- [ ] 安全性增强
- [ ] 兼容性说明

---
EOF
    
    # 保留原有PRD内容（除去头部）
    awk '
    /^#\s+/ && NR > 1 { printing = 1 }
    printing { print }
    !printing && /^版本:|^状态:|^最后更新:/ { next }
    !printing && /^>.*智能更新/ { next }
    ' "$SERVICE_PRD" >> "$TEMP_FILE"
    
    mv "$TEMP_FILE" "$SERVICE_PRD"
    echo "✅ Service PRD 智能更新完成"
}

# 智能更新API文档
update_api_intelligently() {
    echo "📄 智能更新 Service_API.md..."
    
    if [ ! -f "$SERVICE_API" ]; then
        echo "❌ API文档不存在: $SERVICE_API"
        return 1
    fi
    
    TEMP_FILE=$(mktemp)
    
    # 提取当前API文档信息
    VERSION=$(grep -E "^版本:" "$SERVICE_API" | head -1 | cut -d: -f2 | xargs || echo "1.0.0")
    TITLE=$(grep -E "^# " "$SERVICE_API" | head -1 | sed 's/^# *//' || echo "产品服务系统 - API 设计文档")
    
    # 获取变更分析
    CHANGED_FILES=$(get_changed_files)
    
    # 创建智能更新内容
    cat > "$TEMP_FILE" << EOF
# $TITLE

**版本**: $VERSION → $(echo $VERSION | awk -F. '{$NF++; print $0}' OFS=.)
**状态**: 草稿
**最后更新**: $CURRENT_TIME
**关联PRD**: Service_PRD.md (自动同步)
**关联场景**: Service_UserScenarios.md (自动同步)

> **智能API更新分析**：
> - 基于 $(echo "$CHANGED_FILES" | wc -l | xargs) 个文件变更自动分析
> - 检测路由文件变更：$(echo "$CHANGED_FILES" | grep -c "routes/" 2>/dev/null || echo "0") 个
> - 检测服务文件变更：$(echo "$CHANGED_FILES" | grep -c "service/" 2>/dev/null || echo "0") 个
> - 自动提取新增/修改的API接口

## 🔄 本次API智能更新

### 接口变更概览
$(echo "$CHANGED_FILES" | grep "routes/" | while read route; do
    if [ -f "$route" ]; then
        endpoints=$(grep -E "router\.(get|post|put|delete)" "$route" 2>/dev/null | wc -l | xargs)
        echo "- $route: $endpoints 个接口"
    fi
done)

### 新增API接口
$(echo "$CHANGED_FILES" | grep "routes/" | while read route; do
    if [ -f "$route" ]; then
        echo "#### $route"
        git diff HEAD~1 -- "$route" 2>/dev/null | grep -E "^\+" | grep "router\." | head -5 | sed 's/^+/    /' 2>/dev/null || echo "    [暂无新增接口信息]"
        echo ""
    fi
done)

### 修改的API接口
$(echo "$CHANGED_FILES" | grep "routes/" | while read route; do
    if [ -f "$route" ]; then
        echo "#### $route"
        git diff HEAD~1 -- "$route" 2>/dev/null | grep -E "^[+-]" | grep -v "^+++" | grep -v "^---" | head -10 | sed 's/^+/    新增: /; s/^-/    删除: /' 2>/dev/null || echo "    [暂无修改信息]"
        echo ""
    fi
done)

### 数据模型变更
$(echo "$CHANGED_FILES" | grep -E "(models|schemas)" | while read model; do
    if [ -f "$model" ]; then
        echo "#### $model"
        git diff HEAD~1 -- "$model" 2>/dev/null | grep -E "^[+-]" | head -8 | sed 's/^+/    新增: /; s/^-/    删除: /' 2>/dev/null || echo "    [暂无模型变更]"
        echo ""
    fi
done)

### 待完善内容
- [ ] 补充详细的请求/响应示例
- [ ] 更新错误码定义
- [ ] 完善权限控制说明
- [ ] 添加接口测试用例

---
EOF
    
    # 保留原有API文档内容（除去头部）
    awk '
    /^#\s+/ && NR > 1 { printing = 1 }
    printing { print }
    !printing && /^版本:|^状态:|^最后更新:/ { next }
    !printing && /^>.*智能API更新/ { next }
    ' "$SERVICE_API" >> "$TEMP_FILE"
    
    mv "$TEMP_FILE" "$SERVICE_API"
    echo "✅ Service API 智能更新完成"
}

# 主执行流程
main() {
    CHANGED_FILES=$(get_changed_files)
    
    if [ -z "$CHANGED_FILES" ]; then
        echo "⚠️  未检测到代码变更，跳过智能分析"
        return 0
    fi
    
    echo "🎯 检测到以下文件变更:"
    echo "$CHANGED_FILES" | sed 's/^/  - /'
    echo ""
    
    # 执行智能更新
    update_prd_intelligently
    update_api_intelligently
    
    echo ""
    echo "🎉 智能文档更新完成！"
    echo "📊 更新摘要:"
    echo "  - Service PRD: $SERVICE_PRD"
    echo "  - Service API: $SERVICE_API"
    echo ""
    echo "💡 建议下一步:"
    echo "  1. 仔细审核自动生成的变更分析内容"
    echo "  2. 补充具体的业务逻辑和实现细节"
    echo "  3. 验证API接口定义的准确性"
    echo "  4. 完善用户场景和测试用例"
    echo "  5. 提交文档变更到 Git"
}

# 执行主函数
main
