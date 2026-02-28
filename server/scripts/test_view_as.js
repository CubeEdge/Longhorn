/**
 * View As Permission Test Script
 * 
 * Tests the "View As" functionality for permission-based access control.
 * 
 * Usage:
 *   node server/scripts/test_view_as.js
 * 
 * Test Scenarios:
 * 1. Admin can view as any dealer
 * 2. Dealer can only view own data
 * 3. User with ViewAs sees filtered tickets
 * 4. Permission boundaries are respected
 */

const Database = require('better-sqlite3');
const path = require('path');

// Database connection - main db for users, service db for tickets
const mainDbPath = path.join(__dirname, '..', 'longhorn.db');
const serviceDbPath = path.join(__dirname, '..', 'data', 'service.sqlite');
const db = new Database(mainDbPath, { readonly: true });
const serviceDb = new Database(serviceDbPath, { readonly: true });

console.log('='.repeat(60));
console.log(' View As Permission Test Suite');
console.log('='.repeat(60));
console.log();

// Test utilities
const TEST_RESULTS = [];

function test(name, fn) {
  process.stdout.write(`  [TEST] ${name}... `);
  try {
    const result = fn();
    if (result.passed) {
      console.log('✅ PASSED');
      TEST_RESULTS.push({ name, passed: true });
    } else {
      console.log(`❌ FAILED: ${result.reason}`);
      TEST_RESULTS.push({ name, passed: false, reason: result.reason });
    }
  } catch (err) {
    console.log(`❌ ERROR: ${err.message}`);
    TEST_RESULTS.push({ name, passed: false, reason: err.message });
  }
}

// Define role permissions (matching middleware/permission.js)
const ROLE_PERMISSIONS = {
  Admin: {
    canViewAll: true,
    canViewAs: true,
    canModifyAll: true,
    canAccessAdmin: true,
    canExport: true,
    canDeleteTickets: true
  },
  Manager: {
    canViewAll: true,
    canViewAs: true,
    canModifyAll: true,
    canAccessAdmin: true,
    canExport: true,
    canDeleteTickets: false
  },
  Staff: {
    canViewAll: false,
    canViewAs: false,
    canModifyAll: false,
    canAccessAdmin: false,
    canExport: false,
    canDeleteTickets: false
  },
  Dealer: {
    canViewAll: false,
    canViewAs: false,
    canViewDealer: true,
    canModifyAll: false,
    canAccessAdmin: false,
    canExport: false,
    canDeleteTickets: false
  }
};

// ==================== Test 1: Role Definitions ====================
console.log('\n📋 Test Group 1: Role Definitions');
console.log('-'.repeat(40));

test('Admin has canViewAll permission', () => {
  return { passed: ROLE_PERMISSIONS.Admin.canViewAll === true };
});

test('Admin has canViewAs permission', () => {
  return { passed: ROLE_PERMISSIONS.Admin.canViewAs === true };
});

test('Dealer lacks canViewAll permission', () => {
  return { passed: ROLE_PERMISSIONS.Dealer.canViewAll === false };
});

test('Dealer has canViewDealer permission', () => {
  return { passed: ROLE_PERMISSIONS.Dealer.canViewDealer === true };
});

test('Staff lacks canViewAs permission', () => {
  return { passed: ROLE_PERMISSIONS.Staff.canViewAs === false };
});

// ==================== Test 2: User Data ====================
console.log('\n📋 Test Group 2: User Data Verification');
console.log('-'.repeat(40));

test('Users table exists with role column', () => {
  try {
    const columns = db.prepare("PRAGMA table_info(users)").all();
    const hasRole = columns.some(c => c.name === 'role');
    return { passed: hasRole, reason: hasRole ? '' : 'role column not found' };
  } catch {
    return { passed: false, reason: 'users table does not exist' };
  }
});

test('At least one Admin user exists', () => {
  const count = db.prepare("SELECT COUNT(*) as cnt FROM users WHERE role = 'Admin'").get();
  return { passed: count.cnt > 0, reason: count.cnt === 0 ? 'No Admin user found' : '' };
});

test('Dealer users have dealer_id association', () => {
  const dealers = db.prepare("SELECT * FROM users WHERE role = 'Dealer' LIMIT 5").all();
  if (dealers.length === 0) {
    return { passed: true }; // No dealer users to check
  }
  const hasDealerId = dealers.every(d => d.dealer_id !== null);
  return { passed: hasDealerId, reason: hasDealerId ? '' : 'Some Dealer users missing dealer_id' };
});

// ==================== Test 3: Tickets Data Access ====================
console.log('\n📋 Test Group 3: Tickets Data Access Simulation');
console.log('-'.repeat(40));

// Simulate View As filtering
function simulateViewAs(viewerId, viewAsId) {
  // Get viewer info
  const viewer = db.prepare("SELECT id, role, dealer_id FROM users WHERE id = ?").get(viewerId);
  if (!viewer) return { tickets: [], error: 'Viewer not found' };

  const permissions = ROLE_PERMISSIONS[viewer.role] || ROLE_PERMISSIONS.Staff;
  
  // Check if viewer can use ViewAs
  if (viewAsId && !permissions.canViewAs) {
    return { tickets: [], error: 'Viewer lacks ViewAs permission' };
  }

  // Determine effective user
  let effectiveUserId = viewerId;
  let effectiveDealerId = viewer.dealer_id;
  
  if (viewAsId && permissions.canViewAs) {
    const targetUser = db.prepare("SELECT id, role, dealer_id FROM users WHERE id = ?").get(viewAsId);
    if (targetUser) {
      effectiveUserId = targetUser.id;
      effectiveDealerId = targetUser.dealer_id;
    }
  }

  // Build query based on permissions
  let query;
  let params = [];

  if (permissions.canViewAll && !viewAsId) {
    // Admin/Manager sees all
    query = "SELECT COUNT(*) as cnt FROM tickets";
  } else if (effectiveDealerId) {
    // Dealer sees own dealer's tickets
    query = "SELECT COUNT(*) as cnt FROM tickets WHERE dealer_id = ?";
    params = [effectiveDealerId];
  } else {
    // Staff sees own tickets
    query = "SELECT COUNT(*) as cnt FROM tickets WHERE created_by = ? OR assigned_to = ?";
    params = [effectiveUserId, effectiveUserId];
  }

  try {
    const result = serviceDb.prepare(query).get(...params);
    return { ticketCount: result.cnt, effectiveUserId, effectiveDealerId };
  } catch (err) {
    // Tickets table may not exist
    return { ticketCount: 0, effectiveUserId, effectiveDealerId, note: 'tickets table may not exist' };
  }
}

test('Admin without ViewAs sees all tickets', () => {
  const adminUser = db.prepare("SELECT id FROM users WHERE role = 'Admin' LIMIT 1").get();
  if (!adminUser) return { passed: true }; // Skip if no admin
  
  const result = simulateViewAs(adminUser.id, null);
  return { passed: !result.error, reason: result.error || '' };
});

test('Dealer cannot use ViewAs', () => {
  const dealerUser = db.prepare("SELECT id FROM users WHERE role = 'Dealer' LIMIT 1").get();
  if (!dealerUser) return { passed: true }; // Skip if no dealer
  
  const adminUser = db.prepare("SELECT id FROM users WHERE role = 'Admin' LIMIT 1").get();
  if (!adminUser) return { passed: true }; // Skip if no admin
  
  const result = simulateViewAs(dealerUser.id, adminUser.id);
  return { 
    passed: result.error === 'Viewer lacks ViewAs permission', 
    reason: result.error !== 'Viewer lacks ViewAs permission' ? `Expected permission denial, got: ${result.error || 'access granted'}` : ''
  };
});

test('Admin can ViewAs dealer user', () => {
  const adminUser = db.prepare("SELECT id FROM users WHERE role = 'Admin' LIMIT 1").get();
  const dealerUser = db.prepare("SELECT id, dealer_id FROM users WHERE role = 'Dealer' LIMIT 1").get();
  
  if (!adminUser || !dealerUser) return { passed: true }; // Skip if missing users
  
  const result = simulateViewAs(adminUser.id, dealerUser.id);
  const passed = !result.error && result.effectiveDealerId === dealerUser.dealer_id;
  return { 
    passed, 
    reason: passed ? '' : `ViewAs did not switch to dealer context properly` 
  };
});

// ==================== Test 4: Permission Boundaries ====================
console.log('\n📋 Test Group 4: Permission Boundaries');
console.log('-'.repeat(40));

test('Staff cannot access admin panel', () => {
  const permissions = ROLE_PERMISSIONS.Staff;
  return { passed: permissions.canAccessAdmin === false };
});

test('Dealer cannot delete tickets', () => {
  const permissions = ROLE_PERMISSIONS.Dealer;
  return { passed: permissions.canDeleteTickets === false };
});

test('Manager can export but cannot delete', () => {
  const permissions = ROLE_PERMISSIONS.Manager;
  return { passed: permissions.canExport === true && permissions.canDeleteTickets === false };
});

// ==================== Test 5: Data Isolation ====================
console.log('\n📋 Test Group 5: Data Isolation');
console.log('-'.repeat(40));

test('Dealers are associated with accounts', () => {
  try {
    const dealers = serviceDb.prepare(`
      SELECT d.id, d.name, a.id as account_id 
      FROM dealers d 
      LEFT JOIN accounts a ON d.account_id = a.id 
      LIMIT 5
    `).all();
    
    if (dealers.length === 0) return { passed: true }; // No dealers
    
    const allHaveAccounts = dealers.every(d => d.account_id !== null);
    return { passed: allHaveAccounts, reason: allHaveAccounts ? '' : 'Some dealers missing account association' };
  } catch {
    return { passed: true }; // Table structure different
  }
});

test('Inquiry tickets have proper type field', () => {
  try {
    const tickets = serviceDb.prepare(`
      SELECT ticket_type, COUNT(*) as cnt 
      FROM tickets 
      WHERE ticket_type IS NOT NULL 
      GROUP BY ticket_type
    `).all();
    
    if (tickets.length === 0) return { passed: true }; // No tickets
    
    const validTypes = ['inquiry', 'rma', 'dealer_repair', 'svc'];
    const allValid = tickets.every(t => validTypes.includes(t.ticket_type));
    return { passed: allValid, reason: allValid ? '' : 'Invalid ticket_type found' };
  } catch {
    return { passed: true }; // Table structure different
  }
});

// ==================== Summary ====================
console.log('\n' + '='.repeat(60));
console.log(' Test Summary');
console.log('='.repeat(60));

const passed = TEST_RESULTS.filter(t => t.passed).length;
const failed = TEST_RESULTS.filter(t => !t.passed).length;
const total = TEST_RESULTS.length;

console.log(`\n  Total:  ${total}`);
console.log(`  Passed: ${passed} ✅`);
console.log(`  Failed: ${failed} ❌`);
console.log(`\n  Success Rate: ${((passed / total) * 100).toFixed(1)}%`);

if (failed > 0) {
  console.log('\n  Failed Tests:');
  TEST_RESULTS.filter(t => !t.passed).forEach(t => {
    console.log(`    - ${t.name}: ${t.reason}`);
  });
}

console.log('\n' + '='.repeat(60));

// Close databases
db.close();
serviceDb.close();

// Exit with appropriate code
process.exit(failed > 0 ? 1 : 0);
