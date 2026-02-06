/**
 * Service Module - Entry Point
 * 
 * This module extends the existing Longhorn server with Product Service Closure features.
 * It provides modular routes for issues, dealers, production feedbacks, and statistics.
 * 
 * @version 0.3.0
 * @date 2026-02-02
 */

const path = require('path');
const fs = require('fs-extra');

/**
 * Initialize Service module
 * @param {Express} app - Express application instance
 * @param {Database} db - Better-sqlite3 database instance
 * @param {Object} options - Configuration options
 */
function initService(app, db, options = {}) {
    const {
        attachmentsDir = path.join(__dirname, '../data/issue_attachments'),
        authenticate,
        multer,
        serviceUpload
    } = options;

    // Ensure attachments directory exists
    fs.ensureDirSync(attachmentsDir);

    // Run migrations
    runMigrations(db);

    // Initialize routes
    const authRoutes = require('./routes/auth')(db, authenticate);
    const issueRoutes = require('./routes/issues')(db, authenticate, attachmentsDir, multer);
    const dealerRoutes = require('./routes/dealers')(db, authenticate);
    const statsRoutes = require('./routes/statistics')(db, authenticate);
    const systemRoutes = require('./routes/system')(db, authenticate);

    // Phase 1: Service Records and Context Query (legacy, kept for backward compatibility)
    const serviceRecordsRoutes = require('./routes/service-records')(db, authenticate);
    const contextRoutes = require('./routes/context')(db, authenticate);

    // Phase 1.5: Three-Layer Ticket Model (新三层工单模型)
    const inquiryTicketsRoutes = require('./routes/inquiry-tickets')(db, authenticate, serviceUpload);
    const rmaTicketsRoutes = require('./routes/rma-tickets')(db, authenticate, attachmentsDir, multer, serviceUpload);
    const dealerRepairsRoutes = require('./routes/dealer-repairs')(db, authenticate, serviceUpload);

    // Phase 2: Export functionality
    const exportRoutes = require('./routes/export')(db, authenticate);

    // Phase 3: Knowledge base
    const knowledgeRoutes = require('./routes/knowledge')(db, authenticate);
    const compatibilityRoutes = require('./routes/compatibility')(db, authenticate);

    // Phase 4: Repair management
    const partsRoutes = require('./routes/parts')(db, authenticate);
    const logisticsRoutes = require('./routes/logistics')(db, authenticate);

    // Phase 5: Dealer inventory and PI
    const dealerInventoryRoutes = require('./routes/dealer-inventory')(db, authenticate);
    const proformaInvoiceRoutes = require('./routes/proforma-invoice')(db, authenticate);

    // Mount routes under /api/v1 prefix (new API version)
    app.use('/api/v1/auth', authRoutes);
    app.use('/api/v1/issues', issueRoutes);  // Legacy, kept for backward compatibility
    app.use('/api/v1/dealers', dealerRoutes);
    app.use('/api/v1/stats', statsRoutes);
    app.use('/api/v1/system', systemRoutes);

    // Phase 1 routes (legacy)
    app.use('/api/v1/service-records', serviceRecordsRoutes);  // Legacy, kept for backward compatibility
    app.use('/api/v1/context', contextRoutes); // Registered Context Route

    // Phase 1.5: Three-Layer Ticket Model routes (新三层工单模型)
    app.use('/api/v1/inquiry-tickets', inquiryTicketsRoutes);
    app.use('/api/v1/rma-tickets', rmaTicketsRoutes);
    app.use('/api/v1/dealer-repairs', dealerRepairsRoutes);

    // Phase 2 routes
    app.use('/api/v1/export', exportRoutes);

    // Phase 3 routes
    app.use('/api/v1/knowledge', knowledgeRoutes);
    app.use('/api/v1/compatibility', compatibilityRoutes);

    // Phase 4 routes
    app.use('/api/v1/parts', partsRoutes);
    app.use('/api/v1/logistics', logisticsRoutes);

    // Phase 5 routes
    app.use('/api/v1/dealer-inventory', dealerInventoryRoutes);
    app.use('/api/v1/proforma-invoices', proformaInvoiceRoutes);

    // Phase 6: Bokeh AI Routes
    const AIService = require('./ai_service');
    const aiService = new AIService(db);
    const bokehRoutes = require('./routes/bokeh')(db, authenticate, aiService);
    app.use('/api/v1/bokeh', bokehRoutes);
    app.use('/api/v1/internal/tickets', bokehRoutes); // Internal ticket indexing APIs


    console.log('[Service] Module initialized with routes:');
    console.log('  - /api/v1/auth');
    console.log('  - /api/v1/issues (legacy)');
    console.log('  - /api/v1/dealers');
    console.log('  - /api/v1/stats');
    console.log('  - /api/v1/system');
    console.log('  - /api/v1/service-records (legacy)');
    console.log('  - /api/v1/context');
    console.log('  - /api/v1/inquiry-tickets (新: 咨询工单)');
    console.log('  - /api/v1/rma-tickets (新: RMA返厂单)');
    console.log('  - /api/v1/dealer-repairs (新: 经销商维修单)');
    console.log('  - /api/v1/export');
    console.log('  - /api/v1/knowledge');
    console.log('  - /api/v1/compatibility');
    console.log('  - /api/v1/parts');
    console.log('  - /api/v1/logistics');
    console.log('  - /api/v1/dealer-inventory');
    console.log('  - /api/v1/proforma-invoices');
    console.log('  - /api/v1/bokeh (Bokeh AI工单检索)');
    console.log('  - /api/v1/internal/tickets (工单索引化)');

    return {
        generateRmaNumber: (productCode, channelCode) => generateRmaNumber(db, productCode, channelCode),
        generateIssueNumber: () => generateIssueNumber(db)
    };
}

/**
 * Run database migrations
 */
function runMigrations(db) {
    const migrationsDir = path.join(__dirname, 'migrations');

    if (!fs.existsSync(migrationsDir)) {
        console.log('[Service] No migrations directory found');
        return;
    }

    // Create migrations tracking table
    db.exec(`
        CREATE TABLE IF NOT EXISTS _migrations (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT UNIQUE NOT NULL,
            applied_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `);

    const files = fs.readdirSync(migrationsDir)
        .filter(f => f.endsWith('.sql'))
        .sort();

    for (const file of files) {
        const applied = db.prepare('SELECT 1 FROM _migrations WHERE name = ?').get(file);

        if (!applied) {
            console.log(`[Service] Running migration: ${file}`);
            const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8');

            // Split by semicolons and run each statement
            const statements = sql.split(';').filter(s => s.trim());

            for (const stmt of statements) {
                try {
                    db.exec(stmt);
                } catch (err) {
                    // Ignore "column already exists" errors for ALTER TABLE
                    if (!err.message.includes('duplicate column name')) {
                        console.error(`[Service] Migration error in ${file}:`, err.message);
                    }
                }
            }

            db.prepare('INSERT INTO _migrations (name) VALUES (?)').run(file);
            console.log(`[Service] Migration applied: ${file}`);
        }
    }
}

/**
 * Generate RMA number (NEW FORMAT)
 * Format: RA{ProductCode}{ChannelCode}-{YYMM}-{HexSeq}
 * Example: RA09C-2512-001
 * 
 * @param {Database} db - Database instance
 * @param {string} productCode - 2-digit product code (e.g., '09' for MAVO Edge 2)
 * @param {string} channelCode - 1-letter channel code (C=Customer, D=Dealer)
 * @returns {string} RMA number
 */
function generateRmaNumber(db, productCode = '09', channelCode = 'C') {
    const now = new Date();
    const yearMonth = `${String(now.getFullYear() % 100).padStart(2, '0')}${String(now.getMonth() + 1).padStart(2, '0')}`;

    // Get or create sequence for this product+channel+yearMonth combination
    const seqKey = `RMA-${productCode}${channelCode}-${yearMonth}`;

    const existing = db.prepare(`
        SELECT last_sequence FROM service_sequences 
        WHERE sequence_key = ?
    `).get(seqKey);

    let seq;
    if (existing) {
        seq = existing.last_sequence + 1;
        db.prepare(`
            UPDATE service_sequences SET last_sequence = ?, updated_at = CURRENT_TIMESTAMP 
            WHERE sequence_key = ?
        `).run(seq, seqKey);
    } else {
        seq = 1;
        db.prepare(`
            INSERT INTO service_sequences (sequence_key, last_sequence, created_at, updated_at)
            VALUES (?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        `).run(seqKey, seq);
    }

    // Convert to hex if > 999, otherwise use decimal
    const seqStr = seq > 999
        ? seq.toString(16).toUpperCase().padStart(3, '0')
        : String(seq).padStart(3, '0');

    return `RA${productCode}${channelCode}-${yearMonth}-${seqStr}`;
}

/**
 * Generate Service Record Number
 * Format: SR{Type}-{YYMM}-{HexSeq}
 * Example: SRD-2512-001 (Dealer), SRC-2512-001 (Customer)
 * 
 * @param {Database} db - Database instance
 * @param {string} customerType - 'D' for Dealer, 'C' for Customer
 * @returns {string} Service record number
 */
function generateServiceRecordNumber(db, customerType = 'C') {
    const now = new Date();
    const yearMonth = `${String(now.getFullYear() % 100).padStart(2, '0')}${String(now.getMonth() + 1).padStart(2, '0')}`;

    // Get or create sequence for this type+yearMonth combination
    const seqKey = `SR${customerType}-${yearMonth}`;

    const existing = db.prepare(`
        SELECT last_sequence FROM service_sequences 
        WHERE sequence_key = ?
    `).get(seqKey);

    let seq;
    if (existing) {
        seq = existing.last_sequence + 1;
        db.prepare(`
            UPDATE service_sequences SET last_sequence = ?, updated_at = CURRENT_TIMESTAMP 
            WHERE sequence_key = ?
        `).run(seq, seqKey);
    } else {
        seq = 1;
        db.prepare(`
            INSERT INTO service_sequences (sequence_key, last_sequence, created_at, updated_at)
            VALUES (?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        `).run(seqKey, seq);
    }

    // Convert to hex if > 999, otherwise use decimal
    const seqStr = seq > 999
        ? seq.toString(16).toUpperCase().padStart(3, '0')
        : String(seq).padStart(3, '0');

    return `SR${customerType}-${yearMonth}-${seqStr}`;
}

module.exports = {
    initService,
    generateRmaNumber,
    generateServiceRecordNumber
};
