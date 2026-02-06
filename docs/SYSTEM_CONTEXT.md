# System Context (系统全景图)

> **最后更新/Last Updated**: 2026-01-23
> **核心作用**: 本文档定义了 Longhorn 项目的"世界观"，包括硬件设施、部署架构、核心代码逻辑与已知限制。
> **AI 助手必读**: 每次开始任务前，请先阅读本文档以获取环境上下文。

## 0. 核心开发规则 (Critical Rules)
1. **Deployment**：必须关闭 `longhorn-watcher` 自动同步，统一使用 `./scripts/deploy.sh` 进行全部署。
2. **Ghost UI Prevention (构建完整性)**：远程构建必须强制使用登录 Shell (`zsh -l`)。部署前**必须物理删除**旧 `dist` 目录 (Nuclear Cleanup) 且严禁忽略构建报错，否则旧版幽灵必将重生。
6. **构建产物校验**：凡修改前端源码（`.tsx`, `.ts`, `.css`），部署时**必须**执行 `npm run build` 并通过 `ls dist/index.html` 验证产物生成，确保护理修改后生产环境不加载旧产物或空目录。
7. **Verification Proof (交付必验)**：每次构建后必须立即核对退出码及产物时间戳，并使用 `grep` 验证关键代码已进入生产混淆包，确保 TypeScript 零报错且产物非旧版缓存，严禁未经验证即请求用户刷新。
4. **版本管理**：版本号在 `client/package.json` 中维护。每次修改后**自动递增**最后一位，并在用户菜单中以**绿色**显示。
3. **主题色与风格**：主题色锁定为 **Kine Yellow** (#FFD700)。Web 端遵循 **macOS26** 风格，iOS 端遵循 **iOS26** 风格。
5. **多语言交互**：所有回复、任务、文档均使用中文。严禁硬编码文字，确保支持 简中、英、德、日 四国语言。
8. **Remote Ops (远程执行)**：所有远程命令必须强制使用 `ssh -t mini "/bin/zsh -l -c '...命令...'"` 格式执行，以确保登录 Shell 正确加载环境变量（node, pm2, sqlite3 等）。
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

