#!/usr/bin/env node

const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, 'server', 'database.sqlite');
const db = new sqlite3.Database(dbPath);

console.log('=== 数据库部门和用户权限报告 ===\n');

// 查询所有部门
console.log('📁 所有部门:');
console.log('-'.repeat(80));
db.all('SELECT id, name, parent_id, path FROM departments ORDER BY path', [], (err, departments) => {
  if (err) {
    console.error('查询部门失败:', err.message);
  } else {
    console.table(departments);
  }

  // 查询所有用户及其角色
  console.log('\n👥 所有用户及权限:');
  console.log('-'.repeat(80));
  const query = `
    SELECT 
      u.id,
      u.username,
      u.email,
      u.name,
      u.role,
      u.user_type,
      u.department_id,
      d.name as department_name,
      CASE 
        WHEN u.role = 'admin' THEN '系统管理员'
        WHEN u.role = 'manager' THEN '部门经理'
        WHEN u.role = 'member' THEN '普通成员'
        ELSE u.role
      END as role_cn
    FROM users u
    LEFT JOIN departments d ON u.department_id = d.id
    ORDER BY u.id
  `;
  db.all(query, [], (err, users) => {
    if (err) {
      console.error('查询用户失败:', err.message);
    } else {
      console.table(users);
    }

    // 查询角色统计
    console.log('\n📊 角色统计:');
    console.log('-'.repeat(80));
    db.all('SELECT role, COUNT(*) as count FROM users GROUP BY role ORDER BY count DESC', [], (err, stats) => {
      if (err) {
        console.error('查询统计失败:', err.message);
      } else {
        console.table(stats);
      }

      db.close();
      console.log('\n✅ 查询完成');
    });
  });
});
