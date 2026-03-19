import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { X, Save, Plus, Edit2, Shield, Package, Tag, Settings, Calendar, Check, AlertTriangle, Calculator, CheckCircle } from 'lucide-react';
import { useAuthStore } from '../../store/useAuthStore';
import ProductWarrantyRegistrationModal from '../Service/ProductWarrantyRegistrationModal';
import type { WarrantyRegistrationData } from '../Service/ProductWarrantyRegistrationModal';
import { CustomDatePicker } from '../UI/CustomDatePicker';

interface Product {
    id: number;
    model_name: string;
    internal_name: string;
    serial_number: string;
    product_sku: string;
    product_type: string;
    product_line: 'Camera' | 'EVF' | 'Accessory';
    product_family: 'A' | 'B' | 'C' | 'D' | 'E';
    production_date: string;
    is_iot_device: boolean;
    is_activated: boolean;
    activation_date: string;
    last_connected_at: string;
    firmware_version: string;
    ip_address: string;
    sales_channel: 'DIRECT' | 'DEALER';
    original_order_id: string;
    sold_to_dealer_id: number;
    ship_to_dealer_date: string;
    current_owner_id: number;
    current_owner_name?: string;
    registration_date: string;
    sales_invoice_date: string;
    sales_invoice_proof: string;
    warranty_start_date: string;
    warranty_months: number;
    warranty_end_date: string;
    warranty_status: 'ACTIVE' | 'EXPIRED' | 'PENDING';
    status: 'ACTIVE' | 'IN_REPAIR' | 'STOLEN' | 'SCRAPPED';
    description: string;
    sku_id?: number | null;
}

interface ProductModel {
    id: number;
    name_zh: string;
    model_code: string;
    sn_prefix?: string;
    product_type?: string;
    product_family?: string;
}

interface ProductSku {
    id: number;
    model_id: number;
    sku_code: string;
    display_name: string;
}

interface ProductModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: (product: Product) => void;
    editingProduct: Product | null;
    prefillSerialNumber?: string;  // 预填序列号
    prefillProductName?: string;   // 预填型号名称
}

const ProductModal: React.FC<ProductModalProps> = ({ 
    isOpen, onClose, onSuccess, editingProduct, 
    prefillSerialNumber, prefillProductName 
}) => {
    const { token } = useAuthStore();
    const [saving, setSaving] = useState(false);
    const [models, setModels] = useState<ProductModel[]>([]);
    const [skus, setSkus] = useState<ProductSku[]>([]);
    const [, setProductDropdownSettings] = useState<any>(null);
    const [showWarrantyModal, setShowWarrantyModal] = useState(false);
    // 补充信息字段现在始终展开显示在右侧栏
    // 暂存的保修数据（方案B：产品未入库时暂存，入库时一并提交）
    const [pendingWarrantyData, setPendingWarrantyData] = useState<WarrantyRegistrationData | null>(null);
    // 传递给保修注册窗口的预填数据
    const [warrantyPrefillData, setWarrantyPrefillData] = useState<{
        productLine?: 'Camera' | 'EVF' | 'Accessory';
        productFamily?: 'A' | 'B' | 'C' | 'D' | 'E';
        skuId?: number;
        salesChannel?: 'DIRECT' | 'DEALER';
    }>({});
    
    // 审计确认屏障状态
    const [isAuditBarrierOpen, setIsAuditBarrierOpen] = useState(false);
    const [barrierCountdown, setBarrierCountdown] = useState(0);
    const [showWarrantyCalcModal, setShowWarrantyCalcModal] = useState(false);
    const barrierTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

    // 5s 倒计时 Effect
    useEffect(() => {
        if (isAuditBarrierOpen) {
            setBarrierCountdown(5);
            barrierTimerRef.current = setInterval(() => {
                setBarrierCountdown(prev => {
                    if (prev <= 1) {
                        if (barrierTimerRef.current) clearInterval(barrierTimerRef.current);
                        return 0;
                    }
                    return prev - 1;
                });
            }, 1000);
        } else {
            if (barrierTimerRef.current) clearInterval(barrierTimerRef.current);
        }
        return () => { if (barrierTimerRef.current) clearInterval(barrierTimerRef.current); };
    }, [isAuditBarrierOpen]);

    const [formData, setFormData] = useState<Partial<Product>>({
        model_name: '',
        serial_number: '',
        product_sku: '',
        product_line: 'Camera',
        product_family: 'A',
        firmware_version: '',
        production_date: '',
        description: '',
        status: 'ACTIVE',
        sales_channel: 'DIRECT',
        warranty_months: 24,
    });

    useEffect(() => {
        if (isOpen) {
            fetchModelsAndSkus();
            if (editingProduct) {
                setFormData({ ...editingProduct });
            } else {
                // 新建时使用预填值
                setFormData({
                    model_name: prefillProductName || '',
                    serial_number: prefillSerialNumber || '',
                    product_sku: '',
                    product_line: 'Camera',
                    product_family: 'A',
                    firmware_version: '',
                    production_date: '',
                    description: '',
                    status: 'ACTIVE',
                    sales_channel: 'DIRECT',
                    warranty_months: 24,
                });
            }
        }
    }, [isOpen, editingProduct, prefillSerialNumber, prefillProductName]);

    const fetchModelsAndSkus = async () => {
        try {
            const [modelsRes, skusRes, settingsRes] = await Promise.all([
                axios.get('/api/v1/admin/product-models', { headers: { Authorization: `Bearer ${token}` } }),
                axios.get('/api/v1/admin/product-skus', { headers: { Authorization: `Bearer ${token}` } }),
                axios.get('/api/v1/system/public-settings', { headers: { Authorization: `Bearer ${token}` } })
            ]);
            
            // 保存系统设置
            if (settingsRes.data.success) {
                setProductDropdownSettings(settingsRes.data.data.product_dropdown);
            }
            
            if (modelsRes.data.success) {
                let modelsData = modelsRes.data.data;
                
                // SN前缀自动匹配产品型号（仅在新建产品时）
                const snInput = (prefillSerialNumber || '').trim().toUpperCase();
                
                // 应用系统设置过滤（SN为空时）
                if (snInput.length === 0 && settingsRes.data.success) {
                    const settings = settingsRes.data.data.product_dropdown;
                    if (settings) {
                        const familyVisibility = settings.family_visibility || { A: true, B: false, C: true, D: true, E: false };
                        const enableTypeFilter = settings.enable_type_filter !== false;
                        const allowedTypes = settings.allowed_types || ['电影机', '摄像机', '电子寻像器', '寻像器', '套装'];
                        
                        modelsData = modelsData.filter((p: ProductModel) => {
                            // 必须是启用的族群
                            if (!familyVisibility[p.product_family as keyof typeof familyVisibility]) return false;
                            
                            // 必须有 sn_prefix
                            if (!p.sn_prefix) return false;
                            
                            // 检查产品类型过滤
                            if (enableTypeFilter) {
                                const productType = (p.product_type || '').toLowerCase();
                                const matchesType = allowedTypes.some((type: string) => 
                                    productType.includes(type.toLowerCase())
                                );
                                if (!matchesType) return false;
                            }
                            
                            return true;
                        });
                    }
                }
                
                setModels(modelsData);
                
                // SN前缀自动匹配产品型号（仅在新建产品时）
                if (!editingProduct && prefillSerialNumber) {
                    const matchedByPrefix = modelsData.filter((p: ProductModel) => 
                        p.sn_prefix && (
                            p.sn_prefix.toUpperCase() === snInput ||  // 精确匹配
                            snInput.startsWith(p.sn_prefix.toUpperCase())  // 输入以产品前缀开头
                        )
                    );
                    
                    if (matchedByPrefix.length === 1) {
                        // 只有一个精确匹配，自动选择产品型号并填充分类和族群
                        const matched = matchedByPrefix[0];
                        setFormData(prev => ({
                            ...prev,
                            model_name: matched.name_zh,
                            product_line: mapProductTypeToLine(matched.product_type) || 'Camera',
                            product_family: (matched.product_family as 'A' | 'B' | 'C' | 'D' | 'E') || 'A'
                        }));
                    }
                }
            }
            if (skusRes.data.success) setSkus(skusRes.data.data);
        } catch (err) {
            console.error('Failed to fetch models or skus', err);
        }
    };
    
    // 辅助函数：将product_type映射到产品线
    const mapProductTypeToLine = (productType?: string): 'Camera' | 'EVF' | 'Accessory' | null => {
        if (!productType) return null;
        if (productType.includes('电影机') || productType.includes('摄像机')) return 'Camera';
        if (productType.includes('寻像器')) return 'EVF';
        return 'Accessory';
    };

    const handleSubmit = async () => {
        if (!formData.serial_number) {
            alert('请输入序列号');
            return;
        }
        if (!formData.model_name) {
            alert('请选择型号');
            return;
        }
        if (!formData.product_line) {
            alert('请选择分类');
            return;
        }
        if (!formData.product_family) {
            alert('请选择产品族群');
            return;
        }
        setSaving(true);
        try {
            const url = editingProduct
                ? `/api/v1/admin/products/${editingProduct.id}`
                : `/api/v1/admin/products`;
            const method = editingProduct ? 'put' : 'post';

            const res = await axios[method](url, formData, {
                headers: { Authorization: `Bearer ${token}` }
            });

            if (res.data.success) {
                const savedProduct = res.data.data;
                
                // ======== 方案B核心：产品入库后处理暂存的保修数据 ========
                if (pendingWarrantyData && !editingProduct) {
                    try {
                        // Step 1: 上传发票文件（如有）
                        let invoiceProofUrl = '';
                        if (pendingWarrantyData.invoiceFile) {
                            const uploadFormData = new FormData();
                            uploadFormData.append('file', pendingWarrantyData.invoiceFile);
                            uploadFormData.append('type', 'warranty_invoice');
                            
                            const uploadRes = await axios.post('/api/v1/upload', uploadFormData, {
                                headers: {
                                    Authorization: `Bearer ${token}`,
                                    'Content-Type': 'multipart/form-data'
                                }
                            });
                            if (uploadRes.data.success) {
                                invoiceProofUrl = uploadRes.data.data.url;
                            }
                        }
                        
                        // Step 2: 注册保修信息
                        await axios.post('/api/v1/products/register-warranty', {
                            serial_number: formData.serial_number,
                            model_name: pendingWarrantyData.selectedModelName || formData.model_name,
                            product_sku: formData.product_sku || '',
                            sku_id: pendingWarrantyData.selectedSkuId || formData.sku_id || undefined,
                            product_line: pendingWarrantyData.selectedProductLine || formData.product_line,
                            product_family: pendingWarrantyData.selectedProductFamily || formData.product_family,
                            sale_source: pendingWarrantyData.saleSource,
                            sale_date: pendingWarrantyData.saleDate,
                            warranty_months: pendingWarrantyData.warrantyMonths,
                            sales_invoice_proof: invoiceProofUrl,
                            remarks: pendingWarrantyData.remarks || '',
                            sold_to_dealer_id: pendingWarrantyData.selectedDealerId || null,
                            current_owner_id: pendingWarrantyData.selectedOwnerId || null
                        }, {
                            headers: { Authorization: `Bearer ${token}` }
                        });
                        
                        console.log('产品入库并注册保修成功');
                    } catch (warrantyErr) {
                        console.error('保修注册失败，但产品已入库:', warrantyErr);
                        // 产品已入库成功，保修注册失败时仍然关闭窗口并通知成功
                        // 用户可以稍后在工单详情页重新注册保修
                    }
                }
                
                onSuccess(savedProduct);
                onClose();
            }
        } catch (err: any) {
            console.error('Failed to save product', err);
            alert(err.response?.data?.error?.message || '保存失败');
        } finally {
            setSaving(false);
        }
    };

    if (!isOpen) return null;

    // 通用输入框样式
    const inputStyle = {
        width: '100%', padding: '10px 12px', borderRadius: 8,
        border: '1px solid var(--glass-border)', background: 'var(--glass-bg-light)',
        color: 'var(--text-main)', fontSize: '0.9rem', outline: 'none'
    };

    const selectStyle = {
        ...inputStyle,
        cursor: 'pointer', appearance: 'none' as const,
        backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%23888' stroke-width='2'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E")`,
        backgroundRepeat: 'no-repeat',
        backgroundPosition: 'right 12px center'
    };

    const labelStyle = { fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: 600 as const, marginBottom: 6 };

    const sectionStyle = {
        background: 'var(--glass-bg-light)', borderRadius: 10,
        border: '1px solid var(--glass-border)', padding: 16, marginBottom: 16
    };

    const sectionHeaderStyle = {
        display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14,
        fontSize: '0.75rem', fontWeight: 700 as const, color: 'var(--text-tertiary)',
        textTransform: 'uppercase' as const, letterSpacing: 1
    };

    // 右侧补充信息区域样式
    const rightSectionStyle = {
        background: 'var(--glass-bg-light)', borderRadius: 10,
        border: '1px solid var(--glass-border)', padding: 16, marginBottom: 16
    };

    return (
        <>
            <div
                onClick={onClose}
                style={{
                    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                    background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(10px)', zIndex: 1000
                }}
            />
            <div style={{
                position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
                width: 900, maxHeight: '90vh', background: '#1c1c1e', borderRadius: '24px',
                border: '1px solid rgba(255,255,255,0.1)', zIndex: 1001,
                display: 'flex', flexDirection: 'column', boxShadow: '0 30px 60px rgba(0,0,0,0.6)',
                overflow: 'hidden'
            }}>
                {/* Header - 匹配图2样式 */}
                <div style={{
                    padding: '24px 28px', borderBottom: '1px solid var(--glass-border)',
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'var(--glass-bg-light)'
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                        <div style={{
                            width: 44, height: 44, borderRadius: 12,
                            background: editingProduct ? 'rgba(59,130,246,0.15)' : 'rgba(16,185,129,0.15)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center'
                        }}>
                            {editingProduct ? <Edit2 size={22} color="#3B82F6" /> : <Plus size={22} color="#10B981" />}
                        </div>
                        <div>
                            <div style={{ fontWeight: 600, fontSize: 18, color: 'var(--text-main)', letterSpacing: '-0.01em' }}>
                                {editingProduct ? '编辑产品' : '产品入库'}
                            </div>
                            <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 3, letterSpacing: '-0.01em' }}>
                                {editingProduct ? '修改设备台账信息' : '录入新设备到台账'}
                            </div>
                        </div>
                    </div>
                    <button onClick={onClose} style={{ width: 40, height: 40, borderRadius: 10, background: 'var(--glass-bg-light)', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <X size={22} />
                    </button>
                </div>

                {/* Body - 左右分栏布局 */}
                <div style={{ flex: 1, overflow: 'auto', padding: 20 }}>
                    <div style={{ display: 'flex', gap: 20, height: '100%' }}>
                        {/* 左侧：产品信息和分类 */}
                        <div style={{ flex: 1 }}>
                            {/* 产品信息 */}
                            <div style={sectionStyle}>
                                <div style={sectionHeaderStyle}>
                                    <Package size={14} /> 产品信息
                                </div>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                                    <div>
                                        <label style={labelStyle}>序列号 <span style={{ color: '#EF4444' }}>*</span></label>
                                        <input
                                            type="text"
                                            value={formData.serial_number || ''}
                                            onChange={(e) => {
                                                const value = e.target.value;
                                                setFormData(prev => ({ ...prev, serial_number: value }));
                                                
                                                // 根据序列号前缀自动匹配产品型号
                                                if (value.length >= 2) {
                                                    const prefix = value.split('_')[0]; // 获取下划线前的部分
                                                    if (prefix) {
                                                        const matchedModel = models.find(m => 
                                                            m.sn_prefix && prefix.toUpperCase() === m.sn_prefix.toUpperCase()
                                                        );
                                                        if (matchedModel) {
                                                            setFormData(prev => ({ 
                                                                ...prev, 
                                                                serial_number: value,
                                                                model_name: matchedModel.name_zh,
                                                                product_sku: '',
                                                                sku_id: undefined
                                                            }));
                                                        }
                                                    }
                                                }
                                            }}
                                            style={inputStyle}
                                            placeholder="例如: KVF_123121"
                                        />
                                    </div>
                                    <div>
                                        <label style={labelStyle}>型号名称 <span style={{ color: '#EF4444' }}>*</span></label>
                                        <select
                                            value={formData.model_name || ''}
                                            onChange={(e) => {
                                                const modelName = e.target.value;
                                                const selectedModel = models.find(m => m.name_zh === modelName);
                                                setFormData(prev => ({ 
                                                    ...prev, 
                                                    model_name: modelName, 
                                                    product_sku: '', 
                                                    sku_id: undefined,
                                                    // 自动填充分类和族群
                                                    product_line: selectedModel ? (mapProductTypeToLine(selectedModel.product_type) || prev.product_line) : prev.product_line,
                                                    product_family: selectedModel?.product_family ? (selectedModel.product_family as 'A' | 'B' | 'C' | 'D' | 'E') : prev.product_family
                                                }));
                                            }}
                                            style={selectStyle}
                                        >
                                            <option value="" disabled>请选择型号</option>
                                            {models.filter(m => m.sn_prefix).map(m => <option key={m.id} value={m.name_zh}>{m.name_zh}</option>)}
                                        </select>
                                    </div>
                                    <div>
                                        <label style={labelStyle}>产品SKU</label>
                                        <select
                                            value={formData.sku_id || ''}
                                            onChange={(e) => {
                                                const sku = skus.find(s => s.id.toString() === e.target.value);
                                                setFormData(prev => ({ ...prev, sku_id: sku ? sku.id : undefined, product_sku: sku ? sku.sku_code : '' }));
                                            }}
                                            disabled={!formData.model_name}
                                            style={{ ...selectStyle, opacity: !formData.model_name ? 0.5 : 1 }}
                                        >
                                            <option value="">{formData.model_name ? '选择适用的 SKU' : '请先选择型号'}</option>
                                            {skus.filter(s => {
                                                const model = models.find(m => m.name_zh === formData.model_name);
                                                return model && s.model_id === model.id;
                                            }).map(s => <option key={s.id} value={s.id}>{s.display_name} ({s.sku_code})</option>)}
                                        </select>
                                    </div>
                                </div>
                            </div>

                            {/* 产品分类 */}
                            <div style={sectionStyle}>
                                <div style={sectionHeaderStyle}>
                                    <Tag size={14} /> 产品分类
                                </div>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                                    <div>
                                        <label style={labelStyle}>分类 <span style={{ color: '#EF4444' }}>*</span></label>
                                        <select
                                            value={formData.product_line || 'Camera'}
                                            onChange={(e) => setFormData({ ...formData, product_line: e.target.value as Product['product_line'] })}
                                            style={selectStyle}
                                        >
                                            <option value="Camera">Camera（相机）</option>
                                            <option value="EVF">EVF（电子寻像器）</option>
                                            <option value="Accessory">Accessory（配件）</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label style={labelStyle}>产品族群 <span style={{ color: '#EF4444' }}>*</span></label>
                                        <select
                                            value={formData.product_family || 'A'}
                                            onChange={(e) => setFormData({ ...formData, product_family: e.target.value as Product['product_family'] })}
                                            style={selectStyle}
                                        >
                                            <option value="A">A - 在售电影机</option>
                                            <option value="B">B - 广播摄像机</option>
                                            <option value="C">C - 电子寻像器</option>
                                            <option value="D">D - 历史机型</option>
                                            <option value="E">E - 通用配件</option>
                                        </select>
                                    </div>
                                </div>
                            </div>

                            {/* 补充信息：生产日期 + 固件版本 */}
                            <div style={sectionStyle}>
                                <div style={sectionHeaderStyle}>
                                    <Settings size={14} /> 补充信息
                                </div>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                                    <CustomDatePicker
                                        label="生产日期"
                                        value={formData.production_date || ''}
                                        onChange={(val) => setFormData({ ...formData, production_date: val })}
                                    />
                                    <div>
                                        <label style={labelStyle}>固件版本</label>
                                        <input
                                            type="text"
                                            value={formData.firmware_version || ''}
                                            onChange={(e) => setFormData({ ...formData, firmware_version: e.target.value })}
                                            style={inputStyle}
                                            placeholder="例如: 1.2.3"
                                        />
                                    </div>
                                </div>
                            </div>

                        </div>

                        {/* 右侧：保修信息 */}
                        <div style={{ width: 380 }}>
                            <div style={rightSectionStyle}>
                                <div style={{...sectionHeaderStyle, color: 'var(--text-tertiary)'}}>
                                    <Shield size={14} /> 保修信息
                                </div>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                                    {/* 编辑已有保修的产品：显示保修状态概览 */}
                                    {editingProduct && editingProduct.warranty_end_date ? (
                                        <>
                                            {/* 保修状态卡片 */}
                                            <div style={{
                                                padding: 16, borderRadius: 10,
                                                background: editingProduct.warranty_status === 'ACTIVE' ? 'rgba(16,185,129,0.08)' : 'rgba(239,68,68,0.08)',
                                                border: `1px solid ${editingProduct.warranty_status === 'ACTIVE' ? 'rgba(16,185,129,0.3)' : 'rgba(239,68,68,0.3)'}`,
                                            }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                                                    {editingProduct.warranty_status === 'ACTIVE'
                                                        ? <CheckCircle size={18} color="#10B981" />
                                                        : <AlertTriangle size={18} color="#EF4444" />}
                                                    <span style={{
                                                        fontSize: '0.9rem', fontWeight: 700,
                                                        color: editingProduct.warranty_status === 'ACTIVE' ? '#10B981' : '#EF4444'
                                                    }}>
                                                        {editingProduct.warranty_status === 'ACTIVE' ? '保修有效' : '已过保'}
                                                    </span>
                                                </div>
                                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                                                    <div>
                                                        <div style={{ fontSize: '0.7rem', color: 'var(--text-tertiary)', marginBottom: 4 }}>生效日期</div>
                                                        <div style={{ fontSize: '0.85rem', color: 'var(--text-main)', fontWeight: 500 }}>{editingProduct.warranty_start_date || '-'}</div>
                                                    </div>
                                                    <div>
                                                        <div style={{ fontSize: '0.7rem', color: 'var(--text-tertiary)', marginBottom: 4 }}>截止日期</div>
                                                        <div style={{ fontSize: '0.85rem', color: 'var(--text-main)', fontWeight: 500 }}>{editingProduct.warranty_end_date || '-'}</div>
                                                    </div>
                                                </div>
                                            </div>

                                            {/* 操作按钮 */}
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                                                <button
                                                    type="button"
                                                    onClick={() => setShowWarrantyCalcModal(true)}
                                                    style={{
                                                        width: '100%', padding: '10px 14px', borderRadius: 8,
                                                        background: 'var(--glass-bg-light)', border: '1px solid var(--glass-border)',
                                                        color: 'var(--text-secondary)', fontSize: '0.8rem', fontWeight: 500,
                                                        cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                                                        transition: 'all 0.2s'
                                                    }}
                                                    onMouseEnter={e => e.currentTarget.style.background = 'var(--glass-bg-hover)'}
                                                    onMouseLeave={e => e.currentTarget.style.background = 'var(--glass-bg-light)'}
                                                >
                                                    <Calculator size={14} /> 查看计算依据
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => setIsAuditBarrierOpen(true)}
                                                    style={{
                                                        width: '100%', padding: '10px 14px', borderRadius: 8,
                                                        background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.3)',
                                                        color: '#f59e0b', fontSize: '0.8rem', fontWeight: 600,
                                                        cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                                                        transition: 'all 0.2s'
                                                    }}
                                                    onMouseEnter={e => e.currentTarget.style.background = 'rgba(245,158,11,0.2)'}
                                                    onMouseLeave={e => e.currentTarget.style.background = 'rgba(245,158,11,0.1)'}
                                                >
                                                    <Calendar size={14} /> 更改保修信息
                                                </button>
                                            </div>
                                            <div style={{ fontSize: '0.7rem', color: 'var(--text-tertiary)', marginTop: 4 }}>
                                                * 更改保修信息需要经过确认流程
                                            </div>
                                        </>
                                    ) : (
                                        /* 新产品入库：不显示保修注册入口，仅显示状态 */
                                        !editingProduct ? (
                                            /* 新产品入库模式：仅显示保修状态提示 */
                                            <div style={{
                                                padding: '12px', borderRadius: 8,
                                                border: '1px solid rgba(255,255,255,0.08)',
                                                background: 'rgba(255,255,255,0.02)',
                                                color: '#666',
                                                fontSize: '0.85rem',
                                                display: 'flex', alignItems: 'center', gap: 8
                                            }}>
                                                <Shield size={16} color="#666" />
                                                <span>产品入库后可在详情页注册保修</span>
                                            </div>
                                        ) : (
                                            /* 编辑已有产品但无保修：显示注册保修按钮 */
                                            <>
                                                <div style={{
                                                    padding: '12px', borderRadius: 8,
                                                    border: pendingWarrantyData
                                                        ? '1px solid rgba(16,185,129,0.3)'
                                                        : '1px solid rgba(255,255,255,0.08)',
                                                    background: pendingWarrantyData
                                                        ? 'rgba(16,185,129,0.08)'
                                                        : 'rgba(255,255,255,0.02)',
                                                    color: pendingWarrantyData ? '#10B981' : '#666',
                                                    fontSize: '0.85rem',
                                                    display: 'flex', alignItems: 'center', gap: 8,
                                                    marginBottom: 8
                                                }}>
                                                    {pendingWarrantyData ? (
                                                        <>
                                                            <Check size={16} />
                                                            已填写（{pendingWarrantyData.saleDate}，{pendingWarrantyData.warrantyMonths}个月）
                                                        </>
                                                    ) : (
                                                        formData.warranty_start_date || '未设置（系统自动计算）'
                                                    )}
                                                </div>
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        setWarrantyPrefillData({
                                                            productLine: formData.product_line,
                                                            productFamily: formData.product_family,
                                                            skuId: formData.sku_id || undefined,
                                                            salesChannel: formData.sales_channel
                                                        });
                                                        setShowWarrantyModal(true);
                                                    }}
                                                    disabled={!formData.serial_number}
                                                    style={{
                                                        width: '100%', padding: '10px 14px', borderRadius: 8,
                                                        background: pendingWarrantyData
                                                            ? 'rgba(16,185,129,0.1)'
                                                            : 'rgba(59,130,246,0.1)',
                                                        border: pendingWarrantyData
                                                            ? '1px solid rgba(16,185,129,0.3)'
                                                            : '1px solid rgba(59,130,246,0.3)',
                                                        color: pendingWarrantyData ? '#10B981' : '#3B82F6',
                                                        fontSize: '0.8rem', fontWeight: 600,
                                                        cursor: formData.serial_number ? 'pointer' : 'not-allowed',
                                                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                                                        transition: 'all 0.2s',
                                                        opacity: formData.serial_number ? 1 : 0.5
                                                    }}
                                                    onMouseEnter={e => {
                                                        if (formData.serial_number) {
                                                            e.currentTarget.style.background = pendingWarrantyData
                                                                ? 'rgba(16,185,129,0.2)'
                                                                : 'rgba(59,130,246,0.2)';
                                                        }
                                                    }}
                                                    onMouseLeave={e => {
                                                        e.currentTarget.style.background = pendingWarrantyData
                                                            ? 'rgba(16,185,129,0.1)'
                                                            : 'rgba(59,130,246,0.1)';
                                                    }}
                                                >
                                                    <Calendar size={14} />
                                                    {pendingWarrantyData ? '修改保修' : '注册保修'}
                                                </button>
                                                <div style={{ fontSize: '0.7rem', color: '#555', marginTop: 4 }}>
                                                    {pendingWarrantyData
                                                        ? '* 保修信息已暂存，将在保存入库时一并提交'
                                                        : '* 保修日期由系统根据销售信息自动计算'
                                                    }
                                                </div>
                                            </>
                                        )
                                    )}
                                </div>
                            </div>
                            
                            {/* 设备&渠道 */}
                            <div style={rightSectionStyle}>
                                <div style={{...sectionHeaderStyle, color: 'var(--text-tertiary)'}}>
                                    <Settings size={14} /> 其他信息
                                </div>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                                    <div>
                                        <label style={labelStyle}>设备状态</label>
                                        <select
                                            value={formData.status || 'ACTIVE'}
                                            onChange={(e) => setFormData({ ...formData, status: e.target.value as Product['status'] })}
                                            style={selectStyle}
                                        >
                                            <option value="ACTIVE">在役</option>
                                            <option value="IN_REPAIR">维修中</option>
                                            <option value="STOLEN">失窃</option>
                                            <option value="SCRAPPED">报废</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label style={labelStyle}>销售渠道</label>
                                        <select
                                            value={formData.sales_channel || 'DIRECT'}
                                            onChange={(e) => setFormData({ ...formData, sales_channel: e.target.value as 'DIRECT' | 'DEALER' })}
                                            style={selectStyle}
                                        >
                                            <option value="DIRECT">直销</option>
                                            <option value="DEALER">经销商</option>
                                        </select>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Footer - 双按钮布局匹配图2 */}
                <div style={{ 
                    padding: '20px 28px', borderTop: '1px solid var(--glass-border)', 
                    background: 'var(--glass-bg-light)',
                    display: 'flex', gap: 12
                }}>
                    <button
                        onClick={onClose}
                        style={{
                            flex: 1, padding: '14px', borderRadius: 12, fontWeight: 600,
                            background: 'transparent', color: 'var(--text-main)', border: '1px solid var(--glass-border)',
                            cursor: 'pointer', fontSize: '0.95rem',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            transition: 'all 0.2s'
                        }}
                        onMouseEnter={e => { e.currentTarget.style.background = 'var(--glass-bg-hover)'; }}
                        onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
                    >
                        取消
                    </button>
                    <button
                        onClick={handleSubmit}
                        disabled={saving || !formData.serial_number || !formData.model_name}
                        style={{
                            flex: 1, padding: '14px', borderRadius: 12, fontWeight: 600,
                            background: '#FFD200', color: '#000', border: 'none',
                            cursor: (saving || !formData.serial_number || !formData.model_name) ? 'not-allowed' : 'pointer',
                            fontSize: '0.95rem',
                            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                            opacity: (saving || !formData.serial_number || !formData.model_name) ? 0.6 : 1,
                            transition: 'all 0.2s'
                        }}
                    >
                        <Save size={18} /> {saving ? '保存中...' : '保存入库'}
                    </button>
                </div>
            </div>

            {/* Warranty Registration Modal */}
            <ProductWarrantyRegistrationModal
                isOpen={showWarrantyModal}
                onClose={() => setShowWarrantyModal(false)}
                serialNumber={formData.serial_number || ''}
                productName={formData.model_name || ''}
                isNewProduct={!editingProduct}
                prefillData={warrantyPrefillData}
                existingWarrantyData={editingProduct && editingProduct.warranty_end_date ? {
                    saleSource: editingProduct.sales_invoice_date ? 'invoice' : 'customer_statement',
                    saleDate: editingProduct.warranty_start_date || editingProduct.registration_date || '',
                    warrantyMonths: editingProduct.warranty_months || 24,
                    dealerId: editingProduct.sold_to_dealer_id || undefined,
                    ownerId: editingProduct.current_owner_id || undefined
                } : undefined}
                onRegistered={(result) => {
                    setShowWarrantyModal(false);
                    // 方案B：接收暂存的保修数据
                    if (result && typeof result === 'object' && 'saleSource' in result) {
                        setPendingWarrantyData(result as WarrantyRegistrationData);
                    }
                }}
            />
            {/* Audit Barrier Modal */}
            {isAuditBarrierOpen && (
                <div style={{
                    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 1200,
                    background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(5px)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center'
                }}>
                    <div style={{
                        width: 480, background: '#1c1c1e', borderRadius: 20,
                        border: '1px solid rgba(255,255,255,0.1)', overflow: 'hidden',
                        boxShadow: '0 40px 100px rgba(0,0,0,0.8)', padding: 32, textAlign: 'center'
                    }}>
                        <div style={{ width: 64, height: 64, borderRadius: '50%', background: 'rgba(245,158,11,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
                            <AlertTriangle size={32} color="#f59e0b" />
                        </div>
                        <h3 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: 'var(--text-main)', marginBottom: 12 }}>更改保修日期声明</h3>
                        <p style={{ margin: 0, fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: 32 }}>
                            保修日期是计算服务费用的核心依据。<br />更改已有的保修信息将被记录在审计日志中，请确保您持有的销售凭证合法有效。
                        </p>
                        <div style={{ display: 'flex', gap: 12 }}>
                            <button
                                onClick={() => setIsAuditBarrierOpen(false)}
                                style={{ flex: 1, padding: '14px', borderRadius: 12, background: 'var(--glass-bg-light)', border: 'none', color: 'var(--text-secondary)', fontWeight: 600, cursor: 'pointer' }}
                            >
                                取消
                            </button>
                            <button
                                onClick={() => {
                                    setIsAuditBarrierOpen(false);
                                    setWarrantyPrefillData({
                                        productLine: formData.product_line,
                                        productFamily: formData.product_family,
                                        skuId: formData.sku_id || undefined,
                                        salesChannel: formData.sales_channel
                                    });
                                    setShowWarrantyModal(true);
                                }}
                                disabled={barrierCountdown > 0}
                                style={{
                                    flex: 1, padding: '14px', borderRadius: 12, background: '#f59e0b', color: '#000', border: 'none', fontWeight: 700,
                                    cursor: barrierCountdown > 0 ? 'not-allowed' : 'pointer', opacity: barrierCountdown > 0 ? 0.6 : 1, transition: 'all 0.2s'
                                }}
                            >
                                {barrierCountdown > 0 ? `本人已知晓 (${barrierCountdown}s)` : '本人已知晓'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Product-level Warranty Calculation Modal */}
            {showWarrantyCalcModal && editingProduct && (
                <div style={{
                    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 1200,
                    background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(10px)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center'
                }}>
                    <div style={{
                        width: 500, background: 'var(--modal-bg)', borderRadius: 20,
                        border: '1px solid var(--glass-border)', overflow: 'hidden',
                        boxShadow: '0 30px 60px rgba(0,0,0,0.6)'
                    }}>
                        <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--glass-border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                                <div style={{ width: 40, height: 40, borderRadius: 10, background: 'rgba(255,210,0,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                    <Calculator size={20} color="#FFD200" />
                                </div>
                                <div>
                                    <h3 style={{ margin: 0, fontSize: 18, fontWeight: 600, color: 'var(--text-main)' }}>保修计算引擎</h3>
                                    <p style={{ margin: 0, fontSize: 12, color: 'var(--text-tertiary)', marginTop: 4 }}>序列号：{editingProduct.serial_number}</p>
                                </div>
                            </div>
                            <button onClick={() => setShowWarrantyCalcModal(false)} style={{ background: 'none', border: 'none', color: 'var(--text-tertiary)', cursor: 'pointer' }}>
                                <X size={24} />
                            </button>
                        </div>
                        <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 20 }}>
                            <div>
                                <h4 style={{ margin: '0 0 10px 0', fontSize: 13, color: 'var(--text-tertiary)', fontWeight: 600 }}>优先级规则</h4>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, fontSize: 12 }}>
                                    {[
                                        { p: 1, label: 'IoT', detail: '联网激活日期' },
                                        { p: 2, label: '发票', detail: '人工发票日期' },
                                        { p: 3, label: '注册', detail: '人工注册日期' },
                                        { p: 4, label: '直销', detail: '直销出库+7天' },
                                        { p: 5, label: '兜底', detail: '代理发货+90天' }
                                    ].map(rule => (
                                        <div key={rule.p} style={{
                                            display: 'flex', alignItems: 'center', gap: 6,
                                            padding: '6px 10px', borderRadius: 6,
                                            background: 'var(--glass-bg-light)', border: '1px solid var(--glass-border)',
                                            gridColumn: rule.p === 5 ? 'span 2' : 'auto'
                                        }}>
                                            <span style={{ color: 'var(--text-tertiary)', fontWeight: 700 }}>{rule.p}.</span>
                                            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                                <span style={{ color: 'var(--text-main)', fontWeight: 600 }}>{rule.label}</span>
                                                <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{rule.detail}</span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                            <div style={{ height: 1, background: 'var(--glass-border)' }} />
                            <div style={{
                                padding: 16, borderRadius: 12,
                                background: editingProduct.warranty_status === 'ACTIVE' ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)',
                                border: `1px solid ${editingProduct.warranty_status === 'ACTIVE' ? 'rgba(16,185,129,0.3)' : 'rgba(239,68,68,0.3)'}`,
                                display: 'flex', flexDirection: 'column', gap: 12
                            }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                    {editingProduct.warranty_status === 'ACTIVE'
                                        ? <CheckCircle size={22} color="#10B981" />
                                        : <AlertTriangle size={22} color="#EF4444" />}
                                    <span style={{ fontSize: 18, fontWeight: 700, color: editingProduct.warranty_status === 'ACTIVE' ? '#10B981' : '#EF4444' }}>
                                        {editingProduct.warranty_status === 'ACTIVE' ? '在保期内' : '已过保'}
                                    </span>
                                </div>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                                    <div>
                                        <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginBottom: 4 }}>生效日期</div>
                                        <div style={{ fontSize: 14, color: 'var(--text-main)', fontWeight: 500 }}>{editingProduct.warranty_start_date || '-'}</div>
                                    </div>
                                    <div>
                                        <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginBottom: 4 }}>截止日期</div>
                                        <div style={{ fontSize: 14, color: 'var(--text-main)', fontWeight: 500 }}>{editingProduct.warranty_end_date || '-'}</div>
                                    </div>
                                    <div>
                                        <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginBottom: 4 }}>保修时长</div>
                                        <div style={{ fontSize: 14, color: 'var(--text-main)', fontWeight: 500 }}>{editingProduct.warranty_months || 24} 个月</div>
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div style={{ padding: '16px 24px', borderTop: '1px solid var(--glass-border)' }}>
                            <button
                                onClick={() => setShowWarrantyCalcModal(false)}
                                style={{
                                    width: '100%', padding: '12px', borderRadius: 10,
                                    background: 'var(--glass-bg-light)', border: '1px solid var(--glass-border)',
                                    color: 'var(--text-main)', fontWeight: 600, cursor: 'pointer', fontSize: '0.9rem'
                                }}
                            >
                                关闭
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
};

export default ProductModal;
