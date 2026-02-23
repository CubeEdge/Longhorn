const fs = require('fs');

let code = fs.readFileSync('client/src/components/KinefinityWiki.tsx', 'utf-8');

// 1. Move Search and Admin Menu
const searchAdminBegin = "                                {/* 弹性空间 */}\n                                <div style={{ flex: 1 }} />\n\n                                {/* 搜索输入框 */}\n";
const searchAdminEndMarker = "                                        )}\n                                    </div>\n                                )}";
const searchAdminEndIndex = code.indexOf(searchAdminEndMarker, code.indexOf(searchAdminBegin)) + searchAdminEndMarker.length;
const searchAdminCode = code.substring(code.indexOf(searchAdminBegin), searchAdminEndIndex);

// remove it from the tab row
code = code.replace(searchAdminCode, "");

const headerOld = `{/* 顶部布局：标题 */}
                            <div style={{
                                marginBottom: '24px'
                            }}>
                                <h1 style={{
                                    fontSize: '1.8rem',
                                    fontWeight: 800,
                                    margin: '0 0 8px 0',
                                    color: '#fff',
                                    letterSpacing: '-0.5px'
                                }}>
                                    Kinefinity WIKI
                                </h1>
                                <p style={{
                                    fontSize: '14px',
                                    color: '#666',
                                    margin: 0
                                }}>
                                    {t('wiki.subtitle')}
                                </p>
                            </div>`;

const searchAdminCodeClean = searchAdminCode
    .replace("                                {/* 弹性空间 */}\n                                <div style={{ flex: 1 }} />\n\n", "");

const headerNew = `{/* 顶部布局：标题 + 搜索框 + 管理按钮 */}
                            <div style={{
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'flex-start',
                                marginBottom: '24px'
                            }}>
                                <div>
                                    <h1 style={{
                                        fontSize: '1.8rem',
                                        fontWeight: 800,
                                        margin: '0 0 8px 0',
                                        color: '#fff',
                                        letterSpacing: '-0.5px'
                                    }}>
                                        Kinefinity WIKI
                                    </h1>
                                    <p style={{
                                        fontSize: '14px',
                                        color: '#666',
                                        margin: 0
                                    }}>
                                        {t('wiki.subtitle')}
                                    </p>
                                </div>
                                <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-start' }}>
${searchAdminCodeClean}
                                </div>
                            </div>`;

code = code.replace(headerOld, headerNew);

// 2. Fix Product Tab clicking logic
const oldProductTabClick = `                                            onClick={() => {
                                                // 切回产品线 Tab，如果当前在搜索模式则保留搜索数据但切换视图
                                                setSelectedProductLine(item.line);
                                                if (isSearchMode) {
                                                    setShowSearchResults(false);
                                                }`;

const newProductTabClick = `                                            onClick={() => {
                                                // 切回产品线 Tab，如果当前在搜索模式则保留搜索数据但切换视图
                                                setSelectedProductLine(item.line);
                                                if (isSearchMode) {
                                                    setIsSearchMode(false);
                                                    setShowSearchResults(false);
                                                }`;
code = code.replace(oldProductTabClick, newProductTabClick);


// 3. Search History Storage logic
// Add Interface before interface CategoryNode
code = code.replace("interface CategoryNode {", `export interface SearchHistoryItem {
    query: string;
    timestamp: number;
    extractedKeywords: string;
    searchResults: any[];
    keywordTickets: any[];
    aiAnswer: string;
    aiRelatedTickets: any[];
}

interface CategoryNode {`);

const authStoreStr = `const { user } = useAuthStore();`;
if (!code.includes(authStoreStr)) {
    throw new Error("Cannot find useAuthStore");
}

const historyStateOld = `const [searchHistory, setSearchHistory] = useState<string[]>(() => {
        const saved = localStorage.getItem('wiki-search-history');
        return saved ? JSON.parse(saved) : [];
    });`;

const historyStateNew = `const [searchHistory, setSearchHistory] = useState<SearchHistoryItem[]>([]);
    const [historyDeleteQuery, setHistoryDeleteQuery] = useState<string | null>(null);

    // Dynamic History loading
    useEffect(() => {
        try {
            const userId = user?.id || 'guest';
            const saved = localStorage.getItem(\`wiki-search-history-\${userId}\`);
            if (saved) {
                setSearchHistory(JSON.parse(saved));
            }
        } catch (e) { console.error('Failed to load history', e); }
    }, [user?.id]);`;
code = code.replace(historyStateOld, historyStateNew);

// We need to move `const { user } = useAuthStore();` to above useEffect.
// Actually `const { user } = useAuthStore();` is currently down at line 1372.
// Let's remove it from there and put it near the top of the component.
const compStart = `export const KinefinityWiki = forwardRef<KinefinityWikiRef, any>((props, ref) => {`;
const userOldStrLevel = `    const { user } = useAuthStore();
    const hasWikiAdminAccess = user?.role === 'Admin' || user?.role === 'Lead';`;
code = code.replace(userOldStrLevel, `    const hasWikiAdminAccess = user?.role === 'Admin' || user?.role === 'Lead';`);

code = code.replace(compStart, `${compStart}\n    const { user } = useAuthStore();`);

// Now modify doSearch to save the state as SearchHistoryItem
// Look at doSearch success area. Wait, the state updates are asynchronous and scattered.
// Where is doSearch saving history? "保存搜索历史（去重，最新在前，最多10条）"
const historySaveOld = `            // 保存搜索历史（去重，最新在前，最多10条）
            setSearchHistory(prev => {
                const deduped = prev.filter(q => q !== query);
                const updated = [query, ...deduped].slice(0, 10);
                localStorage.setItem('wiki-search-history', JSON.stringify(updated));
                return updated;
            });`;

code = code.replace(historySaveOld, `// History save will happen after results are populated, see below`);

// Wait, the API results are fetched in `performKeywordSearch` and `performAiSearch` then set to state.
// We should intercept search flow so we don't refetch if history item clicked.
// Or, when we click history, we just restore the state!

fs.writeFileSync('client/src/components/KinefinityWiki.tsx', code);
console.log('Script prep ok. Wrote to client/src/components/KinefinityWiki.tsx');
