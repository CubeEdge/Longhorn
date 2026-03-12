# 系统配置 API

<cite>
**本文档引用的文件**
- [server/index.js](file://server/index.js)
- [server/service/backup_service.js](file://server/service/backup_service.js)
- [server/service/routes/settings.js](file://server/service/routes/settings.js)
- [server/service/routes/system.js](file://server/service/routes/system.js)
- [scripts/health-check.sh](file://scripts/health-check.sh)
- [scripts/diagnose-performance.sh](file://scripts/diagnose-performance.sh)
- [scripts/ecosystem.config.js](file://scripts/ecosystem.config.js)
- [client/src/components/AdminPanel.tsx](file://client/src/components/AdminPanel.tsx)
- [client/src/components/SystemDashboard.tsx](file://client/src/components/SystemDashboard.tsx)
- [client/.env.production](file://client/.env.production)
- [server/package.json](file://server/package.json)
- [client/package.json](file://client/package.json)
</cite>

## 更新摘要
**所做更改**
- 新增备份配置管理功能，包括定时备份、备份保留策略和手动备份触发
- 完善系统设置管理，涵盖 AI 配置、备份设置和提供商管理
- 增强系统监控配置，提供实时健康状态和 AI 使用统计
- 新增系统参数管理的完整 API 规范，支持读取、更新和重置功能

## 目录
1. [简介](#简介)
2. [项目结构](#项目结构)
3. [核心组件](#核心组件)
4. [架构总览](#架构总览)
5. [详细组件分析](#详细组件分析)
6. [依赖关系分析](#依赖关系分析)
7. [性能考虑](#性能考虑)
8. [故障排查指南](#故障排查指南)
9. [结论](#结论)

## 简介
本文件面向系统管理员与开发人员，系统性梳理 Longhorn 项目的"系统配置 API"能力边界与实现现状。经过更新后的系统配置 API 已具备完整的备份配置管理和系统设置管理功能，能够满足企业级系统的配置需求。

当前系统配置 API 主要通过以下方式体现：
- **备份配置管理**：支持定时备份、备份频率设置、备份保留策略和手动备份触发
- **系统设置管理**：涵盖 AI 配置、备份设置、提供商管理等核心系统参数
- **系统监控配置**：提供实时健康状态监控和 AI 使用统计分析
- **环境变量配置**：通过 .env.production 注入上传域名等运行时参数

**更新** 新增备份配置和系统设置管理功能，完善系统参数管理的完整 API 规范

## 项目结构
Longhorn 采用前后端分离架构：
- **服务端（Node.js + Express）**：位于 server/，负责业务 API、静态资源、缓存与健康检查等
- **客户端（React + Vite）**：位于 client/，提供管理面板与前端交互
- **运维脚本**：位于 scripts/，提供健康检查、性能诊断、部署与发布等自动化能力

```mermaid
graph TB
subgraph "客户端"
FE_Admin["管理面板<br/>AdminPanel.tsx"]
FE_Dashboard["系统仪表盘<br/>SystemDashboard.tsx"]
FE_Env[".env.production<br/>上传域名配置"]
end
subgraph "服务端"
BE_Index["Express 应用入口<br/>index.js"]
BE_Settings["系统设置 API<br/>settings.js"]
BE_Backup["备份服务<br/>backup_service.js"]
BE_System["系统路由<br/>system.js"]
BE_Scripts["运维脚本<br/>health-check.sh / diagnose-performance.sh"]
end
FE_Admin --> |"HTTP 请求"| BE_Settings
FE_Dashboard --> |"HTTP 请求"| BE_System
FE_Env --> |"构建期注入"| FE_Admin
BE_Index --> |"配置管理"| BE_Settings
BE_Settings --> |"备份控制"| BE_Backup
BE_Scripts --> |"系统状态检查/诊断"| BE_Index
```

**图表来源**
- [server/index.js](file://server/index.js#L1-L80)
- [server/service/routes/settings.js](file://server/service/routes/settings.js#L1-L245)
- [server/service/backup_service.js](file://server/service/backup_service.js#L1-L126)
- [client/src/components/AdminPanel.tsx](file://client/src/components/AdminPanel.tsx#L1-L33)
- [client/src/components/SystemDashboard.tsx](file://client/src/components/SystemDashboard.tsx#L66-L99)
- [client/.env.production](file://client/.env.production#L1-L8)
- [scripts/health-check.sh](file://scripts/health-check.sh#L1-L115)
- [scripts/diagnose-performance.sh](file://scripts/diagnose-performance.sh#L1-L122)

**章节来源**
- [server/index.js](file://server/index.js#L1-L80)
- [server/service/routes/settings.js](file://server/service/routes/settings.js#L1-L245)
- [server/service/backup_service.js](file://server/service/backup_service.js#L1-L126)
- [client/src/components/AdminPanel.tsx](file://client/src/components/AdminPanel.tsx#L1-L33)
- [client/src/components/SystemDashboard.tsx](file://client/src/components/SystemDashboard.tsx#L66-L99)
- [client/.env.production](file://client/.env.production#L1-L8)
- [scripts/health-check.sh](file://scripts/health-check.sh#L1-L115)
- [scripts/diagnose-performance.sh](file://scripts/diagnose-performance.sh#L1-L122)

## 核心组件
- **备份配置管理**
  - 定时备份调度器，支持分钟级频率配置
  - 备份保留策略，支持天数级保留配置
  - 手动备份触发机制
  - 备份目录管理和权限控制
- **系统设置管理**
  - AI 配置参数，包括工作模式、数据源和模型设置
  - 备份设置参数，包括启用状态、频率和保留天数
  - AI 提供商管理，支持多提供商配置和激活状态
  - 系统名称和全局配置管理
- **系统监控配置**
  - 实时系统健康状态监控
  - AI 使用量统计和成本估算
  - 磁盘空间和内存使用监控
  - CPU 负载和系统资源监控

**章节来源**
- [server/service/backup_service.js](file://server/service/backup_service.js#L1-L126)
- [server/service/routes/settings.js](file://server/service/routes/settings.js#L1-L245)
- [server/index.js](file://server/index.js#L73-L97)

## 架构总览
系统配置 API 的目标是将"运行时配置"与"业务配置"以受控的方式暴露为 API，支持：
- **读取**：获取当前生效的配置快照
- **更新**：变更配置（需鉴权与审计）
- **重置**：恢复默认值
- **变更通知**：触发缓存清理、重启或热更新

```mermaid
sequenceDiagram
participant Admin as "管理员"
participant FE as "前端管理面板"
participant SettingsAPI as "系统设置 API"
participant BackupService as "备份服务"
participant ConfigStore as "配置存储层"
participant Cache as "缓存/会话"
Admin->>FE : 打开"系统设置"
FE->>SettingsAPI : GET /api/admin/settings
SettingsAPI->>ConfigStore : 读取系统设置
ConfigStore-->>SettingsAPI : 返回配置快照
SettingsAPI-->>FE : 配置数据含备份设置
Admin->>FE : 修改配置并提交
FE->>SettingsAPI : POST /api/admin/settings
SettingsAPI->>ConfigStore : 写入新配置
SettingsAPI->>BackupService : 重新加载备份配置
SettingsAPI->>Cache : 清理相关缓存
SettingsAPI-->>FE : 成功响应
Admin->>FE : 手动触发备份
FE->>SettingsAPI : POST /api/admin/backup/now
SettingsAPI->>BackupService : 执行备份
BackupService-->>SettingsAPI : 备份结果
SettingsAPI-->>FE : 备份完成
```

**图表来源**
- [server/service/routes/settings.js](file://server/service/routes/settings.js#L20-L160)
- [server/service/backup_service.js](file://server/service/backup_service.js#L23-L122)

## 详细组件分析

### 备份配置管理
备份服务提供了完整的备份配置管理功能：

- **配置参数**
  - `enabled`：备份启用状态（布尔值）
  - `frequency`：备份频率（分钟，默认 1440 分钟/24小时）
  - `retention`：备份保留天数（默认 7 天）
  - `path`：备份存储路径（默认 DiskA/.backups/db）

- **核心功能**
  - 自动化备份调度，基于配置的频率间隔执行
  - 备份文件清理，自动删除超过保留期限的旧备份
  - 手动备份触发，支持即时备份操作
  - 配置热重载，支持运行时更新备份设置

```mermaid
flowchart TD
Start(["应用启动"]) --> LoadConfig["加载系统设置配置"]
LoadConfig --> InitBackup["初始化备份服务"]
InitBackup --> CheckEnabled{"备份启用？"}
CheckEnabled --> |否| Disabled["禁用备份"]
CheckEnabled --> |是| Schedule["设置备份调度器"]
Schedule --> WaitInterval["等待下一个备份周期"]
WaitInterval --> PerformBackup["执行备份"]
PerformBackup --> CleanOld["清理过期备份"]
CleanOld --> WaitInterval
Disabled --> End(["服务就绪"])
```

**图表来源**
- [server/service/backup_service.js](file://server/service/backup_service.js#L17-L122)

**章节来源**
- [server/service/backup_service.js](file://server/service/backup_service.js#L1-L126)
- [server/service/routes/settings.js](file://server/service/routes/settings.js#L38-L42)

### 系统设置管理
系统设置 API 提供了全面的系统配置管理能力：

- **系统设置接口**
  - `GET /api/admin/settings`：获取当前系统设置
  - `POST /api/admin/settings`：更新系统设置
  - `POST /api/admin/backup/now`：手动触发备份

- **配置参数**
  - **AI 设置**：`ai_enabled`、`ai_work_mode`、`ai_data_sources`
  - **备份设置**：`backup_enabled`、`backup_frequency`、`backup_retention_days`
  - **系统信息**：`system_name`、`updated_at`

- **提供商管理**
  - 支持多 AI 提供商配置（DeepSeek、Gemini、Custom）
  - 提供商激活状态管理
  - API 密钥和基础 URL 配置
  - 模型参数配置（chat_model、reasoner_model、vision_model）

```mermaid
classDiagram
class SettingsAPI {
+getSettings() SettingsResponse
+updateSettings(SettingsRequest) UpdateResponse
+triggerBackup() BackupResponse
}
class BackupService {
+init() void
+reload() void
+performBackup() BackupResult
+trigger() BackupResult
+schedule() void
+cleanOldBackups() void
}
class SettingsController {
+validateSettings(Settings) boolean
+normalizeBoolean(value) boolean
+parseJsonArray(jsonString) Array
}
SettingsAPI --> SettingsController
SettingsAPI --> BackupService
BackupService --> SettingsController
```

**图表来源**
- [server/service/routes/settings.js](file://server/service/routes/settings.js#L20-L160)
- [server/service/backup_service.js](file://server/service/backup_service.js#L4-L126)

**章节来源**
- [server/service/routes/settings.js](file://server/service/routes/settings.js#L1-L245)
- [server/index.js](file://server/index.js#L73-L97)

### 系统监控配置
系统监控 API 提供了实时的系统状态监控和统计分析：

- **健康监控接口**
  - `GET /api/admin/stats/system`：实时系统健康状态
  - `GET /api/admin/stats/ai`：AI 使用历史统计

- **监控指标**
  - **系统状态**：CPU 负载、内存使用、系统运行时间、平台信息
  - **AI 使用**：每日 token 使用量、总 token 数、估算成本
  - **磁盘空间**：磁盘容量和剩余空间（可选）

- **统计分析**
  - 30 天 AI 使用趋势分析
  - 成本估算算法（基于 token 使用量）
  - 实时系统资源监控

```mermaid
flowchart LR
Monitor["系统监控"] --> Health["健康状态监控"]
Monitor --> AIUsage["AI 使用统计"]
Health --> CPULoad["CPU 负载"]
Health --> MemUsage["内存使用"]
Health --> DiskSpace["磁盘空间"]
AIUsage --> TokenTrend["Token 使用趋势"]
AIUsage --> CostEstimate["成本估算"]
```

**图表来源**
- [server/service/routes/settings.js](file://server/service/routes/settings.js#L175-L241)

**章节来源**
- [server/service/routes/settings.js](file://server/service/routes/settings.js#L175-L241)

### 运行时配置与环境变量
- **服务端常量**
  - 端口、数据库路径、磁盘根目录、回收站目录、缩略图缓存目录、JWT 密钥等
- **客户端环境变量**
  - 上传基础域名（用于绕过代理超时限制）

```mermaid
flowchart TD
Start(["应用启动"]) --> LoadEnv["加载 .env / 进程环境变量"]
LoadEnv --> InitDB["初始化数据库连接"]
InitDB --> MountFS["挂载磁盘根目录与缓存目录"]
MountFS --> InitJWT["初始化 JWT 密钥"]
InitJWT --> InitBackupService["初始化备份服务"]
InitBackupService --> Ready(["服务就绪"])
```

**图表来源**
- [server/index.js](file://server/index.js#L14-L25)
- [client/.env.production](file://client/.env.production#L1-L8)

**章节来源**
- [server/index.js](file://server/index.js#L14-L25)
- [client/.env.production](file://client/.env.production#L1-L8)

### 健康检查与系统监控
- **健康检查脚本**
  - 检查后端/前端端口监听状态、数据库完整性、必要字段缺失时自动修复
- **性能诊断脚本**
  - 收集 PM2 进程状态、本地 API 响应时间、数据库规模、图片文件分布、网络连通性、系统资源使用等

```mermaid
flowchart TD
HC_Start(["执行健康检查"]) --> CheckPorts["检查端口监听"]
CheckPorts --> CheckDB["检查数据库完整性"]
CheckDB --> StartServices{"服务是否运行？"}
StartServices --> |否| AutoStart["尝试启动后端/前端"]
StartServices --> |是| DoneHC["输出检查结果"]
DP_Start(["执行性能诊断"]) --> PM2List["PM2 进程状态"]
PM2List --> APITest["本地 API 响应时间测试"]
APITest --> DBInfo["数据库规模与结构"]
DBInfo --> FileDist["图片文件大小分布"]
FileDist --> NetTest["网络连通性测试"]
NetTest --> SysRes["系统资源使用"]
SysRes --> Report["生成诊断报告"]
```

**图表来源**
- [scripts/health-check.sh](file://scripts/health-check.sh#L1-L115)
- [scripts/diagnose-performance.sh](file://scripts/diagnose-performance.sh#L1-L122)

**章节来源**
- [scripts/health-check.sh](file://scripts/health-check.sh#L1-L115)
- [scripts/diagnose-performance.sh](file://scripts/diagnose-performance.sh#L1-L122)

### 管理端界面与占位
- **管理面板**：包含"系统设置"占位页，现已实现完整的配置管理功能
- **仪表盘**：展示系统概览，包含健康状态和统计信息

**章节来源**
- [client/src/components/AdminPanel.tsx](file://client/src/components/AdminPanel.tsx#L26-L30)
- [client/src/components/SystemDashboard.tsx](file://client/src/components/SystemDashboard.tsx#L66-L99)

### 当前可用的系统级 API（与配置相关）
- **健康状态**
  - `GET /api/status`：返回服务名称、状态、版本
- **系统统计（间接反映配置影响）**
  - `GET /api/admin/stats`：管理员视角的系统用量、上传趋势、Top 上传者等
  - `GET /api/department/my-stats`：部门维度的文件数量、存储使用、成员数
- **权限与访问**
  - `GET /api/user/permissions`：用户有效权限列表
  - `POST /api/files/access`：记录文件访问（用于审计与统计）
- **系统设置管理**
  - `GET /api/admin/settings`：获取系统设置
  - `POST /api/admin/settings`：更新系统设置
  - `POST /api/admin/backup/now`：手动触发备份
- **系统监控**
  - `GET /api/admin/stats/system`：实时系统健康状态
  - `GET /api/admin/stats/ai`：AI 使用历史统计

**章节来源**
- [server/index.js](file://server/index.js#L477-L479)
- [server/service/routes/settings.js](file://server/service/routes/settings.js#L20-L160)
- [server/service/routes/settings.js](file://server/service/routes/settings.js#L175-L241)

## 依赖关系分析
- **服务端依赖**
  - Express、better-sqlite3、bcryptjs、jsonwebtoken、sharp、multer、compression、cors、dotenv 等
- **客户端依赖**
  - axios、react-router-dom、zustand 等
- **运维依赖**
  - ecosystem.config.js 描述了 PM2 集群模式、实例数、日志与重启策略等

```mermaid
graph LR
S_Pkg["server/package.json"] --> S_Core["核心模块"]
C_Pkg["client/package.json"] --> C_UI["前端模块"]
Ecosys["ecosystem.config.js"] --> PM2["PM2 集群/日志/重启策略"]
S_Core --> |"运行时配置"| S_Index["server/index.js"]
C_UI --> |"调用 API"| S_Index
Ecosys --> |"部署/监控"| S_Index
```

**图表来源**
- [server/package.json](file://server/package.json#L1-L30)
- [client/package.json](file://client/package.json#L1-L45)
- [scripts/ecosystem.config.js](file://scripts/ecosystem.config.js#L1-L41)

**章节来源**
- [server/package.json](file://server/package.json#L1-L30)
- [client/package.json](file://client/package.json#L1-L45)
- [scripts/ecosystem.config.js](file://scripts/ecosystem.config.js#L1-L41)

## 性能考虑
- **备份性能优化**
  - 异步备份执行，避免阻塞主服务线程
  - 备份文件压缩和增量备份策略
  - 备份保留策略优化，减少磁盘占用
- **配置管理性能**
  - 配置缓存机制，避免频繁读取数据库
  - 配置变更的批量更新，减少数据库操作次数
  - 备份服务的懒加载和按需初始化
- **监控性能**
  - 实时监控数据的缓存和批量更新
  - AI 使用统计的分页查询和索引优化
  - 系统资源监控的采样频率控制

**章节来源**
- [server/service/backup_service.js](file://server/service/backup_service.js#L76-L97)
- [server/service/routes/settings.js](file://server/service/routes/settings.js#L175-L241)

## 故障排查指南
- **备份故障排查**
  - 检查备份目录权限和磁盘空间
  - 验证数据库连接和备份文件格式
  - 查看备份服务日志和错误信息
  - 测试手动备份功能
- **配置管理故障排查**
  - 验证系统设置表结构和数据完整性
  - 检查 AI 提供商配置的有效性
  - 验证备份服务的配置重载功能
  - 查看配置更新的日志记录
- **健康检查**
  - 使用 health-check.sh 检查端口、数据库完整性与服务自启
- **性能诊断**
  - 使用 diagnose-performance.sh 采集 PM2、数据库、文件分布、网络与系统资源信息
- **配置变更验证**
  - 通过 `/api/status` 与 `/api/admin/stats` 验证配置变更对服务的影响

**章节来源**
- [scripts/health-check.sh](file://scripts/health-check.sh#L1-L115)
- [scripts/diagnose-performance.sh](file://scripts/diagnose-performance.sh#L1-L122)
- [server/service/backup_service.js](file://server/service/backup_service.js#L49-L55)
- [server/service/routes/settings.js](file://server/service/routes/settings.js#L146-L160)

## 结论
- **现状**：系统配置 API 已实现完整的备份配置管理和系统设置管理功能，支持读取、更新、重置与审计能力
- **功能完善**：新增备份配置管理、系统设置管理、系统监控配置等核心功能
- **架构优化**：基于现有的 API 与界面，扩展了"系统配置 API"，形成完整的配置管理体系
- **建议**：继续完善配置变更的审计日志、配置模板管理和配置导入导出功能

**更新** 新增备份配置和系统设置管理功能，完善系统参数管理的完整 API 规范，形成可审计、可回滚、可监控的系统配置管理体系