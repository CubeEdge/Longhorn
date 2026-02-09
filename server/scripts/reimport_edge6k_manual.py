#!/usr/bin/env python3
"""
重新导入MAVO Edge 6K操作说明书到知识库
- 正确提取文字（避免编码问题）
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
PDF_PATH = "/Users/Kine/Documents/Kinefinity/KineCore/Pool/qoder/Longhorn/input docs/卓曜科技_MAVO Edge 6K操作说明书(KineOS7.2)_C34-102-7200_2023.11.7.pdf"
DB_PATH = "/Users/Kine/Documents/Kinefinity/KineCore/Pool/qoder/Longhorn/server/longhorn.db"
IMAGE_OUTPUT_DIR = "/Users/Kine/Documents/Kinefinity/KineCore/Pool/qoder/Longhorn/server/data/knowledge_images"

# 确保图片目录存在
Path(IMAGE_OUTPUT_DIR).mkdir(parents=True, exist_ok=True)

def extract_images_from_pdf(pdf_doc):
    """提取PDF中的所有图片"""
    images = []
    extracted_hashes = set()
    
    for page_num in range(pdf_doc.page_count):
        page = pdf_doc[page_num]
        image_list = page.get_images(full=True)
        
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
                if width < 50 or height < 50:
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
                
                images.append({
                    'page': page_num + 1,
                    'filename': filename,
                    'width': width,
                    'height': height,
                    'path': f'/data/knowledge_images/{filename}'
                })
                
                print(f"✓ 第{page_num + 1}页: {filename} ({width}x{height})")
                
            except Exception as e:
                print(f"⚠ 第{page_num + 1}页图片提取失败: {e}")
                continue
    
    return images

def extract_chapters_from_pdf(pdf_doc, images_map):
    """
    提取PDF章节内容
    images_map: {page_num: [image_info, ...]}
    """
    chapters = []
    current_chapter = None
    
    # 章节标题模式（如 "3.3.2 自动白平衡"）
    chapter_pattern = re.compile(r'^(\d+(?:\.\d+)*)\s+(.+)$')
    
    for page_num in range(pdf_doc.page_count):
        page = pdf_doc[page_num]
        
        # 使用get_text("dict")获取更好的文本结构
        text_dict = page.get_text("dict")
        blocks = text_dict.get("blocks", [])
        
        for block in blocks:
            if block.get("type") != 0:  # 只处理文本块
                continue
            
            for line in block.get("lines", []):
                line_text = ""
                for span in line.get("spans", []):
                    line_text += span.get("text", "")
                
                line_text = line_text.strip()
                if not line_text:
                    continue
                
                # 检测章节标题
                match = chapter_pattern.match(line_text)
                if match:
                    # 保存前一章节
                    if current_chapter and current_chapter['content']:
                        chapters.append(current_chapter)
                    
                    # 开始新章节
                    chapter_num = match.group(1)
                    chapter_title = match.group(2)
                    current_chapter = {
                        'number': chapter_num,
                        'title': f"MAVO Edge 6K: {chapter_title}",
                        'full_title': f"{chapter_num} {chapter_title}",
                        'content': "",
                        'page_start': page_num + 1,
                        'images': []
                    }
                else:
                    # 添加到当前章节
                    if current_chapter:
                        current_chapter['content'] += line_text + "\n"
        
        # 添加该页的图片到当前章节
        if current_chapter and page_num + 1 in images_map:
            for img_info in images_map[page_num + 1]:
                current_chapter['images'].append(img_info)
    
    # 保存最后一章
    if current_chapter and current_chapter['content']:
        chapters.append(current_chapter)
    
    return chapters

def insert_images_to_content(chapter):
    """在章节内容中插入图片引用"""
    content = chapter['content']
    images = chapter['images']
    
    if not images:
        return content
    
    # 在"如右图所示"、"如图所示"等位置插入图片
    patterns = [
        r'(如右图所示[。，]?)',
        r'(如图所示[。，]?)',
        r'(操作方式如右图所示[。，]?)',
        r'(见右图[。，]?)'
    ]
    
    # 为每个匹配位置插入图片
    for i, img in enumerate(images):
        for pattern in patterns:
            if re.search(pattern, content):
                # 在匹配位置后插入图片
                replacement = f'\\1\n\n![操作示意图]({img["path"]})\n\n'
                content = re.sub(pattern, replacement, content, count=1)
                break
    
    # 如果没有匹配位置，在内容末尾添加图片
    for img in images:
        if img['path'] not in content:
            content += f'\n\n![参考图]({img["path"]})\n'
    
    return content

def main():
    print("=" * 60)
    print("重新导入 MAVO Edge 6K 操作说明书")
    print("=" * 60)
    
    # 1. 打开PDF
    print(f"\n📄 打开PDF: {PDF_PATH}")
    pdf_doc = fitz.open(PDF_PATH)
    print(f"   总页数: {pdf_doc.page_count}")
    
    # 2. 提取图片
    print(f"\n📸 提取图片...")
    images = extract_images_from_pdf(pdf_doc)
    print(f"   共提取 {len(images)} 张图片")
    
    # 创建页码到图片的映射
    images_by_page = {}
    for img in images:
        page = img['page']
        if page not in images_by_page:
            images_by_page[page] = []
        images_by_page[page].append(img)
    
    # 3. 提取章节
    print(f"\n📖 提取章节内容...")
    chapters = extract_chapters_from_pdf(pdf_doc, images_by_page)
    print(f"   共提取 {len(chapters)} 个章节")
    
    pdf_doc.close()
    
    # 4. 处理章节内容（插入图片）
    print(f"\n🖼️  处理章节内容...")
    for chapter in chapters:
        chapter['content_with_images'] = insert_images_to_content(chapter)
        summary = chapter['content'][:200].replace('\n', ' ')
        chapter['summary'] = summary
    
    # 5. 连接数据库
    print(f"\n💾 连接数据库...")
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    # 6. 清空旧的Manual文章
    cursor.execute("DELETE FROM knowledge_articles WHERE category = 'Manual'")
    deleted = cursor.rowcount
    print(f"   已删除 {deleted} 篇旧的Manual文章")
    
    # 7. 插入新文章
    print(f"\n✍️  插入新文章...")
    
    # 获取admin用户ID（created_by字段需要）
    admin_user = cursor.execute("SELECT id FROM users WHERE username = 'admin' LIMIT 1").fetchone()
    admin_id = admin_user[0] if admin_user else 1
    
    insert_sql = """
        INSERT INTO knowledge_articles (
            title, slug, summary, content, 
            category, subcategory, product_line, product_models,
            visibility, status, published_at, created_by, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), ?, datetime('now'))
    """
    
    for i, chapter in enumerate(chapters):
        # 使用章节号+序号生成唯一slug
        slug = f"edge-6k-{chapter['number'].replace('.', '-')}-{i+1:03d}"
        cursor.execute(insert_sql, (
            chapter['title'],
            slug,
            chapter['summary'],
            chapter['content_with_images'],
            'Manual',
            '操作手册',
            'MAVO Edge',
            'MAVO Edge 6K',
            'Public',  # 操作手册默认公开
            'Published',
            admin_id
        ))
        print(f"   ✓ {chapter['title']}")
    
    conn.commit()
    
    # 8. 验证
    count = cursor.execute("SELECT COUNT(*) FROM knowledge_articles WHERE category = 'Manual'").fetchone()[0]
    print(f"\n✅ 完成！共导入 {count} 篇文章")
    
    # 显示示例
    test = cursor.execute("""
        SELECT title, SUBSTR(content, 1, 150) 
        FROM knowledge_articles 
        WHERE title LIKE '%自动白平衡%' 
        LIMIT 1
    """).fetchone()
    
    if test:
        print(f"\n📝 示例文章:")
        print(f"   标题: {test[0]}")
        print(f"   内容: {test[1]}...")
    
    conn.close()
    print("\n" + "=" * 60)

if __name__ == '__main__':
    main()
