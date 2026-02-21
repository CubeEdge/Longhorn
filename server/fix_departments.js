const Database = require("better-sqlite3");
const db = new Database("./longhorn.db");

// Check if departments exist
const depts = db.prepare("SELECT * FROM departments").all();
console.log('Current departments count:', depts.length);

if (depts.length === 0) {
    console.log('⚠️ No departments found! Inserting default departments...');
    
    const defaultDepts = [
        { name: '市场部 (MS)', code: 'MS' },
        { name: '运营部 (OP)', code: 'OP' },
        { name: '研发中心 (RD)', code: 'RD' },
        { name: '通用台面 (RE)', code: 'RE' }
    ];
    
    const insert = db.prepare("INSERT INTO departments (name, code) VALUES (?, ?)");
    const transaction = db.transaction((deptList) => {
        for (const dept of deptList) {
            insert.run(dept.name, dept.code);
        }
    });
    
    transaction(defaultDepts);
    console.log('✅ Default departments inserted successfully!');
} else {
    console.log('✅ Departments exist:');
    depts.forEach(d => console.log(`  - ${d.name} (${d.code})`));
}

// Check admin user
const admin = db.prepare("SELECT id, username, role, department_id, department_name FROM users WHERE username = 'admin'").get();
if (admin) {
    console.log('\nAdmin user:');
    console.log(`  Username: ${admin.username}`);
    console.log(`  Role: ${admin.role}`);
    console.log(`  Department ID: ${admin.department_id}`);
    console.log(`  Department Name: ${admin.department_name}`);
    
    if (!admin.department_id) {
        console.log('⚠️ Admin has no department_id! Setting to first department...');
        const firstDept = db.prepare("SELECT id FROM departments LIMIT 1").get();
        if (firstDept) {
            db.prepare("UPDATE users SET department_id = ?, department_name = (SELECT name FROM departments WHERE id = ?) WHERE username = 'admin'").run(firstDept.id, firstDept.id);
            console.log('✅ Admin department updated!');
        }
    }
} else {
    console.log('❌ Admin user not found!');
}

db.close();
