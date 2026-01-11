# Longhorn 服务器部署与维护指南

**最后更新：** 2026-01-11
**服务器环境：** Mac mini (M1), Node.js, PM2

---

## 1. 标准部署流程

### 1.1 发布新版本（本地）
在开发机（本地）执行：
```bash
# 提交代码
git add -A
git commit -m "feat: 描述更新内容"
git push origin main
```

### 1.2 服务器更新
在服务器上执行：
```bash
# 进入项目目录
cd /Users/admin/Documents/server/Longhorn

# 拉取最新代码
git fetch --all && git reset --hard origin/main

# 前端构建（如果有前端修改）
cd client && npm install && npm run build
cd ..

# 后端安装依赖（如果有新依赖）
cd server && npm install
cd ..

# 重启服务
pkill -9 node
cd server && PORT=4000 npm start &
```

> **注意**: 服务器上也有 `deploy-watch.sh` 脚本在后台运行，它会自动拉取代码。手动执行上述步骤是为了强制立即更新和重启。

---

## 2. 数据库与迁移

### 2.1 数据库位置
- 路径: `server/longhorn.db`
- 类型: SQLite3

### 2.2 运行迁移脚本
如果涉及数据库结构变更或文件夹重命名（如部门迁移）：
```bash
node server/migrate_dept_paths.js
```

---

## 3. 常见问题修复 (Troubleshooting)

### 3.1 侧边栏部门重复 (Duplicate Departments)
**症状**: Sidebar 显示“市场部 (MS)”和“MS”两个条目。
**原因**: 数据库中保留了旧中文名记录。
**修复**:
```bash
cd server
sqlite3 longhorn.db "
UPDATE users SET department_id = 2294 WHERE department_id = 1; -- 迁移旧用户 ID
UPDATE users SET department_id = 2293 WHERE department_id = 2;
UPDATE users SET department_id = 2295 WHERE department_id = 3;
UPDATE users SET department_id = 2296 WHERE department_id = 4;
DELETE FROM departments WHERE id IN (1, 2, 3, 4); -- 删除旧部门
"
```

### 3.2 文件夹显示 Unknown 上传者
**症状**: 文件夹列表中“上传者”显示为 Unknown。
**原因**: 历史文件夹在 `file_stats` 表中无记录，或 `uploader_id` 为 NULL。
**修复**:
```bash
cd server
# 将所有空上传者归属给 admin (ID=1)
sqlite3 longhorn.db "UPDATE file_stats SET uploader_id = 1 WHERE uploader_id IS NULL;"

# 如果记录完全缺失，需手动插入（示例）
sqlite3 longhorn.db "INSERT OR IGNORE INTO file_stats (path, uploader_id, uploaded_at) VALUES ('OP/20260105', 1, datetime('now'));"
```

### 3.3 移动端顶部遮挡
**症状**: iPhone 药丸屏遮挡菜单。
**检查**: 确认 `client/index.html` 包含 `viewport-fit=cover`，且 `index.css` 使用了 `env(safe-area-inset-top)`。

---

## 4. 常用运维命令

**查看实时日志**:
```bash
tail -f server/server.log
```

**检查数据库表**:
```bash
sqlite3 server/longhorn.db "SELECT * FROM departments;"
```

**重启 PM2 (如果使用 PM2)**:
```bash
pm2 restart longhorn
```
