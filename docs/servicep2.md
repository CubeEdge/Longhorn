# 产品服务闭环系统 - Phase 2 需求文档 (Service P2 PRD)

> **文档目的**: 本文档旨在基于现有 `Service_PRD.md` 及实际开发日志 (`log_dev.md`, `log_prompt.md`, `log_backlog.md`) 梳理并明确 Service 系统第二阶段 (Phase 2) 已经实现及规划的核心功能、入口、流转过程与数据关系。

---

## 1. 产品定位与核心价值升级

在原有“产品服务闭环系统 (Longhorn)”实现工单管理、知识沉淀及智能辅助的基础上，Phase 2 进一步强化了 **知识库（Tech Hub）的生态建设**、**B端（经销商/Admin）管控深度**以及**AI（Bokeh）的智能融合与体验抛光**。

### 1.1 核心升级点
- **Tech Hub 品牌化与体验重塑**: 将原“Kinefinity Wiki”全面升级为“Tech Hub”，打造沉浸式、极简（macOS 26 风格）的技术知识中心。
- **智能化检索边界拓宽**: 引入同义词扩展和宽泛检索策略，大幅提升搜索召回率；AI 辅助问答与真实工单数据深度结合。
- **知识输入自动化**: 实现了从 DOCX 到 Markdown 的高保真自动化转换，以及基于 Jina Reader 的网页内容自动抓取与清洗导入。
- **全局状态与交互升维**: 引入前端状态管理（Zustand + 持久化），实现跨页面工作流的无缝衔接（如列表与详情的状态保持、新标签页查看保护阅读上下文）。

---

## 2. 核心功能模块与入口

系统整体架构继续依托**三层模型**（服务作业台、技术知识支撑、档案和基础信息），但在具体表现层与功能点上进行了深化。

### 2.1 技术知识支撑 (Tech Hub) - [重点升级]

**系统入口**: `/tech-hub/wiki` (原知识库入口已收敛至管理菜单，全站对外统一称谓“Tech Hub”)

#### 2.1.1 核心流转：查阅与检索
- **流转路径**: 用户进入 Tech Hub -> 在顶部统合的 Tab 栏输入关键词（或点击 A/B/C/D 产品分类） -> 动态呼出搜索记录下拉框 -> 系统异步并行展示精准命中的 **文章 (Articles)** 与相关联的 **工单 (Tickets)**。
- **Bokeh AI 智能问答**: 用户在侧边聊天气泡输入问题 -> AI 结合召回的文章与带真实联系人上下文的工单数据，生成结构化回答。
- **卡片化引用链接**: AI 回答中的引用文章出处展示为带图标的胶囊型卡片，点击在新标签页打开，保护当前问答会话。

#### 2.1.2 核心流转：知识库内容的生成与导入 (Knowledge Generator)
- **流转路径**: 管理员入口点击“知识导入” -> 弹出 macOS 26 风格高斯模糊的 Generator 模态框。
- **支持的导入方式**:
  - **DOCX 导入**: 系统后台调用 python 脚本，提取层级标题（H1/H2..）、表格并对图片进行 WebP 压缩，最终生成结构化 Markdown 进入数据库。
  - **URL 网页导入 (Turbo 模式)**: 借助 Jina Reader 绕过反爬，提取页面核心正文，并在后端执行去重、H1 剥离与多余元素清洗。
- **批量关联**: 导入时支持通过多选标签组为一篇文章关联多个产品机型。

### 2.2 服务作业台 (Workbench) 与 档案管理 (Archives)

**系统入口**: `/workbench/inquiry-tickets`, `/workbench/rma-tickets`, `/customer-management` 等。

#### 2.2.1 核心流转：工单处理与状态持久化
- **流转路径**: 客服/工程师在列表页进行搜索（URL 驱动） -> 点击具体工单进入 `DetailPage` -> 查看富文本沟通记录及侧边栏带出的全面**客户上下文**。
- **上下文感知展示 (SVC 场景)**: 若当前为经销商视角，维修单展示终端客户；若为直客视角，则展示经手经销商，且联系人自动去重显示。
- **交互保障**: 离开详情页返回列表时，通过 `useRouteMemoryStore` 瞬间恢复之前的筛选关键字与分页状态。点击任何资产卡片，可一键跳转至对应设备型号的 Tech Hub 页面检索关联技术文档。

#### 2.2.2 核心流转：文件与附件管理 (Attachment)
- **流转路径**: 在创建工单的 `TicketCreationModal` 中拖拽上传附件 -> 后端经 `filesRouter` 处理 -> 在各种详情页的 "Attachments" 列表展示预览或提供下载。
- **后台维护功能升级**: Admin 设置区可配置**SQLite 数据库的热备份策略**（结合 `backup_service.js` 实现无锁定时脱机备份）。

---

## 3. 数据关系与流向

在原有的 ER 模型上，Phase 2 进行了更严格的约束与优化。

### 3.1 账户与联系人 (Account & Contact)
- **Schema 统一化**: 全栈使用 `account_id` 替代旧有的 `customer_id` 物理列，确保概念一致。
- **主要联系人约束**: 每个 Account 下**只能有一个** `is_primary = true` 的 Contact。前端保存机制由并发改为队列，防止并发写引发的 SQLite 锁表现象。

### 3.2 搜索与检索辅助模型 (Search Extension)
- **同义词字典 (Synonym Map)**:
  - 关系：独立的配置表 `search_synonyms`。
  - 作用：后端维护热缓存，当用户检索如“录音”时，自动扩展 `OR "拾音" OR "麦克风"` 增加召回广度。
- **降级检索策略**: 补充了对 FTS5 引擎不支持的短字符（<3 长度）的全量表 `LIKE` 扫描降级，确保 100% 关键字不漏。

### 3.3 知识库层级 (Knowledge Chapters)
- **强约束正则**: 确保章节序号（如 `3.1.2` 甚至带有前导空格和点号）能被准确切分出 `chapter`, `section` 与 `title`。
- **空骨架过滤**: 只为展示分类大框架而无实际上文内容的根节点文章，被屏蔽不作为结果单独平铺显示，仅服务于侧边导航树，保持信息流纯净。

### 3.4 文件与备份 (Storage & Backup)
- 所有实体化上传的图片与转换的 WebP 单独存放于 `knowledge_images` 目录。
- 数据库 `longhorn.db` 配置并关联了自动热备份输出路径及按天的回滚机制（配置存于 `system_settings`）。

---

## 4. UI 品牌规范与体验收束

这是 Phase 2 最为显著的特征，所有的功能落地都必须遵循并维护当前的视觉高度。
- **品牌色收敛**: 所有的操作导向绿色统一为 **Kine Green (#10B981)**。黄色为 **Kine Yellow (#FFD700)**。警告与取消必定为 **Kine Red (#EF4444)**。
- **AI 视觉体系**: Bokeh 智能入口、按钮选中态及载入进度，全量采用 **Teal (#00BFA5) -> Lavender (#8E24AA)** 渐变。
- **极简弹窗与空间感**: 全局采用沉浸式 macOS26 毛玻璃、大留白距、右侧统一下拉对齐格式。不再使用原生的生硬 `alert`，全面替换为页面顶部的动画 `Toast` 提示。
- **国际化 (i18n)**: UI 层面杜绝一切硬编码字符，保证中（zh）、英（en）、德（de）、日（ja）的语种瞬时无缝切换与翻译一致性。

---

## 5. 工单系统深度解析 (Workbench & Tickets)

Phase 2 对原有的工单流转体系进行了重构与严格定义，明确了三种核心工单类型及其在服务链路中的定位。

### 5.1 咨询工单 (Inquiry Ticket)

* **定位**：服务链路的起点（入口中心），用于记录客户的咨询、售后求助、投诉等，是全渠道沟通的归集点。
* **数据定义 (`inquiry_tickets`)**：
  * **主键/编号**：`ticket_number` (格式: `KYYMM-XXXX`，如 `K2602-0001`)
  * **核心字段**：`customer_name`, `account_id`, `product_id`, `serial_number`, `service_type` (咨询/问题排查/远程协助等), `problem_summary`, `communication_log`
  * **关联关系**：可关联具体的 `Account`, `Contact`, `Product`，并在后续升级时生成 `related_ticket_id` 指向具体的维修单或 RMA。
* **流程节点 (Status)**：
  1. `in_progress` (处理中)
  2. `waiting_customer` (待客户反馈)
  3. `resolved` (已解决)
  4. `auto_closed` (超时自动关闭)
  5. `converted` (已升级为 RMA 或经销商维修单)
* **核心逻辑**：
  * 所有客户的首次触达（邮件、电话、企微）均应先创建咨询工单。
  * 具备【升级机制】，当线上排查确认需硬件拆修时，可通过 API 直接转换为 RMA 单或 Dealer Repair 单，实现沟通上下文的平滑跨阶段流转。

### 5.2 RMA 返厂单 (RMA Ticket)

* **定位**：设备需要回寄 Kinefinity 总部进行原厂维修的凭证。
* **数据定义 (`tickets`, `ticket_type = 'rma'`)**：
  * **编号**：`ticket_number` (格式: `RMA-{C}-YYMM-XXXX`，其中 C=D[Dealer] 或 C[Customer])
  * **核心字段**：继承基础设备信息，包含 `issue_type` (客户返修/生产问题等), `severity` (等级), `problem_description`, `repair_content`, `received_date`, `ship_date`
  * **强约束**：**一台故障设备必须对应一个独立的 RMA 号**。如果客户一次寄回 3 台机器修，会在底层生成 3 个独立的 RMA 工单（但可通过 Batch 接口批量创建）。
* **流程节点 (Status)**：
  1. `pending` (待收货 / 待处理)
  2. `in_progress` (维修中：已收货，并在产线排期流转)
  3. `repaired` (维修完成：产线修复并质检完毕)
  4. `waiting_payment` (待付款：保外维修，已发送报价单等待结款)
  5. `closed` (已结案：已发货/设备已交还)
* **核心逻辑**：
  * **收货触发机制**：实际物理收货 (`received_date` 记录) 后状态流转至 `in_progress`。
  * **费用判定**：结合设备的 `warranty_until` 与人工确认来制定 `is_warranty`（保内外），决定是直接结案还是进入待付款流转。

### 5.3 经销商维修单 (Dealer Repair Ticket)

* **定位**：授权且有维修能力的一级经销商（Tier 1）在当地对客户设备直接进行维修拦截的业务凭证。
* **数据定义 (`tickets`, `ticket_type = 'dealer_repair'`)**：
  * **编号**：`ticket_number` (格式: `SVC-D-YYMM-XXXX`)
  * **核心字段**：与 RMA 物理表结构完全一致，但具有独特的经销商业务上下文，拥有 `dealer_id` 强关联。
* **流程节点 (Status)**：
  * 流转相对干练脱水，核心环节为：`pending`(待处理) -> `in_progress`(维修中) -> `closed`(已结案)。
* **核心逻辑与经销商配件库存 (Dealer Inventory) 联动**：
  * **库存强耦合与消耗 (`consumePartsFromInventory`)**：创建或更新经销商维修单时，如果填报了消耗的配件 (`parts_used`)，系统会自动去 `dealer_inventory` 表扣减对应经销商的物料存量。
  * **宽容扣减与预警机制**：即便当前系统记录的经销商库存不足，系统仍**允许强制扣减**（允许库存出现负数，并在返回结果中带上 `inventory_warnings`: “库存不足” 的警告）。这符合线下实体维修的容错场景（可能配件已到店但未在系统中入库）。
  * **完整的回退与审计链路 (`restorePartsToInventory`)**：如果管理员删除工单或修改了维修耗材记录，系统会自动执行回退逻辑，将多扣除的配件加回 `dealer_inventory`，并在 `inventory_transactions`（事务流水表）中记录 `Adjustment`（回退）或 `Outbound`（消耗）明细，确保账物绝对相符。
  * **自动补货循环 (`Restock Orders`)**：当经销商配件库存数量 (`quantity`) 降至安全线 (`reorder_point`) 及以下时，系统会触发低库存预警 (`low_stock`)，协助经销商向上级一键发起补货申请单 (`restock_orders`)。
  * **结算机制**：经销商替厂方先行维修，所有产生的物料流转纪录及保外向客户收费的金额，会用作月末与 Kinefinity 总部 B2B 对账抵扣的依据。
