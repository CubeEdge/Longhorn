-- Migration 012: Auto Index Tickets for AI Search
-- Enable real-time indexing of all tickets from creation through their entire lifecycle
-- All ticket changes are automatically synced to ticket_search_index

-- ============================================
-- 1. Helper Function: Index Inquiry Ticket
-- ============================================
CREATE TRIGGER IF NOT EXISTS inquiry_tickets_ai AFTER INSERT ON inquiry_tickets BEGIN
    INSERT INTO ticket_search_index (
        ticket_type, ticket_id, ticket_number,
        title, description, resolution, tags,
        product_model, serial_number, category, status,
        dealer_id, customer_id, visibility, closed_at, updated_at
    ) VALUES (
        'inquiry', new.id, new.ticket_number,
        new.problem_summary,
        COALESCE(new.communication_log, ''),
        COALESCE(new.resolution, ''),
        '[]',
        (SELECT model_name FROM products WHERE id = new.product_id),
        new.serial_number,
        NULL,
        new.status,
        new.dealer_id,
        new.customer_id,
        CASE WHEN new.dealer_id IS NOT NULL THEN 'dealer' ELSE 'internal' END,
        new.resolved_at,
        datetime('now')
    );
END;

CREATE TRIGGER IF NOT EXISTS inquiry_tickets_au AFTER UPDATE ON inquiry_tickets BEGIN
    -- Delete old index
    DELETE FROM ticket_search_index WHERE ticket_type = 'inquiry' AND ticket_id = old.id;
    -- Insert new index
    INSERT INTO ticket_search_index (
        ticket_type, ticket_id, ticket_number,
        title, description, resolution, tags,
        product_model, serial_number, category, status,
        dealer_id, customer_id, visibility, closed_at, updated_at
    ) VALUES (
        'inquiry', new.id, new.ticket_number,
        new.problem_summary,
        COALESCE(new.communication_log, ''),
        COALESCE(new.resolution, ''),
        '[]',
        (SELECT model_name FROM products WHERE id = new.product_id),
        new.serial_number,
        NULL,
        new.status,
        new.dealer_id,
        new.customer_id,
        CASE WHEN new.dealer_id IS NOT NULL THEN 'dealer' ELSE 'internal' END,
        new.resolved_at,
        datetime('now')
    );
END;

CREATE TRIGGER IF NOT EXISTS inquiry_tickets_ad AFTER DELETE ON inquiry_tickets BEGIN
    DELETE FROM ticket_search_index WHERE ticket_type = 'inquiry' AND ticket_id = old.id;
END;

-- ============================================
-- 2. Helper Function: Index RMA Ticket
-- ============================================
CREATE TRIGGER IF NOT EXISTS rma_tickets_ai AFTER INSERT ON rma_tickets BEGIN
    INSERT INTO ticket_search_index (
        ticket_type, ticket_id, ticket_number,
        title, description, resolution, tags,
        product_model, serial_number, category, status,
        dealer_id, customer_id, visibility, closed_at, updated_at
    ) VALUES (
        'rma', new.id, new.ticket_number,
        COALESCE(substr(new.problem_description, 1, 100), 'RMA维修'),
        COALESCE(new.problem_description || '\n' || new.problem_analysis || '\n' || new.solution_for_customer, ''),
        COALESCE(new.repair_content, ''),
        '[]',
        (SELECT model_name FROM products WHERE id = new.product_id),
        new.serial_number,
        new.issue_category,
        new.status,
        new.dealer_id,
        new.customer_id,
        CASE WHEN new.dealer_id IS NOT NULL THEN 'dealer' ELSE 'internal' END,
        new.completed_date,
        datetime('now')
    );
END;

CREATE TRIGGER IF NOT EXISTS rma_tickets_au AFTER UPDATE ON rma_tickets BEGIN
    DELETE FROM ticket_search_index WHERE ticket_type = 'rma' AND ticket_id = old.id;
    INSERT INTO ticket_search_index (
        ticket_type, ticket_id, ticket_number,
        title, description, resolution, tags,
        product_model, serial_number, category, status,
        dealer_id, customer_id, visibility, closed_at, updated_at
    ) VALUES (
        'rma', new.id, new.ticket_number,
        COALESCE(substr(new.problem_description, 1, 100), 'RMA维修'),
        COALESCE(new.problem_description || '\n' || new.problem_analysis || '\n' || new.solution_for_customer, ''),
        COALESCE(new.repair_content, ''),
        '[]',
        (SELECT model_name FROM products WHERE id = new.product_id),
        new.serial_number,
        new.issue_category,
        new.status,
        new.dealer_id,
        new.customer_id,
        CASE WHEN new.dealer_id IS NOT NULL THEN 'dealer' ELSE 'internal' END,
        new.completed_date,
        datetime('now')
    );
END;

CREATE TRIGGER IF NOT EXISTS rma_tickets_ad AFTER DELETE ON rma_tickets BEGIN
    DELETE FROM ticket_search_index WHERE ticket_type = 'rma' AND ticket_id = old.id;
END;

-- ============================================
-- 3. Helper Function: Index Dealer Repair
-- ============================================
CREATE TRIGGER IF NOT EXISTS dealer_repairs_ai AFTER INSERT ON dealer_repairs BEGIN
    INSERT INTO ticket_search_index (
        ticket_type, ticket_id, ticket_number,
        title, description, resolution, tags,
        product_model, serial_number, category, status,
        dealer_id, customer_id, visibility, closed_at, updated_at
    ) VALUES (
        'dealer_repair', new.id, new.ticket_number,
        COALESCE(substr(new.problem_description, 1, 100), '经销商维修'),
        COALESCE(new.problem_description, ''),
        COALESCE(new.repair_content, ''),
        '[]',
        (SELECT model_name FROM products WHERE id = new.product_id),
        new.serial_number,
        new.issue_category,
        new.status,
        new.dealer_id,
        new.customer_id,
        'dealer',
        CASE WHEN new.status = 'Completed' THEN datetime('now') ELSE NULL END,
        datetime('now')
    );
END;

CREATE TRIGGER IF NOT EXISTS dealer_repairs_au AFTER UPDATE ON dealer_repairs BEGIN
    DELETE FROM ticket_search_index WHERE ticket_type = 'dealer_repair' AND ticket_id = old.id;
    INSERT INTO ticket_search_index (
        ticket_type, ticket_id, ticket_number,
        title, description, resolution, tags,
        product_model, serial_number, category, status,
        dealer_id, customer_id, visibility, closed_at, updated_at
    ) VALUES (
        'dealer_repair', new.id, new.ticket_number,
        COALESCE(substr(new.problem_description, 1, 100), '经销商维修'),
        COALESCE(new.problem_description, ''),
        COALESCE(new.repair_content, ''),
        '[]',
        (SELECT model_name FROM products WHERE id = new.product_id),
        new.serial_number,
        new.issue_category,
        new.status,
        new.dealer_id,
        new.customer_id,
        'dealer',
        CASE WHEN new.status = 'Completed' THEN datetime('now') ELSE NULL END,
        datetime('now')
    );
END;

CREATE TRIGGER IF NOT EXISTS dealer_repairs_ad AFTER DELETE ON dealer_repairs BEGIN
    DELETE FROM ticket_search_index WHERE ticket_type = 'dealer_repair' AND ticket_id = old.id;
END;

-- ============================================
-- 4. Index Existing Tickets (Run once)
-- ============================================
-- Note: This will be handled by the application on startup
