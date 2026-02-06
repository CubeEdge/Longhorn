#!/usr/bin/env node
/**
 * Batch Index Historical Tickets for Bokeh AI Search
 * 
 * Usage:
 *   node scripts/index_all_tickets.js
 * 
 * This script indexes all closed tickets into the ticket_search_index table
 * to enable Bokeh AI to search and reference historical ticket content.
 */

const Database = require('better-sqlite3');
const path = require('path');

const DB_PATH = path.join(__dirname, '../longhorn.db');
const db = new Database(DB_PATH);

console.log('🚀 Starting batch ticket indexing...\n');

// Import indexing logic from bokeh route
function indexTicket(ticket_type, ticket_id) {
    let view_name;
    switch (ticket_type) {
        case 'inquiry': view_name = 'v_inquiry_tickets_ready_for_index'; break;
        case 'rma': view_name = 'v_rma_tickets_ready_for_index'; break;
        case 'dealer_repair': view_name = 'v_dealer_repairs_ready_for_index'; break;
        default: throw new Error('Invalid ticket_type');
    }

    const ticketData = db.prepare(`SELECT * FROM ${view_name} WHERE id = ?`).get(ticket_id);
    if (!ticketData) throw new Error('Ticket not found or not ready');

    let title, description, resolution, tags, product_model, serial_number, category, closed_at;

    if (ticket_type === 'inquiry') {
        title = ticketData.problem_summary;
        description = [ticketData.communication_log].filter(Boolean).join('\n');
        resolution = ticketData.resolution;
        closed_at = ticketData.resolved_at;
    } else if (ticket_type === 'rma') {
        title = ticketData.problem_description?.substring(0, 100) || 'RMA维修';
        description = [
            ticketData.problem_description,
            ticketData.problem_analysis,
            ticketData.solution_for_customer
        ].filter(Boolean).join('\n');
        resolution = ticketData.repair_content;
        category = ticketData.issue_category;
        closed_at = ticketData.completed_date;
    } else {
        title = ticketData.problem_description?.substring(0, 100) || '经销商维修';
        description = ticketData.problem_description;
        resolution = ticketData.repair_content;
        category = ticketData.issue_category;
        closed_at = ticketData.updated_at;
    }

    tags = JSON.stringify([]);
    product_model = ticketData.product_id ?
        db.prepare('SELECT model_name FROM products WHERE id = ?').get(ticketData.product_id)?.model_name : null;
    serial_number = ticketData.serial_number;

    let visibility = ticketData.dealer_id ? 'dealer' : 'internal';

    db.prepare(`
        INSERT INTO ticket_search_index (
            ticket_type, ticket_id, ticket_number,
            title, description, resolution, tags,
            product_model, serial_number, category, status,
            dealer_id, customer_id, visibility, closed_at
        ) VALUES (
            @ticket_type, @ticket_id, @ticket_number,
            @title, @description, @resolution, @tags,
            @product_model, @serial_number, @category, @status,
            @dealer_id, @customer_id, @visibility, @closed_at
        )
    `).run({
        ticket_type,
        ticket_id,
        ticket_number: ticketData.ticket_number,
        title,
        description,
        resolution,
        tags,
        product_model,
        serial_number,
        category,
        status: ticketData.status,
        dealer_id: ticketData.dealer_id || null,
        customer_id: ticketData.customer_id || null,
        visibility,
        closed_at
    });
}

try {
    let indexed = { inquiry: 0, rma: 0, dealer_repair: 0 };

    // Index inquiry tickets
    console.log('📋 Indexing inquiry tickets...');
    const inquiryTickets = db.prepare('SELECT id FROM v_inquiry_tickets_ready_for_index').all();
    for (const t of inquiryTickets) {
        try {
            const existing = db.prepare(
                'SELECT id FROM ticket_search_index WHERE ticket_type = ? AND ticket_id = ?'
            ).get('inquiry', t.id);
            if (!existing) {
                indexTicket('inquiry', t.id);
                indexed.inquiry++;
            }
        } catch (err) {
            console.error(`  ❌ Failed to index inquiry ticket ${t.id}:`, err.message);
        }
    }
    console.log(`  ✅ Indexed ${indexed.inquiry} inquiry tickets\n`);

    // Index RMA tickets
    console.log('🔧 Indexing RMA tickets...');
    const rmaTickets = db.prepare('SELECT id FROM v_rma_tickets_ready_for_index').all();
    for (const t of rmaTickets) {
        try {
            const existing = db.prepare(
                'SELECT id FROM ticket_search_index WHERE ticket_type = ? AND ticket_id = ?'
            ).get('rma', t.id);
            if (!existing) {
                indexTicket('rma', t.id);
                indexed.rma++;
            }
        } catch (err) {
            console.error(`  ❌ Failed to index RMA ticket ${t.id}:`, err.message);
        }
    }
    console.log(`  ✅ Indexed ${indexed.rma} RMA tickets\n`);

    // Index dealer repair tickets
    console.log('🛠️  Indexing dealer repair tickets...');
    const dealerRepairs = db.prepare('SELECT id FROM v_dealer_repairs_ready_for_index').all();
    for (const t of dealerRepairs) {
        try {
            const existing = db.prepare(
                'SELECT id FROM ticket_search_index WHERE ticket_type = ? AND ticket_id = ?'
            ).get('dealer_repair', t.id);
            if (!existing) {
                indexTicket('dealer_repair', t.id);
                indexed.dealer_repair++;
            }
        } catch (err) {
            console.error(`  ❌ Failed to index dealer repair ${t.id}:`, err.message);
        }
    }
    console.log(`  ✅ Indexed ${indexed.dealer_repair} dealer repair tickets\n`);

    console.log('='.repeat(50));
    console.log('✨ Batch indexing completed!');
    console.log(`📊 Total indexed: ${indexed.inquiry + indexed.rma + indexed.dealer_repair} tickets`);
    console.log(`   - Inquiry: ${indexed.inquiry}`);
    console.log(`   - RMA: ${indexed.rma}`);
    console.log(`   - Dealer Repair: ${indexed.dealer_repair}`);
    console.log('='.repeat(50));

} catch (err) {
    console.error('❌ Batch indexing failed:', err);
    process.exit(1);
} finally {
    db.close();
}
