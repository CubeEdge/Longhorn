import React, { useState, useEffect } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import axios from 'axios';
import { useAuthStore } from '../store/useAuthStore';
import { useConfirm } from '../store/useConfirm';
import { useBokehContext } from '../store/useBokehContext';
import { useLanguage } from '../i18n/useLanguage';
import { ChevronRight, ChevronDown, ChevronLeft, ChevronUp, Search, BookOpen, List, X, ThumbsUp, ThumbsDown, Sparkles, Eye, EyeOff, Layers, Edit3, FileText, Check, Trash2, Settings, Upload, Loader2, Ticket, MessageCircleQuestion, RefreshCw, Wrench } from 'lucide-react';
import { SynonymManager } from './Knowledge/SynonymManager';
import KnowledgeGenerator from './KnowledgeGenerator';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';
import WikiEditorModal from './Knowledge/WikiEditorModal';
// Legacy components missing after version upgrade, inline replacements
const ArticleCard: React.FC<any> = ({ title, summary, productLine, category, onClick }) => {
    const { t } = useLanguage();
    const categoryLabels: Record<string, string> = {
        'Manual': t('wiki.category.manual'),
        'Troubleshooting': t('wiki.category.troubleshooting'),
        'FAQ': t('wiki.category.faq')
    };
    const displayCategory = categoryLabels[category] || category;

    return (
        <div onClick={onClick} style={{ padding: '12px', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '8px', cursor: 'pointer', transition: 'all 0.2s', ':hover': { background: 'rgba(255,255,255,0.05)' } } as any}>
            <div style={{ fontSize: '14px', fontWeight: 500, color: '#e0e0e0', marginBottom: '6px', lineHeight: 1.4 }}>{title}</div>
            {summary && <div style={{ fontSize: '12px', color: '#888', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{summary}</div>}
            <div style={{ marginTop: '10px', display: 'flex', gap: '8px', fontSize: '11px', color: '#666' }}>
                {displayCategory && <span>{displayCategory}</span>}
                {productLine && <span>· {productLine}</span>}
            </div>
        </div>
    );
};

const getTicketStyles = (type: string | undefined, t: any, isDark = true) => {
    switch (type) {
        case 'inquiry':
        case 'Inquiry':
            return {
                bg: isDark ? 'rgba(59, 130, 246, 0.1)' : 'rgba(59, 130, 246, 0.15)',
                border: isDark ? 'rgba(59, 130, 246, 0.3)' : 'rgba(59, 130, 246, 0.4)',
                hoverBg: isDark ? 'rgba(59, 130, 246, 0.2)' : 'rgba(59, 130, 246, 0.25)',
                hoverBorder: isDark ? 'rgba(59, 130, 246, 0.5)' : 'rgba(59, 130, 246, 0.6)',
                color: '#60A5FA', // Blue
                icon: <MessageCircleQuestion size={14} />,
                label: t('wiki.ticket.inquiry')
            };
        case 'rma':
        case 'RMA':
            return {
                bg: isDark ? 'rgba(249, 115, 22, 0.1)' : 'rgba(249, 115, 22, 0.15)',
                border: isDark ? 'rgba(249, 115, 22, 0.3)' : 'rgba(249, 115, 22, 0.4)',
                hoverBg: isDark ? 'rgba(249, 115, 22, 0.2)' : 'rgba(249, 115, 22, 0.25)',
                hoverBorder: isDark ? 'rgba(249, 115, 22, 0.5)' : 'rgba(249, 115, 22, 0.6)',
                color: '#FB923C', // Orange
                icon: <RefreshCw size={14} />,
                label: t('wiki.ticket.rma')
            };
        case 'dealer_repair':
        case 'Dealer Repair':
            return {
                bg: isDark ? 'rgba(168, 85, 247, 0.1)' : 'rgba(168, 85, 247, 0.15)',
                border: isDark ? 'rgba(168, 85, 247, 0.3)' : 'rgba(168, 85, 247, 0.4)',
                hoverBg: isDark ? 'rgba(168, 85, 247, 0.2)' : 'rgba(168, 85, 247, 0.25)',
                hoverBorder: isDark ? 'rgba(168, 85, 247, 0.5)' : 'rgba(168, 85, 247, 0.6)',
                color: '#C084FC', // Purple
                icon: <Wrench size={14} />,
                label: t('wiki.ticket.dealer_repair')
            };
        default:
            return {
                bg: isDark ? 'rgba(76, 175, 80, 0.1)' : 'rgba(76, 175, 80, 0.15)',
                border: isDark ? 'rgba(76, 175, 80, 0.3)' : 'rgba(76, 175, 80, 0.4)',
                hoverBg: isDark ? 'rgba(76, 175, 80, 0.2)' : 'rgba(76, 175, 80, 0.25)',
                hoverBorder: isDark ? 'rgba(76, 175, 80, 0.5)' : 'rgba(76, 175, 80, 0.6)',
                color: '#4CAF50', // Green
                icon: <Ticket size={14} />,
                label: type === 'maintenance' ? t('wiki.ticket.maintenance') : (type || t('common.all'))
            };
    }
};

const TicketCard: React.FC<any> = ({ ticketNumber, ticketType, title, status, productModel, customerName, contactName, onClick }) => {
    const { t } = useLanguage();
    const styles = getTicketStyles(ticketType, t);
    return (
        <div onClick={onClick} style={{
            padding: '12px',
            background: 'rgba(255,255,255,0.02)',
            border: `1px solid ${styles.border}`,
            borderRadius: '8px',
            cursor: 'pointer',
            transition: 'all 0.2s',
            borderLeft: `3px solid ${styles.color}`
        }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <span style={{ fontSize: '12px', color: '#888', fontFamily: 'monospace', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{ color: styles.color, display: 'flex' }}>{styles.icon}</span>
                    {ticketNumber || `TICKET-${Math.floor(Math.random() * 1000)}`}
                </span>
                <span style={{ fontSize: '11px', padding: '2px 6px', borderRadius: '4px', background: styles.bg, color: styles.color }}>{status || styles.label}</span>
            </div>
            <div style={{ fontSize: '14px', fontWeight: 500, color: '#e0e0e0', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{title}</div>
            <div style={{ marginTop: '10px', display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                {productModel && <span style={{ fontSize: '11px', color: '#666' }}>{productModel}</span>}
                {(customerName || contactName) && (
                    <span style={{ fontSize: '11px', color: '#888' }}>
                        {productModel && '·'} {contactName && contactName !== customerName
                            ? `${customerName} · ${contactName}`
                            : customerName || contactName}
                    </span>
                )}
            </div>
        </div>
    );
};

interface KnowledgeArticle {
    id: number;
    title: string;
    slug: string;
    summary: string;
    content: string;
    formatted_content?: string;
    format_status?: 'none' | 'draft' | 'published';
    formatted_by?: 'ai' | 'human' | 'external';
    formatted_at?: string;
    chapter_number?: number;
    section_number?: number;
    category: string;
    product_line: string;
    product_models: string[];
    tags: string[];
    visibility: 'Public' | 'Dealer' | 'Internal' | 'Department';
    source_type?: string;
    source_reference?: string;
    source_url?: string;
    created_at: string;
    helpful_count: number;
    not_helpful_count: number;
    permissions?: {
        can_edit: boolean;
    };
}

export interface SearchHistoryItem {
    query: string;
    timestamp: number;
    extractedKeywords: string;
    searchResults: any[];
    keywordTickets: any[];
    aiAnswer: string;
    aiRelatedTickets: any[];
}

interface CategoryNode {
    id: string;
    label: string;
    icon?: string;
    children?: CategoryNode[];
    articles?: KnowledgeArticle[];
    product_line?: string;
    product_model?: string;
    category?: string;
}

interface BreadcrumbItem {
    label: string;
    nodeId?: string;
    articleSlug?: string;
    type?: 'home' | 'product_line' | 'product_model' | 'category' | 'article';
    productLine?: string;
    productModel?: string;
    category?: string;
    viewMode?: 'list' | 'grouped';
}

interface RecentArticle {
    slug: string;
    title: string;
    timestamp: number;
}

interface ChapterAggregate {
    chapter_number: number;
    main_chapter: {
        id: number;
        title: string;
        slug: string;
        summary: string;
        content_preview?: string;
    } | null;
    sub_sections: Array<{
        id: number;
        title: string;
        slug: string;
        section_number: number;
        summary: string;
        view_count: number;
        helpful_count: number;
    }>;
    total_articles: number;
}

export const parseChapterNumber = (title: string): { chapter: number | null, section: string | null, cleanTitle: string } => {
    // Match optional prefix (non-greedy) ending in colon+space, followed by Chapter formatting like "3.1", "3.1.1", "3"
    const match = title.match(/^(?:.*?:[ \t]*)?(\d+)((?:\.\d+)*)[.\s]+(.+)/);
    if (match) {
        const chapter = parseInt(match[1]);
        const section = match[2] ? match[1] + match[2] : null; // Keep the full section string e.g., "3.1.1"
        const cleanTitle = match[3].trim();
        return { chapter, section, cleanTitle };
    }
    return { chapter: null, section: null, cleanTitle: title };
};

export const KinefinityWiki: React.FC = () => {
    const { user } = useAuthStore();
    const { confirm } = useConfirm();
    const navigate = useNavigate();
    const location = useLocation();
    const { slug } = useParams<{ slug: string }>();
    const { token } = useAuthStore();
    const { setWikiViewContext, clearContext } = useBokehContext();
    const { t } = useLanguage();

    const [articles, setArticles] = useState<KnowledgeArticle[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [expandedNodes, setExpandedNodes] = useState<Set<string>>(() => {
        const saved = localStorage.getItem('wiki-expanded-nodes');
        return saved ? new Set(JSON.parse(saved)) : new Set(['a-camera']);
    });
    const [selectedArticle, setSelectedArticle] = useState<KnowledgeArticle | null>(null);
    const [tocVisible, setTocVisible] = useState(false);
    const [breadcrumbPath, setBreadcrumbPath] = useState<BreadcrumbItem[]>([]);
    const [navigationHistory, setNavigationHistory] = useState<string[]>([]);
    const [recentArticles, setRecentArticles] = useState<RecentArticle[]>(() => {
        const saved = localStorage.getItem('wiki-recent-articles');
        return saved ? JSON.parse(saved) : [];
    });
    const tocPanelRef = React.useRef<HTMLDivElement>(null);
    const selectedArticleRef = React.useRef<KnowledgeArticle | null>(null);

    // 分组折叠视图状态 - 从 localStorage 恢复（按产品线分开存储）
    const [groupedExpandedModels, setGroupedExpandedModels] = useState<Set<string>>(() => {
        const params = new URLSearchParams(location.search);
        const productLine = params.get('line') || 'A';
        const saved = localStorage.getItem(`wiki-grouped-expanded-models-${productLine}`);
        return saved ? new Set(JSON.parse(saved)) : new Set();
    });
    const [groupedExpandedCategories, setGroupedExpandedCategories] = useState<Set<string>>(() => {
        const params = new URLSearchParams(location.search);
        const productLine = params.get('line') || 'A';
        const saved = localStorage.getItem(`wiki-grouped-expanded-categories-${productLine}`);
        return saved ? new Set(JSON.parse(saved)) : new Set();
    });
    const [groupedExpandedChapters, setGroupedExpandedChapters] = useState<Set<string>>(new Set());
    const [expandedModalChapters, setExpandedModalChapters] = useState<Set<string>>(new Set());
    const [showSearchResults, setShowSearchResults] = useState(false);
    const [isSearchMode, setIsSearchMode] = useState(false); // 区分搜索模式和分组视图模式

    // 简化调试信息输出
    useEffect(() => {
        // 只在状态异常时输出警告
        if (showSearchResults && !isSearchMode && searchQuery.trim()) {
            console.warn('[WIKI] Inconsistent state: showSearchResults=true but isSearchMode=false');
        }
    }, [showSearchResults, isSearchMode, searchQuery]);
    const [searchResults, setSearchResults] = useState<KnowledgeArticle[]>([]);
    const [, setIsSearching] = useState(false);

    // 搜索栏状态 - 当前始终展开
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const [_isSearchExpanded, _setIsSearchExpanded] = useState(true);

    // 当前选中的产品族类 - 默认选中A类
    const [selectedProductLine, setSelectedProductLine] = useState<string | null>('A');

    // Bokeh formatting & chapter view states
    const [viewMode, setViewMode] = useState<'published' | 'draft'>('published');
    const [isFormatting, setIsFormatting] = useState(false);
    const [chapterView, setChapterView] = useState<ChapterAggregate | null>(null);
    const [showChapterView, setShowChapterView] = useState(false);
    const [fullChapterContent, setFullChapterContent] = useState<string | null>(null);
    const [showFullChapter, setShowFullChapter] = useState(false);
    const [loadingFullChapter, setLoadingFullChapter] = useState(false);
    const [showEditorModal, setShowEditorModal] = useState(false);

    // 管理菜单状态
    const [showAdminMenu, setShowAdminMenu] = useState(false);
    const [showArticleManager, setShowArticleManager] = useState(false);
    const [showKnowledgeImport, setShowKnowledgeImport] = useState(false); // 新增：知识导入弹窗状态
    const [showSynonymManager, setShowSynonymManager] = useState(false);
    const [manageArticles, setManageArticles] = useState<KnowledgeArticle[]>([]);
    const [selectedArticleIds, setSelectedArticleIds] = useState<Set<number>>(new Set());
    const [isDeleting, setIsDeleting] = useState(false);
    const [managerSearchQuery, setManagerSearchQuery] = useState('');
    const [managerSort, setManagerSort] = useState<{ field: 'title' | 'product_line' | 'product_model' | 'category'; order: 'asc' | 'desc' } | null>(null);

    // 搜索结果显示控制
    const [showKeywordPanel, setShowKeywordPanel] = useState(true);
    const [showAiPanel, setShowAiPanel] = useState(true);
    const [extractedKeywords, setExtractedKeywords] = useState('');
    const [isNavigationRestored, setIsNavigationRestored] = useState(false);


    // 搜索结果默认显示数量
    const DEFAULT_SHOW_COUNT = 3;
    const AI_REF_SHOW_COUNT = 3; // AI 参考文章默认显示数量

    // 工单搜索结果
    const [keywordTickets, setKeywordTickets] = useState<any[]>([]);
    const [aiRelatedTickets, setAiRelatedTickets] = useState<any[]>([]);
    const [showMoreArticles, setShowMoreArticles] = useState(false);
    const [showMoreTickets, setShowMoreTickets] = useState(false);
    const [showMoreAiArticles, setShowMoreAiArticles] = useState(false);
    const [showMoreRecent, setShowMoreRecent] = useState(false);

    // 最近浏览展开/折叠状态
    const [recentExpanded, setRecentExpanded] = useState(true);
    const [showRecentMenu, setShowRecentMenu] = useState(false);
    const recentMenuRef = React.useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (recentMenuRef.current && !recentMenuRef.current.contains(event.target as Node)) {
                setShowRecentMenu(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const RECENT_SHOW_COUNT = 3;

    const [showManualTocModal, setShowManualTocModal] = useState(false);

    // AI搜索状态
    const [aiAnswer, setAiAnswer] = useState<string>('');
    const [isAiSearching, setIsAiSearching] = useState(false);
    const [isTicketSearching, setIsTicketSearching] = useState(false);
    const [relatedArticles, setRelatedArticles] = useState<KnowledgeArticle[]>([]);
    const [pendingSearchQuery, setPendingSearchQuery] = useState(''); // 待搜索的查询内容

    // 搜索 Tab 状态
    const [activeSearchQuery, setActiveSearchQuery] = useState<string | null>(null); // 当前搜索 Tab 的查询内容
    const [searchHistory, setSearchHistory] = useState<SearchHistoryItem[]>([]);
    // Dynamic History loading
    useEffect(() => {
        try {
            const userId = user?.id || 'guest';
            const saved = localStorage.getItem(`wiki-search-history-${userId}`);
            if (saved) {
                setSearchHistory(JSON.parse(saved));
            }
        } catch (e) { console.error('Failed to load history', e); }
    }, [user?.id]);
    const [showSearchHistory, setShowSearchHistory] = useState(false);
    const [lastProductLine, setLastProductLine] = useState<string>('A'); // 关闭搜索 Tab 时恢复的产品线
    const searchHistoryRef = React.useRef<HTMLDivElement>(null);

    // Build tree structure from articles
    const buildTree = (): CategoryNode[] => {
        const productModels = {
            'A': ['MAVO Edge 8K', 'MAVO Edge 6K', 'MAVO Mark2 LF', 'MAVO Mark2 S35'],
            'B': ['MAVO LF', 'MAVO S35', 'Terra 4K', 'Terra 6K'],
            'C': ['Eagle SDI', 'Eagle HDMI'],
            'D': ['GripBAT系列', 'Magic Arm', 'Dark Tower', 'KineBAT', t('wiki.product.cable_accessories')]
        };

        const categoryTemplates: Record<string, Array<{ id: string, label: string }>> = {
            'A': [{ id: 'manual', label: t('wiki.category.manual') }],
            'B': [{ id: 'manual', label: t('wiki.category.manual') }],
            'C': [{ id: 'manual', label: t('wiki.category.manual') }],
            'D': [{ id: 'manual', label: t('wiki.category.manual') }]
        };

        const buildChapterTree = (articles: KnowledgeArticle[], parentId: string): CategoryNode[] => {
            const chapterMap = new Map<number, { node: CategoryNode, mainArticle: KnowledgeArticle | null, sections: KnowledgeArticle[] }>();

            articles.forEach(article => {
                const { chapter, section } = parseChapterNumber(article.title);
                if (chapter !== null) {
                    if (!chapterMap.has(chapter)) {
                        chapterMap.set(chapter, {
                            node: {
                                id: `${parentId}-chapter-${chapter}`,
                                label: t('wiki.toc.chapter_prefix', { count: chapter }),
                                children: [],
                                articles: []
                            },
                            mainArticle: null,
                            sections: []
                        });
                    }
                    if (section === null) {
                        chapterMap.get(chapter)!.mainArticle = article;
                    } else {
                        chapterMap.get(chapter)!.sections.push(article);
                    }
                }
            });

            const result: CategoryNode[] = [];
            Array.from(chapterMap.entries())
                .sort((a, b) => a[0] - b[0])
                .forEach(([chapterNum, { node, mainArticle, sections }]) => {
                    // Sort sections (e.g., 3.1, 3.2)
                    sections.sort((a, b) => {
                        const secA = parseChapterNumber(a.title).section || '';
                        const secB = parseChapterNumber(b.title).section || '';
                        return secA.localeCompare(secB, undefined, { numeric: true, sensitivity: 'base' });
                    });

                    // Build children nodes for sections
                    const sectionNodes: CategoryNode[] = sections.map((sec, currIndex) => {
                        const { section, cleanTitle } = parseChapterNumber(sec.title);
                        return {
                            id: `${node.id}-section-${section || currIndex}`,
                            label: `${chapterNum}.${section} ${cleanTitle}`,
                            articles: [sec]
                        };
                    });

                    if (!mainArticle && sections.length === 1) {
                        const { cleanTitle } = parseChapterNumber(sections[0].title);
                        node.label = `${t('wiki.toc.chapter_prefix', { count: chapterNum })}：${cleanTitle}`;
                        node.articles = sections;
                        node.children = undefined;
                    } else {
                        node.articles = mainArticle ? [mainArticle] : [];
                        const chapterTitle = mainArticle
                            ? parseChapterNumber(mainArticle.title).cleanTitle
                            : (sections.length > 0 ? parseChapterNumber(sections[0].title).cleanTitle : t('wiki.toc.chapter_prefix', { count: chapterNum }));
                        node.label = `${t('wiki.toc.chapter_prefix', { count: chapterNum })}：${chapterTitle}`;
                        node.children = sectionNodes.length > 0 ? sectionNodes : undefined;
                    }
                    result.push(node);
                });

            return result;
        };

        const tree: CategoryNode[] = [
            { id: 'a-camera', label: t('wiki.line.a_desc'), product_line: 'A', children: [] },
            { id: 'b-camera', label: t('wiki.line.b_desc'), product_line: 'B', children: [] },
            { id: 'c-evf', label: t('wiki.line.c_desc'), product_line: 'C', children: [] },
            { id: 'd-accessory', label: t('wiki.line.d_desc'), product_line: 'D', children: [] },
        ];

        tree.forEach(productLineNode => {
            const line = productLineNode.product_line!;
            const models = productModels[line as keyof typeof productModels] || [];

            models.forEach(model => {
                const modelNode: CategoryNode = {
                    id: `${line.toLowerCase()}-${model.replace(/\s+/g, '-').toLowerCase()}`,
                    label: model,
                    product_line: line,
                    product_model: model,
                    children: []
                };

                const templates = categoryTemplates[line] || [];
                templates.forEach(template => {
                    const categoryArticles = articles.filter(a => {
                        const matchesLine = a.product_line === line;
                        const matchesCategory = a.category.toLowerCase() === template.id.toLowerCase();
                        let matchesModel = false;
                        const productModels: any = a.product_models;
                        if (Array.isArray(productModels)) {
                            matchesModel = productModels.includes(model);
                        } else if (typeof productModels === 'string') {
                            matchesModel = productModels === model || productModels.includes(model);
                        }
                        return matchesLine && matchesCategory && matchesModel;
                    });

                    if (categoryArticles.length === 0) return;

                    if (template.id === 'manual') {
                        const chapterGroups = buildChapterTree(categoryArticles, modelNode.id);
                        const manualNode: CategoryNode = {
                            id: `${modelNode.id}-${template.id}`,
                            label: template.label,
                            product_line: line,
                            product_model: model,
                            category: 'Manual',
                            children: chapterGroups
                        };
                        modelNode.children!.push(manualNode);
                    } else {
                        const categoryNode: CategoryNode = {
                            id: `${modelNode.id}-${template.id}`,
                            label: template.label,
                            product_line: line,
                            product_model: model,
                            category: template.id.charAt(0).toUpperCase() + template.id.slice(1),
                            articles: categoryArticles
                        };
                        modelNode.children!.push(categoryNode);
                    }
                });

                if (modelNode.children && modelNode.children.length > 0) {
                    productLineNode.children!.push(modelNode);
                }
            });
        });

        return tree;
    };

    useEffect(() => {
        fetchArticles();
    }, []);

    // 监听 URL 参数变化，处理面包屑导航、分组视图和搜索状态
    useEffect(() => {
        const params = new URLSearchParams(location.search);
        const productLine = params.get('line');
        const productModel = params.get('model');
        const category = params.get('category');
        const searchParam = params.get('search');

        // 如果URL中有search参数，恢复搜索状态
        if (searchParam && articles.length > 0) {
            setSearchQuery(searchParam);
            setPendingSearchQuery(searchParam);
            return;
        }

        // 如果没有任何 URL 参数且没有实体 slug 路径，自动加载 A 类内容
        // 注意：当 URL 中有 slug 时（deep-link），不应重定向到首页
        if (!slug && !productLine && !productModel && !category && articles.length > 0 && selectedProductLine === 'A' && !isSearchMode && !selectedArticle) {
            const filtered = articles.filter(a => a.product_line === 'A');
            const newBreadcrumb: BreadcrumbItem[] = [{
                label: 'WIKI',
                type: 'home'
            }, {
                label: t('wiki.line.a'),
                type: 'product_line',
                productLine: 'A',
                viewMode: 'grouped'
            }];
            setBreadcrumbPath(newBreadcrumb);
            setSearchResults(filtered);
            setShowSearchResults(true);
            setIsSearching(false);
            // 从 localStorage 加载 A 类的展开状态
            const savedModels = localStorage.getItem('wiki-grouped-expanded-models-A');
            const savedCategories = localStorage.getItem('wiki-grouped-expanded-categories-A');
            setGroupedExpandedModels(savedModels ? new Set<string>(JSON.parse(savedModels)) : new Set<string>());
            setGroupedExpandedCategories(savedCategories ? new Set<string>(JSON.parse(savedCategories)) : new Set<string>());
            navigate('/tech-hub/wiki?line=A', { replace: true });
            return;
        }

        // 如果有 URL 参数，构建对应的面包屑路径和筛选视图
        if (productLine || productModel || category) {
            const newBreadcrumb: BreadcrumbItem[] = [{ label: 'WIKI', type: 'home' }];

            if (productLine) {
                const lineLabels: Record<string, string> = {
                    'A': t('wiki.line.a'),
                    'B': t('wiki.line.b'),
                    'C': t('wiki.line.c'),
                    'D': t('wiki.line.d')
                };
                newBreadcrumb.push({
                    label: lineLabels[productLine],
                    type: 'product_line',
                    productLine,
                    viewMode: 'grouped'
                });
            }

            if (productModel && productLine) {
                newBreadcrumb.push({
                    label: productModel,
                    type: 'product_model',
                    productLine,
                    productModel,
                    viewMode: 'grouped'
                });
            }

            if (category && productModel && productLine) {
                const categoryLabels: Record<string, string> = {
                    'Manual': t('wiki.category.manual'),
                    'Troubleshooting': t('wiki.category.troubleshooting'),
                    'FAQ': t('wiki.category.faq')
                };
                newBreadcrumb.push({
                    label: categoryLabels[category] || category,
                    type: 'category',
                    productLine,
                    productModel,
                    category,
                    viewMode: 'grouped'
                });
            }

            setBreadcrumbPath(newBreadcrumb);

            // 筛选文章
            const filtered = articles.filter(a => {
                let match = true;
                if (productLine) match = match && a.product_line === productLine;
                if (productModel) {
                    const models = Array.isArray(a.product_models) ? a.product_models : [a.product_models];
                    match = match && models.includes(productModel);
                }
                if (category) match = match && a.category === category;
                return match;
            });

            setSearchResults(filtered);
            setShowSearchResults(true);
            // 从 localStorage 加载该产品线的展开状态
            const savedModels = localStorage.getItem(`wiki-grouped-expanded-models-${productLine}`);
            const savedCategories = localStorage.getItem(`wiki-grouped-expanded-categories-${productLine}`);
            setGroupedExpandedModels(savedModels ? new Set<string>(JSON.parse(savedModels)) : new Set<string>());
            setGroupedExpandedCategories(savedCategories ? new Set<string>(JSON.parse(savedCategories)) : new Set<string>());
        }
    }, [location.search, articles]);

    useEffect(() => {
        if (slug && articles.length > 0) {
            const article = articles.find(a => a.slug === slug);
            if (article) {
                loadArticleDetail(article);
                buildBreadcrumb(article);
            }
            setIsNavigationRestored(true);
        } else if (!slug) {
            const lastSlug = localStorage.getItem('wiki-last-article');
            if (lastSlug && articles.length > 0) {
                const article = articles.find(a => a.slug === lastSlug);
                if (article) {
                    // Load full article detail including content
                    loadArticleDetail(article);
                    buildBreadcrumb(article);
                }
            }
            setIsNavigationRestored(true);
        }
    }, [slug, articles.length > 0]);


    // 点击面包屑WIKI按钮时，重置到A类视图

    useEffect(() => {
        localStorage.setItem('wiki-expanded-nodes', JSON.stringify(Array.from(expandedNodes)));
    }, [expandedNodes]);

    // 保存分组展开状态到 localStorage（按产品线分开存储）
    useEffect(() => {
        if (selectedProductLine) {
            const key = `wiki-grouped-expanded-models-${selectedProductLine}`;
            const value = JSON.stringify(Array.from(groupedExpandedModels));
            localStorage.setItem(key, value);
        }
    }, [groupedExpandedModels, selectedProductLine]);

    useEffect(() => {
        if (selectedProductLine) {
            const key = `wiki-grouped-expanded-categories-${selectedProductLine}`;
            const value = JSON.stringify(Array.from(groupedExpandedCategories));
            localStorage.setItem(key, value);
        }
    }, [groupedExpandedCategories, selectedProductLine]);

    // Listen for Bokeh optimization events - use ref to avoid stale closure
    useEffect(() => {
        const handleBokehOptimized = async (event: Event) => {
            const customEvent = event as CustomEvent;
            const { articleId } = customEvent.detail;

            // Use ref to get current article (avoids stale closure)
            const currentArticle = selectedArticleRef.current;
            if (currentArticle && currentArticle.id === articleId) {
                // Reload article from server
                try {
                    const headers = token ? { Authorization: `Bearer ${token}` } : {};
                    const res = await axios.get(`/api/v1/knowledge/${currentArticle.slug}`, { headers });
                    if (res.data.success) {
                        setSelectedArticle(res.data.data);
                        selectedArticleRef.current = res.data.data;
                        setViewMode('draft'); // Auto-switch to draft view
                    }
                } catch (err) {
                    console.error('[WIKI] Failed to reload article:', err);
                }
            }
        };

        window.addEventListener('bokeh-article-optimized', handleBokehOptimized);
        return () => {
            window.removeEventListener('bokeh-article-optimized', handleBokehOptimized);
        };
    }, [token]); // Only depends on token, not selectedArticle

    // 执行搜索（手动触发）
    useEffect(() => {
        if (!pendingSearchQuery.trim()) {
            return;
        }

        const query = pendingSearchQuery.trim();

        // 提取关键词用于显示
        const keywords = extractKeywords(query);
        setExtractedKeywords(keywords);

        // 激活搜索 Tab
        if (!isSearchMode) {
            setLastProductLine(selectedProductLine || 'A');
        }
        setActiveSearchQuery(query);
        setSelectedProductLine(null); // 切换到搜索 Tab

        // History object logic handled after completion

        const doSearch = async () => {
            try {
                setIsSearching(true);
                setIsSearchMode(true); // 尽早设置搜索模式
                setShowKeywordPanel(true);
                setShowAiPanel(true);

                // 清除上一次搜索的 AI 结果，让 AI 面板显示"思考中"
                setAiAnswer('');
                setRelatedArticles([]);
                setAiRelatedTickets([]);
                setKeywordTickets([]);
                setSearchResults([]);

                // 同时执行关键词搜索和AI搜索
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
                    localStorage.setItem(`wiki-search-history-${userId}`, JSON.stringify(updated));
                    return updated;
                });

            } catch (err) {
                console.error('[Wiki] Search error:', err);
            } finally {
                setIsSearching(false);
                setIsAiSearching(false);
            }
        };

        doSearch();
    }, [pendingSearchQuery, token]);

    const performKeywordSearch = async (query: string): Promise<any> => {
        const headers = token ? { Authorization: `Bearer ${token}` } : {};

        // 1. 搜索知识库文章（优先渲染）
        const articleRes = await axios.get('/api/v1/knowledge', {
            headers,
            params: { search: query, page_size: 50 }
        });
        const articleResults = articleRes.data.data || [];
        setSearchResults(articleResults);

        setShowSearchResults(true);
        setIsSearchMode(true);

        // 更新URL，支持分享和浏览器回退
        navigate(`/tech-hub/wiki?search=${encodeURIComponent(query)}`, { replace: false });

        // 重置展开状态
        setShowMoreArticles(false);
        setShowMoreTickets(false);

        // 2. 工单搜索独立异步（不阻塞文章渲染）
        setIsTicketSearching(true);
        try {
            const ticketRes = await axios.post('/api/v1/bokeh/search-tickets', {
                query: extractKeywords(query),
                top_k: 50
            }, { headers });
            setKeywordTickets(ticketRes.data.results || []);
            return { searchResults: articleResults, keywordTickets: ticketRes.data.results || [] };
        } catch (err) {
            // 工单搜索失败不影响关键词搜索结果
            setKeywordTickets([]);
        } finally {
            setIsTicketSearching(false);
        }
    };

    // 从自然语言问题中提取关键词
    const extractKeywords = (query: string): string => {
        // 1. 移除中文停用词和疑问句式
        const stopWords = /如何|怎么|为什么|什么是|怎样|哪里|哪个|哪些|吗|呢|？|\?|的|是|有|什么|介绍|说明|关于|支持|可以|能|会|相关|一些|这个|那个|，|。|、|！|！|常见|一般|通常|经常|平时|总是|容易|可能|需要|建议|推荐|比较|正确|正常|具体|应当|请问|告诉|问题/g;

        let cleaned = query.replace(stopWords, ' ').replace(/\s+/g, ' ').trim();

        // 2. 提取英文技术术语（如 Edge 8K, HDMI, SDI）
        const technicalTerms = query.match(/([A-Za-z0-9]+(?:\s*(?:8K|6K|4K|LF|S35|SDI|HDMI|LUT|ISO|fps))?|[A-Z]{2,})/gi) || [];

        // 3. 提取中文核心词（≥2字符，过滤单字噪音）
        const chineseWords = cleaned.split(' ').filter(w => w.length >= 2);

        // 4. 合并去重
        const allKeywords = [...new Set([
            ...technicalTerms.map(t => t.trim()).filter(t => t.length >= 2),
            ...chineseWords
        ])];

        if (allKeywords.length > 0) {
            return allKeywords.join(' ');
        }

        return query.slice(0, 20);
    };

    // Bokeh 搜索 - 同时获取关联文章和工单
    const performAiSearch = async (query: string): Promise<any> => {
        try {
            const headers = token ? { Authorization: `Bearer ${token}` } : {};
            setIsAiSearching(true);

            // 并行获取知识库文章和工单（使用原始query进行搜索）
            const [articleRes, ticketRes] = await Promise.all([
                axios.get('/api/v1/knowledge', {
                    headers,
                    params: { search: query, page_size: 10 }
                }),
                axios.post('/api/v1/bokeh/search-tickets', {
                    query: extractKeywords(query),
                    top_k: 10
                }, { headers }).catch(() => ({ data: { results: [] } }))
            ]);

            const contextArticles = articleRes.data.data || [];
            const contextTickets = ticketRes.data?.results || [];

            // 3. 调用 Bokeh 接口获取回答
            const messages = [
                {
                    role: 'system',
                    content: `${t('wiki.ai.system_prompt')}

${t('wiki.ai.important_rules')}

${contextArticles.length > 0 ? `${t('wiki.ai.related_articles')}
${contextArticles.map((a: KnowledgeArticle) => `- [${a.title}](/tech-hub/wiki/${a.slug}): ${a.summary || ''}`).join('\n')}` : ''}${contextTickets.length > 0 ? `

${t('wiki.ai.related_tickets')}
${contextTickets.map((t: any) => {
                        const route = t.ticket_type === 'inquiry' ? 'inquiry-tickets' : t.ticket_type === 'rma' ? 'rma-tickets' : 'dealer-repairs';
                        return `- [${t.ticket_number}](/service/${route}/${t.ticket_id || t.id}) ${t.title}: ${t.description || ''} → ${t.resolution || t('status.processing')}`;
                    }).join('\n')}` : ''}`
                },
                {
                    role: 'user',
                    content: query
                }
            ];

            const aiRes = await axios.post('/api/ai/chat', {
                messages,
                context: { source: 'wiki_search', articles: contextArticles.map((a: KnowledgeArticle) => a.id) }
            }, { headers });

            setAiAnswer(typeof aiRes.data.data === 'string' ? aiRes.data.data : (aiRes.data.data?.content || t('wiki.search.ai_error')));
            setRelatedArticles(contextArticles);
            setAiRelatedTickets(contextTickets);

            // 重置展开状态
            setShowMoreAiArticles(false);
        } catch (err) {
            console.error('[Wiki] Bokeh search error:', err);
        } finally {
            setIsAiSearching(false);
        }
        return { aiAnswer: null, aiRelatedTickets: [] };
    };

    const fetchArticles = async () => {
        try {
            const headers = token ? { Authorization: `Bearer ${token}` } : {};
            const res = await axios.get('/api/v1/knowledge', {
                headers,
                params: { page_size: 1000 }
            });
            setArticles(res.data.data || []);
        } catch (err: any) {
            console.error('[WIKI] Failed to fetch articles:', err);
        } finally {
            setLoading(false);
        }
    };

    const buildBreadcrumb = (article: KnowledgeArticle) => {
        const crumbs: BreadcrumbItem[] = [
            { label: 'WIKI', type: 'home' }
        ];

        const lineLabels: Record<string, string> = {
            'A': t('wiki.line.a'),
            'B': t('wiki.line.b'),
            'C': t('wiki.line.c'),
            'D': t('wiki.line.d')
        };
        if (article.product_line && lineLabels[article.product_line]) {
            crumbs.push({
                label: lineLabels[article.product_line],
                type: 'product_line',
                productLine: article.product_line
            });
        }

        if (article.product_models && article.product_models.length > 0) {
            const model = Array.isArray(article.product_models) ? article.product_models[0] : article.product_models;
            crumbs.push({
                label: model,
                type: 'product_model',
                productLine: article.product_line,
                productModel: model,
                viewMode: 'grouped'
            });
        }

        if (article.category) {
            const categoryLabels: Record<string, string> = {
                'Manual': t('wiki.category.manual'),
                'Troubleshooting': t('wiki.category.troubleshooting'),
                'FAQ': t('wiki.category.faq')
            };
            crumbs.push({
                label: categoryLabels[article.category] || article.category,
                type: 'category',
                productLine: article.product_line,
                productModel: Array.isArray(article.product_models) ? article.product_models[0] : article.product_models,
                category: article.category
            });
        }

        crumbs.push({
            label: article.title,
            articleSlug: article.slug,
            type: 'article'
        });

        setBreadcrumbPath(crumbs);
    };

    const toggleNode = (nodeId: string) => {
        const newExpanded = new Set(expandedNodes);
        if (newExpanded.has(nodeId)) {
            newExpanded.delete(nodeId);
        } else {
            newExpanded.add(nodeId);
        }
        setExpandedNodes(newExpanded);
    };

    const loadArticleDetail = async (article: KnowledgeArticle) => {
        try {
            const headers = token ? { Authorization: `Bearer ${token}` } : {};
            const res = await axios.get(`/api/v1/knowledge/${article.slug}`, { headers });
            if (res.data.success) {
                const detailed = res.data.data;
                setSelectedArticle(detailed);
                selectedArticleRef.current = detailed;
                // Set Bokeh context for this article
                setWikiViewContext({
                    id: detailed.id,
                    title: detailed.title,
                    slug: detailed.slug
                });
            } else {
                setSelectedArticle(article);
                selectedArticleRef.current = article;
                setWikiViewContext({
                    id: article.id,
                    title: article.title,
                    slug: article.slug
                });
            }
        } catch (err) {
            console.error('[WIKI] Failed to load article detail:', err);
            setSelectedArticle(article);
            selectedArticleRef.current = article;
        }
    };

    const handleArticleClick = async (article: KnowledgeArticle) => {
        // 保存当前完整路径（含 search params）到历史
        const currentFullPath = location.pathname + location.search;
        if (currentFullPath && location.pathname !== `/tech-hub/wiki/${article.slug}`) {
            setNavigationHistory(prev => [...prev, currentFullPath]);
        }

        // 更新最近浏览历史
        const newRecent: RecentArticle = {
            slug: article.slug,
            title: article.title,
            timestamp: Date.now()
        };
        const updatedRecent = [
            newRecent,
            ...recentArticles.filter(r => r.slug !== article.slug)
        ].slice(0, 5); // 只保留最近5条
        setRecentArticles(updatedRecent);
        localStorage.setItem('wiki-recent-articles', JSON.stringify(updatedRecent));

        window.open(`/tech-hub/wiki/${article.slug}`, '_blank');
    };

    // 打开TOC时自动展开并滚动到当前文章位置
    const openTocAtCurrentArticle = () => {
        // 如果是Manual类文章，显示手册目录弹窗
        if (selectedArticle?.category === 'Manual') {
            setShowManualTocModal(true);
            return;
        }

        // 否则显示标准目录面板
        setTocVisible(true);

        if (selectedArticle) {
            // 展开到当前文章的所有父节点
            const newExpanded = new Set(expandedNodes);

            // 找到文章所属的节点路径
            const line = selectedArticle.product_line;
            const model = Array.isArray(selectedArticle.product_models) ? selectedArticle.product_models[0] : selectedArticle.product_models;

            // 展开产品线节点
            newExpanded.add(`${line.toLowerCase()}-camera`);
            newExpanded.add(`${line.toLowerCase()}-${model?.replace(/\s+/g, '-').toLowerCase()}`);

            // 展开分类节点（操作手册等）
            const modelId = `${line.toLowerCase()}-${model?.replace(/\s+/g, '-').toLowerCase()}`;
            newExpanded.add(`${modelId}-manual`);

            // 如果是章节文章，展开章节
            const match = selectedArticle.title.match(/:\s*(\d+)(?:\.(\d+))?/);
            if (match) {
                const chapter = parseInt(match[1]);
                newExpanded.add(`${modelId}-manual-chapter-${chapter}`);
            }

            setExpandedNodes(newExpanded);

            // 延迟滚动以确保DOM已更新
            setTimeout(() => {
                const articleElement = document.querySelector(`[data-article-id="${selectedArticle.id}"]`);
                if (articleElement && tocPanelRef.current) {
                    articleElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
                }
            }, 300);
        }
    };

    const handleHomeClick = () => {
        // 保存当前路径到历史
        if (location.pathname && location.pathname !== '/tech-hub/wiki') {
            setNavigationHistory(prev => [...prev, location.pathname]);
        }

        // 返回首页时加载A类内容
        setSelectedArticle(null);
        selectedArticleRef.current = null;
        setSelectedProductLine('A');
        clearContext(); // Clear Bokeh context
        navigate('/tech-hub/wiki?line=A'); // 默认导航到A类
        localStorage.removeItem('wiki-last-article');
    };

    // 点击产品族类卡片
    const handleProductLineClick = (productLine: string) => {
        const filtered = articles.filter(a => a.product_line === productLine);

        const lineLabels: Record<string, string> = {
            'A': t('wiki.line.a'),
            'B': t('wiki.line.b'),
            'C': t('wiki.line.c'),
            'D': t('wiki.line.d')
        };

        const newBreadcrumb: BreadcrumbItem[] = [{
            label: 'WIKI',
            type: 'home'
        }, {
            label: lineLabels[productLine],
            type: 'product_line',
            productLine,
            viewMode: 'grouped'
        }];

        // 先加载展开状态，再设置 selectedProductLine，避免 useEffect 覆盖
        const savedModels = localStorage.getItem(`wiki-grouped-expanded-models-${productLine}`);
        const savedCategories = localStorage.getItem(`wiki-grouped-expanded-categories-${productLine}`);

        // 直接设置展开状态
        const newModelsSet = savedModels ? new Set<string>(JSON.parse(savedModels)) : new Set<string>();
        const newCategoriesSet = savedCategories ? new Set<string>(JSON.parse(savedCategories)) : new Set<string>();
        setGroupedExpandedModels(newModelsSet);
        setGroupedExpandedCategories(newCategoriesSet);

        // 然后再设置其他状态
        setBreadcrumbPath(newBreadcrumb);
        setSelectedProductLine(productLine);
        setSearchResults(filtered);
        setShowSearchResults(true);
        setIsSearching(false);

        // 清除当前文章，显示分组视图
        setSelectedArticle(null);
        selectedArticleRef.current = null;

        // 使用 URL 参数支持浏览器前进/后退
        navigate(`/tech-hub/wiki?line=${productLine}`);
    };

    const handleBreadcrumbClick = async (index: number) => {
        const crumb = breadcrumbPath[index];

        // 点击文章节点
        if (crumb.type === 'article' && crumb.articleSlug) {
            const article = articles.find(a => a.slug === crumb.articleSlug);
            if (article) {
                handleArticleClick(article);
            }
            return;
        }

        // 点击 WIKI 首页时返回A类视图
        if (crumb.type === 'home') {
            handleHomeClick();
            return;
        }

        // 点击产品线、产品型号或分类节点，加载对应的分组视图
        const filterParams: any = {};
        if (crumb.type === 'product_line') {
            filterParams.product_line = crumb.productLine;
        } else if (crumb.type === 'product_model') {
            filterParams.product_line = crumb.productLine;
            filterParams.product_models = crumb.productModel;
        } else if (crumb.type === 'category') {
            filterParams.product_line = crumb.productLine;
            filterParams.product_models = crumb.productModel;
            filterParams.category = crumb.category;
        }

        try {
            const headers = token ? { Authorization: `Bearer ${token}` } : {};
            const res = await axios.get('/api/v1/knowledge', {
                headers,
                params: { ...filterParams, page_size: 1000 }
            });

            const filteredArticles = res.data.data || [];
            const newBreadcrumb = breadcrumbPath.slice(0, index + 1);

            setBreadcrumbPath(newBreadcrumb);
            setSearchResults(filteredArticles);
            setShowSearchResults(true);
            setIsSearching(false);
            setSelectedArticle(null);
            selectedArticleRef.current = null;

            setGroupedExpandedModels(new Set());
            setGroupedExpandedCategories(new Set());

            // 构建 URL 参数
            let url = '/tech-hub/wiki';
            const params = new URLSearchParams();
            if (crumb.productLine) params.set('line', crumb.productLine);
            if (crumb.productModel) params.set('model', crumb.productModel);
            if (crumb.category) params.set('category', crumb.category);
            if (params.toString()) url += `?${params.toString()}`;

            navigate(url);
        } catch (err) {
            console.error('[WIKI] Failed to load category articles:', err);
        }
    };

    const handleBackClick = () => {
        if (navigationHistory.length > 0) {
            const previousPath = navigationHistory[navigationHistory.length - 1];
            setNavigationHistory(prev => prev.slice(0, -1));
            navigate(previousPath);
        } else {
            // 如果在搜索模式下，先返回搜索结果；否则返回首页
            if (isSearchMode && selectedArticle) {
                setSelectedArticle(null);
                selectedArticleRef.current = null;
                navigate(`/tech-hub/wiki?search=${encodeURIComponent(searchQuery)}`);
            } else {
                handleHomeClick();
            }
        }
    };

    // 关闭搜索 Tab 并恢复上次浏览的产品线
    const handleDeleteHistoryItem = async (queryToDelete: string) => {
        let msg = t('wiki.search.delete_history_msg');
        if (!msg || msg === 'wiki.search.delete_history_msg') msg = '确定要删除搜索及关联对话吗';

        let title = t('wiki.search.delete_history_title');
        if (!title || title === 'wiki.search.delete_history_title') title = '删除历史搜索纪录';

        const confirmed = await confirm(
            `${msg}「${queryToDelete}」？`,
            title
        );
        if (confirmed) {
            setSearchHistory(prev => {
                const updated = prev.filter(h => h.query !== queryToDelete);
                const userId = user?.id || 'guest';
                localStorage.setItem(`wiki-search-history-${userId}`, JSON.stringify(updated));
                return updated;
            });
            if (activeSearchQuery === queryToDelete) {
                handleCloseSearchTab();
            }
        }
    };

    const handleCloseSearchTab = () => {
        setIsSearchMode(false);
        setShowSearchResults(false);
        setActiveSearchQuery(null);
        setSelectedProductLine(lastProductLine);
        setSearchQuery('');
        setPendingSearchQuery('');
        setSelectedArticle(null);
        selectedArticleRef.current = null;
        clearContext();
    };

    // 点击搜索历史项
    const handleSearchHistorySelect = (hItem: SearchHistoryItem) => {
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
    };

    // 点击外部关闭搜索历史下拉
    useEffect(() => {
        const handler = (e: MouseEvent) => {
            if (searchHistoryRef.current && !searchHistoryRef.current.contains(e.target as Node)) {
                setShowSearchHistory(false);
            }
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    // Bokeh formatting functions
    const handleBokehFormat = async () => {
        if (!selectedArticle || !token) return;

        setIsFormatting(true);
        try {
            const res = await axios.post(
                `/api/v1/knowledge/${selectedArticle.id}/format`,
                { mode: 'full' },
                { headers: { Authorization: `Bearer ${token}` } }
            );

            if (res.data.success) {
                // Reload article to get formatted content
                await loadArticleDetail(selectedArticle);
                setViewMode('draft');
            }
        } catch (err: any) {
            console.error('[WIKI] Bokeh format error:', err);
            alert(err.response?.data?.error?.message || t('wiki.bokeh_format_error'));
        } finally {
            setIsFormatting(false);
        }
    };

    const handlePublishFormat = async () => {
        if (!selectedArticle || !token) return;

        const confirmed = await confirm(
            t('wiki.publish.confirm_desc'),
            t('wiki.publish.confirm_title'),
            t('wiki.publish.confirm_button'),
            t('action.cancel')
        );
        if (!confirmed) return;

        try {
            const res = await axios.post(
                `/api/v1/knowledge/${selectedArticle.id}/publish-format`,
                {},
                { headers: { Authorization: `Bearer ${token}` } }
            );

            if (res.data.success) {
                await loadArticleDetail(selectedArticle);
                setViewMode('published');
            }
        } catch (err: any) {
            console.error('[WIKI] Publish format error:', err);
            alert(err.response?.data?.error?.message || t('wiki.publish_format_error'));
        }
    };

    // Chapter aggregation functions
    const loadChapterAggregate = async (chapterNum: number, productLine: string, productModel: string) => {
        if (!token) return;

        try {
            const res = await axios.get('/api/v1/knowledge/chapter-aggregate', {
                headers: { Authorization: `Bearer ${token}` },
                params: {
                    product_line: productLine,
                    product_model: productModel,
                    category: 'Manual',
                    chapter_number: chapterNum
                }
            });

            if (res.data.success) {
                setChapterView(res.data.data);
                setShowChapterView(true);
                setSelectedArticle(null); // 隐藏单篇文章视图
                selectedArticleRef.current = null;
                setFullChapterContent(null);
                setShowFullChapter(false);
            }
        } catch (err) {
            console.error('[WIKI] Load chapter aggregate error:', err);
        }
    };

    // Load full chapter content for "Read entire chapter" feature
    const loadFullChapter = async () => {
        if (!token || !chapterView) return;

        // Find product info from first article
        const firstSection = chapterView.sub_sections[0] || chapterView.main_chapter;
        if (!firstSection) return;

        const article = articles.find(a => a.slug === firstSection.slug);
        if (!article) return;

        setLoadingFullChapter(true);
        try {
            const productModel = Array.isArray(article.product_models)
                ? article.product_models[0]
                : article.product_models;

            const res = await axios.get('/api/v1/knowledge/chapter-full', {
                headers: { Authorization: `Bearer ${token}` },
                params: {
                    product_line: article.product_line,
                    product_model: productModel,
                    category: 'Manual',
                    chapter_number: chapterView.chapter_number
                }
            });

            if (res.data.success) {
                setFullChapterContent(res.data.data.full_content);
                setShowFullChapter(true);
            }
        } catch (err) {
            console.error('[WIKI] Load full chapter error:', err);
        } finally {
            setLoadingFullChapter(false);
        }
    };

    // Get current display content based on view mode
    const getDisplayContent = () => {
        if (!selectedArticle) return '';
        // Priority: content (published) > formatted_content (draft)
        // Page should show published content, editor shows draft
        if (selectedArticle.content && selectedArticle.content !== t('wiki.content.empty')) {
            return selectedArticle.content;
        }
        if (selectedArticle.formatted_content) {
            return selectedArticle.formatted_content;
        }
        return t('wiki.content.empty');
    };

    // Get current display summary based on view mode
    const getDisplaySummary = () => {
        if (!selectedArticle) return null;
        // In draft mode, prefer formatted_content's summary if available
        if (viewMode === 'draft' && selectedArticle.formatted_content) {
            // Try to extract summary from formatted_content metadata or use article.summary
            return selectedArticle.summary;
        }
        return selectedArticle.summary;
    };

    // Check if user can edit (Admin/Lead/Editor)
    const canEdit = selectedArticle?.permissions?.can_edit || false;

    // Check if user has wiki admin access (Admin/Lead can access Wiki admin)
    const hasWikiAdminAccess = user?.role === 'Admin' || user?.role === 'Lead';

    const renderTreeNode = (node: CategoryNode, level: number = 0) => {
        const isExpanded = expandedNodes.has(node.id);
        const hasChildren = node.children && node.children.length > 0;
        const hasArticles = node.articles && node.articles.length > 0;
        const isClickable = hasChildren || hasArticles;

        // Check if this is a chapter node (e.g., "a-mavo-edge-6k-manual-chapter-2")
        const isChapterNode = node.id.includes('-chapter-');
        const chapterMatch = node.id.match(/-chapter-(\d+)$/);
        const chapterNum = chapterMatch ? parseInt(chapterMatch[1]) : null;

        // Extract product info from node hierarchy
        const getProductInfo = () => {
            // Parse product_line and product_model from parent node id
            const idParts = node.id.split('-');
            let productLine = '';
            let productModel = '';

            // Try to find from the tree context
            if (idParts[0]?.toUpperCase().match(/^[A-D]$/)) {
                productLine = idParts[0].toUpperCase();
            }

            // Find product model from articles
            if (node.articles && node.articles.length > 0) {
                const firstArticle = node.articles[0];
                productLine = firstArticle.product_line || productLine;
                if (firstArticle.product_models && firstArticle.product_models.length > 0) {
                    productModel = Array.isArray(firstArticle.product_models)
                        ? firstArticle.product_models[0]
                        : firstArticle.product_models;
                }
            }

            return { productLine, productModel };
        };

        const handleChapterClick = async (e: React.MouseEvent) => {
            e.stopPropagation();
            if (chapterNum === null) return;

            const { productLine, productModel } = getProductInfo();
            if (productLine && productModel) {
                await loadChapterAggregate(chapterNum, productLine, productModel);
                setTocVisible(false);
            }
        };

        // Apple 风格树节点
        return (
            <div key={node.id}>
                <div
                    onClick={() => isClickable && toggleNode(node.id)}
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        padding: level === 0 ? '14px 16px' : '10px 16px',
                        marginLeft: level * 16,
                        cursor: isClickable ? 'pointer' : 'default',
                        borderBottom: level === 0 ? '1px solid rgba(255,255,255,0.06)' : 'none',
                        transition: 'background 0.15s',
                    }}
                    onMouseEnter={(e) => {
                        if (isClickable) {
                            e.currentTarget.style.background = 'rgba(255,255,255,0.04)';
                        }
                    }}
                    onMouseLeave={(e) => {
                        e.currentTarget.style.background = 'transparent';
                    }}
                >
                    {/* 展开/收起箭头 - Apple 风格 */}
                    {isClickable && (
                        <ChevronRight
                            size={16}
                            color="#FFD700"
                            style={{
                                transform: isExpanded ? 'rotate(90deg)' : 'rotate(0deg)',
                                transition: 'transform 0.2s ease',
                                flexShrink: 0
                            }}
                        />
                    )}
                    {!isClickable && <div style={{ width: 16 }} />}

                    <span style={{
                        fontSize: level === 0 ? '15px' : '14px',
                        fontWeight: level === 0 ? 600 : 400,
                        color: level === 0 ? '#FFD700' : '#ddd',
                        flex: 1
                    }}>
                        {node.label}
                    </span>

                    {/* Chapter Aggregate Button */}
                    {isChapterNode && hasArticles && node.articles && node.articles.length > 1 && (
                        <button
                            onClick={handleChapterClick}
                            style={{
                                background: 'rgba(0, 191, 165, 0.1)',
                                border: '1px solid rgba(0, 191, 165, 0.3)',
                                borderRadius: '6px',
                                padding: '4px 8px',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '4px',
                                transition: 'all 0.2s',
                                marginRight: '4px'
                            }}
                            onMouseEnter={(e) => {
                                e.currentTarget.style.background = 'rgba(0, 191, 165, 0.2)';
                            }}
                            onMouseLeave={(e) => {
                                e.currentTarget.style.background = 'rgba(0, 191, 165, 0.1)';
                            }}
                            title={t('wiki.chapter_overview')}
                        >
                            <Layers size={12} color="#00BFA5" />
                        </button>
                    )}
                </div>

                {isExpanded && hasChildren && (
                    <div>
                        {node.children!.map(child => renderTreeNode(child, level + 1))}
                    </div>
                )}

                {isExpanded && hasArticles && (
                    <div>
                        {node.articles!
                            .sort((a, b) => {
                                // Manual类按章节号排序
                                if (node.category === 'Manual' || node.label === t('wiki.category.manual')) {
                                    const getNum = (title: string) => {
                                        const match = title.match(/:\s*(\d+)(?:\.(\d+))?/);
                                        if (match) {
                                            const chapter = parseInt(match[1]) * 100;
                                            const section = match[2] ? parseInt(match[2]) : 0;
                                            return chapter + section;
                                        }
                                        return 9999;
                                    };
                                    return getNum(a.title) - getNum(b.title);
                                }
                                return 0;
                            })
                            .map(article => {
                                // 提取章节号和标题
                                const isManual = node.category === 'Manual' || node.label === t('wiki.category.manual');
                                const { chapter: parsedChap, section: parsedSec, cleanTitle: parsedCleanTitle } = parseChapterNumber(article.title);
                                const chapterNum = parsedChap !== null ? parsedChap.toString() : '';
                                const displayNum = parsedSec ? parsedSec : chapterNum;
                                const cleanTitle = parsedCleanTitle;

                                return (
                                    <div
                                        key={article.id}
                                        data-article-id={article.id}
                                        onClick={() => handleArticleClick(article)}
                                        style={{
                                            padding: '10px 16px',
                                            cursor: 'pointer',
                                            borderBottom: '1px solid rgba(255,255,255,0.04)',
                                            background: selectedArticle?.id === article.id ? 'rgba(255,215,0,0.08)' : 'transparent',
                                            transition: 'background 0.15s',
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '10px'
                                        }}
                                        onMouseEnter={(e) => {
                                            if (selectedArticle?.id !== article.id) {
                                                e.currentTarget.style.background = 'rgba(255,255,255,0.04)';
                                            }
                                        }}
                                        onMouseLeave={(e) => {
                                            if (selectedArticle?.id !== article.id) {
                                                e.currentTarget.style.background = 'transparent';
                                            }
                                        }}
                                    >
                                        {/* 章节号标签 */}
                                        {isManual && displayNum && (
                                            <span style={{
                                                minWidth: '32px',
                                                padding: '2px 6px',
                                                background: selectedArticle?.id === article.id ? 'rgba(255,215,0,0.2)' : 'rgba(255,215,0,0.1)',
                                                borderRadius: '4px',
                                                fontSize: '10px',
                                                fontWeight: 600,
                                                color: '#FFD700',
                                                textAlign: 'center'
                                            }}>
                                                {displayNum}
                                            </span>
                                        )}
                                        <div style={{
                                            fontSize: '14px',
                                            color: selectedArticle?.id === article.id ? '#FFD700' : '#bbb',
                                            lineHeight: '1.5',
                                            flex: 1
                                        }}>
                                            {isManual ? cleanTitle : article.title}
                                        </div>
                                    </div>
                                );
                            })
                        }
                    </div>
                )}
            </div>
        );
    };

    const tree = buildTree();

    if (loading) {
        return (
            <div style={{
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                height: 'calc(100vh - 60px)',
                background: '#000'
            }}>
                <div style={{ textAlign: 'center' }}>
                    <BookOpen size={48} style={{ marginBottom: '16px', color: '#FFD700' }} />
                    <div style={{ fontSize: '16px', color: '#999' }}>{t('wiki.loading')}</div>
                </div>
            </div>
        );
    }

    return (
        <>
            <div style={{
                display: 'flex',
                height: 'calc(100vh - 60px)',
                background: '#000',
                overflow: 'hidden',
                position: 'relative'
            }}>
                {/* Main Content Area - 全屏 */}
                <div style={{
                    flex: 1,
                    overflow: 'auto',
                    background: '#000',
                    position: 'relative'
                }}>
                    {selectedArticle ? (
                        // Article View
                        <div style={{ maxWidth: '880px', margin: '0 auto', padding: '32px 40px' }}>
                            {/* Top Bar with Breadcrumb and TOC Toggle - FileBrowser 风格 */}
                            <div style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '12px',
                                marginBottom: '32px',
                                paddingBottom: '20px',
                                borderBottom: '1px solid rgba(255,255,255,0.06)'
                            }}>
                                {/* Back Button - 圆形设计 */}
                                <button
                                    onClick={handleBackClick}
                                    style={{
                                        background: 'rgba(255, 255, 255, 0.1)',
                                        border: '1px solid rgba(255, 255, 255, 0.2)',
                                        borderRadius: '50%',
                                        width: '40px',
                                        height: '40px',
                                        cursor: 'pointer',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                                        flexShrink: 0
                                    }}
                                    onMouseEnter={(e) => {
                                        e.currentTarget.style.background = '#FFD700';
                                        e.currentTarget.style.borderColor = '#FFD700';
                                        e.currentTarget.style.transform = 'scale(1.1)';
                                        e.currentTarget.style.boxShadow = '0 4px 12px rgba(255, 215, 0, 0.5)';
                                    }}
                                    onMouseLeave={(e) => {
                                        e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)';
                                        e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.2)';
                                        e.currentTarget.style.transform = 'scale(1)';
                                        e.currentTarget.style.boxShadow = 'none';
                                    }}
                                >
                                    <ChevronLeft size={22} color="#fff" strokeWidth={2.5} />
                                </button>

                                {/* Breadcrumb - FileBrowser 风格：最后一项大字体 */}
                                <div style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '8px',
                                    flex: 1,
                                    overflowX: 'auto',
                                    whiteSpace: 'nowrap'
                                }}>
                                    {breadcrumbPath.map((crumb, index) => {
                                        const isLast = index === breadcrumbPath.length - 1;
                                        const isClickable = index < breadcrumbPath.length - 1;

                                        return (
                                            <React.Fragment key={index}>
                                                {index > 0 && <ChevronRight size={16} color="#666" />}
                                                <span
                                                    onClick={() => isClickable && handleBreadcrumbClick(index)}
                                                    style={{
                                                        color: isLast ? '#fff' : '#888',
                                                        cursor: isClickable ? 'pointer' : 'default',
                                                        fontWeight: isLast ? 700 : 400,
                                                        fontSize: isLast ? '1.25rem' : '0.9rem',
                                                        transition: 'color 0.2s',
                                                        maxWidth: isLast ? '400px' : '150px',
                                                        overflow: 'hidden',
                                                        textOverflow: 'ellipsis'
                                                    }}
                                                    onMouseEnter={(e) => {
                                                        if (isClickable) e.currentTarget.style.color = '#FFD700';
                                                    }}
                                                    onMouseLeave={(e) => {
                                                        if (isClickable) e.currentTarget.style.color = '#888';
                                                    }}
                                                >
                                                    {crumb.label}
                                                </span>
                                            </React.Fragment>
                                        );
                                    })}
                                </div>

                                {/* TOC Toggle Button - 右上角圆形按钮 */}
                                <button
                                    onClick={openTocAtCurrentArticle}
                                    style={{
                                        background: tocVisible ? 'rgba(255,215,0,0.1)' : 'rgba(255,255,255,0.05)',
                                        border: tocVisible ? '1px solid rgba(255,215,0,0.3)' : '1px solid rgba(255,255,255,0.08)',
                                        borderRadius: '50%',
                                        width: '40px',
                                        height: '40px',
                                        cursor: 'pointer',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                                        flexShrink: 0
                                    }}
                                    onMouseEnter={(e) => {
                                        e.currentTarget.style.background = 'rgba(255,215,0,0.15)';
                                        e.currentTarget.style.transform = 'scale(1.05)';
                                    }}
                                    onMouseLeave={(e) => {
                                        e.currentTarget.style.background = tocVisible ? 'rgba(255,215,0,0.1)' : 'rgba(255,255,255,0.05)';
                                        e.currentTarget.style.transform = 'scale(1)';
                                    }}
                                >
                                    <List size={20} color={tocVisible ? '#FFD700' : '#999'} />
                                </button>
                            </div>

                            {/* Article Header */}
                            <div style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '16px',
                                marginBottom: '20px'
                            }}>
                                <h1 style={{
                                    fontSize: '1.8rem',
                                    fontWeight: 800,
                                    color: '#fff',
                                    lineHeight: '1.3',
                                    letterSpacing: '-0.5px',
                                    flex: 1
                                }}>
                                    {selectedArticle.title}
                                </h1>

                                {/* Edit Button - Only show when no draft exists */}
                                {canEdit && selectedArticle.format_status !== 'draft' && (
                                    <button
                                        onClick={() => setShowEditorModal(true)}
                                        style={{
                                            padding: '8px 16px',
                                            background: 'rgba(255,215,0,0.15)',
                                            border: '1px solid rgba(255,215,0,0.3)',
                                            borderRadius: '8px',
                                            color: '#FFD700',
                                            fontSize: '13px',
                                            fontWeight: 600,
                                            cursor: 'pointer',
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '6px',
                                            transition: 'all 0.2s',
                                            flexShrink: 0
                                        }}
                                        onMouseEnter={(e) => {
                                            e.currentTarget.style.background = 'rgba(255,215,0,0.25)';
                                        }}
                                        onMouseLeave={(e) => {
                                            e.currentTarget.style.background = 'rgba(255,215,0,0.15)';
                                        }}
                                    >
                                        <Edit3 size={14} />
                                        {t('action.edit')}
                                    </button>
                                )}
                            </div>

                            {/* Bokeh Formatting Toolbar - Only for editors and only when draft exists */}
                            {canEdit && selectedArticle.format_status === 'draft' && (
                                <div style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '12px',
                                    marginBottom: '20px',
                                    padding: '12px 16px',
                                    background: 'rgba(0, 191, 165, 0.05)',
                                    border: '1px solid rgba(0, 191, 165, 0.15)',
                                    borderRadius: '12px'
                                }}>
                                    {/* View Mode Toggle */}
                                    <div style={{
                                        display: 'flex',
                                        gap: '4px',
                                        padding: '4px',
                                        background: 'rgba(255,255,255,0.05)',
                                        borderRadius: '8px'
                                    }}>
                                        <button
                                            onClick={() => setViewMode('published')}
                                            style={{
                                                padding: '6px 12px',
                                                background: viewMode === 'published' ? 'rgba(255,255,255,0.1)' : 'transparent',
                                                border: 'none',
                                                borderRadius: '6px',
                                                color: viewMode === 'published' ? '#fff' : '#888',
                                                fontSize: '12px',
                                                cursor: 'pointer',
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: '4px'
                                            }}
                                        >
                                            <Eye size={14} /> {t('wiki.toolbar.published')}
                                        </button>
                                        <button
                                            onClick={() => setViewMode('draft')}
                                            style={{
                                                padding: '6px 12px',
                                                background: viewMode === 'draft' ? '#10B981' : 'transparent',
                                                border: 'none',
                                                borderRadius: '6px',
                                                color: viewMode === 'draft' ? '#fff' : '#888',
                                                fontSize: '12px',
                                                fontWeight: viewMode === 'draft' ? 600 : 400,
                                                cursor: 'pointer',
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: '4px'
                                            }}
                                        >
                                            <EyeOff size={14} /> {t('wiki.toolbar.draft')}
                                        </button>
                                    </div>

                                    <div style={{ flex: 1 }} />

                                    {/* Bokeh Format Button */}
                                    <button
                                        onClick={handleBokehFormat}
                                        disabled={isFormatting}
                                        style={{
                                            padding: '8px 16px',
                                            background: isFormatting ? 'rgba(139,92,246,0.1)' : 'linear-gradient(135deg, #8B5CF6, #06B6D4)',
                                            border: 'none',
                                            borderRadius: '8px',
                                            color: '#fff',
                                            fontSize: '13px',
                                            fontWeight: 600,
                                            cursor: isFormatting ? 'not-allowed' : 'pointer',
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '6px',
                                            transition: 'all 0.2s'
                                        }}
                                    >
                                        <Sparkles size={14} />
                                        {isFormatting ? t('wiki.toolbar.bokeh_processing') : t('wiki.toolbar.bokeh_format')}
                                    </button>

                                    {/* Manual Edit Button */}
                                    <button
                                        onClick={() => setShowEditorModal(true)}
                                        style={{
                                            padding: '8px 16px',
                                            background: 'rgba(255,215,0,0.15)',
                                            border: '1px solid rgba(255,215,0,0.3)',
                                            borderRadius: '8px',
                                            color: '#FFD700',
                                            fontSize: '13px',
                                            fontWeight: 600,
                                            cursor: 'pointer',
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '6px',
                                            transition: 'all 0.2s'
                                        }}
                                    >
                                        <Edit3 size={14} />
                                        {t('action.edit')}
                                    </button>

                                    {/* Publish Button - Only show when draft exists */}
                                    {viewMode === 'draft' && (
                                        <button
                                            onClick={handlePublishFormat}
                                            style={{
                                                padding: '8px 16px',
                                                background: 'linear-gradient(135deg, #D4A017, #B8860B)',
                                                border: 'none',
                                                borderRadius: '8px',
                                                color: '#fff',
                                                fontSize: '13px',
                                                fontWeight: 600,
                                                cursor: 'pointer',
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: '6px'
                                            }}
                                        >
                                            {t('wiki.toolbar.publish_draft')}
                                        </button>
                                    )}
                                </div>
                            )}

                            {/* Article Summary */}
                            {getDisplaySummary() && (
                                <div style={{
                                    background: 'rgba(255,215,0,0.06)',
                                    border: '1px solid rgba(255,215,0,0.15)',
                                    borderRadius: '12px',
                                    padding: '16px 20px',
                                    marginBottom: '32px',
                                    fontSize: '14px',
                                    lineHeight: '1.6',
                                    color: '#ccc'
                                }}>
                                    {getDisplaySummary()}
                                </div>
                            )}

                            {/* Article Content */}
                            <div className="markdown-content" style={{
                                fontSize: '15px',
                                lineHeight: '1.8',
                                color: '#ccc'
                            }}>
                                <ReactMarkdown
                                    remarkPlugins={[remarkGfm]}
                                    rehypePlugins={[rehypeRaw]}
                                    components={{
                                        h1: ({ node, ...props }: any) => <h1 style={{ fontSize: '28px', fontWeight: 700, color: '#fff', marginTop: '32px', marginBottom: '16px', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '12px' }} {...props} />,
                                        h2: ({ node, ...props }: any) => <h2 style={{ fontSize: '24px', fontWeight: 600, color: '#fff', marginTop: '28px', marginBottom: '14px' }} {...props} />,
                                        h3: ({ node, ...props }: any) => <h3 style={{ fontSize: '20px', fontWeight: 600, color: '#FFD700', marginTop: '24px', marginBottom: '12px' }} {...props} />,
                                        h4: ({ node, ...props }: any) => <h4 style={{ fontSize: '17px', fontWeight: 500, color: '#FFD700', marginTop: '20px', marginBottom: '10px' }} {...props} />,
                                        p: ({ node, ...props }: any) => <p style={{ marginBottom: '16px', lineHeight: '1.8' }} {...props} />,
                                        ul: ({ node, ...props }: any) => <ul style={{ marginLeft: '20px', marginBottom: '16px', listStyleType: 'disc' }} {...props} />,
                                        ol: ({ node, ...props }: any) => <ol style={{ marginLeft: '20px', marginBottom: '16px' }} {...props} />,
                                        li: ({ node, ...props }: any) => <li style={{ marginBottom: '8px', lineHeight: '1.6' }} {...props} />,
                                        code: ({ node, inline, ...props }: any) => inline
                                            ? <code style={{ background: 'rgba(255,215,0,0.1)', padding: '2px 6px', borderRadius: '6px', fontSize: '13px', color: '#FFD700' }} {...props} />
                                            : <code style={{ display: 'block', background: 'rgba(0,0,0,0.4)', padding: '16px', borderRadius: '10px', overflow: 'auto', fontSize: '13px', marginBottom: '16px', border: '1px solid rgba(255,255,255,0.08)' }} {...props} />,
                                        img: ({ node, ...props }: any) => (
                                            <img
                                                {...props}
                                                style={{
                                                    maxWidth: '100%',
                                                    height: 'auto',
                                                    borderRadius: '12px',
                                                    marginTop: '20px',
                                                    marginBottom: '20px',
                                                    border: '1px solid rgba(255,255,255,0.08)'
                                                }}
                                            />
                                        ),
                                        table: ({ node, ...props }: any) => (
                                            <div style={{ overflowX: 'auto', marginBottom: '20px', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.08)' }}>
                                                <table style={{ width: '100%', borderCollapse: 'collapse' }} {...props} />
                                            </div>
                                        ),
                                        th: ({ node, ...props }: any) => <th style={{ padding: '12px', background: 'rgba(255,255,255,0.03)', borderBottom: '1px solid rgba(255,255,255,0.08)', textAlign: 'left', fontWeight: 600, fontSize: '13px' }} {...props} />,
                                        td: ({ node, ...props }: any) => <td style={{ padding: '12px', borderBottom: '1px solid rgba(255,255,255,0.05)', fontSize: '13px' }} {...props} />,
                                        blockquote: ({ node, ...props }: any) => (
                                            <blockquote style={{
                                                borderLeft: '3px solid #FFD700',
                                                paddingLeft: '20px',
                                                marginLeft: '0',
                                                marginBottom: '20px',
                                                color: '#999',
                                                fontStyle: 'italic'
                                            }} {...props} />
                                        ),
                                        a: ({ node, ...props }: any) => <a style={{ color: '#FFD700', textDecoration: 'none', borderBottom: '1px solid rgba(255,215,0,0.3)' }} {...props} />,
                                        hr: ({ node, ...props }: any) => <hr style={{ border: 'none', borderTop: '1px solid rgba(255,255,255,0.08)', marginTop: '32px', marginBottom: '32px' }} {...props} />,
                                    }}
                                >
                                    {getDisplayContent()}
                                </ReactMarkdown>
                            </div>

                            {/* Feedback Section */}
                            <div style={{
                                marginTop: '48px',
                                paddingTop: '32px',
                                borderTop: '1px solid rgba(255,255,255,0.06)'
                            }}>
                                {/* 知识来源 */}
                                {(selectedArticle.source_type || selectedArticle.source_reference) && (
                                    <div style={{
                                        background: 'rgba(255,255,255,0.02)',
                                        border: '1px solid rgba(255,255,255,0.06)',
                                        borderRadius: '12px',
                                        padding: '16px 20px',
                                        marginBottom: '32px',
                                        fontSize: '13px',
                                        color: '#999'
                                    }}>
                                        <div style={{ fontWeight: 600, color: '#FFD700', marginBottom: '8px' }}>
                                            {t('wiki.source.title')}
                                        </div>
                                        {selectedArticle.source_type && (
                                            <div style={{ marginBottom: '4px' }}>
                                                <span style={{ color: '#666' }}>{t('wiki.source.type_prefix')}</span>
                                                <span style={{ color: '#aaa' }}>{selectedArticle.source_type === 'docx' ? t('wiki.source.type.docx') : selectedArticle.source_type === 'pdf' ? t('wiki.source.type.pdf') : selectedArticle.source_type === 'url' ? t('wiki.source.type.url') : t('wiki.source.type.manual')}</span>
                                            </div>
                                        )}
                                        {selectedArticle.source_reference && (
                                            <div>
                                                <span style={{ color: '#666' }}>{t('wiki.source.doc_prefix')}</span>
                                                <span style={{ color: '#aaa' }}>{selectedArticle.source_reference}</span>
                                            </div>
                                        )}
                                        {selectedArticle.source_url && (
                                            <div style={{ marginTop: '4px' }}>
                                                <a href={selectedArticle.source_url} target="_blank" rel="noopener noreferrer" style={{ color: '#FFD700', textDecoration: 'none', fontSize: '12px' }}>
                                                    {t('wiki.source.view_original')}
                                                </a>
                                            </div>
                                        )}
                                    </div>
                                )}

                                <div style={{ textAlign: 'center' }}>
                                    <div style={{ fontSize: '14px', color: '#999', marginBottom: '16px' }}>
                                        {t('wiki.feedback.title')}
                                    </div>
                                    <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
                                        <button style={{
                                            padding: '10px 24px',
                                            background: 'rgba(255,255,255,0.05)',
                                            border: '1px solid rgba(255,255,255,0.08)',
                                            borderRadius: '10px',
                                            color: '#fff',
                                            cursor: 'pointer',
                                            fontSize: '13px',
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '8px',
                                            transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)'
                                        }}
                                            onMouseEnter={(e) => {
                                                e.currentTarget.style.background = 'rgba(16,185,129,0.1)';
                                                e.currentTarget.style.borderColor = 'rgba(16,185,129,0.3)';
                                            }}
                                            onMouseLeave={(e) => {
                                                e.currentTarget.style.background = 'rgba(255,255,255,0.05)';
                                                e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)';
                                            }}
                                        >
                                            <ThumbsUp size={16} />
                                            <span>{t('wiki.feedback.helpful', { count: selectedArticle.helpful_count })}</span>
                                        </button>
                                        <button style={{
                                            padding: '10px 24px',
                                            background: 'rgba(255,255,255,0.05)',
                                            border: '1px solid rgba(255,255,255,0.08)',
                                            borderRadius: '10px',
                                            color: '#fff',
                                            cursor: 'pointer',
                                            fontSize: '13px',
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '8px',
                                            transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)'
                                        }}
                                            onMouseEnter={(e) => {
                                                e.currentTarget.style.background = 'rgba(239,68,68,0.1)';
                                                e.currentTarget.style.borderColor = 'rgba(239,68,68,0.3)';
                                            }}
                                            onMouseLeave={(e) => {
                                                e.currentTarget.style.background = 'rgba(255,255,255,0.05)';
                                                e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)';
                                            }}
                                        >
                                            <ThumbsDown size={16} />
                                            <span>{t('wiki.feedback.not_helpful', { count: selectedArticle.not_helpful_count })}</span>
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    ) : showChapterView && chapterView ? (
                        // Chapter Aggregate View
                        <div style={{ maxWidth: '880px', margin: '0 auto', padding: '32px 40px' }}>
                            {/* Back Button */}
                            <button
                                onClick={() => {
                                    setShowChapterView(false);
                                    setChapterView(null);
                                }}
                                style={{
                                    background: 'rgba(255,255,255,0.05)',
                                    border: '1px solid rgba(255,255,255,0.08)',
                                    borderRadius: '10px',
                                    padding: '8px 16px',
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '8px',
                                    marginBottom: '24px',
                                    transition: 'all 0.2s'
                                }}
                                onMouseEnter={(e) => {
                                    e.currentTarget.style.background = 'rgba(255,255,255,0.1)';
                                }}
                                onMouseLeave={(e) => {
                                    e.currentTarget.style.background = 'rgba(255,255,255,0.05)';
                                }}
                            >
                                <ChevronLeft size={18} color="#999" />
                                <span style={{ color: '#999', fontSize: '14px' }}>{t('action.back')}</span>
                            </button>

                            {/* Chapter Header */}
                            <div style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '16px',
                                marginBottom: '32px'
                            }}>
                                <Layers size={32} color="#FFD700" />
                                <div>
                                    <h1 style={{
                                        fontSize: '28px',
                                        fontWeight: 700,
                                        color: '#fff',
                                        marginBottom: '8px'
                                    }}>
                                        {t('wiki.toc.chapter_prefix', { count: chapterView.chapter_number })}
                                        {chapterView.main_chapter && (
                                            <span style={{ color: '#ccc', fontWeight: 500 }}>：{chapterView.main_chapter.title.split(':').pop()?.split('.').slice(1).join('.')}</span>
                                        )}
                                    </h1>
                                    <p style={{ color: '#999', fontSize: '14px' }}>
                                        {t('wiki.search.results', { count: chapterView.total_articles })}
                                    </p>
                                </div>
                            </div>

                            {/* Main Chapter Summary */}
                            {chapterView.main_chapter && chapterView.main_chapter.summary && (
                                <div style={{
                                    background: 'rgba(255,215,0,0.06)',
                                    border: '1px solid rgba(255,215,0,0.15)',
                                    borderRadius: '12px',
                                    padding: '20px',
                                    marginBottom: '32px'
                                }}>
                                    <div style={{ fontSize: '15px', color: '#ccc', lineHeight: '1.6' }}>
                                        {chapterView.main_chapter.summary}
                                    </div>
                                    {chapterView.main_chapter.slug && (
                                        <button
                                            onClick={() => {
                                                const article = articles.find(a => a.slug === chapterView.main_chapter!.slug);
                                                if (article) {
                                                    setShowChapterView(false);
                                                    handleArticleClick(article);
                                                }
                                            }}
                                            style={{
                                                marginTop: '16px',
                                                padding: '8px 16px',
                                                background: 'rgba(255,215,0,0.1)',
                                                border: '1px solid rgba(255,215,0,0.3)',
                                                borderRadius: '8px',
                                                color: '#FFD700',
                                                fontSize: '13px',
                                                cursor: 'pointer'
                                            }}
                                        >
                                            {t('wiki.toc.view_overview')}
                                        </button>
                                    )}
                                </div>
                            )}

                            {/* Read Full Chapter Button */}
                            <div style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '12px',
                                marginBottom: '24px',
                                padding: '16px 20px',
                                background: 'rgba(0, 191, 165, 0.05)',
                                border: '1px solid rgba(0, 191, 165, 0.15)',
                                borderRadius: '12px'
                            }}>
                                <BookOpen size={20} color="#00BFA5" />
                                <div style={{ flex: 1 }}>
                                    <div style={{ fontSize: '14px', fontWeight: 600, color: '#00BFA5' }}>
                                        {showFullChapter ? t('wiki.toc.reading_full') : t('wiki.toc.read_full_title')}
                                    </div>
                                    <div style={{ fontSize: '12px', color: '#888', marginTop: '2px' }}>
                                        {showFullChapter ? t('common.collapse') : t('wiki.toc.read_full_desc')}
                                    </div>
                                </div>
                                <button
                                    onClick={() => {
                                        if (showFullChapter) {
                                            setShowFullChapter(false);
                                        } else {
                                            loadFullChapter();
                                        }
                                    }}
                                    disabled={loadingFullChapter}
                                    style={{
                                        padding: '10px 20px',
                                        background: showFullChapter
                                            ? 'rgba(255,255,255,0.1)'
                                            : 'linear-gradient(135deg, #00BFA5, #8E24AA)',
                                        border: 'none',
                                        borderRadius: '8px',
                                        color: '#fff',
                                        fontSize: '13px',
                                        fontWeight: 600,
                                        cursor: loadingFullChapter ? 'not-allowed' : 'pointer',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '6px',
                                        transition: 'all 0.2s'
                                    }}
                                >
                                    {loadingFullChapter ? (
                                        <>{t('dashboard.loading')}</>
                                    ) : showFullChapter ? (
                                        <>{t('common.collapse')}<ChevronDown size={14} /></>
                                    ) : (
                                        <>{t('wiki.toc.read_full')}<ChevronRight size={14} /></>
                                    )}
                                </button>
                            </div>

                            {/* Full Chapter Content */}
                            {showFullChapter && fullChapterContent && (
                                <div style={{
                                    background: 'rgba(255,255,255,0.02)',
                                    border: '1px solid rgba(0, 191, 165, 0.2)',
                                    borderRadius: '16px',
                                    padding: '32px',
                                    marginBottom: '32px'
                                }}>
                                    <div className="markdown-content" style={{
                                        fontSize: '15px',
                                        lineHeight: '1.8',
                                        color: '#ccc'
                                    }}>
                                        <ReactMarkdown
                                            remarkPlugins={[remarkGfm]}
                                            rehypePlugins={[rehypeRaw]}
                                            components={{
                                                h1: ({ node, ...props }: any) => <h1 style={{ fontSize: '28px', fontWeight: 700, color: '#fff', marginTop: '40px', marginBottom: '16px', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '12px' }} {...props} />,
                                                h2: ({ node, ...props }: any) => <h2 style={{ fontSize: '24px', fontWeight: 600, color: '#FFD700', marginTop: '32px', marginBottom: '14px' }} {...props} />,
                                                h3: ({ node, ...props }: any) => <h3 style={{ fontSize: '20px', fontWeight: 600, color: '#00BFA5', marginTop: '24px', marginBottom: '12px' }} {...props} />,
                                                h4: ({ node, ...props }: any) => <h4 style={{ fontSize: '17px', fontWeight: 500, color: '#FFD700', marginTop: '20px', marginBottom: '10px' }} {...props} />,
                                                p: ({ node, ...props }: any) => <p style={{ marginBottom: '16px', lineHeight: '1.8' }} {...props} />,
                                                ul: ({ node, ...props }: any) => <ul style={{ marginLeft: '20px', marginBottom: '16px', listStyleType: 'disc' }} {...props} />,
                                                ol: ({ node, ...props }: any) => <ol style={{ marginLeft: '20px', marginBottom: '16px' }} {...props} />,
                                                li: ({ node, ...props }: any) => <li style={{ marginBottom: '8px', lineHeight: '1.6' }} {...props} />,
                                                code: ({ node, inline, ...props }: any) => inline
                                                    ? <code style={{ background: 'rgba(255,215,0,0.1)', padding: '2px 6px', borderRadius: '6px', fontSize: '13px', color: '#FFD700' }} {...props} />
                                                    : <code style={{ display: 'block', background: 'rgba(0,0,0,0.4)', padding: '16px', borderRadius: '10px', overflow: 'auto', fontSize: '13px', marginBottom: '16px', border: '1px solid rgba(255,255,255,0.08)' }} {...props} />,
                                                img: ({ node, ...props }: any) => (
                                                    <img
                                                        {...props}
                                                        style={{
                                                            maxWidth: '100%',
                                                            height: 'auto',
                                                            borderRadius: '12px',
                                                            marginTop: '20px',
                                                            marginBottom: '20px',
                                                            border: '1px solid rgba(255,255,255,0.08)'
                                                        }}
                                                    />
                                                ),
                                                table: ({ node, ...props }: any) => (
                                                    <div style={{ overflowX: 'auto', marginBottom: '20px', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.08)' }}>
                                                        <table style={{ width: '100%', borderCollapse: 'collapse' }} {...props} />
                                                    </div>
                                                ),
                                                th: ({ node, ...props }: any) => <th style={{ padding: '12px', background: 'rgba(255,255,255,0.03)', borderBottom: '1px solid rgba(255,255,255,0.08)', textAlign: 'left', fontWeight: 600, fontSize: '13px' }} {...props} />,
                                                td: ({ node, ...props }: any) => <td style={{ padding: '12px', borderBottom: '1px solid rgba(255,255,255,0.05)', fontSize: '13px' }} {...props} />,
                                                blockquote: ({ node, ...props }: any) => (
                                                    <blockquote style={{
                                                        borderLeft: '3px solid #00BFA5',
                                                        paddingLeft: '20px',
                                                        marginLeft: '0',
                                                        marginBottom: '20px',
                                                        color: '#999',
                                                        fontStyle: 'italic'
                                                    }} {...props} />
                                                ),
                                                hr: ({ node, ...props }: any) => (
                                                    <hr style={{
                                                        border: 'none',
                                                        borderTop: '2px dashed rgba(0, 191, 165, 0.3)',
                                                        margin: '32px 0'
                                                    }} {...props} />
                                                ),
                                            }}
                                        >
                                            {fullChapterContent}
                                        </ReactMarkdown>
                                    </div>
                                </div>
                            )}

                            {/* Sub-sections Grid - Hidden when full chapter is shown */}
                            {!showFullChapter && (
                                <>
                                    <h2 style={{
                                        fontSize: '18px',
                                        fontWeight: 600,
                                        color: '#FFD700',
                                        marginBottom: '20px',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '8px'
                                    }}>
                                        <List size={18} />
                                        {t('wiki.toc.chapter_content')}
                                    </h2>

                                    <div style={{
                                        display: 'grid',
                                        gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
                                        gap: '16px'
                                    }}>
                                        {chapterView.sub_sections.map((section) => (
                                            <div
                                                key={section.id}
                                                onClick={() => {
                                                    const article = articles.find(a => a.slug === section.slug);
                                                    if (article) {
                                                        setShowChapterView(false);
                                                        handleArticleClick(article);
                                                    }
                                                }}
                                                style={{
                                                    background: 'rgba(255,255,255,0.02)',
                                                    border: '1px solid rgba(255,255,255,0.08)',
                                                    borderRadius: '12px',
                                                    padding: '20px',
                                                    cursor: 'pointer',
                                                    transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)'
                                                }}
                                                onMouseEnter={(e) => {
                                                    e.currentTarget.style.background = 'rgba(255,215,0,0.05)';
                                                    e.currentTarget.style.borderColor = 'rgba(255,215,0,0.2)';
                                                    e.currentTarget.style.transform = 'translateY(-2px)';
                                                }}
                                                onMouseLeave={(e) => {
                                                    e.currentTarget.style.background = 'rgba(255,255,255,0.02)';
                                                    e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)';
                                                    e.currentTarget.style.transform = 'translateY(0)';
                                                }}
                                            >
                                                {/* Section Number Badge */}
                                                <div style={{
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    gap: '10px',
                                                    marginBottom: '12px'
                                                }}>
                                                    <span style={{
                                                        background: 'rgba(255,215,0,0.15)',
                                                        color: '#FFD700',
                                                        padding: '4px 10px',
                                                        borderRadius: '6px',
                                                        fontSize: '12px',
                                                        fontWeight: 600
                                                    }}>
                                                        {chapterView.chapter_number}.{section.section_number}
                                                    </span>
                                                </div>

                                                {/* Section Title */}
                                                <h3 style={{
                                                    fontSize: '15px',
                                                    fontWeight: 600,
                                                    color: '#fff',
                                                    marginBottom: '8px',
                                                    lineHeight: '1.4'
                                                }}>
                                                    {section.title.split(':').pop()?.split('.').slice(1).join('.') || section.title}
                                                </h3>

                                                {/* Section Summary */}
                                                {section.summary && (
                                                    <p style={{
                                                        fontSize: '13px',
                                                        color: '#888',
                                                        lineHeight: '1.5',
                                                        marginBottom: '12px',
                                                        display: '-webkit-box',
                                                        WebkitLineClamp: 3,
                                                        WebkitBoxOrient: 'vertical',
                                                        overflow: 'hidden'
                                                    }}>
                                                        {section.summary}
                                                    </p>
                                                )}

                                                {/* Stats */}
                                                <div style={{
                                                    display: 'flex',
                                                    gap: '16px',
                                                    fontSize: '12px',
                                                    color: '#666'
                                                }}>
                                                    <span>👁 {section.view_count}</span>
                                                    <span>👍 {section.helpful_count}</span>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </>
                            )}
                        </div>
                    ) : (slug && articles.length > 0) ? (
                        <div style={{
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            justifyContent: 'center',
                            height: '60vh',
                            color: '#666'
                        }}>
                            <BookOpen size={48} style={{ marginBottom: '16px', color: '#FFD700', opacity: 0.5 }} />
                            <div style={{ fontSize: '14px' }}>{t('dashboard.loading')}</div>
                        </div>
                    ) : (isNavigationRestored && (
                        // Welcome View - 重构后的主页

                        <div style={{
                            maxWidth: '1200px',
                            margin: '0 auto',
                            padding: '40px 32px'
                        }}>
                            {/* 顶部布局：标题 + 搜索框 + 管理按钮 */}
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
                                    {/* 搜索输入框 */}
                                    <div style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        background: 'rgba(255,255,255,0.05)',
                                        border: '1px solid rgba(255,255,255,0.1)',
                                        borderRadius: '10px',
                                        padding: '0 12px',
                                        width: '240px',
                                        height: '38px',
                                        flexShrink: 0
                                    }}>
                                        <Search size={14} color="#888" style={{ flexShrink: 0 }} />
                                        <input
                                            type="text"
                                            placeholder={t('wiki.search_placeholder')}
                                            value={searchQuery}
                                            onChange={(e) => setSearchQuery(e.target.value)}
                                            onKeyDown={(e) => {
                                                if (e.key === 'Enter' && searchQuery.trim()) {
                                                    setPendingSearchQuery(searchQuery.trim());
                                                }
                                            }}
                                            style={{
                                                flex: 1,
                                                padding: '8px 10px',
                                                background: 'transparent',
                                                border: 'none',
                                                color: '#fff',
                                                fontSize: '13px',
                                                outline: 'none',
                                                minWidth: 0
                                            }}
                                        />
                                        {searchQuery.trim() && (
                                            <button
                                                onClick={() => {
                                                    setSearchQuery('');
                                                }}
                                                style={{
                                                    background: 'transparent',
                                                    border: 'none',
                                                    cursor: 'pointer',
                                                    padding: '2px',
                                                    display: 'flex',
                                                    flexShrink: 0
                                                }}
                                            >
                                                <X size={12} color="#666" />
                                            </button>
                                        )}
                                    </div>

                                    {/* 管理按钮 */}
                                    {hasWikiAdminAccess && (
                                        <div style={{ position: 'relative', flexShrink: 0 }}>
                                            <button
                                                onClick={() => setShowAdminMenu(!showAdminMenu)}
                                                style={{
                                                    padding: '8px 14px',
                                                    background: showAdminMenu ? 'rgba(255,215,0,0.1)' : 'rgba(255,255,255,0.05)',
                                                    border: `1px solid ${showAdminMenu ? 'rgba(255,215,0,0.3)' : 'rgba(255,255,255,0.08)'}`,
                                                    borderRadius: '10px',
                                                    color: showAdminMenu ? '#FFD700' : '#999',
                                                    fontSize: '13px',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    gap: '6px',
                                                    cursor: 'pointer',
                                                    transition: 'all 0.2s',
                                                    height: '38px'
                                                }}
                                            >
                                                <Settings size={16} />
                                            </button>

                                            {/* 管理菜单下拉 */}
                                            {showAdminMenu && (
                                                <>
                                                    <div
                                                        onClick={() => setShowAdminMenu(false)}
                                                        style={{
                                                            position: 'fixed',
                                                            inset: 0,
                                                            zIndex: 99
                                                        }}
                                                    />
                                                    <div style={{
                                                        position: 'absolute',
                                                        top: '100%',
                                                        right: 0,
                                                        marginTop: '8px',
                                                        background: 'linear-gradient(145deg, #2a2a2a 0%, #222 100%)',
                                                        border: '1px solid rgba(255,255,255,0.1)',
                                                        borderRadius: '12px',
                                                        padding: '8px',
                                                        minWidth: '180px',
                                                        boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
                                                        zIndex: 100
                                                    }}>
                                                        <div
                                                            onClick={() => { setShowAdminMenu(false); setShowKnowledgeImport(true); }}
                                                            style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 12px', borderRadius: '8px', cursor: 'pointer', transition: 'all 0.15s' }}
                                                            onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.08)'}
                                                            onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                                                        >
                                                            <Upload size={16} color="#FFD700" />
                                                            <span style={{ color: '#ccc', fontSize: '14px' }}>{t('wiki.import_knowledge')}</span>
                                                        </div>
                                                        <div
                                                            onClick={() => { setShowAdminMenu(false); setManageArticles(articles); setSelectedArticleIds(new Set()); setShowArticleManager(true); }}
                                                            style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 12px', borderRadius: '8px', cursor: 'pointer', transition: 'all 0.15s' }}
                                                            onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.08)'}
                                                            onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                                                        >
                                                            <FileText size={16} color="#FFD700" />
                                                            <span style={{ color: '#ccc', fontSize: '14px' }}>{t('wiki.manage_articles')}</span>
                                                        </div>
                                                        <div
                                                            onClick={() => { setShowAdminMenu(false); setShowSynonymManager(true); }}
                                                            style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 12px', borderRadius: '8px', cursor: 'pointer', transition: 'all 0.15s' }}
                                                            onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.08)'}
                                                            onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                                                        >
                                                            <BookOpen size={16} color="#60A5FA" />
                                                            <span style={{ color: '#ccc', fontSize: '14px' }}>{t('synonym.manage')}</span>
                                                        </div>
                                                    </div>
                                                </>
                                            )}
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* 统一 Tab 栏 + 搜索框 + 管理按钮 */}
                            <div style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '8px',
                                padding: '12px 0',
                                borderBottom: '1px solid rgba(255,255,255,0.08)',
                                marginBottom: '32px'
                            }}>
                                {/* A/B/C/D 产品族类 Tab */}
                                {[
                                    { line: 'A', label: t('wiki.line.a_desc') },
                                    { line: 'B', label: t('wiki.line.b_desc') },
                                    { line: 'C', label: t('wiki.line.c_desc') },
                                    { line: 'D', label: t('wiki.line.d_desc') }
                                ].map(item => {
                                    const lineArticles = articles.filter(a => a.product_line === item.line);
                                    const count = lineArticles.length;
                                    const isSelected = selectedProductLine === item.line;

                                    return (
                                        <button
                                            key={item.line}
                                            onClick={() => {
                                                // 切回产品线 Tab，如果当前在搜索模式则保留搜索数据但切换视图
                                                setSelectedProductLine(item.line);
                                                if (isSearchMode) {
                                                    setIsSearchMode(false);
                                                    setShowSearchResults(false);
                                                }
                                                handleProductLineClick(item.line);
                                            }}
                                            style={{
                                                padding: '10px 18px',
                                                background: isSelected ? 'rgba(255,215,0,0.12)' : 'transparent',
                                                border: `1px solid ${isSelected ? 'rgba(255,215,0,0.4)' : 'rgba(255,255,255,0.08)'}`,
                                                borderRadius: '10px',
                                                color: isSelected ? '#FFF' : '#888',
                                                fontSize: '14px',
                                                fontWeight: isSelected ? 600 : 400,
                                                cursor: 'pointer',
                                                transition: 'all 0.2s',
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: '8px',
                                                flexShrink: 0
                                            }}
                                            onMouseEnter={(e) => {
                                                if (!isSelected) {
                                                    e.currentTarget.style.background = 'rgba(255,255,255,0.05)';
                                                    e.currentTarget.style.borderColor = 'rgba(255,215,0,0.2)';
                                                    e.currentTarget.style.color = '#ccc';
                                                }
                                            }}
                                            onMouseLeave={(e) => {
                                                if (!isSelected) {
                                                    e.currentTarget.style.background = 'transparent';
                                                    e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)';
                                                    e.currentTarget.style.color = '#888';
                                                }
                                            }}
                                        >
                                            {item.label}
                                            {count > 0 && (
                                                <span style={{
                                                    padding: '2px 8px',
                                                    background: isSelected ? 'rgba(255,215,0,0.2)' : 'rgba(255,255,255,0.05)',
                                                    borderRadius: '10px',
                                                    fontSize: '12px',
                                                    color: isSelected ? '#FFD700' : '#666'
                                                }}>
                                                    {count}
                                                </span>
                                            )}
                                        </button>
                                    );
                                })}

                                {/* 搜索 Tab - 有搜索时显示 */}
                                {activeSearchQuery && (
                                    <div ref={searchHistoryRef} style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                                        <button
                                            onClick={() => {
                                                // 切换到搜索 Tab
                                                setSelectedProductLine(null);
                                                setIsSearchMode(true);
                                                setShowSearchResults(true);
                                            }}
                                            style={{
                                                padding: '10px 14px',
                                                background: selectedProductLine === null ? 'rgba(59,130,246,0.12)' : 'transparent',
                                                border: `1px solid ${selectedProductLine === null ? 'rgba(59,130,246,0.4)' : 'rgba(255,255,255,0.08)'}`,
                                                borderRadius: '10px',
                                                color: selectedProductLine === null ? '#fff' : '#888',
                                                fontSize: '14px',
                                                fontWeight: selectedProductLine === null ? 600 : 400,
                                                cursor: 'pointer',
                                                transition: 'all 0.2s',
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: '6px',
                                                flexShrink: 0
                                            }}
                                        >
                                            <Search size={14} />
                                            <span style={{ maxWidth: '120px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                「{activeSearchQuery.length > 10 ? activeSearchQuery.slice(0, 10) + '...' : activeSearchQuery}」
                                            </span>
                                            {/* 历史下拉箭头 */}
                                            {searchHistory.length > 1 && (
                                                <ChevronDown
                                                    size={12}
                                                    style={{
                                                        opacity: 0.6,
                                                        cursor: 'pointer',
                                                        transition: 'transform 0.2s',
                                                        transform: showSearchHistory ? 'rotate(180deg)' : 'rotate(0deg)'
                                                    }}
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        setShowSearchHistory(!showSearchHistory);
                                                    }}
                                                />
                                            )}
                                            {/* 关闭按钮 */}
                                            <X
                                                size={12}
                                                style={{ opacity: 0.5, cursor: 'pointer', marginLeft: '2px' }}
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    handleCloseSearchTab();
                                                }}
                                            />
                                        </button>

                                        {/* 搜索历史下拉 */}
                                        {showSearchHistory && searchHistory.length > 0 && (
                                            <div style={{
                                                position: 'absolute',
                                                top: '100%',
                                                left: 0,
                                                marginTop: '6px',
                                                width: '240px',
                                                background: 'linear-gradient(145deg, #2a2a2a 0%, #222 100%)',
                                                border: '1px solid rgba(255,255,255,0.1)',
                                                borderRadius: '10px',
                                                boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
                                                overflow: 'hidden',
                                                zIndex: 100
                                            }}>
                                                <div style={{
                                                    padding: '8px 12px',
                                                    fontSize: '11px',
                                                    color: '#666',
                                                    fontWeight: 600,
                                                    textTransform: 'uppercase',
                                                    letterSpacing: '0.5px',
                                                    borderBottom: '1px solid rgba(255,255,255,0.05)'
                                                }}>
                                                    {t('wiki.search.history')}
                                                </div>
                                                {searchHistory.map((hItem, i) => (
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
                                                            onClick={(e) => { e.stopPropagation(); handleDeleteHistoryItem(hItem.query); }}
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
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                )}


                            </div>

                            {/* 搜索结果列表 - 搜索 Tab 激活时显示（位于 Tab 栏下方） */}
                            {isSearchMode && selectedProductLine === null && activeSearchQuery && (
                                <div style={{ marginBottom: '24px' }}>
                                    {/* 关键词搜索 Panel - 始终显示（搜索结果为空时显示"未找到"） */}
                                    {isSearchMode && (
                                        <div style={{
                                            background: 'rgba(255,255,255,0.03)',
                                            border: '2px solid rgba(255,215,0,0.25)',
                                            borderRadius: '16px',
                                            padding: '20px',
                                            marginBottom: '20px',
                                            boxShadow: '0 4px 24px rgba(255,215,0,0.08)'
                                        }}>
                                            {/* Panel 头部：标签 + 关闭按钮 */}
                                            <div style={{
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'space-between',
                                                marginBottom: showKeywordPanel ? '16px' : '0'
                                            }}>
                                                <div style={{
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    gap: '12px'
                                                }}>
                                                    <span style={{
                                                        padding: '4px 12px',
                                                        background: 'rgba(255,215,0,0.15)',
                                                        borderRadius: '6px',
                                                        fontSize: '12px',
                                                        color: '#FFD700',
                                                        fontWeight: 600
                                                    }}>
                                                        {t('wiki.search.keyword')}
                                                    </span>
                                                    <span style={{ fontSize: '13px', color: '#666' }}>
                                                        {extractedKeywords ? `「${extractedKeywords}」` : ''}
                                                    </span>
                                                </div>
                                                <button
                                                    onClick={() => {
                                                        // 折叠/展开关键词搜索 Panel
                                                        setShowKeywordPanel(!showKeywordPanel);
                                                    }}
                                                    style={{
                                                        width: '28px',
                                                        height: '28px',
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        justifyContent: 'center',
                                                        background: 'rgba(255,255,255,0.05)',
                                                        border: '1px solid rgba(255,255,255,0.1)',
                                                        borderRadius: '6px',
                                                        cursor: 'pointer',
                                                        transition: 'all 0.15s'
                                                    }}
                                                    onMouseEnter={(e) => {
                                                        e.currentTarget.style.background = 'rgba(255,255,255,0.1)';
                                                    }}
                                                    onMouseLeave={(e) => {
                                                        e.currentTarget.style.background = 'rgba(255,255,255,0.05)';
                                                    }}
                                                >
                                                    <ChevronDown
                                                        size={14}
                                                        color="#999"
                                                        style={{
                                                            transform: showKeywordPanel ? 'rotate(180deg)' : 'rotate(0deg)',
                                                            transition: 'transform 0.2s ease'
                                                        }}
                                                    />
                                                </button>
                                            </div>

                                            {showKeywordPanel && (
                                                <>
                                                    {/* 搜索结果统计 + 展开更多按钮 */}
                                                    <div style={{
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        justifyContent: 'space-between',
                                                        marginBottom: '16px',
                                                        paddingBottom: '12px',
                                                        borderBottom: '1px solid rgba(255,255,255,0.06)'
                                                    }}>
                                                        <div style={{ fontSize: '14px', color: '#999' }}>
                                                            {searchResults.length === 0 && keywordTickets.length === 0 ? (
                                                                <span style={{ color: '#666' }}>{t('wiki.search.no_results')}</span>
                                                            ) : (
                                                                <>
                                                                    {t('wiki.search.results', { count: searchResults.length })}
                                                                    {keywordTickets.length > 0 && ` · ${t('wiki.search.related_tickets')} (${keywordTickets.length})`}
                                                                </>
                                                            )}
                                                        </div>
                                                        {searchResults.length > DEFAULT_SHOW_COUNT && (
                                                            <button
                                                                onClick={() => setShowMoreArticles(!showMoreArticles)}
                                                                style={{
                                                                    padding: '6px 12px',
                                                                    background: 'rgba(255,255,255,0.05)',
                                                                    border: '1px solid rgba(255,255,255,0.1)',
                                                                    borderRadius: '6px',
                                                                    color: '#888',
                                                                    fontSize: '12px',
                                                                    cursor: 'pointer',
                                                                    display: 'flex',
                                                                    alignItems: 'center',
                                                                    gap: '4px',
                                                                    transition: 'all 0.15s'
                                                                }}
                                                                onMouseEnter={(e) => {
                                                                    e.currentTarget.style.background = 'rgba(255,255,255,0.1)';
                                                                }}
                                                                onMouseLeave={(e) => {
                                                                    e.currentTarget.style.background = 'rgba(255,255,255,0.05)';
                                                                }}
                                                            >
                                                                {showMoreArticles ? (
                                                                    <>{t('common.show_less')} <ChevronUp size={12} /></>
                                                                ) : (
                                                                    <>{t('common.show_more', { count: searchResults.length - DEFAULT_SHOW_COUNT })} <ChevronDown size={12} /></>
                                                                )}
                                                            </button>
                                                        )}
                                                    </div>

                                                    {/* 关键词结果内容 - 文章列表 */}
                                                    <div>
                                                        {/* 文章列表 */}
                                                        {searchResults.length > 0 && (
                                                            <div style={{ marginBottom: keywordTickets.length > 0 ? '20px' : 0 }}>
                                                                <div style={{
                                                                    display: 'grid',
                                                                    gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
                                                                    gap: '12px'
                                                                }}>
                                                                    {(showMoreArticles ? searchResults : searchResults.slice(0, DEFAULT_SHOW_COUNT)).map(article => (
                                                                        <ArticleCard
                                                                            key={article.id}
                                                                            id={article.id}
                                                                            title={article.title}
                                                                            summary={article.summary}
                                                                            productLine={article.product_line}
                                                                            productModels={article.product_models}
                                                                            category={article.category}
                                                                            onClick={() => handleArticleClick(article)}
                                                                            variant="default"
                                                                        />
                                                                    ))}
                                                                </div>
                                                            </div>
                                                        )}

                                                        {/* 工单列表 - 始终渲染（loading/empty/有数据） */}
                                                        <div>
                                                            <div style={{
                                                                display: 'flex',
                                                                alignItems: 'center',
                                                                justifyContent: 'space-between',
                                                                marginBottom: '12px'
                                                            }}>
                                                                <div style={{
                                                                    fontSize: '12px',
                                                                    fontWeight: 600,
                                                                    color: '#888',
                                                                    textTransform: 'uppercase',
                                                                    letterSpacing: '0.5px'
                                                                }}>
                                                                    {t('wiki.search.related_tickets')}{!isTicketSearching && keywordTickets.length > 0 && ` · ${keywordTickets.length}`}
                                                                </div>
                                                                {keywordTickets.length > DEFAULT_SHOW_COUNT && (
                                                                    <button
                                                                        onClick={() => setShowMoreTickets(!showMoreTickets)}
                                                                        style={{
                                                                            display: 'flex',
                                                                            alignItems: 'center',
                                                                            gap: '4px',
                                                                            padding: '2px 10px',
                                                                            background: 'rgba(255,255,255,0.05)',
                                                                            border: '1px solid rgba(255,255,255,0.1)',
                                                                            borderRadius: '6px',
                                                                            cursor: 'pointer',
                                                                            color: '#888',
                                                                            fontSize: '12px',
                                                                            transition: 'all 0.15s'
                                                                        }}
                                                                        onMouseEnter={(e) => {
                                                                            e.currentTarget.style.background = 'rgba(255,255,255,0.1)';
                                                                        }}
                                                                        onMouseLeave={(e) => {
                                                                            e.currentTarget.style.background = 'rgba(255,255,255,0.05)';
                                                                        }}
                                                                    >
                                                                        {showMoreTickets ? (
                                                                            <>{t('common.show_less')} <ChevronUp size={14} /></>
                                                                        ) : (
                                                                            <>{t('common.show_more', { count: keywordTickets.length - DEFAULT_SHOW_COUNT })} <ChevronDown size={14} /></>
                                                                        )}
                                                                    </button>
                                                                )}
                                                            </div>
                                                            {isTicketSearching ? (
                                                                <div style={{
                                                                    padding: '16px',
                                                                    background: 'rgba(255,255,255,0.02)',
                                                                    border: '1px solid rgba(255,255,255,0.05)',
                                                                    borderRadius: '8px',
                                                                    display: 'flex',
                                                                    alignItems: 'center',
                                                                    gap: '10px',
                                                                    color: '#888',
                                                                    fontSize: '13px'
                                                                }}>
                                                                    <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} />
                                                                    {t('wiki.search.searching_tickets')}
                                                                </div>
                                                            ) : keywordTickets.length === 0 ? (
                                                                <div style={{
                                                                    padding: '12px 16px',
                                                                    background: 'rgba(255,255,255,0.02)',
                                                                    border: '1px solid rgba(255,255,255,0.05)',
                                                                    borderRadius: '8px',
                                                                    color: '#666',
                                                                    fontSize: '13px'
                                                                }}>
                                                                    {t('wiki.search.no_tickets')}
                                                                </div>
                                                            ) : (
                                                                <div style={{
                                                                    display: 'grid',
                                                                    gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
                                                                    gap: '12px'
                                                                }}>
                                                                    {(showMoreTickets ? keywordTickets : keywordTickets.slice(0, DEFAULT_SHOW_COUNT)).map((ticket: any) => (
                                                                        <TicketCard
                                                                            key={`${ticket.ticket_type}-${ticket.id}`}
                                                                            id={ticket.id}
                                                                            ticketNumber={ticket.ticket_number}
                                                                            ticketType={ticket.ticket_type}
                                                                            title={ticket.title || ticket.subject || t('wiki.search.untitled')}
                                                                            status={ticket.status}
                                                                            productModel={ticket.product_model}
                                                                            customerName={ticket.customer_name}
                                                                            contactName={ticket.contact_name}
                                                                            onClick={() => {
                                                                                const route = ticket.ticket_type === 'inquiry' ? 'inquiry-tickets' : ticket.ticket_type === 'rma' ? 'rma-tickets' : 'dealer-repairs';
                                                                                window.open(`/service/${route}/${ticket.ticket_id || ticket.id}`, '_blank');
                                                                            }}
                                                                            variant="compact"
                                                                        />
                                                                    ))}
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>
                                                </>
                                            )}
                                        </div>
                                    )}

                                    {/* AI 搜索 Panel - 只在搜索时显示 */}
                                    {isSearchMode && (
                                        <div style={{
                                            background: 'rgba(255,255,255,0.03)',
                                            border: '1px solid rgba(255,255,255,0.1)',
                                            borderRadius: '16px',
                                            padding: '20px',
                                            position: 'relative',
                                            overflow: 'hidden'
                                        }}>
                                            {/* Panel 头部：标签 + 折叠按钮 */}
                                            <div style={{
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'space-between',
                                                marginBottom: '0'
                                            }}>
                                                <div style={{
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    gap: '12px'
                                                }}>
                                                    <span style={{
                                                        padding: '5px 14px',
                                                        background: 'linear-gradient(135deg, rgba(139,92,246,0.2), rgba(6,182,212,0.2))',
                                                        borderRadius: '8px',
                                                        fontSize: '12px',
                                                        color: '#a78bfa',
                                                        fontWeight: 600,
                                                        letterSpacing: '0.3px'
                                                    }}>
                                                        ✦ {t('wiki.search.ai_answer')}
                                                    </span>
                                                    {isAiSearching && (
                                                        <span style={{ fontSize: '13px', color: '#666', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                            <Loader2 size={14} className="spin" style={{ animation: 'spin 1s linear infinite' }} />
                                                            {t('wiki.search.thinking')}
                                                        </span>
                                                    )}
                                                </div>
                                                <button
                                                    onClick={() => {
                                                        // 折叠/展开 AI Panel
                                                        setShowAiPanel(!showAiPanel);
                                                    }}
                                                    style={{
                                                        width: '28px',
                                                        height: '28px',
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        justifyContent: 'center',
                                                        background: 'rgba(255,255,255,0.05)',
                                                        border: '1px solid rgba(255,255,255,0.1)',
                                                        borderRadius: '6px',
                                                        cursor: 'pointer',
                                                        transition: 'all 0.15s'
                                                    }}
                                                    onMouseEnter={(e) => {
                                                        e.currentTarget.style.background = 'rgba(255,255,255,0.1)';
                                                    }}
                                                    onMouseLeave={(e) => {
                                                        e.currentTarget.style.background = 'rgba(255,255,255,0.05)';
                                                    }}
                                                >
                                                    <ChevronDown
                                                        size={14}
                                                        color="#999"
                                                        style={{
                                                            transform: showAiPanel ? 'rotate(180deg)' : 'rotate(0deg)',
                                                            transition: 'transform 0.2s ease'
                                                        }}
                                                    />
                                                </button>
                                            </div>

                                            {/* Bokeh 回答区域 - 只在搜索时显示 */}
                                            {showAiPanel && (isAiSearching || aiAnswer || relatedArticles.length > 0 || aiRelatedTickets.length > 0) && (
                                                <div style={{ marginTop: '16px' }}>
                                                    {isAiSearching && !aiAnswer && (
                                                        <div style={{
                                                            background: 'linear-gradient(135deg, rgba(139,92,246,0.06), rgba(6,182,212,0.06))',
                                                            border: '1px solid rgba(139,92,246,0.15)',
                                                            borderRadius: '12px',
                                                            padding: '24px',
                                                            marginBottom: '20px',
                                                            display: 'flex',
                                                            flexDirection: 'column',
                                                            alignItems: 'center',
                                                            gap: '12px'
                                                        }}>
                                                            <Loader2 size={28} color="#a78bfa" style={{ animation: 'spin 1.5s linear infinite' }} />
                                                            <span style={{ fontSize: '14px', color: '#a78bfa', fontWeight: 500 }}>
                                                                {t('wiki.search.analyzing')}
                                                            </span>
                                                            <span style={{ fontSize: '12px', color: '#666' }}>
                                                                {t('wiki.search.retrieving')}
                                                            </span>
                                                        </div>
                                                    )}

                                                    {aiAnswer && (
                                                        <div style={{
                                                            background: 'rgba(255,255,255,0.02)',
                                                            borderRadius: '12px',
                                                            marginBottom: '20px',
                                                            overflow: 'hidden'
                                                        }}>
                                                            {/* AI回答内容 - 精心排版 */}
                                                            <div style={{ padding: '20px 24px' }}>
                                                                <div style={{
                                                                    fontSize: '14.5px',
                                                                    color: '#d4d4d4',
                                                                    lineHeight: '1.85',
                                                                    letterSpacing: '0.01em'
                                                                }}>
                                                                    <ReactMarkdown
                                                                        remarkPlugins={[remarkGfm]}
                                                                        rehypePlugins={[rehypeRaw]}
                                                                        components={{
                                                                            a: ({ node, ...props }) => {
                                                                                const text = props.children?.toString() || '';
                                                                                // 支持复杂前缀如 RMA-C-2601-0002，同时也支持 K2601-0001
                                                                                const isTicket = text.match(/\[?([A-Z]+-)*[A-Z]?\d{4}-\d{4}\]?/) || props.href?.includes('/service/');

                                                                                // Extract ticket type from URL if possible, or fallback
                                                                                let typeStr = 'default';
                                                                                if (props.href?.includes('inquiry')) typeStr = 'inquiry';
                                                                                else if (props.href?.includes('rma')) typeStr = 'rma';
                                                                                else if (props.href?.includes('dealer')) typeStr = 'dealer_repair';

                                                                                const styles = isTicket ? getTicketStyles(typeStr, t) : getTicketStyles('article', t);

                                                                                return (
                                                                                    <a {...props}
                                                                                        style={{
                                                                                            display: 'inline-flex',
                                                                                            alignItems: 'center',
                                                                                            gap: '4px',
                                                                                            background: styles.bg,
                                                                                            border: `1px solid ${styles.border}`,
                                                                                            padding: '1px 8px',
                                                                                            borderRadius: '6px',
                                                                                            color: styles.color,
                                                                                            textDecoration: 'none',
                                                                                            fontSize: '13px',
                                                                                            fontWeight: 500,
                                                                                            margin: '0 4px',
                                                                                            verticalAlign: 'bottom',
                                                                                            transition: 'all 0.2s'
                                                                                        }}
                                                                                        onMouseEnter={(e) => {
                                                                                            e.currentTarget.style.background = styles.hoverBg;
                                                                                            e.currentTarget.style.borderColor = styles.hoverBorder;
                                                                                        }}
                                                                                        onMouseLeave={(e) => {
                                                                                            e.currentTarget.style.background = styles.bg;
                                                                                            e.currentTarget.style.borderColor = styles.border;
                                                                                        }}
                                                                                        target="_blank"
                                                                                        rel="noopener noreferrer"
                                                                                    >
                                                                                        <span style={{ display: 'flex', marginTop: '-1px' }}>
                                                                                            {isTicket ? styles.icon : <FileText size={14} />}
                                                                                        </span>
                                                                                        {props.children}
                                                                                    </a>
                                                                                );
                                                                            }
                                                                        }}
                                                                    >
                                                                        {aiAnswer}
                                                                    </ReactMarkdown>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    )}

                                                    {/* 参考来源 */}
                                                    {/* 参考来源 */}
                                                    {(relatedArticles.length > 0 || aiRelatedTickets.length > 0) && (
                                                        <div>
                                                            <div style={{
                                                                display: 'flex',
                                                                justifyContent: 'space-between',
                                                                alignItems: 'center',
                                                                marginBottom: '12px'
                                                            }}>
                                                                <div style={{
                                                                    fontSize: '13px',
                                                                    fontWeight: 700,
                                                                    color: '#888',
                                                                    textTransform: 'uppercase',
                                                                    letterSpacing: '1px'
                                                                }}>
                                                                    {t('wiki.search.sources')} · {relatedArticles.length + aiRelatedTickets.length}
                                                                </div>
                                                                {relatedArticles.length + aiRelatedTickets.length > AI_REF_SHOW_COUNT && (
                                                                    <button
                                                                        onClick={() => setShowMoreAiArticles(!showMoreAiArticles)}
                                                                        style={{
                                                                            background: 'transparent',
                                                                            border: 'none',
                                                                            color: '#a78bfa',
                                                                            fontSize: '12px',
                                                                            cursor: 'pointer',
                                                                            display: 'flex',
                                                                            alignItems: 'center',
                                                                            gap: '4px',
                                                                            padding: 0
                                                                        }}
                                                                    >
                                                                        {showMoreAiArticles ? (
                                                                            <>{t('common.show_less')} <ChevronUp size={12} /></>
                                                                        ) : (
                                                                            <>{t('common.show_more', { count: relatedArticles.length + aiRelatedTickets.length - AI_REF_SHOW_COUNT })} <ChevronDown size={12} /></>
                                                                        )}
                                                                    </button>
                                                                )}
                                                            </div>

                                                            <div style={{
                                                                display: 'grid',
                                                                gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
                                                                gap: '10px'
                                                            }}>
                                                                {((showMoreAiArticles
                                                                    ? [...relatedArticles, ...aiRelatedTickets]
                                                                    : [...relatedArticles, ...aiRelatedTickets].slice(0, AI_REF_SHOW_COUNT)
                                                                )).map((item: any) => {
                                                                    // 如果有 summary 或 content，则是文章；否则视为工单
                                                                    if (item.summary !== undefined || item.content !== undefined) {
                                                                        return (
                                                                            <ArticleCard
                                                                                key={`ai-article-${item.id}`}
                                                                                id={item.id}
                                                                                title={item.title}
                                                                                summary={item.summary}
                                                                                productLine={item.product_line}
                                                                                productModels={item.product_models}
                                                                                category={item.category}
                                                                                onClick={() => handleArticleClick(item)}
                                                                                variant="reference"
                                                                            />
                                                                        );
                                                                    } else {
                                                                        return (
                                                                            <TicketCard
                                                                                key={`ai-ticket-${item.ticket_type}-${item.id}`}
                                                                                id={item.id}
                                                                                ticketNumber={item.ticket_number}
                                                                                ticketType={item.ticket_type}
                                                                                title={item.title || item.subject || t('wiki.search.untitled')}
                                                                                status={item.status}
                                                                                productModel={item.product_model}
                                                                                customerName={item.customer_name}
                                                                                contactName={item.contact_name}
                                                                                onClick={() => {
                                                                                    const route = item.ticket_type === 'inquiry' ? 'inquiry-tickets' : item.ticket_type === 'rma' ? 'rma-tickets' : 'dealer-repairs';
                                                                                    window.open(`/service/${route}/${item.ticket_id || item.id}`, '_blank');
                                                                                }}
                                                                                variant="compact"
                                                                            />
                                                                        );
                                                                    }
                                                                })}
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* 分组折叠视图 - 只在非搜索模式下显示 */}
                            {!isSearchMode && (() => {
                                const lineArticles = articles.filter(a => a.product_line === selectedProductLine);
                                // 统计产品型号和文章数
                                const modelSet = new Set<string>();
                                lineArticles.forEach(a => {
                                    const models = Array.isArray(a.product_models) ? a.product_models : [a.product_models];
                                    models.forEach(m => m && modelSet.add(m));
                                });
                                const modelCount = modelSet.size;
                                const articleCount = lineArticles.length;

                                if (articleCount === 0) {
                                    return (
                                        <div style={{ padding: '40px 0', textAlign: 'center', color: '#666', fontSize: '14px' }}>
                                            {t('wiki.category.no_articles')}
                                        </div>
                                    );
                                }

                                // 按产品型号分组
                                const groupedByModel = new Map<string, KnowledgeArticle[]>();
                                lineArticles.forEach(a => {
                                    const model = Array.isArray(a.product_models) ? a.product_models[0] : a.product_models;
                                    if (!model) return;
                                    if (!groupedByModel.has(model)) {
                                        groupedByModel.set(model, []);
                                    }
                                    groupedByModel.get(model)!.push(a);
                                });

                                return (
                                    <div style={{
                                        background: 'rgba(255,255,255,0.02)',
                                        border: '1px solid rgba(255,255,255,0.08)',
                                        borderRadius: '16px',
                                        padding: '20px',
                                        marginBottom: '32px'
                                    }}>
                                        {/* 统计文案 */}
                                        <div style={{
                                            display: 'flex',
                                            justifyContent: 'space-between',
                                            alignItems: 'center',
                                            marginBottom: '16px'
                                        }}>
                                            <span style={{ fontSize: '14px', color: '#999' }}>
                                                {t('wiki.manage.stats_summary', { models: modelCount, articles: articleCount })}
                                            </span>
                                        </div>

                                        {/* 产品型号分组列表 */}
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                            {Array.from(groupedByModel.entries()).map(([model, modelArticles]) => {
                                                const isExpanded = groupedExpandedModels.has(model);

                                                // 获取该产品型号的产品线（从第一篇文章获取）
                                                const productLine = modelArticles[0]?.product_line || '';

                                                // 按分类分组
                                                const byCategory = new Map<string, KnowledgeArticle[]>();
                                                modelArticles.forEach(a => {
                                                    const cat = a.category || 'Other';
                                                    if (!byCategory.has(cat)) byCategory.set(cat, []);
                                                    byCategory.get(cat)!.push(a);
                                                });

                                                return (
                                                    <div key={model}>
                                                        {/* 产品型号行 */}
                                                        <div
                                                            onClick={() => {
                                                                const newSet = new Set(groupedExpandedModels);
                                                                if (isExpanded) {
                                                                    newSet.delete(model);
                                                                } else {
                                                                    newSet.add(model);
                                                                }
                                                                setGroupedExpandedModels(newSet);
                                                            }}
                                                            style={{
                                                                display: 'flex',
                                                                alignItems: 'center',
                                                                gap: '12px',
                                                                padding: '12px 16px',
                                                                background: isExpanded ? 'rgba(255,215,0,0.05)' : 'rgba(255,255,255,0.02)',
                                                                border: `1px solid ${isExpanded ? 'rgba(255,215,0,0.2)' : 'rgba(255,255,255,0.06)'}`,
                                                                borderRadius: '10px',
                                                                cursor: 'pointer',
                                                                transition: 'all 0.2s'
                                                            }}
                                                        >
                                                            {/* 产品线标记 */}
                                                            <span style={{
                                                                width: '28px',
                                                                height: '28px',
                                                                background: 'rgba(255,215,0,0.15)',
                                                                color: '#FFD700',
                                                                borderRadius: '6px',
                                                                display: 'flex',
                                                                alignItems: 'center',
                                                                justifyContent: 'center',
                                                                fontSize: '12px',
                                                                fontWeight: 700
                                                            }}>
                                                                {productLine}
                                                            </span>

                                                            <span style={{ flex: 1, fontWeight: 600, color: '#fff', fontSize: '15px' }}>
                                                                {model}
                                                            </span>

                                                            <span style={{
                                                                padding: '4px 10px',
                                                                background: 'rgba(255,255,255,0.05)',
                                                                borderRadius: '12px',
                                                                fontSize: '12px',
                                                                color: '#999'
                                                            }}>
                                                                {t('wiki.count.articles', { count: modelArticles.length })}
                                                            </span>

                                                            <ChevronDown
                                                                size={18}
                                                                color="#666"
                                                                style={{
                                                                    transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)',
                                                                    transition: 'transform 0.2s'
                                                                }}
                                                            />
                                                        </div>

                                                        {/* 展开的分类列表 */}
                                                        {isExpanded && (
                                                            <div style={{
                                                                marginLeft: '40px',
                                                                marginTop: '8px',
                                                                display: 'flex',
                                                                flexDirection: 'column',
                                                                gap: '6px'
                                                            }}>
                                                                {Array.from(byCategory.entries()).map(([category, catArticles]) => {
                                                                    const catKey = `${model}-${category}`;
                                                                    const isCatExpanded = groupedExpandedCategories.has(catKey);
                                                                    const categoryLabels: Record<string, string> = {
                                                                        'Manual': t('wiki.category.manual'),
                                                                        'Troubleshooting': t('wiki.category.troubleshooting'),
                                                                        'FAQ': t('wiki.category.faq')
                                                                    };

                                                                    return (
                                                                        <div key={catKey}>
                                                                            <div
                                                                                onClick={() => {
                                                                                    const newSet = new Set(groupedExpandedCategories);
                                                                                    if (isCatExpanded) {
                                                                                        newSet.delete(catKey);
                                                                                    } else {
                                                                                        newSet.add(catKey);
                                                                                    }
                                                                                    setGroupedExpandedCategories(newSet);
                                                                                }}
                                                                                style={{
                                                                                    display: 'flex',
                                                                                    alignItems: 'center',
                                                                                    gap: '10px',
                                                                                    padding: '10px 14px',
                                                                                    background: isCatExpanded ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.02)',
                                                                                    border: `1px solid ${isCatExpanded ? 'rgba(255,255,255,0.1)' : 'rgba(255,255,255,0.05)'}`,
                                                                                    borderRadius: '8px',
                                                                                    cursor: 'pointer',
                                                                                    transition: 'all 0.2s'
                                                                                }}
                                                                            >
                                                                                <span style={{
                                                                                    width: '24px',
                                                                                    height: '24px',
                                                                                    background: 'rgba(255,255,255,0.1)',
                                                                                    color: '#ddd',
                                                                                    borderRadius: '5px',
                                                                                    display: 'flex',
                                                                                    alignItems: 'center',
                                                                                    justifyContent: 'center',
                                                                                    fontSize: '11px',
                                                                                    fontWeight: 700
                                                                                }}>
                                                                                    {catArticles.length}
                                                                                </span>

                                                                                <span style={{ flex: 1, color: '#ccc', fontSize: '14px' }}>
                                                                                    {categoryLabels[category] || category} {t('wiki.count.articles', { count: catArticles.length })}
                                                                                </span>

                                                                                <ChevronDown
                                                                                    size={16}
                                                                                    color="#666"
                                                                                    style={{
                                                                                        transform: isCatExpanded ? 'rotate(180deg)' : 'rotate(0deg)',
                                                                                        transition: 'transform 0.2s'
                                                                                    }}
                                                                                />
                                                                            </div>

                                                                            {/* 文章列表 */}
                                                                            {isCatExpanded && (
                                                                                <div style={{
                                                                                    marginLeft: '34px',
                                                                                    marginTop: '6px',
                                                                                    display: 'flex',
                                                                                    flexDirection: 'column',
                                                                                    gap: '4px'
                                                                                }}>
                                                                                    {(() => {
                                                                                        // IF not manual, render plain list
                                                                                        if (category !== 'Manual') {
                                                                                            return catArticles.map(article => (
                                                                                                <div
                                                                                                    key={article.id}
                                                                                                    onClick={() => handleArticleClick(article)}
                                                                                                    style={{
                                                                                                        padding: '10px 12px',
                                                                                                        background: 'rgba(255,255,255,0.02)',
                                                                                                        borderRadius: '8px',
                                                                                                        cursor: 'pointer',
                                                                                                        transition: 'all 0.15s',
                                                                                                        display: 'flex',
                                                                                                        alignItems: 'center',
                                                                                                        gap: '12px'
                                                                                                    }}
                                                                                                    onMouseEnter={(e) => {
                                                                                                        e.currentTarget.style.background = 'rgba(255,215,0,0.08)';
                                                                                                    }}
                                                                                                    onMouseLeave={(e) => {
                                                                                                        e.currentTarget.style.background = 'rgba(255,255,255,0.02)';
                                                                                                    }}
                                                                                                >
                                                                                                    <FileText size={14} color="#666" />
                                                                                                    <span style={{ fontSize: '13px', color: '#bbb', flex: 1 }}>
                                                                                                        {article.title}
                                                                                                    </span>
                                                                                                    <ChevronRight size={14} color="#444" />
                                                                                                </div>
                                                                                            ));
                                                                                        }

                                                                                        // For Manual, render Chapter Accordions
                                                                                        const chapterGroups = new Map<number, KnowledgeArticle[]>();
                                                                                        const chaptersHaveSubsections = new Set<number>();

                                                                                        catArticles.forEach(a => {
                                                                                            const { chapter, section } = parseChapterNumber(a.title);
                                                                                            if (chapter !== null) {
                                                                                                if (!chapterGroups.has(chapter)) chapterGroups.set(chapter, []);
                                                                                                chapterGroups.get(chapter)!.push(a);
                                                                                                if (section !== null) chaptersHaveSubsections.add(chapter);
                                                                                            } else {
                                                                                                if (!chapterGroups.has(-1)) chapterGroups.set(-1, []);
                                                                                                chapterGroups.get(-1)!.push(a);
                                                                                            }
                                                                                        });

                                                                                        const sortedChapters = Array.from(chapterGroups.entries()).sort((a, b) => a[0] - b[0]);

                                                                                        return sortedChapters.map(([chapterNum, articlesInChapter]) => {
                                                                                            // Sort sections within chapter
                                                                                            articlesInChapter.sort((a, b) => {
                                                                                                const secA = parseChapterNumber(a.title).section || '';
                                                                                                const secB = parseChapterNumber(b.title).section || '';
                                                                                                return secA.localeCompare(secB, undefined, { numeric: true, sensitivity: 'base' });
                                                                                            });

                                                                                            const isAccordion = chaptersHaveSubsections.has(chapterNum) || articlesInChapter.length > 1;
                                                                                            const chapterKey = `${catKey}-chap-${chapterNum}`;
                                                                                            const isChapExpanded = groupedExpandedChapters.has(chapterKey);

                                                                                            // Infer Chapter Title: Try to find the root chapter (section === null)
                                                                                            // If not found, fall back to "Chapter X"
                                                                                            let cleanTitle = '';
                                                                                            const rootChapterArticle = articlesInChapter.find(a => parseChapterNumber(a.title).section === null);
                                                                                            if (rootChapterArticle) {
                                                                                                cleanTitle = parseChapterNumber(rootChapterArticle.title).cleanTitle;
                                                                                            }

                                                                                            // If no subsections (just 1 standalone article or it's a chapter without subdivisions)
                                                                                            if (!isAccordion || chapterNum === -1) {
                                                                                                return articlesInChapter.map(article => (
                                                                                                    <div
                                                                                                        key={article.id}
                                                                                                        onClick={() => handleArticleClick(article)}
                                                                                                        style={{
                                                                                                            padding: '10px 12px',
                                                                                                            background: 'rgba(255,255,255,0.02)',
                                                                                                            borderRadius: '8px',
                                                                                                            cursor: 'pointer',
                                                                                                            transition: 'all 0.15s',
                                                                                                            display: 'flex',
                                                                                                            alignItems: 'center',
                                                                                                            gap: '12px'
                                                                                                        }}
                                                                                                        onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255,215,0,0.08)'}
                                                                                                        onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.02)'}
                                                                                                    >
                                                                                                        <FileText size={14} color="#666" />
                                                                                                        <span style={{ fontSize: '13px', color: '#bbb', flex: 1 }}>
                                                                                                            {article.title}
                                                                                                        </span>
                                                                                                        <ChevronRight size={14} color="#444" />
                                                                                                    </div>
                                                                                                ));
                                                                                            }

                                                                                            // It is an accordion with subsections
                                                                                            return (
                                                                                                <div key={chapterKey}>
                                                                                                    <div
                                                                                                        onClick={() => {
                                                                                                            const newSet = new Set(groupedExpandedChapters);
                                                                                                            if (isChapExpanded) newSet.delete(chapterKey);
                                                                                                            else newSet.add(chapterKey);
                                                                                                            setGroupedExpandedChapters(newSet);
                                                                                                        }}
                                                                                                        style={{
                                                                                                            display: 'flex',
                                                                                                            alignItems: 'center',
                                                                                                            gap: '8px',
                                                                                                            padding: '10px 12px',
                                                                                                            cursor: 'pointer',
                                                                                                            borderBottom: '1px solid rgba(255,255,255,0.04)',
                                                                                                            transition: 'background 0.15s'
                                                                                                        }}
                                                                                                        onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.04)'}
                                                                                                        onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                                                                                                    >
                                                                                                        <ChevronRight
                                                                                                            size={14}
                                                                                                            color="#FFD700"
                                                                                                            style={{
                                                                                                                transform: isChapExpanded ? 'rotate(90deg)' : 'rotate(0deg)',
                                                                                                                transition: 'transform 0.2s ease',
                                                                                                                flexShrink: 0
                                                                                                            }}
                                                                                                        />
                                                                                                        <span style={{ fontSize: '14px', fontWeight: 600, color: '#FFD700', flex: 1 }}>
                                                                                                            {t('wiki.toc.chapter_prefix', { count: chapterNum })}{cleanTitle ? `：${cleanTitle}` : ''}
                                                                                                        </span>
                                                                                                    </div>

                                                                                                    {isChapExpanded && (
                                                                                                        <div style={{ marginLeft: '22px', marginTop: '4px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                                                                                            {articlesInChapter
                                                                                                                .filter(article => parseChapterNumber(article.title).section !== null)
                                                                                                                .map(article => {
                                                                                                                    // If it's the chapter base article itself, skip or render special?
                                                                                                                    // Usually Apple includes the overview as an article. We'll list them all.
                                                                                                                    const { section, cleanTitle: secTitle } = parseChapterNumber(article.title);
                                                                                                                    const displayNum = section ? section : `${chapterNum}`;
                                                                                                                    return (
                                                                                                                        <div
                                                                                                                            key={article.id}
                                                                                                                            onClick={() => handleArticleClick(article)}
                                                                                                                            style={{
                                                                                                                                padding: '8px 12px',
                                                                                                                                background: 'rgba(255,255,255,0.015)',
                                                                                                                                borderRadius: '6px',
                                                                                                                                cursor: 'pointer',
                                                                                                                                transition: 'all 0.15s',
                                                                                                                                display: 'flex',
                                                                                                                                alignItems: 'center',
                                                                                                                                gap: '12px'
                                                                                                                            }}
                                                                                                                            onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255,215,0,0.08)'}
                                                                                                                            onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.015)'}
                                                                                                                        >
                                                                                                                            <span style={{ minWidth: '32px', textAlign: 'center', color: '#999', fontSize: '11px', background: 'rgba(255,255,255,0.05)', padding: '2px 6px', borderRadius: '4px' }}>
                                                                                                                                {displayNum}
                                                                                                                            </span>
                                                                                                                            <span style={{ fontSize: '13px', color: '#ccc', flex: 1 }}>{secTitle}</span>
                                                                                                                        </div>
                                                                                                                    );
                                                                                                                })}
                                                                                                        </div>
                                                                                                    )}
                                                                                                </div>
                                                                                            );
                                                                                        });
                                                                                    })()}
                                                                                </div>
                                                                            )}
                                                                        </div>
                                                                    );
                                                                })}
                                                            </div>
                                                        )}
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                );
                            })()}

                            {/* 最近浏览 - 卡片式 + 可折叠 */}
                            {recentArticles.length > 0 && (
                                <div style={{ marginBottom: '24px' }}>
                                    <div
                                        style={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'space-between',
                                            padding: '12px 0',
                                            userSelect: 'none'
                                        }}
                                    >
                                        <div style={{
                                            fontSize: '13px',
                                            fontWeight: 700,
                                            color: '#888',
                                            textTransform: 'uppercase',
                                            letterSpacing: '1px'
                                        }}>
                                            {t('wiki.recently_viewed')} · {recentArticles.length}
                                        </div>
                                        <div style={{ position: 'relative' }} ref={recentMenuRef}>
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    setShowRecentMenu(!showRecentMenu);
                                                }}
                                                style={{
                                                    background: 'rgba(255,255,255,0.05)',
                                                    border: '1px solid rgba(255,255,255,0.1)',
                                                    color: '#999',
                                                    fontSize: '12px',
                                                    padding: '4px 8px',
                                                    borderRadius: '6px',
                                                    cursor: 'pointer',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    gap: '4px',
                                                    transition: 'all 0.2s'
                                                }}
                                                onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.1)'}
                                                onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.05)'}
                                            >
                                                {t('wiki.settings.preference')} <ChevronDown size={12} />
                                            </button>

                                            {showRecentMenu && (
                                                <div style={{
                                                    position: 'absolute',
                                                    top: '100%',
                                                    right: 0,
                                                    marginTop: '4px',
                                                    background: '#1a1a1a',
                                                    border: '1px solid rgba(255,255,255,0.1)',
                                                    borderRadius: '8px',
                                                    padding: '4px',
                                                    zIndex: 100,
                                                    minWidth: '120px',
                                                    boxShadow: '0 4px 12px rgba(0,0,0,0.5)'
                                                }} onClick={(e) => e.stopPropagation()}>
                                                    <button
                                                        onClick={() => {
                                                            setRecentExpanded(!recentExpanded);
                                                            setShowRecentMenu(false);
                                                        }}
                                                        style={{
                                                            width: '100%',
                                                            padding: '8px 12px',
                                                            background: 'transparent',
                                                            border: 'none',
                                                            color: '#ddd',
                                                            fontSize: '13px',
                                                            textAlign: 'left',
                                                            cursor: 'pointer',
                                                            borderRadius: '4px',
                                                            display: 'flex',
                                                            justifyContent: 'space-between',
                                                            alignItems: 'center'
                                                        }}
                                                        onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.08)'}
                                                        onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                                                    >
                                                        {recentExpanded ? t('wiki.panel.collapse') : t('wiki.panel.expand')}
                                                    </button>
                                                    {recentArticles.length > RECENT_SHOW_COUNT && recentExpanded && (
                                                        <button
                                                            onClick={() => {
                                                                setShowMoreRecent(!showMoreRecent);
                                                                setShowRecentMenu(false);
                                                            }}
                                                            style={{
                                                                width: '100%',
                                                                padding: '8px 12px',
                                                                background: 'transparent',
                                                                border: 'none',
                                                                color: '#ddd',
                                                                fontSize: '13px',
                                                                textAlign: 'left',
                                                                cursor: 'pointer',
                                                                borderRadius: '4px',
                                                                display: 'flex',
                                                                justifyContent: 'space-between',
                                                                alignItems: 'center'
                                                            }}
                                                            onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.08)'}
                                                            onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                                                        >
                                                            {showMoreRecent ? t('common.show_less') : t('common.show_more', { count: recentArticles.length - RECENT_SHOW_COUNT })}
                                                        </button>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    {recentExpanded && (
                                        <div style={{
                                            display: 'grid',
                                            gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
                                            gap: '12px'
                                        }}>
                                            {(showMoreRecent ? recentArticles : recentArticles.slice(0, RECENT_SHOW_COUNT)).map((recent) => {
                                                const article = articles.find(a => a.slug === recent.slug);
                                                if (!article) return null;

                                                return (
                                                    <ArticleCard
                                                        key={recent.slug}
                                                        id={article.id}
                                                        title={article.title}
                                                        summary={article.summary}
                                                        productLine={article.product_line}
                                                        productModels={article.product_models}
                                                        category={article.category}
                                                        onClick={() => handleArticleClick(article)}
                                                        variant="compact"
                                                    />
                                                );
                                            })}
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    ))}
                </div >

                {/* Right Sidebar - TOC Panel (从右侧滑出) */}
                {
                    tocVisible && (
                        <>
                            {/* Overlay */}
                            <div
                                onClick={() => setTocVisible(false)}
                                style={{
                                    position: 'fixed',
                                    top: 0,
                                    left: 0,
                                    right: 0,
                                    bottom: 0,
                                    background: 'rgba(0,0,0,0.6)',
                                    backdropFilter: 'blur(4px)',
                                    zIndex: 998,
                                    animation: 'fadeIn 0.3s cubic-bezier(0.4, 0, 0.2, 1)'
                                }}
                            />

                            {/* TOC Panel - Apple 支持页面风格 */}
                            <div ref={tocPanelRef} style={{
                                position: 'fixed',
                                right: 0,
                                top: 0,
                                bottom: 0,
                                width: '360px',
                                background: '#0a0a0a',
                                borderLeft: '1px solid rgba(255,255,255,0.08)',
                                zIndex: 999,
                                display: 'flex',
                                flexDirection: 'column',
                                animation: 'slideInRight 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                                boxShadow: '-8px 0 24px rgba(0,0,0,0.4)'
                            }}>
                                {/* Header - 左上角关闭按钮 */}
                                <div style={{
                                    padding: '16px 20px',
                                    borderBottom: '1px solid rgba(255,255,255,0.08)',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'space-between'
                                }}>
                                    <button
                                        onClick={() => setTocVisible(false)}
                                        style={{
                                            background: 'rgba(255,255,255,0.08)',
                                            border: 'none',
                                            borderRadius: '50%',
                                            width: '32px',
                                            height: '32px',
                                            cursor: 'pointer',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            transition: 'all 0.2s'
                                        }}
                                        onMouseEnter={(e) => {
                                            e.currentTarget.style.background = 'rgba(255,255,255,0.15)';
                                        }}
                                        onMouseLeave={(e) => {
                                            e.currentTarget.style.background = 'rgba(255,255,255,0.08)';
                                        }}
                                    >
                                        <X size={18} color="#fff" />
                                    </button>
                                </div>

                                {/* 产品名称标题 - Apple 风格 */}
                                <div style={{
                                    padding: '24px 28px 16px',
                                }}>
                                    <h2 style={{
                                        fontSize: '24px',
                                        fontWeight: 700,
                                        color: '#fff',
                                        margin: 0,
                                        marginBottom: '8px'
                                    }}>
                                        Kinefinity
                                    </h2>
                                    <p style={{
                                        fontSize: '13px',
                                        color: '#888',
                                        margin: 0
                                    }}>
                                        {t('wiki.toc_title')}
                                    </p>
                                </div>

                                {/* Search */}
                                <div style={{ padding: '0 20px 16px' }}>
                                    <div style={{ position: 'relative' }}>
                                        <Search size={16} style={{
                                            position: 'absolute',
                                            left: '12px',
                                            top: '50%',
                                            transform: 'translateY(-50%)',
                                            color: '#666'
                                        }} />
                                        <input
                                            type="text"
                                            placeholder={t('wiki.search.placeholder_short')}
                                            value={searchQuery}
                                            onChange={(e) => setSearchQuery(e.target.value)}
                                            style={{
                                                width: '100%',
                                                padding: '10px 12px 10px 38px',
                                                background: 'rgba(255,255,255,0.05)',
                                                border: '1px solid rgba(255,255,255,0.1)',
                                                borderRadius: '10px',
                                                color: '#fff',
                                                fontSize: '14px',
                                                outline: 'none',
                                                transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)'
                                            }}
                                            onFocus={(e) => {
                                                e.currentTarget.style.borderColor = 'rgba(255,215,0,0.4)';
                                                e.currentTarget.style.background = 'rgba(255,255,255,0.08)';
                                            }}
                                            onBlur={(e) => {
                                                e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)';
                                                e.currentTarget.style.background = 'rgba(255,255,255,0.05)';
                                            }}
                                        />
                                    </div>
                                </div>

                                {/* Tree Navigation - Apple 风格列表 */}
                                <div style={{
                                    flex: 1,
                                    overflowY: 'auto',
                                    padding: '0 12px 20px',
                                }}>
                                    {tree.map(node => renderTreeNode(node))}
                                </div>
                            </div>
                        </>
                    )
                }

                <style>{`
                @keyframes fadeIn {
                    from { opacity: 0; }
                    to { opacity: 1; }
                }
                @keyframes slideInRight {
                    from { transform: translateX(100%); }
                    to { transform: translateX(0); }
                }
                @keyframes expandSearch {
                    from { width: 40px; opacity: 0.5; }
                    to { width: 280px; opacity: 1; }
                }
            `}</style>

                {/* Wiki Editor Modal */}
                <WikiEditorModal
                    isOpen={showEditorModal}
                    onClose={() => setShowEditorModal(false)}
                    article={selectedArticle as any}
                    onSaved={() => {
                        // Reload article detail to get complete updated data
                        if (selectedArticle) {
                            loadArticleDetail(selectedArticle);
                        }
                    }}
                />

                {/* 知识导入弹窗 */}
                <KnowledgeGenerator
                    isOpen={showKnowledgeImport}
                    onClose={() => setShowKnowledgeImport(false)}
                />

                {/* 文章管理弹窗 */}
                {
                    showArticleManager && (
                        <div style={{
                            position: 'fixed',
                            top: 0,
                            left: 0,
                            right: 0,
                            bottom: 0,
                            background: 'rgba(0,0,0,0.7)',
                            backdropFilter: 'blur(8px)',
                            WebkitBackdropFilter: 'blur(8px)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            zIndex: 1000,
                            animation: 'fadeIn 0.2s ease-out'
                        }}>
                            <div style={{
                                background: 'linear-gradient(145deg, #2a2a2a 0%, #1e1e1e 100%)',
                                border: '1px solid rgba(255,255,255,0.1)',
                                borderRadius: '20px',
                                width: '90%',
                                maxWidth: '900px',
                                maxHeight: '80vh',
                                display: 'flex',
                                flexDirection: 'column',
                                boxShadow: '0 20px 60px rgba(0,0,0,0.5)'
                            }}>
                                {/* 头部 */}
                                <div style={{
                                    padding: '24px 32px',
                                    borderBottom: '1px solid rgba(255,255,255,0.08)',
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    alignItems: 'center'
                                }}>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                        <h2 style={{ fontSize: '24px', fontWeight: 700, color: '#fff', margin: 0 }}>
                                            {t('wiki.manage_articles')}
                                        </h2>
                                        <p style={{ fontSize: '14px', color: '#888', margin: 0, fontWeight: 400 }}>
                                            {t('wiki.manage.stats', { total: manageArticles.length, selected: selectedArticleIds.size })}
                                        </p>
                                    </div>
                                    <button
                                        onClick={() => setShowArticleManager(false)}
                                        style={{
                                            width: '40px',
                                            height: '40px',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            background: 'rgba(255,255,255,0.08)',
                                            border: 'none',
                                            borderRadius: '50%',
                                            cursor: 'pointer',
                                            color: '#fff',
                                            transition: 'all 0.2s'
                                        }}
                                        onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.15)'; }}
                                        onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.08)'; }}
                                    >
                                        <X size={22} />
                                    </button>

                                </div>

                                {/* 操作栏 */}
                                <div style={{
                                    padding: '12px 24px',
                                    borderBottom: '1px solid rgba(255,255,255,0.06)',
                                    display: 'flex',
                                    gap: '12px',
                                    alignItems: 'center'
                                }}>
                                    {/* 搜索框 */}
                                    <div style={{
                                        flex: 1,
                                        position: 'relative'
                                    }}>
                                        <Search size={16} color="#666" style={{
                                            position: 'absolute',
                                            left: '12px',
                                            top: '50%',
                                            transform: 'translateY(-50%)'
                                        }} />
                                        <input
                                            type="text"
                                            placeholder={t('wiki.manage.search_placeholder')}
                                            value={managerSearchQuery}
                                            onChange={(e) => setManagerSearchQuery(e.target.value)}
                                            style={{
                                                width: '100%',
                                                padding: '8px 12px 8px 36px',
                                                background: 'rgba(255,255,255,0.05)',
                                                border: '1px solid rgba(255,255,255,0.1)',
                                                borderRadius: '8px',
                                                color: '#fff',
                                                fontSize: '13px',
                                                outline: 'none'
                                            }}
                                        />
                                    </div>

                                    {/* 全选复选框 */}
                                    <button
                                        onClick={() => {
                                            if (selectedArticleIds.size === manageArticles.length) {
                                                setSelectedArticleIds(new Set());
                                            } else {
                                                setSelectedArticleIds(new Set(manageArticles.map(a => a.id)));
                                            }
                                        }}
                                        style={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '8px',
                                            padding: '8px 14px',
                                            background: 'rgba(255,255,255,0.05)',
                                            border: '1px solid rgba(255,255,255,0.1)',
                                            borderRadius: '8px',
                                            color: '#ccc',
                                            fontSize: '13px',
                                            cursor: 'pointer'
                                        }}
                                    >
                                        <div style={{
                                            width: '16px',
                                            height: '16px',
                                            border: `2px solid ${selectedArticleIds.size === manageArticles.length ? '#FFD700' : '#666'}`,
                                            borderRadius: '4px',
                                            background: selectedArticleIds.size === manageArticles.length ? 'rgba(255,215,0,0.2)' : 'transparent',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center'
                                        }}>
                                            {selectedArticleIds.size === manageArticles.length && <Check size={12} color="#FFD700" />}
                                        </div>
                                        {t('common.select_all')}
                                    </button>

                                    {/* 批量删除 */}
                                    {selectedArticleIds.size > 0 && (
                                        <button
                                            onClick={async () => {
                                                const confirmed = await confirm(
                                                    t('wiki.manage.delete_confirm', { count: selectedArticleIds.size }),
                                                    t('wiki.manage.delete_batch'),
                                                    t('common.confirm_delete'),
                                                    t('action.cancel')
                                                );
                                                if (!confirmed) return;

                                                setIsDeleting(true);
                                                const headers = { Authorization: `Bearer ${token}` };
                                                const idsToDelete = Array.from(selectedArticleIds);
                                                let successCount = 0;

                                                for (const id of idsToDelete) {
                                                    try {
                                                        await axios.delete(`/api/v1/knowledge/${id}`, { headers });
                                                        successCount++;
                                                    } catch (err) {
                                                        console.error(`Failed to delete article ${id}:`, err);
                                                    }
                                                }

                                                // 刷新列表
                                                await fetchArticles();
                                                setManageArticles(prev => prev.filter(a => !selectedArticleIds.has(a.id)));
                                                setSelectedArticleIds(new Set());
                                                setIsDeleting(false);
                                            }}
                                            disabled={isDeleting}
                                            style={{
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: '6px',
                                                padding: '8px 14px',
                                                background: 'rgba(255,68,68,0.15)',
                                                border: '1px solid rgba(255,68,68,0.3)',
                                                borderRadius: '8px',
                                                color: '#ff6b6b',
                                                fontSize: '13px',
                                                cursor: isDeleting ? 'not-allowed' : 'pointer',
                                                opacity: isDeleting ? 0.6 : 1
                                            }}
                                        >
                                            <Trash2 size={14} />
                                            {isDeleting ? t('common.deleting') : t('wiki.manage.delete_selected', { count: selectedArticleIds.size })}
                                        </button>
                                    )}
                                </div>

                                {/* 文章列表 */}
                                <div style={{
                                    flex: 1,
                                    overflowY: 'auto',
                                    padding: '12px 24px'
                                }}>
                                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                        <thead>
                                            <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
                                                <th style={{ width: '40px', padding: '12px 8px', textAlign: 'left' }}></th>
                                                <th
                                                    style={{ padding: '12px 8px', textAlign: 'left', color: '#888', fontSize: '12px', fontWeight: 500, cursor: 'pointer', userSelect: 'none' }}
                                                    onClick={() => setManagerSort(prev => ({ field: 'title', order: prev?.field === 'title' && prev?.order === 'asc' ? 'desc' : 'asc' }))}
                                                >
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                        {t('wiki.manage.column.title')}
                                                        {managerSort?.field === 'title' && (
                                                            managerSort?.order === 'asc' ? <ChevronUp size={14} /> : <ChevronDown size={14} />
                                                        )}
                                                    </div>
                                                </th>
                                                <th
                                                    style={{ width: '80px', padding: '12px 8px', textAlign: 'left', color: '#888', fontSize: '12px', fontWeight: 500, cursor: 'pointer', userSelect: 'none' }}
                                                    onClick={() => setManagerSort(prev => ({ field: 'product_line', order: prev?.field === 'product_line' && prev?.order === 'asc' ? 'desc' : 'asc' }))}
                                                >
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                        {t('wiki.manage.column.product_line')}
                                                        {managerSort?.field === 'product_line' && (
                                                            managerSort?.order === 'asc' ? <ChevronUp size={14} /> : <ChevronDown size={14} />
                                                        )}
                                                    </div>
                                                </th>
                                                <th
                                                    style={{ width: '120px', padding: '12px 8px', textAlign: 'left', color: '#888', fontSize: '12px', fontWeight: 500, cursor: 'pointer', userSelect: 'none' }}
                                                    onClick={() => setManagerSort(prev => ({ field: 'product_model', order: prev?.field === 'product_model' && prev?.order === 'asc' ? 'desc' : 'asc' }))}
                                                >
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                        {t('wiki.manage.column.product_model')}
                                                        {managerSort?.field === 'product_model' && (
                                                            managerSort?.order === 'asc' ? <ChevronUp size={14} /> : <ChevronDown size={14} />
                                                        )}
                                                    </div>
                                                </th>
                                                <th
                                                    style={{ width: '100px', padding: '12px 8px', textAlign: 'left', color: '#888', fontSize: '12px', fontWeight: 500, cursor: 'pointer', userSelect: 'none' }}
                                                    onClick={() => setManagerSort(prev => ({ field: 'category', order: prev?.field === 'category' && prev?.order === 'asc' ? 'desc' : 'asc' }))}
                                                >
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                        {t('wiki.manage.column.category')}
                                                        {managerSort?.field === 'category' && (
                                                            managerSort?.order === 'asc' ? <ChevronUp size={14} /> : <ChevronDown size={14} />
                                                        )}
                                                    </div>
                                                </th>
                                                <th style={{ width: '80px', padding: '12px 8px', textAlign: 'center', color: '#888', fontSize: '12px', fontWeight: 500 }}>{t('common.actions')}</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {manageArticles
                                                .filter(article => {
                                                    if (managerSearchQuery.trim() === '') return true;
                                                    const query = managerSearchQuery.toLowerCase();
                                                    // 搜索标题
                                                    if (article.title.toLowerCase().includes(query)) return true;
                                                    // 搜索分类
                                                    if (article.category?.toLowerCase().includes(query)) return true;
                                                    // 搜索产品线
                                                    if (article.product_line?.toLowerCase().includes(query)) return true;
                                                    // 搜索产品型号
                                                    const models = Array.isArray(article.product_models)
                                                        ? article.product_models.join(' ')
                                                        : article.product_models || '';
                                                    if (models.toLowerCase().includes(query)) return true;
                                                    return false;
                                                })
                                                .sort((a, b) => {
                                                    if (!managerSort) return 0;
                                                    const { field, order } = managerSort;
                                                    let valA: string, valB: string;

                                                    if (field === 'product_model') {
                                                        valA = (Array.isArray(a.product_models) ? a.product_models[0] : a.product_models) || '';
                                                        valB = (Array.isArray(b.product_models) ? b.product_models[0] : b.product_models) || '';
                                                    } else {
                                                        valA = (a[field] || '') as string;
                                                        valB = (b[field] || '') as string;
                                                    }

                                                    const comparison = valA.localeCompare(valB, 'zh-CN');
                                                    return order === 'asc' ? comparison : -comparison;
                                                })
                                                .map(article => {
                                                    const isSelected = selectedArticleIds.has(article.id);
                                                    const lineLabels: Record<string, string> = {
                                                        'A': t('wiki.line.a'),
                                                        'B': t('wiki.line.b'),
                                                        'C': t('wiki.line.c'),
                                                        'D': t('wiki.line.d')
                                                    };

                                                    return (
                                                        <tr
                                                            key={article.id}
                                                            style={{
                                                                borderBottom: '1px solid rgba(255,255,255,0.04)',
                                                                background: isSelected ? 'rgba(255,215,0,0.05)' : 'transparent'
                                                            }}
                                                        >
                                                            <td style={{ padding: '12px 8px' }}>
                                                                <button
                                                                    onClick={() => {
                                                                        const newSet = new Set(selectedArticleIds);
                                                                        if (isSelected) {
                                                                            newSet.delete(article.id);
                                                                        } else {
                                                                            newSet.add(article.id);
                                                                        }
                                                                        setSelectedArticleIds(newSet);
                                                                    }}
                                                                    style={{
                                                                        width: '18px',
                                                                        height: '18px',
                                                                        border: `2px solid ${isSelected ? '#FFD700' : '#555'}`,
                                                                        borderRadius: '4px',
                                                                        background: isSelected ? 'rgba(255,215,0,0.2)' : 'transparent',
                                                                        cursor: 'pointer',
                                                                        display: 'flex',
                                                                        alignItems: 'center',
                                                                        justifyContent: 'center'
                                                                    }}
                                                                >
                                                                    {isSelected && <Check size={12} color="#FFD700" />}
                                                                </button>
                                                            </td>
                                                            <td style={{ padding: '12px 8px' }}>
                                                                <div style={{ color: '#fff', fontSize: '14px', lineHeight: 1.4 }}>
                                                                    {article.title}
                                                                </div>
                                                            </td>
                                                            <td style={{ padding: '12px 8px' }}>
                                                                <span style={{
                                                                    padding: '4px 8px',
                                                                    background: 'rgba(255,215,0,0.1)',
                                                                    borderRadius: '6px',
                                                                    color: '#FFD700',
                                                                    fontSize: '12px'
                                                                }}>
                                                                    {lineLabels[article.product_line] || article.product_line}
                                                                </span>
                                                            </td>
                                                            <td style={{ padding: '12px 8px', color: '#ccc', fontSize: '13px' }}>
                                                                {Array.isArray(article.product_models)
                                                                    ? article.product_models[0]
                                                                    : article.product_models || '-'}
                                                            </td>
                                                            <td style={{ padding: '12px 8px', color: '#888', fontSize: '13px' }}>
                                                                {article.category}
                                                            </td>
                                                            <td style={{ padding: '12px 8px', textAlign: 'center' }}>
                                                                <button
                                                                    onClick={async () => {
                                                                        const confirmed = await confirm(
                                                                            t('wiki.manage.delete_single_confirm', { title: article.title }),
                                                                            t('wiki.manage.delete_article'),
                                                                            t('common.confirm_delete'),
                                                                            t('action.cancel')
                                                                        );
                                                                        if (!confirmed) return;

                                                                        try {
                                                                            const headers = { Authorization: `Bearer ${token}` };
                                                                            await axios.delete(`/api/v1/knowledge/${article.id}`, { headers });
                                                                            await fetchArticles();
                                                                            setManageArticles(prev => prev.filter(a => a.id !== article.id));
                                                                        } catch (err) {
                                                                            console.error('Delete article failed:', err);
                                                                        }
                                                                    }}
                                                                    style={{
                                                                        padding: '6px 10px',
                                                                        background: 'transparent',
                                                                        border: '1px solid rgba(255,68,68,0.3)',
                                                                        borderRadius: '6px',
                                                                        color: '#ff6b6b',
                                                                        fontSize: '12px',
                                                                        cursor: 'pointer',
                                                                        transition: 'all 0.15s'
                                                                    }}
                                                                    onMouseEnter={(e) => {
                                                                        e.currentTarget.style.background = 'rgba(255,68,68,0.15)';
                                                                    }}
                                                                    onMouseLeave={(e) => {
                                                                        e.currentTarget.style.background = 'transparent';
                                                                    }}
                                                                >
                                                                    <Trash2 size={12} />
                                                                </button>
                                                            </td>
                                                        </tr>
                                                    );
                                                })}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>
                    )
                }

                {/* 手册目录弹窗 */}
                {
                    showManualTocModal && selectedArticle?.category === 'Manual' && (() => {
                        const model = Array.isArray(selectedArticle.product_models)
                            ? selectedArticle.product_models[0]
                            : selectedArticle.product_models;
                        const manualArticles = articles.filter(a =>
                            a.product_line === selectedArticle.product_line &&
                            a.category === 'Manual' &&
                            (Array.isArray(a.product_models) ? a.product_models.includes(model) : a.product_models === model)
                        ).sort((a, b) => {
                            const secA = parseChapterNumber(a.title);
                            const secB = parseChapterNumber(b.title);
                            const chapterDiff = (secA.chapter || 9999) - (secB.chapter || 9999);
                            if (chapterDiff !== 0) return chapterDiff;
                            return (secA.section || '').localeCompare(secB.section || '', undefined, { numeric: true, sensitivity: 'base' });
                        });

                        // 分类标签映射
                        const categoryLabels: Record<string, string> = {
                            'Manual': t('wiki.category.manual'),
                            'Troubleshooting': t('wiki.category.troubleshooting'),
                            'FAQ': t('wiki.category.faq')
                        };
                        const categoryLabel = categoryLabels[selectedArticle.category] || selectedArticle.category;

                        return (
                            <div style={{
                                position: 'fixed',
                                top: 0,
                                left: 0,
                                right: 0,
                                bottom: 0,
                                background: 'rgba(0,0,0,0.85)',
                                backdropFilter: 'blur(8px)',
                                WebkitBackdropFilter: 'blur(8px)',
                                zIndex: 1000,
                                animation: 'fadeIn 0.2s ease-out',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                padding: '40px'
                            }}>
                                {/* 弹窗内容 - 宽度约2/3 */}
                                <div style={{
                                    width: '90%',
                                    maxWidth: '900px',
                                    height: '80vh',
                                    maxHeight: '800px',
                                    background: 'linear-gradient(145deg, #1e1e1e 0%, #181818 100%)',
                                    border: '1px solid rgba(255,255,255,0.08)',
                                    borderRadius: '16px',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    overflow: 'hidden',
                                    boxShadow: '0 24px 80px rgba(0,0,0,0.6)'
                                }}>
                                    {/* 顶部标题栏 */}
                                    <div style={{
                                        padding: '24px 32px',
                                        borderBottom: '1px solid rgba(255,255,255,0.08)',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'space-between'
                                    }}>

                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                            <h2 style={{
                                                fontSize: '24px',
                                                fontWeight: 700,
                                                color: '#fff',
                                                margin: 0
                                            }}>
                                                {model} · {categoryLabel}
                                            </h2>
                                            <p style={{
                                                fontSize: '14px',
                                                color: '#888',
                                                margin: 0,
                                                fontWeight: 400
                                            }}>
                                                {t('wiki.toc.stats', { count: manualArticles.length })}
                                            </p>
                                        </div>

                                        <button
                                            onClick={() => setShowManualTocModal(false)}
                                            style={{
                                                background: 'rgba(255,255,255,0.08)',
                                                border: 'none',
                                                borderRadius: '50%',
                                                width: '40px',
                                                height: '40px',
                                                cursor: 'pointer',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                transition: 'all 0.2s'
                                            }}
                                            onMouseEnter={(e) => {
                                                e.currentTarget.style.background = 'rgba(255,255,255,0.15)';
                                            }}
                                            onMouseLeave={(e) => {
                                                e.currentTarget.style.background = 'rgba(255,255,255,0.08)';
                                            }}
                                        >
                                            <X size={22} color="#fff" />
                                        </button>
                                    </div>

                                    {/* 章节列表 */}
                                    <div style={{
                                        flex: 1,
                                        overflowY: 'auto',
                                        padding: '24px 32px'
                                    }}>
                                        <div style={{
                                            display: 'flex',
                                            flexDirection: 'column',
                                            gap: '8px'
                                        }}>
                                            {(() => {
                                                const chapterGroups = new Map<number, KnowledgeArticle[]>();
                                                const chaptersHaveSubsections = new Set<number>();

                                                manualArticles.forEach(a => {
                                                    const { chapter, section } = parseChapterNumber(a.title);
                                                    if (chapter !== null) {
                                                        if (!chapterGroups.has(chapter)) chapterGroups.set(chapter, []);
                                                        chapterGroups.get(chapter)!.push(a);
                                                        if (section !== null) chaptersHaveSubsections.add(chapter);
                                                    } else {
                                                        if (!chapterGroups.has(-1)) chapterGroups.set(-1, []);
                                                        chapterGroups.get(-1)!.push(a);
                                                    }
                                                });

                                                const sortedChapters = Array.from(chapterGroups.entries()).sort((a, b) => a[0] - b[0]);

                                                return sortedChapters.map(([chapterNum, articlesInChapter]) => {
                                                    articlesInChapter.sort((a, b) => {
                                                        const secA = parseChapterNumber(a.title).section || '';
                                                        const secB = parseChapterNumber(b.title).section || '';
                                                        return secA.localeCompare(secB, undefined, { numeric: true, sensitivity: 'base' });
                                                    });

                                                    const _isAccordion = chaptersHaveSubsections.has(chapterNum) || articlesInChapter.length > 1;

                                                    const chapterKey = `modal-chap-${chapterNum}`;
                                                    const isCurrentChapter = articlesInChapter.some(a => a.id === selectedArticle.id);

                                                    // Default to expanded if it contains the current article, unless explicitly collapsed
                                                    // For simplicity, we just use the set to track explicitly TOGGLED states.
                                                    // Actually, let's just make everything collapsed by default and toggle with state, 
                                                    // BUT if it's the current chapter we auto-expand unless it's in a collapsed tracking set.
                                                    // To keep it clean: just use expandedModalChapters.
                                                    const isChapExpanded = expandedModalChapters.has(chapterKey) || isCurrentChapter;

                                                    if (!_isAccordion) {
                                                        return articlesInChapter.map(article => {
                                                            const isCurrentArticle = article.id === selectedArticle.id;
                                                            const { chapter, section, cleanTitle } = parseChapterNumber(article.title);
                                                            const displayNum = section ? section : chapter?.toString() || '';

                                                            return (
                                                                <div
                                                                    key={article.id}
                                                                    onClick={() => {
                                                                        if (!isCurrentArticle) {
                                                                            setShowManualTocModal(false);
                                                                            handleArticleClick(article);
                                                                        }
                                                                    }}
                                                                    style={{
                                                                        padding: '14px 18px',
                                                                        background: isCurrentArticle ? 'rgba(255,215,0,0.1)' : 'rgba(255,255,255,0.02)',
                                                                        border: `1px solid ${isCurrentArticle ? 'rgba(255,215,0,0.3)' : 'rgba(255,255,255,0.05)'}`,
                                                                        borderRadius: '12px',
                                                                        cursor: isCurrentArticle ? 'default' : 'pointer',
                                                                        display: 'flex',
                                                                        alignItems: 'center',
                                                                        gap: '16px',
                                                                        transition: 'all 0.15s'
                                                                    }}
                                                                    onMouseEnter={(e) => {
                                                                        if (!isCurrentArticle) { e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; e.currentTarget.style.borderColor = 'rgba(255,215,0,0.15)'; }
                                                                    }}
                                                                    onMouseLeave={(e) => {
                                                                        if (!isCurrentArticle) { e.currentTarget.style.background = 'rgba(255,255,255,0.02)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.05)'; }
                                                                    }}
                                                                >
                                                                    {displayNum && (
                                                                        <span style={{ minWidth: '44px', padding: '6px 10px', background: isCurrentArticle ? 'rgba(255,215,0,0.2)' : 'rgba(255,215,0,0.1)', borderRadius: '8px', fontSize: '13px', fontWeight: 600, color: '#FFD700', textAlign: 'center' }}>
                                                                            {displayNum}
                                                                        </span>
                                                                    )}
                                                                    <span style={{ fontSize: '15px', fontWeight: isCurrentArticle ? 600 : 400, color: isCurrentArticle ? '#FFD700' : '#ccc', flex: 1 }}>{cleanTitle}</span>
                                                                    {isCurrentArticle && <span style={{ fontSize: '12px', color: '#FFD700', padding: '4px 10px', background: 'rgba(255,215,0,0.1)', borderRadius: '10px' }}>{t('wiki.status.current')}</span>}
                                                                </div>
                                                            );
                                                        });
                                                    }

                                                    // It's a grouped accordion

                                                    let chapCleanTitle = '';
                                                    const rootChapterArticle = articlesInChapter.find(a => parseChapterNumber(a.title).section === null);
                                                    if (rootChapterArticle) {
                                                        chapCleanTitle = parseChapterNumber(rootChapterArticle.title).cleanTitle;
                                                    }

                                                    return (
                                                        <div key={chapterKey} style={{
                                                            background: 'rgba(255,255,255,0.02)',
                                                            border: '1px solid rgba(255,255,255,0.05)',
                                                            borderRadius: '12px',
                                                            overflow: 'hidden'
                                                        }}>
                                                            {/* Accordion Header */}
                                                            <div
                                                                onClick={() => {
                                                                    const newSet = new Set(expandedModalChapters);
                                                                    if (expandedModalChapters.has(chapterKey)) {
                                                                        newSet.delete(chapterKey);
                                                                        // If it was auto-expanded due to isCurrentChapter, we need to artificially track it so it closes.
                                                                        // Actually, standard behavior: just track toggles.
                                                                    } else {
                                                                        newSet.add(chapterKey);
                                                                    }
                                                                    // If isCurrentChapter is true and it's NOT in the set, clicking should COLLAPSE it.
                                                                    // To do that robustly: 
                                                                    if (isCurrentChapter && !expandedModalChapters.has(chapterKey)) {
                                                                        newSet.add('collapsed-' + chapterKey);
                                                                    }
                                                                    if (isCurrentChapter && expandedModalChapters.has('collapsed-' + chapterKey)) {
                                                                        newSet.delete('collapsed-' + chapterKey);
                                                                    }

                                                                    setExpandedModalChapters(newSet);
                                                                }}
                                                                style={{
                                                                    padding: '14px 18px',
                                                                    display: 'flex',
                                                                    alignItems: 'center',
                                                                    gap: '12px',
                                                                    cursor: 'pointer',
                                                                    background: isChapExpanded ? 'rgba(255,255,255,0.04)' : 'transparent',
                                                                    transition: 'background 0.15s'
                                                                }}
                                                                onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.06)'}
                                                                onMouseLeave={(e) => e.currentTarget.style.background = isChapExpanded ? 'rgba(255,255,255,0.04)' : 'transparent'}
                                                            >
                                                                <ChevronRight
                                                                    size={18}
                                                                    color="#FFD700"
                                                                    style={{
                                                                        transform: (isCurrentChapter && !expandedModalChapters.has('collapsed-' + chapterKey)) || expandedModalChapters.has(chapterKey) ? 'rotate(90deg)' : 'rotate(0deg)',
                                                                        transition: 'transform 0.2s ease',
                                                                        flexShrink: 0
                                                                    }}
                                                                />
                                                                <span style={{ fontSize: '15px', fontWeight: 600, color: '#FFD700', flex: 1 }}>
                                                                    {t('wiki.toc.chapter_prefix', { count: chapterNum })}{chapCleanTitle ? `：${chapCleanTitle}` : ''}
                                                                </span>
                                                            </div>

                                                            {/* Accordion Body */}
                                                            {((isCurrentChapter && !expandedModalChapters.has('collapsed-' + chapterKey)) || expandedModalChapters.has(chapterKey)) && (
                                                                <div style={{ padding: '8px 18px 14px 48px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                                                    {articlesInChapter
                                                                        .filter(article => parseChapterNumber(article.title).section !== null)
                                                                        .map(article => {
                                                                            const isCurrentArticle = article.id === selectedArticle.id;
                                                                            const { section, cleanTitle: secTitle } = parseChapterNumber(article.title);
                                                                            const displayNum = section ? section : `${chapterNum}`;

                                                                            return (
                                                                                <div
                                                                                    key={article.id}
                                                                                    onClick={() => {
                                                                                        if (!isCurrentArticle) {
                                                                                            setShowManualTocModal(false);
                                                                                            handleArticleClick(article);
                                                                                        }
                                                                                    }}
                                                                                    style={{
                                                                                        padding: '10px 14px',
                                                                                        background: isCurrentArticle ? 'rgba(255,215,0,0.1)' : 'transparent',
                                                                                        borderRadius: '8px',
                                                                                        cursor: isCurrentArticle ? 'default' : 'pointer',
                                                                                        display: 'flex',
                                                                                        alignItems: 'center',
                                                                                        gap: '12px',
                                                                                        transition: 'all 0.15s'
                                                                                    }}
                                                                                    onMouseEnter={(e) => { if (!isCurrentArticle) e.currentTarget.style.background = 'rgba(255,255,255,0.04)'; }}
                                                                                    onMouseLeave={(e) => { if (!isCurrentArticle) e.currentTarget.style.background = 'transparent'; }}
                                                                                >
                                                                                    <span style={{ minWidth: '36px', textAlign: 'center', color: isCurrentArticle ? '#FFD700' : '#888', fontSize: '12px', background: isCurrentArticle ? 'rgba(255,215,0,0.15)' : 'rgba(255,255,255,0.05)', padding: '3px 8px', borderRadius: '6px' }}>
                                                                                        {displayNum}
                                                                                    </span>
                                                                                    <span style={{ fontSize: '14px', fontWeight: isCurrentArticle ? 600 : 400, color: isCurrentArticle ? '#FFD700' : '#bbb', flex: 1 }}>{secTitle}</span>
                                                                                    {isCurrentArticle && <span style={{ fontSize: '11px', color: '#FFD700', padding: '2px 8px', background: 'rgba(255,215,0,0.1)', borderRadius: '10px' }}>{t('wiki.status.current')}</span>}
                                                                                </div>
                                                                            );
                                                                        })}
                                                                </div>
                                                            )}
                                                        </div>
                                                    );
                                                });
                                            })()}
                                        </div>

                                        {/* 动态底部提示 - 当章节较少时填充空白 */}
                                        <div style={{
                                            marginTop: 'auto',
                                            padding: '24px 0 8px',
                                            borderTop: '1px solid rgba(255,255,255,0.04)',
                                            display: 'flex',
                                            flexDirection: 'column',
                                            gap: '12px'
                                        }}>
                                            <div style={{ fontSize: '11px', color: '#555', textTransform: 'uppercase', letterSpacing: '1.5px', fontWeight: 600 }}>
                                                {t('wiki.toc.tips_title')}
                                            </div>
                                            <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                                                {[
                                                    { icon: '📖', text: t('wiki.toc.tip_click') },
                                                    { icon: '🔍', text: t('wiki.toc.tip_search') },
                                                    { icon: '📑', text: t('wiki.toc.tip_bookmark') }
                                                ].map((tip, i) => (
                                                    <div key={i} style={{
                                                        flex: '1 1 200px',
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        gap: '8px',
                                                        padding: '10px 14px',
                                                        background: 'rgba(255,255,255,0.02)',
                                                        borderRadius: '10px',
                                                        border: '1px solid rgba(255,255,255,0.04)',
                                                        fontSize: '12px',
                                                        color: '#666',
                                                        lineHeight: '1.4'
                                                    }}>
                                                        <span style={{ fontSize: '16px', flexShrink: 0 }}>{tip.icon}</span>
                                                        {tip.text}
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        );
                    })()
                }
            </div >
            <SynonymManager isOpen={showSynonymManager} onClose={() => setShowSynonymManager(false)} />
        </>
    );
};
