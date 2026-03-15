---
description: 明确更新代码
---

1   **运维/部署/访问 (必读)**: [OPS.md](/docs/OPS.md) 了解远程服务器如何访问
2. **强制执行 `/upd` 更新远程服务器**:
   - 递增 `client/package.json`（和必要的 `server/package.json`）中的最后一位 (Z位) 版本号。
   - 运行 `npm run build` 确保前端代码编译成功。
   - 运行 `./scripts/deploy.sh --clean` 远程部署（至 `mini`）。
   - 校验部署脚本退出状态，确认 `pm2 reload` 成功执行。
