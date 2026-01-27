---
description: Ensure the 4 Core Project Documents are updated synchronously
---

Perform these steps at the end of every significant turn or task completion.

1.  **Update `docs/1_Backlog.md`**
    - **Purpose**: Track feature status and to-do items.
    - **Action**: Mark completed items as `[x]`. Add new bugs or requirement debt if any.

2.  **Update `docs/2_PromptLog.md`**
    - **Purpose**: Historical record of user requests and agent actions.
    - **Action**: Append the latest session summary (Goal, Prompt, Action, Status).
    - **FormatCheck**: Ensure previous entries are preserved.

3.  **Update `docs/3_PRD.md`**
    - **Purpose**: Product Requirements Document (Source of Truth for Features).
    - **Action**: If the implementation details or feature scope changed (e.g., new "Forging" mechanic), update the relevant section to reflect reality.

4.  **Update `docs/4_DevLog.md`**
    - **Purpose**: Technical Implementation Details.
    - **Action**: Log specific code changes, schema updates, file modifications, and system events.

5.  **Final Verification**
    - confirm all 4 files (`1_Backlog`, `2_PromptLog`, `3_PRD`, `4_DevLog`) have been modified/verified.
