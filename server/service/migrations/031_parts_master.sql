-- ==========================================
-- Parts Master & Inventory Integration
-- 配件主数据与库存整合
-- ==========================================

-- 1. 配件主数据表 (Part Master)
CREATE TABLE IF NOT EXISTS parts_master (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    sku TEXT UNIQUE NOT NULL,                    -- SKU编码: S1-011-013
    name TEXT NOT NULL,                          -- 配件名称: SDI模块
    name_en TEXT,                                -- 英文名称
    category TEXT NOT NULL,                      -- 分类: 主板/接口/外壳/线缆/传感器等
    description TEXT,                            -- 详细描述
    specifications TEXT,                         -- 规格参数 (JSON)

    -- 价格体系 (多币种)
    price_cny DECIMAL(10, 2) DEFAULT 0,          -- 人民币价格
    price_usd DECIMAL(10, 2) DEFAULT 0,          -- 美元价格
    price_eur DECIMAL(10, 2) DEFAULT 0,          -- 欧元价格
    cost_cny DECIMAL(10, 2) DEFAULT 0,           -- 成本价 (内部)

    -- 状态管理
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'discontinued', 'pending')),

    -- 兼容性 (关联产品型号)
    compatible_models TEXT,                      -- JSON数组: ["MAVO Edge 8K", "MAVO Edge 6K"]

    -- 库存管理
    min_stock_level INTEGER DEFAULT 5,           -- 最低库存预警线
    reorder_point INTEGER DEFAULT 10,            -- 补货点

    -- 审计字段
    created_by INTEGER REFERENCES users(id),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_by INTEGER REFERENCES users(id),
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,

    -- 软删除
    is_deleted BOOLEAN DEFAULT 0,
    deleted_at DATETIME,
    deleted_by INTEGER REFERENCES users(id)
);

-- 2. 配件消耗记录表 (Part Consumption)
-- 记录每次维修使用的配件
CREATE TABLE IF NOT EXISTS parts_consumption (
    id INTEGER PRIMARY KEY AUTOINCREMENT,

    -- 关联信息
    ticket_id INTEGER REFERENCES tickets(id) ON DELETE SET NULL,
    ticket_number TEXT,                          -- 冗余存储，方便查询
    part_id INTEGER REFERENCES parts_master(id),
    part_sku TEXT,                               -- 冗余存储
    part_name TEXT,                              -- 冗余存储

    -- 消耗详情
    quantity INTEGER NOT NULL DEFAULT 1,         -- 使用数量
    unit_price DECIMAL(10, 2) NOT NULL,          -- 实际使用单价 (可能打折)
    currency TEXT DEFAULT 'CNY',                 -- 币种
    total_amount DECIMAL(10, 2),                 -- 总价 = quantity * unit_price

    -- 来源追踪
    source_type TEXT DEFAULT 'hq_inventory' CHECK (source_type IN ('hq_inventory', 'dealer_inventory', 'external_purchase', 'warranty_free')),
    dealer_id INTEGER REFERENCES dealers(id),    -- 如果是经销商库存
    dealer_name TEXT,                            -- 冗余存储

    -- 结算状态
    settlement_status TEXT DEFAULT 'pending' CHECK (settlement_status IN ('pending', 'included', 'waived', 'disputed')),
    settlement_id INTEGER,                       -- 关联结算单

    -- 使用人
    used_by INTEGER REFERENCES users(id),
    used_by_name TEXT,                           -- 冗余存储
    used_at DATETIME DEFAULT CURRENT_TIMESTAMP,

    -- 备注
    notes TEXT,

    -- 审计
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    created_by INTEGER REFERENCES users(id)
);

-- 3. 经销商配件结算表 (Dealer Parts Settlement)
-- 月度/季度结算单
CREATE TABLE IF NOT EXISTS dealer_parts_settlements (
    id INTEGER PRIMARY KEY AUTOINCREMENT,

    -- 结算单信息
    settlement_number TEXT UNIQUE NOT NULL,      -- 结算单号: PS-202603-001
    dealer_id INTEGER REFERENCES dealers(id) NOT NULL,
    dealer_name TEXT,                            -- 冗余存储

    -- 结算周期
    period_start DATE NOT NULL,                  -- 周期开始: 2026-03-01
    period_end DATE NOT NULL,                    -- 周期结束: 2026-03-31
    period_type TEXT DEFAULT 'monthly' CHECK (period_type IN ('monthly', 'quarterly')),

    -- 金额汇总
    total_quantity INTEGER DEFAULT 0,            -- 配件总数量
    total_amount_cny DECIMAL(10, 2) DEFAULT 0,   -- 总金额 (人民币)
    total_amount_usd DECIMAL(10, 2) DEFAULT 0,   -- 总金额 (美元)
    total_amount_eur DECIMAL(10, 2) DEFAULT 0,   -- 总金额 (欧元)

    -- 结算状态
    status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'confirmed', 'invoiced', 'paid', 'disputed')),

    -- 确认信息
    confirmed_by INTEGER REFERENCES users(id),
    confirmed_at DATETIME,
    confirmed_notes TEXT,

    -- 开票信息
    invoiced_by INTEGER REFERENCES users(id),
    invoiced_at DATETIME,
    invoice_number TEXT,

    -- 付款信息
    paid_by INTEGER REFERENCES users(id),
    paid_at DATETIME,
    payment_reference TEXT,                      -- 付款凭证号

    -- 审计
    created_by INTEGER REFERENCES users(id),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_by INTEGER REFERENCES users(id),
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 4. 产品型号配件BOM关联表 (Product Model Parts BOM)
-- 定义每个产品型号的常用维修配件
CREATE TABLE IF NOT EXISTS product_model_parts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,

    product_model_id INTEGER NOT NULL,           -- 关联产品型号ID
    product_model_name TEXT,                     -- 冗余: MAVO Edge 8K

    part_id INTEGER REFERENCES parts_master(id) NOT NULL,
    part_sku TEXT,                               -- 冗余: S1-011-013
    part_name TEXT,                              -- 冗余: SDI模块

    -- BOM属性
    is_common BOOLEAN DEFAULT 1,                 -- 是否常用配件
    quantity_per_unit INTEGER DEFAULT 1,         -- 每台设备所需数量
    priority INTEGER DEFAULT 100,                -- 优先级 (越小越优先)
    notes TEXT,                                  -- 备注

    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(product_model_id, part_id)            -- 避免重复
);

-- 5. 库存交易记录表 (Inventory Transactions)
-- 记录所有库存变动
CREATE TABLE IF NOT EXISTS inventory_transactions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,

    transaction_type TEXT NOT NULL CHECK (transaction_type IN (
        'inbound',           -- 入库
        'outbound',          -- 出库
        'transfer_in',       -- 调入
        'transfer_out',      -- 调出
        'adjustment',        -- 盘点调整
        'consumption',       -- 维修消耗
        'return'             -- 退货
    )),

    -- 关联信息
    part_id INTEGER REFERENCES parts_master(id),
    dealer_id INTEGER REFERENCES dealers(id),    -- NULL表示总部库存

    -- 数量 (正数表示入库，负数表示出库)
    quantity INTEGER NOT NULL,
    before_quantity INTEGER,                     -- 变动前数量
    after_quantity INTEGER,                      -- 变动后数量

    -- 关联单据
    reference_type TEXT,                         -- restock_order, consumption, ticket
    reference_id INTEGER,
    reference_number TEXT,                       -- 单据号

    -- 操作人
    operated_by INTEGER REFERENCES users(id),
    operated_by_name TEXT,
    operated_at DATETIME DEFAULT CURRENT_TIMESTAMP,

    notes TEXT,

    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- ==========================================
-- 索引优化
-- ==========================================

CREATE INDEX IF NOT EXISTS idx_parts_master_sku ON parts_master(sku);
CREATE INDEX IF NOT EXISTS idx_parts_master_category ON parts_master(category);
CREATE INDEX IF NOT EXISTS idx_parts_master_status ON parts_master(status);

CREATE INDEX IF NOT EXISTS idx_parts_consumption_ticket ON parts_consumption(ticket_id);
CREATE INDEX IF NOT EXISTS idx_parts_consumption_part ON parts_consumption(part_id);
CREATE INDEX IF NOT EXISTS idx_parts_consumption_dealer ON parts_consumption(dealer_id);
CREATE INDEX IF NOT EXISTS idx_parts_consumption_settlement ON parts_consumption(settlement_id);
CREATE INDEX IF NOT EXISTS idx_parts_consumption_used_at ON parts_consumption(used_at);

CREATE INDEX IF NOT EXISTS idx_settlements_dealer ON dealer_parts_settlements(dealer_id);
CREATE INDEX IF NOT EXISTS idx_settlements_period ON dealer_parts_settlements(period_start, period_end);
CREATE INDEX IF NOT EXISTS idx_settlements_status ON dealer_parts_settlements(status);

CREATE INDEX IF NOT EXISTS idx_product_model_parts_model ON product_model_parts(product_model_id);
CREATE INDEX IF NOT EXISTS idx_inventory_transactions_part ON inventory_transactions(part_id);
CREATE INDEX IF NOT EXISTS idx_inventory_transactions_dealer ON inventory_transactions(dealer_id);

-- ==========================================
-- 初始数据: 从现有配件价格单导入
-- ==========================================

-- 插入MAVO Edge系列配件示例
INSERT OR IGNORE INTO parts_master (sku, name, name_en, category, price_cny, price_usd, price_eur, compatible_models) VALUES
('S1-011-013', 'SDI模块', 'SDI Module', '接口', 390, 69, 69, '["MAVO Edge 8K", "MAVO Edge 6K", "MAVO mark2"]'),
('S3-800-002-01', 'Edge主板', 'Edge Main Board', '主板', 4000, 799, 799, '["MAVO Edge 8K", "MAVO Edge 6K"]'),
('S1-010-001-01', 'MC图像处理模块', 'MC Image Processing Module', '主板', 5500, 1199, 1199, '["MAVO Edge 8K", "MAVO Edge 6K", "MAVO mark2"]'),
('S1-010-010-02', 'Edge显示模块', 'Edge Display Module', '显示', 990, 199, 199, '["MAVO Edge 8K", "MAVO Edge 6K"]'),
('S1-010-006-01', 'Edge电源模块', 'Edge Power Module', '电源', 990, 299, 299, '["MAVO Edge 8K"]'),
('S1-019-003-01', 'Edge 8K Sensor', 'Edge 8K Sensor', '传感器', 15000, 2499, 2499, '["MAVO Edge 8K"]'),
('S1-019-004-01', 'Edge 6K Sensor', 'Edge 6K Sensor', '传感器', 9500, 1599, 1599, '["MAVO Edge 6K"]');
