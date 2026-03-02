# Longhorn Service OS - 核心业务架构设计 (v1.6)  
**版本**: 1.6 (Master Integration)  
**更新**: 整合数据隔离、穿透授权、混合保修、单表多态、代理模式及协作机制。  
**目标**: 构建一个以“责任明确、数据安全、面向未来”为核心的售后服务体系。  
  
# 1. 角色与职责 (Roles & Responsibilities)  

| 缩写 | 全称 | 中文角色 | 核心职责与数据边界 |
| -- | ------------------- | ----- | --------------------------------------------------------------------- |
| MS | Marketing & Service | 市场/客服 | 全知全能 (Global Hub)。

负责客户沟通、报价、收款、物流指令。拥有 CRM、IB、工单的全局读写权限。 |
| OP | Operations | 生产运营 | 受限执行 (Restricted Doer)。

负责收发货、维修、备件。对 CRM/IB 默认不可见，仅通过工单获得“穿透式”技术视图。 |
| RD | R&D | 研发 | 受限专家 (Restricted Expert)。

不持有工单，仅通过 @ 协作提供技术建议。对 CRM/IB 默认不可见。 |
| GE | Finance | 财务 | 资金监管 (Gatekeeper)。

负责确认收款、库存审计。 |
| DL | Dealer | 经销商 | 外部伙伴 (Partner)。

Phase 1 由 MS 代理录入；Phase 2 自行登录。仅见私有数据。 |
  
  
# 2. 数据安全与权限架构 (Security & Permission Model)  
本章节定义系统的**静态访问规则**与**动态穿透逻辑**。  
**2.1 核心原则：隔离与穿透 (Isolation & Passthrough)**  
* **数据隔离 (Data Silo)**:  
    * **OP/RD (生产/研发)**: 默认**无权访问** CRM（客户/经销商列表）及 IB（全量资产库）。  
    * **MS (市场)**: 拥有全局读写权限。  
* **按需穿透 (Just-in-Time Access)**:  
    * **逻辑**: 权限跟随工单流动。OP/RD 只有在成为某工单的 Assignee (负责人) 或 Participant (参与者) 时，系统才临时发放该工单关联资产 (Asset) 的**只读令牌**。  
    * **范围**: 仅限当前工单关联的那**唯一一条**资产数据，不可横向遍历其他资产。  
**2.2 视图分级 (View Scoping)**  
即使用户获得了访问权限，系统也会根据角色返回不同的数据视图 (DTO)：  
* **MS 商业视图 (Commercial View)**:  
    * 可见字段: 完整的 IB 信息，包含 Sold To (销售对象)、Original Order (合同号)、Invoice Date (开票日) 及价格信息。  
* **OP 技术视图 (Technician View/DTO)**:  
    * 可见字段: **脱敏的技术信息**。包含 Serial Number, Firmware, Production Date, Repair History (过往维修履历)。  
    * **隐藏字段**: 自动屏蔽所有商业敏感字段（价格、客户联系方式、经销商渠道）。  
  
# 3. 核心机制：协作与时间轴 (Collaboration & Timeline)  
本章节定义**触发上述权限变更的用户交互流程**。工单被定义为动态的“会话容器”。  
**3.1 提及即邀请 (Mention = Invite)**  
@Mention 是驱动权限授予的核心交互，无需专门的“邀请按钮”。  
* **前端交互**: 用户在评论框输入 @RD_Li 并发送。  
* **后端逻辑 (Backend Hook)**:  
    1. **自动订阅**: 检测到 @ 符号，校验被提及用户是否已在 tickets.participants 数组中。若不在，自动追加。  
    2. **权限授予**: RD_Li 立即获得该工单（及关联资产技术视图）的 **受邀可见 (Guest View)** 权限。  
    3. **通知触发**: 向 RD_Li 发送高优先级通知（Inbox 红点 + 弹窗）。  
**3.2 侧边栏成员管理 (Sidebar Management)**  
作为 @Mention 的补充，支持手动管理协作列表。  
* **静默邀请 (Silent Invite)**:  
    * **场景**: 需要主管关注工单，但无需在时间轴发言打扰。  
    * **动作**: 点击侧边栏 Participants 旁的 [ + ] 按钮 -> 选择用户。  
    * **效果**: 用户加入列表并获得权限，但仅收到低优先级通知（无强弹窗）。  
* **退出协作 (Leave)**:  
    * **场景**: 研发协助排查完毕，不想再被后续的客服琐碎对话打扰。  
    * **动作**: 用户点击侧边栏自己头像旁的 [ x ] 按钮。  
    * **效果**: 将自己从 participants 移除，丧失工单访问权限，不再接收后续通知（除非再次被 @）。  
  
  
# 4. 核心数据模型 (Core Data Schemas)  
  
**4.1 工单 (Ticket) - 单表多态 + 审批挂载**  
三种工单采用同样一个表结构。  
  
```
{
  "entity": "Ticket",
  "table": "tickets",
  "fields": {
    // ==========================================
    // 1. 公共基座 (Common)
    // ==========================================
    "id": "uuid",
    "ticket_number": "String", // K-2603-001, RMA-C-..., SVC-D-...
    "type": "Enum",            // INQUIRY, RMA, SVC
    "status": "String",        // 统一状态机 (New, Processing, Repairing...)
    "current_node": "Enum",    // MARKET, OPS, DEALER, FINANCE (球在哪个半场)
    "assignee_id": "uuid",     // 具体持球人 (NULL = 部门池待领)
    "participants": ["uuid"],  // 协作白名单 (被@的人)
    "priority": "Enum",        // P0_CRITICAL (紧急/R1), P1_HIGH (优先/R2), P2_NORMAL (标准/R3)
                               // 默认值继承自 Customer.service_tier，可人工修改

    "snooze_until": "Timestamp", // 挂起结束时间 (挂起期间 SLA 倒计时暂停)

    // [NEW] 2. SLA 动态引擎 (SLA Engine)
    // 核心计时锚点：用于计算当前节点已停留时长
    "node_entered_at": "Timestamp", // 进入当前 status 的时间点
                                    // 逻辑: 每次 status 变更为新节点时，自动更新为 NOW()

    // 截止时间：后端根据矩阵计算出的绝对死线
    "sla_due_at": "Timestamp",      // 预计超时的时刻
                                    // 逻辑: node_entered_at + Matrix_Duration[priority][status]

    // 实时状态快照：用于前端红绿灯渲染 (无需前端重复计算)
    "sla_status": "Enum",           // OK (正常), 
                                    // WARNING (剩余时间 < 20%), 
                                    // BREACHED (已超时/爆红), 
                                    // PAUSED (挂起中)

    // 考核统计：KPI 扣分依据
    "breach_counter": "Integer",    // 该工单历史累计超时次数 (节点切换时若已超时则 +1)


    // ==========================================
    // 3. 客户上下文 (Context)
    // ==========================================
    "account_id": "uuid",      // 必填。客户主体
    "contact_id": "uuid",      // 必填。实际沟通人
    "asset_id": "uuid",        // 关联 IB (RMA/SVC 必填且唯一; Inquiry 可空)
    

    // ==========================================
    // 4. 内容与诊断 (Content)
    // ==========================================
    "subject": "String",
    "description": "Text",
    "diagnosis_summary": "Text",
    "solution_type": "Enum",   // SW_UPDATE, REPLACE_PART, SWAP_UNIT...

    // ==========================================
    // 5. 审批风控 (Approvals)
    // ==========================================
    "approval_status": "Enum", // NONE, PENDING, APPROVED, REJECTED
                               // 用于 Dashboard "待审批" 卡片计数
    "approval_type": "Enum",   // WAIVER (免单), REFUND (退款), SPECIAL_PART
    "approval_payload": {      // JSON: 记录请求详情
      "requester_id": "user_effy",
      "reason": "VIP Client",
      "original_amount": 800.00,
      "requested_amount": 0.00
    },
    "approved_by": "uuid",     // 最终审批人
    "approved_at": "Timestamp",

    // ==========================================
    // 6. 扩展字段 & SVC专用 (Extended)
    // ==========================================
    "is_warranty": "Boolean",
    "quote_amount": "Decimal",
    "shipping_address_snapshot": "JSON",
    
    // 代理/经销商模式专用
    "dealer_id": "uuid",       // 归属经销商 (权限隔离关键字段)
    "proxy_mode": "Boolean",   // 是否由 MS 代填
    "reporter_name": "String", // 经销商侧技师 (e.g., "Mike @ ProAV")
    "related_so_id": "uuid"    // 关联补货单 (Tier 2)
  }
}

```
  
**4.2 活动时间轴 (Ticket Activities) **  
  
JSON  
```


```
```
{
  "entity": "TicketActivity",
  "table": "ticket_activities",
  "fields": {
    "ticket_id": "uuid",
    "actor_id": "uuid",
    "activity_type": "Enum",   // 决定了 metadata 的结构
                               // PRIORITY_CHANGE, APPROVAL_DECISION, STATUS_CHANGE
    
    "content": "Text",         
    "attachments": ["URL"],
    "mentions": ["uuid"],
    
    // ==========================================
    // [MODIFIED] 审计元数据 (Polymorphic JSON)
    // ==========================================
    "metadata": {              // JSON: 根据 activity_type 存储不同结构
      
      // --- 变体 A: 优先级/SLA 变更 (用于 SLA_BREACH, PRIORITY_CHANGE) ---
      // 前端渲染: 红色/黄色 警告条
      "field_changed": "priority",
      "old_value": "P2_NORMAL",
      "new_value": "P0_CRITICAL",
      "reason": "Manager Escalation",

      // --- 变体 B: 审批结果 (用于 APPROVAL_DECISION) ---
      // 前端渲染: 价格划线 (<s>$800</s> -> $0)
      // "field_changed": "quote_amount",
      // "old_value": 800.00,
      // "new_value": 0.00,
      // "sub_type": "APPROVED",    // APPROVED, REJECTED
      // "requester_id": "user_effy"

      // --- 变体 C: 状态流转 (用于 SYSTEM_LOG) ---
      // 前端渲染: 简单的箭头流程 (Inquiry -> RMA)
      // "field_changed": "status",
      // "old_value": "Pending Arrival",
      // "new_value": "Diagnosing"
    }
  }
}

```
  
**4.3 存量资产 (Installed Base)**  
支持非联网设备 (Offline) 与未来 IoT 设备。  
JSON  
  
```
{
  "entity": "Installed_Base",
  "description": "单台设备的数字生命周期档案 (兼容 IoT 与 非IoT 设备)",
  "fields": {
    // ==========================================
    // 1. 物理身份 (Physical Identity)
    // ==========================================
    "id": "ib_uuid_v4",
    "serial_number": "KD8K-2501-0099",
    "product_sku": "K2-8K-BODY",
    "product_type": "CAMERA",
    "production_date": "2025-12-01",

    // ==========================================
    // 2. 联网状态 (IoT Status - Future Proof)
    // ==========================================
    "is_iot_device": false,          // 标记该型号是否支持联网
    "is_activated": false,           // 是否已联网激活
    "activation_date": null,         // [关键] 联网激活时间 (IoT 设备的保修金标准)
    "last_connected_at": null,       // 最后一次心跳时间 (用于防丢/远程诊断)
    "firmware_version": "7.0",       // 如果联网，自动上报；如果不联网，由维修录入
    "ip_address": null,              // 预留

    // ==========================================
    // 3. 销售溯源 (Sales Trace)
    // ==========================================
    "sales_channel": "DEALER",       
    "original_order_id": "SO-2025-005",
    "sold_to_dealer_id": "dlr_proav",
    "ship_to_dealer_date": "2026-01-10", // 发货给经销商的日期 (基准锚点)

    // ==========================================
    // 4. 终端归属 (Ownership)
    // ==========================================
    "current_owner_id": "acct_netflix",
    
    // [关键] 人工凭证字段 (当 IoT 未激活时使用)
    "registration_date": "2026-02-20",  // 用户在官网手动注册的日期
    "sales_invoice_date": "2026-02-15", // 用户上传的发票日期 (人工核验后填入)
    "sales_invoice_proof": "url_to_pdf",// 发票凭证文件

    // ==========================================
    // 5. 保修计算结果 (Computed Result)
    // ==========================================
    "warranty_source": "DEALER_FALLBACK", // Enum: IOT_ACTIVATION, INVOICE_PROOF, DIRECT_SHIPMENT, DEALER_FALLBACK
                                          // 用于追踪保修期是按哪个标准算的
    "warranty_start_date": "2026-04-10",  // 最终计算出的起始日
    "warranty_months": 24,
    "warranty_end_date": "2028-04-10",
    "warranty_status": "ACTIVE"
  }
}

```
  
  
# 5. 业务流程逻辑 (BPM Workflows)  
**5.1 咨询工单 (Inquiry Ticket) - 沟通中心**  
* **责任方**: **MS** (始终持有)。  
* **协作**: MS 遇到技术难题，在时间轴 @RD 或 @OP。RD/OP 在 Workbench 的 "Mentioned" 列表中看到此单，进入回复。  
* **转化**: 点击 [ Convert ] 生成 RMA/SVC。  
**5.2 RMA 返厂单 (RMA Ticket) - 乒乓协作模型**  
* **责任方**: **MS** 与 **OP** 交替持有。  
* **关键节点**:  
  
**核心逻辑**：OP 负责修机器，MS 负责搞定人（钱、地址、审批）。**审批未通过前，严禁维修。**  

| 阶段 | 状态 (Status) | 当前持球人 (Assignee) | 关键动作 & 逻辑分支 |
| ----- | --------------- | ---------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1. 收货 | Pending Arrival | OP (物流) | 签收快递，拍照入库。 |
| 2. 诊断 | Diagnosing | OP (技师) | 检测故障，填写诊断报告。

➡️ 动作: [ 提交诊断 ] (球传给 MS) |
| 3. 商务 | Commercial | MS (客服) | 此处存在分支逻辑：


A. 常规流程 (Standard):

1. 生成报价 (PI) $\\rightarrow$ 客户付款 $\\rightarrow$ 财务确认。

2. ➡️ 动作: [ 批准维修 ] (球传回 OP)。


B. 豁免/退款流程 (Exception with Approval):

1. MS 修改金额为 0 (或发起退款)。

2. 系统拦截: 检测到风险，状态变为 Pending Approval，锁定 [ 批准维修 ] 按钮。

3. MG (主管) 介入: Dashboard 收到通知 $\\rightarrow$ 查看理由 $\\rightarrow$ 点击 [ 批准 ]。

4. 系统解锁: 状态恢复为 Commercial，金额更新生效。

5. ➡️ 动作: [ 批准维修 ] (球传回 OP)。 |
| 4. 维修 | Repairing | OP (技师) | 领料，维修，老化测试。

➡️ 动作: [ 维修完成 ] (球传回 MS) |
| 5. 确认 | Pending Ship | MS (客服) | 安全阀。确认收货地址、关务文件、客户假期。

➡️ 动作: [ 释放发货 ] (球传给 OP) |
| 6. 发货 | Shipped | OP (物流) | 打印面单，发货结案。 |
  
  
  
**5.3 SVC 经销商维修 (代理模式 Phase 1)**  
**核心逻辑**：MS 作为“接口”，OP/RD 作为幕后支持。  
1. **接单 (MS)**: 收到邮件 -> 创建 Ticket (类型 SVC, 勾选 Proxy)。  
2. **协作 (MS)**: 上传波形图 -> 在 Timeline @RD 求助 -> RD 回复建议 -> MS 转达 Dealer。  
3. **备件 (MS)**:  
    * **Tier 1**: 添加备件 -> 扣减经销商虚拟库存。  
    * **Tier 2**: 添加备件 -> 系统生成关联销售单 (SO) -> 待付款发货 -> 恢复流程。  
4. **结案 (MS)**: 维修完成 -> 触发结算/库存实扣。  
(暂时不处理SVC)  
  
**5.4 经销商咨询场景 (Dealer Inquiries)**  
通过 account_id 和 description 区分三种场景：  
1. **自用咨询**: account_id = Dealer, asset_id = Demo机。  
2. **代潜在客户**: account_id = Dealer, description = "End User: Nolan..."。  
3. **代老客户**: account_id = EndUser (Netflix), contact_id = Dealer (Mike)。  
#   
**5.5  保修计算引擎 (Warranty Engine)**  
系统采用 **“瀑布流 (Waterfall)”** 逻辑计算保修期：  
1. **优先级 1 (IoT)**: 若 activation_date 存在，以此为准。  
2. **优先级 2 (人工)**: 若 sales_invoice_date 存在 (有发票)，以此为准。  
3. **优先级 3 (注册)**: 若 registration_date 存在，以此为准。  
4. **优先级 4 (直销)**: 若 sales_channel == DIRECT，按 ship_date + 7天。  
5. **优先级 5 (兜底)**: 若均为 NULL，按 ship_to_dealer_date + 90天。  
  
**5.6 SLA 计算逻辑**  
1. **初始化 (Inheritance)**:  
    * 创建工单时，Ticket.priority 默认等于 Customer.service_tier 对应的等级。  
2. **计时重置 (Reset Timer)**:  
    * 当 Ticket.status 发生变更（例如从 Pending Arrival -> Diagnosing）：  
    * 系统必须将 node_entered_at 更新为 NOW()。  
    * 系统必须根据 SLA Matrix 重新计算 sla_due_at。  
3. **动态变更 (Recalculation)**:  
    * 如果 Manager 手动修改 Ticket.priority：  
    * node_entered_at **保持不变** (不重置)。  
    * sla_due_at 根据新的优先级时长重新计算。  
    * *判定*：如果 NOW() > 新的 sla_due_at，立即将 sla_status 设为 BREACHED 并触发报警。  
  
  
# 6. 前端与交互规范 (Frontend & UI Specifications)  
**6.1 核心设计哲学**  
1. **Role-First (角色优先)**：不同角色登录看到的是完全不同的界面结构，而非同一界面的不同权限。  
2. **Action-Oriented (行动导向)**：UI 必须直接提示“下一步做什么”，而非仅仅展示“现在是什么”。  
3. **Separation of Concerns (职能分离)**：对于管理岗，强制分离“管人（Management）”与“做事（Execution）”的界面入口。  
  
**6.2 导航架构 (Navigation Architecture)**  
### 5.2 导航架构 (Navigation Architecture)
侧边栏采用 **“动态分段 (Dynamic Sections)”** 结构。

| 分组标题 (Section) | 菜单项 (Menu Item) | 图标 | 可见角色 | 交互/红点逻辑 (Badge Logic) |
| --- | --- | --- | --- | --- |
| MANAGEMENT(管理指挥塔) | 📊 Team Overview(Manager 默认首页) | Chart | ManagerExec | 红点：当有待审批 (Pending Approval) 或 SLA 预警时亮起。这是经理的“早报”和“控制台”。 |
| WORKSPACE(个人执行区) | 🔴 My Tasks(员工 默认首页) | Checkbox | All | 红底数字 (如 3)。表示阻断性任务，必须清零。即使是经理，作为 Player 也要处理这里的任务。 |
|  | 🔔 Mentioned | Bell | All | 蓝底数字 (如 5)。表示协作请求。 |
|  | 📥 Team Queue | Inbox | All | 灰底数字。部门公共池。 |
| OPERATIONS(业务查询) | 📂 All Tickets | Folder | All | 包含 Inquiry, RMA, SVC 的全量历史检索入口。支持全局搜索 (Cmd+K)。 |
| KNOWLEDGE | 📖 Tech Hub | Book | All | 知识库。支持侧滑调用。 |
| ARCHIVES(静态档案) | 🏢 渠道 (Dealers) | Building | MS, Mgr, Exec | (OP/RD 隐藏) 静态档案查询。 |
|  | 👥 客户 (Customers) | Users | MS, Mgr, Exec | (OP/RD 隐藏) 静态档案查询。 |
|  | 📦 资产 (Assets) | Box | MS, Mgr, Exec | (OP/RD 隐藏) 静态档案查询。 |
|  | 🛠️ 配件 (Parts) | Tool | All | 库存与BOM查询。 |



**6.3 核心界面设计 (Core Views)**  
**A. Overview (管理仪表盘)**  
**适用角色**：Lead / Exec  
**定位**：登录后的第一站。先看全局，再干细活。  
1. **Action Zone (决策区 - 顶部)**  
    * **待审批卡片 (Approvals)**：显示数字 3。点击弹出批量审批模态框 (Modal)，快速处理报价/退款。  
    * **风险卡片 (Risks)**：显示数字 2 (SLA Warning)。点击展开列表，允许直接 **@Assignee** 进行催办。  
2. **Team Health (团队健康度 - 中部)**  
    * **负载看板 (Load Balance)**：横向柱状图。  
        * 🟢 OP_Wang: 5 Active  
        * 🔴 OP_Li: 12 Active (Overloaded)  
    * **交互**：点击 OP_Li 的柱子 -> 弹出他的任务列表 -> 勾选任务 -> 点击 **[ ➡️ 改派 (Re-assign) ]** 给 OP_Wang。  
3. **Trend (趋势 - 底部)**  
    * 简单的折线图：本周进件 vs 出件。  
  
**B. The Workspace (个人执行台)**  
**适用角色**：All (员工的主战场，主管的副战场)  
**定位**：处理具体工单的地方。  
  
1. **My Tasks (需我处理) **  
* **数据源**：Assignee == Me AND Status != Closed  
* **工具栏 (Toolbar)**：  
    * **[ ⭐ Star / Focus ]**：允许员工标记“今日关注”。（私有标记，不影响系统 SLA）  
    * **[ 💤 Snooze ]**：允许员工将暂时无法处理的工单挂起。  
* **混合排序逻辑 (The Hybrid Sort)**：  
    1. **🔥 Critical / Breached** (P0 或已超时)：**强制置顶**，不可隐藏，不可 Snooze。  
    2. **⭐ Starred** (员工加星)：按加星时间排序。  
    3. **🕒 Remaining** (普通任务)：按 SLA 剩余时间倒序排列。  
* **列表交互**：  
    * **左滑 (Swipe Left) / 右键菜单**：显示 **[ 💤 Snooze ]** 选项 -> 选择“明天提醒” -> 工单暂时从列表消失。  
    * **点击星号**：将工单提权至第二梯队。  

以下是单张卡片的标准字段布局（从左到右）：  


| 区域 | 字段/元素 | 视觉样式 (Style) | 数据源 (Source) |
| --- | --- | --- | --- |
| 左侧栏 | Star/Lock | Icon🔥 (P0/超时)⭐ (已关注)☆ (普通 - Hover可见) | is_critical OR priority==P0 ? Lock : is_starred |
|  | ID | RMA-001 (灰色微缩字体) | ticket_number |
| 主内容 | 标题行 | [P1] 镜头卡口松动Subtitle: Kinefinity VIP User (VIP) | priority + subjectcustomer.name + service_tier |
|  | 状态行 | 🔵 待诊断 · OP_Wang | status · assignee_id |
| 右侧栏 | SLA 计时器 | - 2h (红底) / 4h (黄字) / 2d (绿字) | sla_due_at - NOW() |
| 隐藏动作(Hover/Swipe) | Snooze | [ 💤 ] (仅对非 P0 可用) | 交互动作 |


  
2. **Mentioned (协作)**  
    * **过滤逻辑**：Participants contains Me AND Unread  
    * **卡片字段**：Ticket ID | 标题 | **[ 💬 RD_Li: "请确认..." ]**  
3. **Team Queue (部门池)**  
    * **交互**：列表右侧显示 **[ ✋ 认领 (Pick Up) ]** 按钮。  
  
**C. Detail View (工单详情页)**  
**适用角色**：All  
1. **Sidecar Tech Hub (侧滑知识库)**  
    * 点击右上角 **[ 📖 ]** 按钮，右侧滑出 30% 宽度的抽屉。  
    * 允许搜索文档，并拖拽链接到评论区。  
2. **Contextual Popover (场景化信息卡)**  
    * **权限控制**：  
        * **MS/Mgr**：客户名为蓝色链接 -> 跳转完整档案。  
        * **OP/RD**：客户名为黑色文本 -> 仅显示收货地址 (脱敏)。  
    * **资产历史**：仅显示当前 SN 的过往维修记录，不显示客户名下其他资产。  
  
**6.4 管理员与测试规范 (Admin & Debugging)**  
为了验证复杂的 RBAC 逻辑，Admin 界面需包含专门的测试工具。  
**A. "View As" (替身/预览模式)**  
**入口**：全局顶部导航栏 (Global Header) 右侧 -> **[ 👁️ 预览视角 ]** 下拉菜单。  
**功能**：允许 Admin 在不登出账号的情况下，以特定用户身份渲染界面。  
* **交互流程**：  
    1. 选择 Role: OP -> User: OP_Wang。  
    2. 页面刷新，加载 OP_Wang 的侧边栏和 Workbench。  
    3. **顶部横幅 (Persistent Banner)**：显示亮黄色警告条：⚠️ **正在以 [ OP_Wang ] 身份浏览。所有操作将记录为该用户。** [ 退出预览 ]  
    4. **验证点**：确认看不到 Team Overview，看不到 客户档案 菜单。  
**B. Debug Overlay (X光模式)**  
**入口**：Admin 设置 -> 开启 **[ 🐞 UI Debug Mode ]**。  
**功能**：在界面元素上覆盖显示权限代码，用于开发自测。  
* **表现**：  
    * 在 审批 按钮旁显示微型标签：[Permission: TICKET_APPROVE]。  
    * 在 客户电话 字段旁显示：[Mask: OP_VIEW]。  
