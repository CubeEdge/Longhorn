# Service 数据模型设计

**版本**: 0.8.1
**最后更新**: 2026-02-22 (Deployed v12.1.5)

> **v0.7.1 更新**：
> - 账户类型更新：CORPORATE → ORGANIZATION
> - 新增经销商专属字段：dealer_level（tier1/tier2/tier3/Direct）
> - 区分 service_tier（终端客户服务等级）和 dealer_level（经销商等级）
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

### 1.2 账户 (accounts)

> **设计说明**：采用"账户(Account) + 联系人(Contact)"双层架构，区分法律/商业实体与具体自然人。
> - 账户(Account)：公司、机构、个体户或个人（法律/商业实体）
> - 联系人(Contact)：具体的自然人，负责对接沟通

```sql
accounts (账户 - 法律/商业实体)
├── id: SERIAL PRIMARY KEY
├── account_number: VARCHAR(30) UNIQUE -- 账户编号 (ACC-2026-0001)
├── name: VARCHAR(255) NOT NULL -- 账户名称（公司名或个人姓名）
├── account_type: ENUM('ORGANIZATION', 'INDIVIDUAL', 'DEALER', 'INTERNAL') NOT NULL
│   -- ORGANIZATION: 机构客户（租赁公司、制作公司、广电、教育机构等）
│   -- INDIVIDUAL: 个人客户（个人摄影师、自由职业者）
│   -- DEALER: 经销商（ProAV, Gafpa, 1SV等）
│   -- INTERNAL: 内部/合作伙伴（友商、供应商、媒体等）
│
├── // 联系信息（主要联系地址）
├── email: VARCHAR(255) -- 主邮箱
├── phone: VARCHAR(50) -- 主电话
├── country: VARCHAR(100) -- 国家
├── province: VARCHAR(100) -- 省份/州
├── city: VARCHAR(100) -- 城市
├── address: TEXT -- 详细地址
│
├── // 业务属性
├── service_tier: ENUM('STANDARD', 'VIP', 'VVIP', 'BLACKLIST') DEFAULT 'STANDARD'
│   -- 终端客户服务等级（适用于 ORGANIZATION/INDIVIDUAL）
├── dealer_level: ENUM('tier1', 'tier2', 'tier3', 'Direct') -- 经销商等级（仅 DEALER）
│   -- tier1: 一级经销商（有配件库存+维修能力）
│   -- tier2: 二级经销商（有维修能力但无备件）
│   -- tier3: 三级经销商（无维修能力无备件）
│   -- Direct: 直营
├── industry_tags: JSON -- 行业标签 ["RENTAL_HOUSE", "PRODUCTION", "BROADCAST"]
├── credit_limit: DECIMAL(10,2) DEFAULT 0 -- 信用额度
│
├── // 经销商关联（销售归属）
├── parent_dealer_id: INT -- 关联经销商账户ID（当客户通过经销商获得时）
│
├── // 经销商特有字段
├── dealer_code: VARCHAR(50) -- 经销商代码（仅 DEALER，如: ProAV, Gafpa）
├── region: VARCHAR(100) -- 销售大区（仅 DEALER）
├── can_repair: BOOLEAN DEFAULT false -- 是否有维修能力（仅 DEALER）
├── repair_level: VARCHAR(50) -- 维修能力等级（仅 DEALER）
│
├── // 系统字段
├── is_active: BOOLEAN DEFAULT true -- 是否启用
├── notes: TEXT -- 备注
├── created_at: TIMESTAMP DEFAULT CURRENT_TIMESTAMP
└── updated_at: TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP

FOREIGN KEY (parent_dealer_id) REFERENCES accounts(id)
```

**索引**：
- PRIMARY KEY (id)
- UNIQUE KEY (account_number)
- INDEX idx_account_type (account_type)
- INDEX idx_parent_dealer (parent_dealer_id)
- INDEX idx_email (email)
- INDEX idx_country_province (country, province)
- INDEX idx_service_tier (service_tier)

---

### 1.2.1 联系人 (contacts)

> **设计说明**：联系人是与账户关联的具体自然人，解决B2B场景中"单位"与"人"的分离问题。
> 例如：CVP UK（账户）有 Mike（维修主管）和 Sarah（财务经理）两个联系人。

```sql
contacts (联系人 - 具体自然人)
├── id: SERIAL PRIMARY KEY
├── account_id: INT NOT NULL -- 关联账户ID
│
├── // 个人信息
├── name: VARCHAR(255) NOT NULL -- 姓名
├── email: VARCHAR(255) -- 邮箱
├── phone: VARCHAR(50) -- 电话
├── wechat: VARCHAR(100) -- 微信号
│
├── // 职位与角色
├── job_title: VARCHAR(100) -- 职位（维修主管、制片、摄影师等）
├── department: VARCHAR(100) -- 部门
│
├── // 偏好设置
├── language_preference: VARCHAR(20) DEFAULT 'en' -- 语言偏好（zh/en/de/ja等）
├── communication_preference: ENUM('EMAIL', 'PHONE', 'WECHAT') DEFAULT 'EMAIL'
│
├── // 状态管理
├── status: ENUM('ACTIVE', 'INACTIVE', 'PRIMARY') DEFAULT 'ACTIVE'
│   -- ACTIVE: 在职/活跃
│   -- INACTIVE: 离职/不再对接
│   -- PRIMARY: 主要对接人
├── is_primary: BOOLEAN DEFAULT false -- 是否为主要联系人
│
├── // 系统字段
├── notes: TEXT -- 备注（如离职交接信息）
├── created_at: TIMESTAMP DEFAULT CURRENT_TIMESTAMP
└── updated_at: TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP

FOREIGN KEY (account_id) REFERENCES accounts(id)
```

**索引**：
- PRIMARY KEY (id)
- INDEX idx_account (account_id)
- INDEX idx_status (status)
- INDEX idx_email (email)
- UNIQUE KEY (account_id, email) -- 同一账户下邮箱唯一

---

### 1.2.2 账户设备关联 (account_devices)

> **设计说明**：记录账户名下的设备资产，支持设备历史追溯（设备可能转让，但历史归属可查）。

```sql
account_devices (账户设备关联)
├── id: SERIAL PRIMARY KEY
├── account_id: INT NOT NULL -- 关联账户ID
├── product_id: INT NOT NULL -- 关联产品ID
├── serial_number: VARCHAR(100) NOT NULL -- 序列号
│
├── // 设备信息
├── firmware_version: VARCHAR(20) -- 当前固件版本
├── purchase_date: DATE -- 购买日期
├── warranty_until: DATE -- 保修截止日期
│
├── // 状态
├── device_status: ENUM('ACTIVE', 'SOLD', 'RETIRED') DEFAULT 'ACTIVE'
│   -- ACTIVE: 当前持有
│   -- SOLD: 已转让/出售
│   -- RETIRED: 已报废
│
├── // 系统字段
├── created_at: TIMESTAMP DEFAULT CURRENT_TIMESTAMP
└── updated_at: TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP

FOREIGN KEY (account_id) REFERENCES accounts(id)
FOREIGN KEY (product_id) REFERENCES products(id)
UNIQUE KEY (account_id, serial_number)
```

**索引**：
- PRIMARY KEY (id)
- INDEX idx_account (account_id)
- INDEX idx_product (product_id)
- INDEX idx_serial_number (serial_number)
- INDEX idx_device_status (device_status)

---

### 1.3 经销商 (dealers) [已弃用]

> **⚠️ 重要说明**：经销商数据已整合到 `accounts` 表中，通过 `account_type = 'DEALER'` 区分。
> 
> 原 `dealers` 表字段映射关系：
> - `dealers.name` → `accounts.name`
> - `dealers.code` → `accounts.dealer_code`
> - `dealers.dealer_type` → `accounts.dealer_level`
> - `dealers.region` → `accounts.region`
> - `dealers.contact_*` → `contacts` 表（通过 `account_id` 关联）
>
> 保留此表定义仅用于历史参考，新开发请使用 `accounts` + `contacts` 双层架构。

```sql
dealers (经销商/渠道商) [已弃用，请使用 accounts 表]
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
├── // 账户与联系人信息 (代客户服务模式下可选)
├── account_id: INT -- 关联账户 (工单归属，可为空)
├── contact_id: INT -- 关联联系人 (具体对接人，可为空)
├── reporter_name: VARCHAR(255) -- 报告人姓名 (冗余，便于显示)
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

FOREIGN KEY (account_id) REFERENCES accounts(id)
FOREIGN KEY (contact_id) REFERENCES contacts(id)
FOREIGN KEY (dealer_id) REFERENCES accounts(id) -- 经销商也是账户的一种
FOREIGN KEY (product_id) REFERENCES products(id)
FOREIGN KEY (handler_id) REFERENCES users(id)
```

**索引**：
- PRIMARY KEY (id)
- UNIQUE KEY (ticket_number)
- INDEX idx_account (account_id)
- INDEX idx_contact (contact_id)
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
├── account_id: INT -- 关联账户 (工单归属)
├── contact_id: INT -- 关联联系人 (具体对接人)
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
FOREIGN KEY (account_id) REFERENCES accounts(id)
FOREIGN KEY (contact_id) REFERENCES contacts(id)
FOREIGN KEY (dealer_id) REFERENCES accounts(id) -- 经销商也是账户的一种
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
- INDEX idx_account (account_id)
- INDEX idx_contact (contact_id)
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
├── slug: VARCHAR(255) UNIQUE -- 用于URL的短链接
├── knowledge_type: ENUM('FAQ', 'Troubleshooting', 'Compatibility', 'Firmware', 'Basics', 'Case', 'Manual') -- 类型
│
├── // 文档层级结构
│
├── chapter_number: INT -- 章节号 (如 Chapter 3)
├── section_number: INT -- 小节号 (如 Section 3.1)
│
├── // FAQ特有
├── question: TEXT -- 问题 (FAQ类型)
├── external_answer: TEXT -- 外部回答
├── internal_answer: TEXT -- 内部回答
│
├── // 内容与排版
├── summary: VARCHAR(1000) -- 摘要
├── content: TEXT -- 原始内容 (HTML)
├── formatted_content: TEXT -- AI/人工优化后的排版内容
├── format_status: ENUM('none', 'draft', 'published') DEFAULT 'none' -- 排版状态
├── formatted_by: ENUM('ai', 'human', 'external') -- 排版人类型
├── formatted_at: TIMESTAMP -- 排版时间
│
├── // 分类与属性
├── category: VARCHAR(100) -- 大类
├── subcategory: VARCHAR(100) -- 子类
├── product_line: ENUM('A', 'B', 'C', 'D') -- 产品线
├── product_models: JSON -- 关联的具体机型列表 (如 ["Edge 8K", "Edge 6K"])
├── tags: JSON -- 标签列表 (如 ["firmware", "display"])
├── visibility: ENUM('Public', 'Dealer', 'Internal', 'Department') DEFAULT 'Internal' -- 可见性
│
├── // 导入溯源
├── source_type: ENUM('Manual', 'PDF', 'DOCX', 'Web') DEFAULT 'Manual' -- 数据来源
├── source_reference: VARCHAR(255) -- 原始文件名或引用链接
├── batch_id: VARCHAR(50) -- 批量导入批次ID
│
├── // 统计与权重
├── view_count: INT DEFAULT 0 -- 阅读数
├── helpful_count: INT DEFAULT 0 -- 觉得有用数
├── not_helpful_count: INT DEFAULT 0 -- 觉得没用数
│
├── // 版本控制与状态
├── version: INT DEFAULT 1 -- 版本号
├── status: ENUM('Draft', 'Published', 'Archived') DEFAULT 'Draft' -- 状态
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

### 4.6 搜索同义词库 (search_synonyms)

```sql
search_synonyms (搜索同义词)
├── id: SERIAL PRIMARY KEY
├── word: VARCHAR(100) NOT NULL -- 原词 (如: 录制)
├── synonyms: TEXT NOT NULL -- 同义词列表 (如: 录影, 录像, 视频录制)
├── category: VARCHAR(50) -- 词类 (操作/硬件/软件/专有名词)
├── is_active: BOOLEAN DEFAULT true
├── created_at: TIMESTAMP DEFAULT CURRENT_TIMESTAMP
└── updated_at: TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
```

**索引**：
- PRIMARY KEY (id)
- INDEX idx_word (word)
- INDEX idx_category (category)


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
├── dealer_id: INT -- 经销商ID (关联 accounts 表，account_type='DEALER')
├── account_id: INT -- 账户ID (关联 accounts 表)
├── contact_id: INT -- 联系人ID (关联 contacts 表，具体对接人)
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

## 10. AI 检索索引 (Search Index)

### 10.1 工单索引表 (ticket_search_index)

```sql
ticket_search_index (工单检索源数据 - SQLite)
├── id: INTEGER PRIMARY KEY
├── ticket_type: TEXT -- 'inquiry', 'rma', 'dealer_repair'
├── ticket_id: INTEGER -- 关联原始工单ID
├── ticket_number: TEXT -- 工单编号
├── title: TEXT -- 摘要/描述
├── description: TEXT -- 沟通详细记录
├── resolution: TEXT -- 最终解决方案
├── tags: TEXT -- JSON标签
├── product_model: TEXT -- 产品型号
├── serial_number: TEXT -- SN
├── category: TEXT -- 故障分类
├── status: TEXT -- 状态
├── dealer_id: INTEGER -- 权限过滤: 经销商ID
├── account_id: INTEGER -- 权限过滤: 账户ID (关联 accounts 表)
├── visibility: TEXT -- 'internal' | 'dealer'
└── closed_at: TEXT -- 结案时间
```

### 10.2 FTS5 虚拟表 (ticket_search_fts)

```sql
ticket_search_fts (全文检索表)
USING fts5(
  title, 
  description, 
  resolution, 
  tags, 
  content='ticket_search_index', 
  content_rowid='id'
)
```

---

## 11. 产品进化池

### 11.1 Bug流 (product_bugs)

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
├── account_id: INT -- 关联账户ID (原 customer_id)
├── contact_id: INT -- 关联联系人ID (具体反馈人)
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

### 10.3 需求-账户关联 (feature_request_accounts)

> **注意**：原 `feature_request_customers` 表已重构为 `feature_request_accounts`，使用 `account_id` 替代 `customer_id`。

```sql
feature_request_accounts (需求-账户关联)
├── id: SERIAL PRIMARY KEY
├── feature_request_id: INT NOT NULL
├── account_id: INT NOT NULL -- 关联账户ID（替代原 customer_id）
├── contact_id: INT -- 关联联系人ID（具体投票人）
├── source_record_id: INT
├── vote_comment: TEXT
├── account_weight: INT DEFAULT 1 -- 账户权重 (VIP=2, KOL=3)
├── notified_at: TIMESTAMP
├── notification_opened: BOOLEAN DEFAULT false
├── feedback: TEXT
└── created_at: TIMESTAMP DEFAULT CURRENT_TIMESTAMP

FOREIGN KEY (account_id) REFERENCES accounts(id)
FOREIGN KEY (contact_id) REFERENCES contacts(id)
```

---

### 10.4 原声流 (customer_voices)

> **注意**：`customer_id` 字段已更新为 `account_id`，保持命名不变但语义对应 accounts 表。

```sql
customer_voices (原声流)
├── id: SERIAL PRIMARY KEY
├── voice_number: VARCHAR(30) UNIQUE -- VOC-2026-0001
├── content: TEXT NOT NULL -- 原始内容
├── source_type: ENUM('inquiry_ticket', 'rma_ticket', 'social_media', 'email')
├── source_id: INT
├── account_id: INT -- 关联账户ID（原 customer_id，对应 accounts 表）
├── contact_id: INT -- 关联联系人ID（具体反馈人）
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

## 13. 系统管理与 AI 配置 (Admin & AI)

### 13.1 系统全局设置 (system_settings)

```sql
system_settings (系统配置)
├── id: INT PRIMARY KEY
├── system_name: TEXT -- 系统名称
├── ai_enabled: BOOLEAN -- 是否启用 AI
├── ai_work_mode: BOOLEAN -- 是否为自动模式 (0=手动确认, 1=自动推送)
├── ai_allow_search: BOOLEAN -- 是否允许联网搜索
├── ai_provider: TEXT -- 当前活跃服务商名称
└── updated_at: TIMESTAMP
```

### 13.2 AI 服务商配置 (ai_providers)

```sql
ai_providers (AI 服务商)
├── id: INT PRIMARY KEY
├── name: TEXT UNIQUE -- 服务商名称 (DeepSeek, Gemini, OpenAI)
├── api_key: TEXT -- API 密钥 (加密存储/脱敏)
├── base_url: TEXT -- 代理或私有部署地址
├── chat_model: TEXT -- 默认对话模型
├── reasoner_model: TEXT -- 推理模型
├── vision_model: TEXT -- 视觉模型
├── allow_search: BOOLEAN -- 联网搜索开关
├── temperature: REAL -- 温度参数 (0-2.0)
├── max_tokens: INT -- 最大生成长度
├── top_p: REAL -- 核采样参数
├── is_active: BOOLEAN -- 是否为当前活跃
└── updated_at: TIMESTAMP
```

### 13.3 AI 使用日志 (ai_usage_logs)

```sql
ai_usage_logs (AI 使用审计)
├── id: INT PRIMARY KEY
├── model: TEXT -- 使用的模型名称
├── task_type: TEXT -- 任务类型 (Chat, Reasoner, Vision, Diagnosis)
├── prompt_tokens: INT -- 输入 Token
├── completion_tokens: INT -- 输出 Token
├── total_tokens: INT -- 总 Token
└── created_at: TIMESTAMP
```

---

## 14. 更新记录

| 日期 | 版本 | 修改内容 | 修改人 | 备注 |
|-----|------|---------|-------|------|
| 2026-02-03 | v1.0 | 初始版本，从PRD中迁移 | - | 完整数据模型设计 |
| 2026-02-06 | v1.1 | 新增 AI 配置与系统管理相关表定义 | - | 对应 PRD v0.9.1 |
| 2026-02-11 | v1.2 | 重构客户模型为"账户+联系人"双层架构 | - | 引入 Account/Contact 模型，支持B2B场景 |
| 2026-02-11 | v1.3 | 账户类型更新，新增经销商专属字段 | - | CORPORATE→ORGANIZATION，新增 dealer_level 等字段 |
| 2026-02-22 | v1.4 | 新增 `search_synonyms` 同义词库支持 | - | 对应 Wiki 搜索召回优化需求 |


---

## 附录：表关系图

```
Core Entities:
  products ←── inquiry_tickets
  accounts ←── contacts
  accounts ←── account_devices
  accounts ←── tickets (account_id)
  contacts ←── tickets (contact_id)
  accounts ←── dealer_inventory (dealer作为account的一种)
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
  search_synonyms (用于搜索优化)


Inventory & Billing:
  accounts (DEALER) → dealer_inventory
  accounts (DEALER) → dealer_inventory_transactions
  accounts (DEALER) → replenishment_requests
  tickets → repair_invoices
  accounts (DEALER) → dealer_settlements

Product Evolution:
  product_bugs ← tickets
  feature_requests ← feature_request_customers ← accounts
  customer_voices ← tickets

Supporting:
  logistics_tracking ← tickets
  ai_suggestions
  issue_stats_daily
  issue_stats_monthly
```

---

**END OF DOCUMENT**
