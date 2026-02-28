/**
 * ResizableImage - 支持拖拽调整大小、并排布局和对齐的图片扩展
 */

import { Node } from '@tiptap/core';
import { ReactNodeViewRenderer, NodeViewWrapper } from '@tiptap/react';
import React, { useState, useRef, useEffect } from 'react';
import { AlignLeft, AlignCenter, AlignRight } from 'lucide-react';

// 图片布局类型
export type ImageLayout = 'full' | 'half' | 'third' | 'quarter';
// 图片对齐类型
export type ImageAlign = 'left' | 'center' | 'right';

// 图片节点视图组件
const ImageView: React.FC<any> = ({ node, updateAttributes, selected, getPos, editor }) => {
    const [isResizing, setIsResizing] = useState(false);
    const [resizeStartX, setResizeStartX] = useState(0);
    const [initialWidth, setInitialWidth] = useState(0);
    const containerRef = useRef<HTMLDivElement>(null);

    // 直接使用TipTap提供的selected状态
    const isSelected = selected;

    // 点击图片时选中节点
    const handleImageClick = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (editor && getPos) {
            const pos = getPos();
            if (typeof pos === 'number') {
                // 设置选中状态到该节点
                editor.commands.setNodeSelection(pos);
            }
        }
    };

    const attrs = node.attrs as {
        src: string;
        alt?: string;
        width?: number;
        layout?: ImageLayout;
        align?: ImageAlign;
    };
    
    const { src, alt, width, layout = 'full', align = 'left' } = attrs;

    // 根据宽度计算分数 - 实时计算显示的比例
    const getWidthFraction = () => {
        if (!width) return 'full';
        const containerWidth = containerRef.current?.parentElement?.offsetWidth || 1200;
        const ratio = width / containerWidth;
        if (ratio >= 0.95) return 'full';
        if (Math.abs(ratio - 0.5) < 0.08) return '1/2';
        if (Math.abs(ratio - 0.33) < 0.08) return '1/3';
        if (Math.abs(ratio - 0.25) < 0.08) return '1/4';
        if (Math.abs(ratio - 0.2) < 0.08) return '1/5';
        return 'custom';
    };

    // 强制重新渲染以更新显示的比例
    const [, forceUpdate] = useState({});

    // 开始拖拽调整大小
    const handleResizeStart = (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsResizing(true);
        setResizeStartX(e.clientX);
        setInitialWidth(width || containerRef.current?.offsetWidth || 400);
    };

    // 拖拽中 - 实时更新宽度和比例显示
    useEffect(() => {
        if (!isResizing) return;

        const handleMouseMove = (e: MouseEvent) => {
            const diff = e.clientX - resizeStartX;
            const newWidth = Math.max(100, Math.min(1200, initialWidth + diff));
            updateAttributes({ width: newWidth });
            forceUpdate({}); // 强制更新以显示最新比例
        };

        const handleMouseUp = () => {
            setIsResizing(false);
        };

        document.addEventListener('mousemove', handleMouseMove);
        document.addEventListener('mouseup', handleMouseUp);

        return () => {
            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('mouseup', handleMouseUp);
        };
    }, [isResizing, resizeStartX, initialWidth, updateAttributes]);

    // 设置对齐
    const setAlign = (newAlign: ImageAlign) => {
        updateAttributes({ align: newAlign });
        // 强制重新渲染以立即更新对齐样式
        forceUpdate({});
    };

    // 对齐按钮样式
    const alignButtonStyle = (active: boolean) => ({
        padding: '4px 6px',
        background: active ? 'rgba(255,255,255,0.25)' : 'rgba(255,255,255,0.1)',
        border: active ? '1px solid #fff' : '1px solid rgba(255,255,255,0.2)',
        borderRadius: '4px',
        color: active ? '#fff' : 'rgba(255,255,255,0.7)',
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
    });

    // 获取对齐样式用于内部容器 - 同时支持 align 和 textAlign 属性
    const getInnerAlignStyle = (): React.CSSProperties => {
        // 优先使用 textAlign (来自 TextAlign 扩展)，其次使用 align (自定义属性)
        const currentAlign = node.attrs.textAlign || node.attrs.align || 'left';
        switch (currentAlign) {
            case 'center':
                return { marginLeft: 'auto', marginRight: 'auto' };
            case 'right':
                return { marginLeft: 'auto', marginRight: '0' };
            default:
                return { marginLeft: '0', marginRight: 'auto' };
        }
    };

    return (
        <NodeViewWrapper
            ref={containerRef as any}
            className={`image-container ${isSelected ? 'selected' : ''}`}
            style={{
                display: 'block',
                margin: layout === 'full' ? '16px 0' : '8px',
                position: 'relative',
            }}
            data-align={align}
            data-width={width ? `${width}px` : '100%'}
        >
            <div style={{
                position: 'relative',
                width: width ? `${width}px` : '100%',
                maxWidth: '100%',
                ...getInnerAlignStyle(),
            }}>
                <img
                    src={src}
                    alt={alt || ''}
                    style={{
                        width: '100%',
                        height: 'auto',
                        borderRadius: '12px',
                        border: 'none',
                        display: 'block',
                        cursor: 'pointer',
                    }}
                    onClick={handleImageClick}
                />
            
                {/* 选中时显示的控制按钮 - 简化为只有工具栏 */}
                {isSelected && (
                    <>
                        {/* 工具栏：布局 + 对齐 */}
                        <div
                            style={{
                                position: 'absolute',
                                top: '-36px',
                                left: '50%',
                                transform: 'translateX(-50%)',
                                display: 'flex',
                                gap: '4px',
                                background: 'rgba(0,0,0,0.9)',
                                padding: '4px 8px',
                                borderRadius: '6px',
                                zIndex: 10,
                            }}
                            onClick={(e) => e.stopPropagation()}
                        >
                            {/* 宽度下拉选择 */}
                            <select
                                value={getWidthFraction()}
                                onChange={(e) => {
                                    const val = e.target.value;
                                    const containerWidth = containerRef.current?.parentElement?.offsetWidth || 1200;
                                    if (val === 'full') {
                                        updateAttributes({ width: undefined });
                                    } else if (val === '1/2') {
                                        updateAttributes({ width: Math.round(containerWidth * 0.5) });
                                    } else if (val === '1/3') {
                                        updateAttributes({ width: Math.round(containerWidth * 0.33) });
                                    } else if (val === '1/4') {
                                        updateAttributes({ width: Math.round(containerWidth * 0.25) });
                                    } else if (val === '1/5') {
                                        updateAttributes({ width: Math.round(containerWidth * 0.2) });
                                    }
                                }}
                                style={{
                                    padding: '4px 8px',
                                    background: 'rgba(255,255,255,0.15)',
                                    border: '1px solid rgba(255,255,255,0.3)',
                                    borderRadius: '4px',
                                    color: 'var(--text-main)',
                                    fontSize: '11px',
                                    cursor: 'pointer',
                                }}
                                title="设置宽度"
                            >
                                <option value="full">全宽</option>
                                <option value="1/2">1/2</option>
                                <option value="1/3">1/3</option>
                                <option value="1/4">1/4</option>
                                <option value="1/5">1/5</option>
                                {getWidthFraction() === 'custom' && <option value="custom">自定义</option>}
                            </select>
                            
                            {/* 分隔线 */}
                            <div style={{ width: '1px', height: '20px', background: 'rgba(255,255,255,0.2)', margin: '0 4px' }} />
                            
                            {/* 对齐按钮组 */}
                            <button
                                onClick={() => setAlign('left')}
                                style={alignButtonStyle(align === 'left')}
                                title="居左"
                            >
                                <AlignLeft size={14} />
                            </button>
                            <button
                                onClick={() => setAlign('center')}
                                style={alignButtonStyle(align === 'center')}
                                title="居中"
                            >
                                <AlignCenter size={14} />
                            </button>
                            <button
                                onClick={() => setAlign('right')}
                                style={alignButtonStyle(align === 'right')}
                                title="居右"
                            >
                                <AlignRight size={14} />
                            </button>
                        </div>
                    </>
                )}
            </div>
            
            {/* 调整大小手柄 - iPadOS26风格四分之一圆环，放在外层框的右下角 */}
            {isSelected && (
                <div
                    onMouseDown={handleResizeStart}
                    style={{
                        position: 'absolute',
                        right: '-6px',
                        bottom: '-6px',
                        width: '28px',
                        height: '28px',
                        background: 'transparent',
                        border: '6px solid #FFD700',
                        borderTop: 'none',
                        borderLeft: 'none',
                        borderRadius: '0 0 16px 0',
                        cursor: 'nwse-resize',
                        zIndex: 20,
                        pointerEvents: 'auto',
                    }}
                />
            )}
        </NodeViewWrapper>
    );
};

// TipTap 扩展定义 - 使用 'image' 名称以替换默认图片处理
export const ResizableImageExtension = Node.create({
    name: 'image',
    
    group: 'inline',
    inline: true,
    atom: true,
    selectable: true,
    draggable: true,
    
    addAttributes() {
        return {
            src: {
                default: null,
                parseHTML: (element: HTMLElement) => element.getAttribute('src'),
            },
            alt: {
                default: null,
                parseHTML: (element: HTMLElement) => element.getAttribute('alt'),
            },
            width: {
                default: null,
                parseHTML: (element: HTMLElement) => {
                    const width = element.getAttribute('width');
                    if (width) return parseInt(width);
                    const style = element.getAttribute('style') || '';
                    const match = style.match(/width:\s*(\d+)px/);
                    return match ? parseInt(match[1]) : null;
                },
            },
            layout: {
                default: 'full',
                parseHTML: (element: HTMLElement) => element.getAttribute('data-layout') || 'full',
            },
            align: {
                default: 'left',
                parseHTML: (element: HTMLElement) => {
                    // 从 data-align 或 style 中解析对齐方式
                    const dataAlign = element.getAttribute('data-align');
                    if (dataAlign) return dataAlign;
                    const style = element.getAttribute('style') || '';
                    if (style.includes('margin-left: auto') && style.includes('margin-right: auto')) return 'center';
                    if (style.includes('margin-left: auto')) return 'right';
                    return 'left';
                },
            },
            textAlign: {
                default: null,
                parseHTML: (element: HTMLElement) => {
                    // 支持 TextAlign 扩展的 textAlign 属性
                    const style = element.getAttribute('style') || '';
                    if (style.includes('margin-left: auto') && style.includes('margin-right: auto')) return 'center';
                    if (style.includes('margin-left: auto')) return 'right';
                    return null;
                },
            },
        };
    },
    
    parseHTML() {
        return [
            {
                tag: 'img[src]',
            },
        ];
    },
    
    renderHTML({ node }) {
        const { width, align, src, alt } = node.attrs;
        
        // 只返回基本的img标签，不包含任何控件
        let style = 'height: auto; border-radius: 12px;';
        
        if (width) {
            style += ` width: ${width}px;`;
        } else {
            style += ' width: 100%;';
        }
        
        // 添加对齐样式
        if (align === 'center') {
            style += ' display: block; margin-left: auto; margin-right: auto;';
        } else if (align === 'right') {
            style += ' display: block; margin-left: auto; margin-right: 0;';
        } else {
            style += ' display: block;';
        }
        
        // 返回img标签，添加 data-属性以便下次解析
        const attrs: any = { 
            src,
            alt: alt || '',
            style
        };
        
        if (width) {
            attrs['data-width'] = `${width}px`;
            attrs['width'] = width;
        }
        if (align && align !== 'left') {
            attrs['data-align'] = align;
        }
        
        return ['img', attrs];
    },
    
    addNodeView() {
        return ReactNodeViewRenderer(ImageView);
    },
    
    addCommands() {
        return {
            setResizableImage: (options: { src: string; alt?: string; width?: number; layout?: ImageLayout; align?: ImageAlign }) => 
                ({ commands }: { commands: any }) => {
                    return commands.insertContent({
                        type: 'image',
                        attrs: options,
                    });
                },
        } as any;
    },
});

// 导出类型
declare module '@tiptap/core' {
    interface Commands<ReturnType> {
        image: {
            setResizableImage: (options: { 
                src: string; 
                alt?: string; 
                width?: number; 
                layout?: ImageLayout;
                align?: ImageAlign;
            }) => ReturnType;
        };
    }
}

export default ResizableImageExtension;
