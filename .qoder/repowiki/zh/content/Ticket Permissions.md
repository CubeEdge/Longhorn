# 工单权限

<cite>
**本文引用的文件**
- [docs/kb/ticket-permissions.md](file://docs/kb/ticket-permissions.md)
- [server/service/middleware/permission.js](file://server/service/middleware/permission.js)
- [server/service/routes/tickets.js](file://server/service/routes/tickets.js)
- [client/src/components/Workspace/UnifiedTicketDetail.tsx](file://client/src/components/Workspace/UnifiedTicketDetail.tsx)
- [client/src/components/Service/AuditReasonModal.tsx](file://client/src/components/Service/AuditReasonModal.tsx)
- [client/src/components/Service/DeleteTicketModal.tsx](file://client/src/components/Service/DeleteTicketModal.tsx)
- [server/service/migrations/020_p2_unified_tickets.sql](file://server/service/migrations/020_p2_unified_tickets.sql)
- [server/scripts/test_view_as.js](file://server/scripts/test_view_as.js)
- [server/service/sla_service.js](file://server/service/sla_service.js)
- [server/scripts/fix_ticket_status.js](file://server/scripts/fix_ticket_status.js)
</cite>

## 目录
1. [简介](#简介)
2. [项目结构](#项目结构)
3. [核心组件](#核心组件)
4. [架构总览](#架构总览)
5. [详细组件分析](#详细组件分析)
6. [依赖分析](#依赖分析)
7. [性能考虑](#性能考虑)
8. [故障排查指南](#故障排查指南)
9. [结论](#结论)

## 简介
本文件系统性阐述 Longhorn 工单系统的“权限与操作”体系，围绕“阶梯式风控模型”展开，覆盖服务端权限中间件、前端 UI 可见性守卫、强制审计机制、删除与恢复策略、以及跨端（Web/iOS）的一致行为。目标是帮助开发者、测试与运营人员准确理解“谁能在何时对工单进行何种操作”，并提供可追溯、可验证的实现依据。

## 项目结构
本主题涉及的关键位置包括：
- 文档层：知识库中关于“工单权限与操作”的说明
- 服务端：权限中间件、工单路由与审计字段白名单、状态机与 SLA 服务
- 客户端：统一工单详情页的 UI 权限守卫、审计理由弹窗、删除确认弹窗
- 数据层：统一工单表结构与索引、活动时间轴与通知

```mermaid
graph TB
subgraph "文档"
KB["知识库<br/>ticket-permissions.md"]
end
subgraph "客户端"
UI["UnifiedTicketDetail.tsx<br/>UI 权限守卫"]
Audit["AuditReasonModal.tsx<br/>强制审计弹窗"]
Del["DeleteTicketModal.tsx<br/>删除确认弹窗"]
end
subgraph "服务端"
Perm["permission.js<br/>权限中间件"]
Routes["tickets.js<br/>工单路由/审计字段/状态机"]
SLA["sla_service.js<br/>SLA 节点变更"]
MIG["020_p2_unified_tickets.sql<br/>统一工单表/索引"]
Test["test_view_as.js<br/>View As 测试脚本"]
end
KB --> UI
UI --> Routes
UI --> Audit
UI --> Del
Perm --> Routes
SLA --> Routes
MIG --> Routes
Test --> Perm
```

图表来源
- [docs/kb/ticket-permissions.md](file://docs/kb/ticket-permissions.md#L1-L63)
- [client/src/components/Workspace/UnifiedTicketDetail.tsx](file://client/src/components/Workspace/UnifiedTicketDetail.tsx#L750-L949)
- [client/src/components/Service/AuditReasonModal.tsx](file://client/src/components/Service/AuditReasonModal.tsx#L1-L338)
- [client/src/components/Service/DeleteTicketModal.tsx](file://client/src/components/Service/DeleteTicketModal.tsx#L1-L383)
- [server/service/middleware/permission.js](file://server/service/middleware/permission.js#L1-L232)
- [server/service/routes/tickets.js](file://server/service/routes/tickets.js#L1-L2502)
- [server/service/sla_service.js](file://server/service/sla_service.js#L124-L172)
- [server/service/migrations/020_p2_unified_tickets.sql](file://server/service/migrations/020_p2_unified_tickets.sql#L1-L271)
- [server/scripts/test_view_as.js](file://server/scripts/test_view_as.js#L1-L200)

章节来源
- [docs/kb/ticket-permissions.md](file://docs/kb/ticket-permissions.md#L1-L63)
- [server/service/middleware/permission.js](file://server/service/middleware/permission.js#L1-L232)
- [server/service/routes/tickets.js](file://server/service/routes/tickets.js#L1-L2502)
- [client/src/components/Workspace/UnifiedTicketDetail.tsx](file://client/src/components/Workspace/UnifiedTicketDetail.tsx#L750-L949)
- [client/src/components/Service/AuditReasonModal.tsx](file://client/src/components/Service/AuditReasonModal.tsx#L1-L338)
- [client/src/components/Service/DeleteTicketModal.tsx](file://client/src/components/Service/DeleteTicketModal.tsx#L1-L383)
- [server/service/migrations/020_p2_unified_tickets.sql](file://server/service/migrations/020_p2_unified_tickets.sql#L1-L271)
- [server/scripts/test_view_as.js](file://server/scripts/test_view_as.js#L1-L200)
- [server/service/sla_service.js](file://server/service/sla_service.js#L124-L172)

## 核心组件
- 阶梯式风控模型与角色权限
  - 活跃期放权：处理中赋予足够编辑权，避免流程卡死
  - 结算期锁定：终态仅特权角色可修正
  - 归属审计：非特权用户的操作需与身份挂钩并强制填写原因
- 强制审计字段白名单：设备/归属、核心内容、经济/时效等关键字段变更需填写原因
- UI 可见性守卫：编辑/删除入口按条件隐藏，杜绝“点了报错”
- 删除与恢复：墓碑化软删除，限定节点与身份；回收站入口仅特权可见
- View As：Admin/Exec 可模拟其他用户视角，权限边界保持一致

章节来源
- [docs/kb/ticket-permissions.md](file://docs/kb/ticket-permissions.md#L13-L63)
- [server/service/routes/tickets.js](file://server/service/routes/tickets.js#L16-L30)
- [client/src/components/Workspace/UnifiedTicketDetail.tsx](file://client/src/components/Workspace/UnifiedTicketDetail.tsx#L750-L949)
- [client/src/components/Service/DeleteTicketModal.tsx](file://client/src/components/Service/DeleteTicketModal.tsx#L40-L43)

## 架构总览
整体采用“服务端中间件 + 前端 UI 守卫 + 数据层约束”的三层防护：

```mermaid
sequenceDiagram
participant U as "用户"
participant FE as "前端 UI<br/>UnifiedTicketDetail.tsx"
participant MW as "权限中间件<br/>permission.js"
participant API as "工单路由<br/>tickets.js"
participant DB as "数据库<br/>tickets/activities"
U->>FE : 打开工单详情
FE->>FE : 计算可见性守卫活跃/终结期、身份关系
FE-->>U : 显示/隐藏“编辑/删除”入口
U->>FE : 点击“编辑”
FE->>API : 发起 PATCH 请求携带变更与原因
API->>MW : 校验全局访问/穿透访问
MW-->>API : 通过/拒绝
API->>DB : 写入工单与活动时间轴
API-->>FE : 返回成功
FE-->>U : 刷新界面
```

图表来源
- [client/src/components/Workspace/UnifiedTicketDetail.tsx](file://client/src/components/Workspace/UnifiedTicketDetail.tsx#L750-L949)
- [server/service/middleware/permission.js](file://server/service/middleware/permission.js#L107-L182)
- [server/service/routes/tickets.js](file://server/service/routes/tickets.js#L1783-L1813)

## 详细组件分析

### 1) 权限中间件（服务端）
- 全局访问判定：Admin/Exec/MS/GE 拥有全局读写
- JIT 穿透：OP/RD 通过工单关联获取 account_id/serial_number/dealer_id 的受限访问
- Context API 穿透：按 query 参数校验访问边界
- View As：Admin/Exec 可模拟用户身份，保持权限一致性

```mermaid
flowchart TD
Start(["请求进入"]) --> HasUser{"是否已登录?"}
HasUser --> |否| Deny401["返回 401"]
HasUser --> |是| CheckGlobal{"是否全局访问?"}
CheckGlobal --> |是| Next["放行"]
CheckGlobal --> |否| InjectCtx["注入可访问集合<br/>account/serial/dealer"]
InjectCtx --> CheckCtx{"是否越权访问?"}
CheckCtx --> |是| Deny403["返回 403"]
CheckCtx --> |否| Next
```

图表来源
- [server/service/middleware/permission.js](file://server/service/middleware/permission.js#L107-L182)

章节来源
- [server/service/middleware/permission.js](file://server/service/middleware/permission.js#L34-L44)
- [server/service/middleware/permission.js](file://server/service/middleware/permission.js#L50-L96)
- [server/service/middleware/permission.js](file://server/service/middleware/permission.js#L145-L182)
- [server/scripts/test_view_as.js](file://server/scripts/test_view_as.js#L50-L85)

### 2) 工单路由与审计字段白名单
- 审计字段白名单：覆盖设备/归属、内容与诊断、经济责任、时效契约、原始证据等
- 终结期节点：resolved/closed/auto_closed/converted/cancelled 禁止普通用户修改
- 状态机与 SLA：节点变更时更新 SLA 截止时间、状态与超时计数

```mermaid
flowchart TD
Enter(["PATCH /tickets/:id"]) --> IsFinalized{"是否终结期?"}
IsFinalized --> |是| PrivOnly["仅特权可修改"]
IsFinalized --> |否| CheckRel{"是否相关人?"}
CheckRel --> |否| HideUI["前端隐藏入口"]
CheckRel --> |是| AuditFields{"是否修改审计字段?"}
AuditFields --> |否| Save["保存变更"]
AuditFields --> |是| RequireReason["要求填写原因"]
RequireReason --> Save
Save --> RecordAct["记录活动时间轴"]
RecordAct --> SLA["更新 SLA 字段"]
SLA --> Done(["完成"])
```

图表来源
- [server/service/routes/tickets.js](file://server/service/routes/tickets.js#L16-L30)
- [server/service/routes/tickets.js](file://server/service/routes/tickets.js#L32-L33)
- [server/service/routes/tickets.js](file://server/service/routes/tickets.js#L1783-L1813)
- [server/service/sla_service.js](file://server/service/sla_service.js#L132-L172)

章节来源
- [server/service/routes/tickets.js](file://server/service/routes/tickets.js#L16-L30)
- [server/service/routes/tickets.js](file://server/service/routes/tickets.js#L32-L33)
- [server/service/routes/tickets.js](file://server/service/routes/tickets.js#L1783-L1813)
- [server/service/sla_service.js](file://server/service/sla_service.js#L132-L172)

### 3) 前端 UI 权限守卫与交互
- 编辑按钮可见性：特权用户始终可见；活跃期仅相关人可见；终结期隐藏
- 删除菜单可见性：特权用户始终可见；非特权仅 draft/submitted 且创建者/提交者可见
- 审计弹窗：变更审计字段时强制输入原因，支持终结期特权修正提示
- 删除弹窗：根据节点决定是否需要输入工单号确认，并强制填写删除理由

```mermaid
sequenceDiagram
participant UI as "UnifiedTicketDetail.tsx"
participant Modal as "AuditReasonModal.tsx"
participant Del as "DeleteTicketModal.tsx"
participant API as "tickets.js"
UI->>UI : 判断当前节点/身份
UI->>UI : 渲染“编辑/删除”入口
UI->>Modal : 打开审计弹窗若有审计字段变更
Modal-->>UI : 返回修改原因
UI->>API : PATCH /tickets/ : id含原因
UI->>Del : 打开删除弹窗若可删除
Del-->>UI : 返回删除原因/确认
UI->>API : DELETE /tickets/ : id含原因
```

图表来源
- [client/src/components/Workspace/UnifiedTicketDetail.tsx](file://client/src/components/Workspace/UnifiedTicketDetail.tsx#L750-L949)
- [client/src/components/Service/AuditReasonModal.tsx](file://client/src/components/Service/AuditReasonModal.tsx#L1-L338)
- [client/src/components/Service/DeleteTicketModal.tsx](file://client/src/components/Service/DeleteTicketModal.tsx#L1-L383)

章节来源
- [client/src/components/Workspace/UnifiedTicketDetail.tsx](file://client/src/components/Workspace/UnifiedTicketDetail.tsx#L750-L949)
- [client/src/components/Service/AuditReasonModal.tsx](file://client/src/components/Service/AuditReasonModal.tsx#L19-L30)
- [client/src/components/Service/DeleteTicketModal.tsx](file://client/src/components/Service/DeleteTicketModal.tsx#L40-L43)

### 4) 数据模型与索引
统一工单表包含工单类型、状态机节点、SLA 字段、协作机制、账户/联系人/经销商、产品信息、问题分类、维修信息、收款信息、时间追踪、自动关闭、关联工单、渠道代码、审批信息等。配套建立多维索引以支撑查询与统计。

```mermaid
erDiagram
TICKETS {
int id PK
text ticket_number UK
text ticket_type
text current_node
text status
text priority
text sla_due_at
text node_entered_at
text sla_status
int breach_counter
int account_id
int contact_id
int dealer_id
text serial_number
int product_id
text reporter_type
text channel
text problem_summary
text problem_description
text repair_content
int is_warranty
real payment_amount
text created_at
text updated_at
}
TICKET_ACTIVITIES {
int id PK
int ticket_id FK
text activity_type
text content
text metadata
text visibility
int actor_id
text actor_name
text actor_role
text created_at
}
NOTIFICATIONS {
int id PK
int recipient_id
text notification_type
text title
text content
text icon
text related_type
int related_id
text action_url
text metadata
int is_read
text read_at
int is_archived
text created_at
}
TICKETS ||--o{ TICKET_ACTIVITIES : "has"
TICKETS ||--o{ NOTIFICATIONS : "related"
```

图表来源
- [server/service/migrations/020_p2_unified_tickets.sql](file://server/service/migrations/020_p2_unified_tickets.sql#L8-L122)
- [server/service/migrations/020_p2_unified_tickets.sql](file://server/service/migrations/020_p2_unified_tickets.sql#L145-L193)
- [server/service/migrations/020_p2_unified_tickets.sql](file://server/service/migrations/020_p2_unified_tickets.sql#L205-L247)

章节来源
- [server/service/migrations/020_p2_unified_tickets.sql](file://server/service/migrations/020_p2_unified_tickets.sql#L1-L271)

### 5) 状态机与 SLA 更新
- 节点映射：根据 ticket_type 与历史 status 推导 current_node
- 节点变更时计算新的 SLA 截止时间，重置/更新 SLA 状态与超时计数
- 记录状态变更活动，保留审计轨迹

```mermaid
flowchart TD
A["收到节点变更请求"] --> B["计算新节点 SLA 截止时间"]
B --> C{"旧节点是否已超时?"}
C --> |是| D["breach_counter + 1"]
C --> |否| E["保持不变"]
D --> F["更新工单 current_node/sla_due_at/sla_status/breach_counter"]
E --> F
F --> G["记录状态变更活动"]
G --> H["结束"]
```

图表来源
- [server/scripts/fix_ticket_status.js](file://server/scripts/fix_ticket_status.js#L114-L167)
- [server/service/sla_service.js](file://server/service/sla_service.js#L132-L172)
- [server/service/routes/tickets.js](file://server/service/routes/tickets.js#L1783-L1813)

章节来源
- [server/scripts/fix_ticket_status.js](file://server/scripts/fix_ticket_status.js#L114-L167)
- [server/service/sla_service.js](file://server/service/sla_service.js#L132-L172)
- [server/service/routes/tickets.js](file://server/service/routes/tickets.js#L1783-L1813)

## 依赖分析
- 服务端耦合
  - permission.js 作为中间件被多条路由共享，形成统一的“隔离与穿透”策略
  - tickets.js 依赖 permission.js 的全局访问判断与 JIT 穿透能力
  - SLA 服务独立于路由，但被状态机更新流程调用
- 前端耦合
  - UnifiedTicketDetail.tsx 依赖审计字段白名单与终结期节点常量
  - AuditReasonModal.tsx 与 DeleteTicketModal.tsx 与后端接口契约一致（原因字段、节点判断）

```mermaid
graph LR
Perm["permission.js"] --> Routes["tickets.js"]
SLA["sla_service.js"] --> Routes
Routes --> DB["tickets/activities"]
UI["UnifiedTicketDetail.tsx"] --> Routes
Audit["AuditReasonModal.tsx"] --> Routes
Del["DeleteTicketModal.tsx"] --> Routes
```

图表来源
- [server/service/middleware/permission.js](file://server/service/middleware/permission.js#L222-L232)
- [server/service/routes/tickets.js](file://server/service/routes/tickets.js#L1-L14)
- [server/service/sla_service.js](file://server/service/sla_service.js#L124-L172)
- [client/src/components/Workspace/UnifiedTicketDetail.tsx](file://client/src/components/Workspace/UnifiedTicketDetail.tsx#L750-L949)
- [client/src/components/Service/AuditReasonModal.tsx](file://client/src/components/Service/AuditReasonModal.tsx#L1-L338)
- [client/src/components/Service/DeleteTicketModal.tsx](file://client/src/components/Service/DeleteTicketModal.tsx#L1-L383)

章节来源
- [server/service/middleware/permission.js](file://server/service/middleware/permission.js#L1-L232)
- [server/service/routes/tickets.js](file://server/service/routes/tickets.js#L1-L2502)
- [client/src/components/Workspace/UnifiedTicketDetail.tsx](file://client/src/components/Workspace/UnifiedTicketDetail.tsx#L750-L949)
- [client/src/components/Service/AuditReasonModal.tsx](file://client/src/components/Service/AuditReasonModal.tsx#L1-L338)
- [client/src/components/Service/DeleteTicketModal.tsx](file://client/src/components/Service/DeleteTicketModal.tsx#L1-L383)

## 性能考虑
- 查询过滤与索引
  - tickets 表建立多维索引（类型、节点、状态、优先级、SLA、账户/产品/序列号、指派人等），降低复杂过滤成本
  - 列表查询默认排除已删除工单，减少扫描范围
- JIT 穿透
  - 通过工单关联查询 account_id/serial_number/dealer_id，避免全量暴露
- SLA 计算
  - 节点变更时一次性计算并更新，避免运行时重复计算
- 前端渲染
  - UI 守卫在渲染前完成可见性判断，减少无效交互与网络请求

## 故障排查指南
- “编辑/删除入口不显示”
  - 检查当前节点是否为终结期；检查用户身份是否为相关人；确认是否满足“极早期+创建者/提交者”的删除条件
  - 参考：前端 UI 守卫逻辑与终结期节点常量
- “修改关键字段时报错要求原因”
  - 确认是否命中审计字段白名单；确保提交时附带 change_reason
  - 参考：审计字段白名单与前端审计弹窗
- “删除失败或权限不足”
  - 确认当前节点是否在 draft/submitted；确认是否为创建者/提交者；必要时使用管理员权限
  - 参考：删除弹窗与终结期节点判断
- “跨部门/Dealer 权限异常”
  - 使用 View As 功能验证权限边界；检查 permission.js 的全局访问与 JIT 穿透逻辑
  - 参考：View As 测试脚本与中间件

章节来源
- [client/src/components/Workspace/UnifiedTicketDetail.tsx](file://client/src/components/Workspace/UnifiedTicketDetail.tsx#L750-L949)
- [client/src/components/Service/AuditReasonModal.tsx](file://client/src/components/Service/AuditReasonModal.tsx#L19-L30)
- [client/src/components/Service/DeleteTicketModal.tsx](file://client/src/components/Service/DeleteTicketModal.tsx#L40-L43)
- [server/scripts/test_view_as.js](file://server/scripts/test_view_as.js#L144-L192)
- [server/service/middleware/permission.js](file://server/service/middleware/permission.js#L107-L182)

## 结论
本权限体系以“阶梯式风控模型”为核心，结合服务端中间件、前端 UI 守卫与数据层约束，实现了“活跃期放权、结算期锁定、归属审计”的闭环。通过审计字段白名单、强制原因输入、墓碑化软删除与回收站入口，既保障处理效率，又强化风险控制与可追溯性。跨端（Web/iOS）在权限边界上保持一致，配合 View As 与测试脚本，便于验证与排障。