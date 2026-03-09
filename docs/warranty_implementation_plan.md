# 保修判定流程修订 - 实施计划

## 任务清单

### Phase 1: 数据库迁移 ✅
- [x] 创建迁移文件 `029_warranty_calculation.sql`
- [ ] 在远程服务器执行迁移

### Phase 2: 后端 API 修改
- [ ] 新增保修计算引擎 API
  - 文件: `server/service/routes/warranty.js` (新建)
  - 功能: 根据设备SN计算保修状态
  - 输入: serial_number, technical_damage_status
  - 输出: warranty_calculation JSON

- [ ] 修改工单路由
  - 文件: `server/service/routes/tickets.js`
  - 修改: 支持新的技术判定字段
  - 新增: `technical_damage_status`, `technical_warranty_suggestion`

### Phase 3: 前端修改
- [ ] 修改 OP 诊断报告表单
  - 文件: `client/src/components/Workspace/SubmitDiagnosticModal.tsx`
  - 修改: 保修判定 → 技术损坏判定
  - 新增: 三选一按钮 (无人为损坏/人为损坏/无法判定)

- [ ] 新增 MS 审核界面
  - 文件: `client/src/components/Workspace/MSReviewPanel.tsx` (新建)
  - 功能: 显示保修计算结果、预估费用输入、客户确认

### Phase 4: 部署
- [ ] 执行数据库迁移
- [ ] 部署后端代码
- [ ] 部署前端代码
- [ ] 验证测试

## 当前状态

由于 SSH 连接不稳定，建议：
1. 先在本地完成所有代码修改
2. 一次性部署到远程服务器
3. 在远程服务器执行数据库迁移

## 代码修改优先级

1. **最高优先级**: 修改 `SubmitDiagnosticModal.tsx`
   - 这是用户当前看到的问题界面
   - 将"保修判定"改为"技术损坏判定"

2. **高优先级**: 新增保修计算 API
   - 为 MS 审核提供数据支持

3. **中优先级**: 新增 MS 审核界面
   - 完整的保修计算展示

## 简化实施方案（推荐）

考虑到实施复杂度，建议分阶段实施：

### 第一阶段（立即实施）
- 修改 OP 诊断表单：将"保修判定"改为"技术损坏判定"
- 保留现有 `is_warranty` 字段作为 MS 最终确认
- 后端暂不修改，MS 人员根据 OP 技术判定手动确认保修状态

### 第二阶段（后续实施）
- 新增保修计算引擎 API
- 新增 MS 审核界面
- 自动化保修计算

这样可以在不影响现有流程的情况下，先解决"OP越权判定保修"的问题。
