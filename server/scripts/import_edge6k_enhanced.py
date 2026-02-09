#!/usr/bin/env python3
"""
将增强版PDF提取结果导入数据库
"""

import sys
import os
import json
import sqlite3
import subprocess
from pathlib import Path
import re

def generate_slug(title):
    """生成URL友好的slug"""
    # 移除特殊字符
    slug = re.sub(r'[^\w\s\-\u4e00-\u9fff]', '', title)
    slug = re.sub(r'[\s_]+', '-', slug)
    return slug.lower()[:100]

def main():
    # 支持本地和远程两种模式
    is_remote = len(sys.argv) > 1 and sys.argv[1] == '--remote'
    
    if is_remote:
        pdf_path = "/Users/admin/Documents/server/Longhorn/input docs/MAVO Edge 6K操作说明书(KineOS8.0)_C34-102-8016_2024.12.19_v0.11_convert.pdf"
        output_dir = "/Users/admin/Documents/server/Longhorn/server/data/knowledge_images"
        db_path = "/Users/admin/Documents/server/Longhorn/server/longhorn.db"
    else:
        pdf_path = "/Users/Kine/Documents/Kinefinity/KineCore/Pool/qoder/Longhorn/input docs/MAVO Edge 6K操作说明书(KineOS8.0)_C34-102-8016_2024.12.19_v0.11_convert.pdf"
        output_dir = "/Users/Kine/Documents/Kinefinity/KineCore/Pool/qoder/Longhorn/server/data/knowledge_images"
        db_path = "/Users/Kine/Documents/Kinefinity/KineCore/Pool/qoder/Longhorn/server/longhorn.db"
    
    print("[1/3] 提取PDF内容（基于书签）...")
    script_path = Path(__file__).parent / "extract_pdf_with_toc.py"
    result = subprocess.run(
        ['python3', str(script_path), pdf_path, output_dir],
        capture_output=True,
        text=True
    )
    
    if result.returncode != 0:
        print(f"❌ 提取失败: {result.stderr}")
        sys.exit(1)
    
    # 解析JSON输出（stderr是进度信息，stdout是JSON）
    data = json.loads(result.stdout)
    
    if not data.get('success'):
        print(f"❌ 提取失败: {data.get('error', 'Unknown error')}")
        sys.exit(1)
    
    sections = data['sections']
    print(f"✅ 提取了 {len(sections)} 个章节")
    
    print("[2/3] 连接数据库...")
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    # 获取admin用户ID
    cursor.execute("SELECT id FROM users WHERE username = 'admin' OR id = 1 LIMIT 1")
    admin_row = cursor.fetchone()
    if not admin_row:
        print("❌ 未找到Admin用户，使用默认ID=1")
        admin_id = 1
    else:
        admin_id = admin_row[0]
    
    print(f"[3/3] 导入 {len(sections)} 个章节到数据库...")
    
    insert_sql = """
    INSERT INTO knowledge_articles (
        title, slug, summary, content, category, subcategory,
        product_line, product_models, visibility, status, created_by
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    """
    
    imported = 0
    for idx, section in enumerate(sections, 1):
        title = section['title'] or f"章节 {idx}"
        slug = generate_slug(f"mavo-edge-6k-{title}")
        
        # 使用content的前200字符作为摘要
        content = section['content']
        summary_text = content.replace('\n', ' ').strip()[:200]
        if len(summary_text) == 200:
            summary_text += "..."
        
        try:
            cursor.execute(insert_sql, (
                f"MAVO Edge 6K: {title}",
                slug,
                summary_text,
                content,
                'Manual',
                '操作手册',
                'A',  # 产品线代码
                '["MAVO Edge 6K"]',  # JSON数组格式
                'Public',  # 说明书默认Public
                'Published',
                admin_id
            ))
            imported += 1
            if imported % 20 == 0:
                print(f"      已导入 {imported}/{len(sections)}...")
        except Exception as e:
            print(f"⚠️  导入失败 [{title}]: {e}")
    
    conn.commit()
    conn.close()
    
    print(f"✅ 成功导入 {imported} 篇文章到本地数据库")
    print(f"📊 统计: {data['stats']['images']}张图片, {imported}个章节")

if __name__ == '__main__':
    main()
