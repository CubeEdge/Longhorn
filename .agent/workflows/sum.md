---
description: Standard procedure to finalize a task and sync all documentation
---


1. **Update `docs/Service_PRD.md`**:
   根据本次对话的内容交互和Service应用当前整体的代码，去分析和增加、标记产品需求的变化，需要非常谨慎和仔细；
   - Mark implemented features as Completed.
   - Note any design changes (e.g., "Pulse View" vs original design).
   - **CRITICAL**: Use **Chinese (Simplified)** for all content.

2. **Update `docs/Service_UserScenarios.md`**:
   根据本次对话的内容交互和Service应用当前整体的代码，去分析和增加、标记用户场景的变化，需要非常谨慎和仔细；
   - Validate if the actual workflow matches the scenario.
   - Update steps or screenshots to reflect the "As Built" state.
   - **CRITICAL**: Use **Chinese (Simplified)** for all content.

3. **Update `docs/Service_API.md`**:
   根据Service应用当前整体的代码，去分析和更新API的变化，需要非常谨慎和仔细；
   - Register any new endpoints (e.g., `products`, `inquiry-tickets`).
   - Document request/response schemas if changed.
   - **CRITICAL**: Use **Chinese (Simplified)** for all content.

4. **Git Commit**:
   - Run: `git add docs/`
   - Run: `git commit -m "docs: finalize task documentation (prompt_log, backlog, dev_log)"`