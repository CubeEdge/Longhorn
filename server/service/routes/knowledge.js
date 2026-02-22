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

module.exports = function (db, authenticate, multerInstance, aiService) {
    const router = express.Router();

    // AI Service 注入（从 index.js 传入）
    // 用于文章排版优化和摘要生成

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

            // Full-text search if provided - MUST be before whereClause
            if (search) {
                // 将搜索词拆分为核心关键词，每个独立 LIKE 匹配，用 AND 连接
                const keywords = splitSearchKeywords(search);
                if (keywords.length > 0) {
                    const expandedLog = [];
                    keywords.forEach(kw => {
                        const synonyms = expandWithSynonyms(kw);
                        expandedLog.push(`${kw}→[${synonyms.join('|')}]`);
                        // 构建 OR 组：(title LIKE '%音频%' OR title LIKE '%声音%' OR ...)
                        const orParts = [];
                        synonyms.forEach(syn => {
                            const term = `%${syn}%`;
                            orParts.push('ka.title LIKE ?', 'ka.summary LIKE ?', 'ka.content LIKE ?', 'ka.tags LIKE ?');
                            params.push(term, term, term, term);
                        });
                        conditions.push(`(${orParts.join(' OR ')})`);
                    });
                    console.log(`[Knowledge] Synonym-expanded search: ${expandedLog.join(' AND ')} (from: "${search}")`);
                } else {
                    // Fallback: 如果拆分后无有效关键词，用原始查询
                    const searchTerm = `%${search.trim()}%`;
                    conditions.push('(ka.title LIKE ? OR ka.summary LIKE ? OR ka.content LIKE ? OR ka.tags LIKE ?)');
                    params.push(searchTerm, searchTerm, searchTerm, searchTerm);
                    console.log(`[Knowledge] Fallback LIKE search for: "${search}"`);
                }
            }

            const whereClause = `WHERE ${conditions.join(' AND ')}`;
            let searchJoin = ''; // No longer needed for LIKE search

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
            const imagesDir = './data/Knowledge/Images';
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

            // Convert sections content to HTML format
            sections = sections.map(section => ({
                ...section,
                content: convertTextToHtml(section.content)
            }));

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
                const DISK_A = '/Volumes/fileserver/Files';
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
            const htmlPath = path.join(tempDir, 'output.html');
            const imagesDir = './data/Knowledge/Images';

            // 创建临时目录
            fs.mkdirSync(tempDir, { recursive: true });
            if (!fs.existsSync(imagesDir)) {
                fs.mkdirSync(imagesDir, { recursive: true });
            }

            // 步骤1: 调用Python脚本转换DOCX→HTML
            console.log('[DOCX Import] Step 1: Converting DOCX to HTML...');
            const convertScript = path.join(__dirname, '../../scripts/docx_to_html.py');

            let stats = { image_count: 0, table_count: 0, heading_count: 0 };
            try {
                // 使用绝对路径python3，并设置环境变量
                const convertOutput = execSync(
                    `/usr/bin/python3 "${convertScript}" "${docxPath}" "${htmlPath}" "${imagesDir}"`,
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

            // 步骤2: 读取HTML内容
            if (!fs.existsSync(htmlPath)) {
                throw new Error('HTML文件生成失败');
            }

            const htmlContent = fs.readFileSync(htmlPath, 'utf-8');
            console.log(`[DOCX Import] Step 2: HTML generated (${htmlContent.length} chars)`);

            // 步骤3: 按章节分割
            console.log('[DOCX Import] Step 3: Splitting into chapters...');
            const productModelsArray = product_models ? JSON.parse(product_models) : [];
            const userSelectedModel = productModelsArray.length > 0 ? productModelsArray[0] : null;
            const chapters = splitHtmlIntoChapters(htmlContent, userSelectedModel, title_prefix);
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

                    // 不在导入时生成摘要，全部放到 Bokeh 优化步骤
                    const summaryText = chapter.content
                        .replace(/<[^>]+>/g, '')
                        .replace(/\s+/g, ' ')
                        .trim()
                        .substring(0, 300);
                    const shortSummary = summaryText.substring(0, 100);

                    // 解析章节号（支持两种格式）
                    // 格式1：带前缀 "MAVO Edge 8K: 3. SDI监看" 或 "MAVO Edge 8K: 3.1 SDI监看"
                    // 格式2：不带前缀 "3. SDI监看" 或 "3.1 SDI监看"
                    let chapterMatch = chapter.title.match(/:\s*(\d+)(?:\.(\d+))?/);
                    if (!chapterMatch) {
                        // 尝试匹配不带前缀的格式
                        chapterMatch = chapter.title.match(/^(\d+)(?:\.(\d+))?[.\s]+/);
                    }
                    const chapterNumber = chapterMatch ? parseInt(chapterMatch[1]) : null;
                    const sectionNumber = chapterMatch && chapterMatch[2] ? parseInt(chapterMatch[2]) : null;

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

                    // 导入时不更新 summary（使用默认值）
                    db.prepare(`
                        UPDATE knowledge_articles SET
                            chapter_number = ?,
                            section_number = ?
                        WHERE id = ?
                    `).run(chapterNumber, sectionNumber, result.lastInsertRowid);

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
                    chapter_count: chapters.length,
                    image_count: stats.image_count,
                    table_count: stats.table_count,
                    total_size: fileSize || 0
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
                            operation_detail: `DOCX导入 - 批次${batchId.substring(0, 8)}`,
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
            if (!['Employee', 'Internal'].includes(req.user.user_type)) {
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
            const imagesDir = './data/Knowledge/Images';
            if (!fs.existsSync(imagesDir)) {
                fs.mkdirSync(imagesDir, { recursive: true });
            }

            const downloadedImages = await downloadWebImages($, url, imagesDir);
            console.log(`[Knowledge Import URL] Downloaded ${downloadedImages.length} images`);

            // Keep HTML format (no longer converting to Markdown)
            let htmlContent = extractedContent.content;

            // Replace image URLs with local paths
            downloadedImages.forEach(img => {
                htmlContent = htmlContent.replace(img.original, img.local);
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
                summary: extractedContent.summary || htmlContent.replace(/<[^>]+>/g, '').substring(0, 200),
                content: htmlContent,
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
                'visibility', 'department_ids', 'status',
                // Wiki editor fields: content, formatted_content, format_status, summary
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
     * GET /api/v1/knowledge/:id/versions
     * Get version history for an article
     */
    router.get('/:id/versions', authenticate, (req, res) => {
        try {
            const article = db.prepare('SELECT id, title FROM knowledge_articles WHERE id = ?').get(req.params.id);
            if (!article) {
                return res.status(404).json({
                    success: false,
                    error: { code: 'NOT_FOUND', message: '文章不存在' }
                });
            }

            const versions = db.prepare(`
                SELECT 
                    kav.id, kav.version, kav.title, kav.change_summary, kav.created_at,
                    u.username as created_by_name
                FROM knowledge_article_versions kav
                LEFT JOIN users u ON kav.created_by = u.id
                WHERE kav.article_id = ?
                ORDER BY kav.version DESC
                LIMIT 20
            `).all(req.params.id);

            res.json({
                success: true,
                data: {
                    article_id: article.id,
                    article_title: article.title,
                    versions: versions.map(v => ({
                        id: v.id,
                        version: v.version,
                        title: v.title,
                        change_summary: v.change_summary,
                        created_at: v.created_at,
                        created_by: v.created_by_name
                    }))
                }
            });
        } catch (err) {
            console.error('[Knowledge] Get versions error:', err);
            res.status(500).json({
                success: false,
                error: { code: 'SERVER_ERROR', message: err.message }
            });
        }
    });

    /**
     * GET /api/v1/knowledge/:id/versions/:version
     * Get specific version content
     */
    router.get('/:id/versions/:version', authenticate, (req, res) => {
        try {
            const version = db.prepare(`
                SELECT kav.*, u.username as created_by_name
                FROM knowledge_article_versions kav
                LEFT JOIN users u ON kav.created_by = u.id
                WHERE kav.article_id = ? AND kav.version = ?
            `).get(req.params.id, req.params.version);

            if (!version) {
                return res.status(404).json({
                    success: false,
                    error: { code: 'NOT_FOUND', message: '版本不存在' }
                });
            }

            res.json({
                success: true,
                data: {
                    id: version.id,
                    version: version.version,
                    title: version.title,
                    content: version.content,
                    change_summary: version.change_summary,
                    created_at: version.created_at,
                    created_by: version.created_by_name
                }
            });
        } catch (err) {
            console.error('[Knowledge] Get version error:', err);
            res.status(500).json({
                success: false,
                error: { code: 'SERVER_ERROR', message: err.message }
            });
        }
    });

    /**
     * POST /api/v1/knowledge/:id/rollback/:version
     * Rollback article to a specific version
     */
    router.post('/:id/rollback/:version', authenticate, async (req, res) => {
        try {
            // Check permission
            if (req.user.role !== 'Admin' && req.user.role !== 'Lead' && req.user.role !== 'Editor') {
                return res.status(403).json({
                    success: false,
                    error: { code: 'FORBIDDEN', message: '无权执行回滚操作' }
                });
            }

            const article = db.prepare('SELECT * FROM knowledge_articles WHERE id = ?').get(req.params.id);
            if (!article) {
                return res.status(404).json({
                    success: false,
                    error: { code: 'NOT_FOUND', message: '文章不存在' }
                });
            }

            const targetVersion = db.prepare(`
                SELECT * FROM knowledge_article_versions 
                WHERE article_id = ? AND version = ?
            `).get(req.params.id, req.params.version);

            if (!targetVersion) {
                return res.status(404).json({
                    success: false,
                    error: { code: 'NOT_FOUND', message: '目标版本不存在' }
                });
            }

            // Create a new version with current content before rollback
            db.prepare(`
                INSERT INTO knowledge_article_versions (article_id, version, title, content, change_summary, created_by)
                SELECT id, COALESCE((SELECT MAX(version) FROM knowledge_article_versions WHERE article_id = ?), 0) + 1, 
                       title, content, '回滚前自动备份', ?
                FROM knowledge_articles WHERE id = ?
            `).run(req.params.id, req.user.id, req.params.id);

            // Rollback to target version
            db.prepare(`
                UPDATE knowledge_articles 
                SET title = ?, content = ?, updated_by = ?, updated_at = CURRENT_TIMESTAMP
                WHERE id = ?
            `).run(targetVersion.title, targetVersion.content, req.user.id, req.params.id);

            // Create version record for rollback
            db.prepare(`
                INSERT INTO knowledge_article_versions (article_id, version, title, content, change_summary, created_by)
                VALUES (?, (SELECT COALESCE(MAX(version), 0) + 1 FROM knowledge_article_versions WHERE article_id = ?), 
                        ?, ?, ?, ?)
            `).run(req.params.id, req.params.id, targetVersion.title, targetVersion.content,
                `回滚到版本 #${req.params.version}`, req.user.id);

            res.json({
                success: true,
                data: {
                    message: `已回滚到版本 #${req.params.version}`,
                    new_version: db.prepare('SELECT MAX(version) as v FROM knowledge_article_versions WHERE article_id = ?').get(req.params.id).v
                }
            });
        } catch (err) {
            console.error('[Knowledge] Rollback error:', err);
            res.status(500).json({
                success: false,
                error: { code: 'SERVER_ERROR', message: err.message }
            });
        }
    });

    /**
     * DELETE /api/v1/knowledge/:id/versions/:version
     * Delete a specific version (not the current/latest version)
     */
    router.delete('/:id/versions/:version', authenticate, (req, res) => {
        try {
            // Check permission
            if (req.user.role !== 'Admin' && req.user.role !== 'Lead') {
                return res.status(403).json({
                    success: false,
                    error: { code: 'FORBIDDEN', message: '无权删除版本' }
                });
            }

            const article = db.prepare('SELECT id FROM knowledge_articles WHERE id = ?').get(req.params.id);
            if (!article) {
                return res.status(404).json({
                    success: false,
                    error: { code: 'NOT_FOUND', message: '文章不存在' }
                });
            }

            // Check if target version exists
            const targetVersion = db.prepare(`
                SELECT * FROM knowledge_article_versions 
                WHERE article_id = ? AND version = ?
            `).get(req.params.id, req.params.version);

            if (!targetVersion) {
                return res.status(404).json({
                    success: false,
                    error: { code: 'NOT_FOUND', message: '版本不存在' }
                });
            }

            // Cannot delete the latest version
            const latestVersion = db.prepare(`
                SELECT MAX(version) as v FROM knowledge_article_versions WHERE article_id = ?
            `).get(req.params.id);

            if (latestVersion && latestVersion.v === parseInt(req.params.version)) {
                return res.status(400).json({
                    success: false,
                    error: { code: 'CANNOT_DELETE_LATEST', message: '不能删除最新版本' }
                });
            }

            // Delete the version
            db.prepare(`
                DELETE FROM knowledge_article_versions 
                WHERE article_id = ? AND version = ?
            `).run(req.params.id, req.params.version);

            res.json({
                success: true,
                data: {
                    message: `已删除版本 #${req.params.version}`
                }
            });
        } catch (err) {
            console.error('[Knowledge] Delete version error:', err);
            res.status(500).json({
                success: false,
                error: { code: 'SERVER_ERROR', message: err.message }
            });
        }
    });

    /**
     * DELETE /api/v1/knowledge/:idOrSlug
     * Delete article (Admin/Lead only)
     */
    router.delete('/:idOrSlug', authenticate, (req, res) => {
        try {
            const { idOrSlug } = req.params;
            const user = req.user;

            // Only Admin/Lead can delete articles
            if (user.role !== 'Admin' && user.role !== 'Lead') {
                return res.status(403).json({
                    success: false,
                    error: { code: 'FORBIDDEN', message: '无权删除文章' }
                });
            }

            console.log('[Knowledge] Deleting article:', idOrSlug);

            // Try to find by slug first (more common in frontend)
            let article = db.prepare('SELECT * FROM knowledge_articles WHERE slug = ?').get(idOrSlug);

            // If not found, try by id
            if (!article) {
                article = db.prepare('SELECT * FROM knowledge_articles WHERE id = ?').get(parseInt(idOrSlug));
            }

            if (!article) {
                return res.status(404).json({
                    success: false,
                    error: { code: 'NOT_FOUND', message: '文章不存在' }
                });
            }

            console.log('[Knowledge] Found article to delete:', article.id, article.title);

            // Log audit before deletion
            if (logAudit) {
                logAudit({
                    operation: 'delete',
                    operation_detail: `删除文章：${article.title}`,
                    article_id: article.id,
                    article_title: article.title,
                    article_slug: article.slug,
                    category: article.category,
                    product_line: article.product_line,
                    product_models: article.product_models ? JSON.parse(article.product_models || '[]') : [],
                    user_id: user.id,
                    user_name: user.username,
                    user_role: user.role
                });
            }

            // Delete related records first
            db.prepare('DELETE FROM knowledge_article_versions WHERE article_id = ?').run(article.id);
            db.prepare('DELETE FROM knowledge_article_feedback WHERE article_id = ?').run(article.id);
            db.prepare('DELETE FROM knowledge_article_links WHERE source_article_id = ? OR target_article_id = ?').run(article.id, article.id);

            // Delete article
            db.prepare('DELETE FROM knowledge_articles WHERE id = ?').run(article.id);

            console.log('[Knowledge] Article deleted successfully:', article.id);

            res.json({
                success: true,
                message: '文章已删除',
                data: { id: article.id, title: article.title }
            });
        } catch (err) {
            console.error('[Knowledge] Delete article error:', err);
            res.status(500).json({
                success: false,
                error: { code: 'SERVER_ERROR', message: err.message }
            });
        }
    });

    /**
     * POST /api/v1/knowledge/:id/create-snapshot
     * Manually create a version snapshot
     */
    router.post('/:id/create-snapshot', authenticate, (req, res) => {
        try {
            const article = db.prepare('SELECT * FROM knowledge_articles WHERE id = ?').get(req.params.id);
            if (!article) {
                return res.status(404).json({
                    success: false,
                    error: { code: 'NOT_FOUND', message: '文章不存在' }
                });
            }

            const { change_summary = '手动创建快照' } = req.body;

            const result = db.prepare(`
                INSERT INTO knowledge_article_versions (article_id, version, title, content, change_summary, created_by)
                SELECT id, COALESCE((SELECT MAX(version) FROM knowledge_article_versions WHERE article_id = ?), 0) + 1, 
                       title, content, ?, ?
                FROM knowledge_articles WHERE id = ?
            `).run(req.params.id, change_summary, req.user.id, req.params.id);

            res.json({
                success: true,
                data: {
                    version_id: result.lastInsertRowid,
                    message: '快照创建成功'
                }
            });
        } catch (err) {
            console.error('[Knowledge] Create snapshot error:', err);
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

    // 同义词扩展：从 synonyms.js 的数据库缓存中获取
    const { expandWithSynonyms } = require('./synonyms');

    /**
     * 将搜索查询拆分为核心关键词列表
     * 移除中文停用词，按空格/标点拆分
     * 例: "音频的相关设置" → ["音频", "设置"]
     */
    function splitSearchKeywords(query) {
        const stopWords = /的|是|有|了|在|和|与|或|也|都|被|把|对|从|到|给|让|着|过|不|没|会|能|可以|应该|关于|如何|什么|怎么|怎样|这个|那个|一些|相关|哪些|哪个|为什么|什么是|介绍|说明|支持|常见|一般|通常|经常|平时|总是|容易|可能|需要|建议|推荐|比较|正确|正常|具体|应当|请问|告诉|问题/g;
        const cleaned = query.replace(stopWords, ' ').replace(/[，。、！？；：""''（）【】\s]+/g, ' ').trim();
        const keywords = cleaned.split(' ').filter(w => {
            if (!w) return false;
            if (/^[\u4e00-\u9fff]+$/.test(w)) return w.length >= 2;
            return w.length >= 1;
        });
        return keywords;
    }

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
        try { tags = JSON.parse(article.tags || '[]'); } catch (e) { }
        try { productModels = JSON.parse(article.product_models || '[]'); } catch (e) { }

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
        let imageLayoutMeta = null;
        try { tags = JSON.parse(article.tags || '[]'); } catch (e) { }
        try { productModels = JSON.parse(article.product_models || '[]'); } catch (e) { }
        try { firmwareVersions = JSON.parse(article.firmware_versions || '[]'); } catch (e) { }
        try { departmentIds = JSON.parse(article.department_ids || '[]'); } catch (e) { }
        try { imageLayoutMeta = article.image_layout_meta ? JSON.parse(article.image_layout_meta) : null; } catch (e) { }

        return {
            id: article.id,
            title: article.title,
            slug: article.slug,
            summary: article.summary,
            summary: article.summary,
            content: article.content,
            formatted_content: article.formatted_content,
            format_status: article.format_status || 'none',
            formatted_by: article.formatted_by,
            formatted_at: article.formatted_at,
            chapter_number: article.chapter_number,
            section_number: article.section_number,
            image_layout_meta: imageLayoutMeta,
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
            source_type: article.source_type,
            source_reference: article.source_reference,
            source_url: article.source_url,
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
    /**
     * Convert plain text to HTML format
     * Used for PDF imports to ensure uniform HTML storage
     */
    function convertTextToHtml(text) {
        if (!text || typeof text !== 'string') return '';

        // Split by double newlines to get paragraphs
        const paragraphs = text.split(/\n\s*\n/);

        return paragraphs
            .map(p => p.trim())
            .filter(p => p.length > 0)
            .map(p => {
                // Escape HTML special characters
                const escaped = p
                    .replace(/&/g, '&amp;')
                    .replace(/</g, '&lt;')
                    .replace(/>/g, '&gt;')
                    .replace(/"/g, '&quot;');
                // Replace single newlines with <br> within paragraph
                return `<p>${escaped.replace(/\n/g, '<br>')}</p>`;
            })
            .join('\n');
    }

    /**
     * Split HTML content into chapters based on heading tags
     * Used for DOCX imports that are now converted to HTML
     */
    function splitHtmlIntoChapters(html, userSelectedModel, customPrefix) {
        const chapters = [];
        const titlePrefix = customPrefix || userSelectedModel || null;

        // 匹配 h1, h2 标签作为章节分隔
        const headingPattern = /<h([1-2])[^>]*>([^<]+)<\/h[1-2]>/gi;
        const matches = [...html.matchAll(headingPattern)];

        if (matches.length === 0) {
            // 没有找到章节，将整个文档作为一章
            if (html.trim().length > 100) {
                chapters.push({
                    title: titlePrefix || 'Untitled Document',
                    content: html.trim()
                });
            }
            return chapters;
        }

        // 分割内容
        let lastIndex = 0;
        for (let i = 0; i < matches.length; i++) {
            const match = matches[i];
            const headingStart = match.index;
            const headingEnd = headingStart + match[0].length;
            let chapterTitle = match[2].trim();

            // 清理章节标题中可能存在的产品型号前缀
            const cleanedTitle = chapterTitle.replace(/^(MAVO\s+[^:]+|Eagle\s+[^:]+|Terra\s+[^:]+):\s*/i, '');
            // 只在用户明确要求添加前缀时才添加（customPrefix 有值时）
            const fullTitle = customPrefix ? `${customPrefix}: ${cleanedTitle}` : cleanedTitle;

            // 找到下一个章节的起始位置
            const nextIndex = (i < matches.length - 1) ? matches[i + 1].index : html.length;
            const content = html.substring(headingEnd, nextIndex).trim();

            if (content.length > 100) {
                chapters.push({
                    title: fullTitle,
                    content: `<h${match[1]}>${chapterTitle}</h${match[1]}>\n${content}`
                });
            }
        }

        return chapters;
    }

    /**
     * Legacy function for Markdown chapter splitting
     * @deprecated Use splitHtmlIntoChapters for new imports
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
                // 例如:"MAVO Edge 6K: 1. 基本说明" -> "1. 基本说明"
                const cleanedTitle = chapterTitle.replace(/^(MAVO\s+[^:]+|Eagle\s+[^:]+|Terra\s+[^:]+):\s*/i, '');

                // 只在用户明确要求添加前缀时才添加（customPrefix 有值时）
                const fullTitle = customPrefix ? `${customPrefix}: ${cleanedTitle}` : cleanedTitle;

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

    /**
     * POST /api/v1/knowledge/:id/bokeh-optimize
     * Receive optimization instruction from Bokeh chat and re-optimize article
     * This is called when user gives feedback like "图片太大，缩小一些" or "段落太长"
     */
    router.post('/:id/bokeh-optimize', authenticate, async (req, res) => {
        try {
            // Check permission
            if (req.user.role !== 'Admin' && req.user.role !== 'Lead' && req.user.role !== 'Editor') {
                return res.status(403).json({
                    success: false,
                    error: { code: 'FORBIDDEN', message: '无权执行此操作' }
                });
            }

            const article = db.prepare('SELECT * FROM knowledge_articles WHERE id = ?').get(req.params.id);
            if (!article) {
                return res.status(404).json({
                    success: false,
                    error: { code: 'NOT_FOUND', message: '文章不存在' }
                });
            }

            const { instruction, currentContent } = req.body;
            if (!instruction) {
                return res.status(400).json({
                    success: false,
                    error: { code: 'MISSING_INSTRUCTION', message: '请提供优化指令' }
                });
            }

            if (!aiService) {
                return res.status(500).json({
                    success: false,
                    error: { code: 'AI_NOT_AVAILABLE', message: 'AI服务未配置' }
                });
            }

            console.log(`[Bokeh Optimize] Article ${article.id}, Instruction: ${instruction}`);

            // Use current draft content if available, otherwise use original
            const contentToOptimize = currentContent || article.formatted_content || article.content;

            // Build prompt based on user's instruction
            // Detect instruction type for better context
            const isStyleInstruction = /颜色|color|样式|style|黄色|yellow|红色|red|蓝色|blue|绿色|green/i.test(instruction);
            const isSizeInstruction = /大小|尺寸|size|缩放|scale|宽度|width|高度|height/i.test(instruction);

            const optimizePrompt = `你是Bokeh，Kinefinity的专业知识库编辑助手。

**当前上下文**：用户正在 Wiki 编辑器中编辑文章「${article.title}」，你可以直接修改编辑器中的内容。

**用户修改指令**: ${instruction}

**当前编辑器中的 HTML 内容**:
${contentToOptimize.substring(0, 8000)}

**你的任务**:
根据用户的修改指令，直接修改上述 HTML 内容。这是编辑器中的实时内容，修改后会立即呈现给用户。

${isStyleInstruction ? `**样式修改指南**（用户指令涉及颜色/样式）：
- "标题改为黄色/kine yellow" = 为所有 <h1>, <h2>, <h3> 标签添加 style="color: #FFD700;"
- "文字改为黄色" = 为 <p>, <span> 等标签添加 style="color: #FFD700;"
- 注意：用户说的是"改颜色"，不是"改文字内容"，不要修改标签内的文字，只添加 style 属性
- 品牌色值：#FFD700 (Kine Yellow)

**示例**：
输入指令："把标题改为 kine yellow"
正确输出：<h1 style="color: #FFD700;">原标题文字</h1>（只改颜色，不改文字）
错误输出：<h1>kine yellow</h1>（这是把标题文字改成了"kine yellow"）` : ''}

${isSizeInstruction ? `**图片尺寸修改指南**（用户指令涉及尺寸）：
- "图片改为1/2" = 为 <img> 标签添加 style="max-width: 50%;" 或 style="width: 50%;"
- "图片居中" = 为 <img> 标签添加 style="display: block; margin: 0 auto;"` : ''}

**通用规则**：
1. 区分"改颜色"和"改文字"：用户说"标题改为黄色"是改颜色，不是把标题文字改成"黄色"
2. 使用内联 style 属性实现样式修改
3. 保持 HTML 格式输出
4. 保留所有原始内容，只做请求的修改
5. 不要添加未要求的修改

**输出格式**：
直接输出修改后的完整 HTML 内容，不要添加任何解释或说明。`;

            let optimizedContent;
            try {
                optimizedContent = await aiService.generate('logic',
                    'You are Bokeh, a professional knowledge base editor. You are currently in the Wiki editor, directly editing HTML content. Follow user instructions precisely.',
                    optimizePrompt
                );
                console.log('[Bokeh Optimize] Optimization completed');
            } catch (aiErr) {
                console.error('[Bokeh Optimize] AI error:', aiErr.message);
                return res.status(500).json({
                    success: false,
                    error: { code: 'AI_ERROR', message: '优化失败：' + aiErr.message }
                });
            }

            // Save as draft
            db.prepare(`
                UPDATE knowledge_articles SET
                    formatted_content = ?,
                    format_status = 'draft',
                    formatted_by = 'ai',
                    formatted_at = CURRENT_TIMESTAMP,
                    updated_at = CURRENT_TIMESTAMP
                WHERE id = ?
            `).run(optimizedContent, article.id);

            // Log audit
            if (logAudit) {
                logAudit({
                    operation: 'bokeh_optimize',
                    operation_detail: `Bokeh优化指令: ${instruction.substring(0, 100)}`,
                    article_id: article.id,
                    article_title: article.title,
                    article_slug: article.slug,
                    user_id: req.user.id,
                    user_name: req.user.username,
                    user_role: req.user.role
                });
            }

            // Generate a response message for Bokeh
            const responseMessage = `✅ 已根据您的修改意见优化文章！\n\n**优化内容**：${instruction}\n\n优化后的内容已保存为草稿，您可以：\n- 切换到「Bokeh草稿」标签查看效果\n- 如满意，点击「发布草稿」正式发布\n- 如还需调整，继续告诉我您的修改意见`;

            res.json({
                success: true,
                data: {
                    article_id: article.id,
                    article_title: article.title,
                    optimized_content: optimizedContent,
                    format_status: 'draft',
                    response_message: responseMessage
                }
            });
        } catch (err) {
            console.error('[Bokeh Optimize] Error:', err);
            res.status(500).json({
                success: false,
                error: { code: 'OPTIMIZE_ERROR', message: err.message }
            });
        }
    });

    /**
     * POST /api/v1/knowledge/:id/format
     * AI-assisted article formatting and summary generation
     * Bokeh优化：排版优化 + 详细摘要，完成后直接更新正文
     */
    router.post('/:id/format', authenticate, async (req, res) => {
        try {
            // Check permission
            if (req.user.role !== 'Admin' && req.user.role !== 'Lead' && req.user.role !== 'Editor') {
                return res.status(403).json({
                    success: false,
                    error: { code: 'FORBIDDEN', message: '无权执行此操作' }
                });
            }

            const article = db.prepare('SELECT * FROM knowledge_articles WHERE id = ?').get(req.params.id);
            if (!article) {
                return res.status(404).json({
                    success: false,
                    error: { code: 'NOT_FOUND', message: '文章不存在' }
                });
            }

            const { mode = 'full' } = req.body; // 'full' | 'layout' | 'summary'

            // Use injected aiService (from module.exports parameter)
            if (!aiService) {
                return res.status(500).json({
                    success: false,
                    error: { code: 'AI_NOT_AVAILABLE', message: 'AI服务未配置' }
                });
            }

            console.log(`[Knowledge Format] Starting Bokeh optimization for article ${article.id}: ${article.title}`);

            let formattedContent = article.content;
            let summaryText = article.summary;

            // 任务1：排版优化
            if (mode === 'full' || mode === 'layout') {
                const layoutPrompt = `你是Bokeh，Kinefinity的专业知识库编辑助手。
请分析以下技术文章，并进行排版优化：

**标题**: ${article.title}

**原始内容**:
${article.content.substring(0, 8000)}

**优化任务**:
1. 识别并优化文章结构（添加缺失的小标题、将长段落拆分为短段落或列表）
2. 保持技术准确性，不随意扩写
3. 如有步骤操作，改为编号列表
4. 保留所有图片引用（<img> 标签），不删除
5. 保留表格格式

请直接输出HTML格式的优化内容，不要添加额外说明。`;

                try {
                    formattedContent = await aiService.generate('logic',
                        'You are Bokeh, a professional knowledge base editor. Optimize article layout while preserving technical accuracy.',
                        layoutPrompt
                    );
                    console.log('[Knowledge Format] Layout optimization completed');
                } catch (aiErr) {
                    console.error('[Knowledge Format] Layout AI error:', aiErr.message);
                    formattedContent = article.content;
                }
            }

            // 任务2：生成详细摘要
            if (mode === 'full' || mode === 'summary') {
                const summaryPrompt = `你是Bokeh，Kinefinity的专业知识库编辑助手。
请为以下技术文章生成一个详细摘要（3-5句话，最多190字），概括文章的核心内容：

**标题**: ${article.title}

**内容片段**:
${formattedContent.replace(/<[^>]+>/g, '').substring(0, 3000)}

请直接输出摘要文本，不要添加引号或额外说明。`;

                try {
                    summaryText = await aiService.generate('logic',
                        'You are Bokeh. Generate comprehensive summaries for technical documentation.',
                        summaryPrompt
                    );
                    summaryText = summaryText.trim().substring(0, 190);
                    console.log('[Knowledge Format] Summary generation completed');
                } catch (aiErr) {
                    console.error('[Knowledge Format] Summary AI error:', aiErr.message);
                    summaryText = formattedContent
                        .replace(/<[^>]+>/g, '')
                        .replace(/\s+/g, ' ')
                        .trim()
                        .substring(0, 190);
                }
            }

            // 生成简短摘要（从详细摘要截取，不调用AI）
            const shortSummary = summaryText.substring(0, 100);

            // 分析图片布局
            const imageMatches = formattedContent.match(/<img[^>]*>/g) || [];
            const imageLayoutMeta = imageMatches.length > 0 ? {
                mode: 'auto',
                maxWidth: 720,
                imageCount: imageMatches.length
            } : null;

            // Parse chapter info from title
            const chapterMatch = article.title.match(/:\s*(\d+)(?:\.(\d+))?/);
            const chapterNumber = chapterMatch ? parseInt(chapterMatch[1]) : null;
            const sectionNumber = chapterMatch && chapterMatch[2] ? parseInt(chapterMatch[2]) : null;

            // 直接更新正文内容（不再保留草稿状态）
            db.prepare(`
                UPDATE knowledge_articles SET
                    content = ?,
                    summary = ?,
                    summary = ?,
                    image_layout_meta = ?,
                    chapter_number = ?,
                    section_number = ?,
                    format_status = 'published',
                    formatted_by = 'ai',
                    formatted_at = CURRENT_TIMESTAMP,
                    updated_at = CURRENT_TIMESTAMP
                WHERE id = ?
            `).run(
                formattedContent,
                summaryText,
                shortSummary,
                imageLayoutMeta ? JSON.stringify(imageLayoutMeta) : null,
                chapterNumber,
                sectionNumber,
                article.id
            );

            // Log audit
            if (logAudit) {
                logAudit({
                    operation: 'format',
                    operation_detail: `Bokeh优化 (${mode})`,
                    article_id: article.id,
                    article_title: article.title,
                    article_slug: article.slug,
                    user_id: req.user.id,
                    user_name: req.user.username,
                    user_role: req.user.role
                });
            }

            console.log(`[Knowledge Format] ✅ Article ${article.id} optimized and published`);

            res.json({
                success: true,
                data: {
                    id: article.id,
                    format_status: 'published',
                    formatted_by: 'ai',
                    formatted_at: new Date().toISOString(),
                    summary: summaryText,
                    image_count: imageMatches.length
                }
            });
        } catch (err) {
            console.error('[Knowledge Format] Error:', err);
            res.status(500).json({
                success: false,
                error: { code: 'FORMAT_ERROR', message: err.message }
            });
        }
    });

    /**
     * POST /api/v1/knowledge/:id/publish-format
     * Publish formatted draft to main content
     */
    router.post('/:id/publish-format', authenticate, (req, res) => {
        try {
            if (req.user.role !== 'Admin' && req.user.role !== 'Lead') {
                return res.status(403).json({
                    success: false,
                    error: { code: 'FORBIDDEN', message: '只有管理员可以发布格式化内容' }
                });
            }

            const article = db.prepare('SELECT * FROM knowledge_articles WHERE id = ?').get(req.params.id);
            if (!article) {
                return res.status(404).json({
                    success: false,
                    error: { code: 'NOT_FOUND', message: '文章不存在' }
                });
            }

            if (!article.formatted_content) {
                return res.status(400).json({
                    success: false,
                    error: { code: 'NO_DRAFT', message: '没有待发布的格式化草稿' }
                });
            }

            // Save current content as version
            db.prepare(`
                INSERT INTO knowledge_article_versions (article_id, version, title, content, change_summary, created_by)
                SELECT id, COALESCE((SELECT MAX(version) FROM knowledge_article_versions WHERE article_id = ?), 0) + 1,
                       title, content, '发布格式化内容', ?
                FROM knowledge_articles WHERE id = ?
            `).run(article.id, req.user.id, article.id);

            // Publish: copy formatted_content to content, update summary
            db.prepare(`
                UPDATE knowledge_articles SET
                    content = formatted_content,
                    summary = summary,
                    format_status = 'published',
                    updated_by = ?,
                    updated_at = CURRENT_TIMESTAMP
                WHERE id = ?
            `).run(req.user.id, article.id);

            // Log audit
            if (logAudit) {
                logAudit({
                    operation: 'publish_format',
                    operation_detail: '发布Bokeh格式化内容',
                    article_id: article.id,
                    article_title: article.title,
                    article_slug: article.slug,
                    user_id: req.user.id,
                    user_name: req.user.username,
                    user_role: req.user.role
                });
            }

            res.json({
                success: true,
                data: {
                    id: article.id,
                    format_status: 'published',
                    published_at: new Date().toISOString()
                }
            });
        } catch (err) {
            console.error('[Knowledge Publish Format] Error:', err);
            res.status(500).json({
                success: false,
                error: { code: 'PUBLISH_ERROR', message: err.message }
            });
        }
    });

    /**
     * GET /api/v1/knowledge/chapter-aggregate
     * Get chapter aggregation view with all sub-sections
     * Query params: product_line, product_model, category, chapter_number
     */
    router.get('/chapter-aggregate', authenticate, (req, res) => {
        try {
            const { product_line, product_model, category = 'Manual', chapter_number } = req.query;

            if (!product_line || !product_model || !chapter_number) {
                return res.status(400).json({
                    success: false,
                    error: { code: 'MISSING_PARAMS', message: '缺少必要参数: product_line, product_model, chapter_number' }
                });
            }

            const user = req.user;
            const visibilityConditions = buildVisibilityConditions(user);

            // Find all articles in this chapter (main chapter + sub-sections)
            // Pattern: title contains "章节号." like "2." for chapter 2, "2.1" for section 2.1
            const chapterPattern = `${product_model}: ${chapter_number}.%`;
            const mainChapterPattern = `${product_model}: ${chapter_number}.%`;

            const articles = db.prepare(`
                SELECT 
                    ka.id, ka.title, ka.slug, ka.summary,
                    ka.chapter_number, ka.section_number,
                    ka.category, ka.product_line, ka.product_models,
                    ka.view_count, ka.helpful_count
                FROM knowledge_articles ka
                WHERE ka.status = 'Published'
                  AND ka.product_line = ?
                  AND ka.product_models LIKE ?
                  AND ka.category = ?
                  AND (ka.title LIKE ? OR ka.chapter_number = ?)
                  AND (${visibilityConditions.sql})
                ORDER BY ka.chapter_number, ka.section_number NULLS FIRST
            `).all(
                product_line,
                `%${product_model}%`,
                category,
                chapterPattern,
                parseInt(chapter_number),
                ...visibilityConditions.params
            );

            // Separate main chapter from sub-sections
            let mainChapter = null;
            const subSections = [];

            articles.forEach(article => {
                const parsedSection = article.section_number;
                if (parsedSection === null || parsedSection === undefined) {
                    // This is the main chapter (e.g., "2. 快速指南")
                    if (!mainChapter) mainChapter = article;
                } else {
                    subSections.push(article);
                }
            });

            // If no main chapter found, use first article as main
            if (!mainChapter && articles.length > 0) {
                mainChapter = articles[0];
            }

            // Get full content of main chapter for intro display
            let mainContent = null;
            if (mainChapter) {
                const fullArticle = db.prepare('SELECT content, formatted_content FROM knowledge_articles WHERE id = ?').get(mainChapter.id);
                mainContent = fullArticle?.formatted_content || fullArticle?.content || '';
            }

            res.json({
                success: true,
                data: {
                    chapter_number: parseInt(chapter_number),
                    main_chapter: mainChapter ? {
                        id: mainChapter.id,
                        title: mainChapter.title,
                        slug: mainChapter.slug,
                        summary: mainChapter.summary,
                        content_preview: mainContent?.substring(0, 1000)
                    } : null,
                    sub_sections: subSections.map(s => ({
                        id: s.id,
                        title: s.title,
                        slug: s.slug,
                        section_number: s.section_number,
                        summary: s.summary,
                        view_count: s.view_count,
                        helpful_count: s.helpful_count
                    })),
                    total_articles: articles.length
                }
            });
        } catch (err) {
            console.error('[Knowledge Chapter Aggregate] Error:', err);
            res.status(500).json({
                success: false,
                error: { code: 'SERVER_ERROR', message: err.message }
            });
        }
    });

    /**
     * GET /api/v1/knowledge/chapter-full
     * Get full chapter content (main + all sub-sections concatenated)
     * For "read entire chapter" feature
     */
    router.get('/chapter-full', authenticate, (req, res) => {
        try {
            const { product_line, product_model, category = 'Manual', chapter_number } = req.query;

            if (!product_line || !product_model || !chapter_number) {
                return res.status(400).json({
                    success: false,
                    error: { code: 'MISSING_PARAMS', message: '缺少必要参数' }
                });
            }

            const user = req.user;
            const visibilityConditions = buildVisibilityConditions(user);

            const chapterPattern = `${product_model}: ${chapter_number}.%`;

            const articles = db.prepare(`
                SELECT 
                    ka.id, ka.title, ka.slug, ka.content, ka.formatted_content,
                    ka.chapter_number, ka.section_number
                FROM knowledge_articles ka
                WHERE ka.status = 'Published'
                  AND ka.product_line = ?
                  AND ka.product_models LIKE ?
                  AND ka.category = ?
                  AND (ka.title LIKE ? OR ka.chapter_number = ?)
                  AND (${visibilityConditions.sql})
                ORDER BY ka.chapter_number, ka.section_number NULLS FIRST
            `).all(
                product_line,
                `%${product_model}%`,
                category,
                chapterPattern,
                parseInt(chapter_number),
                ...visibilityConditions.params
            );

            // Concatenate all content
            let fullContent = '';
            const toc = [];

            articles.forEach((article, idx) => {
                const content = article.formatted_content || article.content || '';
                const anchor = `section-${article.section_number || 'main'}`;

                // Add to TOC
                toc.push({
                    id: article.id,
                    title: article.title,
                    slug: article.slug,
                    anchor
                });

                // Add section header and content
                fullContent += `\n\n<a id="${anchor}"></a>\n\n`;
                fullContent += `## ${article.title}\n\n`;
                fullContent += content;
                fullContent += '\n\n---\n';
            });

            res.json({
                success: true,
                data: {
                    chapter_number: parseInt(chapter_number),
                    title: `第${chapter_number}章`,
                    toc,
                    full_content: fullContent.trim(),
                    article_count: articles.length
                }
            });
        } catch (err) {
            console.error('[Knowledge Chapter Full] Error:', err);
            res.status(500).json({
                success: false,
                error: { code: 'SERVER_ERROR', message: err.message }
            });
        }
    });

    return router;
};
