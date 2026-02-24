---
description: 快速记录当前 Prompt 对话到 log_prompt和log dev, backlog 并结束
---

执行以下步骤完成记录：

1. **计算响应时长**：
   - 从接收 Prompt 到当前时间的总耗时

2. **更新 `docs/log_prompt.md`**：
   - 在文件顶部插入新条目（倒序排列）
   - **CRITICAL**: Use **Chinese (Simplified)** for all content.
   - 格式：
     ```markdown
     ---

     ## YYYY-MM-DD HH:mm (耗时: Xm Ys)

     **User Prompt**: 
     {用户输入内容}

     **Agent Response**:
     {Agent执行的主要操作和结果摘要}

     ```
3. **Update `docs/log_backlog.md`**:
   分析本次对话里面的所有计划plan，walkthrough，然后梳理到这个文档（倒序排列）
   - Mark completed feature/bug items as `[x]`.
   - Move completed items from "Backlog/To Do" to "History/Completed".
   - Add any newly discovered bugs to "Bug Tracker".

4. **Update `docs/log_dev.md`**:
   分析本次对话里面的所有计划plan，walkthrough，然后梳理到这个文档（倒序排列）
   - Add a bullet point for the technical changes made.
   - Mention any new technologies or patterns introduced.

3. **简要总结**：
   - 向用户确认记录已完成