#!/usr/bin/env python3
"""
PDF Image Extractor using PyMuPDF (fitz)
Extract all images from PDF and save to specified directory
"""

import sys
import os
import hashlib
import json
import fitz  # PyMuPDF
from pathlib import Path
from PIL import Image
import io

def extract_images(pdf_path, output_dir):
    """
    Extract all images from PDF file
    
    Args:
        pdf_path: Path to PDF file
        output_dir: Directory to save extracted images
        
    Returns:
        List of dicts: [{'filename', 'page', 'width', 'height', 'path'}]
    """
    images = []
    
    # Open PDF
    try:
        pdf_doc = fitz.open(pdf_path)
    except Exception as e:
        print(json.dumps({'error': str(e)}), file=sys.stderr)
        return images
    
    print(f"Processing {pdf_doc.page_count} pages...", file=sys.stderr)
    
    # Track extracted images by hash to avoid duplicates
    extracted_hashes = set()
    
    # Iterate through pages
    for page_num in range(pdf_doc.page_count):
        page = pdf_doc[page_num]
        image_list = page.get_images(full=True)
        
        for img_index, img_info in enumerate(image_list):
            xref = img_info[0]  # XREF number
            
            try:
                # Extract image
                base_image = pdf_doc.extract_image(xref)
                image_bytes = base_image["image"]
                image_ext = base_image["ext"]
                
                # Calculate hash to avoid duplicates
                img_hash = hashlib.md5(image_bytes).hexdigest()[:12]
                
                if img_hash in extracted_hashes:
                    continue
                
                extracted_hashes.add(img_hash)
                
                # Open image to get dimensions and filter small images
                img = Image.open(io.BytesIO(image_bytes))
                width, height = img.size
                
                # Skip very small images (icons, decorations)
                if width < 50 or height < 50:
                    continue
                
                # Generate filename (WebP format)
                filename = f"img_p{page_num + 1}_{img_hash}.webp"
                filepath = os.path.join(output_dir, filename)
                
                # Convert to WebP for optimal compression
                # Handle different color modes
                if img.mode in ('RGBA', 'LA', 'P'):
                    # Create white background for transparency
                    background = Image.new('RGB', img.size, (255, 255, 255))
                    if img.mode == 'P':
                        img = img.convert('RGBA')
                    if img.mode in ('RGBA', 'LA'):
                        background.paste(img, mask=img.split()[-1])
                    img = background
                elif img.mode != 'RGB':
                    img = img.convert('RGB')
                
                # Save as WebP (quality 85 for balance between size and quality)
                img.save(filepath, "WEBP", quality=85, method=6)
                
                images.append({
                    'filename': filename,
                    'page': page_num + 1,
                    'width': width,
                    'height': height,
                    'path': f'/data/knowledge_images/{filename}'
                })
                
                print(f"✓ Page {page_num + 1}: {filename} ({width}x{height})", file=sys.stderr)
                
            except Exception as e:
                print(f"⚠ Page {page_num + 1}: Failed to extract image - {str(e)}", file=sys.stderr)
                continue
    
    pdf_doc.close()
    
    print(f"\n✅ Total extracted: {len(images)} images", file=sys.stderr)
    
    return images

def main():
    if len(sys.argv) < 3:
        print(json.dumps({'error': 'Usage: extract_pdf_images.py <pdf_path> <output_dir>'}))
        sys.exit(1)
    
    pdf_path = sys.argv[1]
    output_dir = sys.argv[2]
    
    if not os.path.exists(pdf_path):
        print(json.dumps({'error': f'PDF file not found: {pdf_path}'}))
        sys.exit(1)
    
    # Ensure output directory exists
    Path(output_dir).mkdir(parents=True, exist_ok=True)
    
    # Extract images
    images = extract_images(pdf_path, output_dir)
    
    # Output JSON result to stdout
    print(json.dumps({'success': True, 'images': images}))

if __name__ == '__main__':
    main()
