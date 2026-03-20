/**
 * PartsDetailPage - 配件详情页
 * 
 * 展示单个配件的完整信息：基本信息、三种货币价格、兼容机型列表。
 * 对齐 ProductModelDetail 页面的设计风格。
 * 深色/浅色模式兼容：全部使用 CSS 变量。
 */

import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import {
    ArrowLeft, Package, Edit2, AlertCircle,
    Loader2, Layers, DollarSign, MoreHorizontal, Trash2, Power
} from 'lucide-react';
import { useAuthStore } from '../../store/useAuthStore';
import { useLanguage } from '../../i18n/useLanguage';
import PartsEditModal from './PartsEditModal';
import ConfirmModal from '../Service/ConfirmModal';

const FAMILY_LABELS: Record<string, { label: string; color: string }> = {
    'A': { label: '在售电影机', color: 'rgba(59,130,246,0.15)' },
    'B': { label: '广播摄像机', color: 'rgba(249,115,22,0.15)' },
    'C': { label: '电子寻像器', color: 'rgba(16,185,129,0.15)' },
    'D': { label: '历史产品', color: 'rgba(107,114,128,0.15)' },
    'E': { label: '通用配件', color: 'rgba(139,92,246,0.15)' },
};

const FAMILY_TEXT_COLORS: Record<string, string> = {
    'A': '#60A5FA', 'B': '#FB923C', 'C': '#34D399', 'D': '#9CA3AF', 'E': '#A78BFA',
};

interface PartDetail {
    id: number;
    sku: string;
    name: string;
    name_en?: string;
    name_internal?: string;
    name_internal_en?: string;
    material_id?: string;
    category: string;
    description?: string;
    status: string;
    price_cny?: number;
    price_usd?: number;
    price_eur?: number;
    cost_cny?: number;
    compatible_models?: string[];
    model_bom?: BomEntry[];
    created_by_name?: string;
    updated_by_name?: string;
    created_at?: string;
    updated_at?: string;
}

interface BomEntry {
    product_model_id: number;
    model_name: string;
    model_name_en?: string;
    model_code?: string;
    product_family: string;
}

const PartsDetailPage: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const { token, user } = useAuthStore();
    const { t: _t } = useLanguage();

    const [part, setPart] = useState<PartDetail | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [allModels, setAllModels] = useState<any[]>([]);
    const [isMoreMenuOpen, setIsMoreMenuOpen] = useState(false);
    const moreMenuRef = useRef<HTMLDivElement>(null);

    // 确认弹窗状态
    const [confirmModal, setConfirmModal] = useState<{
        isOpen: boolean;
        type: 'deactivate' | 'delete' | null;
        reason: string;
        loading: boolean;
    }>({ isOpen: false, type: null, reason: '', loading: false });

    const isAdmin = ['Admin', 'Lead', 'Exec'].includes(user?.role || '');
    const isOP = user?.department_code === 'OP';

    const fetchPart = async () => {
        if (!id || !token) return;
        try {
            const res = await axios.get(`/api/v1/parts-master/${id}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            if (res.data?.success) setPart(res.data.data);

            // Fetch models for the modal
            const modRes = await axios.get('/api/v1/admin/product-models?limit=100', {
                headers: { Authorization: `Bearer ${token}` }
            });
            if (modRes.data?.success) setAllModels(modRes.data.data);
        } catch (err: any) {
            setError(err.response?.data?.error?.message || '加载失败');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        setLoading(true);
        fetchPart();
    }, [id, token]);

    // 处理确认操作
    const handleConfirmAction = async () => {
        if (!part || !confirmModal.type) return;
        
        // 检查是否填写了原因
        if (!confirmModal.reason.trim()) {
            alert('请填写操作原因');
            return;
        }
        
        setConfirmModal(prev => ({ ...prev, loading: true }));
        
        try {
            if (confirmModal.type === 'deactivate') {
                await axios.patch(`/api/v1/parts-master/${part.id}`, {
                    status: part.status === 'active' ? 'discontinued' : 'active',
                    reason: confirmModal.reason
                }, { headers: { Authorization: `Bearer ${token}` } });
            } else if (confirmModal.type === 'delete') {
                await axios.delete(`/api/v1/parts-master/${part.id}`, {
                    headers: { Authorization: `Bearer ${token}` },
                    data: { reason: confirmModal.reason }
                });
                navigate('/service/parts');
                return;
            }
            
            setConfirmModal({ isOpen: false, type: null, reason: '', loading: false });
            fetchPart();
        } catch (err: any) {
            alert(err.response?.data?.error?.message || '操作失败');
            setConfirmModal(prev => ({ ...prev, loading: false }));
        }
    };

    if (loading) {
        return (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
                <Loader2 size={32} style={{ opacity: 0.5, animation: 'spin 1s linear infinite' }} />
            </div>
        );
    }

    if (error || !part) {
        return (
            <div className="fade-in" style={{ padding: 24, height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16 }}>
                <AlertCircle size={48} color="#EF4444" />
                <p style={{ color: 'var(--text-secondary)' }}>{error || '配件不存在'}</p>
                <button onClick={() => navigate('/service/parts')} className="btn-kine-lowkey">
                    <ArrowLeft size={16} /> 返回配件目录
                </button>
            </div>
        );
    }

    const statusLabel = part.status === 'active' ? '在售' : part.status === 'discontinued' ? '停售' : '待定';
    const statusColor = part.status === 'active' ? '#10B981' : part.status === 'discontinued' ? '#EF4444' : '#F59E0B';

    return (
        <div className="fade-in" style={{ padding: 24, height: '100%', display: 'flex', flexDirection: 'column', overflow: 'auto' }}>
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                    <button
                        onClick={() => navigate('/service/parts')}
                        style={{
                            width: 36, height: 36, borderRadius: '50%',
                            background: 'var(--glass-bg-hover)', border: '1px solid var(--glass-border)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            cursor: 'pointer', color: 'var(--text-secondary)'
                        }}
                    >
                        <ArrowLeft size={18} />
                    </button>
                    <div>
                        <h2 style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: 10 }}>
                            {part.name}
                        </h2>
                        {part.name_en && (
                            <p style={{ color: 'var(--text-secondary)', marginTop: 2, fontSize: '0.9rem' }}>
                                {part.name_en}
                            </p>
                        )}
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8 }}>
                            <span style={{
                                padding: '2px 10px', borderRadius: 4,
                                background: 'var(--glass-bg-hover)', fontSize: '0.8rem',
                                color: 'var(--text-secondary)',
                                fontVariantNumeric: 'tabular-nums'
                            }}>
                                {part.sku}
                            </span>
                            <span style={{
                                padding: '2px 10px', borderRadius: 4,
                                background: 'var(--glass-bg-hover)', fontSize: '0.8rem',
                                color: 'var(--text-secondary)'
                            }}>
                                {part.category}
                            </span>
                            <span style={{
                                padding: '2px 10px', borderRadius: 4,
                                fontSize: '0.8rem', fontWeight: 500,
                                color: statusColor,
                                background: `${statusColor}15`,
                                border: `1px solid ${statusColor}30`
                            }}>
                                {statusLabel}
                            </span>
                        </div>
                    </div>
                </div>
                {isAdmin && (
                    <div style={{ position: 'relative' }} ref={moreMenuRef}>
                        <button
                            onClick={() => setIsMoreMenuOpen(!isMoreMenuOpen)}
                            style={{
                                width: 36, height: 36, borderRadius: '50%',
                                background: 'var(--glass-bg-hover)', border: '1px solid var(--glass-border)',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                cursor: 'pointer', color: 'var(--text-secondary)',
                                transition: 'all 0.15s'
                            }}
                            onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'var(--text-secondary)'; }}
                            onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--glass-border)'; }}
                        >
                            <MoreHorizontal size={20} />
                        </button>
                        {isMoreMenuOpen && (
                            <>
                                <div
                                    style={{ position: 'fixed', inset: 0, zIndex: 99 }}
                                    onClick={() => setIsMoreMenuOpen(false)}
                                />
                                <div style={{
                                    position: 'absolute', top: '100%', right: 0, marginTop: 8,
                                    background: 'var(--bg-sidebar)', border: '1px solid var(--glass-border)',
                                    borderRadius: 12, padding: '8px 0', minWidth: 160, zIndex: 100,
                                    boxShadow: '0 8px 32px var(--glass-shadow)'
                                }}>
                                    <button
                                        onClick={() => {
                                            setIsMoreMenuOpen(false);
                                            setIsModalOpen(true);
                                        }}
                                        style={{
                                            display: 'flex', alignItems: 'center', gap: 10,
                                            width: '100%', padding: '10px 16px', background: 'transparent',
                                            border: 'none', color: 'var(--text-main)', fontSize: '0.9rem',
                                            cursor: 'pointer', textAlign: 'left'
                                        }}
                                    >
                                        <Edit2 size={16} color="#FFD700" /> 编辑
                                    </button>
                                    <button
                                        onClick={() => {
                                            setIsMoreMenuOpen(false);
                                            setConfirmModal({ 
                                                isOpen: true, 
                                                type: 'deactivate', 
                                                reason: '', 
                                                loading: false 
                                            });
                                        }}
                                        style={{
                                            display: 'flex', alignItems: 'center', gap: 10,
                                            width: '100%', padding: '10px 16px', background: 'transparent',
                                            border: 'none', color: part.status === 'active' ? '#EF4444' : '#10B981', fontSize: '0.9rem',
                                            cursor: 'pointer', textAlign: 'left'
                                        }}
                                    >
                                        <Power size={16} /> {part.status === 'active' ? '停用' : '启用'}
                                    </button>
                                    <div style={{ height: 1, background: 'var(--glass-border)', margin: '4px 0' }} />
                                    <button
                                        onClick={() => {
                                            setIsMoreMenuOpen(false);
                                            setConfirmModal({ 
                                                isOpen: true, 
                                                type: 'delete', 
                                                reason: '', 
                                                loading: false 
                                            });
                                        }}
                                        style={{
                                            display: 'flex', alignItems: 'center', gap: 10,
                                            width: '100%', padding: '10px 16px', background: 'transparent',
                                            border: 'none', color: '#EF4444', fontSize: '0.9rem',
                                            cursor: 'pointer', textAlign: 'left'
                                        }}
                                    >
                                        <Trash2 size={16} /> 删除
                                    </button>
                                </div>
                            </>
                        )}
                    </div>
                )}
            </div>

            {/* Content Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 360px', gap: 20, flex: 1 }}>
                {/* Left - Basic Info */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                    {/* Basic Info Card */}
                    <div style={{
                        background: 'var(--glass-bg-light)', borderRadius: 16,
                        border: '1px solid var(--glass-border)', padding: 24
                    }}>
                        <h3 style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-main)', marginBottom: 20, display: 'flex', alignItems: 'center', gap: 8 }}>
                            <Package size={18} color="#FFD700" />
                            基本信息
                        </h3>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                            <InfoField label="对外名称 (中文)" value={part.name} />
                            <InfoField label="对外名称 (英文)" value={part.name_en} />
                            <InfoField label="内部名称 (中文)" value={part.name_internal} />
                            <InfoField label="内部名称 (英文)" value={part.name_internal_en} />
                            <InfoField label="SKU 编码" value={part.sku} mono />
                            <InfoField label="物料 ID" value={part.material_id} mono />
                            <InfoField label="分类" value={part.category} />
                            <InfoField label="状态" value={statusLabel} />
                        </div>
                        {part.description && (
                            <div style={{ marginTop: 16, paddingTop: 16, borderTop: '1px solid var(--glass-border)' }}>
                                <span style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', display: 'block', marginBottom: 6 }}>备注</span>
                                <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>{part.description}</p>
                            </div>
                        )}
                    </div>

                    {/* Metadata */}
                    <div style={{
                        background: 'var(--glass-bg-light)', borderRadius: 12,
                        border: '1px solid var(--glass-border)', padding: '12px 24px',
                        display: 'flex', gap: 24, fontSize: '0.75rem', color: 'var(--text-tertiary)'
                    }}>
                        {part.created_by_name && <span>创建: {part.created_by_name}</span>}
                        {part.created_at && <span>创建时间: {new Date(part.created_at).toLocaleDateString()}</span>}
                        {part.updated_by_name && <span>更新: {part.updated_by_name}</span>}
                    </div>
                </div>

                {/* Right Column */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                    {/* Price Card */}
                    {!isOP && (
                        <div style={{
                            background: 'var(--glass-bg-light)', borderRadius: 16,
                            border: '1px solid var(--glass-border)', padding: 24
                        }}>
                            <h3 style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-main)', marginBottom: 20, display: 'flex', alignItems: 'center', gap: 8 }}>
                                <DollarSign size={18} color="#FFD700" />
                                价格信息
                            </h3>
                            <div style={{ display: 'flex', gap: 12 }}>
                                <PriceTag currency="CNY" symbol="¥" value={part.price_cny} />
                                <PriceTag currency="USD" symbol="$" value={part.price_usd} />
                                <PriceTag currency="EUR" symbol="€" value={part.price_eur} />
                            </div>
                            {part.cost_cny !== undefined && part.cost_cny !== null && (
                                <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--glass-border)', fontSize: '0.8rem', color: 'var(--text-tertiary)' }}>
                                    成本: ¥{part.cost_cny?.toLocaleString() || '—'}
                                </div>
                            )}
                        </div>
                    )}

                    {/* Compatible Models Card */}
                    <div style={{
                        background: 'var(--glass-bg-light)', borderRadius: 16,
                        border: '1px solid var(--glass-border)', padding: 24,
                        flex: 1
                    }}>
                        <h3 style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-main)', marginBottom: 20, display: 'flex', alignItems: 'center', gap: 8 }}>
                            <Layers size={18} color="#FFD700" />
                            兼容机型
                            <span style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', fontWeight: 400 }}>
                                ({(part.model_bom || []).length})
                            </span>
                        </h3>
                        {(part.model_bom || []).length === 0 ? (
                            <div style={{ textAlign: 'center', padding: 20, opacity: 0.5 }}>
                                <Layers size={32} opacity={0.3} />
                                <p style={{ marginTop: 8, fontSize: '0.85rem' }}>暂无关联机型</p>
                            </div>
                        ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                                {(part.model_bom || []).map((bom, idx) => {
                                    const family = FAMILY_LABELS[bom.product_family] || { label: bom.product_family, color: 'var(--glass-bg-hover)' };
                                    const textColor = FAMILY_TEXT_COLORS[bom.product_family] || 'var(--text-secondary)';
                                    return (
                                        <div
                                            key={idx}
                                            style={{
                                                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                                padding: '10px 12px', borderRadius: 8,
                                                background: 'var(--glass-bg-hover)',
                                                border: '1px solid var(--glass-border)',
                                                cursor: 'pointer',
                                                transition: 'all 0.15s'
                                            }}
                                            onClick={() => navigate(`/service/product-models/${bom.product_model_id}`)}
                                            onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--text-tertiary)'; }}
                                            onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--glass-border)'; }}
                                        >
                                            <div>
                                                <div style={{ fontSize: '0.85rem', color: 'var(--text-main)', fontWeight: 500 }}>
                                                    {bom.model_name}
                                                </div>
                                                {bom.model_code && (
                                                    <div style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', marginTop: 2 }}>
                                                        {bom.model_code}
                                                    </div>
                                                )}
                                            </div>
                                            <span style={{
                                                padding: '2px 8px', borderRadius: 4,
                                                fontSize: '0.7rem', fontWeight: 500,
                                                background: family.color,
                                                color: textColor
                                            }}>
                                                {family.label}
                                            </span>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Parts Edit Modal */}
            <PartsEditModal
                isOpen={isModalOpen}
                editingPart={part}
                allModels={allModels}
                onClose={() => setIsModalOpen(false)}
                onSaved={fetchPart}
            />

            {/* 确认弹窗 - 停用/删除 */}
            {confirmModal.isOpen && (
                <ConfirmModal
                    title={confirmModal.type === 'delete' ? '确认删除配件' : `确认${part?.status === 'active' ? '停用' : '启用'}配件`}
                    message={
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                            <p>
                                {confirmModal.type === 'delete' 
                                    ? `您确定要删除配件 "${part?.name}" 吗？此操作不可撤销。`
                                    : `您确定要${part?.status === 'active' ? '停用' : '启用'}配件 "${part?.name}" 吗？`
                                }
                            </p>
                            <div>
                                <label style={{ display: 'block', fontSize: 12, color: 'var(--text-secondary)', marginBottom: 6 }}>
                                    {confirmModal.type === 'delete' ? '删除原因 *' : '操作原因 *'}
                                </label>
                                <textarea
                                    value={confirmModal.reason}
                                    onChange={e => setConfirmModal(prev => ({ ...prev, reason: e.target.value }))}
                                    placeholder="请输入原因..."
                                    rows={3}
                                    style={{
                                        width: '100%', padding: 10, background: 'var(--glass-bg-light)',
                                        border: `1px solid ${!confirmModal.reason.trim() ? '#EF4444' : 'var(--glass-border)'}`,
                                        borderRadius: 6, color: 'var(--text-main)', fontSize: 13, resize: 'none'
                                    }}
                                />
                                {!confirmModal.reason.trim() && (
                                    <span style={{ fontSize: 11, color: '#EF4444', marginTop: 4, display: 'block' }}>
                                        必须填写原因才能继续
                                    </span>
                                )}
                            </div>
                        </div>
                    }
                    confirmText={confirmModal.type === 'delete' ? '删除' : part?.status === 'active' ? '停用' : '启用'}
                    cancelText="取消"
                    isDanger={true}
                    countdown={5}
                    onConfirm={handleConfirmAction}
                    onCancel={() => setConfirmModal({ isOpen: false, type: null, reason: '', loading: false })}
                    loading={confirmModal.loading}
                    showCancel={true}
                />
            )}
        </div>
    );
};

// Sub-components
const InfoField: React.FC<{ label: string; value?: string | null; mono?: boolean }> = ({ label, value, mono }) => (
    <div>
        <span style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', display: 'block', marginBottom: 4 }}>{label}</span>
        <span style={{
            fontSize: '0.9rem', color: value ? 'var(--text-main)' : 'var(--text-tertiary)',
            fontFamily: mono ? 'monospace' : 'inherit'
        }}>
            {value || '—'}
        </span>
    </div>
);

const PriceTag: React.FC<{ currency: string; symbol: string; value?: number }> = ({ currency, symbol, value }) => (
    <div style={{
        flex: 1, padding: '12px 10px', borderRadius: 10,
        background: 'var(--glass-bg-hover)', border: '1px solid var(--glass-border)',
        textAlign: 'center'
    }}>
        <div style={{ fontSize: '0.7rem', color: 'var(--text-tertiary)', marginBottom: 4 }}>{currency}</div>
        <div style={{ fontSize: '1.1rem', fontWeight: 600, color: 'var(--text-main)', fontVariantNumeric: 'tabular-nums' }}>
            {value ? `${symbol}${value.toLocaleString()}` : '—'}
        </div>
    </div>
);

export default PartsDetailPage;
