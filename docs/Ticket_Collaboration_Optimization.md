# 工单协作与通知系统优化方案 (Ticket Collaboration & Notification Optimization)

## 1. 现状分析与诊断 (Current Status & Diagnosis)
目前的工单通知机制处于“被动模式”，存在显著的逻辑断层，导致协作效率低下：

*   **通知触发器过窄**：仅依赖正则匹配 `@提及`。如果用户直接发送评论或附件而未手动 @ 某人，相关责任人（Assignee/Participants）处于“失聪”状态。
*   **动作静默 (Silent Actions)**：
    *   **指派/认领 (Assign/Claim)**：虽有审计日志（Activity），但无即时通知推送，被指派者往往后知后觉。
    *   **协作邀请 (Invite)**：将人员加入 Participants 列表的操作是静默的，被邀请者无法感知参与时机。
*   **负责人责任制失效**：工单负责人（Assignee）理应接收该工单下的一切动态，但目前的逻辑是“除非被点名，否则不通知”。

---

## 2. 优化方案目标 (Objectives)
将通知逻辑从“精准点名制”升级为“角色订阅 + 动作触发制”，确保信息流转的精准与及时。

### A. 全感官通知模型 (The "Always-On" Awareness)
1.  **负责人订阅逻辑**：工单第一责任人 (Assignee) 自动订阅工单动态。所有新评论、附件、状态流转均需触达负责人。
2.  **指派即触达**：移除“指派静默”。当工单被指派（PATCH `assigned_to`）或认领时，接受者收到高优先级通知。
3.  **邀请即感知**：用户被手动加入协作列表时，立即触发“您已被加入协作”通知。

### B. 通知分级机制 (Priority Levels)
*   **高优先级 (High - 弹窗/系统强提醒)**：
    *   `@提及我` (Mentioned me)
    *   `指派任务给我` (Assigned to me)
*   **普通优先级 (Normal - 红点/提示音)**：
    *   `我负责的任务有新评论/附件`
    *   `我被加入协作` (Added to participants)
    *   `工单状态发生了流转`（针对相关节点处理人）

---

## 3. 执行计划 (Execution Plan)

### 第一阶段：后端通知引擎强化 (Backend Logic)
*   **Task 1: POST /activities 逻辑重构**
    *   除了 `@提及` 扫描，增加 Assignee 检测。
    *   若 `actor_id !== assigned_to`，系统自动向 `assigned_to` 发送一条 Activity 通知。
*   **Task 2: PATCH /tickets/:id 指派通知**
    *   检测 `assigned_to` 变化字段。
    *   触发 `createAssignmentNotification` 给新负责人。
*   **Task 3: POST /participants 邀请通知**
    *   在协作者入库成功后，批量通知被新增的用户。

### 第二阶段：前端 UI/UX 体验补全 (Frontend Interaction)
*   **Task 4: 详情页指派交互补全 (`UnifiedTicketDetail.tsx`)**
    *   在 Basic Info 面板的“处理人”字段右侧增加操作入口。
    *   仅对拥有 `Lead` 或 `Admin` 权限的角色开放。
*   **Task 5: 优化导航栏红点提示**
    *   确保 Mentioned 视图能即时反映上述新增的通知类型。

---

## 4. 关键接口修改点对照表
| 模块 | 涉及文件 | 修改核心逻辑 |
| :--- | :--- | :--- |
| **评论与动态** | `ticket-activities.js` | 增加非 @ 情况下的负责人默认推送 |
| **指派与认领** | `tickets.js` (PATCH) | 增加 `assigned_to` 变更时的通知触发 |
| **协作成员** | `tickets.js` (Participants) | 增加人员被 Invite 后的通知触发 |
| **UI 交互** | `UnifiedTicketDetail.tsx` | 增加 Lead 视角的指派选择器 |
