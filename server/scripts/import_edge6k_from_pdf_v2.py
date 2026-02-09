#!/usr/bin/env python3
"""
从原版PDF导入MAVO Edge 6K操作说明书到知识库
- 正确提取文字（无编码问题）
- 提取图片并保存
- 智能匹配图片到章节
"""

import fitz  # PyMuPDF
import sqlite3
import os
import hashlib
import re
from pathlib import Path
from PIL import Image
import io

# 配置
PDF_PATH = "/Users/Kine/Documents/Kinefinity/KineCore/Pool/qoder/Longhorn/input docs/MAVO Edge 6K操作说明书(KineOS8.0)_C34-102-8016_2024.12.19_v0.1_Jiulong.pdf"
DB_PATH = "/Users/Kine/Documents/Kinefinity/KineCore/Pool/qoder/Longhorn/server/longhorn.db"
IMAGE_OUTPUT_DIR = "/Users/Kine/Documents/Kinefinity/KineCore/Pool/qoder/Longhorn/server/data/knowledge_images"

Path(IMAGE_OUTPUT_DIR).mkdir(parents=True, exist_ok=True)

def extract_images_from_pdf(pdf_doc):
    """提取PDF中的所有图片"""
    images = []
    extracted_hashes = set()
    page_images = {}  # {page_num: [images]}
    
    for page_num in range(pdf_doc.page_count):
        page = pdf_doc[page_num]
        image_list = page.get_images(full=True)
        page_images[page_num + 1] = []
        
        for img_index, img_info in enumerate(image_list):
            xref = img_info[0]
            
            try:
                base_image = pdf_doc.extract_image(xref)
                image_bytes = base_image["image"]
                image_ext = base_image["ext"]
                
                # 计算hash避免重复
                img_hash = hashlib.md5(image_bytes).hexdigest()[:12]
                if img_hash in extracted_hashes:
                    continue
                extracted_hashes.add(img_hash)
                
                # 打开图片获取尺寸
                img = Image.open(io.BytesIO(image_bytes))
                width, height = img.size
                
                # 跳过小图（图标、装饰）
                if width < 80 or height < 80:
                    continue
                
                # 生成文件名
                filename = f"edge6k_p{page_num + 1}_{img_hash}.png"
                filepath = os.path.join(IMAGE_OUTPUT_DIR, filename)
                
                # 保存为PNG
                if image_ext != "png":
                    if img.mode not in ('RGB', 'RGBA', 'L'):
                        img = img.convert('RGB')
                    img.save(filepath, "PNG")
                else:
                    with open(filepath, "wb") as f:
                        f.write(image_bytes)
                
                img_info_dict = {
                    'page': page_num + 1,
                    'filename': filename,
                    'width': width,
                    'height': height,
                    'path': f'/data/knowledge_images/{filename}'
                }
                
                images.append(img_info_dict)
                page_images[page_num + 1].append(img_info_dict)
                
                print(f"  ✓ 第{page_num + 1}页: {filename} ({width}x{height})")
                
            except Exception as e:
                print(f"  ⚠ 第{page_num + 1}页图片提取失败: {e}")
                continue
    
    return images, page_images

def parse_chapters_from_pdf(pdf_doc, page_images):
    """从PDF提取章节内容"""
    chapters = []
    current_chapter = None
    
    # 章节标题模式（匹配 "1.1 端口说明" 等）
    chapter_pattern = re.compile(r'^(\d+(?:\.\d+)+)\s+(.+)$')
    
    for page_num in range(pdf_doc.page_count):
        page = pdf_doc[page_num]
        text = page.get_text()
        
        # 按行处理
        lines = text.split('\n')
        
        for line in lines:
            line = line.strip()
            if not line:
                continue
            
            # 检测章节标题
            match = chapter_pattern.match(line)
            if match:
                # 保存上一章节
                if current_chapter and current_chapter['content'].strip():
                    chapters.append(current_chapter)
                
                # 开始新章节
                chapter_num = match.group(1)
                chapter_title = match.group(2)
                
                current_chapter = {
                    'number': chapter_num,
                    'title': f"MAVO Edge 6K: {chapter_title}",
                    'full_title': line,
                    'content': "",
                    'page_start': page_num + 1,
                    'page_end': page_num + 1,
                    'images': []
                }
                continue
            
            # 添加到当前章节
            if current_chapter:
                current_chapter['content'] += line + "\n"
                current_chapter['page_end'] = page_num + 1
    
    # 保存最后一章
    if current_chapter and current_chapter['content'].strip():
        chapters.append(current_chapter)
    
    # 为每个章节匹配图片
    for chapter in chapters:
        for page in range(chapter['page_start'], chapter['page_end'] + 1):
            if page in page_images:
                chapter['images'].extend(page_images[page])
    
    return chapters

def insert_images_to_content(chapter):
    """在章节内容中插入图片引用"""
    content = chapter['content']
    images = chapter['images']
    
    if not images:
        return content
    
    # 在特定位置插入图片
    patterns = [
        (r'(如右?图所示[。，：]?)', '\n\n![操作示意图]({})\n\n'),
        (r'(见右?图[。，：]?)', '\n\n![参考图]({})\n\n'),
        (r'(图示如下[。，：]?)', '\n\n![示意图]({})\n\n'),
    ]
    
    images_inserted = set()
    
    for pattern, replacement_template in patterns:
        matches = list(re.finditer(pattern, content))
        if matches:
            # 从后往前替换，避免索引变化
            for match in reversed(matches):
                for img in images:
                    if img['filename'] not in images_inserted:
                        replacement = match.group(1) + replacement_template.format(img['path'])
                        content = content[:match.start()] + replacement + content[match.end():]
                        images_inserted.add(img['filename'])
                        break
    
    # 如果还有未插入的图片，在章节末尾添加
    for img in images:
        if img['filename'] not in images_inserted:
            content += f'\n\n![配图]({img["path"]})\n'
    
    return content

def main():
    print("=" * 70)
    print("从原版PDF导入 MAVO Edge 6K 操作说明书")
    print("=" * 70)
    
    # 1. 打开PDF
    print(f"\n📄 打开PDF...")
    pdf_doc = fitz.open(PDF_PATH)
    print(f"   总页数: {pdf_doc.page_count}")
    
    # 2. 提取图片
    print(f"\n📸 提取图片...")
    images, page_images = extract_images_from_pdf(pdf_doc)
    print(f"   共提取 {len(images)} 张有效图片")
    
    # 3. 提取章节
    print(f"\n📖 提取章节内容...")
    chapters = parse_chapters_from_pdf(pdf_doc, page_images)
    print(f"   共提取 {len(chapters)} 个章节")
    
    # 显示前5个章节
    for i, ch in enumerate(chapters[:5]):
        print(f"   {i+1}. {ch['number']} {ch['title']} (第{ch['page_start']}-{ch['page_end']}页, {len(ch['images'])}张图)")
    if len(chapters) > 5:
        print(f"   ... 还有 {len(chapters)-5} 个章节")
    
    pdf_doc.close()
    
    # 4. 处理章节内容（插入图片）
    print(f"\n🖼️  处理章节内容...")
    for chapter in chapters:
        chapter['content_with_images'] = insert_images_to_content(chapter)
        summary = chapter['content'][:200].replace('\n', ' ').strip()
        chapter['summary'] = summary
    
    # 5. 连接数据库
    print(f"\n💾 连接数据库...")
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    # 6. 确认清空
    cursor.execute("DELETE FROM knowledge_articles WHERE category = 'Manual'")
    print(f"   已清空Manual分类")
    
    # 7. 获取admin用户ID
    admin_user = cursor.execute("SELECT id FROM users WHERE username = 'admin' LIMIT 1").fetchone()
    admin_id = admin_user[0] if admin_user else 1
    
    # 8. 插入新文章
    print(f"\n✍️  插入文章...")
    insert_sql = """
        INSERT INTO knowledge_articles (
            title, slug, summary, content,
            category, subcategory, product_line, product_models,
            visibility, status, published_at, created_by, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), ?, datetime('now'))
    """
    
    for i, chapter in enumerate(chapters):
        slug = f"edge-6k-{chapter['number'].replace('.', '-')}"
        
        try:
            cursor.execute(insert_sql, (
                chapter['title'],
                slug,
                chapter['summary'],
                chapter['content_with_images'],
                'Manual',
                '操作手册',
                'A',  # 产品线代码
                '["MAVO Edge 6K"]',  # JSON数组
                'Public',
                'Published',
                admin_id
            ))
            print(f"   ✓ {chapter['number']} {chapter['title']}")
        except sqlite3.IntegrityError:
            # slug重复，添加序号
            slug = f"{slug}-{i+1:03d}"
            cursor.execute(insert_sql, (
                chapter['title'],
                slug,
                chapter['summary'],
                chapter['content_with_images'],
                'Manual',
                '操作手册',
                'MAVO Edge',
                'MAVO Edge 6K',
                'Public',
                'Published',
                admin_id
            ))
            print(f"   ✓ {chapter['number']} {chapter['title']} (slug: {slug})")
    
    conn.commit()
    
    # 9. 验证
    count = cursor.execute("SELECT COUNT(*) FROM knowledge_articles WHERE category = 'Manual'").fetchone()[0]
    with_images = cursor.execute("SELECT COUNT(*) FROM knowledge_articles WHERE category = 'Manual' AND content LIKE '%![%'").fetchone()[0]
    
    print(f"\n✅ 完成！")
    print(f"   共导入 {count} 篇文章")
    print(f"   其中 {with_images} 篇包含图片")
    
    # 显示示例
    test = cursor.execute("""
        SELECT title, SUBSTR(content, 1, 150)
        FROM knowledge_articles
        WHERE category = 'Manual'
        ORDER BY id
        LIMIT 1
    """).fetchone()
    
    if test:
        print(f"\n📝 示例文章:")
        print(f"   标题: {test[0]}")
        print(f"   内容: {test[1]}...")
    
    conn.close()
    print("\n" + "=" * 70)

if __name__ == '__main__':
    main()
