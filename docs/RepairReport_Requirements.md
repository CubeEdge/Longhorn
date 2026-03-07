# 维修报告与咨询草案生成需求 (Repair Report & Quotation Draft Requirements)

## 1. 背景与目标
在 OP（运营/维修）部门完成故障排除和零件更换后，系统应自动汇总维修数据，生成一份面向客户的专业维修报告或报价单草条。
该报告由 MS（市场/客服）审核后发送给客户，作为收费依据和维修凭证。

## 2. 报告核心组成部分

### 2.1 基础信息区 (Header & Device Identity)
*   **报告编号**: 关联工单号 (如 `RMA-C-2603-002`)。
*   **生成日期**: 报告生成的具体时间。
*   **客户资料**: 客户姓名/公司名、联系方式。
*   **设备身份**:
    *   产品型号 (Product Model)
    *   序列号 (Serial Number/SN)
    *   固件/硬件版本 (Firmware/HW Version)

### 2.2 技术评估区 (Technical Assessment)
*   **报修故障描述 (Customer Reported Issue)**: 客户原始描述。
*   **检测与排故过程 (Troubleshooting & Diagnosis)**: 
    *   *输入源*: OP 填写的 `Troubleshooting`。
    *   *展示形式*: 专业化转述。例如：“经检测，发现 SDI 接口隔离芯片因外部异常高压击穿”。
*   **维修结果 (Resolution)**: 维修后的状态确认（如“已更换 HDA 主板，各项功能测试 OK”）。

### 2.3 服务详情与费用清单 (Service & Billing Details)
*   **零件消耗表 (Parts List)**:
    *   零件名称/规格
    *   数量
    *   单价 (由 MS 审核时可调整或系统内置价目表带入)
*   **人工工时 (Labor Charges)**:
    *   消耗总工时。
    *   时薪/固定服务费。
*   **运费 (Logistics)**: (可选) 返还设备的运输费用。

### 2.4 财务汇总 (Financial Summary)
*   **保修判定 (Warranty Status)**: 保内 (In-Warranty) / 保外 (Out-of-Warranty)。
*   **合计金额 (Total Amount)**: 零件 + 人工 + 税费。
*   **支付状态**: 待支付 / 已支付。

### 2.5 质量保证与条款 (QA & Terms)
*   **维修质保期**: 针对本次维修更换零件的质保说明 (如 90 天)。
*   **免责声明**: 针对操作不当、二次损坏等说明。
*   **公司章/签名**: 预留电子签章位置。

---

## 3. UI 交互设计 (Mockup 参考)

![维修报告示例](file:///Users/Kine/Documents/Kinefinity/KineCore/Pool/Mega/Longhorn/docs/ui_mockups/repair_report_mockup.png)

### 交互逻辑点：
1.  **OP 提交触发**: 当 OP 节点标记为“维修完成”时，系统后台自动根据填报生成的零件表和排故记录生成此 DRAFT。
2.  **MS 审核修订**: MS 成员在“MS 审核”节点进入此报告，可修改单价、应用折扣、添加商务备注。
3.  **PDF/链接导出**: 支持一键下载 PDF 或生成一个带有效期 and 支付按钮的移动端查看链接发送给客户。

---

## 4. 待解决疑问 (Open Questions)
*   是否需要支持多币种转换 (CNY/USD/EUR)？
*   零件的价格是实时从 ERP 获取还是预设在 CRM 系统内？
*   客户是否需要在线确认/签名 (Digital Signature) 流程？
