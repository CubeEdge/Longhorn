# AI 咨询工单优化文档

**优化日期**: 2026-02-06  
**优化范围**: 咨询工单创建页面的AI辅助体验  
**关联文件**:
- `server/service/ai_service.js` - AI解析服务
- `client/src/components/InquiryTickets/InquiryTicketCreatePage.tsx` - 创建页面

---

## 🎯 优化目标

提升咨询工单创建的AI辅助体验，让用户更快速、准确地从邮件/聊天记录创建工单。

---

## ✨ 主要改进

### 1. **增强 AI 解析能力** (`ai_service.js`)

#### 新增识别字段
- ✅ **序列号识别** (`serial_number`) - 自动提取 8 位以上字母数字序列
- ✅ **服务类型推断** (`service_type`) - 根据内容智能分类：
  - 问题咨询 → `Consultation`
  - 技术故障 → `Troubleshooting`
  - 投诉 → `Complaint`
- ✅ **渠道检测** (`channel`) - 自动识别沟通方式：
  - 检测关键词：`email from` → Email
  - `called` → Phone
  - `WeChat message` → WeChat

#### 改进的产品匹配
- 支持产品名称变体识别（如 "Edge 8K" 自动匹配 "MAVO Edge 8K"）
- 识别更多 Kinefinity 产品线（Eagle, KineMON, Terra 等）

#### 智能紧急度判断
- 检测关键词：`urgent`, `ASAP`, `critical`, `production stopped`, `deadline`
- 自动标记 `High` 或 `Critical` 优先级

---

### 2. **视觉反馈系统** (`InquiryTicketCreatePage.tsx`)

#### AI 提取信息面板
- 📊 **实时展示** AI 识别的所有字段
- ✅ **置信度显示**：
  - ✓ Matched - 产品成功匹配
  - ⚠️ Not Found - 产品未找到
  - 🚨 - 紧急工单标记

#### 字段高亮效果
- 🟡 **金色边框** - AI 自动填充的字段
- ✨ **发光效果** - `boxShadow: '0 0 0 1px rgba(255,215,0,0.3)'`
- 🎨 **背景高亮** - 淡黄色底色 `rgba(255,215,0,0.05)`

**高亮字段包括**:
- Customer Name
- Customer Contact
- Product
- Serial Number
- Service Type
- Channel
- Problem Summary

---

## 📋 使用示例

### 示例输入文本

```
From: john@filmstudio.com
Subject: URGENT - MAVO Edge 8K recording stopped

Hi support team,

Our MAVO Edge 8K (S/N: ME8K2024) suddenly stopped recording during production.
The camera was working fine, then the screen went black. We need ASAP help as 
we have a shoot tomorrow!

Contact: +1-555-0123
John Smith
```

### AI 识别结果

```json
{
  "customer_name": "John Smith",
  "contact_info": "john@filmstudio.com / +1-555-0123",
  "product_model": "MAVO Edge 8K",
  "serial_number": "ME8K2024",
  "service_type": "Troubleshooting",
  "channel": "Email",
  "issue_summary": "MAVO Edge 8K recording stopped",
  "issue_description": "Camera suddenly stopped recording, screen went black during production",
  "urgency": "Critical"
}
```

### 前端展示效果

**AI Suggestions Panel**:
```
✅ AI Extracted 8 field(s)

Customer Name: John Smith          Contact Info: john@filmstudio.com / +... 
Product: MAVO Edge 8K ✓ Matched    Serial Number: ME8K2024
Service Type: Troubleshooting      Channel: Email
Issue Summary: [Critical] MAVO ... Urgency: Critical 🚨
```

**表单状态**:
- 所有填充字段显示金色边框
- 用户可立即检查并提交

---

## 🔧 技术实现

### 后端优化

**`ai_service.js:parseTicket()`**
```javascript
// 增强的 System Prompt
const systemPrompt = `You are Bokeh, Kinefinity's professional AI service assistant.
Your task is to extract consultation ticket information from raw text.

**Important Rules:**
- Recognize Kinefinity product names and variations
- Extract serial numbers carefully (8+ alphanumeric characters)
- Infer service_type from content
- Detect channel from context keywords
- Set urgency based on language tone
`;
```

### 前端优化

**状态管理**
```typescript
const [aiFilledFields, setAiFilledFields] = useState<Set<string>>(new Set());
const [aiSuggestions, setAiSuggestions] = useState<{
  field: string, 
  value: string, 
  confidence?: string
}[]>([]);
```

**字段高亮样式**
```typescript
style={aiFilledFields.has('field_name') ? {
  borderColor: '#FFD700',
  boxShadow: '0 0 0 1px rgba(255,215,0,0.3)',
  background: 'rgba(255,215,0,0.05)'
} : {}}
```

---

## 🎨 视觉设计

### AI Smart Assist 区域
- **背景渐变**: `linear-gradient(135deg, rgba(255, 215, 0, 0.1), rgba(255, 165, 0, 0.05))`
- **边框色**: `rgba(255, 215, 0, 0.3)`
- **图标**: Sparkles (✨) 金色填充

### 提取信息面板
- **背景**: `rgba(0,255,0,0.05)` - 淡绿色表示成功
- **边框**: `rgba(0,255,0,0.2)`
- **标题**: 绿色文本 `#0f0`
- **每个字段卡片**: 左侧金色边框 `3px solid #FFD700`

---

## 📊 效果对比

### 优化前
- ❌ 仅识别 5 个字段
- ❌ 产品匹配不准确
- ❌ 无视觉反馈
- ❌ 用户不知道哪些字段被填充

### 优化后
- ✅ 识别 9+ 个字段
- ✅ 智能产品匹配（支持别名）
- ✅ 实时提取信息面板
- ✅ 金色高亮自动填充字段
- ✅ 置信度标记
- ✅ 紧急度智能判断

---

## 🚀 下一步优化方向

### Phase 2: 智能推荐（已规划）
- [ ] 相似工单检测 - 基于问题摘要查找历史相似案例
- [ ] 解决方案建议 - 推荐历史成功解决方案
- [ ] 处理人推荐 - 根据产品和问题类型推荐专家

### Phase 3: 上下文集成
- [ ] 与 Bokeh 助手集成 - 在创建页面直接唤起 AI 聊天
- [ ] 知识库联动 - 自动关联相关知识文章
- [ ] 历史工单关联 - 显示该客户/产品的历史记录

---

## 📝 测试建议

### 测试场景 1: 标准邮件
```
From: support@dealer.com
MAVO Edge 6K serial ME6K1234 customer reports screen flickering.
Contact: support@dealer.com
```

**预期**: 识别产品、序列号、服务类型(Troubleshooting)、渠道(Email)

### 测试场景 2: 紧急情况
```
URGENT! Production stopped! 
MAVO LF won't power on. S/N: MLF2023.
Client: ABC Films, phone: 555-1234
Need immediate support!
```

**预期**: 
- 紧急度 = Critical 🚨
- 问题摘要加 [Critical] 标记
- 所有字段正确填充

### 测试场景 3: 产品变体
```
Customer asks about Edge 8K compatibility with Ninja V.
Contact: WeChat - Zhang San
```

**预期**:
- 产品匹配 "MAVO Edge 8K"
- 渠道 = WeChat
- 服务类型 = Consultation

---

## 🐛 已知限制

1. **多产品识别**: 当前仅识别第一个提到的产品
2. **中文支持**: AI 对中文文本的识别准确度可能较低（取决于模型）
3. **复杂场景**: 多客户、多问题的情况需要人工干预

---

## 📚 相关文档

- [Service_API.md](./Service_API.md) - API 接口文档
- [Service_PRD.md](./Service_PRD.md) - 产品需求文档
- [Bokeh智能助手知识库](../client/docs/) - AI 助手架构

---

**更新记录**:
- 2026-02-06: 初始版本 - AI 辅助体验优化完成
