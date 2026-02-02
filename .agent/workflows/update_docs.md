---
description: Standard procedure to update documentation after each prompt/task
---

# Documentation Update Workflow

为确保文档与代码实时同步，每个 Prompt/Task 结束时（或 `finalize_task` 时），**必须**执行以下文档更新流程。

## 1. 核心文档 (Core Documents)

### A. Prompt Log (`docs/2_PromptLog.md`)
> **When**: 每次 Prompt 执行完毕后。
> **What**: 记录"用户要什么"和"你做了什么"。
> **Format**: 按时间倒序插入顶部。

```markdown
### YYYY-MM-DD HH:MM - <Task Title>
**User Prompt**:
1. <Brief requirements>
2. ...

**Action**:
1. **<Component>**: <What changed>
2. **<File>**: <Specific technical change>

**Status**: <Complete/In Progress>
```

### B. Dev Log (`docs/4_DevLog.md`)
> **When**: 涉及技术决策、架构变更、新功能实现或复杂 Bug 修复时。
> **What**: 记录"你是怎么做到的" (How) 和 "为什么这么做" (Why)。
> **Format**: 按会话/日期分组。

```markdown
### 任务: <Task Name>
- **状态**: ✅ 已完成
- **变更内容**:
    - **Architecture**: <Design decisions>
    - **Backend**: <API/Schema changes>
    - **Frontend**: <Component/UI changes>
- **技术细节**:
    - <Highlight tricky parts, e.g. SQL optimization, CSS hacks>
```

### C. Backlog (`docs/1_Backlog.md`)
> **When**: 任务完成、新需求提出或 Bug 发现时。
> **What**: 更新任务状态，确保它是"单一事实来源"。

- **Mark Done**: 将 `Current Sprint` 中的条目标记为 ✅ 或移至历史记录。
- **Add New**: 将新发现的 Bug 或下个步骤添加到 `Backlog`。

---

## 2. 辅助流程 (Auxiliary)

- **Commit Message**: `docs: update prompt_log, backlog, dev_log for <feature>`
- **Workflow Tool**: 使用 `/pmlog` 或 `/finalize_task` (如果存在) 来自动化此过程。如果在 Agent 模式下，手动执行 `replace_file_content` 更新这些文件。

## 3. 验收标准 (Checklist)

- [ ] `2_PromptLog.md` 最上方有本次会话记录？
- [ ] `1_Backlog.md` 相关任务状态已更新？
- [ ] `4_DevLog.md` 包含关键技术细节（如有）？
- [ ] 代码变更与文档描述一致？
