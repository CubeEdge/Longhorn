# Longhorn 运维与部署手册 (OPS Manual)

本文档整合了 Longhorn 系统从本地开发、代码同步、服务器部署到日常运维的完整流程。

---

## 🏗 开发与部署流程 (Workflow)

Longhorn 支持两种部署模式：**快速部署 (Fast Mode)** 和 **标准部署 (Standard Mode)**。

### 1. 快速部署 (Fast Mode) - 推荐日常开发
直接将本地代码同步到服务器并自动重启，无需经过 GitHub，速度最快（通常 <5秒）。

```bash
# 在项目根目录执行
./scripts/deploy.sh
```
**`deploy.sh` 的执行逻辑：**
1.  **本地构建**：自动运行 `npm run build` 编译前端代码。部署前**必须物理删除**旧 `dist` 目录。
2.  **增量同步**：使用 `rsync` 将前后端代码同步到服务器。
3.  **远程重启**：必须执行 `pm2 reload` 而非仅 `pm2 restart`，确保护理修改后加载新代码。统一停用 `longhorn-watcher` 自动同步。

---

### 2. 标准部署 (Standard Mode) - 版本发布/备份
通过 GitHub 进行版本控制，适用于里程碑发布或多人协作。

#### A. 推送代码 (各开发者)
```bash
# 1. 提交本地更改
git add .
git commit -m "feat: 描述更新内容"

# 2. 推送到 GitHub
git push origin master
```

#### B. 服务器手动更新 (紧急情况)
如果自动更新失效，可 SSH 登录手动操作：
```bash
ssh mini
cd ~/Documents/server/Longhorn
git pull
npm install
npm run deploy
```

---

## 🖥 服务器访问 (SSH Access)


### 全球公网访问 (Cloudflare Tunnel)
利用 Cloudflare Tunnel 穿透，没有固定 IP。

- **Web 域名**: `https://opware.kineraw.com` (或 `opware.kinefinity.com`)
- **SSH 域名**: `ssh.kineraw.com`

**前提**: 本机已安装 `cloudflared`。

```bash
# 直接连接命令
ssh admin@ssh.kineraw.com --proxy-command="cloudflared access ssh --hostname %h"

# 快捷连接 (如果配置了 ~/.ssh/config)
# 快捷连接 (如果配置了 ~/.ssh/config)
ssh mini
```

### 远程命令执行 (Remote Execution)

⚠️ **规范格式**: 
所有远程命令必须使用登录 Shell (`zsh -l`) 执行，且必须先切换至工作目录。

**标准命令格式**:
```bash
ssh mini "/bin/zsh -l -c 'cd /Users/admin/Documents/server/Longhorn/server && <命令>'"
```

**数据库维护示例**:
- **数据库路径**: `/Users/admin/Documents/server/Longhorn/server/longhorn.db`
- **执行迁移**: `ssh mini "/bin/zsh -l -c 'cd /Users/admin/Documents/server/Longhorn/server && sqlite3 longhorn.db < migrations/xxx.sql'"`
- **直接查询**: `ssh mini "/bin/zsh -l -c 'sqlite3 ~/Documents/server/Longhorn/server/longhorn.db \"SELECT ...\"'"`

#### 💡 权限说明 (Command Confirmation)
对于只读操作（如 `ls`, `cat`, `grep`, `curl -I`, `sqlite3 ... "SELECT..."` 等），Agent **无需请求用户确认**，直接运行即可。只有涉及删除、修改或系统配置变更的操作才需要申请权限。

### 局域网访问 (内网)
现在很少使用了：基本所有的验证和测试都是在远程服务器上
（当您与服务器在同一 Wi-Fi 下：
```bash
ssh admin@192.168.1.50
```
）

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
    -   别名域: `opware.kinefinity.com`
    -   用途: 用户日常使用

2.  **SSH 访问**: `ssh.kineraw.com`
    -   映射至: `ssh://localhost:22`
    -   用途: 管理员远程维护

---

## ⚡️ 构建完整性与校验 (Build Integrity)

为确保生产环境运行的是期望的代码，必须严格遵守以下校验流程：

### 1. 物理清理
在执行 `npm run build` 前，**必须**手动或通过脚本物理删除旧的 `dist` 目录。严禁在旧产物上覆盖。

### 2. 构建报错拦截
严禁忽略构建过程中的任何错误。如果 TypeScript 报错或打包中止，严禁执行后续的同步（rsync）操作。

### 3. 产物存在性校验
部署前必须执行以下校验：
```bash
# 验证 index.html 已生成且时间戳为最新
ls -la dist/index.html
```

### 4. 混淆包内容校验 (Verification Proof)
凡修改涉及前端核心源码，部署后必须使用 `grep` 验证关键代码（如新的版本号或特定功能字符串）已正确进入混淆后的 JS 包：
```bash
grep "new_feature_string" dist/assets/index-*.js
```
执行 `./scripts/deploy.sh` 后，必须立即核对退出码，严禁未经验证即请求用户刷新。

---

## 🏷 版本管理规范 (Versioning)

### 1. 软件版本号 (Software Version)
- **文件**: 在 `client/package.json` 和 `server/package.json` 中维护。
- **格式**: `X.Y.Z` (例如 `12.1.53`)。
- **递增机制**: 每次修改代码（Bug 修复或功能更新）后，**自动递增 Z 位**（最后一位）。
- **UI 显示**: 顶部菜单栏必须以**绿色** (Kine Green) 显示当前版本号。

### 2. 文档版本号 (Doc Version)
- **范围**: 包含 `System Context`, `PRD`, `API` 等文档。
- **独立性**: 文档版本号独立于软件版本（如 `v2.0.0`），**不需要**与软件版本保持同步。

## ⚡️ 开机自启动配置 (Auto-start Setup)

为了确保 Mac mini 在断电重启或意外关机后能自动恢复服务，必须配置以下三个层级的自启动。

### 1. 硬件层级：断电自动开启
确保 Mac mini 在恢复供电后立即自动开机。
- **操作**: 
    1. 打开 **系统设置 (System Settings)** -> **能源节省 (Energy Saver)**。
    2. 勾选 **断电后自动启动 (Start up automatically after a power failure)**。
- **命令行验证**:
  ```bash
  sudo pmset -a autorestart 1
  ```

### 2. 进程层级：PM2 自动管理
确保 Node.js 服务和哨兵脚本在系统启动时运行。
- **操作**:
  ```bash
  # 1. 生成启动脚本 (会输出一条 sudo 命令，请在服务器执行)
  pm2 startup
  
  # 2. 保存当前运行的任务列表（确保 longhorn 和 longhorn-watcher 在列表中）
  pm2 save
  ```

### 3. 网络层级：Cloudflare Tunnel
确保公网访问通道作为系统服务运行。
- **操作**:
  ```bash
  # 将 cloudflared 安装为系统服务（仅需执行一次）
  sudo cloudflared service install
  ```
- **验证**:
  ```bash
  sudo launchctl list | grep cloudflare
  ```

---

## 📂 文件存储架构 (Fileserver)

所有用户文件（Files应用、Service应用）统一存储在 `/Volumes/fileserver/` 目录下。

### 目录结构

```
/Volumes/fileserver/
├── 📁 Files/                    # Files 应用根目录
│   ├── MS/                      # 市场部部门文件
│   ├── OP/                      # 运营部部门文件
│   ├── RD/                      # 研发部部门文件
│   ├── RE/                      # 通用台面
│   ├── GE/                      # 旧目录（保留）
│   └── MEMBERS/                 # 个人空间
│       └── {username}/
│
├── 📁 Service/                  # Service 应用根目录
│   ├── 📁 Tickets/              # 工单附件
│   │   ├── Inquiry/             # 咨询工单
│   │   ├── RMA/                 # RMA返厂单
│   │   └── DealerRepair/        # 经销商维修单
│   │
│   ├── 📁 Knowledge/            # 知识库资源
│   │   ├── Images/              # 知识库图片
│   │   ├── Videos/              # 知识库视频
│   │   └── Documents/           # 知识库文档
│   │
│   ├── 📁 Products/             # 产品相关
│   │   ├── Photos/              # 产品照片
│   │   ├── Manuals/             # 说明书
│   │   └── Firmware/            # 固件文件
│   │
│   └── 📁 Temp/                 # 临时上传目录
│       └── Chunks/              # 分块上传临时文件
│
├── 📁 System/                   # 系统文件
│   ├── Backups/db/              # 数据库备份
│   ├── Thumbnails/              # 缩略图缓存
│   └── RecycleBin/              # 回收站
│
└── 📁 Shared/                   # 共享资源
    ├── Public/                  # 公开访问文件
    └── Templates/               # 模板文件
```

### 软链接配置

| 软链接 | 目标路径 | 用途 |
| :--- | :--- | :--- |
| `~/Documents/server/Longhorn/server/data/DiskA` | `/Volumes/fileserver/Files` | Files 应用数据访问 |

### 重要说明

- **Files 应用**：通过 `DiskA` 软链接访问 `/Volumes/fileserver/Files`
- **Service 应用**：直接访问 `/Volumes/fileserver/Service`
- **知识库图片**：存储在 `Service/Knowledge/Images/`，通过 `/data/knowledge_images` URL 访问
- **工单附件**：新上传的文件将存储在 `Service/Tickets/{类型}/`

---

## 💾 数据库备份策略（双重备份）

### 备份架构

```
┌─────────────────────────────────────────────────────────────┐
│                    Mac mini 服务器                           │
│                                                             │
│  ┌─────────────────────────┐  ┌─────────────────────────┐  │
│  │      主备份 (Primary)    │  │    次级备份 (Secondary)  │  │
│  │                         │  │                         │  │
│  │  /Volumes/fileserver/   │  │  ~/Documents/server/    │  │
│  │  System/Backups/db/     │  │  Longhorn/server/       │  │
│  │  └── backups/           │  │  backups/secondary/     │  │
│  │                         │  │                         │  │
│  │  频率: 24小时 (可配置)   │  │  频率: 72小时 (可配置)   │  │
│  │  保留: 7天 (可配置)      │  │  保留: 30天 (可配置)     │  │
│  │  存储: fileserver SSD   │  │  存储: 系统盘            │  │
│  └─────────────────────────┘  └─────────────────────────┘  │
│           ↑                              ↑                  │
│           │                              │                  │
│      应用内自动备份                 应用内自动备份           │
│    (BackupService调度)            (BackupService调度)       │
└─────────────────────────────────────────────────────────────┘
```

### 备份层级说明

| 层级 | 存储位置 | 频率 | 保留期 | 用途 |
|------|---------|------|--------|------|
| **主备份** | `/Volumes/fileserver/System/Backups/db/` | 24小时 | 7天 | 日常快速恢复 |
| **次级备份** | `~/Documents/server/Longhorn/server/backups/secondary/` | 72小时 | 30天 | 系统盘故障时恢复 |

### 系统设置管理

备份配置可在系统管理后台进行可视化设置：

```bash
# 获取备份状态和文件列表
GET /api/admin/backup/status

# 触发主备份
POST /api/admin/backup/now

# 触发次级备份
POST /api/admin/backup/now/secondary

# 更新备份设置（通过 /api/admin/settings）
POST /api/admin/settings
{
  "settings": {
    "backup_enabled": true,
    "backup_frequency": 1440,
    "backup_retention_days": 7,
    "secondary_backup_enabled": true,
    "secondary_backup_frequency": 4320,
    "secondary_backup_retention_days": 30
  }
}
```

### 主备份（Primary）

- **状态**: ✅ 已启用
- **频率**: 每 24 小时 (1440 分钟，可配置)
- **保留期**: 7 天 (可配置)
- **存储位置**: `/Volumes/fileserver/System/Backups/db/`
- **备份文件命名**: `longhorn-{ISO8601时间戳}.db`
- **触发方式**: 应用内 BackupService 自动调度

### 次级备份（Secondary）

- **状态**: ✅ 已启用
- **频率**: 每 72 小时 (4320 分钟，可配置，默认主备份的3倍)
- **保留期**: 30 天 (可配置)
- **存储位置**: `~/Documents/server/Longhorn/server/backups/secondary/`
- **备份文件命名**: `longhorn-secondary-{ISO8601时间戳}.db`
- **触发方式**: 应用内 BackupService 自动调度

### 手动触发备份

```bash
# 主备份（立即执行）
curl -X POST http://localhost:4000/api/admin/backup/now \
  -H "Authorization: Bearer YOUR_TOKEN"

# 次级备份（立即执行）
curl -X POST http://localhost:4000/api/admin/backup/now/secondary \
  -H "Authorization: Bearer YOUR_TOKEN"

# 手动复制备份
cp ~/Documents/server/Longhorn/server/longhorn.db \
   /Volumes/fileserver/System/Backups/db/longhorn_manual_$(date +%Y%m%d_%H%M%S).db
```

### 备份配置检查

```bash
# 查看备份配置
sqlite3 ~/Documents/server/Longhorn/server/longhorn.db \
  "SELECT 
    backup_enabled, backup_frequency, backup_retention_days,
    secondary_backup_enabled, secondary_backup_frequency, secondary_backup_retention_days 
  FROM system_settings;"

# 查看主备份文件
ls -la /Volumes/fileserver/System/Backups/db/

# 查看次级备份文件
ls -la ~/Documents/server/Longhorn/server/backups/secondary/

# 通过 API 查看完整备份状态
curl -s http://localhost:4000/api/admin/backup/status \
  -H "Authorization: Bearer YOUR_TOKEN" | jq
```

### 恢复备份

**从主备份恢复（推荐，通常最新）:**
```bash
# 1. 停止服务
pm2 stop longhorn

# 2. 备份当前数据库（以防万一）
cp ~/Documents/server/Longhorn/server/longhorn.db \
   ~/Documents/server/Longhorn/server/longhorn_corrupt_$(date +%Y%m%d).db

# 3. 恢复指定备份
cp /Volumes/fileserver/System/Backups/db/longhorn-{timestamp}.db \
   ~/Documents/server/Longhorn/server/longhorn.db

# 4. 重启服务
pm2 start longhorn
```

**从次级备份恢复（fileserver故障时）:**
```bash
# 1. 停止服务
pm2 stop longhorn

# 2. 恢复次级备份
cp ~/Documents/server/Longhorn/server/backups/secondary/longhorn-secondary-{timestamp}.db \
   ~/Documents/server/Longhorn/server/longhorn.db

# 3. 重启服务
pm2 start longhorn
```

---

## 📂 部署路径参考

| 节点 | 角色 | 部署路径 | 备注 |
| :--- | :--- | :--- | :--- |
| **MBAir** | 开发机 | `/Users/Kine/Documents/.../Longhorn` | 唯一代码源 |
| **Mac mini** | 服务器 | `/Users/admin/Documents/server/Longhorn` | 生产环境 |

---

> **注意**: 旧的零散部署文档 (`deployment.md`, `QUICK_DEPLOY.md`, `REMOTE_DEV_GUIDE.md`) 已归档，日常运维请以本文档 (`OPS.md`) 为准。
