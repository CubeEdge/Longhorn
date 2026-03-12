# VoC客户声音管理系统

<cite>
**本文档中引用的文件**
- [App.tsx](file://client/src/App.tsx)
- [useAuthStore.ts](file://client/src/store/useAuthStore.ts)
- [index.js](file://server/index.js)
- [AuthManager.swift](file://ios/LonghornApp/Services/AuthManager.swift)
- [User.swift](file://ios/LonghornApp/Models/User.swift)
- [Dashboard.tsx](file://client/src/components/Dashboard.tsx)
- [SYSTEM_CONTEXT.md](file://docs/SYSTEM_CONTEXT.md)
- [package.json](file://client/package.json)
- [server/package.json](file://server/package.json)
- [LonghornApp.swift](file://ios/LonghornApp/LonghornApp.swift)
- [inquiry-tickets.js](file://server/service/routes/inquiry-tickets.js)
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

VoC客户声音管理系统是一个基于现代技术栈构建的企业级文件管理和客户服务系统。该系统旨在收集、处理和分析客户反馈，提供多平台支持（Web、iOS），并具备强大的权限控制和文件管理功能。

系统采用三层架构设计，包含：
- **前端客户端**：React 18 + TypeScript + Vite 构建的现代化Web应用
- **移动端客户端**：SwiftUI + MVVM架构的iOS应用
- **后端服务**：Node.js + Express.js + SQLite3的高性能API服务

## 项目结构

```mermaid
graph TB
subgraph "客户端层"
Web[Web客户端<br/>React 18 + TypeScript]
iOS[iOS客户端<br/>SwiftUI + MVVM]
end
subgraph "服务层"
API[API服务器<br/>Express.js + Node.js]
Auth[认证服务<br/>JWT + 权限管理]
FileMgr[文件管理器<br/>分片上传 + 缓存]
end
subgraph "数据层"
DB[(SQLite3数据库)]
FS[(文件系统)]
Cache[(缓存系统)]
end
Web --> API
iOS --> API
API --> DB
API --> FS
API --> Cache
Auth --> DB
FileMgr --> FS
```

**图表来源**
- [SYSTEM_CONTEXT.md](file://docs/SYSTEM_CONTEXT.md#L1-L96)
- [package.json](file://client/package.json#L1-L46)
- [server/package.json](file://server/package.json#L1-L31)

**章节来源**
- [SYSTEM_CONTEXT.md](file://docs/SYSTEM_CONTEXT.md#L1-L96)
- [package.json](file://client/package.json#L1-L46)
- [server/package.json](file://server/package.json#L1-L31)

## 核心组件

### 1. 多模块导航系统

系统采用模块化设计，支持两个主要功能模块：

```mermaid
graph LR
subgraph "服务模块 (Service)"
Inquiry[咨询工单<br/>Layer 1]
RMA[RMA返厂单<br/>Layer 2]
Dealer[经销商维修单<br/>Layer 3]
Context[上下文查询]
Knowledge[知识库]
Parts[配件管理]
end
subgraph "文件模块 (Files)"
Personal[个人空间]
Dept[部门文件]
Starred[收藏夹]
Shares[共享文件]
Recycle[回收站]
Search[搜索]
Recent[最近访问]
end
```

**图表来源**
- [App.tsx](file://client/src/App.tsx#L118-L198)

### 2. 权限管理体系

系统实现三级权限控制：
- **只读权限**：仅允许浏览和下载
- **贡献权限**：可上传和新建，但只能修改删除自己上传的文件
- **完全权限**：管理员和部门负责人拥有完整管理权限

**章节来源**
- [SYSTEM_CONTEXT.md](file://docs/SYSTEM_CONTEXT.md#L52-L59)

### 3. 文件处理机制

```mermaid
flowchart TD
Upload[文件上传] --> Chunk[分片上传]
Chunk --> Process[文件处理]
Process --> Thumbnail[生成缩略图]
Process --> Cache[缓存处理]
Process --> Store[存储文件]
Thumbnail --> WebP[WebP格式]
Cache --> Memory[内存缓存]
Cache --> Disk[磁盘缓存]
Store --> Metadata[元数据记录]
Metadata --> Access[权限验证]
```

**图表来源**
- [SYSTEM_CONTEXT.md](file://docs/SYSTEM_CONTEXT.md#L60-L67)

**章节来源**
- [SYSTEM_CONTEXT.md](file://docs/SYSTEM_CONTEXT.md#L60-L67)

## 架构概览

### 系统架构图

```mermaid
graph TB
subgraph "用户界面层"
UI[Web界面]
Mobile[iOS应用]
end
subgraph "API网关层"
Router[路由处理]
Auth[认证中间件]
CORS[CORS处理]
end
subgraph "业务逻辑层"
Service[服务层]
Ticket[工单管理]
FileSvc[文件服务]
UserSvc[用户管理]
end
subgraph "数据持久层"
SQLite[(SQLite3)]
FS[(文件系统)]
Cache[(Redis/内存缓存)]
end
UI --> Router
Mobile --> Router
Router --> Auth
Auth --> Service
Service --> Ticket
Service --> FileSvc
Service --> UserSvc
Ticket --> SQLite
FileSvc --> FS
FileSvc --> Cache
UserSvc --> SQLite
```

**图表来源**
- [index.js](file://server/index.js#L22-L641)
- [LonghornApp.swift](file://ios/LonghornApp/LonghornApp.swift#L12-L25)

### 数据流架构

```mermaid
sequenceDiagram
participant Client as 客户端
participant Auth as 认证服务
participant API as API网关
participant DB as 数据库
participant FS as 文件系统
Client->>Auth : 登录请求
Auth->>Auth : JWT令牌生成
Auth-->>Client : 返回令牌
Client->>API : 受保护资源请求
API->>Auth : 验证JWT令牌
Auth->>DB : 用户信息验证
DB-->>Auth : 返回用户数据
Auth-->>API : 验证通过
API->>DB : 业务数据查询
DB-->>API : 返回数据
API->>FS : 文件操作
FS-->>API : 文件状态
API-->>Client : 响应数据
```

**图表来源**
- [AuthManager.swift](file://ios/LonghornApp/Services/AuthManager.swift#L44-L69)
- [useAuthStore.ts](file://client/src/store/useAuthStore.ts#L17-L30)

## 详细组件分析

### 1. 认证系统

#### 前端认证流程

```mermaid
sequenceDiagram
participant React as React应用
participant Store as Zustand存储
participant API as API服务
participant JWT as JWT令牌
React->>API : POST /api/login
API->>JWT : 生成JWT令牌
JWT-->>API : 返回加密令牌
API-->>React : {token, user}
React->>Store : setAuth(user, token)
Store->>Store : 本地存储用户信息
Store-->>React : 更新认证状态
React->>API : 受保护请求
API->>API : 验证JWT令牌
API-->>React : 返回受保护数据
```

**图表来源**
- [useAuthStore.ts](file://client/src/store/useAuthStore.ts#L17-L30)
- [App.tsx](file://client/src/App.tsx#L96-L115)

#### 移动端认证流程

```mermaid
sequenceDiagram
participant iOS as iOS应用
participant Auth as AuthManager
participant Keychain as Keychain
participant APIClient as APIClient
participant Server as 服务器
iOS->>Auth : login(username, password)
Auth->>APIClient : POST /api/login
APIClient->>Server : 登录请求
Server-->>APIClient : 返回JWT令牌
APIClient-->>Auth : {token, user}
Auth->>Keychain : 保存令牌
Auth->>Auth : 设置currentUser
Auth-->>iOS : 认证成功
iOS->>Auth : logout()
Auth->>Keychain : 删除令牌
Auth->>Auth : 清理缓存
Auth-->>iOS : 登出完成
```

**图表来源**
- [AuthManager.swift](file://ios/LonghornApp/Services/AuthManager.swift#L44-L89)

**章节来源**
- [useAuthStore.ts](file://client/src/store/useAuthStore.ts#L1-L31)
- [AuthManager.swift](file://ios/LonghornApp/Services/AuthManager.swift#L1-L195)

### 2. 工单管理系统

#### 咨询工单处理流程

```mermaid
flowchart TD
Create[创建工单] --> Validate[数据验证]
Validate --> Generate[生成工单号<br/>KYYMM-XXXX]
Generate --> Assign[分配处理人]
Assign --> Track[跟踪状态]
Track --> InProgress[处理中]
Track --> AwaitingFeedback[待反馈]
Track --> Resolved[已解决]
InProgress --> Update[更新状态]
AwaitingFeedback --> Update
Resolved --> Close[关闭工单]
Update --> Notify[通知相关方]
Notify --> Track
Close --> Archive[归档记录]
```

**图表来源**
- [inquiry-tickets.js](file://server/service/routes/inquiry-tickets.js#L20-L47)

#### 工单统计面板

```mermaid
graph LR
subgraph "统计卡片"
All[全部<br/>#6b7280]
InProgress[处理中<br/>#3b82f6]
AwaitingFeedback[待反馈<br/>#8b5cf6]
Resolved[已解决<br/>#10b981]
end
subgraph "过滤器"
Filter[状态过滤]
end
All --> Filter
InProgress --> Filter
AwaitingFeedback --> Filter
Resolved --> Filter
```

**图表来源**
- [App.tsx](file://client/src/App.tsx#L569-L608)

**章节来源**
- [inquiry-tickets.js](file://server/service/routes/inquiry-tickets.js#L1-L200)
- [App.tsx](file://client/src/App.tsx#L569-L608)

### 3. 文件管理系统

#### 文件权限验证流程

```mermaid
flowchart TD
Request[文件请求] --> CheckAdmin{是否管理员?}
CheckAdmin --> |是| Allow[允许访问]
CheckAdmin --> |否| CheckPath[验证文件路径]
CheckPath --> CheckPersonal{是否个人空间?}
CheckPersonal --> |是| VerifyPersonal[验证个人权限]
CheckPersonal --> |否| CheckDept[验证部门权限]
VerifyPersonal --> CheckMember{是否成员?}
CheckMember --> |是| VerifyMember[验证成员权限]
CheckMember --> |否| Deny[拒绝访问]
VerifyMember --> CheckRead{访问类型?}
CheckRead --> |Read| Allow
CheckRead --> |Contributor| VerifyOwner[验证文件所有者]
VerifyOwner --> Owner{是否文件所有者?}
Owner --> |是| Allow
Owner --> |否| Deny
CheckDept --> CheckExtended[检查扩展权限]
CheckExtended --> Extended{权限存在?}
Extended --> |是| Allow
Extended --> |否| Deny
```

**图表来源**
- [index.js](file://server/index.js#L506-L559)

**章节来源**
- [index.js](file://server/index.js#L506-L559)

### 4. 仪表板系统

#### 用户统计面板

```mermaid
graph TB
subgraph "统计卡片"
Upload[上传数量<br/>文件文本图标]
Storage[存储使用量<br/>硬盘图标]
Starred[收藏文件数<br/>星形图标]
Shares[分享链接数<br/>链接图标]
end
subgraph "账户信息"
LastLogin[最后登录时间<br/>时钟图标]
Created[账户创建时间<br/>日历图标]
end
subgraph "快捷操作"
GotoSpace[前往个人空间]
ViewStarred[查看收藏]
SearchFiles[搜索文件]
end
Upload --> LastLogin
Storage --> Created
Starred --> GotoSpace
Shares --> ViewStarred
LastLogin --> SearchFiles
```

**图表来源**
- [Dashboard.tsx](file://client/src/components/Dashboard.tsx#L102-L374)

**章节来源**
- [Dashboard.tsx](file://client/src/components/Dashboard.tsx#L1-L378)

## 依赖关系分析

### 技术栈依赖图

```mermaid
graph TB
subgraph "前端依赖"
React[React 18]
TS[TypeScript]
ZUSTAND[Zustand状态管理]
AXIOS[Axios HTTP客户端]
ROUTER[React Router DOM]
end
subgraph "后端依赖"
EXPRESS[Express.js]
SQLITE[better-sqlite3]
JWT[jsonwebtoken]
BCRYPT[BcryptJS]
SHARP[Sharp图像处理]
MULTER[Multer文件上传]
end
subgraph "移动端依赖"
SWIFTUI[SwiftUI]
FOUNDATION[Foundation]
SECURITY[Security框架]
end
React --> AXIOS
React --> ZUSTAND
React --> ROUTER
EXPRESS --> SQLITE
EXPRESS --> JWT
EXPRESS --> BCRYPT
EXPRESS --> SHARP
EXPRESS --> MULTER
SWIFTUI --> FOUNDATION
SWIFTUI --> SECURITY
```

**图表来源**
- [package.json](file://client/package.json#L12-L30)
- [server/package.json](file://server/package.json#L15-L29)
- [LonghornApp.swift](file://ios/LonghornApp/LonghornApp.swift#L9-L25)

### 模块间依赖关系

```mermaid
graph LR
subgraph "认证模块"
AuthStore[useAuthStore]
AuthManager[AuthManager]
end
subgraph "服务模块"
Inquiry[InquiryTickets]
RMATickets[RMATickets]
DealerRepairs[DealerRepairs]
end
subgraph "文件模块"
FileBrowser[FileBrowser]
FileService[FileService]
ShareService[ShareService]
end
AuthStore --> Inquiry
AuthStore --> FileBrowser
AuthManager --> FileService
Inquiry --> RMATickets
RMATickets --> DealerRepairs
FileBrowser --> ShareService
FileService --> ShareService
```

**图表来源**
- [App.tsx](file://client/src/App.tsx#L1-L50)

**章节来源**
- [package.json](file://client/package.json#L12-L30)
- [server/package.json](file://server/package.json#L15-L29)

## 性能考虑

### 1. 缓存策略

系统实现了多层次缓存机制：

- **内存缓存**：用于频繁访问的数据，如用户统计信息
- **磁盘缓存**：用于静态资源和生成的缩略图
- **浏览器缓存**：利用ETag和Last-Modified头实现智能缓存

### 2. 文件处理优化

```mermaid
flowchart TD
Upload[文件上传] --> Queue[队列管理]
Queue --> Process[异步处理]
Process --> Image[图片处理<br/>Sharp]
Process --> Video[视频处理<br/>FFmpeg]
Process --> HEIC[HEIC转换]
Image --> WebP[生成WebP]
Video --> Thumbnail[生成缩略图]
HEIC --> JPEG[转换为JPEG]
WebP --> Cache[缓存]
Thumbnail --> Cache
JPEG --> Cache
Cache --> Serve[快速响应]
```

**图表来源**
- [SYSTEM_CONTEXT.md](file://docs/SYSTEM_CONTEXT.md#L62-L66)

### 3. 并发处理

系统针对不同场景进行了优化：
- **视频转码**：主要依赖CPU处理，M1芯片性能充足但需注意并发限制
- **文件预览**：使用本地缓存减少网络传输
- **权限验证**：数据库查询添加适当索引提高性能

**章节来源**
- [SYSTEM_CONTEXT.md](file://docs/SYSTEM_CONTEXT.md#L75-L79)

## 故障排除指南

### 1. 常见问题诊断

#### 权限相关问题

**症状**：用户无法访问特定文件或目录
**排查步骤**：
1. 检查用户角色和部门信息
2. 验证文件路径权限设置
3. 确认扩展权限配置
4. 查看权限验证日志

#### 文件访问问题

**症状**：文件无法下载或预览异常
**排查步骤**：
1. 检查文件是否存在且未被删除
2. 验证文件权限设置
3. 确认缓存状态
4. 检查文件格式支持情况

### 2. 日志和监控

系统提供了完善的日志记录机制：

```mermaid
graph TB
subgraph "日志级别"
ERROR[错误日志]
WARN[警告日志]
INFO[信息日志]
DEBUG[调试日志]
end
subgraph "监控指标"
HTTP[HTTP请求日志]
AUTH[认证日志]
FILE[文件操作日志]
PERF[性能指标]
end
ERROR --> PM2[PM2进程管理]
WARN --> PM2
INFO --> PM2
DEBUG --> PM2
HTTP --> MONITOR[监控系统]
AUTH --> MONITOR
FILE --> MONITOR
PERF --> MONITOR
```

**章节来源**
- [SYSTEM_CONTEXT.md](file://docs/SYSTEM_CONTEXT.md#L73-L89)

### 3. 紧急处理流程

当遇到系统异常时，按照以下流程处理：

1. **立即检查**：查看PM2日志和系统状态
2. **临时恢复**：启动备用服务或降级功能
3. **根本解决**：定位问题根源并修复
4. **预防措施**：完善监控和告警机制

## 结论

VoC客户声音管理系统是一个功能完整、架构清晰的企业级应用。系统的主要优势包括：

### 核心优势

1. **多平台支持**：Web和iOS双端同步，用户体验一致
2. **权限安全**：三级权限控制，确保数据安全
3. **性能优化**：多层次缓存和异步处理机制
4. **扩展性强**：模块化设计便于功能扩展
5. **开发友好**：完善的开发工具链和文档

### 技术亮点

- **现代化技术栈**：React 18 + TypeScript + SwiftUI
- **高效数据库**：SQLite3 + better-sqlite3
- **智能文件处理**：分片上传 + 多格式支持
- **完善的认证**：JWT + Keychain集成
- **跨平台部署**：支持多种部署方式

### 发展建议

1. **监控完善**：增加更详细的性能监控指标
2. **测试覆盖**：提高自动化测试覆盖率
3. **文档更新**：保持技术文档与代码同步
4. **安全加固**：持续改进安全防护措施
5. **用户体验**：根据用户反馈优化界面设计

该系统为企业提供了完整的客户声音收集和管理解决方案，具备良好的可维护性和扩展性，能够满足现代企业的数字化转型需求。