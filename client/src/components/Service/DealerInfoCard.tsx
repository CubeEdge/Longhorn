import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Building, ChevronRight, User, Hash } from 'lucide-react';

interface DealerInfoCardProps {
    dealerId?: number | null;
    dealerName?: string | null;
    dealerCode?: string | null;
    contactName?: string | null;
    contactTitle?: string | null;
}

/**
 * 经销商信息卡片组件
 * 用于在工单详情页展示经销商信息，点击可跳转到经销商详情页
 * 
 * UI设计遵循 macOS26 风格，主题色 Kine Yellow (#FFD700)
 */
const DealerInfoCard: React.FC<DealerInfoCardProps> = ({
    dealerId,
    dealerName,
    dealerCode,
    contactName,
    contactTitle
}) => {
    const navigate = useNavigate();

    // 如果没有经销商信息，不渲染
    if (!dealerId && !dealerName) {
        return null;
    }

    const handleClick = () => {
        if (dealerId) {
            navigate(`/service/dealers/${dealerId}?type=Dealer`);
        }
    };

    return (
        <div
            onClick={handleClick}
            style={{
                background: 'rgba(255, 215, 0, 0.08)',
                border: '1px solid rgba(255, 215, 0, 0.2)',
                borderRadius: '12px',
                padding: '16px',
                marginBottom: '20px',
                cursor: dealerId ? 'pointer' : 'default',
                transition: 'all 0.2s ease',
            }}
            onMouseEnter={(e) => {
                if (dealerId) {
                    e.currentTarget.style.background = 'rgba(255, 215, 0, 0.12)';
                    e.currentTarget.style.borderColor = 'rgba(255, 215, 0, 0.35)';
                }
            }}
            onMouseLeave={(e) => {
                e.currentTarget.style.background = 'rgba(255, 215, 0, 0.08)';
                e.currentTarget.style.borderColor = 'rgba(255, 215, 0, 0.2)';
            }}
        >
            {/* Header with icon and title */}
            <div style={{ 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'space-between',
                marginBottom: '12px'
            }}>
                <div style={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    gap: '8px'
                }}>
                    <div style={{
                        width: '32px',
                        height: '32px',
                        borderRadius: '8px',
                        background: 'linear-gradient(135deg, #FFD700, #F5A623)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                    }}>
                        <Building size={16} color="#000" />
                    </div>
                    <span style={{ 
                        fontSize: '0.75rem', 
                        textTransform: 'uppercase', 
                        letterSpacing: '0.05em',
                        color: 'rgba(255, 215, 0, 0.8)',
                        fontWeight: 600 
                    }}>
                        经销商
                    </span>
                </div>
                {dealerId && (
                    <ChevronRight size={16} color="rgba(255, 215, 0, 0.6)" />
                )}
            </div>

            {/* Dealer Name */}
            <div style={{ 
                fontSize: '1.1rem', 
                fontWeight: 700, 
                color: '#fff',
                marginBottom: '8px'
            }}>
                {dealerName || '未知经销商'}
            </div>

            {/* Dealer Code & Contact */}
            <div style={{ 
                display: 'flex', 
                flexWrap: 'wrap',
                gap: '12px',
                fontSize: '0.85rem',
                color: 'rgba(255, 255, 255, 0.6)'
            }}>
                {dealerCode && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <Hash size={12} />
                        <span>{dealerCode}</span>
                    </div>
                )}
                {contactName && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <User size={12} />
                        <span>
                            {contactName}
                            {contactTitle && <span style={{ opacity: 0.7 }}> · {contactTitle}</span>}
                        </span>
                    </div>
                )}
            </div>
        </div>
    );
};

export default DealerInfoCard;
