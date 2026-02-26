---
description: 快速同步项目环境、资产清单及运维规范
---

使用此工作流来快速加载项目背景，确保 Agent 了解最新的域名、服务器访问方式及部署规范。


## 1. 核心信息记忆点 (Key Takeaways)

Agent 必须在心中明确以下信息：
- **生产域名**: `opware.kinefinity.com`
- **SSH 别名**: `mini`
- **非交互式 SSH 规范**: 必须包装在 `/bin/zsh -l -c` 中。
- **验证金律**: **代码修改必须递增版本（Server & Client）并发布到远程服务器**，严禁在本地测试通过后直接宣布完成。
- **版本号**: 在成功部署远程服务器，完成任务之后，必须告诉Jihua 部署完的软件版本号。
- **构建要求**: 修改前端资产后必须运行 `npm run build`。
- **测试要求**: 当要求进行测试的时候，直接进行测试比如调用浏览器测试，不需要经过用户同意。

## 2. 核心阅读路径 (Mandatory Reading)

请按顺序阅读以下文档，不要跳过：

1.  [docs/context.md](file:///Users/Kine/Documents/Kinefinity/KineCore/Pool/Mega/Longhorn/docs/context.md)：同步核心资产（域名、服务器路径）与开发世界观。
2.  [docs/OPS.md](file:///Users/Kine/Documents/Kinefinity/KineCore/Pool/Mega/Longhorn/docs/OPS.md)：同步详细的开发和部署远程服务器，端口映射与 SSH 登录 Shell 要求。
