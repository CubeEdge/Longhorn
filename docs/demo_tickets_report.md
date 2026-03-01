# 最新预置的 10 个复杂工单详情报告

## [K2603-0001-DEMO] Waiver request for out-of-warranty repair
- **类型**: `INQUIRY`  **状态**: `in_progress`  **当前节点**: `ms_review`
- **指派给**: Effy  **创建者**: Effy
- **创建时间**: 2026/3/1 10:07:34

### 沟通与活动节点流：
> **[10:07:34] System** (status_change): 
> 状态变更: draft → ms_review

> **[10:17:34] System** (comment): 
> @[Manager](372) 这个客户很强势，这次能不能免单？(VIP 客户)

> **[10:18:34] System** (system_event): 
> Effy 发起了审批申请\n类型：报价豁免 (Waiver)\n金额：$800.00 -> $0.00\n理由：VIP 客户关系维护\n状态：待经理审批

> **[10:22:34] System** (system_event): 
> Manager 已批准备注：同意，但请提醒客户下次必须按流程。

> **[11:02:34] System** (comment): 
> 收到，已经和客户沟通完毕！

---

## [RMA-C-2603-001-DEMO] Sensor artifact during 8K record
- **类型**: `RMA`  **状态**: `in_progress`  **当前节点**: `op_diagnosing`
- **指派给**: ZhangOP  **创建者**: admin
- **创建时间**: 2026/3/1 09:07:34

### 沟通与活动节点流：
> **[10:07:34] System** (comment): 
> Received device. The IB snapshot shows Netflix US, MAVO Edge 8K. Dealer is ProAV. Running CMOS test.

> **[11:06:34] System** (system_event): 
> SLA 已经超时 (P0)

---

## [RMA-C-2603-010-DEMO] SDI port loose
- **类型**: `RMA`  **状态**: `in_progress`  **当前节点**: `op_repairing`
- **指派给**: ZhangOP  **创建者**: Effy
- **创建时间**: 2026/2/27 11:07:34

### 沟通与活动节点流：
> **[09:07:34] System** (system_event): 
> SLA Breach: Overdue by 2 hours.

> **[10:07:34] System** (comment): 
> @[ZhangOP](373) 这个单子卡了很久了，Netflix 明天要机器首映，今晚加紧修出来！

> **[11:02:34] System** (comment): 
> @[cathy](375) 收到，已经去物料房领了配件，晚上搞定并发测试。

---

## [RMA-C-2603-002-DEMO] Eagle SDI screen burn
- **类型**: `RMA`  **状态**: `in_progress`  **当前节点**: `ge_closing`
- **指派给**: AliceFinance  **创建者**: Effy
- **创建时间**: 2026/2/27 11:07:34

### 沟通与活动节点流：
> **[11:07:34] System** (assignment_change): 
> 指派变更: 从 Effy 变更为 AliceFinance

> **[10:37:34] System** (comment): 
> @[Effy](371) 客户已经汇款，请确认发货。

---

## [RMA-C-2603-007-DEMO] Water damage during heavy rain shoot
- **类型**: `RMA`  **状态**: `in_progress`  **当前节点**: `op_diagnosing`
- **指派给**: ZhangOP  **创建者**: Effy
- **创建时间**: 2026/2/26 11:07:34

### 沟通与活动节点流：
> **[11:07:34] System** (comment): 
> Machine received. Severe water damage on main board.

> **[11:07:34] System** (comment): 
> @[LiRD](376) 原件腐蚀严重，能否尝试飞线修复，还是需要直接换主板？

> **[09:07:34] System** (comment): 
> @[ZhangOP](373) 看了你发的图，无法飞线。直接走整板更换流程吧。

> **[10:27:34] System** (comment): 
> @[cathy](375) 客户是 VIP，换主板报价太高客户在犹豫，能否申请物料 8 折折扣？

> **[10:52:34] System** (comment): 
> @[Effy](371) 已特批 8 折，请系统发起报价给客户。

---

## [SVC-D-2603-005-DEMO] Random error code E05
- **类型**: `SVC`  **状态**: `in_progress`  **当前节点**: `dl_repairing`
- **指派给**: Effy  **创建者**: admin
- **创建时间**: 2026/2/24 11:07:34

---

## [K2603-0004-DEMO] Edge 6K Audio desync
- **类型**: `INQUIRY`  **状态**: `waiting`  **当前节点**: `waiting_customer`
- **指派给**: Effy  **创建者**: Effy
- **创建时间**: 2026/2/24 11:07:34

### 沟通与活动节点流：
> **[11:07:34] System** (comment): 
> Requested log files from user.

---

## [SVC-D-2603-006-DEMO] Random error code E06
- **类型**: `SVC`  **状态**: `in_progress`  **当前节点**: `dl_repairing`
- **指派给**: Effy  **创建者**: admin
- **创建时间**: 2026/2/23 11:07:34

---

## [RMA-D-2603-008-DEMO] Intermittent purple artifact on SDI OUT
- **类型**: `RMA`  **状态**: `in_progress`  **当前节点**: `ms_review`
- **指派给**: LiRD  **创建者**: Effy
- **创建时间**: 2026/2/22 11:07:34

### 沟通与活动节点流：
> **[11:07:34] System** (comment): 
> @[LiRD](376) 经销商那边说升级了最新固件还是有这个问题，麻烦看一下是不是 FPGA 烧了？

> **[11:07:34] System** (comment): 
> 让他们提取一下 error.log 给我，重点看 timestamp 和 sync bits 错位。

> **[11:07:34] System** (attachment): 
> Attached: syslog_dump.zip

> **[09:37:34] System** (comment): 
> 确认是 FPGA 硬件缺陷导致的包丢失。需要发回原厂重置 BGA。

---

## [RMA-C-2603-009-DEMO] Camera dropped from drone - Total loss
- **类型**: `RMA`  **状态**: `resolved`  **当前节点**: `resolved`
- **指派给**: AliceFinance  **创建者**: ZhangOP
- **创建时间**: 2026/2/19 11:07:34

### 沟通与活动节点流：
> **[11:07:34] System** (comment): 
> 定损完成，维修价格超过新机的 70%。@[AliceFinance](374) 转给销售看下能否走"以旧换新"？

> **[11:07:34] System** (comment): 
> 好的，我已经联系客户推了换新方案，客户同意折抵废旧机。

> **[11:07:34] System** (status_change): 
> Status changed to: resolved (Trade-in Completed)

---

