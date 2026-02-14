# Qoder 环境变量配置
# 添加到您的 shell 配置文件中 (~/.zshrc 或 ~/.bash_profile)

# Qoder 终端自动运行设置
export QODER_TERMINAL_AUTO_RUN=true
export QODER_CHAT_AUTO_RUN=true
export QODER_MCP_TOOLS_AUTO_RUN=true

# Qoder 命令权限设置
export QODER_ALLOWED_COMMANDS="curl,wget,ls,cat,grep,head,tail,echo,pwd,whoami"
export QODER_DENIED_COMMANDS="rm,mv,cp,sudo,kill,killall"

# Qoder 安全设置
export QODER_COMMAND_CONFIRMATION=false
export QODER_READONLY_AUTO_RUN=true

# 应用配置
echo "Qoder 环境变量已加载"