import React from 'react';
import { RefreshCw, Wrench, MessageCircleQuestion, Ticket } from 'lucide-react';
import { useLanguage } from '../i18n/useLanguage';

export const getTicketStyles = (type: string | undefined, t: any, isDark = true) => {
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
                label: (t as any)('wiki.ticket.inquiry', '咨询工单')
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
                label: (t as any)('wiki.ticket.rma', 'RMA')
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
                label: (t as any)('wiki.ticket.dealer_repair', '经销商维修')
            };
        default:
            return {
                bg: isDark ? 'rgba(16, 185, 129, 0.1)' : 'rgba(16, 185, 129, 0.15)',
                border: isDark ? 'rgba(16, 185, 129, 0.3)' : 'rgba(16, 185, 129, 0.4)',
                hoverBg: isDark ? 'rgba(16, 185, 129, 0.2)' : 'rgba(16, 185, 129, 0.25)',
                hoverBorder: isDark ? 'rgba(16, 185, 129, 0.5)' : 'rgba(16, 185, 129, 0.6)',
                color: '#10B981', // Kine Green
                icon: <Ticket size={14} />,
                label: type === 'maintenance' ? (t as any)('wiki.ticket.maintenance', '维护记录') : (type || (t as any)('common.all', '全部'))
            };
    }
};

export const TicketCard: React.FC<any> = ({ ticketNumber, ticketType, title, status, productModel, customerName, contactName, onClick }) => {
    const { t } = useLanguage();
    const styles = getTicketStyles(ticketType, t);

    const tText = (key: string, defaultText: string) => {
        const text = (t as any)(key, { defaultValue: defaultText });
        return text === key ? defaultText : text;
    };

    const translateStatus = (s: string) => {
        const map: Record<string, string> = {
            'Draft': tText('common.draft', '草稿'),
            'Open': tText('common.open', '待处理'),
            'InProgress': tText('common.inprogress', '处理中'),
            'Pending': tText('common.pending', '待定'),
            'Diagnosing': tText('common.diagnosing', '诊断中'),
            'Resolved': tText('common.resolved', '已解决'),
            'Closed': tText('common.closed', '已关闭'),
            'Cancelled': tText('common.cancelled', '已取消'),
            'Completed': tText('common.completed', '已完成'),
            // Fallback for raw keys from backend
            'common.inprogress': '处理中',
            'common.resolved': '已解决',
            'common.open': '待处理',
            'common.completed': '已完成'
        };
        let trans = s ? (map[s] || s) : '';
        if (trans.startsWith('common.')) {
            const cleanKeyStr = trans.replace('common.', '');
            trans = map[cleanKeyStr] || trans; // attempt re-map
        }
        return trans;
    };

    return (
        <div onClick={onClick} style={{
            padding: '12px',
            background: 'rgba(255,255,255,0.02)',
            border: `1px solid ${styles.border}`,
            borderRadius: '8px',
            cursor: 'pointer',
            transition: 'all 0.2s',
            borderLeft: `3px solid ${styles.color}`,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            height: '100%',
            minHeight: '120px'
        }}
            onMouseEnter={e => {
                e.currentTarget.style.background = styles.hoverBg;
                e.currentTarget.style.borderColor = styles.hoverBorder;
                e.currentTarget.style.borderLeftColor = styles.color;
            }}
            onMouseLeave={e => {
                e.currentTarget.style.background = 'rgba(255,255,255,0.02)';
                e.currentTarget.style.borderColor = styles.border;
                e.currentTarget.style.borderLeftColor = styles.color;
            }}
        >
            <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                    <span style={{ fontSize: '12px', color: 'var(--text-secondary)', fontFamily: 'monospace', display: 'flex', alignItems: 'center', gap: '6px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        <span style={{ color: styles.color, display: 'flex', flexShrink: 0 }}>{styles.icon}</span>
                        {ticketNumber || `TICKET-${Math.floor(Math.random() * 1000)}`}
                    </span>
                    <span style={{ fontSize: '11px', padding: '2px 6px', borderRadius: '4px', background: styles.bg, color: styles.color, whiteSpace: 'nowrap', flexShrink: 0, marginLeft: '8px' }}>
                        {translateStatus(status) || styles.label}
                    </span>
                </div>
                <div style={{
                    fontSize: '13.5px',
                    fontWeight: 500,
                    color: 'var(--text-main)',
                    display: '-webkit-box',
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: 'vertical',
                    overflow: 'hidden',
                    whiteSpace: 'normal',
                    lineHeight: '1.4',
                    minHeight: '2.8em'
                }}>
                    {title}
                </div>
            </div>
            <div style={{ marginTop: '12px', display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                {productModel && (
                    <span style={{ fontSize: '11px', color: 'var(--text-secondary)', background: 'rgba(255,255,255,0.05)', padding: '2px 6px', borderRadius: '4px' }}>
                        {productModel}
                    </span>
                )}
                {(() => {
                    const isValid = (name?: string) => name && name !== 'null' && name !== 'undefined';
                    const validCus = isValid(customerName) ? customerName : '';
                    const validCon = isValid(contactName) ? contactName : '';
                    if (!validCus && !validCon) return null;

                    let display = '';
                    if (validCus && validCon && validCus !== validCon) {
                        display = `${validCus} | ${validCon}`;
                    } else {
                        display = validCus || validCon;
                    }

                    return (
                        <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                            {display}
                        </span>
                    );
                })()}
            </div>
        </div>
    );
};
