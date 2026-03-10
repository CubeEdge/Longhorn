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
const sqlite3 = require('better-sqlite3');

const DB_PATH = path.join(__dirname, '../../longhorn.db');

const ROLE_MAPPING = {
    'Technician': { newRole: 'Member', jobTitle: 'Technician' },
    'Service': { newRole: 'Member', jobTitle: 'Service' },
    'Operation': { newRole: 'Member', jobTitle: 'Operation' },
    'Engineer': { newRole: 'Member', jobTitle: 'Engineer' },
};

function migrateData() {
    console.log('=== 用户角色迁移开始 ===\n');
    console.log('数据库:', DB_PATH);

    const db = new sqlite3(DB_PATH);

    try {
        db.exec('BEGIN TRANSACTION');

        // 1. 确保新字段存在
        const columns = db.pragma('table_info(users)').map(c => c.name);
        const addColumn = (name, type = 'TEXT') => {
            if (!columns.includes(name)) {
                db.exec(`ALTER TABLE users ADD COLUMN ${name} ${type}`);
            }
        };

        addColumn('job_title');
        addColumn('display_name');
        addColumn('email');
        addColumn('phone');
        addColumn('avatar_url');
        addColumn('status', "TEXT DEFAULT 'active'");
        addColumn('last_login_at');

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
        try {
            console.log('\n--- 验证结果 ---');
            // Fix: department_name is not in users table, it's joined from departments if needed
            const result = db.prepare('SELECT id, username, role, job_title FROM users ORDER BY role').all();
            for (const r of result) {
                console.log(`  ${r.username.padEnd(12)} role=${(r.role || '').padEnd(8)} job_title=${(r.job_title || '-').padEnd(12)}`);
            }
        } catch (vErr) {
            console.error('Verification query failed:', vErr.message);
        }

    } catch (err) {
        if (db.inTransaction) {
            db.exec('ROLLBACK');
        }
        console.error('❌ 迁移失败:', err.message);
        throw err;
    } finally {
        db.close();
    }
}

if (require.main === module) {
    migrateData();
}

module.exports = { migrateData };
