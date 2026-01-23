const NAME_TO_CODE = {
    '运营部': 'OP',
    '市场部': 'MS',
    '研发中心': 'RD',
    '研发部': 'RD',
    '综合管理': 'GE',
    '通用台面': 'RE'
};

const VALID_DEPT_CODES = ['OP', 'MS', 'RD', 'RE', 'MEMBERS'];

function resolvePath(requestPath) {
    if (!requestPath) return '';
    const normalizedPath = requestPath.normalize('NFC');
    const segments = normalizedPath.split('/').filter(Boolean);
    if (segments.length > 0) {
        let firstSegment = segments[0];
        if (NAME_TO_CODE[firstSegment]) {
            firstSegment = NAME_TO_CODE[firstSegment];
        }
        const firstSegmentUpper = firstSegment.toUpperCase();
        if (VALID_DEPT_CODES.includes(firstSegmentUpper)) {
            segments[0] = firstSegmentUpper;
        }
    }
    return segments.join('/');
}

const hasPermission = (user, folderPath, accessType = 'Read') => {
    if (user.role === 'Admin') return true;

    const normalizedPath = folderPath.replace(/\\/g, '/').replace(/^\/+|\/+$/g, '');
    let deptName = user.department_name;

    // THE FIX LOGIC
    const codeMatch = deptName ? deptName.match(/\(([A-Za-z]+)\)$/) : null;
    if (codeMatch) {
        deptName = codeMatch[1];
    } else if (deptName && NAME_TO_CODE[deptName]) {
        deptName = NAME_TO_CODE[deptName];
    }

    const deptNameLower = deptName ? deptName.toLowerCase() : '';
    const normalizedLower = normalizedPath.toLowerCase();

    // Debug output
    console.log(`[Check] Path: "${normalizedPath}" (Lower: "${normalizedLower}")`);
    console.log(`[Check] UserDept: "${user.department_name}" -> "${deptName}" (Lower: "${deptNameLower}")`);

    if (deptName) {
        if (user.role === 'Lead' && (normalizedLower === deptNameLower || normalizedLower.startsWith(deptNameLower + '/'))) return true;
        if (user.role === 'Member' && (normalizedLower === deptNameLower || normalizedLower.startsWith(deptNameLower + '/'))) {
            // ... simplified legacy check logic ...
            return true;
        }
    }
    return false;
};

// MOCK DATA
const mockUser = {
    username: 'Orange',
    role: 'Lead', // Derived from screenshot "Department Lead"
    department_name: '运营部 (OP)' // Derived from DB query
};

console.log('--- TEST 1: WEB REQUEST Check (Path=OP) ---');
const webPath = resolvePath('OP');
console.log(`Resolved Path: ${webPath}`);
console.log(`hasPermission: ${hasPermission(mockUser, webPath)}`);

console.log('\n--- TEST 2: iOS REQUEST Check (Path=运营部) ---');
const iosPath = resolvePath('运营部');
console.log(`Resolved Path: ${iosPath}`);
console.log(`hasPermission: ${hasPermission(mockUser, iosPath)}`);

console.log('\n--- TEST 3: iOS REQUEST Check (Path=运营部/SomeFile) ---');
const iosPathFile = resolvePath('运营部/SomeFile');
console.log(`Resolved Path: ${iosPathFile}`);
console.log(`hasPermission: ${hasPermission(mockUser, iosPathFile)}`);
