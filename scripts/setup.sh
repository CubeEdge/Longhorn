#!/bin/bash

# Longhorn M1 Server Setup Script
# 用于一键初始化 Mac mini M1 生产环境

set -e

echo "🚀 开始初始化 Longhorn 生产环境..."

# 1. 检查并安装 Homebrew
if ! command -v brew &> /dev/null; then
    echo "📦 正在安装 Homebrew (可能需要输入开机密码)..."
    /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
    
    # 将 brew 添加到 PATH (针对 M1 Mac)
    if [[ $(uname -m) == "arm64" ]]; then
        echo 'eval "$(/opt/homebrew/bin/brew shellenv)"' >> ~/.zprofile
        eval "$(/opt/homebrew/bin/brew shellenv)"
    fi
else
    echo "✅ Homebrew 已安装"
    # 深度清理任何可能的锁定冲突
    echo "🧹 强制解除 Homebrew 进程与文件锁定..."
    pgrep -f "brew" | xargs kill -9 2>/dev/null || true
    BR_CACHE=$(brew --cache)
    # 增加对受损 API 缓存的清理 (解决 jws.json 报错的核心)
    rm -rf "$BR_CACHE/api" 2>/dev/null || true
    rm -rf "$BR_CACHE/downloads"/*.incomplete 2>/dev/null || true
    rm -f "$BR_CACHE"/*.lock 2>/dev/null || true
    rm -rf /Users/admin/Library/Caches/Homebrew/downloads/*.incomplete 2>/dev/null || true
fi

# 1.5 强制更新 Homebrew 仓库 (解决 jws.json 报错)
echo "🔄 正在同步与重置 Homebrew 缓存..."
brew update --force || true

# 2. 安装 Node.js (强力模式：优先二进制，失败则使用官方安装包)
if ! command -v node &> /dev/null; then
    echo "🟢 正在尝试通过 Homebrew 安装预编译版 Node.js..."
    # 强制只使用预编译包，禁止本地编译 LLVM 等重型依赖
    if ! brew install --only-bottle node; then
        echo "⚠️ Homebrew 无法获取预编译包。正在切换到官方安装程序 (快速且无需编译)..."
        curl -O https://nodejs.org/dist/v22.13.0/node-v22.13.0.pkg
        sudo installer -pkg node-v22.13.0.pkg -target /
        rm node-v22.13.0.pkg
    fi
else
    echo "✅ Node.js $(node -v) 已安装"
fi

# 3. 安装 Git
if ! command -v git &> /dev/null; then
    echo "📂 正在安装 Git..."
    brew install git
else
    echo "✅ Git 已安装"
fi

# 4. 安装 PM2 (进程管理)
if ! command -v pm2 &> /dev/null; then
    echo "🔄 正在安装 PM2 (可能需要输入开机密码审批)..."
    sudo npm install -g pm2
else
    echo "✅ PM2 已安装"
fi

# 5. 安装 Cloudflared (针对 opware.kineraw.com 隧道)
if ! command -v cloudflared &> /dev/null; then
    echo "☁️ 正在安装 Cloudflare Tunnel (M1 预编译版)..."
    # 尝试 Homebrew (不强制 bottle，防止报错)
    if ! brew install cloudflared; then
        echo "⚠️ Homebrew 安装失败，手动获取 M1 (arm64) 官方二进制文件..."
        curl -L https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-darwin-arm64.tgz | tar xz
        sudo mv cloudflared /usr/local/bin/
        chmod +x /usr/local/bin/cloudflared
    fi
else
    echo "✅ Cloudflare Tunnel 已安装"
fi

# 6. 安装项目依赖并构建
echo "🏗️ 正在检测项目完整性..."
MISSING=0
if [ ! -f "package.json" ]; then echo "❌ 缺失文件: package.json"; MISSING=1; fi
if [ ! -d "client" ]; then echo "❌ 缺失文件夹: client"; MISSING=1; fi
if [ ! -d "server" ]; then echo "❌ 缺失文件夹: server"; MISSING=1; fi

if [ $MISSING -eq 1 ]; then
    echo "----------------------------------------------------"
    echo "🚨 错误: 项目结构不完整！"
    echo "请确保您从 MBAir 拷贝的是整个 Longhorn 文件夹，包含以下内容："
    echo "  - client/  (文件夹)"
    echo "  - server/  (文件夹)"
    echo "  - package.json (文件)"
    echo "  - setup.sh (文件)"
    echo "----------------------------------------------------"
    echo "当前目录下的内容如下："
    ls -F
    exit 1
fi

echo "🏗️ 结构完整，开始安装项目依赖与执行构建..."
npm run install-all
npm run build-client

echo "----------------------------------------------------"
echo "🎉 环境初始化完成！"
echo "下一步操作建议："
echo "1. 执行 'pm2 start server/index.js --name longhorn' 启动服务器"
echo "2. 执行 'cloudflared tunnel login' 开始配置公网隧道"
echo "----------------------------------------------------"
