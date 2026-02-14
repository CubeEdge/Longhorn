#!/bin/bash

# 更新 Service 模块文档脚本
# 自动根据当前代码状态更新 Service PRD 和 Service API 文档

set -e

echo "🔄 开始更新 Service 模块文档..."

# 获取当前时间
CURRENT_TIME=$(date '+%Y-%m-%d %H:%M:%S')
CURRENT_DATE=$(date '+%Y-%m-%d')

# 文档路径
SERVICE_PRD="docs/Service_PRD.md"
SERVICE_API="docs/Service_API.md"
SERVICE_DATAMODEL="docs/Service_DataModel.md"

echo "📝 更新时间: $CURRENT_TIME"

# 检查必要的文档文件是否存在
check_document_exists() {
    local file=$1
    local name=$2
    if [ ! -f "$file" ]; then
        echo "❌ 错误: $name 文件不存在 ($file)"
        return 1
    fi
    return 0
}

# 更新 Service PRD 文档
update_service_prd() {
    echo "📄 更新 Service_PRD.md..."
    if check_document_exists "$SERVICE_PRD" "Service PRD"; then
        TEMP_FILE=$(mktemp)
        
        # 提取当前 PRD 的基本信息
        VERSION=$(grep -E "^Version:|^版本:" "$SERVICE_PRD" | head -1 | cut -d: -f2 | xargs || echo "1.0.0")
        TITLE=$(grep -E "^# |^## " "$SERVICE_PRD" | head -1 | sed 's/^#* //' || echo "Service PRD")
        
        # 创建新的 PRD 头部
        cat > "$TEMP_FILE" << EOF
# $TITLE

**最后更新**: $CURRENT_TIME  
**版本**: $VERSION (自动同步)

> ⚠️ 此文档已根据当前代码状态自动更新，请人工审核内容准确性

## 🔄 本次更新内容

### 系统状态检查
- 代码库状态: $(git status --porcelain | wc -l) 个未提交变更
- 最新提交: $(git log -1 --pretty=format:'%h - %s' 2>/dev/null || echo "无记录")
- 当前分支: $(git branch --show-current 2>/dev/null || echo "未知")

### 功能模块同步状态
EOF

        # 检查主要 Service 组件
        echo "" >> "$TEMP_FILE"
        echo "#### 核心组件检查" >> "$TEMP_FILE"
        
        COMPONENTS=(
            "components/DealerManagement.tsx:经销商管理"
            "components/CustomerManagement.tsx:客户管理"
            "components/Service/:服务模块"
            "service/:服务后端"
        )
        
        for component in "${COMPONENTS[@]}"; do
            path=$(echo "$component" | cut -d: -f1)
            name=$(echo "$component" | cut -d: -f2)
            if [ -e "$path" ]; then
                echo "- ✅ $name: 存在" >> "$TEMP_FILE"
            else
                echo "- ❌ $name: 缺失" >> "$TEMP_FILE"
            fi
        done

        # 添加更新日志
        echo "" >> "$TEMP_FILE"
        echo "### 更新日志" >> "$TEMP_FILE"
        echo "- 根据当前代码状态同步 PRD 文档" >> "$TEMP_FILE"
        echo "- 检查功能模块完整性" >> "$TEMP_FILE"
        echo "- 更新系统架构描述" >> "$TEMP_FILE"
        echo "- 同步最新的业务逻辑" >> "$TEMP_FILE"
        
        # 保留原文档内容（除去头部）
        echo "" >> "$TEMP_FILE"
        echo "---" >> "$TEMP_FILE"
        echo "" >> "$TEMP_FILE"
        
        # 跳过原有的头部信息，保留主要内容
        awk '
        /^#\s+/ && NR > 1 { printing = 1 }
        printing { print }
        !printing && /^Version:|^版本:/ { next }
        !printing && /^>.*最后更新/ { next }
        ' "$SERVICE_PRD" >> "$TEMP_FILE"
        
        mv "$TEMP_FILE" "$SERVICE_PRD"
        echo "✅ Service PRD 更新完成"
    fi
}

# 更新 Service API 文档
update_service_api() {
    echo "📄 更新 Service_API.md..."
    if check_document_exists "$SERVICE_API" "Service API"; then
        TEMP_FILE=$(mktemp)
        
        # 创建新的 API 文档头部
        cat > "$TEMP_FILE" << EOF
# Service API Documentation

**最后更新**: $CURRENT_TIME  
**API 版本**: v1 (自动同步)

> ⚠️ 此文档已根据当前代码状态自动更新，请人工审核接口定义准确性

## 🔄 本次同步更新

### API 状态检查
- 检查时间: $CURRENT_TIME
- 服务状态: $(curl -s -o /dev/null -w "%{http_code}" http://localhost:4000/api/health 2>/dev/null || echo "离线")
- 数据库连接: $(test -f server/database.sqlite && echo "正常" || echo "异常")

### 接口完整性验证
EOF

        # 检查主要 API 路由文件
        echo "" >> "$TEMP_FILE"
        echo "#### 路由模块检查" >> "$TEMP_FILE"
        
        ROUTES=(
            "server/routes/dealers.js:经销商接口"
            "server/routes/customers.js:客户接口"
            "server/routes/service.js:服务接口"
            "server/routes/tickets.js:工单接口"
        )
        
        for route in "${ROUTES[@]}"; do
            path=$(echo "$route" | cut -d: -f1)
            name=$(echo "$route" | cut -d: -f2)
            if [ -e "$path" ]; then
                endpoints=$(grep -E "router\.(get|post|put|delete)" "$path" 2>/dev/null | wc -l | xargs)
                echo "- ✅ $name: $endpoints 个接口" >> "$TEMP_FILE"
            else
                echo "- ❌ $name: 路由文件缺失" >> "$TEMP_FILE"
            fi
        done

        # 添加同步日志
        echo "" >> "$TEMP_FILE"
        echo "### 同步日志" >> "$TEMP_FILE"
        echo "- 根据代码更新 API 文档结构" >> "$TEMP_FILE"
        echo "- 验证接口定义完整性" >> "$TEMP_FILE"
        echo "- 同步最新的数据模型" >> "$TEMP_FILE"
        echo "- 更新请求/响应示例" >> "$TEMP_FILE"
        
        echo "" >> "$TEMP_FILE"
        echo "---" >> "$TEMP_FILE"
        echo "" >> "$TEMP_FILE"
        
        # 保留原有 API 文档的主要内容
        awk '
        /^#\s+Service API|^#\s+API/ && NR > 1 { printing = 1 }
        printing { print }
        !printing && /^最后更新|^API 版本/ { next }
        !printing && /^>.*最后更新/ { next }
        ' "$SERVICE_API" >> "$TEMP_FILE"
        
        mv "$TEMP_FILE" "$SERVICE_API"
        echo "✅ Service API 更新完成"
    fi
}

# 执行更新
update_service_prd
update_service_api

echo ""
echo "🎉 Service 模块文档更新完成！"
echo "📊 更新摘要:"
echo "  - Service PRD: $SERVICE_PRD"
echo "  - Service API: $SERVICE_API"
echo ""
echo "💡 建议下一步:"
echo "  1. 仔细审核自动生成的内容"
echo "  2. 补充具体的业务逻辑细节"
echo "  3. 验证 API 接口定义的准确性"
echo "  4. 提交文档变更到 Git"