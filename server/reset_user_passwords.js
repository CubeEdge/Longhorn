/**
 * 批量重置用户密码脚本
 */

const Database = require('better-sqlite3');
const bcrypt = require('bcryptjs');
const path = require('path');

const dbPath = path.join(__dirname, 'longhorn.db');
const db = new Database(dbPath);

console.log('🔐 开始批量重置用户密码...\n');

// 密码分组
const vistaUsers = ['Cathy', 'Effy', 'Sherry', '李雨健', '吴琪萌'];
const mavoUsers = ['伍帅', '张工', '张平娇', '陈高松', '汪蒙', 'Bishan', '张承', '郭建辉', '时春杰'];

try {
    // 生成密码哈希
    const vistaHash = bcrypt.hashSync('vista123', 10);
    const mavoHash = bcrypt.hashSync('mavo123', 10);
    
    console.log('✅ 密码哈希生成完成\n');
    
    // 更新 vista 用户
    console.log('📝 更新 vista123 密码的用户:');
    for (const username of vistaUsers) {
        const user = db.prepare('SELECT id FROM users WHERE username = ?').get(username);
        if (user) {
            db.prepare('UPDATE users SET password = ? WHERE username = ?').run(vistaHash, username);
            console.log(`   ✅ ${username} - 已更新`);
        } else {
            console.log(`   ⚠️  ${username} - 用户不存在`);
        }
    }
    
    console.log('\n📝 更新 mavo123 密码的用户:');
    for (const username of mavoUsers) {
        const user = db.prepare('SELECT id FROM users WHERE username = ?').get(username);
        if (user) {
            db.prepare('UPDATE users SET password = ? WHERE username = ?').run(mavoHash, username);
            console.log(`   ✅ ${username} - 已更新`);
        } else {
            console.log(`   ⚠️  ${username} - 用户不存在`);
        }
    }
    
    console.log('\n✅ 密码重置完成！\n');
    console.log('📊 统计:');
    console.log(`   vista123: ${vistaUsers.length} 个用户`);
    console.log(`   mavo123: ${mavoUsers.length} 个用户`);
    
} catch (err) {
    console.error('\n❌ 密码重置失败:', err.message);
    process.exit(1);
} finally {
    db.close();
}
