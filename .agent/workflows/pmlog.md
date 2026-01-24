---
description: Standard procedure to update documentation (DevLog & Backlog)
---

1. Read the current status from `task.md` to understand what has been completed in this session.
2. Read `docs/4_DevLog.md` to see the current state and format.
3. Update `docs/4_DevLog.md`:
   - If a section for today's date exists, append the new task details to it.
   - If not, create a new section at the top `## 会话: YYYY-MM-DD`.
   - **CRITICAL**: Use **Chinese (Simplified)** for all content.
   - Format:
     ```markdown
     ### 任务: [Task Name]
     - **状态**: ✅ 已完成
     - **变更内容**:
         - **[Category]**: [Detail]
     ```
4. Read `docs/1_Backlog.md`.
5. Update `docs/1_Backlog.md`:
   - Check off any completed items in the "Current Sprint" or "Backlog" sections.
   - Ensure no English subtitles/headers remain.
6. Verify that all changes are successfully saved.
