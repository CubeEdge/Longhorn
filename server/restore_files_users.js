const Database = require('better-sqlite3');
const bcrypt = require('bcryptjs');
const path = require('path');

const DB_PATH = path.join(__dirname, 'longhorn.db');
const db = new Database(DB_PATH);

console.log('[Restore] Restoring Files module users and departments...');

try {
    const transaction = db.transaction(() => {
        // 1. Restore Departments
        const departments = [
            { id: 1, name: '市场部 (MS)', code: 'MS' },
            { id: 2, name: '运营部 (OP)', code: 'OP' },
            { id: 3, name: '研发部 (RD)', code: 'RD' },
            { id: 4, name: '通用台面 (RE)', code: 'RE' }
        ];

        for (const dept of departments) {
            const existing = db.prepare('SELECT id FROM departments WHERE id = ?').get(dept.id);
            if (!existing) {
                db.prepare('INSERT INTO departments (id, name, code) VALUES (?, ?, ?)').run(dept.id, dept.name, dept.code);
                console.log('Department created:', dept.name);
            } else {
                db.prepare('UPDATE departments SET name = ?, code = ? WHERE id = ?').run(dept.name, dept.code, dept.id);
                console.log('Department updated:', dept.name);
            }
        }

        // 2. Restore Users with department_id
        const users = [
            { id: 1, username: 'admin', password: 'admin123', role: 'Admin', department_id: null, user_type: 'Internal' },
            { id: 11, username: 'Pepper', password: 'pepper123', role: 'Lead', department_id: 1, user_type: 'Internal' }, // 市场部主管
            { id: 37, username: 'Orange', password: 'orange123', role: 'Lead', department_id: 2, user_type: 'Internal' }  // 运营部主管
        ];

        for (const user of users) {
            const existing = db.prepare('SELECT id FROM users WHERE id = ?').get(user.id);
            const hash = bcrypt.hashSync(user.password, 10);
            
            if (!existing) {
                db.prepare(`
                    INSERT INTO users (id, username, password, role, department_id, user_type, created_at) 
                    VALUES (?, ?, ?, ?, ?, ?, datetime('now'))
                `).run(user.id, user.username, hash, user.role, user.department_id, user.user_type);
                console.log('User created:', user.username, '-', user.role, user.department_id ? `(Dept ID: ${user.department_id})` : '(No Dept)');
            } else {
                db.prepare(`
                    UPDATE users SET username = ?, password = ?, role = ?, department_id = ?, user_type = ? 
                    WHERE id = ?
                `).run(user.username, hash, user.role, user.department_id, user.user_type, user.id);
                console.log('User updated:', user.username);
            }
        }

        // 3. Update department_name for users based on department_id
        db.prepare(`
            UPDATE users SET department_name = 
                CASE 
                    WHEN department_id = 1 THEN '市场部 (MS)'
                    WHEN department_id = 2 THEN '运营部 (OP)'
                    WHEN department_id = 3 THEN '研发部 (RD)'
                    WHEN department_id = 4 THEN '通用台面 (RE)'
                    ELSE NULL
                END
            WHERE department_id IS NOT NULL
        `).run();
        console.log('Updated department_name for users');

        // 4. Reset SQLite sequence for departments and users
        db.prepare("DELETE FROM sqlite_sequence WHERE name='departments'").run();
        db.prepare("DELETE FROM sqlite_sequence WHERE name='users'").run();
        db.prepare("INSERT INTO sqlite_sequence (name, seq) VALUES ('departments', 4)").run();
        db.prepare("INSERT INTO sqlite_sequence (name, seq) VALUES ('users', 37)").run();
        console.log('Reset sequences');
    });

    transaction();
    console.log('[Restore] Files module users and departments restored successfully!');
    
    // Show final state
    console.log('\n[Departments]');
    const depts = db.prepare('SELECT * FROM departments').all();
    depts.forEach(d => console.log(`  ID: ${d.id}, Name: ${d.name}, Code: ${d.code}`));
    
    console.log('\n[Users]');
    const users = db.prepare('SELECT id, username, role, department_id, department_name, user_type FROM users').all();
    users.forEach(u => console.log(`  ID: ${u.id}, Username: ${u.username}, Role: ${u.role}, Dept: ${u.department_name || 'None'}, Type: ${u.user_type}`));

} catch (err) {
    console.error('[Restore] Error:', err);
} finally {
    db.close();
}
