---
description: Standard procedure to finalize a task and sync all documentation
---

1. **Update `docs/2_PromptLog.md`**:
   - Record the session time.
   - Summarize the User Prompt.
   - Detail the Actions Taken (Root Cause Analysis, Code Changes).
   - State the Result/Status.

2. **Update `docs/1_Backlog.md`**:
   - Mark completed feature/bug items as `[x]`.
   - Move completed items from "Backlog/To Do" to "History/Completed".
   - Add any newly discovered bugs to "Bug Tracker".

3. **Update `docs/4_DevLog.md`**:
   - Add a bullet point for the technical changes made.
   - Mention any new technologies or patterns introduced.

4. **Git Commit**:
   - Run: `git add docs/`
   - Run: `git commit -m "docs: finalize task documentation (prompt_log, backlog, dev_log)"`
