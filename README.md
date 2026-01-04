# Longhorn: Enterprise Local Data Server

Longhorn is a high-performance local data server designed for Kinefinity, optimized for Mac mini M1 with dual-disk redundancy.

## Features
- **MacOS 26 UI**: Ultra-modern glassmorphism design.
- **Admin-Managed Auth**: Secure user creation and role management.
- **Disk Redundancy**: Automated rsync backup from Disk A to Disk B.
- **Public Tunneling**: Professional sharing links via UUID-based mapping.

## Setup Instructions

### 1. Server Configuration
```bash
cd server
npm start
```
Default Admin: `admin` / `admin123`

### 2. Client Access
```bash
cd client
npm run dev
```
Accessible at [http://localhost:3001](http://localhost:3001)

### 3. Tunneling (opware.kineraw.com)

1. Sign up for Cloudflare and add the domain `kineraw.com`.
2. Install `cloudflared` on the M1 server.
3. Authenticate and create a tunnel.
4. Add a CNAME record for `opware.kineraw.com` pointing to your tunnel ID.

## 运维指南

### 服务健康检查
```bash
./health-check.sh
```
自动检查前后端服务状态、数据库完整性，并提供自动恢复选项。

### 数据库验证
```bash
./db-validate.sh
```
验证数据库表结构完整性，自动修复缺失的列。

### 常见问题排查

**问题：页面无法访问**
```bash
# 检查服务状态
lsof -i :3001  # 前端
lsof -i :4000  # 后端

# 重启服务
./health-check.sh
```

**问题：系统概览加载失败**
```bash
# 验证数据库
./db-validate.sh

# 重启后端
cd server && npm run dev
```

**问题：权限错误**
- 检查 `server/longhorn.db` 是否有 `last_login` 列
- 运行 `./db-validate.sh` 自动修复

### 部署流程
1. 运行 `./db-validate.sh` 验证数据库
2. 运行 `./health-check.sh` 确认服务状态
3. 执行 `./publish.sh` 部署到生产环境

---
© 2026 Kinefinity Team. Design by Longhorn.
