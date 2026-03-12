# 服务配件SKU定价

<cite>
**本文档引用的文件**
- [Service_Parts_SKU_Pricing.md](file://docs/Service_Parts_SKU_Pricing.md)
- [Service_PRD.md](file://docs/Service_PRD.md)
- [Service_API.md](file://docs/Service_API.md)
- [parts.js](file://server/service/routes/parts.js)
- [dealer-repairs.js](file://server/service/routes/dealer-repairs.js)
- [007_parts_inventory.sql](file://server/service/migrations/007_parts_inventory.sql)
- [seed_eagle_parts.sql](file://server/service/seeds/seed_eagle_parts.sql)
- [CustomerContextSidebar.tsx](file://client/src/components/Service/CustomerContextSidebar.tsx)
- [ServiceRecordCreatePage.tsx](file://client/src/components/ServiceRecords/ServiceRecordCreatePage.tsx)
- [dealer-inventory.js](file://server/service/routes/dealer-inventory.js)
- [DealerRepairCreatePage.tsx](file://client/src/components/DealerRepairs/DealerRepairCreatePage.tsx)
- [DealerRepairDetailPage.tsx](file://client/src/components/DealerRepairs/DealerRepairDetailPage.tsx)
- [DealerRepairListPage.tsx](file://client/src/components/DealerRepairs/DealerRepairListPage.tsx)
- [proforma-invoice.js](file://server/service/routes/proforma-invoice.js)
</cite>

## 更新摘要
**所做更改**
- 新增返修报价系统相关API文档和实现
- 扩展配件管理功能，包括经销商库存和补货申请
- 增强报价计算引擎，支持多种维修场景
- 完善前端组件，支持返修报价的完整工作流程

## 目录
1. [简介](#简介)
2. [项目结构](#项目结构)
3. [核心组件](#核心组件)
4. [架构概览](#架构概览)
5. [详细组件分析](#详细组件分析)
6. [返修报价系统](#返修报价系统)
7. [配件库存管理](#配件库存管理)
8. [依赖关系分析](#依赖关系分析)
9. [性能考虑](#性能考虑)
10. [故障排除指南](#故障排除指南)
11. [结论](#结论)

## 简介

服务配件SKU定价系统是Kinefinity产品服务闭环系统的重要组成部分，负责管理维修配件的SKU编码、价格体系和报价计算。该系统基于标准化的文档规范，为前端应用提供实时的配件价格数据，支持经销商和内部团队的维修服务流程。

系统采用三层工单模型，涵盖咨询工单、RMA返厂单和经销商维修单三种服务场景，为每个工单类型提供完整的配件定价和报价功能。新增的返修报价系统进一步完善了整个服务生态，实现了从配件查询到维修报价的全流程管理。

## 项目结构

```mermaid
graph TB
subgraph "文档层"
PRD[Service_PRD.md]
Pricing[Service_Parts_SKU_Pricing.md]
API[Service_API.md]
end
subgraph "服务端"
PartsRoute[parts.js]
DealerRepairs[dealer-repairs.js]
DealerInventory[dealer-inventory.js]
ProformaInvoice[proforma-invoice.js]
Migrations[007_parts_inventory.sql]
Seeds[seed_eagle_parts.sql]
end
subgraph "客户端"
CustomerSidebar[CustomerContextSidebar.tsx]
ServiceRecord[ServiceRecordCreatePage.tsx]
DealerRepairCreate[DealerRepairCreatePage.tsx]
DealerRepairDetail[DealerRepairDetailPage.tsx]
DealerRepairList[DealerRepairListPage.tsx]
end
PRD --> PartsRoute
Pricing --> PartsRoute
API --> PartsRoute
PartsRoute --> CustomerSidebar
DealerRepairs --> DealerRepairCreate
DealerRepairs --> DealerRepairDetail
DealerRepairs --> DealerRepairList
DealerInventory --> ProformaInvoice
Migrations --> PartsRoute
Seeds --> PartsRoute
```

**图表来源**
- [Service_PRD.md](file://docs/Service_PRD.md#L1-L800)
- [Service_Parts_SKU_Pricing.md](file://docs/Service_Parts_SKU_Pricing.md#L1-L233)
- [parts.js](file://server/service/routes/parts.js#L1-L659)
- [dealer-repairs.js](file://server/service/routes/dealer-repairs.js#L1-L472)

**章节来源**
- [Service_PRD.md](file://docs/Service_PRD.md#L1-L800)
- [Service_Parts_SKU_Pricing.md](file://docs/Service_Parts_SKU_Pricing.md#L1-L233)

## 核心组件

### 配件目录管理

系统提供完整的配件目录管理功能，包括：

- **SKU编码规则**：统一的S+物料ID格式
- **价格体系**：支持CNY、USD、EUR三种货币
- **分类管理**：按产品线和功能分类组织配件
- **兼容性管理**：基于产品模型的配件适用性

### 报价计算引擎

提供智能的报价计算功能：

- **快速估算**：基于规则引擎的初步报价
- **详细报价**：包含配件、人工、运费的完整报价
- **汇率转换**：支持多币种报价
- **折扣管理**：支持批量折扣和促销活动

### 经销商库存管理

集成经销商库存系统：

- **实时库存查询**：支持低库存预警
- **补货订单**：自动化补货流程
- **月结结算**：定期财务结算功能

**章节来源**
- [parts.js](file://server/service/routes/parts.js#L16-L180)
- [parts.js](file://server/service/routes/parts.js#L526-L607)

## 架构概览

```mermaid
sequenceDiagram
participant Client as 客户端应用
participant API as API服务器
participant DB as 数据库
participant Pricing as 定价引擎
Client->>API : 获取配件价格列表
API->>DB : 查询配件目录
DB-->>API : 返回配件数据
API->>Pricing : 计算汇率和税费
Pricing-->>API : 返回最终价格
API-->>Client : 返回格式化后的价格数据
Note over Client,Pricing : 支持多币种实时汇率计算
```

**图表来源**
- [parts.js](file://server/service/routes/parts.js#L16-L108)
- [parts.js](file://server/service/routes/parts.js#L526-L607)

系统采用RESTful API设计，所有配件相关操作都通过HTTP接口提供。前端组件通过标准的GET/POST请求与后端交互，实现数据的实时同步。

## 详细组件分析

### 配件目录API

```mermaid
classDiagram
class PartsCatalog {
+int id
+string part_number
+string part_name
+string category
+float retail_price
+float dealer_price
+array applicable_products
+boolean is_active
+formatPart() object
}
class Quotation {
+int id
+string quotation_number
+int issue_id
+float parts_total
+float labor_cost
+float shipping_cost
+float total_amount
+string currency
+string status
+generateQuotationNumber() string
}
class LaborRate {
+string rate_type
+string region
+float hourly_rate
}
PartsCatalog --> Quotation : "被引用"
Quotation --> LaborRate : "使用"
```

**图表来源**
- [parts.js](file://server/service/routes/parts.js#L609-L655)

配件目录API提供以下核心功能：

1. **列表查询**：支持分页、搜索、分类筛选
2. **详情获取**：返回完整的配件信息和价格数据
3. **创建管理**：管理员权限的配件创建和更新
4. **价格计算**：实时计算配件价格和税费

**章节来源**
- [parts.js](file://server/service/routes/parts.js#L16-L180)
- [parts.js](file://server/service/routes/parts.js#L182-L386)

### 报价计算流程

```mermaid
flowchart TD
Start([开始报价计算]) --> ValidateInput["验证输入参数"]
ValidateInput --> InputValid{"输入有效?"}
InputValid --> |否| ReturnError["返回错误信息"]
InputValid --> |是| LoadParts["加载配件信息"]
LoadParts --> CalcParts["计算配件总价"]
CalcParts --> CalcLabor["计算人工费用"]
CalcLabor --> CalcShipping["计算运费"]
CalcShipping --> CalcTotal["计算总费用"]
CalcTotal --> ApplyDiscount["应用折扣"]
ApplyDiscount --> ReturnQuote["返回报价结果"]
ReturnError --> End([结束])
ReturnQuote --> End
```

**图表来源**
- [parts.js](file://server/service/routes/parts.js#L526-L607)

报价计算流程包含以下步骤：

1. **参数验证**：检查必需参数的有效性
2. **配件加载**：从数据库获取配件详细信息
3. **成本计算**：计算配件、人工、运费的总成本
4. **折扣应用**：应用可用的折扣和优惠
5. **结果返回**：返回详细的报价分解

**章节来源**
- [parts.js](file://server/service/routes/parts.js#L526-L607)

### 前端集成组件

```mermaid
graph LR
subgraph "前端组件"
CustomerSidebar[CustomerContextSidebar]
ServiceRecord[ServiceRecordCreatePage.tsx]
DealerRepairCreate[DealerRepairCreatePage.tsx]
DealerRepairDetail[DealerRepairDetailPage.tsx]
DealerRepairList[DealerRepairListPage.tsx]
end
subgraph "数据流"
PartsData[配件价格数据]
QuotationData[报价数据]
InventoryData[库存数据]
RepairData[返修数据]
end
subgraph "后端API"
PartsAPI[配件API]
QuoteAPI[报价API]
InventoryAPI[库存API]
RepairAPI[返修API]
end
CustomerSidebar --> PartsData
ServiceRecord --> QuotationData
DealerRepairCreate --> RepairData
DealerRepairDetail --> RepairData
DealerRepairList --> RepairData
PartsData --> PartsAPI
QuotationData --> QuoteAPI
InventoryData --> InventoryAPI
RepairData --> RepairAPI
```

**图表来源**
- [CustomerContextSidebar.tsx](file://client/src/components/Service/CustomerContextSidebar.tsx#L274-L306)
- [ServiceRecordCreatePage.tsx](file://client/src/components/ServiceRecords/ServiceRecordCreatePage.tsx#L1-L358)
- [DealerRepairCreatePage.tsx](file://client/src/components/DealerRepairs/DealerRepairCreatePage.tsx#L1-L221)
- [DealerRepairDetailPage.tsx](file://client/src/components/DealerRepairs/DealerRepairDetailPage.tsx#L1-L505)
- [DealerRepairListPage.tsx](file://client/src/components/DealerRepairs/DealerRepairListPage.tsx#L1-L324)

前端组件通过以下方式集成：

1. **实时数据更新**：组件自动获取最新的配件价格
2. **交互式报价**：支持用户手动输入参数进行报价计算
3. **库存状态显示**：显示配件的实时库存状态
4. **历史记录追踪**：记录用户的查询和报价历史
5. **返修流程支持**：完整的返修报价和管理功能

**章节来源**
- [CustomerContextSidebar.tsx](file://client/src/components/Service/CustomerContextSidebar.tsx#L274-L306)
- [ServiceRecordCreatePage.tsx](file://client/src/components/ServiceRecords/ServiceRecordCreatePage.tsx#L1-L358)
- [DealerRepairCreatePage.tsx](file://client/src/components/DealerRepairs/DealerRepairCreatePage.tsx#L1-L221)
- [DealerRepairDetailPage.tsx](file://client/src/components/DealerRepairs/DealerRepairDetailPage.tsx#L1-L505)
- [DealerRepairListPage.tsx](file://client/src/components/DealerRepairs/DealerRepairListPage.tsx#L1-L324)

## 返修报价系统

### 经销商维修单管理

新增的返修报价系统提供了完整的经销商维修单管理功能：

```mermaid
stateDiagram-v2
[*] --> 待接收
待接收 --> 检测中 : 接收设备
检测中 --> 等待配件 : 需要配件
等待配件 --> 维修中 : 配件到位
维修中 --> 完成 : 维修完成
完成 --> 已退回 : 设备退回
已退回 --> [*]
```

**图表来源**
- [dealer-repairs.js](file://server/service/routes/dealer-repairs.js#L16-L47)

系统支持四种维修类型：

- **在保维修**：设备在保修期内的免费维修
- **过保维修**：设备过保后的付费维修
- **升级维修**：将设备升级到更高配置
- **保养维护**：定期保养和预防性维护

### 返修报价流程

```mermaid
flowchart TD
Start([开始返修报价]) --> SelectProduct["选择产品型号"]
SelectProduct --> EnterInfo["输入客户信息"]
EnterInfo --> DescribeIssue["描述问题"]
DescribeIssue --> PartsNeeded["选择所需配件"]
PartsNeeded --> LaborCalc["计算人工费用"]
LaborCalc --> ShippingCalc["计算运费"]
ShippingCalc --> TaxCalc["计算税费"]
TaxCalc --> TotalCalc["计算总费用"]
TotalCalc --> ReviewQuote["审核报价"]
ReviewQuote --> ConfirmQuote["客户确认"]
ConfirmQuote --> StartRepair["开始维修"]
```

**图表来源**
- [DealerRepairCreatePage.tsx](file://client/src/components/DealerRepairs/DealerRepairCreatePage.tsx#L45-L79)
- [DealerRepairDetailPage.tsx](file://client/src/components/DealerRepairs/DealerRepairDetailPage.tsx#L109-L129)

**章节来源**
- [dealer-repairs.js](file://server/service/routes/dealer-repairs.js#L288-L397)
- [DealerRepairCreatePage.tsx](file://client/src/components/DealerRepairs/DealerRepairCreatePage.tsx#L1-L221)
- [DealerRepairDetailPage.tsx](file://client/src/components/DealerRepairs/DealerRepairDetailPage.tsx#L1-L505)
- [DealerRepairListPage.tsx](file://client/src/components/DealerRepairs/DealerRepairListPage.tsx#L1-L324)

## 配件库存管理

### 经销商库存系统

新增的配件库存管理系统提供了完整的库存管理功能：

```mermaid
classDiagram
class DealerInventory {
+int id
+int dealer_id
+int part_id
+int quantity
+int reserved_quantity
+int available_quantity
+int min_stock_level
+checkStockStatus() string
+updateStock() void
}
class RestockOrder {
+int id
+string order_number
+int dealer_id
+string status
+float subtotal
+float total_amount
+createOrder() void
+approveOrder() void
}
class ProformaInvoice {
+int id
+string pi_number
+int dealer_id
+float subtotal
+float total_amount
+string status
+generateInvoice() void
}
DealerInventory --> RestockOrder : "触发补货"
RestockOrder --> ProformaInvoice : "生成PI"
```

**图表来源**
- [007_parts_inventory.sql](file://server/service/migrations/007_parts_inventory.sql#L10-L80)
- [007_parts_inventory.sql](file://server/service/migrations/007_parts_inventory.sql#L85-L160)
- [007_parts_inventory.sql](file://server/service/migrations/007_parts_inventory.sql#L177-L226)

### 库存管理功能

系统提供以下库存管理功能：

1. **实时库存查询**：支持按经销商和配件的实时库存查询
2. **库存预警**：当库存低于安全线时自动预警
3. **补货申请**：经销商可以发起补货申请
4. **库存流水**：记录所有库存变动的详细流水
5. **月结结算**：支持月度库存结算和对账

### 补货订单流程

```mermaid
sequenceDiagram
participant Dealer as 经销商
participant System as 库存系统
participant Finance as 财务系统
Dealer->>System : 发起补货申请
System->>System : 检查库存和安全线
System->>Dealer : 发送补货确认
Dealer->>System : 确认补货订单
System->>Finance : 生成PI发票
Finance-->>System : 确认付款状态
System-->>Dealer : 更新订单状态
```

**图表来源**
- [dealer-inventory.js](file://server/service/routes/dealer-inventory.js#L466-L481)
- [proforma-invoice.js](file://server/service/routes/proforma-invoice.js#L212-L324)

**章节来源**
- [007_parts_inventory.sql](file://server/service/migrations/007_parts_inventory.sql#L1-L349)
- [dealer-inventory.js](file://server/service/routes/dealer-inventory.js#L466-L642)
- [proforma-invoice.js](file://server/service/routes/proforma-invoice.js#L1-L415)

## 依赖关系分析

```mermaid
graph TB
subgraph "核心依赖"
PRD[Service_PRD.md]
PricingDoc[Service_Parts_SKU_Pricing.md]
API[Service_API.md]
end
subgraph "技术实现"
Express[Express.js]
SQLite[SQLite数据库]
Axios[Axios HTTP客户端]
end
subgraph "业务逻辑"
PartsCatalog[配件目录]
QuotationEngine[报价引擎]
InventorySystem[库存系统]
RepairSystem[返修系统]
ProformaSystem[PI系统]
end
PRD --> PartsCatalog
PricingDoc --> PartsCatalog
API --> PartsCatalog
Express --> PartsCatalog
SQLite --> PartsCatalog
PartsCatalog --> QuotationEngine
PartsCatalog --> InventorySystem
PartsCatalog --> RepairSystem
InventorySystem --> ProformaSystem
Axios --> PartsCatalog
```

**图表来源**
- [Service_PRD.md](file://docs/Service_PRD.md#L1-L800)
- [Service_Parts_SKU_Pricing.md](file://docs/Service_Parts_SKU_Pricing.md#L1-L233)

系统的关键依赖关系：

1. **文档驱动**：所有业务逻辑都基于标准化的文档规范
2. **API标准化**：前后端通过标准化的API接口通信
3. **数据一致性**：前端和后端共享相同的数据模型
4. **权限控制**：基于角色的访问控制确保数据安全
5. **流程集成**：返修系统与库存系统无缝集成

**章节来源**
- [Service_API.md](file://docs/Service_API.md#L1451-L1691)

## 性能考虑

### 缓存策略

系统采用多层次缓存策略来优化性能：

- **数据库查询缓存**：热门配件查询结果缓存
- **前端组件缓存**：用户常用的报价模板缓存
- **静态资源缓存**：CSS、JS文件的浏览器缓存
- **会话缓存**：用户登录状态和权限信息缓存

### 并发处理

```mermaid
flowchart TD
Request[并发请求] --> Queue[请求队列]
Queue --> Process[并发处理]
Process --> Cache[缓存检查]
Cache --> |命中| Return[返回缓存]
Cache --> |未命中| DB[数据库查询]
DB --> UpdateCache[更新缓存]
UpdateCache --> Return
Return --> Response[响应客户端]
```

**图表来源**
- [parts.js](file://server/service/routes/parts.js#L20-L81)

### 数据库优化

- **索引优化**：为常用查询字段建立索引
- **查询优化**：使用LIMIT和OFFSET实现分页
- **连接池**：使用连接池管理数据库连接
- **事务管理**：确保库存和报价数据的一致性

## 故障排除指南

### 常见问题及解决方案

| 问题类型 | 症状 | 解决方案 |
|---------|------|----------|
| 配件价格不更新 | 前端显示过期价格 | 清除浏览器缓存或强制刷新页面 |
| 报价计算错误 | 计算结果与预期不符 | 检查输入参数和汇率设置 |
| 库存显示异常 | 库存数量不准确 | 同步库存数据或检查库存事务日志 |
| API访问失败 | 401/403错误 | 检查认证令牌和用户权限 |
| 返修单创建失败 | 500错误 | 检查产品和客户信息的完整性 |
| 库存预警不准确 | 预警延迟或缺失 | 检查安全线设置和库存更新频率 |

### 调试工具

1. **浏览器开发者工具**：监控网络请求和响应
2. **数据库查询工具**：直接查询数据库验证数据
3. **日志分析**：查看服务器日志定位问题
4. **API测试工具**：使用Postman测试API接口
5. **库存监控工具**：实时监控库存变化和预警状态

**章节来源**
- [parts.js](file://server/service/routes/parts.js#L74-L80)
- [parts.js](file://server/service/routes/parts.js#L168-L179)

## 结论

服务配件SKU定价系统通过标准化的文档规范和RESTful API设计，为Kinefinity的产品服务闭环提供了强大的技术支持。系统不仅满足了当前的业务需求，还具备良好的扩展性和维护性。

**主要成就**：

1. **标准化管理**：基于文档的标准化管理模式
2. **实时数据**：前后端数据的实时同步
3. **灵活扩展**：支持新的配件类别和定价策略
4. **安全可靠**：完善的权限控制和数据保护
5. **完整流程**：从配件查询到维修报价的全流程支持

**新增功能价值**：

1. **返修报价系统**：实现了完整的返修报价和管理流程
2. **库存集成**：与经销商库存系统无缝集成
3. **PI发票管理**：支持正式发票的生成和管理
4. **多币种支持**：全面支持多币种报价和结算
5. **自动化流程**：从报价到付款的自动化处理

**未来发展方向**：

1. **智能化报价**：集成AI算法提供更精准的报价建议
2. **移动端支持**：开发移动应用支持现场报价
3. **多语言支持**：扩展国际化功能支持更多语言
4. **数据分析**：增强数据分析功能支持业务决策
5. **供应链集成**：与供应商系统深度集成优化供应链管理