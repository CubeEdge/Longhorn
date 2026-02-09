#!/usr/bin/env python3
"""
修复MAVO Edge 6K PDF操作说明书的编码问题
并重新提取内容到数据库
"""

import sqlite3
import sys
import os

# 字符映射表（乱码 → 正确字符）
CHAR_MAP = {
    '弼': '当',
    '丌': '不',
    '迕': '进',
    '劢': '动',
    '返': '这',
    '秱': '移',
    '卐': '卓',
    '巫': '已',
    '乊': '之',
    '叏': '取',
    '吭': '启',
    '项': '须',
    '枂': '析',
    '轲': '载',
    '匘': '匹',
    '览': '浏',
    '劣': '助',
    '亍': '于',
    '卑': '单',
}

def fix_text(text):
    """修复文本中的乱码字符"""
    if not text:
        return text
    
    for wrong, correct in CHAR_MAP.items():
        text = text.replace(wrong, correct)
    
    return text

def fix_database_content(db_path):
    """修复数据库中所有Manual类文章的content和summary"""
    
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    # 获取所有Manual类文章
    cursor.execute("""
        SELECT id, title, summary, content 
        FROM knowledge_articles 
        WHERE category = 'Manual'
    """)
    
    articles = cursor.fetchall()
    print(f"找到 {len(articles)} 篇Manual类文章")
    
    fixed_count = 0
    for article_id, title, summary, content in articles:
        # 修复标题、摘要和正文
        fixed_title = fix_text(title)
        fixed_summary = fix_text(summary)
        fixed_content = fix_text(content)
        
        # 检查是否有变化
        if fixed_title != title or fixed_summary != summary or fixed_content != content:
            cursor.execute("""
                UPDATE knowledge_articles 
                SET title = ?, summary = ?, content = ?
                WHERE id = ?
            """, (fixed_title, fixed_summary, fixed_content, article_id))
            fixed_count += 1
            print(f"✓ 修复文章 #{article_id}: {title[:30]}...")
    
    conn.commit()
    conn.close()
    
    print(f"\n✅ 完成！共修复 {fixed_count} 篇文章")
    return fixed_count

if __name__ == '__main__':
    if len(sys.argv) < 2:
        print("Usage: python fix_pdf_encoding.py <database_path>")
        sys.exit(1)
    
    db_path = sys.argv[1]
    
    if not os.path.exists(db_path):
        print(f"错误：数据库文件不存在: {db_path}")
        sys.exit(1)
    
    fix_database_content(db_path)
