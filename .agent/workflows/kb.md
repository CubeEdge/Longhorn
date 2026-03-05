---
description: 发布或更新知识库文章到远程生产数据库
---

# Knowledge Base 文章发布流程

## 前置条件
- 文章源文件位于 `docs/kb/` 目录下，格式为 `.md`
- 文件包含 YAML frontmatter（title, slug, product_line, category, visibility, tags, summary）
- 远程服务器 `mini` SSH 可达

## 发布步骤

### 1. 编写或修改文章
在 `docs/kb/` 目录下创建或编辑 `.md` 文件，确保 frontmatter 格式正确：

```markdown
---
title: "文章标题"
slug: article-slug
product_line: GENERIC
category: Manual
visibility: Internal
tags: ["Tag1", "Tag2"]
summary: "简短摘要"
---

（正文 Markdown 内容）
```

### 2. 本地预览
在 VS Code 中预览 `.md` 文件，确认格式正确。

// turbo
### 3. 发布到远程
```bash
./scripts/publish_kb.sh docs/kb/<filename>.md
```

批量发布所有文章：
```bash
./scripts/publish_kb.sh docs/kb/*.md
```

### 4. 验证
在浏览器中打开 Tech Hub → 一般文档 (GENERIC)，检查文章是否正确显示。

## 注意事项
- 脚本基于 `slug` 做 UPSERT（有则更新，无则新增）
- 默认作者 ID 为 4 (Jihua)
- 内容通过 `readfile()` 加载，不存在 shell 转义问题
- 发布后无需重启服务器，文章立即生效
