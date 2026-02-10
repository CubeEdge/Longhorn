/**
 * Knowledge Base Routes
 * Knowledge articles with visibility tiers
 * Phase 3: Knowledge base system
 */

const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const pdf = require('pdf-parse');
const axios = require('axios');
const cheerio = require('cheerio');
const TurndownService = require('turndown');
const { gfm } = require('turndown-plugin-gfm');
const crypto = require('crypto');
const { execSync } = require('child_process');

// Configure multer for PDF uploads
const upload = multer({
    dest: '/tmp/knowledge_uploads',
    limits: { fileSize: 50 * 1024 * 1024 }, // 50MB
    fileFilter: (req, file, cb) => {
        if (file.mimetype === 'application/pdf') {
            cb(null, true);
        } else {
            cb(new Error('Only PDF files are allowed'));
        }
    }
});

// Configure multer for DOCX uploads
const docxUpload = multer({
    dest: '/tmp/knowledge_uploads',
    limits: { fileSize: 50 * 1024 * 1024 }, // 50MB
    fileFilter: (req, file, cb) => {
        const allowedMimes = [
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            'application/msword'
        ];
        if (allowedMimes.includes(file.mimetype) || file.originalname.endsWith('.docx') || file.originalname.endsWith('.doc')) {
            cb(null, true);
        } else {
            cb(new Error('Only DOCX/DOC files are allowed'));
        }
    }
});

module.exports = function(db, authenticate) {
    const router = express.Router();
    
    // 审计日志函数（从 knowledge_audit 路由注入）
    let logAudit = null;
    let generateBatchId = null;
    
    // 设置审计日志函数（由 service/index.js 调用）
    router.setAuditLogger = (logFn, batchIdFn) => {
        logAudit = logFn;
        generateBatchId = batchIdFn;
    };

    /**
     * GET /api/v1/knowledge
     * List knowledge articles with visibility filtering
     */
    router.get('/', authenticate, (req, res) => {
        try {
            const {
                page = 1,
                page_size = 20,
                category,
                product_line,
                visibility,
                status = 'Published',
                search,
                tag
            } = req.query;

            const user = req.user;
            let conditions = ['ka.status = ?'];
            let params = [status];

            // Visibility filtering based on user type
            const visibilityConditions = buildVisibilityConditions(user);
            conditions.push(`(${visibilityConditions.sql})`);
            params.push(...visibilityConditions.params);

            if (category) {
                conditions.push('ka.category = ?');
                params.push(category);
            }
            if (product_line) {
                conditions.push('ka.product_line = ?');
                params.push(product_line);
            }
            if (visibility && (user.role === 'Admin' || user.role === 'Lead')) {
                conditions.push('ka.visibility = ?');
                params.push(visibility);
            }
            if (tag) {
                conditions.push('ka.tags LIKE ?');
                params.push(`%"${tag}"%`);
            }

            const whereClause = `WHERE ${conditions.join(' AND ')}`;

            // Full-text search if provided
            let searchJoin = '';
            if (search) {
                searchJoin = `
                    INNER JOIN knowledge_articles_fts fts ON fts.rowid = ka.id
                    AND fts MATCH ?
                `;
                params.unshift(search);
            }

            const countSql = `
                SELECT COUNT(*) as total 
                FROM knowledge_articles ka
                ${searchJoin}
                ${whereClause}
            `;
            const total = db.prepare(countSql).get(...params).total;

            const offset = (parseInt(page) - 1) * parseInt(page_size);
            const sql = `
                SELECT 
                    ka.id, ka.title, ka.slug, ka.summary,
                    ka.category, ka.subcategory, ka.tags,
                    ka.product_line, ka.product_models, ka.visibility,
                    ka.view_count, ka.helpful_count, ka.not_helpful_count,
                    ka.published_at, ka.created_at,
                    u.username as author_name
                FROM knowledge_articles ka
                ${searchJoin}
                LEFT JOIN users u ON ka.created_by = u.id
                ${whereClause}
                ORDER BY ka.published_at DESC, ka.created_at DESC
                LIMIT ? OFFSET ?
            `;

            const articles = db.prepare(sql).all(...params, parseInt(page_size), offset);

            res.json({
                success: true,
                data: articles.map(formatArticleListItem),
                meta: {
                    page: parseInt(page),
                    page_size: parseInt(page_size),
                    total,
                    total_pages: Math.ceil(total / parseInt(page_size))
                }
            });
        } catch (err) {
            console.error('[Knowledge] List error:', err);
            res.status(500).json({
                success: false,
                error: { code: 'SERVER_ERROR', message: err.message }
            });
        }
    });

    /**
     * GET /api/v1/knowledge/:idOrSlug
     * Get article detail
     */
    router.get('/:idOrSlug', authenticate, (req, res) => {
        try {
            const { idOrSlug } = req.params;
            const isNumeric = /^\d+$/.test(idOrSlug);

            const article = db.prepare(`
                SELECT ka.*, u.username as author_name, updater.username as updated_by_name
                FROM knowledge_articles ka
                LEFT JOIN users u ON ka.created_by = u.id
                LEFT JOIN users updater ON ka.updated_by = updater.id
                WHERE ${isNumeric ? 'ka.id = ?' : 'ka.slug = ?'}
            `).get(idOrSlug);

            if (!article) {
                return res.status(404).json({
                    success: false,
                    error: { code: 'NOT_FOUND', message: '文章不存在' }
                });
            }

            // Check visibility permission
            if (!canAccessArticle(req.user, article)) {
                return res.status(403).json({
                    success: false,
                    error: { code: 'FORBIDDEN', message: '无权访问此文章' }
                });
            }

            // Increment view count
            db.prepare('UPDATE knowledge_articles SET view_count = view_count + 1 WHERE id = ?').run(article.id);

            // Get related articles
            const relatedArticles = db.prepare(`
                SELECT ka.id, ka.title, ka.slug, ka.category, kal.link_type
                FROM knowledge_article_links kal
                JOIN knowledge_articles ka ON ka.id = kal.target_article_id
                WHERE kal.source_article_id = ? AND ka.status = 'Published'
            `).all(article.id);

            res.json({
                success: true,
                data: {
                    ...formatArticleDetail(article),
                    related_articles: relatedArticles.map(a => ({
                        id: a.id,
                        title: a.title,
                        slug: a.slug,
                        category: a.category,
                        link_type: a.link_type
                    })),
                    permissions: {
                        can_edit: canEditArticle(req.user, article)
                    }
                }
            });
        } catch (err) {
            console.error('[Knowledge] Detail error:', err);
            res.status(500).json({
                success: false,
                error: { code: 'SERVER_ERROR', message: err.message }
            });
        }
    });

    /**
     * POST /api/v1/knowledge
     * Create new article (Internal users only)
     */
    router.post('/', authenticate, (req, res) => {
        try {
            if (req.user.user_type !== 'Employee') {
                return res.status(403).json({
                    success: false,
                    error: { code: 'FORBIDDEN', message: '只有内部员工可以创建文章' }
                });
            }

            const {
                title,
                slug,
                summary,
                content,
                category,
                subcategory,
                tags = [],
                product_line,
                product_models = [],
                firmware_versions = [],
                visibility = 'Internal',
                department_ids = [],
                status = 'Draft'
            } = req.body;

            if (!title || !content || !category) {
                return res.status(400).json({
                    success: false,
                    error: { code: 'VALIDATION_ERROR', message: '缺少必填字段: title, content, category' }
                });
            }

            // Generate slug if not provided
            const finalSlug = slug || generateSlug(title);

            const result = db.prepare(`
                INSERT INTO knowledge_articles (
                    title, slug, summary, content,
                    category, subcategory, tags,
                    product_line, product_models, firmware_versions,
                    visibility, department_ids,
                    status, published_at,
                    created_by
                ) VALUES (
                    ?, ?, ?, ?,
                    ?, ?, ?,
                    ?, ?, ?,
                    ?, ?,
                    ?, ?,
                    ?
                )
            `).run(
                title, finalSlug, summary || null, content,
                category, subcategory || null, JSON.stringify(tags),
                product_line || null, JSON.stringify(product_models), JSON.stringify(firmware_versions),
                visibility, JSON.stringify(department_ids),
                status, status === 'Published' ? new Date().toISOString() : null,
                req.user.id
            );

            // 记录审计日志
            if (logAudit) {
                logAudit({
                    operation: 'create',
                    operation_detail: status === 'Published' ? '创建并发布' : '创建草稿',
                    article_id: result.lastInsertRowid,
                    article_title: title,
                    article_slug: finalSlug,
                    category,
                    product_line,
                    product_models,
                    new_status: status,
                    source_type: 'Text',
                    user_id: req.user.id,
                    user_name: req.user.username,
                    user_role: req.user.role
                });
            }

            res.status(201).json({
                success: true,
                data: {
                    id: result.lastInsertRowid,
                    slug: finalSlug,
                    status,
                    created_at: new Date().toISOString()
                }
            });
        } catch (err) {
            console.error('[Knowledge] Create error:', err);
            if (err.message.includes('UNIQUE constraint failed')) {
                return res.status(400).json({
                    success: false,
                    error: { code: 'DUPLICATE_SLUG', message: '文章别名已存在' }
                });
            }
            res.status(500).json({
                success: false,
                error: { code: 'SERVER_ERROR', message: err.message }
            });
        }
    });

    /**
     * POST /api/v1/knowledge/import/pdf
     * Import knowledge from PDF file
     */
    router.post('/import/pdf', authenticate, upload.single('pdf'), async (req, res) => {
        try {
            if (req.user.user_type !== 'Employee') {
                return res.status(403).json({
                    success: false,
                    error: { code: 'FORBIDDEN', message: '只有内部员工可以导入知识' }
                });
            }

            if (!req.file) {
                return res.status(400).json({
                    success: false,
                    error: { code: 'NO_FILE', message: '请上传PDF文件' }
                });
            }

            const {
                title_prefix,
                category = 'Manual',
                product_line = 'Cinema',
                product_models,
                visibility = 'Dealer',
                tags
            } = req.body;

            // Parse PDF
            const dataBuffer = fs.readFileSync(req.file.path);
            const pdfData = await pdf(dataBuffer);

            console.log(`[Knowledge Import] PDF parsed: ${pdfData.numpages} pages, ${pdfData.text.length} chars`);

            // Extract images from PDF
            const imagesDir = path.join(__dirname, '../../data/knowledge_images');
            if (!fs.existsSync(imagesDir)) {
                fs.mkdirSync(imagesDir, { recursive: true });
            }
            
            console.log('[Knowledge Import] Extracting images...');
            const images = await extractPDFImages(req.file.path, imagesDir);
            console.log(`[Knowledge Import] Extracted ${images.length} images`);

            // Split content into sections (simple version - by page breaks or size)
            let sections = splitPDFContent(pdfData.text, title_prefix || req.file.originalname);
            
            // Insert image references into sections
            if (images.length > 0) {
                sections = insertImageReferences(sections, images);
            }

            console.log(`[Knowledge Import] Split into ${sections.length} sections`);

            const productModelsArray = product_models ? JSON.parse(product_models) : [];
            const tagsArray = tags ? tags.split(',').map(t => t.trim()).filter(Boolean) : [];

            // Insert articles
            const pdfFilename = req.file.originalname;
            const insertStmt = db.prepare(`
                INSERT INTO knowledge_articles (
                    title, slug, summary, content, category,
                    product_line, product_models, tags, visibility, status,
                    source_type, source_reference,
                    created_by, created_at, updated_at, published_at
                ) VALUES (
                    @title, @slug, @summary, @content, @category,
                    @product_line, @product_models, @tags, @visibility, 'Published',
                    'PDF', @source_reference,
                    @created_by, datetime('now'), datetime('now'), datetime('now')
                )
            `);

            const checkDuplicateStmt = db.prepare('SELECT id FROM knowledge_articles WHERE slug = ?');

            let imported_count = 0;
            let skipped_count = 0;
            let failed_count = 0;
            const article_ids = [];

            for (const section of sections) {
                try {
                    const slug = generateSlug(section.title);

                    // Check duplicate
                    const existing = checkDuplicateStmt.get(slug);
                    if (existing) {
                        skipped_count++;
                        continue;
                    }

                    const result = insertStmt.run({
                        title: section.title,
                        slug,
                        summary: section.content.substring(0, 200).trim(),
                        content: section.content,
                        category,
                        product_line,
                        product_models: JSON.stringify(productModelsArray),
                        tags: JSON.stringify([...tagsArray, product_line, category]),
                        visibility,
                        source_reference: pdfFilename,
                        created_by: req.user.id
                    });

                    article_ids.push(result.lastInsertRowid);
                    imported_count++;
                } catch (err) {
                    console.error(`[Knowledge Import] Failed to insert section: ${section.title}`, err);
                    failed_count++;
                }
            }

            // Cleanup uploaded file
            fs.unlinkSync(req.file.path);

            res.json({
                success: true,
                data: {
                    imported_count,
                    skipped_count,
                    failed_count,
                    article_ids
                }
            });
        } catch (err) {
            console.error('[Knowledge Import] Error:', err);
            // Cleanup uploaded file on error
            if (req.file && fs.existsSync(req.file.path)) {
                fs.unlinkSync(req.file.path);
            }
            res.status(500).json({
                success: false,
                error: { code: 'IMPORT_ERROR', message: err.message }
            });
        }
    });

    /**
     * POST /api/v1/knowledge/import/docx
     * Import knowledge from DOCX file using python-docx workflow
     * 支持两种方式：
     * 1. 直接上传：multipart/form-data with 'docx' file
     * 2. 分块上传后合并：form-data with 'mergedFilePath'
     */
    router.post('/import/docx', authenticate, docxUpload.single('docx'), async (req, res) => {
        try {
            if (req.user.role !== 'Admin' && req.user.role !== 'Lead' && req.user.role !== 'Editor') {
                return res.status(403).json({
                    success: false,
                    error: { code: 'FORBIDDEN', message: '只有内部员工可以导入知识' }
                });
            }

            // 支持两种方式：1. 直接上传 2. 分块合并后的文件
            let docxPath;
            let originalFilename;
            let fileSize;
            
            if (req.body.mergedFilePath) {
                // 分块上传后合并的文件
                const DISK_A = path.resolve(__dirname, '../../data/DiskA');
                docxPath = path.join(DISK_A, req.body.mergedFilePath);
                
                console.log('[DOCX Import] Merged file path:', docxPath);
                
                if (!fs.existsSync(docxPath)) {
                    console.error('[DOCX Import] File not found at:', docxPath);
                    return res.status(400).json({
                        success: false,
                        error: { code: 'FILE_NOT_FOUND', message: '合并的文件不存在' }
                    });
                }
                
                originalFilename = path.basename(docxPath);
                fileSize = fs.statSync(docxPath).size;
                console.log(`[DOCX Import] Using merged file: ${docxPath}`);
            } else if (req.file) {
                // 直接上传的文件
                docxPath = req.file.path;
                originalFilename = req.file.originalname;
                fileSize = req.file.size;
            } else {
                return res.status(400).json({
                    success: false,
                    error: { code: 'NO_FILE', message: '请上传DOCX文件' }
                });
            }

            const {
                title_prefix,
                category = 'Manual',
                product_line = 'A',
                product_models,
                visibility = 'Public',
                tags
            } = req.body;

            console.log(`[DOCX Import] Starting import: ${originalFilename}`);
            console.log(`[DOCX Import] Product line: ${product_line}, Models: ${product_models}`);

            const timestamp = Date.now();
            const tempDir = `/tmp/docx_import_${timestamp}`;
            const mdPath = path.join(tempDir, 'output.md');
            const imagesDir = path.join(__dirname, '../../data/knowledge_images');
            
            // 创建临时目录
            fs.mkdirSync(tempDir, { recursive: true });
            if (!fs.existsSync(imagesDir)) {
                fs.mkdirSync(imagesDir, { recursive: true });
            }

            // 步骤1: 调用Python脚本转换DOCX→MD
            console.log('[DOCX Import] Step 1: Converting DOCX to Markdown...');
            const convertScript = path.join(__dirname, '../../scripts/docx_to_markdown.py');
            
            let stats = { image_count: 0, table_count: 0, heading_count: 0 };
            try {
                // 使用绝对路径python3，并设置环境变量
                const convertOutput = execSync(
                    `/usr/bin/python3 "${convertScript}" "${docxPath}" "${mdPath}" "${imagesDir}"`,
                    { 
                        encoding: 'utf-8', 
                        maxBuffer: 10 * 1024 * 1024,
                        env: { 
                            ...process.env, 
                            PYTHONPATH: '/Users/admin/Library/Python/3.9/lib/python/site-packages',
                            PATH: process.env.PATH + ':/usr/bin:/usr/local/bin'
                        }
                    }
                );
                console.log('[DOCX Import] Conversion output:', convertOutput);
                
                // 解析转换统计数据
                const imageMatch = convertOutput.match(/图片数[:|：]\s*(\d+)/);
                const tableMatch = convertOutput.match(/表格数[:|：]\s*(\d+)/);
                const headingMatch = convertOutput.match(/标题数[:|：]\s*(\d+)/);
                
                stats = {
                    image_count: imageMatch ? parseInt(imageMatch[1]) : 0,
                    table_count: tableMatch ? parseInt(tableMatch[1]) : 0,
                    heading_count: headingMatch ? parseInt(headingMatch[1]) : 0
                };
                
                console.log('[DOCX Import] Statistics:', stats);
                
            } catch (convertErr) {
                console.error('[DOCX Import] Conversion failed:', convertErr.message);
                throw new Error(`DOCX转换失败: ${convertErr.message}`);
            }

            // 步骤2: 读取Markdown内容
            if (!fs.existsSync(mdPath)) {
                throw new Error('Markdown文件生成失败');
            }
            
            const mdContent = fs.readFileSync(mdPath, 'utf-8');
            console.log(`[DOCX Import] Step 2: Markdown generated (${mdContent.length} chars)`);

            // 步骤3: 按章节分割
            console.log('[DOCX Import] Step 3: Splitting into chapters...');
            const productModelsArray = product_models ? JSON.parse(product_models) : [];
            const userSelectedModel = productModelsArray.length > 0 ? productModelsArray[0] : null;
            const chapters = splitMarkdownIntoChapters(mdContent, userSelectedModel, title_prefix);
            console.log(`[DOCX Import] Found ${chapters.length} chapters`);
            
            // 检测文档标题与用户选择是否一致
            let titleMismatch = null;
            if (chapters.length > 0 && userSelectedModel) {
                const firstChapterTitle = chapters[0].title.toLowerCase();
                const selectedModelLower = userSelectedModel.toLowerCase();
                
                // 检查是否包含其他产品型号关键词
                const allModels = ['edge 6k', 'edge 8k', 'mark2 lf', 'mark2 s35', 'mavo lf', 'mavo s35', 'terra 4k', 'terra 6k'];
                const detectedModels = allModels.filter(model => 
                    firstChapterTitle.includes(model) && !selectedModelLower.includes(model)
                );
                
                if (detectedModels.length > 0) {
                    titleMismatch = {
                        selected: userSelectedModel,
                        detected: detectedModels[0],
                        firstTitle: chapters[0].title
                    };
                    console.log('[DOCX Import] ⚠️  Title mismatch detected:', titleMismatch);
                }
            }

            if (chapters.length === 0) {
                throw new Error('未找到任何章节，请检查文档结构');
            }

            // 步骤4: 导入到数据库
            console.log('[DOCX Import] Step 4: Importing to database...');
            const tagsArray = tags ? tags.split(',').map(t => t.trim()).filter(Boolean) : [];

            const insertStmt = db.prepare(`
                INSERT INTO knowledge_articles (
                    title, slug, summary, content, category,
                    product_line, product_models, tags, visibility, status,
                    source_type, source_reference,
                    created_by, created_at, updated_at, published_at
                ) VALUES (
                    @title, @slug, @summary, @content, @category,
                    @product_line, @product_models, @tags, @visibility, 'Published',
                    'DOCX', @source_reference,
                    @created_by, datetime('now'), datetime('now'), datetime('now')
                )
            `);

            const checkDuplicateStmt = db.prepare('SELECT id FROM knowledge_articles WHERE slug = ?');

            let imported_count = 0;
            let skipped_count = 0;
            let failed_count = 0;
            const article_ids = [];

            for (const chapter of chapters) {
                try {
                    const slug = generateSlug(chapter.title);

                    // 检查重复
                    const existing = checkDuplicateStmt.get(slug);
                    if (existing) {
                        console.log(`[DOCX Import] Skipped duplicate: ${chapter.title}`);
                        skipped_count++;
                        continue;
                    }

                    // 生成摘要（移除Markdown图片语法）
                    const summaryText = chapter.content
                        .replace(/!\[.*?\]\(.*?\)/g, '') // 移除图片
                        .replace(/\n+/g, ' ') // 合并换行
                        .trim()
                        .substring(0, 200);

                    const result = insertStmt.run({
                        title: chapter.title,
                        slug,
                        summary: summaryText,
                        content: chapter.content,
                        category,
                        product_line,
                        product_models: JSON.stringify(productModelsArray),
                        tags: JSON.stringify([...tagsArray, product_line, category]),
                        visibility,
                        source_reference: originalFilename,
                        created_by: req.user.id
                    });

                    article_ids.push(result.lastInsertRowid);
                    imported_count++;
                    console.log(`[DOCX Import] Imported: ${chapter.title} (ID: ${result.lastInsertRowid})`);
                } catch (err) {
                    console.log(`[DOCX Import] Failed to insert: ${chapter.title}`, err);
                    failed_count++;
                }
            }

            // 清理临时文件
            if (req.file && fs.existsSync(req.file.path)) {
                fs.unlinkSync(req.file.path);
            }
            if (req.body.mergedFilePath && fs.existsSync(docxPath)) {
                fs.unlinkSync(docxPath); // 删除合并后的文件
            }
            if (fs.existsSync(tempDir)) {
                fs.rmSync(tempDir, { recursive: true, force: true });
            }

            console.log(`[DOCX Import] Completed: ${imported_count} imported, ${skipped_count} skipped, ${failed_count} failed`);

            // 如果检测到标题不匹配,在响应中包含警告
            const responseData = {
                success: true,
                data: {
                    imported_count,
                    skipped_count,
                    failed_count,
                    article_ids,
                    stats
                }
            };
            
            if (titleMismatch) {
                responseData.warning = {
                    type: 'title_mismatch',
                    message: `文档标题中检测到"${titleMismatch.detected}",但您选择的是"${titleMismatch.selected}"`,
                    details: titleMismatch
                };
            }

            // 记录批量导入审计日志
            if (logAudit && generateBatchId && imported_count > 0) {
                const batchId = generateBatchId();
                const productModelsArray = product_models ? JSON.parse(product_models) : [];
                
                // 为每篇成功导入的文章记录日志
                for (let i = 0; i < Math.min(article_ids.length, chapters.length); i++) {
                    const articleId = article_ids[i];
                    const chapter = chapters.find((c, idx) => idx === i);
                    if (chapter) {
                        logAudit({
                            operation: 'import',
                            operation_detail: `DOCX导入 - 批次${batchId.substring(0,8)}`,
                            article_id: articleId,
                            article_title: chapter.title,
                            article_slug: generateSlug(chapter.title),
                            category,
                            product_line,
                            product_models: productModelsArray,
                            new_status: 'Published',
                            source_type: 'DOCX',
                            source_reference: originalFilename,
                            batch_id: batchId,
                            user_id: req.user.id,
                            user_name: req.user.username,
                            user_role: req.user.role
                        });
                    }
                }
            }

            res.json(responseData);
        } catch (err) {
            console.error('[DOCX Import] Error:', err);
            // 清理上传文件
            if (req.file && fs.existsSync(req.file.path)) {
                fs.unlinkSync(req.file.path);
            }
            res.status(500).json({
                success: false,
                error: { code: 'IMPORT_ERROR', message: err.message }
            });
        }
    });

    /**
     * POST /api/v1/knowledge/import/url
     * Import knowledge from web page URL
     */
    router.post('/import/url', authenticate, async (req, res) => {
        try {
            if (req.user.user_type !== 'Employee') {
                return res.status(403).json({
                    success: false,
                    error: { code: 'FORBIDDEN', message: '只有内部员工可以导入知识' }
                });
            }

            const {
                url,
                title,
                category = 'Application Note',
                product_line,
                product_models = [],
                visibility = 'Public',
                tags = []
            } = req.body;

            if (!url) {
                return res.status(400).json({
                    success: false,
                    error: { code: 'NO_URL', message: '请提供URL' }
                });
            }

            console.log(`[Knowledge Import URL] Fetching: ${url}`);

            // Fetch webpage
            const response = await axios.get(url, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
                    'Accept': 'text/html,application/xhtml+xml'
                },
                timeout: 30000
            });

            const html = response.data;
            const $ = cheerio.load(html);

            // Extract meaningful content
            const extractedContent = extractWebContent($, url);

            if (!extractedContent.content || extractedContent.content.length < 100) {
                return res.status(400).json({
                    success: false,
                    error: { code: 'NO_CONTENT', message: '无法提取有效内容' }
                });
            }
            
            // Download images from webpage
            console.log('[Knowledge Import URL] Downloading images...');
            const imagesDir = path.join(__dirname, '../../data/knowledge_images');
            if (!fs.existsSync(imagesDir)) {
                fs.mkdirSync(imagesDir, { recursive: true });
            }
            
            const downloadedImages = await downloadWebImages($, url, imagesDir);
            console.log(`[Knowledge Import URL] Downloaded ${downloadedImages.length} images`);

            // Convert HTML to Markdown
            const turndownService = new TurndownService({
                headingStyle: 'atx',
                codeBlockStyle: 'fenced'
            });
            turndownService.use(gfm); // Support tables

            let markdown = turndownService.turndown(extractedContent.content);
            
            // Replace image URLs with local paths
            downloadedImages.forEach(img => {
                markdown = markdown.replace(img.original, img.local);
            });

            // Generate article
            const articleTitle = title || extractedContent.title || 'Web Import';
            const slug = generateSlug(articleTitle);

            // Check duplicate
            const existing = db.prepare('SELECT id FROM knowledge_articles WHERE slug = ?').get(slug);
            if (existing) {
                return res.json({
                    success: true,
                    data: {
                        imported_count: 0,
                        skipped_count: 1,
                        failed_count: 0,
                        article_ids: [],
                        message: '文章已存在'
                    }
                });
            }

            // Insert article
            const insertResult = db.prepare(`
                INSERT INTO knowledge_articles (
                    title, slug, summary, content, category,
                    product_line, product_models, tags, visibility, status,
                    source_type, source_reference, source_url,
                    created_by, created_at, updated_at, published_at
                ) VALUES (
                    @title, @slug, @summary, @content, @category,
                    @product_line, @product_models, @tags, @visibility, 'Published',
                    'URL', @source_reference, @source_url,
                    @created_by, datetime('now'), datetime('now'), datetime('now')
                )
            `).run({
                title: articleTitle,
                slug,
                summary: extractedContent.summary || markdown.substring(0, 200),
                content: markdown,
                category,
                product_line: product_line || 'General',
                product_models: JSON.stringify(product_models),
                tags: JSON.stringify([...tags, 'Web Import', category]),
                visibility,
                source_reference: extractedContent.title || articleTitle,
                source_url: url,
                created_by: req.user.id
            });

            console.log(`[Knowledge Import URL] Success: ${articleTitle}`);

            res.json({
                success: true,
                data: {
                    imported_count: 1,
                    skipped_count: 0,
                    failed_count: 0,
                    article_ids: [insertResult.lastInsertRowid]
                }
            });
        } catch (err) {
            console.error('[Knowledge Import URL] Error:', err);
            res.status(500).json({
                success: false,
                error: { code: 'IMPORT_ERROR', message: err.message }
            });
        }
    });

    /**
     * PATCH /api/v1/knowledge/:id
     * Update article
     */
    router.patch('/:id', authenticate, (req, res) => {
        try {
            const article = db.prepare('SELECT * FROM knowledge_articles WHERE id = ?').get(req.params.id);
            if (!article) {
                return res.status(404).json({
                    success: false,
                    error: { code: 'NOT_FOUND', message: '文章不存在' }
                });
            }

            if (!canEditArticle(req.user, article)) {
                return res.status(403).json({
                    success: false,
                    error: { code: 'FORBIDDEN', message: '无权编辑此文章' }
                });
            }

            const allowedFields = [
                'title', 'slug', 'summary', 'content',
                'category', 'subcategory', 'tags',
                'product_line', 'product_models', 'firmware_versions',
                'visibility', 'department_ids', 'status'
            ];

            const updates = [];
            const params = [];

            for (const field of allowedFields) {
                if (req.body[field] !== undefined) {
                    let value = req.body[field];
                    if (['tags', 'product_models', 'firmware_versions', 'department_ids'].includes(field)) {
                        value = JSON.stringify(value);
                    }
                    updates.push(`${field} = ?`);
                    params.push(value);
                }
            }

            // Handle status change to Published
            if (req.body.status === 'Published' && article.status !== 'Published') {
                updates.push('published_at = CURRENT_TIMESTAMP');
            }

            if (updates.length === 0) {
                return res.status(400).json({
                    success: false,
                    error: { code: 'NO_CHANGES', message: '没有需要更新的字段' }
                });
            }

            // Save version history
            db.prepare(`
                INSERT INTO knowledge_article_versions (article_id, version, title, content, change_summary, created_by)
                SELECT id, COALESCE((SELECT MAX(version) FROM knowledge_article_versions WHERE article_id = ?), 0) + 1, title, content, ?, ?
                FROM knowledge_articles WHERE id = ?
            `).run(article.id, req.body.change_summary || '更新文章', req.user.id, article.id);

            updates.push('updated_by = ?', 'updated_at = CURRENT_TIMESTAMP');
            params.push(req.user.id, req.params.id);

            db.prepare(`UPDATE knowledge_articles SET ${updates.join(', ')} WHERE id = ?`).run(...params);

            // 记录审计日志
            if (logAudit) {
                const old_status = article.status;
                const new_status = req.body.status !== undefined ? req.body.status : article.status;
                
                // 构建更改摘要
                const changedFields = [];
                if (req.body.title) changedFields.push('标题');
                if (req.body.content) changedFields.push('内容');
                if (req.body.category) changedFields.push('分类');
                if (req.body.product_line) changedFields.push('产品线');
                if (req.body.visibility) changedFields.push('可见性');
                if (req.body.status) changedFields.push('状态');
                
                logAudit({
                    operation: 'update',
                    operation_detail: req.body.change_summary || `修改: ${changedFields.join(', ')}`,
                    article_id: article.id,
                    article_title: req.body.title || article.title,
                    article_slug: req.body.slug || article.slug,
                    category: req.body.category || article.category,
                    product_line: req.body.product_line || article.product_line,
                    product_models: req.body.product_models ? req.body.product_models : JSON.parse(article.product_models || '[]'),
                    changes_summary: JSON.stringify({
                        fields: changedFields,
                        note: req.body.change_summary
                    }),
                    old_status,
                    new_status,
                    user_id: req.user.id,
                    user_name: req.user.username,
                    user_role: req.user.role
                });
            }

            res.json({
                success: true,
                data: { id: parseInt(req.params.id), updated_at: new Date().toISOString() }
            });
        } catch (err) {
            console.error('[Knowledge] Update error:', err);
            res.status(500).json({
                success: false,
                error: { code: 'SERVER_ERROR', message: err.message }
            });
        }
    });

    /**
     * POST /api/v1/knowledge/:id/feedback
     * Submit feedback for article
     */
    router.post('/:id/feedback', authenticate, (req, res) => {
        try {
            const article = db.prepare('SELECT id FROM knowledge_articles WHERE id = ?').get(req.params.id);
            if (!article) {
                return res.status(404).json({
                    success: false,
                    error: { code: 'NOT_FOUND', message: '文章不存在' }
                });
            }

            const { is_helpful, feedback_text } = req.body;
            if (is_helpful === undefined) {
                return res.status(400).json({
                    success: false,
                    error: { code: 'VALIDATION_ERROR', message: '请指定是否有帮助' }
                });
            }

            db.prepare(`
                INSERT INTO knowledge_article_feedback (article_id, is_helpful, feedback_text, user_id, user_type)
                VALUES (?, ?, ?, ?, ?)
            `).run(req.params.id, is_helpful ? 1 : 0, feedback_text || null, req.user.id, req.user.user_type);

            // Update counts
            if (is_helpful) {
                db.prepare('UPDATE knowledge_articles SET helpful_count = helpful_count + 1 WHERE id = ?').run(req.params.id);
            } else {
                db.prepare('UPDATE knowledge_articles SET not_helpful_count = not_helpful_count + 1 WHERE id = ?').run(req.params.id);
            }

            res.json({ success: true });
        } catch (err) {
            console.error('[Knowledge] Feedback error:', err);
            res.status(500).json({
                success: false,
                error: { code: 'SERVER_ERROR', message: err.message }
            });
        }
    });

    /**
     * GET /api/v1/knowledge/categories/stats
     * Get article counts by category
     */
    router.get('/categories/stats', authenticate, (req, res) => {
        try {
            const user = req.user;
            const visibilityConditions = buildVisibilityConditions(user);

            const stats = db.prepare(`
                SELECT category, COUNT(*) as count
                FROM knowledge_articles ka
                WHERE status = 'Published' AND (${visibilityConditions.sql})
                GROUP BY category
                ORDER BY count DESC
            `).all(...visibilityConditions.params);

            res.json({
                success: true,
                data: stats
            });
        } catch (err) {
            console.error('[Knowledge] Category stats error:', err);
            res.status(500).json({
                success: false,
                error: { code: 'SERVER_ERROR', message: err.message }
            });
        }
    });

    // Helper functions
    function buildVisibilityConditions(user) {
        if (user.role === 'Admin') {
            return { sql: '1=1', params: [] };
        }

        const conditions = [];
        const params = [];

        // Public articles are always visible
        conditions.push("ka.visibility = 'Public'");

        if (user.user_type === 'Dealer') {
            // Dealers can see Public and Dealer visibility
            conditions.push("ka.visibility = 'Dealer'");
        } else if (user.user_type === 'Employee') {
            // Employees can see Public, Dealer, Internal, and their department's articles
            conditions.push("ka.visibility IN ('Dealer', 'Internal')");
            if (user.department_id) {
                conditions.push("(ka.visibility = 'Department' AND ka.department_ids LIKE ?)");
                params.push(`%${user.department_id}%`);
            }
        }

        return { sql: conditions.join(' OR '), params };
    }

    function canAccessArticle(user, article) {
        if (user.role === 'Admin') return true;
        if (article.visibility === 'Public') return true;
        if (article.visibility === 'Dealer' && (user.user_type === 'Dealer' || user.user_type === 'Employee')) return true;
        if (article.visibility === 'Internal' && user.user_type === 'Employee') return true;
        if (article.visibility === 'Department' && user.user_type === 'Employee') {
            const deptIds = JSON.parse(article.department_ids || '[]');
            return deptIds.includes(user.department_id);
        }
        return false;
    }

    function canEditArticle(user, article) {
        if (user.role === 'Admin') return true;
        if (user.role === 'Lead') return true;
        return article.created_by === user.id;
    }

    function generateSlug(title) {
        return title
            .toLowerCase()
            .replace(/[^\w\s-]/g, '')
            .replace(/\s+/g, '-')
            .substring(0, 50) + '-' + Date.now().toString(36);
    }

    function formatArticleListItem(article) {
        let tags = [];
        let productModels = [];
        try { tags = JSON.parse(article.tags || '[]'); } catch (e) {}
        try { productModels = JSON.parse(article.product_models || '[]'); } catch (e) {}

        return {
            id: article.id,
            title: article.title,
            slug: article.slug,
            summary: article.summary,
            category: article.category,
            subcategory: article.subcategory,
            tags,
            product_line: article.product_line,
            product_models: productModels,
            visibility: article.visibility,
            view_count: article.view_count,
            helpful_count: article.helpful_count,
            not_helpful_count: article.not_helpful_count,
            author: article.author_name,
            published_at: article.published_at,
            created_at: article.created_at
        };
    }

    function formatArticleDetail(article) {
        let tags = [], productModels = [], firmwareVersions = [], departmentIds = [];
        try { tags = JSON.parse(article.tags || '[]'); } catch (e) {}
        try { productModels = JSON.parse(article.product_models || '[]'); } catch (e) {}
        try { firmwareVersions = JSON.parse(article.firmware_versions || '[]'); } catch (e) {}
        try { departmentIds = JSON.parse(article.department_ids || '[]'); } catch (e) {}

        return {
            id: article.id,
            title: article.title,
            slug: article.slug,
            summary: article.summary,
            content: article.content,
            category: article.category,
            subcategory: article.subcategory,
            tags,
            product_line: article.product_line,
            product_models: productModels,
            firmware_versions: firmwareVersions,
            visibility: article.visibility,
            department_ids: departmentIds,
            status: article.status,
            view_count: article.view_count,
            helpful_count: article.helpful_count,
            not_helpful_count: article.not_helpful_count,
            author: { id: article.created_by, name: article.author_name },
            updated_by: article.updated_by ? { id: article.updated_by, name: article.updated_by_name } : null,
            published_at: article.published_at,
            created_at: article.created_at,
            updated_at: article.updated_at
        };
    }

    /**
     * Download images from web page
     * Returns array of { original, local }
     * Images are automatically converted to WebP format
     */
    async function downloadWebImages($, baseUrl, outputDir) {
        const downloadedImages = [];
        const images = $('img');
        
        for (let i = 0; i < images.length; i++) {
            try {
                const $img = $(images[i]);
                let src = $img.attr('src');
                
                if (!src) continue;
                
                // Convert relative URL to absolute
                if (!src.startsWith('http')) {
                    const base = new URL(baseUrl);
                    if (src.startsWith('/')) {
                        src = `${base.origin}${src}`;
                    } else {
                        src = `${base.origin}/${src}`;
                    }
                }
                
                // Skip data URLs and very small images
                if (src.startsWith('data:')) continue;
                
                // Download image
                const response = await axios.get(src, {
                    responseType: 'arraybuffer',
                    timeout: 10000,
                    headers: {
                        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
                    }
                });
                
                const buffer = Buffer.from(response.data);
                
                // Skip small images (< 1KB, likely icons)
                if (buffer.length < 1024) continue;
                
                // Generate filename (WebP format)
                const hash = crypto.createHash('md5').update(buffer).digest('hex').substring(0, 12);
                const filename = `web_${hash}.webp`;
                const filepath = path.join(outputDir, filename);
                
                // Convert to WebP using Python script
                const tempPngPath = filepath.replace('.webp', '.png');
                fs.writeFileSync(tempPngPath, buffer);
                
                try {
                    execSync(`python3 -c "
import sys
from PIL import Image
img = Image.open('${tempPngPath}')
if img.mode in ('RGBA', 'LA', 'P'):
    bg = Image.new('RGB', img.size, (255,255,255))
    if img.mode == 'P': img = img.convert('RGBA')
    if img.mode in ('RGBA', 'LA'): bg.paste(img, mask=img.split()[-1])
    img = bg
elif img.mode != 'RGB':
    img = img.convert('RGB')
img.save('${filepath}', 'WEBP', quality=85, method=6)
"
`, { encoding: 'utf8', timeout: 5000 });
                    
                    // Delete temp PNG
                    fs.unlinkSync(tempPngPath);
                } catch (convertErr) {
                    console.log(`[Web Images] Failed to convert to WebP, keeping PNG: ${convertErr.message}`);
                    // Keep PNG if conversion fails
                    fs.renameSync(tempPngPath, filepath.replace('.webp', '.png'));
                }
                
                const localPath = `/data/knowledge_images/${filename}`;
                downloadedImages.push({
                    original: src,
                    local: localPath
                });
                
                console.log(`[Web Images] ✓ Downloaded: ${filename}`);
            } catch (err) {
                // Skip images that fail to download
                console.log(`[Web Images] ⚠ Failed to download image: ${err.message}`);
            }
        }
        
        return downloadedImages;
    }

    /**
     * Extract meaningful content from web page
     * Intelligently detects article body, removes nav/ads/footer
     */
    function extractWebContent($, url) {
        // Remove unwanted elements
        $('script, style, nav, header, footer, .nav, .menu, .sidebar, .ad, .advertisement, .comments').remove();

        let title = '';
        let content = '';
        let summary = '';

        // Try to extract title
        title = $('h1').first().text().trim() || 
                $('title').text().trim() || 
                $('meta[property="og:title"]').attr('content') || 
                '';

        // Try to extract meta description as summary
        summary = $('meta[name="description"]').attr('content') || 
                  $('meta[property="og:description"]').attr('content') || 
                  '';

        // Try to find main content area (prioritized selectors)
        const contentSelectors = [
            'article',
            'main',
            '[role="main"]',
            '.article-content',
            '.post-content',
            '.entry-content',
            '.content',
            '#content',
            '.main-content'
        ];

        let $contentArea = null;
        for (const selector of contentSelectors) {
            $contentArea = $(selector).first();
            if ($contentArea.length > 0 && $contentArea.text().trim().length > 200) {
                break;
            }
        }

        // Fallback: use body if no specific content area found
        if (!$contentArea || $contentArea.length === 0) {
            $contentArea = $('body');
        }

        // Convert relative image URLs to absolute
        $contentArea.find('img').each((i, elem) => {
            const $img = $(elem);
            let src = $img.attr('src');
            if (src && !src.startsWith('http')) {
                const baseUrl = new URL(url);
                if (src.startsWith('/')) {
                    src = `${baseUrl.origin}${src}`;
                } else {
                    src = `${baseUrl.origin}/${src}`;
                }
                $img.attr('src', src);
            }
        });

        content = $contentArea.html() || '';

        return {
            title: title.substring(0, 200),
            summary: summary.substring(0, 500),
            content
        };
    }

    /**
     * Split Markdown content into chapters based on headings
     * @param {string} markdown - Markdown内容
     * @param {string} userSelectedModel - 用户选择的产品型号(优先)
     * @param {string} customPrefix - 用户自定义标题前缀(可选)
     * Supports: # Heading1, ## Heading2, numbered sections (1., 1.1, etc.)
     */
    function splitMarkdownIntoChapters(markdown, userSelectedModel, customPrefix) {
        const chapters = [];
        const lines = markdown.split('\n');
            
        // 确定标题前缀：优先使用用户选择的产品型号
        const titlePrefix = customPrefix || userSelectedModel || null;
            
        let currentChapter = null;
        let currentContent = [];
            
        // 章节标题模式：# 标题 或 1. 标题 或 1.1 标题
        const chapterPattern = /^(#{1,2})\s+(.+)$|^(\d+(?:\.\d+)*)[.\s]+(.+)$/;
            
        for (const line of lines) {
            const match = line.match(chapterPattern);
                
            if (match) {
                // 保存上一章
                if (currentChapter && currentContent.length > 0) {
                    currentChapter.content = currentContent.join('\n').trim();
                    if (currentChapter.content.length > 100) {
                        chapters.push(currentChapter);
                    }
                }
                    
                // 开始新章
                let chapterTitle;
                if (match[1]) {
                    // Markdown标题
                    chapterTitle = match[2].trim();
                } else {
                    // 数字编号标题
                    chapterTitle = match[4].trim();
                }
                    
                // 清理章节标题中可能存在的产品型号前缀
                // 例如: "MAVO Edge 6K: 1. 基本说明" -> "1. 基本说明"
                const cleanedTitle = chapterTitle.replace(/^(MAVO\s+[^:]+|Eagle\s+[^:]+|Terra\s+[^:]+):\s*/i, '');
                    
                // 添加用户选择的产品型号前缀
                const fullTitle = titlePrefix ? `${titlePrefix}: ${cleanedTitle}` : cleanedTitle;
                    
                currentChapter = {
                    title: fullTitle,
                    content: ''
                };
                currentContent = [];
            } else {
                // 添加到当前章节
                if (currentChapter) {
                    currentContent.push(line);
                }
            }
        }
            
        // 保存最后一章
        if (currentChapter && currentContent.length > 0) {
            currentChapter.content = currentContent.join('\n').trim();
            if (currentChapter.content.length > 100) {
                chapters.push(currentChapter);
            }
        }
            
        // 如果没有找到章节，将整个文档作为一章
        if (chapters.length === 0 && markdown.trim().length > 100) {
            chapters.push({
                title: titlePrefix || 'Untitled Document',
                content: markdown.trim()
            });
        }
            
        return chapters;
    }

    /**
     * Split PDF content into sections with intelligent chapter detection
     * Supports: Chapter titles, Markdown headers, numbered sections
     */
    function splitPDFContent(text, titlePrefix) {
        const sections = [];
        
        // Enhanced chapter detection patterns (ordered by priority)
        const chapterPatterns = [
            // Chinese chapter patterns
            { regex: /^第[一二三四五六七八九十百千]+章[\s:：](.+)$/m, priority: 1 },
            { regex: /^第\s*\d+\s*章[\s:：](.+)$/m, priority: 1 },
            
            // Numbered sections (1., 1.1, etc.)
            { regex: /^(\d+\.\d+\.?\d*)\s+(.+)$/m, priority: 2 },
            { regex: /^(\d+\.)\s+(.+)$/m, priority: 2 },
            
            // Markdown-style headers
            { regex: /^#{1,3}\s+(.+)$/m, priority: 1 },
            
            // All caps titles
            { regex: /^([A-Z][A-Z\s]{2,})$/m, priority: 3 },
            
            // Chinese numbered items
            { regex: /^[一二三四五六七八九十]+[、.]\s*(.+)$/m, priority: 2 }
        ];
        
        const lines = text.split('\n');
        let currentTitle = '';
        let currentContent = [];
        let sectionIndex = 0;
        
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim();
            if (!line) continue;
            
            let isChapterStart = false;
            let detectedTitle = '';
            let matchPriority = 999;
            
            // Try each pattern
            for (const pattern of chapterPatterns) {
                const match = line.match(pattern.regex);
                if (match && pattern.priority <= matchPriority) {
                    isChapterStart = true;
                    matchPriority = pattern.priority;
                    
                    // Extract title
                    if (match[2]) {
                        detectedTitle = match[2].trim();
                    } else if (match[1]) {
                        detectedTitle = match[1].trim();
                    } else {
                        detectedTitle = line;
                    }
                    
                    // Validate title
                    if (detectedTitle.length < 2 || /^[\d\.\s]+$/.test(detectedTitle)) {
                        isChapterStart = false;
                    }
                }
            }
            
            // Additional heuristic: detect potential headers
            if (!isChapterStart && currentContent.length > 50) {
                if (line.length > 3 && line.length < 80 && 
                    !line.match(/[。！？；,，]$/) &&
                    (line[0] === line[0].toUpperCase() || /^[一-龥]/.test(line))) {
                    
                    // Look ahead
                    let nextLinesAreContent = false;
                    for (let j = i + 1; j < Math.min(i + 3, lines.length); j++) {
                        const nextLine = lines[j].trim();
                        if (nextLine.length > 40) {
                            nextLinesAreContent = true;
                            break;
                        }
                    }
                    
                    if (nextLinesAreContent) {
                        isChapterStart = true;
                        detectedTitle = line;
                    }
                }
            }
            
            // Save section
            if (isChapterStart && currentContent.length > 30) {
                if (currentTitle) {
                    const content = currentContent.join('\n').trim();
                    if (content.length > 100) {
                        sections.push({
                            title: currentTitle,
                            content: content
                        });
                        sectionIndex++;
                    }
                }
                currentTitle = detectedTitle;
                currentContent = [line];
            } else {
                currentContent.push(line);
            }
        }
        
        // Save last section
        if (currentTitle && currentContent.length > 30) {
            const content = currentContent.join('\n').trim();
            if (content.length > 100) {
                sections.push({
                    title: currentTitle,
                    content: content
                });
            }
        }
        
        // Fallback: semantic chunking if no chapters detected
        if (sections.length === 0) {
            const paragraphs = text.split(/\n\s*\n/);
            let chunk = [];
            let chunkIndex = 1;
            const targetSize = 1500;
            
            for (const para of paragraphs) {
                const trimmed = para.trim();
                if (!trimmed || trimmed.length < 10) continue;
                
                chunk.push(trimmed);
                const currentSize = chunk.join('\n\n').length;
                
                if (currentSize > targetSize) {
                    const content = chunk.join('\n\n').trim();
                    if (content.length > 100) {
                        const firstLine = content.split('\n')[0];
                        const title = firstLine.length < 60 && !firstLine.match(/[。！？]$/)
                            ? `${titlePrefix}: ${firstLine}`
                            : `${titlePrefix} - Part ${chunkIndex}`;
                        
                        sections.push({ title, content });
                        chunkIndex++;
                    }
                    chunk = [];
                }
            }
            
            // Save last chunk
            if (chunk.length > 0) {
                const content = chunk.join('\n\n').trim();
                if (content.length > 100) {
                    const firstLine = content.split('\n')[0];
                    const title = firstLine.length < 60
                        ? `${titlePrefix}: ${firstLine}`
                        : `${titlePrefix} - Part ${chunkIndex}`;
                    sections.push({ title, content });
                }
            }
        }
        
        return sections;
    }

    /**
     * Extract images from PDF file using Python PyMuPDF
     * Returns array of { filename, page, path }
     */
    async function extractPDFImages(pdfPath, outputDir) {
        try {
            const scriptPath = path.join(__dirname, '../../scripts/extract_pdf_images.py');
            
            // Call Python script
            const result = execSync(
                `python3 "${scriptPath}" "${pdfPath}" "${outputDir}"`,
                { encoding: 'utf8', maxBuffer: 10 * 1024 * 1024 }
            );
            
            // Parse JSON output
            const data = JSON.parse(result);
            
            if (data.success && data.images) {
                console.log(`[PDF Images] ✅ Extracted ${data.images.length} images`);
                return data.images;
            }
            
            return [];
        } catch (err) {
            console.error('[PDF Images] Extraction error:', err.message);
            return [];
        }
    }

    /**
     * Insert image references into content at appropriate positions
     * Tries to match images to sections by page number
     */
    function insertImageReferences(sections, images) {
        if (!images || images.length === 0) return sections;
        
        // Group images by page
        const imagesByPage = {};
        images.forEach(img => {
            if (!imagesByPage[img.page]) {
                imagesByPage[img.page] = [];
            }
            imagesByPage[img.page].push(img);
        });
        
        // Insert images into sections
        // Note: This is a simple heuristic - assumes sections are roughly sequential by page
        const pagesPerSection = Math.ceil(Object.keys(imagesByPage).length / sections.length);
        
        sections.forEach((section, idx) => {
            const startPage = idx * pagesPerSection + 1;
            const endPage = (idx + 1) * pagesPerSection;
            
            let sectionImages = [];
            for (let page = startPage; page <= endPage; page++) {
                if (imagesByPage[page]) {
                    sectionImages = sectionImages.concat(imagesByPage[page]);
                }
            }
            
            if (sectionImages.length > 0) {
                // Append images at the end of section content
                section.content += '\n\n---\n\n**相关图片**：\n\n';
                sectionImages.forEach((img, i) => {
                    section.content += `![图 ${i + 1}](${img.path})\n\n`;
                });
            }
        });
        
        return sections;
    }

    return router;
};
