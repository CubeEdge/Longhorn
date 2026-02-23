const fs = require('fs');

// 1. Fix Backlog (it had some overlapping text/version lines)
let backlog = fs.readFileSync('docs/1_Backlog.md', 'utf-8');
const searchSection = `## 最近更新 (2026-02-23 02:40)
- **搜索历史持久化增强**: 实现了完整的搜索状态快照存储（包含文章结果、工单、AI 回答、关键词），支持用户维度的隔离。
- **历史记录清理**: 新增单条搜索历史删除功能，集成全局 \`ConfirmDialog\` 二次确认，自动维护 LRU 前 10 条最优性能队列。
- **UI 位置回归与互斥修复**: 搜索框回归至 Header 顶部右侧，与产品族 Tab 解耦。修复了产品 Tab 切换时搜索模式未正确重置导致的视图冲突。`;

// Remove the messy duplication part
backlog = backlog.replace(/## 会话: 2026-02-23 \(Wiki Search History & State Persistence\)[\s\S]*?## 最近更新/, "## 最近更新");
backlog = backlog.replace(/## 最近更新## 2026-02-23 02:40/, "## 会话详情: 2026-02-23 02:40");

if (!backlog.includes(searchSection)) {
   backlog = backlog.replace("# Backlog 更新记录\n", "# Backlog 更新记录\n\n" + searchSection + "\n\n");
}
fs.writeFileSync('docs/1_Backlog.md', backlog);

// 2. Fix context.md date
let context = fs.readFileSync('docs/context.md', 'utf-8');
context = context.replace(/> \*\*最后更新\/Last Updated\*\*: .*/, "> **最后更新/Last Updated**: 2026-02-23 v2.0.1 (Update Search Persistence)");
fs.writeFileSync('docs/context.md', context);

console.log('Final log polish done.');
