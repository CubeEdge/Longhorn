# 协作开发与部署流程指南 (Workflow Guide)

> **核心原则**: 开发效率与代码一致性的平衡。
> **适用场景**: 多人协作开发、远程服务器调试、正式版本发布。

## 1. 核心理念: 双轨制 (Dual Track)

为了适应不同的开发阶段，我们将工作流分为两条轨道：

| 模式 | A. 调试快车道 (Debug Mode) | B. 标准发布道 (Release Mode) |
| :--- | :--- | :--- |
| **工具** | `rsync` (deploy.sh) | `git` (standard) |
| **特点** | **极速** (秒级生效)，不留记录 | **严谨** (版本可追溯)，流程较长 |
| **适用** | 抓虫 (Troubleshooting)、微调 UI、验证服务器特有 Bug | 功能完成、合入主干、交付队友 |
| **风险** | 代码未提交，容易覆盖队友代码 | 无风险，版本一致 |

---

## 2. 详细操作流程

### 场景 A: 我遇到了一个 Bug，需要在服务器上调试 (目前的 OP 部门问题)

**目标**: 快速修改代码，快速在服务器上看到效果，不需要每次都 Commit。

1.  **通知队友** (可选): "我要调试一下服务器，暂时别发版。"
2.  **本地修改代码**。
3.  **极速同步**:
    ```bash
    ./scripts/deploy.sh
    ```
    *   *作用*: 强制将本地代码同步到服务器并重启。
    *   *注意*: 此时 Git 仓库里并没有你的改动。
4.  **验证**: 在浏览器或 App 上查看 Bug 是否修复。
5.  **循环**: 如未修复，重复步骤 2-4。
6.  **[关键] 收尾**:
    *   Bug 修复后，**必须**在本地执行 Git 提交。
    *   `git add .` -> `git commit -m "Fix: OP department bug"` -> `git push`
    *   这样队友拉取代码后，才拥有同样的修复。

### 场景 B: 我完成了功能，想正式发布 (Handover)

**目标**: 确保服务器运行的代码与 Git 仓库完全一致，适合移交给其他成员继续开发。

1.  **本地提交**:
    ```bash
    git add .
    git commit -m "Feat: Completed new feature"
    git push origin main
    ```
2.  **服务器同步 (两种方式)**:
    *   **方式 1 (推荐)**: 继续运行 `./scripts/deploy.sh`。因为你的本地代码已经和 Git 一致了，同步上去的代码也是一致的。
    *   **方式 2 (纯净)**: SSH 登录服务器执行 `git pull` (需配置好服务器 Git)。

---

## 3. 常用命令速查

### 极速调试 (当前默认)
```bash
./scripts/deploy.sh
```
*   直接覆盖服务器代码，不走 Git。

### 提交代码 (Git Push)
```bash
# 1. 查看改动
git status

# 2. 提交所有改动
git add .
git commit -m "简要描述你的修改"

# 3. 推送到远程
git push
```

### 拉取最新代码 (Git Pull)
*   开始工作前，养成好习惯，先拉取队友的代码：
```bash
git pull
```

---

## 4. 特殊情况处理

**问题**: 我用 `deploy.sh` 改乱了服务器，想重置怎么办？
**回答**: 
1.  SSH 登录服务器。
2.  进入目录: `cd /Users/admin/Documents/server/Longhorn`
3.  强制重置为 Git 最新版: `git fetch --all && git reset --hard origin/main`
