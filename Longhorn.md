# Longhorn 协同文件系统

Longhorn 是 Kinefinity 团队的企业级本地数据协作系统，由三部分组成：**Server (服务端)**、**Web Client (网页端)** 和 **iOS App (移动端)**。

本系统旨在提供安全、高效的局域网/广域网文件访问、多级权限管理及跨部门协作能力。

---

## 📚 项目导航 (Documentation Index)

本仓库包含两个独立维护的前端项目和一个共享后端：

### 1. [Longhorn Web System](./client/docs/PRD.md)
网页端管理后台与文件浏览器，面向 PC/Mac 桌面用户。
- **定位**: 全功能文件管理、系统设置、权限分配、数据统计。
- **文档**:
    - [产品需求文档 (PRD)](./client/docs/PRD.md)
    - [开发日志 (Prompt Log)](./client/docs/prompt_log.md)
    - [变更日志 (Changelog)](./client/docs/CHANGELOG.md)
- **快速开始**:
    ```bash
    cd client && npm run dev  # Port: 3001
    cd server && npm run dev  # Port: 4000
    ```

### 2. [Longhorn iOS App](./ios/docs/PRD.md)
原生 iOS 移动客户端，面向 iPhone/iPad 用户。
- **定位**: 移动办公、现场文件查阅、个人空间管理。
- **文档**:
    - [产品需求文档 (PRD)](./ios/docs/PRD.md)
    - [iOS 开发指南](./ios/docs/iOS_Dev_Guide.md)
    - [开发日志 (Prompt Log)](./ios/docs/prompt_log.md)
    - [变更日志 (Changelog)](./ios/docs/CHANGELOG.md)
- **快速开始**:
    - 打开 `ios/LonghornApp/LonghornApp.xcodeproj`
    - Target: `LonghornApp` (iPhone/iPad)

### 3. Server Node (Backend)
基于 Node.js + SQLite 的高性能服务端，为 Web 和 iOS 提供统一 API。
- **路径**: `server/`
- **核心功能**: 文件 I/O、权限验证 (JWT)、数据库管理 (SQLite)、视频转码 (FFmpeg)。
- **部署维护**:
    - [运维与部署手册 (OPS Manual)](./docs/OPS.md)

---

## 🛠 系统架构概览

```mermaid
graph TD
    Client[Web Client (React)] -->|HTTP/REST| API[Node.js Server]
    iOS[iOS App (SwiftUI)] -->|HTTP/REST| API
    iOS -->|WebSockets| API
    
    API -->|Read/Write| DB[(SQLite DB)]
    API -->|File I/O| Disk[Local Disk / RAID]
    
    subgraph "Infrastructure"
        PM2[Process Manager]
        Tunnel[Cloudflare Tunnel]
        Rsync[Auto Backup]
    end
    
    PM2 --> API
    Tunnel --> API
```


---
© 2026 Kinefinity Team.
