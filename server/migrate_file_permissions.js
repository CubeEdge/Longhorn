/**
 * 文件权限表优化迁移脚本
 * 
 * 改进内容：
 * 1. 重命名表：permissions → file_permissions
 * 2. 增加 path_hash 字段用于快速查询
 * 3. 创建唯一索引防止重复授权
 * 4. 添加过期时间索引优化查询性能
 */

const Database = require('better-sqlite3');
const crypto = require('crypto');
const path = require('path');

const dbPath = path.join(__dirname, 'longhorn.db');
const db = new Database(dbPath);

console.log('🚀 开始文件权限表优化迁移...\n');

try {
    // 1. 验证表已重命名
    const tableExists = db.prepare(`
        SELECT name FROM sqlite_master WHERE type='table' AND name='file_permissions'
    `).get();
    
    if (!tableExists) {
        throw new Error('❌ file_permissions 表不存在，请先执行表重命名');
    }
    
    console.log('✅ 表名验证通过：file_permissions\n');

    // 2. 检查 path_hash 列是否存在
    const columns = db.prepare("PRAGMA table_info(file_permissions)").all();
    const hasPathHash = columns.some(col => col.name === 'path_hash');
    
    if (!hasPathHash) {
        console.log('⚠️  path_hash 列不存在，尝试添加...');
        try {
            db.exec("ALTER TABLE file_permissions ADD COLUMN path_hash TEXT");
            console.log('✅ 已添加 path_hash 列\n');
        } catch (err) {
            console.log('ℹ️  path_hash 列可能已存在:', err.message, '\n');
        }
    } else {
        console.log('✅ path_hash 列已存在\n');
    }

    // 3. 为现有数据生成 path_hash
    console.log('📝 为现有权限记录生成 path_hash...');
    const permissions = db.prepare('SELECT id, folder_path FROM file_permissions WHERE path_hash IS NULL').all();
    
    if (permissions.length > 0) {
        const updateStmt = db.prepare('UPDATE file_permissions SET path_hash = ? WHERE id = ?');
        
        let updated = 0;
        for (const perm of permissions) {
            // 使用 folder_path 的 MD5 作为 hash
            const hash = crypto.createHash('md5').update(perm.folder_path).digest('hex');
            updateStmt.run(hash, perm.id);
            updated++;
            
            if (updated % 100 === 0) {
                console.log(`   已更新 ${updated}/${permissions.length} 条记录...`);
            }
        }
        
        console.log(`✅ 已为 ${updated} 条记录生成 path_hash\n`);
    } else {
        console.log('✅ 所有记录已包含 path_hash\n');
    }

    // 4. 创建/验证索引
    console.log('📊 创建优化索引...');
    
    const indexes = [
        {
            name: 'idx_file_permissions_user_path',
            sql: 'CREATE UNIQUE INDEX IF NOT EXISTS idx_file_permissions_user_path ON file_permissions(user_id, folder_path)'
        },
        {
            name: 'idx_file_permissions_path_hash',
            sql: 'CREATE INDEX IF NOT EXISTS idx_file_permissions_path_hash ON file_permissions(path_hash)'
        },
        {
            name: 'idx_file_permissions_expires',
            sql: 'CREATE INDEX IF NOT EXISTS idx_file_permissions_expires ON file_permissions(expires_at) WHERE expires_at IS NOT NULL'
        }
    ];
    
    for (const idx of indexes) {
        try {
            db.exec(idx.sql);
            console.log(`✅ 索引已创建：${idx.name}`);
        } catch (err) {
            console.log(`ℹ️  索引可能已存在 ${idx.name}:`, err.message);
        }
    }
    
    console.log('\n✅ 索引创建完成\n');

    // 5. 添加级联删除触发器（可选）
    console.log('🔗 添加级联删除触发器...');
    try {
        db.exec(`
            CREATE TRIGGER IF NOT EXISTS cascade_delete_file_permissions
            AFTER DELETE ON users
            BEGIN
                DELETE FROM file_permissions WHERE user_id = OLD.id;
            END
        `);
        console.log('✅ 级联删除触发器已创建\n');
    } catch (err) {
        console.log('ℹ️  触发器可能已存在:', err.message, '\n');
    }

    // 6. 统计信息
    const stats = db.prepare(`
        SELECT 
            COUNT(*) as total,
            COUNT(path_hash) as with_hash,
            COUNT(CASE WHEN expires_at IS NOT NULL THEN 1 END) as with_expiry
        FROM file_permissions
    `).get();
    
    console.log('📊 迁移后统计:');
    console.log(`   总记录数：${stats.total}`);
    console.log(`   含 path_hash: ${stats.with_hash}`);
    console.log(`   含过期时间：${stats.with_expiry}`);
    
    console.log('\n✅ 迁移完成！\n');
    
} catch (err) {
    console.error('\n❌ 迁移失败:', err.message);
    console.error(err.stack);
    process.exit(1);
} finally {
    db.close();
}
