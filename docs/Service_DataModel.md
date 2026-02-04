# Service 数据模型设计

> **文档定位**：Kinefinity Service 系统完整数据库设计  
> **维护者**：研发部  
> **最后更新**：2026-02-03  
> **参考来源**：A02-产品返修记录.xlsx、EAGLE知识库.xlsx、Knowledge base_Edge.xlsx、固件Knowledge Base.xlsx

---

## 文档说明

本文档是 [Service_PRD.md](./Service_PRD.md) 的附属技术文档，完整定义了 service 系统的数据库结构。

### 与主PRD的关系

- **主PRD**（Service_PRD.md）：产品视角，描述业务流程、功能需求、用户体验
- **本文档**（Service_DataModel.md）：技术视角，定义数据表结构、字段类型、关系约束

### 阅读对象

- 后端开发工程师：数据库设计与API开发
- 数据库管理员：表结构维护与优化
- 前端开发工程师：了解数据结构以便API对接

### 设计原则

1. **三层工单模型**：咨询工单 → RMA返厂单 / 经销商维修单
2. **完整追溯链**：从咨询→维修→结算的完整数据关联
3. **灵活分类**：支持多维度分类与标签
4. **权限分级**：数据访问权限分为 Public/Dealer/Internal/Department
5. **AI友好**：为AI应用预留字段（向量化、建议记录等）

---

## 1. 核心实体

### 1.1 产品 (products)

```sql
products (产品)
├── id: SERIAL PRIMARY KEY
├── name: VARCHAR(255) NOT NULL -- 产品名称
├── model: VARCHAR(100) -- 型号
├── category: ENUM('camera', 'viewfinder', 'accessory', 'cable') -- 分类
├── series: VARCHAR(50) -- 系列 (Edge/MM2/Terra/Eagle)
├── current_firmware_version: VARCHAR(20) -- 当前固件版本
├── product_family: ENUM('A', 'B', 'C', 'D') -- 产品族群
│   -- A: 在售电影机, B: 历史机型, C: 电子寻像器, D: 通用配件
├── is_active: BOOLEAN DEFAULT true -- 是否在售
├── created_at: TIMESTAMP DEFAULT CURRENT_TIMESTAMP
└── updated_at: TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
```

**索引**：
- PRIMARY KEY (id)
- INDEX idx_model (model)
- INDEX idx_category (category)
- INDEX idx_series (series)

---

### 1.2 客户 (customers)

```sql
customers (客户)
├── id: SERIAL PRIMARY KEY
├── name: VARCHAR(255) NOT NULL -- 客户姓名
├── company: VARCHAR(255) -- 公司名称
├── email: VARCHAR(255) -- 邮箱
├── phone: VARCHAR(50) -- 电话
├── wechat: VARCHAR(100) -- 微信号
├── customer_type: ENUM('end_user', 'kol', 'media') -- 客户类型
├── customer_level: ENUM('vip', 'normal', 'new') DEFAULT 'normal' -- 客户等级
├── country: VARCHAR(100) -- 国家
├── province: VARCHAR(100) -- 省份/州
├── city: VARCHAR(100) -- 城市
├── address: TEXT -- 详细地址
├── dealer_id: INT -- 关联经销商 (可为空)
├── notes: TEXT -- 备注
├── created_at: TIMESTAMP DEFAULT CURRENT_TIMESTAMP
└── updated_at: TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP

FOREIGN KEY (dealer_id) REFERENCES dealers(id)
```

**索引**：
- PRIMARY KEY (id)
- INDEX idx_dealer (dealer_id)
- INDEX idx_email (email)
- INDEX idx_country_province (country, province)

---

### 1.3 经销商 (dealers)

```sql
dealers (经销商/渠道商)
├── id: SERIAL PRIMARY KEY
├── name: VARCHAR(255) NOT NULL -- 经销商名称
├── code: VARCHAR(50) UNIQUE -- 经销商代码 (如: ProAV, Gafpa)
├── dealer_type: ENUM('tier1', 'tier2', 'direct') -- 一级/二级/直营
├── region: VARCHAR(100) -- 销售大区
├── country: VARCHAR(100) -- 国家
├── province: VARCHAR(100) -- 省份/州
├── city: VARCHAR(100) -- 城市
├── contact_name: VARCHAR(255) -- 联系人
├── contact_email: VARCHAR(255) -- 联系邮箱
├── contact_phone: VARCHAR(50) -- 联系电话
├── credit_limit: DECIMAL(10,2) DEFAULT 0 -- 信用额度 (仅特殊经销商)
├── is_active: BOOLEAN DEFAULT true -- 是否启用
├── notes: TEXT -- 备注
├── created_at: TIMESTAMP DEFAULT CURRENT_TIMESTAMP
└── updated_at: TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
```

**索引**：
- PRIMARY KEY (id)
- UNIQUE KEY (code)
- INDEX idx_dealer_type (dealer_type)
- INDEX idx_country (country)

---

### 1.4 系统用户 (users)

```sql
users (系统用户 - 员工)
├── id: SERIAL PRIMARY KEY
├── name: VARCHAR(255) NOT NULL -- 姓名
├── email: VARCHAR(255) UNIQUE NOT NULL -- 邮箱
├── password_hash: VARCHAR(255) -- 密码哈希
├── department: ENUM('marketing', 'production', 'rd', 'management') -- 部门
├── role: ENUM('admin', 'editor', 'viewer') -- 角色
├── region_responsible: ENUM('domestic', 'overseas', 'all') -- 负责区域 (市场部)
├── is_active: BOOLEAN DEFAULT true -- 是否启用
├── last_login_at: TIMESTAMP -- 最后登录时间
├── created_at: TIMESTAMP DEFAULT CURRENT_TIMESTAMP
└── updated_at: TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
```

**索引**：
- PRIMARY KEY (id)
- UNIQUE KEY (email)
- INDEX idx_department (department)

---

## 2. 工单模型

### 2.1 咨询工单 (inquiry_tickets)

```sql
inquiry_tickets (咨询工单 - 系统入口)
├── id: SERIAL PRIMARY KEY
├── ticket_number: VARCHAR(20) UNIQUE NOT NULL -- 工单编号 (KYYMM-XXXX)
│
├── // 客户信息 (代客户服务模式下可选)
├── customer_name: VARCHAR(255) -- 客户姓名 (可选)
├── customer_contact: VARCHAR(255) -- 联系方式 (可选)
├── customer_id: INT -- 关联客户 (可为空)
├── dealer_id: INT -- 关联经销商 (可为空)
│
├── // 产品信息 (可选)
├── product_id: INT -- 关联产品 (可为空)
├── serial_number: VARCHAR(100) -- 序列号 (可为空)
│
├── // 服务内容
├── service_type: ENUM('consultation', 'troubleshooting', 'remote_assist', 'complaint') -- 服务类型
├── channel: ENUM('phone', 'email', 'wechat', 'enterprise_wechat') -- 沟通渠道
├── problem_summary: VARCHAR(500) -- 问题摘要
├── communication_log: TEXT -- 沟通记录
├── resolution: TEXT -- 处理结果
│
├── // 处理信息
├── handler_id: INT -- 处理人ID
├── handler_name: VARCHAR(255) -- 处理人姓名
│
├── // 状态管理
├── status: ENUM('in_progress', 'waiting_customer', 'resolved', 'auto_closed', 'converted') -- 状态
├── status_changed_at: TIMESTAMP -- 最近状态变更时间
├── waiting_customer_since: TIMESTAMP -- 进入待反馈状态的时间
│
├── // 时间追踪
├── first_response_at: TIMESTAMP -- 首次响应时间
├── first_response_minutes: INT -- 首次响应时长(分钟)
├── total_duration_minutes: INT -- 总服务时长(分钟)
├── effective_duration_minutes: INT -- 有效处理时长(分钟)
├── waiting_duration_minutes: INT -- 等待客户反馈累计时长(分钟)
│
├── // 关联
├── related_ticket_id: INT -- 升级后的工单ID
├── related_ticket_type: ENUM('rma', 'dealer_repair') -- 关联工单类型
├── reopened_from_id: INT -- 如是重新打开，原咨询工单ID
│
├── // 自动关闭提醒
├── auto_close_reminder_sent: BOOLEAN DEFAULT false -- 是否已发送关闭提醒
├── auto_close_at: TIMESTAMP -- 预计自动关闭时间
│
├── created_at: TIMESTAMP DEFAULT CURRENT_TIMESTAMP
└── updated_at: TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP

FOREIGN KEY (customer_id) REFERENCES customers(id)
FOREIGN KEY (dealer_id) REFERENCES dealers(id)
FOREIGN KEY (product_id) REFERENCES products(id)
FOREIGN KEY (handler_id) REFERENCES users(id)
```

**索引**：
- PRIMARY KEY (id)
- UNIQUE KEY (ticket_number)
- INDEX idx_customer (customer_id)
- INDEX idx_dealer (dealer_id)
- INDEX idx_handler (handler_id)
- INDEX idx_status (status)
- INDEX idx_created_at (created_at)

---

### 2.2 工单实体 (tickets)

```sql
tickets (工单/RMA返厂单/经销商维修单)
├── id: SERIAL PRIMARY KEY
├── ticket_number: VARCHAR(30) UNIQUE NOT NULL -- 工单编号
│   -- 格式：RMA-{C}-YYMM-XXXX 或 SVC-D-YYMM-XXXX
│   -- {C} = D(Dealer) 或 C(Customer)
│
├── ticket_type: ENUM('rma', 'dealer_repair') -- 工单类型
│
├── // 问题分类
├── issue_type: ENUM('production', 'shipping', 'customer_return', 'internal_sample') -- 来源类型
├── issue_category: VARCHAR(100) -- 大类 (稳定性/素材/监看/SSD/音频/兼容性/时码/硬件结构)
├── issue_subcategory: VARCHAR(100) -- 小类
├── severity: ENUM('1', '2', '3') -- 等级
│
├── // 产品信息
├── product_id: INT NOT NULL -- 关联产品
├── serial_number: VARCHAR(100) NOT NULL -- 序列号
├── firmware_version: VARCHAR(20) -- 固件版本
├── hardware_version: VARCHAR(50) -- 硬件版本/批次
│
├── // 问题描述 (市场部填写)
├── problem_description: TEXT -- 问题描述
├── solution_for_customer: TEXT -- 解决方案(对客户)
├── is_warranty: BOOLEAN -- 是否在保
│
├── // 维修信息 (生产部填写)
├── repair_content: TEXT -- 维修内容
├── problem_analysis: TEXT -- 问题分析
│
├── // 关联人员
├── reporter_name: VARCHAR(255) -- 反馈人姓名
├── reporter_type: ENUM('customer', 'dealer', 'internal') -- 反馈人类型
├── customer_id: INT -- 关联客户
├── dealer_id: INT -- 关联经销商
├── region: VARCHAR(100) -- 地区
│
├── // 内部负责人
├── submitted_by: INT -- 提交人(市场部)
├── assigned_to: INT -- 当前处理人(生产部)
├── created_by: INT -- 创建人
│
├── // 收款信息
├── payment_channel: ENUM('wechat', 'alipay', 'bank_transfer') -- 收款渠道
├── payment_amount: DECIMAL(10,2) -- 收款金额
├── payment_date: DATE -- 收款日期
│
├── // 状态与时间
├── status: ENUM('pending', 'in_progress', 'repaired', 'waiting_payment', 'closed') -- 状态
├── feedback_date: DATE -- 反馈时间
├── ship_date: DATE -- 发货日期 (原始发货)
├── received_date: DATE -- 收货日期 (返修收货)
├── completed_date: DATE -- 完成日期
│
├── // 外部链接
├── external_link: TEXT -- RMA工单链接
│
├── // 关联咨询工单
├── inquiry_ticket_id: INT -- 关联的咨询工单ID
│
├── created_at: TIMESTAMP DEFAULT CURRENT_TIMESTAMP
└── updated_at: TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP

FOREIGN KEY (product_id) REFERENCES products(id)
FOREIGN KEY (customer_id) REFERENCES customers(id)
FOREIGN KEY (dealer_id) REFERENCES dealers(id)
FOREIGN KEY (submitted_by) REFERENCES users(id)
FOREIGN KEY (assigned_to) REFERENCES users(id)
FOREIGN KEY (created_by) REFERENCES users(id)
FOREIGN KEY (inquiry_ticket_id) REFERENCES inquiry_tickets(id)
```

**索引**：
- PRIMARY KEY (id)
- UNIQUE KEY (ticket_number)
- INDEX idx_ticket_type (ticket_type)
- INDEX idx_product (product_id)
- INDEX idx_customer (customer_id)
- INDEX idx_dealer (dealer_id)
- INDEX idx_serial_number (serial_number)
- INDEX idx_status (status)
- INDEX idx_created_at (created_at)
- INDEX idx_inquiry (inquiry_ticket_id)

---

### 2.3 工单附件 (issue_attachments)

```sql
issue_attachments (工单附件)
├── id: SERIAL PRIMARY KEY
├── issue_id: INT NOT NULL -- 关联工单 (可以是 inquiry_tickets 或 tickets)
├── issue_type: ENUM('inquiry', 'ticket') -- 工单类型
├── file_name: VARCHAR(255) NOT NULL -- 文件名
├── file_path: VARCHAR(500) -- 文件路径
├── file_url: TEXT -- 文件URL
├── file_size: BIGINT -- 文件大小 (bytes)
├── file_type: ENUM('image', 'video', 'document') -- 文件类型
├── mime_type: VARCHAR(100) -- MIME类型
├── uploaded_by: INT -- 上传人
├── created_at: TIMESTAMP DEFAULT CURRENT_TIMESTAMP

FOREIGN KEY (uploaded_by) REFERENCES users(id)
```

**索引**：
- PRIMARY KEY (id)
- INDEX idx_issue (issue_id, issue_type)
- INDEX idx_uploaded_by (uploaded_by)

---

### 2.4 工单评论 (issue_comments)

```sql
issue_comments (工单评论)
├── id: SERIAL PRIMARY KEY
├── issue_id: INT NOT NULL -- 关联工单
├── issue_type: ENUM('inquiry', 'ticket') -- 工单类型
├── comment_type: ENUM('progress', 'internal_note', 'customer_communication') -- 类型
├── content: TEXT NOT NULL -- 内容
├── author_id: INT NOT NULL -- 作者ID
├── author_name: VARCHAR(255) -- 作者姓名
├── author_department: VARCHAR(100) -- 作者部门
├── is_internal: BOOLEAN DEFAULT false -- 是否仅内部可见
├── created_at: TIMESTAMP DEFAULT CURRENT_TIMESTAMP

FOREIGN KEY (author_id) REFERENCES users(id)
```

**索引**：
- PRIMARY KEY (id)
- INDEX idx_issue (issue_id, issue_type)
- INDEX idx_author (author_id)
- INDEX idx_created_at (created_at)

---

## 3. 生产问题反馈 (production_feedbacks)

```sql
production_feedbacks (生产问题反馈 - F0)
├── id: SERIAL PRIMARY KEY
├── feedback_date: DATE -- 反馈日期
├── ship_date: DATE -- 发货日期
├── category: ENUM('production', 'shipping', 'return', 'inspection') -- 分类
├── severity: ENUM('1', '2', '3') -- 等级
├── product_name: VARCHAR(255) -- 反馈产品
├── serial_number: VARCHAR(100) -- 序列号
├── problem_description: TEXT -- 反馈问题
├── communication_feedback: TEXT -- 沟通反馈
├── reporter: VARCHAR(255) -- 反馈人/客户
├── responsible_person: VARCHAR(255) -- 负责人
├── order_responsible: VARCHAR(255) -- 订单负责人
├── remarks: TEXT -- 备注
├── related_issue_id: INT -- 关联工单
├── created_at: TIMESTAMP DEFAULT CURRENT_TIMESTAMP
└── updated_at: TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP

FOREIGN KEY (related_issue_id) REFERENCES tickets(id)
```

**索引**：
- PRIMARY KEY (id)
- INDEX idx_serial_number (serial_number)
- INDEX idx_feedback_date (feedback_date)
- INDEX idx_related_issue (related_issue_id)

---

## 4. 知识库系统

### 4.1 知识库条目 (knowledge_articles)

```sql
knowledge_articles (知识库条目)
├── id: SERIAL PRIMARY KEY
├── article_number: VARCHAR(20) UNIQUE -- 知识编号 (KB-0023)
├── title: VARCHAR(500) NOT NULL -- 标题
├── knowledge_type: ENUM('faq', 'troubleshooting', 'compatibility', 'firmware', 'basics', 'case', 'manual') -- 类型
│   -- faq: FAQ常见问题
│   -- troubleshooting: 故障排查
│   -- compatibility: 兼容性列表
│   -- firmware: 固件知识
│   -- basics: 基础知识
│   -- case: 问题案例
│   -- manual: 维修手册
│
├── // FAQ特有
├── question: TEXT -- 问题 (FAQ类型)
├── external_answer: TEXT -- 外部回答
├── internal_answer: TEXT -- 内部回答
│
├── // 通用
├── content: TEXT -- 正文内容 (Markdown)
├── visibility: ENUM('public', 'dealer', 'internal', 'department') DEFAULT 'internal' -- 可见性
│
├── // 关联
├── firmware_version: VARCHAR(20) -- 相关固件版本
├── related_issues: JSON -- 关联工单ID列表
│
├── // 版本控制
├── version: INT DEFAULT 1 -- 版本号
├── status: ENUM('draft', 'published') DEFAULT 'draft' -- 状态
├── created_by: INT -- 创建人
├── updated_by: INT -- 更新人
├── published_at: TIMESTAMP -- 发布时间
├── created_at: TIMESTAMP DEFAULT CURRENT_TIMESTAMP
└── updated_at: TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP

FOREIGN KEY (created_by) REFERENCES users(id)
FOREIGN KEY (updated_by) REFERENCES users(id)
```

**索引**：
- PRIMARY KEY (id)
- UNIQUE KEY (article_number)
- INDEX idx_knowledge_type (knowledge_type)
- INDEX idx_visibility (visibility)
- INDEX idx_status (status)
- FULLTEXT INDEX ft_content (title, question, content)

---

### 4.2 知识库-产品关联 (knowledge_products)

```sql
knowledge_products (知识-产品关联)
├── id: SERIAL PRIMARY KEY
├── knowledge_id: INT NOT NULL
└── product_id: INT NOT NULL

FOREIGN KEY (knowledge_id) REFERENCES knowledge_articles(id)
FOREIGN KEY (product_id) REFERENCES products(id)
UNIQUE KEY (knowledge_id, product_id)
```

---

### 4.3 知识库标签 (knowledge_tags)

```sql
knowledge_tags (知识标签)
├── id: SERIAL PRIMARY KEY
├── knowledge_id: INT NOT NULL
└── tag: VARCHAR(100) NOT NULL -- 标签名称

FOREIGN KEY (knowledge_id) REFERENCES knowledge_articles(id)
INDEX idx_tag (tag)
```

---

### 4.4 故障排查步骤 (troubleshooting_steps)

```sql
troubleshooting_steps (故障排查步骤)
├── id: SERIAL PRIMARY KEY
├── knowledge_id: INT NOT NULL
├── step_order: INT NOT NULL -- 步骤顺序
├── action: TEXT NOT NULL -- 操作内容
├── result_if_pass: TEXT -- 通过后结果
├── result_if_fail: TEXT -- 失败后结果
└── next_step_if_fail: INT -- 失败后下一步ID

FOREIGN KEY (knowledge_id) REFERENCES knowledge_articles(id)
INDEX idx_knowledge (knowledge_id)
```

---

### 4.5 兼容性条目 (compatibility_entries)

```sql
compatibility_entries (兼容性条目)
├── id: SERIAL PRIMARY KEY
├── knowledge_id: INT NOT NULL
├── our_product: VARCHAR(255) -- 我方产品
├── external_device: VARCHAR(255) -- 外部设备型号
├── external_brand: VARCHAR(100) -- 外部品牌
├── interface_type: VARCHAR(100) -- 接口类型
├── resolution: VARCHAR(50) -- 分辨率
├── frame_rate: VARCHAR(50) -- 帧率
├── is_compatible: BOOLEAN -- 是否兼容
├── supports_rec_status: BOOLEAN -- 支持录制状态
├── supports_vu: BOOLEAN -- 支持VU表
├── supports_timecode: BOOLEAN -- 支持时码
├── notes: TEXT -- 备注
├── tested_date: DATE -- 测试日期
└── tested_by: VARCHAR(255) -- 测试人员

FOREIGN KEY (knowledge_id) REFERENCES knowledge_articles(id)
```

---

## 5. 经销商配件库存管理

### 5.1 经销商配件库存 (dealer_inventory)

```sql
dealer_inventory (经销商配件库存)
├── id: SERIAL PRIMARY KEY
├── dealer_id: INT NOT NULL
├── sku: VARCHAR(50) NOT NULL
├── sku_name: VARCHAR(255)
├── quantity: INT DEFAULT 0
├── safety_stock: INT DEFAULT 5 -- 安全库存线
├── last_replenishment_date: DATE
├── last_replenishment_quantity: INT
├── created_at: TIMESTAMP DEFAULT CURRENT_TIMESTAMP
└── updated_at: TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP

FOREIGN KEY (dealer_id) REFERENCES dealers(id)
UNIQUE KEY (dealer_id, sku)
```

---

### 5.2 库存变动记录 (dealer_inventory_transactions)

```sql
dealer_inventory_transactions (库存变动记录)
├── id: SERIAL PRIMARY KEY
├── dealer_id: INT NOT NULL
├── sku: VARCHAR(50) NOT NULL
├── transaction_type: ENUM('init', 'replenish', 'usage', 'return', 'adjust') -- 变动类型
├── quantity_change: INT NOT NULL -- 变动数量 (+/-)
├── quantity_before: INT -- 变动前数量
├── quantity_after: INT -- 变动后数量
├── related_issue_id: INT -- 关联工单
├── related_replenishment_id: INT -- 关联补货单
├── reason: TEXT -- 变动原因
├── operator_id: INT -- 操作人
└── created_at: TIMESTAMP DEFAULT CURRENT_TIMESTAMP

FOREIGN KEY (dealer_id) REFERENCES dealers(id)
FOREIGN KEY (operator_id) REFERENCES users(id)
```

---

### 5.3 补货申请 (replenishment_requests)

```sql
replenishment_requests (补货申请)
├── id: SERIAL PRIMARY KEY
├── request_number: VARCHAR(30) UNIQUE -- 补货单号 (REP-2026-001)
├── dealer_id: INT NOT NULL
├── status: ENUM('pending', 'reviewing', 'approved', 'rejected', 'shipped', 'received')
├── items: JSON -- [{sku, quantity, reason}]
├── total_items: INT
├── total_quantity: INT
├── outstanding_amount: DECIMAL(10,2) -- 申请时未结清金额
├── outstanding_age_days: INT -- 最长欠款账龄
├── debt_check_passed: BOOLEAN -- 欠款检查是否通过
├── approved_by: INT
├── approved_at: TIMESTAMP
├── approval_note: TEXT
├── is_emergency: BOOLEAN DEFAULT false
├── shipped_at: TIMESTAMP
├── tracking_number: VARCHAR(100)
├── received_at: TIMESTAMP
├── created_by: INT
├── created_at: TIMESTAMP DEFAULT CURRENT_TIMESTAMP
└── updated_at: TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP

FOREIGN KEY (dealer_id) REFERENCES dealers(id)
```

---

## 6. 维修发票与结算

### 6.1 维修发票 (repair_invoices)

```sql
repair_invoices (维修发票/PI)
├── id: SERIAL PRIMARY KEY
├── invoice_number: VARCHAR(30) UNIQUE -- 发票编号 (PI-2026-0001)
├── invoice_date: DATE
├── dealer_id: INT -- 经销商ID
├── customer_id: INT -- 客户ID
├── issue_id: INT -- 关联工单
├── rma_number: VARCHAR(30) -- RMA号
├── product_model: VARCHAR(255)
├── serial_number: VARCHAR(100)
├── warranty_status: ENUM('in_warranty', 'out_of_warranty')
├── items: JSON -- [{sku, name, quantity, unit_price, subtotal}]
├── parts_total: DECIMAL(10,2)
├── labor_fee: DECIMAL(10,2)
├── shipping_fee: DECIMAL(10,2)
├── other_fee: DECIMAL(10,2)
├── total_amount: DECIMAL(10,2)
├── currency: ENUM('USD', 'EUR', 'CNY')
├── bill_to_address: JSON
├── ship_to_address: JSON
├── problem_description: TEXT
├── analysis: TEXT
├── solution: TEXT
├── status: ENUM('draft', 'sent', 'pending_payment', 'paid', 'cancelled')
├── sent_at: TIMESTAMP
├── paid_at: TIMESTAMP
├── payment_method: VARCHAR(100)
├── created_by: INT
├── created_at: TIMESTAMP DEFAULT CURRENT_TIMESTAMP
└── updated_at: TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
```

---

### 6.2 经销商定期结算 (dealer_settlements)

```sql
dealer_settlements (经销商定期结算)
├── id: SERIAL PRIMARY KEY
├── settlement_number: VARCHAR(30) UNIQUE
├── dealer_id: INT NOT NULL
├── period_start: DATE
├── period_end: DATE
├── settlement_type: ENUM('monthly', 'quarterly')
├── total_repairs: INT
├── total_parts_used: INT
├── total_amount: DECIMAL(10,2)
├── currency: ENUM('USD', 'EUR', 'CNY')
├── invoice_ids: JSON -- [关联PI列表]
├── detail_items: JSON -- [{sku, quantity, amount}]
├── status: ENUM('pending_confirm', 'confirmed', 'pending_payment', 'paid')
├── confirmed_at: TIMESTAMP
├── paid_at: TIMESTAMP
├── created_at: TIMESTAMP DEFAULT CURRENT_TIMESTAMP
└── updated_at: TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
```

---

## 7. 物流跟踪 (logistics_tracking)

```sql
logistics_tracking (物流跟踪)
├── id: SERIAL PRIMARY KEY
├── issue_id: INT
├── rma_number: VARCHAR(30)
├── direction: ENUM('inbound', 'outbound') -- 方向
├── logistics_type: ENUM('express', 'door_delivery', 'kine_pickup', 'batch_shipment')
├── carrier: VARCHAR(100) -- 快递公司
├── tracking_number: VARCHAR(100)
├── is_tracking_pending: BOOLEAN DEFAULT false
├── origin_region: VARCHAR(100)
├── origin_address: JSON
├── destination_address: JSON
├── shipped_at: TIMESTAMP
├── estimated_arrival: TIMESTAMP
├── actual_arrival: TIMESTAMP
├── received_at: TIMESTAMP
├── appointment_time: TIMESTAMP -- 上门送达特有
├── contact_person: VARCHAR(255)
├── contact_phone: VARCHAR(50)
├── related_rma_numbers: JSON -- 集中发货特有
├── status: ENUM('pending_shipment', 'in_transit', 'arrived', 'signed')
├── status_history: JSON
├── created_by: INT
├── created_at: TIMESTAMP DEFAULT CURRENT_TIMESTAMP
└── updated_at: TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
```

---

## 8. 维修异常处理 (repair_exceptions)

```sql
repair_exceptions (维修异常)
├── id: SERIAL PRIMARY KEY
├── issue_id: INT NOT NULL
├── exception_number: VARCHAR(30) UNIQUE -- 异常编号
├── exception_type: ENUM('cost_exceed', 'severe_damage', 'need_replacement', 'user_damage', 'unrepairable', 'other_issue')
├── original_estimate: DECIMAL(10,2)
├── original_estimate_detail: JSON
├── actual_estimate: DECIMAL(10,2)
├── actual_estimate_detail: JSON
├── difference_amount: DECIMAL(10,2)
├── difference_percentage: DECIMAL(5,2)
├── description: TEXT
├── photos: JSON -- [URL列表]
├── analysis: TEXT
├── customer_options: JSON
├── customer_choice: ENUM('continue', 'cancel', 'trade_in', 'scrap')
├── customer_choice_at: TIMESTAMP
├── customer_note: TEXT
├── requires_approval: BOOLEAN DEFAULT false
├── approval_level: ENUM('staff', 'manager', 'director')
├── approved_by: INT
├── approved_at: TIMESTAMP
├── approval_note: TEXT
├── status: ENUM('pending', 'waiting_customer', 'waiting_approval', 'confirmed', 'cancelled')
├── reported_by: INT
├── handled_by: INT
├── created_at: TIMESTAMP DEFAULT CURRENT_TIMESTAMP
└── updated_at: TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
```

---

## 9. AI建议记录 (ai_suggestions)

```sql
ai_suggestions (AI建议记录)
├── id: SERIAL PRIMARY KEY
├── suggestion_type: VARCHAR(100) -- 建议类型
├── related_entity_type: VARCHAR(50) -- 关联实体类型
├── related_entity_id: INT -- 关联实体ID
├── suggestions: JSON -- [{option, confidence, reason}]
├── recommended_index: INT
├── user_action: ENUM('accepted', 'modified', 'rejected', 'ignored')
├── user_choice: TEXT
├── user_modification: TEXT
├── action_by: INT
├── action_at: TIMESTAMP
├── model_used: VARCHAR(100)
├── prompt_version: VARCHAR(50)
├── processing_time_ms: INT
└── created_at: TIMESTAMP DEFAULT CURRENT_TIMESTAMP
```

---

## 10. 产品进化池

### 10.1 Bug流 (product_bugs)

```sql
product_bugs (Bug流)
├── id: SERIAL PRIMARY KEY
├── bug_number: VARCHAR(30) UNIQUE -- Bug编号 (BUG-2026-0001)
├── title: VARCHAR(500) NOT NULL
├── severity: ENUM('critical', 'high', 'normal', 'low')
├── phenomenon: TEXT -- 现象描述
├── reproduce_steps: TEXT -- 复现步骤
├── affected_versions: JSON -- 受影响固件版本列表
├── affected_models: JSON -- 受影响机型列表
├── source_type: ENUM('inquiry_ticket', 'rma_ticket', 'internal_test')
├── source_ids: JSON -- 来源ID列表
├── reporter_count: INT DEFAULT 1
├── status: ENUM('new', 'confirmed', 'fixing', 'fixed', 'cannot_reproduce', 'not_bug')
├── assigned_to: INT
├── root_cause: TEXT
├── fix_plan: TEXT
├── fixed_in_version: VARCHAR(20)
├── fix_release_date: DATE
├── verification_status: ENUM('pending', 'verified', 'recurred')
├── created_at: TIMESTAMP DEFAULT CURRENT_TIMESTAMP
└── updated_at: TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
```

---

### 10.2 需求流 (feature_requests)

```sql
feature_requests (功能期望)
├── id: SERIAL PRIMARY KEY
├── request_number: VARCHAR(30) UNIQUE -- FR-2026-0001
├── title: VARCHAR(500) NOT NULL
├── description: TEXT
├── category: ENUM('ui', 'function', 'performance', 'compatibility', 'hardware', 'other')
├── product_id: INT
├── source_type: ENUM('inquiry_ticket', 'dealer_feedback', 'customer_self', 'internal')
├── source_id: INT
├── customer_id: INT
├── priority: ENUM('high', 'medium', 'low')
├── vote_count: INT DEFAULT 1 -- 请求次数/投票数
├── weight_score: INT DEFAULT 1 -- 加权得分
├── status: ENUM('new', 'evaluating', 'planned', 'developing', 'released', 'rejected', 'merged')
├── assigned_to: INT
├── rejection_reason: TEXT
├── merged_to_id: INT
├── target_version: VARCHAR(20)
├── released_version: VARCHAR(20)
├── release_date: DATE
├── ai_tags: JSON
├── ai_similar_ids: JSON
├── ai_priority_score: DECIMAL(5,2)
├── created_at: TIMESTAMP DEFAULT CURRENT_TIMESTAMP
└── updated_at: TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
```

---

### 10.3 需求-客户关联 (feature_request_customers)

```sql
feature_request_customers (需求-客户关联)
├── id: SERIAL PRIMARY KEY
├── feature_request_id: INT NOT NULL
├── customer_id: INT NOT NULL
├── dealer_id: INT
├── source_record_id: INT
├── vote_comment: TEXT
├── customer_weight: INT DEFAULT 1 -- 客户权重 (VIP=2, KOL=3)
├── notified_at: TIMESTAMP
├── notification_opened: BOOLEAN DEFAULT false
├── feedback: TEXT
└── created_at: TIMESTAMP DEFAULT CURRENT_TIMESTAMP
```

---

### 10.4 原声流 (customer_voices)

```sql
customer_voices (原声流)
├── id: SERIAL PRIMARY KEY
├── voice_number: VARCHAR(30) UNIQUE -- VOC-2026-0001
├── content: TEXT NOT NULL -- 原始内容
├── source_type: ENUM('inquiry_ticket', 'rma_ticket', 'social_media', 'email')
├── source_id: INT
├── customer_id: INT
├── sentiment: ENUM('positive', 'neutral', 'negative') -- 情感
├── ai_tags: JSON -- AI自动标签 [#画质好, #服务快, #MAVO Edge]
├── product_tags: JSON -- 产品标签
├── feature_tags: JSON -- 功能标签
├── scene_tags: JSON -- 场景标签
├── usage_status: ENUM('pending', 'approved', 'used', 'rejected') -- 使用状态
├── used_in: JSON -- 使用场景 [官网/社交媒体/案例研究]
├── approved_by: INT
├── approved_at: TIMESTAMP
├── created_at: TIMESTAMP DEFAULT CURRENT_TIMESTAMP
└── updated_at: TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
```

---

## 11. 配件目录 (parts_catalog)

```sql
parts_catalog (配件目录)
├── id: SERIAL PRIMARY KEY
├── sku: VARCHAR(50) UNIQUE NOT NULL
├── category: VARCHAR(100) -- 产品分类
├── internal_name_cn: VARCHAR(255)
├── internal_name_en: VARCHAR(255)
├── external_name_cn: VARCHAR(255)
├── external_name_en: VARCHAR(255)
├── price_cny: DECIMAL(10,2)
├── price_usd: DECIMAL(10,2)
├── price_eur: DECIMAL(10,2)
├── product_family: ENUM('A', 'B', 'C', 'D') -- 产品族群限制
├── is_active: BOOLEAN DEFAULT true
├── remarks: TEXT
├── created_at: TIMESTAMP DEFAULT CURRENT_TIMESTAMP
└── updated_at: TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
```

> **数据来源**：完整配件清单见 [Service_Parts_SKU_Pricing.md](./Service_Parts_SKU_Pricing.md)

---

## 12. 统计视图

### 12.1 每日统计 (issue_stats_daily)

```sql
issue_stats_daily (每日统计 - 预计算)
├── id: SERIAL PRIMARY KEY
├── date: DATE NOT NULL
├── product_id: INT
├── issue_category: VARCHAR(100)
├── severity: VARCHAR(10)
├── region: VARCHAR(100)
├── dealer_id: INT
├── count: INT DEFAULT 0
├── avg_response_time: INT -- 平均响应时间(分钟)
└── avg_resolve_time: INT -- 平均解决时间(分钟)

UNIQUE KEY (date, product_id, issue_category, severity, region, dealer_id)
```

---

### 12.2 月度统计 (issue_stats_monthly)

```sql
issue_stats_monthly (月度统计)
├── id: SERIAL PRIMARY KEY
├── year_month: VARCHAR(7) NOT NULL -- '2026-02'
├── product_id: INT
├── issue_category: VARCHAR(100)
├── severity: VARCHAR(10)
├── region: VARCHAR(100)
├── dealer_id: INT
├── count: INT DEFAULT 0
├── avg_response_time: INT
└── avg_resolve_time: INT

UNIQUE KEY (year_month, product_id, issue_category, severity, region, dealer_id)
```

---

## 13. 更新记录

| 日期 | 版本 | 修改内容 | 修改人 | 备注 |
|-----|------|---------|-------|------|
| 2026-02-03 | v1.0 | 初始版本，从PRD中迁移 | - | 完整数据模型设计 |

---

## 附录：表关系图

```
Core Entities:
  products ←── inquiry_tickets
  customers ←── tickets
  dealers   ←── dealer_inventory
  users

Ticketing System:
  inquiry_tickets → (upgrade) → tickets
  tickets → issue_attachments
  tickets → issue_comments
  tickets → repair_exceptions

Knowledge Base:
  knowledge_articles → knowledge_products
  knowledge_articles → knowledge_tags
  knowledge_articles → troubleshooting_steps
  knowledge_articles → compatibility_entries

Inventory & Billing:
  dealers → dealer_inventory
  dealers → dealer_inventory_transactions
  dealers → replenishment_requests
  tickets → repair_invoices
  dealers → dealer_settlements

Product Evolution:
  product_bugs ← tickets
  feature_requests ← feature_request_customers ← customers
  customer_voices ← tickets

Supporting:
  logistics_tracking ← tickets
  ai_suggestions
  issue_stats_daily
  issue_stats_monthly
```

---

**END OF DOCUMENT**
