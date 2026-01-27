# 团队协作与发布指南 (COLLABORATION)

本文档定义了 Longhorn 项目的多人协作模式、分支策略及发版流程。

---

## 1. 分支策略 (Branching Strategy)

我们采用简化版的 **GitHub Flow**：

- **`main` (主分支)**
  - **性质**: 生产环境代码 (Production Ready)。
  - **保护**: ❌ **禁止直接 Push**。必须通过 Pull Request (PR) 合并。
  - **部署**: 这是 Mac mini 生产服务器自动拉取的分支。

- **`develop` (开发/集成分支)**
  - **性质**: 每日开发代码的汇聚地，用于测试集成。
  - **协作**: 团队成员主要向此分支提交 PR。
  - **提示**: 如果团队规模较小 (<3人)，可跳过此分支，直接使用 Feature 分支 -> Main 的模式。

- **`feat/xxx` (特性分支)**
  - **来源**: 从 `main` (或 `develop`) 切出。
  - **命名**: `feat/vocabulary-engine`, `fix/ios-crash`, `chore/docs-update`.
  - **生命周期**: 开发完成后提 PR，合并后删除。

---

## 2. 协作流程 (Workflow)

### 2.1 开发新功能
1.  **拉取最新代码**: `git pull origin main`
2.  **创建分支**: `git checkout -b feat/my-feature`
3.  **提交代码**:
    ```bash
    git add .
    git commit -m "feat: 实现每日一词 UI (close #12)"
    ```
4.  **推送远端**: `git push origin feat/my-feature`

### 2.2 提交合并 (Pull Request)
1.  在 GitHub 页面点击 **"New Pull Request"**。
2.  选择 `base: main` (或 `develop`) <- `compare: feat/my-feature`。
3.  **Code Review**: 邀请同事 Review 代码。
4.  **Merge**: 审核通过后，点击 "Squash and merge" 以保持主分支历史整洁。

---

## 3. 发布与部署 (Release & Deploy)

由于我们使用了 `deploy-watch.sh` 自动部署脚本，发版流程被极大简化：

### 3.1 正式发版
1.  **合并代码**: 确保所有功能已合并进 `main`。
2.  **打标签 (Tag)**:
    ```bash
    git tag v14.0.0
    git push origin v14.0.0
    ```
3.  **Github Release** (可选): 在 GitHub Releases 页面基于 Tag 创建 Release Note。

### 3.2 自动上线
- **原理**: Mac mini 上的哨兵脚本 (`deploy-watch.sh`) 会每分钟检查 `main` 分支。
- **动作**: 一旦检测到 `main` 有变动，自动执行 `pull` -> `build` -> `restart`。
- **通知**: 部署完成后，可通过 Slack/DingTalk 机器人通知团队 (可选扩展)。

---

## 4. 常见问题

**Q: 两个人同时改了同一个文件怎么办？**
A: Git 会提示冲突 (Conflict)。
1.  本地执行 `git pull origin main`。
2.  手动解决文件中的 `<<<<<<<` 冲突标记。
3.  再次 `add` & `commit`。

**Q: 我不小心把密码传上去了？**
A: 立即修改密码！Git 历史清除非常麻烦且不安全，优先重置凭证。

**Q: 如何回滚 (Rollback)?**
A: `git revert <commit-hash>` 生成一个新的反向提交，安全地抵消错误修改。

---
