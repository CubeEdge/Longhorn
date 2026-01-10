#!/bin/bash
# SSH 登录 Mini 服务器并自动切换到 Longhorn 目录
# Usage: ./ssh-mini.sh 或 ssh-mini (如果添加了 alias)

ssh -t mini "cd /Users/admin/Documents/server/Longhorn && exec zsh -l"
