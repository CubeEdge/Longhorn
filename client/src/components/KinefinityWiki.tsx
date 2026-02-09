import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import axios from 'axios';
import { useAuthStore } from '../store/useAuthStore';
import { ChevronRight, ChevronDown, Search, Home, BookOpen } from 'lucide-react';
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
    icon: string;
    children?: CategoryNode[];
    articles?: KnowledgeArticle[];
    product_line?: string;
    product_model?: string; // 新增：产品型号
    category?: string;
}

export const KinefinityWiki: React.FC = () => {
    const navigate = useNavigate();
    const { slug } = useParams<{ slug: string }>();
    const { token } = useAuthStore();

    const [articles, setArticles] = useState<KnowledgeArticle[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [expandedNodes, setExpandedNodes] = useState<Set<string>>(() => {
        // 从 localStorage 恢复展开状态
        const saved = localStorage.getItem('wiki-expanded-nodes');
        return saved ? new Set(JSON.parse(saved)) : new Set(['a-camera']);
    });
    const [selectedArticle, setSelectedArticle] = useState<KnowledgeArticle | null>(null);

    // Build tree structure from articles
    const buildTree = (): CategoryNode[] => {
        // 定义产品型号映射
        const productModels = {
            'A': ['MAVO Edge 8K', 'MAVO Edge 6K', 'MAVO Mark2 LF', 'MAVO Mark2 S35'],
            'B': ['MAVO LF', 'MAVO S35', 'Terra 4K', 'Terra 6K'],
            'C': ['Eagle SDI', 'Eagle HDMI'],
            'D': ['GripBAT系列', 'Magic Arm', 'Dark Tower', 'KineBAT', '线缆配件']
        };

        // 定义分类映射
        const categoryTemplates: Record<string, Array<{id: string, label: string, icon: string}>> = {
            'A': [
                { id: 'manual', label: '操作手册', icon: '📖' },
            ],
            'B': [
                { id: 'manual', label: '操作手册', icon: '📖' },
            ],
            'C': [
                { id: 'manual', label: '操作手册', icon: '📖' },
            ],
            'D': [
                { id: 'manual', label: '使用指南', icon: '📖' },
            ]
        };

        // 解析章节编号（如 "1. 基本说明", "1.1 端口说明", "2.5.1 KineMAG Nano基本说明" 等）
        const parseChapterNumber = (title: string): { chapter: number | null, section: number | null, cleanTitle: string } => {
            // 匹配格式："MAVO Edge 6K: 1. 基本说明" 或 "MAVO Edge 6K: 1.1 端口说明"
            // 注意：section可以有多级（如2.5.1），但我们只取前两级
            // 正则解释：
            // :\s* - 冒号+可选空格
            // (\d+) - 章节号（第一级）
            // (?:\.(\d+))? - 可选的小节号（第二级）
            // (?:\.\d+)* - 忽略第三级及以上
            // [.\s]+ - 点号或空格（至少一个）
            // (.+) - 标题内容
            const match = title.match(/:\s*(\d+)(?:\.(\d+))?(?:\.\d+)*[.\s]+(.+)/);
            if (match) {
                const chapter = parseInt(match[1]);
                const section = match[2] ? parseInt(match[2]) : null;
                const cleanTitle = match[3].trim();
                return { chapter, section, cleanTitle };
            }
            return { chapter: null, section: null, cleanTitle: title };
        };

        // 构建章节树
        const buildChapterTree = (
            articles: KnowledgeArticle[], 
            parentId: string
        ): CategoryNode[] => {
            const chapterMap = new Map<number, { node: CategoryNode, sections: KnowledgeArticle[] }>();

            // 第一轮：分类文章
            articles.forEach(article => {
                const { chapter } = parseChapterNumber(article.title);
                
                if (chapter !== null) {
                    if (!chapterMap.has(chapter)) {
                        chapterMap.set(chapter, {
                            node: {
                                id: `${parentId}-chapter-${chapter}`,
                                label: `第${chapter}章`,
                                icon: '📗',
                                children: [],
                                articles: []
                            },
                            sections: []
                        });
                    }
                    chapterMap.get(chapter)!.sections.push(article);
                }
            });

            // 第二轮：构建章节节点
            const result: CategoryNode[] = [];
            
            // 添加章节节点
            Array.from(chapterMap.entries())
                .sort((a, b) => a[0] - b[0]) // 按章节号排序
                .forEach(([chapterNum, { node, sections }]) => {
                    // 如果章下只有一篇文章，直接显示
                    if (sections.length === 1) {
                        const { cleanTitle } = parseChapterNumber(sections[0].title);
                        node.label = `第${chapterNum}章：${cleanTitle}`;
                        node.articles = sections;
                        node.children = undefined;
                    } else {
                        // 多篇文章，显示章节
                        node.articles = sections;
                        // 查找章节主标题（section为null的文章，如"1. 基本说明"）
                        const chapterArticle = sections.find(s => parseChapterNumber(s.title).section === null);
                        const chapterTitle = chapterArticle 
                            ? parseChapterNumber(chapterArticle.title).cleanTitle 
                            : parseChapterNumber(sections[0].title).cleanTitle;
                        node.label = `第${chapterNum}章：${chapterTitle} (${sections.length})`;
                    }
                    result.push(node);
                });

            return result;
        };

        const tree: CategoryNode[] = [
            {
                id: 'a-camera',
                label: 'A类：在售电影摄影机',
                icon: '🎥',
                product_line: 'A',
                children: []
            },
            {
                id: 'b-camera',
                label: 'B类：历史机型',
                icon: '📼',
                product_line: 'B',
                children: []
            },
            {
                id: 'c-evf',
                label: 'C类：电子寻像器',
                icon: '🔍',
                product_line: 'C',
                children: []
            },
            {
                id: 'd-accessory',
                label: 'D类：通用配件',
                icon: '🔧',
                product_line: 'D',
                children: []
            },
        ];

        // 为每个产品线动态构建产品型号层级
        tree.forEach(productLineNode => {
            const line = productLineNode.product_line!;
            const models = productModels[line as keyof typeof productModels] || [];
            
            models.forEach(model => {
                const modelNode: CategoryNode = {
                    id: `${line.toLowerCase()}-${model.replace(/\s+/g, '-').toLowerCase()}`,
                    label: model,
                    icon: '📱',
                    product_line: line,
                    product_model: model,
                    children: []
                };

                // 为每个产品型号添加分类节点
                const templates = categoryTemplates[line] || [];
                templates.forEach(template => {
                    // 过滤该产品型号+分类的文章
                    const categoryArticles = articles.filter(a => {
                        const matchesLine = a.product_line === line;
                        const matchesCategory = a.category.toLowerCase() === template.id.toLowerCase();
                                        
                        // 兼容 product_models 可能是字符串或数组
                        let matchesModel = false;
                        const productModels: any = a.product_models;
                        if (Array.isArray(productModels)) {
                            matchesModel = productModels.includes(model);
                        } else if (typeof productModels === 'string') {
                            matchesModel = productModels === model || productModels.includes(model);
                        }
                                        
                        // 调试：详细过滤信息
                        if (template.id === 'manual' && a.category === 'Manual') {
                            console.log(`[WIKI Filter] 文章: ${a.title.substring(0, 30)}`, {
                                matchesLine, // 应该为 true
                                matchesCategory, // 应该为 true
                                matchesModel, // 应该为 true
                                line,
                                'a.product_line': a.product_line,
                                model,
                                'a.product_models': a.product_models,
                                'product_models_type': typeof productModels,
                                'isArray': Array.isArray(productModels),
                                'template.id': template.id,
                                'a.category': a.category
                            });
                        }
                                        
                        return matchesLine && matchesCategory && matchesModel;
                    });
                
                    if (categoryArticles.length === 0) return;

                    // 如果是操作手册，按章节分组
                    if (template.id === 'manual') {
                        const chapterGroups = buildChapterTree(categoryArticles, modelNode.id);
                        // 创建“操作手册”节点，包含所有章节
                        const manualNode: CategoryNode = {
                            id: `${modelNode.id}-${template.id}`,
                            label: template.label,
                            icon: template.icon,
                            product_line: line,
                            product_model: model,
                            category: 'Manual',
                            children: chapterGroups  // 章节作为子节点
                        };
                        modelNode.children!.push(manualNode);
                    } else {
                        // 其他分类直接列出文章
                        const categoryNode: CategoryNode = {
                            id: `${modelNode.id}-${template.id}`,
                            label: template.label,
                            icon: template.icon,
                            product_line: line,
                            product_model: model,
                            category: template.id.charAt(0).toUpperCase() + template.id.slice(1),
                            articles: categoryArticles
                        };
                        modelNode.children!.push(categoryNode);
                    }
                });

                // 只添加有分类的产品型号节点
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
            }
        } else if (!slug) {
            // 没有 slug 时，尝试从 localStorage 恢复上次浏览的文章
            const lastSlug = localStorage.getItem('wiki-last-article');
            if (lastSlug && articles.length > 0) {
                const article = articles.find(a => a.slug === lastSlug);
                if (article) {
                    // 静默恢复，不更新 URL（避免强制跳转）
                    setSelectedArticle(article);
                }
            }
        }
    }, [slug, articles]);

    // 保存展开状态到 localStorage
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
            const articles = res.data.data || [];
            
            // 调试：检查Manual文章数据
            const manualArticles = articles.filter((a: KnowledgeArticle) => a.category === 'Manual');
            console.log(`[WIKI] 获取到 ${articles.length} 篇文章，其中 ${manualArticles.length} 篇Manual`);
            if (manualArticles.length > 0) {
                const sample = manualArticles[0];
                console.log('[WIKI] Manual示例:', {
                    title: sample.title,
                    product_line: sample.product_line,
                    product_models: sample.product_models,
                    product_models_type: typeof sample.product_models,
                    product_models_isArray: Array.isArray(sample.product_models)
                });
            }
            
            setArticles(articles);
        } catch (err: any) {
            console.error('[WIKI] Failed to fetch articles:', err);
        } finally {
            setLoading(false);
        }
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
        // 加载完整文章内容
        try {
            const headers = token ? { Authorization: `Bearer ${token}` } : {};
            const res = await axios.get(`/api/v1/knowledge/${article.slug}`, { headers });
            if (res.data.success) {
                setSelectedArticle(res.data.data);
            } else {
                // 如果详情接口失败，使用列表数据
                setSelectedArticle(article);
            }
        } catch (err) {
            console.error('[WIKI] Failed to load article detail:', err);
            // 失败时使用列表数据
            setSelectedArticle(article);
        }
    };

    const handleArticleClick = async (article: KnowledgeArticle) => {
        // 更新 URL 并保存到 localStorage
        navigate(`/tech-hub/wiki/${article.slug}`);
        localStorage.setItem('wiki-last-article', article.slug);
        
        // 加载文章详情
        await loadArticleDetail(article);
    };

    const handleHomeClick = () => {
        setSelectedArticle(null);
        navigate('/tech-hub/wiki');
        // 清除 localStorage 中的上次文章记录
        localStorage.removeItem('wiki-last-article');
    };

    const renderTreeNode = (node: CategoryNode, level: number = 0) => {
        const isExpanded = expandedNodes.has(node.id);
        const hasChildren = node.children && node.children.length > 0;
        const hasArticles = node.articles && node.articles.length > 0;
        const isClickable = hasChildren || hasArticles; // 有子节点或文章都可点击

        return (
            <div key={node.id} style={{ marginLeft: level * 0 }}>
                {/* Node header */}
                <div
                    onClick={() => isClickable && toggleNode(node.id)}
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        padding: '8px 12px',
                        cursor: isClickable ? 'pointer' : 'default',
                        borderRadius: '6px',
                        transition: 'all 0.2s',
                        background: isExpanded ? 'rgba(255,215,0,0.08)' : 'transparent',
                    }}
                    onMouseEnter={(e) => {
                        if (isClickable) {
                            e.currentTarget.style.background = 'rgba(255,255,255,0.05)';
                        }
                    }}
                    onMouseLeave={(e) => {
                        e.currentTarget.style.background = isExpanded ? 'rgba(255,215,0,0.08)' : 'transparent';
                    }}
                >
                    {isClickable && (
                        isExpanded ? <ChevronDown size={16} color="#FFD700" /> : <ChevronRight size={16} color="#999" />
                    )}
                    <span style={{ fontSize: '18px' }}>{node.icon}</span>
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
                            fontSize: '12px', 
                            color: '#666',
                            background: 'rgba(255,255,255,0.05)',
                            padding: '2px 8px',
                            borderRadius: '10px'
                        }}>
                            {node.articles.length}
                        </span>
                    )}
                </div>

                {/* Children */}
                {isExpanded && hasChildren && (
                    <div style={{ marginLeft: '24px', marginTop: '4px' }}>
                        {node.children!.map(child => renderTreeNode(child, level + 1))}
                    </div>
                )}

                {/* Articles */}
                {isExpanded && hasArticles && (
                    <div style={{ marginLeft: '24px', marginTop: '4px' }}>
                        {node.articles!.map(article => (
                            <div
                                key={article.id}
                                onClick={() => handleArticleClick(article)}
                                style={{
                                    padding: '6px 12px',
                                    cursor: 'pointer',
                                    borderRadius: '6px',
                                    background: selectedArticle?.id === article.id ? 'rgba(0,255,255,0.1)' : 'transparent',
                                    borderLeft: selectedArticle?.id === article.id ? '3px solid #0ff' : '3px solid transparent',
                                    transition: 'all 0.2s',
                                    marginBottom: '2px'
                                }}
                                onMouseEnter={(e) => {
                                    if (selectedArticle?.id !== article.id) {
                                        e.currentTarget.style.background = 'rgba(255,255,255,0.05)';
                                    }
                                }}
                                onMouseLeave={(e) => {
                                    if (selectedArticle?.id !== article.id) {
                                        e.currentTarget.style.background = 'transparent';
                                    }
                                }}
                            >
                                <div style={{ fontSize: '14px', color: selectedArticle?.id === article.id ? '#0ff' : '#aaa' }}>
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
                color: '#999' 
            }}>
                <div style={{ textAlign: 'center' }}>
                    <BookOpen size={48} style={{ marginBottom: '16px', color: '#FFD700' }} />
                    <div style={{ fontSize: '16px' }}>正在加载知识库...</div>
                </div>
            </div>
        );
    }

    return (
        <div style={{ 
            display: 'flex', 
            height: 'calc(100vh - 60px)', 
            background: '#0a0a0a',
            overflow: 'hidden'
        }}>
            {/* Left Sidebar - Table of Contents */}
            <div style={{
                width: '320px',
                borderRight: '1px solid #222',
                background: '#111',
                display: 'flex',
                flexDirection: 'column',
                overflow: 'hidden'
            }}>
                {/* Header */}
                <div style={{ 
                    padding: '20px',
                    borderBottom: '1px solid #222'
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
                        <BookOpen size={24} color="#FFD700" />
                        <h1 style={{ 
                            fontSize: '20px', 
                            fontWeight: 700, 
                            color: '#fff',
                            margin: 0
                        }}>
                            Kinefinity WIKI
                        </h1>
                    </div>
                    <p style={{ 
                        color: '#666', 
                        fontSize: '13px',
                        margin: 0
                    }}>
                        技术百科·产品知识库
                    </p>
                </div>

                {/* Search */}
                <div style={{ padding: '16px', borderBottom: '1px solid #222' }}>
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
                            placeholder="搜索知识库..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            style={{
                                width: '100%',
                                padding: '10px 12px 10px 38px',
                                background: '#0a0a0a',
                                border: '1px solid #333',
                                borderRadius: '8px',
                                color: '#fff',
                                fontSize: '14px',
                                outline: 'none',
                            }}
                            onFocus={(e) => e.currentTarget.style.borderColor = '#FFD700'}
                            onBlur={(e) => e.currentTarget.style.borderColor = '#333'}
                        />
                    </div>
                </div>

                {/* Tree Navigation */}
                <div style={{ 
                    flex: 1, 
                    overflowY: 'auto', 
                    padding: '16px 8px',
                }}>
                    {tree.map(node => renderTreeNode(node))}
                </div>
            </div>

            {/* Right Content Area */}
            <div style={{ 
                flex: 1, 
                overflow: 'auto',
                background: '#0a0a0a'
            }}>
                {selectedArticle ? (
                    // Article View
                    <div style={{ maxWidth: '900px', margin: '0 auto', padding: '40px' }}>
                        {/* Breadcrumb */}
                        <div style={{ 
                            display: 'flex', 
                            alignItems: 'center', 
                            gap: '8px',
                            marginBottom: '24px',
                            fontSize: '13px',
                            color: '#666'
                        }}>
                            <Home size={14} style={{ cursor: 'pointer' }} onClick={handleHomeClick} />
                            <ChevronRight size={14} />
                            <span>{selectedArticle.product_line}类</span>
                            <ChevronRight size={14} />
                            <span>{selectedArticle.category}</span>
                            <ChevronRight size={14} />
                            <span style={{ color: '#FFD700' }}>{selectedArticle.title}</span>
                        </div>

                        {/* Article Header */}
                        <h1 style={{ 
                            fontSize: '36px', 
                            fontWeight: 700, 
                            color: '#fff',
                            marginBottom: '16px',
                            lineHeight: '1.2'
                        }}>
                            {selectedArticle.title}
                        </h1>

                        {/* Article Meta */}
                        <div style={{ 
                            display: 'flex', 
                            gap: '16px',
                            marginBottom: '32px',
                            paddingBottom: '24px',
                            borderBottom: '1px solid #222',
                            fontSize: '13px',
                            color: '#999'
                        }}>
                            <span>📦 {selectedArticle.product_line}类产品</span>
                            <span>•</span>
                            <span>{selectedArticle.category}</span>
                            {selectedArticle.source_reference && (
                                <>
                                    <span>•</span>
                                    <span>来源: {selectedArticle.source_reference}</span>
                                </>
                            )}
                        </div>

                        {/* Article Content */}
                        <div className="markdown-content" style={{ 
                            fontSize: '16px', 
                            lineHeight: '1.8',
                            color: '#ccc'
                        }}>
                            {selectedArticle.summary && (
                                <div style={{ 
                                    background: 'rgba(255,215,0,0.08)',
                                    border: '1px solid rgba(255,215,0,0.2)',
                                    borderRadius: '8px',
                                    padding: '20px',
                                    marginBottom: '32px',
                                    fontSize: '15px',
                                    color: '#fff'
                                }}>
                                    <strong style={{ color: '#FFD700' }}>摘要：</strong>
                                    {selectedArticle.summary}
                                </div>
                            )}
                            
                            <ReactMarkdown
                                remarkPlugins={[remarkGfm]}
                                rehypePlugins={[rehypeRaw]}
                                components={{
                                    // 标题样式
                                    h1: ({node, ...props}) => <h1 style={{fontSize: '32px', fontWeight: 700, color: '#fff', marginTop: '32px', marginBottom: '16px', borderBottom: '2px solid #333', paddingBottom: '12px'}} {...props} />,
                                    h2: ({node, ...props}) => <h2 style={{fontSize: '28px', fontWeight: 600, color: '#fff', marginTop: '28px', marginBottom: '14px'}} {...props} />,
                                    h3: ({node, ...props}) => <h3 style={{fontSize: '22px', fontWeight: 600, color: '#FFD700', marginTop: '24px', marginBottom: '12px'}} {...props} />,
                                    h4: ({node, ...props}) => <h4 style={{fontSize: '18px', fontWeight: 500, color: '#FFD700', marginTop: '20px', marginBottom: '10px'}} {...props} />,
                                    
                                    // 段落样式
                                    p: ({node, ...props}) => <p style={{marginBottom: '16px', lineHeight: '1.8'}} {...props} />,
                                    
                                    // 列表样式
                                    ul: ({node, ...props}) => <ul style={{marginLeft: '24px', marginBottom: '16px', listStyleType: 'disc'}} {...props} />,
                                    ol: ({node, ...props}) => <ol style={{marginLeft: '24px', marginBottom: '16px'}} {...props} />,
                                    li: ({node, ...props}) => <li style={{marginBottom: '8px', lineHeight: '1.6'}} {...props} />,
                                    
                                    // 代码样式
                                    code: ({node, inline, ...props}: any) => inline 
                                        ? <code style={{background: 'rgba(255,215,0,0.1)', padding: '2px 6px', borderRadius: '4px', fontSize: '14px', color: '#FFD700'}} {...props} />
                                        : <code style={{display: 'block', background: '#0a0a0a', padding: '16px', borderRadius: '8px', overflow: 'auto', fontSize: '14px', marginBottom: '16px', border: '1px solid #222'}} {...props} />,
                                    
                                    // 图片样式
                                    img: ({node, ...props}) => (
                                        <img 
                                            {...props} 
                                            style={{
                                                maxWidth: '100%',
                                                height: 'auto',
                                                borderRadius: '8px',
                                                marginTop: '20px',
                                                marginBottom: '20px',
                                                border: '1px solid #222'
                                            }} 
                                        />
                                    ),
                                    
                                    // 表格样式
                                    table: ({node, ...props}) => (
                                        <div style={{overflowX: 'auto', marginBottom: '20px'}}>
                                            <table style={{width: '100%', borderCollapse: 'collapse', border: '1px solid #333'}} {...props} />
                                        </div>
                                    ),
                                    th: ({node, ...props}) => <th style={{padding: '12px', background: '#1a1a1a', border: '1px solid #333', textAlign: 'left', fontWeight: 600}} {...props} />,
                                    td: ({node, ...props}) => <td style={{padding: '12px', border: '1px solid #333'}} {...props} />,
                                    
                                    // 引用样式
                                    blockquote: ({node, ...props}) => (
                                        <blockquote style={{
                                            borderLeft: '4px solid #FFD700',
                                            paddingLeft: '20px',
                                            marginLeft: '0',
                                            marginBottom: '20px',
                                            color: '#999',
                                            fontStyle: 'italic'
                                        }} {...props} />
                                    ),
                                    
                                    // 链接样式
                                    a: ({node, ...props}) => <a style={{color: '#FFD700', textDecoration: 'underline'}} {...props} />,
                                    
                                    // 分隔线
                                    hr: ({node, ...props}) => <hr style={{border: 'none', borderTop: '1px solid #333', marginTop: '32px', marginBottom: '32px'}} {...props} />,
                                }}
                            >
                                {selectedArticle.content || '暂无内容'}
                            </ReactMarkdown>
                        </div>

                        {/* Feedback */}
                        <div style={{ 
                            marginTop: '48px',
                            paddingTop: '24px',
                            borderTop: '1px solid #222',
                        }}>
                            {/* 章节导航 */}
                            <div style={{ 
                                display: 'flex', 
                                justifyContent: 'space-between',
                                marginBottom: '32px'
                            }}>
                                <button 
                                    style={{
                                        padding: '10px 20px',
                                        background: 'rgba(255,255,255,0.05)',
                                        border: '1px solid #333',
                                        borderRadius: '6px',
                                        color: '#fff',
                                        cursor: 'pointer',
                                        fontSize: '14px',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '8px'
                                    }}
                                    onMouseEnter={(e) => {
                                        e.currentTarget.style.background = 'rgba(255,255,255,0.1)';
                                        e.currentTarget.style.borderColor = '#FFD700';
                                    }}
                                    onMouseLeave={(e) => {
                                        e.currentTarget.style.background = 'rgba(255,255,255,0.05)';
                                        e.currentTarget.style.borderColor = '#333';
                                    }}
                                >
                                    ⬅️ 上一节
                                </button>
                                <button 
                                    onClick={handleHomeClick}
                                    style={{
                                        padding: '10px 20px',
                                        background: 'rgba(255,215,0,0.1)',
                                        border: '1px solid rgba(255,215,0,0.3)',
                                        borderRadius: '6px',
                                        color: '#FFD700',
                                        cursor: 'pointer',
                                        fontSize: '14px',
                                        fontWeight: 500
                                    }}
                                    onMouseEnter={(e) => {
                                        e.currentTarget.style.background = 'rgba(255,215,0,0.15)';
                                    }}
                                    onMouseLeave={(e) => {
                                        e.currentTarget.style.background = 'rgba(255,215,0,0.1)';
                                    }}
                                >
                                    📖 返回目录
                                </button>
                                <button 
                                    style={{
                                        padding: '10px 20px',
                                        background: 'rgba(255,255,255,0.05)',
                                        border: '1px solid #333',
                                        borderRadius: '6px',
                                        color: '#fff',
                                        cursor: 'pointer',
                                        fontSize: '14px',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '8px'
                                    }}
                                    onMouseEnter={(e) => {
                                        e.currentTarget.style.background = 'rgba(255,255,255,0.1)';
                                        e.currentTarget.style.borderColor = '#FFD700';
                                    }}
                                    onMouseLeave={(e) => {
                                        e.currentTarget.style.background = 'rgba(255,255,255,0.05)';
                                        e.currentTarget.style.borderColor = '#333';
                                    }}
                                >
                                    下一节 ➡️
                                </button>
                            </div>

                            {/* 反馈按钮 */}
                            <div style={{ textAlign: 'center' }}>
                                <div style={{ fontSize: '14px', color: '#999', marginBottom: '16px' }}>
                                    这篇文章对您有帮助吗？
                                </div>
                                <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
                                    <button style={{
                                        padding: '8px 24px',
                                        background: 'rgba(255,255,255,0.05)',
                                        border: '1px solid #333',
                                        borderRadius: '6px',
                                        color: '#fff',
                                        cursor: 'pointer',
                                        fontSize: '14px'
                                    }}>
                                        👍 有帮助 ({selectedArticle.helpful_count})
                                    </button>
                                    <button style={{
                                        padding: '8px 24px',
                                        background: 'rgba(255,255,255,0.05)',
                                        border: '1px solid #333',
                                        borderRadius: '6px',
                                        color: '#fff',
                                        cursor: 'pointer',
                                        fontSize: '14px'
                                    }}>
                                        👎 需要改进 ({selectedArticle.not_helpful_count})
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                ) : (
                    // Welcome View
                    <div style={{ 
                        maxWidth: '900px', 
                        margin: '0 auto', 
                        padding: '80px 40px',
                        textAlign: 'center'
                    }}>
                        <BookOpen size={64} color="#FFD700" style={{ marginBottom: '24px' }} />
                        <h1 style={{ 
                            fontSize: '42px', 
                            fontWeight: 700, 
                            color: '#fff',
                            marginBottom: '16px'
                        }}>
                            欢迎使用 Kinefinity WIKI
                        </h1>
                        <p style={{ 
                            fontSize: '18px', 
                            color: '#999',
                            marginBottom: '48px',
                            lineHeight: '1.6'
                        }}>
                            这里汇集了 Kinefinity 全系列产品的技术文档、故障排查指南和常见问题解答。<br />
                            请从左侧目录中选择您需要查看的内容。
                        </p>

                        <div style={{ 
                            display: 'grid', 
                            gridTemplateColumns: 'repeat(2, 1fr)', 
                            gap: '24px',
                            marginTop: '48px',
                            textAlign: 'left'
                        }}>
                            <div style={{
                                background: '#111',
                                border: '1px solid #222',
                                borderRadius: '12px',
                                padding: '24px',
                            }}>
                                <div style={{ fontSize: '32px', marginBottom: '12px' }}>🎥</div>
                                <h3 style={{ fontSize: '18px', fontWeight: 600, color: '#fff', marginBottom: '8px' }}>
                                    A类：在售电影摄影机
                                </h3>
                                <p style={{ fontSize: '14px', color: '#999', lineHeight: '1.6' }}>
                                    MAVO Edge系列、Mark2等现役机型的完整技术文档和使用指南
                                </p>
                            </div>

                            <div style={{
                                background: '#111',
                                border: '1px solid #222',
                                borderRadius: '12px',
                                padding: '24px',
                            }}>
                                <div style={{ fontSize: '32px', marginBottom: '12px' }}>📼</div>
                                <h3 style={{ fontSize: '18px', fontWeight: 600, color: '#fff', marginBottom: '8px' }}>
                                    B类：历史机型
                                </h3>
                                <p style={{ fontSize: '14px', color: '#999', lineHeight: '1.6' }}>
                                    MAVO LF、Terra、MAVO S35等经典机型的存档文档
                                </p>
                            </div>

                            <div style={{
                                background: '#111',
                                border: '1px solid #222',
                                borderRadius: '12px',
                                padding: '24px',
                            }}>
                                <div style={{ fontSize: '32px', marginBottom: '12px' }}>🔍</div>
                                <h3 style={{ fontSize: '18px', fontWeight: 600, color: '#fff', marginBottom: '8px' }}>
                                    C类：电子寻像器
                                </h3>
                                <p style={{ fontSize: '14px', color: '#999', lineHeight: '1.6' }}>
                                    Eagle系列监视器的使用指南和兼容性信息
                                </p>
                            </div>

                            <div style={{
                                background: '#111',
                                border: '1px solid #222',
                                borderRadius: '12px',
                                padding: '24px',
                            }}>
                                <div style={{ fontSize: '32px', marginBottom: '12px' }}>🔧</div>
                                <h3 style={{ fontSize: '18px', fontWeight: 600, color: '#fff', marginBottom: '8px' }}>
                                    D类：通用配件
                                </h3>
                                <p style={{ fontSize: '14px', color: '#999', lineHeight: '1.6' }}>
                                    GripBAT、Magic Arm等跨代配件的使用说明
                                </p>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};
