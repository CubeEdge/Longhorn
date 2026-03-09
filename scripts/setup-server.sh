#!/bin/bash

# ==========================================
# Server Setup Script for Longhorn
# Run this on the remote server once
# ==========================================

set -e

echo "🚀 Setting up Longhorn server..."

# Configuration
REMOTE_PATH="${1:-/Users/admin/Documents/server/Longhorn}"
NODE_VERSION="20"

echo "📁 Creating directories..."
mkdir -p "$REMOTE_PATH"
mkdir -p "$REMOTE_PATH/logs"
mkdir -p "$REMOTE_PATH/data"
mkdir -p "$REMOTE_PATH/uploads"

echo "🔧 Checking Node.js..."
if ! command -v node &> /dev/null; then
    echo "Installing Node.js ${NODE_VERSION}..."
    if [[ "$OSTYPE" == "darwin"* ]]; then
        # macOS
        if ! command -v brew &> /dev/null; then
            echo "Installing Homebrew..."
            /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
        fi
        brew install node@${NODE_VERSION}
    else
        # Linux
        curl -fsSL https://deb.nodesource.com/setup_${NODE_VERSION}.x | sudo -E bash -
        sudo apt-get install -y nodejs
    fi
fi

echo "📦 Installing PM2..."
npm install -g pm2

echo "🐳 Installing Docker (optional)..."
if ! command -v docker &> /dev/null; then
    if [[ "$OSTYPE" == "darwin"* ]]; then
        echo "Please install Docker Desktop for Mac manually"
    else
        curl -fsSL https://get.docker.com | sh
        sudo usermod -aG docker $USER
    fi
fi

echo "✅ Server setup complete!"
echo ""
echo "Next steps:"
echo "  1. Copy your .env file to $REMOTE_PATH/server/"
echo "  2. Run deployment script from local machine:"
echo "     ./scripts/deploy.sh --full"
