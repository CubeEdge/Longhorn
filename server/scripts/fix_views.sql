-- Fix views for ticket indexing
DROP VIEW IF EXISTS v_rma_tickets_ready_for_index;
DROP VIEW IF EXISTS v_dealer_repairs_ready_for_index;

-- RMA Tickets View
CREATE VIEW v_rma_tickets_ready_for_index AS
SELECT 
    id,
    ticket_number,
    account_id AS customer_id,
    dealer_id,
    product_id,
    serial_number,
    problem_description,
    problem_analysis,
    repair_content,
    solution_for_customer,
    issue_category,
    status,
    completed_date,
    created_at
FROM rma_tickets
WHERE status IN ('Completed', 'Closed')
  AND completed_date IS NOT NULL;

-- Dealer Repairs View  
CREATE VIEW v_dealer_repairs_ready_for_index AS
SELECT 
    id,
    ticket_number,
    account_id AS customer_id,
    dealer_id,
    product_id,
    serial_number,
    problem_description,
    repair_content,
    issue_category,
    status,
    created_at,
    updated_at
FROM dealer_repairs
WHERE status = 'Completed';
