---
description: Standard procedure to finalize a task and sync all documentation
---

1. **Update `docs/Service_API.md`**:
   - Register any new endpoints (e.g., `products`, `inquiry-tickets`).
   - Document request/response schemas if changed.

2. **Update `docs/Service_PRD.md`**:
   - Mark implemented features as Completed.
   - Note any design changes (e.g., "Pulse View" vs original design).

3. **Update `docs/Service_UserScenarios.md`**:
   - Validate if the actual workflow matches the scenario.
   - Update steps or screenshots to reflect the "As Built" state.


4. **Update `docs/2_PromptLog.md`**:
   - Record the session time.
   - Summarize the User Prompt.
   - Detail the Actions Taken (Root Cause Analysis, Code Changes).
   - State the Result/Status.

5. **Update `docs/1_Backlog.md`**:
   - Mark completed feature/bug items as `[x]`.
   - Move completed items from "Backlog/To Do" to "History/Completed".
   - Add any newly discovered bugs to "Bug Tracker".

6. **Update `docs/4_DevLog.md`**:
   - Add a bullet point for the technical changes made.
   - Mention any new technologies or patterns introduced.


7. **Git Commit**:
   - Run: `git add docs/`
   - Run: `git commit -m "docs: finalize task documentation (prompt_log, backlog, dev_log)"`