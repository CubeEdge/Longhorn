# System Context (系统全景图)

> **核心作用**: 本文档定义了 Longhorn 项目的“世界观”，包括硬件设施、核心代码逻辑与已知限制。
> **AI 助手必读**: 每次开始任务前，请先运行 `.@/context` 指令以加载最新环境上下文。

## 0. 核心资产与环境 (Environment Assets)

| 资产名称 | 详细路径/地址 | 说明 |
| :--- | :--- | :--- |
| **生产域名** | `opware.kinefinity.com` | 系统主入口 |
| **SSH 访问** | `ssh.kineraw.com` (别名 `mini`) | 详见 `OPS.md` |
| **服务器** | Mac mini (M1 Chip) | 核心计算与转码节点 |
| **本地代码** | `/Users/Kine/Documents/.../Longhorn` | 开发源码源 |
| **远程代码** | `/Users/admin/Documents/server/Longhorn` | 生产环境路径 |
| **核心存储** | `/Volumes/fileserver` | 统一文件存储挂载点 |
| **数据库** | `.../server/longhorn.db` | SQLite 数据库 (详见 `OPS.md`) |

## 1. 核心开发规则 (Critical Rules)

1.  **权限分离**: 运维/访问/部署细节严禁写在本文档。**必须**查阅 `OPS.md`。
2.  **Remote Ops**: 远程执行必须遵循 `OPS.md` 的 Non-interactive SSH 规范 (login shell)。
3.  **Deployment & Verification**: 统一使用 `./scripts/deploy.sh` 部署。**代码修改执行后必须立即发布到远程服务器**。严禁仅在本地验证，所有功能修改必须在远程环境验证后方可交付。
4.  **构建完整性**: 修改前端后**必须**执行 `npm run build` 并验证产物。部署前物理删除旧 `dist`。
5.  **UI 风格**: 主题色锁定为 **Kine Yellow** (#FFD700)，遵循 **macOS26/iOS26** 设计规范。
6.  **AI 设计规范**: 
    - 核心色: **Kine Green** (#00A650) 用于 AI 相关组件（如 Bokeh）。
    - 渐变色: **AI 渐变色 (Bokeh Gradient)** 统一定义为 `linear-gradient(135deg, #00A650, #8E24AA)`。
7.  **多语言交互**: 严禁硬编码文字，确保支持 简中、英、德、日。
8.  **版本管理**: 每次修改代码后，**必须**同步递增 `client` 和 `server` 的版本号（通常在 `package.json` 中维护 Z 位版本）。

## 2. 技术栈 (Tech Stack)

*   **后端**: Node.js (Express) + SQLite3 (`better-sqlite3`)
*   **前端**: React 18 (Vite) + TailwindCSS
*   **移动端**: SwiftUI (iOS 16+)

## 3. 文档索引 (Authority Index)

*   **运维/部署/访问 (必读)**: [OPS.md](/docs/OPS.md)
*   **业务需求**: `/docs/Service_PRD.md` / `Service_API.md`
*   **开发日志**: `log_dev.md`
*   **待办规划**: `log_backlog.md`
