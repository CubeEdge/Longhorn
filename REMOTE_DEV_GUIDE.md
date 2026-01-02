# Longhorn 远程同步与发布极简指南 (SOP)

恭喜！您已经完成了最难的“开荒”阶段。从现在开始，您的发布流程被简化为以下三步。

## 🌟 黄金发布流程 (日常使用)

这是一套“离线开发 -> 云端中转 -> 远端上线”的标准动作：

1.  **MBAir 提交代码**：
    您有两种方式：
    - **极简方式 (AI 自动化)**：在对话框直接说 **“发布 Git”**。我会自动更新 `CHANGELOG.md` 和 `PROMPT_LOG.md`，并执行 commit 与推送。
    - **手动方式**：在 MBAir 的 Longhorn 目录下执行：
    ```bash
    git add .
    git commit -m "本次修改的描述"
    git push
    ```

2.  **登录 Mac mini** (如果您还没连)：
    ```bash
    ssh mini
    ```

3.  **Mac mini 一键上线**：
    ```bash
    cd path/to/Longhorn  # 进入目录
    npm run deploy
    ```

---

## ⚡ 极客方案：无人值守自动同步
如果您连第三步都不想跑，希望在 MBAir 推送后 Mac mini 自动上线：

1.  **在 Mac mini 开启哨兵**：
    ```bash
    pm2 start ./deploy-watch.sh --name longhorn-watcher
    ```
2.  **从此以后**：
    您只需在 MBAir 执行 `git push`。剩下的“拉取、构建、重启”动作，Mac mini 会在 1 分钟内自动完成。

---

## 🛠️ 初始配置备忘 (一劳永逸)
如果您在其他电脑上再次配置，请记住这几个关键点：
- **Token 记忆**：在 MBAir 使用 `git remote set-url origin https://TOKEN@github.com/...` 可以免去输入密码。
- **上游分支**：在 Mac mini 运行一次 `git branch --set-upstream-to=origin/main main` 建立同步链路。
- **后台运行**：使用 `pm2` 启动服务，确保关掉 SSH 窗口后程序依然在线。

---

> [!IMPORTANT]
> **发布成功验证**：
> 访问 [opware.kineraw.com](https://opware.kineraw.com) 检查功能是否更新。

---

为了让您在 MBAir 上拥有最佳的开发体验，建议采用以下两种模式之一。

---

## 模式 A：VS Code 远程实时开发 (推荐方案)
**体验**：像在本地写代码一样，但文件、插件和运行环境全都在 Mac mini 上。

### 1. 在 Mac mini 上开启 SSH
1. 进入“系统设置” -> “通用” -> “共享”。
2. 开启 **“远程登录 (Remote Login)”**。
3. 允许“所有用户”或您的管理员账户访问。
4. 在终端输入 `ifconfig` 确认 Mac mini 的局域网 IP (例如 `192.168.1.50`)。

### 2. 在 MBAir 上配置 VS Code
1. 安装插件：**Remote - SSH** (由 Microsoft 出备)。
2. 点击左下角的蓝图标 `><`，选择 `Connect to Host...` -> `Add New SSH Host`。
3. 输入：`ssh admin@192.168.1.50` (请替换为实际用户名和 IP)。
4. 连接成功后，直接在 VS Code 里 `Open Folder` 选中 Mac mini 上的 `Longhorn` 目录。
5. **从此以后**：您在 MBAir 上改代码并保存，Mac mini 上的程序会自动识别并热更新。

---

## 模式 B：本地开发 + 远程同步 (Git 工作流)
**体验**：在 MBAir 上离线开发，写好后一次性同步到服务器。

### 流程如下：
1. **MBAir 开发**：直接在 MBAir 上进行日常编码测试。
2. **代码提交**：使用 `git commit` 和 `git push` 将代码推送到您的代码仓库 (GitHub/Gitee)。
3. **服务器上线**：
   在 Mac mini 终端运行：
   ```bash
   git pull && npm run deploy
   ```
   *(注：`npm run deploy` 是我之前为您在根目录配置的一键部署脚本)*

---

## 核心 FAQ

### 1. 我怎么看远程运行的效果？
- **局域网内**：在 MBAir 浏览器访问 `http://192.168.1.50:4000`。
- **公网环境下**：无论您在哪，直接访问 `https://opware.kineraw.com`。

### 2. 开发和生产共用一个数据库吗？
- **是的**。如果您使用 VS Code 远程连接，修改的就是 Mac mini 上的生产数据库。
- **注意**：大范围修改功能前，建议先运行一次备份：`/api/admin/backup`。

---

---

## 模式 C：无人值守全自动部署 (CI/CD)
**体验**：您只管在 MBAir 上 `git push`，Mac mini 会像“哨兵”一样自动发现代码变动并执行更新。

### 配置方法 (在 Mac mini 运行一次)：
1. **启动哨兵脚本**：
   我为您编写了 `deploy-watch.sh`，请使用 PM2 将其挂载成后台任务：
   ```bash
   chmod +x deploy-watch.sh
   pm2 start ./deploy-watch.sh --name longhorn-watcher
   ```
2. **从此以后**：
   您在 MBAir 上推送代码后，Mac mini 会在 1 分钟内自动感知，并执行 `git pull` -> `npm run build` -> `pm2 restart`。您不需要在那边操作任何内容。

## 模式 D：跨网络全球 SSH (专治不在一个局域网)
**体验**：无论您在世界的哪个角落，只要有网，就能秒连 Mac mini。

### 1. 在 Mac mini 配置规则 (只需运行一次)
假设您的隧道已经开启，请在服务器终端执行：
```bash
cloudflared tunnel route dns longhorn-proxy ssh.kineraw.com
```
并在 Cloudflare 控制台将此域名的 `Service` 设置为 `SSH://localhost:22`。

---

### 2. 在 MBAir 上建立连接
由于 SSH 是加密协议，不能直接浏览器访问，您需要 MBAir 上也有 `cloudflared`。

1. **安装工具**：`brew install cloudflared`。
2. **连接命令**：
   ```bash
   ssh admin@ssh.kineraw.com --proxy-command="cloudflared access ssh --hostname %h"
   ```

### 3. (进阶) 给 MBAir 设置快捷连接
在 MBAir 的 `~/.ssh/config` 中加入：
```text
Host mini
    HostName ssh.kineraw.com
    User admin
    ProxyCommand /opt/homebrew/bin/cloudflared access ssh --hostname %h
```
**配置完后**，您以后只需输入 `ssh mini` 即可秒连。

---

> [!IMPORTANT]
> **关于“没人”的担心**：
> 实际上，工业级的服务器都是没有显示器和键盘的。只要 Mac mini 通电联网，我们的 **PM2 守护进程** 和 **自动配置服务** 就能保证它在无人值守的情况下自我更新。
