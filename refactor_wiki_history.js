const fs = require('fs');

let code = fs.readFileSync('client/src/components/KinefinityWiki.tsx', 'utf-8');

// 1. Rewrite handleSearchHistorySelect and the search history map UI
const historySelectOld = `    const handleSearchHistorySelect = (query: string) => {
        setSearchQuery(query);
        setPendingSearchQuery(query);
        setShowSearchHistory(false);
    };`;

const historySelectNew = `    const handleSearchHistorySelect = (hItem: SearchHistoryItem) => {
        setSearchQuery(hItem.query);
        setActiveSearchQuery(hItem.query);
        setExtractedKeywords(hItem.extractedKeywords);
        setSearchResults(hItem.searchResults);
        setKeywordTickets(hItem.keywordTickets);
        setAiAnswer(hItem.aiAnswer);
        setAiRelatedTickets(hItem.aiRelatedTickets);
        
        setIsSearchMode(true);
        setShowSearchResults(true);
        setSelectedProductLine(null);
        setShowSearchHistory(false);
        setPendingSearchQuery('');
    };`;
code = code.replace(historySelectOld, historySelectNew);


// The Map function in the UI dropdown
// We need to find `searchHistory.map((q, i) => (`
const mapOld = `{searchHistory.map((q, i) => (
                                                    <button
                                                        key={i}
                                                        onClick={() => handleSearchHistorySelect(q)}
                                                        style={{
                                                            width: '100%',
                                                            padding: '10px 12px',
                                                            background: q === activeSearchQuery ? 'rgba(59,130,246,0.1)' : 'transparent',
                                                            border: 'none',
                                                            borderBottom: i < searchHistory.length - 1 ? '1px solid rgba(255,255,255,0.03)' : 'none',
                                                            color: q === activeSearchQuery ? '#3B82F6' : '#ccc',
                                                            fontSize: '13px',
                                                            cursor: 'pointer',
                                                            textAlign: 'left',
                                                            transition: 'background 0.15s',
                                                            display: 'flex',
                                                            alignItems: 'center',
                                                            gap: '8px'
                                                        }}
                                                        onMouseEnter={(e) => {
                                                            e.currentTarget.style.background = 'rgba(255,255,255,0.08)';
                                                        }}
                                                        onMouseLeave={(e) => {
                                                            e.currentTarget.style.background = q === activeSearchQuery ? 'rgba(59,130,246,0.1)' : 'transparent';
                                                        }}
                                                    >
                                                        <Search size={12} style={{ opacity: 0.4, flexShrink: 0 }} />
                                                        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{q}</span>
                                                    </button>
                                                ))}`;

const mapNew = `{searchHistory.map((hItem, i) => (
                                                    <div key={i} style={{ 
                                                        position: 'relative', 
                                                        display: 'flex', 
                                                        alignItems: 'center',
                                                        borderBottom: i < searchHistory.length - 1 ? '1px solid rgba(255,255,255,0.03)' : 'none',
                                                        background: hItem.query === activeSearchQuery ? 'rgba(59,130,246,0.1)' : 'transparent'
                                                    }}
                                                    onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.08)'}
                                                    onMouseLeave={(e) => e.currentTarget.style.background = hItem.query === activeSearchQuery ? 'rgba(59,130,246,0.1)' : 'transparent'}
                                                    >
                                                        <button
                                                            onClick={() => handleSearchHistorySelect(hItem)}
                                                            style={{
                                                                flex: 1,
                                                                padding: '10px 12px',
                                                                background: 'transparent',
                                                                border: 'none',
                                                                color: hItem.query === activeSearchQuery ? '#3B82F6' : '#ccc',
                                                                fontSize: '13px',
                                                                cursor: 'pointer',
                                                                textAlign: 'left',
                                                                display: 'flex',
                                                                alignItems: 'center',
                                                                gap: '8px',
                                                                overflow: 'hidden'
                                                            }}
                                                        >
                                                            <Search size={12} style={{ opacity: 0.4, flexShrink: 0 }} />
                                                            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{hItem.query}</span>
                                                        </button>
                                                        <div 
                                                            onClick={(e) => { e.stopPropagation(); setHistoryDeleteQuery(hItem.query); }}
                                                            style={{
                                                                padding: '0 12px',
                                                                cursor: 'pointer',
                                                                color: '#888',
                                                                display: 'flex',
                                                                alignItems: 'center',
                                                                height: '100%'
                                                            }}
                                                        >
                                                            <X size={14} style={{ transition: 'color 0.2s' }} onMouseEnter={e => e.currentTarget.style.color = '#ff453a'} onMouseLeave={e => e.currentTarget.style.color = '#888'} />
                                                        </div>
                                                    </div>
                                                ))}`;
code = code.replace(mapOld, mapNew);

// Add Confirmation Modal at the end of the return statement
const deleteModal = `
            {/* History Delete Confirmation Modal */}
            <ConfirmationDialog
                isOpen={historyDeleteQuery !== null}
                title={t('wiki.search.delete_history_title', 'Delete Search History')}
                message={t('wiki.search.delete_history_msg', \`Are you sure you want to delete the search history for "\${historyDeleteQuery}"?\`)}
                confirmLabel={t('common.delete', 'Delete')}
                cancelLabel={t('common.cancel', 'Cancel')}
                isDestructive={true}
                onConfirm={() => {
                    if (historyDeleteQuery) {
                        setSearchHistory(prev => {
                            const updated = prev.filter(h => h.query !== historyDeleteQuery);
                            const userId = user?.id || 'guest';
                            localStorage.setItem(\`wiki-search-history-\${userId}\`, JSON.stringify(updated));
                            return updated;
                        });
                        if (activeSearchQuery === historyDeleteQuery) {
                            handleCloseSearchTab();
                        }
                    }
                    setHistoryDeleteQuery(null);
                }}
                onCancel={() => setHistoryDeleteQuery(null)}
            />
`;
code = code.replace(`        </div>\n    );\n});`, `${deleteModal}        </div>\n    );\n});`);


// 2. Rewrite performKeywordSearch to return its objects
const keywordOld = `    // 关键词搜索 - 文章优先渲染，工单异步加载
    const performKeywordSearch = async (query: string) => {`;
code = code.replace(keywordOld, `    const performKeywordSearch = async (query: string): Promise<any> => {`);

// In performKeywordSearch, replace final setKeywordTickets logic
const keywordEndOld = `        } catch (err) {
            // 工单搜索失败不影响关键词搜索结果
            setKeywordTickets([]);
        } finally {
            setIsTicketSearching(false);
        }
    };`;
const keywordEndNew = `        } catch (err) {
            // 工单搜索失败不影响关键词搜索结果
            setKeywordTickets([]);
            return { searchResults: articleResults, keywordTickets: [] };
        } finally {
            setIsTicketSearching(false);
        }
    };`;
// wait, the success path doesn't return anything. Let's fix it properly using string replace.
// Let's replace the whole performKeywordSearch body with regex or substring.
let ksStart = code.indexOf(`const performKeywordSearch = async (query: string)`);
if (ksStart === -1) ksStart = code.indexOf(`const performKeywordSearch = async (query: string): Promise<any> => {`);
const ksEnd = code.indexOf(`};`, code.indexOf(`setIsTicketSearching(false);`, ksStart)) + 2;


// Actually, we can just replace specifically inside performKeywordSearch
code = code.replace(`setKeywordTickets(ticketRes.data.results || []);\n        } catch (err)`, `setKeywordTickets(ticketRes.data.results || []);\n            return { searchResults: articleResults, keywordTickets: ticketRes.data.results || [] };\n        } catch (err)`);

// 3. Rewrite performAiSearch to return objects
code = code.replace(`const performAiSearch = async (query: string) => {`, `const performAiSearch = async (query: string): Promise<any> => {`);
// In performAiSearch, the end looks like:
const aiEndOldStr = `            }

            setAiAnswer(fullAnswer);

        } catch (err: any) {`;

const aiEndNewStr = `            }

            setAiAnswer(fullAnswer);
            return { aiAnswer: fullAnswer, aiRelatedTickets: contextTickets };

        } catch (err: any) {`;
code = code.replace(aiEndOldStr, aiEndNewStr);
// The catch block:
code = code.replace(`setIsAiSearching(false);\n        }\n    };`, `setIsAiSearching(false);\n        }\n        return { aiAnswer: null, aiRelatedTickets: [] };\n    };`);


// 4. Update the doSearch function to hook into Promise.all

const doSearchOldStr = `                // 同时执行关键词搜索和AI搜索
                await Promise.all([
                    performKeywordSearch(query),
                    performAiSearch(query)
                ]);
            } catch (err) {`;

const doSearchNewStr = `                // 同时执行关键词搜索和AI搜索
                const [kRes, aRes] = await Promise.all([
                    performKeywordSearch(query),
                    performAiSearch(query)
                ]);

                // Save Search History Snapshot
                setSearchHistory(prev => {
                    const deduped = prev.filter(item => item.query !== query);
                    const newItem: SearchHistoryItem = {
                        query,
                        timestamp: Date.now(),
                        extractedKeywords: keywords,
                        searchResults: kRes?.searchResults || [],
                        keywordTickets: kRes?.keywordTickets || [],
                        aiAnswer: aRes?.aiAnswer || '',
                        aiRelatedTickets: aRes?.aiRelatedTickets || []
                    };
                    const updated = [newItem, ...deduped].slice(0, 10);
                    const userId = useAuthStore.getState().user?.id || 'guest';
                    localStorage.setItem(\`wiki-search-history-\${userId}\`, JSON.stringify(updated));
                    return updated;
                });

            } catch (err) {`;
code = code.replace(doSearchOldStr, doSearchNewStr);


fs.writeFileSync('client/src/components/KinefinityWiki.tsx', code);
console.log('Script 2 prep ok.');
