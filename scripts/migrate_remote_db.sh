#!/bin/bash
# 远程执行数据库迁移

echo "🚀 执行远程数据库迁移..."

ssh admin@ssh.kineraw.com << 'ENDSSH'
    cd /Users/admin/web/Longhorn/server
    
    echo "📝 执行迁移：添加knowledge来源字段..."
    sqlite3 longhorn.db < migrations/add_knowledge_source_fields.sql
    
    echo "✅ 验证字段已添加..."
    sqlite3 longhorn.db "PRAGMA table_info(knowledge_articles);" | grep -i source
    
    echo "✨ 迁移完成！"
ENDSSH

echo "✅ 远程迁移执行完成"
