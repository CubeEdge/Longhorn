/**
 * remove_parts_prices.js
 * 破坏性迁移：彻底从 parts_master 移除价格字段。
 */

const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, '../longhorn.db');
console.log(`[Migration] Connecting to database at: ${dbPath}`);

const db = new Database(dbPath);

try {
    const migration = db.transaction(() => {
        const columns = db.prepare("PRAGMA table_info(parts_master)").all();
        const existingColumns = columns.map(c => c.name);

        const columnsToRemove = ['price_cny', 'price_usd', 'price_eur', 'cost_cny'];

        // 检查 SQLite 版本是否原生支持 DROP COLUMN (>= 3.35.0)
        let supportsDrop = false;
        try {
            // 尝试在事务内运行一次无害的测试，或用版本测试
            const versionResult = db.prepare("SELECT sqlite_version()").get();
            console.log(`SQLite Version: ${versionResult['sqlite_version()']}`);
            
            const [major, minor, patch] = versionResult['sqlite_version()'].split('.').map(Number);
            supportsDrop = major > 3 || (major === 3 && minor >= 35);
        } catch (e) {
            console.log('Could not determine SQLite version support, fallback to safe-recreate method.');
        }

        if (supportsDrop) {
            console.log('Native DROP COLUMN supported. Proceeding...');
            columnsToRemove.forEach(col => {
                if (existingColumns.includes(col)) {
                    console.log(`Dropping column: ${col}`);
                    db.prepare(`ALTER TABLE parts_master DROP COLUMN ${col}`).run();
                }
            });
        } else {
            console.log('Native DROP COLUMN NOT supported. Using table Recreation strategy...');
            // 1. 获取创建原表的SQL
            const createSqlResult = db.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='parts_master'").get();
            let createSql = createSqlResult.sql;

            // 2. 剥除价格字段
            createSql = createSql.replace(/,\s*price_cny\s+DECIMAL[^,]+/, '')
                                 .replace(/,\s*price_usd\s+DECIMAL[^,]+/, '')
                                 .replace(/,\s*price_eur\s+DECIMAL[^,]+/, '')
                                 .replace(/,\s*cost_cny\s+DECIMAL[^,]+/, '');

            const tempTableName = 'parts_master_new';
            const cleanCreateSql = createSql.replace('parts_master', tempTableName);

            // 🛠️ 极其安全的重构法
            db.prepare(cleanCreateSql).run();

            // 3. 构建 SELECT 字段 (不包含被删除项)
            const columnsToSelect = existingColumns.filter(c => !columnsToRemove.includes(c));
            const selectFields = columnsToSelect.join(', ');

            db.prepare(`INSERT INTO ${tempTableName} (${selectFields}) SELECT ${selectFields} FROM parts_master`).run();

            // 4. 重命名覆盖
            db.prepare("DROP TABLE parts_master").run();
            db.prepare(`ALTER TABLE ${tempTableName} RENAME TO parts_master`).run();

            // 5. 重新建立索引 (从 sqlite_master 拿)
            const indexes = db.prepare("SELECT sql FROM sqlite_master WHERE type='index' AND tbl_name='parts_master'").all();
            indexes.forEach(idx => {
                if (idx.sql) db.prepare(idx.sql).run();
            });
        }

        console.log('✅ Columns dropped for parts_master.');
    });

    migration();
    console.log('🎉 Price columns effectively removed from parts_master.');

} catch (err) {
    console.error('❌ Migration failed:', err);
    process.exit(1);
} finally {
    db.close();
}
