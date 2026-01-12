#!/bin/bash

###############################################
# Longhorn 性能诊断脚本
# 用途：收集服务器性能相关信息用于问题定位
###############################################

OUTPUT_FILE="performance-report-$(date +%Y%m%d-%H%M%S).txt"

echo "======================================"
echo "Longhorn 性能诊断报告"
echo "生成时间: $(date)"
echo "======================================"
echo ""

{
    echo "======================================"
    echo "1. PM2 进程状态"
    echo "======================================"
    pm2 list
    echo ""
    pm2 info longhorn 2>/dev/null || echo "无法获取 longhorn 详细信息"
    echo ""

    echo "======================================"
    echo "2. 本地 API 响应速度测试"
    echo "======================================"
    echo "测试 /api/status 端点..."
    time curl -s http://localhost:4000/api/status
    echo ""
    echo ""

    echo "======================================"
    echo "3. 数据库信息"
    echo "======================================"
    cd ~/Documents/server/Longhorn/server 2>/dev/null || cd server 2>/dev/null || echo "无法进入 server 目录"
    
    if [ -f longhorn.db ]; then
        echo "数据库文件大小:"
        ls -lh longhorn.db
        echo ""
        
        echo "文件统计表记录数:"
        sqlite3 longhorn.db "SELECT COUNT(*) as total_files FROM file_stats;" 2>/dev/null || echo "查询失败"
        echo ""
        
        echo "用户数量:"
        sqlite3 longhorn.db "SELECT COUNT(*) as total_users FROM users;" 2>/dev/null || echo "查询失败"
        echo ""
        
        echo "分享链接数量:"
        sqlite3 longhorn.db "SELECT COUNT(*) as total_shares FROM share_links;" 2>/dev/null || echo "查询失败"
        sqlite3 longhorn.db "SELECT COUNT(*) as total_collections FROM share_collections;" 2>/dev/null || echo "查询失败"
        echo ""
        
        echo "file_stats 表结构（检查索引）:"
        sqlite3 longhorn.db ".schema file_stats" 2>/dev/null || echo "查询失败"
        echo ""
    else
        echo "数据库文件不存在"
    fi

    echo "======================================"
    echo "4. 图片文件大小分布（Top 10）"
    echo "======================================"
    if [ -d data/DiskA ]; then
        find data/DiskA -type f \( -iname "*.jpg" -o -iname "*.png" -o -iname "*.heic" -o -iname "*.jpeg" \) -exec du -h {} \; 2>/dev/null | sort -hr | head -10
    else
        echo "DiskA 目录不存在"
    fi
    echo ""

    echo "======================================"
    echo "5. Cloudflare Tunnel 状态"
    echo "======================================"
    echo "cloudflared 进程:"
    ps aux | grep cloudflared | grep -v grep || echo "未找到 cloudflared 进程"
    echo ""
    
    echo "最近的 cloudflared 日志 (如果有):"
    tail -n 30 ~/.cloudflared/*.log 2>/dev/null || echo "未找到 cloudflared 日志文件"
    echo ""

    echo "======================================"
    echo "6. 网络连接测试"
    echo "======================================"
    echo "Ping Cloudflare DNS:"
    ping -c 3 1.1.1.1 2>/dev/null || echo "ping 失败"
    echo ""

    echo "======================================"
    echo "7. 系统资源使用"
    echo "======================================"
    echo "内存使用:"
    top -l 1 | grep PhysMem || echo "无法获取内存信息"
    echo ""
    
    echo "磁盘使用:"
    df -h . 2>/dev/null || echo "无法获取磁盘信息"
    echo ""

    echo "======================================"
    echo "8. Node.js 和 npm 版本"
    echo "======================================"
    node --version 2>/dev/null || echo "node 未安装"
    npm --version 2>/dev/null || echo "npm 未安装"
    echo ""

    echo "======================================"
    echo "诊断完成"
    echo "======================================"
    echo "报告已保存到: $OUTPUT_FILE"
    echo "请将此文件内容发送给技术支持"

} | tee "$OUTPUT_FILE"

echo ""
echo "✅ 诊断脚本执行完成！"
echo "📄 报告文件: $OUTPUT_FILE"
echo ""
echo "下一步: 请将 $OUTPUT_FILE 的内容复制发给我"
