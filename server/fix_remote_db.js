const Database = require('better-sqlite3');
const path = require('path');

const DB_PATH = path.join(__dirname, 'longhorn.db');
const db = new Database(DB_PATH);

console.log('🔄 开始修复数据库中的重复部门...');

try {
    // 1. 删除旧名称的部门 (研发中心, 综合管理)
    const delResult = db.prepare(`
        DELETE FROM departments 
        WHERE name IN ('研发中心 (RD)', '综合管理 (GE)')
    `).run();
    console.log(`🗑️  已删除旧部门记录数: ${delResult.changes}`);

    // 2. 修正保留下来的部门名称 (如果通用台面还是 GE，改名为 RE)
    const updateResult = db.prepare(`
        UPDATE departments 
        SET name = '通用台面 (RE)' 
        WHERE name = '通用台面 (GE)'
    `).run();
    if (updateResult.changes > 0) {
        console.log(`✨ 已把 '通用台面 (GE)' 重命名为 '通用台面 (RE)'`);
    }

    // 3. 再次强制清理非标准 ID (只保留 1-4)
    // 注意: 只有当我们确定 1-4 是正确的时候才这么做。
    // 安全起见，我们查一下结果
    const rows = db.prepare('SELECT * FROM departments').all();
    console.log('\n✅ 当前数据库中的部门列表:');
    rows.forEach(row => {
        console.log(`ID: ${row.id} | Name: ${row.name}`);
    });

} catch (err) {
    console.error('❌ 修复出错:', err);
}
