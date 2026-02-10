const Database = require('better-sqlite3');

console.log('🔄 Starting database restore...');

const dbOld = new Database('longhorn.db.broken', { readonly: true });
const dbNew = new Database('longhorn.db');

// 禁用外键约束，允许恢复数据
dbNew.pragma('foreign_keys = OFF');

const tables = [
  // Files应用相关表
  'departments',
  'starred_files',
  'file_stats',
  'share_links',
  'access_logs',
  'permissions',
  
  // Service工单相关表
  'inquiry_tickets',
  'inquiry_ticket_sequences',
  'rma_tickets',
  'rma_ticket_sequences',
  'dealer_repairs',
  'dealer_repair_sequences',
  'dealer_repair_parts',
  
  // Issues相关表
  'issues',
  'issue_sequences',
  'issue_comments',
  'issue_attachments',
  'issue_status_history',
  'issue_time_metrics',
  
  // 基础数据表
  'customers',
  'dealers',
  'products',
  'parts_catalog',
  'ai_providers',
  'system_settings'
];

let totalRestored = 0;

tables.forEach(table => {
  try {
    const rows = dbOld.prepare(`SELECT * FROM ${table}`).all();
    console.log(`📊 ${table}: ${rows.length} rows`);
    
    if (rows.length > 0) {
      // 清空目标表
      dbNew.prepare(`DELETE FROM ${table}`).run();
      
      // 获取新表的列名
      const newTableInfo = dbNew.prepare(`PRAGMA table_info(${table})`).all();
      const newColumns = newTableInfo.map(col => col.name);
      
      // 获取旧数据的列名
      const oldColumns = Object.keys(rows[0]);
      
      // 只使用两边都存在的列
      const commonColumns = oldColumns.filter(col => newColumns.includes(col));
      
      if (commonColumns.length === 0) {
        console.log(`  ⚠ No common columns found, skipping`);
        return;
      }
      
      const cols = commonColumns.join(', ');
      const placeholders = commonColumns.map(() => '?').join(', ');
      const stmt = dbNew.prepare(`INSERT INTO ${table} (${cols}) VALUES (${placeholders})`);
      
      let restored = 0;
      rows.forEach(row => {
        try {
          const values = commonColumns.map(col => row[col]);
          stmt.run(...values);
          restored++;
        } catch (e) {
          // 跳过重复或错误数据
          if (!e.message.includes('UNIQUE')) {
            console.log(`    ⚠ Skip row: ${e.message.substring(0, 50)}`);
          }
        }
      });
      
      console.log(`  ✓ Restored ${restored} records`);
      totalRestored += restored;
    }
  } catch (e) {
    console.log(`  ✗ Error on ${table}: ${e.message}`);
  }
});

dbOld.close();

// 恢复外键约束
dbNew.pragma('foreign_keys = ON');
dbNew.close();

console.log(`\n✅ Restore complete! Total records restored: ${totalRestored}`);
