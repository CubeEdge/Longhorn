/**
 * Warranty Calculation Service (保修计算引擎)
 * P2 架构升级
 * 
 * 参考: Service_PRD.md 1.2.3 保修判定规则
 */

// 默认保修期 (月)
const DEFAULT_WARRANTY_MONTHS = {
  camera: 24,        // 摄影机主机 2 年
  accessory: 12,     // 配件 1 年
  lens: 24,          // 镜头 2 年
  monitor: 12,       // 监视器 1 年
  default: 12        // 默认 1 年
};

// 产品类型映射
const PRODUCT_TYPE_MAP = {
  'MAVO': 'camera',
  'TERRA': 'camera',
  'KOMODO': 'camera',
  'EAGLE': 'camera',
  'KineMAX': 'camera',
  'KineMINI': 'camera',
  'KineRAW': 'camera',
  'KineLENS': 'lens',
  'KineMON': 'monitor',
  'KineMount': 'accessory',
  'KineBACK': 'accessory',
  'KineEVF': 'accessory'
};

/**
 * 获取产品类型
 * @param {string} productName - 产品名称
 * @returns {string} 产品类型
 */
function getProductType(productName) {
  if (!productName) return 'default';
  
  const upperName = productName.toUpperCase();
  for (const [prefix, type] of Object.entries(PRODUCT_TYPE_MAP)) {
    if (upperName.includes(prefix.toUpperCase())) {
      return type;
    }
  }
  return 'default';
}

/**
 * 计算保修到期日期
 * @param {string} purchaseDate - 购买日期
 * @param {string} productName - 产品名称
 * @param {number} [customMonths] - 自定义保修月数
 * @returns {Date} 保修到期日期
 */
function calculateWarrantyEndDate(purchaseDate, productName, customMonths = null) {
  const purchase = new Date(purchaseDate);
  
  const months = customMonths !== null 
    ? customMonths 
    : DEFAULT_WARRANTY_MONTHS[getProductType(productName)] || DEFAULT_WARRANTY_MONTHS.default;
  
  const endDate = new Date(purchase);
  endDate.setMonth(endDate.getMonth() + months);
  
  return endDate;
}

/**
 * 检查是否在保修期内
 * @param {string} purchaseDate - 购买日期
 * @param {string} productName - 产品名称
 * @param {Date|string} [checkDate] - 检查日期，默认为当前日期
 * @returns {Object} { is_warranty: boolean, warranty_end_date: string, days_remaining: number }
 */
function checkWarrantyStatus(purchaseDate, productName, checkDate = new Date()) {
  if (!purchaseDate) {
    return {
      is_warranty: null,
      warranty_end_date: null,
      days_remaining: null,
      status: 'unknown'
    };
  }

  const check = new Date(checkDate);
  const warrantyEnd = calculateWarrantyEndDate(purchaseDate, productName);
  
  const isWarranty = check <= warrantyEnd;
  const daysRemaining = Math.ceil((warrantyEnd.getTime() - check.getTime()) / (1000 * 60 * 60 * 24));
  
  let status = 'valid';
  if (!isWarranty) {
    status = 'expired';
  } else if (daysRemaining <= 30) {
    status = 'expiring_soon';
  }
  
  return {
    is_warranty: isWarranty,
    warranty_end_date: warrantyEnd.toISOString().split('T')[0],
    days_remaining: Math.max(0, daysRemaining),
    status
  };
}

/**
 * 批量计算工单的保修状态
 * @param {Object} db - better-sqlite3 数据库实例
 * @param {Array<number>} ticketIds - 工单 ID 数组
 * @returns {Object} { ticketId: warrantyInfo }
 */
function batchCheckWarranty(db, ticketIds) {
  const results = {};
  
  const tickets = db.prepare(`
    SELECT t.id, t.serial_number, t.product_id, 
           p.name as product_name,
           ad.purchase_date
    FROM tickets t
    LEFT JOIN products p ON t.product_id = p.id
    LEFT JOIN account_devices ad ON t.serial_number = ad.serial_number
    WHERE t.id IN (${ticketIds.map(() => '?').join(',')})
  `).all(...ticketIds);
  
  for (const ticket of tickets) {
    results[ticket.id] = checkWarrantyStatus(
      ticket.purchase_date,
      ticket.product_name
    );
  }
  
  return results;
}

/**
 * 更新工单的保修状态字段
 * @param {Object} db - better-sqlite3 数据库实例
 * @param {number} ticketId - 工单 ID
 * @returns {Object} 更新后的保修信息
 */
function updateTicketWarrantyStatus(db, ticketId) {
  const ticket = db.prepare(`
    SELECT t.id, t.serial_number, t.product_id, t.is_warranty,
           p.name as product_name,
           ad.purchase_date
    FROM tickets t
    LEFT JOIN products p ON t.product_id = p.id
    LEFT JOIN account_devices ad ON t.serial_number = ad.serial_number
    WHERE t.id = ?
  `).get(ticketId);
  
  if (!ticket) return null;
  
  const warrantyInfo = checkWarrantyStatus(ticket.purchase_date, ticket.product_name);
  
  // 只有当保修状态发生变化时才更新
  if (ticket.is_warranty !== warrantyInfo.is_warranty) {
    db.prepare('UPDATE tickets SET is_warranty = ?, updated_at = ? WHERE id = ?')
      .run(warrantyInfo.is_warranty ? 1 : 0, new Date().toISOString(), ticketId);
  }
  
  return warrantyInfo;
}

/**
 * 获取产品的保修信息
 * @param {Object} db - better-sqlite3 数据库实例
 * @param {string} serialNumber - 序列号
 * @returns {Object} 完整的保修信息
 */
function getProductWarrantyInfo(db, serialNumber) {
  const device = db.prepare(`
    SELECT ad.*, p.name as product_name, p.family as product_family
    FROM account_devices ad
    LEFT JOIN products p ON ad.product_id = p.id
    WHERE ad.serial_number = ?
  `).get(serialNumber);
  
  if (!device) {
    return { error: '设备未找到', serial_number: serialNumber };
  }
  
  const warrantyInfo = checkWarrantyStatus(device.purchase_date, device.product_name);
  
  return {
    serial_number: serialNumber,
    product_name: device.product_name,
    product_family: device.product_family,
    purchase_date: device.purchase_date,
    ...warrantyInfo
  };
}

module.exports = {
  DEFAULT_WARRANTY_MONTHS,
  getProductType,
  calculateWarrantyEndDate,
  checkWarrantyStatus,
  batchCheckWarranty,
  updateTicketWarrantyStatus,
  getProductWarrantyInfo
};
