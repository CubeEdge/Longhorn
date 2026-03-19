/**
 * upgrade_parts_pricing.js
 * 数据库迁移脚: 升级配件系统，剥离价格到 sku_prices 通用价格表，并扩充名称字段。
 * 【安全策略】: 只加不减，100% 向下兼容。
 */

const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, '../longhorn.db');
console.log(`[Migration] Connecting to database at: ${dbPath}`);

const db = new Database(dbPath);

try {
    // 采用事务运行
    const migration = db.transaction(() => {
        // ==========================================
        // 1. 创建通用价格表 sku_prices
        // ==========================================
        console.log('[1/4] Creating `sku_prices` table...');
        db.prepare(`
            CREATE TABLE IF NOT EXISTS sku_prices (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                sku TEXT UNIQUE NOT NULL,                       
                item_type TEXT CHECK (item_type IN ('part', 'product', 'accessory')), 
                price_cny DECIMAL(10, 2) DEFAULT 0,
                price_usd DECIMAL(10, 2) DEFAULT 0,
                price_eur DECIMAL(10, 2) DEFAULT 0,
                cost_cny DECIMAL(10, 2) DEFAULT 0,              
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        `).run();

        db.prepare(`CREATE INDEX IF NOT EXISTS idx_sku_prices_sku ON sku_prices(sku)`).run();

        // ==========================================
        // 2. 将 parts_master 的价格数据镜像同步到新表
        // ==========================================
        console.log('[2/4] Mirroring prices from parts_master to sku_prices...');
        db.prepare(`
            INSERT OR IGNORE INTO sku_prices (sku, item_type, price_cny, price_usd, price_eur, cost_cny)
            SELECT sku, 'part', price_cny, price_usd, price_eur, cost_cny
            FROM parts_master
        `).run();

        // ==========================================
        // 3. 扩充 parts_master 字段 (内部与对外名称)
        // ==========================================
        console.log('[3/4] Adding internal/external name columns to parts_master (if not exists)...');
        const columns = db.prepare("PRAGMA table_info(parts_master)").all();
        const existingColumns = columns.map(c => c.name);

        const columnsToAdd = [
            'name_internal',
            'name_internal_en',
            'name_external',
            'name_external_en'
        ];

        columnsToAdd.forEach(column => {
            if (!existingColumns.includes(column)) {
                console.log(`Adding column: ${column} to parts_master`);
                db.prepare(`ALTER TABLE parts_master ADD COLUMN ${column} TEXT`).run();
            }
        });

        // ==========================================
        // 4. 数据回填：将原有 name/name_en 赋值到 name_internal 备用
        // ==========================================
        console.log('[4/4] Backfilling names to name_internal...');
        db.prepare(`
            UPDATE parts_master 
            SET name_internal = name, 
                name_internal_en = name_en 
            WHERE name_internal IS NULL OR name_internal = ''
        `).run();

        console.log('✅ Migration Transaction Prepared.');
    });

    // 执行事务
    migration();
    console.log('🎉 Database migration successfully executed in a single transaction.');

} catch (err) {
    console.error('❌ Migration failed:', err);
    process.exit(1);
} finally {
    db.close();
}
