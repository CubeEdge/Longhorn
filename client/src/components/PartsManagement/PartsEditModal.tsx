/**
 * PartsEditModal - 配件新增/编辑弹窗
 * 
 * 对齐 ProductModelsManagement 的居中 Modal 设计：
 * - 左侧：基本信息表单
 * - 右侧：价格信息
 * - macOS26 风格，Kine Yellow 主题
 * - 使用 useToast 进行操作反馈
 */

import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Edit2, Plus, X, Save, DollarSign, Loader2, Search } from 'lucide-react';
import { useAuthStore } from '../../store/useAuthStore';
import { useLanguage } from '../../i18n/useLanguage';
import { useToast } from '../../store/useToast';

interface ProductModel {
    id: number;
    name_zh: string;
    name_en: string;
    model_code: string;
    product_family: string;
}

const FAMILY_LABELS: Record<string, { label: string; color: string; text: string }> = {
    'A': { label: '在售电影机', color: 'rgba(59,130,246,0.15)', text: '#60A5FA' },
    'B': { label: '广播摄像机', color: 'rgba(249,115,22,0.15)', text: '#FB923C' },
    'C': { label: '电子寻像器', color: 'rgba(16,185,129,0.15)', text: '#34D399' },
    'D': { label: '历史产品', color: 'rgba(107,114,128,0.15)', text: '#9CA3AF' },
    'E': { label: '通用配件', color: 'rgba(139,92,246,0.15)', text: '#A78BFA' },
};

interface PartFormData {
    sku: string;
    name: string;
    name_en: string;
    name_internal: string;
    name_internal_en: string;
    material_id: string;
    category: string;
    description: string;
    status: string;
    price_cny: number | string;
    price_usd: number | string;
    price_eur: number | string;
    cost_cny: number | string;
    compatible_models: number[]; // Product model IDs
}

const EMPTY_FORM: PartFormData = {
    sku: '', name: '', name_en: '', name_internal: '', name_internal_en: '',
    material_id: '', category: '', description: '', status: 'active',
    price_cny: '', price_usd: '', price_eur: '', cost_cny: '',
    compatible_models: []
};

const CATEGORY_OPTIONS = [
    'CMOS传感器', '主板', '电源板', '接口板', '散热模块', '按键模块',
    '连接器', '线缆', '机械结构件', '光学组件', '显示屏', '电池', '其他'
];

const STATUS_OPTIONS = [
    { value: 'active', label: '在售', color: '#10B981' },
    { value: 'discontinued', label: '停售', color: '#EF4444' },
    { value: 'pending', label: '待定', color: '#F59E0B' },
];

// Shared input style
const inputStyle: React.CSSProperties = {
    padding: '10px 12px', borderRadius: 8,
    border: '1px solid var(--glass-border)',
    background: 'var(--glass-bg-hover)', color: 'var(--text-main)',
    fontSize: '0.9rem', width: '100%', boxSizing: 'border-box'
};

const selectStyle: React.CSSProperties = { ...inputStyle };

interface PartsEditModalProps {
    isOpen: boolean;
    editingPart: any | null;  // null = create mode
    allModels: ProductModel[];
    onClose: () => void;
    onSaved: () => void;
}

const PartsEditModal: React.FC<PartsEditModalProps> = ({ isOpen, editingPart, allModels, onClose, onSaved }) => {
    const { token } = useAuthStore();
    const { showToast } = useToast();
    const { language } = useLanguage();
    const [formData, setFormData] = useState<PartFormData>(EMPTY_FORM);
    const [saving, setSaving] = useState(false);
    
    // Model Selection State
    const [modelSearch, setModelSearch] = useState('');
    const [isDropdownOpen, setIsDropdownOpen] = useState(false);

    const isEdit = !!editingPart;

    // Populate form when editing or refreshing BOM
    useEffect(() => {
        if (isOpen && editingPart) {
            const currentModelIds = editingPart.model_bom?.map((m: any) => m.product_model_id) || [];
            
            setFormData({
                sku: editingPart.sku || '',
                name: editingPart.name || '',
                name_en: editingPart.name_en || '',
                name_internal: editingPart.name_internal || '',
                name_internal_en: editingPart.name_internal_en || '',
                material_id: editingPart.material_id || '',
                category: editingPart.category || '',
                description: editingPart.description || '',
                status: editingPart.status || 'active',
                price_cny: editingPart.price_cny ?? '',
                price_usd: editingPart.price_usd ?? '',
                price_eur: editingPart.price_eur ?? '',
                cost_cny: editingPart.cost_cny ?? '',
                compatible_models: currentModelIds
            });

            // If BOM is missing from the object passed, fetch it now to ensure correct state
            if (editingPart.id && (!editingPart.model_bom || editingPart.model_bom.length === 0)) {
                axios.get(`/api/v1/parts-master/${editingPart.id}`, {
                    headers: { Authorization: `Bearer ${token}` }
                }).then(res => {
                    if (res.data?.success && res.data.data.model_bom) {
                        setFormData(prev => ({
                            ...prev,
                            compatible_models: res.data.data.model_bom.map((m: any) => m.product_model_id)
                        }));
                    }
                });
            }
        } else if (isOpen) {
            setFormData(EMPTY_FORM);
        }
    }, [isOpen, editingPart, token]);

    const updateField = (field: keyof PartFormData, value: string | number | number[]) => {
        setFormData(prev => ({ ...prev, [field]: value }));
    };

    const handleSave = async () => {
        // Validation
        if (!formData.sku.trim() || !formData.name.trim() || !formData.category.trim()) {
            showToast('SKU、配件名称、分类为必填项', 'warning');
            return;
        }

        setSaving(true);
        try {
            const payload = {
                ...formData,
                price_cny: formData.price_cny === '' ? 0 : Number(formData.price_cny),
                price_usd: formData.price_usd === '' ? 0 : Number(formData.price_usd),
                price_eur: formData.price_eur === '' ? 0 : Number(formData.price_eur),
                cost_cny: formData.cost_cny === '' ? 0 : Number(formData.cost_cny),
                compatible_models: formData.compatible_models
            };

            if (isEdit) {
                await axios.patch(`/api/v1/parts-master/${editingPart.id}`, payload, {
                    headers: { Authorization: `Bearer ${token}` }
                });
                showToast('配件已更新', 'success');
            } else {
                await axios.post('/api/v1/parts-master', payload, {
                    headers: { Authorization: `Bearer ${token}` }
                });
                showToast('配件已创建', 'success');
            }
            onSaved();
            onClose();
        } catch (err: any) {
            const msg = err.response?.data?.error?.message || '操作失败';
            showToast(msg, 'error');
        } finally {
            setSaving(false);
        }
    };

    const addModel = (modelId: number) => {
        if (!formData.compatible_models.includes(modelId)) {
            updateField('compatible_models', [...formData.compatible_models, modelId]);
        }
        setModelSearch('');
        setIsDropdownOpen(false);
    };

    const removeModel = (modelId: number) => {
        updateField('compatible_models', formData.compatible_models.filter(id => id !== modelId));
    };

    const filteredModels = modelSearch
        ? allModels.filter(m => {
            const query = modelSearch.toLowerCase();
            return !formData.compatible_models.includes(m.id) && (
                m.name_zh.toLowerCase().includes(query) ||
                (m.name_en && m.name_en.toLowerCase().includes(query)) ||
                m.model_code?.toLowerCase().includes(query)
            );
        })
        : allModels.filter(m => !formData.compatible_models.includes(m.id) && (m.product_family === 'A' || m.product_family === 'C'));

    if (!isOpen) return null;

    return (
        <>
            {/* Overlay */}
            <div
                onClick={onClose}
                style={{
                    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                    background: 'var(--modal-overlay)', backdropFilter: 'blur(4px)',
                    zIndex: 9999
                }}
            />
            {/* Modal */}
            <div style={{
                position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
                width: 860, maxHeight: '85vh',
                background: 'var(--modal-bg)', borderRadius: 16,
                boxShadow: 'var(--glass-shadow-lg)', border: '1px solid var(--glass-border)',
                display: 'flex', flexDirection: 'column', zIndex: 10000,
                overflow: 'hidden'
            }}>
                {/* Header */}
                <div style={{
                    padding: '20px 24px', borderBottom: '1px solid var(--glass-border)',
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    flexShrink: 0
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                        <div style={{
                            width: 44, height: 44, borderRadius: 12,
                            background: isEdit ? 'rgba(59,130,246,0.15)' : 'rgba(16,185,129,0.15)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center'
                        }}>
                            {isEdit ? <Edit2 size={22} color="#3B82F6" /> : <Plus size={22} color="#10B981" />}
                        </div>
                        <div>
                            <div style={{ fontWeight: 600, fontSize: 18, color: 'var(--text-main)' }}>
                                {isEdit ? '编辑配件' : '新增配件'}
                            </div>
                            <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 3 }}>
                                {isEdit ? formData.name || formData.sku : '创建新的维修配件定义'}
                            </div>
                        </div>
                    </div>
                    <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', padding: 4 }}>
                        <X size={22} />
                    </button>
                </div>

                {/* Body - 左右分栏 */}
                <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
                    {/* 左侧 - 基本信息 */}
                    <div className="custom-scroll" style={{ flex: 1, padding: 24, overflowY: 'auto', borderRight: '1px solid var(--glass-border)' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

                            {/* SKU + 物料ID */}
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                                <FormField label="SKU 编码" required>
                                    <input
                                        type="text" value={formData.sku}
                                        onChange={e => updateField('sku', e.target.value)}
                                        style={inputStyle}
                                        placeholder="S1-019-003-01"
                                        disabled={isEdit}
                                    />
                                </FormField>
                                <FormField label="物料 ID">
                                    <input
                                        type="text" value={formData.material_id}
                                        onChange={e => updateField('material_id', e.target.value)}
                                        style={inputStyle}
                                        placeholder="1-019-003-01"
                                    />
                                </FormField>
                            </div>

                            {/* 对外名称 CN/EN */}
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                                <FormField label="对外名称（中文）" required>
                                    <input
                                        type="text" value={formData.name}
                                        onChange={e => updateField('name', e.target.value)}
                                        style={inputStyle}
                                        placeholder="Edge 8K CMOS 传感器"
                                    />
                                </FormField>
                                <FormField label="对外名称（英文）">
                                    <input
                                        type="text" value={formData.name_en}
                                        onChange={e => updateField('name_en', e.target.value)}
                                        style={inputStyle}
                                        placeholder="MAVO Edge 8K Sensor"
                                    />
                                </FormField>
                            </div>

                            {/* 内部名称 CN/EN */}
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                                <FormField label="内部名称（中文）">
                                    <input
                                        type="text" value={formData.name_internal}
                                        onChange={e => updateField('name_internal', e.target.value)}
                                        style={inputStyle}
                                        placeholder="Edge 8K CMOS 传感器"
                                    />
                                </FormField>
                                <FormField label="内部名称（英文）">
                                    <input
                                        type="text" value={formData.name_internal_en}
                                        onChange={e => updateField('name_internal_en', e.target.value)}
                                        style={inputStyle}
                                        placeholder="MAVO Edge 8K Sensor"
                                    />
                                </FormField>
                            </div>

                            {/* 分类 + 状态 */}
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                                <FormField label="分类" required>
                                    <select
                                        value={formData.category}
                                        onChange={e => updateField('category', e.target.value)}
                                        style={selectStyle}
                                    >
                                        <option value="">选择分类...</option>
                                        {CATEGORY_OPTIONS.map(c => (
                                            <option key={c} value={c}>{c}</option>
                                        ))}
                                    </select>
                                </FormField>
                                <FormField label="状态">
                                    <select
                                        value={formData.status}
                                        onChange={e => updateField('status', e.target.value)}
                                        style={selectStyle}
                                    >
                                        {STATUS_OPTIONS.map(s => (
                                            <option key={s.value} value={s.value}>{s.label}</option>
                                        ))}
                                    </select>
                                </FormField>
                            </div>

                            {/* 价格信息 - 移至左侧 */}
                            <div style={{ padding: '16px 20px', background: 'rgba(255,215,0,0.03)', borderRadius: 12, border: '1px solid var(--glass-border)', marginBottom: 4 }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
                                    <DollarSign size={18} color="#FFD700" />
                                    <h4 style={{ margin: 0, fontSize: 15, color: 'var(--text-main)', fontWeight: 600 }}>价格信息</h4>
                                </div>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                                        <FormField label="人民币 (CNY)">
                                            <div style={{ position: 'relative' }}>
                                                <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-tertiary)', fontSize: '0.85rem' }}>¥</span>
                                                <input
                                                    type="number" value={formData.price_cny}
                                                    onChange={e => updateField('price_cny', e.target.value)}
                                                    style={{ ...inputStyle, paddingLeft: 28, fontSize: '0.85rem' }}
                                                    placeholder="0"
                                                />
                                            </div>
                                        </FormField>
                                        <FormField label="成本 (CNY)">
                                            <div style={{ position: 'relative' }}>
                                                <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-tertiary)', fontSize: '0.85rem' }}>¥</span>
                                                <input
                                                    type="number" value={formData.cost_cny}
                                                    onChange={e => updateField('cost_cny', e.target.value)}
                                                    style={{ ...inputStyle, paddingLeft: 28, fontSize: '0.85rem' }}
                                                    placeholder="0"
                                                />
                                            </div>
                                        </FormField>
                                    </div>
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                                        <FormField label="美元 (USD)">
                                            <div style={{ position: 'relative' }}>
                                                <span style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-tertiary)', fontSize: '0.8rem' }}>$</span>
                                                <input
                                                    type="number" value={formData.price_usd}
                                                    onChange={e => updateField('price_usd', e.target.value)}
                                                    style={{ ...inputStyle, paddingLeft: 24, fontSize: '0.85rem' }}
                                                    placeholder="0"
                                                />
                                            </div>
                                        </FormField>
                                        <FormField label="欧元 (EUR)">
                                            <div style={{ position: 'relative' }}>
                                                <span style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-tertiary)', fontSize: '0.8rem' }}>€</span>
                                                <input
                                                    type="number" value={formData.price_eur}
                                                    onChange={e => updateField('price_eur', e.target.value)}
                                                    style={{ ...inputStyle, paddingLeft: 24, fontSize: '0.85rem' }}
                                                    placeholder="0"
                                                />
                                            </div>
                                        </FormField>
                                    </div>
                                </div>
                            </div>

                            {/* 备注 */}
                            <FormField label="备注">
                                <textarea
                                    value={formData.description}
                                    onChange={e => updateField('description', e.target.value)}
                                    rows={3}
                                    style={{ ...inputStyle, resize: 'none' }}
                                    placeholder="可选备注信息..."
                                />
                            </FormField>
                        </div>
                    </div>

                    {/* 右侧 - 价格与兼容性 (侧边栏模式) */}
                    <div className="custom-scroll" style={{ 
                        width: 320, padding: 0, 
                        background: 'rgba(255,215,0,0.03)', 
                        borderLeft: '1px solid var(--glass-border)',
                        display: 'flex', flexDirection: 'column', overflowY: 'auto' 
                    }}>
                        {/* 兼容机型部分 */}
                        <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                            <div style={{ 
                                padding: '16px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                background: 'rgba(255,215,0,0.05)'
                            }}>
                                <h4 style={{ margin: 0, fontSize: 14, color: 'var(--text-main)', fontWeight: 600 }}>
                                    兼容机型 <span style={{ color: 'var(--text-tertiary)', fontWeight: 400, fontSize: '0.8rem' }}>({formData.compatible_models.length})</span>
                                </h4>
                                <button 
                                    onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                                    type="button"
                                    className="btn-kine-lowkey"
                                    style={{ padding: '4px 10px', fontSize: '0.75rem', borderRadius: 6, display: 'flex', alignItems: 'center', gap: 4 }}
                                >
                                    <Plus size={14} /> 添加
                                </button>
                            </div>

                            <div style={{ padding: '12px 20px', flex: 1, display: 'flex', flexDirection: 'column', gap: 12 }}>
                                {/* Expandable Search */}
                                {isDropdownOpen && (
                                    <div style={{ position: 'relative', marginBottom: 8 }}>
                                        <div style={{ 
                                            position: 'relative', 
                                            display: 'flex', alignItems: 'center',
                                            padding: '0 12px',
                                            background: 'var(--modal-bg)',
                                            border: '2px solid #FFD700',
                                            borderRadius: 12,
                                            boxShadow: '0 4px 12px rgba(255,215,0,0.15)',
                                            transition: 'all 0.2s'
                                        }}>
                                            <Search size={16} style={{ color: 'var(--text-tertiary)', marginRight: 10 }} />
                                            <input
                                                type="text"
                                                value={modelSearch}
                                                onChange={e => setModelSearch(e.target.value)}
                                                placeholder="搜索机型名称、代号..."
                                                autoFocus
                                                style={{ 
                                                    flex: 1, height: 42, background: 'transparent', border: 'none', 
                                                    outline: 'none', color: 'var(--text-main)', fontSize: '0.9rem' 
                                                }}
                                            />
                                        </div>

                                        <div style={{
                                            position: 'absolute', top: 'calc(100% + 8px)', left: 0, right: 0,
                                            background: 'var(--modal-bg)', 
                                            border: '1px solid var(--glass-border)',
                                            borderRadius: 12, 
                                            boxShadow: 'var(--glass-shadow-lg)',
                                            maxHeight: 300, overflowY: 'auto', zIndex: 100
                                        }} className="custom-scroll">
                                            <div style={{ 
                                                padding: '12px 16px 8px', fontSize: '0.75rem', 
                                                color: 'var(--text-tertiary)', fontWeight: 600,
                                                display: 'flex', justifyContent: 'space-between'
                                            }}>
                                                <span>{modelSearch ? `搜索结果 (${filteredModels.length})` : '建议机型 (A/C)'}</span>
                                            </div>
                                            
                                            {filteredModels.length === 0 ? (
                                                <div style={{ padding: '20px 16px', textAlign: 'center', fontSize: '0.85rem', color: 'var(--text-tertiary)' }}>
                                                    未找到匹配机型
                                                </div>
                                            ) : (
                                                <div style={{ padding: '0 8px 8px' }}>
                                                    {filteredModels.map(m => {
                                                        const fam = FAMILY_LABELS[m.product_family] || { label: m.product_family, color: 'rgba(255,255,255,0.1)', text: 'var(--text-secondary)' };
                                                        const displayName = language === 'zh' ? m.name_zh : (m.name_en || m.name_zh);
                                                        
                                                        return (
                                                            <div 
                                                                key={m.id}
                                                                onClick={() => addModel(m.id)}
                                                                style={{ 
                                                                    padding: '10px 12px', cursor: 'pointer', borderRadius: 10,
                                                                    display: 'flex', alignItems: 'center', gap: 12,
                                                                    marginBottom: 4, transition: 'all 0.1s'
                                                                }}
                                                                onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,215,0,0.08)'}
                                                                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                                                            >
                                                                <div style={{
                                                                    width: 32, height: 32, borderRadius: 8,
                                                                    background: fam.color, display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                                    color: fam.text, fontSize: '0.8rem', fontWeight: 700
                                                                }}>
                                                                    {m.product_family}
                                                                </div>
                                                                <div style={{ flex: 1 }}>
                                                                    <div style={{ fontSize: '0.85rem', color: 'var(--text-main)', fontWeight: 600 }}>{displayName}</div>
                                                                    <div style={{ fontSize: '0.7rem', color: 'var(--text-tertiary)' }}>{m.model_code}</div>
                                                                </div>
                                                                <Plus size={14} style={{ color: 'var(--brand-main)', opacity: 0.6 }} />
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                )}

                                {/* Selected Models List */}
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                                    {formData.compatible_models.length === 0 ? (
                                        <div style={{ padding: '30px 20px', textAlign: 'center', border: '1px dashed var(--glass-border)', borderRadius: 10, color: 'var(--text-tertiary)', fontSize: '0.8rem' }}>
                                            暂无管理机型
                                        </div>
                                    ) : (
                                        formData.compatible_models.map(id => {
                                            const m = allModels.find(am => am.id === id);
                                            if (!m) return null;
                                            const fam = FAMILY_LABELS[m.product_family] || { label: m.product_family, color: 'rgba(255,255,255,0.1)', text: 'var(--text-secondary)' };
                                            return (
                                                <div key={id} style={{
                                                    padding: '12px', borderRadius: 10,
                                                    background: 'var(--modal-bg)', border: '1px solid var(--glass-border)',
                                                    boxShadow: '0 2px 4px rgba(0,0,0,0.05)',
                                                    display: 'flex', alignItems: 'center', gap: 12
                                                }}>
                                                    <div style={{
                                                        width: 32, height: 32, borderRadius: 8,
                                                        background: fam.color, display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                        color: fam.text, fontSize: '0.85rem', fontWeight: 700
                                                    }}>
                                                        {m.product_family}
                                                    </div>
                                                    <div style={{ flex: 1, minWidth: 0 }}>
                                                        <div style={{ fontSize: '0.85rem', color: 'var(--text-main)', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                            {language === 'zh' ? m.name_zh : (m.name_en || m.name_zh)}
                                                        </div>
                                                        <div style={{ fontSize: '0.7rem', color: 'var(--text-tertiary)' }}>{m.model_code || '—'}</div>
                                                    </div>
                                                    <button 
                                                        onClick={() => removeModel(id)}
                                                        type="button"
                                                        style={{ padding: 4, background: 'rgba(239,68,68,0.05)', border: 'none', color: '#EF4444', borderRadius: 4, cursor: 'pointer' }}
                                                    >
                                                        <X size={14} />
                                                    </button>
                                                </div>
                                            );
                                        })
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div style={{
                    padding: '16px 24px', borderTop: '1px solid var(--glass-border)',
                    display: 'flex', justifyContent: 'flex-end', gap: 12, flexShrink: 0
                }}>
                    <button
                        onClick={onClose}
                        style={{
                            padding: '10px 20px', borderRadius: 8,
                            background: 'transparent', border: '1px solid var(--glass-border)',
                            color: 'var(--text-main)', fontSize: '0.9rem',
                            cursor: 'pointer'
                        }}
                    >
                        取消
                    </button>
                    <button
                        onClick={handleSave}
                        disabled={saving}
                        style={{
                            padding: '10px 24px', borderRadius: 8,
                            background: saving ? 'var(--glass-bg-hover)' : '#FFD700',
                            border: 'none', color: '#000', fontSize: '0.9rem',
                            fontWeight: 600, cursor: saving ? 'not-allowed' : 'pointer',
                            display: 'flex', alignItems: 'center', gap: 8,
                            opacity: saving ? 0.6 : 1
                        }}
                    >
                        {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                        {saving ? '保存中...' : (isEdit ? '更新' : '创建')}
                    </button>
                </div>
            </div>
        </>
    );
};

// FormField sub-component
const FormField: React.FC<{ label: string; required?: boolean; children: React.ReactNode }> = ({ label, required, children }) => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: 600 }}>
            {label} {required && <span style={{ color: '#EF4444' }}>*</span>}
        </label>
        {children}
    </div>
);

export default PartsEditModal;
