const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

// Connect to DB
const dbPath = path.join(__dirname, '../longhorn.db');
const db = new Database(dbPath);

console.log('🔄 Checking Migrations...');

// Enable foreign keys
db.pragma('foreign_keys = ON');

console.log('🏗 Ensuring Base Schema...');

console.log('🌱 Seeding Service Data (PRD Cases)...');

// Helper to generate IDs
function genSR(seq) {
    const date = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    return `SR-${date}-${String(seq).padStart(3, '0')}`;
}
function genIssue(type, seq) {
    const year = new Date().getFullYear();
    return `${type}-${year}-${String(seq).padStart(4, '0')}`;
}

// ==========================================
// 1. Service Records (5 CASES FROM PRD)
// ==========================================

const serviceRecords = [
    // Case 1: Max (End User) -> Edge 8K Freezing -> RMA
    {
        record_number: 'SR-2026-0001',
        service_mode: 'CustomerService',
        customer_name: 'Max (End User)',
        customer_contact: 'max@studio.com',
        product_name: 'MAVO Edge 8K',
        serial_number: 'ME8K-207890',
        service_type: 'Troubleshooting',
        channel: 'Dealer', // Through ProAV
        problem_summary: 'Edge 8K freezes when recording 4K 50fps.',
        problem_category: 'Hardware',
        status: 'UpgradedToTicket',
        resolution: 'Escalated to RMA (IS-2026-0157).',
        department: 'Market',
        created_by: 1
    },
    // Case 2: Feature Request -> Quick Start
    {
        record_number: 'SR-2025-0089',
        service_mode: 'CustomerService',
        customer_name: 'Customer A',
        customer_contact: 'cust_a@kine.com',
        product_name: 'General',
        serial_number: '',
        service_type: 'FeatureRequest',
        channel: 'Forum',
        problem_summary: 'Request for "Quick Start" mode to bypass boot logo.',
        problem_category: 'Software',
        status: 'Closed',
        resolution: 'Merged into Feature Request FR-2025-0089. Planned for fw 8.0.',
        department: 'RD',
        created_by: 1
    },
    // Case 3: Dealer Local Repair -> SDI Damaged
    {
        record_number: 'SR-2026-0045',
        service_mode: 'DealerSupport',
        customer_name: 'ProAV (Dealer)',
        customer_contact: 'tech@proav.co.uk',
        product_name: 'MAVO mark2 6K',
        serial_number: 'MM26-2023112',
        service_type: 'Troubleshooting',
        channel: 'Email',
        problem_summary: 'SDI 1 port physically damaged by client.',
        problem_category: 'Hardware',
        status: 'Completed',
        resolution: 'Dealer performed local repair (Local Ticket LR-2026-0012).',
        department: 'Market',
        created_by: 1
    },
    // Case 4: VIP Complaint -> Fan Noise
    {
        record_number: 'SR-2026-0099',
        service_mode: 'CustomerService',
        customer_name: 'VIP Director X',
        customer_contact: 'vip@hollywood.com',
        product_name: 'MAVO Edge 8K',
        serial_number: 'ME8K-2023001',
        service_type: 'Complaint',
        channel: 'WeChat',
        problem_summary: 'Fan noise is too loud for quiet scenes. Unacceptable.',
        problem_category: 'Hardware',
        status: 'InProcess', // P1 Priority
        resolution: null,
        department: 'Market',
        created_by: 1
    },
    // Case 5: Internal Production Issue
    {
        record_number: 'SR-2026-0101',
        service_mode: 'Internal',
        customer_name: 'Production Line',
        customer_contact: 'internal',
        product_name: 'EAGLE EVF',
        serial_number: 'EE-2023055',
        service_type: 'Troubleshooting',
        channel: 'Internal',
        problem_summary: 'Batch 55: Scratch on EVF chassis during assembly.',
        problem_category: 'Quality',
        status: 'Closed',
        resolution: 'Unit scraped. QA process updated.',
        department: 'Production',
        created_by: 1
    }
];

const insertSR = db.prepare(`
    INSERT OR REPLACE INTO service_records (
        record_number, service_mode, customer_name, customer_contact,
        product_name, serial_number, service_type, channel,
        problem_summary, problem_category, status, resolution,
        department, created_by, created_at, updated_at
    ) VALUES (
        @record_number, @service_mode, @customer_name, @customer_contact,
        @product_name, @serial_number, @service_type, @channel,
        @problem_summary, @problem_category, @status, @resolution,
        @department, @created_by, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
    )
`);

db.transaction(() => {
    for (const record of serviceRecords) {
        insertSR.run({
            resolution: null,
            customer_contact: null,
            serial_number: null,
            problem_category: null,
            department: null,
            channel: 'Email',
            ...record
        });
    }
})();
console.log(`✅ Inserted ${serviceRecords.length} Service Records`);


// ==========================================
// 2. Issues (5 CASES FROM PRD)
// ==========================================

const issues = [
    // Case 1: RMA for Max
    {
        issue_number: 'IS-2026-0157',
        ticket_type: 'IS', // Internal/RMA
        rma_number: 'RA010226001',
        issue_type: 'CustomerReturn',
        issue_source: 'DealerFeedback',
        issue_category: 'Hardware',
        severity: 'Medium', // 3
        title: 'Edge 8K Freezing / Mainboard Issue',
        description: 'Diagnosis: Mainboard corrosion due to humidity. Needs replacement.', // Fixed column name
        status: 'InProgress',
        reporter_name: 'Max (via ProAV)',
        product_name: 'MAVO Edge 8K',
        serial_number: 'ME8K-207890',
        created_by: 1
    },
    // Case 2: Local Repair by ProAV
    {
        issue_number: 'LR-2026-0012',
        ticket_type: 'LR',
        rma_number: null,
        issue_type: 'DealerRepair',
        issue_source: 'DealerFeedback',
        issue_category: 'Hardware',
        severity: 'Low', // 4
        title: 'SDI Port Replacement',
        description: 'Replaced SDI module locally using stock parts.',
        status: 'Closed',
        reporter_name: 'ProAV (Dealer)',
        product_name: 'MAVO mark2 6K',
        serial_number: 'MM26-2023112',
        created_by: 1
    },
    // Case 3: Production QA Issue
    {
        issue_number: 'IS-2026-0158',
        ticket_type: 'IS',
        rma_number: null,
        issue_type: 'InternalTest',
        issue_source: 'InternalTest',
        issue_category: 'Hardware',
        severity: 'Medium',
        title: 'Batch 55 Chassis Scratch',
        description: 'Cosmetic damage detected during QA.',
        status: 'Closed',
        reporter_name: 'Production Line',
        product_name: 'EAGLE EVF',
        serial_number: 'EE-2023055',
        created_by: 1
    },
    // Case 4: Firmware Escalation
    {
        issue_number: 'IS-2026-0159',
        ticket_type: 'IS',
        rma_number: 'RA010226002',
        issue_source: 'OnlineFeedback',
        issue_category: 'Software',
        severity: 'Critical',
        title: 'Boot Loop on FW 7.0Beta',
        description: 'Unit stuck in boot loop. User cannot downgrade.',
        status: 'Assigned',
        reporter_name: 'Beta Tester Z',
        product_name: 'MAVO Edge 8K',
        serial_number: 'ME8K-2023999',
        created_by: 1
    },
    // Case 5: Routine Maintenance (Clean)
    {
        issue_number: 'IS-2026-0160',
        ticket_type: 'IS',
        rma_number: 'RA020226005',
        issue_type: 'CustomerReturn',
        issue_source: 'OfflineReturn',
        issue_category: 'Hardware',
        severity: 'Low',
        title: 'Sensor Cleaning Service',
        description: 'Routine cleaning requested by rental house.',
        status: 'Pending',
        reporter_name: 'Rental House B',
        product_name: 'MAVO Edge 6K',
        serial_number: 'ME6K-2022100',
        created_by: 1
    }
];

const insertIssue = db.prepare(`
    INSERT OR REPLACE INTO issues (
        issue_number, ticket_type, rma_number, issue_type, issue_category, severity,
        title, description, status, reporter_name,
        created_by, created_at, updated_at, issue_source
    ) VALUES (
        @issue_number, @ticket_type, @rma_number, @issue_type, @issue_category, @severity,
        @title, @description, @status, @reporter_name,
        @created_by, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, @issue_source
    )
`);

db.transaction(() => {
    for (const issue of issues) {
        insertIssue.run({
            rma_number: null,
            issue_type: 'CustomerReturn',
            issue_category: null,
            severity: 'Medium',
            status: 'Pending',
            ...issue
        });
    }
})();
console.log(`✅ Inserted ${issues.length} Issues`);

console.log('Done!');
