import React from 'react';
import { Package, Shield, Wifi } from 'lucide-react';

interface ProductSummary {
    model_name: string;
    serial_number: string;
    product_family: string;
    warranty_status: string;
    is_iot_device: boolean;
}

const PRODUCT_FAMILY_MAP: Record<string, { label: string; color: string }> = {
    'A': { label: '在售电影机', color: '#3B82F6' },
    'B': { label: '历史机型', color: '#6B7280' },
    'C': { label: '电子寻像器', color: '#10B981' },
    'D': { label: '通用配件', color: '#8B5CF6' }
};

interface ProductSummaryCardProps {
    product: ProductSummary;
    isWarrantyValid?: boolean;
    hideBadges?: boolean;
}

const ProductSummaryCard: React.FC<ProductSummaryCardProps> = ({ product, isWarrantyValid, hideBadges }) => {
    const familyInfo = PRODUCT_FAMILY_MAP[product.product_family] || { label: '未知', color: '#6B7280' };
    const valid = isWarrantyValid !== undefined ? isWarrantyValid : product.warranty_status === 'ACTIVE';

    return (
        <div style={{
            background: 'rgba(255, 210, 0, 0.05)',
            border: '1px solid rgba(255, 210, 0, 0.2)',
            borderRadius: 16,
            padding: 24,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: 24,
            boxShadow: '0 8px 32px rgba(255, 210, 0, 0.05)'
        }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
                <div style={{
                    width: 56,
                    height: 56,
                    borderRadius: 12,
                    background: 'rgba(255, 210, 0, 0.15)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#FFD200'
                }}>
                    <Package size={28} />
                </div>
                <div>
                    <h2 style={{ margin: 0, fontSize: '1.3rem', fontWeight: 800, color: '#fff', letterSpacing: '-0.02em' }}>
                        {product.model_name}
                    </h2>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 4, color: '#9CA3AF', fontSize: '0.85rem' }}>
                        <span style={{ fontFamily: 'monospace', fontWeight: 600 }}>{product.serial_number}</span>
                        <span style={{ color: 'rgba(255,255,255,0.1)' }}>|</span>
                        <span style={{ color: familyInfo.color, fontWeight: 700 }}>{familyInfo.label}</span>
                    </div>
                </div>
            </div>

            {!hideBadges && (
                <div style={{ display: 'flex', gap: 12 }}>
                    {Boolean(product.is_iot_device) && (
                        <div style={{
                            padding: '6px 14px',
                            borderRadius: 10,
                            background: 'rgba(59, 130, 246, 0.1)',
                            border: '1px solid rgba(59, 130, 246, 0.2)',
                            display: 'flex',
                            alignItems: 'center',
                            gap: 6,
                            color: '#60A5FA',
                            fontSize: '0.8rem',
                            fontWeight: 600
                        }}>
                            <Wifi size={14} /> IoT设备
                        </div>
                    )}
                    <div style={{
                        padding: '6px 14px',
                        borderRadius: 10,
                        background: valid ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                        border: `1px solid ${valid ? 'rgba(16, 185, 129, 0.2)' : 'rgba(239, 68, 68, 0.2)'}`,
                        display: 'flex',
                        alignItems: 'center',
                        gap: 6,
                        color: valid ? '#34D399' : '#F87171',
                        fontSize: '0.8rem',
                        fontWeight: 600
                    }}>
                        <Shield size={14} /> {valid ? '保修期内' : '过期/保修外'}
                    </div>
                </div>
            )}
        </div>
    );
};

export default ProductSummaryCard;
