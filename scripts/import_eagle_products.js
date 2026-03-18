/**
 * Eagle Product Data Importer (Dependency-Free Version)
 * Imports product models and SKUs from eagle.csv into Longhorn database.
 * 
 * Usage:
 *   node scripts/import_eagle_products.js [--dry-run] [--db path/to/db]
 */

const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');

const args = process.argv.slice(2);
const isDryRun = args.includes('--dry-run');
const dbPathArg = args.find((_, i) => args[i-1] === '--db');
const csvPathArg = args.find((_, i) => args[i-1] === '--csv');
const familyArg = args.find((_, i) => args[i-1] === '--family') || 'C';

const DB_PATH = dbPathArg || path.join(__dirname, '../server/longhorn.db');
const CSV_PATH = csvPathArg || path.join(__dirname, '../testdocs/eagle.csv');

console.log(`[Import] Mode: ${isDryRun ? 'DRY RUN (No changes)' : 'LIVE'}`);
console.log(`[Import] Family: ${familyArg}`);
console.log(`[Import] DB: ${DB_PATH}`);
console.log(`[Import] CSV: ${CSV_PATH}\n`);

if (!fs.existsSync(CSV_PATH)) {
    console.error(`Error: CSV file not found at ${CSV_PATH}`);
    process.exit(1);
}

const db = new Database(DB_PATH);

// Simple CSV line parser (handles quotes and commas)
function parseCSVLine(line) {
    const result = [];
    let cur = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
        const char = line[i];
        if (char === '"') {
            if (inQuotes && line[i + 1] === '"') {
                cur += '"';
                i++;
            } else {
                inQuotes = !inQuotes;
            }
        } else if (char === ',' && !inQuotes) {
            result.push(cur.trim());
            cur = '';
        } else {
            cur += char;
        }
    }
    result.push(cur.trim());
    return result;
}

// Helper to get or create model_id
function ensureProductModel(modelCode, nameZh, nameEn) {
    if (!modelCode && !nameZh) return null;

    let model = null;
    if (modelCode) {
        model = db.prepare('SELECT id FROM product_models WHERE model_code = ?').get(modelCode);
    }
    
    if (!model && nameZh) {
        model = db.prepare('SELECT id FROM product_models WHERE name_zh = ?').get(nameZh);
    }

    if (model) return model.id;

    if (isDryRun) {
        console.log(`[DryRun] Would create product model: ${nameZh} (${modelCode || 'N/A'}) - Family: ${familyArg}`);
        return 'NEW_MODEL_ID';
    }

    const result = db.prepare(`
        INSERT INTO product_models (name_zh, name_en, model_code, product_family, product_type, brand, is_active, created_at, updated_at)
        VALUES (?, ?, ?, ?, 'EQUIPMENT', 'Kinefinity', 1, datetime('now'), datetime('now'))
    `).run(nameZh, nameEn || null, modelCode || null, familyArg);
    
    return result.lastInsertRowid;
}

try {
    const csvContent = fs.readFileSync(CSV_PATH, 'utf-8');
    const lines = csvContent.split(/\r?\n/).filter(line => line.trim() !== '');

    let currentModelId = null;
    let stats = { skipped: 0, models: 0, skus: 0 };

    for (let i = 0; i < lines.length; i++) {
        const row = parseCSVLine(lines[i]);
        
        // Data extraction based on eagle.csv structure
        // Column indices after comma split: 
        // 0: ignored(empty from leading comma), 1: #, 2: NameZH, 3: NameEN, 4: Model, 5: SKU, 6: SN Prefix, 7: SaaS ID, 8: UPC
        const nameZh = row[2];
        const nameEn = row[3];
        const modelCode = row[4];
        const skuCode = row[5];
        const snPrefix = row[6];
        const materialId = row[7];
        const upc = row[8];

        // Skip headers and irrelevant lines
        if (i < 15 || (!skuCode && !modelCode)) {
            continue;
        }

        // 1. Detect and ensure Model
        if (modelCode && modelCode.length >= 3 && !modelCode.includes('Model')) {
            const newModelId = ensureProductModel(modelCode, nameZh, nameEn);
            if (newModelId) {
                currentModelId = newModelId;
                stats.models++;
            }
        }

        // 2. Data Filtering: Must have SKU
        if (!skuCode || skuCode.length < 5 || skuCode.includes('SKU/')) {
            stats.skipped++;
            continue;
        }

        if (!currentModelId) {
            console.warn(`[Warn] Line ${i+1}: No model context for SKU ${skuCode}. Skipping.`);
            stats.skipped++;
            continue;
        }

        // 3. Import SKU
        if (isDryRun) {
            console.log(`[DryRun] Would import SKU: ${skuCode} [${nameZh}] (ModelID: ${currentModelId})`);
        } else {
            try {
                const tableInfo = db.prepare(`PRAGMA table_info(product_skus)`).all();
                const columns = tableInfo.map(c => c.name);

                const existing = db.prepare('SELECT id FROM product_skus WHERE sku_code = ?').get(skuCode);
                
                if (existing) {
                    let updateSql = `UPDATE product_skus SET model_id = ?, material_id = ?, display_name = ?, display_name_en = ?`;
                    let params = [currentModelId === 'NEW_MODEL_ID' ? 0 : currentModelId, materialId || null, nameZh, nameEn || null];

                    if (columns.includes('upc')) {
                        updateSql += `, upc = ?`;
                        params.push(upc || null);
                    }
                    if (columns.includes('sn_prefix')) {
                        updateSql += `, sn_prefix = ?`;
                        params.push(snPrefix || null);
                    }

                    updateSql += `, updated_at = datetime('now') WHERE id = ?`;
                    params.push(existing.id);
                    db.prepare(updateSql).run(...params);
                } else {
                    let colNames = ['model_id', 'sku_code', 'material_id', 'display_name', 'display_name_en'];
                    let placeholders = ['?', '?', '?', '?', '?'];
                    let params = [currentModelId, skuCode, materialId || null, nameZh, nameEn || null];

                    if (columns.includes('upc')) {
                        colNames.push('upc');
                        placeholders.push('?');
                        params.push(upc || null);
                    }
                    if (columns.includes('sn_prefix')) {
                        colNames.push('sn_prefix');
                        placeholders.push('?');
                        params.push(snPrefix || null);
                    }

                    db.prepare(`
                        INSERT INTO product_skus (${colNames.join(', ')}, is_active, created_at, updated_at) 
                        VALUES (${placeholders.join(', ')}, 1, datetime('now'), datetime('now'))
                    `).run(...params);
                }
            } catch (err) {
                console.error(`[Error] Failed to import SKU ${skuCode}:`, err.message);
                continue;
            }
        }
        stats.skus++;
    }

    console.log(`\n[Summary]`);
    console.log(`- Models Processed: ${stats.models}`);
    console.log(`- SKUs Imported/Updated: ${stats.skus}`);
    console.log(`- Lines Skipped: ${stats.skipped}`);
    
    if (!isDryRun) {
        console.log(`\nImport completed successfully.`);
    }

} catch (err) {
    console.error(`Fatal Error:`, err);
} finally {
    db.close();
}
