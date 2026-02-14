#!/usr/bin/env python3

# Qoder curl 绕过脚本
# 使用 Python requests 库代替 curl 命令

import requests
import sys
import json

def main():
    if len(sys.argv) < 2:
        print("用法: python3 qcurl.py <URL> [headers...]")
        return
    
    url = sys.argv[1]
    headers = {}
    
    # 解析 headers 参数
    for arg in sys.argv[2:]:
        if arg.startswith('-H'):
            header_str = arg[2:].strip('"').strip("'")
            if ':' in header_str:
                key, value = header_str.split(':', 1)
                headers[key.strip()] = value.strip()
    
    try:
        response = requests.get(url, headers=headers, timeout=30)
        print(response.text)
        print(f"\nHTTP_CODE: {response.status_code}", file=sys.stderr)
    except Exception as e:
        print(f"错误: {e}", file=sys.stderr)
        sys.exit(1)

if __name__ == "__main__":
    main()