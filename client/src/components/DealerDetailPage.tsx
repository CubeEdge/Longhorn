import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useAuthStore } from '../store/useAuthStore';
import { ArrowLeft, MapPin, Phone, Mail, Wrench, MoreHorizontal, Edit2, Trash2, PowerOff, RotateCcw } from 'lucide-react';
import CustomerFormModal from './CustomerFormModal';
import DeleteAccountModal from './DeleteAccountModal';

interface Dealer {
    id: number;
    name: string;
    code: string;
    dealer_type: string;
    region: string;
    country?: string;
    province?: string;
    city?: string;
    contact_person?: string;
    contact_email?: string;
    contact_phone?: string;
    can_repair: number;
    repair_level?: string;
    notes?: string;
    created_at: string;
}

interface DealerStats {
    monthly_repairs: number;
    monthly_inquiries: number;
    inventory_turnover: number;
}

interface InventoryItem {
    sku: string;
    part_name: string;
    quantity: number;
    status: string;
}

const DealerDetailPage: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const { token, user } = useAuthStore();

    const [dealer, setDealer] = useState<Dealer | null>(null);
    const [stats, setStats] = useState<DealerStats | null>(null);
    const [inventory, setInventory] = useState<InventoryItem[]>([]);
    const [loading, setLoading] = useState(true);
    
    // More menu state
    const [showMoreMenu, setShowMoreMenu] = useState(false);
    
    // Edit modal state
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [contacts, setContacts] = useState<any[]>([]);
    
    // Delete/Deactivate modal state
    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
    const [deleteLoading, setDeleteLoading] = useState(false);
    const [deleteHasRelatedData, setDeleteHasRelatedData] = useState(false);
    const [deleteCounts, setDeleteCounts] = useState<{ tickets: number; inquiry_tickets?: number; rma_tickets?: number; dealer_repairs?: number; devices: number } | undefined>();
    const [accountStatus, setAccountStatus] = useState<'active' | 'inactive'>('active');
    
    const isAdmin = user?.role === 'Admin';
    const canManageDealerStatus = user?.role === 'Admin' || user?.role === 'Lead';

    useEffect(() => {
        if (token && id) {
            fetchDealerDetail();
        }
    }, [token, id]);

    const fetchDealerDetail = async () => {
        setLoading(true);
        try {
            // 使用新的 accounts API 获取经销商详情
            const res = await axios.get(`/api/v1/accounts/${id}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            if (res.data.success) {
                const account = res.data.data;
                // 将 account 数据映射到 dealer 格式
                setDealer({
                    id: account.id,
                    name: account.name,
                    code: account.dealer_code || '',
                    dealer_type: account.dealer_level || 'FirstTier',
                    region: account.country || '',
                    country: account.country,
                    province: account.province,
                    city: account.city,
                    contact_person: account.primary_contact_name || account.contacts?.find((c: any) => c.is_primary)?.name || '',
                    contact_email: account.primary_contact_email || account.contacts?.find((c: any) => c.is_primary)?.email || '',
                    contact_phone: account.primary_contact_phone || account.contacts?.find((c: any) => c.is_primary)?.phone || '',
                    can_repair: account.can_repair ? 1 : 0,
                    repair_level: account.repair_level,
                    notes: account.notes,
                    created_at: account.created_at
                });
                // 设置联系人数据
                if (account.contacts) {
                    setContacts(account.contacts);
                }
                // 设置账户状态
                setAccountStatus(account.is_active ? 'active' : 'inactive');
                // Mock stats for now - will implement API later
                setStats({
                    monthly_repairs: 15,
                    monthly_inquiries: 47,
                    inventory_turnover: 2.3
                });
                // Mock inventory - will implement API later
                setInventory([
                    { sku: 'S1-011-013-01', part_name: 'SDI模块', quantity: 3, status: '正常' },
                    { sku: 'S3-800-002-01', part_name: 'Edge主板', quantity: 1, status: '正常' },
                    { sku: 'S4-000-003-01', part_name: '风扇', quantity: 0, status: '缺货' }
                ]);
            }
        } catch (err) {
            console.error('Failed to fetch dealer detail', err);
        } finally {
            setLoading(false);
        }
    };

    const getDealerTypeLabel = (type: string) => {
        const map: Record<string, string> = {
            'tier1': '一级经销商',
            'tier2': '二级经销商',
            'tier3': '三级经销商',
            // 兼容旧数据
            'FirstTier': '一级经销商',
            'SecondTier': '二级经销商',
            'ThirdTier': '三级经销商'
        };
        return map[type] || type;
    };

    // 维修能力等级标签映射
    const getRepairLevelLabel = (level: string | undefined) => {
        if (!level) return '无';
        const map: Record<string, string> = {
            'simple': '简单',
            'advanced': '高级',
            'full': '完整',
            // 兼容旧数据
            'intermediate': '高级',
            'SimpleRepair': '简单',
            'MediumRepair': '高级',
            'FullRepair': '完整'
        };
        return map[level] || level;
    };

    // 维修能力等级颜色
    const getRepairLevelColor = (level: string | undefined) => {
        if (!level) return { bg: 'rgba(156, 163, 175, 0.1)', text: '#9ca3af' };
        const colors: Record<string, { bg: string; text: string }> = {
            'simple': { bg: 'rgba(16, 185, 129, 0.1)', text: '#10B981' },
            'advanced': { bg: 'rgba(168, 85, 247, 0.1)', text: '#a855f7' },
            'full': { bg: 'rgba(255, 215, 0, 0.15)', text: '#FFD700' },
            // 兼容旧数据
            'intermediate': { bg: 'rgba(168, 85, 247, 0.1)', text: '#a855f7' },
            'SimpleRepair': { bg: 'rgba(16, 185, 129, 0.1)', text: '#10B981' },
            'MediumRepair': { bg: 'rgba(168, 85, 247, 0.1)', text: '#a855f7' },
            'FullRepair': { bg: 'rgba(255, 215, 0, 0.15)', text: '#FFD700' }
        };
        return colors[level] || { bg: 'rgba(156, 163, 175, 0.1)', text: '#9ca3af' };
    };

    // 删除经销商处理 - 点击显示确认弹窗
    const handleDeleteClick = () => {
        setShowMoreMenu(false);
        setDeleteHasRelatedData(false);
        setDeleteCounts(undefined);
        setIsDeleteModalOpen(true);
    };

    // 确认删除（调用 API 执行软删除）
    const handleConfirmDelete = async () => {
        setDeleteLoading(true);
        try {
            const res = await axios.delete(`/api/v1/accounts/${id}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            
            if (res.data.success) {
                navigate('/service/dealers');
            }
        } catch (err: any) {
            if (err.response?.status === 409) {
                // 有关联数据，显示建议停用
                setDeleteHasRelatedData(true);
                setDeleteCounts(err.response.data.counts);
            } else {
                alert('删除失败: ' + (err.response?.data?.error?.message || err.message));
                setIsDeleteModalOpen(false);
            }
        } finally {
            setDeleteLoading(false);
        }
    };

    // 确认停用
    const handleConfirmDeactivate = async () => {
        setDeleteLoading(true);
        try {
            await axios.post(`/api/v1/accounts/${id}/deactivate`, 
                { reason: '用户手动停用' },
                { headers: { Authorization: `Bearer ${token}` } }
            );
            setAccountStatus('inactive');
            setIsDeleteModalOpen(false);
            fetchDealerDetail();
        } catch (err: any) {
            alert('停用失败: ' + (err.response?.data?.error?.message || err.message));
        } finally {
            setDeleteLoading(false);
        }
    };

    // 恢复经销商
    const handleReactivate = async () => {
        setShowMoreMenu(false);
        try {
            await axios.post(`/api/v1/accounts/${id}/reactivate`, 
                { reason: '用户手动恢复' },
                { headers: { Authorization: `Bearer ${token}` } }
            );
            setAccountStatus('active');
            fetchDealerDetail();
        } catch (err: any) {
            alert('恢复失败: ' + (err.response?.data?.error?.message || err.message));
        }
    };

    if (loading) {
        return (
            <div className="fade-in" style={{ padding: '40px', textAlign: 'center' }}>
                <div className="loading-spinner" style={{ margin: '0 auto' }} />
            </div>
        );
    }

    if (!dealer) {
        return (
            <div className="fade-in" style={{ padding: '40px', textAlign: 'center' }}>
                <p style={{ color: 'var(--text-secondary)' }}>经销商不存在</p>
            </div>
        );
    }

    return (
        <div className="fade-in" style={{ padding: '24px', maxWidth: '1200px', margin: '0 auto', height: '100vh', overflow: 'auto' }}>
            {/* Header - macOS26 Style */}
            <div style={{
                padding: '20px 0',
                borderBottom: '1px solid var(--glass-border)',
                display: 'flex',
                alignItems: 'center',
                gap: '16px',
                marginBottom: 32
            }}>
                <button
                    onClick={() => navigate('/service/dealers')}
                    style={{
                        background: 'var(--glass-bg-light)',
                        border: '1px solid var(--glass-border)',
                        borderRadius: '10px',
                        color: 'var(--text-secondary)',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        width: '40px',
                        height: '40px',
                        padding: 0,
                        transition: 'all 0.2s'
                    }}
                    onMouseEnter={(e) => {
                        e.currentTarget.style.background = 'var(--glass-bg-hover)';
                        e.currentTarget.style.color = '#fff';
                    }}
                    onMouseLeave={(e) => {
                        e.currentTarget.style.background = 'var(--glass-bg-light)';
                        e.currentTarget.style.color = 'var(--text-secondary)';
                    }}
                >
                    <ArrowLeft size={22} />
                </button>

                <div>
                    <h1 style={{ fontSize: '2rem', fontWeight: 700, marginBottom: 8 }}>
                        {dealer.name}
                    </h1>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                        {/* 经销商等级标签 */}
                        <span style={{
                            padding: '4px 12px',
                            borderRadius: '100px',
                            fontSize: '0.85rem',
                            fontWeight: 600,
                            background: dealer.dealer_type === 'tier1' || dealer.dealer_type === 'FirstTier' 
                                ? 'rgba(255, 215, 0, 0.15)' 
                                : dealer.dealer_type === 'tier2' || dealer.dealer_type === 'SecondTier'
                                    ? 'rgba(59, 130, 246, 0.15)'
                                    : 'rgba(156, 163, 175, 0.15)',
                            color: dealer.dealer_type === 'tier1' || dealer.dealer_type === 'FirstTier' 
                                ? '#FFD700' 
                                : dealer.dealer_type === 'tier2' || dealer.dealer_type === 'SecondTier'
                                    ? '#60a5fa'
                                    : '#9ca3af'
                        }}>
                            {getDealerTypeLabel(dealer.dealer_type)}
                        </span>
                        {/* 维修能力标签 */}
                        <span style={{
                            padding: '4px 12px',
                            borderRadius: '100px',
                            fontSize: '0.85rem',
                            fontWeight: 600,
                            background: getRepairLevelColor(dealer.repair_level).bg,
                            color: getRepairLevelColor(dealer.repair_level).text
                        }}>
                            🔧 {getRepairLevelLabel(dealer.repair_level)}
                        </span>
                        {/* 经销商代码 */}
                        <span style={{ color: 'var(--text-tertiary)', fontSize: '0.9rem' }}>
                            {dealer.code}
                        </span>
                    </div>
                </div>

                <div style={{ flex: 1 }} />

                {/* More Actions Menu */}
                <div style={{ position: 'relative' }}>
                        <button
                            onClick={() => setShowMoreMenu(!showMoreMenu)}
                            style={{
                                background: 'var(--glass-bg-light)',
                                border: '1px solid var(--glass-border)',
                                borderRadius: '8px',
                                padding: '8px 12px',
                                color: 'var(--text-secondary)',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                gap: 6,
                                transition: 'all 0.2s'
                            }}
                            onMouseEnter={(e) => {
                                e.currentTarget.style.background = 'var(--glass-bg-hover)';
                            }}
                            onMouseLeave={(e) => {
                                e.currentTarget.style.background = 'var(--glass-bg-light)';
                            }}
                        >
                            <MoreHorizontal size={18} />
                            <span style={{ fontSize: '0.85rem' }}>更多</span>
                        </button>
                        
                        {/* Dropdown Menu */}
                        {showMoreMenu && (
                            <>
                                <div
                                    style={{ position: 'fixed', inset: 0, zIndex: 10 }}
                                    onClick={() => setShowMoreMenu(false)}
                                />
                                <div
                                    style={{
                                        position: 'absolute',
                                        right: 0,
                                        top: '100%',
                                        marginTop: 8,
                                        background: 'rgba(40, 40, 42, 0.98)',
                                        backdropFilter: 'blur(20px)',
                                        borderRadius: 12,
                                        border: '1px solid var(--glass-border)',
                                        boxShadow: '0 10px 40px var(--glass-shadow)',
                                        zIndex: 20,
                                        minWidth: 160,
                                        padding: '8px 0'
                                    }}
                                >
                                    <button
                                        onClick={() => { setIsEditModalOpen(true); setShowMoreMenu(false); }}
                                        style={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: 12,
                                            width: '100%',
                                            padding: '10px 16px',
                                            background: 'none',
                                            border: 'none',
                                            color: 'var(--text-main)',
                                            cursor: 'pointer',
                                            fontSize: '0.9rem',
                                            textAlign: 'left'
                                        }}
                                    >
                                        <Edit2 size={16} color="var(--accent-blue)" />
                                        编辑
                                    </button>
                                    
                                    {(isAdmin || user?.role === 'Lead') && (
                                        <button
                                            onClick={handleDeleteClick}
                                            style={{
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: 12,
                                                width: '100%',
                                                padding: '10px 16px',
                                                background: 'none',
                                                border: 'none',
                                                color: '#ff4d4f',
                                                cursor: 'pointer',
                                                fontSize: '0.9rem',
                                                textAlign: 'left'
                                            }}
                                        >
                                            <Trash2 size={16} />
                                            删除
                                        </button>
                                    )}
                                    
                                    {/* 停用经销商按钮 */}
                                    {canManageDealerStatus && accountStatus === 'active' && (
                                        <button
                                            onClick={() => { setShowMoreMenu(false); setIsDeleteModalOpen(true); setDeleteHasRelatedData(true); }}
                                            style={{
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: 12,
                                                width: '100%',
                                                padding: '10px 16px',
                                                background: 'none',
                                                border: 'none',
                                                color: '#f59e0b',
                                                cursor: 'pointer',
                                                fontSize: '0.9rem',
                                                textAlign: 'left'
                                            }}
                                        >
                                            <PowerOff size={16} />
                                            停用经销商
                                        </button>
                                    )}
                                    
                                    {/* 已停用状态显示恢复按钮 */}
                                    {canManageDealerStatus && accountStatus === 'inactive' && (
                                        <button
                                            onClick={handleReactivate}
                                            style={{
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: 12,
                                                width: '100%',
                                                padding: '10px 16px',
                                                background: 'none',
                                                border: 'none',
                                                color: '#10B981',
                                                cursor: 'pointer',
                                                fontSize: '0.9rem',
                                                textAlign: 'left'
                                            }}
                                        >
                                            <RotateCcw size={16} />
                                            恢复经销商
                                        </button>
                                    )}
                                </div>
                            </>
                        )}
                    </div>
            </div>

            {/* Basic Info Card */}
            <div
                style={{
                    background: 'var(--glass-bg)',
                    backdropFilter: 'blur(20px)',
                    borderRadius: '16px',
                    padding: '24px',
                    marginBottom: 24,
                    border: '1px solid var(--glass-border)'
                }}
            >
                <h2 style={{ fontSize: '1.2rem', fontWeight: 600, marginBottom: 20 }}>基本信息</h2>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 24 }}>
                    <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                            <MapPin size={16} color="var(--accent-blue)" />
                            <span style={{ fontSize: '0.85rem', color: 'var(--text-tertiary)', textTransform: 'uppercase' }}>地区</span>
                        </div>
                        <p style={{ fontSize: '1rem', fontWeight: 500 }}>
                            {dealer.country || '-'} {dealer.city ? `/ ${dealer.city}` : ''}
                        </p>
                    </div>

                    <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                            <Wrench size={16} color="var(--accent-blue)" />
                            <span style={{ fontSize: '0.85rem', color: 'var(--text-tertiary)', textTransform: 'uppercase' }}>维修能力</span>
                        </div>
                        <p style={{ fontSize: '1rem', fontWeight: 500 }}>
                            {dealer.can_repair ? `${dealer.repair_level || '有'}` : '无'}
                        </p>
                    </div>

                    {dealer.contact_person && (
                        <div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                                <Phone size={16} color="var(--accent-blue)" />
                                <span style={{ fontSize: '0.85rem', color: 'var(--text-tertiary)', textTransform: 'uppercase' }}>联系人</span>
                            </div>
                            <p style={{ fontSize: '1rem', fontWeight: 500 }}>{dealer.contact_person}</p>
                            {dealer.contact_phone && (
                                <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>{dealer.contact_phone}</p>
                            )}
                        </div>
                    )}

                    {dealer.contact_email && (
                        <div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                                <Mail size={16} color="var(--accent-blue)" />
                                <span style={{ fontSize: '0.85rem', color: 'var(--text-tertiary)', textTransform: 'uppercase' }}>邮箱</span>
                            </div>
                            <p style={{ fontSize: '0.9rem', fontWeight: 500, wordBreak: 'break-all' }}>{dealer.contact_email}</p>
                        </div>
                    )}
                </div>

                {dealer.notes && (
                    <div style={{ marginTop: 20, paddingTop: 20, borderTop: '1px solid var(--glass-border)' }}>
                        <span style={{ fontSize: '0.85rem', color: 'var(--text-tertiary)', textTransform: 'uppercase' }}>备注</span>
                        <p style={{ fontSize: '0.95rem', color: 'var(--text-secondary)', marginTop: 8, lineHeight: 1.6 }}>
                            {dealer.notes}
                        </p>
                    </div>
                )}
            </div>

            {/* Service Dashboard */}
            {stats && (
                <div
                    style={{
                        background: 'var(--glass-bg)',
                        backdropFilter: 'blur(20px)',
                        borderRadius: '16px',
                        padding: '24px',
                        marginBottom: 24,
                        border: '1px solid var(--glass-border)'
                    }}
                >
                    <h2 style={{ fontSize: '1.2rem', fontWeight: 600, marginBottom: 20 }}>Service Dashboard</h2>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 20 }}>
                        <div style={{ textAlign: 'center' }}>
                            <div style={{ fontSize: '2rem', fontWeight: 700, color: 'var(--accent-blue)' }}>
                                {stats.monthly_repairs}
                            </div>
                            <div style={{ fontSize: '0.85rem', color: 'var(--text-tertiary)', marginTop: 4 }}>本月维修单</div>
                        </div>
                        <div style={{ textAlign: 'center' }}>
                            <div style={{ fontSize: '2rem', fontWeight: 700, color: '#10b981' }}>
                                {stats.monthly_inquiries}
                            </div>
                            <div style={{ fontSize: '0.85rem', color: 'var(--text-tertiary)', marginTop: 4 }}>本月咨询</div>
                        </div>
                        <div style={{ textAlign: 'center' }}>
                            <div style={{ fontSize: '2rem', fontWeight: 700, color: '#f59e0b' }}>
                                {stats.inventory_turnover}
                            </div>
                            <div style={{ fontSize: '0.85rem', color: 'var(--text-tertiary)', marginTop: 4 }}>库存周转率</div>
                        </div>
                    </div>
                </div>
            )}

            {/* Inventory (for FirstTier only) */}
            {dealer.dealer_type === 'FirstTier' && inventory.length > 0 && (
                <div
                    style={{
                        background: 'var(--glass-bg)',
                        backdropFilter: 'blur(20px)',
                        borderRadius: '16px',
                        padding: '24px',
                        marginBottom: 24,
                        border: '1px solid var(--glass-border)'
                    }}
                >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                        <h2 style={{ fontSize: '1.2rem', fontWeight: 600 }}>备件库存（一级经销商专属）</h2>
                        <div style={{ display: 'flex', gap: 12 }}>
                            <button className="btn-kine-lowkey" style={{ fontSize: '0.85rem', padding: '0 12px', height: '32px' }}>
                                库存明细
                            </button>
                            <button className="btn-kine-lowkey" style={{ fontSize: '0.85rem', padding: '0 12px', height: '32px' }}>
                                补货申请
                            </button>
                        </div>
                    </div>

                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead>
                            <tr style={{ borderBottom: '1px solid var(--glass-border)' }}>
                                <th style={{ textAlign: 'left', padding: '12px', fontSize: '0.85rem', color: 'var(--text-tertiary)', fontWeight: 600 }}>SKU</th>
                                <th style={{ textAlign: 'left', padding: '12px', fontSize: '0.85rem', color: 'var(--text-tertiary)', fontWeight: 600 }}>配件名称</th>
                                <th style={{ textAlign: 'center', padding: '12px', fontSize: '0.85rem', color: 'var(--text-tertiary)', fontWeight: 600 }}>库存</th>
                                <th style={{ textAlign: 'center', padding: '12px', fontSize: '0.85rem', color: 'var(--text-tertiary)', fontWeight: 600 }}>状态</th>
                            </tr>
                        </thead>
                        <tbody>
                            {inventory.map((item, idx) => (
                                <tr key={idx} style={{ borderBottom: '1px solid var(--glass-border)' }}>
                                    <td style={{ padding: 16, fontSize: '0.9rem', color: 'var(--text-secondary)' }}>{item.sku}</td>
                                    <td style={{ padding: 16, fontSize: '0.95rem', fontWeight: 500 }}>{item.part_name}</td>
                                    <td style={{ padding: 16, textAlign: 'center', fontSize: '1rem', fontWeight: 600 }}>{item.quantity}</td>
                                    <td style={{ padding: 16, textAlign: 'center' }}>
                                        <span
                                            style={{
                                                padding: '4px 12px',
                                                borderRadius: 6,
                                                fontSize: '0.85rem',
                                                background: item.status === '正常' ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                                                color: item.status === '正常' ? '#10b981' : '#ef4444'
                                            }}
                                        >
                                            {item.status}
                                        </span>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {/* Repair List Section Placeholder */}
            <div
                style={{
                    background: 'var(--glass-bg)',
                    backdropFilter: 'blur(20px)',
                    borderRadius: '16px',
                    padding: '24px',
                    border: '1px solid var(--glass-border)'
                }}
            >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                    <h2 style={{ fontSize: '1.2rem', fontWeight: 600 }}>维修单列表</h2>
                    <button className="btn-kine-lowkey" style={{ fontSize: '0.85rem', padding: '0 12px', height: '32px' }}>
                        查看全部
                    </button>
                </div>
                <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-tertiary)' }}>
                    暂无维修单记录
                </div>
            </div>

            {/* Edit Modal */}
            {isEditModalOpen && dealer && (
                <CustomerFormModal
                    isOpen={isEditModalOpen}
                    onClose={() => setIsEditModalOpen(false)}
                    onSubmit={async (e, formData) => {
                        e.preventDefault();
                        try {
                            const accountData = {
                                name: formData.name,
                                account_type: 'DEALER',
                                dealer_code: formData.dealer_code,
                                dealer_level: formData.dealer_level,
                                address: formData.address,
                                country: formData.country,
                                city: formData.city,
                                notes: formData.notes,
                                repair_level: formData.repair_level,
                                can_repair: !!formData.repair_level,
                                primary_contact: formData.contacts?.find((c: any) => c.is_primary) || formData.contacts?.[0]
                            };

                            await axios.patch(`/api/v1/accounts/${id}`, accountData, {
                                headers: { Authorization: `Bearer ${token}` }
                            });

                            // Sync contacts
                            if (formData.contacts && formData.contacts.length > 0) {
                                const existingContactsRes = await axios.get(`/api/v1/accounts/${id}/contacts`, {
                                    headers: { Authorization: `Bearer ${token}` }
                                });
                                const existingContacts = existingContactsRes.data.data || [];

                                for (const contact of existingContacts) {
                                    await axios.delete(`/api/v1/contacts/${contact.id}`, {
                                        headers: { Authorization: `Bearer ${token}` }
                                    });
                                }

                                for (const contact of formData.contacts) {
                                    await axios.post(`/api/v1/accounts/${id}/contacts`, {
                                        name: contact.name,
                                        email: contact.email,
                                        phone: contact.phone,
                                        job_title: contact.job_title,
                                        is_primary: contact.is_primary
                                    }, {
                                        headers: { Authorization: `Bearer ${token}` }
                                    });
                                }
                            }

                            setIsEditModalOpen(false);
                            fetchDealerDetail();
                        } catch (err) {
                            console.error('Failed to save dealer', err);
                            alert('保存失败');
                        }
                    }}
                    initialData={{
                        id: dealer.id,
                        name: dealer.name,
                        dealer_code: dealer.code,
                        dealer_level: dealer.dealer_type,
                        country: dealer.country || '',
                        city: dealer.city || '',
                        notes: dealer.notes || '',
                        repair_level: dealer.repair_level,
                        contacts: contacts.length > 0 ? contacts : [{
                            name: dealer.contact_person || '',
                            email: dealer.contact_email || '',
                            phone: dealer.contact_phone || '',
                            is_primary: true
                        }]
                    }}
                    isEditing={true}
                    _user={user}
                    mode="dealer"
                />
            )}

            {/* Delete/Deactivate Modal */}
            <DeleteAccountModal
                isOpen={isDeleteModalOpen}
                account={dealer ? { id: dealer.id, name: dealer.name, account_type: 'DEALER' } : null}
                onClose={() => !deleteLoading && setIsDeleteModalOpen(false)}
                onConfirmDelete={handleConfirmDelete}
                onConfirmDeactivate={handleConfirmDeactivate}
                loading={deleteLoading}
                hasRelatedData={deleteHasRelatedData}
                counts={deleteCounts}
            />
        </div>
    );
};

export default DealerDetailPage;
