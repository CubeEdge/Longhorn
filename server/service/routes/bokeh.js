const express = require('express');

module.exports = (db, authenticate, aiService) => {
    const router = express.Router();

    // Helper to fetch custom AI prompts from DB
    const getAIPrompt = (key, defaultPrompt) => {
        try {
            const settings = db.prepare('SELECT ai_prompts FROM system_settings LIMIT 1').get();
            if (settings && settings.ai_prompts) {
                const prompts = JSON.parse(settings.ai_prompts);
                if (prompts && prompts[key] && prompts[key].trim()) {
                    return prompts[key];
                }
            }
        } catch (e) {
            console.error('[Bokeh] Failed to parse ai_prompts', e);
        }
        return defaultPrompt;
    };

    /**
     * POST /api/v1/bokeh/search-tickets
     * Search historical tickets with permission isolation
     * 
     * Permission Rules:
     * - Dealers: Only see their own customers' tickets (dealer_id filter)
     * - Internal users: See all tickets
     */
    router.post('/search-tickets', authenticate, async (req, res) => {
        try {
            const { query, filters = {}, top_k = 5 } = req.body;
            const user = req.user;

            if (!query) {
                return res.status(400).json({ error: 'Query is required' });
            }

            // Build WHERE clause based on user role
            let whereConditions = []; // Search all tickets (both open and closed)
            let params = {};

            // Permission Filter
            if (user.department === 'Dealer') {
                // Dealers only see their own tickets
                whereConditions.push('tsi.dealer_id = @dealer_id');
                params.dealer_id = user.dealer_id;
            }
            // Internal users: no filter, see all tickets

            // Optional Filters
            if (filters.product_model) {
                whereConditions.push('tsi.product_model LIKE @product_model');
                params.product_model = `%${filters.product_model}%`;
            }

            if (filters.category) {
                whereConditions.push('tsi.category = @category');
                params.category = filters.category;
            }

            if (filters.date_range?.start) {
                whereConditions.push("tsi.closed_at >= @start_date");
                params.start_date = filters.date_range.start;
            }

            if (filters.date_range?.end) {
                whereConditions.push("tsi.closed_at <= @end_date");
                params.end_date = filters.date_range.end;
            }

            const whereClause = whereConditions.length > 0 ? 'AND ' + whereConditions.join(' AND ') : '';
            const finalWhere = 'WHERE 1=1 ' + whereClause;

            // FTS5 Search Query
            // Use MATCH for full-text search on title, description, resolution, tags
            const searchQuery = `
                SELECT 
                    tsi.id,
                    tsi.ticket_number,
                    tsi.ticket_type,
                    tsi.ticket_id,
                    tsi.title,
                    tsi.description,
                    tsi.resolution,
                    tsi.product_model,
                    tsi.serial_number,
                    tsi.category,
                    tsi.status,
                    tsi.closed_at,
                    tsi.account_id,
                    tsi.dealer_id,
                    fts.rank
                FROM ticket_search_index tsi
                INNER JOIN ticket_search_fts fts ON tsi.id = fts.rowid
                ${finalWhere} AND fts MATCH @query
                ORDER BY fts.rank
                LIMIT @limit
            `;

            // 短查询（<3字符）用 LIKE fallback — trigram tokenizer 要求 ≥3 字符
            let results;
            if (query.trim().length < 3) {
                const likeQuery = `
                    SELECT 
                        tsi.id,
                        tsi.ticket_number,
                        tsi.ticket_type,
                        tsi.ticket_id,
                        tsi.title,
                        tsi.description,
                        tsi.resolution,
                        tsi.product_model,
                        tsi.serial_number,
                        tsi.category,
                        tsi.status,
                        tsi.closed_at,
                        tsi.account_id,
                        tsi.dealer_id
                    FROM ticket_search_index tsi
                    ${finalWhere} AND (tsi.title LIKE @likeQuery OR tsi.description LIKE @likeQuery OR tsi.resolution LIKE @likeQuery OR tsi.tags LIKE @likeQuery)
                    ORDER BY tsi.updated_at DESC
                    LIMIT @limit
                `;
                params.likeQuery = `%${query.trim()}%`;
                params.limit = top_k;
                results = db.prepare(likeQuery).all(params);
            } else {
                // FTS5 Search Query — use subquery pattern (FTS5 virtual tables don't support JOIN alias)
                const searchQuery = `
                    SELECT 
                        tsi.id,
                        tsi.ticket_number,
                        tsi.ticket_type,
                        tsi.ticket_id,
                        tsi.title,
                        tsi.description,
                        tsi.resolution,
                        tsi.product_model,
                        tsi.serial_number,
                        tsi.category,
                        tsi.status,
                        tsi.closed_at,
                        tsi.account_id,
                        tsi.dealer_id,
                        fts_match.rank AS rank
                    FROM ticket_search_index tsi
                    INNER JOIN (
                        SELECT rowid, rank FROM ticket_search_fts WHERE ticket_search_fts MATCH @query
                    ) fts_match ON tsi.id = fts_match.rowid
                    ${finalWhere}
                    ORDER BY fts_match.rank
                    LIMIT @limit
                `;

                // Sanitize query for FTS5 — split by space, expand with synonyms, use OR for lenient matching
                const { expandWithSynonyms } = require('./synonyms');
                const words = query.trim().split(/\s+/).filter(w => w.length > 0);
                const allTerms = new Set();
                words.forEach(w => {
                    expandWithSynonyms(w).forEach(syn => allTerms.add(syn));
                });
                const safeQuery = Array.from(allTerms).map(w => '"' + w.replace(/"/g, '""') + '"*').join(' OR ');
                params.query = safeQuery;
                params.limit = top_k;
                console.log(`[Bokeh] Ticket FTS5 query: ${safeQuery} (from: "${query}")`);
                results = db.prepare(searchQuery).all(params);
            }

            // Generate AI Summary if results found
            let aiSummary = '';
            if (results.length > 0 && aiService) {
                const context = results.map((r, i) =>
                    `${i + 1}. [${r.ticket_number}] ${r.title} → ${r.resolution || '未解决'}`
                ).join('\n');

                const defaultSummaryPrompt = `Based on the following historical tickets, provide a brief helpful answer to: "{{query}}"\n\nTickets:\n{{context}}\n\nAnswer in Chinese, be concise and cite ticket numbers.`;
                const summaryPrompt = getAIPrompt('ticket_summary', defaultSummaryPrompt)
                    .replace(/{{query}}/g, query)
                    .replace(/{{context}}/g, context);

                try {
                    aiSummary = await aiService.generate('chat',
                        'You are Bokeh, Kinefinity service assistant. Provide helpful summaries.',
                        summaryPrompt
                    );
                } catch (err) {
                    console.warn('[Bokeh Search] AI summary failed:', err.message);
                    aiSummary = '根据历史工单,已找到相关案例,请查看下方结果。';
                }
            }

            // Enrich results with account names and contact names
            const enrichedResults = results.map(r => {
                let customer_name = null;
                let contact_name = null;
                if (r.account_id) {
                    const account = db.prepare('SELECT name FROM accounts WHERE id = ?').get(r.account_id);
                    customer_name = account?.name;
                }
                // 获取联系人姓名
                try {
                    if (r.ticket_id) {
                        const contactIdQuery = db.prepare('SELECT contact_id FROM tickets WHERE id = ?').get(r.ticket_id);
                        if (contactIdQuery && contactIdQuery.contact_id) {
                            const contact = db.prepare('SELECT name FROM contacts WHERE id = ?').get(contactIdQuery.contact_id);
                            contact_name = contact?.name || null;
                        }
                    }
                } catch (enrichErr) {
                    console.warn(`[Bokeh Enrichment] Failed to fetch contact for ${r.ticket_type}:${r.ticket_id}`, enrichErr.message);
                }

                // If it's a dealer repair and we have a dealer_id, ensure customer_name is the Dealer name
                if (r.ticket_type === 'dealer_repair' && r.dealer_id) {
                    const dealer = db.prepare('SELECT name FROM accounts WHERE id = ?').get(r.dealer_id);
                    customer_name = dealer?.name || customer_name;
                }
                return {
                    ticket_number: r.ticket_number,
                    ticket_type: r.ticket_type,
                    ticket_id: r.ticket_id,
                    title: r.title,
                    description: r.description?.substring(0, 200),
                    resolution: r.resolution,
                    product_model: r.product_model,
                    serial_number: r.serial_number,
                    customer_name: customer_name,
                    contact_name: contact_name,
                    category: r.category,
                    status: r.status,
                    closed_at: r.closed_at,
                    relevance_score: r.rank
                };
            });

            res.json({
                success: true,
                results: enrichedResults,
                ai_summary: aiSummary,
                sources: enrichedResults.map(r => r.ticket_number),
                total: enrichedResults.length
            });

        } catch (err) {
            console.error('[Bokeh Search Tickets] Error:', err);
            res.status(500).json({ error: err.message });
        }
    });

    /**
     * POST /api/v1/internal/tickets/index
     * Index a closed ticket for search (Internal use only)
     * Called automatically when ticket is closed
     */
    router.post('/index', authenticate, async (req, res) => {
        try {
            const { ticket_type, ticket_id } = req.body;

            if (!ticket_type || !ticket_id) {
                return res.status(400).json({ error: 'ticket_type and ticket_id required' });
            }

            // Fetch ticket data based on type
            let ticketData;
            let view_name;

            // Support 'unified' type for new tickets table
            if (ticket_type === 'unified') {
                ticketData = db.prepare('SELECT * FROM tickets WHERE id = ?').get(ticket_id);
                if (!ticketData) {
                    return res.status(404).json({ error: 'Ticket not found' });
                }
                // Index directly from tickets table
                const result = indexUnifiedTicket(db, ticketData);
                return res.json(result);
            }

            switch (ticket_type) {
                case 'inquiry':
                    view_name = 'v_inquiry_tickets_ready_for_index';
                    break;
                case 'rma':
                    view_name = 'v_rma_tickets_ready_for_index';
                    break;
                case 'dealer_repair':
                    view_name = 'v_dealer_repairs_ready_for_index';
                    break;
                default:
                    return res.status(400).json({ error: 'Invalid ticket_type' });
            }

            ticketData = db.prepare(`SELECT * FROM ${view_name} WHERE id = ?`).get(ticket_id);

            if (!ticketData) {
                return res.status(404).json({ error: 'Ticket not found or not ready for indexing' });
            }

            // Delete if already indexed to allow real-time updates
            db.prepare(
                'DELETE FROM ticket_search_index WHERE ticket_type = ? AND ticket_id = ?'
            ).run(ticket_type, ticket_id);

            // Build content digest based on ticket type
            let title, description, resolution, tags, product_model, serial_number, category, closed_at;

            if (ticket_type === 'inquiry') {
                title = ticketData.problem_summary;
                description = [ticketData.communication_log].filter(Boolean).join('\n');
                resolution = ticketData.resolution;
                tags = JSON.stringify([]); // TODO: Extract tags
                product_model = ticketData.product_id ?
                    db.prepare('SELECT model_name FROM products WHERE id = ?').get(ticketData.product_id)?.model_name : null;
                serial_number = ticketData.serial_number;
                category = null; // Inquiry tickets don't have category
                closed_at = ticketData.resolved_at;
            } else if (ticket_type === 'rma') {
                title = ticketData.problem_description?.substring(0, 100) || 'RMA维修';
                description = [
                    ticketData.problem_description,
                    ticketData.problem_analysis,
                    ticketData.solution_for_customer
                ].filter(Boolean).join('\n');
                resolution = ticketData.repair_content;
                tags = JSON.stringify([]);
                product_model = ticketData.product_id ?
                    db.prepare('SELECT model_name FROM products WHERE id = ?').get(ticketData.product_id)?.model_name : null;
                serial_number = ticketData.serial_number;
                category = ticketData.issue_category;
                closed_at = ticketData.completed_date;
            } else { // dealer_repair
                title = ticketData.problem_description?.substring(0, 100) || '经销商维修';
                description = ticketData.problem_description;
                resolution = ticketData.repair_content;
                tags = JSON.stringify([]);
                product_model = ticketData.product_id ?
                    db.prepare('SELECT model_name FROM products WHERE id = ?').get(ticketData.product_id)?.model_name : null;
                serial_number = ticketData.serial_number;
                category = ticketData.issue_category;
                closed_at = ticketData.updated_at;
            }

            // Determine visibility
            let visibility = 'internal';
            if (ticketData.dealer_id) {
                visibility = 'dealer';
            }

            // Insert into search index
            db.prepare(`
                INSERT INTO ticket_search_index (
                    ticket_type, ticket_id, ticket_number,
                    title, description, resolution, tags,
                    product_model, serial_number, category, status,
                    dealer_id, account_id, visibility, closed_at
                ) VALUES (
                    @ticket_type, @ticket_id, @ticket_number,
                    @title, @description, @resolution, @tags,
                    @product_model, @serial_number, @category, @status,
                    @dealer_id, @account_id, @visibility, @closed_at
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
                account_id: ticketData.account_id || null,
                visibility,
                closed_at
            });

            res.json({
                success: true,
                message: 'Ticket indexed successfully',
                indexed: true,
                ticket_number: ticketData.ticket_number
            });

        } catch (err) {
            console.error('[Ticket Index] Error:', err);
            res.status(500).json({ error: err.message });
        }
    });

    /**
     * POST /api/v1/internal/tickets/batch-index
     * Batch index all closed tickets (Admin only)
     */
    router.post('/batch-index', authenticate, async (req, res) => {
        try {
            // Admin only
            if (req.user.role !== 'Admin') {
                return res.status(403).json({ error: 'Admin access required' });
            }

            let indexed = { inquiry: 0, rma: 0, dealer_repair: 0, unified: 0 };

            // 1. Index from legacy views (旧数据)
            try {
                const inquiryTickets = db.prepare('SELECT id FROM v_inquiry_tickets_ready_for_index').all();
                for (const t of inquiryTickets) {
                    try {
                        await indexTicket(db, 'inquiry', t.id);
                        indexed.inquiry++;
                    } catch (err) {
                        console.error(`Failed to index inquiry ticket ${t.id}:`, err.message);
                    }
                }
            } catch (_e) { console.warn('[Batch] v_inquiry view not available, skipping'); }

            try {
                const rmaTickets = db.prepare('SELECT id FROM v_rma_tickets_ready_for_index').all();
                for (const t of rmaTickets) {
                    try {
                        await indexTicket(db, 'rma', t.id);
                        indexed.rma++;
                    } catch (err) {
                        console.error(`Failed to index RMA ticket ${t.id}:`, err.message);
                    }
                }
            } catch (_e) { console.warn('[Batch] v_rma view not available, skipping'); }

            try {
                const dealerRepairs = db.prepare('SELECT id FROM v_dealer_repairs_ready_for_index').all();
                for (const t of dealerRepairs) {
                    try {
                        await indexTicket(db, 'dealer_repair', t.id);
                        indexed.dealer_repair++;
                    } catch (err) {
                        console.error(`Failed to index dealer repair ${t.id}:`, err.message);
                    }
                }
            } catch (_e) { console.warn('[Batch] v_dealer view not available, skipping'); }

            // 2. Index from new unified tickets table (新数据)
            try {
                const unifiedTickets = db.prepare("SELECT * FROM tickets WHERE status IN ('resolved','closed')").all();
                for (const t of unifiedTickets) {
                    try {
                        indexUnifiedTicket(db, t);
                        indexed.unified++;
                    } catch (err) {
                        console.error(`Failed to index unified ticket ${t.id}:`, err.message);
                    }
                }
            } catch (_e) { console.warn('[Batch] tickets table not available, skipping'); }

            res.json({
                success: true,
                message: 'Batch indexing completed',
                indexed
            });

        } catch (err) {
            console.error('[Batch Index] Error:', err);
            res.status(500).json({ error: err.message });
        }
    });

    return router;
};

// Helper function to index a single ticket (reusable logic)
function indexTicket(db, ticket_type, ticket_id) {
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

    // Delete any existing entry to allow updates
    db.prepare(
        'DELETE FROM ticket_search_index WHERE ticket_type = ? AND ticket_id = ?'
    ).run(ticket_type, ticket_id);

    db.prepare(`
        INSERT INTO ticket_search_index (
            ticket_type, ticket_id, ticket_number,
            title, description, resolution, tags,
            product_model, serial_number, category, status,
            dealer_id, account_id, visibility, closed_at
        ) VALUES (
            @ticket_type, @ticket_id, @ticket_number,
            @title, @description, @resolution, @tags,
            @product_model, @serial_number, @category, @status,
            @dealer_id, @account_id, @visibility, @closed_at
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
        account_id: ticketData.account_id || null,
        visibility,
        closed_at
    });
}

/**
 * Index a ticket from the new unified `tickets` table.
 * Maps fields to the same ticket_search_index schema.
 */
function indexUnifiedTicket(db, ticketData) {
    const ticket_type = ticketData.ticket_type || 'inquiry';
    const ticket_id = ticketData.id;

    // Delete any existing entry
    db.prepare(
        'DELETE FROM ticket_search_index WHERE ticket_type = ? AND ticket_id = ?'
    ).run(ticket_type, ticket_id);

    // Build index fields
    const title = ticketData.problem_summary || ticketData.problem_description?.substring(0, 100) || '工单';
    const description = [
        ticketData.problem_description,
        ticketData.problem_analysis,
        ticketData.communication_log,
        ticketData.solution_for_customer
    ].filter(Boolean).join('\n');
    const resolution = ticketData.resolution || ticketData.repair_content || '';
    const tags = JSON.stringify([]);
    const product_model = ticketData.product_id ?
        (db.prepare('SELECT model_name FROM products WHERE id = ?').get(ticketData.product_id)?.model_name || null) : null;
    const serial_number = ticketData.serial_number || null;
    const category = ticketData.issue_category || null;
    const closed_at = ticketData.completed_date || ticketData.updated_at;
    const visibility = ticketData.dealer_id ? 'dealer' : 'internal';

    db.prepare(`
        INSERT INTO ticket_search_index (
            ticket_type, ticket_id, ticket_number,
            title, description, resolution, tags,
            product_model, serial_number, category, status,
            dealer_id, account_id, visibility, closed_at
        ) VALUES (
            @ticket_type, @ticket_id, @ticket_number,
            @title, @description, @resolution, @tags,
            @product_model, @serial_number, @category, @status,
            @dealer_id, @account_id, @visibility, @closed_at
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
        account_id: ticketData.account_id || null,
        visibility,
        closed_at
    });

    return {
        success: true,
        message: 'Unified ticket indexed successfully',
        indexed: true,
        ticket_number: ticketData.ticket_number
    };
}
