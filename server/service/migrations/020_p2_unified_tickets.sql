-- Migration 020: P2 Unified Tickets System
-- 统一工单表 + 活动时间轴 + 通知系统
-- 参考: Service_DataModel.md v0.9.0

-- ============================================================
-- 1. 统一工单表 (tickets) - 单表多态设计
-- ============================================================
CREATE TABLE IF NOT EXISTS tickets (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ticket_number TEXT UNIQUE NOT NULL,  -- K2602-0001 / RMA-D-2602-0001 / SVC-D-2602-0001
    
    -- ===== 工单类型与状态机 (P2 核心) =====
    ticket_type TEXT NOT NULL CHECK(ticket_type IN ('inquiry', 'rma', 'svc')),
    current_node TEXT DEFAULT 'draft',  -- 状态机节点
    -- inquiry: draft -> in_progress -> waiting_customer -> resolved -> auto_closed -> converted
    -- rma: submitted -> ms_review -> op_receiving -> op_diagnosing -> op_repairing -> op_qa -> ms_closing -> closed
    -- svc: submitted -> ge_review -> dl_receiving -> dl_repairing -> dl_qa -> ge_closing -> closed
    
    status TEXT DEFAULT 'open' CHECK(status IN ('open', 'in_progress', 'waiting', 'resolved', 'closed', 'cancelled')),
    status_changed_at TEXT,
    
    -- ===== SLA 引擎字段 (P2 新增) =====
    priority TEXT DEFAULT 'P2' CHECK(priority IN ('P0', 'P1', 'P2')),
    -- P0: 紧急 (首响2h, 方案4h, 报价24h, 完结<36h)
    -- P1: 高   (首响8h, 方案24h, 报价48h, 完结3工作日)
    -- P2: 常规 (首响24h, 方案48h, 报价5天, 完结7工作日)
    node_entered_at TEXT,       -- 进入当前节点时间
    sla_due_at TEXT,            -- 当前节点 SLA 截止时间
    sla_status TEXT DEFAULT 'normal' CHECK(sla_status IN ('normal', 'warning', 'breached')),
    breach_counter INTEGER DEFAULT 0,  -- 累计超时次数
    
    -- ===== 协作机制 (P2 新增) =====
    participants TEXT,          -- JSON: [{user_id, role, added_at, added_by}]
    snooze_until TEXT,          -- 贪睡模式截止时间
    
    -- ===== 账户与联系人 =====
    account_id INTEGER,         -- 关联账户 (工单归属)
    contact_id INTEGER,         -- 关联联系人 (具体对接人)
    dealer_id INTEGER,          -- 关联经销商账户
    reporter_name TEXT,         -- 报告人姓名 (冗余)
    reporter_type TEXT CHECK(reporter_type IN ('customer', 'dealer', 'internal')),
    region TEXT,                -- 地区
    
    -- ===== 产品信息 =====
    product_id INTEGER,         -- 关联产品
    serial_number TEXT,         -- 序列号
    firmware_version TEXT,      -- 固件版本
    hardware_version TEXT,      -- 硬件版本
    
    -- ===== 问题分类 =====
    issue_type TEXT,            -- production/shipping/customer_return/internal_sample
    issue_category TEXT,        -- 大类
    issue_subcategory TEXT,     -- 小类
    severity INTEGER DEFAULT 3, -- 等级 1/2/3
    
    -- ===== 咨询工单特有字段 =====
    service_type TEXT,          -- consultation/troubleshooting/remote_assist/complaint
    channel TEXT,               -- phone/email/wechat/enterprise_wechat
    problem_summary TEXT,       -- 问题摘要
    communication_log TEXT,     -- 沟通记录
    
    -- ===== 问题描述 (MS 填写) =====
    problem_description TEXT,   -- 问题描述
    solution_for_customer TEXT, -- 解决方案(对客户)
    is_warranty INTEGER DEFAULT 1,  -- 是否在保
    
    -- ===== 维修信息 (OP/DL 填写) =====
    repair_content TEXT,        -- 维修内容
    problem_analysis TEXT,      -- 问题分析
    resolution TEXT,            -- 处理结果
    
    -- ===== 内部负责人 =====
    submitted_by INTEGER,       -- 提交人
    assigned_to INTEGER,        -- 当前处理人
    created_by INTEGER,         -- 创建人
    
    -- ===== 收款信息 =====
    payment_channel TEXT,       -- wechat/alipay/bank_transfer/paypal
    payment_amount REAL DEFAULT 0,
    payment_date TEXT,
    
    -- ===== 时间追踪 =====
    feedback_date TEXT,
    ship_date TEXT,
    received_date TEXT,
    completed_date TEXT,
    first_response_at TEXT,
    first_response_minutes INTEGER,
    waiting_customer_since TEXT,
    
    -- ===== 自动关闭 (inquiry 特有) =====
    auto_close_reminder_sent INTEGER DEFAULT 0,
    auto_close_at TEXT,
    
    -- ===== 工单关联 =====
    parent_ticket_id INTEGER,   -- 父工单ID (升级时设置)
    reopened_from_id INTEGER,
    external_link TEXT,
    
    -- ===== 渠道代码 (RMA 特有) =====
    channel_code TEXT DEFAULT 'D',  -- D=Dealer, C=Customer
    
    -- ===== 审批信息 =====
    approval_status TEXT,       -- pending/approved/rejected
    approved_by INTEGER,
    approved_at TEXT,
    
    -- ===== 系统字段 =====
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (product_id) REFERENCES products(id),
    FOREIGN KEY (account_id) REFERENCES accounts(id),
    FOREIGN KEY (contact_id) REFERENCES contacts(id),
    FOREIGN KEY (dealer_id) REFERENCES accounts(id),
    FOREIGN KEY (submitted_by) REFERENCES users(id),
    FOREIGN KEY (assigned_to) REFERENCES users(id),
    FOREIGN KEY (created_by) REFERENCES users(id),
    FOREIGN KEY (approved_by) REFERENCES users(id),
    FOREIGN KEY (parent_ticket_id) REFERENCES tickets(id),
    FOREIGN KEY (reopened_from_id) REFERENCES tickets(id)
);

-- 统一工单表索引
CREATE INDEX IF NOT EXISTS idx_tickets_number ON tickets(ticket_number);
CREATE INDEX IF NOT EXISTS idx_tickets_type ON tickets(ticket_type);
CREATE INDEX IF NOT EXISTS idx_tickets_node ON tickets(current_node);
CREATE INDEX IF NOT EXISTS idx_tickets_status ON tickets(status);
CREATE INDEX IF NOT EXISTS idx_tickets_priority ON tickets(priority);
CREATE INDEX IF NOT EXISTS idx_tickets_sla_status ON tickets(sla_status);
CREATE INDEX IF NOT EXISTS idx_tickets_sla_due ON tickets(sla_due_at);
CREATE INDEX IF NOT EXISTS idx_tickets_account ON tickets(account_id);
CREATE INDEX IF NOT EXISTS idx_tickets_contact ON tickets(contact_id);
CREATE INDEX IF NOT EXISTS idx_tickets_dealer ON tickets(dealer_id);
CREATE INDEX IF NOT EXISTS idx_tickets_product ON tickets(product_id);
CREATE INDEX IF NOT EXISTS idx_tickets_serial ON tickets(serial_number);
CREATE INDEX IF NOT EXISTS idx_tickets_assigned ON tickets(assigned_to);
CREATE INDEX IF NOT EXISTS idx_tickets_submitted ON tickets(submitted_by);
CREATE INDEX IF NOT EXISTS idx_tickets_created ON tickets(created_at);
CREATE INDEX IF NOT EXISTS idx_tickets_parent ON tickets(parent_ticket_id);

-- ============================================================
-- 2. 工单活动时间轴 (ticket_activities)
-- ============================================================
CREATE TABLE IF NOT EXISTS ticket_activities (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ticket_id INTEGER NOT NULL,
    
    -- 活动类型
    activity_type TEXT NOT NULL CHECK(activity_type IN (
        'status_change',      -- 状态变更
        'comment',            -- 评论/备注
        'internal_note',      -- 内部备注
        'attachment',         -- 附件上传
        'mention',            -- @提及
        'participant_added',  -- 新增参与者
        'assignment_change',  -- 指派变更
        'priority_change',    -- 优先级变更
        'sla_breach',         -- SLA 超时
        'field_update',       -- 字段更新
        'ticket_linked',      -- 工单关联
        'system_event'        -- 系统事件
    )),
    
    -- 活动内容
    content TEXT,             -- 活动内容/评论文本
    content_html TEXT,        -- HTML 格式内容
    metadata TEXT,            -- JSON: 活动元数据
    -- status_change: {from_node, to_node, from_status, to_status}
    -- mention: {mentioned_users: [{user_id, name}]}
    -- attachment: {file_id, file_name, file_type, file_size}
    -- priority_change: {from_priority, to_priority}
    -- assignment_change: {from_user_id, to_user_id}
    
    -- 可见性控制
    visibility TEXT DEFAULT 'all' CHECK(visibility IN ('all', 'internal', 'technician')),
    -- all: 所有人可见 (Commercial View)
    -- internal: 仅内部员工可见
    -- technician: Technician View (仅 OP/RD)
    
    -- 操作人
    actor_id INTEGER,         -- 操作人 ID (系统事件时为空)
    actor_name TEXT,          -- 操作人姓名 (冗余)
    actor_role TEXT,          -- 操作人角色 (MS/OP/RD/GE/DL)
    
    -- 系统字段
    is_edited INTEGER DEFAULT 0,
    edited_at TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (ticket_id) REFERENCES tickets(id) ON DELETE CASCADE,
    FOREIGN KEY (actor_id) REFERENCES users(id)
);

-- 活动时间轴索引
CREATE INDEX IF NOT EXISTS idx_activities_ticket ON ticket_activities(ticket_id);
CREATE INDEX IF NOT EXISTS idx_activities_type ON ticket_activities(activity_type);
CREATE INDEX IF NOT EXISTS idx_activities_visibility ON ticket_activities(visibility);
CREATE INDEX IF NOT EXISTS idx_activities_actor ON ticket_activities(actor_id);
CREATE INDEX IF NOT EXISTS idx_activities_created ON ticket_activities(created_at);

-- ============================================================
-- 3. 系统通知 (notifications)
-- ============================================================
CREATE TABLE IF NOT EXISTS notifications (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    recipient_id INTEGER NOT NULL,
    
    -- 通知类型
    notification_type TEXT NOT NULL CHECK(notification_type IN (
        'mention',            -- @提及
        'assignment',         -- 工单指派
        'status_change',      -- 状态变更
        'sla_warning',        -- SLA 预警
        'sla_breach',         -- SLA 超时
        'new_comment',        -- 新评论
        'participant_added',  -- 被加入参与者
        'snooze_expired',     -- 贪睡到期
        'system_announce'     -- 系统公告
    )),
    
    -- 通知内容
    title TEXT NOT NULL,      -- 通知标题
    content TEXT,             -- 通知内容
    icon TEXT DEFAULT 'info', -- 图标标识 (ticket/warning/info/success)
    
    -- 关联实体
    related_type TEXT CHECK(related_type IN ('ticket', 'system')),
    related_id INTEGER,       -- 关联实体 ID
    action_url TEXT,          -- 点击跳转 URL
    
    -- 通知元数据
    metadata TEXT,            -- JSON: 额外信息
    -- mention: {ticket_number, mentioned_by, activity_id}
    -- sla_warning: {ticket_number, sla_due_at, remaining_time}
    -- assignment: {ticket_number, assigned_by}
    
    -- 状态
    is_read INTEGER DEFAULT 0,
    read_at TEXT,
    is_archived INTEGER DEFAULT 0,
    
    -- 系统字段
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (recipient_id) REFERENCES users(id) ON DELETE CASCADE
);

-- 通知索引
CREATE INDEX IF NOT EXISTS idx_notifications_recipient ON notifications(recipient_id);
CREATE INDEX IF NOT EXISTS idx_notifications_type ON notifications(notification_type);
CREATE INDEX IF NOT EXISTS idx_notifications_read ON notifications(is_read);
CREATE INDEX IF NOT EXISTS idx_notifications_related ON notifications(related_type, related_id);
CREATE INDEX IF NOT EXISTS idx_notifications_created ON notifications(created_at);

-- ============================================================
-- 4. 工单编号序列表 (统一)
-- ============================================================
CREATE TABLE IF NOT EXISTS ticket_sequences (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ticket_type TEXT NOT NULL,  -- inquiry/rma/svc
    channel_code TEXT,          -- D/C (仅 RMA 需要)
    year_month TEXT NOT NULL,   -- YYMM format: "2602"
    last_sequence INTEGER DEFAULT 0,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(ticket_type, channel_code, year_month)
);

CREATE INDEX IF NOT EXISTS idx_ticket_seq_lookup ON ticket_sequences(ticket_type, channel_code, year_month);
