/**
 * Export Routes
 * Excel/CSV export for issues and service records
 * Phase 2: Advanced query and export
 */

const express = require('express');

module.exports = function(db, authenticate) {
    const router = express.Router();

    /**
     * POST /api/v1/export/issues
     * Export issues to Excel/CSV
     */
    router.post('/issues', authenticate, async (req, res) => {
        try {
            const {
                format = 'xlsx',
                // Filter parameters
                status,
                issue_type,
                ticket_type,
                issue_category,
                severity,
                region,
                dealer_id,
                assigned_to,
                is_warranty,
                created_from,
                created_to,
                keyword,
                // Export options
                columns = 'all', // all or array of column names
                include_comments = false,
                max_records = 1000
            } = req.body;

            const user = req.user;
            let conditions = [];
            let params = [];

            // Role-based filtering (same as list)
            if (user.user_type === 'Dealer') {
                conditions.push('i.dealer_id = ?');
                params.push(user.dealer_id);
            } else if (user.user_type === 'Customer') {
                conditions.push('(i.customer_id = ? OR i.created_by = ?)');
                params.push(user.id, user.id);
            } else if (user.role === 'Member') {
                conditions.push('(i.assigned_to = ? OR i.created_by = ?)');
                params.push(user.id, user.id);
            }

            // Apply filters
            if (status) {
                const statuses = status.split(',');
                conditions.push(`i.status IN (${statuses.map(() => '?').join(',')})`);
                params.push(...statuses);
            }
            if (issue_type) {
                conditions.push('i.issue_type = ?');
                params.push(issue_type);
            }
            if (ticket_type) {
                conditions.push('i.ticket_type = ?');
                params.push(ticket_type);
            }
            if (issue_category) {
                conditions.push('i.issue_category = ?');
                params.push(issue_category);
            }
            if (severity) {
                conditions.push('i.severity = ?');
                params.push(severity);
            }
            if (region) {
                conditions.push('i.region = ?');
                params.push(region);
            }
            if (dealer_id) {
                conditions.push('i.dealer_id = ?');
                params.push(dealer_id);
            }
            if (assigned_to === 'me') {
                conditions.push('i.assigned_to = ?');
                params.push(user.id);
            } else if (assigned_to) {
                conditions.push('i.assigned_to = ?');
                params.push(parseInt(assigned_to));
            }
            if (is_warranty !== undefined) {
                conditions.push('i.is_warranty = ?');
                params.push(is_warranty === 'true' || is_warranty === '1' ? 1 : 0);
            }
            if (created_from) {
                conditions.push('date(i.created_at) >= ?');
                params.push(created_from);
            }
            if (created_to) {
                conditions.push('date(i.created_at) <= ?');
                params.push(created_to);
            }
            if (keyword) {
                conditions.push(`(
                    i.issue_number LIKE ? OR 
                    i.rma_number LIKE ? OR 
                    i.title LIKE ? OR 
                    i.problem_description LIKE ? OR
                    i.serial_number LIKE ?
                )`);
                const term = `%${keyword}%`;
                params.push(term, term, term, term, term);
            }

            const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

            // Get issues for export
            const sql = `
                SELECT 
                    i.id, i.issue_number, i.rma_number, i.ticket_type,
                    i.issue_type, i.issue_category, i.issue_subcategory,
                    i.severity, i.status, i.service_priority, i.repair_priority,
                    i.title, i.problem_description, i.solution_for_customer,
                    i.repair_content, i.problem_analysis,
                    i.serial_number, i.firmware_version, i.hardware_version,
                    i.reporter_name, i.reporter_type, i.region,
                    i.is_warranty,
                    i.payment_channel, i.payment_amount, i.payment_date,
                    i.feedback_date, i.ship_date, i.received_date, i.completed_date,
                    i.created_at, i.updated_at,
                    p.model_name as product_name,
                    c.customer_name, c.phone as customer_phone, c.email as customer_email,
                    d.name as dealer_name, d.code as dealer_code,
                    creator.username as created_by_name,
                    assignee.username as assigned_to_name
                FROM issues i
                LEFT JOIN products p ON i.product_id = p.id
                LEFT JOIN customers c ON i.customer_id = c.id
                LEFT JOIN dealers d ON i.dealer_id = d.id
                LEFT JOIN users creator ON i.created_by = creator.id
                LEFT JOIN users assignee ON i.assigned_to = assignee.id
                ${whereClause}
                ORDER BY i.created_at DESC
                LIMIT ?
            `;

            const issues = db.prepare(sql).all(...params, parseInt(max_records));

            // Format data for export
            const exportData = issues.map(issue => ({
                '工单号': issue.issue_number,
                'RMA号': issue.rma_number || '',
                '工单类型': issue.ticket_type === 'LR' ? '本地工单' : '返修工单',
                '问题类型': issue.issue_type,
                '问题分类': issue.issue_category,
                '严重程度': `${issue.severity}级`,
                '状态': getStatusLabel(issue.status),
                '标题': issue.title,
                '问题描述': issue.problem_description,
                '解决方案': issue.solution_for_customer || '',
                '产品型号': issue.product_name || '',
                '序列号': issue.serial_number || '',
                '固件版本': issue.firmware_version || '',
                '客户名称': issue.customer_name || issue.reporter_name || '',
                '客户电话': issue.customer_phone || '',
                '客户邮箱': issue.customer_email || '',
                '区域': issue.region,
                '经销商': issue.dealer_name || '',
                '保修状态': issue.is_warranty ? '保修' : '非保修',
                '处理人': issue.assigned_to_name || '',
                '创建人': issue.created_by_name,
                '创建时间': formatDateTime(issue.created_at),
                '更新时间': formatDateTime(issue.updated_at),
                '反馈日期': issue.feedback_date || '',
                '发货日期': issue.ship_date || '',
                '收货日期': issue.received_date || '',
                '完成日期': issue.completed_date || ''
            }));

            // Record export history
            const fileName = `issues_export_${new Date().toISOString().slice(0, 10)}.${format}`;
            db.prepare(`
                INSERT INTO export_history (export_type, filter_config, record_count, file_name, exported_by)
                VALUES (?, ?, ?, ?, ?)
            `).run('issues', JSON.stringify(req.body), issues.length, fileName, user.id);

            // Return data (client will generate file)
            res.json({
                success: true,
                data: {
                    records: exportData,
                    meta: {
                        total: issues.length,
                        format,
                        file_name: fileName,
                        exported_at: new Date().toISOString()
                    }
                }
            });
        } catch (err) {
            console.error('[Export] Issues export error:', err);
            res.status(500).json({
                success: false,
                error: { code: 'SERVER_ERROR', message: err.message }
            });
        }
    });

    /**
     * POST /api/v1/export/service-records
     * Export service records to Excel/CSV
     */
    router.post('/service-records', authenticate, async (req, res) => {
        try {
            const {
                format = 'xlsx',
                status,
                service_type,
                channel,
                dealer_id,
                handler_id,
                created_from,
                created_to,
                keyword,
                max_records = 1000
            } = req.body;

            const user = req.user;
            let conditions = [];
            let params = [];

            // Role-based filtering
            if (user.user_type === 'Dealer') {
                conditions.push('sr.dealer_id = ?');
                params.push(user.dealer_id);
            } else if (user.user_type === 'Customer') {
                conditions.push('sr.customer_id = ?');
                params.push(user.id);
            } else if (user.role === 'Member') {
                conditions.push('(sr.handler_id = ? OR sr.created_by = ?)');
                params.push(user.id, user.id);
            }

            // Apply filters
            if (status) {
                const statuses = status.split(',');
                conditions.push(`sr.status IN (${statuses.map(() => '?').join(',')})`);
                params.push(...statuses);
            }
            if (service_type) {
                conditions.push('sr.service_type = ?');
                params.push(service_type);
            }
            if (channel) {
                conditions.push('sr.channel = ?');
                params.push(channel);
            }
            if (dealer_id) {
                conditions.push('sr.dealer_id = ?');
                params.push(dealer_id);
            }
            if (handler_id === 'me') {
                conditions.push('sr.handler_id = ?');
                params.push(user.id);
            } else if (handler_id) {
                conditions.push('sr.handler_id = ?');
                params.push(parseInt(handler_id));
            }
            if (created_from) {
                conditions.push('date(sr.created_at) >= ?');
                params.push(created_from);
            }
            if (created_to) {
                conditions.push('date(sr.created_at) <= ?');
                params.push(created_to);
            }
            if (keyword) {
                conditions.push(`(
                    sr.record_number LIKE ? OR 
                    sr.customer_name LIKE ? OR 
                    sr.problem_summary LIKE ? OR
                    sr.serial_number LIKE ?
                )`);
                const term = `%${keyword}%`;
                params.push(term, term, term, term);
            }

            const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

            const sql = `
                SELECT 
                    sr.*,
                    d.name as dealer_name,
                    h.username as handler_name,
                    c.username as created_by_name
                FROM service_records sr
                LEFT JOIN dealers d ON sr.dealer_id = d.id
                LEFT JOIN users h ON sr.handler_id = h.id
                LEFT JOIN users c ON sr.created_by = c.id
                ${whereClause}
                ORDER BY sr.created_at DESC
                LIMIT ?
            `;

            const records = db.prepare(sql).all(...params, parseInt(max_records));

            const exportData = records.map(sr => ({
                '记录号': sr.record_number,
                '服务模式': sr.service_mode === 'CustomerService' ? '代客户服务' : '快速查询',
                '服务类型': getServiceTypeLabel(sr.service_type),
                '服务渠道': sr.channel,
                '状态': getServiceRecordStatusLabel(sr.status),
                '客户名称': sr.customer_name || '',
                '联系方式': sr.customer_contact || '',
                '产品型号': sr.product_name || '',
                '序列号': sr.serial_number || '',
                '固件版本': sr.firmware_version || '',
                '问题描述': sr.problem_summary,
                '解决方案': sr.resolution || '',
                '经销商': sr.dealer_name || '',
                '处理人': sr.handler_name || '',
                '创建人': sr.created_by_name,
                '创建时间': formatDateTime(sr.created_at),
                '首次响应': sr.first_response_at ? formatDateTime(sr.first_response_at) : '',
                '解决时间': sr.resolved_at ? formatDateTime(sr.resolved_at) : ''
            }));

            const fileName = `service_records_export_${new Date().toISOString().slice(0, 10)}.${format}`;
            db.prepare(`
                INSERT INTO export_history (export_type, filter_config, record_count, file_name, exported_by)
                VALUES (?, ?, ?, ?, ?)
            `).run('service_records', JSON.stringify(req.body), records.length, fileName, user.id);

            res.json({
                success: true,
                data: {
                    records: exportData,
                    meta: {
                        total: records.length,
                        format,
                        file_name: fileName,
                        exported_at: new Date().toISOString()
                    }
                }
            });
        } catch (err) {
            console.error('[Export] Service records export error:', err);
            res.status(500).json({
                success: false,
                error: { code: 'SERVER_ERROR', message: err.message }
            });
        }
    });

    /**
     * GET /api/v1/export/history
     * Get export history for current user
     */
    router.get('/history', authenticate, (req, res) => {
        try {
            const { page = 1, page_size = 20 } = req.query;
            const offset = (parseInt(page) - 1) * parseInt(page_size);

            let conditions = [];
            let params = [];

            // Non-admin users only see their own exports
            if (req.user.role !== 'Admin') {
                conditions.push('eh.exported_by = ?');
                params.push(req.user.id);
            }

            const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

            const total = db.prepare(`
                SELECT COUNT(*) as total FROM export_history eh ${whereClause}
            `).get(...params).total;

            const history = db.prepare(`
                SELECT eh.*, u.username as exported_by_name
                FROM export_history eh
                LEFT JOIN users u ON eh.exported_by = u.id
                ${whereClause}
                ORDER BY eh.exported_at DESC
                LIMIT ? OFFSET ?
            `).all(...params, parseInt(page_size), offset);

            res.json({
                success: true,
                data: history.map(h => ({
                    id: h.id,
                    export_type: h.export_type,
                    record_count: h.record_count,
                    file_name: h.file_name,
                    exported_by: h.exported_by_name,
                    exported_at: h.exported_at
                })),
                meta: {
                    page: parseInt(page),
                    page_size: parseInt(page_size),
                    total,
                    total_pages: Math.ceil(total / parseInt(page_size))
                }
            });
        } catch (err) {
            console.error('[Export] History error:', err);
            res.status(500).json({
                success: false,
                error: { code: 'SERVER_ERROR', message: err.message }
            });
        }
    });

    // Helper functions
    function getStatusLabel(status) {
        const labels = {
            Pending: '待处理',
            Assigned: '已分配',
            InProgress: '处理中',
            AwaitingVerification: '待验证',
            Closed: '已关闭',
            Rejected: '已拒绝'
        };
        return labels[status] || status;
    }

    function getServiceRecordStatusLabel(status) {
        const labels = {
            Created: '已创建',
            InProgress: '处理中',
            WaitingCustomer: '待客户反馈',
            Resolved: '已解决',
            AutoClosed: '自动关闭',
            UpgradedToTicket: '已转工单'
        };
        return labels[status] || status;
    }

    function getServiceTypeLabel(type) {
        const labels = {
            Consultation: '咨询',
            TechnicalSupport: '技术支持',
            WarrantyQuery: '保修查询',
            RepairRequest: '维修申请',
            Complaint: '投诉',
            Other: '其他'
        };
        return labels[type] || type;
    }

    function formatDateTime(dateStr) {
        if (!dateStr) return '';
        return new Date(dateStr).toLocaleString('zh-CN');
    }

    return router;
};
