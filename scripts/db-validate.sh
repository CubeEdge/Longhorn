#!/bin/bash
# 数据库结构验证和自动修复脚本

DB_PATH="server/longhorn.db"

echo "========================================="
echo "数据库结构验证"
echo "========================================="

# 定义必需的表结构
declare -A REQUIRED_COLUMNS

# users 表必需的列
REQUIRED_COLUMNS[users]="id username password role department_id last_login"

# 检查并修复表结构
check_and_fix_table() {
    local table=$1
    local columns=${REQUIRED_COLUMNS[$table]}
    
    echo "检查表: $table"
    
    for col in $columns; do
        if sqlite3 "$DB_PATH" "PRAGMA table_info($table);" | grep -q "\\b$col\\b"; then
            echo "  ✓ 列 '$col' 存在"
        else
            echo "  ⚠ 列 '$col' 缺失，正在添加..."
            
            # 根据列名确定类型和默认值
            case $col in
                last_login)
                    sqlite3 "$DB_PATH" "ALTER TABLE $table ADD COLUMN $col TEXT;"
                    sqlite3 "$DB_PATH" "UPDATE $table SET $col = datetime('now') WHERE $col IS NULL;"
                    ;;
                *)
                    echo "  ✗ 未知列类型: $col"
                    ;;
            esac
        fi
    done
}

# 验证所有表
for table in "${!REQUIRED_COLUMNS[@]}"; do
    check_and_fix_table "$table"
    echo ""
done

echo "========================================="
echo "数据库验证完成"
echo "========================================="
