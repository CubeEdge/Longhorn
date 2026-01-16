# Longhorn 运维与部署手册 (OPS Manual)

本文档整合了 Longhorn 系统从本地开发、代码同步、服务器部署到日常运维的完整流程。

---

## 🏗 开发与发布流程 (Git Workflow)

Longhorn 采用 **"MBAir 开发 -> GitHub 中转 -> Mac mini 自动部署"** 的工作流。

### 1. 本地开发 (MBAir)
所有代码修改均应在 MBAir 上进行。

```bash
# 1. 修改代码后提交
git add .
git commit -m "feat: 描述更新内容"

# 2. 推送到 GitHub
git push
```

### 2. 服务器更新 (Mac mini)

#### 自动模式 (推荐)
Mac mini 上运行着哨兵脚本 (`longhorn-watcher`)，它每 60 秒检测一次 GitHub 更新。
- **只要您 Push 代码，服务器会在 1 分钟内自动 拉取 -> 构建 -> 重启。**
- 无需登录服务器操作。

#### 手动模式 (紧急情况)
如果需要立即更新或自动更新失效：

```bash
# 1. SSH 连接
ssh mini  # 需配置 .ssh/config

# 2. 手动执行部署脚本
cd ~/Documents/server/Longhorn
npm run deploy
```

---

## 🖥 服务器访问 (SSH Access)

### 局域网访问 (内网)
当您与服务器在同一 Wi-Fi 下：
```bash
ssh admin@192.168.1.50
```

### 全球公网访问 (Cloudflare Tunnel)
利用 Cloudflare Tunnel 穿透，无需 VPN 即可连接。

**前提**: 本机已安装 `cloudflared`。

```bash
# 直接连接命令
ssh admin@ssh.kineraw.com --proxy-command="cloudflared access ssh --hostname %h"

# 快捷连接 (如果配置了 ~/.ssh/config)
ssh mini
```

---

## 🛠 常见运维指令

### 服务状态检查
```bash
# 在服务器项目根目录执行
./health-check.sh
```
此脚本会自动检查：
- PM2 进程状态 (longhorn, longhorn-watcher)
- 端口占用 (3001, 4000)
- 数据库连接

### 数据库维护
```bash
# 验证表结构完整性
./db-validate.sh

# 备份数据库
# (备份文件存需手动指定或使用 Cron 备份)
cp server/longhorn.db server/longhorn_backup_$(date +%Y%m%d).db
```

### 查看实时日志
```bash
# 查看主程序日志
pm2 logs longhorn

# 查看自动部署哨兵日志
pm2 logs longhorn-watcher
```

---

## 🌩 网络架构 (Cloudflare)

系统的公网访问依赖 Cloudflare Tunnel，包含两条主要路由：

1.  **Web 访问**: `https://opware.kineraw.com`
    -   映射至: `http://localhost:4000` (后端)
    -   用途: 用户日常使用

2.  **SSH 访问**: `ssh.kineraw.com`
    -   映射至: `ssh://localhost:22`
    -   用途: 管理员远程维护

### 故障排查
如果公网无法访问：
1. 检查 Mac mini 上的 `cloudflared` 服务是否运行：
   ```bash
   sudo launchctl list | grep cloudflare
   ```
2. 检查 Cloudflare Dashboard 的 Tunnel 状态是否为 Active。

---

## 📂 目录结构参考

| 节点 | 角色 | 部署路径 | 备注 |
| :--- | :--- | :--- | :--- |
| **MBAir** | 开发机 | `/Users/Kine/Documents/.../Longhorn` | 唯一代码源 |
| **Mac mini** | 服务器 | `/Users/admin/Documents/server/Longhorn` | 生产环境 |

---

> **注意**: 旧的零散部署文档 (`deployment.md`, `QUICK_DEPLOY.md`, `REMOTE_DEV_GUIDE.md`) 已归档，日常运维请以本文档 (`OPS.md`) 为准。
