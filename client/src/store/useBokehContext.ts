import { create } from 'zustand';

interface WikiArticleContext {
    type: 'wiki_article';
    articleId: number;
    articleTitle: string;
    articleSlug: string;
    hasDraft: boolean;
}

interface BokehContextState {
    // Current context - what the user is working on
    currentContext: WikiArticleContext | null;
    
    // Set context when user starts working on something
    setWikiContext: (article: { id: number; title: string; slug: string; hasDraft?: boolean }) => void;
    
    // Clear context
    clearContext: () => void;
    
    // Format the context into a readable string for Bokeh
    getContextSummary: () => string | null;
}

export const useBokehContext = create<BokehContextState>((set, get) => ({
    currentContext: null,
    
    setWikiContext: (article) => {
        set({
            currentContext: {
                type: 'wiki_article',
                articleId: article.id,
                articleTitle: article.title,
                articleSlug: article.slug,
                hasDraft: article.hasDraft || false
            }
        });
    },
    
    clearContext: () => {
        set({ currentContext: null });
    },
    
    getContextSummary: () => {
        const ctx = get().currentContext;
        if (!ctx) return null;
        
        if (ctx.type === 'wiki_article') {
            return `用户正在审阅 Wiki 文章：${ctx.articleTitle}（ID: ${ctx.articleId}）${ctx.hasDraft ? '，有待发布的Bokeh优化草稿' : ''}`;
        }
        
        return null;
    }
}));
