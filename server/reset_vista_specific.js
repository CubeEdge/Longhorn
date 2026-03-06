/**
 * 重置 SherryFin 和 Jihua 的密码为 vista123
 */
const Database = require('better-sqlite3');
const bcrypt = require('bcryptjs');
const path = require('path');

const dbPath = path.join(__dirname, 'longhorn.db');
const db = new Database(dbPath);

const targetUsers = ['SherryFin', 'Jihua'];

try {
    const hash = bcrypt.hashSync('vista123', 10);
    console.log('🔐 开始重置密码为 vista123...\n');

    for (const username of targetUsers) {
        const user = db.prepare('SELECT id FROM users WHERE username = ?').get(username);
        if (user) {
            db.prepare('UPDATE users SET password = ? WHERE username = ?').run(hash, username);
            console.log(`   ✅ ${username} - 已更新`);
        } else {
            console.log(`   ⚠️  ${username} - 用户不存在`);
        }
    }
    console.log('\n✅ 任务完成');
} catch (err) {
    console.error('\n❌ 失败:', err.message);
    process.exit(1);
} finally {
    db.close();
}
