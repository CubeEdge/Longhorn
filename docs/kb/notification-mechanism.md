# Longhorn 通知系统开发规范 (Notification Mechanism)

> **核心目标**：保障工单流转的实时感知，降低用户沟通成本。通知系统遵循“极简触发、精准推送、即时跳转”的设计原则。

## 1. 核心模型与存储
通知数据存储在 `notifications` 表中，核心字段包括：
- `recipient_id`: 接收人 ID。
- `notification_type`: 通知类型（见下文）。
- `related_type` / `related_id`: 关联对象（通常为 `ticket`）。
- `action_url`: 点击通知后的跳转地址（如 `/service/tickets/123`）。
- `is_read`: 已读状态。

## 2. 触发场景与逻辑

### 2.1 @提及 (@Mention)
- **触发逻辑**：在工单评论区输入 `@姓名`。
- **发送范围**：被提及的人员（非本人）。
- **副作用**：被提及人员会被自动添加为该工单的 **参与者 (Participant)**。
- **通知类型**：`mention`。

### 2.2 工单指派 (Assignment)
- **触发逻辑**：工单负责人 (`assigned_to`) 发生变更时。
- **发送范围**：新的负责人。
- **通知类型**：`assignment`。

### 2.3 状态变更 (Status Change) [Update v1.8]
- **触发逻辑**：工单节点 (`current_node`) 发生变更时。
- **发送范围**：
  - 工单负责人 (Assignee)
  - 工单创建人 (Creator)
  - 所有工单参与者 (Participants)
- **通知类型**：`status_change`。

### 2.4 SLA 超时预警 (SLA Warning/Breach) [Planned]
- **触发逻辑**：工单接近或超过预設 SLA 时限。
- **发送范围**：负责人及部门负责人 (Lead)。
- **通知类型**：`sla_warning`, `sla_breach`。

## 3. 前端交互规范 (macOS 26 风格)

### 3.1 顶部红点 (Badge)
- **实时性**：前端每 30 秒轮询一次 `/unread-count` 接口。
- **展示**：数字显示在顶部工具栏的铃铛图标右上角。

### 3.2 通知中心面板
- **入口**：点击顶部铃铛弹出。
- **分类标识**：
  - `@` 蓝色图标：提及。
  - `User+` 蓝色图标：指派。
  - `Info` 绿色图标：状态变更。
  - `Warning` 黄色/红色图标：SLA。
- **已读逻辑**：点击通知自动跳转并标记已读；支持点击“全部标记已读”。

## 4. 后端开发规范
- 通知触发应封装在业务路逻辑中（如 `tickets.js` 或 `ticket-activities.js`），通过直接插入 `notifications` 表或调用 helper 函数实现。
- 发送通知时需排除 **当前操作者 (Actor)**，避免自我干扰。
- 如果用户通过 **View As (替身功能)** 操作，通知的 `actor` 应记录为替身后的用户标识。
