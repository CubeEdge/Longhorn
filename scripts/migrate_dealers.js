const Database = require('better-sqlite3');
const path = require('path');

const DB_PATH = path.join(__dirname, '../server/longhorn.db');
const db = new Database(DB_PATH, { verbose: console.log });

function migrateDealers() {
    console.log('Starting Dealer Migration...');

    // 1. Get all existing dealers
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
        for (const dealer of dealers) {
            console.log(`Migrating dealer: ${dealer.name} (ID: ${dealer.id})`);

            // Check if already migrated (optional check by name to avoid dupes if ran twice)
            // But for now we assume clean migration or we rely on ID mapping.
            // Let's just insert.

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

        // 2. Update Foreign Keys in related tables
        console.log('Updating Foreign Keys...');

        const updateUsers = db.prepare('UPDATE users SET dealer_id = ? WHERE dealer_id = ?');
        const updateRMA = db.prepare('UPDATE rma_tickets SET dealer_id = ? WHERE dealer_id = ?');
        const updateRepairs = db.prepare('UPDATE dealer_repairs SET dealer_id = ? WHERE dealer_id = ?');

        for (const [oldId, newId] of migrationMap.entries()) {
            // Users
            const userRes = updateUsers.run(newId, oldId);
            if (userRes.changes > 0) console.log(`  Updated ${userRes.changes} users for Dealer ${oldId}->${newId}`);

            // RMA Tickets
            const rmaRes = updateRMA.run(newId, oldId);
            if (rmaRes.changes > 0) console.log(`  Updated ${rmaRes.changes} RMA tickets for Dealer ${oldId}->${newId}`);

            // Dealer Repairs
            const repairRes = updateRepairs.run(newId, oldId);
            if (repairRes.changes > 0) console.log(`  Updated ${repairRes.changes} Dealer Repairs for Dealer ${oldId}->${newId}`);
        }
    });

    try {
        transaction();
        console.log('Migration completed successfully.');
    } catch (err) {
        console.error('Migration failed:', err);
    }
}

migrateDealers();
