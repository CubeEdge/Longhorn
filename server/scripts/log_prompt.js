const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const LOG_FILE = path.resolve(__dirname, '../docs/prompt_log.md');
const PROMPT = process.argv[2];

if (!PROMPT) {
    console.log("Usage: node log_prompt.js \"Your prompt here\"");
    process.exit(1);
}

// 1. Get Git Hash
let currentHash = 'unknown';
try {
    currentHash = execSync('git rev-parse --short HEAD', { cwd: path.resolve(__dirname, '..'), stdio: 'pipe' }).toString().trim();
} catch (e) {
    console.log("⚠️ Not a git repository or git error.");
}

// 2. Prepare Data
const now = new Date();
const dateHeader = `## ${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

// 3. Read content
let content = '';
if (fs.existsSync(LOG_FILE)) {
    content = fs.readFileSync(LOG_FILE, 'utf8');
}

const lines = content.split('\n');

// 4. Find Last Hash
// We look for pattern: `**Version**: [hash]` or similar.
let lastHash = null;
for (let i = 0; i < 200 && i < lines.length; i++) { // Search top 200 lines
    const match = lines[i].match(/\*\*Version\*\*: `([a-zA-Z0-9]+)`/);
    if (match) {
        lastHash = match[1];
        break; // Found recent hash
    }
}

// 5. Build New Entry
let newEntry = '';
let insertIndex = -1;

// Find insertion point (After the date header if exists)
const dateHeaderIndex = lines.findIndex(l => l.trim() === dateHeader);

if (dateHeaderIndex !== -1) {
    // Date header exists, insert after it
    insertIndex = dateHeaderIndex + 2; // Skip header and blank line
} else {
    // New Date, find where to insert (usually after top meta or first separator)
    // Assuming format: # Header ... --- ... ## Date
    const separatorIndex = lines.findIndex(l => l.trim() === '---');
    if (separatorIndex !== -1) {
        insertIndex = separatorIndex + 2;
    } else {
        insertIndex = lines.length; // Append if no structure
    }
    newEntry += `\n${dateHeader}\n\n`;
}

newEntry += `### ${timeStr} - ${PROMPT.length > 30 ? PROMPT.substring(0, 30) + '...' : PROMPT}\n`;
newEntry += `\`\`\`\n${PROMPT}\n\`\`\`\n`;

if (currentHash !== lastHash) {
    newEntry += `**Version**: \`${currentHash}\` (Code Changed)\n`;
} else {
    newEntry += `**Version**: \`${currentHash}\` (No Change)\n`;
}
newEntry += `\n`;

// 6. Insert
if (dateHeaderIndex !== -1) {
    // Insert into existing date block
    // We want to insert AT THE TOP of the date block (reverse chronological usually?)
    // Existing log seems to be reverse chronological (newest date top).
    // Let's check existing file structure in view_file.
    // Line 7: ## 2026-01-22
    // Line 9: ### 08:30 ...
    // So yes, it inserts below the date header.
    // But if there are already entries, we want to be at top of that date?
    // "Line 9" implies it's the first one. 
    // If I add now (09:00), it should be before 08:30? 
    // usually logs are chronological per day or reverse?
    // Looking at file: 
    // 08:30 is top. The user just added it?
    // Let's assume reverse chronological (newest top).

    // We insert right after Date Header + 1 empty line.
    lines.splice(dateHeaderIndex + 2, 0, newEntry.trim() + '\n');
} else {
    // Insert new Date Block at top (after separator)
    const separatorIndex = lines.findIndex(l => l.trim() === '---');
    if (separatorIndex !== -1) {
        lines.splice(separatorIndex + 1, 0, '\n' + newEntry.trim());
    } else {
        // Fallback
        lines.push(newEntry);
    }
}

// 7. Write Back
fs.writeFileSync(LOG_FILE, lines.join('\n'));
console.log(`✅ Logged to ${path.basename(LOG_FILE)}`);
