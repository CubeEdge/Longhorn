/**
 * PartsManagementPage
 * 统一配件管理入口
 *
 * 整合功能：
 * - 配件目录 (Part Master)
 * - 库存管理 (Inventory)
 * - 消耗记录 (Consumption)
 * - 结算管理 (Settlement)
 */

import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    Package,
    Warehouse,
    ClipboardList,
    Calculator,
    ChevronRight,
    TrendingUp,
    AlertCircle
} from 'lucide-react';


type TabType = 'catalog' | 'inventory' | 'consumption' | 'settlement';

const PartsManagementPage: React.FC = () => {
    const navigate = useNavigate();
    const [activeTab, setActiveTab] = useState<TabType>('catalog');

    const tabs = [
        {
            id: 'catalog' as TabType,
            label: '配件目录',
            description: 'SKU管理、价格、兼容性',
            icon: Package,
            color: '#3B82F6',
            path: '/service/parts/catalog'
        },
        {
            id: 'inventory' as TabType,
            label: '库存管理',
            description: '总部及经销商库存',
            icon: Warehouse,
            color: '#10B981',
            path: '/service/parts/inventory'
        },
        {
            id: 'consumption' as TabType,
            label: '消耗记录',
            description: '维修配件使用记录',
            icon: ClipboardList,
            color: '#F59E0B',
            path: '/service/parts/consumption'
        },
        {
            id: 'settlement' as TabType,
            label: '结算管理',
            description: '经销商配件结算',
            icon: Calculator,
            color: '#8B5CF6',
            path: '/service/parts/settlement'
        }
    ];

    const stats = [
        { label: '配件SKU总数', value: '74', trend: '+3', icon: Package },
        { label: '低库存预警', value: '5', trend: '-2', icon: AlertCircle, alert: true },
        { label: '本月消耗', value: '¥128,500', trend: '+12%', icon: TrendingUp },
        { label: '待结算金额', value: '¥45,200', trend: '3单', icon: Calculator }
    ];

    return (
        <div className="fade-in" style={{ padding: '24px', height: '100%', display: 'flex', flexDirection: 'column' }}>
            {/* Header */}
            <div style={{ marginBottom: 24 }}>
                <h2 style={{ fontSize: '1.8rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 12 }}>
                    <Package size={28} color="#FFD700" />
                    配件管理
                </h2>
                <p style={{ color: 'var(--text-secondary)', marginTop: 4 }}>
                    统一配件目录、库存、消耗及结算管理
                </p>
            </div>

            {/* Stats Cards */}
            <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(4, 1fr)',
                gap: 16,
                marginBottom: 24
            }}>
                {stats.map((stat, index) => (
                    <div
                        key={index}
                        style={{
                            background: 'var(--glass-bg)',
                            border: '1px solid var(--glass-border)',
                            borderRadius: 12,
                            padding: 16,
                            display: 'flex',
                            alignItems: 'center',
                            gap: 12
                        }}
                    >
                        <div style={{
                            width: 48,
                            height: 48,
                            borderRadius: 10,
                            background: stat.alert ? 'rgba(239,68,68,0.15)' : 'rgba(255,215,0,0.15)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center'
                        }}>
                            <stat.icon size={24} color={stat.alert ? '#EF4444' : '#FFD700'} />
                        </div>
                        <div>
                            <div style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>{stat.label}</div>
                            <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-main)' }}>{stat.value}</div>
                            <div style={{ fontSize: 11, color: stat.trend.startsWith('+') ? '#10B981' : '#888' }}>
                                {stat.trend}
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            {/* Tab Navigation */}
            <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(4, 1fr)',
                gap: 16,
                flex: 1
            }}>
                {tabs.map((tab) => {
                    const Icon = tab.icon;
                    const isActive = activeTab === tab.id;

                    return (
                        <div
                            key={tab.id}
                            onClick={() => {
                                setActiveTab(tab.id);
                                navigate(tab.path);
                            }}
                            style={{
                                background: isActive ? `${tab.color}15` : 'var(--glass-bg)',
                                border: `1px solid ${isActive ? tab.color : 'var(--glass-border)'}`,
                                borderRadius: 12,
                                padding: 24,
                                cursor: 'pointer',
                                display: 'flex',
                                flexDirection: 'column',
                                gap: 16,
                                transition: 'all 0.2s',
                                position: 'relative'
                            }}
                        >
                            <div style={{
                                width: 56,
                                height: 56,
                                borderRadius: 12,
                                background: `${tab.color}20`,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center'
                            }}>
                                <Icon size={28} color={tab.color} />
                            </div>

                            <div>
                                <div style={{
                                    fontSize: 18,
                                    fontWeight: 600,
                                    color: isActive ? tab.color : 'var(--text-main)',
                                    marginBottom: 4
                                }}>
                                    {tab.label}
                                </div>
                                <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
                                    {tab.description}
                                </div>
                            </div>

                            <div style={{
                                marginTop: 'auto',
                                display: 'flex',
                                alignItems: 'center',
                                gap: 4,
                                color: tab.color,
                                fontSize: 13,
                                fontWeight: 500
                            }}>
                                进入管理 <ChevronRight size={16} />
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Quick Actions */}
            <div style={{
                marginTop: 24,
                padding: 20,
                background: 'var(--glass-bg)',
                border: '1px solid var(--glass-border)',
                borderRadius: 12
            }}>
                <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 12 }}>快速操作</div>
                <div style={{ display: 'flex', gap: 12 }}>
                    <button style={{
                        padding: '8px 16px',
                        background: '#3B82F6',
                        border: 'none',
                        borderRadius: 6,
                        color: '#fff',
                        fontSize: 13,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 6
                    }}>
                        <Package size={16} /> 新增配件SKU
                    </button>
                    <button style={{
                        padding: '8px 16px',
                        background: 'var(--glass-bg-hover)',
                        border: '1px solid var(--glass-border)',
                        borderRadius: 6,
                        color: 'var(--text-main)',
                        fontSize: 13,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 6
                    }}>
                        <Warehouse size={16} /> 入库操作
                    </button>
                    <button style={{
                        padding: '8px 16px',
                        background: 'var(--glass-bg-hover)',
                        border: '1px solid var(--glass-border)',
                        borderRadius: 6,
                        color: 'var(--text-main)',
                        fontSize: 13,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 6
                    }}>
                        <Calculator size={16} /> 生成结算单
                    </button>
                </div>
            </div>
        </div>
    );
};

export default PartsManagementPage;
