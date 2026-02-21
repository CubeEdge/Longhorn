import React from 'react';
import { FileText, ChevronRight } from 'lucide-react';

interface ArticleCardProps {
    id: number;
    title: string;
    summary?: string;
    productLine?: string;
    productModels?: string[] | string;
    category?: string;
    tags?: string[];
    onClick: () => void;
    variant?: 'default' | 'compact' | 'reference';
}

export const ArticleCard: React.FC<ArticleCardProps> = ({
    title,
    summary,
    productLine,
    productModels,
    category,
    onClick,
    variant = 'default'
}) => {

    const modelText = Array.isArray(productModels) 
        ? productModels[0] 
        : productModels;

    if (variant === 'compact') {
        return (
            <div
                onClick={onClick}
                style={{
                    background: 'rgba(255,255,255,0.03)',
                    border: '1px solid rgba(255,255,255,0.08)',
                    borderRadius: '12px',
                    padding: '14px 16px',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px'
                }}
                onMouseEnter={(e) => {
                    e.currentTarget.style.background = 'rgba(255,215,0,0.05)';
                    e.currentTarget.style.borderColor = 'rgba(255,215,0,0.25)';
                    e.currentTarget.style.transform = 'translateY(-1px)';
                }}
                onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'rgba(255,255,255,0.03)';
                    e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)';
                    e.currentTarget.style.transform = 'translateY(0)';
                }}
            >
                <div style={{
                    width: '36px',
                    height: '36px',
                    background: 'rgba(255,215,0,0.1)',
                    borderRadius: '10px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0
                }}>
                    <FileText size={18} color="#FFD700" />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{
                        fontSize: '14px',
                        fontWeight: 600,
                        color: '#fff',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap'
                    }}>
                        {title}
                    </div>
                    {modelText && (
                        <div style={{
                            fontSize: '12px',
                            color: '#888',
                            marginTop: '2px'
                        }}>
                            {modelText}
                        </div>
                    )}
                </div>
                <ChevronRight size={16} color="#666" />
            </div>
        );
    }

    if (variant === 'reference') {
        return (
            <div
                onClick={onClick}
                style={{
                    background: 'rgba(255,255,255,0.02)',
                    border: '1px solid rgba(255,255,255,0.06)',
                    borderRadius: '12px',
                    padding: '16px',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '8px',
                    height: '100%'
                }}
                onMouseEnter={(e) => {
                    e.currentTarget.style.background = 'rgba(255,215,0,0.05)';
                    e.currentTarget.style.borderColor = 'rgba(255,215,0,0.2)';
                    e.currentTarget.style.transform = 'translateY(-2px)';
                    e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.2)';
                }}
                onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'rgba(255,255,255,0.02)';
                    e.currentTarget.style.borderColor = 'rgba(255,255,255,0.06)';
                    e.currentTarget.style.transform = 'translateY(0)';
                    e.currentTarget.style.boxShadow = 'none';
                }}
            >
                <div style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '10px'
                }}>
                    {productLine && (
                        <span style={{
                            padding: '3px 8px',
                            background: 'rgba(255,215,0,0.12)',
                            borderRadius: '6px',
                            fontSize: '11px',
                            fontWeight: 700,
                            color: '#FFD700',
                            flexShrink: 0
                        }}>
                            {productLine}
                        </span>
                    )}
                    <div style={{
                        fontSize: '14px',
                        fontWeight: 600,
                        color: '#fff',
                        lineHeight: '1.4',
                        flex: 1
                    }}>
                        {title}
                    </div>
                </div>
                
                {summary && (
                    <div style={{
                        fontSize: '12px',
                        color: '#888',
                        lineHeight: '1.5',
                        display: '-webkit-box',
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: 'vertical',
                        overflow: 'hidden'
                    }}>
                        {summary}
                    </div>
                )}
                
                <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    marginTop: 'auto',
                    paddingTop: '8px'
                }}>
                    {modelText && (
                        <span style={{ fontSize: '11px', color: '#666' }}>
                            {modelText}
                        </span>
                    )}
                    {category && (
                        <>
                            <span style={{ color: '#444' }}>·</span>
                            <span style={{ fontSize: '11px', color: '#666' }}>
                                {category}
                            </span>
                        </>
                    )}
                </div>
            </div>
        );
    }

    // Default variant
    return (
        <div
            onClick={onClick}
            style={{
                background: 'rgba(255,255,255,0.03)',
                border: '1px solid rgba(255,255,255,0.08)',
                borderRadius: '14px',
                padding: '18px',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                display: 'flex',
                flexDirection: 'column',
                gap: '10px'
            }}
            onMouseEnter={(e) => {
                e.currentTarget.style.background = 'rgba(255,215,0,0.05)';
                e.currentTarget.style.borderColor = 'rgba(255,215,0,0.25)';
                e.currentTarget.style.transform = 'translateY(-2px)';
            }}
            onMouseLeave={(e) => {
                e.currentTarget.style.background = 'rgba(255,255,255,0.03)';
                e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)';
                e.currentTarget.style.transform = 'translateY(0)';
            }}
        >
            <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px'
            }}>
                {productLine && (
                    <span style={{
                        width: '32px',
                        height: '32px',
                        background: 'rgba(255,215,0,0.12)',
                        borderRadius: '8px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '13px',
                        fontWeight: 700,
                        color: '#FFD700'
                    }}>
                        {productLine}
                    </span>
                )}
                <div style={{
                    fontSize: '15px',
                    fontWeight: 600,
                    color: '#fff',
                    flex: 1,
                    lineHeight: '1.4'
                }}>
                    {title}
                </div>
            </div>
            
            {summary && (
                <div style={{
                    fontSize: '13px',
                    color: '#888',
                    lineHeight: '1.5',
                    display: '-webkit-box',
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: 'vertical',
                    overflow: 'hidden'
                }}>
                    {summary}
                </div>
            )}
            
            <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                marginTop: '4px'
            }}>
                {modelText && (
                    <span style={{ fontSize: '12px', color: '#666' }}>
                        {modelText}
                    </span>
                )}
                {category && (
                    <>
                        <span style={{ color: '#444' }}>·</span>
                        <span style={{ fontSize: '12px', color: '#666' }}>
                            {category}
                        </span>
                    </>
                )}
            </div>
        </div>
    );
};

export default ArticleCard;
