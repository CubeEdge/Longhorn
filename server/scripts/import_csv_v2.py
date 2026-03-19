#!/usr/bin/env python3
"""
CSV 导入脚本 v2 - 重新分析后的版本
处理 testdocs/ 下的 6 个 CSV 文件
"""

import csv
import os

BASE_DIR = "/Users/Kine/Documents/Kinefinity/KineCore/Pool/qoder/Longhorn/testdocs"

def parse_cine_pm():
    """解析 cine_pm.csv - A族群电影机型号"""
    models = []
    with open(os.path.join(BASE_DIR, "cine_pm.csv"), 'r', encoding='utf-8') as f:
        reader = csv.reader(f)
        next(reader)  # 跳过表头
        next(reader)  # 跳过英文表头
        for row in reader:
            if len(row) < 8:
                continue
            name_zh = row[2].strip()
            name_en = row[3].strip()
            model_code = row[4].strip()
            sn_prefix = row[5].strip()
            material_id = row[6].strip()
            product_type = row[7].strip()
            
            if not model_code:
                continue
            
            models.append({
                'model_code': model_code,
                'name_zh': name_zh,
                'name_en': name_en,
                'sn_prefix': sn_prefix,
                'material_id': material_id,
                'product_type': product_type,
                'family': 'A',
                'brand': 'Kinefinity'
            })
    return models

def parse_bc_pm():
    """解析 bc_pm.csv - B族群广播摄像型号
    注意：此文件列结构不同，从第2列开始
    """
    models = []
    with open(os.path.join(BASE_DIR, "bc_pm.csv"), 'r', encoding='utf-8') as f:
        reader = csv.reader(f)
        next(reader)  # 跳过表头
        next(reader)  # 跳过英文表头
        for row in reader:
            if len(row) < 7:
                continue
            name_zh = row[1].strip()
            name_en = row[2].strip()
            model_code = row[3].strip()
            sn_prefix = row[4].strip()
            material_id = row[5].strip()
            product_type = row[6].strip()
            
            if not model_code:
                continue
            
            models.append({
                'model_code': model_code,
                'name_zh': name_zh,
                'name_en': name_en,
                'sn_prefix': sn_prefix,
                'material_id': material_id,
                'product_type': product_type,
                'family': 'B',
                'brand': 'Kinefinity'
            })
    return models

def parse_acc_pm():
    """解析 acc_pm.csv - E族群配件型号"""
    models = []
    with open(os.path.join(BASE_DIR, "acc_pm.csv"), 'r', encoding='utf-8') as f:
        reader = csv.reader(f)
        next(reader)  # 跳过表头
        next(reader)  # 跳过英文表头
        for row in reader:
            if len(row) < 9:
                continue
            name_zh = row[2].strip()
            name_en = row[3].strip()
            model_code = row[4].strip()
            sn_prefix = row[5].strip()
            material_id = row[6].strip()
            brand = row[7].strip() if len(row) > 7 else ''
            product_type = row[8].strip() if len(row) > 8 else ''
            
            if not model_code:
                continue
            
            models.append({
                'model_code': model_code,
                'name_zh': name_zh,
                'name_en': name_en,
                'sn_prefix': sn_prefix,
                'material_id': material_id,
                'product_type': product_type,
                'family': 'E',
                'brand': brand if brand else 'Kinefinity'
            })
    return models

def parse_cine_sku():
    """解析 cine_sku.csv - A族群SKU"""
    skus = []
    with open(os.path.join(BASE_DIR, "cine_sku.csv"), 'r', encoding='utf-8') as f:
        reader = csv.reader(f)
        next(reader)  # 跳过表头
        next(reader)  # 跳过英文表头
        for row in reader:
            if len(row) < 6:
                continue
            model_code = row[1].strip()
            name_zh = row[2].strip()
            name_en = row[3].strip()
            sku_code = row[4].strip()
            material_id = row[5].strip()
            
            if not model_code or not sku_code:
                continue
            
            skus.append({
                'model_code': model_code,
                'sku_code': sku_code,
                'name_zh': name_zh,
                'name_en': name_en,
                'material_id': material_id,
                'family': 'A'
            })
    return skus

def parse_bc_sku():
    """解析 bc_sku.csv - B族群SKU
    注意：此文件列结构不同
    """
    skus = []
    with open(os.path.join(BASE_DIR, "bc_sku.csv"), 'r', encoding='utf-8') as f:
        reader = csv.reader(f)
        next(reader)  # 跳过表头
        next(reader)  # 跳过英文表头
        for row in reader:
            if len(row) < 7:
                continue
            # bc_sku.csv: 第2列=name_zh, 第3列=name_en, 第4列=model_code, 第5列=sku, 第7列=material_id
            name_zh = row[1].strip()
            name_en = row[2].strip()
            model_code = row[3].strip()
            sku_code = row[4].strip()
            material_id = row[6].strip() if len(row) > 6 else ''
            
            if not model_code or not sku_code:
                continue
            
            skus.append({
                'model_code': model_code,
                'sku_code': sku_code,
                'name_zh': name_zh,
                'name_en': name_en,
                'material_id': material_id,
                'family': 'B'
            })
    return skus

def parse_acc_sku():
    """解析 acc_sku.csv - E族群SKU"""
    skus = []
    with open(os.path.join(BASE_DIR, "acc_sku.csv"), 'r', encoding='utf-8') as f:
        reader = csv.reader(f)
        next(reader)  # 跳过表头
        next(reader)  # 跳过英文表头
        for row in reader:
            if len(row) < 6:
                continue
            # acc_sku.csv: 第2列=name_zh, 第3列=name_en, 第4列=model_code, 第5列=sku, 第6列=material_id
            name_zh = row[1].strip()
            name_en = row[2].strip()
            model_code = row[3].strip()
            sku_code = row[4].strip()
            material_id = row[5].strip()
            
            if not model_code or not sku_code:
                continue
            
            skus.append({
                'model_code': model_code,
                'sku_code': sku_code,
                'name_zh': name_zh,
                'name_en': name_en,
                'material_id': material_id,
                'family': 'E'
            })
    return skus

def generate_pm_sql(models):
    """生成产品型号插入SQL - 适配远程数据库字段名"""
    sql_lines = []
    for m in models:
        sql = f"""INSERT INTO product_models (model_code, name_zh, name_en, sn_prefix, material_id, product_type, product_family, brand, is_active, created_at, updated_at)
VALUES ('{m['model_code']}', '{m['name_zh'].replace("'", "''")}', '{m['name_en'].replace("'", "''")}', '{m['sn_prefix']}', '{m['material_id']}', '{m['product_type']}', '{m['family']}', '{m['brand']}', 1, datetime('now'), datetime('now'));"""
        sql_lines.append(sql)
    return sql_lines

def generate_sku_sql(skus):
    """生成SKU插入SQL - 适配远程数据库字段名"""
    sql_lines = []
    for s in skus:
        # 使用子查询获取 model_id
        # 远程数据库字段: display_name (不是 name_zh), display_name_en (不是 name_en)
        sql = f"""INSERT INTO product_skus (model_id, sku_code, display_name, display_name_en, material_id, is_active, created_at, updated_at)
SELECT id, '{s['sku_code']}', '{s['name_zh'].replace("'", "''")}', '{s['name_en'].replace("'", "''")}', '{s['material_id']}', 1, datetime('now'), datetime('now') FROM product_models WHERE model_code = '{s['model_code']}';"""
        sql_lines.append(sql)
    return sql_lines

def main():
    print("=" * 60)
    print("CSV 导入分析")
    print("=" * 60)
    
    # 解析所有型号
    cine_models = parse_cine_pm()
    bc_models = parse_bc_pm()
    acc_models = parse_acc_pm()
    
    all_models = cine_models + bc_models + acc_models
    
    print(f"\n产品型号统计:")
    print(f"  A族群 (电影机): {len(cine_models)} 个")
    print(f"  B族群 (广播摄像): {len(bc_models)} 个")
    print(f"  E族群 (配件): {len(acc_models)} 个")
    print(f"  总计: {len(all_models)} 个")
    
    # 解析所有SKU
    cine_skus = parse_cine_sku()
    bc_skus = parse_bc_sku()
    acc_skus = parse_acc_sku()
    
    all_skus = cine_skus + bc_skus + acc_skus
    
    print(f"\nSKU统计:")
    print(f"  A族群 (电影机): {len(cine_skus)} 个")
    print(f"  B族群 (广播摄像): {len(bc_skus)} 个")
    print(f"  E族群 (配件): {len(acc_skus)} 个")
    print(f"  总计: {len(all_skus)} 个")
    
    # 检查型号-SKU关联
    model_codes = {m['model_code'] for m in all_models}
    orphan_skus = [s for s in all_skus if s['model_code'] not in model_codes]
    
    if orphan_skus:
        print(f"\n⚠️ 警告: 有 {len(orphan_skus)} 个 SKU 没有对应的产品型号:")
        for s in orphan_skus[:10]:
            print(f"    - {s['sku_code']} -> {s['model_code']}")
    
    # 检查重复SKU
    sku_codes = [s['sku_code'] for s in all_skus]
    duplicates = {code for code in sku_codes if sku_codes.count(code) > 1}
    if duplicates:
        print(f"\n⚠️ 警告: 发现 {len(duplicates)} 个重复的 SKU 编码:")
        for code in list(duplicates)[:10]:
            print(f"    - {code}")
    
    # 生成SQL
    pm_sql = generate_pm_sql(all_models)
    sku_sql = generate_sku_sql(all_skus)
    
    # 写入SQL文件
    pm_file = "/Users/Kine/Documents/Kinefinity/KineCore/Pool/qoder/Longhorn/server/scripts/import_pm_v2.sql"
    sku_file = "/Users/Kine/Documents/Kinefinity/KineCore/Pool/qoder/Longhorn/server/scripts/import_sku_v2.sql"
    
    with open(pm_file, 'w', encoding='utf-8') as f:
        f.write("-- 产品型号导入 SQL (v2)\n")
        f.write("-- 生成时间: 2025\n\n")
        f.write("BEGIN TRANSACTION;\n\n")
        for sql in pm_sql:
            f.write(sql + "\n")
        f.write("\nCOMMIT;\n")
    
    with open(sku_file, 'w', encoding='utf-8') as f:
        f.write("-- SKU导入 SQL (v2)\n")
        f.write("-- 生成时间: 2025\n\n")
        f.write("BEGIN TRANSACTION;\n\n")
        for sql in sku_sql:
            f.write(sql + "\n")
        f.write("\nCOMMIT;\n")
    
    print(f"\n✅ SQL文件已生成:")
    print(f"  - {pm_file}")
    print(f"  - {sku_file}")
    
    # 打印前几个型号和SKU作为示例
    print(f"\n产品型号示例 (前5个):")
    for m in all_models[:5]:
        print(f"  - [{m['family']}] {m['model_code']}: {m['name_zh']}")
    
    print(f"\nSKU示例 (前5个):")
    for s in all_skus[:5]:
        print(f"  - [{s['family']}] {s['sku_code']} -> {s['model_code']}: {s['name_zh']}")

if __name__ == "__main__":
    main()
