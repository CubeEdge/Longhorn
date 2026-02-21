/**
 * Markdown ↔ HTML Conversion Utilities
 * 用于TipTap编辑器的双向格式转换
 */

import TurndownService from 'turndown';

// ============ Markdown → HTML (用于加载文章到编辑器) ============

/**
 * 将Markdown转换为HTML，供TipTap编辑器使用
 * 使用简化的处理逻辑，避免复杂正则导致的递归问题
 */
export function markdownToHtml(markdown: string): string {
    if (!markdown) return '<p></p>';

    // 安全限制：防止超长内容
    const safeContent = markdown.length > 50000 
        ? markdown.substring(0, 50000) + '\n\n... (内容过长)'
        : markdown;

    let html = safeContent;

    // 1. 处理代码块 (必须在其他转换之前)
    html = html.replace(/```(\w*)\n([\s\S]*?)```/g, (_match, lang, code) => {
        return `<pre><code class="language-${lang}">${escapeHtml(code.trim())}</code></pre>`;
    });

    // 2. 处理行内代码
    html = html.replace(/`([^`]+)`/g, '<code>$1</code>');

    // 3. 处理图片 (必须在链接之前)
    html = html.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img src="$2" alt="$1">');

    // 4. 处理链接
    html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');

    // 5. 处理标题
    html = html.replace(/^#### (.*)$/gm, '<h4>$1</h4>');
    html = html.replace(/^### (.*)$/gm, '<h3>$1</h3>');
    html = html.replace(/^## (.*)$/gm, '<h2>$1</h2>');
    html = html.replace(/^# (.*)$/gm, '<h1>$1</h1>');

    // 6. 处理粗体和斜体 - 使用更安全的模式
    // 先处理三符号组合，再处理双符号，最后单符号
    // 使用非贪心匹配避免递归问题
    html = html.replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>');
    html = html.replace(/___(.+?)___/g, '<strong><em>$1</em></strong>');
    html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
    html = html.replace(/__(.+?)__/g, '<strong>$1</strong>');
    // 单符号使用更严格的匹配 - 确保前后有边界
    html = html.replace(/(?<![\*_])\*([^*]+?)\*(?![\*])/g, '<em>$1</em>');
    html = html.replace(/(?<![\*_])_([^_]+?)_(?![_])/g, '<em>$1</em>');

    // 7. 处理引用块
    html = html.replace(/^> (.*)$/gm, '<blockquote>$1</blockquote>');

    // 8. 处理水平线
    html = html.replace(/^---$/gm, '<hr>');
    html = html.replace(/^\*\*\*$/gm, '<hr>');

    // 9. 处理无序列表
    html = html.replace(/^[\-\*] (.*)$/gm, '<li>$1</li>');

    // 10. 处理有序列表
    html = html.replace(/^\d+\. (.*)$/gm, '<li>$1</li>');

    // 11. 处理段落 - 将连续的非标签行包装成段落
    const lines = html.split('\n');
    const processedLines: string[] = [];
    let inParagraph = false;
    let paragraphContent: string[] = [];

    for (const line of lines) {
        const trimmedLine = line.trim();
        const isBlockElement = /^<(h[1-6]|p|div|ul|ol|li|blockquote|pre|hr|img|table)/i.test(trimmedLine);
        const isEndBlockElement = /<\/(h[1-6]|p|div|ul|ol|li|blockquote|pre)>$/i.test(trimmedLine);

        if (isBlockElement || isEndBlockElement || trimmedLine === '') {
            if (inParagraph && paragraphContent.length > 0) {
                processedLines.push(`<p>${paragraphContent.join('<br>')}</p>`);
                paragraphContent = [];
                inParagraph = false;
            }
            if (trimmedLine !== '') {
                processedLines.push(trimmedLine);
            }
        } else {
            inParagraph = true;
            paragraphContent.push(trimmedLine);
        }
    }

    // 处理剩余的段落内容
    if (paragraphContent.length > 0) {
        processedLines.push(`<p>${paragraphContent.join('<br>')}</p>`);
    }

    return processedLines.join('\n');
}

/**
 * HTML转义函数
 */
function escapeHtml(text: string): string {
    const map: Record<string, string> = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;'
    };
    return text.replace(/[&<>"']/g, m => map[m]);
}

// ============ HTML → Markdown (用于保存编辑器内容) ============

// 创建Turndown服务实例
const turndownService = new TurndownService({
    headingStyle: 'atx',
    codeBlockStyle: 'fenced',
    bulletListMarker: '-',
    emDelimiter: '*',
    strongDelimiter: '**'
});

// 自定义图片处理 - 保留HTML格式以支持尺寸和布局
turndownService.addRule('image', {
    filter: 'img',
    replacement: (_content: string, node: any) => {
        const alt = node.alt || '';
        const src = node.getAttribute('src') || '';
        const width = node.getAttribute('width');
        const style = node.getAttribute('style') || '';
        
        // 提取宽度信息
        let widthValue = width;
        if (!widthValue) {
            const widthMatch = style.match(/(?:max-)?width:\s*(\d+)px/);
            if (widthMatch) widthValue = widthMatch[1];
        }
        
        // 提取布局信息 (inline-block 表示可并排)
        const isInline = style.includes('inline-block') || style.includes('display: inline');
        const layoutStyle = style.match(/max-width:\s*(\d+%)/)?.[1];
        
        // 如果有尺寸信息，保留HTML格式以支持尺寸
        if (widthValue || layoutStyle || isInline) {
            let imgStyle = 'border-radius: 12px;';
            if (widthValue) imgStyle += ` max-width: ${widthValue}px; width: 100%; height: auto;`;
            if (layoutStyle) imgStyle += ` max-width: ${layoutStyle};`;
            if (isInline) imgStyle += ' display: inline-block; vertical-align: top;';
            return `\n<img src="${src}" alt="${alt}" style="${imgStyle}">\n`;
        }
        
        // 没有特殊样式，使用标准Markdown
        return `![${alt}](${src})`;
    }
});

// 自定义链接处理
turndownService.addRule('link', {
    filter: 'a',
    replacement: (content: string, node: any) => {
        const href = node.getAttribute('href') || '';
        return `[${content}](${href})`;
    }
});

/**
 * 将HTML转换为Markdown，用于保存到数据库
 */
export function htmlToMarkdown(html: string): string {
    if (!html) return '';

    try {
        // 清理编辑器特定的样式和类，但保留img的style
        let cleanHtml = html;
        
        try {
            cleanHtml = cleanHtml
                // 移除resize handles
                .replace(/<div class="resize-handle"[^>]*><\/div>/gi, '')
                // 移除wiki-image-wrapper，保留img
                .replace(/<div class="wiki-image-wrapper"[^>]*>\s*(<img[^>]*>)\s*<\/div>/gi, '$1')
                // 移除非img标签的style属性
                .replace(/<(?!img)([a-z][a-z0-9]*)([^>]*)\s*style="[^"]*"([^>]*)>/gi, '<$1$2$3>')
                // 清理空div
                .replace(/<div>\s*<\/div>/gi, '')
                // 清理空段落
                .replace(/<p>\s*<\/p>/gi, '')
                // 将div转为段落
                .replace(/<div>([^<]*)<\/div>/gi, '<p>$1</p>');
        } catch (cleanErr) {
            console.warn('[htmlToMarkdown] HTML cleanup failed:', cleanErr);
            // 继续使用原始 HTML
        }

        // 转换为Markdown
        const markdown = turndownService.turndown(cleanHtml);

        // 清理多余空行
        return markdown.replace(/\n{3,}/g, '\n\n').trim();
    } catch (err) {
        console.error('[htmlToMarkdown] Conversion error:', err);
        // 错误时返回简单清理后的HTML（不要删除标签，保留HTML格式）
        return html;
    }
}

// ============ 工具函数 ============

/**
 * 检查内容是否为Markdown格式
 */
export function isMarkdown(content: string): boolean {
    if (!content) return false;

    const markdownPatterns = [
        /^#{1,6}\s/,           // 标题
        /\*\*[^*]+\*\*/,       // 粗体
        /\*[^*]+\*/,           // 斜体
        /!\[[^\]]*\]\([^)]+\)/, // 图片
        /\[[^\]]+\]\([^)]+\)/,  // 链接
        /^[-*]\s/,             // 无序列表
        /^\d+\.\s/,            // 有序列表
        /^>\s/,                // 引用
        /```[\s\S]*```/,       // 代码块
        /`[^`]+`/,             // 行内代码
    ];

    return markdownPatterns.some(pattern => pattern.test(content));
}

/**
 * 智能转换：自动检测格式并转换
 * 对HTML内容进行清理，避免复杂HTML导致TipTap解析错误
 */
export function toEditorContent(content: string): string {
    if (!content) return '<p></p>';

    // 安全限制：内容长度
    const safeContent = content.length > 100000 
        ? content.substring(0, 100000) + '\n\n... (内容过长，已截断)'
        : content;

    // 如果已经是HTML，清理后返回
    if (safeContent.includes('</p>') || safeContent.includes('</div>') || safeContent.includes('</h')) {
        // 清理HTML：移除危险属性，保留图片样式
        let cleanHtml = safeContent
            // 保留img标签的src和style，移除其他属性
            .replace(/<img([^>]*)>/gi, (_match, attrs) => {
                const srcMatch = attrs.match(/src=["']([^"']+)["']/);
                const styleMatch = attrs.match(/style=["']([^"']+)["']/);
                const altMatch = attrs.match(/alt=["']([^"']+)["']/);
                const widthMatch = attrs.match(/width=["']?([\d]+)["']?/);
                
                let imgTag = '<img';
                if (srcMatch) imgTag += ` src="${srcMatch[1]}"`;
                if (altMatch) imgTag += ` alt="${altMatch[1]}"`;
                if (widthMatch) imgTag += ` width="${widthMatch[1]}"`;
                if (styleMatch) imgTag += ` style="${styleMatch[1]}"`;
                imgTag += '>';
                return imgTag;
            })
            // 移除其他标签的style属性
            .replace(/<(?!img)([a-z][a-z0-9]*)([^>]*?)\s*style="[^"]*"([^>]*)>/gi, '<$1$2$3>')
            // 移除class属性
            .replace(/\s*class="[^"]*"/gi, '')
            // 移除data-*属性
            .replace(/\s*data-[a-z-]+="[^"]*"/gi, '')
            // 移除onclick等事件属性
            .replace(/\s*on[a-z]+="[^"]*"/gi, '')
            // 清理空的style/class属性残留
            .replace(/\s+>/g, '>')
            // 清理Markdown图片语法
            .replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img src="$2" alt="$1">');
        
        return cleanHtml;
    }

    // 否则当作Markdown转换
    return markdownToHtml(safeContent);
}

/**
 * 为保存准备内容：统一转换为Markdown
 */
export function toStorageContent(html: string): string {
    return htmlToMarkdown(html);
}
