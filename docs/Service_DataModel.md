# Service 数据模型设计

**版本**: 0.9.1 (P2 Integration)
**最后更新**: 2026-03-01

> **v0.9.1 更新 (文件权限优化)**：
> - 重命名表：`permissions` → `file_permissions`（避免语义混淆）
> - 新增 `path_hash` 字段：MD5 哈希值，用于快速路径查询
> - 新增唯一索引：防止重复授权 `(user_id, folder_path)`
> - 新增过期时间索引：优化过期权限清理
> - 新增级联删除触发器：用户删除时自动清理权限记录
>
> **v0.9.0 更新 (P2 升级)**：
> - 工单模型重构：分表设计合并为统一 tickets 表 (ticket_type 区分)
> - 新增 SLA 引擎字段：node_entered_at, sla_due_at, sla_status, breach_counter
> - 新增协作机制字段：current_node, participants, snooze_until
> - 新增活动时间轴表 (ticket_activities)
> - 新增系统通知表 (notifications)
> - 资产表扩展 IoT 和保修计算字段
> **参考来源**：Service PRD_P2.md v1.6, A02-产品返修记录.xlsx

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

### 1.2.2 账户设备关联 / Installed_Base (account_devices)

> **设计说明**：记录账户名下的设备资产（Installed_Base），支持设备历史追溯、IoT 数据绑定和保修计算。
> **P2 更新**：新增 IoT 绑定字段和保修计算引擎字段，支持瀑布流保修判定逻辑。

```sql
account_devices (账户设备关联 / Installed_Base)
├── id: SERIAL PRIMARY KEY
├── account_id: INT NOT NULL -- 关联账户ID
├── product_id: INT NOT NULL -- 关联产品ID
├── serial_number: VARCHAR(100) NOT NULL -- 序列号
│
├── // 设备信息
├── firmware_version: VARCHAR(20) -- 当前固件版本
├── hardware_version: VARCHAR(50) -- 硬件版本/批次
├── purchase_date: DATE -- 购买日期
├── warranty_until: DATE -- 保修截止日期 (计算结果)
│
├── // IoT 绑定 (P2 新增)
├── iot_device_id: VARCHAR(100) -- IoT 设备ID (来自 Kine App 绑定)
├── iot_bind_time: TIMESTAMP -- IoT 绑定时间
├── iot_data: JSON -- IoT 累计数据快照 (运行时长、快门次数等)
│
├── // 保修计算引擎字段 (P2 新增)
├── warranty_source: ENUM('iot', 'invoice', 'registration', 'direct_sale', 'fallback') -- 保修依据来源
│   -- iot: IoT 首次开机时间
│   -- invoice: 发票日期
│   -- registration: 用户注册日期
│   -- direct_sale: 直销发货日期
│   -- fallback: SN 出厂日期 + 180天
├── warranty_start_date: DATE -- 保修起算日期
├── warranty_duration_months: INT DEFAULT 24 -- 保修时长 (月)
├── warranty_calculated_at: TIMESTAMP -- 保修计算时间
│
├── // 发票信息 (用于保修计算)
├── invoice_date: DATE -- 发票日期
├── invoice_number: VARCHAR(100) -- 发票号
├── invoice_attachment_id: INT -- 发票附件ID
│
├── // 注册信息 (用于保修计算)
├── registration_date: DATE -- 用户注册日期
├── registration_source: VARCHAR(50) -- 注册来源 (Kine App / Web)
│
├── // 状态
├── device_status: ENUM('ACTIVE', 'SOLD', 'RETIRED') DEFAULT 'ACTIVE'
│   -- ACTIVE: 当前持有
│   -- SOLD: 已转让/出售
│   -- RETIRED: 已报废
│
├── // 系统字段
├── notes: TEXT -- 备注
├── created_at: TIMESTAMP DEFAULT CURRENT_TIMESTAMP
└── updated_at: TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP

FOREIGN KEY (account_id) REFERENCES accounts(id)
FOREIGN KEY (product_id) REFERENCES products(id)
UNIQUE KEY (account_id, serial_number)
```

**保修计算瀑布流逻辑**（优先级从高到低）：
1. **IoT 首次开机** → `warranty_start_date = iot_data.first_boot`
2. **发票日期** → `warranty_start_date = invoice_date`
3. **用户注册日期** → `warranty_start_date = registration_date`
4. **直销发货日期** → `warranty_start_date = direct_sale_date`
5. **兜底逻辑** → `warranty_start_date = sn_manufacture_date + 180天`

**索引**：
- PRIMARY KEY (id)
- INDEX idx_account (account_id)
- INDEX idx_product (product_id)
- INDEX idx_serial_number (serial_number)
- INDEX idx_device_status (device_status)
- INDEX idx_iot_device (iot_device_id)
- INDEX idx_warranty_until (warranty_until)

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

> **P2 架构升级**：采用单表多态设计，将原 `inquiry_tickets`、`rma_tickets`、`dealer_repairs` 三表合并为统一的 `tickets` 表，通过 `ticket_type` 字段区分工单类型。

### 2.1 统一工单表 (tickets)

```sql
tickets (统一工单表 - 单表多态设计)
├── id: SERIAL PRIMARY KEY
├── ticket_number: VARCHAR(30) UNIQUE NOT NULL -- 工单编号
│   -- 格式规范：
│   -- Inquiry: KYYMM-XXXX (如 K2602-0001)
│   -- RMA:     RMA-{C/D}-YYMM-XXXX (C=Customer, D=Dealer)
│   -- SVC:     SVC-D-YYMM-XXXX (经销商维修)
│
├── // ===== 工单类型与状态机 (P2 核心) =====
├── ticket_type: ENUM('inquiry', 'rma', 'svc') NOT NULL -- 工单类型
│   -- inquiry: 咨询工单（入口）
│   -- rma: RMA 返厂单
│   -- svc: 经销商现场维修单
│
├── current_node: VARCHAR(50) -- 当前流程节点 (状态机)
│   -- inquiry 流程: draft → in_progress → waiting_customer → resolved → auto_closed → converted
│   -- rma 流程: submitted → ms_review → op_receiving → op_diagnosing → op_repairing → op_qa → ms_closing → closed
│   -- svc 流程: submitted → ge_review → dl_receiving → dl_repairing → dl_qa → ge_closing → closed
│
├── status: ENUM('open', 'in_progress', 'waiting', 'resolved', 'closed', 'cancelled') -- 汇总状态
│   -- 用于看板筛选，由 current_node 映射
├── status_changed_at: TIMESTAMP -- 最近状态变更时间
│
├── // ===== SLA 引擎字段 (P2 新增) =====
├── priority: ENUM('P0', 'P1', 'P2') DEFAULT 'P2' -- 优先级
│   -- P0: 紧急 (首响2h, 方案4h, 报价24h, 完结<36h)
│   -- P1: 高   (首响8h, 方案24h, 报价48h, 完结3工作日)
│   -- P2: 常规 (首响24h, 方案48h, 报价5天, 完结7工作日)
├── node_entered_at: TIMESTAMP -- 进入当前节点时间
├── sla_due_at: TIMESTAMP -- 当前节点 SLA 截止时间
├── sla_status: ENUM('normal', 'warning', 'breached') DEFAULT 'normal' -- SLA 状态
│   -- normal: 正常
│   -- warning: 即将超时 (剩余 < 25%)
│   -- breached: 已超时
├── breach_counter: INT DEFAULT 0 -- 累计超时次数
│
├── // ===== 协作机制 (P2 新增) =====
├── participants: JSON -- 参与者数组 [{user_id, role, added_at, added_by}]
│   -- 被 @Mention 或主动加入的用户
├── snooze_until: TIMESTAMP -- 贪睡模式截止时间
│
├── // ===== 账户与联系人 =====
├── account_id: INT -- 关联账户 (工单归属)
├── contact_id: INT -- 关联联系人 (具体对接人)
├── dealer_id: INT -- 关联经销商 (经销商也是账户)
├── reporter_name: VARCHAR(255) -- 报告人姓名 (冗余显示)
├── reporter_type: ENUM('customer', 'dealer', 'internal') -- 反馈人类型
├── region: VARCHAR(100) -- 地区
│
├── // ===== 产品信息 =====
├── product_id: INT -- 关联产品 (inquiry 可为空)
├── serial_number: VARCHAR(100) -- 序列号 (inquiry 可为空)
├── firmware_version: VARCHAR(20) -- 固件版本
├── hardware_version: VARCHAR(50) -- 硬件版本/批次
│
├── // ===== 问题分类 =====
├── issue_type: ENUM('production', 'shipping', 'customer_return', 'internal_sample') -- 来源类型
├── issue_category: VARCHAR(100) -- 大类 (稳定性/素材/监看/SSD/音频/兼容性/时码/硬件结构)
├── issue_subcategory: VARCHAR(100) -- 小类
├── severity: ENUM('1', '2', '3') -- 等级
│
├── // ===== 咨询工单特有字段 =====
├── service_type: ENUM('consultation', 'troubleshooting', 'remote_assist', 'complaint') -- 服务类型
├── channel: ENUM('phone', 'email', 'wechat', 'enterprise_wechat') -- 沟通渠道
├── problem_summary: VARCHAR(500) -- 问题摘要
├── communication_log: TEXT -- 沟通记录
│
├── // ===== 问题描述 (MS 填写) =====
├── problem_description: TEXT -- 问题描述
├── solution_for_customer: TEXT -- 解决方案(对客户)
├── is_warranty: BOOLEAN -- 是否在保
│
├── // ===== 维修信息 (OP/DL 填写) =====
├── repair_content: TEXT -- 维修内容
├── problem_analysis: TEXT -- 问题分析
├── resolution: TEXT -- 处理结果/解决方案
│
├── // ===== 内部负责人 =====
├── submitted_by: INT -- 提交人 (MS)
├── assigned_to: INT -- 当前处理人 (OP/DL)
├── created_by: INT -- 创建人
│
├── // ===== 收款信息 =====
├── payment_channel: ENUM('wechat', 'alipay', 'bank_transfer', 'paypal') -- 收款渠道
├── payment_amount: DECIMAL(10,2) -- 收款金额
├── payment_date: DATE -- 收款日期
│
├── // ===== 时间追踪 =====
├── feedback_date: DATE -- 反馈时间
├── ship_date: DATE -- 发货日期 (原始发货)
├── received_date: DATE -- 收货日期 (返修收货)
├── completed_date: DATE -- 完成日期
├── first_response_at: TIMESTAMP -- 首次响应时间
├── first_response_minutes: INT -- 首次响应时长(分钟)
├── waiting_customer_since: TIMESTAMP -- 进入待反馈状态的时间
│
├── // ===== 自动关闭 (inquiry 特有) =====
├── auto_close_reminder_sent: BOOLEAN DEFAULT false -- 是否已发送关闭提醒
├── auto_close_at: TIMESTAMP -- 预计自动关闭时间
│
├── // ===== 工单关联 =====
├── parent_ticket_id: INT -- 父工单ID (inquiry → rma/svc 升级时设置)
├── reopened_from_id: INT -- 重新打开来源工单ID
├── external_link: TEXT -- 外部工单链接
│
├── created_at: TIMESTAMP DEFAULT CURRENT_TIMESTAMP
└── updated_at: TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP

FOREIGN KEY (product_id) REFERENCES products(id)
FOREIGN KEY (account_id) REFERENCES accounts(id)
FOREIGN KEY (contact_id) REFERENCES contacts(id)
FOREIGN KEY (dealer_id) REFERENCES accounts(id)
FOREIGN KEY (submitted_by) REFERENCES users(id)
FOREIGN KEY (assigned_to) REFERENCES users(id)
FOREIGN KEY (created_by) REFERENCES users(id)
FOREIGN KEY (parent_ticket_id) REFERENCES tickets(id)
FOREIGN KEY (reopened_from_id) REFERENCES tickets(id)
```

**SLA 时长矩阵**（单位：工作时间）：

| 优先级 | 首次响应 | 方案输出 | 报价输出 | 工单完结 |
|--------|----------|----------|----------|----------|
| P0     | 2h       | 4h       | 24h      | < 36h    |
| P1     | 8h       | 24h      | 48h      | 3 工作日 |
| P2     | 24h      | 48h      | 5 天     | 7 工作日 |

**状态机节点映射**：

| current_node       | status      | 说明 |
|--------------------|-------------|------|
| draft              | open        | 草稿 |
| in_progress        | in_progress | 处理中 |
| waiting_customer   | waiting     | 等待客户反馈 |
| submitted          | open        | 已提交待审核 |
| ms_review/ge_review| in_progress | MS/GE 审核中 |
| op_*/dl_*          | in_progress | OP/DL 处理中 |
| ms_closing/ge_closing | in_progress | 结案审核 |
| resolved           | resolved    | 已解决 |
| closed             | closed      | 已关闭 |
| auto_closed        | closed      | 自动关闭 |
| cancelled          | cancelled   | 已取消 |

**索引**：
- PRIMARY KEY (id)
- UNIQUE KEY (ticket_number)
- INDEX idx_ticket_type (ticket_type)
- INDEX idx_current_node (current_node)
- INDEX idx_status (status)
- INDEX idx_priority (priority)
- INDEX idx_sla_status (sla_status)
- INDEX idx_product (product_id)
- INDEX idx_account (account_id)
- INDEX idx_contact (contact_id)
- INDEX idx_dealer (dealer_id)
- INDEX idx_serial_number (serial_number)
- INDEX idx_assigned_to (assigned_to)
- INDEX idx_submitted_by (submitted_by)
- INDEX idx_created_at (created_at)
- INDEX idx_parent_ticket (parent_ticket_id)
- INDEX idx_sla_due (sla_due_at)

---

### 2.2 工单活动时间轴 (ticket_activities) [P2 新增]

> **设计说明**：记录工单生命周期内的所有事件，包括状态变更、评论、附件上传、@Mention 等。
> 支持 Commercial View (MS) 和 Technician View (OP/RD) 的分级视图。

```sql
ticket_activities (工单活动时间轴)
├── id: SERIAL PRIMARY KEY
├── ticket_id: INT NOT NULL -- 关联工单
│
├── // 活动类型
├── activity_type: ENUM(
│     'status_change',      -- 状态变更
│     'comment',             -- 评论/备注
│     'internal_note',       -- 内部备注 (Technician View 可见)
│     'attachment',          -- 附件上传
│     'mention',             -- @提及
│     'participant_added',   -- 新增参与者
│     'assignment_change',   -- 指派变更
│     'priority_change',     -- 优先级变更
│     'sla_breach',          -- SLA 超时
│     'field_update',        -- 字段更新
│     'ticket_linked',       -- 工单关联
│     'system_event'         -- 系统事件 (自动关闭等)
│   ) NOT NULL
│
├── // 活动内容
├── content: TEXT -- 活动内容/评论文本
├── content_html: TEXT -- HTML 格式内容 (支持富文本)
├── metadata: JSON -- 活动元数据
│   -- status_change: {from_node, to_node, from_status, to_status}
│   -- mention: {mentioned_users: [{user_id, name}]}
│   -- attachment: {file_id, file_name, file_type, file_size}
│   -- priority_change: {from_priority, to_priority}
│   -- assignment_change: {from_user_id, to_user_id}
│   -- field_update: {field_name, old_value, new_value}
│
├── // 可见性控制
├── visibility: ENUM('all', 'internal', 'technician') DEFAULT 'all'
│   -- all: 所有人可见 (Commercial View)
│   -- internal: 仅内部员工可见
│   -- technician: Technician View (仅 OP/RD 可见)
│
├── // 操作人
├── actor_id: INT -- 操作人 ID (系统事件时为空)
├── actor_name: VARCHAR(255) -- 操作人姓名 (冗余)
├── actor_role: VARCHAR(50) -- 操作人角色 (MS/OP/RD/GE/DL)
│
├── // 系统字段
├── is_edited: BOOLEAN DEFAULT false -- 是否被编辑过
├── edited_at: TIMESTAMP -- 编辑时间
├── created_at: TIMESTAMP DEFAULT CURRENT_TIMESTAMP

FOREIGN KEY (ticket_id) REFERENCES tickets(id) ON DELETE CASCADE
FOREIGN KEY (actor_id) REFERENCES users(id)
```

**视图分级说明**：
- **Commercial View (MS)**：显示 `visibility = 'all'` 的活动，用于与客户/经销商沟通
- **Technician View (OP/RD)**：显示 `visibility IN ('all', 'internal', 'technician')` 的活动，包含技术细节

**索引**：
- PRIMARY KEY (id)
- INDEX idx_ticket (ticket_id)
- INDEX idx_activity_type (activity_type)
- INDEX idx_visibility (visibility)
- INDEX idx_actor (actor_id)
- INDEX idx_created_at (created_at)

---

### 2.3 系统通知 (notifications) [P2 新增]

> **设计说明**：系统内推送通知，参考 macOS 26 通知中心风格。
> 支持 SLA 预警、@Mention、工单状态变更、系统公告等多种通知类型。

```sql
notifications (系统通知)
├── id: SERIAL PRIMARY KEY
├── recipient_id: INT NOT NULL -- 接收人 ID
│
├── // 通知类型
├── notification_type: ENUM(
│     'mention',           -- @提及
│     'assignment',        -- 工单指派
│     'status_change',     -- 工单状态变更
│     'sla_warning',       -- SLA 即将超时预警
│     'sla_breach',        -- SLA 超时
│     'new_comment',       -- 新评论
│     'participant_added', -- 被加入参与者
│     'snooze_expired',    -- 贪睡到期
│     'system_announce'    -- 系统公告
│   ) NOT NULL
│
├── // 通知内容
├── title: VARCHAR(255) NOT NULL -- 通知标题
├── content: TEXT -- 通知内容
├── icon: VARCHAR(50) -- 图标标识 (ticket/warning/info/success)
│
├── // 关联实体
├── related_type: ENUM('ticket', 'system') -- 关联实体类型
├── related_id: INT -- 关联实体 ID (ticket_id 等)
├── action_url: VARCHAR(500) -- 点击跳转 URL
│
├── // 通知元数据
├── metadata: JSON -- 额外信息
│   -- mention: {ticket_number, mentioned_by, activity_id}
│   -- sla_warning: {ticket_number, sla_due_at, remaining_time}
│   -- assignment: {ticket_number, assigned_by}
│
├── // 状态
├── is_read: BOOLEAN DEFAULT false -- 是否已读
├── read_at: TIMESTAMP -- 阅读时间
├── is_archived: BOOLEAN DEFAULT false -- 是否已归档
│
├── // 系统字段
├── created_at: TIMESTAMP DEFAULT CURRENT_TIMESTAMP

FOREIGN KEY (recipient_id) REFERENCES users(id) ON DELETE CASCADE
```

**通知触发规则**：
| 事件 | 接收人 | notification_type |
|------|--------|-------------------|
| @Mention 某用户 | 被提及用户 | mention |
| 工单指派给某人 | 被指派人 | assignment |
| SLA 剩余时间 < 25% | assigned_to + participants | sla_warning |
| SLA 超时 | assigned_to + MS 管理层 | sla_breach |
| 工单状态变更 | participants | status_change |
| 新评论 | 工单相关人 | new_comment |
| 贪睡到期 | snooze 设置者 | snooze_expired |

**索引**：
- PRIMARY KEY (id)
- INDEX idx_recipient (recipient_id)
- INDEX idx_notification_type (notification_type)
- INDEX idx_is_read (is_read)
- INDEX idx_related (related_type, related_id)
- INDEX idx_created_at (created_at)

---

### 2.4 工单附件 (issue_attachments)

> **P2 更新**：简化关联结构，统一关联 tickets 表。

```sql
issue_attachments (工单附件)
├── id: SERIAL PRIMARY KEY
├── ticket_id: INT NOT NULL -- 关联工单 (tickets 统一表)
├── activity_id: INT -- 关联活动 (如果是通过评论上传)
├── file_name: VARCHAR(255) NOT NULL -- 文件名
├── file_path: VARCHAR(500) -- 文件路径
├── file_url: TEXT -- 文件URL
├── file_size: BIGINT -- 文件大小 (bytes)
├── file_type: ENUM('image', 'video', 'document') -- 文件类型
├── mime_type: VARCHAR(100) -- MIME类型
├── uploaded_by: INT -- 上传人
├── created_at: TIMESTAMP DEFAULT CURRENT_TIMESTAMP

FOREIGN KEY (ticket_id) REFERENCES tickets(id) ON DELETE CASCADE
FOREIGN KEY (activity_id) REFERENCES ticket_activities(id)
FOREIGN KEY (uploaded_by) REFERENCES users(id)
```

**索引**：
- PRIMARY KEY (id)
- INDEX idx_ticket (ticket_id)
- INDEX idx_activity (activity_id)
- INDEX idx_uploaded_by (uploaded_by)

---

### 2.5 工单评论 (issue_comments) [已弃用]

> **ℹ️ 迁移说明**：P2 架构中，评论已合并到 `ticket_activities` 表，通过 `activity_type = 'comment'` 或 `'internal_note'` 区分。
> 保留此表定义仅用于历史数据参考和迁移，新开发请使用 `ticket_activities` 表。

```sql
issue_comments (工单评论) [已弃用，请使用 ticket_activities]
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
├── parent_article_id: INT -- 父级文章ID (用于树形聚合)
│
├── // FAQ特有
├── question: TEXT -- 问题 (FAQ类型)
├── external_answer: TEXT -- 外部回答
├── internal_answer: TEXT -- 内部回答
│
├── // 内容与排版
├── summary: VARCHAR(1000) -- 摘要
├── short_summary: VARCHAR(1000) -- 极简摘要 (用于卡片展示)
├── content: TEXT -- 原始内容 (HTML)
├── formatted_content: TEXT -- AI/人工优化后的排版内容
├── format_status: ENUM('none', 'draft', 'published') DEFAULT 'none' -- 排版状态
├── formatted_by: ENUM('ai', 'human', 'external') -- 排版人类型
├── formatted_at: TIMESTAMP -- 排版时间
├── image_layout_meta: JSON -- 图片排版元数据 (如对齐、宽度等)
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
├── source_type: ENUM('Manual', 'PDF', 'DOCX', 'URL', 'Text') DEFAULT 'Manual' -- 数据来源
├── source_reference: VARCHAR(255) -- 原始文件名或引用链接
├── source_url: VARCHAR(500) -- 导入的原始 URL (仅 URL 导入)
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
FOREIGN KEY (parent_article_id) REFERENCES knowledge_articles(id)
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

### 4.7 知识库审计日志 (knowledge_audit_log)

```sql
knowledge_audit_log (审计日志)
├── id: SERIAL PRIMARY KEY
├── operation: TEXT NOT NULL -- 'create', 'update', 'delete', 'import', 'publish_format', 'archive'
├── operation_detail: TEXT -- 详细说明 (如: "发布 Bokeh 格式化内容")
│
├── // 文章快照 (解决文章删除后无法溯源问题)
├── article_id: INTEGER -- 关联的文章ID (SET NULL on delete)
├── article_title: TEXT NOT NULL -- 标题快照
├── article_slug: TEXT -- Slug快照
│
├── // 分类与产品快照
├── category: TEXT
├── product_line: TEXT
├── product_models: JSON
│
├── // 变更记录 (JSON)
├── changes_summary: TEXT -- 具体修改了哪些字段
├── old_status: TEXT
├── new_status: TEXT
│
├── // 导入信息
├── source_type: TEXT -- 'Manual', 'PDF', 'URL', 'DOCX'
├── source_reference: TEXT
├── batch_id: TEXT -- 批量操作 ID
│
├── // 操作人快照
├── user_id: INTEGER NOT NULL
├── user_name: TEXT NOT NULL
├── user_role: TEXT
│
└── created_at: TIMESTAMP DEFAULT CURRENT_TIMESTAMP

FOREIGN KEY (article_id) REFERENCES knowledge_articles(id) ON DELETE SET NULL
FOREIGN KEY (user_id) REFERENCES users(id)
```

**索引**：
- INDEX idx_audit_operation (operation)
- INDEX idx_audit_article (article_id)
- INDEX idx_audit_user (user_id)
- INDEX idx_audit_time (created_at)
- INDEX idx_audit_batch (batch_id)
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

## 13. 文件权限管理

### 13.1 文件权限表 (file_permissions)

> **设计说明**：用于管理用户对特定文件夹的访问权限，支持细粒度授权和临时协作。
> 
> **v0.9.1 优化**：
> - 表名重命名：`permissions` → `file_permissions`（避免与工单权限、知识库权限等混淆）
> - 新增 `path_hash` 字段：MD5 哈希值，用于快速路径查询（O(1) 查找）
> - 新增唯一索引：防止重复授权 `(user_id, folder_path)`
> - 新增过期时间索引：优化过期权限清理性能
> - 新增级联删除触发器：用户删除时自动清理权限记录

```sql
file_permissions (文件权限)
├── id: INTEGER PRIMARY KEY AUTOINCREMENT
├── user_id: INTEGER NOT NULL -- 关联用户 ID
├── folder_path: TEXT NOT NULL -- 文件夹路径（如 "MS/Projects", "OP/Docs"）
├── access_type: ENUM('Read', 'Contribute', 'Full') NOT NULL
│   -- Read: 只读（浏览、预览、下载）
│   -- Contribute: 贡献者（上传、编辑、删除自己上传的文件）
│   -- Full: 完全控制（所有操作，包括删除他人文件、授权）
├── expires_at: DATETIME -- 过期时间（可选，NULL 表示永久有效）
├── path_hash: TEXT -- folder_path 的 MD5 哈希值，用于快速查询
├── created_at: DATETIME DEFAULT CURRENT_TIMESTAMP
│
FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
```

**索引**：
- PRIMARY KEY (id)
- UNIQUE INDEX idx_user_path (user_id, folder_path) - 防止重复授权
- INDEX idx_path_hash (path_hash) - 加速路径哈希查询
- INDEX idx_expires (expires_at) WHERE expires_at IS NOT NULL - 优化过期清理

**触发器**：
```sql
CREATE TRIGGER cascade_delete_file_permissions
AFTER DELETE ON users
BEGIN
    DELETE FROM file_permissions WHERE user_id = OLD.id;
END
```

### 13.2 权限判断逻辑

**优先级顺序**（从高到低）：

1. **Admin 角色** → 自动拥有所有文件权限 ✅
2. **Lead 角色** → 自动拥有整个部门文件夹权限
3. **显式授权**（file_permissions 表）→ 按 `access_type` 判断
4. **个人空间** → `Members/{username}` 自动授权给本人
5. **部门成员** → 默认读取所在部门文件夹
6. **拒绝访问** ❌

**查询优化**：
```sql
-- 优化前：LIKE 模糊查询，无法利用索引
SELECT access_type FROM permissions 
WHERE user_id = ? AND folder_path LIKE 'MS/%'

-- 优化后：使用 path_hash 精确匹配，B-Tree 索引 O(1) 查找
SELECT access_type FROM file_permissions 
WHERE user_id = ? AND path_hash = ?
```

### 13.3 典型使用场景

**场景 1：临时项目协作**
```sql
-- 给 Cathy 临时访问 RD 部门某项目的权限（7 天）
INSERT INTO file_permissions (user_id, folder_path, access_type, expires_at)
VALUES (3, 'RD/ProjectX', 'Contribute', datetime('now', '+7 days'));
```

**场景 2：跨部门审阅**
```sql
-- 让 Sherry 可以查看 OP 部门的所有文件（只读，永久）
INSERT INTO file_permissions (user_id, folder_path, access_type)
VALUES (2, 'OP', 'Read');
```

**场景 3：个人空间共享**
```sql
-- 允许团队成员访问个人工作区
INSERT INTO file_permissions (user_id, folder_path, access_type)
VALUES (11, 'Members/Cathy', 'Read');
```

---

## 14. 更新记录

| 日期 | 版本 | 修改内容 | 修改人 | 备注 |
|-----|------|---------|-------|------|
| 2026-02-03 | v1.0 | 初始版本，从 PRD 中迁移 | - | 完整数据模型设计 |
| 2026-02-06 | v1.1 | 新增 AI 配置与系统管理相关表定义 | - | 对应 PRD v0.9.1 |
| 2026-02-11 | v1.2 | 重构客户模型为“账户 + 联系人”双层架构 | - | 引入 Account/Contact 模型，支持 B2B 场景 |
| 2026-02-11 | v1.3 | 账户类型更新，新增经销商专属字段 | - | CORPORATE→ORGANIZATION，新增 dealer_level 等字段 |
| 2026-02-22 | v1.4 | 新增 `search_synonyms` 同义词库支持 | - | 对应 Wiki 搜索召回优化需求 |
| 2026-02-25 | v1.5 | 完善 `knowledge_articles` 章节字段与 `knowledge_audit_log` 审计日志 | Jihua | 对应 Phase 3/4 深度优化交付 |
| 2026-02-28 | **v0.9.0** | **P2 架构升级**：统一 tickets 表、SLA 引擎、活动时间轴、通知系统 | - | **重大更新** |
| 2026-03-01 | **v0.9.1** | **文件权限优化**：重命名 file_permissions、新增 path_hash、索引优化、级联删除 | - | **性能与安全性提升** |


---

## 附录：表关系图 (P2 架构)

```
Core Entities:
  products
  accounts ←─ contacts
  accounts ←─ account_devices (Installed_Base)
  users

Ticketing System (P2 统一架构):
  tickets (统一工单表, ticket_type: inquiry/rma/svc)
    ├─ ticket_activities (活动时间轴)
    ├─ issue_attachments (附件)
    ├─ repair_exceptions (维修异常)
    └─ logistics_tracking (物流跟踪)
  
  tickets.parent_ticket_id → tickets (工单升级关联)
  tickets.account_id → accounts
  tickets.contact_id → contacts
  tickets.dealer_id → accounts (DEALER)

Notification System (P2 新增):
  notifications → users (recipient_id)
  notifications → tickets (related_id)

Knowledge Base:
  knowledge_articles → knowledge_products
  knowledge_articles → knowledge_tags
  knowledge_articles → troubleshooting_steps
  knowledge_articles → compatibility_entries
  knowledge_articles → knowledge_audit_log
  search_synonyms (搜索优化)

Inventory & Billing:
  accounts (DEALER) → dealer_inventory
  accounts (DEALER) → dealer_inventory_transactions
  accounts (DEALER) → replenishment_requests
  tickets → repair_invoices
  accounts (DEALER) → dealer_settlements

Product Evolution:
  product_bugs ← tickets
  feature_requests ← feature_request_accounts ← accounts
  customer_voices ← tickets

Supporting:
  ai_suggestions
  issue_stats_daily
  issue_stats_monthly
```

### P2 核心变更摘要

1. **工单模型统一**：原 `inquiry_tickets` + `tickets` 合并为单一 `tickets` 表
2. **SLA 引擎**：新增 `priority`, `node_entered_at`, `sla_due_at`, `sla_status`, `breach_counter` 字段
3. **状态机**：`current_node` 字段支持细粒度流程节点
4. **协作机制**：`participants` 数组支持 @Mention 和参与者管理
5. **活动时间轴**：`ticket_activities` 表记录工单全生命周期事件
6. **通知系统**：`notifications` 表支持系统内推送
7. **保修计算**：`account_devices` 表扩展 IoT 和保修计算字段
8. **文件权限优化 (v0.9.1)**：
   - 重命名 `permissions` → `file_permissions`
   - 新增 `path_hash` 字段加速查询
   - 唯一索引防止重复授权
   - 级联删除触发器保证数据一致性

---

**END OF DOCUMENT**
