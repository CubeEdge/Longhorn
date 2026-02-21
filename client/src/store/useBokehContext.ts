import { create } from 'zustand';

// 编辑模式 - 在 Wiki 编辑器内，可以直接修改内容
type EditorMode = 'editor';

// 助手模式 - 普通页面，提供建议和搜索
type AssistantMode = 'assistant';

// Wiki 文章编辑上下文
interface WikiArticleEditContext {
    type: 'wiki_article_edit';
    mode: EditorMode;
    articleId: number;
    articleTitle: string;
    articleSlug: string;
    currentContent: string; // 当前编辑器内容
    hasDraft: boolean;
}

// Wiki 文章浏览上下文
interface WikiArticleViewContext {
    type: 'wiki_article_view';
    mode: AssistantMode;
    articleId: number;
    articleTitle: string;
    articleSlug: string;
    articleSummary?: string;
}

// Wiki 首页上下文
interface WikiHomeContext {
    type: 'wiki_home';
    mode: AssistantMode;
}

// 文件管理上下文
interface FileManagerContext {
    type: 'file_manager';
    mode: AssistantMode;
    currentPath?: string;
    selectedFiles?: string[];
}

// 工单系统上下文
interface TicketSystemContext {
    type: 'ticket_system';
    mode: AssistantMode;
    viewType?: 'inquiry' | 'rma' | 'dealer_repair' | 'dashboard';
}

// 通用页面上下文
interface GenericPageContext {
    type: 'generic';
    mode: AssistantMode;
    path: string;
    title: string;
}

type BokehContext = 
    | WikiArticleEditContext 
    | WikiArticleViewContext 
    | WikiHomeContext 
    | FileManagerContext 
    | TicketSystemContext 
    | GenericPageContext;

interface BokehContextState {
    // Current context - what the user is working on
    currentContext: BokehContext | null;
    
    // Mode detection
    getMode: () => EditorMode | AssistantMode | null;
    isEditorMode: () => boolean;
    isAssistantMode: () => boolean;
    
    // Set context for different scenarios
    setWikiEditContext: (article: { id: number; title: string; slug: string; content: string; hasDraft?: boolean }) => void;
    setWikiViewContext: (article: { id: number; title: string; slug: string; summary?: string }) => void;
    setWikiHomeContext: () => void;
    setFileManagerContext: (path?: string, selectedFiles?: string[]) => void;
    setTicketSystemContext: (viewType?: 'inquiry' | 'rma' | 'dealer_repair' | 'dashboard') => void;
    setGenericContext: (path: string, title: string) => void;
    
    // Clear context
    clearContext: () => void;
    
    // Format the context into a readable string for Bokeh
    getContextSummary: () => string | null;
    
    // Get suggested actions based on context
    getSuggestedActions: () => string[];
}

export const useBokehContext = create<BokehContextState>((set, get) => ({
    currentContext: null,
    
    getMode: () => {
        const ctx = get().currentContext;
        if (!ctx) return null;
        return ctx.mode;
    },
    
    isEditorMode: () => {
        const ctx = get().currentContext;
        return ctx?.mode === 'editor';
    },
    
    isAssistantMode: () => {
        const ctx = get().currentContext;
        return ctx?.mode === 'assistant';
    },
    
    setWikiEditContext: (article) => {
        set({
            currentContext: {
                type: 'wiki_article_edit',
                mode: 'editor',
                articleId: article.id,
                articleTitle: article.title,
                articleSlug: article.slug,
                currentContent: article.content,
                hasDraft: article.hasDraft || false
            }
        });
    },
    
    setWikiViewContext: (article) => {
        set({
            currentContext: {
                type: 'wiki_article_view',
                mode: 'assistant',
                articleId: article.id,
                articleTitle: article.title,
                articleSlug: article.slug,
                articleSummary: article.summary
            }
        });
    },
    
    setWikiHomeContext: () => {
        set({
            currentContext: {
                type: 'wiki_home',
                mode: 'assistant'
            }
        });
    },
    
    setFileManagerContext: (path, selectedFiles) => {
        set({
            currentContext: {
                type: 'file_manager',
                mode: 'assistant',
                currentPath: path,
                selectedFiles
            }
        });
    },
    
    setTicketSystemContext: (viewType) => {
        set({
            currentContext: {
                type: 'ticket_system',
                mode: 'assistant',
                viewType
            }
        });
    },
    
    setGenericContext: (path, title) => {
        set({
            currentContext: {
                type: 'generic',
                mode: 'assistant',
                path,
                title
            }
        });
    },
    
    clearContext: () => {
        set({ currentContext: null });
    },
    
    getContextSummary: () => {
        const ctx = get().currentContext;
        if (!ctx) return null;
        
        switch (ctx.type) {
            case 'wiki_article_edit':
                return `用户正在 Wiki 编辑器中编辑文章「${ctx.articleTitle}」（ID: ${ctx.articleId}），可以直接修改内容。${ctx.hasDraft ? '有待发布的Bokeh优化草稿。' : ''}`;
            case 'wiki_article_view':
                return `用户正在浏览 Wiki 文章「${ctx.articleTitle}」（ID: ${ctx.articleId}）。`;
            case 'wiki_home':
                return '用户正在 Wiki 首页浏览知识库。';
            case 'file_manager':
                return `用户正在文件管理器${ctx.currentPath ? `的「${ctx.currentPath}」目录` : ''}中。`;
            case 'ticket_system':
                return `用户正在工单系统${ctx.viewType ? `的「${ctx.viewType}」视图` : ''}中。`;
            case 'generic':
                return `用户正在「${ctx.title}」页面（${ctx.path}）。`;
            default:
                return null;
        }
    },
    
    getSuggestedActions: () => {
        const ctx = get().currentContext;
        if (!ctx) return ['有什么可以帮您的吗？'];
        
        switch (ctx.type) {
            case 'wiki_article_edit':
                return [
                    '优化排版',
                    '精简内容',
                    '调整图片大小',
                    '修改标题颜色为 Kine Yellow',
                    '检查格式'
                ];
            case 'wiki_article_view':
                return [
                    '这篇文章讲了什么？',
                    '查找相关内容',
                    '这篇文章有帮助吗？',
                    '如何编辑这篇文章？'
                ];
            case 'wiki_home':
                return [
                    '如何创建新文章？',
                    '查找关于 MAVO Edge 的文档',
                    '最近更新的文章',
                    '如何导入文档？'
                ];
            case 'file_manager':
                return [
                    '如何分享文件？',
                    '如何创建文件夹？',
                    '文件版本历史',
                    '批量操作'
                ];
            case 'ticket_system':
                return [
                    '如何创建新工单？',
                    '工单状态说明',
                    '查找历史工单',
                    '工单处理流程'
                ];
            default:
                return ['有什么可以帮您的吗？'];
        }
    }
}));
