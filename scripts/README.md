# 🔧 Longhorn 运维与脚本

集成化运维工具集，位于根目录 `scripts/`。

## 脚本分类

### 部署与发布
- `deploy.sh`: 全量生产环境部署。
- `publish.sh`: 发布代码到运行环境。
- `update.sh`: 增量更新同步。
- `deploy-watch.sh`: 监视文件变化并热更新。

### 数据库维护
- `sync-db.sh`: 本地数据库同步工具。
- `sync-remote-db.sh`: 从生产服务器下载最新数据库。
- `db-validate.sh`: 数据库结构一致性检查。

### 系统工具
- `setup.sh`: 首次环境搭建脚本。
- `health-check.sh`: 服务器实时健康监测。
- `diagnose-performance.sh`: 性能诊断报告生成。
- `ssh-mini.sh`: 快速 SSH 连接。

## 使用示例
```bash
# 检查系统健康
bash scripts/health-check.sh

# 部署
bash scripts/deploy.sh
```
