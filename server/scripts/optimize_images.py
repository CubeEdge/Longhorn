#!/usr/bin/env python3
"""
优化知识库图片
- 压缩PNG图片（保持视觉质量）
- 转换为WebP格式（更小体积）
"""

import os
from pathlib import Path
from PIL import Image

IMAGE_DIR = "/Users/Kine/Documents/Kinefinity/KineCore/Pool/qoder/Longhorn/server/data/knowledge_images"

def optimize_image(filepath):
    """压缩单个图片"""
    try:
        img = Image.open(filepath)
        
        # 原始大小
        original_size = os.path.getsize(filepath)
        
        # 转换为RGB（WebP不支持RGBA透明度）
        if img.mode in ('RGBA', 'LA', 'P'):
            background = Image.new('RGB', img.size, (255, 255, 255))
            if img.mode == 'P':
                img = img.convert('RGBA')
            background.paste(img, mask=img.split()[-1] if img.mode in ('RGBA', 'LA') else None)
            img = background
        elif img.mode != 'RGB':
            img = img.convert('RGB')
        
        # 生成WebP文件名
        webp_path = filepath.rsplit('.', 1)[0] + '.webp'
        
        # 保存为WebP（质量85，平衡体积和质量）
        img.save(webp_path, 'WEBP', quality=85, method=6)
        
        webp_size = os.path.getsize(webp_path)
        reduction = (1 - webp_size / original_size) * 100
        
        print(f"✓ {Path(filepath).name}")
        print(f"  PNG: {original_size/1024:.1f}KB → WebP: {webp_size/1024:.1f}KB (减少 {reduction:.1f}%)")
        
        # 删除原PNG
        os.remove(filepath)
        
        return webp_size, original_size
        
    except Exception as e:
        print(f"✗ {Path(filepath).name}: {e}")
        return 0, 0

def main():
    print("=" * 60)
    print("优化知识库图片")
    print("=" * 60)
    
    png_files = list(Path(IMAGE_DIR).glob("edge6k_*.png"))
    
    if not png_files:
        print("没有找到需要优化的PNG图片")
        return
    
    print(f"\n找到 {len(png_files)} 个PNG图片\n")
    
    total_original = 0
    total_optimized = 0
    
    for png_file in png_files:
        optimized, original = optimize_image(str(png_file))
        total_optimized += optimized
        total_original += original
    
    if total_original > 0:
        total_reduction = (1 - total_optimized / total_original) * 100
        print("\n" + "=" * 60)
        print(f"✅ 优化完成！")
        print(f"   原始总大小: {total_original/1024/1024:.1f}MB")
        print(f"   优化后总大小: {total_optimized/1024/1024:.1f}MB")
        print(f"   节省空间: {(total_original - total_optimized)/1024/1024:.1f}MB ({total_reduction:.1f}%)")
        print("=" * 60)

if __name__ == '__main__':
    main()
