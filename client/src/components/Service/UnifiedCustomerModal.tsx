/**
 * UnifiedCustomerModal - 统一客户创建/编辑弹窗
 * 
 * 使用场景:
 * 1. 工单详情页 → 未知访客 → "添加为新客户" (简化模式，预填快照)
 * 2. 客户档案页面 → "+ 新增" (完整模式)
 * 3. 关联已知客户弹窗 → "找不到？添加新客户" (简化模式)
 * 
 * 设计规范: macOS26 风格
 * 主题色: Kine Yellow (#FFD700)
 */

import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, Check, ChevronDown, ChevronUp, Plus, Trash2 } from 'lucide-react';
import axios from 'axios';
import { useAuthStore } from '../../store/useAuthStore';

// ============ Types ============
interface Contact {
    id?: number;
    name: string;
    email: string;
    phone: string;
    job_title: string;
    is_primary: boolean;
}

interface CustomerFormData {
    id?: number;
    name: string;
    account_type: 'DEALER' | 'ORGANIZATION' | 'INDIVIDUAL';
    lifecycle_stage: 'PROSPECT' | 'ACTIVE';
    service_tier: string;
    country: string;
    city: string;
    address: string;
    notes: string;
    parent_dealer_id?: number;
    contacts: Contact[];
    // 经销商特有字段
    dealer_code?: string;
    dealer_level?: 'tier1' | 'tier2' | 'tier3' | 'Direct' | '';
    can_repair?: boolean;
    repair_level?: 'simple' | 'advanced' | 'full' | '';
}

interface UnifiedCustomerModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: (accountId: number, accountName: string) => void;
    
    // 预填数据 (来自访客快照)
    prefillData?: {
        name?: string;
        email?: string;
        phone?: string;
    };
    
    // 工单关联模式
    ticketId?: number;
    
    // 编辑模式
    editData?: any;
    isEditing?: boolean;
    
    // 默认模式
    defaultMode?: 'individual' | 'organization' | 'dealer';
    
    // 默认客户身份
    defaultLifecycleStage?: 'PROSPECT' | 'ACTIVE';
}

// ============ Component ============
const UnifiedCustomerModal: React.FC<UnifiedCustomerModalProps> = ({
    isOpen,
    onClose,
    onSuccess,
    prefillData,
    ticketId,
    editData,
    isEditing = false,
    defaultMode = 'individual',
    defaultLifecycleStage = 'ACTIVE'
}) => {
    const { token } = useAuthStore();
    const [loading, setLoading] = useState(false);
    const [showAdvanced, setShowAdvanced] = useState(false);
    
    // 表单数据
    const [formData, setFormData] = useState<CustomerFormData>({
        name: '',
        account_type: defaultMode === 'organization' ? 'ORGANIZATION' : 'INDIVIDUAL',
        lifecycle_stage: defaultLifecycleStage,
        service_tier: 'STANDARD',
        country: '',
        city: '',
        address: '',
        notes: '',
        contacts: [{ name: '', email: '', phone: '', job_title: '', is_primary: true }]
    });

    // 判断是否为经销商模式
    const isDealerMode = defaultMode === 'dealer' || formData.account_type === 'DEALER';

    // 初始化/重置表单
    useEffect(() => {
        if (!isOpen) return;
        
        if (isEditing && editData) {
            // 编辑模式：加载现有数据
            const isDealer = editData.account_type === 'DEALER' || defaultMode === 'dealer';
            setFormData({
                id: editData.id,
                name: editData.name || editData.customer_name || '',
                account_type: editData.account_type || (defaultMode === 'dealer' ? 'DEALER' : 'INDIVIDUAL'),
                lifecycle_stage: editData.lifecycle_stage || 'ACTIVE',
                service_tier: editData.service_tier || 'STANDARD',
                country: editData.country || '',
                city: editData.city || '',
                address: editData.address || '',
                notes: editData.notes || '',
                parent_dealer_id: editData.parent_dealer_id,
                // 经销商特有字段
                dealer_code: isDealer ? (editData.dealer_code || '') : undefined,
                dealer_level: isDealer ? (editData.dealer_level || '') : undefined,
                can_repair: isDealer ? (editData.can_repair || false) : undefined,
                repair_level: isDealer ? (editData.repair_level || '') : undefined,
                contacts: editData.contacts?.length > 0
                    ? editData.contacts.map((c: any) => ({
                        id: c.id,
                        name: c.name || '',
                        email: c.email || '',
                        phone: c.phone || '',
                        job_title: c.job_title || '',
                        is_primary: c.is_primary || c.status === 'PRIMARY' || false
                    }))
                    : [{ name: '', email: '', phone: '', job_title: '', is_primary: true }]
            });
            setShowAdvanced(true); // 编辑模式默认展开高级选项
        } else {
            // 新建模式：使用预填数据
            const isDealer = defaultMode === 'dealer';
            setFormData({
                name: prefillData?.name || '',
                account_type: defaultMode === 'dealer' ? 'DEALER' : (defaultMode === 'organization' ? 'ORGANIZATION' : 'INDIVIDUAL'),
                lifecycle_stage: defaultLifecycleStage,
                service_tier: 'STANDARD',
                country: '',
                city: '',
                address: '',
                notes: '',
                // 经销商特有字段
                dealer_code: isDealer ? '' : undefined,
                dealer_level: isDealer ? '' : undefined,
                can_repair: isDealer ? false : undefined,
                repair_level: isDealer ? '' : undefined,
                contacts: [{
                    name: prefillData?.name || '',
                    email: prefillData?.email || '',
                    phone: prefillData?.phone || '',
                    job_title: '',
                    is_primary: true
                }]
            });
            setShowAdvanced(false);
        }
    }, [isOpen, isEditing, editData, prefillData, defaultMode, defaultLifecycleStage]);

    // 联系人操作
    const handleAddContact = () => {
        setFormData({
            ...formData,
            contacts: [...formData.contacts, { name: '', email: '', phone: '', job_title: '', is_primary: false }]
        });
    };

    const handleRemoveContact = (index: number) => {
        const newContacts = formData.contacts.filter((_, i) => i !== index);
        if (newContacts.length > 0 && !newContacts.some(c => c.is_primary)) {
            newContacts[0].is_primary = true;
        }
        setFormData({ ...formData, contacts: newContacts });
    };

    const handleContactChange = (index: number, field: keyof Contact, value: string | boolean) => {
        const newContacts = [...formData.contacts];
        newContacts[index] = { ...newContacts[index], [field]: value };
        if (field === 'is_primary' && value === true) {
            newContacts.forEach((c, i) => {
                if (i !== index) c.is_primary = false;
            });
        }
        setFormData({ ...formData, contacts: newContacts });
    };

    // 提交表单
    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        
        if (!formData.name.trim()) {
            alert('请输入客户名称');
            return;
        }

        setLoading(true);
        try {
            let accountId: number;
            let accountName: string;

            if (isEditing && formData.id) {
                // 更新现有账户
                const updateData: any = {
                    name: formData.name,
                    account_type: formData.account_type,
                    lifecycle_stage: formData.lifecycle_stage,
                    service_tier: formData.service_tier,
                    country: formData.country,
                    city: formData.city,
                    address: formData.address,
                    notes: formData.notes,
                    parent_dealer_id: formData.parent_dealer_id
                };
                // 经销商特有字段
                if (isDealerMode) {
                    updateData.dealer_code = formData.dealer_code;
                    updateData.dealer_level = formData.dealer_level;
                    updateData.can_repair = formData.can_repair;
                    updateData.repair_level = formData.repair_level;
                }
                await axios.patch(`/api/v1/accounts/${formData.id}`, updateData, {
                    headers: { Authorization: `Bearer ${token}` }
                });
                
                accountId = formData.id;
                accountName = formData.name;
                
                // 同步联系人
                await syncContacts(accountId, formData.contacts);
                
            } else {
                // 创建新账户
                const primaryContact = formData.contacts.find(c => c.is_primary) || formData.contacts[0];
                
                const createData: any = {
                    name: formData.name,
                    account_type: formData.account_type,
                    lifecycle_stage: formData.lifecycle_stage,
                    service_tier: formData.service_tier,
                    country: formData.country,
                    city: formData.city,
                    address: formData.address,
                    notes: formData.notes,
                    parent_dealer_id: formData.parent_dealer_id,
                    // 主联系人信息
                    primary_contact_name: primaryContact?.name,
                    primary_contact_email: primaryContact?.email,
                    primary_contact_phone: primaryContact?.phone,
                    primary_contact_job_title: primaryContact?.job_title
                };
                // 经销商特有字段
                if (isDealerMode) {
                    createData.dealer_code = formData.dealer_code;
                    createData.dealer_level = formData.dealer_level;
                    createData.can_repair = formData.can_repair;
                    createData.repair_level = formData.repair_level;
                }
                
                const res = await axios.post('/api/v1/accounts', createData, {
                    headers: { Authorization: `Bearer ${token}` }
                });

                if (!res.data.success) {
                    throw new Error(res.data.error || '创建失败');
                }

                accountId = res.data.data.id;
                accountName = formData.name;

                // 创建额外联系人
                const otherContacts = formData.contacts.filter(c => !c.is_primary && c.name.trim());
                for (const contact of otherContacts) {
                    await axios.post(`/api/v1/accounts/${accountId}/contacts`, {
                        name: contact.name,
                        email: contact.email,
                        phone: contact.phone,
                        job_title: contact.job_title,
                        is_primary: false
                    }, {
                        headers: { Authorization: `Bearer ${token}` }
                    });
                }

                // 如果是工单关联模式，自动关联
                if (ticketId) {
                    const primaryContactRes = await axios.get(`/api/v1/accounts/${accountId}/contacts`, {
                        headers: { Authorization: `Bearer ${token}` }
                    });
                    const contactId = primaryContactRes.data.data?.[0]?.id;
                    
                    await axios.patch(`/api/v1/tickets/${ticketId}`, {
                        account_id: accountId,
                        contact_id: contactId,
                        reporter_name: primaryContact?.name
                    }, {
                        headers: { Authorization: `Bearer ${token}` }
                    });
                }
            }

            onSuccess(accountId, accountName);
        } catch (err: any) {
            console.error('UnifiedCustomerModal submit error:', err);
            alert(err.response?.data?.error || err.message || '操作失败');
        } finally {
            setLoading(false);
        }
    };

    // 同步联系人（编辑模式）
    const syncContacts = async (accountId: number, contacts: Contact[]) => {
        const existingRes = await axios.get(`/api/v1/accounts/${accountId}/contacts`, {
            headers: { Authorization: `Bearer ${token}` }
        });
        const existingContacts = existingRes.data.data || [];
        const existingIds = existingContacts.map((c: any) => c.id);
        const newIds = contacts.filter(c => c.id).map(c => c.id);

        // 删除不存在的
        for (const ec of existingContacts) {
            if (!newIds.includes(ec.id)) {
                await axios.delete(`/api/v1/contacts/${ec.id}`, {
                    headers: { Authorization: `Bearer ${token}` }
                });
            }
        }

        // 更新/创建
        for (const contact of contacts) {
            if (contact.id && existingIds.includes(contact.id)) {
                await axios.patch(`/api/v1/contacts/${contact.id}`, {
                    name: contact.name,
                    email: contact.email,
                    phone: contact.phone,
                    job_title: contact.job_title,
                    is_primary: contact.is_primary
                }, {
                    headers: { Authorization: `Bearer ${token}` }
                });
            } else if (contact.name.trim()) {
                await axios.post(`/api/v1/accounts/${accountId}/contacts`, {
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
    };

    if (!isOpen) return null;

    return createPortal(
        <div style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            background: 'var(--modal-overlay)', backdropFilter: 'blur(4px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999
        }}>
            <div style={{
                background: 'var(--modal-bg)', width: 900, borderRadius: 12,
                boxShadow: 'var(--glass-shadow-lg)',
                border: '1px solid var(--glass-border)',
                display: 'flex', flexDirection: 'column',
                maxHeight: '85vh'
            }}>
                {/* Header */}
                <div style={{
                    padding: '16px 24px', borderBottom: '1px solid var(--glass-border)',
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    flexShrink: 0
                }}>
                    <h3 style={{ margin: 0, fontSize: 18, color: 'var(--text-main)' }}>
                        {isDealerMode 
                            ? (isEditing ? '编辑经销商' : '新增经销商')
                            : (isEditing ? '编辑客户' : '新增客户')
                        }
                    </h3>
                    <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}>
                        <X size={22} />
                    </button>
                </div>

                {/* Content - 左右分栏布局 */}
                <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
                    <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
                        {/* 左侧：双 Panel 布局 */}
                        <div style={{ flex: 1, padding: 24, overflowY: 'auto', borderRight: '1px solid var(--glass-border)' }}>
                        
                        {/* Panel 1: 根据模式显示不同字段 */}
                        <div style={{ 
                            padding: 20, 
                            background: 'var(--glass-bg-light)', 
                            borderRadius: 12, 
                            border: '1px solid var(--glass-border)',
                            marginBottom: 16 
                        }}>
                            {isDealerMode ? (
                                // 经销商模式: 身份、经销商等级、维修能力
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
                                    {/* 身份 */}
                                    <div>
                                        <label style={{ display: 'block', fontSize: 12, color: 'var(--text-tertiary)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 }}>身份</label>
                                        <select
                                            value={formData.lifecycle_stage}
                                            onChange={e => setFormData({ ...formData, lifecycle_stage: e.target.value as any })}
                                            style={{
                                                width: '100%', padding: '10px 12px', background: 'var(--input-bg)',
                                                border: '1px solid var(--input-border)', borderRadius: 8, color: 'var(--text-main)', fontSize: 14
                                            }}
                                        >
                                            <option value="PROSPECT">潜在</option>
                                            <option value="ACTIVE">正式</option>
                                        </select>
                                    </div>
                                    {/* 经销商等级 */}
                                    <div>
                                        <label style={{ display: 'block', fontSize: 12, color: 'var(--text-tertiary)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 }}>经销商等级</label>
                                        <select
                                            value={formData.dealer_level || ''}
                                            onChange={e => setFormData({ ...formData, dealer_level: e.target.value as any })}
                                            style={{
                                                width: '100%', padding: '10px 12px', background: 'var(--input-bg)',
                                                border: '1px solid var(--input-border)', borderRadius: 8, color: 'var(--text-main)', fontSize: 14
                                            }}
                                        >
                                            <option value="">请选择</option>
                                            <option value="tier1">一级经销商</option>
                                            <option value="tier2">二级经销商</option>
                                            <option value="tier3">三级经销商</option>
                                            <option value="Direct">直营</option>
                                        </select>
                                    </div>
                                    {/* 维修能力 */}
                                    <div>
                                        <label style={{ display: 'block', fontSize: 12, color: 'var(--text-tertiary)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 }}>维修能力</label>
                                        <select
                                            value={formData.repair_level || ''}
                                            onChange={e => {
                                                const value = e.target.value;
                                                setFormData({ 
                                                    ...formData, 
                                                    repair_level: value as any, 
                                                    can_repair: !!value 
                                                });
                                            }}
                                            style={{
                                                width: '100%', padding: '10px 12px', background: 'var(--input-bg)',
                                                border: '1px solid var(--input-border)', borderRadius: 8, color: 'var(--text-main)', fontSize: 14
                                            }}
                                        >
                                            <option value="">无维修能力</option>
                                            <option value="simple">简单</option>
                                            <option value="advanced">高级</option>
                                            <option value="full">完整</option>
                                        </select>
                                    </div>
                                </div>
                            ) : (
                                // 客户模式: 类型、身份、服务等级
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
                                    {/* 客户类型 */}
                                    <div>
                                        <label style={{ display: 'block', fontSize: 12, color: 'var(--text-tertiary)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 }}>类型</label>
                                        <select
                                            value={formData.account_type}
                                            onChange={e => setFormData({ ...formData, account_type: e.target.value as any })}
                                            style={{
                                                width: '100%', padding: '10px 12px', background: 'var(--input-bg)',
                                                border: '1px solid var(--input-border)', borderRadius: 8, color: 'var(--text-main)', fontSize: 14
                                            }}
                                        >
                                            <option value="INDIVIDUAL">👤 个人</option>
                                            <option value="ORGANIZATION">🏢 机构</option>
                                        </select>
                                    </div>
                                    {/* 客户身份 */}
                                    <div>
                                        <label style={{ display: 'block', fontSize: 12, color: 'var(--text-tertiary)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 }}>身份</label>
                                        <select
                                            value={formData.lifecycle_stage}
                                            onChange={e => setFormData({ ...formData, lifecycle_stage: e.target.value as any })}
                                            style={{
                                                width: '100%', padding: '10px 12px', background: 'var(--input-bg)',
                                                border: '1px solid var(--input-border)', borderRadius: 8, color: 'var(--text-main)', fontSize: 14
                                            }}
                                        >
                                            <option value="PROSPECT">潜在</option>
                                            <option value="ACTIVE">正式</option>
                                        </select>
                                    </div>
                                    {/* 服务等级 */}
                                    <div>
                                        <label style={{ display: 'block', fontSize: 12, color: 'var(--text-tertiary)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 }}>服务等级</label>
                                        <select
                                            value={formData.service_tier}
                                            onChange={e => setFormData({ ...formData, service_tier: e.target.value })}
                                            style={{
                                                width: '100%', padding: '10px 12px', background: 'var(--input-bg)',
                                                border: '1px solid var(--input-border)', borderRadius: 8, color: 'var(--text-main)', fontSize: 14
                                            }}
                                        >
                                            <option value="STANDARD">Standard</option>
                                            <option value="VIP">VIP</option>
                                            <option value="VVIP">VVIP</option>
                                        </select>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Panel 2: 基本信息（名称、电话、邮箱、地址） */}
                        <div style={{ 
                            padding: 20, 
                            background: 'var(--glass-bg-light)', 
                            borderRadius: 12, 
                            border: '1px solid var(--glass-border)'
                        }}>
                            {/* 名称 + 经销商代码（仅经销商模式） */}
                            <div style={{ display: 'grid', gridTemplateColumns: isDealerMode ? '2fr 1fr' : '1fr', gap: 12, marginBottom: 16 }}>
                                <div>
                                    <label style={{ display: 'block', fontSize: 12, color: 'var(--text-tertiary)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                                        {isDealerMode ? '账户名称' : (formData.account_type === 'ORGANIZATION' ? '企业名称' : '客户姓名')} *
                                    </label>
                                    <input
                                        required
                                        style={{
                                            width: '100%', padding: '12px 14px', background: 'var(--input-bg)',
                                            border: '1px solid var(--input-border)', borderRadius: 8, color: 'var(--text-main)', fontSize: 16
                                        }}
                                        value={formData.name}
                                        onChange={e => setFormData({ ...formData, name: e.target.value })}
                                        placeholder={isDealerMode ? '输入账户名称...' : (formData.account_type === 'ORGANIZATION' ? '输入企业名称...' : '输入客户姓名...')}
                                    />
                                </div>
                                {isDealerMode && (
                                    <div>
                                        <label style={{ display: 'block', fontSize: 12, color: 'var(--text-tertiary)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 }}>经销商代码</label>
                                        <input
                                            style={{
                                                width: '100%', padding: '12px 14px', background: 'var(--input-bg)',
                                                border: '1px solid var(--input-border)', borderRadius: 8, color: 'var(--text-main)', fontSize: 16
                                            }}
                                            value={formData.dealer_code || ''}
                                            onChange={e => setFormData({ ...formData, dealer_code: e.target.value })}
                                            placeholder="如: ProAV"
                                        />
                                    </div>
                                )}
                            </div>

                            {/* 电话 + 邮箱 */}
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
                                <div>
                                    <label style={{ display: 'block', fontSize: 12, color: 'var(--text-tertiary)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 }}>电话</label>
                                    <input
                                        style={{
                                            width: '100%', padding: '10px 12px', background: 'var(--input-bg)',
                                            border: '1px solid var(--input-border)', borderRadius: 8, color: 'var(--text-main)', fontSize: 15
                                        }}
                                        value={formData.contacts[0]?.phone || ''}
                                        onChange={e => handleContactChange(0, 'phone', e.target.value)}
                                        placeholder="联系电话"
                                    />
                                </div>
                                <div>
                                    <label style={{ display: 'block', fontSize: 12, color: 'var(--text-tertiary)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 }}>邮箱</label>
                                    <input
                                        type="email"
                                        style={{
                                            width: '100%', padding: '10px 12px', background: 'var(--input-bg)',
                                            border: '1px solid var(--input-border)', borderRadius: 8, color: 'var(--text-main)', fontSize: 15
                                        }}
                                        value={formData.contacts[0]?.email || ''}
                                        onChange={e => handleContactChange(0, 'email', e.target.value)}
                                        placeholder="电子邮箱"
                                    />
                                </div>
                            </div>

                            {/* 地区 + 城市 */}
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
                                <div>
                                    <label style={{ display: 'block', fontSize: 12, color: 'var(--text-tertiary)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 }}>地区</label>
                                    <input
                                        style={{
                                            width: '100%', padding: '10px 12px', background: 'var(--input-bg)',
                                            border: '1px solid var(--input-border)', borderRadius: 8, color: 'var(--text-main)', fontSize: 15
                                        }}
                                        value={formData.country}
                                        onChange={e => setFormData({ ...formData, country: e.target.value })}
                                        placeholder="国家/地区"
                                    />
                                </div>
                                <div>
                                    <label style={{ display: 'block', fontSize: 12, color: 'var(--text-tertiary)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 }}>城市</label>
                                    <input
                                        style={{
                                            width: '100%', padding: '10px 12px', background: 'var(--input-bg)',
                                            border: '1px solid var(--input-border)', borderRadius: 8, color: 'var(--text-main)', fontSize: 15
                                        }}
                                        value={formData.city}
                                        onChange={e => setFormData({ ...formData, city: e.target.value })}
                                        placeholder="城市"
                                    />
                                </div>
                            </div>

                            {/* 详细地址 */}
                            <div>
                                <label style={{ display: 'block', fontSize: 12, color: 'var(--text-tertiary)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 }}>详细地址</label>
                                <input
                                    style={{
                                        width: '100%', padding: '10px 12px', background: 'var(--input-bg)',
                                        border: '1px solid var(--input-border)', borderRadius: 8, color: 'var(--text-main)', fontSize: 15
                                    }}
                                    value={formData.address}
                                    onChange={e => setFormData({ ...formData, address: e.target.value })}
                                    placeholder="详细地址"
                                />
                            </div>
                        </div>

                        {/* 高级选项（备注） */}
                        <div style={{ marginTop: 16 }}>
                            <div
                                onClick={() => setShowAdvanced(!showAdvanced)}
                                style={{
                                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                    padding: '10px 0', cursor: 'pointer'
                                }}
                            >
                                <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
                                    {showAdvanced ? '收起备注' : '添加备注'}
                                </span>
                                {showAdvanced ? <ChevronUp size={16} color="var(--text-secondary)" /> : <ChevronDown size={16} color="var(--text-secondary)" />}
                            </div>
                            {showAdvanced && (
                                <div style={{ marginTop: 8 }}>
                                    <textarea
                                        style={{
                                            width: '100%', padding: '12px 14px', background: 'var(--input-bg)',
                                            border: '1px solid var(--input-border)', borderRadius: 8, color: 'var(--text-main)', fontSize: 15,
                                            resize: 'vertical', minHeight: 80
                                        }}
                                        value={formData.notes}
                                        onChange={e => setFormData({ ...formData, notes: e.target.value })}
                                        placeholder="备注信息..."
                                    />
                                </div>
                            )}
                        </div>
                    </div>{/* 左侧结束 */}

                    {/* 右侧：联系人列表 */}
                        <div style={{ width: 320, padding: 24, overflowY: 'auto', background: 'var(--glass-bg-light)' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                                <h4 style={{ margin: 0, fontSize: 15, color: 'var(--text-main)', fontWeight: 500 }}>联系人</h4>
                                <button
                                    type="button"
                                    onClick={handleAddContact}
                                    className="btn-kine-lowkey"
                                    style={{
                                        display: 'flex', alignItems: 'center', gap: 4, padding: '6px 12px',
                                        borderRadius: 6, fontSize: 13, fontWeight: 500
                                    }}
                                >
                                    <Plus size={16} /> 添加
                                </button>
                            </div>

                            {formData.contacts.map((contact, index) => (
                                <div key={index} style={{
                                    padding: 14, background: 'var(--glass-bg)', borderRadius: 10,
                                    marginBottom: 10, border: contact.is_primary ? '1px solid var(--glass-border-accent)' : '1px solid var(--glass-border)'
                                }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                            <input
                                                type="radio"
                                                name="primary_contact"
                                                checked={contact.is_primary}
                                                onChange={() => handleContactChange(index, 'is_primary', true)}
                                                style={{ accentColor: 'var(--accent-blue)' }}
                                            />
                                            <span style={{ fontSize: 13, color: contact.is_primary ? 'var(--accent-blue)' : 'var(--text-secondary)' }}>
                                                {contact.is_primary ? '主要联系人' : '联系人'}
                                            </span>
                                        </div>
                                        {formData.contacts.length > 1 && (
                                            <button
                                                type="button"
                                                onClick={() => handleRemoveContact(index)}
                                                style={{ background: 'transparent', border: 'none', color: 'var(--text-tertiary)', cursor: 'pointer', padding: 2 }}
                                            >
                                                <Trash2 size={16} />
                                            </button>
                                        )}
                                    </div>
                                    <input
                                        style={{
                                            width: '100%', padding: '8px 10px', background: 'var(--input-bg)',
                                            border: '1px solid var(--input-border)', borderRadius: 6, color: 'var(--text-main)', fontSize: 14,
                                            marginBottom: 8
                                        }}
                                        value={contact.name}
                                        onChange={e => handleContactChange(index, 'name', e.target.value)}
                                        placeholder="姓名"
                                    />
                                    <input
                                        style={{
                                            width: '100%', padding: '8px 10px', background: 'var(--input-bg)',
                                            border: '1px solid var(--input-border)', borderRadius: 6, color: 'var(--text-main)', fontSize: 14,
                                            marginBottom: 8
                                        }}
                                        value={contact.job_title}
                                        onChange={e => handleContactChange(index, 'job_title', e.target.value)}
                                        placeholder="职位"
                                    />
                                    <input
                                        style={{
                                            width: '100%', padding: '8px 10px', background: 'var(--input-bg)',
                                            border: '1px solid var(--input-border)', borderRadius: 6, color: 'var(--text-main)', fontSize: 14,
                                            marginBottom: 8
                                        }}
                                        value={contact.phone}
                                        onChange={e => handleContactChange(index, 'phone', e.target.value)}
                                        placeholder="电话"
                                    />
                                    <input
                                        style={{
                                            width: '100%', padding: '8px 10px', background: 'var(--input-bg)',
                                            border: '1px solid var(--input-border)', borderRadius: 6, color: 'var(--text-main)', fontSize: 14
                                        }}
                                        value={contact.email}
                                        onChange={e => handleContactChange(index, 'email', e.target.value)}
                                        placeholder="邮箱"
                                    />
                                </div>
                            ))}
                        </div>{/* 右侧结束 */}
                    </div>{/* 内容区分栏结束 */}

                    {/* Footer */}
                    <div style={{
                        padding: '16px 20px', borderTop: '1px solid var(--glass-border)',
                        display: 'flex', justifyContent: 'flex-end', gap: 12, flexShrink: 0
                    }}>
                        <button
                            type="button"
                            onClick={onClose}
                            className="glass-btn"
                            style={{
                                padding: '10px 20px'
                            }}
                        >
                            取消
                        </button>
                        <button
                            type="submit"
                            disabled={loading}
                            className="btn-primary"
                            style={{
                                padding: '10px 20px', display: 'flex', alignItems: 'center', gap: 6,
                                opacity: loading ? 0.7 : 1
                            }}
                        >
                            <Check size={16} />
                            {loading ? '处理中...' : (isEditing ? '保存修改' : (ticketId ? '创建并关联' : '确认创建'))}
                        </button>
                    </div>
                </form>
            </div>
        </div>,
        document.body
    );
};

export default UnifiedCustomerModal;
