# Longhorn 开发任务 backlog

> **最后更新**: 2026-02-15
> **版本**: 1.2.0

---

## 进行中任务

(无)

## 待办任务

### [DEALER-001] 经销商停用功能完善

**状态**: ⬜ 待开发  
**优先级**: P2 (依赖 INV-001 完成)  
**预计工时**: 6小时  
**前置依赖**: INV-001 经销商库存管理

#### 背景
当前停用经销商的后端 API 已实现，但存在以下缺陷：
1. 未处理经销商用户账户（登录权限）
2. 未处理库存数据（冻结/转移）
3. 未处理进行中的订单
4. 恢复时未恢复联系人状态

#### 经销商关联关系

```
accounts (经销商)
   │
   ├── contacts (联系人)
   ├── accounts (下级客户: parent_dealer_id)
   ├── users (经销商用户: dealer_id)
   │
   ├── 工单系统
   │   ├── inquiry_tickets
   │   ├── rma_tickets
   │   └── dealer_repairs
   │
   └── 库存与订单
       ├── dealer_inventory (配件库存)
       ├── inventory_transactions (交易记录)
       ├── restock_orders (补货订单)
       └── proforma_invoices (形式发票)
```

#### 增强方案

| 处理项 | 当前状态 | 建议策略 |
|--------|----------|----------|
| 下级客户 | ✅ 转移/转直客 | 保持 |
| 联系人 | ✅ 标记INACTIVE | 恢复时需恢复 |
| 经销商用户 | ⬜ 未处理 | 禁止登录 |
| 库存数据 | ⬜ 未处理 | 冻结或转移 |
| 进行中订单 | ⬜ 未处理 | 自动取消 |
| 历史工单 | ✅ 保留 | 保持（历史追溯） |

#### 实施计划

| 阶段 | 任务 | 预计时间 | 优先级 |
|------|------|----------|--------|
| 1 | 停用时禁止关联用户登录 | 2h | P0 |
| 2 | 停用前检查API（展示风险项） | 1h | P1 |
| 3 | 库存处理策略（冻结/转移） | 2h | P2 |
| 4 | 订单自动取消逻辑 | 0.5h | P2 |
| 5 | 恢复时联系人状态恢复 | 0.5h | P3 |

#### 涉及文件
- `server/service/routes/accounts.js`
- `server/service/routes/auth.js`
- `client/src/components/DeactivateDealerModal.tsx`

---

## 已完成任务

### [INV-001] 经销商备件库存管理 + 经销商维修工单集成
**状态**: ✅ 已完成  
**完成时间**: 2026-02-15  
**内容**: 
- 创建前端库存管理组件（DealerInventoryListPage）
- 创建补货订单列表/详情/创建页面
- 侧边栏添加配件库存入口
- 经销商维修工单配件消耗自动扣减库存
- 库存交易记录完整追踪
- 配件更新/删除时自动回退库存

**涉及文件**:
- `client/src/components/DealerInventory/` (新建 5 个文件)
- `server/service/routes/dealer-repairs.js` (库存集成)
- `client/src/App.tsx` (路由和侧边栏)
- `client/src/i18n/translations.ts` (翻译)

### [WIKI-001] Wiki 主界面重新设计 + Bokeh AI 融合
**状态**: ✅ 已完成  
**完成时间**: 2026-02-15  
**内容**: 
- 简化 Wiki 首页布局，减少图标使用
- 搜索框双模式：关键词搜索 + AI 自然语言问答
- 文章删除功能（单篇 + 批量）
- 批量删除 macOS26 风格确认对话框
- 搜索防抖优化
- 后端 DELETE API + FTS5 全文搜索
- 审计日志完善

### [WIKI-000] 清空知识库数据
**状态**: ✅ 已完成  
**完成时间**: 2026-02-17  
**内容**: 清空生产服务器知识库文章（89条）和图片（169张）

---

## 任务编号规范

- `WIKI-xxx`: Wiki/知识库相关
- `TICKET-xxx`: 工单系统相关
- `BOKEH-xxx`: Bokeh AI 相关
- `UI-xxx`: 界面设计相关
- `API-xxx`: 后端接口相关
- `INV-xxx`: 库存管理相关
- `DEALER-xxx`: 经销商管理相关
