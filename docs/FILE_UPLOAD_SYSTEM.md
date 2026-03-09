# 文件上传系统文档

**版本**: 1.0  
**更新日期**: 2026-03-09  
**关联文档**: OPS.md

---

## 1. 概述

本文档汇总了 Longhorn 系统中所有文件上传入口、存储路径、缩略图生成机制及相关配置。

---

## 2. 存储架构

### 2.1 生产环境文件服务器

```
/Volumes/fileserver/                    # 文件服务器根目录
├── Files/                              # Files 应用存储
│   ├── MS/                             # 市场部部门文件
│   ├── OP/                             # 运营部部门文件
│   ├── RD/                             # 研发部部门文件
│   ├── RE/                             # 通用台面
│   ├── GE/                             # 旧目录（保留）
│   └── MEMBERS/{username}/             # 个人空间
│
├── Service/                            # Service 应用存储
│   ├── Products/
│   │   ├── WarrantyInvoices/           # 保修发票（新增）
│   │   ├── Photos/                     # 产品照片
│   │   ├── Manuals/                    # 说明书
│   │   └── Firmware/                   # 固件文件
│   ├── Tickets/
│   │   ├── Inquiry/                    # 咨询工单附件
│   │   ├── RMA/                        # RMA返厂单附件
│   │   ├── DealerRepair/               # 经销商维修单附件
│   │   └── Activities/                 # 工单活动附件（建议迁移）
│   ├── RMA/
│   │   └── Documents/                  # RMA文档（建议迁移）
│   ├── Knowledge/
│   │   ├── Images/                     # 知识库图片
│   │   ├── Videos/                     # 知识库视频
│   │   ├── Documents/                  # 知识库文档
│   │   └── Temp/                       # 知识库临时导入（建议迁移）
│   └── Temp/
│       ├── Uploads/                    # 临时上传
│       └── Chunks/                     # 分块上传临时文件
│
├── System/
│   ├── Backups/db/                     # 数据库备份
│   ├── Thumbnails/                     # 缩略图缓存
│   └── RecycleBin/                     # 回收站
│
└── Shared/
    ├── Public/                         # 公开访问文件
    └── Templates/                      # 模板文件
```

### 2.2 本地开发/临时存储

```
./data/                                 # 应用数据目录
├── issue_attachments/                  # 工单活动附件（当前）
├── .thumbnails/                        # 缩略图缓存
├── .uploads/                           # 上传临时文件
├── .chunks/{uploadId}/                 # 分片上传临时目录
├── .recycle/                           # 回收站
└── DiskA -> /Volumes/fileserver/Files  # 软链接（生产环境）
```

---

## 3. 上传 API 端点

### 3.1 Service 模块上传

| 路由文件 | 端点 | 方法 | 用途 | 存储路径 |
|---------|------|------|------|---------|
| `upload.js` | `/api/v1/upload` | POST | 保修发票、通用附件 | `/Volumes/fileserver/Service/...` |
| `ticket-activities.js` | `/api/v1/tickets/:id/attachments` | POST | 工单活动附件 | `./data/issue_attachments/` |
| `rma-documents.js` | `/api/v1/rma-documents/:id/documents` | POST | PI/维修报告文档 | `./data/issue_attachments/` |
| `knowledge.js` | `/api/v1/knowledge/import` | POST | 知识库PDF导入 | `/tmp/knowledge_uploads/` |

### 3.2 文件系统上传

| 端点 | 方法 | 用途 | 存储路径 |
|------|------|------|---------|
| `/api/upload` | POST | 多文件直传 | `/Volumes/fileserver/Files/` |
| `/api/upload/chunk` | POST | 分片上传接收 | `./data/.chunks/{uploadId}/` |
| `/api/upload/merge` | POST | 分片合并 | `/Volumes/fileserver/Files/` |
| `/api/upload/check-chunks` | POST | 检查已存在分片 | - |

---

## 4. 上传配置详情

### 4.1 Service 模块上传配置

**文件**: `/server/service/routes/upload.js`

```javascript
// 存储路径映射
const typeDirMap = {
    'warranty_invoice': 'Products/WarrantyInvoices',    // 保修发票
    'ticket_attachment': 'Tickets/General',              // 工单附件
    'general': 'Temp/Uploads'                            // 临时上传
};

// 文件限制
- 最大文件大小: 5MB
- 单次上传文件数: 1个
- 支持格式: JPG, PNG, GIF, WebP, PDF

// 文件名格式
{timestamp}_{random}_{baseName}{ext}
// 示例: 1710001234567_abc123_invoice.pdf
```

### 4.2 工单活动附件配置

**文件**: `/server/service/routes/ticket-activities.js`

```javascript
// 当前存储路径
const attachmentsDir = path.join(__dirname, '../../data/issue_attachments');

// 文件限制
- 最大文件大小: 50MB
- 支持格式: 图像、视频、PDF

// 缩略图生成
- 尺寸: 200x200px
- 格式: JPEG
- 存储: ./data/.thumbnails/
```

### 4.3 文件系统上传配置

**文件**: `/server/index.js`

```javascript
// 存储路径
const DISK_A = process.env.STORAGE_PATH 
    || (Darwin && 生产环境) ? '/Volumes/fileserver/Files'
    || (开发环境) ? './data/DiskA';

// 分片上传配置
- 分片大小: 5MB
- 临时存储: ./data/.chunks/{uploadId}/
- 最大并发: 2
```

---

## 5. 前端上传组件

### 5.1 组件列表

| 组件名 | 路径 | 用途 | 上传方式 |
|--------|------|------|---------|
| `ProductWarrantyRegistrationModal` | `Service/` | 保修发票上传 | 单文件上传 |
| `MentionCommentInput` | `Workspace/` | 工单评论附件 | 多文件上传 |
| `TicketCreationModal` | `Service/` | 工单创建附件 | 多文件上传 |
| `FileBrowser` | `components/` | 文件管理上传 | 断点续传 |
| `AttachmentZone` | `Service/` | 通用拖拽上传 | 拖拽上传 |
| `PIEditor` | `Workspace/` | PI文档附件 | 单文件上传 |
| `RepairReportEditor` | `Workspace/` | 维修报告附件 | 单文件上传 |
| `DocumentReviewModal` | `Workspace/` | 文档审核附件 | 单文件上传 |
| `FinalSettlementModal` | `Workspace/` | 结算文档附件 | 单文件上传 |

### 5.2 Hooks

| Hook名 | 路径 | 功能 |
|--------|------|------|
| `useResumableUpload` | `hooks/` | 断点续传、进度跟踪 |

---

## 6. 缩略图生成系统

### 6.1 缩略图 API

| 端点 | 位置 | 功能 | 缓存路径 |
|------|------|------|---------|
| `GET /api/thumbnail` | `/server/index.js` | 通用缩略图 | `./data/.thumbnails/` |
| `GET /api/recycle-bin/thumbnail` | `/server/index.js` | 回收站缩略图 | `./data/.thumbnails/` |
| 后台生成 | `ticket-activities.js` | 工单附件缩略图 | `./data/.thumbnails/` |

### 6.2 缩略图参数

```javascript
// 默认模式
{
    size: 200,          // 200x200px
    quality: 75,        // WebP quality
    fit: 'cover'        // 裁剪填充
}

// Preview 模式
{
    size: 1200,         // 1200px (长边)
    quality: 85,
    fit: 'inside'       // 保持纵横比
}

// 缓存键格式
{path}_{size}.webp
```

### 6.3 支持格式

| 类型 | 格式 | 处理方式 |
|------|------|---------|
| 标准图像 | JPG, PNG, GIF, WebP, BMP, TIFF | Sharp 库处理 |
| 视频 | MOV, MP4, M4V, AVI, MKV | FFmpeg 抽帧 |
| HEIC/HEIF | HEIC, HEIF | macOS sips 命令 |

### 6.4 并发控制

```javascript
const MAX_CONCURRENT_THUMBS = 2;    // 最大并发缩略图生成数
const FFPROBE_TIMEOUT = 60000;      // FFmpeg 超时时间 (ms)
```

---

## 7. 数据库表结构

### 7.1 上传记录表

```sql
-- Service 模块上传记录
CREATE TABLE service_uploads (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    file_name TEXT NOT NULL,           -- 原始文件名
    file_path TEXT NOT NULL,           -- 存储路径
    file_size INTEGER NOT NULL,        -- 文件大小 (bytes)
    file_type TEXT NOT NULL,           -- MIME 类型
    upload_type TEXT DEFAULT 'general', -- 上传类型
    uploaded_by INTEGER NOT NULL,      -- 上传者ID
    uploaded_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 文件统计表 (Files 应用)
CREATE TABLE file_stats (
    path TEXT PRIMARY KEY,             -- 文件路径
    uploaded_at DATETIME,              -- 上传时间
    uploaded_by INTEGER,               -- 上传者ID
    accessed_count INTEGER DEFAULT 0,  -- 访问次数
    last_accessed DATETIME,            -- 最后访问时间
    size INTEGER                       -- 文件大小
);

-- 回收站表
CREATE TABLE recycle_bin (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    file_path TEXT NOT NULL,           -- 文件路径
    original_location TEXT NOT NULL,   -- 原始位置
    deletion_date DATETIME,            -- 删除时间
    deleted_by INTEGER                 -- 删除者ID
);
```

### 7.2 文档序列表

```sql
-- PI 文档序列
CREATE TABLE pi_sequences (
    date_key TEXT PRIMARY KEY,         -- YYYYMMDD
    last_sequence INTEGER DEFAULT 0    -- 当日计数
);

-- 维修报告序列
CREATE TABLE report_sequences (
    date_key TEXT PRIMARY KEY,
    last_sequence INTEGER DEFAULT 0
);

-- 文档审计日志
CREATE TABLE document_audit_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    document_type TEXT,                -- pi/repair_report
    document_id INTEGER,
    action TEXT,                       -- create/review/publish/reject
    user_id INTEGER,
    user_name TEXT,
    changes_summary TEXT,              -- JSON
    comment TEXT,
    created_at DATETIME
);
```

---

## 8. 迁移计划

### 8.1 建议迁移路径

以下上传功能仍使用旧路径，建议逐步迁移到 `/Volumes/fileserver/Service/`:

| 功能 | 当前路径 | 建议路径 | 优先级 |
|------|---------|---------|--------|
| 工单活动附件 | `./data/issue_attachments/` | `/Volumes/fileserver/Service/Tickets/Activities/` | 高 |
| RMA 文档 | `./data/issue_attachments/` | `/Volumes/fileserver/Service/RMA/Documents/` | 高 |
| 知识库导入 | `/tmp/knowledge_uploads/` | `/Volumes/fileserver/Service/Knowledge/Temp/` | 中 |

### 8.2 迁移步骤

1. 修改对应路由文件的存储路径配置
2. 更新前端组件中的文件访问 URL
3. 执行数据库迁移（如需）
4. 测试验证上传和下载功能
5. 迁移历史文件（可选）

---

## 9. 相关文件路径

### 9.1 后端路由

```
/server/service/routes/upload.js
/server/service/routes/ticket-activities.js
/server/service/routes/rma-documents.js
/server/service/routes/system.js
/server/service/routes/knowledge.js
/server/files/routes.js
/server/index.js
```

### 9.2 前端组件

```
/client/src/hooks/useResumableUpload.ts
/client/src/components/FileBrowser.tsx
/client/src/components/Service/AttachmentZone.tsx
/client/src/components/Service/ProductWarrantyRegistrationModal.tsx
/client/src/components/Service/TicketCreationModal.tsx
/client/src/components/Workspace/MentionCommentInput.tsx
/client/src/components/Workspace/PIEditor.tsx
/client/src/components/Workspace/RepairReportEditor.tsx
/client/src/components/Workspace/DocumentReviewModal.tsx
/client/src/components/Workspace/FinalSettlementModal.tsx
```

---

## 10. 注意事项

1. **权限控制**: 所有上传/下载端点都需要认证
2. **目录遍历防护**: 文件名中禁止 `..` 和 `//`
3. **文件类型白名单**: 严格限制可上传文件类型
4. **大小限制**: 根据用途设置合理的文件大小限制
5. **临时文件清理**: 定期清理 `.chunks` 和 `Temp` 目录
6. **备份策略**: 生产环境文件应纳入备份计划

---

**文档维护**: 当新增或修改上传功能时，请同步更新本文档。
