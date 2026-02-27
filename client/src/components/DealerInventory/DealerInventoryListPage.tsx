/**
 * DealerInventoryListPage
 * 经销商配件库存列表页面
 * 
 * 功能：
 * - 显示当前库存
 * - 低库存预警
 * - 库存交易记录
 * - 创建补货订单入口
 */

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '../../i18n/useLanguage';
import axios from 'axios';
import {
    Package, AlertTriangle, Plus, ChevronRight,
    RefreshCw, TrendingDown, ArrowUpRight,
    Loader2, Search
} from 'lucide-react';
import { useAuthStore } from '../../store/useAuthStore';

interface InventoryItem {
    id: number;
    dealer: { id: number; name: string; code: string };
    part: { id: number; number: string; name: string; category: string };
    quantity: number;
    reserved_quantity: number;
    available_quantity: number;
    min_stock_level: number;
    reorder_point: number;
    is_low_stock: boolean;
    last_inbound_date: string | null;
    last_outbound_date: string | null;
    updated_at: string;
}

interface LowStockAlert {
    dealer: { id: number; name: string };
    part: { id: number; number: string; name: string; category: string };
    current_quantity: number;
    reorder_point: number;
    shortage: number;
}

const DealerInventoryListPage: React.FC = () => {
    const { t } = useLanguage();
    const navigate = useNavigate();
    const { token, user } = useAuthStore();
    const headers = { Authorization: `Bearer ${token}` };

    const [inventory, setInventory] = useState<InventoryItem[]>([]);
    const [lowStockAlerts, setLowStockAlerts] = useState<LowStockAlert[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [showLowStockOnly, setShowLowStockOnly] = useState(false);
    const [selectedCategory, setSelectedCategory] = useState<string>('');
    const [categories, setCategories] = useState<string[]>([]);

    const isDealer = user?.user_type === 'Dealer';

    useEffect(() => {
        fetchInventory();
        fetchLowStockAlerts();
    }, [showLowStockOnly, selectedCategory]);

    const fetchInventory = async () => {
        setLoading(true);
        try {
            const params: any = { page_size: 200 };
            if (showLowStockOnly) params.low_stock = 'true';
            if (selectedCategory) params.category = selectedCategory;

            const res = await axios.get('/api/v1/dealer-inventory', { headers, params });
            if (res.data?.success) {
                setInventory(res.data.data);
                // 提取唯一的分类
                const cats = [...new Set(res.data.data.map((i: InventoryItem) => i.part.category))].filter(Boolean) as string[];
                setCategories(cats);
            }
        } catch (err) {
            console.error('Failed to fetch inventory:', err);
        } finally {
            setLoading(false);
        }
    };

    const fetchLowStockAlerts = async () => {
        try {
            const res = await axios.get('/api/v1/dealer-inventory/low-stock', { headers });
            if (res.data?.success) {
                setLowStockAlerts(res.data.data);
            }
        } catch (err) {
            console.error('Failed to fetch low stock alerts:', err);
        }
    };

    // 筛选库存
    const filteredInventory = inventory.filter(item => {
        if (searchTerm) {
            const term = searchTerm.toLowerCase();
            return item.part.name.toLowerCase().includes(term) ||
                item.part.number.toLowerCase().includes(term) ||
                item.dealer.name.toLowerCase().includes(term);
        }
        return true;
    });

    // 统计数据
    const totalItems = inventory.length;
    const lowStockCount = inventory.filter(i => i.is_low_stock).length;

    return (
        <div className="fade-in" style={{ padding: '32px 40px', maxWidth: 1400, margin: '0 auto' }}>
            {/* 页头 */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 32 }}>
                <div>
                    <h1 style={{ fontSize: '1.8rem', fontWeight: 800, marginBottom: 8 }}>
                        {t('inventory.title') || '配件库存'}
                    </h1>
                    <p style={{ color: 'var(--text-secondary)', marginTop: 4 }}>
                        {isDealer
                            ? t('inventory.dealer_desc') || '查看和管理您的配件库存'
                            : t('inventory.admin_desc') || '管理所有经销商的配件库存'
                        }
                    </p>
                </div>
                <div style={{ display: 'flex', gap: 12 }}>
                    <button
                        className="btn-glass"
                        onClick={fetchInventory}
                        style={{ display: 'flex', alignItems: 'center', gap: 8 }}
                    >
                        <RefreshCw size={16} />
                        {t('common.refresh') || '刷新'}
                    </button>
                    <button
                        className="btn-primary"
                        onClick={() => navigate('/service/inventory/restock/new')}
                        style={{ display: 'flex', alignItems: 'center', gap: 8 }}
                    >
                        <Plus size={16} />
                        {t('inventory.create_restock') || '创建补货订单'}
                    </button>
                </div>
            </div>

            {/* 低库存预警卡片 */}
            {lowStockAlerts.length > 0 && (
                <div style={{
                    background: 'linear-gradient(135deg, rgba(255, 193, 7, 0.15) 0%, rgba(255, 152, 0, 0.1) 100%)',
                    border: '1px solid rgba(255, 193, 7, 0.3)',
                    borderRadius: 16,
                    padding: 20,
                    marginBottom: 24
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
                        <AlertTriangle size={20} style={{ color: '#FFC107' }} />
                        <span style={{ fontWeight: 600, fontSize: '1rem' }}>
                            {t('inventory.low_stock_alert') || '低库存预警'} ({lowStockAlerts.length})
                        </span>
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
                        {lowStockAlerts.slice(0, 5).map((alert, idx) => (
                            <div key={idx} style={{
                                background: 'rgba(0, 0, 0, 0.3)',
                                borderRadius: 12,
                                padding: '12px 16px',
                                display: 'flex',
                                alignItems: 'center',
                                gap: 12,
                                minWidth: 200
                            }}>
                                <TrendingDown size={16} style={{ color: '#ff6b6b' }} />
                                <div>
                                    <div style={{ fontWeight: 500, fontSize: '0.9rem' }}>{alert.part.name}</div>
                                    <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                                        {alert.current_quantity} / {alert.reorder_point} ({t('inventory.need') || '需补'} {alert.shortage})
                                    </div>
                                </div>
                            </div>
                        ))}
                        {lowStockAlerts.length > 5 && (
                            <button
                                onClick={() => setShowLowStockOnly(true)}
                                style={{
                                    background: 'rgba(255, 193, 7, 0.2)',
                                    border: 'none',
                                    borderRadius: 12,
                                    padding: '12px 16px',
                                    color: '#FFC107',
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 8
                                }}
                            >
                                {t('common.view_all') || '查看全部'} <ChevronRight size={14} />
                            </button>
                        )}
                    </div>
                </div>
            )}

            {/* 统计卡片 */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16, marginBottom: 24 }}>
                <div style={{
                    background: 'rgba(255,255,255,0.03)',
                    borderRadius: 16,
                    padding: 20,
                    border: '1px solid var(--glass-border)'
                }}>
                    <div className="hint" style={{ fontSize: '0.75rem', marginBottom: 8 }}>{t('inventory.total_items') || '配件种类'}</div>
                    <div style={{ fontSize: '1.8rem', fontWeight: 700 }}>{totalItems}</div>
                </div>
                <div style={{
                    background: lowStockCount > 0 ? 'rgba(255, 193, 7, 0.1)' : 'rgba(255,255,255,0.03)',
                    borderRadius: 16,
                    padding: 20,
                    border: lowStockCount > 0 ? '1px solid rgba(255, 193, 7, 0.3)' : '1px solid var(--glass-border)'
                }}>
                    <div className="hint" style={{ fontSize: '0.75rem', marginBottom: 8 }}>{t('inventory.low_stock') || '低库存'}</div>
                    <div style={{ fontSize: '1.8rem', fontWeight: 700, color: lowStockCount > 0 ? '#FFC107' : undefined }}>
                        {lowStockCount}
                    </div>
                </div>
                <div
                    style={{
                        background: 'rgba(255,255,255,0.03)',
                        borderRadius: 16,
                        padding: 20,
                        border: '1px solid var(--glass-border)',
                        cursor: 'pointer'
                    }}
                    onClick={() => navigate('/service/inventory/restock')}
                >
                    <div className="hint" style={{ fontSize: '0.75rem', marginBottom: 8 }}>{t('inventory.restock_orders') || '补货订单'}</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <ArrowUpRight size={18} />
                        <span style={{ fontSize: '0.9rem' }}>{t('common.view') || '查看'}</span>
                    </div>
                </div>
            </div>

            {/* 筛选栏 */}
            <div style={{
                display: 'flex',
                gap: 12,
                marginBottom: 20,
                flexWrap: 'wrap'
            }}>
                <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    background: 'rgba(255,255,255,0.05)',
                    padding: '8px 16px',
                    borderRadius: 30,
                    flex: 1,
                    maxWidth: 400
                }}>
                    <Search size={16} style={{ opacity: 0.5 }} />
                    <input
                        type="text"
                        placeholder={t('inventory.search_placeholder') || '搜索配件名称或编号...'}
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                        style={{
                            background: 'transparent',
                            border: 'none',
                            outline: 'none',
                            color: 'white',
                            width: '100%'
                        }}
                    />
                </div>

                <select
                    value={selectedCategory}
                    onChange={e => setSelectedCategory(e.target.value)}
                    className="form-control"
                    style={{ width: 'auto', minWidth: 150 }}
                >
                    <option value="">{t('inventory.all_categories') || '全部分类'}</option>
                    {categories.map(cat => (
                        <option key={cat} value={cat}>{cat}</option>
                    ))}
                </select>

                <label style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    padding: '8px 16px',
                    background: showLowStockOnly ? 'rgba(255, 193, 7, 0.2)' : 'rgba(255,255,255,0.05)',
                    borderRadius: 30,
                    cursor: 'pointer',
                    border: showLowStockOnly ? '1px solid rgba(255, 193, 7, 0.5)' : '1px solid transparent'
                }}>
                    <input
                        type="checkbox"
                        checked={showLowStockOnly}
                        onChange={e => setShowLowStockOnly(e.target.checked)}
                        style={{ accentColor: '#FFD700' }}
                    />
                    <span style={{ fontSize: '0.9rem' }}>{t('inventory.show_low_stock_only') || '仅显示低库存'}</span>
                </label>
            </div>

            {/* 库存列表 */}
            {loading ? (
                <div style={{ textAlign: 'center', padding: 60 }}>
                    <Loader2 size={32} className="animate-spin" style={{ opacity: 0.5 }} />
                </div>
            ) : filteredInventory.length === 0 ? (
                <div style={{
                    textAlign: 'center',
                    padding: 60,
                    background: 'rgba(255,255,255,0.02)',
                    borderRadius: 16,
                    border: '1px solid var(--glass-border)'
                }}>
                    <Package size={48} style={{ opacity: 0.3, marginBottom: 16 }} />
                    <p className="hint">{t('inventory.no_items') || '暂无库存数据'}</p>
                </div>
            ) : (
                <div style={{
                    background: 'rgba(255,255,255,0.02)',
                    borderRadius: 16,
                    border: '1px solid var(--glass-border)',
                    overflow: 'hidden'
                }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead>
                            <tr style={{ background: 'rgba(255,255,255,0.03)' }}>
                                <th style={{ padding: '14px 20px', textAlign: 'left', fontSize: '0.75rem', fontWeight: 600, opacity: 0.6 }}>
                                    {t('inventory.part') || '配件'}
                                </th>
                                <th style={{ padding: '14px 20px', textAlign: 'left', fontSize: '0.75rem', fontWeight: 600, opacity: 0.6 }}>
                                    {t('inventory.category') || '分类'}
                                </th>
                                {!isDealer && (
                                    <th style={{ padding: '14px 20px', textAlign: 'left', fontSize: '0.75rem', fontWeight: 600, opacity: 0.6 }}>
                                        {t('inventory.dealer') || '经销商'}
                                    </th>
                                )}
                                <th style={{ padding: '14px 20px', textAlign: 'center', fontSize: '0.75rem', fontWeight: 600, opacity: 0.6 }}>
                                    {t('inventory.quantity') || '库存数量'}
                                </th>
                                <th style={{ padding: '14px 20px', textAlign: 'center', fontSize: '0.75rem', fontWeight: 600, opacity: 0.6 }}>
                                    {t('inventory.reorder_point') || '补货点'}
                                </th>
                                <th style={{ padding: '14px 20px', textAlign: 'center', fontSize: '0.75rem', fontWeight: 600, opacity: 0.6 }}>
                                    {t('inventory.status') || '状态'}
                                </th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredInventory.map(item => (
                                <tr
                                    key={item.id}
                                    style={{
                                        borderTop: '1px solid var(--glass-border)',
                                        background: item.is_low_stock ? 'rgba(255, 193, 7, 0.05)' : undefined
                                    }}
                                >
                                    <td style={{ padding: '14px 20px' }}>
                                        <div style={{ fontWeight: 500 }}>{item.part.name}</div>
                                        <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                                            {item.part.number}
                                        </div>
                                    </td>
                                    <td style={{ padding: '14px 20px', color: 'var(--text-secondary)' }}>
                                        {item.part.category || '-'}
                                    </td>
                                    {!isDealer && (
                                        <td style={{ padding: '14px 20px' }}>
                                            <div>{item.dealer.name}</div>
                                            <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                                                {item.dealer.code}
                                            </div>
                                        </td>
                                    )}
                                    <td style={{ padding: '14px 20px', textAlign: 'center' }}>
                                        <span style={{
                                            fontWeight: 600,
                                            fontSize: '1.1rem',
                                            color: item.is_low_stock ? '#FFC107' : undefined
                                        }}>
                                            {item.quantity}
                                        </span>
                                    </td>
                                    <td style={{ padding: '14px 20px', textAlign: 'center', color: 'var(--text-secondary)' }}>
                                        {item.reorder_point}
                                    </td>
                                    <td style={{ padding: '14px 20px', textAlign: 'center' }}>
                                        {item.is_low_stock ? (
                                            <span style={{
                                                display: 'inline-flex',
                                                alignItems: 'center',
                                                gap: 6,
                                                padding: '4px 12px',
                                                background: 'rgba(255, 193, 7, 0.2)',
                                                color: '#FFC107',
                                                borderRadius: 20,
                                                fontSize: '0.8rem',
                                                fontWeight: 500
                                            }}>
                                                <AlertTriangle size={12} />
                                                {t('inventory.low') || '低库存'}
                                            </span>
                                        ) : (
                                            <span style={{
                                                padding: '4px 12px',
                                                background: 'rgba(16, 185, 129, 0.15)',
                                                color: '#10B981',
                                                borderRadius: 20,
                                                fontSize: '0.8rem',
                                                fontWeight: 500
                                            }}>
                                                {t('inventory.normal') || '正常'}
                                            </span>
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
};

export default DealerInventoryListPage;
