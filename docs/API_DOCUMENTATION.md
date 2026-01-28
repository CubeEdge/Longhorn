# API Documentation (API 接口文档)

> **版本**: 1.1 (2026-01-29)
> **状态**: 活跃/Active
> **适用范围**: Server, Web Client, iOS Client

本文档详细梳理了 Longhorn 项目的各个端点（Endpoint）及其在客户端的使用情况。

## 1. 概述 (Overview)

*   **Base URL (Web/Local)**: `http://localhost:4000` (Dev), `https://opware.kineraw.com` (Prod)
*   **认证机制 (Authentication)**:
    *   **Method**: JWT (JSON Web Token)
    *   **Header**: `Authorization: Bearer <token>`
*   **数据格式**: JSON
*   **错误处理**: HTTP Status Codes + `{ error: "message" }`

---

## 2. 服务端 API (Server Endpoints)

### 2.1 身份认证与用户 (Authentication & User)

| Method | Endpoint | Description | Auth | Roles |
| :--- | :--- | :--- | :--- | :--- |
| `POST` | `/api/login` | 用户登录 | No | All |
| `GET` | `/api/user/accessible-departments` | 获取用户可访问的部门列表 | Yes | All |
| `GET` | `/api/user/permissions` | 获取用户的特殊文件夹权限 | Yes | All |
| `GET` | `/api/user/stats` | 获取用户个人统计 (上传数, 收藏数等) | Yes | All |

### 2.2 文件操作 (Files & Folders)

| Method | Endpoint | Description | Query Params | Response |
| :--- | :--- | :--- | :--- | :--- |
| `GET` | `/api/files` | 获取文件列表或下载 | `path` (dir path), `download=true` | `{ items: [FileItem], userCanWrite: Bool }` |
| `POST` | `/api/files/hit` | 增加文件访问计数 | `path` (file path) | `{ success: Bool }` |
| `GET` | `/api/files/stats` | 获取单文件详细访问记录 | `path` (file path) | `[AccessLog]` |
| `GET` | `/api/files/recent` | 获取最近访问/修改的文件 | None | `{ items: [FileItem] }` |
| `POST` | `/api/upload` | 单文件/多文件上传 | `path` (target dir) | `{ success: Bool }` |
| `POST` | `/api/upload/chunk` | 分片上传 (Chunked) | `uploadId`, `chunkIndex`, `path` | `{ success: Bool }` |
| `POST` | `/api/upload/merge` | 合并分片 | `uploadId`, `fileName`, `path` | `{ success: Bool }` |
| `POST` | `/api/folders` | 创建文件夹 | `path` (parent), `name` | `{ success: Bool }` |
| `GET` | `/api/folders/tree` | 获取文件夹树 (用于移动/复制) | None | `[FolderTreeItem]` |
| `DELETE` | `/api/files` | 删除文件/文件夹 (移入回收站) | `path` | `{ success: Bool }` |

### 3.3 数据模型 (Models) - iOS

*   **FileItem** (对应 `/api/files` 列表项):
    *   `name`: String
    *   `path`: String
    *   `isDirectory`: Bool
    *   `uploader`: String (上传者用户名, 修复: 之前 iOS 误用 `uploader_name`)
    *   `starred`: Bool (当前用户是否收藏)
    *   `size`: Int64?
    *   `mtime`: String (ISO8601)

*   **WordEntry** (对应 `/api/vocabulary/batch`):
    *   `id`: Int
    *   `word`: String
    *   `examples`: `[WordExample]` (服务端返回 JSON 数组，iOS 需解码)

---

## 4. 前端客户端实现 (Web Frontend Implementation)

前端使用 React + Vite 构建，利用 Modern Hooks 进行状态管理和数据获取。

### 4.1 核心状态: `useAuthStore.ts` (Zustand)

*   管理全局 `user` 对象和 `token`。
*   提供 `login` 和 `logout` 方法，并未持久化到 localStorage。

### 4.2 数据获取: `useCachedFiles.ts` (SWR)

*   **SWR (Stale-While-Revalidate)**: 用于高性能的文件列表加载。
*   **特点**:
    *   `dedupingInterval: 2000`: 2秒内重复请求去重。
    *   `keepPreviousData: true`: 切换目录时保留上一级 UI，防止闪烁。
    *   `prefetch(subPath)`: 预加载子目录数据，提升点击响应速度。
    *   **Smart Polling**: 仅在数据深度对比（JSON stringify）发生变化时触发 React 重渲染。

### 4.3 文件浏览器: `FileBrowser.tsx`

*   **核心组件**: 负责文件展示、导航、操作（增删改查）。
*   **上传逻辑**:
    *   使用 `AbortController` 支持取消上传。
    *   实现了分片上传 (`/api/upload/chunk`) 和合并 (`/api/upload/merge`) 逻辑，支持大文件。
*   **预览**:
    *   图片/视频: 直接通过 `<img src="/api/thumbnail...">` 或 `<video src="...">` (Server支持 Range Request)。
    *   文档: 使用 `docx-preview` 和 `xlsx` 库进行前端渲染。

### 4.4 国际化与多语言

*   API 返回错误信息通常包含英文 Key 或 Message。
*   前端通过 `i18n` (如 `useLanguage` hook) 将界面元素本地化。
*   分享页 (`/s/:token`) 支持服务端渲染 (SSR) 的多语言页面 (Server index.js lines 2236+)。

---

## 5. 开发建议 (Recommendations)

1.  **API 版本控制**: 目前未显式使用 `/v1/` 前缀，建议未来版本升级时增加。
2.  **错误码规范**: 服务端应统一返回 `{ error_code: string, message: string }` 以便客户端更好处理（目前混用了 string 和 object）。
3.  **iOS 轮询优化**: 目前 iOS 采用 5s 轮询，建议未来考虑 WebSocket 或 Push Notification 以降低服务器负载。
