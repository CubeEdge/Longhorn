# 产品服务系统 - API 设计文档

**版本**: 0.8.0 (Draft)
**状态**: 草稿
**最后更新**: 2026-02-06
**关联PRD**: Service_PRD.md v0.10.0
**关联场景**: Service_UserScenarios.md v0.6.0

> **重要更新（2026-02-06）**：
> - **v0.8.0 更新**：
>   - 新增 Section 17/18: Bokeh 工单搜索与索引管理 API
>   - 集成各工单详情弹窗所需的端点。
>   - 同步 PRD v0.10.0 交互规范。

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

### 2.5 获取产品列表 (Phase 6 引入)

**GET** `/api/v1/products`

**权限**: 全部登录用户

**Response**:
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "model_name": "MAVO Edge 8K",
      "product_family": "A"
    },
    {
      "id": 2,
      "model_name": "MAVO Edge 6K",
      "product_family": "A"
    },
    {
      "id": 3,
      "model_name": "MAVO mark2 LF",
      "product_family": "A"
    },
    {
      "id": 5,
      "model_name": "MAVO LF",
      "product_family": "B"
    },
    {
      "id": 7,
      "model_name": "Terra 4K",
      "product_family": "B"
    },
    {
      "id": 8,
      "model_name": "Eagle HDMI",
      "product_family": "C"
    },
    {
      "id": 9,
      "model_name": "Eagle SDI",
      "product_family": "C"
    },
    {
      "id": 10,
      "model_name": "KineMON 7U2",
      "product_family": "C"
    },
    {
      "id": 11,
      "model_name": "GripBAT PD75",
      "product_family": "D"
    }
  ]
}
```

**字段说明**：
- `product_family`：产品族群标识，对应 PRD 1.5.2.0 中的产品体系分类：
  - `A`：在售电影摄影机（如 MAVO Edge 8K / 6K、MAVO mark2 等）
  - `B`：存档/历史机型（如 MAVO LF、Terra 4K/6K 等）
  - `C`：电子寻像器（如 Eagle SDI/HDMI、KineMON 系列等，仅保证与 Kinefinity 电影机适配）
  - `D`：通用配件（如 GripBAT 电池、Magic Arm 等跨代通用配件）

**前端使用建议**：
- 根据 `product_family` 控制产品在选择列表中的展示优先级：
  - A 类优先展示在顶部；
  - B 类可折叠或标记为「历史机型」；
  - C 类触发「宿主设备信息」填写要求（见下文）；
  - D 类可独立展示，不强制绑定具体机型。

---

## 3. 咨询工单 API (Inquiry Ticket)

> 咨询工单用于记录咨询、问题排查等服务，可升级为RMA返厂单或经销商维修单。
> 工单ID格式：KYYMM-XXXX（如K2602-0001）

### 3.1 创建咨询工单

**POST** `/api/v1/inquiry-tickets`

**权限**: 市场部、经销商(2.0)

**Content-Type**: `multipart/form-data`

**产品与宿主设备字段规则**：
- `product_id`：
  - 引用 `/api/v1/products` 返回的产品ID；
  - 前端可通过 `product_family` 控制展示优先级（A 类优先展示，B 类折叠，C/D 类按需展示）。
- `host_device_type` / `host_device_model`：
  - 仅当 `product_family = C`（电子寻像器，如 Eagle/KineMON 等）时必填；
  - 用于区分「Kinefinity 相机 + e-Viewfinder」的常规硬件问题，和「第三方相机 + e-Viewfinder」的兼容性排查。

**字段列表**：

| 字段 | 类型 | 必须 | 说明 |
|-----|------|------|------|
| customer_name | string | 否 | 客户姓名 |
| customer_contact | string | 否 | 客户联系方式 |
| product_id | int | 否 | 产品ID（从 `/products` 选择） |
| serial_number | string | 否 | 序列号 |
| host_device_type | string | C类必填 | 宿主类型：`KINEFINITY_CAMERA` / `THIRD_PARTY_CAMERA` |
| host_device_model | string | C类必填 | 宿主机型名称，如 "MAVO Edge 6K" 或 "Canon C400" |
| service_type | string | 是 | 咨询/问题排查/远程协助/投诉 |
| channel | string | 是 | 渠道 (邮件/电话/等) |
| problem_summary | string | 是 | 问题摘要 |
| problem_description | string | 否 | 详细描述 |
| files | file[] | 否 | 附件文件 (图片/视频/PDF) |

```json
// Request
{
  // 客户信息 (可选)
  "customer_name": "Max Mueller",  // 不填显示"匿名客户"
  "customer_contact": "max@example.uk",
  "customer_id": "cust_001",  // 关联已有客户
  "dealer_id": "dealer_proav",  // 经销商ID
  
  // 产品信息 (建议填写)
  "product_id": "prod_edge8k",
  "serial_number": "ME_207890",
  
  // 仅当 product_family = C (电子寻像器) 时必填
  // 示例：如产品为 Eagle HDMI / Eagle SDI / KineMON 等
  "host_device_type": null,  // "KINEFINITY_CAMERA" / "THIRD_PARTY_CAMERA" / null
  "host_device_model": null, // 宿主机型名称，如 "MAVO Edge 6K" 或 "Canon C400"
  
  // 服务内容
  "service_type": "问题排查",  // 咨询/问题排查/远程协助/投诉
  "channel": "邮件",  // 电话/邮件/微信/企业微信/Facebook/在线
  "problem_summary": "拍摄4K 50fps时死机",
  "communication_log": "Q: 客户询问...\nA: 建议..."
}

// 字段说明补充：
// - customer_id: 关联已有客户账户，通常为 account_type = END_USER 或 CORPORATE，用于将工单归档到具体客户名下。
// - dealer_id: 工单的服务经销商。经销商用户登录创建时由系统自动填入当前经销商；
//   市场部创建时可选择服务经销商，默认等于客户的 parent_dealer_id，如需跨区支援可例外指定其他经销商。

// Response
{
  "success": true,
  "data": {
    "id": "inq_20260202_001",
    "ticket_number": "K2602-0001",
    "status": "处理中",
    "created_at": "2026-02-02T10:30:00Z",
    "attachments": [
      {
        "id": 1,
        "file_path": "/uploads/service/image.png",
        "mime_type": "image/png",
        "size": 102400
      }
    ]
  }
}
```

### 3.2 获取咨询工单列表

**GET** `/api/v1/inquiry-tickets`

**权限**: 市场部可看全部，经销商仅看自己的记录

**查询参数**:

| 参数 | 类型 | 说明 |
|-----|------|------|
| page | int | 页码，默认1 |
| page_size | int | 每页数量，默认20 |
| status | string | 状态筛选: 处理中/待客户反馈/已解决/自动关闭/已升级 |
| service_type | string | 服务类型筛选 |
| customer_id | string | 客户筛选 |
| dealer_id | string | 经销商筛选 |
| serial_number | string | 按SN筛选 |
| handler_id | string | 处理人筛选 |
| created_from | date | 创建时间起 |
| created_to | date | 创建时间止 |
| keyword | string | 关键词搜索 |

### 3.3 获取咨询工单详情

**GET** `/api/v1/inquiry-tickets/{id}`

### 3.4 更新咨询工单

**PATCH** `/api/v1/inquiry-tickets/{id}`

```json
// Request (更新状态和处理结果)
{
  "status": "待客户反馈",  // 处理中/待客户反馈/已解决/自动关闭/已升级
  "resolution": "建议升级固件至8025版本",
  "communication_log": "追加沟通内容..."
}
```

### 3.5 升级为RMA返厂单或经销商维修单

**POST** `/api/v1/inquiry-tickets/{id}/upgrade`

```json
// Request - 升级为RMA返厂单
{
  "upgrade_type": "rma",  // rma / svc
  "channel_code": "D",  // D=Dealer, C=Customer, I=Internal
  "issue_category": "稳定性",
  "issue_subcategory": "死机",
  "severity": 2
}

// Response
{
  "success": true,
  "data": {
    "inquiry_ticket_id": "inq_001",
    "inquiry_ticket_number": "K2602-0001",
    "inquiry_ticket_status": "已升级",
    "upgraded_to": {
      "type": "rma",
      "id": "rma_001",
      "ticket_number": "RMA-D-2602-0001"
    }
  }
}

// Request - 升级为经销商维修单
{
  "upgrade_type": "svc",
  "issue_category": "硬件结构",
  "issue_subcategory": "SDI模块"
}

// Response
{
  "success": true,
  "data": {
    "inquiry_ticket_id": "inq_001",
    "inquiry_ticket_number": "K2602-0001",
    "inquiry_ticket_status": "已升级",
    "upgraded_to": {
      "type": "svc",
      "id": "svc_001",
      "ticket_number": "SVC-D-2602-0001"
    }
  }
}
```

### 3.6 重新打开咨询工单

**POST** `/api/v1/inquiry-tickets/{id}/reopen`

> 30天内同一客户同一产品的同问题可重新打开原工单

```json
// Response
{
  "success": true,
  "data": {
    "id": "inq_001",
    "ticket_number": "K2602-0001",
    "status": "处理中",
    "reopened_at": "2026-02-02T14:00:00Z"
  }
}
```

---

## 4. 上下文查询 API

> 支持按客户或按产品SN查询上下文信息，用于服务时快速了解背景

### 4.0 客户账户数据模型（Account / Customer）

上下文查询 API 使用统一的客户账户数据模型，所有对外主体（终端客户、机构大客户、经销商、内部/合作伙伴）均映射为 Customer 对象的一种。

**Customer 对象核心字段**：

| 字段 | 类型 | 说明 |
|------|------|------|
| id | string | 客户唯一ID |
| name | string | 客户名称（个人姓名或公司名） |
| contact | string | 主要联系方式（邮箱/电话等） |
| account_type | string | 账户类型：DEALER / END_USER / CORPORATE / INTERNAL |
| acquisition_channel | string | 获客/购买来源：DIRECT / CHANNEL |
| parent_dealer_id | string/null | 关联经销商ID，仅当 acquisition_channel = CHANNEL 时必填，指向 account_type = DEALER 的账户 |
| service_tier | string | 服务等级：STANDARD / VIP / VVIP / BLACKLIST |
| industry_tags | string[] | 行业标签列表，如 ["RENTAL_HOUSE", "PRODUCTION"] |

> 说明：
> - account_type 用于区分经销商、终端用户、机构大客户和内部/合作伙伴，支撑视图隔离和权限控制。
> - acquisition_channel 表示客户/设备的长期获客渠道，与 RMA 中的 channel_code（本次工单来源）不同。
> - parent_dealer_id 表示该客户的销售归属经销商，经销商视图下「名下客户」即通过此字段确定。
> - service_tier 和 industry_tags 会被 AI 客户画像和统计报表复用。

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
      "account_type": "END_USER",
      "acquisition_channel": "CHANNEL",
      "parent_dealer_id": "dealer_proav",
      "service_tier": "VIP",
      "industry_tags": ["RENTAL_HOUSE"]
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
        "type": "inquiry_ticket",
        "id": "inq_089",
        "number": "K2602-0089",
        "summary": "高帧率设置咨询",
        "status": "已解决",
        "date": "2026-01-15"
      },
      {
        "type": "rma",
        "id": "rma_012",
        "number": "RMA-D-2602-0012",
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

#### 4.1.1 访问控制与经销商视图

- 内部用户（市场部、生产部、研发、管理层）调用 `/context/by-customer` 时，可按权限查看任意客户的上下文信息，用于全局服务分析和质量追踪。
- 经销商用户调用时，系统会自动限制：
  - 仅允许查询 account_type ∈ {END_USER, CORPORATE} 且 parent_dealer_id = 当前经销商.id 的客户；
  - 即只能看到「自己名下客户」及其设备、服务历史，无法访问其他经销商的客户数据。
- 这样设计的必要性：
  - 保护各经销商的客户数据安全，避免渠道之间互相窥视客户名单；
  - 清晰界定服务责任边界，便于统计「本经销商名下客户满意度与故障率」。

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
        "type": "inquiry_ticket",
        "id": "inq_089",
        "number": "K2502-0089",
        "summary": "参数设置咨询",
        "customer_name": "John Smith",  // 显示当时的客户
        "status": "已解决",
        "date": "2025-06-15"
      },
      {
        "type": "rma",
        "id": "rma_156",
        "number": "RMA-C-2509-0156",
        "summary": "SDI模块更换",
        "customer_name": "John Smith",
        "status": "已完成",
        "date": "2025-09-20"
      },
      {
        "type": "inquiry_ticket",
        "id": "inq_201",
        "number": "K2601-0201",
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

## 5. 客户与经销商列表 API

> 提供客户列表和经销商列表视图，基于统一的客户账户模型进行过滤和权限控制。

### 5.1 客户列表（Customers）

**GET** `/api/v1/customers`

**说明**：
- 返回 account_type ∈ {END_USER, CORPORATE} 的客户列表，用于市场部和经销商查看客户档案。

**查询参数**：

| 参数 | 类型 | 说明 |
|------|------|------|
| page | int | 页码，默认1 |
| page_size | int | 每页数量，默认20 |
| account_type | string | 账户类型筛选：END_USER / CORPORATE |
| acquisition_channel | string | 获客渠道：DIRECT / CHANNEL |
| parent_dealer_id | string | 销售归属经销商ID，用于筛选某经销商名下客户 |
| service_tier | string | 服务等级：STANDARD / VIP / VVIP / BLACKLIST |
| industry_tag | string | 行业标签筛选，如 RENTAL_HOUSE、PRODUCTION |
| keyword | string | 关键词搜索（名称、联系信息等） |

**权限与视图规则**：

- 内部用户（市场部、管理层等）：可按上述条件查询所有客户。
- 经销商用户：系统自动追加过滤条件 `parent_dealer_id = 当前经销商.id`，只能看到自己名下客户。

### 5.2 经销商列表（Dealers）

**GET** `/api/v1/dealers`

**说明**：
- 返回 account_type = DEALER 的账户列表，用于市场部管理经销商、在创建工单/RMA 时选择经销商等场景。

**查询参数**：

| 参数 | 类型 | 说明 |
|------|------|------|
| page | int | 页码，默认1 |
| page_size | int | 每页数量，默认20 |
| region | string | 区域筛选，如 Europe、US、APAC 等 |
| level | string | 经销商级别（一级/二级/三级），对应 PRD 中的经销商分级字段 |
| keyword | string | 关键词搜索（经销商名称、联系人等） |

**权限规则**：
- 仅内部用户可访问经销商完整列表；经销商自身仅在与自己相关的下拉选择中被引用，不需要访问全量经销商列表。

---

## 6. RMA返厂单 API

> RMA返厂单用于设备寄回Kinefinity总部维修。
> 工单ID格式：RMA-{C}-YYMM-XXXX（如RMA-D-2602-0001）
> 每台设备必须有独立的RMA号。

### 6.1 创建RMA返厂单（单设备）

**POST** `/api/v1/rma-tickets`

**权限**: 市场部(1.0)、经销商需审批(2.0)

**Content-Type**: `multipart/form-data`

**产品与宿主设备字段规则**：
- `product_id`：引用 `/api/v1/products` 返回的产品ID，可通过其中的 `product_family` 字段判断产品族（A/B/C/D）。
- `host_device_type` / `host_device_model`：
  - 仅当 `product_family = C`（电子寻像器，如 Eagle / KineMON 等）时必填；
  - 用于区分「Kinefinity 相机 + e-Viewfinder」的常规硬件问题，和「第三方相机 + e-Viewfinder」的兼容性排查场景。

| 字段 | 类型 | 必须 | 说明 |
|-----|------|------|------|
| channel_code | string | 是 | D=Dealer, C=Customer, I=Internal |
| problem_description | string | 是 | 问题描述 |
| product_id | int | 否 | 产品ID（从 `/products` 选择） |
| serial_number | string | 否 | 业务序列号 |
| host_device_type | string | C类必填 | 宿主类型：`KINEFINITY_CAMERA` / `THIRD_PARTY_CAMERA` |
| host_device_model | string | C类必填 | 宿主机型名称，如 "MAVO Edge 6K" 或 "Canon C400" |
| files | file[] | 否 | 附件文件 (图片/视频/PDF) |

```json
// Request
{
  // 渠道信息
  "channel_code": "D",  // D=Dealer, C=Customer, I=Internal
  
  // 基础信息
  "issue_type": "客户返修",  // 生产问题/发货问题/客户返修/内部样机
  "issue_category": "稳定性",
  "issue_subcategory": "死机",
  "severity": 3,  // 1/2/3级
  
  // 产品信息（每台设备一个RMA）
  "product_id": "prod_edge8k",
  "serial_number": "ME_207624",
  "firmware_version": "8023",
  
  // 仅当 product_family = C (电子寻像器，如 Eagle/KineMON 等) 时必填
  "host_device_type": null,  // "KINEFINITY_CAMERA" / "THIRD_PARTY_CAMERA" / null
  "host_device_model": null, // 宿主机型，如 "MAVO Edge 6K" 或 "Canon C400"
  
  // 问题描述
  "problem_description": "拍摄时随机死机，约每小时一次",
  "is_warranty": true,
  
  // 关联人员
  "reporter_name": "张先生",
  "customer_id": "cust_001",
  "dealer_id": "dealer_proav",
  
  // 关联咨询工单 (如从咨询工单升级)
  "inquiry_ticket_id": "inq_001"
}

// 字段说明补充：
// - customer_id: 关联已有客户账户，通常为 account_type = END_USER 或 CORPORATE，用于将 RMA 归档到具体客户名下。
// - dealer_id: RMA 的服务经销商。经销商用户登录创建时由系统自动填入当前经销商；
//   市场部创建时可选择服务经销商，默认等于客户的 parent_dealer_id，如需跨区支援可例外指定其他经销商。
// - 当 product_family = "C" (电子寻像器，如 Eagle/KineMON 等) 且 host_device_type = "THIRD_PARTY_CAMERA" 时，后台应将该RMA标记为「兼容性排查」类别，便于研发统计和分析。

// Response
{
  "success": true,
  "data": {
    "id": "rma_20260130_001",
    "ticket_number": "RMA-D-2602-0001",
    "status": "待处理",
    "created_at": "2026-01-30T10:30:00Z",
    "attachments": []
  }
}
```

### 6.2 批量创建RMA返厂单（购物车模式）

**POST** `/api/v1/rma-tickets/batch`

**权限**: 市场部(1.0)、经销商需审批(2.0)

> 经销商可一次添加多台设备申请返厂，提交时系统为每台设备生成独立RMA号

```json
// Request
{
  "channel_code": "D",
  "dealer_id": "dealer_proav",
  "devices": [
    {
      "product_id": "prod_edge8k",
      "serial_number": "ME8K_SN001",
      "problem_description": "死机重启"
    },
    {
      "product_id": "prod_edge6k",
      "serial_number": "ME6K_SN002",
      "problem_description": "SDI无输出"
    },
    {
      "product_id": "prod_terra4k",
      "serial_number": "TER_SN003",
      "problem_description": "开机无反应"
    }
  ]
}

// Response
{
  "success": true,
  "data": {
    "batch_id": "batch_20260202_001",
    "rma_tickets": [
      {
        "id": "rma_001",
        "ticket_number": "RMA-D-2602-0001",
        "serial_number": "ME8K_SN001",
        "product_name": "MAVO Edge 8K"
      },
      {
        "id": "rma_002",
        "ticket_number": "RMA-D-2602-0002",
        "serial_number": "ME6K_SN002",
        "product_name": "MAVO Edge 6K"
      },
      {
        "id": "rma_003",
        "ticket_number": "RMA-D-2602-0003",
        "serial_number": "TER_SN003",
        "product_name": "Terra 4K"
      }
    ],
    "packing_list": {
      "message": "提交成功！请打印以下清单放入箱内",
      "items": [
        { "rma_number": "RMA-D-2602-0001", "barcode": "..." },
        { "rma_number": "RMA-D-2602-0002", "barcode": "..." },
        { "rma_number": "RMA-D-2602-0003", "barcode": "..." }
      ],
      "download_pdf_url": "/api/v1/rma-tickets/batch/batch_20260202_001/packing-list.pdf"
    }
  }
}
```

### 6.3 获取RMA返厂单列表

**GET** `/api/v1/rma-tickets`

**权限**: 按角色过滤可见范围

**查询参数**:

| 参数 | 类型 | 说明 |
|-----|------|------|
| page | int | 页码，默认1 |
| page_size | int | 每页数量，默认20，最大100 |
| sort_by | string | 排序字段: created_at, updated_at, severity |
| sort_order | string | asc/desc |
| **筛选条件** | | |
| channel_code | string | 渠道: D/C/I |
| status | string | 状态筛选，多选用逗号分隔 |
| issue_type | string | 类型筛选 |
| issue_category | string | 大类筛选 |
| severity | int | 等级筛选 |
| product_id | string | 产品筛选 |
| dealer_id | string | 经销商筛选 |
| assigned_to | string | 处理人筛选 |
| is_warranty | bool | 是否在保 |
| created_from | date | 创建时间起 |
| created_to | date | 创建时间止 |
| keyword | string | 关键词搜索 |

```json
// Response
{
  "success": true,
  "data": [
    {
      "id": "rma_001",
      "ticket_number": "RMA-D-2602-0001",
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

### 6.4 获取RMA返厂单详情

**GET** `/api/v1/rma-tickets/{id}`

```json
// Response
{
  "success": true,
  "data": {
    "id": "rma_001",
    "ticket_number": "RMA-D-2602-0001",
    
    // 完整信息
    "channel_code": "D",
    "issue_type": "客户返修",
    "issue_category": "稳定性",
    "issue_subcategory": "死机",
    "severity": 2,
    
    "product": {
      "id": "prod_edge8k",
      "name": "MAVO Edge 8K",
      "series": "Edge",
      "product_family": "A"
    },
    "serial_number": "ME_207624",
    "firmware_version": "8023",
    "hardware_version": "Rev.B",
    
    // 仅当产品族为 C (电子寻像器) 时存在，用于兼容性分析
    "host_device_type": null,   // "KINEFINITY_CAMERA" / "THIRD_PARTY_CAMERA" / null
    "host_device_model": null,  // 宿主机型，如 "MAVO Edge 6K" 或 "Canon C400"
    
    "problem_description": "拍摄时随机死机，约每小时一次",
    "solution_for_customer": "建议升级至8025固件，如问题持续请返修",
    "is_warranty": true,
    
    "repair_content": "更换主板",  // 生产部填写
    "problem_analysis": "主板供电芯片虚焊",  // 生产部填写
    
    "reporter_name": "张先生",
    "customer": { "id": "cust_001", "name": "张先生", "company": "XX影视" },
    "dealer": { "id": "dealer_proav", "name": "ProAV UK" },
    
    "submitted_by": { "id": "usr_001", "name": "Effy" },
    "assigned_to": { "id": "usr_002", "name": "陈高松" },
    
    // 关联咨询工单
    "inquiry_ticket": {
      "id": "inq_001",
      "ticket_number": "K2602-0089"
    },
    
    "payment_channel": "微信",
    "payment_amount": 0,
    "payment_date": null,
    
    "status": "处理中",
    "feedback_date": "2026-01-28",
    "received_date": "2026-01-30",
    "completed_date": null,
    
    "attachments": [...],
    "comments": [...],
    
    "created_at": "2026-01-30T10:30:00Z",
    "updated_at": "2026-01-30T14:20:00Z"
  }
}
```

### 6.5 更新RMA返厂单

**PATCH** `/api/v1/rma-tickets/{id}`

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

### 6.6 分配RMA返厂单

**POST** `/api/v1/rma-tickets/{id}/assign`

**权限**: 市场部

```json
// Request
{
  "assigned_to": "usr_002",
  "repair_priority": "R2",  // R1加急/R2优先/R3标准
  "comment": "请检查主板供电部分"
}
```

### 6.7 审批RMA返厂单（2.0版本）

**POST** `/api/v1/rma-tickets/{id}/approve`

**权限**: 市场部

> 2.0版本：经销商提交的RMA需要Kinefinity审批

```json
// Request
{
  "action": "approve",  // approve / reject
  "comment": "已审核，可以寄回"
}

// Response
{
  "success": true,
  "data": {
    "id": "rma_001",
    "ticket_number": "RMA-D-2602-0001",
    "approval_status": "approved",
    "approved_by": "usr_001",
    "approved_at": "2026-02-02T10:30:00Z"
  }
}
```

### 6.8 删除RMA返厂单

**DELETE** `/api/v1/rma-tickets/{id}`

**权限**: admin

---

## 6.5 返修报价预估 API (Phase 4)

> Phase 4引入：AI故障诊断+配件价格自动计算+客户确认流程

### 6.5.1 AI故障诊断

**POST** `/api/v1/rma-tickets/{id}/ai-diagnosis`

**权限**: 市场部、生产部

```json
// Request
{
  "problem_description": "拍摄4K 50fps时随机死机",
  "firmware_version": "8023",
  "usage_scenario": "长时间4K RAW拍摄"
}

// Response
{
  "success": true,
  "data": {
    "diagnoses": [
      {
        "root_cause": "散热系统异常",
        "probability": 0.72,
        "estimated_parts": [
          { "part_id": "part_015", "name_cn": "风扇模块", "price_usd": 65 }
        ],
        "estimated_labor": 0,
        "estimated_total_usd": 65
      },
      {
        "root_cause": "主板供电不稳",
        "probability": 0.23,
        "estimated_parts": [
          { "part_id": "part_003", "name_cn": "主板", "price_usd": 890 }
        ],
        "estimated_labor": 120,
        "estimated_total_usd": 1010
      }
    ],
    "recommended_diagnosis": 0,
    "note": "以上为AI预估，最终以实际检测为准"
  }
}
```

### 6.5.2 生成维修报价

**POST** `/api/v1/rma-tickets/{id}/estimate`

**权限**: 市场部、生产部

```json
// Request
{
  "currency": "usd",
  "parts": [
    { "part_id": "part_015", "quantity": 1 }
  ],
  "labor_hours": 0,
  "include_shipping": true,
  "shipping_region": "Europe"
}

// Response
{
  "success": true,
  "data": {
    "estimate_id": "est_001",
    "rma_id": "rma_001",
    "currency": "usd",
    "breakdown": {
      "parts": [
        { "part_id": "part_015", "name_cn": "风扇模块", "quantity": 1, "unit_price": 65, "subtotal": 65 }
      ],
      "parts_total": 65,
      "labor": 0,
      "shipping": 29,
      "tax": 0
    },
    "total": 94,
    "valid_until": "2026-02-12",
    "note": "最终费用以实际检测为准，过保设备需客户确认后才能维修"
  }
}
```

### 6.5.3 客户确认报价

**POST** `/api/v1/rma-tickets/{id}/estimate/{estimate_id}/confirm`

**权限**: 市场部（代客户确认）、经销商（代客户确认）

```json
// Request
{
  "confirmed_by": "customer",  // customer / dealer
  "confirmation_method": "邮件",  // 邮件/微信/电话/在线
  "confirmed_at": "2026-02-05T14:30:00Z",
  "customer_notes": "同意维修，请尽快处理"
}

// Response
{
  "success": true,
  "data": {
    "estimate_id": "est_001",
    "status": "confirmed",
    "confirmed_at": "2026-02-05T14:30:00Z",
    "rma_status_updated": "待寄回"
  }
}
```

### 6.5.4 报价超时管理

**GET** `/api/v1/rma-tickets/estimate-timeout`

**权限**: 市场部

**查询参数**:

| 参数 | 类型 | 说明 |
|-----|------|------|
| timeout_level | string | 7d / 14d / 30d |
| page | int | 页码 |

```json
// Response
{
  "success": true,
  "data": [
    {
      "rma_id": "rma_089",
      "ticket_number": "RMA-D-2602-0089",
      "estimate_sent_at": "2026-01-29",
      "days_elapsed": 7,
      "status": "待确认",
      "customer": "张先生",
      "dealer": "ProAV Berlin",
      "last_reminder_sent": "2026-02-03"
    }
  ]
}
```

**POST** `/api/v1/rma-tickets/{id}/estimate-reminder`

```json
// Request
{
  "reminder_type": "7d_first",  // 7d_first / 14d_followup / 30d_final
  "send_to": ["customer_email", "dealer_email"]
}
```

---

## 6.6 物流追踪 API (Phase 4)

> Phase 4引入：快递单号管理、物流状态追踪、自动通知

### 6.6.1 更新快递信息

**PATCH** `/api/v1/rma-tickets/{id}/shipping`

**权限**: 市场部、生产部、经销商

```json
// Request - 客户寄回总部
{
  "direction": "to_kinefinity",  // to_kinefinity / from_kinefinity
  "tracking_method": "customer_fills",  // customer_fills / pending_fill / pickup / collect / bulk
  "tracking_number": "SF1234567890",
  "carrier": "顺丰速运",
  "shipped_at": "2026-02-05",
  "estimated_arrival": "2026-02-07"
}

// Request - 上门取件（无单号）
{
  "direction": "to_kinefinity",
  "tracking_method": "pickup",
  "pickup_scheduled_at": "2026-02-06T14:00:00Z",
  "pickup_address": "北京市朝阳区XXX"
}

// Response
{
  "success": true,
  "data": {
    "rma_id": "rma_001",
    "shipping_updated": true,
    "status_updated": "运输中"
  }
}
```

### 6.6.2 查询物流状态

**GET** `/api/v1/rma-tickets/{id}/shipping-status`

```json
// Response
{
  "success": true,
  "data": {
    "rma_id": "rma_001",
    "direction": "to_kinefinity",
    "tracking_number": "SF1234567890",
    "carrier": "顺丰速运",
    "current_status": "运输中",
    "shipped_at": "2026-02-05",
    "estimated_arrival": "2026-02-07",
    "tracking_history": [
      {
        "time": "2026-02-05 14:30",
        "location": "北京分拨中心",
        "status": "已发出"
      },
      {
        "time": "2026-02-05 10:20",
        "location": "北京XXX营业点",
        "status": "已揽收"
      }
    ]
  }
}
```

### 6.6.3 物流到达通知

**POST** `/api/v1/rma-tickets/{id}/shipping-arrived`

**权限**: 市场部、生产部

```json
// Request
{
  "direction": "to_kinefinity",
  "arrived_at": "2026-02-07T09:30:00Z",
  "received_by": "usr_015",
  "package_condition": "良好",  // 良好/破损/其他
  "notes": "包装完好"
}

// Response - 自动触发通知
{
  "success": true,
  "data": {
    "rma_id": "rma_001",
    "status_updated": "已收到",
    "notifications_sent": [
      { "to": "customer_email", "type": "arrival_confirmation" },
      { "to": "production_team", "type": "device_received" }
    ]
  }
}
```

---

## 6.7 维修异常处理 API (Phase 4)

> Phase 4引入：异常类型定义、三方确认流程、审批权限控制

### 6.7.1 创建维修异常

**POST** `/api/v1/rma-tickets/{id}/exceptions`

**权限**: 生产部

```json
// Request
{
  "exception_type": "cost_increase",  // cost_increase / unfixable / part_unavailable / customer_issue / extended_time / other
  "description": "检测发现主板需更换，费用增加至$890",
  "estimated_additional_cost_usd": 825,
  "estimated_parts": [
    { "part_id": "part_003", "name_cn": "主板", "quantity": 1, "price_usd": 890 }
  ],
  "severity": "medium"  // low / medium / high
}

// Response
{
  "success": true,
  "data": {
    "exception_id": "exc_001",
    "rma_id": "rma_001",
    "status": "待市场部确认",
    "created_at": "2026-02-08T10:30:00Z",
    "notifications_sent": [
      { "to": "market_team", "priority": "high" }
    ]
  }
}
```

### 6.7.2 异常类型定义

| 异常类型 | 代码 | 说明 | 处理流程 |
|---------|------|------|---------|
| 费用增加 | cost_increase | 实际维修费用超出预估 | 生产部→市场部→客户 |
| 无法维修 | unfixable | 设备损坏严重无法修复 | 生产部→市场部→客户（建议换新/报废） |
| 配件缺货 | part_unavailable | 需要的配件暂时无货 | 生产部→市场部→客户（等待/替代方案） |
| 客户原因 | customer_issue | 客户提供信息不全/设备不符 | 市场部→客户 |
| 延期交付 | extended_time | 维修时间超出预期 | 生产部→市场部→客户 |
| 其他异常 | other | 其他特殊情况 | 按实际情况处理 |

### 6.7.3 市场部确认异常

**POST** `/api/v1/rma-tickets/{id}/exceptions/{exception_id}/market-confirm`

**权限**: 市场部

```json
// Request
{
  "action": "forward_to_customer",  // forward_to_customer / handle_internally / reject
  "customer_communication": "已联系客户，建议更换主板，费用$890",
  "proposed_solution": "继续维修",  // continue / cancel / replace_new / scrap
  "notes": "客户为VIP，费用敏感"
}

// Response
{
  "success": true,
  "data": {
    "exception_id": "exc_001",
    "status": "待客户确认",
    "market_confirmed_at": "2026-02-08T14:30:00Z",
    "notifications_sent": [
      { "to": "customer_email", "type": "exception_notification" }
    ]
  }
}
```

### 6.7.4 客户选择处理方案

**POST** `/api/v1/rma-tickets/{id}/exceptions/{exception_id}/customer-decision`

**权限**: 市场部（代客户操作）

```json
// Request
{
  "decision": "continue",  // continue / cancel / replace_new / scrap
  "additional_payment_confirmed": true,
  "customer_notes": "同意更换主板，请继续维修",
  "decided_at": "2026-02-09T10:00:00Z"
}

// Response
{
  "success": true,
  "data": {
    "exception_id": "exc_001",
    "status": "客户已确认-继续维修",
    "rma_status_updated": "维修中",
    "requires_approval": true,  // 费用超$500需审批
    "approval_level": "manager"  // <$100: staff / $100-500: manager / >$500: executive
  }
}
```

### 6.7.5 审批异常处理

**POST** `/api/v1/rma-tickets/{id}/exceptions/{exception_id}/approve`

**权限**: 按费用分级

```json
// Request
{
  "action": "approve",  // approve / reject
  "approver_notes": "同意继续维修，注意控制成本",
  "special_discount": 0  // 特殊折扣金额（如VIP优惠）
}

// Response
{
  "success": true,
  "data": {
    "exception_id": "exc_001",
    "status": "已审批-可继续",
    "approved_by": "usr_001",
    "approved_at": "2026-02-09T14:30:00Z",
    "notifications_sent": [
      { "to": "production_team", "type": "approval_confirmed" }
    ]
  }
}
```

### 6.7.6 获取异常列表

**GET** `/api/v1/rma-exceptions`

**查询参数**:

| 参数 | 类型 | 说明 |
|-----|------|------|
| status | string | pending_market / pending_customer / pending_approval / resolved |
| exception_type | string | 异常类型筛选 |
| severity | string | low / medium / high |

---

## 7. 经销商维修单 API (Dealer Repair)

> 经销商维修单用于记录经销商本地维修，用于配件消耗和库存管理。
> 工单ID格式：SVC-D-YYMM-XXXX（如SVC-D-2602-0001）

### 7.1 创建经销商维修单

**POST** `/api/v1/dealer-repairs`

**权限**: 市场部(1.0)、经销商(2.0)

**Content-Type**: `multipart/form-data`

| 字段 | 类型 | 必须 | 说明 |
|-----|------|------|------|
| dealer_id | string | 否 | 经销商ID |
| product_id | int | 否 | 产品ID |
| serial_number | string | 否 | 序列号 |
| customer_name | string | 是 | 客户姓名 |
| problem_description | string | 是 | 问题描述 |
| files | file[] | 否 | 附件文件 (图片/视频/PDF) |

```json
// Request
{
  "dealer_id": "dealer_proav",
  
  // 产品信息
  "product_id": "prod_edge8k",
  "serial_number": "ME_207890",
  
  // 客户信息
  "customer_name": "Max Mueller",
  "customer_contact": "max@example.uk",
  
  // 维修信息
  "issue_category": "硬件结构",
  "issue_subcategory": "SDI模块",
  "problem_description": "SDI输出无信号",
  "repair_content": "更换SDI模块",
  
  // 使用配件
  "parts_used": [
    { "part_id": "part_001", "quantity": 1 }
  ]
}

// 字段说明补充：
// - dealer_id: 必须指向 account_type = DEALER 的账户。经销商用户创建时系统自动填入当前经销商；
//   市场部代创建时，用于指定承担本次维修、配件消耗和结算的经销商。
// - customer_name / customer_contact: 终端用户的基础信息，便于沟通和后续在客户账户中补录该用户（END_USER/CORPORATE）。
// - 使用配件 parts_used 在前端选择时，应根据产品的 product_family 自动过滤候选列表：
//   - 当产品族为 A（在售电影摄影机，如 Edge/mark2 系列）时，仅允许选择 KineMAG Nano 系列存储卡；
//   - 当产品族为 B（历史机型，如 Terra/MAVO LF 系列）时，仅允许选择 KineMAG SSD (SATA) 系列存储卡；
//   以避免经销商误选卡型导致备件发错。

// Response
{
  "success": true,
  "data": {
    "id": "svc_001",
    "ticket_number": "SVC-D-2602-0001",
    "dealer_id": "dealer_proav",
    "status": "已完成",
    "parts_consumed": [
      { "part_name": "SDI模块", "quantity": 1, "price_usd": 69 }
    ],
    "created_at": "2026-02-02T10:30:00Z"
  }
}
```

### 7.2 获取经销商维修单列表

**GET** `/api/v1/dealer-repairs`

**权限**: 市场部可看全部，经销商仅看自己的

**查询参数**:

| 参数 | 类型 | 说明 |
|-----|------|------|
| dealer_id | string | 经销商筛选 |
| product_id | string | 产品筛选 |
| created_from | date | 创建时间起 |
| created_to | date | 创建时间止 |

### 7.3 获取经销商维修单详情

**GET** `/api/v1/dealer-repairs/{id}`

### 7.4 更新经销商维修单

**PATCH** `/api/v1/dealer-repairs/{id}`

```json
// Request
{
  "repair_content": "更换SDI模块和风扇",
  "parts_used": [
    { "part_id": "part_001", "quantity": 1 },
    { "part_id": "part_025", "quantity": 1 }
  ]
}
```

---

## 8. 工单评论 API

> 三种工单类型都支持评论功能

### 8.1 添加评论

**POST** `/api/v1/inquiry-tickets/{ticket_id}/comments`
**POST** `/api/v1/rma-tickets/{ticket_id}/comments`
**POST** `/api/v1/dealer-repairs/{ticket_id}/comments`

```json
// Request
{
  "content": "已联系客户，约定明天寄回",
  "comment_type": "进度更新",  // 进度更新/内部备注/客户沟通
  "is_internal": false  // true=仅内部可见
}
```

### 8.2 获取评论列表

**GET** `/api/v1/inquiry-tickets/{ticket_id}/comments`
**GET** `/api/v1/rma-tickets/{ticket_id}/comments`
**GET** `/api/v1/dealer-repairs/{ticket_id}/comments`

---

## 9. 工单附件 API

### 9.1 上传附件

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

### 9.2 获取/下载附件

**GET** `/api/v1/attachments/{id}/download`

**权限**: 需有对应工单访问权限

### 9.3 删除附件

**DELETE** `/api/v1/attachments/{id}`

---

## 10. 知识库 API

### 10.0 知识库审计日志

**GET** `/api/v1/knowledge/audit`

**权限**: Admin only

**查询参数**:

| 参数 | 类型 | 说明 |
|-----|------|------|
| page, page_size | int | 分页 |
| operation | string | 操作类型: create/update/delete/import/publish/archive |
| product_line | string | 产品线筛选 |
| category | string | 分类筛选 |
| user_id | int | 操作人筛选 |
| article_title | string | 文章标题搜索 |
| start_date, end_date | date | 时间范围筛选 |
| batch_id | string | 批量操作ID筛选 |

```json
// Response
{
  "success": true,
  "data": [
    {
      "id": 123,
      "operation": "import",
      "operation_detail": "DOCX导入 - 批次a7b8c9d1",
      "article_id": 456,
      "article_title": "MAVO Edge 6K操作说明书: 3.1 基本操作",
      "article_slug": "mavo-edge-6k-manual-3-1-basic-operation",
      "category": "Manual",
      "product_line": "Cinema",
      "product_models": ["MAVO Edge 6K"],
      "changes_summary": null,
      "old_status": null,
      "new_status": "Published",
      "source_type": "Manual",
      "source_reference": "MAVO Edge 6K操作说明书(KineOS8.0)_C34-102-8016_2024.12.19_v0.11_convert.docx",
      "batch_id": "a7b8c9d1-e2f3-4a5b-6c7d-8e9f0a1b2c3d",
      "user_id": 1,
      "user_name": "刘玖龙",
      "user_role": "Admin",
      "created_at": "2026-02-06T12:30:00Z"
    },
    {
      "id": 122,
      "operation": "update",
      "operation_detail": "修改: 内容, 分类",
      "article_id": 455,
      "article_title": "Edge 8K高温环境使用建议",
      "article_slug": "edge-8k-high-temperature-usage",
      "category": "FAQ",
      "product_line": "Cinema",
      "product_models": ["MAVO Edge 8K"],
      "changes_summary": "{\"fields\":[\"内容\",\"分类\"],\"note\":\"更新高温使用建议\"}",
      "old_status": "Published",
      "new_status": "Published",
      "source_type": null,
      "source_reference": null,
      "batch_id": null,
      "user_id": 2,
      "user_name": "编辑员李",
      "user_role": "Editor",
      "created_at": "2026-02-06T14:20:00Z"
    }
  ],
  "meta": {
    "page": 1,
    "page_size": 50,
    "total": 156
  }
}
```

---

### 10.1 创建知识条目

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

### 10.2 获取知识库列表

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

### 10.3 获取知识详情

**GET** `/api/v1/knowledge/{id}`

**权限**: 按visibility和用户角色过滤

### 10.4 更新知识条目

**PATCH** `/api/v1/knowledge/{id}`

### 10.5 发布知识条目

**POST** `/api/v1/knowledge/{id}/publish`

> 默认方案: 编辑者可直接发布，无需审核

### 10.6 获取兼容性列表

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

### 10.7 知识库树形结构

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

### 10.8 知识库审计日志 API

**功能说明**: 为Admin提供知识库写操作的完整审计追踪，包括创建、更新、删除、批量导入等所有修改操作的记录。

**权限要求**: 仅Admin角色可访问

#### 10.8.1 获取审计日志列表

**GET** `/api/v1/knowledge/audit`

**权限**: Admin

**查询参数**:

| 参数 | 类型 | 说明 |
|-----|------|------|
| page | int | 页码，默认1 |
| page_size | int | 每页数量，默认50 |
| operation | string | 操作类型筛选：create/update/delete/import/publish/archive |
| product_line | string | 产品线筛选：Cinema/Cinema 5 Axis/Accessories |
| search | string | 搜索文章标题、操作人姓名 |
| start_date | string | 开始日期（ISO 8601） |
| end_date | string | 结束日期（ISO 8601） |

**Response**:
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "operation": "import",
      "operation_detail": "DOCX导入 - 批次a1b2c3d4",
      "article_id": 157,
      "article_title": "MAVO Edge 6K操作说明书: 1. 产品概述",
      "article_slug": "mavo-edge-6k-manual-chapter-1",
      "category": "Manual",
      "product_line": "Cinema",
      "product_models": ["MAVO Edge 6K"],
      "changes_summary": null,
      "old_status": null,
      "new_status": "Published",
      "source_type": "Manual",
      "source_reference": "MAVO Edge 6K操作说明书(KineOS8.0)_C34-102-8016_2024.12.19_v0.11_convert.docx",
      "batch_id": "a1b2c3d4e5f67890",
      "user_id": 1,
      "user_name": "admin",
      "user_role": "Admin",
      "created_at": "2026-02-06T15:30:00Z"
    },
    {
      "id": 2,
      "operation": "update",
      "operation_detail": "修改: 内容, 状态",
      "article_id": 157,
      "article_title": "MAVO Edge 6K操作说明书: 1. 产品概述（修订版）",
      "article_slug": "mavo-edge-6k-manual-chapter-1",
      "category": "Manual",
      "product_line": "Cinema",
      "product_models": ["MAVO Edge 6K"],
      "changes_summary": "{\"fields\":[\"内容\",\"状态\"],\"note\":\"更新产品规格参数\"}",
      "old_status": "Published",
      "new_status": "Published",
      "source_type": null,
      "source_reference": null,
      "batch_id": null,
      "user_id": 2,
      "user_name": "editor_li",
      "user_role": "Editor",
      "created_at": "2026-02-06T16:45:00Z"
    }
  ],
  "meta": {
    "page": 1,
    "page_size": 50,
    "total": 156
  }
}
```

#### 10.8.2 获取审计统计信息

**GET** `/api/v1/knowledge/audit/stats`

**权限**: Admin

**Response**:
```json
{
  "success": true,
  "data": {
    "total_operations": 156,
    "unique_users": 3,
    "batch_imports": 2,
    "operations_by_type": {
      "create": 12,
      "update": 8,
      "delete": 0,
      "import": 136,
      "publish": 0,
      "archive": 0
    },
    "recent_activity": [
      {
        "date": "2026-02-06",
        "count": 145
      },
      {
        "date": "2026-02-05",
        "count": 11
      }
    ]
  }
}
```

#### 10.8.3 审计日志记录规则

**自动记录的操作**:

| 操作类型 | 触发时机 | 记录内容 |
|---------|---------|----------|
| **create** | POST `/api/v1/knowledge` 成功 | 文章基本信息、状态、创建人 |
| **update** | PATCH `/api/v1/knowledge/:id` 成功 | 修改字段列表、状态变化、修改人 |
| **delete** | DELETE `/api/v1/knowledge/:id` 成功 | 文章快照、删除人 |
| **import** | POST `/api/v1/knowledge/import/docx` 成功 | 批次ID、源文件、导入数量 |
| **publish** | 状态从Draft变为Published | 状态变化、发布人 |
| **archive** | 状态变为Archived | 状态变化、归档人 |

**批量操作追踪**:
- 所有批量导入操作（DOCX/PDF）使用统一的`batch_id`关联
- `batch_id`格式：16字符UUID片段（如`a1b2c3d4e5f67890`）
- 可通过`batch_id`筛选查看同一批次的所有文章

**日志保留策略**:
- 永久保留所有审计日志
- 建议按季度归档历史数据
- 支持按日期范围导出CSV/Excel

---

## 10.9 VoC管理 API (Voice of Customer - Phase 7)

> Phase 7引入：客户反馈→产品改进的闭环管理

### 10.8.1 VoC类型定义

| 类型 | 代码 | 说明 | 来源 |
|-----|------|------|------|
| Bug流 | bug | 产品缺陷、功能错误 | 工单系统自动标记 |
| Wishlist流 | wishlist | 功能期望、改进建议 | 客户主动提出或从工单提取 |
| 原声流 | voice | 客户原始反馈记录 | 邮件、社交媒体、调研 |

### 10.8.2 创建VoC条目

**POST** `/api/v1/voc`

**权限**: 市场部、研发部

```json
// Request - Bug类型
{
  "voc_type": "bug",
  "title": "Edge 8K录制ProRes时码跳帧",
  "description": "使用ProRes编码录制时，时码偶尔出现跳帧现象",
  "product_ids": ["prod_edge8k"],
  "source": "issue",  // issue / email / social / survey / other
  "source_ref_id": "inq_089",  // 关联工单ID
  "reporter": {
    "customer_id": "cust_001",
    "customer_name": "张先生",
    "customer_tier": "VIP"
  },
  "affected_firmware": "8023",
  "reproducible": true,
  "severity": "medium",  // low / medium / high / critical
  "tags": ["时码", "ProRes", "Edge 8K"]
}

// Request - Wishlist类型
{
  "voc_type": "wishlist",
  "title": "希望支持BRAW格式录制",
  "description": "客户希望Edge系列能支持Blackmagic RAW格式",
  "product_ids": ["prod_edge8k", "prod_edge6k"],
  "source": "email",
  "priority": "P3",  // P1高/P2中/P3低
  "business_value": "可吸引BMPCC用户转换至Kinefinity",
  "estimated_demand": "多个客户提及",
  "tags": ["编码格式", "BRAW", "功能请求"]
}

// Request - 原声类型
{
  "voc_type": "voice",
  "title": "客户对Eagle HDMI稳定性的积极反馈",
  "original_content": "客户在Facebook发帖：Eagle HDMI与FX6搭配非常稳定...",
  "source": "social",
  "platform": "Facebook",
  "sentiment": "positive",  // positive / neutral / negative
  "url": "https://facebook.com/...",
  "captured_at": "2026-02-01"
}

// Response
{
  "success": true,
  "data": {
    "id": "voc_001",
    "voc_number": "VOC-2602-001",
    "voc_type": "bug",
    "status": "new",
    "created_at": "2026-02-03T10:30:00Z"
  }
}
```

### 10.8.3 获取VoC列表

**GET** `/api/v1/voc`

**查询参数**:

| 参数 | 类型 | 说明 |
|-----|------|------|
| voc_type | string | bug / wishlist / voice |
| status | string | new / reviewing / planned / in_progress / resolved / wont_fix |
| product_id | string | 产品筛选 |
| priority | string | P1 / P2 / P3 |
| severity | string | low / medium / high / critical |
| tags | string | 标签筛选，逗号分隔 |
| assigned_to | string | 处理人筛选 |
| keyword | string | 关键词搜索 |

```json
// Response
{
  "success": true,
  "data": [
    {
      "id": "voc_001",
      "voc_number": "VOC-2602-001",
      "voc_type": "bug",
      "title": "Edge 8K录制ProRes时码跳帧",
      "status": "reviewing",
      "priority": null,
      "severity": "medium",
      "product_names": ["MAVO Edge 8K"],
      "reporter_name": "张先生",
      "assigned_to": { "id": "usr_010", "name": "研发-李工" },
      "votes": 5,
      "created_at": "2026-02-03",
      "updated_at": "2026-02-05"
    }
  ],
  "meta": {
    "total": 156,
    "page": 1,
    "page_size": 20
  }
}
```

### 10.8.4 VoC详情

**GET** `/api/v1/voc/{id}`

```json
// Response
{
  "success": true,
  "data": {
    "id": "voc_001",
    "voc_number": "VOC-2602-001",
    "voc_type": "bug",
    "title": "Edge 8K录制ProRes时码跳帧",
    "description": "使用ProRes编码录制时，时码偶尔出现跳帧现象",
    "status": "planned",
    "priority": "P2",
    "severity": "medium",
    "products": [
      { "id": "prod_edge8k", "name": "MAVO Edge 8K" }
    ],
    "reporter": {
      "customer_id": "cust_001",
      "customer_name": "张先生",
      "customer_tier": "VIP"
    },
    "source": "issue",
    "source_ref": {
      "type": "inquiry_ticket",
      "id": "inq_089",
      "number": "K2602-0089"
    },
    "assigned_to": {
      "id": "usr_010",
      "name": "研发-李工",
      "department": "研发部"
    },
    "planned_release": "v8026",
    "votes": 5,
    "voters": [
      { "customer_id": "cust_001", "name": "张先生", "voted_at": "2026-02-03" },
      { "customer_id": "cust_015", "name": "王导演", "voted_at": "2026-02-04" }
    ],
    "related_vocs": [
      { "id": "voc_012", "title": "ProRes编码偶现花屏", "similarity": 0.75 }
    ],
    "timeline": [
      { "time": "2026-02-03", "action": "created", "by": "usr_001" },
      { "time": "2026-02-04", "action": "reviewed", "by": "usr_010", "note": "已复现，排查中" },
      { "time": "2026-02-05", "action": "status_changed", "from": "reviewing", "to": "planned" }
    ],
    "created_at": "2026-02-03T10:30:00Z",
    "updated_at": "2026-02-05T14:20:00Z"
  }
}
```

### 10.8.5 更新VoC状态

**PATCH** `/api/v1/voc/{id}`

**权限**: 研发部、市场部

```json
// Request - 研发部更新
{
  "status": "in_progress",
  "assigned_to": "usr_010",
  "priority": "P1",
  "planned_release": "v8026",
  "internal_notes": "已定位问题，预计2周内修复"
}

// Request - 标记为不修复
{
  "status": "wont_fix",
  "resolution": "该功能设计如此，不属于Bug",
  "notify_reporter": true
}
```

### 10.8.6 VoC投票

**POST** `/api/v1/voc/{id}/vote`

**权限**: 所有登录用户

```json
// Request
{
  "voter_id": "cust_015",  // 可选，不填则使用当前用户
  "voter_name": "王导演"
}

// Response
{
  "success": true,
  "data": {
    "voc_id": "voc_001",
    "votes": 6,
    "voted_at": "2026-02-06T10:30:00Z"
  }
}
```

**DELETE** `/api/v1/voc/{id}/vote` - 取消投票

### 10.8.7 VoC关联开发

**POST** `/api/v1/voc/{id}/link-development`

**权限**: 研发部

```json
// Request
{
  "development_type": "firmware",  // firmware / feature / fix
  "version": "v8026",
  "jira_id": "KINE-1234",  // 可选，关联Jira
  "estimated_release_date": "2026-03-15"
}
```

### 10.8.8 发布通知相关客户

**POST** `/api/v1/voc/{id}/notify-release`

**权限**: 市场部

```json
// Request
{
  "release_version": "v8026",
  "release_notes": "已修复ProRes时码跳帧问题",
  "notify_targets": "voters_and_reporter"  // voters_and_reporter / all_interested
}

// Response
{
  "success": true,
  "data": {
    "notifications_sent": 6,
    "recipients": [
      { "customer_id": "cust_001", "name": "张先生", "method": "邮件" }
    ]
  }
}
```

### 10.8.9 VoC统计

**GET** `/api/v1/voc/stats`

```json
// Response
{
  "success": true,
  "data": {
    "by_type": {
      "bug": 45,
      "wishlist": 89,
      "voice": 23
    },
    "by_status": {
      "new": 12,
      "reviewing": 15,
      "planned": 34,
      "in_progress": 28,
      "resolved": 56,
      "wont_fix": 11
    },
    "top_voted": [
      { "id": "voc_023", "title": "支持BRAW格式", "votes": 45 },
      { "id": "voc_089", "title": "增加LUT预览", "votes": 38 }
    ],
    "recent_resolved": [
      { "id": "voc_156", "title": "ProRes时码问题", "resolved_in": "v8026" }
    ]
  }
}
```

---

## 11. 产品 API

### 11.1 获取产品列表

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

### 11.2 获取产品详情

**GET** `/api/v1/products/{id}`

---

## 12. 客户 API

### 12.1 创建客户

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

### 12.2 获取客户列表

**GET** `/api/v1/customers`

### 12.3 获取/更新客户详情

**GET/PATCH** `/api/v1/customers/{id}`

---

## 13. 经销商 API

### 13.1 获取经销商列表

**GET** `/api/v1/dealers`

```json
// Response
{
  "success": true,
  "data": [
    {
      "id": "dealer_proav",
      "name": "ProAV London",
      "code": "PROAV",
      "dealer_type": "一级代理",
      "region": "海外",
      "country": "英国",
      "contact_info": {
        "contact_person": "Nick",
        "email": "nick@proav.uk",
        "phone": "+49..."
      },
      "service_capabilities": {
        "can_repair": true,
        "repair_level": "全面维修"  // 简单维修/中级维修/全面维修
      }
    }
  ]
}
```

### 13.2 经销商返修记录

**GET** `/api/v1/dealers/{id}/issues`

**权限**: 市场部、该经销商自己

---

## 14. 维修配件 API

> 配件价格查询、库存管理和报价计算

### 14.1 获取配件分类列表

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

### 14.2 获取配件价格列表

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

### 14.3 获取配件详情

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

### 14.4 Edge前部维修方案查询

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

### 14.5 生成维修报价预估

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

### 14.6 经销商配件库存

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

### 14.7 经销商配件补货申请

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

## 15. 生产问题反馈 API (F0)

### 15.1 创建生产反馈

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

### 15.2 获取生产反馈列表

**GET** `/api/v1/production-feedbacks`

---

## 16. 统计分析 API

### 16.1 工单统计概览

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

### 16.2 趋势统计

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

### 16.3 产品问题分布

**GET** `/api/v1/stats/by-product`

### 16.4 问题类别统计

**GET** `/api/v1/stats/by-category`

### 16.5 经销商统计

**GET** `/api/v1/stats/by-dealer`

### 16.6 地区统计

**GET** `/api/v1/stats/by-region`

> 默认方案: 返回按地区聚合的数据，前端可选择是否用热力图展示

### 16.7 处理效率统计

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

### 16.8 导出报表

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

### 16.9 定时报表

**POST** `/api/v1/stats/scheduled-reports`

> 默认方案: Phase 1 不实现，后续版本考虑

---

## 17. Bokeh智能助手 API (Phase 6)

> Phase 6引入：知识库智能检索 + AI辅助问答系统，统一命名为"Bokeh"

### 17.1 智能问答（Bokeh Chat）

**POST** `/api/v1/bokeh/chat`

**权限**: 按用户角色决定检索范围

```json
// Request
{
  "question": "MAVO Edge 8K 录制时突然停止是什么原因？",
  "context": {
    "product_id": "prod_edge8k",  // 可选，限定产品范围
    "include_issues": true,  // 是否检索历史工单
    "include_kb": true  // 是否检索知识库
  },
  "session_id": "bokeh_session_001"  // 可选，多轮对话时传入
}

// Response
{
  "success": true,
  "data": {
    "session_id": "bokeh_session_001",
    "answer": "根据历史工单 [K2602-0001]，MAVO Edge 8K 录制中断通常有以下原因：\n1. SSD 写入速度不足\n2. 高温保护触发\n3. 电池电量不足\n\n建议排查步骤...",
    "references": [
      {
        "type": "knowledge",
        "id": "kb_023",
        "title": "SSD兼容性指南",
        "snippet": "推荐使用Samsung T7...",
        "relevance_score": 0.92
      },
      {
        "type": "issue",
        "id": "issue_847",
        "rma_number": "RMA-C-2512-0047",
        "snippet": "客户反馈录制中断，更换SSD后解决",
        "relevance_score": 0.85
      }
    ],
    "suggested_actions": [
      { "action": "create_issue", "label": "创建工单" },
      { "action": "view_knowledge", "id": "kb_023", "label": "查看知识库" }
    ],
    "confidence": 0.88
  }
}
```

### 17.2 引导式故障排查（Bokeh Troubleshoot）

**POST** `/api/v1/bokeh/troubleshoot`

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
      { "action": "create_issue", "label": "创建RMA返厂单" }
    ]
  }
}
```

### 17.3 工单智能分析

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

### 17.4 智能查询建议

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

### 17.5 自动标签建议

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

## 18. 系统管理 API

### 18.1 用户管理

**GET/POST/PATCH/DELETE** `/api/v1/admin/users`

**权限**: admin

### 18.2 字典数据

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

### 18.3 工单编号规则

**GET** `/api/v1/system/ticket-rules`

```json
// Response
{
  "success": true,
  "data": {
    "ticket_types": [
      {
        "type": "inquiry",
        "format": "KYYMM-XXXX",
        "example": "K2602-0001",
        "description": "咨询工单"
      },
      {
        "type": "rma",
        "format": "RMA-{C}-YYMM-XXXX",
        "example": "RMA-D-2602-0015",
        "description": "RMA返厂单，{C}=D(经销商)/C(直客)"
      },
      {
        "type": "dealer_repair",
        "format": "SVC-D-YYMM-XXXX",
        "example": "SVC-D-2602-0001",
        "description": "经销商维修单"
      }
    ],
    "serial_number_rules": {
      "format": "YYMM-XXXX",
      "yymm_description": "年份后两位+月份，如2602=2026年2月",
      "sequence_description": "0001-9999(十进制), A000-FFFF(16进制)",
      "reset_policy": "每月重置",
      "max_capacity": 65535
    }
  }
}
```

---

## 19. 通知 API

> 默认方案: Phase 1 实现基础通知，不含推送

### 19.1 获取通知列表

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

### 19.2 标记已读

**POST** `/api/v1/notifications/mark-read`

```json
// Request
{
  "notification_ids": ["notif_001", "notif_002"]
}
```

---

## 20. 待确认问题汇总

> **注**：以下待确认问题已在PRD第4章明确，此处保留历史记录

| 编号 | 问题 | 决策（PRD 4.1） | 影响API |
|-----|------|---------|--------|
| Q5 | 图片/视频大小限制 | 图片6MB/张，视频50MB/个 | `POST /attachments` |
| Q6 | 是否自动压缩 | Backlog | 附件上传 |
| Q7 | 是否用对象存储 | 暂不使用，本地SSD | 附件存储 |
| Q8 | 知识库组织方式 | 混合模式（产品+分类） | `GET /knowledge/tree` |
| Q9 | 知识库版本控制 | 不需要 | 知识库API |
| Q10 | 知识库审核流程 | 需要（含推送提醒） | `POST /knowledge/{id}/publish` |
| Q11 | 知识库内容格式 | Markdown/富文本 | 知识库创建/编辑 |
| Q13 | 经销商独立入口 | 共用入口 | `POST /auth/login` |
| Q14 | 经销商能否创建工单 | 可以 | `POST /inquiry-tickets`, `POST /rma-tickets` |
| Q2 | 定时邮件推送 | 需要（Phase 8实现） | `POST /stats/scheduled-reports` |
| Q17 | 推送通知 | 需要（Phase 8实现） | 通知API |

---

## 21. API 版本规划

> 根据PRD第5章版本规划调整API开发路线图

### Phase 1: 三层工单系统 ✅ **已完成**

**API范围**：
- 认证API (2.1-2.5)
- 产品列表API (2.5)
- 咨询工单API (3.x) - 完整CRUD+升级
- 上下文查询API (4.1-4.2)
- 客户/经销商列表API (5.1-5.2)
- RMA返厂单API (6.1-6.8) - 单/批量创建
- 经销商维修单API (7.x)
- 工单评论API (8.x)
- 工单附件API (9.x) - 本地存储，50MB限制
- 系统字典API (18.2-18.3)

**交付物**：
- 三种工单类型完整API
- 基础认证与权限
- 附件上传（本地存储）

---

### Phase 2: 核心服务流程完善 🚧 **进行中**

**API范围**：
- 工单协作增强
  - 评论@提醒功能
  - 状态流转可视化
  - 附件批量管理
- 客户与设备管理
  - 客户档案完善API
  - 设备资产管理API
  - 客户-设备关联
- 统计与报表
  - 统计大盘API (16.1-16.2)
  - 多维度筛选查询
  - Excel导出API (16.8)
  - 预置查询模板

**预计时间**：4-6周

---

### Phase 3: 知识库体系 📚

**API范围**：
- 知识库CRUD API (10.1-10.7)
  - Markdown/富文本支持
  - 混合组织模式
  - 权限分级（Public/Dealer/Internal/Department）
  - WIKI式浏览
  - 全文搜索
- 知识审核流程API
  - 审核工作流（草稿→待审核→已发布）
  - 审核推送通知
- 工单-知识联动API

**预计时间**：4-6周

---

### Phase 4: 返修闭环管理 🔄

**API范围**：
- **返修报价预估API** (6.5.x)
  - AI故障诊断
  - 配件价格自动计算
  - 预估价格生成
  - 客户确认流程
  - 超时提醒机制（7/14/30天）
- **物流追踪API** (6.6.x)
  - 快递单号管理（5种模式）
  - 物流状态追踪
  - 到达通知
- **维修异常处理API** (6.7.x)
  - 异常类型定义（6种）
  - 三方确认流程（生产部→市场部→客户）
  - 分级审批（<$100/$100-500/>$500）
- **维修配件管理API** (14.x)
  - 配件目录
  - 配件报价
  - 维修PI生成

**预计时间**：6-8周

---

### Phase 5: 经销商配件与结算 💰

**API范围**：
- **配件库存管理API** (14.6)
  - 库存初始化
  - 维修工单自动扣减
  - 库存预警
  - 库存变动记录
- **补货管理API** (14.7)
  - 补货申请
  - 欠款检查机制（<30天警告/≥30天阻止）
  - 市场部审批
  - 紧急例外审批
- **结算管理API**
  - 定期结算（月度/季度）
  - 对账单生成
  - 欠款催收

**预计时间**：4-6周

---

### Phase 6: Bokeh智能助手（第一期）🤖

**API范围**：
- **知识库智能检索API** (17.1)
  - 向量化知识库
  - 语义搜索
  - 智能问答（Bokeh Chat）
  - 引导式故障排查（Bokeh Troubleshoot）
- **工单智能辅助API** (17.3-17.5)
  - 工单智能分类
  - 优先级自动建议
  - 智能回复建议
  - 知识点自动提取
- **故障诊断API** (6.5.1)
  - AI故障原因诊断
  - 维修方案推荐
  - 配件需求预测

**预计时间**：6-8周

---

### Phase 7: VoC产品进化池 🌱

**API范围**：
- **VoC管理API** (10.8.x)
  - Bug流管理
  - Wishlist流管理
  - 原声流管理
  - VoC投票系统
- **研发协同API**
  - VoC关联开发
  - 版本规划关联
  - 发布推送给相关客户

**预计时间**：4周

---

### Phase 8: 洞察与报告 📊

**API范围**：
- **质量仪表盘API**
  - 问题趋势分析 (16.2)
  - 高频问题识别
  - 批次问题预警
  - 产品健康度评分
- **性能指标API** (16.7)
  - TAT分析
  - SLA达标率
  - 客户满意度
  - 地区热力图 (16.6)
- **定期报告API**
  - 自动报告生成
  - 富文本HTML邮件推送
  - 报告订阅管理

**预计时间**：4-6周

---

### Phase 9: iOS移动端 API 📱

**API优化**：
- 移动端适配（简化返回数据）
- 离线草稿同步API
- APNs推送注册与管理
- 快速操作API（快速创建、状态更新）

**预计时间**：8-10周（含iOS开发）

---

### Phase 10: Bokeh智能助手（第二期）🚀

**API范围**：
- 高频问题自动识别
- 相似工单智能推荐
- 补货量智能建议
- 邮件/通知自动起草
- 报告智能摘要

**预计时间**：4-6周

---

### Phase 11: Bokeh智能助手（第三期）💡

**API范围**：
- 处理人智能分配
- 知识条目更新建议
- 自然语言查询
- 客户情绪识别
- 结算异常检测
- 维修记录规范化
- 多语言翻译

**预计时间**：4-6周

---

### Backlog（待规划）

- 自定义报表功能
- 图片/视频自动压缩
- 对象存储迁移（OSS/S3）
- 官网集成（知识库API对外开放）
- 物流API对接（自动追踪）
- 信用额度管理
- 多语言支持（i18n）

---

## 19. 智能中心与系统看板 API 🧠

> 管理全系统 AI 服务商、模型路由参数以及服务器运行状态监控。
> 基准路径: `/api/admin`

### 19.1 获取系统配置与服务商

**GET** `/api/admin/settings`

**权限**: Admin

**Response**:
```json
{
  "success": true,
  "data": {
    "settings": {
      "id": 1,
      "system_name": "Longhorn System",
      "ai_enabled": true,
      "ai_work_mode": false,
      "ai_allow_search": false,
      "updated_at": "2026-02-06T10:00:00Z"
    },
    "providers": [
      {
        "name": "DeepSeek",
        "base_url": "https://api.deepseek.com",
        "chat_model": "deepseek-chat",
        "reasoner_model": "deepseek-reasoner",
        "vision_model": "deepseek-chat",
        "is_active": true,
        "temperature": 0.7
      }
    ]
  }
}
```

### 19.2 更新系统配置与服务商

**POST** `/api/admin/settings`

**权限**: Admin

**Request Body**:
```json
{
  "settings": {
    "system_name": "KineCore Service",
    "ai_enabled": true,
    "ai_work_mode": true
  },
  "providers": [
    {
      "name": "Gemini",
      "api_key": "sk-...",
      "base_url": "...",
      "chat_model": "gemini-1.5-flash",
      "is_active": true
    }
  ]
}
```

### 19.3 删除服务商

**POST** `/api/admin/providers/delete`

**权限**: Admin

> 注意：仅支持删除 `is_active = 0` 的非激活服务商。

**Request**: `{ "name": "GEMINI_OLD" }`

### 19.4 系统运行状态 (Health Check)

**GET** `/api/admin/stats/system`

**权限**: Admin

**Response**:
```json
{
  "success": true,
  "data": {
    "uptime": 123456,
    "cpu_load": 0.45,
    "mem_used": 4294967296,
    "mem_total": 17179869184,
    "platform": "darwin 23.0.0"
  }
}
```

### 19.5 AI 使用统计

**GET** `/api/admin/stats/ai`

**权限**: Admin

**Response**:
```json
{
  "success": true,
  "data": {
    "daily_usage": [
      { "date": "2026-02-01", "tokens": 15000 },
      { "date": "2026-02-02", "tokens": 22000 }
    ],
    "total_tokens": 37000,
    "estimated_cost_usd": "0.0074"
  }
}
```

---

**下一步**: 确认待确认问题后，可开始代码实现。
