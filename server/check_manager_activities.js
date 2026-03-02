const db = require('better-sqlite3')('longhorn.db');

// 查找所有包含 'Manager' 的活动记录
const activities = db.prepare(`
    SELECT id, ticket_id, actor_name, content 
    FROM ticket_activities 
    WHERE actor_name = 'Manager' OR content LIKE '%@Manager%'
`).all();

console.log(`Found ${activities.length} activities with 'Manager':`);
activities.forEach(a => {
    console.log(`  - Ticket ${a.ticket_id}: Activity #${a.id}, Actor: ${a.actor_name}`);
});

// 查找 Manager 用户
const managerUser = db.prepare(`
    SELECT id, username, role 
    FROM users 
    WHERE username = 'Manager'
`).get();

if (managerUser) {
    console.log('\nManager user found:', managerUser);
} else {
    console.log('\nNo Manager user found');
}

// 查找 Cathy 用户
const cathyUser = db.prepare(`
    SELECT id, username, role, department_id 
    FROM users 
    WHERE username = 'cathy'
`).get();

if (cathyUser) {
    console.log('\nCathy user found:', cathyUser);
    
    // 获取部门信息
    const dept = db.prepare(`SELECT id, name FROM departments WHERE id = ?`).get(cathyUser.department_id);
    if (dept) {
        console.log('Department:', dept.name);
    }
} else {
    console.log('\nNo Cathy user found');
}

db.close();
