import React from 'react';
import { MessageSquare, Wrench, HelpCircle, ChevronRight } from 'lucide-react';

interface TicketCardProps {
    id: number;
    ticketNumber: string;
    ticketType: 'inquiry' | 'rma' | 'dealer_repair';
    title: string;
    status: string;
    productModel?: string;
    createdAt?: string;
    onClick: () => void;
    variant?: 'default' | 'compact';
}

const ticketTypeConfig = {
    inquiry: {
        label: '咨询',
        icon: HelpCircle,
        color: '#3B82F6',
        bgColor: 'rgba(59, 130, 246, 0.1)'
    },
    rma: {
        label: 'RMA',
        icon: Wrench,
        color: '#EF4444',
        bgColor: 'rgba(239, 68, 68, 0.1)'
    },
    dealer_repair: {
        label: '维修',
        icon: MessageSquare,
        color: '#F59E0B',
        bgColor: 'rgba(245, 158, 11, 0.1)'
    }
};

const statusMap: Record<string, string> = {
    'Open': '待处理',
    'In Progress': '处理中',
    'Pending': '待确认',
    'Resolved': '已解决',
    'Closed': '已关闭',
    'Cancelled': '已取消'
};

export const TicketCard: React.FC<TicketCardProps> = ({
    ticketNumber,
    ticketType,
    title,
    status,
    productModel,
    onClick,
    variant = 'default'
}) => {
    const config = ticketTypeConfig[ticketType];
    const Icon = config.icon;

    if (variant === 'compact') {
        return (
            <div
                onClick={onClick}
                style={{
                    background: 'rgba(255,255,255,0.03)',
                    border: '1px solid rgba(255,255,255,0.08)',
                    borderRadius: '10px',
                    padding: '12px 14px',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px'
                }}
                onMouseEnter={(e) => {
                    e.currentTarget.style.background = config.bgColor;
                    e.currentTarget.style.borderColor = `${config.color}40`;
                }}
                onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'rgba(255,255,255,0.03)';
                    e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)';
                }}
            >
                <div style={{
                    width: '32px',
                    height: '32px',
                    background: config.bgColor,
                    borderRadius: '8px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0
                }}>
                    <Icon size={16} color={config.color} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{
                        fontSize: '13px',
                        fontWeight: 600,
                        color: '#fff',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap'
                    }}>
                        {title}
                    </div>
                    <div style={{
                        fontSize: '11px',
                        color: '#666',
                        marginTop: '2px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px'
                    }}>
                        <span>{ticketNumber}</span>
                        <span style={{ color: '#444' }}>·</span>
                        <span style={{ color: config.color }}>{config.label}</span>
                    </div>
                </div>
                <ChevronRight size={14} color="#666" />
            </div>
        );
    }

    return (
        <div
            onClick={onClick}
            style={{
                background: 'rgba(255,255,255,0.03)',
                border: '1px solid rgba(255,255,255,0.08)',
                borderRadius: '12px',
                padding: '16px',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                display: 'flex',
                flexDirection: 'column',
                gap: '10px'
            }}
            onMouseEnter={(e) => {
                e.currentTarget.style.background = config.bgColor;
                e.currentTarget.style.borderColor = `${config.color}40`;
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
                gap: '10px'
            }}>
                <div style={{
                    width: '36px',
                    height: '36px',
                    background: config.bgColor,
                    borderRadius: '10px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0
                }}>
                    <Icon size={18} color={config.color} />
                </div>
                <div style={{
                    padding: '3px 10px',
                    background: config.bgColor,
                    borderRadius: '6px',
                    fontSize: '12px',
                    fontWeight: 600,
                    color: config.color
                }}>
                    {config.label}
                </div>
                <div style={{
                    fontSize: '12px',
                    color: '#666',
                    fontFamily: 'monospace'
                }}>
                    {ticketNumber}
                </div>
            </div>

            <div style={{
                fontSize: '14px',
                fontWeight: 600,
                color: '#fff',
                lineHeight: '1.4'
            }}>
                {title}
            </div>

            <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                marginTop: '4px'
            }}>
                {productModel && (
                    <span style={{ fontSize: '12px', color: '#888' }}>
                        {productModel}
                    </span>
                )}
                <span style={{ color: '#444' }}>·</span>
                <span style={{
                    fontSize: '12px',
                    color: status === 'Closed' || status === 'Resolved' ? '#10B981' : '#888'
                }}>
                    {statusMap[status] || status}
                </span>
            </div>
        </div>
    );
};

export default TicketCard;
