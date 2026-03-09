/**
 * Upload Routes
 * File upload handling for warranty invoices and service attachments
 */

const express = require('express');
const path = require('path');
const fs = require('fs-extra');

module.exports = function (db, authenticate, multerModule, attachmentsDir) {
    const router = express.Router();

    // Setup multer for file uploads
    const multer = multerModule || require('multer');

    // Base storage path - use fileserver if available, fallback to attachmentsDir
    const getBaseStoragePath = () => {
        const fileserverPath = '/Volumes/fileserver/Service';
        if (fs.existsSync('/Volumes/fileserver')) {
            return fileserverPath;
        }
        // Fallback to local attachments dir for development
        return attachmentsDir;
    };

    // Configure storage for warranty documents
    const warrantyStorage = multer.diskStorage({
        destination: (req, file, cb) => {
            const uploadType = req.body.type || 'general';
            const basePath = getBaseStoragePath();

            // Map upload types to correct directories
            const typeDirMap = {
                'warranty_invoice': 'Products/WarrantyInvoices',
                'ticket_attachment': 'Tickets/General',
                'general': 'Temp/Uploads'
            };

            const destDir = path.join(basePath, typeDirMap[uploadType] || typeDirMap.general);
            fs.ensureDirSync(destDir);
            cb(null, destDir);
        },
        filename: (req, file, cb) => {
            // Generate unique filename: timestamp_random_originalname
            const timestamp = Date.now();
            const random = Math.random().toString(36).substring(2, 8);
            const ext = path.extname(file.originalname);
            const baseName = path.basename(file.originalname, ext).replace(/[^a-zA-Z0-9]/g, '_');
            cb(null, `${timestamp}_${random}_${baseName}${ext}`);
        }
    });

    const upload = multer({
        storage: warrantyStorage,
        limits: {
            fileSize: 5 * 1024 * 1024, // 5MB max for warranty documents
            files: 1
        },
        fileFilter: (req, file, cb) => {
            const allowedTypes = [
                'image/jpeg',
                'image/png',
                'image/gif',
                'image/webp',
                'application/pdf'
            ];
            if (allowedTypes.includes(file.mimetype)) {
                cb(null, true);
            } else {
                cb(new Error('不支持的文件类型，仅支持 JPG、PNG、GIF、WebP、PDF'), false);
            }
        }
    });

    /**
     * POST /api/v1/upload
     * Upload a file for warranty invoices or service attachments
     *
     * Body (multipart/form-data):
     *   - file: The file to upload (required)
     *   - type: Upload type/category (optional, default: 'general')
     *           Options: 'warranty_invoice', 'general', 'ticket_attachment'
     *
     * Response:
     *   {
     *     success: true,
     *     data: {
     *       url: '/uploads/warranty_invoice/123456_abc123_invoice.pdf',
     *       originalName: 'invoice.pdf',
     *       size: 12345,
     *       mimeType: 'application/pdf'
     *     }
     *   }
     */
    router.post('/', authenticate, upload.single('file'), (req, res) => {
        try {
            if (!req.file) {
                return res.status(400).json({
                    success: false,
                    error: 'No file uploaded'
                });
            }

            const uploadType = req.body.type || 'general';
            // Map upload types to URL paths
            const typeUrlMap = {
                'warranty_invoice': '/service/products/warranty-invoices',
                'ticket_attachment': '/service/tickets/attachments',
                'general': '/service/temp/uploads'
            };
            const urlPath = typeUrlMap[uploadType] || typeUrlMap.general;
            const normalizedPath = `${urlPath}/${req.file.filename}`;

            // Log upload to database
            try {
                db.prepare(`
                    INSERT INTO service_uploads (
                        file_name, file_path, file_size, file_type,
                        upload_type, uploaded_by, uploaded_at
                    ) VALUES (?, ?, ?, ?, ?, ?, datetime('now'))
                `).run(
                    req.file.originalname,
                    normalizedPath,
                    req.file.size,
                    req.file.mimetype,
                    uploadType,
                    req.user.id
                );
            } catch (dbErr) {
                // Non-fatal: log but don't fail the upload
                console.error('[Upload] Failed to log to database:', dbErr.message);
            }

            console.log(`[Upload] ${uploadType}: ${req.file.originalname} (${req.file.size} bytes) by ${req.user.email}`);

            res.json({
                success: true,
                data: {
                    url: normalizedPath,
                    originalName: req.file.originalname,
                    size: req.file.size,
                    mimeType: req.file.mimetype
                }
            });
        } catch (err) {
            console.error('[Upload] Error:', err);
            res.status(500).json({
                success: false,
                error: 'Upload failed: ' + err.message
            });
        }
    });

    /**
     * GET /api/v1/upload/file/:path(*)
     * Serve uploaded files from fileserver (with authentication)
     * Path format: /api/v1/upload/file/Products/WarrantyInvoices/filename.pdf
     */
    router.get('/file/:path(*)', authenticate, (req, res) => {
        try {
            // Get the file path from parameter
            const filePathParam = req.params.path;

            // Security: prevent directory traversal
            if (filePathParam.includes('..') || filePathParam.includes('//')) {
                return res.status(400).json({ error: 'Invalid filename' });
            }

            // Map URL path to storage path
            const basePath = getBaseStoragePath();
            const filePath = path.join(basePath, filePathParam);

            // Check if file exists
            if (!fs.existsSync(filePath)) {
                return res.status(404).json({ error: 'File not found' });
            }

            // Set appropriate content type
            const ext = path.extname(filePath).toLowerCase();
            const mimeTypes = {
                '.jpg': 'image/jpeg',
                '.jpeg': 'image/jpeg',
                '.png': 'image/png',
                '.gif': 'image/gif',
                '.webp': 'image/webp',
                '.pdf': 'application/pdf'
            };

            if (mimeTypes[ext]) {
                res.setHeader('Content-Type', mimeTypes[ext]);
            }

            // Stream the file
            res.sendFile(filePath);
        } catch (err) {
            console.error('[Upload] Serve error:', err);
            res.status(500).json({ error: 'Failed to serve file' });
        }
    });

    return router;
};
