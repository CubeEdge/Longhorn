#!/usr/bin/env python3
"""
导入 CSV 产品数据到 SQL
用法: python3 import_csv_to_sql.py
"""

import csv
import os

BASE_DIR = "/Users/Kine/Documents/Kinefinity/KineCore/Pool/qoder/Longhorn/testdocs"

def parse_csv_file(filepath, family, has_brand=False, col_offset=0):
    """解析 CSV 文件，返回产品型号列表
    col_offset: 列偏移量，bc_pm.csv 从第1列开始，其他从第2列开始
    """
    models = []
    with open(filepath, 'r', encoding='utf-8') as f:
        reader = csv.reader(f)
        rows = list(reader)
        
        if len(rows) < 3:
            return models
        
        # 找到数据起始行（跳过空行和标题行）
        data_start = 2
        for i, row in enumerate(rows[2:], start=2):
            idx_name = 1 + col_offset
            idx_model = 3 + col_offset
            if len(row) >= idx_model + 1 and row[idx_name] and row[idx_model]:
                data_start = i
                break
        
        for row in rows[data_start:]:
            if len(row) < 5:
                continue
            
            name_zh = row[1 + col_offset].strip() if len(row) > 1 + col_offset else ''
            name_en = row[2 + col_offset].strip() if len(row) > 2 + col_offset else ''
            model_code = row[3 + col_offset].strip() if len(row) > 3 + col_offset else ''
            sn_prefix = row[4 + col_offset].strip() if len(row) > 4 + col_offset else ''
            material_id = row[5 + col_offset].strip() if len(row) > 5 + col_offset else ''
            product_type = row[6 + col_offset].strip() if len(row) > 6 + col_offset else ''
            brand = row[7 + col_offset].strip() if has_brand and len(row) > 7 + col_offset else 'Kinefinity'
            
            if not name_zh or not model_code:
                continue
            
            models.append({
                'name_zh': name_zh,
                'name_en': name_en,
                'model_code': model_code,
                'sn_prefix': sn_prefix,
                'material_id': material_id,
                'product_type': product_type,
                'brand': brand,
                'family': family
            })
    
    return models

def generate_pm_sql(models, family):
    """生成产品型号导入 SQL"""
    sql = f"-- 导入 {family} 族群产品型号\n"
    for m in models:
        sql += f"""INSERT INTO product_models (name_zh, name_en, model_code, sn_prefix, material_id, product_type, product_family, brand, is_active, created_at, updated_at)
VALUES ('{m['name_zh'].replace("'", "''")}', '{m['name_en'].replace("'", "''")}', '{m['model_code']}', '{m['sn_prefix']}', '{m['material_id']}', '{m['product_type']}', '{family}', '{m['brand']}', 1, datetime('now'), datetime('now'));\n"""
    return sql

def parse_sku_csv(filepath, family, file_type='cine'):
    """解析 SKU CSV 文件
    file_type: 'cine', 'bc', 'acc' - 不同文件有不同的列结构
    """
    skus = []
    with open(filepath, 'r', encoding='utf-8') as f:
        reader = csv.reader(f)
        rows = list(reader)
        
        if len(rows) < 3:
            return skus
        
        for row in rows[2:]:
            if len(row) < 5:
                continue
            
            # 根据文件类型解析列
            if file_type == 'cine':
                # cine_sku: 第1列=空, 第2列=model, 第3列=name_zh, 第4列=name_en, 第5列=sku, 第6列=material, 第7列=upc
                model_code = row[1].strip() if len(row) > 1 else ''
                name_zh = row[2].strip() if len(row) > 2 else ''
                name_en = row[3].strip() if len(row) > 3 else ''
                sku_code = row[4].strip() if len(row) > 4 else ''
                material_id = row[5].strip() if len(row) > 5 else ''
                upc = row[6].strip() if len(row) > 6 else ''
            elif file_type == 'bc':
                # bc_sku: 第1列=#, 第2列=name_zh, 第3列=name_en, 第4列=model, 第5列=sku, 第6列=sn, 第7列=material
                name_zh = row[1].strip() if len(row) > 1 else ''
                name_en = row[2].strip() if len(row) > 2 else ''
                model_code = row[3].strip() if len(row) > 3 else ''
                sku_code = row[4].strip() if len(row) > 4 else ''
                material_id = row[6].strip() if len(row) > 6 else ''
                upc = ''  # bc_sku 没有 UPC 列
            elif file_type == 'acc':
                # acc_sku: 第1列=空, 第2列=#, 第3列=name_zh, 第4列=name_en, 第5列=model, 第6列=sku, 第7列=material, 第8列=upc
                name_zh = row[2].strip() if len(row) > 2 else ''
                name_en = row[3].strip() if len(row) > 3 else ''
                model_code = row[4].strip() if len(row) > 4 else ''
                sku_code = row[5].strip() if len(row) > 5 else ''
                material_id = row[6].strip() if len(row) > 6 else ''
                upc = row[7].strip() if len(row) > 7 else ''
            else:
                continue
            
            if not sku_code or not name_zh or not model_code:
                continue
            
            skus.append({
                'model_code': model_code,
                'sku_code': sku_code,
                'name_zh': name_zh,
                'name_en': name_en,
                'material_id': material_id,
                'upc': upc
            })
    
    return skus

def generate_sku_sql(skus, family):
    """生成 SKU 导入 SQL"""
    sql = f"-- 导入 {family} 族群 SKU\n"
    for s in skus:
        sql += f"""INSERT INTO product_skus (model_id, sku_code, display_name, display_name_en, material_id, upc, is_active, created_at, updated_at)
SELECT id, '{s['sku_code']}', '{s['name_zh'].replace("'", "''")}', '{s['name_en'].replace("'", "''")}', '{s['material_id']}', '{s['upc']}', 1, datetime('now'), datetime('now') FROM product_models WHERE model_code = '{s['model_code']}';\n"""
    return sql

def main():
    # A 族群 - 电影机 (从第2列开始，col_offset=1)
    cine_models = parse_csv_file(os.path.join(BASE_DIR, 'cine_pm.csv'), 'A', has_brand=False, col_offset=1)
    print(f"Cine models: {len(cine_models)}")
    
    # B 族群 - 广播摄像 (从第1列开始，col_offset=0)
    bc_models = parse_csv_file(os.path.join(BASE_DIR, 'bc_pm.csv'), 'B', has_brand=False, col_offset=0)
    print(f"BC models: {len(bc_models)}")
    
    # E 族群 - 配件 (从第2列开始，col_offset=1)
    acc_models = parse_csv_file(os.path.join(BASE_DIR, 'acc_pm.csv'), 'E', has_brand=True, col_offset=1)
    print(f"Acc models: {len(acc_models)}")
    
    # 生成产品型号 SQL
    pm_sql = "-- 产品型号导入脚本\n\n"
    pm_sql += generate_pm_sql(cine_models, 'A')
    pm_sql += "\n"
    pm_sql += generate_pm_sql(bc_models, 'B')
    pm_sql += "\n"
    pm_sql += generate_pm_sql(acc_models, 'E')
    
    with open(os.path.join(BASE_DIR, '../server/scripts/import_all_pm.sql'), 'w', encoding='utf-8') as f:
        f.write(pm_sql)
    print("Generated: import_all_pm.sql")
    
    # 解析 SKU
    cine_skus = parse_sku_csv(os.path.join(BASE_DIR, 'cine_sku.csv'), 'A', file_type='cine')
    bc_skus = parse_sku_csv(os.path.join(BASE_DIR, 'bc_sku.csv'), 'B', file_type='bc')
    acc_skus = parse_sku_csv(os.path.join(BASE_DIR, 'acc_sku.csv'), 'E', file_type='acc')
    
    print(f"Cine SKUs: {len(cine_skus)}")
    print(f"BC SKUs: {len(bc_skus)}")
    print(f"Acc SKUs: {len(acc_skus)}")
    
    # 生成 SKU SQL
    sku_sql = "-- SKU 导入脚本\n\n"
    sku_sql += generate_sku_sql(cine_skus, 'A')
    sku_sql += "\n"
    sku_sql += generate_sku_sql(bc_skus, 'B')
    sku_sql += "\n"
    sku_sql += generate_sku_sql(acc_skus, 'E')
    
    with open(os.path.join(BASE_DIR, '../server/scripts/import_all_sku.sql'), 'w', encoding='utf-8') as f:
        f.write(sku_sql)
    print("Generated: import_all_sku.sql")

if __name__ == '__main__':
    main()
