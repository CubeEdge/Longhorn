# 产品服务系统 - API 设计文档

**版本**: 0.3.0 (Draft)
**状态**: 草稿
**最后更新**: 2026-02-02
**关联PRD**: Service_PRD.md v0.7.0
**关联场景**: Service_UserScenarios.md v0.3.0

---

## 1. API 设计原则

### 1.1 基础规范

- **协议**: HTTPS
- **格式**: JSON
- **编码**: UTF-8
- **版本**: URL路径版本控制 `/api/v1/`
- **认证**: Bearer Token (JWT)

### 1.2 响应格式

**成功响应**:
```json
{
  "success": true,
  "data": { ... },
  "meta": {
    "page": 1,
    "page_size": 20,
    "total": 100
  }
}
```

**错误响应**:
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "问题描述不能为空",
    "details": [...]
  }
}
```

### 1.3 HTTP 状态码

| 状态码 | 含义 |
|-------|------|
| 200 | 成功 |
| 201 | 创建成功 |
| 400 | 请求参数错误 |
| 401 | 未认证 |
| 403 | 无权限 |
| 404 | 资源不存在 |
| 422 | 业务逻辑错误 |
| 500 | 服务器错误 |

---

## 2. 认证与授权

### 2.1 用户登录

**POST** `/api/v1/auth/login`

```json
// Request
{
  "email": "user@kinefinity.com",
  "password": "..."
}

// Response
{
  "success": true,
  "data": {
    "access_token": "eyJhbGci...",
    "refresh_token": "eyJhbGci...",
    "expires_in": 3600,
    "user": {
      "id": "usr_001",
      "name": "刘玖龙",
      "email": "user@kinefinity.com",
      "department": "市场部",
      "role": "editor",
      "region_responsible": "国内"
    }
  }
}
```

### 2.2 刷新Token

**POST** `/api/v1/auth/refresh`

```json
// Request
{
  "refresh_token": "eyJhbGci..."
}

// Response
{
  "success": true,
  "data": {
    "access_token": "eyJhbGci...",
    "expires_in": 3600
  }
}
```

### 2.3 经销商登录 [待确认: 是否独立入口]

> 默认方案: 与员工共用登录入口，按角色区分权限

**POST** `/api/v1/auth/login`

```json
// Request (经销商)
{
  "email": "dealer@proav.de",
  "password": "..."
}

// Response
{
  "success": true,
  "data": {
    "access_token": "...",
    "user": {
      "id": "dlr_001",
      "name": "ProAV UK",
      "user_type": "dealer",  // 区分用户类型
      "dealer_id": "dealer_proav",
      "permissions": ["issue:create", "issue:read_own", "kb:read_dealer"]
    }
  }
}
```

### 2.4 获取当前用户信息

**GET** `/api/v1/auth/me`

---

## 3. 服务记录 API

> 服务记录用于记录咨询、问题排查等轻量级服务，可升级为工单。

### 3.1 创建服务记录

**POST** `/api/v1/service-records`

**权限**: 市场部、经销商

```json
// Request
{
  // 服务模式 (经销商使用)
  "service_mode": "代客户服务",  // 快速查询(不创建记录) / 代客户服务
  
  // 客户信息 (可选)
  "customer_name": "Max Mueller",  // 不填显示"匿名客户"
  "customer_contact": "max@example.uk",
  "customer_id": "cust_001",  // 关联已有客户
  "dealer_id": "dealer_proav",  // 经销商ID
  
  // 产品信息 (建议填写)
  "product_id": "prod_edge8k",
  "serial_number": "ME_207890",
  
  // 服务内容
  "service_type": "问题排查",  // 咨询/问题排查/远程协助/投诉
  "channel": "邮件",  // 电话/邮件/微信/企业微信/Facebook/在线
  "problem_summary": "拍摄4K 50fps时死机",
  "communication_log": "Q: 客户询问...\nA: 建议..."
}

// Response
{
  "success": true,
  "data": {
    "id": "sr_20260202_001",
    "record_number": "SRD-2602-001",
    "status": "处理中",
    "created_at": "2026-02-02T10:30:00Z"
  }
}
```

### 3.2 获取服务记录列表

**GET** `/api/v1/service-records`

**权限**: 市场部可看全部，经销商仅看自己的记录

**查询参数**:

| 参数 | 类型 | 说明 |
|-----|------|------|
| page | int | 页码，默认1 |
| page_size | int | 每页数量，默认20 |
| status | string | 状态筛选: 处理中/待客户反馈/已解决/自动关闭/转工单 |
| service_type | string | 服务类型筛选 |
| customer_id | string | 客户筛选 |
| dealer_id | string | 经销商筛选 |
| serial_number | string | 按SN筛选 |
| handler_id | string | 处理人筛选 |
| created_from | date | 创建时间起 |
| created_to | date | 创建时间止 |
| keyword | string | 关键词搜索 |

### 3.3 获取服务记录详情

**GET** `/api/v1/service-records/{id}`

### 3.4 更新服务记录

**PATCH** `/api/v1/service-records/{id}`

```json
// Request (更新状态和处理结果)
{
  "status": "待客户反馈",  // 处理中/待客户反馈/已解决/自动关闭/转工单
  "resolution": "建议升级固件至8025版本",
  "communication_log": "追加沟通内容..."
}
```

### 3.5 升级为工单

**POST** `/api/v1/service-records/{id}/upgrade-to-issue`

```json
// Request
{
  "ticket_type": "返修工单",  // 本地工单 / 返修工单
  "issue_category": "稳定性",
  "issue_subcategory": "死机",
  "severity": 2
}

// Response
{
  "success": true,
  "data": {
    "service_record_id": "sr_001",
    "service_record_status": "转工单",
    "issue": {
      "id": "issue_001",
      "rma_number": "RA09D-2602-001",  // 返修工单
      // 或 "LR-2026-0001" (本地工单)
      "ticket_type": "返修工单"
    }
  }
}
```

### 3.6 重新打开服务记录

**POST** `/api/v1/service-records/{id}/reopen`

> 30天内同一客户同一产品的同问题可重新打开原记录

```json
// Response
{
  "success": true,
  "data": {
    "id": "sr_001",
    "status": "处理中",
    "reopened_at": "2026-02-02T14:00:00Z",
    "reopened_from_id": null  // 如是从另一记录重开则有值
  }
}
```

---

## 4. 上下文查询 API

> 支持按客户或按产品SN查询上下文信息，用于服务时快速了解背景

### 4.1 按客户查询上下文

**GET** `/api/v1/context/by-customer`

**查询参数**:

| 参数 | 类型 | 说明 |
|-----|------|------|
| customer_id | string | 客户ID |
| customer_name | string | 客户姓名 (模糊匹配) |
| customer_contact | string | 联系方式 |

```json
// Response
{
  "success": true,
  "data": {
    "customer": {
      "id": "cust_001",
      "name": "Max Mueller",
      "contact": "max@example.uk",
      "customer_level": "VIP"
    },
    "devices": [
      {
        "product_id": "prod_edge8k",
        "product_name": "MAVO Edge 8K",
        "serial_number": "ME_207890",
        "warranty_status": "在保",
        "warranty_until": "2027-03-15"
      },
      {
        "product_id": "prod_eagle",
        "product_name": "Eagle HDMI",
        "serial_number": "EH_104523",
        "warranty_status": "过保"
      }
    ],
    "service_history": [
      {
        "type": "service_record",
        "id": "sr_089",
        "number": "SRD-2602-089",
        "summary": "高帧率设置咨询",
        "status": "已解决",
        "date": "2026-01-15"
      },
      {
        "type": "issue",
        "id": "issue_012",
        "number": "IS-2026-0012",
        "summary": "SDI模块更换",
        "status": "已完成",
        "date": "2026-01-08"
      }
    ],
    "ai_profile": {
      "activity_level": "高频",  // 高频/中频/低频
      "technical_ability": "强",  // 强/中/弱
      "communication_preference": "邮件",
      "tags": ["VIP客户", "技术能力强", "偏好邮件"],
      "notes": "此客户曾提出2个功能期望，均已纳入规划"
    }
  }
}
```

### 4.2 按产品SN查询上下文

**GET** `/api/v1/context/by-serial-number`

**查询参数**:

| 参数 | 类型 | 说明 |
|-----|------|------|
| serial_number | string | 产品序列号 |

> 适用场景：设备可能转让/出租，需查看该设备完整服务历史（可能涉及多个用户）

```json
// Response
{
  "success": true,
  "data": {
    "device": {
      "product_id": "prod_edge8k",
      "product_name": "MAVO Edge 8K",
      "serial_number": "ME_207890",
      "firmware_version": "8023",
      "warranty_status": "在保",
      "warranty_until": "2027-03-15"
    },
    "ownership_history": [
      {
        "customer_id": "cust_001",
        "customer_name": "John Smith",
        "period": "2025-03-15 ~ 2025-12-01",
        "status": "已转让"
      },
      {
        "customer_id": "cust_002",
        "customer_name": "Max Mueller",
        "period": "2025-12-01 ~ 至今",
        "status": "当前"
      }
    ],
    "service_history": [
      {
        "type": "service_record",
        "id": "sr_089",
        "number": "SR-2025-0089",
        "summary": "参数设置咨询",
        "customer_name": "John Smith",  // 显示当时的客户
        "status": "已解决",
        "date": "2025-06-15"
      },
      {
        "type": "issue",
        "id": "issue_156",
        "number": "IS-2025-0156",
        "summary": "SDI模块更换",
        "customer_name": "John Smith",
        "status": "已完成",
        "date": "2025-09-20"
      },
      {
        "type": "service_record",
        "id": "sr_201",
        "number": "SRC-2602-201",
        "summary": "高帧率设置",
        "customer_name": "Max Mueller",  // 转让后的新客户
        "status": "已解决",
        "date": "2026-01-20"
      }
    ]
  }
}
```

---

## 5. 工单管理 API

### 5.1 创建工单

**POST** `/api/v1/issues`

**权限**: 市场部、经销商

```json
// Request
{
  // 工单类型 (新增)
  "ticket_type": "返修工单",  // 本地工单 / 返修工单
  // 本地工单: 经销商自行维修，编号格式 LR-2026-0001
  // 返修工单: 寄回总部维修，编号格式 IS-2026-0001
  
  // 基础信息
  "issue_type": "客户返修",  // 生产问题/发货问题/客户返修/内部样机
  "issue_category": "稳定性",
  "issue_subcategory": "死机",
  "severity": 3,  // 1/2/3级
  
  // 产品信息
  "product_id": "prod_edge8k",
  "serial_number": "ME_207624",
  "firmware_version": "8023",
  
  // 问题描述
  "problem_description": "拍摄时随机死机，约每小时一次",
  "solution_for_customer": "",  // 初始可为空
  "is_warranty": true,
  
  // 关联人员
  "reporter_name": "张先生",
  "reporter_type": "客户",  // 客户/经销商/内部
  "customer_id": "cust_001",  // 可选
  "dealer_id": "dealer_proav",  // 可选
  "region": "国内",
  
  // 关联服务记录 (如从服务记录升级)
  "service_record_id": "sr_001",  // 可选
  
  // 可选
  "rma_number": "",  // 返修工单后续分配，本地工单不需要
  "external_link": "https://..."
}

// Response
{
  "success": true,
  "data": {
    "id": "issue_20260130_001",
    "rma_number": "RA09C-2602-156",  // 返修工单使用RMA号
    "ticket_type": "返修工单",
    "status": "待处理",
    "created_at": "2026-01-30T10:30:00Z"
  }
}
```

### 5.2 获取工单列表

**GET** `/api/v1/issues`

**权限**: 按角色过滤可见范围

**查询参数**:

| 参数 | 类型 | 说明 |
|-----|------|------|
| page | int | 页码，默认1 |
| page_size | int | 每页数量，默认20，最大100 |
| sort_by | string | 排序字段: created_at, updated_at, severity |
| sort_order | string | asc/desc |
| **筛选条件** | | |
| ticket_type | string | 工单类型: 本地工单/返修工单 |
| status | string | 状态筛选，多选用逗号分隔 |
| issue_type | string | 类型筛选 |
| issue_category | string | 大类筛选 |
| severity | int | 等级筛选 |
| product_id | string | 产品筛选 |
| dealer_id | string | 经销商筛选 |
| region | string | 地区筛选 |
| assigned_to | string | 处理人筛选 |
| is_warranty | bool | 是否在保 |
| created_from | date | 创建时间起 |
| created_to | date | 创建时间止 |
| keyword | string | 关键词搜索(标题+描述) |

```json
// Response
{
  "success": true,
  "data": [
    {
      "id": "issue_001",
      "rma_number": "RA09C-2602-156",
      "ticket_type": "返修工单",
      "issue_type": "客户返修",
      "issue_category": "稳定性",
      "severity": 2,
      "product": {
        "id": "prod_edge8k",
        "name": "MAVO Edge 8K"
      },
      "serial_number": "ME_207624",
      "problem_description": "拍摄时随机死机...",
      "reporter_name": "张先生",
      "status": "处理中",
      "assigned_to": {
        "id": "usr_002",
        "name": "陈高松"
      },
      "created_at": "2026-01-30T10:30:00Z",
      "updated_at": "2026-01-30T14:20:00Z"
    }
  ],
  "meta": {
    "page": 1,
    "page_size": 20,
    "total": 156
  }
}
```

### 5.3 获取工单详情

**GET** `/api/v1/issues/{id}`

```json
// Response
{
  "success": true,
  "data": {
    "id": "issue_001",
    "rma_number": "RA09C-2602-156",
    "ticket_type": "返修工单",
    
    // 完整信息
    "issue_type": "客户返修",
    "issue_category": "稳定性",
    "issue_subcategory": "死机",
    "severity": 2,
    
    "product": {
      "id": "prod_edge8k",
      "name": "MAVO Edge 8K",
      "series": "Edge"
    },
    "serial_number": "ME_207624",
    "firmware_version": "8023",
    "hardware_version": "Rev.B",
    
    "problem_description": "拍摄时随机死机，约每小时一次",
    "solution_for_customer": "建议升级至8025固件，如问题持续请返修",
    "is_warranty": true,
    
    "repair_content": "更换主板",  // 生产部填写
    "problem_analysis": "主板供电芯片虚焊",  // 生产部填写
    
    "reporter_name": "张先生",
    "reporter_type": "客户",
    "customer": { "id": "cust_001", "name": "张先生", "company": "XX影视" },
    "dealer": null,
    "region": "国内",
    
    "submitted_by": { "id": "usr_001", "name": "刘玖龙" },
    "assigned_to": { "id": "usr_002", "name": "陈高松" },
    
    // 关联服务记录
    "service_record": {
      "id": "sr_001",
      "record_number": "SRD-2602-089"
    },
    
    "payment_channel": "微信",
    "payment_amount": 0,
    "payment_date": null,
    
    "status": "处理中",
    "feedback_date": "2026-01-28",
    "received_date": "2026-01-30",
    "completed_date": null,
    
    "external_link": "https://...",
    
    "attachments": [...],  // 附件列表
    "comments": [...],  // 评论列表
    
    "created_at": "2026-01-30T10:30:00Z",
    "updated_at": "2026-01-30T14:20:00Z"
  }
}
```

### 5.4 更新工单

**PATCH** `/api/v1/issues/{id}`

**权限**: 按字段分权限控制

```json
// Request (市场部 - 更新解决方案)
{
  "solution_for_customer": "已确认为固件问题，请升级至8025版本",
  "status": "已关闭"
}

// Request (生产部 - 更新维修信息)
{
  "repair_content": "更换主板、清洁传感器",
  "problem_analysis": "主板U23芯片虚焊导致供电不稳",
  "status": "已维修"
}

// Request (市场部 - 更新收款信息)
{
  "payment_channel": "对公转账",
  "payment_amount": 1500,
  "payment_date": "2026-01-30"
}
```

### 5.5 分配工单

**POST** `/api/v1/issues/{id}/assign`

**权限**: 市场部

```json
// Request
{
  "assigned_to": "usr_002",
  "repair_priority": "R2",  // R1加急/R2优先/R3标准
  "comment": "请检查主板供电部分"  // 可选
}
```

### 5.6 创建RMA号 (仅返修工单)

**POST** `/api/v1/issues/{id}/rma`

**权限**: 市场部

> 注意: 仅返修工单需要RMA号，本地工单不需要

```json
// Request
{
  "product_type": "09",  // 产品类型代码
  "channel": "01"  // 渠道代码: 01国内/02海外
}

// Response
{
  "success": true,
  "data": {
    "rma_number": "RA09C-2602-001"  // RA + 产品(2) + 渠道(1) + YYMM + 序号(3)
  }
}
```

### 5.7 删除工单

**DELETE** `/api/v1/issues/{id}`

**权限**: admin

---

## 6. 工单评论 API

### 6.1 添加评论

**POST** `/api/v1/issues/{issue_id}/comments`

```json
// Request
{
  "content": "已联系客户，约定明天寄回",
  "comment_type": "进度更新",  // 进度更新/内部备注/客户沟通
  "is_internal": false  // true=仅内部可见
}
```

### 6.2 获取评论列表

**GET** `/api/v1/issues/{issue_id}/comments`

---

## 7. 工单附件 API

### 7.1 上传附件

**POST** `/api/v1/issues/{issue_id}/attachments`

**Content-Type**: multipart/form-data

| 字段 | 类型 | 限制 |
|-----|------|------|
| file | File | 图片: 10MB, 视频: 50MB |
| type | string | image/video |

```json
// Response
{
  "success": true,
  "data": {
    "id": "att_001",
    "file_name": "故障截图.jpg",
    "file_url": "/api/v1/attachments/att_001/download",
    "file_size": 1024000,
    "file_type": "image",
    "thumbnail_url": "/api/v1/attachments/att_001/thumbnail"
  }
}
```

### 7.2 获取/下载附件

**GET** `/api/v1/attachments/{id}/download`

**权限**: 需有对应工单访问权限

### 7.3 删除附件

**DELETE** `/api/v1/attachments/{id}`

---

## 8. 知识库 API

### 8.1 创建知识条目

**POST** `/api/v1/knowledge`

**权限**: 编辑者+

```json
// Request (FAQ类型)
{
  "knowledge_type": "FAQ",
  "title": "Eagle HDMI是否支持3D LUT导入",
  "question": "Eagle HDMI是否支持3D LUT导入？",
  "external_answer": "Eagle HDMI不支持3D LUT导入，仅Eagle SDI支持此功能",
  "internal_answer": "Eagle HDMI硬件不支持LUT处理，SDI版本使用独立LUT处理芯片",
  "visibility": "Public",  // Public/Dealer/Internal/Department
  "product_ids": ["prod_eagle_hdmi"],
  "tags": ["LUT", "HDMI", "功能"],
  "status": "draft"  // draft/published [待确认: 是否需要审核流程]
}

// Request (Troubleshooting类型)
{
  "knowledge_type": "Troubleshooting",
  "title": "Eagle屏幕不亮排查指南",
  "content": "...",  // Markdown格式 [待确认: 内容格式]
  "visibility": "Internal",
  "product_ids": ["prod_eagle_hdmi", "prod_eagle_sdi"],
  "steps": [
    {
      "step_order": 1,
      "action": "检查供电线缆是否插好，特别是0B5P的",
      "next_step_if_fail": 2
    },
    {
      "step_order": 2,
      "action": "检查Eagle电源开关是否打开",
      "next_step_if_fail": 3
    },
    {
      "step_order": 3,
      "action": "更换线缆尝试",
      "result_if_pass": "线缆问题",
      "result_if_fail": "需更换主板"
    }
  ]
}
```

### 8.2 获取知识库列表

**GET** `/api/v1/knowledge`

**查询参数**:

| 参数 | 类型 | 说明 |
|-----|------|------|
| page, page_size | int | 分页 |
| knowledge_type | string | FAQ/Troubleshooting/兼容性/固件知识/问题案例 |
| product_id | string | 产品筛选 |
| visibility | string | 可见性筛选 (按用户权限自动过滤) |
| tags | string | 标签筛选，逗号分隔 |
| keyword | string | 关键词搜索 |
| status | string | draft/published |

### 8.3 获取知识详情

**GET** `/api/v1/knowledge/{id}`

**权限**: 按visibility和用户角色过滤

### 8.4 更新知识条目

**PATCH** `/api/v1/knowledge/{id}`

### 8.5 发布知识条目

**POST** `/api/v1/knowledge/{id}/publish`

> 默认方案: 编辑者可直接发布，无需审核

### 8.6 获取兼容性列表

**GET** `/api/v1/knowledge/compatibility`

```json
// Query params
?our_product=prod_eagle_hdmi
&external_brand=Sony
&interface_type=HDMI

// Response
{
  "success": true,
  "data": [
    {
      "id": "compat_001",
      "our_product": { "id": "prod_eagle_hdmi", "name": "Eagle HDMI" },
      "external_device": "FX6",
      "external_brand": "Sony",
      "interface_type": "全尺寸HDMI A",
      "resolution": "1080p",
      "frame_rate": "50",
      "is_compatible": true,
      "supports_rec_status": true,
      "supports_vu_meter": true,
      "supports_timecode": true,
      "notes": "",
      "tested_date": "2025-06-15"
    }
  ]
}
```

### 8.7 知识库树形结构

**GET** `/api/v1/knowledge/tree`

> 默认方案: 混合模式 (按产品+按类型)

```json
// Response
{
  "success": true,
  "data": {
    "by_product": [
      {
        "product": { "id": "prod_eagle_hdmi", "name": "Eagle HDMI" },
        "categories": [
          { "type": "FAQ", "count": 25 },
          { "type": "Troubleshooting", "count": 8 },
          { "type": "兼容性", "count": 45 }
        ]
      }
    ],
    "by_type": [
      { "type": "FAQ", "count": 120 },
      { "type": "Troubleshooting", "count": 35 },
      { "type": "固件知识", "count": 15 }
    ],
    "general": { "count": 20 }
  }
}
```

---

## 9. 产品 API

### 9.1 获取产品列表

**GET** `/api/v1/products`

```json
// Response
{
  "success": true,
  "data": [
    {
      "id": "prod_edge8k",
      "name": "MAVO Edge 8K",
      "model": "Edge 8K",
      "category": "电影机",
      "series": "Edge",
      "current_firmware_version": "8025"
    }
  ]
}
```

### 9.2 获取产品详情

**GET** `/api/v1/products/{id}`

---

## 10. 客户 API

### 10.1 创建客户

**POST** `/api/v1/customers`

```json
// Request
{
  "name": "张先生",
  "company": "XX影视公司",
  "contact_info": {
    "phone": "13800138000",
    "email": "zhang@example.com",
    "wechat": "zhang_wx"
  },
  "customer_type": "终端客户",  // 终端客户/KOL/媒体
  "customer_level": "普通",  // VIP/普通/新客户
  "country": "中国",
  "province": "广东",
  "city": "深圳",
  "dealer_id": null  // 关联经销商
}
```

### 10.2 获取客户列表

**GET** `/api/v1/customers`

### 10.3 获取/更新客户详情

**GET/PATCH** `/api/v1/customers/{id}`

---

## 11. 经销商 API

### 11.1 获取经销商列表

**GET** `/api/v1/dealers`

```json
// Response
{
  "success": true,
  "data": [
    {
      "id": "dealer_proav",
      "name": "ProAV Berlin",
      "code": "PROAV",
      "dealer_type": "一级代理",
      "region": "海外",
      "country": "德国",
      "contact_info": {
        "contact_person": "Max",
        "email": "max@proav.de",
        "phone": "+49..."
      },
      "service_capabilities": {
        "can_repair": true,
        "repair_level": "简单维修"  // 简单维修/中级维修/全面维修
      }
    }
  ]
}
```

### 11.2 经销商返修记录

**GET** `/api/v1/dealers/{id}/issues`

**权限**: 市场部、该经销商自己

---

## 12. 维修配件 API

> 配件价格查询、库存管理和报价计算

### 12.1 获取配件分类列表

**GET** `/api/v1/parts/categories`

**权限**: 市场部、经销商

```json
// Response
{
  "success": true,
  "data": [
    {
      "id": "cat_eagle_evf",
      "name": "EAGLE EVF",
      "parts_count": 3
    },
    {
      "id": "cat_edge_mm2",
      "name": "MAVO Edge/mark2",
      "parts_count": 29
    },
    {
      "id": "cat_terra",
      "name": "TERRA/MAVO S35/LF",
      "parts_count": 14
    }
  ]
}
```

### 12.2 获取配件价格列表

**GET** `/api/v1/parts`

**权限**: 市场部、经销商

**查询参数**:

| 参数 | 类型 | 说明 |
|-----|------|------|
| category | string | 配件分类筛选 |
| keyword | string | 关键词搜索(名称/SKU) |
| sku | string | 精确SKU查询 |
| product_id | string | 适用产品筛选 |
| has_price | bool | 是否有价格 |

```json
// Response
{
  "success": true,
  "data": [
    {
      "id": "part_001",
      "sku": "S1-011-013-01",
      "name_cn": "SDI模块",
      "name_en": "SDI Module",
      "category": "MAVO Edge/mark2",
      "applicable_products": ["Edge 8K", "Edge 6K", "MM2"],
      "pricing": {
        "cny": 390,
        "usd": 69,
        "eur": 69
      },
      "in_stock": true,
      "notes": ""
    }
  ],
  "meta": {
    "total": 74,
    "page": 1,
    "page_size": 20
  }
}
```

### 12.3 获取配件详情

**GET** `/api/v1/parts/{id}`

```json
// Response
{
  "success": true,
  "data": {
    "id": "part_001",
    "sku": "S1-011-013-01",
    "name_cn": "SDI模块",
    "name_en": "SDI Module",
    "name_external_cn": "SDI模块",
    "name_external_en": "SDI Module",
    "category": "MAVO Edge/mark2",
    "applicable_products": ["Edge 8K", "Edge 6K", "MM2 LF", "MM2 S35"],
    "pricing": {
      "cny": 390,
      "usd": 69,
      "eur": 69
    },
    "notes": "",
    "updated_at": "2026-01-30"
  }
}
```

### 12.4 Edge前部维修方案查询

**GET** `/api/v1/parts/edge-front-repair`

**权限**: 市场部、经销商

**查询参数**:

| 参数 | 类型 | 说明 |
|-----|------|------|
| model_batch | string | 机型批次: edge_8k_1/edge_8k_2/edge_8k_3/edge_6k_1/edge_6k_2 |
| replace_nd | bool | 是否需要更换ND |

```json
// Response
{
  "success": true,
  "data": {
    "model_batch": "edge_8k_2",
    "model_description": "Edge 8K 6系列 (2021.12.3起)",
    "replace_nd": false,
    "recommended_scheme": "B1",
    "schemes": [
      {
        "code": "B1",
        "name": "前部框架更换",
        "description": "仅更换前部框架，不含ND模块",
        "applicable": true,
        "pricing": {
          "cny": 1190,
          "usd": 249
        },
        "includes": ["前部框架"]
      },
      {
        "code": "B2",
        "name": "简化前部更换",
        "applicable": true,
        "pricing": {
          "cny": 799,
          "usd": 199
        }
      }
    ],
    "special_rules": [
      "在保维修免费",
      "VIP客户B2方案可申请免费",
      "已购买电子E卡口客户可享优惠"
    ]
  }
}
```

### 12.5 生成维修报价预估

**POST** `/api/v1/parts/estimate`

**权限**: 市场部、经销商

```json
// Request
{
  "currency": "usd",  // cny/usd/eur
  "region": "英国",  // 用于计算运费
  "parts": [
    { "part_id": "part_001", "quantity": 1 },
    { "part_id": "part_025", "quantity": 1 }
  ],
  "edge_front_scheme": null,  // 如需Edge前部维修，填写方案代码如"B1"
  "include_shipping": true,
  "include_labor": true,
  "labor_type": "standard"  // standard/complex
}

// Response
{
  "success": true,
  "data": {
    "currency": "usd",
    "breakdown": {
      "parts": [
        { "name": "SDI模块", "quantity": 1, "unit_price": 69, "subtotal": 69 },
        { "name": "风扇", "quantity": 1, "unit_price": 65, "subtotal": 65 }
      ],
      "parts_total": 134,
      "shipping": 29,
      "labor": 0,
      "edge_front_scheme": null
    },
    "total": 163,
    "note": "最终费用以实际检测为准"
  }
}
```

### 12.6 经销商配件库存

**GET** `/api/v1/dealers/{dealer_id}/parts-inventory`

**权限**: 市场部、该经销商自己

```json
// Response
{
  "success": true,
  "data": {
    "dealer_id": "dealer_proav",
    "dealer_name": "ProAV Berlin",
    "inventory": [
      {
        "part_id": "part_001",
        "sku": "S1-011-013-01",
        "name": "SDI模块",
        "quantity": 5,
        "safety_stock": 3,
        "status": "normal"  // normal/low/out_of_stock
      },
      {
        "part_id": "part_006",
        "sku": "S1-010-006-01",
        "name": "Edge电源模块",
        "quantity": 1,
        "safety_stock": 2,
        "status": "low"
      }
    ],
    "summary": {
      "total_sku_count": 15,
      "low_stock_count": 2,
      "out_of_stock_count": 0
    }
  }
}
```

### 12.7 经销商配件补货申请

**POST** `/api/v1/dealers/{dealer_id}/parts-orders`

**权限**: 经销商

```json
// Request
{
  "parts": [
    { "part_id": "part_006", "quantity": 4 },
    { "part_id": "part_025", "quantity": 3 }
  ],
  "notes": "库存不足，申请补货"
}

// Response
{
  "success": true,
  "data": {
    "order_id": "po_20260202_001",
    "status": "待审核",
    "parts": [...],
    "estimated_total": {
      "usd": 1496
    }
  }
}
```

---

## 13. 生产问题反馈 API (F0)

### 13.1 创建生产反馈

**POST** `/api/v1/production-feedbacks`

**权限**: 市场部、生产部

```json
// Request
{
  "feedback_date": "2026-01-30",
  "ship_date": "2026-01-25",
  "category": "生产",  // 生产/发货/返修/检测维修
  "severity": 2,
  "product_name": "Edge 8K",
  "serial_number": "ME_207890",
  "problem_description": "出厂时发现Sensor有灰点",
  "reporter": "客户张先生",
  "responsible_person": "张工",
  "related_issue_id": "issue_001"  // 可选，关联工单
}
```

### 13.2 获取生产反馈列表

**GET** `/api/v1/production-feedbacks`

---

## 14. 统计分析 API

### 14.1 工单统计概览

**GET** `/api/v1/stats/overview`

```json
// Response
{
  "success": true,
  "data": {
    "total_issues": 1256,
    "by_status": {
      "待处理": 45,
      "处理中": 89,
      "已维修": 23,
      "已关闭": 1099
    },
    "by_severity": {
      "1级": 12,
      "2级": 156,
      "3级": 1088
    },
    "this_week": {
      "new": 23,
      "closed": 18,
      "trend": "+12%"
    }
  }
}
```

### 14.2 趋势统计

**GET** `/api/v1/stats/trend`

**查询参数**:
- `period`: day/week/month
- `from_date`, `to_date`: 时间范围
- `product_id`, `issue_category`, `region`: 筛选条件

```json
// Response
{
  "success": true,
  "data": {
    "labels": ["2026-01-01", "2026-01-08", "2026-01-15", "2026-01-22", "2026-01-29"],
    "datasets": [
      {
        "name": "新增工单",
        "values": [12, 15, 8, 23, 18]
      },
      {
        "name": "已关闭",
        "values": [10, 12, 11, 20, 15]
      }
    ]
  }
}
```

### 14.3 产品问题分布

**GET** `/api/v1/stats/by-product`

### 14.4 问题类别统计

**GET** `/api/v1/stats/by-category`

### 14.5 经销商统计

**GET** `/api/v1/stats/by-dealer`

### 14.6 地区统计

**GET** `/api/v1/stats/by-region`

> 默认方案: 返回按地区聚合的数据，前端可选择是否用热力图展示

### 14.7 处理效率统计

**GET** `/api/v1/stats/efficiency`

```json
// Response
{
  "success": true,
  "data": {
    "avg_response_time_hours": 4.5,
    "avg_resolve_time_days": 3.2,
    "by_assignee": [
      { "name": "陈高松", "avg_resolve_days": 2.8, "count": 45 },
      { "name": "张工", "avg_resolve_days": 3.5, "count": 38 }
    ]
  }
}
```

### 14.8 导出报表

**POST** `/api/v1/stats/export`

```json
// Request
{
  "report_type": "issue_list",  // issue_list/trend/product_quality
  "format": "xlsx",  // xlsx/csv/pdf
  "filters": {
    "from_date": "2026-01-01",
    "to_date": "2026-01-31",
    "product_id": "prod_edge8k"
  }
}

// Response
{
  "success": true,
  "data": {
    "download_url": "/api/v1/downloads/export_20260130_001.xlsx",
    "expires_at": "2026-01-30T12:00:00Z"
  }
}
```

### 14.9 定时报表

**POST** `/api/v1/stats/scheduled-reports`

> 默认方案: Phase 1 不实现，后续版本考虑

---

## 15. AI 智能问答 API

### 15.1 智能问答

**POST** `/api/v1/ai/chat`

**权限**: 按用户角色决定检索范围

```json
// Request
{
  "question": "MAVO Edge 8K 录制时突然停止是什么原因？",
  "context": {
    "product_id": "prod_edge8k",  // 可选，限定产品范围
    "include_issues": true  // 是否检索历史工单
  }
}

// Response
{
  "success": true,
  "data": {
    "answer": "根据历史记录，MAVO Edge 8K 录制中断通常有以下原因：\n1. SSD 写入速度不足\n2. 高温保护触发\n3. 电池电量不足\n\n建议排查步骤...",
    "references": [
      {
        "type": "knowledge",
        "id": "kb_023",
        "title": "SSD兼容性指南",
        "snippet": "推荐使用Samsung T7..."
      },
      {
        "type": "issue",
        "id": "issue_847",
        "rma_number": "RA09C-2512-047",
        "snippet": "客户反馈录制中断，更换SSD后解决"
      }
    ],
    "suggested_actions": [
      { "action": "create_issue", "label": "创建工单" },
      { "action": "view_knowledge", "id": "kb_023", "label": "查看知识库" }
    ]
  }
}
```

### 15.2 引导式故障排查

**POST** `/api/v1/ai/troubleshoot`

```json
// Request (开始排查)
{
  "action": "start",
  "phenomenon": "Eagle屏幕不亮"
}

// Response
{
  "success": true,
  "data": {
    "session_id": "ts_001",
    "current_step": 1,
    "question": "请检查供电线缆是否插好，特别是0B5P的",
    "options": [
      { "value": "pass", "label": "线缆已插好，问题仍存在" },
      { "value": "fail", "label": "发现线缆松动，已修复" }
    ]
  }
}

// Request (继续排查)
{
  "action": "continue",
  "session_id": "ts_001",
  "answer": "pass"
}

// Response (最终结果)
{
  "success": true,
  "data": {
    "session_id": "ts_001",
    "completed": true,
    "diagnosis": "根据排查结果，可能需要更换主板",
    "suggested_actions": [
      { "action": "create_issue", "label": "创建返修工单" }
    ]
  }
}
```

### 15.3 工单智能分析

**POST** `/api/v1/ai/analyze-issues`

**权限**: 研发部、管理层

```json
// Request
{
  "analysis_type": "pattern",  // pattern/trend/root_cause
  "filters": {
    "from_date": "2026-01-01",
    "product_id": "prod_edge8k"
  }
}

// Response
{
  "success": true,
  "data": {
    "analysis_type": "pattern",
    "findings": [
      {
        "pattern": "死机问题集中在批次 2026Q1-003",
        "confidence": 0.85,
        "affected_issues": ["issue_101", "issue_105", "issue_112"],
        "recommendation": "建议检查该批次供电模块"
      }
    ],
    "summary": "近30天共发现2个显著问题模式..."
  }
}
```

### 15.4 智能查询建议

**POST** `/api/v1/ai/suggest-query`

```json
// Request
{
  "natural_query": "最近华东地区问题比较多"
}

// Response
{
  "success": true,
  "data": {
    "structured_query": {
      "region": "华东",
      "created_from": "2025-12-31",
      "sort_by": "created_at",
      "sort_order": "desc"
    },
    "insight": "华东地区近30天共45个工单，环比增长30%。主要集中在MAVO Edge 8K(51%)，问题类型以存储相关为主(40%)"
  }
}
```

### 15.5 自动标签建议

**POST** `/api/v1/ai/suggest-tags`

```json
// Request
{
  "issue_id": "issue_001",
  "problem_description": "拍摄8K RAW时，约30分钟后机器自动关机，查看温度显示85度"
}

// Response
{
  "success": true,
  "data": {
    "suggested_category": "稳定性",
    "suggested_subcategory": "温度异常",
    "suggested_severity": 2,
    "suggested_tags": ["高温保护", "8K RAW", "长时间拍摄"],
    "similar_issues": ["issue_089", "issue_156"]
  }
}
```

---

## 16. 系统管理 API

### 16.1 用户管理

**GET/POST/PATCH/DELETE** `/api/v1/admin/users`

**权限**: admin

### 16.2 字典数据

**GET** `/api/v1/system/dictionaries`

```json
// Response
{
  "success": true,
  "data": {
    "issue_types": ["生产问题", "发货问题", "客户返修", "内部样机"],
    "issue_categories": ["稳定性", "素材", "监看", "SSD", "音频", "兼容性", "时码", "硬件结构"],
    "severity_levels": [
      { "value": 1, "label": "1级", "description": "严重错误+严重后果" },
      { "value": 2, "label": "2级", "description": "严重错误+无严重后果" },
      { "value": 3, "label": "3级", "description": "一般问题" }
    ],
    "status_list": ["待处理", "处理中", "已维修", "待收款", "已关闭"],
    "regions": ["国内", "国外"],
    "payment_channels": ["微信", "支付宝", "对公转账", "PayPal", "Wire Transfer"]
  }
}
```

### 16.3 RMA编号规则

**GET** `/api/v1/system/rma-rules`

```json
// Response
{
  "success": true,
  "data": {
    "format": "RA + 产品类型(2) + 渠道(2) + 年份(2) + 序号(3)",
    "product_codes": {
      "09": "电影机",
      "10": "Eagle",
      "11": "配件"
    },
    "channel_codes": {
      "01": "国内",
      "02": "海外-ProAV",
      "03": "海外-Gafpa"
    }
  }
}
```

---

## 17. 通知 API

> 默认方案: Phase 1 实现基础通知，不含推送

### 17.1 获取通知列表

**GET** `/api/v1/notifications`

```json
// Response
{
  "success": true,
  "data": [
    {
      "id": "notif_001",
      "type": "issue_assigned",
      "title": "新工单分配",
      "message": "工单 IS-2026-0156 已分配给您",
      "related_issue_id": "issue_001",
      "is_read": false,
      "created_at": "2026-01-30T10:30:00Z"
    }
  ],
  "meta": {
    "unread_count": 5
  }
}
```

### 17.2 标记已读

**POST** `/api/v1/notifications/mark-read`

```json
// Request
{
  "notification_ids": ["notif_001", "notif_002"]
}
```

---

## 18. 待确认问题汇总

| 编号 | 问题 | 默认方案 | 影响API |
|-----|------|---------|--------|
| Q5 | 视频100MB限制是否足够 | 100MB | `POST /issues/{id}/attachments` |
| Q6 | 是否自动压缩 | 不压缩 | 附件上传 |
| Q7 | 是否用对象存储 | 本地存储 | 附件存储 |
| Q8 | 知识库组织方式 | 混合模式 | `GET /knowledge/tree` |
| Q9 | 是否版本控制 | 不需要 | 知识库API |
| Q10 | 是否审核流程 | 不需要 | `POST /knowledge/{id}/publish` |
| Q11 | 内容格式 | Markdown | 知识库创建/编辑 |
| Q13 | 经销商独立入口 | 共用入口 | `POST /auth/login` |
| Q14 | 经销商能否创建工单 | 可以 | `POST /issues` |
| Q2 | 定时邮件推送 | Phase 1不实现 | `POST /stats/scheduled-reports` |
| Q17 | 推送通知 | 基础通知,无推送 | 通知API |

---

## 19. API 版本规划

### Phase 1 (基础)
- 认证API (2.1-2.4)
- 服务记录API (3.1-3.6)
- 上下文查询API (4.1-4.2)
- 工单CRUD (5.1-5.7)
- 工单评论 (6.x)
- 附件上传 (7.x) - 本地存储
- 产品/客户/经销商基础API (9-11)
- 维修配件API (12.1-12.5) **新增** - 配件价格查询、报价预估
- 基础统计 (14.1-14.5)

### Phase 2 (知识库+配件库存)
- 知识库全部API (8.x)
- AI智能问答 (15.1-15.2)
- 经销商配件库存API (12.6-12.7) **新增**

### Phase 3 (高级分析)
- 高级统计 (14.6-14.8)
- AI工单分析 (15.3-15.5)
- 导出功能

### Phase 4 (扩展)
- 定时报表
- 推送通知
- 对象存储迁移

---

**下一步**: 确认待确认问题后，可开始代码实现。
