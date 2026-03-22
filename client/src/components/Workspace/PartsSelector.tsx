/**
 * PartsSelector - 配件选择器组件
 * 用于维修报告中从配件库选择配件
 * 支持：搜索配件、BOM推荐、手动添加非标准配件
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Search, Trash2, Package, Loader2, Sparkles } from 'lucide-react';
import axios from 'axios';
import { useAuthStore } from '../../store/useAuthStore';

export interface PartUsed {
    id: string;
    part_id?: number;           // 关联 parts_master.id
    name: string;
    part_number: string;        // SKU
    quantity: number;
    unit_price: number;
    status: 'new' | 'refurbished';
    source_type?: string;       // 来源类型: hq_inventory, dealer_inventory, external_purchase, warranty_free
}

interface PartOption {
    id: number;
    sku: string;
    name: string;
    name_en?: string;
    category: string;
    price_cny: number;
    price_usd: number;
    price_eur: number;
    compatible_models?: string[];
}

interface PartsSelectorProps {
    ticketId: number;
    productModel?: string;      // 产品型号名称（用于显示）
    productModelId?: number;    // 产品型号ID（用于查询兼容配件）
    selectedParts: PartUsed[];
    onPartsChange: (parts: PartUsed[]) => void;
    canEdit: boolean;
    currency: string;
    isWarranty?: boolean;       // 是否保内
}

const sourceTypeOptions = [
    { value: 'hq_inventory', label: '总部库存', color: '#3B82F6' },
    { value: 'dealer_inventory', label: '经销商库存', color: '#10B981' },
    { value: 'external_purchase', label: '外部采购', color: '#FFD200' },
    { value: 'warranty_free', label: '保修免费', color: '#8B5CF6' }
];

export const PartsSelector: React.FC<PartsSelectorProps> = ({
    ticketId: _ticketId,  // 预留，用于未来扩展
    productModel,
    productModelId,
    selectedParts,
    onPartsChange,
    canEdit,
    currency,
    isWarranty
}) => {
    const { token } = useAuthStore();
    const headers = { Authorization: `Bearer ${token}` };

    const [searchTerm, setSearchTerm] = useState('');
    const [searchResults, setSearchResults] = useState<PartOption[]>([]);
    const [searching, setSearching] = useState(false);
    const [showDropdown, setShowDropdown] = useState(false);
    const [bomParts, setBomParts] = useState<PartOption[]>([]);
    const [showBomRecommend, setShowBomRecommend] = useState(false);
    const [showManualAdd, setShowManualAdd] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);
    const searchInputRef = useRef<HTMLInputElement>(null);

    // 手动添加表单
    const [manualPart, setManualPart] = useState<Partial<PartUsed>>({
        name: '',
        part_number: '',
        quantity: 1,
        unit_price: 0,
        status: 'new',
        source_type: 'hq_inventory'
    });

    // 点击外部关闭下拉
    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
                setShowDropdown(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // 搜索配件（限定为兼容配件，无结果时回退全部）
    const searchParts = useCallback(async (term: string) => {
        if (!term || term.length < 1) {
            setSearchResults([]);
            return;
        }
        setSearching(true);
        try {
            // 优先使用 productModelId 查询兼容配件
            let res = await axios.get('/api/v1/parts-master', {
                headers,
                params: { 
                    search: term, 
                    status: 'active', 
                    page_size: 100,
                    product_model_id: productModelId || undefined
                }
            });
            // 如果兼容配件无结果，回退搜索所有配件
            if (res.data?.success && res.data.data.length === 0 && productModelId) {
                res = await axios.get('/api/v1/parts-master', {
                    headers,
                    params: { search: term, status: 'active', page_size: 100 }
                });
            }
            if (res.data?.success) {
                setSearchResults(res.data.data);
                setShowDropdown(true);
            }
        } catch (err) {
            console.error('Failed to search parts:', err);
        } finally {
            setSearching(false);
        }
    }, [headers, productModelId]);

    // 加载兼容配件（聚焦时显示，无结果时回退全部）
    const loadCompatibleParts = useCallback(async () => {
        setSearching(true);
        try {
            // 优先使用 productModelId 加载兼容配件
            let res = productModelId ? await axios.get('/api/v1/parts-master', {
                headers,
                params: { status: 'active', page_size: 100, product_model_id: productModelId }
            }) : null;
            
            // 如果兼容配件无结果或无产品型号ID，加载所有配件
            if (!res || !res.data?.success || res.data.data.length === 0) {
                res = await axios.get('/api/v1/parts-master', {
                    headers,
                    params: { status: 'active', page_size: 100 }
                });
            }
            if (res && res.data?.success) {
                setSearchResults(res.data.data);
                setShowDropdown(true);
            }
        } catch (err) {
            console.error('Failed to load compatible parts:', err);
        } finally {
            setSearching(false);
        }
    }, [headers, productModelId]);

    // 防抖搜索（1个字符就开始搜索），搜索词为空时不清空结果（避免闪烁）
    useEffect(() => {
        if (searchTerm.length < 1) return;
        const timer = setTimeout(() => searchParts(searchTerm), 200);
        return () => clearTimeout(timer);
    }, [searchTerm, searchParts]);

    // 获取BOM推荐配件
    const fetchBomParts = useCallback(async () => {
        if (!productModel) return;
        try {
            const res = await axios.get('/api/v1/parts-master/bom', {
                headers,
                params: { product_model: productModel }
            });
            if (res.data?.success) {
                setBomParts(res.data.data || []);
            }
        } catch (err) {
            console.error('Failed to fetch BOM parts:', err);
        }
    }, [productModel, headers]);

    useEffect(() => {
        if (productModel) {
            fetchBomParts();
        }
    }, [productModel, fetchBomParts]);

    // 选择配件
    const handleSelectPart = (part: PartOption) => {
        // 检查是否已添加
        const exists = selectedParts.some(p => p.part_id === part.id);
        if (exists) {
            // 增加数量
            const updated = selectedParts.map(p =>
                p.part_id === part.id ? { ...p, quantity: p.quantity + 1 } : p
            );
            onPartsChange(updated);
        } else {
            // 添加新配件
            const newPart: PartUsed = {
                id: `part-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                part_id: part.id,
                name: part.name,
                part_number: part.sku,
                quantity: 1,
                unit_price: currency === 'USD' ? part.price_usd : currency === 'EUR' ? part.price_eur : part.price_cny,
                status: 'new',
                source_type: isWarranty ? 'warranty_free' : 'hq_inventory'
            };
            onPartsChange([...selectedParts, newPart]);
        }
        setSearchTerm('');
        setShowDropdown(false);
        setShowBomRecommend(false);
    };

    // 更新配件
    const handleUpdatePart = (index: number, updates: Partial<PartUsed>) => {
        const updated = [...selectedParts];
        updated[index] = { ...updated[index], ...updates };
        onPartsChange(updated);
    };

    // 删除配件
    const handleRemovePart = (index: number) => {
        const updated = selectedParts.filter((_, i) => i !== index);
        onPartsChange(updated);
    };

    // 手动添加配件
    const handleManualAdd = () => {
        if (!manualPart.name) return;
        const newPart: PartUsed = {
            id: `manual-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            name: manualPart.name || '',
            part_number: manualPart.part_number || '',
            quantity: manualPart.quantity || 1,
            unit_price: manualPart.unit_price || 0,
            status: manualPart.status || 'new',
            source_type: manualPart.source_type || 'hq_inventory'
        };
        onPartsChange([...selectedParts, newPart]);
        setManualPart({
            name: '',
            part_number: '',
            quantity: 1,
            unit_price: 0,
            status: 'new',
            source_type: 'hq_inventory'
        });
        setShowManualAdd(false);
    };

    // 格式化价格
    const formatPrice = (amount: number) => {
        const symbol = currency === 'USD' ? 'US $' : currency === 'EUR' ? '€' : '¥';
        return `${symbol}${amount.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    };

    // 计算小计 (保留以备后续UI展示)
    const subtotal = selectedParts.reduce((sum, p) => sum + p.quantity * p.unit_price, 0);
    void subtotal; // 暂时未在UI中显示，但保留计算逻辑

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {/* 搜索区域 */}
            {canEdit && (
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <div style={{ flex: 1, position: 'relative' }} ref={dropdownRef}>
                        <div style={{ position: 'relative' }}>
                            <Search
                                size={16}
                                style={{
                                    position: 'absolute',
                                    left: 12,
                                    top: '50%',
                                    transform: 'translateY(-50%)',
                                    color: 'var(--text-tertiary)'
                                }}
                            />
                            <input
                                ref={searchInputRef}
                                type="text"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                onFocus={() => {
                                    // 聚焦时：如果有搜索词则显示下拉，否则加载兼容配件
                                    if (searchTerm.length >= 1 && searchResults.length > 0) {
                                        setShowDropdown(true);
                                    } else if (productModel) {
                                        // 聚焦时加载兼容配件（无论搜索框是否为空）
                                        loadCompatibleParts();
                                    }
                                }}
                                placeholder="输入SKU或零件号搜索添加配件..."
                                style={{
                                    width: '100%',
                                    padding: '10px 12px 10px 36px',
                                    background: 'var(--glass-bg-light)',
                                    border: '1px solid var(--glass-border)',
                                    borderRadius: 8,
                                    color: 'var(--text-main)',
                                    fontSize: 13,
                                    outline: 'none'
                                }}
                            />
                            {searching && (
                                <Loader2
                                    size={16}
                                    className="animate-spin"
                                    style={{
                                        position: 'absolute',
                                        right: 12,
                                        top: '50%',
                                        transform: 'translateY(-50%)',
                                        color: 'var(--text-tertiary)'
                                    }}
                                />
                            )}
                        </div>

                        {/* 搜索结果下拉 - 不透明背景，确保不被层叠 */}
                        {showDropdown && searchResults.length > 0 && (
                            <div style={{
                                position: 'absolute',
                                top: '100%',
                                left: 0,
                                right: 0,
                                marginTop: 4,
                                background: 'var(--card-bg)',
                                border: '1px solid var(--glass-border)',
                                borderRadius: 8,
                                maxHeight: 500,  // 增加高度以显示更多
                                overflow: 'auto',
                                zIndex: 9999,
                                boxShadow: '0 8px 24px rgba(0,0,0,0.3)'
                            }}>
                                {searchResults.map(part => (
                                    <div
                                        key={part.id}
                                        onClick={() => handleSelectPart(part)}
                                        style={{
                                            padding: '10px 14px',
                                            cursor: 'pointer',
                                            borderBottom: '1px solid var(--glass-border)',
                                            transition: 'background 0.15s'
                                        }}
                                        onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255,215,0,0.1)'}
                                        onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                                    >
                                        <div style={{ fontWeight: 500, fontSize: 13, color: 'var(--text-main)' }}>
                                            {part.name}
                                        </div>
                                        <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 2, display: 'flex', gap: 8 }}>
                                            <span style={{ fontVariantNumeric: 'tabular-nums' }}>{part.sku}</span>
                                            <span>{formatPrice(currency === 'USD' ? part.price_usd : currency === 'EUR' ? part.price_eur : part.price_cny)}</span>
                                            {part.category && <span style={{ opacity: 0.7 }}>{part.category}</span>}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* BOM推荐按钮 */}
                    {productModel && bomParts.length > 0 && (
                        <button
                            onClick={() => setShowBomRecommend(!showBomRecommend)}
                            style={{
                                padding: '10px 14px',
                                background: showBomRecommend ? 'rgba(139,92,246,0.2)' : 'var(--glass-bg-light)',
                                border: `1px solid ${showBomRecommend ? 'rgba(139,92,246,0.4)' : 'var(--glass-border)'}`,
                                borderRadius: 8,
                                color: showBomRecommend ? '#8B5CF6' : 'var(--text-secondary)',
                                fontSize: 12,
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                gap: 6,
                                whiteSpace: 'nowrap'
                            }}
                        >
                            <Sparkles size={14} /> BOM推荐
                        </button>
                    )}


                </div>
            )}

            {/* BOM推荐面板 */}
            {showBomRecommend && bomParts.length > 0 && (
                <div style={{
                    padding: 12,
                    background: 'rgba(139,92,246,0.05)',
                    border: '1px solid rgba(139,92,246,0.2)',
                    borderRadius: 8
                }}>
                    <div style={{ fontSize: 12, color: '#8B5CF6', marginBottom: 8, fontWeight: 500 }}>
                        基于 {productModel} 推荐的常用配件
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                        {bomParts.map(part => (
                            <button
                                key={part.id}
                                onClick={() => handleSelectPart(part)}
                                style={{
                                    padding: '6px 12px',
                                    background: 'var(--glass-bg)',
                                    border: '1px solid var(--glass-border)',
                                    borderRadius: 6,
                                    color: 'var(--text-main)',
                                    fontSize: 12,
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 6
                                }}
                            >
                                <Package size={12} />
                                {part.name}
                                <span style={{ color: 'var(--text-tertiary)', fontSize: 11 }}>
                                    {formatPrice(currency === 'USD' ? part.price_usd : currency === 'EUR' ? part.price_eur : part.price_cny)}
                                </span>
                            </button>
                        ))}
                    </div>
                </div>
            )}

            {/* 手动添加表单 */}
            {showManualAdd && canEdit && (
                <div style={{
                    padding: 14,
                    background: 'rgba(59,130,246,0.05)',
                    border: '1px solid rgba(59,130,246,0.2)',
                    borderRadius: 8
                }}>
                    <div style={{ fontSize: 12, color: '#3B82F6', marginBottom: 10, fontWeight: 500 }}>
                        手动添加非标准配件
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 120px 80px 100px 80px', gap: 8, alignItems: 'end' }}>
                        <div>
                            <label style={{ display: 'block', fontSize: 11, color: 'var(--text-tertiary)', marginBottom: 4 }}>配件名称 *</label>
                            <input
                                type="text"
                                value={manualPart.name || ''}
                                onChange={(e) => setManualPart({ ...manualPart, name: e.target.value })}
                                placeholder="配件名称"
                                style={{
                                    width: '100%',
                                    padding: 8,
                                    background: 'var(--glass-bg)',
                                    border: '1px solid var(--glass-border)',
                                    borderRadius: 4,
                                    color: 'var(--text-main)',
                                    fontSize: 13
                                }}
                            />
                        </div>
                        <div>
                            <label style={{ display: 'block', fontSize: 11, color: 'var(--text-tertiary)', marginBottom: 4 }}>配件号</label>
                            <input
                                type="text"
                                value={manualPart.part_number || ''}
                                onChange={(e) => setManualPart({ ...manualPart, part_number: e.target.value })}
                                placeholder="SKU"
                                style={{
                                    width: '100%',
                                    padding: 8,
                                    background: 'var(--glass-bg)',
                                    border: '1px solid var(--glass-border)',
                                    borderRadius: 4,
                                    color: 'var(--text-main)',
                                    fontSize: 13
                                }}
                            />
                        </div>
                        <div>
                            <label style={{ display: 'block', fontSize: 11, color: 'var(--text-tertiary)', marginBottom: 4 }}>数量</label>
                            <input
                                type="number"
                                min={1}
                                value={manualPart.quantity || 1}
                                onChange={(e) => setManualPart({ ...manualPart, quantity: parseInt(e.target.value) || 1 })}
                                style={{
                                    width: '100%',
                                    padding: 8,
                                    background: 'var(--glass-bg)',
                                    border: '1px solid var(--glass-border)',
                                    borderRadius: 4,
                                    color: 'var(--text-main)',
                                    fontSize: 13,
                                    textAlign: 'center'
                                }}
                            />
                        </div>
                        <div>
                            <label style={{ display: 'block', fontSize: 11, color: 'var(--text-tertiary)', marginBottom: 4 }}>单价</label>
                            <input
                                type="number"
                                min={0}
                                step={0.01}
                                value={manualPart.unit_price || 0}
                                onChange={(e) => setManualPart({ ...manualPart, unit_price: parseFloat(e.target.value) || 0 })}
                                style={{
                                    width: '100%',
                                    padding: 8,
                                    background: 'var(--glass-bg)',
                                    border: '1px solid var(--glass-border)',
                                    borderRadius: 4,
                                    color: 'var(--text-main)',
                                    fontSize: 13,
                                    textAlign: 'right'
                                }}
                            />
                        </div>
                        <button
                            onClick={handleManualAdd}
                            disabled={!manualPart.name}
                            style={{
                                padding: 8,
                                background: manualPart.name ? '#3B82F6' : 'var(--glass-bg)',
                                border: 'none',
                                borderRadius: 4,
                                color: manualPart.name ? '#fff' : 'var(--text-tertiary)',
                                fontSize: 12,
                                cursor: manualPart.name ? 'pointer' : 'not-allowed',
                                fontWeight: 500
                            }}
                        >
                            添加
                        </button>
                    </div>
                </div>
            )}

            {/* 已选配件列表表头 */}
            {selectedParts.length > 0 && (
                <div style={{
                    display: 'flex',
                    gap: 8,
                    padding: '8px 12px',
                    background: 'var(--glass-bg-light)',
                    borderRadius: 8,
                    fontSize: 12,
                    color: 'var(--text-tertiary)'
                }}>
                    <span style={{ flex: 1 }}>配件名称</span>
                    <span style={{ width: 150 }}>配件号</span>
                    <span style={{ width: 50, textAlign: 'center' }}>数量</span>
                    <span style={{ width: 90, textAlign: 'right' }}>单价</span>
                    <span style={{ width: 70 }}>状态</span>
                    {canEdit && <span style={{ width: 90 }}>来源</span>}
                    <span style={{ width: 80, textAlign: 'right' }}>小计</span>
                    {canEdit && <span style={{ width: 36 }}></span>}
                </div>
            )}

            {/* 已选配件列表 */}
            {selectedParts.map((part, index) => (
                <div
                    key={part.id}
                    style={{
                        display: 'flex',
                        gap: 8,
                        padding: 10,
                        background: 'rgba(255,255,255,0.03)',
                        borderRadius: 6,
                        alignItems: 'center'
                    }}
                >
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 2 }}>
                        {canEdit ? (
                            <input
                                type="text"
                                value={part.name}
                                onChange={(e) => handleUpdatePart(index, { name: e.target.value })}
                                style={{
                                    padding: 8,
                                    background: 'var(--glass-bg-light)',
                                    border: '1px solid var(--glass-border)',
                                    borderRadius: 4,
                                    color: 'var(--text-main)',
                                    fontSize: 13
                                }}
                            />
                        ) : (
                            <span style={{ color: 'var(--text-main)', fontSize: 13 }}>{part.name}</span>
                        )}
                        {part.part_id && (
                            <span style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>
                                ID: {part.part_id}
                            </span>
                        )}
                    </div>
                    {canEdit ? (
                        <input
                            type="text"
                            value={part.part_number}
                            onChange={(e) => handleUpdatePart(index, { part_number: e.target.value })}
                            placeholder="SKU"
                            style={{
                                width: 150,
                                padding: 8,
                                background: 'var(--glass-bg-light)',
                                border: '1px solid var(--glass-border)',
                                borderRadius: 4,
                                color: 'var(--text-main)',
                                fontSize: 13,
                                fontVariantNumeric: 'tabular-nums'
                            }}
                        />
                    ) : (
                        <span style={{ width: 150, fontVariantNumeric: 'tabular-nums', fontSize: 12, color: 'var(--text-secondary)' }}>
                            {part.part_number}
                        </span>
                    )}
                    <input
                        type="number"
                        value={part.quantity}
                        onChange={(e) => handleUpdatePart(index, { quantity: parseInt(e.target.value) || 1 })}
                        disabled={!canEdit}
                        min={1}
                        style={{
                            width: 50,
                            padding: 8,
                            background: 'var(--glass-bg-light)',
                            border: '1px solid var(--glass-border)',
                            borderRadius: 4,
                            color: 'var(--text-main)',
                            fontSize: 13,
                            textAlign: 'center'
                        }}
                    />
                    <input
                        type="number"
                        value={part.unit_price || 0}
                        onChange={(e) => handleUpdatePart(index, { unit_price: parseFloat(e.target.value) || 0 })}
                        disabled={!canEdit}
                        min={0}
                        step={0.01}
                        style={{
                            width: 90,
                            padding: 8,
                            background: 'var(--glass-bg-light)',
                            border: '1px solid var(--glass-border)',
                            borderRadius: 4,
                            color: 'var(--text-main)',
                            fontSize: 13,
                            textAlign: 'right'
                        }}
                    />
                    <select
                        value={part.status}
                        onChange={(e) => handleUpdatePart(index, { status: e.target.value as 'new' | 'refurbished' })}
                        disabled={!canEdit}
                        style={{
                            width: 70,
                            padding: 8,
                            background: 'var(--glass-bg-light)',
                            border: '1px solid var(--glass-border)',
                            borderRadius: 4,
                            color: 'var(--text-main)',
                            fontSize: 12
                        }}
                    >
                        <option value="new">新件</option>
                        <option value="refurbished">翻新</option>
                    </select>
                    {canEdit && (
                        <select
                            value={part.source_type || 'hq_inventory'}
                            onChange={(e) => handleUpdatePart(index, { source_type: e.target.value })}
                            style={{
                                width: 90,
                                padding: 8,
                                background: 'var(--glass-bg-light)',
                                border: '1px solid var(--glass-border)',
                                borderRadius: 4,
                                color: 'var(--text-main)',
                                fontSize: 11
                            }}
                        >
                            {sourceTypeOptions.map(opt => (
                                <option key={opt.value} value={opt.value}>{opt.label}</option>
                            ))}
                        </select>
                    )}
                    <div style={{
                        width: 80,
                        textAlign: 'right',
                        color: 'var(--text-main)',
                        fontWeight: 600,
                        fontSize: 13
                    }}>
                        {formatPrice(part.quantity * part.unit_price)}
                    </div>
                    {canEdit && (
                        <button
                            onClick={() => handleRemovePart(index)}
                            style={{
                                padding: 6,
                                background: 'rgba(239,68,68,0.2)',
                                border: 'none',
                                borderRadius: 4,
                                color: '#EF4444',
                                cursor: 'pointer'
                            }}
                        >
                            <Trash2 size={14} />
                        </button>
                    )}
                </div>
            ))}

            {/* 空状态 */}
            {selectedParts.length === 0 && (
                <div style={{
                    textAlign: 'center',
                    padding: 24,
                    color: 'var(--text-tertiary)',
                    fontSize: 13
                }}>
                    <Package size={32} style={{ margin: '0 auto 12px', opacity: 0.3 }} />
                    <div>暂无配件</div>
                    {canEdit && <div style={{ fontSize: 11, marginTop: 4 }}>使用上方搜索框添加配件</div>}
                </div>
            )}
        </div>
    );
};

export default PartsSelector;
