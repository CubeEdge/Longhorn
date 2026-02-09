import React, { useState, useEffect } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import axios from 'axios';
import { useAuthStore } from '../store/useAuthStore';
import { ChevronRight, ChevronDown, ChevronLeft, Search, BookOpen, List, X, ThumbsUp, ThumbsDown } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';

interface KnowledgeArticle {
    id: number;
    title: string;
    slug: string;
    summary: string;
    content: string;
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
}

export const KinefinityWiki: React.FC = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const { slug } = useParams<{ slug: string }>();
    const { token } = useAuthStore();

    const [articles, setArticles] = useState<KnowledgeArticle[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [expandedNodes, setExpandedNodes] = useState<Set<string>>(() => {
        const saved = localStorage.getItem('wiki-expanded-nodes');
        return saved ? new Set(JSON.parse(saved)) : new Set(['a-camera']);
    });
    const [selectedArticle, setSelectedArticle] = useState<KnowledgeArticle | null>(null);
    const [tocVisible, setTocVisible] = useState(false); // 目录可见性
    const [breadcrumbPath, setBreadcrumbPath] = useState<BreadcrumbItem[]>([]);
    const [navigationHistory, setNavigationHistory] = useState<string[]>([]);

    // Build tree structure from articles
    const buildTree = (): CategoryNode[] => {
        const productModels = {
            'A': ['MAVO Edge 8K', 'MAVO Edge 6K', 'MAVO Mark2 LF', 'MAVO Mark2 S35'],
            'B': ['MAVO LF', 'MAVO S35', 'Terra 4K', 'Terra 6K'],
            'C': ['Eagle SDI', 'Eagle HDMI'],
            'D': ['GripBAT系列', 'Magic Arm', 'Dark Tower', 'KineBAT', '线缆配件']
        };

        const categoryTemplates: Record<string, Array<{id: string, label: string}>> = {
            'A': [{ id: 'manual', label: '操作手册' }],
            'B': [{ id: 'manual', label: '操作手册' }],
            'C': [{ id: 'manual', label: '操作手册' }],
            'D': [{ id: 'manual', label: '使用指南' }]
        };

        const parseChapterNumber = (title: string): { chapter: number | null, section: number | null, cleanTitle: string } => {
            const match = title.match(/:\s*(\d+)(?:\.(\d+))?(?:\.\d+)*[.\s]+(.+)/);
            if (match) {
                const chapter = parseInt(match[1]);
                const section = match[2] ? parseInt(match[2]) : null;
                const cleanTitle = match[3].trim();
                return { chapter, section, cleanTitle };
            }
            return { chapter: null, section: null, cleanTitle: title };
        };

        const buildChapterTree = (articles: KnowledgeArticle[], parentId: string): CategoryNode[] => {
            const chapterMap = new Map<number, { node: CategoryNode, sections: KnowledgeArticle[] }>();

            articles.forEach(article => {
                const { chapter } = parseChapterNumber(article.title);
                if (chapter !== null) {
                    if (!chapterMap.has(chapter)) {
                        chapterMap.set(chapter, {
                            node: {
                                id: `${parentId}-chapter-${chapter}`,
                                label: `第${chapter}章`,
                                children: [],
                                articles: []
                            },
                            sections: []
                        });
                    }
                    chapterMap.get(chapter)!.sections.push(article);
                }
            });

            const result: CategoryNode[] = [];
            Array.from(chapterMap.entries())
                .sort((a, b) => a[0] - b[0])
                .forEach(([chapterNum, { node, sections }]) => {
                    if (sections.length === 1) {
                        const { cleanTitle } = parseChapterNumber(sections[0].title);
                        node.label = `第${chapterNum}章：${cleanTitle}`;
                        node.articles = sections;
                        node.children = undefined;
                    } else {
                        node.articles = sections;
                        const chapterArticle = sections.find(s => parseChapterNumber(s.title).section === null);
                        const chapterTitle = chapterArticle 
                            ? parseChapterNumber(chapterArticle.title).cleanTitle 
                            : parseChapterNumber(sections[0].title).cleanTitle;
                        node.label = `第${chapterNum}章：${chapterTitle}`;
                    }
                    result.push(node);
                });

            return result;
        };

        const tree: CategoryNode[] = [
            { id: 'a-camera', label: 'A类：在售电影摄影机', product_line: 'A', children: [] },
            { id: 'b-camera', label: 'B类：历史机型', product_line: 'B', children: [] },
            { id: 'c-evf', label: 'C类：电子寻像器', product_line: 'C', children: [] },
            { id: 'd-accessory', label: 'D类：通用配件', product_line: 'D', children: [] },
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

    useEffect(() => {
        if (slug && articles.length > 0) {
            const article = articles.find(a => a.slug === slug);
            if (article) {
                loadArticleDetail(article);
                buildBreadcrumb(article);
            }
        } else if (!slug) {
            const lastSlug = localStorage.getItem('wiki-last-article');
            if (lastSlug && articles.length > 0) {
                const article = articles.find(a => a.slug === lastSlug);
                if (article) {
                    setSelectedArticle(article);
                    buildBreadcrumb(article);
                }
            }
        }
    }, [slug, articles]);

    useEffect(() => {
        localStorage.setItem('wiki-expanded-nodes', JSON.stringify(Array.from(expandedNodes)));
    }, [expandedNodes]);

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
            { label: 'WIKI', articleSlug: undefined }
        ];

        const lineLabels: Record<string, string> = {
            'A': 'A类',
            'B': 'B类',
            'C': 'C类',
            'D': 'D类'
        };
        if (article.product_line && lineLabels[article.product_line]) {
            crumbs.push({ label: lineLabels[article.product_line] });
        }

        if (article.product_models && article.product_models.length > 0) {
            const model = Array.isArray(article.product_models) ? article.product_models[0] : article.product_models;
            crumbs.push({ label: model });
        }

        if (article.category) {
            const categoryLabels: Record<string, string> = {
                'Manual': '操作手册',
                'Troubleshooting': '故障排查',
                'FAQ': '常见问题'
            };
            crumbs.push({ label: categoryLabels[article.category] || article.category });
        }

        crumbs.push({ label: article.title, articleSlug: article.slug });

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
                setSelectedArticle(res.data.data);
            } else {
                setSelectedArticle(article);
            }
        } catch (err) {
            console.error('[WIKI] Failed to load article detail:', err);
            setSelectedArticle(article);
        }
    };

    const handleArticleClick = async (article: KnowledgeArticle) => {
        // 保存当前路径到历史
        if (location.pathname && location.pathname !== `/tech-hub/wiki/${article.slug}`) {
            setNavigationHistory(prev => [...prev, location.pathname]);
        }

        navigate(`/tech-hub/wiki/${article.slug}`);
        localStorage.setItem('wiki-last-article', article.slug);
        await loadArticleDetail(article);
        buildBreadcrumb(article);
        
        // 关闭TOC
        setTocVisible(false);
    };

    const handleHomeClick = () => {
        // 保存当前路径到历史
        if (location.pathname && location.pathname !== '/tech-hub/wiki') {
            setNavigationHistory(prev => [...prev, location.pathname]);
        }
        
        setSelectedArticle(null);
        setBreadcrumbPath([]);
        navigate('/tech-hub/wiki');
        localStorage.removeItem('wiki-last-article');
    };

    const handleBreadcrumbClick = (index: number) => {
        const crumb = breadcrumbPath[index];
        if (crumb.articleSlug) {
            const article = articles.find(a => a.slug === crumb.articleSlug);
            if (article) {
                handleArticleClick(article);
            }
        } else if (index === 0) {
            handleHomeClick();
        }
    };

    const handleBackClick = () => {
        if (navigationHistory.length > 0) {
            const previousPath = navigationHistory[navigationHistory.length - 1];
            setNavigationHistory(prev => prev.slice(0, -1));
            navigate(previousPath);
        } else {
            handleHomeClick();
        }
    };

    const renderTreeNode = (node: CategoryNode, level: number = 0) => {
        const isExpanded = expandedNodes.has(node.id);
        const hasChildren = node.children && node.children.length > 0;
        const hasArticles = node.articles && node.articles.length > 0;
        const isClickable = hasChildren || hasArticles;

        return (
            <div key={node.id} style={{ marginLeft: level * 0 }}>
                <div
                    onClick={() => isClickable && toggleNode(node.id)}
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        padding: '10px 16px',
                        cursor: isClickable ? 'pointer' : 'default',
                        borderRadius: '10px',
                        transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                        background: isExpanded ? 'rgba(255,215,0,0.08)' : 'transparent',
                    }}
                    onMouseEnter={(e) => {
                        if (isClickable && !isExpanded) {
                            e.currentTarget.style.background = 'rgba(255,255,255,0.03)';
                        }
                    }}
                    onMouseLeave={(e) => {
                        if (!isExpanded) {
                            e.currentTarget.style.background = 'transparent';
                        }
                    }}
                >
                    {isClickable && (
                        isExpanded ? 
                            <ChevronDown size={18} color="#FFD700" style={{ transition: 'transform 0.2s' }} /> : 
                            <ChevronRight size={18} color="#999" style={{ transition: 'transform 0.2s' }} />
                    )}
                    <span style={{ 
                        fontSize: level === 0 ? '15px' : '14px',
                        fontWeight: level === 0 ? 600 : 400,
                        color: level === 0 ? '#fff' : '#ccc',
                        flex: 1
                    }}>
                        {node.label}
                    </span>
                    {hasArticles && node.articles && (
                        <span style={{ 
                            fontSize: '11px', 
                            color: '#999',
                            background: 'rgba(255,255,255,0.05)',
                            padding: '2px 8px',
                            borderRadius: '12px'
                        }}>
                            {node.articles.length}
                        </span>
                    )}
                </div>

                {isExpanded && hasChildren && (
                    <div style={{ marginLeft: '20px', marginTop: '4px' }}>
                        {node.children!.map(child => renderTreeNode(child, level + 1))}
                    </div>
                )}

                {isExpanded && hasArticles && (
                    <div style={{ marginLeft: '26px', marginTop: '4px' }}>
                        {node.articles!.map(article => (
                            <div
                                key={article.id}
                                onClick={() => handleArticleClick(article)}
                                style={{
                                    padding: '8px 12px',
                                    cursor: 'pointer',
                                    borderRadius: '8px',
                                    background: selectedArticle?.id === article.id ? 'rgba(255,215,0,0.1)' : 'transparent',
                                    borderLeft: selectedArticle?.id === article.id ? '2px solid #FFD700' : '2px solid transparent',
                                    transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                                    marginBottom: '2px'
                                }}
                                onMouseEnter={(e) => {
                                    if (selectedArticle?.id !== article.id) {
                                        e.currentTarget.style.background = 'rgba(255,255,255,0.03)';
                                    }
                                }}
                                onMouseLeave={(e) => {
                                    if (selectedArticle?.id !== article.id) {
                                        e.currentTarget.style.background = 'transparent';
                                    }
                                }}
                            >
                                <div style={{ 
                                    fontSize: '13px', 
                                    color: selectedArticle?.id === article.id ? '#FFD700' : '#aaa',
                                    lineHeight: '1.5'
                                }}>
                                    {article.title}
                                </div>
                            </div>
                        ))}
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
                    <div style={{ fontSize: '16px', color: '#999' }}>正在加载知识库...</div>
                </div>
            </div>
        );
    }

    return (
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
                        {/* Top Bar with Breadcrumb and TOC Toggle */}
                        <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '16px',
                            marginBottom: '32px',
                            paddingBottom: '20px',
                            borderBottom: '1px solid rgba(255,255,255,0.06)'
                        }}>
                            {/* Back Button - 始终显示 */}
                            <button
                                onClick={handleBackClick}
                                style={{
                                    background: 'rgba(255,255,255,0.05)',
                                    border: '1px solid rgba(255,255,255,0.08)',
                                    borderRadius: '10px',
                                    padding: '8px',
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)'
                                }}
                                onMouseEnter={(e) => {
                                    e.currentTarget.style.background = 'rgba(255,255,255,0.1)';
                                }}
                                onMouseLeave={(e) => {
                                    e.currentTarget.style.background = 'rgba(255,255,255,0.05)';
                                }}
                            >
                                <ChevronLeft size={20} color="#999" />
                            </button>

                            {/* Breadcrumb */}
                            <div style={{ 
                                display: 'flex', 
                                alignItems: 'center', 
                                gap: '8px',
                                flex: 1,
                                fontSize: '13px',
                                color: '#666',
                                overflowX: 'auto',
                                whiteSpace: 'nowrap'
                            }}>
                                {breadcrumbPath.map((crumb, index) => {
                                    const isLast = index === breadcrumbPath.length - 1;
                                    const isClickable = index < breadcrumbPath.length - 1;
                                    
                                    return (
                                        <React.Fragment key={index}>
                                            {index > 0 && <ChevronRight size={14} color="#444" />}
                                            <span
                                                onClick={() => isClickable && handleBreadcrumbClick(index)}
                                                style={{
                                                    color: isLast ? '#FFD700' : '#999',
                                                    cursor: isClickable ? 'pointer' : 'default',
                                                    fontWeight: isLast ? 600 : 400,
                                                    transition: 'color 0.2s',
                                                    maxWidth: '200px',
                                                    overflow: 'hidden',
                                                    textOverflow: 'ellipsis'
                                                }}
                                                onMouseEnter={(e) => {
                                                    if (isClickable) e.currentTarget.style.color = '#FFD700';
                                                }}
                                                onMouseLeave={(e) => {
                                                    if (isClickable) e.currentTarget.style.color = '#999';
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
                                onClick={() => setTocVisible(!tocVisible)}
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
                        <h1 style={{ 
                            fontSize: '32px', 
                            fontWeight: 700, 
                            color: '#fff',
                            marginBottom: '12px',
                            lineHeight: '1.3'
                        }}>
                            {selectedArticle.title}
                        </h1>

                        {/* Article Summary */}
                        {selectedArticle.summary && (
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
                                {selectedArticle.summary}
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
                                    h1: ({node, ...props}) => <h1 style={{fontSize: '28px', fontWeight: 700, color: '#fff', marginTop: '32px', marginBottom: '16px', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '12px'}} {...props} />,
                                    h2: ({node, ...props}) => <h2 style={{fontSize: '24px', fontWeight: 600, color: '#fff', marginTop: '28px', marginBottom: '14px'}} {...props} />,
                                    h3: ({node, ...props}) => <h3 style={{fontSize: '20px', fontWeight: 600, color: '#FFD700', marginTop: '24px', marginBottom: '12px'}} {...props} />,
                                    h4: ({node, ...props}) => <h4 style={{fontSize: '17px', fontWeight: 500, color: '#FFD700', marginTop: '20px', marginBottom: '10px'}} {...props} />,
                                    p: ({node, ...props}) => <p style={{marginBottom: '16px', lineHeight: '1.8'}} {...props} />,
                                    ul: ({node, ...props}) => <ul style={{marginLeft: '20px', marginBottom: '16px', listStyleType: 'disc'}} {...props} />,
                                    ol: ({node, ...props}) => <ol style={{marginLeft: '20px', marginBottom: '16px'}} {...props} />,
                                    li: ({node, ...props}) => <li style={{marginBottom: '8px', lineHeight: '1.6'}} {...props} />,
                                    code: ({node, inline, ...props}: any) => inline 
                                        ? <code style={{background: 'rgba(255,215,0,0.1)', padding: '2px 6px', borderRadius: '6px', fontSize: '13px', color: '#FFD700'}} {...props} />
                                        : <code style={{display: 'block', background: 'rgba(0,0,0,0.4)', padding: '16px', borderRadius: '10px', overflow: 'auto', fontSize: '13px', marginBottom: '16px', border: '1px solid rgba(255,255,255,0.08)'}} {...props} />,
                                    img: ({node, ...props}) => (
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
                                    table: ({node, ...props}) => (
                                        <div style={{overflowX: 'auto', marginBottom: '20px', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.08)'}}>
                                            <table style={{width: '100%', borderCollapse: 'collapse'}} {...props} />
                                        </div>
                                    ),
                                    th: ({node, ...props}) => <th style={{padding: '12px', background: 'rgba(255,255,255,0.03)', borderBottom: '1px solid rgba(255,255,255,0.08)', textAlign: 'left', fontWeight: 600, fontSize: '13px'}} {...props} />,
                                    td: ({node, ...props}) => <td style={{padding: '12px', borderBottom: '1px solid rgba(255,255,255,0.05)', fontSize: '13px'}} {...props} />,
                                    blockquote: ({node, ...props}) => (
                                        <blockquote style={{
                                            borderLeft: '3px solid #FFD700',
                                            paddingLeft: '20px',
                                            marginLeft: '0',
                                            marginBottom: '20px',
                                            color: '#999',
                                            fontStyle: 'italic'
                                        }} {...props} />
                                    ),
                                    a: ({node, ...props}) => <a style={{color: '#FFD700', textDecoration: 'none', borderBottom: '1px solid rgba(255,215,0,0.3)'}} {...props} />,
                                    hr: ({node, ...props}) => <hr style={{border: 'none', borderTop: '1px solid rgba(255,255,255,0.08)', marginTop: '32px', marginBottom: '32px'}} {...props} />,
                                }}
                            >
                                {selectedArticle.content || '暂无内容'}
                            </ReactMarkdown>
                        </div>

                        {/* Feedback Section */}
                        <div style={{ 
                            marginTop: '48px',
                            paddingTop: '32px',
                            borderTop: '1px solid rgba(255,255,255,0.06)',
                            textAlign: 'center'
                        }}>
                            <div style={{ fontSize: '14px', color: '#999', marginBottom: '16px' }}>
                                这篇文章对您有帮助吗？
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
                                    <span>有帮助 ({selectedArticle.helpful_count})</span>
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
                                    <span>需要改进 ({selectedArticle.not_helpful_count})</span>
                                </button>
                            </div>
                        </div>
                    </div>
                ) : (
                    // Welcome View
                    <div style={{ 
                        maxWidth: '800px', 
                        margin: '0 auto', 
                        padding: '80px 32px',
                        textAlign: 'center'
                    }}>
                        <BookOpen size={64} color="#FFD700" style={{ marginBottom: '24px' }} />
                        <h1 style={{ 
                            fontSize: '36px', 
                            fontWeight: 700, 
                            color: '#fff',
                            marginBottom: '16px'
                        }}>
                            欢迎使用 Kinefinity WIKI
                        </h1>
                        <p style={{ 
                            fontSize: '16px', 
                            color: '#999',
                            marginBottom: '48px',
                            lineHeight: '1.6'
                        }}>
                            这里汇集了 Kinefinity 全系列产品的技术文档、故障排查指南和常见问题解答。<br />
                            点击右上角目录按钮开始探索。
                        </p>

                        <div style={{ 
                            display: 'grid', 
                            gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', 
                            gap: '20px',
                            marginTop: '48px',
                            textAlign: 'left'
                        }}>
                            {[
                                { title: 'A类：在售电影摄影机', desc: 'MAVO Edge系列、Mark2等现役机型的完整技术文档和使用指南', emoji: '🎥' },
                                { title: 'B类：历史机型', desc: 'MAVO LF、Terra、MAVO S35等经典机型的存档文档', emoji: '📼' },
                                { title: 'C类：电子寻像器', desc: 'Eagle系列监视器的使用指南和兼容性信息', emoji: '🔍' },
                                { title: 'D类：通用配件', desc: 'GripBAT、Magic Arm等跨代配件的使用说明', emoji: '🔧' }
                            ].map((item, idx) => (
                                <div key={idx} style={{
                                    background: 'rgba(255,255,255,0.02)',
                                    border: '1px solid rgba(255,255,255,0.06)',
                                    borderRadius: '16px',
                                    padding: '24px',
                                    transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                                    cursor: 'pointer'
                                }}
                                onClick={() => setTocVisible(true)}
                                onMouseEnter={(e) => {
                                    e.currentTarget.style.background = 'rgba(255,255,255,0.04)';
                                    e.currentTarget.style.borderColor = 'rgba(255,215,0,0.3)';
                                    e.currentTarget.style.transform = 'translateY(-4px)';
                                }}
                                onMouseLeave={(e) => {
                                    e.currentTarget.style.background = 'rgba(255,255,255,0.02)';
                                    e.currentTarget.style.borderColor = 'rgba(255,255,255,0.06)';
                                    e.currentTarget.style.transform = 'translateY(0)';
                                }}
                                >
                                    <div style={{ fontSize: '32px', marginBottom: '12px' }}>{item.emoji}</div>
                                    <h3 style={{ fontSize: '16px', fontWeight: 600, color: '#fff', marginBottom: '8px' }}>
                                        {item.title}
                                    </h3>
                                    <p style={{ fontSize: '13px', color: '#999', lineHeight: '1.6', margin: 0 }}>
                                        {item.desc}
                                    </p>
                                </div>
                            ))}
                        </div>

                        {/* 主页也显示TOC按钮 */}
                        <button
                            onClick={() => setTocVisible(true)}
                            style={{
                                position: 'fixed',
                                top: '80px',
                                right: '40px',
                                background: 'rgba(255,215,0,0.1)',
                                border: '1px solid rgba(255,215,0,0.3)',
                                borderRadius: '50%',
                                width: '48px',
                                height: '48px',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                                boxShadow: '0 4px 12px rgba(255,215,0,0.2)'
                            }}
                            onMouseEnter={(e) => {
                                e.currentTarget.style.background = 'rgba(255,215,0,0.2)';
                                e.currentTarget.style.transform = 'scale(1.1)';
                            }}
                            onMouseLeave={(e) => {
                                e.currentTarget.style.background = 'rgba(255,215,0,0.1)';
                                e.currentTarget.style.transform = 'scale(1)';
                            }}
                        >
                            <List size={24} color="#FFD700" />
                        </button>
                    </div>
                )}
            </div>

            {/* Right Sidebar - TOC Panel (从右侧滑出) */}
            {tocVisible && (
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

                    {/* TOC Panel */}
                    <div style={{
                        position: 'fixed',
                        right: 0,
                        top: 0,
                        bottom: 0,
                        width: '320px',
                        background: 'rgba(0,0,0,0.95)',
                        backdropFilter: 'blur(20px) saturate(180%)',
                        WebkitBackdropFilter: 'blur(20px) saturate(180%)',
                        borderLeft: '1px solid rgba(255,255,255,0.06)',
                        zIndex: 999,
                        display: 'flex',
                        flexDirection: 'column',
                        animation: 'slideInRight 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                        boxShadow: '-8px 0 24px rgba(0,0,0,0.4)'
                    }}>
                        {/* Header */}
                        <div style={{ 
                            padding: '20px',
                            borderBottom: '1px solid rgba(255,255,255,0.06)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between'
                        }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                <BookOpen size={22} color="#FFD700" />
                                <h2 style={{ 
                                    fontSize: '18px', 
                                    fontWeight: 700, 
                                    color: '#fff',
                                    margin: 0
                                }}>
                                    目录
                                </h2>
                            </div>
                            <button
                                onClick={() => setTocVisible(false)}
                                style={{
                                    background: 'transparent',
                                    border: 'none',
                                    cursor: 'pointer',
                                    padding: '4px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    transition: 'transform 0.2s'
                                }}
                                onMouseEnter={(e) => {
                                    e.currentTarget.style.transform = 'scale(1.1)';
                                }}
                                onMouseLeave={(e) => {
                                    e.currentTarget.style.transform = 'scale(1)';
                                }}
                            >
                                <X size={20} color="#999" />
                            </button>
                        </div>

                        {/* Search */}
                        <div style={{ padding: '16px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
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
                                    placeholder="搜索..."
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    style={{
                                        width: '100%',
                                        padding: '10px 12px 10px 38px',
                                        background: 'rgba(255,255,255,0.03)',
                                        border: '1px solid rgba(255,255,255,0.08)',
                                        borderRadius: '10px',
                                        color: '#fff',
                                        fontSize: '13px',
                                        outline: 'none',
                                        transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)'
                                    }}
                                    onFocus={(e) => {
                                        e.currentTarget.style.borderColor = 'rgba(255,215,0,0.3)';
                                        e.currentTarget.style.background = 'rgba(255,255,255,0.05)';
                                    }}
                                    onBlur={(e) => {
                                        e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)';
                                        e.currentTarget.style.background = 'rgba(255,255,255,0.03)';
                                    }}
                                />
                            </div>
                        </div>

                        {/* Tree Navigation */}
                        <div style={{ 
                            flex: 1, 
                            overflowY: 'auto', 
                            padding: '12px 8px',
                        }}>
                            {tree.map(node => renderTreeNode(node))}
                        </div>
                    </div>
                </>
            )}

            <style>{`
                @keyframes fadeIn {
                    from { opacity: 0; }
                    to { opacity: 1; }
                }
                @keyframes slideInRight {
                    from { transform: translateX(100%); }
                    to { transform: translateX(0); }
                }
            `}</style>
        </div>
    );
};
