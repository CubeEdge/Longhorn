# System Context (系统全景图)

> **最后更新/Last Updated**: 2026-02-25 | **Current Version**: v12.1.47 (Knowledge Base Import Optimization)
> **核心作用**: 本文档定义了 Longhorn 项目的“世界观”，包括硬件设施、部署架构、核心代码逻辑与已知限制。
> **AI 助手必读**: 每次开始任务前，请先阅读本文档以获取环境上下文。

## 0. 核心开发规则 (Critical Rules)
1. **远程服务器** 是利用 Cloudflare Tunnel 穿透的，没有固定IP，域名是opware.kinefinity.com。
2. **Remote Ops (远程执行)**：所有远程命令必须使用 `ssh mini "cd /Users/admin/Documents/server/Longhorn/server && <命令>"` 格式执行，SSH别名 `mini` 已通过 Cloudflare tunnel 配置，数据库路径为 `/Users/admin/Documents/server/Longhorn/server/longhorn.db`，执行迁移用 `sqlite3 longhorn.db < migrations/xxx.sql`。
3. **Deployment**：必须关闭 `longhorn-watcher` 自动同步，统一使用 `./scripts/deploy.sh` 进行全部署。部署脚本应在同步代码后自动执行 `pm2 reload` 而非仅 `pm2 restart`，确保新代码被加载。
4. **构建完整性**：远程构建必须强制使用登录 Shell (`zsh -l`)。部署前**必须物理删除**旧 `dist` 目录且严禁忽略构建报错。
5. **构建产物校验**：凡修改前端源码（`.tsx`, `.ts`, `.css`），部署时**必须**执行 `npm run build` 并通过 `ls dist/index.html` 验证产物生成，确保护理修改后生产环境不加载旧产物或空目录。
6. **Verification Proof (交付必验)**：每次构建后必须立即核对退出码及产物时间戳，并使用 `grep` 验证关键代码已进入生产混淆包，确保 TypeScript 零报错且产物非旧版缓存，严禁未经验证即请求用户刷新。
7. **命令行确认**对于只读操作（如curl -I检查HTTP状态、ls、cat、grep等）不需要和我确认，直接运行就可以。
9. **版本管理**：
   - **软件版本号**：在 `client/package.json` 中维护，格式为 `X.Y.Z`
   - **自动递增**：每次修改代码后自动递增Z位（最后一位）
   - **显示规范**：在用户菜单中以**绿色**显示当前版本号
   - **文档版本号**：System Context 等系统文档有独立的版本号（如v2.0.0），**不需要**与软件版本号保持一致
9. **Git 提交**：不需要每次执行完就自动 commit 和 push，**听从用户指示**再执行
10. **UI风格**：所有UI设计风格，主题色锁定为 **Kine Yellow** (#FFD700)。所有UI设计风格，Web 端遵循 **macOS26** 风格，iOS 端遵循 **iOS26** 风格。成功 选中采用 **Kine Green**(#10B981);警示危险紧急 采用 **kine red**(#EF4444)；**Kine Blue** (#3B82F6)。
11. **多语言交互**：所有回复、任务、文档均使用中文。严禁硬编码文字，确保支持 简中、英、德、日 四国语言。
12. **Documentation Versioning (文档版本号管理)**：凡对系统核心文档（PRD、API、UserScenarios、DataModel 等）进行内容更新，必须同步升级其内部版本号并刷新“最后更新”日期，以确保文档的可追溯性和一致性。**Wiki 引用**：仅在该列表展示知识库文章，隐藏工单关联。

## 1. 基础设施 (Infrastructure)

*   **服务器**: Mac mini (M1 Chip) - 视频转码主要依赖 CPU (ffmpeg)。
*   **网络 (Cloudflare Tunnel)**:
    *   **Web**: `https://opware.kineraw.com` -> `localhost:4000`
    *   **SSH**: `ssh.kineraw.com` -> `localhost:22` (用户: `admin`)
*   **进程 (PM2)**:
    *   `longhorn`: 主后端服务
    *   `longhorn-watcher`: 自动部署哨兵 (高频开发期间建议关闭)
*   **存储**:
    *   **代码 (Server)**: `/Users/admin/Documents/server/Longhorn`
    *   **数据挂载**: `/Volumes/fileserver`

## 2. 技术栈 (Tech Stack)

### 后端 (Server)
*   Node.js + Express + SQLite3
*   `better-sqlite3`, `sharp`, `fluent-ffmpeg`, `jsonwebtoken`

### 前端 (Web Client)
*   React 18 + Vite + TailwindCSS
*   **核心模块**: 权限管理 (`AdminPanel`), 资源浏览 (`FileBrowser`)

### 移动端 (iOS Client)
*   SwiftUI + MVVM (iOS 16.0+)
*   5s 轮询同步，`PreviewCacheManager` 缓存。

## 3. 核心机制 (Core Mechanics)

### 3.1 权限体系 (Permissions)
采用 **三级权限设计**:
1.  **Read (只读)**: 浏览/下载。
2.  **Contribute (贡献)**: 上传/新建，且**仅可修改自己上传的文件**。
3.  **Full (完全)**: 管理所有文件 (Admin/Lead 拥有)。

### 3.2 部署流程 (Deployment)
遵循本文件 **Section 0, Rule 1** 的原子化部署要求：
1.  **Dev**: 本地开发 -> `git push`。
2.  **Manual Ops**: 使用 `./scripts/deploy.sh` 进行全量同步、Nuclear Cleanup 及远程构建。

## 4. 常见问题与运维 (Troubleshooting & Ops)

### 已知问题 (Known Issues)
*   **部门重复**: 需清理数据库中旧的中文名部门记录。
*   **iOS 预览**: 必须使用 `item: $binding` 方式触发。
*   **性能**: 大并发视频转码可能受 M1 GPU/CPU 限制。

---

## 5. 项目文档索引 (Documentation Index)

### 🎧 Service 模块 (Service Module)
*   `Service_PRD.md`: Service 模块核心需求文档
*   `Service_API.md`: Service 模块核心API
*   `Service_UserScenarios.md`: Service 模块用户场景

### 📂 Files 模块 (Files Module)
*   `CONTRIBUTE_PERMISSION_IMPLEMENTATION.md`: 贡献者权限实现细节
*   `iOS_Dev_Guide.md`: iOS 端开发细节
*   `deployment.md`: 历史部署记录与常见问题

### 🛠️ 运维与系统 (System & Ops)
*   `OPS.md`: 运维与部署手册 (权威)
*   `DEV_LOG.md`: 每日开发流水账
*   `PRODUCT_BACKLOG.md`: 功能规划与当前待办

