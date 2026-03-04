/**
 * Permission Middleware (穿透式权限中间件)
 * P2 架构升级
 * 
 * 核心原则：隔离与穿透 (Isolation & Passthrough)
 * - OP/RD: 默认无权访问 CRM/IB，仅通过工单获得 JIT 穿透
 * - MS: 全局读写
 * - Admin/Exec: 全权限
 */

/**
 * 判断用户是否拥有 CRM/IB 全局访问权限
 * Admin, Exec, MS 部门人员有全局权限
 */
function hasGlobalAccess(user) {
  if (!user) return false;
  // Admin / Exec 全权限
  if (user.role === 'Admin' || user.role === 'Exec') return true;
  // MS (市场部) 全局读写
  const deptCode = user.department_code || '';
  if (deptCode === 'MS') return true;
  // GE (通用台面) — 平台管理员
  if (deptCode === 'GE') return true;
  return false;
}

/**
 * 获取用户通过工单关联可访问的 account_id 列表 (JIT 穿透)
 * 通过 ticket_participants + tickets 表查询
 */
function getAccessibleAccountIds(db, userId) {
  const rows = db.prepare(`
        SELECT DISTINCT t.account_id 
        FROM tickets t
        INNER JOIN ticket_participants tp ON tp.ticket_id = t.id
        WHERE tp.user_id = ? AND t.account_id IS NOT NULL
        UNION
        SELECT DISTINCT t.account_id 
        FROM tickets t
        WHERE (t.assigned_to = ? OR t.created_by = ?) AND t.account_id IS NOT NULL
    `).all(userId, userId, userId);
  return rows.map(r => r.account_id);
}

/**
 * 获取用户通过工单关联可访问的 serial_number 列表 (JIT 穿透)
 */
function getAccessibleSerialNumbers(db, userId) {
  const rows = db.prepare(`
        SELECT DISTINCT t.serial_number 
        FROM tickets t
        INNER JOIN ticket_participants tp ON tp.ticket_id = t.id
        WHERE tp.user_id = ? AND t.serial_number IS NOT NULL AND t.serial_number != ''
        UNION
        SELECT DISTINCT t.serial_number 
        FROM tickets t
        WHERE (t.assigned_to = ? OR t.created_by = ?) AND t.serial_number IS NOT NULL AND t.serial_number != ''
    `).all(userId, userId, userId);
  return rows.map(r => r.serial_number);
}

/**
 * 获取用户通过工单关联可访问的 dealer_id 列表
 */
function getAccessibleDealerIds(db, userId) {
  const rows = db.prepare(`
        SELECT DISTINCT t.dealer_id 
        FROM tickets t
        INNER JOIN ticket_participants tp ON tp.ticket_id = t.id
        WHERE tp.user_id = ? AND t.dealer_id IS NOT NULL
        UNION
        SELECT DISTINCT t.dealer_id 
        FROM tickets t
        WHERE (t.assigned_to = ? OR t.created_by = ?) AND t.dealer_id IS NOT NULL
    `).all(userId, userId, userId);
  return rows.map(r => r.dealer_id);
}

// ============================
// Express 中间件
// ============================

/**
 * CRM 访问守卫 — 保护客户/经销商列表 API
 * OP/RD 用户无法浏览全量客户列表，返回 403
 * 但可以通过 /context/* 使用工单穿透
 */
function requireCrmAccess(req, res, next) {
  if (!req.user) {
    return res.status(401).json({ success: false, error: '未认证' });
  }
  if (hasGlobalAccess(req.user)) {
    return next();
  }
  return res.status(403).json({
    success: false,
    error: '权限不足：您所在部门无权浏览客户档案全量列表。如需查看特定客户信息，请通过关联工单访问。'
  });
}

/**
 * IB (Install Base / 产品库) 访问守卫
 * OP/RD 不能浏览全量产品列表，但可搜索自己工单关联的 SN
 */
function requireIbAccess(db) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ success: false, error: '未认证' });
    }
    if (hasGlobalAccess(req.user)) {
      return next();
    }
    // OP/RD 可以搜索，但仅返回自己工单关联的产品
    // 注入可访问的 SN 列表到 req 上，让 route handler 过滤
    req.accessibleSerialNumbers = getAccessibleSerialNumbers(db, req.user.id);
    req.isRestrictedAccess = true;
    next();
  };
}

/**
 * Context API 穿透守卫
 * /context/by-account: OP/RD 仅能查询自己工单关联的 account
 * /context/by-serial-number: OP/RD 仅能查询自己工单关联的 SN
 */
function requireContextAccess(db) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ success: false, error: '未认证' });
    }
    if (hasGlobalAccess(req.user)) {
      return next();
    }

    const { account_id, serial_number } = req.query;

    // 检查 account_id 穿透
    if (account_id) {
      const accessibleIds = getAccessibleAccountIds(db, req.user.id);
      const accessibleDealerIds = getAccessibleDealerIds(db, req.user.id);
      const allAccessible = [...accessibleIds, ...accessibleDealerIds];
      if (!allAccessible.includes(parseInt(account_id))) {
        return res.status(403).json({
          success: false,
          error: '权限不足：您没有该客户的访问权限。仅可查看与您关联工单的客户信息。'
        });
      }
    }

    // 检查 serial_number 穿透
    if (serial_number) {
      const accessibleSNs = getAccessibleSerialNumbers(db, req.user.id);
      if (!accessibleSNs.includes(serial_number)) {
        return res.status(403).json({
          success: false,
          error: '权限不足：您没有该设备的访问权限。仅可查看与您关联工单的设备信息。'
        });
      }
    }

    next();
  };
}

/**
 * View As 中间件 (保持原有逻辑)
 */
function viewAsMiddleware(db) {
  return (req, res, next) => {
    const viewAsId = req.headers['x-view-as-user'];

    if (viewAsId && req.user) {
      if (req.user.role === 'Admin' || req.user.role === 'Exec') {
        const viewAsUser = db.prepare(`
                    SELECT u.*, d.name as department_name, d.name as department_code
                    FROM users u
                    LEFT JOIN departments d ON u.department_id = d.id
                    WHERE u.id = ?
                `).get(viewAsId);

        if (viewAsUser) {
          req.originalUser = { ...req.user };
          req.user.id = viewAsUser.id;
          req.user.username = viewAsUser.username;
          req.user.display_name = viewAsUser.display_name;
          req.user.role = viewAsUser.role;
          req.user.department_id = viewAsUser.department_id;
          req.user.department_name = viewAsUser.department_name;
          req.user.department_code = viewAsUser.department_code;
          req.user.user_type = viewAsUser.user_type;
          req.user.dealer_id = viewAsUser.dealer_id;
          req.user.region_responsible = viewAsUser.region_responsible;
          req.user.viewingAs = viewAsUser;
          req.user.isViewingAs = true;
        }
      }
    }

    next();
  };
}

module.exports = {
  hasGlobalAccess,
  getAccessibleAccountIds,
  getAccessibleSerialNumbers,
  getAccessibleDealerIds,
  requireCrmAccess,
  requireIbAccess,
  requireContextAccess,
  viewAsMiddleware
};
