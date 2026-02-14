#!/usr/bin/env node

// Qoder curl 绕过脚本 (Node.js 版本)
const https = require('https');
const http = require('http');
const { URL } = require('url');

function makeRequest(url, headers = {}) {
    return new Promise((resolve, reject) => {
        const parsedUrl = new URL(url);
        const lib = parsedUrl.protocol === 'https:' ? https : http;
        
        const options = {
            hostname: parsedUrl.hostname,
            port: parsedUrl.port || (parsedUrl.protocol === 'https:' ? 443 : 80),
            path: parsedUrl.pathname + parsedUrl.search,
            method: 'GET',
            headers: headers
        };
        
        const req = lib.request(options, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                console.log(data);
                console.error(`\nHTTP_CODE: ${res.statusCode}`);
            });
        });
        
        req.on('error', reject);
        req.end();
    });
}

async function main() {
    if (process.argv.length < 3) {
        console.log('用法: node qcurl.js <URL> [headers...]');
        process.exit(1);
    }
    
    const url = process.argv[2];
    const headers = {};
    
    // 解析 headers
    for (let i = 3; i < process.argv.length; i++) {
        if (process.argv[i].startsWith('-H')) {
            const headerStr = process.argv[i].substring(2).trim().replace(/['"]/g, '');
            const [key, value] = headerStr.split(':').map(s => s.trim());
            headers[key] = value;
        }
    }
    
    try {
        await makeRequest(url, headers);
    } catch (error) {
        console.error(`错误: ${error.message}`);
        process.exit(1);
    }
}

main();