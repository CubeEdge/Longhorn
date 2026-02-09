#!/usr/bin/env python3
"""
基于PDF书签（TOC）的增强提取器
- 使用书签精确识别章节结构（100%准确）
- 按章节范围提取图片和表格
- 自动转WebP优化图片
- 输出结构化Markdown内容
"""

import sys
import os
import json
import hashlib
import fitz  # PyMuPDF
import pdfplumber
from pathlib import Path
from PIL import Image
import io

def extract_images_by_page(pdf_path, output_dir):
    """提取所有图片并按页码组织，转为WebP"""
    images_by_page = {}
    extracted_hashes = set()
    
    pdf_doc = fitz.open(pdf_path)
    
    for page_num in range(pdf_doc.page_count):
        page = pdf_doc[page_num]
        image_list = page.get_images(full=True)
        
        page_images = []
        
        for img_info in image_list:
            xref = img_info[0]
            
            try:
                base_image = pdf_doc.extract_image(xref)
                image_bytes = base_image["image"]
                
                img_hash = hashlib.md5(image_bytes).hexdigest()[:12]
                if img_hash in extracted_hashes:
                    continue
                extracted_hashes.add(img_hash)
                
                img = Image.open(io.BytesIO(image_bytes))
                width, height = img.size
                
                if width < 50 or height < 50:
                    continue
                
                # 转WebP
                filename = f"img_p{page_num + 1}_{img_hash}.webp"
                filepath = os.path.join(output_dir, filename)
                
                if img.mode in ('RGBA', 'LA', 'P'):
                    bg = Image.new('RGB', img.size, (255, 255, 255))
                    if img.mode == 'P': img = img.convert('RGBA')
                    if img.mode in ('RGBA', 'LA'): bg.paste(img, mask=img.split()[-1])
                    img = bg
                elif img.mode != 'RGB':
                    img = img.convert('RGB')
                
                img.save(filepath, "WEBP", quality=85, method=6)
                
                page_images.append({
                    'filename': filename,
                    'path': f'/data/knowledge_images/{filename}',
                    'width': width,
                    'height': height
                })
                
            except Exception as e:
                continue
        
        if page_images:
            images_by_page[page_num + 1] = page_images
    
    pdf_doc.close()
    return images_by_page

def table_to_markdown(table_data):
    """将表格转为Markdown格式"""
    if not table_data or len(table_data) < 2:
        return None
    
    # 过滤空行
    table_data = [row for row in table_data if any(cell and str(cell).strip() for cell in row)]
    
    if len(table_data) < 2:
        return None
    
    # 确保所有行列数一致
    max_cols = max(len(row) for row in table_data)
    normalized_data = []
    for row in table_data:
        normalized_row = list(row) + [''] * (max_cols - len(row))
        normalized_data.append(normalized_row)
    
    md_lines = []
    
    # 表头
    header = normalized_data[0]
    md_lines.append('| ' + ' | '.join(str(cell or '').strip() for cell in header) + ' |')
    
    # 分隔线
    md_lines.append('| ' + ' | '.join(['---'] * len(header)) + ' |')
    
    # 数据行
    for row in normalized_data[1:]:
        md_lines.append('| ' + ' | '.join(str(cell or '').strip() for cell in row) + ' |')
    
    return '\n' + '\n'.join(md_lines) + '\n'

def extract_content_by_toc(pdf_path, toc, images_by_page):
    """基于书签提取章节内容"""
    sections = []
    
    with pdfplumber.open(pdf_path) as pdf:
        for i, (level, title, page_start) in enumerate(toc):
            # 计算页码范围
            if i + 1 < len(toc):
                page_end = toc[i + 1][2] - 1
            else:
                page_end = len(pdf.pages)
            
            # 提取该章节的文本和表格
            content = f"{'#' * (level + 1)} {title}\n\n"
            
            for page_num in range(page_start, page_end + 1):
                if page_num > len(pdf.pages):
                    break
                
                page = pdf.pages[page_num - 1]
                
                # 提取文本
                text = page.extract_text()
                if text:
                    # 简单清理：移除过多的空行
                    lines = [line.strip() for line in text.split('\n') if line.strip()]
                    content += '\n\n'.join(lines) + '\n\n'
                
                # 提取表格
                tables = page.extract_tables()
                for table in tables:
                    md_table = table_to_markdown(table)
                    if md_table:
                        content += md_table + '\n'
                
                # 插入图片
                if page_num in images_by_page:
                    for img in images_by_page[page_num]:
                        content += f"![图片]({img['path']})\n\n"
            
            sections.append({
                'title': title,
                'level': level,
                'content': content.strip(),
                'page_start': page_start,
                'page_end': page_end
            })
    
    return sections

def main():
    if len(sys.argv) < 3:
        print(json.dumps({'error': 'Usage: extract_pdf_with_toc.py <pdf_path> <output_dir>'}))
        sys.exit(1)
    
    pdf_path = sys.argv[1]
    output_dir = sys.argv[2]
    
    if not os.path.exists(pdf_path):
        print(json.dumps({'error': f'PDF not found: {pdf_path}'}))
        sys.exit(1)
    
    Path(output_dir).mkdir(parents=True, exist_ok=True)
    
    print("[1/4] 读取PDF书签...", file=sys.stderr)
    pdf_doc = fitz.open(pdf_path)
    toc = pdf_doc.get_toc()
    pdf_doc.close()
    
    if not toc:
        print(json.dumps({'error': 'PDF没有书签（TOC）！请确保导出PDF时勾选了"创建书签"选项。'}))
        sys.exit(1)
    
    print(f"      找到 {len(toc)} 个书签", file=sys.stderr)
    
    print("[2/4] 提取图片并转WebP...", file=sys.stderr)
    images_by_page = extract_images_by_page(pdf_path, output_dir)
    total_images = sum(len(imgs) for imgs in images_by_page.values())
    print(f"      提取了 {total_images} 张图片", file=sys.stderr)
    
    print("[3/4] 按书签提取章节内容...", file=sys.stderr)
    sections = extract_content_by_toc(pdf_path, toc, images_by_page)
    print(f"      提取了 {len(sections)} 个章节", file=sys.stderr)
    
    print("[4/4] 生成结果...", file=sys.stderr)
    
    result = {
        'success': True,
        'toc': toc,
        'sections': sections,
        'stats': {
            'bookmarks': len(toc),
            'images': total_images,
            'sections': len(sections)
        }
    }
    
    print(json.dumps(result, ensure_ascii=False))

if __name__ == '__main__':
    main()
