/**
 * Robust Product Data Importer (v9)
 * 1. Renamed column: material_id_prefix -> material_id
 * 2. Improved product_type detection: fallback to family default if column missing or empty.
 * 3. Ensure is_active = 1 for all models.
 * 4. Improved SaaS ID (Material ID) matching logic.
 */

const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');

const args = process.argv.slice(2);
const dbPathArg = args.find((_, i) => args[i-1] === '--db') || 'longhorn.db';
const csvPathArg = args.find((_, i) => args[i-1] === '--csv');
const familyArg = args.find((_, i) => args[i-1] === '--family');

if (!csvPathArg || !familyArg) {
    console.error('Usage: node import_series_products.js --csv <path> --family <A|B|C|E> [--db <db_path>]');
    process.exit(1);
}

const DB_PATH = path.isAbsolute(dbPathArg) ? dbPathArg : path.join(process.cwd(), dbPathArg);
const CSV_PATH = path.isAbsolute(csvPathArg) ? csvPathArg : path.join(process.cwd(), csvPathArg);

const db = new Database(DB_PATH);

function parseCSV(content) {
    const rows = [];
    let currentRow = [];
    let field = '';
    let inQuotes = false;
    for (let i = 0; i < content.length; i++) {
        const char = content[i];
        const next = content[i+1];
        if (char === '"') {
            if (inQuotes && next === '"') { field += '"'; i++; }
            else inQuotes = !inQuotes;
        } else if (char === ',' && !inQuotes) {
            currentRow.push(field.trim()); field = '';
        } else if ((char === '\r' || char === '\n') && !inQuotes) {
            if (char === '\r' && next === '\n') i++;
            currentRow.push(field.trim());
            if (currentRow.join('').length > 0) rows.push(currentRow);
            currentRow = []; field = '';
        } else field += char;
    }
    if (currentRow.length > 0 || field !== '') {
        currentRow.push(field.trim()); rows.push(currentRow);
    }
    return rows;
}

const FAMILY_TYPE_MAP = {
    'A': '电影机',
    'B': '广电摄像机',
    'C': '电子寻像器',
    'E': '通用附件'
};

try {
    const raw = fs.readFileSync(CSV_PATH, 'utf-8');
    const rows = parseCSV(raw);
    
    let hIdx = -1;
    for (let i = 0; i < Math.min(25, rows.length); i++) {
        const line = rows[i].join('|');
        if (line.includes('品名') || line.includes('SKU') || line.includes('产品') || line.includes('SaaS') || line.includes('物料')) {
            hIdx = i; break;
        }
    }

    if (hIdx === -1) throw new Error('Header not found');
    const h = rows[hIdx];
    const findIndex = (terms) => h.findIndex(cell => terms.some(t => cell.includes(t)));

    const idx = {
        zh: findIndex(['产品名称', 'Product Name']),
        en: findIndex(['产品名称(EN)', 'Product Name(EN)', 'Product Name (EN)']),
        model: findIndex(['产品型号', 'Model Name']),
        sku: findIndex(['SKU', '产品码']),
        sn: findIndex(['序列号', 'SN Prefix']),
        saas: findIndex(['SaaS', 'Product ID', 'SaaSID', '物料码']),
        upc: findIndex(['UPC']),
        type: findIndex(['产品类型', 'Product Type'])
    };

    console.log(`[Family ${familyArg}] Mapping:`, JSON.stringify(idx));

    let mid = null;
    let stats = { m: 0, s: 0, skip: 0 };

    for (let i = hIdx + 1; i < rows.length; i++) {
        const r = rows[i];
        if (r.length < 5) continue;

        const nameZh = r[idx.zh];
        const nameEn = r[idx.en];
        const modelCode = r[idx.model];
        const skuCode = r[idx.sku];
        const saasId = r[idx.saas];
        
        let typeStr = (idx.type !== -1 && r[idx.type]) ? r[idx.type] : FAMILY_TYPE_MAP[familyArg] || 'CAMERA';

        if (modelCode && modelCode.length >= 2 && !modelCode.toLowerCase().includes('model')) {
            let model = db.prepare('SELECT id FROM product_models WHERE model_code = ? OR name_zh = ?').get(modelCode, nameZh);
            if (model) {
                mid = model.id;
                db.prepare("UPDATE product_models SET product_type = ?, product_family = ?, name_en = ?, material_id = ?, is_active = 1, updated_at = datetime('now') WHERE id = ?")
                  .run(typeStr, familyArg, nameEn || null, saasId || null, mid);
            } else {
                const res = db.prepare("INSERT INTO product_models (name_zh, name_en, model_code, product_family, product_type, brand, material_id, is_active, created_at, updated_at) VALUES (?, ?, ?, ?, ?, 'Kinefinity', ?, 1, datetime('now'), datetime('now'))")
                              .run(nameZh, nameEn || null, modelCode, familyArg, typeStr, saasId || null);
                mid = res.lastInsertRowid;
                stats.m++;
            }
        }

        if (!skuCode || skuCode.length < 5 || skuCode.toLowerCase().includes('sku')) { stats.skip++; continue; }
        if (!mid) { stats.skip++; continue; }

        const upc = idx.upc !== -1 ? r[idx.upc] : null;
        const sn = idx.sn !== -1 ? r[idx.sn] : null;
        const exist = db.prepare('SELECT id FROM product_skus WHERE sku_code = ?').get(skuCode);
        
        if (exist) {
            db.prepare("UPDATE product_skus SET model_id = ?, material_id = ?, display_name = ?, display_name_en = ?, upc = ?, sn_prefix = ?, is_active = 1, updated_at = datetime('now') WHERE id = ?")
              .run(mid, saasId || null, nameZh, nameEn || null, upc || null, sn || null, exist.id);
        } else {
            db.prepare("INSERT INTO product_skus (model_id, sku_code, material_id, display_name, display_name_en, upc, sn_prefix, is_active, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, 1, datetime('now'), datetime('now'))")
              .run(mid, skuCode, saasId || null, nameZh, nameEn || null, upc || null, sn || null);
        }
        stats.s++;
    }
    console.log(`[Summary ${familyArg}] Models: ${stats.m}, SKUs: ${stats.s}, Skipped: ${stats.skip}`);
} catch (e) {
    console.error(`Fatal: ${e.message}`);
} finally {
    db.close();
}
