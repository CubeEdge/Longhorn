# Longhorn Service OS - 核心业务架构设计 (v1.7)  
**版本**: 1.9 (macOS 26 Modal UI & Device Ledger)  
**更新**: 设备台账添加/编辑改为macOS 26居中弹窗(560px)、清除双语标签、极简时间轴布局、核心字段高亮。  
**更新**: 2026-03-13 - 调整产品/配件菜单权限策略：产品目录、产品SKU、设备台账、配件目录对所有内部人员可见；客户/经销商/配件运营保持MS部门专属，非MS部门通过工单JIT穿透访问。  
**更新**: 2026-03-13 - 新增 §5.5.2 SN 状态驱动的入库与保修注册一体化，定义四种场景矩阵（A/B/C/D）及差异化处理流程。  
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
* **工单可见性分级 (Ticket Visibility by Type)**:  
    * **RMA 返厂工单**: OP/RD **自由可见**。OP 是 RMA 流程的核心参与方（§5.2 乒乓协作模型），需要在 My Tasks / Team Queue 中查看和领取 RMA 工单。侧边栏菜单对 OP/RD **可见**。  
    * **Inquiry 咨询工单**: OP/RD **仅 JIT 可见**。MS 始终持有（§5.1），OP/RD 仅通过 @Mention 进入。侧边栏菜单入口对 OP/RD **隐藏**，通过 Mentioned 列表访问。  
    * **SVC 经销商维修**: OP/RD **仅 JIT 可见**。MS 作为接口（§5.3），OP/RD 仅作为幕后支持。侧边栏菜单入口对 OP/RD **隐藏**，通过 Mentioned 列表访问。  
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
 
    // [NEW v1.7] 来源通道：决定信息完整度预期
    "channel": "Enum",         // PHONE (需补录), EMAIL/PORTAL (相对完整), AI_OCR (待清洗)

    // [NEW] 2. SLA 动态引擎 (SLA Engine)
    "priority": "Enum",        // P0_CRITICAL (紧急/R1), P1_HIGH (优先/R2), P2_NORMAL (标准/R3)
                               // 默认值继承自 Customer.service_tier，可人工修改
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

    "snooze_until": "Timestamp", // 挂起结束时间 (挂起期间 SLA 倒计时暂停)


    // ==========================================
    // 3. 客户上下文 (Context) - 核心修改区 v1.7
    // ==========================================
    
    // [变更] 改为可空。为空代表 "散客" 或 "待清洗线索"
    "account_id": "uuid",      // Nullable. 指向 Company/Organization
        // [变更] 改为可空。
    "contact_id": "uuid",      // Nullable. 指向 contacts 表的正式 ID
        // [新增] 临时联系人快照 (关键字段)
    // 无论是 AI 抓取的邮件签名，还是电话里听写的名字，都先存这里
    // 格式：{ "name": "Smith", "phone": "138...", "email": "...", "role": "DIT", "source": "phone_input" }
    "reporter_snapshot": "JSON", 

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
    "related_so_id": "uuid",    // 关联补货单 (Tier 2)

    // ==========================================
    // 7. 审计与删除 (Audit & Deletion) - [NEW v1.7]
    // ==========================================
    "is_deleted": "Boolean",   // 默认 0. 墓碑化删除标记
    "deleted_at": "Timestamp",
    "deleted_by": "uuid",
    "delete_reason": "String"
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
    "sku_id": "uuid",                // [NEW v2.0] 关联具体 SKU
    "grade": "Enum",                 // [NEW v2.0] 品质等级: A (全新), B (官翻), C (维修级)
    "specification": "String",       // [NEW v2.0] 规格描述 (如: 深空灰, E卡口版)
    "product_sku": "K2-8K-BODY",     // 冗余 SKU 编码
    "product_type": "CAMERA",
    "production_date": "2025-12-01",
    "warehouse": "String",           // [NEW v2.0] 物理位置/仓库
    "entry_channel": "Enum",         // [NEW v2.0] 入库渠道 (FACTORY, RETURN, TRADE_IN)

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
**5.1 咨询工单 (Inquiry Ticket) - 沟通中心 (v3 升级)**  
* **责任方**: **MS** (始终持有单一对接人)。  
* **协作**: MS 遇到技术难题，在时间轴 @RD 或 @OP。RD/OP 在 "Mentioned" 列表中进入。  

**5.1.1 节点与状态流转 (Nodes & Lifecycle)**
取消独立的 Status 与 Node 差异，实现 1:1 映射。工单创建即进入流转，由底层状态机驱动：

| 节点/状态 ID | UI 显示名称 | 归属/动作 | 描述 |
| :--- | :--- | :--- | :--- |
| `handling` | **处理中** | MS 对接人 | 初始节点。MS 作为传声筒与客户沟通，内部协作均在此触发。 |
| `awaiting_customer` | **等待客户** | MS 对接人 | 点击 **[发送回复并等待]** 驱动。会触发自动结案倒计时（SLA机制）。 |
| `resolved` | **已解决** | MS 对接人 | 客户问题已解决，客服手动标记。 |
| `closed` | **已结案** | 系统/人工 | 流程终止状态。 |
| `auto_closed` | **超时关闭** | 系统自动 | 客户长期未回复触发。 |
| `converted` | **已升级** | MS 对接人 | 升级为 RMA/SVC 后触发。 |

**5.1.2 核心交互与“传声筒”逻辑 (Megaphone Logic)**
*   **正式回复 vs 评论**: 系统通过 `activity_type: reply` 录入正式对客回复。在时间轴上，正式回复与客户反馈呈现为 **Kine Yellow 圆环图标**（同 RMA 标准），方便快速扫描。
*   **代录反馈 (Megaphone)**: 在 `awaiting_customer` 节点，客服通过其它渠道接到客户反馈时，点击主 Action 按钮 -> 触发“代录反馈”。
    *   **支持附件**: 允许代录时上传图片/文档等凭证。
    *   **状态切换**: 提交代录后，节点由 `awaiting_customer` 强制回滚至 `handling`。
*   **重新激活 (Manual Reopen)**: 工单处于终结节点时，右上角“更多”菜单为 对接人/MS Lead 开放重启入口。内嵌 5s 强制安全悬窗及必答理由。

**5.1.3 时效与 SLA 配置 (Inquiry SLA)**
*   **自动预计算**: 客服在进行正式回复时，底部 SLA 控制板会自动预计算默认 **5 个工作日** 后的结案日期。
*   **节点时限 (SLA Timer)**: 引入节点处理超时时限（默认为 24 小时），允许对客会话微调或弹性延期。
*   **转交降级**: 工单在通过 `ParticipantsSidebar` 触发转交（仅限 MS 部门）时，**系统会自动降级原对接人**为普通协作者（Mentioned），恪守单一对接人制。
**5.2 RMA 返厂单 (RMA Ticket) - 乒乓协作模型**  
* **责任方**: **MS** 与 **OP** 交替持有。  
* **关键节点**:  
  
**核心逻辑**：OP 负责修机器，MS 负责搞定人（钱、地址、审批）。**审批未通过前，严禁维修。**  

**5.2.1 可视化协作提示 (Visual Collaboration Cues)**  
为了强化“乒乓球”协作模型，系统在工单详情页顶部提供动态进度条及球权提示：
*   **蓝脉冲 (Pulse View)**：当前环节的节点圆圈呈现蓝色呼吸灯效果，视觉化强调“球目前在谁手里”。
*   **中性微光气泡 (Portal Tooltip)**：
    *   **触发方式**：Hover 活跃节点。
    *   **技术实现**：使用 **React Portal** 渲染至 body 顶层，彻底解决 `overflow` 容器造成的 UI 裁剪问题。
    *   **视觉风格**：中性半透明毛玻璃边框 (Neutral Glass Glow)，蓝色标题。
    *   **内容提示**：显示当前球权所属角色、具体负责人姓名（若已认领），以及基于当前状态的“行动建议”。
*   **权限卫兵**：配合 `View As` 预览模式，系统根据“实际操作人 (Acting User)”身份动态限制【编辑】与【删除】按钮的可见性，确保角色切换时的真实权限模拟。


| 界面显示阶段 | 核心任务 | 后端节点名 (`current_node`) | 归属部门 | 关键动作 & 强制信息要求 |
| :--- | :--- | :--- | :--- | :--- |
| **0. 提交** | 工单发起 | `submitted` | **MS** | [ 提交工单 ] ➔ **逻辑**: RMA单提交后立即转入 `op_receiving`。 |
| **1. 待收货** | 物流签收/拆箱 | **`op_receiving`** | **OP** (物流) | [ 确认收货 ] ➡️ **建议**: 附件(开箱照)。若 SN 不符须更正。 |
| **2. 诊断** | 判定故障/方案 | `op_diagnosing` | **OP** (技师) | [ 提交诊断 ] ➡️ **必填**: 故障分析、初步方案、备件需求、**技术损坏判定**。 |
| **3. 商务审核** | 客户确认/报价 | `ms_review` | **MS** (客服) | [ 批准维修 ] ➡️ **系统**: 自动调用保修计算引擎，综合设备数据与OP技术判定，生成保修状态与预估费用。**必填**: 客户确认方式（邮件/PI预览/电话截图）。 |
| **4. 维修中** | 物理维修/更换 | `op_repairing` | **OP** (技师) | [ 维修完成 ] ➡️ **必填**: **具体维修内容详述**、老化测试结论。 |
| **5. 结算审核** | 对账/释放发货 | `ms_closing` | **MS** (客服) | [ 最终确认 ] ➡️ **逻辑**: 若过保付费需转交财务，若保内免费则直转物流。 |
| **5.5 财务确认** | 核实体外流水 | `ge_review` | **GE** (财务) | [ 确认收款结转 ] ➡️ **必填**: 实际收款金额、收款日期、渠道。转回 MS_Closing。 |
| **6. 已发货** | 打单发货 | `op_shipping` | **OP** (物流) | [ 发货结案 ] ➡️ **必填**: **物流公司、快递单号** |

**5.2.2 节点分发与指派逻辑 (Assignment & Dispatching)**  
为确保工单在跨部门流转时责任清晰，系统实施严格的分发策略：
1. **防外泄拦截 (Cross-Department Clearance)**: 当工单流向受控部门（如 `OP`, `MS`, `GE`）时，若当前负责人非目标部门成员，系统强制将 `assigned_to` 清空 (`NULL`)，防止“A部门节点显示B部门负责人”的越权乱象。
2. **三段式自动分发 (Auto-Dispatch)**:
   - **阶段一 (精确规则匹配)**: 后台优先检查目标部门是否配置了该节点的精确绑定（如“`op_repairing` 绑定 Zhang”）。
   - **阶段二 (默认网捕)**: 若无精确规则但该部门启用了默认全科室分发，则分配给默认负责人（如“OP 默认指派李工”）。
   - **阶段三 (部门公海池)**: 若均未命中（或本部门未启用自动分配），则将 `assigned_to` 落为空 (`NULL`)，工单进入该部门的公海池，处于“🚩待认领”状态。
3. **同部门分流原则**: 用户在手动点击“修改指派人”时，下拉列表将严格屏蔽无关人员，仅呈现当前节点所属部门的成员，确保派单的准确性。
4. **核心操作审计**: 手动转移球权（修改 `assigned_to`）为核心审计动作。提交时触发 5 秒强制确认弹窗，必须输入变动理由。
  
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
系统采用 **"瀑布流 (Waterfall)"** 逻辑计算保修期：  
1. **优先级 1 (IoT)**: 若 activation_date 存在，以此为准。  
2. **优先级 2 (人工)**: 若 sales_invoice_date 存在 (有发票)，以此为准。  
3. **优先级 3 (注册)**: 若 registration_date 存在，以此为准。  
4. **优先级 4 (直销)**: 若 sales_channel == DIRECT，按 ship_date + 7天。  
5. **优先级 5 (兜底)**: 若均为 NULL，按 ship_to_dealer_date + 90天。  

**5.5.1 RMA 工单保修依据检查 (Warranty Basis Check) - [NEW v1.8]**

**适用范围**: 仅 RMA 工单创建时需要，咨询工单不需要。

**业务流程**:
```
客户报修 → 创建 RMA 工单
              ↓
        输入产品序列号
              ↓
        自动查询保修状态
              ↓
    ┌───────────┴───────────┐
   已注册                   未注册
    ↓                       ↓
 显示 ✓ 已注册            显示 ⚠ 需注册
 继续创建工单              弹出保修注册对话框
                              ↓
                        录入销售日期来源
                        (发票/客户陈述)
                              ↓
                        保存到产品台账
                              ↓
                        继续创建工单
```

**实现细节**:
- **前端组件**: `RMATicketCreatePage` 集成序列号保修状态检查
- **注册对话框**: `ProductWarrantyRegistrationModal` 提供保修信息录入
- **后端 API**:
  - `GET /api/v1/products/check-warranty?serial_number=XXX` - 检查保修状态
  - `POST /api/v1/products/register-warranty` - 注册保修信息
- **保修依据判定**: 检查 `activation_date`、`sales_invoice_date`、`registration_date` 是否存在
- **销售日期来源**: 
  - `invoice` → 保存到 `sales_invoice_date` (优先级 2)
  - `customer_statement` → 保存到 `registration_date` (优先级 3)

**5.5.2 SN 状态驱动的入库与保修注册一体化 (Unified Entry & Warranty) - [NEW v1.9]**

**核心问题**: 工单详情页需要处理四种 SN 状态场景，提供差异化的入库与保修注册入口。

**场景矩阵 (Scenario Matrix)**:

| 场景 | SN 在台账 | 保修注册 | Header 显示 | 序列号区域按钮 | 弹窗类型 |
|------|----------|---------|-------------|---------------|---------|
| **A** | ✓ 已入库 | ✓ 已注册 | 在保/过保 | 无 | - |
| **B** | ✓ 已入库 | ✗ 未注册 | 保修待确认 | [注册保修] | ProductWarrantyRegistrationModal |
| **C** | ✗ 未入库 | N/A | 保修未知 | [产品入库] | ProductModal |
| **D** | SN 输入错误 | N/A | 保修未知 | 无 | 允许继续，后续修正 |

**场景详细说明**:

- **场景 A (已入库 + 已注册保修)**:
  - Header 显示: 保修状态（在保/过保）+ 剩余天数
  - 序列号区域: 仅显示 SN 链接，无操作按钮
  - 用户可点击 SN 链接跳转到产品详情页

- **场景 B (已入库 + 未注册保修)**:
  - Header 显示: "保修待确认" (黄色警示)
  - 序列号区域: 显示 [注册保修] 按钮
  - 点击打开 `ProductWarrantyRegistrationModal` 录入销售信息

- **场景 C (未入库)**:
  - Header 显示: "保修未知" (橙色警示)
  - 序列号区域: 显示 [产品入库] 按钮
  - 点击打开 `ProductModal` (预填 SN + 型号)
  - 入库成功后自动关联工单 product_id，刷新后变为场景 B

- **场景 D (SN 输入错误)**:
  - Header 显示: "保修未知"
  - 序列号区域: 无操作按钮（无法对错误 SN 入库）
  - 允许继续创建工单，后续通过"一键修正"修改 SN

**技术实现**:

- **状态判断依据**:
  - `assetData?.device?.is_unregistered === true` → 场景 C/D（未入库）
  - `assetData?.device` 存在且 `warrantyCalc?.final_warranty_status === 'warranty_unknown'` → 场景 B
  - `assetData?.device` 存在且有保修记录 → 场景 A

- **权限控制**:
  - 入库/注册按钮仅对 MS 部门 + Admin 可见
  - OP 部门隐藏所有入库/注册操作

- **弹窗组件**:
  - `ProductModal`: 产品入库专用，支持预填 SN 和型号
    - 字段: 序列号、型号、SKU、产品线、产品族群、生产日期、固件版本等
    - 布局: 单页分组，取消 Tab
  - `ProductWarrantyRegistrationModal`: 保修注册专用
    - 字段: 销售日期、销售日期来源、经销商、最终用户等

- **自动关联**:
  - 入库成功后，自动调用 `PUT /api/v1/tickets/{id}` 更新 `product_id`
  - 刷新工单详情和保修计算结果

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
  
**5.7 数据录入与清洗流程 (Data Entry & Cleaning) - [NEW v1.7]**
本系统采用 “双层身份模型” 处理客户信息：

资产拥有者 (Account): 法律主体，决定 SLA 等级和资产归属 (如: ARRI Rental)。

实际报修人 (Reporter): 当前沟通者，可能是临时工或未注册员工 (如: 场务 Smith)。

场景 A: 电话极速录入 (Loose Entry)
接听: 客服接起电话，对方自称是 ARRI 的临时工 Smith。

录入:

Account: 搜索 "ARRI"，系统锁定 account_id = 2 (ARRI Rental)。

Contact: 此时通讯录无 Smith，留空。

Reporter: 手动输入 "Smith (临时)", 电话 "138..."。系统存入 reporter_snapshot。

结果: 工单创建成功，SLA 按 ARRI (VIP) 计算，但联系人标记为“未归档”。

场景 B: AI/OCR 智能捕获 (Smart Capture)
输入: 客服将微信截图拖入新建页。

AI 解析: 识别出 "公司: Kinefinity", "联系人: 小王", "设备: MAVO Edge"。

映射:

AI 模糊匹配 "Kinefinity" -> 对应 Account ID。

AI 无法匹配 "小王" -> 填入 reporter_snapshot。

确认: 客服点击确认生成工单。

场景 C: 事后清洗 (Data Cleaning)
触发: 客服在工单详情页看到“⚠️ 未归档联系人”警告。

操作:

5. 忽略: 保持原状，结案后 Smith 仅作为历史文本存在。

**5.8 客户生命周期流转 (Customer Lifecycle & Prospect) [COMPLETED v12.3.0]**
我们不再为“潜在客户”单设新表，而是通过 `accounts.lifecycle_stage` 来管理身份。
* **状态定义**:
    * `PROSPECT` (潜在/线索): 没有关联设备的客户档案。比如参加会展、致电询价的记录。
    * `ACTIVE` (正式): 默认状态。拥有至少一台在保或出保设备的实名客户。
    * `ARCHIVED` (归档): 逻辑删除，或者是因为重组合并而停用。
* **数据入库 (Entry Flow)**:
    1. **标准创建**: 数据库字段默认为 `ACTIVE`，确保直接录入的客户默认视为正式。
    2. **工单清洗 (Capture)**: 在咨询工单详情页点击“入库”时，弹出**标准新建客户表单**（包含机构/个人选项）：
        - **UI 默认选项**: `PROSPECT` (潜在/线索)。
        - **可选切换**: 允许客服手动选择为 `ACTIVE`（例如：咨询时对方已经是正式客户但未建档）。
* **自动转正机制 (Auto-Upgrade)**: 
    系统会在触发以下任意行为时，**自动将 PROSPECT 状态升至 ACTIVE**：
    1. 为该 `account_id` 扫码入库第一台 `Installed Base (资产)`。
    2. 有关联该 `account_id` 的正式电商/分销订单完成。
* **双重身份穿透 (Multiple Roles per Contact)**:
    如果一个曾经的“个人潜客” (PROSPECT) 后来入职了“企业机构” (ORGANIZATION)：
    * 保留其个人的潜客 Account，同时在机构 Account 下新建该人的 Contact 记录。
    * 两个记录通过 **相同 Email** 串联。
    * 优势：确保他以后报修的“私有设备”与“公司财产”在工单系统和归集逻辑中界限分明。


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
|  | 🔔 Mentioned | Bell | All | 蓝底数字 (如 5)。表示协作请求。**OP/RD 进入 Inquiry/SVC 工单的唯一入口。** |
|  | 📥 Team Queue | Inbox | All | 灰底数字。部门公共池。 |
| OPERATIONS(业务查询) | ❓ 咨询工单 (Inquiry) | HelpCircle | MS, Mgr, Exec | (OP/RD 隐藏) OP/RD 通过 Mentioned 列表进入。全量咨询工单检索入口。 |
|  | 📦 RMA返厂 (RMA) | ClipboardList | All | OP 核心业务入口。乒乓协作模型主战场，支持 Team Queue 领取。 |
|  | 🔧 经销商维修 (SVC) | Wrench | MS, Mgr, Exec | (OP/RD 隐藏) OP/RD 通过 Mentioned 列表进入。全量 SVC 工单检索入口。 |
| KNOWLEDGE | 📖 Tech Hub | Book | All | 知识库。支持侧滑调用。 |
| ARCHIVES(静态档案) | 🏢 渠道 (Dealers) | Building | MS, Mgr, Exec | (OP/RD 隐藏) 静态档案查询。非MS部门通过工单JIT穿透访问。 |
|  | 👥 客户 (Customers) | Users | MS, Mgr, Exec | (OP/RD 隐藏) 静态档案查询。非MS部门通过工单JIT穿透访问。 |
|  | 📦 配件运营 (Dealer Operations) | Package | MS, Mgr, Exec | (OP/RD 隐藏) 经销商配件结算管理。非MS部门通过工单JIT穿透访问。 |
| PRODUCTS(产品管理) | 📋 产品目录 (Product Models) | Layers | All | 产品型号管理，所有内部人员可查看。 |
|  | 📦 产品SKU (Product SKUs) | Package | All | 商品规格管理，所有内部人员可查看。 |
|  | 📦 设备台账 (Assets) | Box | All | 设备实例管理，所有内部人员可查看。 |
|  | 🛠️ 配件目录 (Parts) | Tool | All | 配件SKU目录，所有内部人员可查看。 |



**6.3 核心界面设计 (Core Views)**  

**A. Overview (管理/部门仪表盘)**  
**适用角色**：Lead / Exec  
**定位**：登录后的第一站。先看全局，再干细活。  

**[NEW v1.7.1] 数据隔离原则**: 仪表盘数据必须严格遵循“部门职责范围”，不再统计全局可见但无权干预的工单。基于部门分工，后端通过专门的聚合接口（如 `/api/v1/tickets/team-stats`）根据请求者的 Department 动态计算。

1. **Action Zone (决策区 - 顶部)**  
    * **待审批卡片 (Approvals)**：仅对 MS、GE 或管理员等有审批权的角色展示。OP 部门无直接审批业务，其面板不受他部门审批单数字干扰。点击跳转 Team Hub 相关审批列表。
    * **风险卡片 (Risks)**：仅统计**当前节点处于本部门流转职责范围内**的超时单/风险单。其他部门节点的拖拖拉拉不再本部门报警。允许直接催办本部门 Assignee。
    * **进行中 (Open Tickets) & 今日完成 (Closed Today)**：指标计算基于目前持球人在本部门 (Assignee belongs to My Dept) 或当前节点隶属于本部门，而非全局彻底结案单数。
2. **Team Health (团队健康度 - 中部)**  
    * **负载看板 (Team Load)**：严格过滤系统成员，团队负载将**只展示与当前用户同部门的成员**的持有工单数。去除混杂其他部门成员的干扰。
        * 🟢 OP_Wang: 5 Active  
        * 🔴 OP_Li: 12 Active (Overloaded)  
    * **交互**：点击人员的柱子 -> 弹出他的任务列表 -> 勾选任务 -> 点击 **[ ➡️ 改派 (Re-assign) ]** 给 OP_Wang。  
3. **SLA Health (SLA 健康度 - 底部)**  
    * 仅展现本部门处理节点的超时率和响应时长，剥离非本部门节点停留导致的指标稀释，避免背锅。
  
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

2. **Mentioned (协作)**  
    * **过滤逻辑**：Participants contains Me AND Unread  
    * **卡片字段**：Ticket ID | 标题 | **[ 💬 RD_Li: "请确认..." ]**  

以下是单张卡片的标准字段布局（从左到右）：  


| 区域 | 字段/元素 | 视觉样式 (Style) | 数据源 (Source) |
| --- | --- | --- | --- |
| 左侧栏 | Star/Lock | Icon🔥 (P0/超时)⭐ (已关注)☆ (普通 - Hover可见) | is_critical OR priority==P0 ? Lock : is_starred |
|  | ID | RMA-001 (灰色微缩字体) | ticket_number |
| 主内容 | 标题行 | [P1] 镜头卡口松动Subtitle: Kinefinity VIP User (VIP) | priority + subjectcustomer.name + service_tier |
|  | 状态行 | 🔵 待诊断 · OP_Wang | status · assignee_id |
| 右侧栏 | SLA 计时器 | - 2h (红底) / 4h (黄字) / 2d (绿字) | sla_due_at - NOW() |
| 隐藏动作(Hover/Swipe) | Snooze | [ 💤 ] (仅对非 P0 可用) | 交互动作 |

**C. Detail View (工单详情页)**  
**适用角色**：All  
右侧栏 (Right Sidebar) 不再是静态信息展示，而是 数据质量控制台。根据数据完整度，分为四种状态展示。

状态 1: 标准企业工单 (Corporate Standard)
数据: Account ✅, Contact ✅
最理想状态。

+--------------------------------------------------+
+--------------------------------------------------+
|  [Logo] ARRI Rental                              |
|         VIP 客户 | 北京 | 信用良好                 |
+--------------------------------------------------+
|  对接人                                          |
|  [头像] Markus Zeiler (租赁经理)                  |
|  📞 +49 123 456 789                              |
+--------------------------------------------------+

状态 2: 企业 + 临时对接人 (Corporate + Temp) - 重点场景
数据: Account ✅ (ARRI), Contact ❌, Snapshot ✅ (Smith)

场景：ARRI 的临时场务报修。需明确“他是谁”和“他代表谁”。
+--------------------------------------------------+
|  🏢 客户信息 (临时对接)           [ 编辑 ]        |
+--------------------------------------------------+
|  [Logo] ARRI Rental                              |
|         VIP 客户 | 北京 | 信用良好                 |
+--------------------------------------------------+
|  对接人 (Reporter)                               |
|                                                  |
|  [👻头像] Smith (临时)    [标签:电话录入]         |
|  📞 139-0000-0000                                |
|                                                  |
|  ⚠️ 未归档联系人                                  |
|  [ Icon+入库 ]  [ Icon+关联现有 ]                 | <-- 清洗入口
+--------------------------------------------------+

状态 3: 个人/散客 (Individual / Freelancer)
数据: Account ❌, Contact ✅ (或 Snapshot ✅)

场景：独立摄影师。

+--------------------------------------------------+
|  👤 个人客户                     [ 编辑 ]        |
+--------------------------------------------------+
|  [头像] 李大山                                   |
|         Freelancer | 上海                        |
+--------------------------------------------------+
|  联系方式                                        |
|  📞 186-xxxx-xxxx                                |
|  ✉️ li@gmail.com                                 |
+--------------------------------------------------+
|  [ ⬆️ 升级为企业账户 ]                            |
+--------------------------------------------------+
状态 4: 未知/幽灵工单 (Ghost / Unregistered)
数据: Account ❌, Contact ❌, Snapshot ✅

场景：AI 抓取的邮件，或仅有一个电话号码。需强制清洗。

+--------------------------------------------------+
|  ❓ 未知身份                     [ 编辑 ]        |
+--------------------------------------------------+
|  来源: ✉️ support@kinefinity.com                 |
+--------------------------------------------------+
|  原始信息 (Snapshot)                             |
|  "User <123@gmail.com> via Email"                |
+--------------------------------------------------+
|  ⚠️ 建议操作 (Action Required)                   |
|                                                  |
|  [ 🔍 关联到企业 ]  (如: 归入 ARRI)               |
|  [ 👤 转为个人客户 ] (新建档案)                   |
|  [ 🗑️ 标记为垃圾 ]                               |
+--------------------------------------------------+
左侧基本信息区 (Info Grid) 联动逻辑
在工单左上角的基本信息区，显示逻辑需与右侧卡片一致：

客户 (Client):
有 Account -> 显示 Account Name (链接)。
无 Account -> 显示 -- 或 待确认 (灰色)。
报修人 (Reporter):
有 Contact -> 显示 Contact Name。
无 Contact -> 显示 Snapshot.name + (临时) 后缀。

交互：清洗操作流 (The Cleaning Flow)
当用户在右侧卡片点击 [ Icon+入库 ] 时：
弹出模态框 (Modal): 标题 "新建联系人"。
自动填充: 将 reporter_snapshot 中的 name, phone, email 填入表单。
锁定归属: Account 字段自动锁定为当前工单的 ARRI Rental。

保存后:
后端创建 Contact 记录。
更新当前 Ticket 的 contact_id。
UI 刷新，状态从“状态 2”变为“状态 1”。

  

**D. 工单新建入口与权限 (Ticket Creation Entry) [NEW v1.8]**
**核心原则**：App Rail 仅作空间导航，废除历史查询页面的新建入口，严格收敛建单入口与权限。

1. **入口布局**:
    * **第一层全局入口 (Top Bar)**：系统最上方的 Top Bar 区域右侧提供极简 `[ + ]` 按钮，无论身处何页，一键唤出“智能工单枢纽 (Smart Ticket Hub)”弹窗，作为兜底入口。
    * **第二层工作台入口 (My Tasks)**：仅在 Workspace 的“My Tasks”主视图顶部搜索栏旁设置 `[ + 新建工单 ]` 按钮，契合“在我的工作池中放入新任务”的心智模型。
2. **场景降噪 (清理冗余)**:
    * **移除 App Rail 动作按钮**：侧边栏彻底剥离高亮度动作按钮，回归“仅提供空间导航”属性。
    * **移除列表/历史页入口**：禁止在 RMA、SVC、咨询等档案式或带时间范围的查询列表页出现新建入口，保持“查档”场景的纯粹性。
    * **无衍生新建**：不在详情页内放置分裂/衍生新工单的入口。
3. **权限控制 (RBAC)**:
    * **可见且可用**：所有的建单入口仅限 **`MS` (市场客服部)** 以及全局特权账号 (`Admin` / `Exec`) 可见并使用。
    * **完全隐藏**：其它支撑部门人员（如 OP、RD、GE等），在登录后**完全看不见**各类新建按钮，从系统层级杜绝跨部门建单及越权操作。

**E. 部门工单 (Team Hub) —— 职责中心与协同**
[NEW v1.7] 本页面是部门成员的“雷达站”，体现**情报共享**与**共同担责**。

*   **核心政策：Dashboard 唯一性**
    *   **Topbar Dashboard**（带数字的状态统计条）**仅存在于**“部门工单 / Team Hub”页面。
    *   **My Tasks** (专注执行) 与 **Archives** (专注搜索) 均不显示 Topbar，以保持界面纯净。
*   **各部门展示与协作逻辑 (ABC 方案)**
    | 部门 | 可见性范围 (Visibility Scope) | Topbar Tab (关注点) | 职能定位 |
    | :--- | :--- | :--- | :--- |
    | **A. OP (运营)** | **全量活跃 RMA** + 被 @Mention 的工单 | `待收货` `待检测` `待维修` `待发货` `技术协作` | 确保物理设备流转“不漏单”。 |
    | **B. RD (研发)** | **完全由 @Mention 驱动** | `需技术建议` `已提供方案` | 作为专家支撑中心“找对人”。 |
    | **C. MS (市场)** | **全量活跃工单 (K/RMA/SVC)** | `活跃咨询` `返修协调` `代理维修` `待审批` | 确保商务界面“不断流”。 |

*   **“部门池”的整合与认领逻辑**
    1.  **取消独立部门池**：不再设置独立的“部门池”菜单，未分配任务直接整合在“部门工单”列表中。
    2.  **待领取 (Unassigned) 识别**：列表通过 `Assignee IS NULL` 自动标记为“公共任务”。
    3.  **Topbar 联动**：在 Topbar 的 `全部` 旁设置一个 `待认领` 快捷过滤 Tab。
    4.  **认领交互**：在列表中，未指派工单的负责人位置显示醒目的 `[ 认领 / Claim ]` 按钮。任何部门成员点击后，球瞬间转入其 **My Tasks**，实现“从公共池捞活”的无缝切换。

**6.4 档案库 (Operations/Archives) —— 搜寻与统计导向**
[Refined v1.7] 当用户进入此处时，心理模型是“查找”或“回顾”。
*   **交互逻辑**：移除进度条 Dashboard，顶部完全留给 **高级搜索** 与 **多维过滤器**。
*   **搜索增强**：支持精准 SN 搜索、历史关联性分析及数据导出。


**6.5 管理员与测试规范 (Admin & Debugging)**  
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
  
# 7. 产品管理与配件库存整合方案 (v2.0 升级)

## 7.1 三层产品架构 (Three-Layer Architecture) [COMPLETED v2.0]

### 问题背景
为了与内部 ERP 系统的 9 系列（物料代码）和 A 系列（商品 SKU）深度对齐，我们将“产品管理”从单一层级升级为三层架构，以解决“相同型号多种配置”和“硬件品质等级”的管理难题。

### 架构定义
1.  **产品目录 (Product Model/Catalog)**：定义基础平台（如：MAVO Edge 8K）。主要存储 **产品型号 (Model Code, 如 C181)**、**产品名称 (Product Name)**、品牌信息、**主视觉图片 (Hero Image)**。
2.  **商品规格 (Product SKU)**：定义具体的销售形态（如：MAVO Edge 8K - 深空灰、EF套装）。主要存储 **商品编码 (SKU ID, 如 A010-001-01)**、**物料 ID (Material ID, 如 9-010-001-01)**、全家福图片。
3.  **设备台账 (Product Instance/Ledger)**：定义每一台出厂的具体设备。主要存储 SN、品质等级（Grade）、实时仓库位置。

### 重置与 UI 实现
*   **统一入口**: “产品目录”作为主入口。
*   **双页签管理**: 在“产品目录”编辑界面，通过 **[ 基本信息 ]** 和 **[ SKU 体系 ]** 双页签进行管理。
*   **视觉支持**: 支持产品型号的 Hero Image 上传与 SKU 的专属图片上传。

### 重命名与映射
| 当前名称 | 建议名称 | 对应层级 | 核心 ID 标识 |
|---------|---------|---------|-------------|
| 产品型号 | **产品目录** / Model | 型号层 (Model) | **产品型号 (Model Code)**: C181 |
| (新概念) | **商品规格** / SKU | 商品层 (SKU) | **商品编码 (SKU ID)**: A0xx |
| 产品管理 | **设备台账** / Ledger | 实例层 (Instance) | **序列号 (SN)**: KD8K... |
| (新概念) | **物料 ID** / Material | 制造层 (Material)| **物料 ID (Material ID)**: 9-0xx |

### 7.1.1 核心数据结构 (v2.0)

**A. 产品目录 (product_models)**
定义基础平台硬件型号。
```json
{
  "id": "INTEGER PRIMARY KEY",
  "model_code": "C181",           // 产品型号 (Model Code)
  "model_name": "MAVO Edge 8K",   // 内部名称 (用于旧数据兼容)
  "name_zh": "MAVO Edge 8K",      // 产品名称 (中文)
  "name_en": "MAVO Edge 8K",      // 产品名称 (英文)
  "brand": "Kinefinity",
  "internal_prefix": "9-010-001", // 物料 ID 前缀 (ERP 9-series)
  "hero_image": "url_to_image",
  "is_active": true
}
```

**B. 商品规格 (product_skus)**
定义具体的销售形态（套装、卡口、颜色）。
```json
{
  "id": "INTEGER PRIMARY KEY",
  "model_id": "INTEGER",           // 关联 product_models.id
  "sku_code": "A010-001-01",       // 商品编码 (SKU ID / A系列)
  "erp_code": "9-010-001-01",      // 物料 ID (ERP ID / 9系列)
  "display_name": "MAVO Edge 8K 基础套装",
  "display_name_en": "MAVO Edge 8K Basic Kit",
  "spec_label": "深空灰 / E卡口",
  "sku_image": "url_to_bundle_image",
  "is_active": true
}
```

**C. 设备台账 (products / Installed Base)**
定义每一台具有唯一 SN 的设备实例。
```json
{
  "id": "INTEGER PRIMARY KEY",
  "serial_number": "KD8K-2501-0099",
  "sku_id": "INTEGER",             // 关联 product_skus.id
  "model_name": "String",          // 冗余型号名 (兼容性)
  "product_sku": "String",         // 冗余 SKU 编码 (兼容性)
  "grade": "Enum",                 // 品质等级: A (全新), B (官翻), C (维修级)
  "warehouse": "String",           // 物理位置/仓库
  "entry_channel": "Enum",         // 入库渠道 (FACTORY, RETURN, TRADE_IN)
  
  // 保修依据 (Warranty Basis)
  "is_iot_device": "Boolean",      // 是否支持联网
  "is_activated": "Boolean",       // 是否已联网激活
  "activation_date": "Date",       // 联网激活日期 (优先级 1)
  "sales_invoice_date": "Date",    // 发票日期 (优先级 2)
  "registration_date": "Date",     // 客户注册日期 (优先级 3)
  "ship_to_dealer_date": "Date",   // 发货至经销商日期 (优先级 5 兜底)
  
  // 保修计算结果 (Computed Result)
  "warranty_start_date": "Date",   // 最终保修起始日
  "warranty_end_date": "Date",     // 最终保修结束日
  "warranty_months": "Integer",    // 保修期 (默认 24)
  "warranty_status": "ACTIVE",     // ACTIVE / EXPIRED
  "warranty_source": "Enum"        // 记录计算依据来源
}
```

## 7.2 配件管理整合方案

### 现有系统分析

| 模块 | 功能 | 数据 |
|------|------|------|
| **Inventory（配件库存）** | 经销商配件库存管理 | 总部库存 + 一级经销商库存 |
| **Service Parts SKU** | 配件主数据 | 74个配件，含SKU编码、多币种价格 |
| **设备台账** | Installed Base | 出厂设备SN |
| **产品目录** | 产品型号 | 型号定义 |

### 核心问题
1. **配件定义 vs 配件库存分离**：SKU文档独立，库存模块独立
2. **维修配件消耗未打通**：维修工单使用配件时，未自动扣减库存
3. **结算流程割裂**：库存消耗和财务结算未关联

### 整合后数据模型

```
┌─────────────────────────────────────────────────────────┐
│                    配件主数据 (Part Master)               │
├─────────────────────────────────────────────────────────┤
│  SKU        名称        分类    价格(CNY/USD/EUR)  状态  │
│  S1-011-013 SDI模块     接口    ¥390/$69/€69       在售  │
└─────────────────────────────────────────────────────────┘
                            │
        ┌───────────────────┼───────────────────┐
        ▼                   ▼                   ▼
┌───────────────┐   ┌───────────────┐   ┌───────────────┐
│  总部库存      │   │ 经销商库存     │   │  维修消耗记录  │
├───────────────┤   ├───────────────┤   ├───────────────┤
│  location: HQ │   │ location: ProAV│   │ ticket_id     │
│  quantity: 50 │   │ quantity: 5   │   │ part_id       │
│  ...          │   │ dealer_id     │   │ quantity      │
└───────────────┘   └───────────────┘   │ source        │
                                        │ (库存/外购)   │
                                        └───────────────┘
                                                   │
                                                   ▼
                                          ┌───────────────┐
                                          │   结算记录     │
                                          ├───────────────┤
                                          │ dealer_id     │
                                          │ amount        │
                                          │ period        │
                                          │ status        │
                                          └───────────────┘
```

### 关键整合点

**1. 维修工单 ↔ 配件库存**
- 选择配件SKU（从Part Master）
- 选择来源：[总部库存] [经销商库存] [外购]
- 自动扣减对应库存
- 生成消耗记录

**2. 配件库存 ↔ 结算**
- 每月1日生成上月结算单
- 汇总经销商库存消耗记录
- 按Part Master价格计算金额
- 生成结算单（待确认→已确认→已开票→已付款）

**3. 产品型号 ↔ 配件（BOM关联）**
- 产品型号配置常用维修配件包
- 维修时自动推荐常用配件
- 快速添加到维修工单

### 统一配件管理入口

```
服务管理
├── 配件管理（新整合页面）
│   ├── [配件目录] Tab - 查看所有SKU
│   ├── [库存管理] Tab - 总部+经销商库存视图
│   ├── [消耗记录] Tab - 所有维修配件使用记录
│   └── [结算管理] Tab - 经销商结算单
│
├── 设备台账（原产品管理）
├── 产品目录（原产品型号）
└── ...
```

# 8. 修正与删除机制 (Correction & Deletion Mechanism) [COMPLETED v12.3.44]
本系统在满足“允许纠错”需求的同时，建立了严格的审计闭环，防止数据造假。

**7.1 审计化修正 (Audited Correction) [COMPLETED v12.3.44]**
*   **对比逻辑**：后端在处理 `PATCH /tickets/:id` 请求时，会自动对比核心字段的新旧值。强制识别空值（null, undefined, ""）为等效。
*   **强制记录与理由**：修改下列清单中的字段时，系统**强制要求**填写修正理由。前端弹出带 5 秒倒计时的审计模态框，强制用户核对变更 Diff 并提供理由。
*   **审计日志**：变更理由将同步记录到 `ticket_activities` 时间轴，显式展示新旧值对比。
*   **UI 规范 [v1.8]**: 时间轴采用极简单行布局：`[角色] 修改了 [字段]: [旧值] ➔ [新值]`，长值自动截断，修正理由辅助显示。
*   **安全提示 [v1.8]**: 编辑面板标题增加 `ShieldAlert` 图标及审计警告语；核心资产字段(SN/Product) 使用黄色预警底色及图标提醒。
*   **侧滑标准 [v1.8]**: 所有侧滑窗口（编辑窗口、全景详情窗口）统一定义宽度为 **400px**，不再使用 600px。
*   **设备台账弹窗 [v1.9]**: 设备台账的添加/编辑产品改为 **macOS 26 风格居中弹窗 (560px)**，采用圆角卡片设计、深色背景、毛玻璃遮罩，与侧滑窗口区分使用场景。
*   **本地化标准 [v1.8]**: 移除所有 "(Summary)", "(Description)" 等英文双语后缀，保持界面纯净中文。

**7.2 墓碑化软删除 (Soft Deletion / Tombstone) [COMPLETED v12.3.44]**
*   **逻辑实现**：使用 `is_deleted` 标记，配合 `deleted_at`, `deleted_by`, `delete_reason`。
*   **特殊权限**：市场部负责人 (MS Lead) 具备跨生命周期阶段强制删除任何工单的特权。
*   **回收站**：作为独立按钮存放在 Team Hub 页面统计区域。支持一键恢复（Restore）。
