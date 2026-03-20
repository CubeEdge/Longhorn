# 服务 API 文档

<cite>
**本文档引用的文件**
- [API 文档](file://docs/API_DOCUMENTATION.md)
- [服务 API 设计文档](file://docs/Service_API.md)
- [服务端入口](file://server/index.js)
- [工单路由](file://server/service/routes/tickets.js)
- [权限中间件](file://server/service/middleware/permission.js)
- [上传路由](file://server/service/routes/upload.js)
- [附件计数迁移](file://server/migrations/039_add_attachments_count.sql)
- [附件检查脚本](file://server/scripts/check_attachments.js)
- [工单活动路由](file://server/service/routes/ticket-activities.js)
- [RMA文档路由](file://server/service/routes/rma-documents.js)
- [产品路由](file://server/service/routes/products.js)
- [设置路由](file://server/service/routes/settings.js)
- [系统路由](file://server/service/routes/system.js)
- [PI编辑器](file://client/src/components/Workspace/PIEditor.tsx)
- [知识库审计日志路由](file://server/service/routes/knowledge_audit.js)
- [知识库审计日志SQL](file://server/migrations/add_knowledge_audit_log.sql)
- [AI服务](file://server/service/ai_service.js)
- [Bokeh聊天路由](file://server/service/routes/bokeh.js)
- [维修报告编辑器](file://client/src/components/Workspace/RepairReportEditor.tsx)
- [知识库审计日志前端](file://client/src/components/KnowledgeAuditLog.tsx)
</cite>

## 更新摘要
**变更内容**
- 新增维修报告管理API，支持完整的维修报告生命周期管理
- 集成AI翻译服务，提供Bokeh AI翻译功能
- 增强权限控制系统，实现穿透式权限中间件
- 新增知识库审计日志API，提供完整的操作追踪功能

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

Longhorn 服务 API 是一个基于 Node.js 和 Express 的现代化服务系统，专为 Kinefinity 的产品服务管理而设计。该系统提供了完整的工单管理、客户服务、产品管理和经销商管理功能，并集成了先进的文档管理和配置管理能力。

### 主要特性

- **统一工单系统**：支持咨询工单、RMA 返厂单、经销商维修单的统一管理
- **多租户架构**：支持内部员工、经销商、终端客户等多角色访问
- **智能权限控制**：基于部门和角色的细粒度权限管理，支持穿透式访问控制
- **实时协作**：支持工单参与者协作和通知系统
- **数据安全保障**：完整的审计日志和数据脱敏机制
- **附件管理**：完整的工单附件上传、存储和访问控制
- **文档管理**：PI和维修报告的全生命周期管理
- **配置管理**：灵活的产品下拉设置和系统配置选项
- **AI翻译服务**：集成Bokeh AI翻译功能，支持多语言维修报告处理
- **知识库审计**：完整的知识库操作追踪和统计分析

## 项目结构

Longhorn 项目采用模块化的三层架构设计：

```mermaid
graph TB
subgraph "客户端层"
Web[Web 客户端]
iOS[iOS 客户端]
end
subgraph "服务端层"
API[API 网关]
Auth[认证中间件]
Routes[路由模块]
Services[业务服务]
AI[AI服务层]
end
subgraph "数据层"
DB[(SQLite 数据库)]
FS[(文件系统)]
Cache[(缓存)]
Audit[审计日志]
end
Web --> API
iOS --> API
API --> Auth
API --> Routes
API --> AI
Routes --> Services
Services --> DB
Services --> FS
Services --> Cache
Services --> Audit
AI --> DB
```

**图表来源**
- [服务端入口:1-800](file://server/index.js#L1-800)
- [前端应用入口:1-800](file://client/src/App.tsx#L1-800)

**章节来源**
- [服务端入口:1-800](file://server/index.js#L1-800)
- [API 文档:1-105](file://docs/API_DOCUMENTATION.md#L1-105)

## 核心组件

### 1. 认证与授权系统

系统采用 JWT 令牌进行身份验证，支持多种用户类型：

| 用户类型 | 权限范围 | 访问范围 |
|---------|----------|----------|
| Admin | 系统管理员 | 全部数据 |
| Exec | 执行官 | 全部数据 |
| Lead | 部门主管 | 部门内数据 |
| Member | 普通成员 | 个人和部门数据 |
| Dealer | 经销商用户 | 自身客户数据 |

**新增** 穿透式权限中间件，实现隔离与穿透的权限控制机制：

- **隔离原则**：OP/RD 部门默认无权访问 CRM/IB，仅通过工单获得 JIT 穿透
- **穿透机制**：通过工单关联查询可访问的客户、设备和经销商列表
- **全局权限**：MS 部门人员和 Admin/Exec 拥有全局读写权限
- **GE 部门**：通用台面部门作为平台管理员拥有特殊权限

### 2. 工单管理系统

统一的工单架构支持三种工单类型：

```mermaid
classDiagram
class Ticket {
+string id
+string ticket_number
+string ticket_type
+string status
+string current_node
+datetime created_at
+datetime updated_at
+int attachments_count
}
class InquiryTicket {
+string service_type
+string problem_summary
+string communication_log
}
class RMATicket {
+string issue_type
+string issue_category
+string severity
+boolean is_warranty
}
class DealerRepairTicket {
+string repair_content
+string solution_for_customer
}
Ticket <|-- InquiryTicket
Ticket <|-- RMATicket
Ticket <|-- DealerRepairTicket
```

**图表来源**
- [工单路由:1-800](file://server/service/routes/tickets.js#L1-800)

### 3. 文档管理系统

系统提供完整的文档管理能力，特别是PI和维修报告的全生命周期管理：

```mermaid
classDiagram
class ProformaInvoice {
+string id
+string pi_number
+string status
+string ticket_id
+object content
+number subtotal
+number tax_amount
+number total_amount
+string currency
+number version
+datetime created_at
+datetime updated_at
}
class RepairReport {
+string id
+string report_number
+string status
+string ticket_id
+object content
+string service_type
+number total_cost
+string currency
+string warranty_status
+number version
+datetime created_at
+datetime updated_at
}
ProformaInvoice <|-- RepairReport
```

**图表来源**
- [RMA文档路由:1-800](file://server/service/routes/rma-documents.js#L1-800)

### 4. 知识库审计系统

**新增** 完整的知识库操作审计日志系统：

```mermaid
classDiagram
class KnowledgeAuditLog {
+int id
+string operation
+string operation_detail
+int article_id
+string article_title
+string article_slug
+string category
+string product_line
+string product_models
+string changes_summary
+string old_status
+string new_status
+string source_type
+string source_reference
+string batch_id
+int user_id
+string user_name
+string user_role
+datetime created_at
}
class DocumentAuditLog {
+int id
+string document_type
+int document_id
+string action
+int user_id
+string user_name
+string changes_summary
+string comment
+datetime created_at
}
KnowledgeAuditLog <|-- DocumentAuditLog
```

**图表来源**
- [知识库审计日志SQL:1-50](file://server/migrations/add_knowledge_audit_log.sql#L1-L50)

### 5. AI翻译服务系统

**新增** 集成Bokeh AI翻译服务：

```mermaid
flowchart TD
AIAPI[AI API] --> AIService[AI服务层]
AIService --> BokehChat[Bokeh聊天端点]
AIService --> TicketParsing[Ticket解析]
AIService --> KnowledgeOptimization[知识库优化]
BokehChat --> RepairReport[维修报告翻译]
BokehChat --> KnowledgeTranslate[知识库翻译]
TicketParsing --> TicketExtraction[工单信息提取]
KnowledgeOptimization --> ContentFormatting[内容排版优化]
```

**图表来源**
- [AI服务:1-666](file://server/service/ai_service.js#L1-L666)
- [Bokeh聊天路由:1-42](file://server/service/routes/bokeh.js#L1-L42)

### 6. 数据模型架构

```mermaid
erDiagram
ACCOUNTS {
int id PK
string account_number
string name
string account_type
string email
string phone
string region
string service_tier
boolean is_active
datetime created_at
}
CONTACTS {
int id PK
int account_id FK
string name
string email
string phone
string status
boolean is_primary
datetime created_at
}
PRODUCTS {
int id PK
string model_name
string serial_number
string product_family
string warranty_status
datetime created_at
}
TICKETS {
int id PK
string ticket_number
string ticket_type
string status
string current_node
int account_id FK
int product_id FK
int attachments_count
datetime created_at
}
TICKETS ||--o{ TICKET_ATTACHMENTS : "包含"
TICKETS ||--o{ PROFORMA_INVOICES : "关联"
TICKETS ||--o{ REPAIR_REPORTS : "关联"
ACCOUNTS ||--o{ CONTACTS : "包含"
ACCOUNTS ||--o{ TICKETS : "关联"
PRODUCTS ||--o{ TICKETS : "关联"
PROFORMA_INVOICES ||--|| KNOWLEDGE_AUDIT_LOG : "审计"
REPAIR_REPORTS ||--|| KNOWLEDGE_AUDIT_LOG : "审计"
```

**图表来源**
- [工单路由:1380-1395](file://server/service/routes/tickets.js#L1380-L1395)
- [权限中间件:34-44](file://server/service/middleware/permission.js#L34-L44)
- [附件计数迁移:1-11](file://server/migrations/039_add_attachments_count.sql#L1-L11)
- [RMA文档路由:1-800](file://server/service/routes/rma-documents.js#L1-800)

**章节来源**
- [服务 API 设计文档:1-800](file://docs/Service_API.md#L1-800)
- [工单路由:1-800](file://server/service/routes/tickets.js#L1-800)

## 架构概览

### 1. API 设计原则

系统遵循 RESTful API 设计原则，采用版本化 URL 结构：

```
/api/v1/endpoint
```

**响应格式规范**：
```json
{
  "success": true,
  "data": {},
  "meta": {
    "page": 1,
    "page_size": 20,
    "total": 100
  }
}
```

### 2. 错误处理机制

```mermaid
flowchart TD
Request[API 请求] --> Validate[参数验证]
Validate --> Valid{验证通过?}
Valid --> |否| ValidationError[返回验证错误]
Valid --> |是| Process[处理请求]
Process --> Success[成功响应]
Process --> Error[处理错误]
Error --> ErrorResponse[返回错误响应]
ValidationError --> End[结束]
Success --> End
ErrorResponse --> End
```

**图表来源**
- [服务端入口:655-729](file://server/index.js#L655-729)

### 3. 权限控制流程

```mermaid
sequenceDiagram
participant Client as 客户端
participant Auth as 认证中间件
participant Perm as 权限检查
participant DB as 数据库
Client->>Auth : 发送带令牌的请求
Auth->>Auth : 验证 JWT 令牌
Auth->>DB : 查询用户信息
DB-->>Auth : 返回用户详情
Auth->>Perm : 检查资源权限
Perm->>Perm : 验证角色和部门
Perm->>Perm : 应用穿透式访问控制
Perm-->>Auth : 权限检查结果
Auth-->>Client : 授权或拒绝
```

**图表来源**
- [服务端入口:655-729](file://server/index.js#L655-729)
- [权限中间件:34-44](file://server/service/middleware/permission.js#L34-L44)

**章节来源**
- [服务 API 设计文档:35-84](file://docs/Service_API.md#L35-84)
- [服务端入口:655-729](file://server/index.js#L655-729)

## 详细组件分析

### 1. 工单管理 API

#### 1.1 工单创建流程

```mermaid
sequenceDiagram
participant Client as 客户端
participant API as 工单 API
participant Validator as 参数验证器
participant DB as 数据库
participant Workflow as 工作流引擎
Client->>API : POST /api/v1/tickets
API->>Validator : 验证必填字段
Validator-->>API : 验证结果
API->>DB : 插入工单记录
DB-->>API : 返回工单ID
API->>Workflow : 触发自动分配
Workflow-->>API : 返回分配结果
API-->>Client : 返回创建的工单
```

**图表来源**
- [工单路由:557-776](file://server/service/routes/tickets.js#L557-776)

#### 1.2 工单状态流转

```mermaid
stateDiagram-v2
[*] --> draft : 创建工单
draft --> submitted : 提交审核
submitted --> ms_review : 市场部审核
ms_review --> op_receiving : 运营部接收
op_receiving --> op_diagnosing : 诊断
op_diagnosing --> op_repairing : 维修
op_repairing --> op_shipping : 发货
op_shipping --> op_qa : 质检
op_qa --> resolved : 已解决
resolved --> closed : 关闭
ms_review --> waiting_customer : 等待客户反馈
waiting_customer --> ms_review : 继续处理
```

**图表来源**
- [工单路由:56-61](file://server/service/routes/tickets.js#L56-L61)

#### 1.3 工单查询接口

| 接口 | 方法 | 功能 | 权限 |
|------|------|------|------|
| `/api/v1/tickets` | GET | 查询工单列表 | 所有登录用户 |
| `/api/v1/tickets/:id` | GET | 获取工单详情 | 相关用户 |
| `/api/v1/tickets` | POST | 创建新工单 | 市场部、经销商 |
| `/api/v1/tickets/:id` | PATCH | 更新工单 | 相关用户 |
| `/api/v1/tickets/:id/attachments` | POST | 添加附件 | 相关用户 |
| `/api/v1/tickets/:id/attachments/:attachId` | DELETE | 删除附件 | 相关用户 |

**更新** 新增工单附件管理API端点，支持工单级附件上传和删除

#### 1.4 工单附件管理API

**附件上传接口**：
- **URL**: `POST /api/v1/tickets/:id/attachments`
- **权限**: Admin、Exec、MS部门主管、工单创建者
- **文件限制**: 最多10个文件，单个文件大小限制
- **返回**: 附件列表，包含下载URL和缩略图URL

**附件删除接口**：
- **URL**: `DELETE /api/v1/tickets/:id/attachments/:attachId`
- **权限**: Admin、Exec、MS部门主管、附件上传者本人
- **功能**: 删除指定附件并清理文件系统

**权限控制机制**：
- `canUpload()` 函数验证上传权限
- `canDelete()` 函数验证删除权限
- 支持部门级权限继承（MS部门全局读写）

**章节来源**
- [工单路由:2739-2852](file://server/service/routes/tickets.js#L2739-L2852)

### 2. 上下文查询 API

#### 2.1 客户上下文查询

系统提供三种上下文查询方式：

```mermaid
flowchart TD
CustomerQuery[客户上下文查询] --> ByCustomer[按客户ID查询]
CustomerQuery --> ByAccount[按账户ID查询]
CustomerQuery --> BySN[按序列号查询]
ByCustomer --> CustomerProfile[客户档案]
ByCustomer --> DeviceHistory[设备历史]
ByCustomer --> ServiceHistory[服务历史]
ByAccount --> AccountInfo[账户信息]
ByAccount --> ContactList[联系人列表]
ByAccount --> DeviceAssets[设备资产]
BySN --> DeviceInfo[设备信息]
BySN --> DeviceHistory[设备历史]
BySN --> OwnershipHistory[所有权历史]
```

**图表来源**
- [上下文查询路由:12-175](file://server/service/routes/context.js#L12-175)

#### 2.2 数据脱敏机制

```mermaid
flowchart TD
Data[原始数据] --> CheckRole{检查用户角色}
CheckRole --> |Admin/Exec| FullAccess[完全访问权限]
CheckRole --> |MS| CommercialView[商业视图]
CheckRole --> |OP/RD| TechnicianView[技术视图]
CommercialView --> MaskSensitive[脱敏敏感信息]
TechnicianView --> MaskSensitive
FullAccess --> ReturnData[返回完整数据]
MaskSensitive --> ReturnData
```

**图表来源**
- [上下文查询路由:137-158](file://server/service/routes/context.js#L137-158)

**章节来源**
- [上下文查询路由:12-484](file://server/service/routes/context.js#L12-484)

### 3. 产品管理 API

#### 3.1 产品下拉设置管理

**新增** 系统现在支持灵活的产品下拉设置配置：

```mermaid
flowchart TD
ProductDropdown[产品下拉设置] --> FamilyVisibility[产品系列可见性]
ProductDropdown --> TypeFilter[产品类型过滤]
ProductDropdown --> AllowedTypes[允许的产品类型]
FamilyVisibility --> ShowFamilyA[显示A系列]
FamilyVisibility --> ShowFamilyB[显示B系列]
FamilyVisibility --> ShowFamilyC[显示C系列]
FamilyVisibility --> ShowFamilyD[显示D系列]
FamilyVisibility --> ShowFamilyE[显示E系列]
TypeFilter --> EnableTypeFilter[启用类型过滤]
AllowedTypes --> ProductTypes[产品类型列表]
ProductTypes --> Camera[相机]
ProductTypes --> EVF[电子寻像器]
ProductTypes --> Accessory[配件]
```

**图表来源**
- [系统路由:51-62](file://server/service/routes/system.js#L51-L62)
- [设置路由:86-94](file://server/service/routes/settings.js#L86-L94)

**产品下拉设置接口**：
- **GET** `/api/v1/system/public-settings` - 获取公共产品下拉设置
- **POST** `/api/v1/admin/settings` - 更新产品下拉设置

**设置选项**：
- `show_family_a/b/c/d/e` - 控制各产品系列的显示
- `enable_product_type_filter` - 启用产品类型过滤
- `allowed_product_types` - 允许的产品类型列表

#### 3.2 保修管理流程

```mermaid
flowchart TD
WarrantyCheck[保修状态检查] --> CheckSerial[检查序列号]
CheckSerial --> ProductFound{产品存在?}
ProductFound --> |是| CheckWarranty[检查保修基础]
ProductFound --> |否| NeedRegistration[需要注册]
CheckWarranty --> HasBasis{有保修基础?}
HasBasis --> |是| ActiveWarranty[有效保修]
HasBasis --> |否| CanUseFallback[使用后备规则]
CanUseFallback --> FallbackEligible{后备规则适用?}
FallbackEligible --> |是| CreateWarranty[创建保修]
FallbackEligible --> |否| NoWarranty[无保修]
NeedRegistration --> RegisterWarranty[注册保修]
RegisterWarranty --> CalculateWarranty[计算保修期]
CalculateWarranty --> CreateWarranty
CreateWarranty --> ActiveWarranty
```

**图表来源**
- [产品路由:37-120](file://server/service/routes/products.js#L37-120)
- [产品路由:136-332](file://server/service/routes/products.js#L136-332)

#### 3.3 保修计算引擎

系统采用瀑布式计算逻辑：

| 优先级 | 条件 | 保修开始日期来源 |
|--------|------|------------------|
| 1 | IoT 激活日期 | IOT_ACTIVATION |
| 2 | 销售发票日期 | INVOICE_PROOF |
| 3 | 手动注册日期 | REGISTRATION |
| 4 | 直销发货日期 + 7天 | DIRECT_SHIPMENT |
| 5 | 经销商发货日期 + 90天 | DEALER_FALLBACK |

**更新** 产品路由验证逻辑得到增强，提升了数据验证的准确性

**章节来源**
- [产品路由:334-384](file://server/service/routes/products.js#L334-384)

### 4. 客户与经销商管理

#### 4.1 账户架构

```mermaid
classDiagram
class Account {
+int id
+string account_number
+string name
+string account_type
+string service_tier
+boolean is_active
+string region
}
class Contact {
+int id
+int account_id
+string name
+string email
+string phone
+string status
+boolean is_primary
}
class Dealer {
+string dealer_code
+string dealer_level
+boolean can_repair
+string repair_level
}
class Organization {
+string industry_tags
+string country
+string city
}
class Individual {
+string email
+string phone
}
Account <|-- Dealer
Account <|-- Organization
Account <|-- Individual
Account --> Contact : "包含"
```

**图表来源**
- [账户路由:1-800](file://server/service/routes/accounts.js#L1-800)

#### 4.2 经销商管理

| 接口 | 方法 | 功能 | 权限 |
|------|------|------|------|
| `/api/v1/dealers` | GET | 获取经销商列表 | 市场部、管理员 |
| `/api/v1/dealers/:id` | GET | 获取经销商详情 | 市场部、管理员 |
| `/api/v1/dealers` | POST | 创建经销商 | 管理员 |
| `/api/v1/dealers/:id` | PATCH | 更新经销商 | 管理员 |
| `/api/v1/dealers/:id/issues` | GET | 获取经销商工单 | 市场部、管理员 |

**章节来源**
- [经销商路由:16-321](file://server/service/routes/dealers.js#L16-321)

### 5. 工单详情接口增强

**更新** 工单详情接口现已支持完整的附件返回：

```mermaid
flowchart TD
GetTicket[GET /api/v1/tickets/:id] --> LoadTicket[加载工单基本信息]
LoadTicket --> LoadActivities[加载工单活动]
LoadActivities --> LoadAttachments[加载所有附件]
LoadAttachments --> LoadParticipants[加载参与者]
LoadParticipants --> ReturnResponse[返回完整响应]
```

**图表来源**
- [工单路由:1381-1457](file://server/service/routes/tickets.js#L1381-L1457)

**响应结构增强**：
- 新增 `attachments` 数组，包含所有附件信息
- 新增 `attachments_count` 字段，显示附件总数
- 每个附件包含下载URL和缩略图URL

**章节来源**
- [工单路由:1381-1457](file://server/service/routes/tickets.js#L1381-L1457)

### 6. 附件查询优化

**更新** 附件查询已进行优化，支持更高效的工单附件检索：

```mermaid
flowchart TD
OptimizeQuery[优化附件查询] --> IndexScan[索引扫描]
IndexScan --> DirectLookup[直接查找]
DirectLookup --> CacheHit{缓存命中?}
CacheHit --> |是| FastReturn[快速返回]
CacheHit --> |否| DBQuery[数据库查询]
DBQuery --> UpdateCache[更新缓存]
UpdateCache --> FastReturn
```

**优化特性**：
- 使用 `ticket_attachments` 表的索引进行快速查找
- 支持工单级附件的批量查询
- 实现附件URL的即时生成，无需额外查询
- 支持图片附件的缩略图URL生成

**章节来源**
- [工单路由:1381-1395](file://server/service/routes/tickets.js#L1381-L1395)

### 7. 权限控制增强

**更新** 权限控制机制已增强，支持更精细的权限管理：

```mermaid
flowchart TD
PermissionCheck[权限检查] --> CheckRole{检查用户角色}
CheckRole --> |Admin/Exec| GlobalAccess[全局访问权限]
CheckRole --> |MS Lead| MSAccess[MS部门访问权限]
CheckRole --> |Normal User| RestrictedAccess[受限访问权限]
GlobalAccess --> Allow[允许访问]
MSAccess --> CheckDepartment{检查部门}
CheckDepartment --> |MS Department| Allow
CheckDepartment --> |Other Department| Deny[拒绝访问]
RestrictedAccess --> CheckTicket{检查工单关联}
CheckTicket --> |相关工单| Allow
CheckTicket --> |无关工单| Deny
```

**权限函数增强**：
- `hasGlobalAccess()` 函数判断全局访问权限
- 支持 Admin、Exec、MS 部门人员的全局权限
- 实现部门级权限的精细化控制

**章节来源**
- [权限中间件:34-44](file://server/service/middleware/permission.js#L34-L44)

### 8. 附件存储和访问控制机制

**更新** 附件存储系统已进行全面优化：

**存储架构**：
- **临时文件存储**：使用 `SERVICE_TEMP_DIR` 存储上传的临时文件
- **永久文件存储**：使用 `/Volumes/fileserver/Service` 远程文件服务器
- **目录结构**：`Service/Tickets/{类型}/{工单号}/`

**访问控制**：
- **权限验证**：每个附件访问都必须通过用户权限验证
- **路径安全**：防止目录遍历攻击
- **文件类型限制**：支持的文件类型包括图片和PDF
- **缩略图生成**：自动为图片附件生成缩略图

**章节来源**
- [服务端入口:46-57](file://server/index.js#L46-L57)
- [服务端入口:20-40](file://server/index.js#L20-L40)
- [工单路由:2739-2852](file://server/service/routes/tickets.js#L2739-L2852)

### 9. PI召回操作功能

**新增** 系统现在支持PI文档的召回操作：

```mermaid
flowchart TD
PIRecall[PI召回操作] --> CheckStatus{检查PI状态}
CheckStatus --> |published| CheckRole{检查用户权限}
CheckStatus --> |draft/rejected| Deny[不允许召回]
CheckRole --> |Admin/Lead| AllowRecall[允许召回]
CheckRole --> |其他用户| Deny
AllowRecall --> UpdateStatus[更新状态为draft]
UpdateStatus --> UpdateVersion[递增版本号]
UpdateVersion --> UpdateNumber[更新PI编号]
UpdateNumber --> LogAudit[记录审计日志]
LogAudit --> Notify[通知参与者]
Notify --> Complete[完成召回]
```

**图表来源**
- [RMA文档路由:606-701](file://server/service/routes/rma-documents.js#L606-L701)
- [PI编辑器:650-685](file://client/src/components/Workspace/PIEditor.tsx#L650-L685)

**PI召回接口**：
- **POST** `/api/v1/rma-documents/pi/:id/recall` - 撤回已发布的PI
- **权限**：仅Admin和Lead用户可操作
- **功能**：将已发布的PI状态重置为草稿，递增版本号

**客户端实现**：
- 在PI编辑器中提供"撤回发布"按钮
- 调用召回接口后自动更新PI编号和版本
- 同步更新后端数据

**章节来源**
- [RMA文档路由:606-701](file://server/service/routes/rma-documents.js#L606-L701)
- [PI编辑器:650-685](file://client/src/components/Workspace/PIEditor.tsx#L650-L685)

### 10. 增强的公共设置管理

**新增** 系统设置了更完善的公共设置管理功能：

```mermaid
flowchart TD
PublicSettings[公共设置] --> SystemSettings[系统设置]
PublicSettings --> ProductDropdown[产品下拉设置]
PublicSettings --> SLASettings[SLA设置]
PublicSettings --> AIConfig[AI配置]
SystemSettings --> SystemName[系统名称]
SystemSettings --> BackupSettings[备份设置]
SystemSettings --> NotificationSettings[通知设置]
ProductDropdown --> FamilyVisibility[产品系列可见性]
ProductDropdown --> TypeFilter[类型过滤]
ProductDropdown --> AllowedTypes[允许类型]
SLASettings --> InquirySLA[咨询工单SLA]
SLASettings --> RMASLA[RMA工单SLA]
SLASettings --> SVC_SLA[服务工单SLA]
```

**图表来源**
- [系统路由:17-72](file://server/service/routes/system.js#L17-L72)
- [设置路由:20-112](file://server/service/routes/settings.js#L20-L112)

**公共设置接口**：
- **GET** `/api/v1/system/public-settings` - 获取公共设置
- **POST** `/api/v1/admin/settings` - 更新系统设置

**设置类别**：
- **系统设置**：系统名称、备份配置、通知间隔等
- **产品下拉设置**：产品系列可见性、类型过滤、允许类型
- **SLA设置**：各类工单的SLA配置
- **AI设置**：AI功能开关、提示词配置等

**章节来源**
- [系统路由:17-72](file://server/service/routes/system.js#L17-L72)
- [设置路由:20-112](file://server/service/routes/settings.js#L20-L112)

### 11. RMA文档路由端点更新

**更新** RMA文档路由的端点得到了增强，提供了更完整的文档管理能力：

```mermaid
flowchart TD
RMADocuments[RMA文档管理] --> PIDocuments[PI文档]
RMADocuments --> RepairReports[维修报告]
RMADocuments --> AuditLog[审计日志]
RMADocuments --> Translation[翻译功能]
PIDocuments --> CreatePI[创建PI]
PIDocuments --> EditPI[编辑PI]
PIDocuments --> SubmitPI[提交PI]
PIDocuments --> ReviewPI[审核PI]
PIDocuments --> PublishPI[发布PI]
PIDocuments --> RecallPI[召回PI]
PIDocuments --> ExportPDF[导出PDF]
RepairReports --> CreateReport[创建报告]
RepairReports --> EditReport[编辑报告]
RepairReports --> SubmitReport[提交报告]
RepairReports --> ReviewReport[审核报告]
RepairReports --> PublishReport[发布报告]
RepairReports --> RecallReport[召回报告]
RepairReports --> ExportPDF[导出PDF]
RepairReports --> TranslateReport[AI翻译]
```

**图表来源**
- [RMA文档路由:70-800](file://server/service/routes/rma-documents.js#L70-L800)

**PI文档端点**：
- `GET /api/v1/rma-documents/pi` - 列出PI文档
- `GET /api/v1/rma-documents/pi/:id` - 获取PI详情
- `POST /api/v1/rma-documents/pi` - 创建PI
- `PATCH /api/v1/rma-documents/pi/:id` - 更新PI
- `POST /api/v1/rma-documents/pi/:id/submit` - 提交PI
- `POST /api/v1/rma-documents/pi/:id/review` - 审核PI
- `POST /api/v1/rma-documents/pi/:id/publish` - 发布PI
- `POST /api/v1/rma-documents/pi/:id/recall` - 撤回PI
- `GET /api/v1/rma-documents/pi/:id/pdf` - 导出PI PDF

**维修报告端点**：
- `GET /api/v1/rma-documents/repair-reports` - 列出维修报告
- `GET /api/v1/rma-documents/repair-reports/:id` - 获取报告详情
- `POST /api/v1/rma-documents/repair-reports` - 创建报告
- `PATCH /api/v1/rma-documents/repair-reports/:id` - 更新报告
- `POST /api/v1/rma-documents/repair-reports/:id/submit` - 提交报告
- `POST /api/v1/rma-documents/repair-reports/:id/review` - 审核报告
- `POST /api/v1/rma-documents/repair-reports/:id/publish` - 发布报告
- `POST /api/v1/rma-documents/repair-reports/:id/recall` - 撤回报告
- `GET /api/v1/rma-documents/repair-reports/:id/pdf` - 导出报告PDF

**维修报告审计日志端点**：
- `GET /api/v1/rma-documents/audit` - 获取文档审计日志
- `GET /api/v1/rma-documents/audit/:id` - 获取特定文档审计详情

**章节来源**
- [RMA文档路由:70-800](file://server/service/routes/rma-documents.js#L70-L800)

### 12. 附件存储优化

**更新** 附件存储系统已进行优化：

- **临时文件存储**：使用 `SERVICE_TEMP_DIR` 存储上传的临时文件
- **索引优化**：为 `ticket_attachments` 表建立索引
- **批量操作**：支持批量附件上传和删除
- **清理机制**：自动清理过期的临时文件

**章节来源**
- [服务端入口:46-57](file://server/index.js#L46-L57)

### 13. AI翻译服务系统

**新增** 完整的AI翻译服务集成：

**Bokeh AI聊天端点**：
- **POST** `/api/v1/bokeh/chat` - AI聊天和翻译服务
- **权限**：所有登录用户
- **功能**：支持维修报告内容翻译、技术问答等

**维修报告AI翻译功能**：
- 支持英语、日语、德语等多种语言翻译
- 保持专业术语准确性
- 支持重新翻译和确认机制
- 自动保存翻译结果

**AI服务特性**：
- **多模型支持**：支持多种AI提供商和模型
- **温度控制**：可配置的AI输出温度参数
- **令牌统计**：记录AI使用量和成本
- **搜索集成**：支持网络搜索和知识库检索

**章节来源**
- [AI服务:1-666](file://server/service/ai_service.js#L1-L666)
- [Bokeh聊天路由:1-42](file://server/service/routes/bokeh.js#L1-L42)
- [维修报告编辑器:258-361](file://client/src/components/Workspace/RepairReportEditor.tsx#L258-L361)

### 14. 知识库审计日志系统

**新增** 完整的知识库操作审计日志功能：

**审计日志端点**：
- `GET /api/v1/knowledge/audit` - 获取知识库操作审计日志
- `GET /api/v1/knowledge/audit/stats` - 获取审计统计信息

**审计日志字段**：
- **操作类型**：create、update、delete、import、publish、archive
- **文章信息**：文章ID、标题、slug
- **分类信息**：分类、产品线、产品型号
- **变更摘要**：JSON格式的变更内容
- **操作人信息**：用户ID、姓名、角色
- **时间戳**：操作时间

**统计分析功能**：
- 按操作类型统计
- 按用户统计
- 按产品线统计
- 最近7天操作趋势
- 总体统计指标

**章节来源**
- [知识库审计日志路由:1-281](file://server/service/routes/knowledge_audit.js#L1-L281)
- [知识库审计日志SQL:1-50](file://server/migrations/add_knowledge_audit_log.sql#L1-L50)
- [知识库审计日志前端:1-599](file://client/src/components/KnowledgeAuditLog.tsx#L1-L599)

### 15. 权限控制中间件增强

**新增** 穿透式权限中间件实现：

**核心功能**：
- **全局访问控制**：Admin、Exec、MS部门人员拥有全局权限
- **JIT穿透访问**：OP/RD部门通过工单关联获得临时访问权限
- **客户穿透**：通过工单参与者表查询可访问的客户列表
- **设备穿透**：通过工单查询可访问的设备序列号列表
- **经销商穿透**：通过工单查询可访问的经销商列表

**中间件类型**：
- `requireCrmAccess`：CRM访问守卫
- `requireIbAccess`：安装基座访问守卫
- `requireContextAccess`：上下文API穿透守卫
- `viewAsMiddleware`：模拟用户访问中间件

**章节来源**
- [权限中间件:1-232](file://server/service/middleware/permission.js#L1-L232)

## 依赖关系分析

### 1. 组件耦合度

```mermaid
graph LR
subgraph "核心模块"
Auth[认证模块]
Perm[权限模块]
Ticket[工单模块]
Context[上下文模块]
Product[产品模块]
Account[账户模块]
Dealer[经销商模块]
RMA[文档模块]
Settings[设置模块]
System[系统模块]
AI[AI服务模块]
Audit[审计模块]
Knowledge[知识库模块]
end
subgraph "支持模块"
DB[(数据库)]
FS[(文件系统)]
Cache[(缓存)]
Notify[通知系统]
end
Auth --> Perm
Perm --> Ticket
Perm --> Context
Perm --> Product
Perm --> Account
Perm --> Dealer
Perm --> RMA
Perm --> Settings
Perm --> System
Perm --> AI
Perm --> Audit
Perm --> Knowledge
Ticket --> DB
Context --> DB
Product --> DB
Account --> DB
Dealer --> DB
RMA --> DB
Settings --> DB
System --> DB
AI --> DB
Audit --> DB
Knowledge --> DB
Ticket --> FS
Ticket --> Cache
Ticket --> Notify
RMA --> FS
RMA --> Cache
RMA --> Notify
AI --> FS
AI --> Cache
Audit --> Cache
Knowledge --> FS
Knowledge --> Cache
```

**图表来源**
- [服务端入口:15-23](file://server/index.js#L15-L23)

### 2. 外部依赖

| 依赖项 | 版本 | 用途 |
|--------|------|------|
| Express | 最新稳定版 | Web 框架 |
| Better-SQLite3 | 最新 | 数据库 ORM |
| JWT | 最新 | 身份验证 |
| Multer | 最新 | 文件上传 |
| Sharp | 最新 | 图像处理 |
| Axios | 最新 | HTTP 客户端 |
| OpenAI SDK | 最新 | AI服务集成 |

**章节来源**
- [服务端入口:1-16](file://server/index.js#L1-16)

## 性能考虑

### 1. 缓存策略

系统采用多层次缓存机制：

- **内存缓存**：热点数据缓存
- **数据库缓存**：查询结果缓存
- **文件缓存**：静态资源缓存
- **CDN 缓存**：静态文件加速

### 2. 数据库优化

```mermaid
flowchart TD
Query[数据库查询] --> CheckCache{检查缓存}
CheckCache --> |命中| ReturnCache[返回缓存数据]
CheckCache --> |未命中| ExecuteQuery[执行查询]
ExecuteQuery --> UpdateCache[更新缓存]
UpdateCache --> ReturnResult[返回结果]
ReturnCache --> End[结束]
ReturnResult --> End
```

### 3. 并发处理

- **连接池**：数据库连接池管理
- **请求去重**：重复请求去重机制
- **异步处理**：耗时操作异步化
- **限流机制**：防止系统过载

### 4. 附件存储优化

**更新** 附件存储系统已进行优化：

- **临时文件存储**：使用 `SERVICE_TEMP_DIR` 存储上传的临时文件
- **索引优化**：为 `ticket_attachments` 表建立索引
- **批量操作**：支持批量附件上传和删除
- **清理机制**：自动清理过期的临时文件

### 5. AI服务优化

**新增** AI服务性能优化：
- **模型缓存**：AI客户端实例缓存
- **令牌统计**：异步记录AI使用量
- **超时控制**：60秒超时设置
- **重试机制**：最多2次重试

**章节来源**
- [服务端入口:46-57](file://server/index.js#L46-L57)

## 故障排除指南

### 1. 常见错误类型

| 错误代码 | 描述 | 解决方案 |
|----------|------|----------|
| 401 | 未认证 | 检查 JWT 令牌有效性 |
| 403 | 权限不足 | 验证用户角色和权限 |
| 404 | 资源不存在 | 检查 ID 和路径 |
| 422 | 业务逻辑错误 | 检查输入数据格式 |
| 500 | 服务器错误 | 查看服务器日志 |
| 503 | 服务不可用 | 检查AI服务配置 |

### 2. 调试工具

```mermaid
flowchart TD
Debug[调试流程] --> EnableLogs[启用详细日志]
EnableLogs --> TestAPI[测试 API 端点]
TestAPI --> CheckAuth[检查认证]
CheckAuth --> VerifyPermissions[验证权限]
VerifyPermissions --> ValidateData[验证数据]
ValidateData --> ReviewLogs[审查日志]
ReviewLogs --> FixIssues[修复问题]
FixIssues --> TestAgain[再次测试]
```

### 3. 性能监控

- **响应时间监控**：关键 API 的响应时间跟踪
- **错误率监控**：异常请求的统计分析
- **资源使用监控**：CPU、内存、磁盘使用情况
- **数据库性能监控**：查询执行时间和慢查询分析
- **AI使用监控**：令牌消耗和成本统计

**章节来源**
- [服务端入口:655-729](file://server/index.js#L655-729)

## 结论

Longhorn 服务 API 提供了一个功能完整、架构清晰的服务管理系统。系统的设计充分考虑了现代企业的需求，具有以下优势：

### 核心优势

1. **模块化设计**：清晰的模块分离，便于维护和扩展
2. **安全可靠**：完善的认证授权机制和数据脱敏
3. **性能优化**：多层次缓存和异步处理机制
4. **易于使用**：RESTful API 设计，文档完善
5. **可扩展性**：插件化架构，支持功能扩展
6. **附件管理**：完整的工单附件上传、存储和访问控制
7. **文档管理**：PI和维修报告的全生命周期管理
8. **配置管理**：灵活的产品下拉设置和系统配置选项
9. **AI集成**：完整的AI翻译服务和智能助手功能
10. **审计追踪**：全面的知识库操作审计和统计分析

### 发展方向

1. **微服务化**：将大型模块拆分为独立服务
2. **容器化部署**：支持 Docker 和 Kubernetes 部署
3. **实时通信**：集成 WebSocket 支持实时通知
4. **AI 集成**：引入智能客服和自动化处理
5. **移动端优化**：开发专用的移动应用

### 最新更新

**维修报告管理功能**：
- 新增完整的维修报告生命周期管理
- 支持创建、编辑、提交、审核、发布、召回等操作
- 集成审计日志功能，追踪所有操作
- 支持多语言翻译和专业术语处理

**AI翻译服务集成**：
- 新增Bokeh AI翻译功能
- 支持英语、日语、德语等多种语言
- 保持专业术语准确性
- 支持维修报告内容翻译
- 集成重新翻译和确认机制

**权限控制中间件增强**：
- 新增穿透式权限中间件
- 实现隔离与穿透的权限控制机制
- 支持JIT（Just-In-Time）访问控制
- 通过工单关联查询可访问资源

**知识库审计日志系统**：
- 新增完整的审计日志功能
- 支持所有知识库操作的追踪
- 提供详细的统计分析功能
- 仅管理员可访问审计数据
- 支持按操作类型、用户、产品线等维度统计

**AI服务系统优化**：
- 新增多模型支持和配置管理
- 实现AI客户端缓存机制
- 增加令牌使用量统计功能
- 优化超时和重试机制
- 支持网络搜索和知识库检索

该系统为 Kinefinity 的产品服务管理提供了坚实的技术基础，能够满足当前和未来的业务发展需求。