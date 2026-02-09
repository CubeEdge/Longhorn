#!/usr/bin/env python3
"""
从Markdown文件导入知识库
- 按标题层级分割章节
- 保留完整Markdown格式
- 图片、表格、列表原生支持
"""

import sys
import os
import sqlite3
import re
from pathlib import Path

def generate_slug(title):
    """生成URL友好的slug"""
    slug = re.sub(r'[^\w\s\-\u4e00-\u9fff]', '', title)
    slug = re.sub(r'[\s_]+', '-', slug)
    return slug.lower()[:100]

def parse_markdown_sections(md_content):
    """按标题解析Markdown章节"""
    sections = []
    
    # 按标题分割（支持# ## ###）
    parts = re.split(r'^(#{1,3}\s+.+)$', md_content, flags=re.MULTILINE)
    
    current_section = None
    
    for i, part in enumerate(parts):
        part = part.strip()
        if not part:
            continue
        
        # 检测是否是标题
        heading_match = re.match(r'^(#{1,3})\s+(.+)$', part)
        
        if heading_match:
            # 保存上一个章节
            if current_section and current_section['content'].strip():
                sections.append(current_section)
            
            # 开始新章节
            level = len(heading_match.group(1))
            title = heading_match.group(2).strip()
            
            # 清理标题中的锚点链接
            title = re.sub(r'<a id="[^"]+"></a>', '', title)
            title = re.sub(r'\[([^\]]+)\]\([^\)]+\)', r'\1', title)
            title = title.strip()
            
            current_section = {
                'title': title,
                'level': level,
                'content': f"{'#' * level} {title}\n\n"
            }
        else:
            # 添加到当前章节内容
            if current_section:
                current_section['content'] += part + '\n\n'
    
    # 保存最后一个章节
    if current_section and current_section['content'].strip():
        sections.append(current_section)
    
    return sections

def import_to_database(sections, db_path, product_line='A', product_models='["MAVO Edge 6K"]'):
    """导入章节到数据库"""
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    # 获取admin用户ID
    cursor.execute("SELECT id FROM users WHERE username = 'admin' OR id = 1 LIMIT 1")
    admin_row = cursor.fetchone()
    admin_id = admin_row[0] if admin_row else 1
    
    insert_sql = """
    INSERT INTO knowledge_articles (
        title, slug, summary, content, category, subcategory,
        product_line, product_models, visibility, status, created_by
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    """
    
    imported = 0
    for section in sections:
        title = f"MAVO Edge 6K: {section['title']}"
        slug = generate_slug(section['title'])
        content = section['content']
        
        # 生成摘要（取前200字符，移除Markdown语法和图片）
        summary_text = re.sub(r'!\[.*?\]\([^)]*\)', '', content)  # 移除图片
        summary_text = re.sub(r'[#*\[\]]', '', summary_text)  # 移除其他Markdown语法
        summary_text = re.sub(r'\s+', ' ', summary_text).strip()[:200]
        if len(summary_text) == 200:
            summary_text += "..."
        
        try:
            cursor.execute(insert_sql, (
                title,
                slug,
                summary_text,
                content,
                'Manual',
                '操作手册',
                product_line,
                product_models,
                'Public',
                'Published',
                admin_id
            ))
            imported += 1
            if imported % 10 == 0:
                print(f"      已导入 {imported}/{len(sections)}...")
        except Exception as e:
            print(f"⚠️  导入失败 [{title}]: {e}")
    
    conn.commit()
    conn.close()
    
    return imported

def main():
    if len(sys.argv) < 3:
        print("Usage: python3 import_from_markdown.py <md_path> <db_path> [--remote]")
        sys.exit(1)
    
    md_path = sys.argv[1]
    db_path = sys.argv[2]
    
    if not os.path.exists(md_path):
        print(f"❌ Markdown文件不存在: {md_path}")
        sys.exit(1)
    
    if not os.path.exists(db_path):
        print(f"❌ 数据库不存在: {db_path}")
        sys.exit(1)
    
    print(f"[1/3] 读取Markdown文件: {md_path}")
    with open(md_path, 'r', encoding='utf-8') as f:
        md_content = f.read()
    
    print(f"[2/3] 解析章节...")
    sections = parse_markdown_sections(md_content)
    print(f"✅ 解析了 {len(sections)} 个章节")
    
    print(f"[3/3] 导入到数据库...")
    imported = import_to_database(sections, db_path)
    
    print(f"\n✅ 成功导入 {imported} 篇文章到数据库")
    print(f"📊 统计: {len(sections)} 个章节")

if __name__ == '__main__':
    main()
