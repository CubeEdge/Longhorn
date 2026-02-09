#!/usr/bin/env python3
"""
增强版PDF内容提取器
- 使用pdfplumber提取表格结构并转为Markdown
- 保留段落格式
- 提取图片并转为WebP格式
- 智能章节分割
"""

import sys
import os
import json
import hashlib
import fitz  # PyMuPDF (用于图片提取)
import pdfplumber  # 用于表格提取
from pathlib import Path
from PIL import Image
import io
import re

def extract_images_webp(pdf_path, output_dir):
    """提取PDF图片并转为WebP格式"""
    images = []
    extracted_hashes = set()
    
    pdf_doc = fitz.open(pdf_path)
    
    for page_num in range(pdf_doc.page_count):
        page = pdf_doc[page_num]
        image_list = page.get_images(full=True)
        
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
                
                # 跳过小图
                if width < 50 or height < 50:
                    continue
                
                # 转为WebP
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
                
                images.append({
                    'page': page_num + 1,
                    'filename': filename,
                    'path': f'/data/knowledge_images/{filename}',
                    'width': width,
                    'height': height
                })
                
            except Exception as e:
                continue
    
    pdf_doc.close()
    return images

def table_to_markdown(table_data):
    """将pdfplumber提取的表格转为Markdown格式"""
    if not table_data or len(table_data) < 2:
        return None
    
    # 过滤空行
    table_data = [row for row in table_data if any(cell and str(cell).strip() for cell in row)]
    
    if len(table_data) < 2:
        return None
    
    # 第一行作为表头
    header = table_data[0]
    rows = table_data[1:]
    
    # 构建Markdown表格
    md_lines = []
    
    # 表头
    md_lines.append('| ' + ' | '.join(str(cell or '').strip() for cell in header) + ' |')
    
    # 分隔线
    md_lines.append('| ' + ' | '.join(['---'] * len(header)) + ' |')
    
    # 数据行
    for row in rows:
        md_lines.append('| ' + ' | '.join(str(cell or '').strip() for cell in row) + ' |')
    
    return '\n'.join(md_lines)

def extract_content_structured(pdf_path, images_by_page):
    """提取PDF内容，保留结构（段落、表格）"""
    sections = []
    current_section = {'title': '', 'content': '', 'page_start': 1, 'page_end': 1}
    
    # 章节标题模式
    chapter_pattern = re.compile(r'^(\d+(?:\.\d+)*)\s+(.+)$')
    
    with pdfplumber.open(pdf_path) as pdf:
        for page_num, page in enumerate(pdf.pages, start=1):
            # 提取表格
            tables = page.extract_tables()
            
            # 提取文本
            text = page.extract_text() or ''
            
            lines = text.split('\n')
            
            for line in lines:
                line = line.strip()
                if not line:
                    continue
                
                # 检测章节标题
                match = chapter_pattern.match(line)
                if match and len(line) < 100:  # 标题通常不会太长
                    # 保存上一章节
                    if current_section['content'].strip():
                        sections.append(current_section.copy())
                    
                    # 开始新章节
                    chapter_num = match.group(1)
                    chapter_title = match.group(2)
                    current_section = {
                        'title': line,
                        'content': f"## {line}\n\n",
                        'page_start': page_num,
                        'page_end': page_num
                    }
                else:
                    # 添加到当前章节
                    current_section['content'] += line + '\n\n'
                    current_section['page_end'] = page_num
            
            # 插入表格（Markdown格式）
            if tables:
                for table in tables:
                    md_table = table_to_markdown(table)
                    if md_table:
                        current_section['content'] += '\n' + md_table + '\n\n'
            
            # 插入图片
            if page_num in images_by_page:
                for img in images_by_page[page_num]:
                    current_section['content'] += f"![图片]({img['path']})\n\n"
    
    # 保存最后一章
    if current_section['content'].strip():
        sections.append(current_section)
    
    return sections

def main():
    if len(sys.argv) < 3:
        print(json.dumps({'error': 'Usage: extract_pdf_enhanced.py <pdf_path> <output_dir>'}))
        sys.exit(1)
    
    pdf_path = sys.argv[1]
    output_dir = sys.argv[2]
    
    if not os.path.exists(pdf_path):
        print(json.dumps({'error': f'PDF not found: {pdf_path}'}))
        sys.exit(1)
    
    Path(output_dir).mkdir(parents=True, exist_ok=True)
    
    print(f"[1/3] 提取图片...", file=sys.stderr)
    images = extract_images_webp(pdf_path, output_dir)
    print(f"      提取了 {len(images)} 张图片", file=sys.stderr)
    
    # 按页码组织图片
    images_by_page = {}
    for img in images:
        page = img['page']
        if page not in images_by_page:
            images_by_page[page] = []
        images_by_page[page].append(img)
    
    print(f"[2/3] 提取文本和表格...", file=sys.stderr)
    sections = extract_content_structured(pdf_path, images_by_page)
    print(f"      提取了 {len(sections)} 个章节", file=sys.stderr)
    
    print(f"[3/3] 生成结果...", file=sys.stderr)
    
    # 输出JSON结果
    result = {
        'success': True,
        'images': images,
        'sections': sections,
        'stats': {
            'images': len(images),
            'sections': len(sections)
        }
    }
    
    print(json.dumps(result, ensure_ascii=False))

if __name__ == '__main__':
    main()
