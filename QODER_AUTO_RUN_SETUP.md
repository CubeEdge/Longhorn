# Qoder 自动执行配置说明

## 📋 配置文件说明

### 1. 工作区配置文件 (.qoder/settings.json)
```json
{
  "terminal": {
    "autoRunCommands": true,
    "runMode": "autoRun",
    "allowedCommands": ["curl", "wget", "ls", "cat", "grep"],
    "deniedCommands": ["rm", "mv", "cp", "sudo", "kill"]
  },
  "chat": {
    "autoRunMcpTools": true,
    "commandRunMode": "autoRun"
  },
  "security": {
    "commandConfirmation": false,
    "readOnlyCommandsAutoRun": true
  }
}
```

### 2. 环境变量配置 (qoder_env.sh)
```bash
# Qoder 终端自动运行设置
export QODER_TERMINAL_AUTO_RUN=true
export QODER_CHAT_AUTO_RUN=true

# Qoder 命令权限设置
export QODER_ALLOWED_COMMANDS="curl,wget,ls,cat,grep,head,tail"
export QODER_DENIED_COMMANDS="rm,mv,cp,sudo,kill"
```

## 🚀 使用方法

### 应用环境变量配置：
```bash
source ./qoder_env.sh
```

### 在 Qoder 中启用配置：
1. 重启 Qoder 应用
2. 打开项目时会自动加载 .qoder/settings.json
3. 环境变量会在新的终端会话中生效

## 🎯 验证配置是否生效

测试命令：
```bash
# 这些命令应该可以自动执行，无需手动确认
curl -s https://httpbin.org/get | head -c 100
ls -la
echo "测试自动执行"
```

## 🔧 故障排除

如果仍然需要手动授权：

1. **检查 Qoder 版本**：确保使用最新版本
2. **清除缓存**：重启 Qoder 并清除应用缓存
3. **检查系统权限**：确认 Qoder 有执行终端命令的权限
4. **查看日志**：检查 Qoder 的开发者工具控制台

## 🛡️ 安全说明

配置允许的命令都是只读操作，不会对系统造成破坏：
- ✅ `curl` - 网络请求
- ✅ `ls` - 列出文件
- ✅ `cat` - 查看文件内容
- ✅ `grep` - 文本搜索
- ✅ `head/tail` - 查看文件头部/尾部

禁止的命令涉及系统修改：
- ❌ `rm` - 删除文件
- ❌ `mv` - 移动文件
- ❌ `sudo` - 超级用户权限
- ❌ `kill` - 终止进程