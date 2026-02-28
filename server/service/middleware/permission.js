/**
 * Permission Middleware (穿透式权限中间件)
 * P2 架构升级
 * 
 * 实现基于角色的权限控制和 View As 功能
 */

/**
 * 角色权限定义
 */
const ROLE_PERMISSIONS = {
  Admin: {
    canViewAll: true,
    canViewInternal: true,
    canViewDealer: true,
    canEditAll: true,
    canDelete: true,
    canAssign: true,
    canViewAs: true,
    departments: ['*']
  },
  Employee: {
    canViewAll: false,
    canViewInternal: true,
    canViewDealer: true,
    canEditAll: false,
    canDelete: false,
    canAssign: true,
    canViewAs: false,
    departments: ['marketing', 'operation', 'rd']
  },
  Market: {
    canViewAll: false,
    canViewInternal: true,
    canViewDealer: true,
    canEditAll: false,
    canDelete: false,
    canAssign: false,
    canViewAs: false,
    departments: ['marketing']
  },
  Dealer: {
    canViewAll: false,
    canViewInternal: false,
    canViewDealer: false,  // Only own dealer's data
    canEditAll: false,
    canDelete: false,
    canAssign: false,
    canViewAs: false,
    departments: []
  }
};

/**
 * 部门权限映射
 */
const DEPARTMENT_PERMISSIONS = {
  operation: {
    canAccessOp: true,
    canAccessMs: false,
    canAccessRd: false,
    ticketVisibility: ['all', 'internal', 'op_only']
  },
  marketing: {
    canAccessOp: false,
    canAccessMs: true,
    canAccessRd: false,
    ticketVisibility: ['all', 'internal']
  },
  rd: {
    canAccessOp: true,
    canAccessMs: true,
    canAccessRd: true,
    ticketVisibility: ['all', 'internal', 'op_only', 'rd_only']
  }
};

/**
 * 创建权限检查器
 * @param {Object} user - 当前用户
 * @returns {Object} 权限检查方法集合
 */
function createPermissionChecker(user) {
  const rolePerms = ROLE_PERMISSIONS[user.role] || ROLE_PERMISSIONS.Employee;
  const deptPerms = DEPARTMENT_PERMISSIONS[user.department] || {};
  
  // 如果是 View As 模式
  const effectiveUser = user.viewingAs || user;
  const effectiveRole = ROLE_PERMISSIONS[effectiveUser.role] || rolePerms;
  
  return {
    /**
     * 检查是否可以访问工单
     */
    canAccessTicket(ticket) {
      // Admin 可以访问所有
      if (rolePerms.canViewAll) return true;
      
      // Dealer 只能访问自己的
      if (user.user_type === 'Dealer') {
        return ticket.dealer_id === user.dealer_id;
      }
      
      // 员工基于部门和参与者检查
      if (ticket.participants) {
        try {
          const participants = JSON.parse(ticket.participants);
          if (participants.some(p => p.user_id === user.id)) {
            return true;
          }
        } catch (e) {}
      }
      
      // 基于指派
      if (ticket.assigned_to === user.id) return true;
      if (ticket.submitted_by === user.id) return true;
      
      // 基于部门可见性
      return true; // 内部员工默认可见所有内部工单
    },
    
    /**
     * 检查活动可见性
     */
    canViewActivity(activity) {
      const visibility = activity.visibility || 'all';
      
      if (visibility === 'all') return true;
      
      if (user.user_type === 'Dealer') {
        return visibility === 'all';
      }
      
      if (visibility === 'internal') {
        return effectiveRole.canViewInternal;
      }
      
      if (visibility === 'op_only') {
        return deptPerms.canAccessOp || rolePerms.canViewAll;
      }
      
      if (visibility === 'rd_only') {
        return deptPerms.canAccessRd || rolePerms.canViewAll;
      }
      
      return false;
    },
    
    /**
     * 检查是否可以编辑工单
     */
    canEditTicket(ticket) {
      if (rolePerms.canEditAll) return true;
      if (ticket.assigned_to === user.id) return true;
      if (ticket.submitted_by === user.id && ticket.status === 'open') return true;
      return false;
    },
    
    /**
     * 检查是否可以指派工单
     */
    canAssignTicket(ticket) {
      if (!rolePerms.canAssign) return false;
      if (rolePerms.canEditAll) return true;
      
      // MS 只能指派给自己部门
      if (user.department === 'marketing') {
        return true; // MS 可以指派给任何 MS
      }
      
      return user.department === 'operation' || user.department === 'rd';
    },
    
    /**
     * 检查是否可以使用 View As
     */
    canUseViewAs() {
      return rolePerms.canViewAs;
    },
    
    /**
     * 获取允许的活动可见性选项
     */
    getAllowedVisibilities() {
      if (rolePerms.canViewAll) {
        return ['all', 'internal', 'op_only', 'rd_only'];
      }
      return deptPerms.ticketVisibility || ['all'];
    },
    
    /**
     * 过滤查询条件 - 添加权限限制
     */
    applyQueryFilter(baseQuery, params = []) {
      if (rolePerms.canViewAll) {
        return { query: baseQuery, params };
      }
      
      if (user.user_type === 'Dealer') {
        return {
          query: `${baseQuery} AND dealer_id = ?`,
          params: [...params, user.dealer_id]
        };
      }
      
      // 内部员工 - 可以看到所有非经销商专属的
      return { query: baseQuery, params };
    }
  };
}

/**
 * Express 中间件 - 注入权限检查器
 */
function permissionMiddleware(req, res, next) {
  if (req.user) {
    req.permissions = createPermissionChecker(req.user);
  }
  next();
}

/**
 * View As 中间件
 * 允许管理员以其他用户身份查看
 */
function viewAsMiddleware(db) {
  return (req, res, next) => {
    const viewAsId = req.headers['x-view-as-user'];
    
    if (viewAsId && req.user) {
      const checker = createPermissionChecker(req.user);
      
      if (checker.canUseViewAs()) {
        const viewAsUser = db.prepare('SELECT * FROM users WHERE id = ?').get(viewAsId);
        
        if (viewAsUser) {
          req.user.viewingAs = viewAsUser;
          req.user.originalUser = { ...req.user };
          req.permissions = createPermissionChecker(req.user);
        }
      }
    }
    
    next();
  };
}

/**
 * 权限检查装饰器 - 用于路由
 * @param {string} permission - 权限名称
 */
function requirePermission(permission) {
  return (req, res, next) => {
    if (!req.permissions) {
      return res.status(401).json({ success: false, error: '未认证' });
    }
    
    const checkMethod = `can${permission.charAt(0).toUpperCase() + permission.slice(1)}`;
    
    if (typeof req.permissions[checkMethod] === 'function') {
      if (!req.permissions[checkMethod]()) {
        return res.status(403).json({ success: false, error: '权限不足' });
      }
    }
    
    next();
  };
}

module.exports = {
  ROLE_PERMISSIONS,
  DEPARTMENT_PERMISSIONS,
  createPermissionChecker,
  permissionMiddleware,
  viewAsMiddleware,
  requirePermission
};
