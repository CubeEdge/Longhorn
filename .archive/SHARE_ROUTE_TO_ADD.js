// Share link access page - Add BEFORE the catch-all route

app.get('/s/:token', async (req, res) => {
    try {
        const { token } = req.params;
        const { password } = req.query;

        const shareLink = db.prepare('SELECT * FROM share_links WHERE share_token = ?').get(token);

        if (!shareLink) {
            return res.status(404).send(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>链接不存在</title>
                <style>body{font-family:sans-serif;max-width:600px;margin:100px auto;text-align:center;padding:20px;}</style>
                </head><body><h1>❌ 分享链接不存在</h1><p>该链接可能已被删除或无效</p></body></html>`);
        }

        // Check expiration
        if (shareLink.expires_at && new Date(shareLink.expires_at) < new Date()) {
            return res.status(410).send(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>链接已过期</title>
                <style>body{font-family:sans-serif;max-width:600px;margin:100px auto;text-align:center;padding:20px;}</style>
                </head><body><h1>⏰ 分享链接已过期</h1><p>该链接已超过有效期</p></body></html>`);
        }

        // Check password
        if (shareLink.password) {
            if (!password) {
                return res.send(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>需要密码</title>
                    <style>body{font-family:sans-serif;max-width:500px;margin:100px auto;padding:20px;}
                    input,button{padding:12px;font-size:16px;width:100%;margin:10px 0;border-radius:8px;box-sizing:border-box;}
                    button{background:#FFD200;border:none;cursor:pointer;font-weight:bold;}</style>
                    </head><body><h2>🔒 该文件需要密码访问</h2><form method="GET">
                    <input type="password" name="password" placeholder="请输入访问密码" required>
                    <button type="submit">访问</button></form></body></html>`);
            }

            const passwordValid = bcrypt.compareSync(password, shareLink.password);
            if (!passwordValid) {
                return res.send(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>密码错误</title>
                    <style>body{font-family:sans-serif;max-width:500px;margin:100px auto;padding:20px;}
                    input,button{padding:12px;font-size:16px;width:100%;margin:10px 0;border-radius:8px;box-sizing:border-box;}
                    button{background:#FFD200;border:none;cursor:pointer;font-weight:bold;}.error{color:red;margin-bottom:10px;}</style>
                    </head><body><h2>🔒 该文件需要密码访问</h2><p class="error">❌ 密码错误，请重试</p><form method="GET">
                    <input type="password" name="password" placeholder="请输入访问密码" required>
                    <button type="submit">访问</button></form></body></html>`);
            }
        }

        // Update access stats
        db.prepare('UPDATE share_links SET access_count = access_count + 1, last_accessed = datetime("now") WHERE id = ?').run(shareLink.id);

        const fileName = path.basename(shareLink.file_path);
        const filePath = path.join(DISK_A, shareLink.file_path);

        if (!fs.existsSync(filePath)) {
            return res.status(404).send(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>文件不存在</title>
                <style>body{font-family:sans-serif;max-width:600px;margin:100px auto;text-align:center;padding:20px;}</style>
                </head><body><h1>❌ 文件不存在</h1><p>原文件可能已被移动或删除</p></body></html>`);
        }

        // Serve download page
        res.send(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>${fileName}</title>
            <style>body{font-family:sans-serif;max-width:600px;margin:100px auto;padding:20px;text-align:center;}
            .file-icon{font-size:64px;margin:20px 0;}.filename{font-size:24px;font-weight:bold;margin:20px 0;word-break:break-all;}
            .info{color:#666;margin:10px 0;}button{background:#FFD200;color:#000;border:none;padding:15px 40px;
            font-size:18px;font-weight:bold;cursor:pointer;border-radius:8px;margin-top:30px;}button:hover{background:#FFC100;}</style>
            </head><body><div class="file-icon">📄</div><div class="filename">${fileName}</div>
            <div class="info">访问次数: ${shareLink.access_count + 1}</div>
            ${shareLink.expires_at ? `<div class="info">过期时间: ${new Date(shareLink.expires_at).toLocaleString('zh-CN')}</div>` : ''}
            <button onclick="window.location.href='/api/download-share/${token}${password ? '?password=' + encodeURIComponent(password) : ''}'">⬇️ 下载文件</button>
            </body></html>`);
    } catch (err) {
        console.error('[Share /s/:token] Error:', err);
        res.status(500).send('服务器错误');
    }
});

// Download shared file API
app.get('/api/download-share/:token', (req, res) => {
    try {
        const { token } = req.params;
        const { password } = req.query;
        const shareLink = db.prepare('SELECT * FROM share_links WHERE share_token = ?').get(token);

        if (!shareLink || (shareLink.expires_at && new Date(shareLink.expires_at) < new Date())) {
            return res.status(404).json({ error: 'Link not found or expired' });
        }
        if (shareLink.password && (!password || !bcrypt.compareSync(password, shareLink.password))) {
            return res.status(403).json({ error: 'Invalid password' });
        }

        const filePath = path.join(DISK_A, shareLink.file_path);
        if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'File not found' });

        res.download(filePath);
    } catch (err) {
        console.error('[Share Download] Error:', err);
        res.status(500).json({ error: 'Download failed' });
    }
});
