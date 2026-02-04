# System Context (系统全景图)

> **最后更新/Last Updated**: 2026-01-23
> **核心作用**: 本文档定义了 Longhorn 项目的"世界观"，包括硬件设施、部署架构、核心代码逻辑与已知限制。
> **AI 助手必读**: 每次开始任务前，请先阅读本文档以获取环境上下文。

## 0. 核心开发规则 (Critical Rules)
1.  **部署原则**：代码更新后，必须执行 `./scripts/deploy.sh` 部署到远程服务器 (https://opware.kineraw.com)。确认部署成功（查看 Ops 日志）后，再通知用户验收。
2.  **主题色**：App 主题色严格锁定为 **Kine Yellow** (#FFD700)，严禁使用默认蓝色或紫色。
3.  **UI 风格**：Web 前端设计必须遵循 **macOS26** 风格（玻璃拟态、圆角、模糊背景、深色模式）。而iOS App设计必须遵循 **iOS26** 风格。
4.  **版本管理**：开发版本号需在 `client/package.json` 中维护。每次代码修改后，**自动递增**最后一位（例如 1.1.1 -> 1.1.2），并确保右上角用户菜单中以 **绿色** 显示版本号。
5. **交互中文**：所有回复、思考过程及任务清单、文档，均须使用中文。
**称呼**：在对话里面，提到用户/user的时候，使用Jihua，作为用户的名字
**多语言** 避免任何硬编码文字，所有UI、交互都会是多语言版本，简体中文、英语、德语和日语。
**AI 优先**：本项目已集成 DeepSeek AI，涉及后端逻辑变更时需同步检查 `AIService` 及其日志功能。


## 1. 基础设施 (Infrastructure)

*   **服务器硬件**: Mac mini (M1 Chip) - *注意: 视频转码主要依赖 CPU (ffmpeg), M1 性能足够但需留意并发。*
*   **操作系统**: macOS (Server端), macOS (开发机)
*   **网络架构 (Cloudflare Tunnel)**:
    *   **Web 访问**: `https://opware.kineraw.com` -> `localhost:4000`
    *   **SSH 访问**: `ssh.kineraw.com` -> `localhost:22` (用户: `admin`)
    *   **连接详情**: 详见 `docs/OPS.md` 中的 "服务器访问" 章节。
*   **进程管理 (PM2)**:
    *   `longhorn`: 主后端服务
    *   `longhorn-watcher`: 自动部署哨兵 (每 60s 检查 git pull)
*   **文件存储**:
    *   **代码路径 (Server)**: `/Users/admin/Documents/server/Longhorn`
    *   **代码路径 (Dev)**: `/Users/Kine/Documents/Kinefinity/KineCore/Pool/Mega/Longhorn`
    *   **数据挂载**: 主要文件存储在 `/Volumes/fileserver` (或类似挂载点，视具体配置而定，代码中通常引用相对路径或配置路径).

## 2. 技术栈 (Tech Stack)

### 后端 (Server)
*   **Runtime**: Node.js
*   **Framework**: Express.js
*   **Database**: SQLite3 (`server/longhorn.db`)
*   **Key Libs**:
    *   `better-sqlite3`: 数据库交互
    *   `sharp`: 图片缩略图生成
    *   `fluent-ffmpeg`: 视频转码/缩略图
    *   `socket.io`: (如有) 实时通讯
    *   `jsonwebtoken`: JWT 身份验证

### 前端 (Web Client)
*   **Build Tool**: Vite
*   **Framework**: React 18
*   **Styling**: TailwindCSS (v3), PostCSS
*   **Key Components**: `DepartmentManagement` (权限管理), `FileBrowser` (核心视图)

### 移动端 (iOS Client)
*   **Platform**: iOS 16.0+
*   **Architecture**: SwiftUI + MVVM
*   **Key Patterns**:
    *   **Polling**: 前台每 5s 轮询文件列表，模拟实时性。
    *   **PreviewCache**: `PreviewCacheManager` + `AsyncImage`，本地缓存预览图以提升加载速度。
    *   **Gestures**: 自定义下拉关闭、上拉详情手势 (模仿 iOS Photos)。

## 3. 核心机制 (Core Mechanics)

### 3.1 权限体系 (Permissions)
采用 **三级权限设计** (详见 `CONTRIBUTE_PERMISSION_IMPLEMENTATION.md`):
1.  **Read (只读)**: 仅浏览/下载。
2.  **Contribute (贡献)**: 
    *   可上传/新建。
    *   **仅可修改/删除自己上传的文件** (依赖 `file_stats` 表中的 `uploader_id` 字段)。
3.  **Full (完全)**: 可管理所有文件 (Admin/Lead 默认拥有)。

### 3.2 文件处理 (File Processing)
*   **上传**: 分片上传 (Chunked Upload)，断点续传支持。
*   **缩略图**:
    *   图片: `sharp` resize.
    *   视频: `ffmpeg` 截取帧 (耗时操作，有队列机制).
    *   HEIC: 转换为 JPEG 缓存。
*   **缓存**: 服务端生成后缓存于 `server/cache` 或 `server/thumbnails` 目录。

### 3.3 部署流程 (Deployment)
1.  **Dev**: 本地 MBAir 开发 -> `git push`。
2.  **Ops**: Mac mini 上的 `longhorn-watcher` 自动检测 -> `git pull` -> `npm run build` (if needed) -> `pm2 restart`。
3.  **Manual**: 紧急情况下可 SSH 连入执行 `npm run deploy`。

## 4. 常见问题与运维 (Troubleshooting & Ops)

### 已知问题 (Known Issues)
*   **侧边栏部门重复**: 数据库脏数据导致，需清理旧的中文名部门记录 (参考 `deployment.md` 3.1)。
*   **Unknown Uploader**: (已通过 Omni-Matcher 修复) 历史文件路径格式差异导致的问题已解决。
*   **iOS 预览黑屏**: 确保使用 `item: $binding` 而非 `isPresented: $bool` 触发 `fullScreenCover`。
*   **M1 GPU 限制**: `ffmpeg` 主要靠 CPU 软解/硬解，大量并发视频处理可能导致服务卡顿。

### 常用命令
```bash
# 查看日志
pm2 logs longhorn
# 检查健康状态
./health-check.sh
# 数据库备份 (建议定期)
cp server/longhorn.db server/longhorn_backup.db
```

## 5. 项目文档索引 (Documentation Index)
*   `OPS.md`: 运维与部署手册 (权威)
*   `iOS_Dev_Guide.md`: iOS 端开发细节
*   `PRODUCT_BACKLOG.md`: 功能规划与当前待办
*   `DEV_LOG.md`: 每日开发流水账
