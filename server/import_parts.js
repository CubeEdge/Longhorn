
const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');

const dbPath = '/Users/admin/Documents/server/Longhorn/server/longhorn.db';
const csvPath = '/Users/admin/Documents/server/Longhorn/testdocs/parts_ac.csv';

const db = new Database(dbPath);

// ==========================================
// 1. 构建型号映射字典
// ==========================================
const models = db.prepare('SELECT id, name_zh FROM product_models').all();
console.log(`Loaded ${models.length} product models for mapping.`);

function findModelId(name) {
    if (!name) return null;
    const cleanName = name.trim();
    
    // 特殊硬映射 (EAGLE = 猎影)
    if (cleanName.includes('EAGLE SDI KVF') || cleanName.includes('猎影SDI')) return 88;
    if (cleanName.includes('EAGLE HDMI KVF') || cleanName.includes('猎影HDMI')) return 89;
    if (cleanName.includes('Ealge HDMI KVF')) return 89; // 修正拼写错误

    // 模糊匹配
    const match = models.find(m => 
        m.name_zh.includes(cleanName) || 
        cleanName.includes(m.name_zh.replace(' 机身', ''))
    );
    
    return match ? match.id : null;
}

// ==========================================
// 2. 读取并解析 CSV
// ==========================================
const csvData = fs.readFileSync(csvPath, 'utf8');
const lines = csvData.split('\n');
const headers = lines[0].split(',');

const parts = [];
for (let i = 1; i < lines.length; i++) {
    if (!lines[i].trim()) continue;
    
    // 处理 CSV 可能存在的引号和逗号问题 (简单版)
    // 注意：Edge/MM2 MC，图像处理模块 这种逗号在名称里的情况
    const row = lines[i].match(/(".*?"|[^",\r\n]+)(?=\s*,|\s*$)/g) || [];
    const fields = row.map(f => f.replace(/^"|"$/g, '').trim());

    if (fields.length < 5) continue;

    const part = {
        // compatible_models_raw: fields[1], (Removed)
        sku: fields[2],
        material_id: fields[3],
        category: fields[4],
        name_internal: fields[5],
        name_internal_en: fields[6],
        name: fields[7],
        name_en: fields[8],
        price_cny: parseFloat(fields[9]?.replace(/[^\d.]/g, '')) || 0,
        price_usd: parseFloat(fields[10]?.replace(/[^\d.]/g, '')) || 0,
        price_eur: parseFloat(fields[11]?.replace(/[^\d.]/g, '')) || 0
    };
    parts.push(part);
}

console.log(`Parsed ${parts.length} parts from CSV.`);

// ==========================================
// 3. 开启事务导入
// ==========================================
const transaction = db.transaction((data) => {
    // A. 清空现有的备件相关表
    db.prepare("DELETE FROM parts_master").run();
    db.prepare("DELETE FROM sku_prices WHERE item_type = 'part'").run();
    db.prepare("DELETE FROM product_model_parts").run();
    console.log("Cleared existing parts data.");

    const insertPart = db.prepare(`
        INSERT INTO parts_master (
            sku, name, name_en, name_internal, name_internal_en, category, material_id, 
            status, created_by, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, 'active', 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    `);

    const insertPrice = db.prepare(`
        INSERT INTO sku_prices (
            sku, item_type, price_cny, price_usd, price_eur, cost_cny, updated_at
        ) VALUES (?, 'part', ?, ?, ?, 0, CURRENT_TIMESTAMP)
    `);

    const insertBom = db.prepare(`
        INSERT INTO product_model_parts (
            product_model_id, product_model_name, part_id, part_sku, part_name, is_common
        ) VALUES (?, ?, ?, ?, ?, 1)
    `);

    let successCount = 0;
    let bomCount = 0;

    for (const p of data) {
        // 1. 插入主表
        const info = insertPart.run(
            p.sku, p.name, p.name_en, p.name_internal, p.name_internal_en, 
            p.category, p.material_id
        );
        const partId = info.lastInsertRowid;

        // 2. 插入价格表
        insertPrice.run(p.sku, p.price_cny, p.price_usd, p.price_eur);

        // 3. 建立机机关联网格 (BOM)
        for (const modelName of compatibleList) {
            const mid = findModelId(modelName);
            if (mid) {
                // 查找型号全称以填充冗余字段
                const mObj = models.find(m => m.id === mid);
                insertBom.run(mid, mObj.name_zh, partId, p.sku, p.name);
                bomCount++;
            } else {
                console.warn(`[Warning] Could not match model name: "${modelName}" for SKU: ${p.sku}`);
            }
        }

        successCount++;
    }

    return { successCount, bomCount };
});

try {
    const result = transaction(parts);
    console.log(`Success: Imported ${result.successCount} parts and established ${result.bomCount} BOM links.`);
} catch (err) {
    console.error("Import failed:", err);
}
