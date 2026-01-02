# Changelog

## [10.0.0] - 2026-01-02
### Fixed
- **UI**: 重构回收站界面，修复排版乱序与图标重复问题，引入毛玻璃审美。
- **Core**: 修复软删除逻辑，支持跨 DISK_A 和 DISK_B 的文件检测与移动。
- **Logic**: 执行部门目录合并脚本，清理冗余的英文名称目录（如 MS/GE），统一为官方中文名称。
- **DB**: 同步更新 `file_stats` 和 `access_logs` 中的物理路径映射。

## [9.1.2] - 2026-01-02
### Added
- 在 `FULL_DEPLOYMENT_RECAP.md` 中补充 MBAir 与 Mac mini 的服务运行清单。

## [9.1.1] - 2026-01-02
### Added
- 在 `FULL_DEPLOYMENT_RECAP.md` 中集成全系统架构图（Mermaid）与核心角色角色定义。

## [9.1.0] - 2026-01-02
### Added
- 建立双日志体系：`PROMPT_LOG.md` 用于指令溯源，`CHANGELOG.md` 用于版本变更记录。
- 集成 AI 自动化发布流程说明至开发指引。

## [9.0.0] - 2026-01-02
### Added
- 实现回收站 (Recycle Bin) 功能，软删除文件保留 30 天。
- 新增 `recycle_bin` 数据库表及辅助函数。
- 新增前端 `RecycleBin.tsx` 管理界面。
- 部署 30 天自动物理清理后台任务。
- 构建独立 Git 仓库及 GitHub 远程关联。

## [8.0.0] - 2026-01-02
### Added
- 深度用户权限管理体系，支持文件夹授权、Lead 角色管理隔离及密码重置。

## [7.0.0] - 2026-01-02
### Added
- 个人空间 (Members 目录) 自动同步与 UI 规范化。
