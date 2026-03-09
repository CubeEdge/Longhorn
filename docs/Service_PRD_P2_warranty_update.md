# 保修计算引擎修订文档 (Warranty Engine Update)

**更新日期**: 2026-03-08  
**关联 PRD**: Service PRD_P2.md §5.5  
**修订原因**: 分离 OP 技术判定与 MS 商业保修判定，明确费用结算两阶段流程

---

## 1. 核心变更摘要

| 变更项 | 原设计 | 新设计 |
|--------|--------|--------|
| **OP 职责** | 直接判定"保修免费/付费" | 仅做"技术损坏判定"（人为/正常/不确定） |
| **保修计算** | 无明确节点 | MS 在 `ms_review` 节点自动触发 |
| **费用确认** | 在 `ms_review` 生成 PI | 两阶段：ms_review 预估 → ms_closing 实际结算 |
| **数据模型** | 简单 `is_warranty` 布尔值 | 结构化对象：技术判定 + 保修计算 + 费用结算 |

---

## 2. 保修计算引擎详细设计

### 2.1 计算原则

保修计算由 **MS 部门在 `ms_review` 节点** 自动触发，综合以下两类数据：

| 数据类型 | 字段 | 说明 |
|----------|------|------|
| **设备基础数据** (IB) | `iot_activation_date` | IoT激活日期（最高优先级） |
| | `sales_invoice_date` | 销售发票日期 |
| | `registration_date` | 官网注册日期 |
| | `ship_date` / `ship_to_dealer_date` | 发货日期 |
| **OP技术判定** | `technical_damage_status` | 人为损坏/物理损伤会**直接否定保修** |
| | `technical_warranty_suggestion` | OP的技术建议（供MS参考） |

### 2.2 计算逻辑（瀑布流 + 人为损坏拦截）

```
Step 1: 【拦截检查】OP判定为"人为损坏/物理损伤"？
   → 是：直接判定为"保外"，保修结束
   → 否：继续下一步

Step 2: 【瀑布流计算保修期】按优先级获取保修起始日：
   Priority 1: IoT激活日期
   Priority 2: 销售发票日期
   Priority 3: 注册日期
   Priority 4: 直销发货日期 + 7天
   Priority 5: 经销商发货日期 + 90天（兜底）

Step 3: 【计算保修结束日】
   保修结束日 = 保修起始日 + warranty_months（默认24个月）

Step 4: 【判断当前状态】
   当前日期 <= 保修结束日？在保 : 已过保
```

### 2.3 MS审核界面显示内容

```
┌─────────────────────────────────────────┐
│  保修计算结果（自动计算）                  │
├─────────────────────────────────────────┤
│  保修起始日：2024-01-15                  │
│  计算依据：IoT激活日期                    │
│  保修结束日：2026-01-15                  │
│  当前状态：⚠️ 已过保 / ✅ 在保期内        │
├─────────────────────────────────────────┤
│  OP技术判定：人为损坏 / 正常故障          │
│  OP建议：建议保内 / 建议保外              │
├─────────────────────────────────────────┤
│  【保修综合判定】                         │
│  最终结果：保内免费 / 保外付费            │
│  （人为损坏直接判定为保外）                │
├─────────────────────────────────────────┤
│  预估维修费用（基于OP备件清单）            │
│  - 备件A：¥xxx                           │
│  - 备件B：¥xxx                           │
│  - 预估工时：¥xxx（参考）                 │
│  - 预估合计：¥xxx ~ ¥xxx（范围）          │
├─────────────────────────────────────────┤
│  [发送客户确认]                           │
│  客户确认方式：邮件/PI预览 / 电话确认截图  │
└─────────────────────────────────────────┘
```

### 2.4 费用结算流程（两阶段）

| 阶段 | 节点 | 功能 | 说明 |
|------|------|------|------|
| **第一阶段** | `ms_review` | **预估费用 + 客户确认** | 基于OP备件清单，给出预估费用范围，获得客户确认后开始维修 |
| **第二阶段** | `ms_closing` | **实际费用结算 + 生成PI** | 维修完成后，根据实际发生的备件+工时+其他费用，生成最终PI |

---

## 3. 数据模型

### 3.1 新增字段

```javascript
// OP技术判定（op_diagnosing节点填写）
"technical_damage_status": "Enum",  // 'no_damage', 'physical_damage', 'uncertain'
"technical_warranty_suggestion": "Enum",  // 'suggest_in_warranty', 'suggest_out_warranty', 'needs_verification'

// 保修引擎计算结果（ms_review节点自动计算）
"warranty_calculation": {
    "start_date": "Date",
    "end_date": "Date",
    "calculation_basis": "Enum",  // 'iot_activation', 'invoice', 'registration', 'direct_ship', 'dealer_fallback'
    "is_in_warranty": "Boolean",  // 基于日期计算
    "is_damage_void_warranty": "Boolean",  // 人为损坏是否否定保修
    "final_warranty_status": "Enum"  // 'warranty_valid', 'warranty_void_damage', 'warranty_expired'
},

// MS审核确认（ms_review节点填写）
"ms_review": {
    "estimated_cost_min": "Decimal",  // 预估最低费用
    "estimated_cost_max": "Decimal",  // 预估最高费用
    "customer_confirmation_method": "Enum",  // 'email', 'pi_preview', 'phone_screenshot'
    "customer_confirmed": "Boolean",
    "confirmed_at": "Timestamp"
},

// 维修完成后结算（ms_closing节点填写）
"final_settlement": {
    "actual_parts_cost": "Decimal",      // 实际备件费用
    "actual_labor_cost": "Decimal",      // 实际工时费用
    "actual_other_cost": "Decimal",      // 其他费用
    "actual_total_cost": "Decimal",      // 实际总费用
    "final_pi_number": "String",         // 最终PI号
    "final_pi_generated_at": "Timestamp"
}
```

### 3.2 数据库迁移 SQL

```sql
-- OP 技术判定字段
ALTER TABLE tickets ADD COLUMN technical_damage_status TEXT CHECK(technical_damage_status IN ('no_damage', 'physical_damage', 'uncertain'));
ALTER TABLE tickets ADD COLUMN technical_warranty_suggestion TEXT CHECK(technical_warranty_suggestion IN ('suggest_in_warranty', 'suggest_out_warranty', 'needs_verification'));

-- 保修计算结果（JSON 存储）
ALTER TABLE tickets ADD COLUMN warranty_calculation TEXT;  -- JSON格式

-- MS 审核确认（JSON 存储）
ALTER TABLE tickets ADD COLUMN ms_review TEXT;  -- JSON格式

-- 最终结算（JSON 存储）
ALTER TABLE tickets ADD COLUMN final_settlement TEXT;  -- JSON格式
```

---

## 4. 流程图

```
┌─────────────┐    ┌─────────────────┐    ┌──────────────────┐
│ op_receiving│ →  │ op_diagnosing   │ →  │ ms_review        │
│ 待收货       │    │ 诊断中（OP）     │    │ 商务审核（MS）    │
└─────────────┘    └─────────────────┘    └──────────────────┘
                          │                        │
                          ▼                        ▼
                    [技术损坏判定]            [保修计算引擎]
                    [备件需求清单]            ├─ 综合设备数据
                    [保修建议]                ├─ 结合OP判定
                                             ├─ 计算保修状态
                                             └─ 生成预估费用
                                                      │
                                                      ▼
                                             [客户确认]
                                             （邮件/PI预览/电话）
                                                      │
                                                      ▼
┌─────────────┐    ┌─────────────────┐    ┌──────────────────┐
│ op_shipping │ ←  │ ms_closing      │ ←  │ op_repairing     │
│ 发货         │    │ 结算审核（MS）   │    │ 维修中（OP）      │
└─────────────┘    └─────────────────┘    └──────────────────┘
                          │
                          ▼
                   [实际维修完成]
                   [录入实际费用]
                   [生成最终PI]
                   [客户付款确认]
```

---

## 5. 前端界面修改

### 5.1 OP 诊断报告表单（SubmitDiagnosticModal.tsx）

**修改前**:
```
保修判定 (必填)
[保修免费] [付费包修 / 拒保退回]
```

**修改后**:
```
技术损坏判定 (必填)
[无人为损坏 / 正常故障] [人为损坏 / 物理损伤] [无法判定]

保修建议 (选填，供商务参考)
[建议保内] [建议保外] [需进一步核实]
```

### 5.2 MS 审核界面（新增）

- 显示保修计算引擎的自动计算结果
- 显示 OP 的技术判定作为参考
- 提供预估费用输入和客户确认方式选择
- 客户确认后才能流转到 `op_repairing`

---

## 6. 后端 API 修改

### 6.1 新增保修计算 API

```
POST /api/v1/tickets/:id/warranty-calculation
请求：{}
响应：{
  success: true,
  data: {
    start_date: "2024-01-15",
    end_date: "2026-01-15",
    calculation_basis: "iot_activation",
    is_in_warranty: true,
    is_damage_void_warranty: false,
    final_warranty_status: "warranty_valid"
  }
}
```

### 6.2 修改提交诊断报告

- 接收 `technical_damage_status` 和 `technical_warranty_suggestion`
- 不再接收简单的 `is_warranty` 布尔值

### 6.3 修改 MS 审核接口

- 接收 `ms_review` 对象（预估费用、客户确认方式等）
- 接收 `final_settlement` 对象（实际维修完成后）

---

## 7. 兼容性说明

- **向后兼容**：现有 `is_warranty` 字段继续保留，作为 MS 最终确认的保修状态
- **数据迁移**：历史工单保持现有 `is_warranty` 值不变
- **渐进式更新**：新工单使用新字段，旧工单逐步迁移
