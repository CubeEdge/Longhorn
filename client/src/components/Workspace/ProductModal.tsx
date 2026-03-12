import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { X, Save, Plus, Edit2, Shield } from 'lucide-react';
import { useAuthStore } from '../../store/useAuthStore';
import ProductWarrantyRegistrationModal from '../Service/ProductWarrantyRegistrationModal';

interface Product {
    id: number;
    model_name: string;
    internal_name: string;
    serial_number: string;
    product_sku: string;
    product_type: string;
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
}

const ProductModal: React.FC<ProductModalProps> = ({ isOpen, onClose, onSuccess, editingProduct }) => {
    const { token } = useAuthStore();
    const [activeTab, setActiveTab] = useState<'basic' | 'business'>('basic');
    const [saving, setSaving] = useState(false);
    const [models, setModels] = useState<ProductModel[]>([]);
    const [skus, setSkus] = useState<ProductSku[]>([]);
    const [showWarrantyModal, setShowWarrantyModal] = useState(false);
    const [formData, setFormData] = useState<Partial<Product>>({
        model_name: '',
        serial_number: '',
        product_sku: '',
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
                setFormData({
                    model_name: '',
                    serial_number: '',
                    product_sku: '',
                    firmware_version: '',
                    production_date: '',
                    description: '',
                    status: 'ACTIVE',
                    sales_channel: 'DIRECT',
                    warranty_months: 24,
                });
            }
        }
    }, [isOpen, editingProduct]);

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
        if (!formData.model_name) {
            alert('请选择型号');
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
                width: 560, maxHeight: '85vh', background: '#1c1c1e', borderRadius: 16,
                border: '1px solid rgba(255,255,255,0.1)', zIndex: 1001,
                display: 'flex', flexDirection: 'column', boxShadow: '0 30px 60px rgba(0,0,0,0.6)',
                overflow: 'hidden'
            }}>
                {/* Header */}
                <div style={{
                    padding: '20px 24px', borderBottom: '1px solid rgba(255,255,255,0.08)',
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'rgba(0,0,0,0.2)'
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <div style={{
                            width: 40, height: 40, borderRadius: 10,
                            background: editingProduct ? 'rgba(59,130,246,0.15)' : 'rgba(16,185,129,0.15)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center'
                        }}>
                            {editingProduct ? <Edit2 size={20} color="#3B82F6" /> : <Plus size={20} color="#10B981" />}
                        </div>
                        <div>
                            <div style={{ fontWeight: 600, fontSize: 17, color: '#fff', letterSpacing: '-0.01em' }}>
                                {editingProduct ? '编辑产品' : '添加产品'}
                            </div>
                            <div style={{ fontSize: 12, color: '#888', marginTop: 2, letterSpacing: '-0.01em' }}>
                                {editingProduct ? '修改设备台账信息' : '录入新设备到台账'}
                            </div>
                        </div>
                    </div>
                    <button onClick={onClose} style={{ width: 36, height: 36, borderRadius: 8, background: 'rgba(255,255,255,0.05)', border: 'none', cursor: 'pointer', color: '#888', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <X size={20} />
                    </button>
                </div>

                {/* Tabs */}
                <div style={{ display: 'flex', borderBottom: '1px solid rgba(255,255,255,0.1)', padding: '0 24px' }}>
                    <button
                        onClick={() => setActiveTab('basic')}
                        style={{
                            padding: '12px 20px', background: 'none', border: 'none',
                            borderBottom: `2px solid ${activeTab === 'basic' ? '#3B82F6' : 'transparent'}`,
                            color: activeTab === 'basic' ? '#3B82F6' : '#888',
                            fontWeight: 600, fontSize: '0.9rem', cursor: 'pointer'
                        }}
                    >
                        基本信息
                    </button>
                    <button
                        onClick={() => setActiveTab('business')}
                        style={{
                            padding: '12px 20px', background: 'none', border: 'none',
                            borderBottom: `2px solid ${activeTab === 'business' ? '#3B82F6' : 'transparent'}`,
                            color: activeTab === 'business' ? '#3B82F6' : '#888',
                            fontWeight: 600, fontSize: '0.9rem', cursor: 'pointer'
                        }}
                    >
                        业务信息
                    </button>
                </div>

                {/* Body */}
                <div style={{ flex: 1, overflow: 'auto', padding: 24, display: 'flex', flexDirection: 'column', gap: 20 }}>
                    {activeTab === 'basic' ? (
                        <>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                                <label style={{ fontSize: '0.8rem', color: '#888', fontWeight: 600 }}>型号名称 <span style={{ color: '#EF4444' }}>*</span></label>
                                <select
                                    value={formData.model_name || ''}
                                    onChange={(e) => setFormData(prev => ({ ...prev, model_name: e.target.value, product_sku: '', sku_id: undefined }))}
                                    style={{ padding: '10px 12px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.05)', color: '#fff', fontSize: '0.9rem' }}
                                >
                                    <option value="" disabled>请选择型号</option>
                                    {models.map(m => <option key={m.id} value={m.name_zh}>{m.name_zh}</option>)}
                                </select>
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                                <label style={{ fontSize: '0.8rem', color: '#888', fontWeight: 600 }}>产品SKU</label>
                                <select
                                    value={formData.sku_id || ''}
                                    onChange={(e) => {
                                        const sku = skus.find(s => s.id.toString() === e.target.value);
                                        setFormData(prev => ({ ...prev, sku_id: sku ? sku.id : undefined, product_sku: sku ? sku.sku_code : '' }));
                                    }}
                                    disabled={!formData.model_name}
                                    style={{ padding: '10px 12px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.05)', color: '#fff', fontSize: '0.9rem', opacity: !formData.model_name ? 0.5 : 1 }}
                                >
                                    <option value="">{formData.model_name ? '请选择 SKU' : '请先选择型号'}</option>
                                    {skus.filter(s => {
                                        const model = models.find(m => m.name_zh === formData.model_name);
                                        return model && s.model_id === model.id;
                                    }).map(s => <option key={s.id} value={s.id}>{s.display_name} ({s.sku_code})</option>)}
                                </select>
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                                <label style={{ fontSize: '0.8rem', color: '#888', fontWeight: 600 }}>序列号</label>
                                <input
                                    type="text"
                                    value={formData.serial_number || ''}
                                    onChange={(e) => setFormData({ ...formData, serial_number: e.target.value })}
                                    style={{ padding: '10px 12px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.05)', color: '#fff', fontSize: '0.9rem' }}
                                    placeholder="例如: ME_107649"
                                />
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                                <label style={{ fontSize: '0.8rem', color: '#888', fontWeight: 600 }}>生产日期</label>
                                <input
                                    type="date"
                                    value={formData.production_date || ''}
                                    onChange={(e) => setFormData({ ...formData, production_date: e.target.value })}
                                    style={{ padding: '10px 12px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.05)', color: '#fff', fontSize: '0.9rem' }}
                                />
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                                <label style={{ fontSize: '0.8rem', color: '#888', fontWeight: 600 }}>固件版本</label>
                                <input
                                    type="text"
                                    value={formData.firmware_version || ''}
                                    onChange={(e) => setFormData({ ...formData, firmware_version: e.target.value })}
                                    style={{ padding: '10px 12px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.05)', color: '#fff', fontSize: '0.9rem' }}
                                />
                            </div>
                        </>
                    ) : (
                        <>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                                <label style={{ fontSize: '0.8rem', color: '#888', fontWeight: 600 }}>设备状态 <span style={{ color: '#EF4444' }}>*</span></label>
                                <select
                                    value={formData.status}
                                    onChange={(e) => setFormData({ ...formData, status: e.target.value as Product['status'] })}
                                    style={{ padding: '10px 12px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.05)', color: '#fff', fontSize: '0.9rem' }}
                                >
                                    <option value="ACTIVE">在役</option>
                                    <option value="IN_REPAIR">维修中</option>
                                    <option value="STOLEN">失窃</option>
                                    <option value="SCRAPPED">报废</option>
                                </select>
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                                <label style={{ fontSize: '0.8rem', color: '#888', fontWeight: 600 }}>销售渠道</label>
                                <select
                                    value={formData.sales_channel}
                                    onChange={(e) => setFormData({ ...formData, sales_channel: e.target.value as 'DIRECT' | 'DEALER' })}
                                    style={{ padding: '10px 12px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.05)', color: '#fff', fontSize: '0.9rem' }}
                                >
                                    <option value="DIRECT">直销</option>
                                    <option value="DEALER">经销商</option>
                                </select>
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                                <label style={{ fontSize: '0.8rem', color: '#888', fontWeight: 600 }}>保修起始日期</label>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                    <div style={{ 
                                        flex: 1, padding: '10px 12px', borderRadius: 8, 
                                        border: '1px solid rgba(255,255,255,0.1)', 
                                        background: 'rgba(255,255,255,0.02)', color: '#888', fontSize: '0.9rem'
                                    }}>
                                        {formData.warranty_start_date || '未设置 (系统自动计算)'}
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => setShowWarrantyModal(true)}
                                        style={{
                                            padding: '10px 14px', borderRadius: 8,
                                            background: 'rgba(59,130,246,0.1)', border: '1px solid rgba(59,130,246,0.3)',
                                            color: '#3B82F6', fontSize: '0.8rem', fontWeight: 600,
                                            cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6,
                                            transition: 'all 0.2s'
                                        }}
                                        onMouseEnter={e => { e.currentTarget.style.background = 'rgba(59,130,246,0.2)'; }}
                                        onMouseLeave={e => { e.currentTarget.style.background = 'rgba(59,130,246,0.1)'; }}
                                    >
                                        <Shield size={14} />
                                        修改保修
                                    </button>
                                </div>
                                <span style={{ fontSize: '0.7rem', color: '#666' }}>
                                    * 保修日期由系统根据销售信息自动计算，点击"修改保修"录入销售日期
                                </span>
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                                <label style={{ fontSize: '0.8rem', color: '#888', fontWeight: 600 }}>保修时长（月）</label>
                                <input
                                    type="number"
                                    value={formData.warranty_months || 24}
                                    onChange={(e) => setFormData({ ...formData, warranty_months: parseInt(e.target.value) })}
                                    style={{ padding: '10px 12px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.05)', color: '#fff', fontSize: '0.9rem' }}
                                />
                            </div>
                        </>
                    )}
                </div>

                {/* Footer */}
                <div style={{ padding: '16px 24px', borderTop: '1px solid rgba(255,255,255,0.08)', background: 'rgba(0,0,0,0.2)' }}>
                    <button
                        onClick={handleSubmit}
                        disabled={saving}
                        style={{
                            width: '100%', padding: '10px', borderRadius: 10, fontWeight: 600,
                            background: '#FFD200', color: '#000', border: 'none',
                            cursor: saving ? 'wait' : 'pointer', fontSize: '0.88rem',
                            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                            opacity: saving ? 0.7 : 1
                        }}
                    >
                        <Save size={15} /> {saving ? '保存中...' : '保存更改'}
                    </button>
                </div>
            </div>

            {/* Warranty Registration Modal */}
            <ProductWarrantyRegistrationModal
                isOpen={showWarrantyModal}
                onClose={() => setShowWarrantyModal(false)}
                serialNumber={formData.serial_number || ''}
                productName={formData.model_name || ''}
                onRegistered={() => {
                    // Refresh to get updated warranty info
                    setShowWarrantyModal(false);
                }}
            />
        </>
    );
};

export default ProductModal;
