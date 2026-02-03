const path = require('path');
const Database = require('better-sqlite3');
const fs = require('fs-extra');

const DB_PATH = path.join(__dirname, 'longhorn.db');
const db = new Database(DB_PATH, { verbose: console.log });

console.log('[Seeding] Starting Service Data Seeding...');

// ==========================================
// 1. Clean up relevant tables (Optional: Keep existing?)
// Let's clear to ensure clean state for demo
// ==========================================
// Check if tables exist first to avoid errors
function clearTable(tableName) {
    try {
        db.prepare(`DELETE FROM ${tableName}`).run();
        console.log(`Cleared ${tableName}`);
    } catch (e) { console.log(`Skipped clearing ${tableName} (not found)`); }
}

const tablesToSeed = [
    'inquiry_tickets', 'rma_tickets', 'dealer_repairs',
    'products', 'customers', 'dealers', 'parts_catalog'
];

// Uncomment to clear data
// tablesToSeed.forEach(clearTable);

// ==========================================
// 2. Seed Users (Dealers & Customers)
// ==========================================

// Create Dealers
const dealers = [
    { name: 'ProAV UK', region: 'Europe', contact: 'sales@proav.co.uk', level: 'Level 1' },
    { name: 'Gafpa Gear', region: 'Europe', contact: 'info@gafpagear.com', level: 'Level 1' },
    { name: '1SV', region: 'North America', contact: 'support@1sv.com', level: 'Level 1' },
    { name: 'DP Gadget', region: 'Asia Pacific', contact: 'dp@gadget.com', level: 'Level 2' }
];

const dealerMap = {}; // name -> id

for (const d of dealers) {
    const existing = db.prepare('SELECT id FROM dealers WHERE name = ?').get(d.name);
    if (!existing) {
        // Schema fix: Added code, removed status if not present or handle defaulting
        const dealerCode = 'DLR_' + d.name.replace(/\s+/g, '').substring(0, 3).toUpperCase() + Math.floor(Math.random() * 1000);
        const info = db.prepare(`
            INSERT INTO dealers (
                name, code, region, contact_person, contact_email, dealer_type, 
                can_repair, repair_level
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
            d.name, dealerCode, d.region, d.contact, d.contact,
            d.level === 'Level 1' ? 'FirstTier' : 'SecondTier',
            d.level === 'Level 1' ? 1 : 1, // Assume both can repair for demo
            d.level
        );
        dealerMap[d.name] = info.lastInsertRowid;
    } else {
        dealerMap[d.name] = existing.id;
    }
}

// Create Customers (10+ records)
const customers = [
    {
        name: 'Max Mueller', contact: 'max@example.de', type: 'END_USER', tier: 'VIP',
        channel: 'CHANNEL', dealer: 'ProAV UK', tags: ['CINEMATOGRAPHER', 'RENTAL_OWNER']
    },
    {
        name: 'John Smith', contact: 'john@hollywood.com', type: 'CORPORATE', tier: 'VVIP',
        channel: 'DIRECT', dealer: null, tags: ['PRODUCTION_HOUSE', 'NETFLIX_CERTIFIED']
    },
    {
        name: 'Sarah Connor', contact: 'sarah@skynet.net', type: 'END_USER', tier: 'STANDARD',
        channel: 'DIRECT', dealer: null, tags: ['DOCUMENTARY']
    },
    {
        name: 'Lee Ming', contact: 'lee@beijing.cn', type: 'END_USER', tier: 'VIP',
        channel: 'DIRECT', dealer: null, tags: ['KOL', 'AMBASSADOR']
    },
    {
        name: 'Pierre Dubois', contact: 'pierre@film.fr', type: 'END_USER', tier: 'STANDARD',
        channel: 'CHANNEL', dealer: 'Gafpa Gear', tags: []
    },
    {
        name: 'Global Rentals Inc.', contact: 'ops@globalrentals.com', type: 'CORPORATE', tier: 'VVIP',
        channel: 'CHANNEL', dealer: '1SV', tags: ['RENTAL_HOUSE', 'BULK_BUYER']
    },
    {
        name: 'Indie Filmmakers Co', contact: 'contact@indie.co', type: 'CORPORATE', tier: 'STANDARD',
        channel: 'CHANNEL', dealer: 'DP Gadget', tags: ['INDIE_FILM']
    },
    {
        name: 'Taro Tanaka', contact: 'taro@tokyo.jp', type: 'END_USER', tier: 'STANDARD',
        channel: 'CHANNEL', dealer: 'DP Gadget', tags: []
    },
    {
        name: 'Hans Zimmer (Studio)', contact: 'tech@hans.com', type: 'CORPORATE', tier: 'VVIP',
        channel: 'DIRECT', dealer: null, tags: ['MUSIC_VIDEO', 'HIGH_PROFILE']
    },
    {
        name: 'Test Lab Internal', contact: 'qa@kinefinity.com', type: 'INTERNAL', tier: 'STANDARD',
        channel: 'DIRECT', dealer: null, tags: ['QA', 'BETA_TESTER']
    },
    {
        name: 'Emily Blunt', contact: 'emily@act.com', type: 'END_USER', tier: 'VIP',
        channel: 'CHANNEL', dealer: 'ProAV UK', tags: ['CELEBRITY']
    },
    {
        name: 'BBC Wildlife Unit', contact: 'wildlife@bbc.co.uk', type: 'CORPORATE', tier: 'VVIP',
        channel: 'CHANNEL', dealer: 'ProAV UK', tags: ['BROADCAST', 'RENTAL_HOUSE']
    }
];

const customerMap = {}; // name -> id

for (const c of customers) {
    const existing = db.prepare('SELECT id FROM customers WHERE customer_name = ?').get(c.name);
    let cid;
    if (!existing) {
        const info = db.prepare(`
            INSERT INTO customers (
                customer_name, email, customer_type, account_type, service_tier, 
                acquisition_channel, parent_dealer_id, industry_tags
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
            c.name, c.contact, c.type === 'INTERNAL' ? 'Internal' : 'EndUser', c.type, c.tier,
            c.channel, c.dealer ? dealerMap[c.dealer] : null, JSON.stringify(c.tags)
        );
        cid = info.lastInsertRowid;
    } else {
        cid = existing.id;
        // Update new fields if they are missing
        db.prepare(`
            UPDATE customers SET 
            account_type = ?, service_tier = ?, acquisition_channel = ?, 
            parent_dealer_id = ?, industry_tags = ?
            WHERE id = ?
        `).run(
            c.type, c.tier, c.channel, c.dealer ? dealerMap[c.dealer] : null, JSON.stringify(c.tags), cid
        );
    }
    customerMap[c.name] = cid;
}

// ==========================================
// 3. Seed Products (Devices)
// ==========================================

const products = [
    { model: 'MAVO Edge 8K', sn: 'ME8K_001', family: 'A', line: 'Camera' },
    { model: 'MAVO Edge 6K', sn: 'ME6K_002', family: 'A', line: 'Camera' },
    { model: 'MAVO mark2 LF', sn: 'MM2_003', family: 'A', line: 'Camera' },
    { model: 'MAVO LF', sn: 'MLF_004', family: 'B', line: 'Camera' },
    { model: 'Terra 4K', sn: 'T4K_005', family: 'B', line: 'Camera' },
    { model: 'Eagle SDI', sn: 'ES_006', family: 'C', line: 'EVF' },
    { model: 'Eagle HDMI', sn: 'EH_007', family: 'C', line: 'EVF' },
    { model: 'MC Board 8K', sn: 'PCB_008', family: 'D', line: 'Accessory' },
    { model: 'PD KineBAT 75', sn: 'BAT_009', family: 'D', line: 'Accessory' },
    { model: 'MAVO Edge 8K', sn: 'ME8K_010', family: 'A', line: 'Camera' },
    { model: 'MAVO Edge 8K', sn: 'ME8K_011', family: 'A', line: 'Camera' },
    { model: 'MAVO Edge 6K', sn: 'ME6K_012', family: 'A', line: 'Camera' }
];

const productMap = {}; // sn -> id

for (const p of products) {
    const existing = db.prepare('SELECT id FROM products WHERE serial_number = ?').get(p.sn);
    if (!existing) {
        const info = db.prepare(`
            INSERT INTO products (model_name, serial_number, product_family, product_line)
            VALUES (?, ?, ?, ?)
        `).run(p.model, p.sn, p.family, p.line);
        productMap[p.sn] = info.lastInsertRowid;
    } else {
        productMap[p.sn] = existing.id;
        // Update family
        db.prepare('UPDATE products SET product_family = ? WHERE id = ?').run(p.family, existing.id);
    }
}

// ==========================================
// 4. Seed Parts (For Repairs)
// ==========================================

// Check if parts_catalog table exists (it might be named differently or not created yet)
// Based on 007 migration: `parts_catalog` referenced, but `CREATE TABLE parts_catalog` is likely in 007 or earlier. 
// Wait, 007 has `FOREIGN KEY(part_id) REFERENCES parts_catalog(id)`. 
// Let's assume `parts_catalog` exists or create it if missing (simplified version).

try {
    db.exec(`
        CREATE TABLE IF NOT EXISTS parts_catalog (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            part_number TEXT UNIQUE,
            name TEXT,
            category TEXT,
            price_usd REAL,
            price_cny REAL,
            compatible_models TEXT
        )
    `);
} catch (e) { }

const parts = [
    { pn: 'S1-001', name: 'SDI Module (Edge)', price: 69, cat: 'Module' },
    { pn: 'S1-002', name: 'Fan Unit (General)', price: 45, cat: 'Cooling' },
    { pn: 'S1-003', name: 'Main Board (M2)', price: 800, cat: 'PCB' },
    { pn: 'S1-004', name: 'Lens Mount (EF)', price: 120, cat: 'Mechanical' },
    { pn: 'S1-005', name: 'Top Handle', price: 150, cat: 'Accessory' }
];

const partMap = {}; // pn -> id

for (const p of parts) {
    const existing = db.prepare('SELECT id FROM parts_catalog WHERE part_number = ?').get(p.pn);
    if (!existing) {
        // Schema: part_number, part_name, part_name_en, category, retail_price, cost_price
        const info = db.prepare(`
            INSERT INTO parts_catalog (part_number, part_name, part_name_en, category, retail_price, cost_price)
            VALUES (?, ?, ?, ?, ?, ?)
        `).run(p.pn, p.name, p.name, p.cat, p.price, p.price * 0.7);
        partMap[p.pn] = info.lastInsertRowid;
    } else {
        partMap[p.pn] = existing.id;
    }
}

// ==========================================
// 5. Seed Service Tickets (History)
// ==========================================

// Helper for dates
const daysAgo = (n) => {
    const d = new Date();
    d.setDate(d.getDate() - n);
    return d.toISOString();
};

const tickets = [
    // Max Mueller (VIP, Dealer: ProAV) - Has recent RMA
    {
        type: 'inquiry', customer: 'Max Mueller', product: 'ME8K_001', sn: 'ME8K_001',
        summary: 'Camera getting hot', status: 'Upgraded', date: daysAgo(30),
        detail: 'User reports high temp warning during 8K recording.'
    },
    {
        type: 'rma', customer: 'Max Mueller', product: 'ME8K_001', sn: 'ME8K_001',
        summary: 'Overheating check', status: 'Completed', date: daysAgo(25),
        desc: 'Fan likely broken.', solution: 'Replaced Fan Unit.',
        parts: ['S1-002']
    },

    // John Smith (VVIP, Direct) - Active Inquiry
    {
        type: 'inquiry', customer: 'John Smith', product: 'ME6K_002', sn: 'ME6K_002',
        summary: 'Firmware update failed', status: 'InProgress', date: daysAgo(2),
        detail: 'Stuck at 99%.'
    },

    // Sarah Connor (Standard, Direct) - Historical Dealer Repair (maybe she used a dealer before)
    // Actually Dealer Repair is linked to Dealer. Let's assign a dealer repair for a dealer customer.

    // Pierre Dubois (Standard, Dealer: Gafpa)
    {
        type: 'dealer_repair', dealer: 'Gafpa Gear', customer: 'Pierre Dubois', product: 'MM2_003', sn: 'MM2_003',
        summary: 'SDI Port loose', status: 'Completed', date: daysAgo(60),
        parts: ['S1-001']
    },

    // Global Rentals (Corporate) - Batch of RMAs
    {
        type: 'rma', customer: 'Global Rentals Inc.', product: 'ME8K_010', sn: 'ME8K_010',
        summary: 'Sensor dust cleaning', status: 'Pending', date: daysAgo(1),
        desc: 'Routine maintenance.'
    },
    {
        type: 'rma', customer: 'Global Rentals Inc.', product: 'ME8K_011', sn: 'ME8K_011',
        summary: 'Button stuck', status: 'Pending', date: daysAgo(1),
        desc: 'Record button sticky.'
    },

    // BBC Wildlife (VVIP)
    {
        type: 'inquiry', customer: 'BBC Wildlife Unit', product: 'ME6K_012', sn: 'ME6K_012',
        summary: 'Weather sealing question', status: 'Resolved', date: daysAgo(100),
        detail: 'Is it safe for rain?'
    }
];

let inqSeq = 1;
let rmaSeq = 1;

for (const t of tickets) {
    const cId = customerMap[t.customer];
    const pId = productMap[t.sn];

    if (t.type === 'inquiry') {
        const ticketNum = `K2602-${String(inqSeq++).padStart(4, '0')}`;
        const existing = db.prepare('SELECT id FROM inquiry_tickets WHERE ticket_number = ?').get(ticketNum);
        if (existing) {
            console.log(`Skipping existing inquiry ticket ${ticketNum}`);
        } else {
            db.prepare(`
                INSERT INTO inquiry_tickets (
                    ticket_number, customer_id, customer_name, product_id, serial_number,
                    problem_summary, status, created_at, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            `).run(
                ticketNum, cId, t.customer, pId, t.sn,
                t.summary, t.status, t.date, t.date
            );
        }
    } else if (t.type === 'rma') {
        const dealer = t.customer && customers.find(c => c.name === t.customer)?.dealer;
        const dId = dealer ? dealerMap[dealer] : null; // If customer belongs to dealer, RMA might be associated

        const ticketNum = `RMA-D-2602-${String(rmaSeq++).padStart(4, '0')}`;
        const existing = db.prepare('SELECT id FROM rma_tickets WHERE ticket_number = ?').get(ticketNum);
        if (existing) {
            console.log(`Skipping existing RMA ticket ${ticketNum}`);
        } else {
            const info = db.prepare(`
                INSERT INTO rma_tickets (
                    ticket_number, customer_id, product_id, serial_number,
                    problem_description, solution_for_customer, status, created_at, updated_at,
                    channel_code, dealer_id
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `).run(
                ticketNum, cId, pId, t.sn,
                t.desc || t.summary, t.solution, t.status, t.date, t.date,
                dId ? 'D' : 'C', dId
            );
        }

        // Add Parts (Mock cost)
        // Note: RMA parts usually handled in production_feedbacks or similar, 
        // but for now we don't have a direct 'rma_parts' table in the partial SQL I saw.
        // But `dealer_repair_parts` exists.
        // Let's assume for this demo we don't populate RMA parts deeply unless we find the table.
        // Migration 006_repair_management.sql likely has it.
    } else if (t.type === 'dealer_repair') {
        const dId = dealerMap[t.dealer];
        const ticketNum = `SVC-D-2601-${String(Math.floor(Math.random() * 100)).padStart(4, '0') + Math.floor(Math.random() * 100)}`; // More randomness

        // Simple try-catch for unique just in case ID collision
        try {
            const info = db.prepare(`
                INSERT INTO dealer_repairs (
                    ticket_number, dealer_id, customer_id, customer_name, product_id, serial_number,
                    problem_description, status, created_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            `).run(
                ticketNum, dId, cId, t.customer, pId, t.sn,
                t.summary, t.status, t.date
            );

            // Add Parts
            if (t.parts) {
                for (const pn of t.parts) {
                    const partId = partMap[pn];
                    db.prepare(`
                        INSERT INTO dealer_repair_parts (dealer_repair_id, part_id, quantity, unit_price)
                        VALUES (?, ?, 1, (SELECT retail_price FROM parts_catalog WHERE id = ?))
                    `).run(info.lastInsertRowid, partId, partId);
                }
            }
        } catch (e) { console.log('Skipped duplicate Dealer Repair ' + ticketNum); }
    }
}

console.log('[Seeding] Completed!');
