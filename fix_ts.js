const fs = require('fs');

let code = fs.readFileSync('client/src/components/KinefinityWiki.tsx', 'utf-8');

// The replacement for user missed placing it correctly or it placed it outside the component?
// Let's just fix it by manually putting it at the start of KinefinityWiki renderer
code = code.replace(`    const [hasWikiAdminAccess`, `    const { user } = useAuthStore();\n    const [hasWikiAdminAccess`); // wait, hasWikiAdminAccess is not state

// Actually let's just use string replacement on exact current code.
