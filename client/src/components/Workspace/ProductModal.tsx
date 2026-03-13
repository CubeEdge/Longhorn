import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { X, Save, Plus, Edit2, Shield, ChevronDown, ChevronRight, Package, Tag, Settings, Calendar } from 'lucide-react';
import { useAuthStore } from '../../store/useAuthStore';
import ProductWarrantyRegistrationModal from '../Service/ProductWarrantyRegistrationModal';

interface Product {
    id: number;
    model_name: string;
    internal_name: string;
    serial_number: string;
    product_sku: string;
    product_type: string;
    product_line: 'Camera' | 'EVF' | 'Accessory';
    product_family: 'A' | 'B' | 'C' | 'D';
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
    const [showWarrantyModal, setShowWarrantyModal] = useState(false);
    const [showOptional, setShowOptional] = useState(false);
    // 传递给保修注册窗口的预填数据
    const [warrantyPrefillData, setWarrantyPrefillData] = useState<{
        productLine?: 'Camera' | 'EVF' | 'Accessory';
        productFamily?: 'A' | 'B' | 'C' | 'D';
        skuId?: number;
        salesChannel?: 'DIRECT' | 'DEALER';
    }>({});
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
            const [modelsRes, skusRes] = await Promise.all([
                axios.get('/api/v1/admin/product-models', { headers: { Authorization: `Bearer ${token}` } }),
                axios.get('/api/v1/admin/product-skus', { headers: { Authorization: `Bearer ${token}` } })
            ]);
            if (modelsRes.data.success) setModels(modelsRes.data.data);
            if (skusRes.data.success) setSkus(skusRes.data.data);
        } catch (err) {
            console.error('Failed to fetch models or skus', err);
        }
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
            alert('请选择产品线');
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
                onSuccess(res.data.data);
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
        border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.05)',
        color: '#fff', fontSize: '0.9rem', outline: 'none'
    };

    const selectStyle = {
        ...inputStyle,
        cursor: 'pointer', appearance: 'none' as const,
        backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%23888' stroke-width='2'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E")`,
        backgroundRepeat: 'no-repeat',
        backgroundPosition: 'right 12px center'
    };

    const labelStyle = { fontSize: '0.8rem', color: '#888', fontWeight: 600 as const, marginBottom: 6 };

    const sectionStyle = {
        background: 'rgba(255,255,255,0.02)', borderRadius: 10,
        border: '1px solid rgba(255,255,255,0.06)', padding: 16, marginBottom: 16
    };

    const sectionHeaderStyle = {
        display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14,
        fontSize: '0.75rem', fontWeight: 700 as const, color: 'rgba(255,255,255,0.4)',
        textTransform: 'uppercase' as const, letterSpacing: 1
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
                width: 600, maxHeight: '90vh', background: '#1c1c1e', borderRadius: '24px',
                border: '1px solid rgba(255,255,255,0.1)', zIndex: 1001,
                display: 'flex', flexDirection: 'column', boxShadow: '0 30px 60px rgba(0,0,0,0.6)',
                overflow: 'hidden'
            }}>
                {/* Header - 匹配图2样式 */}
                <div style={{
                    padding: '24px 28px', borderBottom: '1px solid rgba(255,255,255,0.08)',
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'rgba(0,0,0,0.2)'
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
                            <div style={{ fontWeight: 600, fontSize: 18, color: '#fff', letterSpacing: '-0.01em' }}>
                                {editingProduct ? '编辑产品' : '产品入库'}
                            </div>
                            <div style={{ fontSize: 13, color: '#888', marginTop: 3, letterSpacing: '-0.01em' }}>
                                {editingProduct ? '修改设备台账信息' : '录入新设备到台账'}
                            </div>
                        </div>
                    </div>
                    <button onClick={onClose} style={{ width: 40, height: 40, borderRadius: 10, background: 'rgba(255,255,255,0.05)', border: 'none', cursor: 'pointer', color: '#888', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <X size={22} />
                    </button>
                </div>

                {/* Body - 单页滚动 */}
                <div style={{ flex: 1, overflow: 'auto', padding: 20 }}>
                    
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
                                    onChange={(e) => setFormData({ ...formData, serial_number: e.target.value })}
                                    style={inputStyle}
                                    placeholder="例如: KVF_123121"
                                />
                            </div>
                            <div>
                                <label style={labelStyle}>型号名称 <span style={{ color: '#EF4444' }}>*</span></label>
                                <select
                                    value={formData.model_name || ''}
                                    onChange={(e) => setFormData(prev => ({ ...prev, model_name: e.target.value, product_sku: '', sku_id: undefined }))}
                                    style={selectStyle}
                                >
                                    <option value="" disabled>请选择型号</option>
                                    {models.map(m => <option key={m.id} value={m.name_zh}>{m.name_zh}</option>)}
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
                                <label style={labelStyle}>产品线 <span style={{ color: '#EF4444' }}>*</span></label>
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
                                    <option value="B">B - 历史机型</option>
                                    <option value="C">C - 电子寻像器</option>
                                    <option value="D">D - 通用配件</option>
                                </select>
                            </div>
                        </div>
                    </div>

                    {/* 补充信息（可折叠） */}
                    <div style={{ ...sectionStyle, padding: showOptional ? 16 : '12px 16px' }}>
                        <div 
                            onClick={() => setShowOptional(!showOptional)}
                            style={{ 
                                ...sectionHeaderStyle, marginBottom: showOptional ? 14 : 0,
                                cursor: 'pointer', userSelect: 'none'
                            }}
                        >
                            {showOptional ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                            <Settings size={14} /> 补充信息（可选）
                        </div>
                        {showOptional && (
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                                <div>
                                    <label style={labelStyle}>生产日期</label>
                                    <input
                                        type="date"
                                        value={formData.production_date || ''}
                                        onChange={(e) => setFormData({ ...formData, production_date: e.target.value })}
                                        style={inputStyle}
                                    />
                                </div>
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
                        )}
                    </div>

                    {/* 保修信息 */}
                    <div style={sectionStyle}>
                        <div style={sectionHeaderStyle}>
                            <Shield size={14} /> 保修信息
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            <div style={{ 
                                flex: 1, padding: '10px 12px', borderRadius: 8, 
                                border: '1px solid rgba(255,255,255,0.08)', 
                                background: 'rgba(255,255,255,0.02)', color: '#666', fontSize: '0.85rem'
                            }}>
                                {formData.warranty_start_date || '未设置（系统自动计算）'}
                            </div>
                            <button
                                type="button"
                                onClick={() => {
                                    // 设置预填数据并打开保修注册窗口
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
                                    padding: '10px 14px', borderRadius: 8,
                                    background: 'rgba(59,130,246,0.1)', border: '1px solid rgba(59,130,246,0.3)',
                                    color: '#3B82F6', fontSize: '0.8rem', fontWeight: 600,
                                    cursor: formData.serial_number ? 'pointer' : 'not-allowed',
                                    display: 'flex', alignItems: 'center', gap: 6,
                                    transition: 'all 0.2s',
                                    opacity: formData.serial_number ? 1 : 0.5
                                }}
                                onMouseEnter={e => { if (formData.serial_number) e.currentTarget.style.background = 'rgba(59,130,246,0.2)'; }}
                                onMouseLeave={e => { e.currentTarget.style.background = 'rgba(59,130,246,0.1)'; }}
                            >
                                <Calendar size={14} />
                                注册保修
                            </button>
                        </div>
                        <div style={{ fontSize: '0.7rem', color: '#555', marginTop: 8 }}>
                            * 保修日期由系统根据销售信息自动计算，点击"注册保修"录入销售日期
                        </div>
                    </div>

                </div>

                {/* Footer - 双按钮布局匹配图2 */}
                <div style={{ 
                    padding: '20px 28px', borderTop: '1px solid rgba(255,255,255,0.08)', 
                    background: 'rgba(0,0,0,0.2)',
                    display: 'flex', gap: 12
                }}>
                    <button
                        onClick={onClose}
                        style={{
                            flex: 1, padding: '14px', borderRadius: 12, fontWeight: 600,
                            background: 'transparent', color: '#fff', border: '1px solid rgba(255,255,255,0.2)',
                            cursor: 'pointer', fontSize: '0.95rem',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            transition: 'all 0.2s'
                        }}
                        onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; }}
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
                isNewProduct={true}
                prefillData={warrantyPrefillData}
                onRegistered={() => {
                    setShowWarrantyModal(false);
                    // 重新获取数据以更新保修信息
                }}
            />
        </>
    );
};

export default ProductModal;
