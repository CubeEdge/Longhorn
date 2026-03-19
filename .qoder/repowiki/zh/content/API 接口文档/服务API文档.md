# 服务API文档

<cite>
**本文档引用的文件**
- [API_DOCUMENTATION.md](file://docs/API_DOCUMENTATION.md)
- [Service_API.md](file://docs/Service_API.md)
- [index.js](file://server/index.js)
- [App.tsx](file://client/src/App.tsx)
- [package.json](file://server/package.json)
- [tickets.js](file://server/service/routes/tickets.js)
- [auth.js](file://server/service/routes/auth.js)
- [products.js](file://server/service/routes/products.js)
- [dealers.js](file://server/service/routes/dealers.js)
- [settings.js](file://server/service/routes/settings.js)
- [warranty.js](file://server/service/routes/warranty.js)
- [parts.js](file://server/service/routes/parts.js)
- [permission.js](file://server/service/middleware/permission.js)
- [useAuthStore.ts](file://client/src/store/useAuthStore.ts)
</cite>

## 目录
1. [简介](#简介)
2. [项目结构](#项目结构)
3. [核心组件](#核心组件)
4. [架构概览](#架构概览)
5. [详细组件分析](#详细组件分析)
6. [依赖关系分析](#依赖关系分析)
7. [性能考虑](#性能考虑)
8. [故障排除指南](#故障排除指南)
9. [结论](#结论)

## 简介

Longhorn是一个企业级服务管理系统，提供完整的工单管理、客户服务、产品管理和配件管理功能。该系统采用前后端分离架构，后端基于Node.js + Express，前端使用React + TypeScript构建。

### 系统特性
- **统一工单管理**：支持咨询工单、RMA返厂单、经销商维修单等多种工单类型
- **多部门协作**：基于部门的权限控制系统，支持跨部门协作
- **产品生命周期管理**：从产品注册到保修计算的完整流程
- **配件库存管理**：完整的配件目录和报价系统
- **AI集成**：内置AI助手，支持智能问答和文档处理

## 项目结构

```mermaid
graph TB
subgraph "客户端 (Client)"
A[React应用]
B[前端路由]
C[状态管理]
D[组件库]
end
subgraph "服务端 (Server)"
E[Express服务器]
F[认证中间件]
G[权限控制]
H[业务路由]
I[数据库层]
end
subgraph "数据存储"
J[Better-SQLite3]
K[文件系统]
L[缓存]
end
A --> E
B --> E
C --> E
D --> E
E --> F
E --> G
E --> H
H --> I
I --> J
I --> K
I --> L
```

**图表来源**
- [index.js:1-800](file://server/index.js#L1-800)
- [App.tsx:1-800](file://client/src/App.tsx#L1-800)

**章节来源**
- [index.js:1-800](file://server/index.js#L1-800)
- [App.tsx:1-800](file://client/src/App.tsx#L1-800)

## 核心组件

### 1. 认证系统

系统采用JWT令牌认证机制，支持员工、经销商和客户三种用户类型：

```mermaid
sequenceDiagram
participant Client as 客户端
participant Auth as 认证服务
participant DB as 数据库
participant Token as JWT令牌
Client->>Auth : POST /api/v1/auth/login
Auth->>DB : 验证用户凭据
DB-->>Auth : 用户信息
Auth->>Token : 生成访问令牌
Auth->>Token : 生成刷新令牌
Auth-->>Client : 返回令牌和用户信息
Note over Client,Token : 使用Bearer Token进行身份验证
```

**图表来源**
- [auth.js:17-103](file://server/service/routes/auth.js#L17-103)

### 2. 工单管理系统

统一的工单API，支持多种工单类型和复杂的权限控制：

```mermaid
classDiagram
class Ticket {
+id : number
+ticket_number : string
+ticket_type : string
+current_node : string
+status : string
+account_id : number
+product_id : number
+dealer_id : number
+problem_summary : string
+created_at : string
+updated_at : string
}
class InquiryTicket {
+service_type : string
+channel : string
+communication_log : string
+resolution : string
}
class RMATicket {
+issue_type : string
+issue_category : string
+severity : number
+is_warranty : boolean
+reporter_name : string
}
class DealerRepairTicket {
+repair_content : string
+problem_analysis : string
+solution_for_customer : string
}
Ticket <|-- InquiryTicket
Ticket <|-- RMATicket
Ticket <|-- DealerRepairTicket
```

**图表来源**
- [tickets.js:18-551](file://server/service/routes/tickets.js#L18-551)

### 3. 权限控制系统

基于部门和角色的细粒度权限管理：

```mermaid
flowchart TD
A[用户请求] --> B{检查用户类型}
B --> |Admin/Exec| C[完全访问权限]
B --> |MS部门| D[全局CRM访问]
B --> |OP/RD部门| E{检查工单关联}
B --> |Dealer| F[有限访问权限]
E --> |有工单关联| G[JIT穿透访问]
E --> |无工单关联| H[拒绝访问]
G --> I[访问受限资源]
C --> I
D --> I
F --> J[访问经销商专属功能]
```

**图表来源**
- [permission.js:34-138](file://server/service/middleware/permission.js#L34-138)

**章节来源**
- [auth.js:17-282](file://server/service/routes/auth.js#L17-282)
- [tickets.js:18-800](file://server/service/routes/tickets.js#L18-800)
- [permission.js:1-232](file://server/service/middleware/permission.js#L1-232)

## 架构概览

### 系统架构图

```mermaid
graph TB
subgraph "表现层"
Web[Web客户端]
Mobile[iOS客户端]
Admin[管理面板]
end
subgraph "API网关"
Auth[认证服务]
Ticket[工单服务]
CRM[客户关系服务]
Product[产品服务]
Parts[配件服务]
end
subgraph "业务逻辑层"
TicketCore[工单核心逻辑]
Warranty[Warranty计算引擎]
Quote[报价引擎]
Context[上下文查询]
end
subgraph "数据层"
SQLite[Better-SQLite3]
FS[文件系统]
Cache[内存缓存]
end
Web --> Auth
Mobile --> Auth
Admin --> Auth
Auth --> Ticket
Ticket --> TicketCore
CRM --> Context
Product --> Warranty
Parts --> Quote
TicketCore --> SQLite
Warranty --> SQLite
Quote --> SQLite
Context --> SQLite
SQLite --> FS
SQLite --> Cache
```

**图表来源**
- [index.js:1-800](file://server/index.js#L1-800)
- [tickets.js:1-800](file://server/service/routes/tickets.js#L1-800)

### 数据流图

```mermaid
sequenceDiagram
participant User as 用户
participant API as API层
participant Business as 业务逻辑
participant DB as 数据库
participant Storage as 文件存储
User->>API : 发送请求
API->>Business : 调用业务方法
Business->>DB : 查询/更新数据
DB-->>Business : 返回数据
Business->>Storage : 文件操作
Storage-->>Business : 文件信息
Business-->>API : 处理结果
API-->>User : 响应数据
```

**图表来源**
- [index.js:655-729](file://server/index.js#L655-729)

**章节来源**
- [index.js:1-800](file://server/index.js#L1-800)

## 详细组件分析

### 认证与授权组件

#### JWT令牌管理

系统使用JWT进行身份验证，支持访问令牌和刷新令牌：

| 组件 | 功能 | 安全特性 |
|------|------|----------|
| 访问令牌 | 短期身份验证 | 24小时有效期 |
| 刷新令牌 | 获取新的访问令牌 | 7天有效期 |
| 用户信息 | 包含角色、部门、权限 | 动态权限加载 |

#### 权限控制机制

```mermaid
flowchart LR
A[用户登录] --> B[生成JWT令牌]
B --> C[权限解析]
C --> D{用户类型}
D --> |Admin/Exec| E[超级管理员权限]
D --> |MS部门| F[全局CRM访问]
D --> |OP/RD部门| G[JIT穿透访问]
D --> |Dealer| H[经销商专用权限]
E --> I[完全访问]
F --> I
G --> J[工单关联访问]
H --> K[有限访问]
```

**图表来源**
- [auth.js:213-278](file://server/service/routes/auth.js#L213-278)
- [permission.js:34-138](file://server/service/middleware/permission.js#L34-138)

**章节来源**
- [auth.js:17-282](file://server/service/routes/auth.js#L17-282)
- [permission.js:1-232](file://server/service/middleware/permission.js#L1-232)

### 工单管理组件

#### 工单类型与生命周期

系统支持三种主要工单类型：

| 工单类型 | 编号格式 | 用途 | 关键字段 |
|----------|----------|------|----------|
| 咨询工单 | KYYMM-XXXX | 问题咨询、技术支持 | service_type, channel, problem_summary |
| RMA返厂单 | RMA-{C/D}-YYMM-XXXX | 设备返厂维修 | issue_type, issue_category, severity |
| 经销商维修单 | SVC-D-YYMM-XXXX | 经销商现场维修 | repair_content, problem_analysis |

#### 工单状态流转

```mermaid
stateDiagram-v2
[*] --> 草稿
草稿 --> 提交
提交 --> 市场审核
市场审核 --> 等待客户反馈
市场审核 --> 市场关闭
等待客户反馈 --> 提交
等待客户反馈 --> 解决
解决 --> [*]
市场关闭 --> [*]
```

**图表来源**
- [tickets.js:371-397](file://server/service/routes/tickets.js#L371-397)

**章节来源**
- [tickets.js:1-800](file://server/service/routes/tickets.js#L1-800)

### 产品管理组件

#### 保修计算引擎

系统实现了复杂的保修计算逻辑，支持五级优先级：

```mermaid
flowchart TD
A[开始计算] --> B{检查物理损坏}
B --> |是| C[保修失效]
B --> |否| D{检查IoT激活}
D --> |有| E[IoT激活日期]
D --> |无| F{检查销售发票}
F --> |有| G[销售发票日期]
F --> |无| H{检查手动登记}
H --> |有| I[手动登记日期]
H --> |无| J{检查直发日期}
J --> |直发| K[直发+7天]
J --> |经销商| L[经销商+90天]
J --> |无| M[无法确定]
E --> N[计算结束]
G --> N
I --> N
K --> N
L --> N
C --> O[最终状态: 保修失效]
M --> P[最终状态: 无法确定]
```

**图表来源**
- [warranty.js:211-285](file://server/service/routes/warranty.js#L211-285)

#### 产品注册流程

```mermaid
sequenceDiagram
participant User as 用户
participant API as 产品API
participant DB as 数据库
participant Calc as 保修计算
User->>API : POST /api/v1/products/register-warranty
API->>DB : 检查产品是否存在
DB-->>API : 产品信息
API->>Calc : 计算保修期
Calc-->>API : 保修开始/结束日期
API->>DB : 更新产品信息
DB-->>API : 更新结果
API-->>User : 返回注册结果
```

**图表来源**
- [products.js:136-332](file://server/service/routes/products.js#L136-332)

**章节来源**
- [products.js:1-388](file://server/service/routes/products.js#L1-388)
- [warranty.js:1-286](file://server/service/routes/warranty.js#L1-286)

### 配件管理组件

#### 配件目录管理

系统提供完整的配件目录管理功能：

| 功能模块 | 描述 | 关键特性 |
|----------|------|----------|
| 配件查询 | 支持按分类、型号、关键词搜索 | 多维度过滤、分页支持 |
| 价格管理 | 成本价、零售价、经销商价 | 多价格体系 |
| 库存控制 | 最低库存预警、补货提醒 | 自动化库存管理 |
| 适用性管理 | 适配产品型号列表 | 智能匹配算法 |

#### 报价系统

```mermaid
classDiagram
class Quotation {
+id : number
+quotation_number : string
+issue_id : number
+total_amount : number
+currency : string
+status : string
+valid_until : string
+line_items : LineItem[]
}
class LineItem {
+id : number
+item_type : string
+description : string
+quantity : number
+unit_price : number
+total_price : number
}
class LaborRate {
+rate_type : string
+hourly_rate : number
+region : string
}
Quotation --> LineItem
Quotation --> LaborRate
```

**图表来源**
- [parts.js:257-475](file://server/service/routes/parts.js#L257-475)

**章节来源**
- [parts.js:1-660](file://server/service/routes/parts.js#L1-660)

### 系统设置组件

#### 备份管理

系统提供自动备份功能，支持主备份和次备份：

| 备份类型 | 频率 | 保留天数 | 触发方式 |
|----------|------|----------|----------|
| 主备份 | 默认180分钟 | 7天 | 自动/手动 |
| 次备份 | 默认1440分钟 | 30天 | 自动/手动 |

#### AI集成

```mermaid
graph LR
A[AI配置] --> B[模型提供商]
B --> C[DeepSeek]
B --> D[Gemini]
B --> E[自定义]
A --> F[功能开关]
F --> G[AI问答]
F --> H[文档分析]
F --> I[智能搜索]
A --> J[使用统计]
J --> K[每日用量]
J --> L[成本估算]
```

**图表来源**
- [settings.js:20-334](file://server/service/routes/settings.js#L20-334)

**章节来源**
- [settings.js:1-334](file://server/service/routes/settings.js#L1-334)

## 依赖关系分析

### 服务端依赖

```mermaid
graph TB
subgraph "核心依赖"
A[express] --> B[Web框架]
C[better-sqlite3] --> D[数据库驱动]
E[multer] --> F[文件上传]
G[jwt] --> H[令牌认证]
end
subgraph "工具库"
I[bcryptjs] --> J[密码加密]
K[sharp] --> L[图像处理]
M[axios] --> N[HTTP客户端]
end
subgraph "开发工具"
O[nodemon] --> P[热重载]
Q[dotenv] --> R[环境变量]
end
```

**图表来源**
- [package.json:15-39](file://server/package.json#L15-39)

### 前端依赖

```mermaid
graph TB
subgraph "React生态"
A[react] --> B[核心库]
C[react-router-dom] --> D[路由管理]
E[zustand] --> F[状态管理]
G[axios] --> H[HTTP请求]
end
subgraph "UI组件"
I[lucide-react] --> J[图标库]
K[swr] --> L[数据缓存]
end
subgraph "国际化"
M[i18next] --> N[多语言支持]
O[react-i18next] --> P[React集成]
end
```

**图表来源**
- [App.tsx:1-800](file://client/src/App.tsx#L1-800)

**章节来源**
- [package.json:1-41](file://server/package.json#L1-41)
- [App.tsx:1-800](file://client/src/App.tsx#L1-800)

## 性能考虑

### 缓存策略

系统采用了多层次的缓存机制：

1. **数据库查询缓存**：使用SQLite的查询缓存机制
2. **文件系统缓存**：缩略图和预览文件缓存
3. **前端数据缓存**：SWR实现的智能缓存策略
4. **内存缓存**：热点数据的内存缓存

### 性能优化

```mermaid
flowchart TD
A[请求到达] --> B{检查缓存}
B --> |命中| C[直接返回缓存]
B --> |未命中| D[数据库查询]
D --> E[查询优化]
E --> F[结果缓存]
F --> G[返回响应]
C --> G
```

### 扩展性设计

- **微服务架构**：每个功能模块独立部署
- **水平扩展**：支持多实例部署
- **异步处理**：大量数据处理采用队列机制
- **CDN集成**：静态资源通过CDN加速

## 故障排除指南

### 常见问题

#### 认证问题

| 问题 | 可能原因 | 解决方案 |
|------|----------|----------|
| 401未认证 | 令牌过期或无效 | 使用刷新令牌获取新令牌 |
| 403权限不足 | 用户权限不足 | 检查用户角色和部门权限 |
| 404用户不存在 | 用户ID错误 | 验证用户ID的有效性 |

#### 数据库连接问题

| 问题 | 可能原因 | 解决方案 |
|------|----------|----------|
| 连接超时 | 数据库繁忙 | 增加连接池大小 |
| 查询缓慢 | 缺少索引 | 添加必要的数据库索引 |
| 内存溢出 | 大数据集处理 | 实施分页和流式处理 |

#### 文件上传问题

| 问题 | 可能原因 | 解决方案 |
|------|----------|----------|
| 上传失败 | 磁盘空间不足 | 清理磁盘空间 |
| 分片上传错误 | 网络中断 | 实现断点续传机制 |
| 文件损坏 | 编码问题 | 检查文件编码和格式 |

**章节来源**
- [index.js:655-729](file://server/index.js#L655-729)

## 结论

Longhorn服务管理系统是一个功能完整、架构清晰的企业级解决方案。系统的主要优势包括：

### 核心优势

1. **完整的业务覆盖**：从客户服务到产品管理的全流程支持
2. **灵活的权限控制**：基于角色和工单关联的细粒度权限管理
3. **强大的扩展性**：模块化的架构设计支持功能扩展
4. **优秀的用户体验**：直观的界面和高效的响应速度

### 技术亮点

1. **统一的工单管理**：支持多种工单类型的统一处理
2. **智能的保修计算**：基于复杂逻辑的保修期计算
3. **完善的配件管理**：从采购到使用的完整生命周期管理
4. **AI集成能力**：内置AI助手提升工作效率

### 发展建议

1. **API版本控制**：建议引入API版本控制机制
2. **错误码标准化**：统一错误响应格式
3. **实时通信**：考虑WebSocket或推送通知减少服务器负载
4. **监控告警**：完善系统监控和告警机制

该系统为企业提供了强大的数字化服务能力，能够有效提升客户服务质量和运营效率。