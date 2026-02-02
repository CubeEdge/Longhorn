/**
 * Statistics Routes
 * Issue analytics and reporting
 */

const express = require('express');

module.exports = function(db, authenticate) {
    const router = express.Router();

    /**
     * GET /api/v1/stats/overview
     * Dashboard overview statistics
     */
    router.get('/overview', authenticate, (req, res) => {
        try {
            // Total issues
            const total = db.prepare('SELECT COUNT(*) as count FROM issues').get().count;

            // By status
            const byStatus = db.prepare(`
                SELECT status, COUNT(*) as count FROM issues GROUP BY status
            `).all();

            // By severity
            const bySeverity = db.prepare(`
                SELECT severity, COUNT(*) as count FROM issues GROUP BY severity ORDER BY severity
            `).all();

            // This week stats
            const thisWeek = db.prepare(`
                SELECT 
                    SUM(CASE WHEN date(created_at) >= date('now', '-7 days') THEN 1 ELSE 0 END) as new_issues,
                    SUM(CASE WHEN date(closed_at) >= date('now', '-7 days') THEN 1 ELSE 0 END) as closed_issues
                FROM issues
            `).get();

            // Last week for comparison
            const lastWeek = db.prepare(`
                SELECT 
                    SUM(CASE WHEN date(created_at) BETWEEN date('now', '-14 days') AND date('now', '-8 days') THEN 1 ELSE 0 END) as new_issues
                FROM issues
            `).get();

            // Calculate trend
            const trend = lastWeek.new_issues > 0 
                ? Math.round(((thisWeek.new_issues - lastWeek.new_issues) / lastWeek.new_issues) * 100)
                : 0;

            res.json({
                success: true,
                data: {
                    total_issues: total,
                    by_status: Object.fromEntries(byStatus.map(s => [s.status, s.count])),
                    by_severity: Object.fromEntries(bySeverity.map(s => [s.severity || '3', s.count])),
                    this_week: {
                        new: thisWeek.new_issues || 0,
                        closed: thisWeek.closed_issues || 0,
                        trend: `${trend >= 0 ? '+' : ''}${trend}%`
                    }
                }
            });
        } catch (err) {
            console.error('[Stats] Overview error:', err);
            res.status(500).json({
                success: false,
                error: { code: 'SERVER_ERROR', message: err.message }
            });
        }
    });

    /**
     * GET /api/v1/stats/trend
     * Issue trend over time
     */
    router.get('/trend', authenticate, (req, res) => {
        try {
            const { 
                period = 'week', // day, week, month
                from_date,
                to_date,
                product_id,
                issue_category,
                region
            } = req.query;

            let dateFormat, dateGroup, defaultRange;
            switch (period) {
                case 'day':
                    dateFormat = '%Y-%m-%d';
                    dateGroup = "date(created_at)";
                    defaultRange = 30;
                    break;
                case 'month':
                    dateFormat = '%Y-%m';
                    dateGroup = "strftime('%Y-%m', created_at)";
                    defaultRange = 365;
                    break;
                default: // week
                    dateFormat = '%Y-W%W';
                    dateGroup = "strftime('%Y-W%W', created_at)";
                    defaultRange = 90;
            }

            let conditions = [];
            let params = [];

            // Date range
            if (from_date) {
                conditions.push('date(created_at) >= ?');
                params.push(from_date);
            } else {
                conditions.push(`date(created_at) >= date('now', '-${defaultRange} days')`);
            }
            if (to_date) {
                conditions.push('date(created_at) <= ?');
                params.push(to_date);
            }

            // Filters
            if (product_id) {
                conditions.push('product_id = ?');
                params.push(product_id);
            }
            if (issue_category) {
                conditions.push('issue_category = ?');
                params.push(issue_category);
            }
            if (region) {
                conditions.push('region = ?');
                params.push(region);
            }

            const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

            // Get new issues trend
            const newIssues = db.prepare(`
                SELECT ${dateGroup} as period, COUNT(*) as count
                FROM issues
                ${whereClause}
                GROUP BY ${dateGroup}
                ORDER BY period
            `).all(...params);

            // Get closed issues trend
            const closedConditions = conditions.map(c => c.replace('created_at', 'closed_at'));
            const closedWhereClause = closedConditions.length > 0 
                ? `WHERE closed_at IS NOT NULL AND ${closedConditions.join(' AND ')}` 
                : 'WHERE closed_at IS NOT NULL';

            const closedIssues = db.prepare(`
                SELECT ${dateGroup.replace('created_at', 'closed_at')} as period, COUNT(*) as count
                FROM issues
                ${closedWhereClause}
                GROUP BY ${dateGroup.replace('created_at', 'closed_at')}
                ORDER BY period
            `).all(...params);

            // Merge into unified labels
            const allPeriods = new Set([
                ...newIssues.map(i => i.period),
                ...closedIssues.map(i => i.period)
            ]);
            const labels = Array.from(allPeriods).sort();

            const newMap = Object.fromEntries(newIssues.map(i => [i.period, i.count]));
            const closedMap = Object.fromEntries(closedIssues.map(i => [i.period, i.count]));

            res.json({
                success: true,
                data: {
                    labels,
                    datasets: [
                        {
                            name: '新增工单',
                            values: labels.map(l => newMap[l] || 0)
                        },
                        {
                            name: '已关闭',
                            values: labels.map(l => closedMap[l] || 0)
                        }
                    ]
                }
            });
        } catch (err) {
            console.error('[Stats] Trend error:', err);
            res.status(500).json({
                success: false,
                error: { code: 'SERVER_ERROR', message: err.message }
            });
        }
    });

    /**
     * GET /api/v1/stats/by-product
     * Issues distribution by product
     */
    router.get('/by-product', authenticate, (req, res) => {
        try {
            const { from_date, to_date } = req.query;
            
            let conditions = [];
            let params = [];

            if (from_date) {
                conditions.push('date(i.created_at) >= ?');
                params.push(from_date);
            }
            if (to_date) {
                conditions.push('date(i.created_at) <= ?');
                params.push(to_date);
            }

            const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

            const stats = db.prepare(`
                SELECT 
                    p.id, p.model_name as name, p.product_line as line,
                    COUNT(*) as total,
                    SUM(CASE WHEN i.status = 'Closed' THEN 1 ELSE 0 END) as closed,
                    SUM(CASE WHEN i.severity = 1 THEN 1 ELSE 0 END) as severity_1,
                    SUM(CASE WHEN i.severity = 2 THEN 1 ELSE 0 END) as severity_2,
                    SUM(CASE WHEN i.severity = 3 OR i.severity IS NULL THEN 1 ELSE 0 END) as severity_3
                FROM issues i
                LEFT JOIN products p ON i.product_id = p.id
                ${whereClause}
                GROUP BY p.id
                ORDER BY total DESC
            `).all(...params);

            const total = stats.reduce((sum, s) => sum + s.total, 0);

            res.json({
                success: true,
                data: stats.map(s => ({
                    product: s.id ? { id: s.id, name: s.name, line: s.line } : { name: '未关联产品' },
                    total: s.total,
                    percentage: total > 0 ? Math.round((s.total / total) * 100) : 0,
                    closed: s.closed,
                    open: s.total - s.closed,
                    by_severity: {
                        '1': s.severity_1,
                        '2': s.severity_2,
                        '3': s.severity_3
                    }
                }))
            });
        } catch (err) {
            console.error('[Stats] By-product error:', err);
            res.status(500).json({
                success: false,
                error: { code: 'SERVER_ERROR', message: err.message }
            });
        }
    });

    /**
     * GET /api/v1/stats/by-category
     * Issues distribution by category
     */
    router.get('/by-category', authenticate, (req, res) => {
        try {
            const { from_date, to_date, product_id } = req.query;
            
            let conditions = [];
            let params = [];

            if (from_date) {
                conditions.push('date(created_at) >= ?');
                params.push(from_date);
            }
            if (to_date) {
                conditions.push('date(created_at) <= ?');
                params.push(to_date);
            }
            if (product_id) {
                conditions.push('product_id = ?');
                params.push(product_id);
            }

            const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

            const stats = db.prepare(`
                SELECT 
                    issue_category as category,
                    COUNT(*) as total,
                    SUM(CASE WHEN status = 'Closed' THEN 1 ELSE 0 END) as closed
                FROM issues
                ${whereClause}
                GROUP BY issue_category
                ORDER BY total DESC
            `).all(...params);

            const total = stats.reduce((sum, s) => sum + s.total, 0);

            res.json({
                success: true,
                data: stats.map(s => ({
                    category: s.category || '未分类',
                    total: s.total,
                    percentage: total > 0 ? Math.round((s.total / total) * 100) : 0,
                    closed: s.closed,
                    open: s.total - s.closed
                }))
            });
        } catch (err) {
            console.error('[Stats] By-category error:', err);
            res.status(500).json({
                success: false,
                error: { code: 'SERVER_ERROR', message: err.message }
            });
        }
    });

    /**
     * GET /api/v1/stats/by-dealer
     * Issues distribution by dealer
     */
    router.get('/by-dealer', authenticate, (req, res) => {
        try {
            const { from_date, to_date } = req.query;
            
            let conditions = ['i.dealer_id IS NOT NULL'];
            let params = [];

            if (from_date) {
                conditions.push('date(i.created_at) >= ?');
                params.push(from_date);
            }
            if (to_date) {
                conditions.push('date(i.created_at) <= ?');
                params.push(to_date);
            }

            const whereClause = `WHERE ${conditions.join(' AND ')}`;

            const stats = db.prepare(`
                SELECT 
                    d.id, d.name, d.code, d.region,
                    COUNT(*) as total,
                    SUM(CASE WHEN i.status = 'Closed' THEN 1 ELSE 0 END) as closed,
                    SUM(CASE WHEN i.status NOT IN ('Closed', 'Rejected') THEN 1 ELSE 0 END) as open
                FROM issues i
                JOIN dealers d ON i.dealer_id = d.id
                ${whereClause}
                GROUP BY d.id
                ORDER BY total DESC
            `).all(...params);

            res.json({
                success: true,
                data: stats.map(s => ({
                    dealer: { id: s.id, name: s.name, code: s.code, region: s.region },
                    total: s.total,
                    closed: s.closed,
                    open: s.open
                }))
            });
        } catch (err) {
            console.error('[Stats] By-dealer error:', err);
            res.status(500).json({
                success: false,
                error: { code: 'SERVER_ERROR', message: err.message }
            });
        }
    });

    /**
     * GET /api/v1/stats/by-region
     * Issues distribution by region
     */
    router.get('/by-region', authenticate, (req, res) => {
        try {
            const { from_date, to_date } = req.query;
            
            let conditions = [];
            let params = [];

            if (from_date) {
                conditions.push('date(created_at) >= ?');
                params.push(from_date);
            }
            if (to_date) {
                conditions.push('date(created_at) <= ?');
                params.push(to_date);
            }

            const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

            const stats = db.prepare(`
                SELECT 
                    region,
                    COUNT(*) as total,
                    SUM(CASE WHEN status = 'Closed' THEN 1 ELSE 0 END) as closed
                FROM issues
                ${whereClause}
                GROUP BY region
                ORDER BY total DESC
            `).all(...params);

            res.json({
                success: true,
                data: stats.map(s => ({
                    region: s.region || '未知',
                    total: s.total,
                    closed: s.closed,
                    open: s.total - s.closed
                }))
            });
        } catch (err) {
            console.error('[Stats] By-region error:', err);
            res.status(500).json({
                success: false,
                error: { code: 'SERVER_ERROR', message: err.message }
            });
        }
    });

    /**
     * GET /api/v1/stats/efficiency
     * Processing efficiency statistics
     */
    router.get('/efficiency', authenticate, (req, res) => {
        try {
            // Overall averages
            const overall = db.prepare(`
                SELECT 
                    AVG(CASE WHEN assigned_at IS NOT NULL 
                        THEN (julianday(assigned_at) - julianday(created_at)) * 24 
                        ELSE NULL END) as avg_response_hours,
                    AVG(CASE WHEN closed_at IS NOT NULL 
                        THEN julianday(closed_at) - julianday(created_at) 
                        ELSE NULL END) as avg_resolve_days
                FROM issues
            `).get();

            // By assignee
            const byAssignee = db.prepare(`
                SELECT 
                    u.id, u.username as name,
                    COUNT(*) as total_assigned,
                    SUM(CASE WHEN i.status = 'Closed' THEN 1 ELSE 0 END) as closed,
                    AVG(CASE WHEN i.closed_at IS NOT NULL 
                        THEN julianday(i.closed_at) - julianday(i.created_at) 
                        ELSE NULL END) as avg_resolve_days
                FROM issues i
                JOIN users u ON i.assigned_to = u.id
                GROUP BY u.id
                ORDER BY total_assigned DESC
                LIMIT 10
            `).all();

            res.json({
                success: true,
                data: {
                    avg_response_time_hours: overall.avg_response_hours 
                        ? Math.round(overall.avg_response_hours * 10) / 10 
                        : null,
                    avg_resolve_time_days: overall.avg_resolve_days 
                        ? Math.round(overall.avg_resolve_days * 10) / 10 
                        : null,
                    by_assignee: byAssignee.map(a => ({
                        id: a.id,
                        name: a.name,
                        total_assigned: a.total_assigned,
                        closed: a.closed,
                        avg_resolve_days: a.avg_resolve_days 
                            ? Math.round(a.avg_resolve_days * 10) / 10 
                            : null
                    }))
                }
            });
        } catch (err) {
            console.error('[Stats] Efficiency error:', err);
            res.status(500).json({
                success: false,
                error: { code: 'SERVER_ERROR', message: err.message }
            });
        }
    });

    /**
     * POST /api/v1/stats/export
     * Export statistics report
     */
    router.post('/export', authenticate, (req, res) => {
        try {
            const { report_type = 'issue_list', format = 'json', filters = {} } = req.body;

            // For now, only support JSON export
            // Excel/CSV export can be added later
            if (format !== 'json') {
                return res.status(400).json({
                    success: false,
                    error: { code: 'UNSUPPORTED_FORMAT', message: '当前仅支持JSON格式导出' }
                });
            }

            let data;
            switch (report_type) {
                case 'issue_list':
                    data = exportIssueList(db, filters);
                    break;
                case 'summary':
                    data = exportSummary(db, filters);
                    break;
                default:
                    return res.status(400).json({
                        success: false,
                        error: { code: 'INVALID_REPORT_TYPE', message: '无效的报表类型' }
                    });
            }

            res.json({
                success: true,
                data: {
                    report_type,
                    generated_at: new Date().toISOString(),
                    filters,
                    content: data
                }
            });
        } catch (err) {
            console.error('[Stats] Export error:', err);
            res.status(500).json({
                success: false,
                error: { code: 'SERVER_ERROR', message: err.message }
            });
        }
    });

    // Helper functions
    function exportIssueList(db, filters) {
        let conditions = [];
        let params = [];

        if (filters.from_date) {
            conditions.push('date(created_at) >= ?');
            params.push(filters.from_date);
        }
        if (filters.to_date) {
            conditions.push('date(created_at) <= ?');
            params.push(filters.to_date);
        }
        if (filters.product_id) {
            conditions.push('product_id = ?');
            params.push(filters.product_id);
        }
        if (filters.status) {
            conditions.push('status = ?');
            params.push(filters.status);
        }

        const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

        return db.prepare(`
            SELECT 
                issue_number, rma_number, issue_type, issue_category, severity, status,
                problem_description, solution_for_customer, repair_content, problem_analysis,
                serial_number, firmware_version, reporter_name, region,
                created_at, closed_at
            FROM issues
            ${whereClause}
            ORDER BY created_at DESC
            LIMIT 1000
        `).all(...params);
    }

    function exportSummary(db, filters) {
        let conditions = [];
        let params = [];

        if (filters.from_date) {
            conditions.push('date(created_at) >= ?');
            params.push(filters.from_date);
        }
        if (filters.to_date) {
            conditions.push('date(created_at) <= ?');
            params.push(filters.to_date);
        }

        const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

        const total = db.prepare(`SELECT COUNT(*) as count FROM issues ${whereClause}`).get(...params);
        const byStatus = db.prepare(`SELECT status, COUNT(*) as count FROM issues ${whereClause} GROUP BY status`).all(...params);
        const byCategory = db.prepare(`SELECT issue_category, COUNT(*) as count FROM issues ${whereClause} GROUP BY issue_category`).all(...params);
        const bySeverity = db.prepare(`SELECT severity, COUNT(*) as count FROM issues ${whereClause} GROUP BY severity`).all(...params);

        return {
            total: total.count,
            by_status: Object.fromEntries(byStatus.map(s => [s.status, s.count])),
            by_category: Object.fromEntries(byCategory.map(c => [c.issue_category || '未分类', c.count])),
            by_severity: Object.fromEntries(bySeverity.map(s => [s.severity || '3', s.count]))
        };
    }

    return router;
};
