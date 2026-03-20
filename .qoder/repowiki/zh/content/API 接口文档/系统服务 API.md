# 系统服务 API

<cite>
**本文档引用的文件**
- [server/index.js](file://server/index.js)
- [server/service/routes/system.js](file://server/service/routes/system.js)
- [server/service/routes/settings.js](file://server/service/routes/settings.js)
- [server/service/middleware/permission.js](file://server/service/middleware/permission.js)
- [server/service/migrations/047_add_product_dropdown_settings.sql](file://server/service/migrations/047_add_product_dropdown_settings.sql)
- [client/src/App.tsx](file://client/src/App.tsx)
- [client/src/components/SystemDashboard.tsx](file://client/src/components/SystemDashboard.tsx)
- [client/src/components/Dashboard.tsx](file://client/src/components/Dashboard.tsx)
- [client/src/components/DailyWord.tsx](file://client/src/components/DailyWord.tsx)
- [client/src/components/Workspace/ProductModal.tsx](file://client/src/components/Workspace/ProductModal.tsx)
- [client/src/components/Service/ProductWarrantyRegistrationModal.tsx](file://client/src/components/Service/ProductWarrantyRegistrationModal.tsx)
- [ios/LonghornApp/Services/APIClient.swift](file://ios/LonghornApp/Services/APIClient.swift)
- [scripts/health-check.sh](file://scripts/health-check.sh)
- [scripts/diagnose-performance.sh](file://scripts/diagnose-performance.sh)
- [server/data/vocab/en.json](file://server/data/vocab/en.json)
</cite>

## 更新摘要
**变更内容**
- 新增产品下拉配置选项系统，支持产品家族可见性和类型过滤设置
- 新增系统设置端点，提供系统配置管理功能
- 新增权限控制API，实现基于角色的访问控制和工单穿透机制
- 更新系统路由，增加产品模型和SKU管理的权限控制
- 新增AI服务集成的系统设置管理

## 目录
1. [简介](#简介)
2. [项目结构](#项目结构)
3. [核心组件](#核心组件)
4. [架构总览](#架构总览)
5. [详细组件分析](#详细组件分析)
6. [依赖关系分析](#依赖关系分析)
7. [性能考虑](#性能考虑)
8. [故障排除指南](#故障排除指南)
9. [结论](#结论)
10. [附录](#附录)

## 简介
本文件面向系统管理员与开发人员，系统性梳理 Longhorn 的系统服务 API，包括健康检查、系统状态、词汇表管理、缓存清理、系统监控与统计、备份与恢复、产品下拉配置、系统设置管理、权限控制API以及前端仪表板与移动端状态数据来源与更新机制。文档以实际代码为依据，提供接口定义、调用流程、数据模型与可视化图表，帮助快速理解与维护系统。

## 项目结构
Longhorn 采用前后端分离架构：后端基于 Node.js + Express 提供 REST API；前端使用 React/Vite 构建 Web 仪表板；iOS 使用 Swift 开发移动端应用。系统服务 API 主要集中在后端 server/index.js 中，前端通过 axios 调用，iOS 通过自定义 APIClient 封装网络层。

```mermaid
graph TB
subgraph "前端"
Web["Web 仪表板<br/>React/Vite"]
Mobile["iOS 应用<br/>Swift"]
end
subgraph "后端"
API["Express 服务器<br/>server/index.js"]
SystemRoutes["系统路由<br/>/api/v1/system/*"]
SettingsRoutes["设置路由<br/>/api/admin/settings"]
PermissionMW["权限中间件<br/>permission.js"]
DB["SQLite 数据库<br/>longhorn.db"]
FS["文件系统<br/>DISK_A 目录"]
end
Web --> API
Mobile --> API
API --> SystemRoutes
API --> SettingsRoutes
SystemRoutes --> PermissionMW
API --> DB
API --> FS
```

**图表来源**
- [server/index.js:16-31](file://server/index.js#L16-L31)
- [server/service/routes/system.js:1-200](file://server/service/routes/system.js#L1-L200)
- [server/service/routes/settings.js:1-397](file://server/service/routes/settings.js#L1-L397)
- [server/service/middleware/permission.js:1-232](file://server/service/middleware/permission.js#L1-L232)

**章节来源**
- [server/index.js:16-31](file://server/index.js#L16-L31)
- [server/service/routes/system.js:1-200](file://server/service/routes/system.js#L1-L200)
- [server/service/routes/settings.js:1-397](file://server/service/routes/settings.js#L1-L397)
- [server/service/middleware/permission.js:1-232](file://server/service/middleware/permission.js#L1-L232)

## 核心组件
- 健康检查与状态接口：提供服务可用性检测与基础状态信息。
- 产品下拉配置系统：支持产品家族可见性控制、产品类型过滤和SN前缀匹配。
- 系统设置管理：提供系统配置、AI提供商设置、备份配置等功能。
- 权限控制API：实现基于角色的访问控制、工单穿透机制和上下文访问控制。
- 词汇表管理：支持批量获取、随机获取与按条件筛选的词汇查询。
- 系统监控与统计：提供用户、存储、文件等维度的系统统计。
- 管理功能：数据库恢复、分享集合管理、回收站清理等。
- 缓存与缩略图：缩略图生成与缓存策略，优化图片加载性能。
- 前端与移动端数据来源：仪表板与每日一词等组件的数据拉取与更新机制。

**章节来源**
- [server/service/routes/system.js:17-72](file://server/service/routes/system.js#L17-L72)
- [server/service/routes/system.js:174-215](file://server/service/routes/system.js#L174-L215)
- [server/service/routes/settings.js:20-112](file://server/service/routes/settings.js#L20-L112)
- [server/service/middleware/permission.js:107-182](file://server/service/middleware/permission.js#L107-L182)
- [server/service/routes/system.js:431-475](file://server/service/routes/system.js#L431-L475)

## 架构总览
系统服务 API 的调用链路如下：前端/移动端发起 HTTP 请求，后端进行鉴权与权限校验，访问数据库与文件系统，返回标准化 JSON 响应。健康检查与状态接口无需鉴权，其余接口均需携带 Bearer Token。

```mermaid
sequenceDiagram
participant Client as "客户端(Web/iOS)"
participant Auth as "鉴权中间件"
participant API as "系统服务 API"
participant Perm as "权限控制"
participant DB as "SQLite 数据库"
participant FS as "文件系统"
Client->>API : GET /api/status
API-->>Client : {name,status,version}
Client->>API : GET /api/admin/stats (需要鉴权)
API->>Auth : 验证 JWT
Auth-->>API : 用户信息
API->>Perm : 权限检查
Perm-->>API : 访问授权
API->>DB : 查询统计
DB-->>API : 统计结果
API-->>Client : {users,storage,totalFiles,...}
Client->>API : GET /api/v1/system/public-settings (需要鉴权)
API->>DB : 查询系统设置
DB-->>API : 设置配置
API-->>Client : {product_dropdown,sla_settings,...}
```

**图表来源**
- [server/service/routes/system.js:17-72](file://server/service/routes/system.js#L17-L72)
- [server/service/routes/system.js:217-280](file://server/service/routes/system.js#L217-L280)
- [server/service/middleware/permission.js:107-182](file://server/service/middleware/permission.js#L107-L182)

**章节来源**
- [server/service/routes/system.js:17-72](file://server/service/routes/system.js#L17-L72)
- [server/service/routes/system.js:217-280](file://server/service/routes/system.js#L217-L280)
- [server/service/middleware/permission.js:107-182](file://server/service/middleware/permission.js#L107-L182)

## 详细组件分析

### 健康检查与系统状态接口
- 接口路径：/api/status
- 方法：GET
- 功能：返回服务名称、运行状态与版本号，用于健康检查与服务发现。
- 认证：无需鉴权
- 返回示例：包含 name、status、version 字段的对象

```mermaid
sequenceDiagram
participant Monitor as "监控系统"
participant API as "系统服务 API"
Monitor->>API : GET /api/status
API-->>Monitor : {"name" : "Longhorn API","status" : "Running","version" : "1.0.0"}
```

**图表来源**
- [server/index.js:477-479](file://server/index.js#L477-L479)

**章节来源**
- [server/index.js:477-479](file://server/index.js#L477-L479)

### 产品下拉配置系统

#### 公共系统设置接口
- 接口路径：/api/v1/system/public-settings
- 方法：GET
- 功能：返回系统公共设置，包括产品下拉配置、SLA设置、通知间隔等
- 认证：需要鉴权
- 返回数据：包含产品下拉设置（family_visibility、enable_type_filter、allowed_types）

```mermaid
sequenceDiagram
participant Client as "客户端"
participant API as "系统服务 API"
participant DB as "SQLite 数据库"
Client->>API : GET /api/v1/system/public-settings
API->>DB : 查询 system_settings
DB-->>API : 系统设置数据
API-->>Client : {product_dropdown : {family_visibility,enable_type_filter,allowed_types},sla_settings,...}
```

**图表来源**
- [server/service/routes/system.js:17-72](file://server/service/routes/system.js#L17-L72)

#### 产品模型下拉接口
- 接口路径：/api/v1/system/products
- 方法：GET
- 查询参数：category（可选）
- 功能：获取激活的产品模型列表，支持按产品系列过滤
- 认证：需要鉴权
- 数据来源：product_models 表，按产品系列和名称排序

**章节来源**
- [server/service/routes/system.js:174-215](file://server/service/routes/system.js#L174-L215)

### 系统设置管理接口

#### 获取系统设置
- 接口路径：/api/admin/settings
- 方法：GET
- 功能：获取系统设置和AI提供商配置
- 认证：需要鉴权，超级管理员权限
- 返回数据：包含系统设置和AI提供商列表，敏感信息对非超级管理员隐藏

#### 更新系统设置
- 接口路径：/api/admin/settings
- 方法：POST
- 功能：更新系统设置和AI提供商配置
- 认证：需要超级管理员权限
- 参数：{ settings, providers }
- 特殊功能：支持产品下拉配置（show_family_a-e、enable_product_type_filter、allowed_product_types）

```mermaid
flowchart TD
Start(["开始更新设置"]) --> CheckRole["校验超级管理员权限"]
CheckRole --> Validate["验证输入参数"]
Validate --> UpdateSettings["更新 system_settings 表"]
UpdateSettings --> UpdateProviders["更新/插入 AI 提供商"]
UpdateProviders --> ReloadBackup["重新加载备份服务"]
ReloadBackup --> Success(["更新完成"])
```

**图表来源**
- [server/service/routes/settings.js:114-263](file://server/service/routes/settings.js#L114-L263)

**章节来源**
- [server/service/routes/settings.js:20-112](file://server/service/routes/settings.js#L20-L112)
- [server/service/routes/settings.js:114-263](file://server/service/routes/settings.js#L114-L263)
- [server/service/migrations/047_add_product_dropdown_settings.sql:1-26](file://server/service/migrations/047_add_product_dropdown_settings.sql#L1-L26)

### 权限控制API

#### CRM访问守卫
- 功能：保护客户/经销商列表 API
- 规则：Admin/Exec/MS 全权限，OP/RD 无权浏览全量列表
- 特殊：可通过 /context/* 使用工单穿透

#### IB（安装基础）访问守卫
- 功能：保护产品库访问
- 规则：OP/RD 不能浏览全量产品列表，但可搜索自己工单关联的SN

#### 上下文访问控制
- 功能：/context/* 穿透守卫
- 规则：OP/RD 仅能查询与自己工单关联的 account 或 SN

```mermaid
flowchart TD
User["用户请求"] --> CheckUser["检查用户身份"]
CheckUser --> HasGlobal{"是否有全局访问权限?"}
HasGlobal --> |是| Allow["允许访问"]
HasGlobal --> |否| CheckContext{"是否为上下文请求?"}
CheckContext --> |是| CheckAccess["检查工单穿透权限"]
CheckContext --> |否| Deny["拒绝访问"]
CheckAccess --> AccessOK["允许访问"]
CheckAccess --> AccessDenied["拒绝访问"]
```

**图表来源**
- [server/service/middleware/permission.js:107-182](file://server/service/middleware/permission.js#L107-L182)

**章节来源**
- [server/service/middleware/permission.js:107-182](file://server/service/middleware/permission.js#L107-L182)

### 产品管理权限控制

#### 产品模型管理权限
- 接口：/api/v1/admin/product-models/*
- 权限要求：Admin/Exec 或 MS Lead+
- GET 请求：允许所有 MS 员工
- 非 GET 请求：需要 Admin/Exec 或 MS Lead+

#### 产品SKU管理权限
- 接口：/api/v1/admin/product-skus/*
- 权限要求：Admin/Exec 或 MS Lead+
- GET 请求：允许所有 MS 员工
- 非 GET 请求：需要 Admin/Exec 或 MS Lead+

**章节来源**
- [server/service/routes/product-models-admin.js:19-41](file://server/service/routes/product-models-admin.js#L19-L41)
- [server/service/routes/product-skus.js:19-41](file://server/service/routes/product-skus.js#L19-L41)

### 词汇表管理接口
- 批量获取接口：/api/vocabulary/batch
  - 方法：GET
  - 查询参数：language（可选）、level（可选）、count（可选，最大 50）
  - 功能：按条件筛选并随机返回指定数量的词汇，示例字段包含单词、音标、释义、词性、例句等
  - 认证：需要鉴权
  - 数据来源：数据库 vocabulary 表，示例种子位于 server/data/vocab/*.json

```mermaid
sequenceDiagram
participant Client as "客户端"
participant API as "系统服务 API"
participant DB as "SQLite 数据库"
Client->>API : GET /api/vocabulary/batch?language=en&level=Advanced&count=20
API->>DB : 查询词汇(条件+随机)
DB-->>API : 词汇列表(JSON)
API-->>Client : [词汇对象...]
```

**图表来源**
- [server/index.js:431-475](file://server/index.js#L431-L475)
- [server/data/vocab/en.json:1-227](file://server/data/vocab/en.json#L1-L227)

**章节来源**
- [server/index.js:431-475](file://server/index.js#L431-L475)
- [server/data/vocab/en.json:1-227](file://server/data/vocab/en.json#L1-L227)

### 系统监控与统计接口
- 管理统计接口：/api/admin/stats
  - 方法：GET
  - 功能：返回系统级统计数据，包括今日/周/月上传统计、存储使用分布、用户总数与活跃数、文件总数、部门存储占比、Top 上传者等
  - 认证：需要 Admin 权限
  - 数据来源：多表聚合查询，涉及用户、文件、访问日志等

- 用户统计接口：/api/user/stats
  - 方法：GET
  - 功能：返回当前用户的上传数量、存储使用量、分享数量等
  - 认证：需要鉴权
  - 数据来源：用户相关统计与访问日志

- 实时系统健康状态：/api/admin/stats/system
  - 方法：GET
  - 功能：返回CPU负载、内存使用、系统运行时间等实时健康信息
  - 认证：需要鉴权

- AI使用统计：/api/admin/stats/ai
  - 方法：GET
  - 功能：返回过去30天AI使用趋势和总令牌消耗统计
  - 认证：需要鉴权

```mermaid
sequenceDiagram
participant Admin as "管理员"
participant API as "系统服务 API"
participant DB as "SQLite 数据库"
Admin->>API : GET /api/admin/stats
API->>DB : 聚合查询(用户/存储/文件/访问日志)
DB-->>API : 统计结果
API-->>Admin : {todayStats,weekStats,monthStats,storage,users,topUploaders,totalFiles}
```

**图表来源**
- [client/src/components/SystemDashboard.tsx:15-34](file://client/src/components/SystemDashboard.tsx#L15-L34)
- [client/src/components/SystemDashboard.tsx:42-56](file://client/src/components/SystemDashboard.tsx#L42-L56)

**章节来源**
- [client/src/components/SystemDashboard.tsx:15-34](file://client/src/components/SystemDashboard.tsx#L15-L34)
- [client/src/components/SystemDashboard.tsx:42-56](file://client/src/components/SystemDashboard.tsx#L42-L56)
- [client/src/components/Dashboard.tsx:37-55](file://client/src/components/Dashboard.tsx#L37-L55)
- [server/service/routes/settings.js:327-393](file://server/service/routes/settings.js#L327-L393)

### 管理功能：数据库恢复
- 接口路径：/api/admin/restore-db
- 方法：POST
- 功能：管理员上传新的数据库文件，执行备份与替换，并触发服务重启
- 认证：需要 Admin 权限
- 流程：关闭数据库连接 → 备份现有数据库 → 替换新数据库 → 返回成功消息 → 进程退出由进程管理器重启

```mermaid
flowchart TD
Start(["开始"]) --> CheckAuth["校验管理员权限"]
CheckAuth --> Upload["接收上传的数据库文件"]
Upload --> CloseDB["关闭当前数据库连接"]
CloseDB --> Backup["备份现有数据库(.bak-时间戳)"]
Backup --> Replace["替换为新数据库文件"]
Replace --> Restart["触发服务重启"]
Restart --> End(["结束"])
```

**图表来源**
- [server/index.js:3082-3118](file://server/index.js#L3082-L3118)

**章节来源**
- [server/index.js:3082-3118](file://server/index.js#L3082-L3118)

### 缓存与缩略图接口
- 接口路径：/api/thumbnail
- 方法：GET
- 功能：根据文件路径生成 WebP 缩略图并缓存，支持预览模式与尺寸控制
- 支持格式：标准图片（jpg/png/gif/webp/bmp/tiff）与视频/HEIC（通过 ffmpeg/sips 处理）
- 缓存策略：基于文件路径与尺寸生成缓存键，缓存文件存在且更新时间晚于源文件时直接返回
- 并发控制：缩略图生成队列限制并发数，避免 CPU/IO 过载

```mermaid
flowchart TD
Req["请求 /api/thumbnail?path=...&size=..."] --> Validate["校验文件扩展名与存在性"]
Validate --> CacheCheck{"缓存是否存在且有效?"}
CacheCheck --> |是| ServeCache["直接返回缓存图像"]
CacheCheck --> |否| GenMode{"视频/HEIC 或标准图片?"}
GenMode --> |视频/HEIC| FFmpeg["使用 ffmpeg/sips 生成缩略图"]
GenMode --> |标准图片| Sharp["使用 sharp 生成缩略图"]
FFmpeg --> WriteCache["写入缓存(原子重命名)"]
Sharp --> WriteCache
WriteCache --> Serve["返回图像并设置缓存头"]
```

**图表来源**
- [server/index.js:483-679](file://server/index.js#L483-L679)

**章节来源**
- [server/index.js:483-679](file://server/index.js#L483-L679)

### 前端仪表板与移动端状态数据来源
- Web 仪表板：SystemDashboard 组件通过 /api/admin/stats 获取系统统计，周期性轮询更新，展示用户数、存储使用、文件总数、部门存储分布与 Top 上传者。
- 用户个人仪表板：Dashboard 组件通过 /api/user/stats 获取个人统计，展示上传数量、存储使用量、分享数量等。
- 每日一词：DailyWord 组件通过 /api/vocabulary/random 获取随机词汇，支持语言与难度切换，本地持久化难度设置。
- 产品选择器：ProductModal 和 ProductWarrantyRegistrationModal 通过 /api/v1/system/public-settings 获取产品下拉配置，实现动态产品过滤。

```mermaid
sequenceDiagram
participant Web as "Web 仪表板(SystemDashboard)"
participant API as "系统服务 API"
Web->>API : GET /api/admin/stats
API-->>Web : 系统统计数据
Web->>Web : 渲染图表与卡片
participant ProductModal as "产品选择器(ProductModal)"
ProductModal->>API : GET /api/v1/system/public-settings
API-->>ProductModal : 产品下拉配置
ProductModal->>ProductModal : 应用产品过滤规则
```

**图表来源**
- [client/src/components/SystemDashboard.tsx:42-56](file://client/src/components/SystemDashboard.tsx#L42-L56)
- [client/src/components/Dashboard.tsx:37-55](file://client/src/components/Dashboard.tsx#L37-L55)
- [client/src/components/DailyWord.tsx:19-36](file://client/src/components/DailyWord.tsx#L19-L36)
- [client/src/components/Workspace/ProductModal.tsx:152-176](file://client/src/components/Workspace/ProductModal.tsx#L152-L176)

**章节来源**
- [client/src/components/SystemDashboard.tsx:42-56](file://client/src/components/SystemDashboard.tsx#L42-L56)
- [client/src/components/Dashboard.tsx:37-55](file://client/src/components/Dashboard.tsx#L37-L55)
- [client/src/components/DailyWord.tsx:19-36](file://client/src/components/DailyWord.tsx#L19-L36)
- [client/src/components/Workspace/ProductModal.tsx:152-176](file://client/src/components/Workspace/ProductModal.tsx#L152-L176)
- [client/src/components/Service/ProductWarrantyRegistrationModal.tsx:265-289](file://client/src/components/Service/ProductWarrantyRegistrationModal.tsx#L265-L289)

### iOS 端网络层与数据获取
- APIClient 封装了统一的网络请求方法，支持 GET/POST/DELETE/PUT，自动添加 Authorization 头与 JSON 内容类型。
- 支持超时配置与错误处理，包含无效 URL、无数据、解码错误、网络错误、服务器错误与未授权等错误类型。
- 适用于文件下载、批量下载、上传等场景，为移动端状态展示与数据同步提供基础能力。

```mermaid
classDiagram
class APIClient {
+String baseURL
+get(endpoint, queryItems) T
+post(endpoint, body) T
+post(endpoint, body) void
+delete(endpoint) void
+delete(endpoint, queryItems) void
+put(endpoint, body) void
+downloadFile(path, progress) URL
+downloadBatchFiles(paths) URL
+uploadFile(data, fileName, toPath, progress) void
}
class APIError {
+invalidURL
+noData
+decodingError(Error)
+networkError(Error)
+serverError(Int, String?)
+unauthorized
}
APIClient --> APIError : "抛出错误"
```

**图表来源**
- [ios/LonghornApp/Services/APIClient.swift:11-35](file://ios/LonghornApp/Services/APIClient.swift#L11-L35)
- [ios/LonghornApp/Services/APIClient.swift:69-108](file://ios/LonghornApp/Services/APIClient.swift#L69-L108)

**章节来源**
- [ios/LonghornApp/Services/APIClient.swift:1-326](file://ios/LonghornApp/Services/APIClient.swift#L1-L326)

## 依赖关系分析
- 服务器端依赖：Express、better-sqlite3、bcrypt、sharp、archiver、multer 等。
- 前端依赖：axios、react-router、lucide-react 等。
- iOS 依赖：Foundation、URLSession、JSON 解析与编码。
- 运维脚本：health-check.sh、diagnose-performance.sh 等辅助系统健康检查与性能诊断。

```mermaid
graph TB
Express["Express"] --> SQLite["better-sqlite3"]
Express --> Bcrypt["bcrypt"]
Express --> Sharp["sharp"]
Express --> Archiver["archiver"]
Express --> Multer["multer"]
React["React/Vite"] --> Axios["axios"]
React --> Router["react-router"]
iOS["iOS Swift"] --> URLSession["URLSession"]
iOS --> Foundation["Foundation"]
```

**图表来源**
- [server/index.js:1-14](file://server/index.js#L1-L14)
- [client/src/App.tsx:1-20](file://client/src/App.tsx#L1-L20)
- [ios/LonghornApp/Services/APIClient.swift:53-64](file://ios/LonghornApp/Services/APIClient.swift#L53-L64)

**章节来源**
- [server/index.js:1-14](file://server/index.js#L1-L14)
- [client/src/App.tsx:1-20](file://client/src/App.tsx#L1-L20)
- [ios/LonghornApp/Services/APIClient.swift:53-64](file://ios/LonghornApp/Services/APIClient.swift#L53-L64)

## 性能考虑
- 压缩与缓存：启用 gzip 压缩与静态资源缓存，减少带宽与延迟。
- 缩略图并发控制：限制缩略图生成并发数，避免 CPU/IO 过载。
- ETag 与条件请求：文件列表接口使用 ETag 与 If-None-Match 实现缓存命中，降低重复传输。
- 数据库 WAL 模式：开启 WAL 模式提升并发读写性能。
- 健康检查与诊断：提供本地健康检查与性能诊断脚本，便于快速定位问题。

**章节来源**
- [server/index.js:418-427](file://server/index.js#L418-L427)
- [server/index.js:555-577](file://server/index.js#L555-L577)
- [server/index.js:2337-2342](file://server/index.js#L2337-L2342)
- [scripts/health-check.sh:1-114](file://scripts/health-check.sh#L1-L114)
- [scripts/diagnose-performance.sh:1-31](file://scripts/diagnose-performance.sh#L1-L31)

## 故障排除指南
- 健康检查：使用 health-check.sh 检查后端/前端服务端口状态，必要时自动启动。
- 性能诊断：使用 diagnose-performance.sh 生成性能报告，包含 PM2 进程状态与本地 API 响应时间测试。
- 缩略图生成失败：检查 ffmpeg/sips 是否可用，查看缩略图缓存目录权限与磁盘空间。
- 权限不足：确认用户角色与路径权限，Admin 可见全部部门，普通用户仅可见自身与授权范围。
- 数据库恢复：确保上传文件格式正确，恢复后由进程管理器自动重启服务。
- 产品下拉配置：检查 system_settings 表中的产品相关字段，确认配置正确性。

**章节来源**
- [scripts/health-check.sh:1-114](file://scripts/health-check.sh#L1-L114)
- [scripts/diagnose-performance.sh:1-31](file://scripts/diagnose-performance.sh#L1-L31)
- [server/index.js:3082-3118](file://server/index.js#L3082-L3118)
- [server/service/migrations/047_add_product_dropdown_settings.sql:1-26](file://server/service/migrations/047_add_product_dropdown_settings.sql#L1-L26)

## 结论
Longhorn 的系统服务 API 提供了完整的健康检查、系统状态、产品下拉配置管理、系统设置、权限控制、词汇表管理、缓存与缩略图、系统统计与管理功能。通过前后端分离架构与移动端网络封装，实现了稳定的数据来源与更新机制。新增的产品下拉配置系统和权限控制API进一步增强了系统的灵活性和安全性。建议在生产环境中结合健康检查与性能诊断脚本，定期巡检服务状态与资源使用情况，确保系统高可用与高性能。

## 附录
- 接口清单与调用方式详见各组件章节。
- 前端与移动端数据来源与更新策略详见"前端仪表板与移动端状态数据来源"与"iOS 端网络层与数据获取"。
- 产品下拉配置和权限控制的具体实现细节详见相关章节。