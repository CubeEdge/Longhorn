# 团队协作与部署流程指南 (COLLABORATION)

> **版本**: 2.0 (Dual Track Workflow)
> **最后更新**: 2026-01-28
> **核心原则**: 开发效率与代码一致性的平衡。

本文档定义了 Longhorn 项目的多人协作模式、分支策略以及基于双轨制 (Dual Track) 的部署流程。

---

## 1. 核心工作流: 双轨制 (Dual Track)

为了调和"极速调试"与"严谨发布"的矛盾，我们将部署流程分为两条轨道：

| 模式 | A. 调试快车道 (Debug Mode) | B. 标准发布道 (Release Mode) |
| :--- | :--- | :--- |
| **命令** | `./scripts/deploy.sh` | `./scripts/deploy.sh --git` (或标准 Git 流程) |
| **工具** | `rsync` 强制覆盖 | `git` 提交 + 拉取 |
| **特点** | **极速** (秒级生效)，不留记录 | **严谨** (版本可追溯)，流程较长 |
| **适用** | 抓虫 (Troubleshooting)、微调 UI、验证服务器特有 Bug | 功能完成、合入主干、交付队友 |
| **风险** | 代码未提交，容易覆盖队友代码 | 无风险，版本一致 |

### 场景 A: 极速调试 (Troubleshooting)
**目标**: 遇到服务器特有 Bug (如权限问题)，需要快速修改并验证，不需要频繁 Commit。
1.  **通知队友**: "我要调试一下服务器，暂时别发版。"
2.  **修改代码**: 在本地进行修改。
3.  **极速同步**: 运行 `./scripts/deploy.sh` (默认模式)。
    *   *效果*: 本地代码直接覆盖服务器，服务自动重启。
4.  **收尾**: 修复完成后，**必须**回到本地执行 Git 提交，防止修复代码丢失。

### 场景 B: 标准协作 (Collaboration)
**目标**: 功能开发完成，准备移交给队友或正式上线。
1.  **提交代码**: 确保本地无 "Dirty" 代码。
2.  **发布**: 运行 `./scripts/deploy.sh --git`。
    *   *效果*: 自动检查未提交代码 -> 提交并 Push -> 触发服务器 Pull & Build。

---

## 2. 分支策略 (Branching Strategy)

我们采用简化版的 **GitHub Flow**：

- **`main` (主分支)**
  - **性质**: 生产环境代码 (Production Ready)。
  - **部署**: Mac mini 生产服务器运行的代码基准。
- **`feat/xxx` (特性分支)** (可选，视团队规模定)
  - **来源**: 从 `main` 切出。
  - **生命周期**: 开发完成后提 PR (Pull Request)，通过 Code Review 后合并入 Main。

---

## 3. 从零开始协作 (For New Members)

### 3.1 环境准备
1.  **拉取代码**:
    ```bash
    git clone https://github.com/CubeEdge/Longhorn.git
    cd Longhorn
    npm install
    ```
2.  **配置免密登录**: 确保你的 SSH Key 已添加到服务器 (`ssh-copy-id admin@ssh.kineraw.com`)。

### 3.2 日常开发
1.  **上班第一件事**: 拉取最新代码。
    ```bash
    git pull
    ```
2.  **开发**: 本地 `localhost:3000` 调试。
3.  **下班/功能完成**: 提交并推送。
    ```bash
    git add .
    git commit -m "feat: 完成了 xxx 功能"
    git push
    ```

---

## 4. 常见问题 (FAQ)

**Q: 两个人同时改了同一个文件怎么办？**
A: Git 会提示冲突 (Conflict)。
1.  本地执行 `git pull`。
2.  手动解决文件中的 `<<<<<<<` 冲突标记。
3.  再次 `add` & `commit`。

**Q: 我用 `deploy.sh` (rsync) 改乱了服务器，想重置怎么办？**
A: 
1.  SSH 登录服务器: `ssh admin@ssh.kineraw.com`
2.  进入目录: `cd /Users/admin/Documents/server/Longhorn`
3.  强制重置为 Git 最新版: `git fetch --all && git reset --hard origin/main`

**Q: `deploy.sh` 和 `deploy-watch.sh` 的区别？**
A: 
*   `deploy.sh`: **本地运行**的脚本，用于主动触发部署（无论是 rsync 还是 git 模式）。
*   `deploy-watch.sh`: **服务器运行**的守护进程，用于每分钟自动检测 Git 变动（被动触发）。当前推荐优先使用主动触发以获得即时反馈。
