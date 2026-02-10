const Database = require('better-sqlite3');
const path = require('path');

const DB_PATH = path.join(__dirname, '../server/longhorn.db');
const db = new Database(DB_PATH, { verbose: console.log });

function migrateDealers() {
    console.log('Starting Dealer Migration V2...');

    // 1. Disable Foreign Keys to allow ID updates
    db.pragma('foreign_keys = OFF');
    console.log('Foreign Keys Disabled.');

    const dealers = db.prepare('SELECT * FROM dealers').all();
    console.log(`Found ${dealers.length} dealers to migrate.`);

    const migrationMap = new Map(); // OldID -> NewID

    const insertCustomer = db.prepare(`
        INSERT INTO customers (
            customer_type, customer_name, contact_person, phone, email,
            country, province, city, company_name, notes,
            account_type, service_tier, created_at, updated_at
        ) VALUES (
            'Dealer', @name, @contact_person, @contact_phone, @contact_email,
            @country, @region, @city, @name, @notes,
            @dealer_type, @repair_level, @created_at, @updated_at
        )
    `);

    // Transaction to ensure data integrity
    const transaction = db.transaction(() => {
        // --- DATA MIGRATION ---
        for (const dealer of dealers) {
            console.log(`Migrating dealer: ${dealer.name} (ID: ${dealer.id})`);

            // Check if already migrated? 
            // We assume this is run once or on a fresh DB state. 
            // If previous run partially succeeded (but rolled back), then IDs are burned but data is gone.
            // If previous run committed, we might have dupes.
            // Since previous run failed with ROLLBACK, we are safe.

            const result = insertCustomer.run({
                name: dealer.name,
                contact_person: dealer.contact_person,
                contact_phone: dealer.contact_phone,
                contact_email: dealer.contact_email,
                country: dealer.country,
                region: dealer.region,
                city: dealer.city,
                notes: dealer.notes ? `[Migrated Code: ${dealer.code}] ${dealer.notes}` : `[Migrated Code: ${dealer.code}]`,
                dealer_type: dealer.dealer_type || 'Distributor',
                repair_level: dealer.repair_level || 'Level1',
                created_at: dealer.created_at,
                updated_at: dealer.updated_at
            });

            const newId = result.lastInsertRowid;
            migrationMap.set(dealer.id, newId);
            console.log(`-> Created Customer ID: ${newId}`);
        }

        // --- UPDATE IDs ---
        console.log('Updating Foreign Keys Data...');

        const updateUsers = db.prepare('UPDATE users SET dealer_id = ? WHERE dealer_id = ?');
        const updateRMA = db.prepare('UPDATE rma_tickets SET dealer_id = ? WHERE dealer_id = ?');
        const updateRepairs = db.prepare('UPDATE dealer_repairs SET dealer_id = ? WHERE dealer_id = ?');

        for (const [oldId, newId] of migrationMap.entries()) {
            const userRes = updateUsers.run(newId, oldId);
            if (userRes.changes > 0) console.log(`  Updated ${userRes.changes} users for Dealer ${oldId}->${newId}`);

            const rmaRes = updateRMA.run(newId, oldId);
            if (rmaRes.changes > 0) console.log(`  Updated ${rmaRes.changes} RMA tickets for Dealer ${oldId}->${newId}`);

            const repairRes = updateRepairs.run(newId, oldId);
            if (repairRes.changes > 0) console.log(`  Updated ${repairRes.changes} Dealer Repairs for Dealer ${oldId}->${newId}`);
        }

        // --- SCHEMA MIGRATION ---
        console.log('Migrating Schema (Updating FK definitions)...');

        // 0. Handle Dependent Views
        console.log('Handling Views...');
        // Drop view if exists
        db.prepare('DROP VIEW IF EXISTS v_rma_tickets_ready_for_index').run();
        db.prepare('DROP VIEW IF EXISTS v_dealer_repairs_ready_for_index').run();

        // 1. RMA Tickets
        console.log('Migrating rma_tickets schema...');
        db.prepare('ALTER TABLE rma_tickets RENAME TO rma_tickets_old').run();
        db.prepare(`
            CREATE TABLE rma_tickets (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                ticket_number TEXT UNIQUE NOT NULL,
                channel_code TEXT DEFAULT 'D',
                issue_type TEXT,
                issue_category TEXT,
                issue_subcategory TEXT,
                severity INTEGER DEFAULT 3,
                product_id INTEGER REFERENCES products(id),
                serial_number TEXT,
                firmware_version TEXT,
                hardware_version TEXT,
                problem_description TEXT NOT NULL,
                solution_for_customer TEXT,
                is_warranty INTEGER DEFAULT 1,
                repair_content TEXT,
                problem_analysis TEXT,
                reporter_name TEXT,
                customer_id INTEGER REFERENCES customers(id),
                dealer_id INTEGER REFERENCES customers(id), -- UPDATED
                submitted_by INTEGER REFERENCES users(id),
                assigned_to INTEGER REFERENCES users(id),
                inquiry_ticket_id INTEGER REFERENCES inquiry_tickets(id),
                payment_channel TEXT,
                payment_amount REAL DEFAULT 0,
                payment_date TEXT,
                status TEXT DEFAULT 'Pending',
                repair_priority TEXT DEFAULT 'R3',
                feedback_date TEXT,
                received_date TEXT,
                completed_date TEXT,
                approval_status TEXT,
                approved_by INTEGER REFERENCES users(id),
                approved_at TEXT,
                created_at TEXT DEFAULT CURRENT_TIMESTAMP,
                updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
                host_device_type TEXT, 
                host_device_model TEXT, 
                product_family TEXT
            )
        `).run();
        db.prepare('INSERT INTO rma_tickets SELECT * FROM rma_tickets_old').run();
        db.prepare('DROP TABLE rma_tickets_old').run();

        // Recreate View
        db.prepare(`
            CREATE VIEW v_rma_tickets_ready_for_index AS
            SELECT 
                t.id,
                t.ticket_number,
                t.problem_description,
                t.solution_for_customer,
                t.repair_content,
                p.model_name as product_name,
                t.serial_number,
                'RMA' as ticket_type,
                t.updated_at
            FROM rma_tickets t
            LEFT JOIN products p ON t.product_id = p.id
            WHERE t.status = 'Completed'
        `).run();

        // 2. Dealer Repairs
        console.log('Migrating dealer_repairs schema...');
        db.prepare('ALTER TABLE dealer_repairs RENAME TO dealer_repairs_old').run();
        db.prepare(`
            CREATE TABLE dealer_repairs (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                ticket_number TEXT UNIQUE NOT NULL,
                dealer_id INTEGER REFERENCES customers(id) NOT NULL, -- UPDATED
                customer_name TEXT,
                customer_contact TEXT,
                customer_id INTEGER REFERENCES customers(id),
                product_id INTEGER REFERENCES products(id),
                serial_number TEXT,
                issue_category TEXT,
                issue_subcategory TEXT,
                problem_description TEXT,
                repair_content TEXT,
                inquiry_ticket_id INTEGER REFERENCES inquiry_tickets(id),
                status TEXT DEFAULT 'Completed',
                created_at TEXT DEFAULT CURRENT_TIMESTAMP,
                updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
                product_family TEXT
            )
        `).run();
        db.prepare('INSERT INTO dealer_repairs SELECT * FROM dealer_repairs_old').run();
        db.prepare('DROP TABLE dealer_repairs_old').run();

        // Recreate View
        db.prepare(`
            CREATE VIEW v_dealer_repairs_ready_for_index AS
            SELECT 
                t.id,
                t.ticket_number,
                t.problem_description,
                t.repair_content,
                p.model_name as product_name,
                t.serial_number,
                'DealerRepair' as ticket_type,
                t.updated_at
            FROM dealer_repairs t
            LEFT JOIN products p ON t.product_id = p.id
            WHERE t.status = 'Completed'
        `).run();

        // 3. Users (Adding FK)
        console.log('Migrating users schema...');
        db.prepare('ALTER TABLE users RENAME TO users_old').run();
        db.prepare(`
            CREATE TABLE users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                username TEXT UNIQUE,
                password TEXT,
                role TEXT DEFAULT 'user',
                department_id INTEGER, 
                created_at TEXT DEFAULT '2026-01-02 12:00:00', 
                last_login TEXT, 
                user_type TEXT DEFAULT 'Employee', 
                region_responsible TEXT, 
                dealer_id INTEGER REFERENCES customers(id) -- UPDATED
            )
        `).run();
        db.prepare('INSERT INTO users SELECT * FROM users_old').run();
        db.prepare('DROP TABLE users_old').run();

        // 4. Rename old dealers table to avoid confusion
        db.prepare('ALTER TABLE dealers RENAME TO dealers_legacy').run();

    });

    try {
        transaction();
        console.log('Migration V2 completed successfully.');
        db.pragma('foreign_keys = ON');
    } catch (err) {
        console.error('Migration V2 failed:', err);
    }
}

migrateDealers();
