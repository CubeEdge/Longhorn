import React from 'react';
import { Package } from 'lucide-react';

export const ProductCard: React.FC<any> = ({ productName, serialNumber, warrantyStatus, familyColor, onClick }) => {
    return (
        <div onClick={onClick} style={{
            padding: '10px 14px',
            background: 'rgba(0,0,0,0.2)', // Darker, flat background
            border: `1px solid var(--glass-bg-light)`,
            borderRadius: '10px',
            cursor: onClick ? 'pointer' : 'default',
            transition: 'all 0.2s',
            display: 'flex',
            alignItems: 'center',
            gap: '12px'
        }}
            onMouseEnter={e => {
                if (onClick) {
                    e.currentTarget.style.background = 'var(--glass-bg-light)';
                    e.currentTarget.style.borderColor = 'var(--glass-bg-hover)';
                }
            }}
            onMouseLeave={e => {
                if (onClick) {
                    e.currentTarget.style.background = 'rgba(0,0,0,0.2)';
                    e.currentTarget.style.borderColor = 'var(--glass-bg-light)';
                }
            }}
        >
            <div style={{
                width: '36px', height: '36px', borderRadius: '8px',
                background: 'var(--glass-bg-light)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                flexShrink: 0
            }}>
                <Package size={18} color={familyColor || 'var(--accent-blue)'} />
            </div>

            <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column', gap: '3px' }}>
                <div style={{ fontSize: '14.5px', fontWeight: 600, color: 'var(--text-main)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {productName}
                </div>
                <div style={{ fontSize: '12px', color: '#777', fontFamily: 'monospace' }}>
                    SN: {serialNumber}
                </div>
            </div>

            <div style={{ display: 'flex', flexShrink: 0 }}>
                <span
                    style={{
                        padding: '4px 10px',
                        borderRadius: '12px',
                        fontSize: '11px',
                        background: warrantyStatus === '在保' || warrantyStatus === 'Active'
                            ? 'rgba(16, 185, 129, 0.15)' : 'rgba(156, 163, 175, 0.1)',
                        color: warrantyStatus === '在保' || warrantyStatus === 'Active'
                            ? '#34d399' : '#9ca3af',
                        fontWeight: 600
                    }}
                >
                    {warrantyStatus === 'Active' ? '在保' : warrantyStatus}
                </span>
            </div>
        </div>
    );
};
