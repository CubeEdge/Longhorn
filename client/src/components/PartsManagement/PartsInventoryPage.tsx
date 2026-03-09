/**
 * PartsInventoryPage
 * 配件库存管理页面
 */

import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import {
    Warehouse,
    Plus,
    Minus,
    Search,
    AlertTriangle,
    TrendingDown,
    Loader2,
    Building,
    DollarSign,
    Boxes
} from 'lucide-react';
import { useAuthStore } from '../../store/useAuthStore';

interface InventoryItem {
    id: number;
    part_id: number;
    part_sku: string;
    part_name: string;
    part_category: string;
    dealer_id?: number;
    dealer_name?: string;
    dealer_code?: string;
    quantity: number;
    reserved_quantity: number;
    available_quantity: number;
    min_stock_level: number;
    reorder_point: number;
    is_low_stock: boolean;
    is_critical: boolean;
    last_inbound_date?: string;
    last_outbound_date?: string;
}

interface InventoryStats {
    value: {
        total_cost_cny: number;
        total_value_cny: number;
        sku_count: number;
        total_quantity: number;
    };
    alerts: {
        low_stock_count: number;
        critical_count: number;
    };
    categories: Array<{
        category: string;
        sku_count: number;
        total_quantity: number;
        total_value_cny: number;
    }>;
}

const PartsInventoryPage: React.FC = () => {
    const { token, user } = useAuthStore();
    const headers = { Authorization: `Bearer ${token}` };

    const [inventory, setInventory] = useState<InventoryItem[]>([]);
    const [stats, setStats] = useState<InventoryStats | null>(null);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [showLowStockOnly, setShowLowStockOnly] = useState(false);

    const isAdmin = ['Admin', 'Lead', 'Exec'].includes(user?.role || '');

    const fetchInventory = useCallback(async () => {
        setLoading(true);
        try {
            const params: any = { page_size: 100 };
            if (searchTerm) params.search = searchTerm;
            if (showLowStockOnly) params.low_stock = 'true';

            const [inventoryRes, statsRes] = await Promise.all([
                axios.get('/api/v1/parts-inventory', { headers, params }),
                axios.get('/api/v1/parts-inventory/summary', { headers })
            ]);

            if (inventoryRes.data?.success) {
                setInventory(inventoryRes.data.data);
            }
            if (statsRes.data?.success) {
                setStats(statsRes.data.data);
            }
        } catch (err) {
            console.error('Failed to fetch inventory:', err);
        } finally {
            setLoading(false);
        }
    }, [searchTerm, showLowStockOnly, headers]);

    useEffect(() => {
        fetchInventory();
    }, [fetchInventory]);

    const formatCurrency = (value: number) => {
        return new Intl.NumberFormat('zh-CN', { style: 'currency', currency: 'CNY' }).format(value || 0);
    };

    return (
        <div style={{ padding: '24px', height: '100%', display: 'flex', flexDirection: 'column' }}>
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
                <div>
                    <h2 style={{ fontSize: '1.5rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 12 }}>
                        <Warehouse size={24} color="#10B981" />
                        库存管理
                    </h2>
                    <p style={{ color: 'var(--text-secondary)', marginTop: 4, fontSize: 13 }}>
                        总部及经销商配件库存监控与出入库管理
                    </p>
                </div>
                {isAdmin && (
                    <div style={{ display: 'flex', gap: 12 }}>
                        <button
                            style={{
                                padding: '10px 20px',
                                background: '#10B981',
                                border: 'none',
                                borderRadius: 8,
                                color: '#fff',
                                fontSize: 14,
                                fontWeight: 600,
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                gap: 8
                            }}
                        >
                            <Plus size={18} /> 入库
                        </button>
                        <button
                            style={{
                                padding: '10px 20px',
                                background: 'var(--glass-bg-hover)',
                                border: '1px solid var(--glass-border)',
                                borderRadius: 8,
                                color: 'var(--text-main)',
                                fontSize: 14,
                                fontWeight: 600,
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                gap: 8
                            }}
                        >
                            <Minus size={18} /> 出库
                        </button>
                    </div>
                )}
            </div>

            {/* Stats Cards */}
            {stats && (
                <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(4, 1fr)',
                    gap: 16,
                    marginBottom: 24
                }}>
                    <div style={{
                        background: 'var(--glass-bg)',
                        border: '1px solid var(--glass-border)',
                        borderRadius: 12,
                        padding: 16
                    }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
                            <div style={{
                                width: 40, height: 40, borderRadius: 10,
                                background: 'rgba(16,185,129,0.15)',
                                display: 'flex', alignItems: 'center', justifyContent: 'center'
                            }}>
                                <Boxes size={20} color="#10B981" />
                            </div>
                            <div>
                                <div style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>SKU种类</div>
                                <div style={{ fontSize: 20, fontWeight: 700 }}>{stats.value.sku_count}</div>
                            </div>
                        </div>
                        <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                            总库存: {stats.value.total_quantity} 件
                        </div>
                    </div>

                    <div style={{
                        background: 'var(--glass-bg)',
                        border: '1px solid var(--glass-border)',
                        borderRadius: 12,
                        padding: 16
                    }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
                            <div style={{
                                width: 40, height: 40, borderRadius: 10,
                                background: 'rgba(59,130,246,0.15)',
                                display: 'flex', alignItems: 'center', justifyContent: 'center'
                            }}>
                                <DollarSign size={20} color="#3B82F6" />
                            </div>
                            <div>
                                <div style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>库存价值</div>
                                <div style={{ fontSize: 20, fontWeight: 700 }}>{formatCurrency(stats.value.total_value_cny)}</div>
                            </div>
                        </div>
                        <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                            成本: {formatCurrency(stats.value.total_cost_cny)}
                        </div>
                    </div>

                    <div style={{
                        background: 'var(--glass-bg)',
                        border: stats.alerts.low_stock_count > 0 ? '1px solid rgba(245,158,11,0.5)' : '1px solid var(--glass-border)',
                        borderRadius: 12,
                        padding: 16
                    }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
                            <div style={{
                                width: 40, height: 40, borderRadius: 10,
                                background: stats.alerts.low_stock_count > 0 ? 'rgba(245,158,11,0.15)' : 'rgba(16,185,129,0.15)',
                                display: 'flex', alignItems: 'center', justifyContent: 'center'
                            }}>
                                <TrendingDown size={20} color={stats.alerts.low_stock_count > 0 ? '#F59E0B' : '#10B981'} />
                            </div>
                            <div>
                                <div style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>低库存预警</div>
                                <div style={{ fontSize: 20, fontWeight: 700, color: stats.alerts.low_stock_count > 0 ? '#F59E0B' : 'inherit' }}>
                                    {stats.alerts.low_stock_count}
                                </div>
                            </div>
                        </div>
                        <div style={{ fontSize: 12, color: stats.alerts.critical_count > 0 ? '#EF4444' : 'var(--text-secondary)' }}>
                            紧急缺货: {stats.alerts.critical_count}
                        </div>
                    </div>

                    <div style={{
                        background: 'var(--glass-bg)',
                        border: '1px solid var(--glass-border)',
                        borderRadius: 12,
                        padding: 16
                    }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
                            <div style={{
                                width: 40, height: 40, borderRadius: 10,
                                background: 'rgba(139,92,246,0.15)',
                                display: 'flex', alignItems: 'center', justifyContent: 'center'
                            }}>
                                <Building size={20} color="#8B5CF6" />
                            </div>
                            <div>
                                <div style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>库存位置</div>
                                <div style={{ fontSize: 20, fontWeight: 700 }}>总部+经销商</div>
                            </div>
                        </div>
                        <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                            点击查看详情
                        </div>
                    </div>
                </div>
            )}

            {/* Filters */}
            <div style={{ display: 'flex', gap: 12, marginBottom: 20 }}>
                <div style={{ position: 'relative', flex: 1, maxWidth: 400 }}>
                    <Search size={18} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#888' }} />
                    <input
                        type="text"
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                        placeholder="搜索SKU或配件名称..."
                        style={{
                            width: '100%',
                            padding: '10px 12px 10px 40px',
                            background: 'var(--glass-bg)',
                            border: '1px solid var(--glass-border)',
                            borderRadius: 8,
                            color: 'var(--text-main)',
                            fontSize: 14
                        }}
                    />
                </div>
                <button
                    onClick={() => setShowLowStockOnly(!showLowStockOnly)}
                    style={{
                        padding: '10px 16px',
                        background: showLowStockOnly ? 'rgba(245,158,11,0.2)' : 'var(--glass-bg)',
                        border: `1px solid ${showLowStockOnly ? '#F59E0B' : 'var(--glass-border)'}`,
                        borderRadius: 8,
                        color: showLowStockOnly ? '#F59E0B' : 'var(--text-main)',
                        fontSize: 14,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8
                    }}
                >
                    <AlertTriangle size={16} />
                    仅看低库存
                </button>
            </div>

            {/* Table */}
            <div style={{
                flex: 1,
                background: 'var(--glass-bg)',
                border: '1px solid var(--glass-border)',
                borderRadius: 12,
                overflow: 'auto'
            }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                        <tr style={{ borderBottom: '1px solid var(--glass-border)' }}>
                            <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: 12, fontWeight: 600, color: 'var(--text-tertiary)' }}>SKU</th>
                            <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: 12, fontWeight: 600, color: 'var(--text-tertiary)' }}>配件名称</th>
                            <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: 12, fontWeight: 600, color: 'var(--text-tertiary)' }}>位置</th>
                            <th style={{ padding: '12px 16px', textAlign: 'right', fontSize: 12, fontWeight: 600, color: 'var(--text-tertiary)' }}>当前库存</th>
                            <th style={{ padding: '12px 16px', textAlign: 'right', fontSize: 12, fontWeight: 600, color: 'var(--text-tertiary)' }}>可用库存</th>
                            <th style={{ padding: '12px 16px', textAlign: 'center', fontSize: 12, fontWeight: 600, color: 'var(--text-tertiary)' }}>状态</th>
                            <th style={{ padding: '12px 16px', textAlign: 'center', fontSize: 12, fontWeight: 600, color: 'var(--text-tertiary)' }}>操作</th>
                        </tr>
                    </thead>
                    <tbody>
                        {loading ? (
                            <tr>
                                <td colSpan={7} style={{ padding: 40, textAlign: 'center' }}>
                                    <Loader2 size={32} className="animate-spin" style={{ margin: '0 auto' }} />
                                </td>
                            </tr>
                        ) : inventory.length === 0 ? (
                            <tr>
                                <td colSpan={7} style={{ padding: 40, textAlign: 'center', color: 'var(--text-secondary)' }}>
                                    暂无库存数据
                                </td>
                            </tr>
                        ) : (
                            inventory.map(item => (
                                <tr key={item.id} style={{ borderBottom: '1px solid var(--glass-border)' }}>
                                    <td style={{ padding: '12px 16px', fontSize: 13, fontFamily: 'monospace', color: '#3B82F6' }}>{item.part_sku}</td>
                                    <td style={{ padding: '12px 16px', fontSize: 13 }}>
                                        <div>{item.part_name}</div>
                                        <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{item.part_category}</div>
                                    </td>
                                    <td style={{ padding: '12px 16px', fontSize: 13 }}>
                                        {item.dealer_name ? (
                                            <span style={{ color: '#8B5CF6' }}>{item.dealer_name}</span>
                                        ) : (
                                            <span style={{ color: '#10B981' }}>总部仓库</span>
                                        )}
                                    </td>
                                    <td style={{ padding: '12px 16px', fontSize: 13, textAlign: 'right', fontFamily: 'monospace' }}>
                                        {item.quantity}
                                    </td>
                                    <td style={{ padding: '12px 16px', fontSize: 13, textAlign: 'right', fontFamily: 'monospace' }}>
                                        {item.available_quantity}
                                    </td>
                                    <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                                        {item.is_critical ? (
                                            <span style={{
                                                padding: '2px 8px',
                                                borderRadius: 4,
                                                fontSize: 11,
                                                fontWeight: 600,
                                                background: 'rgba(239,68,68,0.2)',
                                                color: '#EF4444'
                                            }}>紧急</span>
                                        ) : item.is_low_stock ? (
                                            <span style={{
                                                padding: '2px 8px',
                                                borderRadius: 4,
                                                fontSize: 11,
                                                fontWeight: 600,
                                                background: 'rgba(245,158,11,0.2)',
                                                color: '#F59E0B'
                                            }}>低库存</span>
                                        ) : (
                                            <span style={{
                                                padding: '2px 8px',
                                                borderRadius: 4,
                                                fontSize: 11,
                                                fontWeight: 600,
                                                background: 'rgba(16,185,129,0.2)',
                                                color: '#10B981'
                                            }}>正常</span>
                                        )}
                                    </td>
                                    <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                                        <button
                                            onClick={() => {}}
                                            style={{
                                                padding: '6px 12px',
                                                background: 'var(--glass-bg-hover)',
                                                border: '1px solid var(--glass-border)',
                                                borderRadius: 4,
                                                color: 'var(--text-main)',
                                                fontSize: 12,
                                                cursor: 'pointer'
                                            }}
                                        >
                                            详情
                                        </button>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>

            {/* Category Distribution */}
            {stats && stats.categories.length > 0 && (
                <div style={{
                    marginTop: 24,
                    padding: 20,
                    background: 'var(--glass-bg)',
                    border: '1px solid var(--glass-border)',
                    borderRadius: 12
                }}>
                    <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 16 }}>分类分布</div>
                    <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
                        {stats.categories.map(cat => (
                            <div key={cat.category} style={{
                                padding: '12px 16px',
                                background: 'var(--glass-bg-hover)',
                                borderRadius: 8,
                                minWidth: 150
                            }}>
                                <div style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>{cat.category}</div>
                                <div style={{ fontSize: 18, fontWeight: 700, marginTop: 4 }}>{cat.sku_count} SKU</div>
                                <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>
                                    {cat.total_quantity} 件 · {formatCurrency(cat.total_value_cny)}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};

export default PartsInventoryPage;
