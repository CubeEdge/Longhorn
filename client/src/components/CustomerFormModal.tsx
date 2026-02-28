import React, { useState, useEffect } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { useLanguage } from '../i18n/useLanguage';

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
    dealer_code?: string;
    dealer_level?: string;
    can_repair?: boolean;
    repair_level?: string;
    service_tier?: string;
    industry_tags?: string;
    address?: string;
    country: string;
    city: string;
    notes: string;
    contacts: Contact[];
}

interface CustomerFormModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSubmit: (e: React.FormEvent, data: CustomerFormData) => void;
    initialData: any;
    isEditing: boolean;
    _user: any;
    mode: 'individual' | 'organization' | 'dealer';
    saving?: boolean;
}

const CustomerFormModal: React.FC<CustomerFormModalProps> = ({
    isOpen,
    onClose,
    onSubmit,
    initialData,
    isEditing,
    _user: _unusedUser,
    mode,
    saving = false
}) => {
    const { t } = useLanguage();

    // Determine default account type based on mode
    const getDefaultAccountType = () => {
        switch (mode) {
            case 'dealer': return 'DEALER';
            case 'organization': return 'ORGANIZATION';
            case 'individual': return 'INDIVIDUAL';
            default: return 'INDIVIDUAL';
        }
    };

    const [formData, setFormData] = useState<CustomerFormData>({
        name: '',
        account_type: getDefaultAccountType(),
        country: '',
        city: '',
        notes: '',
        contacts: [{ name: '', email: '', phone: '', job_title: '', is_primary: true }]
    });

    useEffect(() => {
        if (initialData) {
            // For editing, use the mode to determine account_type if not explicitly set
            let accountType = initialData.account_type || initialData.customer_type;
            if (!accountType || accountType === 'EndUser') {
                accountType = mode === 'organization' ? 'ORGANIZATION' :
                    mode === 'dealer' ? 'DEALER' : 'INDIVIDUAL';
            }

            setFormData({
                id: initialData.id,
                name: initialData.customer_name || initialData.name || '',
                account_type: accountType === 'Dealer' || accountType === 'DEALER' ? 'DEALER' :
                    accountType === 'ORGANIZATION' ? 'ORGANIZATION' : 'INDIVIDUAL',
                dealer_code: initialData.dealer_code || '',
                dealer_level: initialData.dealer_level || '',
                can_repair: initialData.can_repair || false,
                repair_level: initialData.repair_level || '',
                service_tier: initialData.service_tier || 'STANDARD',
                industry_tags: initialData.industry_tags || '',
                address: initialData.address || '',
                country: initialData.country || '',
                city: initialData.city || '',
                notes: initialData.notes || '',
                contacts: initialData.contacts?.length > 0
                    ? initialData.contacts.map((c: any) => ({
                        id: c.id,
                        name: c.name || '',
                        email: c.email || '',
                        phone: c.phone || '',
                        job_title: c.job_title || '',
                        is_primary: c.is_primary || c.status === 'PRIMARY' || false
                    }))
                    : [{ name: initialData.contact_person || '', email: initialData.email || '', phone: initialData.phone || '', job_title: '', is_primary: true }]
            });
        } else {
            setFormData({
                name: '',
                account_type: getDefaultAccountType(),
                country: '',
                city: '',
                notes: '',
                contacts: [{ name: '', email: '', phone: '', job_title: '', is_primary: true }]
            });
        }
    }, [initialData, isOpen, mode]);

    const handleAddContact = () => {
        setFormData({
            ...formData,
            contacts: [...formData.contacts, { name: '', email: '', phone: '', job_title: '', is_primary: false }]
        });
    };

    const handleRemoveContact = (index: number) => {
        const newContacts = formData.contacts.filter((_, i) => i !== index);
        // Ensure at least one primary contact
        if (newContacts.length > 0 && !newContacts.some(c => c.is_primary)) {
            newContacts[0].is_primary = true;
        }
        setFormData({ ...formData, contacts: newContacts });
    };

    const handleContactChange = (index: number, field: keyof Contact, value: string | boolean) => {
        const newContacts = [...formData.contacts];
        newContacts[index] = { ...newContacts[index], [field]: value };

        // If setting this contact as primary, unset others
        if (field === 'is_primary' && value === true) {
            newContacts.forEach((c, i) => {
                if (i !== index) c.is_primary = false;
            });
        }

        setFormData({ ...formData, contacts: newContacts });
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onSubmit(e, formData);
    };

    const getAccountTypeLabel = (type: string) => {
        switch (type) {
            case 'DEALER': return '经销商 (DEALER)';
            case 'ORGANIZATION': return '机构客户 (ORGANIZATION)';
            case 'INDIVIDUAL': return '个人客户 (INDIVIDUAL)';
            default: return type;
        }
    };

    // Tab state for dealer and organization modes
    const [activeFormTab, setActiveFormTab] = useState<'basic' | 'contacts'>('basic');

    // Reset tab when modal opens
    useEffect(() => {
        if (isOpen) {
            setActiveFormTab('basic');
        }
    }, [isOpen]);

    // Check if should show tabs (dealer or organization mode)
    const shouldShowTabs = mode === 'dealer' || mode === 'organization';

    if (!isOpen) return null;

    const tc = (key: string, defaultText: string) => {
        const text = (t as any)(key, { defaultValue: defaultText });
        return text === key ? defaultText : text;
    };

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-content fade-in" onClick={e => e.stopPropagation()} style={{ width: '100%', maxWidth: 700, height: 620, display: 'flex', flexDirection: 'column' }}>
                <h3 style={{ marginBottom: 24, flexShrink: 0 }}>{isEditing ? tc('customer.edit_account', '编辑账户') : tc('customer.add_account', '新增账户')}</h3>
                <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
                    {/* Tab Navigation for dealer/organization */}
                    {shouldShowTabs && (
                        <div style={{ display: 'flex', gap: 4, background: 'var(--glass-bg-hover)', padding: 4, borderRadius: 10, marginBottom: 20, height: '44px', alignItems: 'center', flexShrink: 0 }}>
                            <button
                                type="button"
                                onClick={() => setActiveFormTab('basic')}
                                style={{
                                    flex: 1,
                                    padding: '0 20px',
                                    height: '36px',
                                    background: activeFormTab === 'basic' ? 'var(--glass-bg-hover)' : 'transparent',
                                    color: activeFormTab === 'basic' ? 'var(--text-main)' : 'var(--text-secondary)',
                                    borderRadius: 8,
                                    fontWeight: activeFormTab === 'basic' ? 600 : 400,
                                    fontSize: '0.95rem',
                                    border: 'none',
                                    cursor: 'pointer',
                                    transition: 'all 0.2s ease'
                                }}
                            >
                                {tc('customer.basic_info', '基本信息')}
                            </button>
                            <button
                                type="button"
                                onClick={() => setActiveFormTab('contacts')}
                                style={{
                                    flex: 1,
                                    padding: '0 20px',
                                    height: '36px',
                                    background: activeFormTab === 'contacts' ? 'var(--glass-bg-hover)' : 'transparent',
                                    color: activeFormTab === 'contacts' ? 'var(--text-main)' : 'var(--text-secondary)',
                                    borderRadius: 8,
                                    fontWeight: activeFormTab === 'contacts' ? 600 : 400,
                                    fontSize: '0.95rem',
                                    border: 'none',
                                    cursor: 'pointer',
                                    transition: 'all 0.2s ease'
                                }}
                            >
                                {tc('customer.contact_info', '联系人信息')}
                            </button>
                        </div>
                    )}

                    <div style={{ flex: 1, overflowY: 'auto', paddingRight: 4, marginBottom: 20 }} className="custom-scroll">
                        {/* Basic Info Tab */}
                        {(!shouldShowTabs || activeFormTab === 'basic') && (
                            <>
                                {/* Account Name and Dealer Code (for dealer mode) */}
                                {mode === 'dealer' ? (
                                    <div style={{ display: 'grid', gridTemplateColumns: '3fr 1fr', gap: 16, marginBottom: 16 }}>
                                        <div>
                                            <label className="hint">Account Name *</label>
                                            <input
                                                className="form-control"
                                                required
                                                value={formData.name}
                                                onChange={e => setFormData({ ...formData, name: e.target.value })}
                                            />
                                        </div>
                                        <div>
                                            <label className="hint">经销商代码</label>
                                            <input
                                                className="form-control"
                                                value={formData.dealer_code || ''}
                                                onChange={e => setFormData({ ...formData, dealer_code: e.target.value })}
                                            />
                                        </div>
                                    </div>
                                ) : (
                                    <div style={{ marginBottom: 16 }}>
                                        <label className="hint">{(t as any)('customer.account_name', 'Account Name')} *</label>
                                        <input
                                            className="form-control"
                                            required
                                            value={formData.name}
                                            onChange={e => setFormData({ ...formData, name: e.target.value })}
                                        />
                                    </div>
                                )}

                                {/* Type and Service Tier / Dealer fields */}
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
                                    {mode === 'dealer' ? (
                                        // Dealer mode: show dealer level and repair capability
                                        <>
                                            <div>
                                                <label className="hint">经销商等级</label>
                                                {/* 
                                            经销商等级定义 (PRD 1.3.2)：
                                            - tier1 (一级经销商): 有配件库存 + 强维修能力
                                              代表: ProAV, Gafpa, 1SV, EU Office
                                            - tier2 (二级经销商): 无配件库存 + 有维修能力
                                              代表: DP Gadget
                                            - tier3 (三级经销商): 无配件库存 + 无维修能力
                                              代表: RMK
                                            */}
                                                <select
                                                    className="form-control"
                                                    value={formData.dealer_level || ''}
                                                    onChange={e => setFormData({ ...formData, dealer_level: e.target.value })}
                                                >
                                                    <option value="">请选择</option>
                                                    <option value="tier1">一级经销商</option>
                                                    <option value="tier2">二级经销商</option>
                                                    <option value="tier3">三级经销商</option>
                                                </select>
                                            </div>
                                            <div>
                                                <label className="hint">维修能力</label>
                                                {/*
                                            维修能力等级（PRD 1.3.2）：
                                            - 无: 无维修能力
                                            - 简单: 基础维修，可处理简单问题
                                            - 高级: 高级维修能力
                                            - 完整: 完整维修能力，可处理所有问题
                                            */}
                                                <select
                                                    className="form-control"
                                                    value={formData.repair_level || ''}
                                                    onChange={e => setFormData({ ...formData, repair_level: e.target.value, can_repair: !!e.target.value })}
                                                >
                                                    <option value="">无维修能力</option>
                                                    <option value="simple">简单</option>
                                                    <option value="advanced">高级</option>
                                                    <option value="full">完整</option>
                                                </select>
                                            </div>
                                        </>
                                    ) : (
                                        // Customer mode: show type selector with both INDIVIDUAL and ORGANIZATION options
                                        <>
                                            <div>
                                                <label className="hint">{(t as any)('customer.type', 'Type')} *</label>
                                                <select
                                                    className="form-control"
                                                    value={formData.account_type}
                                                    onChange={e => setFormData({ ...formData, account_type: e.target.value as any })}
                                                >
                                                    <option value="INDIVIDUAL">{getAccountTypeLabel('INDIVIDUAL')}</option>
                                                    <option value="ORGANIZATION">{getAccountTypeLabel('ORGANIZATION')}</option>
                                                </select>
                                            </div>
                                            <div>
                                                <label className="hint">Service Tier</label>
                                                <select
                                                    className="form-control"
                                                    value={formData.service_tier || 'STANDARD'}
                                                    onChange={e => setFormData({ ...formData, service_tier: e.target.value })}
                                                >
                                                    <option value="STANDARD">Standard</option>
                                                    <option value="VIP">VIP</option>
                                                    <option value="VVIP">VVIP</option>
                                                    <option value="BLACKLIST">Blacklist</option>
                                                </select>
                                            </div>
                                        </>
                                    )}
                                </div>

                                {/* Address - shown for all types */}
                                <div style={{ marginBottom: 16 }}>
                                    <label className="hint">Address</label>
                                    <input
                                        className="form-control"
                                        value={formData.address || ''}
                                        onChange={e => setFormData({ ...formData, address: e.target.value })}
                                    />
                                </div>

                                {/* Region */}
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
                                    <div>
                                        <label className="hint">Region (Country)</label>
                                        <input
                                            className="form-control"
                                            value={formData.country}
                                            onChange={e => setFormData({ ...formData, country: e.target.value })}
                                        />
                                    </div>
                                    <div>
                                        <label className="hint">City</label>
                                        <input
                                            className="form-control"
                                            value={formData.city}
                                            onChange={e => setFormData({ ...formData, city: e.target.value })}
                                        />
                                    </div>
                                </div>

                                {/* Notes */}
                                <div style={{ marginBottom: 24 }}>
                                    <label className="hint">Notes</label>
                                    <textarea
                                        className="form-control"
                                        rows={3}
                                        value={formData.notes}
                                        onChange={e => setFormData({ ...formData, notes: e.target.value })}
                                    />
                                </div>
                            </>
                        )}

                        {/* Contacts Tab */}
                        {(!shouldShowTabs || activeFormTab === 'contacts') && (
                            <div style={{ marginBottom: 16 }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                                    <label className="hint">联系人列表 *</label>
                                    <button
                                        type="button"
                                        className="btn-kine-lowkey"
                                        onClick={handleAddContact}
                                        style={{ padding: '4px 12px', fontSize: '0.85rem' }}
                                    >
                                        <Plus size={14} /> 添加
                                    </button>
                                </div>

                                <div style={{ border: '1px solid var(--glass-border)', borderRadius: 8, padding: 12 }}>
                                    <div style={{ display: 'grid', gridTemplateColumns: '2fr 1.5fr 2fr 1.5fr 60px 30px', gap: 8, marginBottom: 8, fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                                        <span>姓名 *</span>
                                        <span>职位</span>
                                        <span>邮箱</span>
                                        <span>电话</span>
                                        <span>主要</span>
                                        <span></span>
                                    </div>

                                    {formData.contacts.map((contact, index) => (
                                        <div key={index} style={{ display: 'grid', gridTemplateColumns: '2fr 1.5fr 2fr 1.5fr 60px 30px', gap: 8, marginBottom: 8, alignItems: 'center' }}>
                                            <input
                                                className="form-control"
                                                style={{ padding: '6px 10px', fontSize: '0.9rem' }}
                                                value={contact.name}
                                                onChange={e => handleContactChange(index, 'name', e.target.value)}
                                                placeholder="姓名"
                                                required
                                            />
                                            <input
                                                className="form-control"
                                                style={{ padding: '6px 10px', fontSize: '0.9rem' }}
                                                value={contact.job_title}
                                                onChange={e => handleContactChange(index, 'job_title', e.target.value)}
                                                placeholder="职位"
                                            />
                                            <input
                                                className="form-control"
                                                style={{ padding: '6px 10px', fontSize: '0.9rem' }}
                                                value={contact.email}
                                                onChange={e => handleContactChange(index, 'email', e.target.value)}
                                                placeholder="邮箱"
                                            />
                                            <input
                                                className="form-control"
                                                style={{ padding: '6px 10px', fontSize: '0.9rem' }}
                                                value={contact.phone}
                                                onChange={e => handleContactChange(index, 'phone', e.target.value)}
                                                placeholder="电话"
                                            />
                                            <div style={{ display: 'flex', justifyContent: 'center' }}>
                                                <input
                                                    type="radio"
                                                    name="primary_contact"
                                                    checked={contact.is_primary}
                                                    onChange={() => handleContactChange(index, 'is_primary', true)}
                                                    style={{
                                                        cursor: 'pointer',
                                                        accentColor: '#10B981',
                                                        width: '18px',
                                                        height: '18px'
                                                    }}
                                                />
                                            </div>
                                            <button
                                                type="button"
                                                onClick={() => handleRemoveContact(index)}
                                                disabled={formData.contacts.length === 1}
                                                style={{
                                                    background: 'none',
                                                    border: 'none',
                                                    color: formData.contacts.length === 1 ? 'rgba(255,255,255,0.2)' : '#ef4444',
                                                    cursor: formData.contacts.length === 1 ? 'not-allowed' : 'pointer',
                                                    padding: 4
                                                }}
                                            >
                                                <Trash2 size={16} />
                                            </button>
                                        </div>
                                    ))}
                                </div>
                                <p style={{ fontSize: '0.85rem', lineHeight: '1.5', color: 'var(--text-secondary)', marginTop: 12, marginBottom: 8 }}>
                                    所有账户类型均支持多联系人，至少添加1个联系人。选择“主要”联系人以便作为系统默认对接人。对于代理商，建议将其技术总监或售后主管设为主要联系人。
                                </p>
                            </div>
                        )}
                    </div>

                    {/* Actions */}
                    <div style={{ display: 'flex', gap: 12, flexShrink: 0 }}>
                        <button
                            type="submit"
                            className="btn-kine-lowkey"
                            style={{
                                flex: 1,
                                justifyContent: 'center',
                                opacity: saving ? 0.7 : 1,
                                cursor: saving ? 'not-allowed' : 'pointer'
                            }}
                            disabled={saving}
                        >
                            {saving ? (
                                <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                    <span style={{
                                        width: 14,
                                        height: 14,
                                        border: '2px solid rgba(255,255,255,0.3)',
                                        borderTopColor: 'var(--accent-blue)',
                                        borderRadius: '50%',
                                        animation: 'spin 1s linear infinite'
                                    }} />
                                    Saving...
                                </span>
                            ) : (t as any)('action.save', 'Save')}
                        </button>
                        <button
                            type="button"
                            className="btn-kine-lowkey"
                            onClick={onClose}
                            disabled={saving}
                            style={{ flex: 1, justifyContent: 'center', opacity: saving ? 0.7 : 1 }}
                        >
                            {(t as any)('action.cancel', 'Cancel')}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default CustomerFormModal;
