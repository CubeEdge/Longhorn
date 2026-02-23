const fs = require('fs');

let code = fs.readFileSync('client/src/components/KinefinityWiki.tsx', 'utf-8');

// 1. Add useConfirm import
code = code.replace(`import { useAuthStore } from '../store/useAuthStore';`, `import { useAuthStore } from '../store/useAuthStore';\nimport { useConfirm } from '../store/useConfirm';`);

// 2. Add useConfirm hook call
code = code.replace(`    const { user } = useAuthStore();`, `    const { user } = useAuthStore();\n    const { confirm } = useConfirm();`);

// 3. Remove ConfirmationDialog related code
// State:
code = code.replace(`    const [historyDeleteQuery, setHistoryDeleteQuery] = useState<string | null>(null);\n\n`, '');

// Delete Modal:
const deleteModalStart = `{/* History Delete Confirmation Modal */}`;
const deleteModalEnd = `onCancel={() => setHistoryDeleteQuery(null)}\n            />`;

if (code.includes(deleteModalStart)) {
    const startIdx = code.indexOf(deleteModalStart);
    const endIdx = code.indexOf(deleteModalEnd, startIdx) + deleteModalEnd.length;
    code = code.substring(0, startIdx) + code.substring(endIdx);
}

// 4. Update the X button click
const xDivOld = `<div 
                                                            onClick={(e) => { e.stopPropagation(); setHistoryDeleteQuery(hItem.query); }}`;
const xDivNew = `<div 
                                                            onClick={(e) => { e.stopPropagation(); handleDeleteHistoryItem(hItem.query); }}`;
code = code.replace(xDivOld, xDivNew);

// 5. Add handleDeleteHistoryItem
const handleCloseOld = `    const handleCloseSearchTab = () => {`;
const handleDeleteCode = `    const handleDeleteHistoryItem = async (queryToDelete: string) => {
        const confirmed = await confirm(
            \`\${t('wiki.search.delete_history_msg', '确定要删除搜索及关联对话吗')}「\${queryToDelete}」？\`,
            t('wiki.search.delete_history_title', '删除历史搜索纪录')
        );
        if (confirmed) {
            setSearchHistory(prev => {
                const updated = prev.filter(h => h.query !== queryToDelete);
                const userId = user?.id || 'guest';
                localStorage.setItem(\`wiki-search-history-\${userId}\`, JSON.stringify(updated));
                return updated;
            });
            if (activeSearchQuery === queryToDelete) {
                handleCloseSearchTab();
            }
        }
    };\n\n`;
code = code.replace(handleCloseOld, handleDeleteCode + handleCloseOld);

// 6. Fix `t` typings inside `doSearch` where I introduced it? 
// No, the typing errors were inside `<ConfirmationDialog>` which is now removed! 
// Wait, `t` shouldn't have typing errors if used correctly. 
// Let's check if the translation has an issue.
// "Argument of type 'string' is not assignable to parameter of type '{ [key: string]: string | number; }'."
// This implies `t` expects (key: string, options?: {...}). We gave it a string as second arg.
// So `t('key', 'default')` is invalid for this i18n implementation!
// In our handleDeleteCode, let's omit the second arg for `t`.

const handleDeleteCodeFixed = `    const handleDeleteHistoryItem = async (queryToDelete: string) => {
        let msg = t('wiki.search.delete_history_msg');
        if (!msg || msg === 'wiki.search.delete_history_msg') msg = '确定要删除搜索及关联对话吗';
        
        let title = t('wiki.search.delete_history_title');
        if (!title || title === 'wiki.search.delete_history_title') title = '删除历史搜索纪录';

        const confirmed = await confirm(
            \`\${msg}「\${queryToDelete}」？\`,
            title
        );
        if (confirmed) {
            setSearchHistory(prev => {
                const updated = prev.filter(h => h.query !== queryToDelete);
                const userId = user?.id || 'guest';
                localStorage.setItem(\`wiki-search-history-\${userId}\`, JSON.stringify(updated));
                return updated;
            });
            if (activeSearchQuery === queryToDelete) {
                handleCloseSearchTab();
            }
        }
    };\n\n`;
code = code.replace(handleDeleteCode, handleDeleteCodeFixed);

fs.writeFileSync('client/src/components/KinefinityWiki.tsx', code);
console.log('Cleaned up history modal and fixed typings.');
