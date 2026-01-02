# Prompt Log (Reverse Chronological)

## 如何恢复版本
1. 复制对应任务的 **版本ID** (Git Commit Hash)。
2. 在终端执行命令：`git checkout <版本ID>`。
3. 若要回到最新版本，执行：`git checkout main`。

| 日期 | 任务名称 | 版本ID | 状态 | 修改说明 |
| :--- | :--- | :--- | :--- | :--- |
| 2026-01-02 23:20 | *服务清单细化* | `b3064bf` | `Done` | 在 FULL_DEPLOYMENT_RECAP.md 中补充 Mac mini 与 MBAir 的关键服务运行清单。 |
| 2026-01-02 23:15 | *技术架构复盘可视化* | `54f6aaf` | `Done` | 在 FULL_DEPLOYMENT_RECAP.md 中新增全系统 Mermaid 架构图与各组件角色定义。 |
| 2026-01-02 23:05 | *日志与发布体系构建* | `3dfdf0e` | `Done` | 建立 CHANGELOG.md 与 PROMPT_LOG.md 双日志闭环，实现“一键发布”功能。 |
| 2026-01-02 21:55 | *回收站功能 (30天保留)* | `dcc212c` | `Done` | 实现软删除机制、30天自动清理、回收站 UI 界面及 GitHub 独立仓库关联。 |
| 2026-01-02 11:35 | *黑屏故障修复* | `4c21c25` | `Done` | 修正 App.tsx 样式属性错误、删除冗余导入并同步数据库角色大小写。 |
| 2026-01-02 11:15 | *权限系统与上传优化* | `c2a74d2` | `Done` | 实现 yyyymmdd_ 重命名、Admin/Lead/Member 角色引擎、部门隔离及动态授权。 |
| 2026-01-02 10:25 | *iOS 风格按钮精修* | `5a9bf3e` | `Done` | 精修了缩略图和列表视图中的 "More" 按钮，引入 iOS 风格毛玻璃背景和悬停缩放反馈。 |
