/**
 * TipTapEditor - TipTap富文本编辑器封装
 * 支持Markdown快捷键、图片处理、表格等
 */

import React, { useCallback, useEffect, useState, forwardRef, useImperativeHandle, useRef } from 'react';
import { useEditor, EditorContent, Editor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import Highlight from '@tiptap/extension-highlight';
import Typography from '@tiptap/extension-typography';
import { Table } from '@tiptap/extension-table';
import { TableRow } from '@tiptap/extension-table-row';
import { TableCell } from '@tiptap/extension-table-cell';
import { TableHeader } from '@tiptap/extension-table-header';
import TextAlign from '@tiptap/extension-text-align';
import {
    Bold, Italic, Strikethrough, Code, Heading1, Heading2, Heading3,
    List, ListOrdered, Quote, Minus, Image as ImageIcon, Undo, Redo,
    Highlighter, AlignLeft, AlignCenter, AlignRight
} from 'lucide-react';
import { toEditorContent, toStorageContent, isMarkdown } from './markdownUtils';
import ResizableImageExtension from './ResizableImageExtension';

interface TipTapEditorProps {
    content: string;
    onChange?: (markdown: string) => void;
    onSave?: (markdown: string) => void;
    placeholder?: string;
    editable?: boolean;
    onImageUpload?: (file: File) => Promise<string>;
}

// 暴露给父组件的方法
export interface TipTapEditorRef {
    getContent: () => string;
    getHTML: () => string;
}

// 工具栏组件
const Toolbar: React.FC<{
    editor: Editor | null;
    onInsertImage: () => void;
    disabled?: boolean;
}> = ({ editor, onInsertImage, disabled }) => {
    if (!editor) return null;

    const buttonStyle = (active: boolean = false) => ({
        padding: '8px 10px',
        background: active ? 'rgba(255, 215, 0, 0.2)' : 'transparent',
        border: active ? '1px solid rgba(255, 215, 0, 0.4)' : '1px solid transparent',
        borderRadius: '6px',
        color: active ? '#FFD700' : 'rgba(255,255,255,0.7)',
        cursor: disabled ? 'not-allowed' : 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        transition: 'all 0.15s ease',
        opacity: disabled ? 0.5 : 1
    });

    const ToolButton = ({ onClick, active, children, title }: {
        onClick: () => void;
        active?: boolean;
        children: React.ReactNode;
        title: string;
    }) => (
        <button
            onClick={onClick}
            title={title}
            style={buttonStyle(active)}
            disabled={disabled}
            onMouseEnter={(e) => {
                if (!disabled) {
                    e.currentTarget.style.background = active ? 'rgba(255, 215, 0, 0.3)' : 'rgba(255,255,255,0.1)';
                }
            }}
            onMouseLeave={(e) => {
                e.currentTarget.style.background = active ? 'rgba(255, 215, 0, 0.2)' : 'transparent';
            }}
        >
            {children}
        </button>
    );

    return (
        <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            padding: '12px 16px',
            borderBottom: '1px solid rgba(255,255,255,0.08)',
            background: 'rgba(0,0,0,0.2)',
            flexWrap: 'wrap'
        }}>
            {/* 撤销/重做 */}
            <ToolButton onClick={() => editor.chain().focus().undo().run()} title="撤销 (Cmd+Z)">
                <Undo size={16} />
            </ToolButton>
            <ToolButton onClick={() => editor.chain().focus().redo().run()} title="重做 (Cmd+Shift+Z)">
                <Redo size={16} />
            </ToolButton>

            <div style={{ width: '1px', height: '20px', background: 'rgba(255,255,255,0.1)', margin: '0 8px' }} />

            {/* 标题 */}
            <ToolButton
                onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
                active={editor.isActive('heading', { level: 1 })}
                title="标题1"
            >
                <Heading1 size={16} />
            </ToolButton>
            <ToolButton
                onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
                active={editor.isActive('heading', { level: 2 })}
                title="标题2"
            >
                <Heading2 size={16} />
            </ToolButton>
            <ToolButton
                onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
                active={editor.isActive('heading', { level: 3 })}
                title="标题3"
            >
                <Heading3 size={16} />
            </ToolButton>

            <div style={{ width: '1px', height: '20px', background: 'rgba(255,255,255,0.1)', margin: '0 8px' }} />

            {/* 格式 */}
            <ToolButton
                onClick={() => editor.chain().focus().toggleBold().run()}
                active={editor.isActive('bold')}
                title="粗体 (Cmd+B)"
            >
                <Bold size={16} />
            </ToolButton>
            <ToolButton
                onClick={() => editor.chain().focus().toggleItalic().run()}
                active={editor.isActive('italic')}
                title="斜体 (Cmd+I)"
            >
                <Italic size={16} />
            </ToolButton>
            <ToolButton
                onClick={() => editor.chain().focus().toggleStrike().run()}
                active={editor.isActive('strike')}
                title="删除线"
            >
                <Strikethrough size={16} />
            </ToolButton>
            <ToolButton
                onClick={() => editor.chain().focus().toggleHighlight().run()}
                active={editor.isActive('highlight')}
                title="高亮"
            >
                <Highlighter size={16} />
            </ToolButton>
            <ToolButton
                onClick={() => editor.chain().focus().toggleCode().run()}
                active={editor.isActive('code')}
                title="行内代码"
            >
                <Code size={16} />
            </ToolButton>

            <div style={{ width: '1px', height: '20px', background: 'rgba(255,255,255,0.1)', margin: '0 8px' }} />

            {/* 列表 */}
            <ToolButton
                onClick={() => editor.chain().focus().toggleBulletList().run()}
                active={editor.isActive('bulletList')}
                title="无序列表"
            >
                <List size={16} />
            </ToolButton>
            <ToolButton
                onClick={() => editor.chain().focus().toggleOrderedList().run()}
                active={editor.isActive('orderedList')}
                title="有序列表"
            >
                <ListOrdered size={16} />
            </ToolButton>
            <ToolButton
                onClick={() => editor.chain().focus().toggleBlockquote().run()}
                active={editor.isActive('blockquote')}
                title="引用"
            >
                <Quote size={16} />
            </ToolButton>

            <div style={{ width: '1px', height: '20px', background: 'rgba(255,255,255,0.1)', margin: '0 8px' }} />

            {/* 对齐 */}
            <ToolButton
                onClick={() => editor.chain().focus().setTextAlign('left').run()}
                active={editor.isActive({ textAlign: 'left' })}
                title="居左对齐"
            >
                <AlignLeft size={16} />
            </ToolButton>
            <ToolButton
                onClick={() => editor.chain().focus().setTextAlign('center').run()}
                active={editor.isActive({ textAlign: 'center' })}
                title="居中对齐"
            >
                <AlignCenter size={16} />
            </ToolButton>
            <ToolButton
                onClick={() => editor.chain().focus().setTextAlign('right').run()}
                active={editor.isActive({ textAlign: 'right' })}
                title="居右对齐"
            >
                <AlignRight size={16} />
            </ToolButton>

            <div style={{ width: '1px', height: '20px', background: 'rgba(255,255,255,0.1)', margin: '0 8px' }} />

            {/* 插入 */}
            <ToolButton
                onClick={() => editor.chain().focus().setHorizontalRule().run()}
                title="分隔线"
            >
                <Minus size={16} />
            </ToolButton>
            <ToolButton onClick={onInsertImage} title="插入图片">
                <ImageIcon size={16} />
            </ToolButton>
        </div>
    );
};

// 主编辑器组件 - 使用 forwardRef 暴露方法给父组件
const TipTapEditor = forwardRef<TipTapEditorRef, TipTapEditorProps>(({
    content,
    onChange,
    onSave,
    placeholder = '开始输入内容...',
    editable = true,
    onImageUpload
}, ref) => {
    const [isReady, setIsReady] = useState(false);
    // 使用 ref 存储 editor 实例，确保始终可以访问最新的 editor
    const editorInstanceRef = useRef<Editor | null>(null);

    const editor = useEditor({
        extensions: [
            StarterKit.configure({
                heading: {
                    levels: [1, 2, 3, 4]
                },
                // 禁用StarterKit的默认图片处理，使用我们的ResizableImageExtension
                // Note: StarterKit doesn't include Image by default, but we ensure no conflict
            }),
            ResizableImageExtension,
            Placeholder.configure({
                placeholder
            }),
            Highlight.configure({
                multicolor: false
            }),
            Typography,
            // 表格支持
            Table.configure({
                resizable: true,
                HTMLAttributes: {
                    class: 'wiki-table',
                },
            }),
            TableRow,
            TableHeader,
            TableCell,
            TextAlign.configure({
                types: ['heading', 'paragraph', 'image'],
                alignments: ['left', 'center', 'right'],
            }),
        ],
        content: '',
        editable,
        editorProps: {
            attributes: {
                style: `
                    outline: none;
                    min-height: 300px;
                    padding: 24px;
                    font-size: 15px;
                    line-height: 1.8;
                    color: rgba(255,255,255,0.9);
                `,
                class: 'tiptap-editor-content'
            },
            handleKeyDown: (_view, event) => {
                // Cmd+S 保存
                if ((event.metaKey || event.ctrlKey) && event.key === 's') {
                    event.preventDefault();
                    if (onSave && editor) {
                        // 直接使用 HTML 保存
                        const domElement = editor.view?.dom;
                        const html = domElement?.innerHTML || editor.getHTML();
                        onSave(html);
                    }
                    return true;
                }
                return false;
            }
        },
        onUpdate: ({ editor }: any) => {
            // 确保 editor 和 onChange 都存在
            if (!onChange || !editor) return;

            try {
                // 直接从 DOM 获取 HTML 内容，不再转换为 Markdown
                const domElement = editor.view?.dom;
                let html = '';
                if (domElement && domElement.innerHTML) {
                    html = domElement.innerHTML;
                } else {
                    html = editor.getHTML();
                }

                if (!html) {
                    console.warn('[TipTap] getHTML returned empty');
                    return;
                }

                // 直接返回 HTML，不转换为 Markdown
                onChange(html);
            } catch (err) {
                // 只记录一次错误，避免频繁日志
                if (!((window as any).__tiptapErrorLogged)) {
                    console.error('[TipTap] onUpdate error:', err);
                    (window as any).__tiptapErrorLogged = true;
                    // 5秒后重置，允许再次记录
                    setTimeout(() => { (window as any).__tiptapErrorLogged = false; }, 5000);
                }
            }
        },
        onCreate: ({ editor }: any) => {
            console.log('[TipTap] Editor created');
            editorInstanceRef.current = editor;
            setIsReady(true);
        },
        onDestroy: () => {
            console.log('[TipTap] Editor destroyed');
            editorInstanceRef.current = null;
        }
    });

    // 加载内容 - HTML 直接加载，保留所有属性
    useEffect(() => {
        if (editor && isReady) {
            // Skip if content is empty or already loaded
            if (!content || content.trim() === '') {
                console.log('[TipTap] No content to load, skipping');
                return;
            }

            try {
                console.log('[TipTap] Loading content, length:', content.length);
                let htmlContent = '';

                // 检测是否为 HTML 内容
                const isHtmlContent = content.includes('<') && content.includes('>');

                if (isHtmlContent) {
                    // HTML内容：清理可能存在的控件残留
                    // 移除 select/option 标签和其内容
                    htmlContent = content
                        .replace(/<select[^>]*>.*?<\/select>/gis, '')
                        .replace(/<option[^>]*>.*?<\/option>/gis, '')
                        // 移除孤立的控件文本
                        .replace(/全宽1\/21\/31\/41\/5/g, '')
                        .replace(/\d+px\s*$/gm, '')
                        .substring(0, 100000);
                    console.log('[TipTap] Loading as HTML, cleaned control elements');
                } else {
                    // Markdown内容：简单转换为HTML
                    htmlContent = `<p>${content.replace(/\n/g, '</p><p>')}</p>`;
                    console.log('[TipTap] Loading as Markdown, converted to HTML');
                }

                console.log('[TipTap] Setting HTML content, length:', htmlContent.length);
                editor.commands.setContent(htmlContent);
            } catch (err) {
                console.error('[TipTap] Failed to load content:', err);
                editor.commands.setContent('<p></p>');
            }
        }
    }, [editor, content, isReady]);

    // 更新可编辑状态
    useEffect(() => {
        if (editor) {
            editor.setEditable(editable);
        }
    }, [editor, editable]);

    // 插入图片
    const handleInsertImage = useCallback(() => {
        if (!editor) return;

        // 创建文件选择器
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'image/*';
        input.onchange = async (e) => {
            const file = (e.target as HTMLInputElement).files?.[0];
            if (!file) return;

            let imageUrl: string;

            if (onImageUpload) {
                // 使用自定义上传
                try {
                    imageUrl = await onImageUpload(file);
                } catch (err) {
                    console.error('Image upload failed:', err);
                    return;
                }
            } else {
                // 转为Base64
                imageUrl = await new Promise((resolve) => {
                    const reader = new FileReader();
                    reader.onload = () => resolve(reader.result as string);
                    reader.readAsDataURL(file);
                });
            }

            editor.chain().focus().setResizableImage({ src: imageUrl }).run();
        };
        input.click();
    }, [editor, onImageUpload]);

    // 通过URL插入图片
    const insertImageByUrl = useCallback((url: string) => {
        if (editor && url) {
            editor.chain().focus().setResizableImage({ src: url }).run();
        }
    }, [editor]);

    // 获取当前内容（Markdown格式）
    const getMarkdown = useCallback(() => {
        if (!editor) return '';
        return toStorageContent(editor.getHTML());
    }, [editor]);

    // 获取HTML内容
    const getHTML = useCallback(() => {
        if (!editor) return '';
        return editor.getHTML();
    }, [editor]);

    // 通过 useImperativeHandle 暴露方法给父组件
    useImperativeHandle(ref, () => ({
        getContent: () => {
            // 使用 ref 获取最新的 editor 实例
            const currentEditor = editorInstanceRef.current || editor;
            console.log('[TipTap] getContent called, editor state:', {
                hasEditorRef: !!editorInstanceRef.current,
                hasEditor: !!editor,
                hasCurrentEditor: !!currentEditor,
                isReady: isReady
            });

            if (!currentEditor) {
                console.warn('[TipTap] getContent: editor not ready');
                return '';
            }

            try {
                // 【关键】直接从 DOM 提取内容，避免 getHTML() 的递归问题
                const domElement = currentEditor.view?.dom;
                if (!domElement) {
                    console.warn('[TipTap] getContent: DOM element not found');
                    return '';
                }

                // 克隆 DOM 内容进行清理
                const clone = domElement.cloneNode(true) as HTMLElement;

                // 移除所有控件元素（不包括图片容器）
                const controlsToRemove = clone.querySelectorAll('select, option, button:not(.image-container button), .resize-handle');
                controlsToRemove.forEach(el => el.remove());

                // 移除尺寸提示
                const sizeHints = clone.querySelectorAll('div[style*="font-size: 11px"][style*="color: rgba(255,255,255,0.5)"]');
                sizeHints.forEach(el => el.remove());

                // 移除工具栏（绝对定位的div）
                const toolbars = clone.querySelectorAll('div[style*="position: absolute"]');
                toolbars.forEach(el => {
                    // 确保不移除图片容器
                    if (!el.querySelector('img') && !el.closest('.image-container')) {
                        el.remove();
                    }
                });

                // 清理图片容器，只保留 img 标签
                const imageContainers = clone.querySelectorAll('.image-container');
                imageContainers.forEach(container => {
                    const img = container.querySelector('img');
                    if (img) {
                        // 从容器获取宽度和对齐属性
                        const widthAttr = container.getAttribute('data-width');
                        const alignAttr = container.getAttribute('data-align');

                        // 设置图片样式
                        let style = 'height: auto; border-radius: 12px; display: block;';
                        if (widthAttr) {
                            style += ` width: ${widthAttr};`;
                        } else {
                            style += ' width: 100%;';
                        }

                        if (alignAttr === 'center') {
                            style += ' margin-left: auto; margin-right: auto;';
                        } else if (alignAttr === 'right') {
                            style += ' margin-left: auto; margin-right: 0;';
                        }

                        img.setAttribute('style', style);

                        // 复制容器的属性到图片
                        if (widthAttr) img.setAttribute('data-width', widthAttr);
                        if (alignAttr) img.setAttribute('data-align', alignAttr);

                        container.parentNode?.replaceChild(img, container);
                    } else {
                        container.remove();
                    }
                });

                const html = clone.innerHTML;
                console.log('[TipTap] getContent: got cleaned DOM HTML, length:', html?.length || 0);

                if (!html || html.trim() === '' || html === '<p></p>') {
                    console.warn('[TipTap] getContent: HTML is empty or default');
                    return '';
                }

                return html;
            } catch (err: any) {
                console.error('[TipTap] getContent error:', err?.message || err);
                return '';
            }
        },
        getHTML: () => {
            try {
                const currentEditor = editorInstanceRef.current || editor;
                const domElement = currentEditor?.view?.dom;
                if (domElement) {
                    // 克隆并清理
                    const clone = domElement.cloneNode(true) as HTMLElement;
                    const controls = clone.querySelectorAll('select, option, button, [data-selected]');
                    controls.forEach(el => el.remove());
                    return clone.innerHTML || '';
                }
                return '';
            } catch (e: any) {
                console.error('[TipTap] getHTML error:', e?.message || e);
                return '';
            }
        }
    }), [editor, isReady]);

    // 也保留旧的方式，确保兼容性
    useEffect(() => {
        if (editor) {
            (editor as any).getMarkdown = getMarkdown;
            (editor as any).getHTML = getHTML;
            (editor as any).insertImageByUrl = insertImageByUrl;
        }
    }, [editor, getMarkdown, getHTML, insertImageByUrl]);

    return (
        <div style={{
            display: 'flex',
            flexDirection: 'column',
            flex: 1,
            overflow: 'hidden',
            background: 'rgba(0,0,0,0.2)',
            borderRadius: '12px'
        }}>
            <Toolbar
                editor={editor}
                onInsertImage={handleInsertImage}
                disabled={!editable}
            />
            <div style={{
                flex: 1,
                overflow: 'auto',
                background: 'transparent'
            }}>
                <EditorContent editor={editor} />
            </div>

            {/* TipTap样式覆盖 */}
            <style>{`
                .tiptap-editor-content {
                    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                }
                .tiptap-editor-content h1 {
                    font-size: 28px;
                    font-weight: 700;
                    color: #fff;
                    margin: 24px 0 16px;
                    padding-bottom: 12px;
                    border-bottom: 1px solid rgba(255,255,255,0.1);
                }
                .tiptap-editor-content h2 {
                    font-size: 22px;
                    font-weight: 600;
                    color: #fff;
                    margin: 20px 0 12px;
                }
                .tiptap-editor-content h3 {
                    font-size: 18px;
                    font-weight: 600;
                    color: #FFD700;
                    margin: 16px 0 10px;
                }
                .tiptap-editor-content h4 {
                    font-size: 16px;
                    font-weight: 600;
                    color: rgba(255,255,255,0.9);
                    margin: 14px 0 8px;
                }
                .tiptap-editor-content p {
                    margin-bottom: 16px;
                    line-height: 1.8;
                    color: rgba(255,255,255,0.9);
                }
                .tiptap-editor-content p.is-editor-empty:first-child::before {
                    content: attr(data-placeholder);
                    float: left;
                    color: rgba(255,255,255,0.3);
                    pointer-events: none;
                    height: 0;
                }
                .tiptap-editor-content ul,
                .tiptap-editor-content ol {
                    padding-left: 24px;
                    margin-bottom: 16px;
                }
                .tiptap-editor-content li {
                    margin-bottom: 8px;
                    line-height: 1.6;
                }
                .tiptap-editor-content blockquote {
                    border-left: 3px solid #FFD700;
                    padding-left: 20px;
                    margin: 16px 0;
                    color: rgba(255,255,255,0.7);
                    font-style: italic;
                }
                .tiptap-editor-content code {
                    background: rgba(255, 215, 0, 0.1);
                    padding: 2px 6px;
                    border-radius: 4px;
                    color: #FFD700;
                    font-size: 14px;
                    font-family: 'SF Mono', Monaco, monospace;
                }
                .tiptap-editor-content pre {
                    background: rgba(0,0,0,0.4);
                    padding: 16px;
                    border-radius: 8px;
                    overflow-x: auto;
                    margin: 16px 0;
                }
                .tiptap-editor-content pre code {
                    background: transparent;
                    padding: 0;
                    color: rgba(255,255,255,0.9);
                }
                .tiptap-editor-content a {
                    color: #FFD700;
                    text-decoration: none;
                    border-bottom: 1px solid rgba(255, 215, 0, 0.3);
                }
                .tiptap-editor-content a:hover {
                    border-bottom-color: #FFD700;
                }
                .tiptap-editor-content img {
                    max-width: 100%;
                    height: auto;
                    border-radius: 12px;
                    margin: 16px 0;
                    border: 1px solid rgba(255,255,255,0.1);
                }
                .tiptap-editor-content hr {
                    border: none;
                    border-top: 1px solid rgba(255,255,255,0.1);
                    margin: 24px 0;
                }
                .tiptap-editor-content mark {
                    background: rgba(255, 215, 0, 0.3);
                    color: inherit;
                    padding: 0 4px;
                    border-radius: 2px;
                }
                .tiptap-editor-content .ProseMirror-selectednode {
                    outline: none;
                }
                /* 图片并排布局样式 */
                .tiptap-editor-content .image-container {
                    display: inline-block;
                    vertical-align: top;
                    margin: 8px;
                    position: relative;
                }
                .tiptap-editor-content .image-container.selected {
                    outline: 2px solid #fff;
                    border-radius: 12px;
                    padding: 4px;
                }
                /* 确保选中的图片容器使用block布局以支持margin对齐 */
                .tiptap-editor-content .image-container.selected > div:first-child {
                    display: block !important;
                }
                .tiptap-editor-content p:has(.image-container) {
                    display: flex;
                    flex-wrap: wrap;
                    align-items: flex-start;
                    gap: 8px;
                    margin: 16px 0;
                }
                /* 表格样式 - 与正文页面保持一致 */
                .tiptap-editor-content table {
                    width: 100%;
                    border-collapse: collapse;
                    margin-bottom: 20px;
                    border-radius: 10px;
                    border: 1px solid rgba(255,255,255,0.08);
                    overflow: hidden;
                }
                .tiptap-editor-content th {
                    padding: 12px;
                    background: rgba(255,255,255,0.03);
                    border-bottom: 1px solid rgba(255,255,255,0.08);
                    text-align: left;
                    font-weight: 600;
                    font-size: 13px;
                }
                .tiptap-editor-content td {
                    padding: 12px;
                    border-bottom: 1px solid rgba(255,255,255,0.05);
                    font-size: 13px;
                }
            `}</style>
        </div>
    );
});

TipTapEditor.displayName = 'TipTapEditor';

export default TipTapEditor;

// 导出工具函数供外部使用
export { toEditorContent, toStorageContent, isMarkdown };
