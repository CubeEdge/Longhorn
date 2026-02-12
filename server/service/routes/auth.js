/**
 * Authentication Routes
 * Extended for dealer/customer login support
 */

const express = require('express');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

const JWT_SECRET = process.env.JWT_SECRET || 'longhorn-secret-key-2026';
const TOKEN_EXPIRY = '24h';
const REFRESH_TOKEN_EXPIRY = '7d';

module.exports = function(db, authenticate) {
    const router = express.Router();

    /**
     * POST /api/v1/auth/login
     * Unified login for employees, dealers, and customers
     */
    router.post('/login', (req, res) => {
        try {
            const { email, password, username } = req.body;
            const loginId = email || username;

            if (!loginId || !password) {
                return res.status(400).json({
                    success: false,
                    error: { code: 'MISSING_CREDENTIALS', message: '请提供用户名/邮箱和密码' }
                });
            }

            // Find user by username or email
            // 经销商用户通过 dealer_id 关联到 accounts 表（新架构）
            const user = db.prepare(`
                SELECT u.*, d.name as department_name, 
                       acc.name as dealer_name, acc.dealer_code as dealer_code
                FROM users u
                LEFT JOIN departments d ON u.department_id = d.id
                LEFT JOIN accounts acc ON u.dealer_id = acc.id AND acc.account_type = 'DEALER'
                WHERE u.username = ? OR u.username = ?
            `).get(loginId, loginId.toLowerCase());

            if (!user) {
                return res.status(401).json({
                    success: false,
                    error: { code: 'INVALID_CREDENTIALS', message: '用户名或密码错误' }
                });
            }

            // Verify password
            const validPassword = bcrypt.compareSync(password, user.password);
            if (!validPassword) {
                return res.status(401).json({
                    success: false,
                    error: { code: 'INVALID_CREDENTIALS', message: '用户名或密码错误' }
                });
            }

            // Generate tokens
            const accessToken = jwt.sign(
                { id: user.id, username: user.username, role: user.role },
                JWT_SECRET,
                { expiresIn: TOKEN_EXPIRY }
            );

            const refreshToken = jwt.sign(
                { id: user.id, type: 'refresh' },
                JWT_SECRET,
                { expiresIn: REFRESH_TOKEN_EXPIRY }
            );

            // Build permissions based on user type
            const permissions = buildPermissions(user);

            res.json({
                success: true,
                data: {
                    access_token: accessToken,
                    refresh_token: refreshToken,
                    expires_in: 86400, // 24 hours in seconds
                    user: {
                        id: user.id,
                        name: user.username,
                        email: user.username, // Using username as email for now
                        user_type: user.user_type || 'Employee',
                        department: user.department_name,
                        role: user.role,
                        region_responsible: user.region_responsible,
                        dealer_id: user.dealer_id,
                        dealer_name: user.dealer_name,
                        permissions
                    }
                }
            });
        } catch (err) {
            console.error('[Auth] Login error:', err);
            res.status(500).json({
                success: false,
                error: { code: 'SERVER_ERROR', message: err.message }
            });
        }
    });

    /**
     * POST /api/v1/auth/refresh
     * Refresh access token
     */
    router.post('/refresh', (req, res) => {
        try {
            const { refresh_token } = req.body;

            if (!refresh_token) {
                return res.status(400).json({
                    success: false,
                    error: { code: 'MISSING_TOKEN', message: '请提供refresh_token' }
                });
            }

            jwt.verify(refresh_token, JWT_SECRET, (err, decoded) => {
                if (err || decoded.type !== 'refresh') {
                    return res.status(401).json({
                        success: false,
                        error: { code: 'INVALID_TOKEN', message: 'refresh_token无效或已过期' }
                    });
                }

                // Get user
                const user = db.prepare('SELECT id, username, role FROM users WHERE id = ?').get(decoded.id);
                if (!user) {
                    return res.status(401).json({
                        success: false,
                        error: { code: 'USER_NOT_FOUND', message: '用户不存在' }
                    });
                }

                // Generate new access token
                const accessToken = jwt.sign(
                    { id: user.id, username: user.username, role: user.role },
                    JWT_SECRET,
                    { expiresIn: TOKEN_EXPIRY }
                );

                res.json({
                    success: true,
                    data: {
                        access_token: accessToken,
                        expires_in: 86400
                    }
                });
            });
        } catch (err) {
            console.error('[Auth] Refresh error:', err);
            res.status(500).json({
                success: false,
                error: { code: 'SERVER_ERROR', message: err.message }
            });
        }
    });

    /**
     * GET /api/v1/auth/me
     * Get current user info
     */
    router.get('/me', authenticate, (req, res) => {
        try {
            // 经销商用户通过 dealer_id 关联到 accounts 表（新架构）
            const user = db.prepare(`
                SELECT u.*, d.name as department_name, 
                       acc.name as dealer_name, acc.dealer_code as dealer_code
                FROM users u
                LEFT JOIN departments d ON u.department_id = d.id
                LEFT JOIN accounts acc ON u.dealer_id = acc.id AND acc.account_type = 'DEALER'
                WHERE u.id = ?
            `).get(req.user.id);

            if (!user) {
                return res.status(404).json({
                    success: false,
                    error: { code: 'USER_NOT_FOUND', message: '用户不存在' }
                });
            }

            const permissions = buildPermissions(user);

            res.json({
                success: true,
                data: {
                    id: user.id,
                    name: user.username,
                    email: user.username,
                    user_type: user.user_type || 'Employee',
                    department: user.department_name,
                    role: user.role,
                    region_responsible: user.region_responsible,
                    dealer_id: user.dealer_id,
                    dealer_name: user.dealer_name,
                    permissions
                }
            });
        } catch (err) {
            console.error('[Auth] Me error:', err);
            res.status(500).json({
                success: false,
                error: { code: 'SERVER_ERROR', message: err.message }
            });
        }
    });

    /**
     * Build permissions array based on user type and role
     */
    function buildPermissions(user) {
        const permissions = [];
        const userType = user.user_type || 'Employee';
        const role = user.role;

        if (userType === 'Dealer') {
            // Dealer permissions
            permissions.push(
                'issue:create',
                'issue:read_own',
                'issue:update_own',
                'kb:read_dealer'
            );
        } else if (userType === 'Customer') {
            // Customer permissions
            permissions.push(
                'issue:create',
                'issue:read_own',
                'kb:read_public'
            );
        } else {
            // Employee permissions based on role
            if (role === 'Admin') {
                permissions.push(
                    'issue:*',
                    'kb:*',
                    'user:*',
                    'dealer:*',
                    'stats:*'
                );
            } else if (role === 'Lead') {
                permissions.push(
                    'issue:create',
                    'issue:read_all',
                    'issue:update_dept',
                    'issue:assign',
                    'kb:read_internal',
                    'kb:edit',
                    'stats:read'
                );
            } else {
                // Member
                permissions.push(
                    'issue:create',
                    'issue:read_assigned',
                    'issue:update_assigned',
                    'kb:read_internal',
                    'stats:read_basic'
                );
            }

            // Department-specific permissions
            const dept = user.department_name || '';
            if (dept.includes('市场') || dept.includes('MS')) {
                permissions.push('issue:assign', 'rma:create', 'payment:record');
            }
            if (dept.includes('生产') || dept.includes('RD')) {
                permissions.push('issue:repair_update');
            }
            if (dept.includes('研发')) {
                permissions.push('stats:advanced', 'ai:analyze');
            }
        }

        return permissions;
    }

    return router;
};
