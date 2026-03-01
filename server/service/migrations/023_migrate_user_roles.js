/**
 * Migration 023: Users Role → platform_role + job_title 数据迁移
 * 
 * 将现有 role 字段标准化：
 * - Technician → role=Member, job_title=Technician
 * - Service    → role=Member, job_title=Service
 * - Operation  → role=Member, job_title=Operation
 * - Engineer   → role=Member, job_title=Engineer
 * - Exec       → role=Exec,   job_title=null (Exec 是平台角色)
 * - Admin/Lead/Member/Dealer → 保持不变
 */

const path = require('path');
const Database = require('better-sqlite3');

const DB_PATH = path.join(__dirname, '../../longhorn.db');
console.log('=== 用户角色迁移开始 ===\n');
console.log('数据库:', DB_PATH);

const db = new Database(DB_PATH);

// 角色映射表: 旧 role → { newRole, jobTitle }
const ROLE_MAPPING = {
    'Technician': { newRole: 'Member', jobTitle: 'Technician' },
    'Service': { newRole: 'Member', jobTitle: 'Service' },
    'Operation': { newRole: 'Member', jobTitle: 'Operation' },
    'Engineer': { newRole: 'Member', jobTitle: 'Engineer' },
    // Exec 是平台角色，保留在 role 中
    // Admin, Lead, Member, Dealer 保持不变
};

try {
    db.exec('BEGIN');

    // 1. 确保新字段存在
    const columns = db.pragma('table_info(users)').map(c => c.name);
    if (!columns.includes('job_title')) {
        console.log('⚠️  job_title 列不存在，先执行 022_users_enhancement.sql');
        db.exec('ALTER TABLE users ADD COLUMN job_title TEXT');
    }
    if (!columns.includes('display_name')) {
        db.exec('ALTER TABLE users ADD COLUMN display_name TEXT');
    }
    if (!columns.includes('email')) {
        db.exec('ALTER TABLE users ADD COLUMN email TEXT');
    }
    if (!columns.includes('phone')) {
        db.exec('ALTER TABLE users ADD COLUMN phone TEXT');
    }
    if (!columns.includes('avatar_url')) {
        db.exec('ALTER TABLE users ADD COLUMN avatar_url TEXT');
    }
    if (!columns.includes('status')) {
        db.exec("ALTER TABLE users ADD COLUMN status TEXT DEFAULT 'active'");
    }
    if (!columns.includes('last_login_at')) {
        db.exec('ALTER TABLE users ADD COLUMN last_login_at TEXT');
    }

    // 2. 读取所有用户
    const users = db.prepare('SELECT id, username, role FROM users').all();
    console.log(`\n共 ${users.length} 个用户\n`);

    const updateStmt = db.prepare('UPDATE users SET role = ?, job_title = ? WHERE id = ?');

    let migratedCount = 0;
    for (const user of users) {
        const mapping = ROLE_MAPPING[user.role];
        if (mapping) {
            updateStmt.run(mapping.newRole, mapping.jobTitle, user.id);
            console.log(`  ✅ ${user.username}: ${user.role} → role=${mapping.newRole}, job_title=${mapping.jobTitle}`);
            migratedCount++;
        } else {
            console.log(`  ⏭️  ${user.username}: role=${user.role} (保持不变)`);
        }
    }

    db.exec('COMMIT');
    console.log(`\n=== 迁移完成: ${migratedCount} 个用户已更新 ===`);

    // 3. 验证结果
    console.log('\n--- 验证结果 ---');
    const result = db.prepare('SELECT id, username, role, job_title, department_name FROM users ORDER BY department_name, role').all();
    for (const r of result) {
        console.log(`  ${r.username.padEnd(12)} role=${(r.role || '').padEnd(8)} job_title=${(r.job_title || '-').padEnd(12)} dept=${r.department_name || '-'}`);
    }

} catch (err) {
    db.exec('ROLLBACK');
    console.error('❌ 迁移失败:', err.message);
    process.exit(1);
} finally {
    db.close();
}
