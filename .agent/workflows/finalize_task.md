---
description: Standard procedure to finalize a task and sync Project docs and git
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

4. **Git Commit & Push**:
   - Stage all changed files (code and documentation).
   - Use a descriptive commit message following the project's milestones.
   - Execute `git push` to synchronize changes with the remote repository.