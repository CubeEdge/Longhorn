const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs-extra');
const multer = require('multer');
const archiver = require('archiver');
const sharp = require('sharp');
const crypto = require('crypto');

module.exports = function (db, authenticate, DISK_A, THUMB_DIR, RECYCLE_DIR, upload, chunkUpload) {

    // Middleware: Ensure only Internal users can access Files
    const checkInternalUser = (req, res, next) => {
        if (!req.user || req.user.user_type !== 'Internal') {
            return res.status(403).json({ error: 'Access denied: Internal users only' });
        }
        next();
    };

    router.use(authenticate);
    router.use(checkInternalUser);

    // ==========================================
    // Constants & Helpers
    // ==========================================
    const NAME_TO_CODE = {
        '市场部': 'MS',
        '运营部': 'OP',
        '研发部': 'RD',
        '通用台面': 'RE'
    };

    const DEPT_DISPLAY_MAP = {
        'OP': '运营部 (OP)',
        'MS': '市场部 (MS)',
        'RD': '研发部 (RD)',
        'RE': '通用台面 (RE)'
    };

    // Resolve Path logic
    const resolvePath = (userPath) => {
        if (!userPath) return '';
        // Prevent directory traversal
        const safePath = userPath.replace(/\.\./g, '').replace(/^\/+/, '');
        return safePath;
    };

    // Permission Check Logic from index.js
    const hasPermission = (user, folderPath, accessType = 'Read') => {
        if (user.role === 'Admin') return true;
        const normalizedPath = folderPath.replace(/\\/g, '/').replace(/^\/+|\/+$/g, '');

        // 1. Check personal space
        if (normalizedPath.toLowerCase().startsWith(`members/${user.username.toLowerCase()}`)) return true;

        // 2. Check department space
        let deptName = user.department_name;
        const codeMatch = deptName ? deptName.match(/\(([A-Za-z]+)\)$/) : null;
        if (codeMatch) deptName = codeMatch[1];
        else if (deptName && NAME_TO_CODE[deptName]) deptName = NAME_TO_CODE[deptName];

        if (deptName) {
            const deptNameLower = deptName.toLowerCase();
            const normLower = normalizedPath.toLowerCase();
            if (normLower === deptNameLower || normLower.startsWith(deptNameLower + '/')) {
                // Member check: Read/Contributor
                if (user.role === 'Lead') return true;
                // Basic Members have Read access to Department Root unless overridden
                if (user.role === 'Member' && (accessType === 'Read' || accessType === 'Contributor')) return true;
            }
        }

        // 3. Check explicit permissions table
        try {
            const parts = normalizedPath.split('/');
            let currentPath = '';
            for (const part of parts) {
                currentPath = currentPath ? `${currentPath}/${part}` : part;
                const perm = db.prepare(`
                    SELECT access_type FROM permissions 
                    WHERE user_id = ? AND folder_path = ?
                    AND (expires_at IS NULL OR expires_at > datetime('now'))
                `).get(user.id, currentPath);

                if (perm) {
                    if (perm.access_type === 'Full') return true;
                    if (perm.access_type === 'Contribute' && accessType !== 'Full') return true;
                    if (perm.access_type === 'Read' && accessType === 'Read') return true;
                }
            }
        } catch (err) { }

        return false;
    };

    // Helper: Move to Recycle Bin
    async function moveItemToRecycle(subPath, userId) {
        const fullPath = path.join(DISK_A, subPath);
        if (!fs.existsSync(fullPath)) return;

        const stats = fs.statSync(fullPath);
        const fileName = path.basename(subPath);
        const deletedName = `${Date.now()}_${fileName}`;
        const deletedPath = path.join(RECYCLE_DIR, deletedName);

        await fs.ensureDir(RECYCLE_DIR);
        await fs.move(fullPath, deletedPath);

        db.prepare(`
            INSERT INTO recycle_bin (name, original_path, deleted_path, user_id, is_directory)
            VALUES (?, ?, ?, ?, ?)
        `).run(fileName, subPath, deletedName, userId, stats.isDirectory() ? 1 : 0);

        // Clean up stats
        db.prepare('DELETE FROM file_stats WHERE path = ? OR path LIKE ?').run(subPath, subPath + '/%');
        db.prepare('DELETE FROM access_logs WHERE path = ? OR path LIKE ?').run(subPath, subPath + '/%');
    }

    // Helper: Get Folder Size
    const getFolderSize = (dirPath) => {
        let size = 0;
        try {
            const items = fs.readdirSync(dirPath);
            for (const item of items) {
                if (item.startsWith('.')) continue;
                const fullPath = path.join(dirPath, item);
                try {
                    const stats = fs.statSync(fullPath);
                    if (stats.isDirectory()) {
                        size += getFolderSize(fullPath);
                    } else {
                        size += stats.size;
                    }
                } catch (e) { }
            }
        } catch (err) { }
        return size;
    };

    // ==========================================
    // ROUTES
    // ==========================================

    // 1. MAIN FILE LIST (GET /files)
    // Supports Aliases, Search, ETag, Metadata
    router.get('/files', async (req, res) => {
        const requestedPath = req.query.path || '';
        let subPath = resolvePath(requestedPath);

        // Auto-fix: Force non-Admins to personal space if asking for 'Members' root
        if (subPath.toLowerCase() === 'members' && req.user.role !== 'Admin') {
            subPath = `Members/${req.user.username}`;
        }

        const fullPath = path.join(DISK_A, subPath);

        // Check Read permissions
        const hasRead = hasPermission(req.user, subPath, 'Read');
        // allow empty path if it's dashboard request, handled by "files" empty return + authorized
        // But dashboard usually calls /api/files?path=
        // if no permission, check if root. 
        if (!hasRead) {
            if (requestedPath === '' || requestedPath === '/') {
                // Dashboard Mode: Return Authorized Roots as "files" or special struct?
                // Original index.js logic implies /api/files handles real folders.
                // If permission denied at root, it just errors.
                // Dashboard likely uses /api/files without path to check access?
                return res.status(403).json({ error: 'Permission denied' });
            }
            return res.status(403).json({ error: 'Permission denied' });
        }

        // Handle Download Param
        if (req.query.download === 'true') {
            if (fs.existsSync(fullPath) && fs.statSync(fullPath).isFile()) {
                db.prepare(`
                    UPDATE file_stats SET accessed_count = accessed_count + 1, last_accessed = CURRENT_TIMESTAMP
                    WHERE path = ?
                `).run(subPath);
                return res.download(fullPath);
            } else {
                return res.status(404).json({ error: 'File not found' });
            }
        }

        try {
            const canWrite = hasPermission(req.user, subPath, 'Full') || hasPermission(req.user, subPath, 'Contributor');
            let items = [];
            try {
                if (fs.existsSync(fullPath) && fs.statSync(fullPath).isDirectory()) {
                    items = (await fs.readdir(fullPath, { withFileTypes: true }))
                        .filter(item => !item.name.startsWith('.'));
                }
            } catch (e) {
                items = [];
            }

            // Generate ETag data
            const etagData = items.map(item => {
                const fullItemPath = path.join(fullPath, item.name);
                try {
                    const stats = fs.statSync(fullItemPath);
                    return `${item.name}-${stats.mtime.getTime()}-${item.isDirectory() ? 'dir' : stats.size}`;
                } catch (e) { return item.name; }
            }).join('|');
            const userStarredCount = db.prepare('SELECT COUNT(*) as count FROM starred_files WHERE user_id = ?').get(req.user.id)?.count || 0;
            const etag = 'W/"' + crypto.createHash('md5').update(etagData + '|starred:' + userStarredCount + '|' + Date.now()).digest('hex') + '"';
            res.setHeader('ETag', etag);

            const result = items.map(item => {
                const itemPath = path.join(subPath, item.name).normalize('NFC');
                const fullItemPath = path.join(fullPath, item.name);
                let stats;
                try { stats = fs.statSync(fullItemPath); } catch (e) { return null; }
                if (!stats) return null;

                // Alias Matching Logic
                const pathVariants = [itemPath, itemPath.normalize('NFC'), itemPath.normalize('NFD')];
                Object.entries(DEPT_DISPLAY_MAP).forEach(([code, displayName]) => {
                    if (itemPath.startsWith(code + '/') || itemPath === code) {
                        pathVariants.push(itemPath.replace(code, displayName));
                    } else if (itemPath.startsWith(displayName + '/') || itemPath === displayName) {
                        pathVariants.push(itemPath.replace(displayName, code));
                    }
                });
                const uniqueVariants = [...new Set(pathVariants)];
                const placeholders = uniqueVariants.map(() => '?').join(',');

                let dbStats = db.prepare(`
                    SELECT s.accessed_count as access_count, u.username as uploader 
                    FROM file_stats s 
                    LEFT JOIN users u ON s.uploaded_by = u.id 
                    WHERE s.path IN (${placeholders})
                `).get(...uniqueVariants);

                if (!dbStats) {
                    dbStats = db.prepare(`
                        SELECT s.accessed_count as access_count, u.username as uploader 
                        FROM file_stats s 
                        LEFT JOIN users u ON s.uploaded_by = u.id 
                        WHERE s.path LIKE ? ESCAPE '\\' LIMIT 1
                    `).get(`%/${item.name}`);
                }

                // Starred Check
                const starredRecord = db.prepare(`
                    SELECT 1 FROM starred_files 
                    WHERE user_id = ? AND (file_path = ? OR file_path LIKE ? OR file_path = ?)
                `).get(req.user.id, itemPath, `%/${item.name}`, item.name);

                return {
                    name: item.name,
                    isDirectory: item.isDirectory(),
                    path: itemPath, // Relative path
                    size: item.isDirectory() ? getFolderSize(fullItemPath) : stats.size,
                    mtime: stats.mtime,
                    access_count: dbStats ? dbStats.access_count : 0,
                    uploader: dbStats ? dbStats.uploader : 'unknown',
                    starred: !!starredRecord
                };
            }).filter(i => i !== null);

            res.json({ items: result, userCanWrite: canWrite });
        } catch (err) {
            console.error('[FILES] Error:', err);
            res.status(500).json({ error: err.message });
        }
    });

    // 2. FILES STATS (For Info Panel)
    router.get('/files/stats', (req, res) => {
        const { path: filePath } = req.query;
        if (!filePath) return res.status(400).json({ error: 'Path required' });

        const fileStat = db.prepare('SELECT uploaded_by FROM file_stats WHERE path = ?').get(filePath);
        const isOwner = fileStat && fileStat.uploaded_by === req.user.id;

        if (!isOwner && !hasPermission(req.user, filePath, 'Full')) {
            return res.status(403).json({ error: 'Permission denied' });
        }

        try {
            const stats = db.prepare(`
                SELECT l.count, l.last_access, u.username
                FROM access_logs l
                JOIN users u ON l.user_id = u.id
                WHERE l.path = ?
                ORDER BY l.last_access DESC
            `).all(filePath);
            res.json(stats);
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    });

    // 3. HIT (Record Access)
    router.post('/files/hit', (req, res) => {
        const { path: itemPath } = req.body;
        try {
            db.prepare(`
                INSERT INTO file_stats(path, accessed_count, last_accessed)
                VALUES(?, 1, CURRENT_TIMESTAMP)
                ON CONFLICT(path) DO UPDATE SET
                accessed_count = accessed_count + 1, last_accessed = CURRENT_TIMESTAMP
            `).run(itemPath);

            db.prepare(`
                INSERT INTO access_logs(path, user_id, count, last_access)
                VALUES(?, ?, 1, CURRENT_TIMESTAMP)
                ON CONFLICT(path, user_id) DO UPDATE SET
                count = count + 1, last_access = CURRENT_TIMESTAMP
            `).run(itemPath, req.user.id);

            res.json({ success: true });
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    });

    // 4. CREATE FOLDER
    router.post('/folders', async (req, res) => {
        const { path: requestedSubPath, name } = req.body;
        const subPath = resolvePath(requestedSubPath || '');
        const targetPath = path.join(subPath, name);

        if (!hasPermission(req.user, targetPath, 'Full') && !hasPermission(req.user, targetPath, 'Contributor')) {
            return res.status(403).json({ error: 'No permission to create folder here' });
        }

        try {
            const fullPath = path.join(DISK_A, targetPath);
            if (fs.existsSync(fullPath)) return res.status(400).json({ error: 'Folder already exists' });
            await fs.ensureDir(fullPath);
            db.prepare('INSERT OR REPLACE INTO file_stats (path, uploaded_by) VALUES (?, ?)').run(targetPath.normalize('NFC'), req.user.id);
            res.json({ success: true });
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    });
    // Alias for compatibility
    router.post('/create-folder', async (req, res) => {
        const { currentPath, folderName } = req.body;
        req.body.path = currentPath;
        req.body.name = folderName;
        // Reuse logic above by calling handler or copying. Copying for safety.
        const subPath = resolvePath(currentPath || '');
        const targetPath = path.join(subPath, folderName);
        if (!hasPermission(req.user, targetPath, 'Full') && !hasPermission(req.user, targetPath, 'Contributor')) return res.status(403).json({ error: 'No write permission' });
        try {
            const fullPath = path.join(DISK_A, targetPath);
            if (fs.existsSync(fullPath)) return res.status(400).json({ error: 'Folder already exists' });
            await fs.ensureDir(fullPath);
            db.prepare('INSERT OR REPLACE INTO file_stats (path, uploaded_by) VALUES (?, ?)').run(targetPath.normalize('NFC'), req.user.id);
            res.json({ success: true });
        } catch (e) { res.status(500).json({ error: e.message }); }
    });


    // 5. FOLDER TREE (Move Dialog)
    router.get('/folders/tree', async (req, res) => {
        try {
            const buildTree = (dirPath = '') => {
                const fullPath = path.join(DISK_A, dirPath);
                const nodes = [];
                if (!fs.existsSync(fullPath)) return nodes;
                if (dirPath !== '' && dirPath.toLowerCase() !== 'members' && !hasPermission(req.user, dirPath, 'Read')) return nodes;

                const items = fs.readdirSync(fullPath).filter(name => !name.startsWith('.'));
                for (const item of items) {
                    const itemPath = path.join(dirPath, item);
                    const itemFullPath = path.join(DISK_A, itemPath);
                    try {
                        const stat = fs.statSync(itemFullPath);
                        if (stat.isDirectory()) {
                            const isMembers = itemPath.toLowerCase() === 'members';
                            if (hasPermission(req.user, itemPath, 'Full') || hasPermission(req.user, itemPath, 'Contributor') || isMembers) {
                                const node = {
                                    path: itemPath,
                                    name: item,
                                    children: buildTree(itemPath)
                                };
                                if (!isMembers || node.children.length > 0) nodes.push(node);
                            }
                        }
                    } catch (e) { }
                }
                return nodes;
            };

            const tree = buildTree('');
            res.json([{ path: '', name: '根目录', children: tree }]);
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    });

    // 6. UPLOAD (POST /upload) & CHUNKED
    router.post('/upload', upload.array('files'), (req, res) => {
        const requestedPath = req.query.path || '';
        let subPath = resolvePath(requestedPath);
        if (!subPath || subPath === '') subPath = `Members/${req.user.username}`;
        if (subPath.toLowerCase() === 'members' && req.user.role !== 'Admin') subPath = `Members/${req.user.username}`;

        if (!hasPermission(req.user, subPath, 'Full') && !hasPermission(req.user, subPath, 'Contributor')) {
            return res.status(403).json({ error: 'No write permission' });
        }

        const uploadTargetDir = path.join(DISK_A, subPath);
        fs.ensureDirSync(uploadTargetDir);

        try {
            const insertStmt = db.prepare(`
                INSERT OR REPLACE INTO file_stats (path, uploaded_at, uploaded_by, accessed_count, last_accessed)
                VALUES (?, ?, ?, COALESCE((SELECT accessed_count FROM file_stats WHERE path = ?), 0), COALESCE((SELECT last_accessed FROM file_stats WHERE path = ?), CURRENT_TIMESTAMP))
            `);
            const transaction = db.transaction((files) => {
                files.forEach(file => {
                    const itemPath = path.join(subPath, file.originalname);
                    const normalizedPath = itemPath.normalize('NFC').replace(/\\/g, '/');
                    insertStmt.run(normalizedPath, new Date().toISOString(), req.user.id, normalizedPath, normalizedPath);
                });
            });
            transaction(req.files);
            res.json({ success: true });
        } catch (err) {
            console.error('Upload error:', err);
            res.status(500).json({ error: 'Failed' });
        }
    });

    // Chunked routes
    router.post('/upload/check-chunks', async (req, res) => {
        try {
            const { uploadId, totalChunks } = req.body;
            const chunkDir = path.join(DISK_A, '.chunks', uploadId);
            const existingChunks = [];
            if (fs.existsSync(chunkDir)) {
                for (let i = 0; i < parseInt(totalChunks); i++) {
                    if (fs.existsSync(path.join(chunkDir, `${i}`))) existingChunks.push(i);
                }
            }
            res.json({ success: true, existingChunks });
        } catch (e) { res.status(500).json({ error: e.message }); }
    });

    router.post('/upload/chunk', chunkUpload.single('chunk'), async (req, res) => {
        try {
            const { uploadId, chunkIndex } = req.body;
            const chunkDir = path.join(DISK_A, '.chunks', uploadId);
            fs.ensureDirSync(chunkDir);
            fs.moveSync(req.file.path, path.join(chunkDir, `${chunkIndex}`), { overwrite: true });
            res.json({ success: true, chunkIndex: parseInt(chunkIndex) });
        } catch (e) { res.status(500).json({ error: e.message }); }
    });

    router.post('/upload/merge', async (req, res) => {
        try {
            const { uploadId, fileName, totalChunks, path: uploadPath } = req.body;
            let subPath = resolvePath(uploadPath || '');
            if (!subPath || subPath === '') subPath = `Members/${req.user.username}`;
            // Permission check same as upload
            if (!hasPermission(req.user, subPath, 'Full') && !hasPermission(req.user, subPath, 'Contributor')) return res.status(403).json({ error: 'No permissions' });

            const chunkDir = path.join(DISK_A, '.chunks', uploadId);
            const targetDir = path.join(DISK_A, subPath);
            fs.ensureDirSync(targetDir);
            const finalPath = path.join(targetDir, fileName);
            const writeStream = fs.createWriteStream(finalPath);

            for (let i = 0; i < parseInt(totalChunks); i++) {
                const chunkPath = path.join(chunkDir, `${i}`);
                if (!fs.existsSync(chunkPath)) {
                    writeStream.destroy();
                    return res.status(400).json({ error: `Missing chunk ${i}` });
                }
                writeStream.write(fs.readFileSync(chunkPath));
            }
            writeStream.end();

            await new Promise((resolve, reject) => {
                writeStream.on('finish', resolve);
                writeStream.on('error', reject);
            });
            fs.removeSync(chunkDir);

            // DB Record
            const itemPath = path.join(subPath, fileName);
            const normPath = itemPath.normalize('NFC').replace(/\\/g, '/');
            db.prepare(`
                INSERT OR REPLACE INTO file_stats (path, uploaded_at, uploaded_by, accessed_count, last_accessed)
                VALUES (?, ?, ?, COALESCE((SELECT accessed_count FROM file_stats WHERE path = ?), 0), COALESCE((SELECT last_accessed FROM file_stats WHERE path = ?), CURRENT_TIMESTAMP))
            `).run(normPath, new Date().toISOString(), req.user.id, normPath, normPath);

            res.json({ success: true, path: normPath });
        } catch (e) { res.status(500).json({ error: e.message }); }
    });

    // 7. BATCH DOWNLOAD
    router.post('/download-batch', async (req, res) => {
        const { paths } = req.body;
        if (!Array.isArray(paths) || paths.length === 0) return res.status(400).json({ error: 'Paths array required' });

        const validFiles = [];
        for (const subPath of paths) {
            if (!hasPermission(req.user, subPath, 'Read')) continue;
            const fullPath = path.join(DISK_A, subPath);
            if (fs.existsSync(fullPath)) {
                validFiles.push({ fullPath, name: path.basename(subPath) });
            }
        }

        if (validFiles.length === 0) return res.status(404).json({ error: 'No valid files' });

        res.attachment('batch_download.zip');
        const archive = archiver('zip', { zlib: { level: 9 } });
        archive.pipe(res);
        validFiles.forEach(f => {
            const stats = fs.statSync(f.fullPath);
            if (stats.isDirectory()) archive.directory(f.fullPath, f.name);
            else archive.file(f.fullPath, { name: f.name });
        });
        archive.finalize();
    });

    // 8. RENAME
    router.post('/files/rename', async (req, res) => {
        const { path: filePath, newName } = req.body;
        if (!filePath || !newName) return res.status(400).json({ error: 'Args missing' });

        const safeOldPath = resolvePath(filePath);
        const parentDir = path.dirname(safeOldPath);
        if (!hasPermission(req.user, parentDir, 'Full') && !hasPermission(req.user, parentDir, 'Contributor')) return res.status(403).json({ error: 'Denied' });

        const safeNewPath = path.join(parentDir, newName);
        try {
            const oldFullPath = path.join(DISK_A, safeOldPath);
            const newFullPath = path.join(DISK_A, safeNewPath);
            if (!fs.existsSync(oldFullPath)) return res.status(404).json({ error: 'File not found' });
            if (fs.existsSync(newFullPath)) return res.status(400).json({ error: 'Target exists' });

            await fs.rename(oldFullPath, newFullPath);
            db.prepare('UPDATE file_stats SET path = ? WHERE path = ?').run(safeNewPath.replace(/\\/g, '/'), safeOldPath.replace(/\\/g, '/'));
            res.json({ success: true });
        } catch (e) { res.status(500).json({ error: e.message }); }
    });
    // Alias /rename just in case
    router.post('/rename', (req, res) => {
        req.body.path = req.body.oldPath; // Adapter
        const { oldPath, newName } = req.body;
        const p = oldPath || req.body.path;
        if (!p || !newName) return res.status(400).json({ error: 'Missing args' });

        const safeOldPath = resolvePath(p);
        const parentDir = path.dirname(safeOldPath);
        if (!hasPermission(req.user, parentDir, 'Full') && !hasPermission(req.user, parentDir, 'Contributor')) return res.status(403).json({ error: 'Permissions' });
        const safeNewPath = path.join(parentDir, newName);
        const oldFullPath = path.join(DISK_A, safeOldPath);
        const newFullPath = path.join(DISK_A, safeNewPath);
        if (!fs.existsSync(oldFullPath)) return res.status(404).json({ error: 'File not found' });
        if (fs.existsSync(newFullPath)) return res.status(400).json({ error: 'Exists' });
        fs.renameSync(oldFullPath, newFullPath);
        db.prepare('UPDATE file_stats SET path = ? WHERE path = ?').run(safeNewPath.replace(/\\/g, '/'), safeOldPath.replace(/\\/g, '/'));
        res.json({ success: true });
    });

    // 9. DELETE & BULK DELETE
    router.delete('/files', async (req, res) => {
        const filePath = req.query.path;
        const safePath = resolvePath(filePath);
        if (!hasPermission(req.user, path.dirname(safePath), 'Full')) return res.status(403).json({ error: 'Denied' });
        await moveItemToRecycle(safePath, req.user.id);
        res.json({ success: true });
    });
    // Alias /delete
    router.delete('/delete', async (req, res) => {
        const filePath = req.query.path;
        const safePath = resolvePath(filePath);
        if (!hasPermission(req.user, path.dirname(safePath), 'Full')) return res.status(403).json({ error: 'Denied' });
        await moveItemToRecycle(safePath, req.user.id);
        res.json({ success: true });
    });

    router.post('/files/bulk-delete', async (req, res) => {
        const { paths } = req.body;
        if (!Array.isArray(paths)) return res.status(400).json({ error: 'Paths array required' });
        let deletedCount = 0;
        const failedItems = [];
        for (const subPath of paths) {
            if (hasPermission(req.user, subPath, 'Full')) {
                await moveItemToRecycle(subPath, req.user.id);
                deletedCount++;
            } else {
                failedItems.push(path.basename(subPath));
            }
        }
        res.json({ success: true, deletedCount, failedItems });
    });


    // 10. COPY
    router.post('/files/copy', async (req, res) => {
        const { sourcePath, targetDir } = req.body;
        if (!sourcePath || !targetDir) {
            return res.status(400).json({ error: 'sourcePath and targetDir required' });
        }

        // Check read permission on source
        if (!hasPermission(req.user, sourcePath, 'Read') &&
            !hasPermission(req.user, sourcePath, 'Contributor') &&
            !hasPermission(req.user, sourcePath, 'Full')) {
            return res.status(403).json({ error: 'No permission to read source file' });
        }

        // Check write permission on target
        if (!hasPermission(req.user, targetDir, 'Full') && !hasPermission(req.user, targetDir, 'Contributor')) {
            return res.status(403).json({ error: 'No write permission for target directory' });
        }

        try {
            const sourceFullPath = path.join(DISK_A, sourcePath);
            const fileName = path.basename(sourcePath);
            let targetFileName = fileName;
            let targetFullPath = path.join(DISK_A, targetDir, targetFileName);

            // Check if source exists
            if (!await fs.pathExists(sourceFullPath)) {
                return res.status(404).json({ error: 'Source file not found' });
            }

            // Handle name conflict - add (copy) suffix
            let copyNum = 0;
            while (await fs.pathExists(targetFullPath)) {
                copyNum++;
                const ext = path.extname(fileName);
                const base = path.basename(fileName, ext);
                targetFileName = `${base} (copy${copyNum > 1 ? ' ' + copyNum : ''})${ext}`;
                targetFullPath = path.join(DISK_A, targetDir, targetFileName);
            }

            // Perform copy
            await fs.copy(sourceFullPath, targetFullPath);

            // Copy file_stats if exists (with new uploader)
            const sourceStat = db.prepare('SELECT * FROM file_stats WHERE path = ?').get(sourcePath);
            const newPath = path.join(targetDir, targetFileName).normalize('NFC').replace(/\\/g, '/');

            if (sourceStat) {
                db.prepare(`
                    INSERT OR REPLACE INTO file_stats (path, uploaded_at, accessed_count, uploaded_by, last_accessed, size)
                    VALUES (?, ?, 0, ?, datetime('now'), ?)
                `).run(newPath, new Date().toISOString(), req.user.id, sourceStat.size);
            }

            res.json({ success: true, newPath: newPath });
        } catch (err) {
            console.error('[Copy] Error:', err);
            res.status(500).json({ error: err.message });
        }
    });

    // 11. BULK MOVE
    router.post('/files/bulk-move', async (req, res) => {
        const { paths, targetDir: requestedTargetDir } = req.body;
        if (!Array.isArray(paths) || requestedTargetDir === undefined) return res.status(400).json({ error: 'Paths and targetDir required' });

        const targetDir = resolvePath(requestedTargetDir);

        if (!hasPermission(req.user, targetDir, 'Full') && !hasPermission(req.user, targetDir, 'Contributor')) {
            return res.status(403).json({ error: 'No write permission for target directory' });
        }

        try {
            const failedItems = [];
            let movedCount = 0;

            for (const subPath of paths) {
                let canMove = false;
                // 1. Admin/Full permission always allows move
                if (hasPermission(req.user, subPath, 'Full')) {
                    canMove = true;
                }
                // 2. Contributor permission + Ownership check (or if they have Full on parent?)
                // Actually, moving requires Write on Source Parent (delete) and Write on Target (create).
                // Simplified check: If you have Full on item (implies parent access usually) OR you own it and have Contributor
                else if (hasPermission(req.user, subPath, 'Contributor')) {
                    const fileStat = db.prepare('SELECT uploaded_by FROM file_stats WHERE path = ?').get(subPath);
                    if (fileStat && fileStat.uploaded_by === req.user.id) {
                        canMove = true;
                    }
                }

                if (canMove) {
                    const fileName = path.basename(subPath);
                    const oldFullPath = path.join(DISK_A, subPath);
                    const newSubPath = path.join(targetDir, fileName).normalize('NFC').replace(/\\/g, '/');
                    const newFullPath = path.join(DISK_A, newSubPath);

                    if (oldFullPath === newFullPath) continue;

                    await fs.move(oldFullPath, newFullPath, { overwrite: true });

                    // Update database records
                    db.prepare('UPDATE file_stats SET path = ? WHERE path = ?').run(newSubPath, subPath);
                    // Also update starts/access logs?
                    // db.prepare('UPDATE access_logs SET path = ? WHERE path = ?').run(newSubPath, subPath);
                    // Starred files?
                    db.prepare('UPDATE starred_files SET file_path = ? WHERE file_path = ?').run(newSubPath, subPath);

                    movedCount++;
                } else {
                    failedItems.push(path.basename(subPath));
                }
            }
            res.json({ success: true, movedCount, failedItems });
        } catch (err) {
            console.error('[Bulk Move] Error:', err);
            res.status(500).json({ error: err.message });
        }
    });

    return router;
};
