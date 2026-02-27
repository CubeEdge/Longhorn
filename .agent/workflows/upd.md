---
description: 明确更新代码
---

1. **强制执行 `/upd` 流水线**:
   - 递增 `client/package.json`（和必要的 `server/package.json`）中的最后一位 (Z位) 版本号。
   - 运行 `npm run build` 确保前端代码编译成功。
   - 运行 `./scripts/deploy.sh` 进行全量远程部署（至 `mini`）。
   - 校验部署脚本退出状态，确认 `pm2 reload` 成功执行。
   - 执行/pmlog