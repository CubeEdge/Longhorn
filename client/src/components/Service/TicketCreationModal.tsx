import React, { useState, useEffect } from 'react';
import { X, Save, Loader2, MessageSquare, ShieldCheck, Wrench, Upload, Trash2, Image as ImageIcon, Video, FileText, Sparkles } from 'lucide-react';
import axios from 'axios';
import { useTicketStore } from '../../store/useTicketStore';
import { useAuthStore } from '../../store/useAuthStore';
import { useLanguage } from '../../i18n/useLanguage';

const TicketCreationModal: React.FC = () => {
    const { isOpen, ticketType, drafts, closeModal, updateDraft, clearDraft } = useTicketStore();
    const { token } = useAuthStore();
    const { t } = useLanguage();

    const [loading, setLoading] = useState(false);
    const [products, setProducts] = useState<any[]>([]);
    const [, setDealers] = useState<any[]>([]);
    const [attachments, setAttachments] = useState<File[]>([]);

    // AI Assist State
    const [aiInput, setAiInput] = useState('');
    const [aiLoading, setAiLoading] = useState(false);

    const draft = drafts[ticketType];

    useEffect(() => {
        if (isOpen) {
            fetchInitialData();
        }
    }, [isOpen]);

    const fetchInitialData = async () => {
        try {
            const [prodRes, dealerRes] = await Promise.all([
                axios.get('/api/v1/system/products', { headers: { Authorization: `Bearer ${token}` } }),
                axios.get('/api/v1/system/dealers', { headers: { Authorization: `Bearer ${token}` } })
            ]);
            if (prodRes.data.success) setProducts(prodRes.data.data);
            if (dealerRes.data.success) setDealers(dealerRes.data.data);
        } catch (err) {
            console.error('Failed to fetch modal data:', err);
        }
    };

    const handleFieldChange = (field: string, value: any) => {
        updateDraft(ticketType, { [field]: value });
    };

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files) {
            const newFiles = Array.from(e.target.files);
            setAttachments(prev => [...prev, ...newFiles]);
        }
    };

    const removeAttachment = (index: number) => {
        setAttachments(prev => prev.filter((_, i) => i !== index));
    };

    const getFileIcon = (file: File) => {
        if (file.type.startsWith('image/')) return <ImageIcon size={16} style={{ color: '#60a5fa' }} />;
        if (file.type.startsWith('video/')) return <Video size={16} style={{ color: '#a78bfa' }} />;
        return <FileText size={16} style={{ color: 'var(--text-secondary)' }} />;
    };

    // AI Parsing Logic
    const handleAiParse = async () => {
        if (!aiInput.trim()) return;
        setAiLoading(true);

        try {
            const res = await axios.post('/api/ai/ticket_parse', {
                text: aiInput,
                strictness: 'High'
            }, {
                headers: { Authorization: `Bearer ${token}` }
            });

            if (res.data.success) {
                const result = res.data.data;
                const updates: any = {};

                if (result.customer_name) updates.customer_name = result.customer_name;
                if (result.contact_info) updates.customer_contact = result.contact_info;

                // Match Product
                if (result.product_model) {
                    const matchedProduct = products.find(p =>
                        p.name.toLowerCase().includes(result.product_model.toLowerCase()) ||
                        result.product_model.toLowerCase().includes(p.name.toLowerCase())
                    );
                    if (matchedProduct) {
                        updates.product_id = matchedProduct.id; // Map ID
                    }
                }

                // Problem Summary & Description
                let summary = result.issue_summary || '';
                if (result.urgency === 'High' && !summary.startsWith('[URGENT]')) {
                    summary = `[URGENT] ${summary}`;
                }

                if (ticketType === 'Inquiry') {
                    updates.problem_summary = summary;
                } else {
                    updates.problem_description = summary + '\n\n' + (result.communication_log || '');
                }

                // Apply updates
                Object.entries(updates).forEach(([key, val]) => {
                    handleFieldChange(key, val);
                });
            }
        } catch (err) {
            console.error('AI Parse Failed:', err);
            // Optional: Toast error here
        } finally {
            setAiLoading(false);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);

        try {
            const formData = new FormData();
            Object.keys(draft).forEach(key => {
                if (draft[key] !== undefined && draft[key] !== null) {
                    formData.append(key, draft[key]);
                }
            });

            attachments.forEach(file => {
                formData.append('attachments', file);
            });

            // P2: Use unified tickets API
            const typeMap: Record<string, string> = {
                'Inquiry': 'inquiry',
                'RMA': 'rma',
                'DealerRepair': 'svc'
            };
            formData.append('ticket_type', typeMap[ticketType]);
            const endpoint = '/api/v1/tickets';

            const res = await axios.post(endpoint, formData, {
                headers: {
                    Authorization: `Bearer ${token}`,
                    'Content-Type': 'multipart/form-data'
                }
            });

            if (res.data.success) {
                clearDraft(ticketType);
                setAttachments([]);
                setAiInput(''); // Clear AI Input
                closeModal();
                window.location.reload();
            }
        } catch (err: any) {
            console.error('Failed to create ticket:', err);
            alert(err.response?.data?.error?.message || t('common.error'));
        } finally {
            setLoading(false);
        }
    };

    if (!isOpen) return null;

    const renderTypeIcon = () => {
        switch (ticketType) {
            case 'Inquiry': return <MessageSquare style={{ color: '#3b82f6' }} size={24} />;
            case 'RMA': return <ShieldCheck style={{ color: '#f97316' }} size={24} />;
            case 'DealerRepair': return <Wrench style={{ color: '#10B981' }} size={24} />;
        }
    };

    const getHeaderStyle = (): React.CSSProperties => {
        const base: React.CSSProperties = {
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '24px 32px',
            borderBottom: '1px solid var(--glass-border)'
        };
        switch (ticketType) {
            case 'Inquiry': return { ...base, background: 'rgba(59, 130, 246, 0.05)', borderLeft: '3px solid rgba(59, 130, 246, 0.5)' };
            case 'RMA': return { ...base, background: 'rgba(249, 115, 22, 0.05)', borderLeft: '3px solid rgba(249, 115, 22, 0.5)' };
            case 'DealerRepair': return { ...base, background: 'rgba(16, 185, 129, 0.05)', borderLeft: '3px solid rgba(16, 185, 129, 0.5)' };
            default: return base;
        }
    };

    // 通用样式
    const inputStyle: React.CSSProperties = {
        width: '100%',
        height: '44px',
        background: 'var(--glass-shadow)',
        border: '1px solid var(--glass-border)',
        borderRadius: '10px',
        padding: '0 16px',
        color: 'var(--text-main)',
        fontSize: '14px',
        outline: 'none'
    };

    const labelStyle: React.CSSProperties = {
        fontSize: '13px',
        fontWeight: 500,
        color: 'var(--text-secondary)',
        marginBottom: '6px',
        display: 'block'
    };

    const sectionTitleStyle: React.CSSProperties = {
        fontSize: '11px',
        fontWeight: 600,
        color: 'var(--text-main)',
        textTransform: 'uppercase',
        letterSpacing: '1.5px',
        marginBottom: '16px'
    };

    return (
        <div style={{
            position: 'fixed',
            inset: 0,
            zIndex: 100,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'rgba(0,0,0,0.75)',
            backdropFilter: 'blur(8px)',
            padding: '24px'
        }}>
            <div style={{
                background: 'var(--bg-sidebar)',
                border: '1px solid var(--glass-border)',
                borderRadius: '16px',
                width: '100%',
                maxWidth: '800px',
                maxHeight: '85vh',
                display: 'flex',
                flexDirection: 'column',
                boxShadow: '0 25px 50px -12px var(--glass-shadow)',
                overflow: 'hidden',
                animation: 'modalIn 0.2s ease-out'
            }}>
                {/* Header */}
                <div style={getHeaderStyle()}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                        <div style={{
                            padding: '12px',
                            borderRadius: '12px',
                            background: 'var(--glass-shadow)',
                            border: '1px solid var(--glass-border)'
                        }}>
                            {renderTypeIcon()}
                        </div>
                        <div>
                            <h2 style={{ fontSize: '18px', fontWeight: 600, color: 'var(--text-main)', margin: 0 }}>
                                {ticketType === 'Inquiry' ? t('ticket.create.inquiry') :
                                    ticketType === 'RMA' ? t('ticket.create.rma') :
                                        t('ticket.create.dealerrepair')}
                            </h2>
                            <p style={{ fontSize: '13px', color: 'var(--text-secondary)', margin: '4px 0 0 0' }}>
                                Kinefinity Service Operation
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={closeModal}
                        style={{
                            padding: '8px',
                            background: 'transparent',
                            border: 'none',
                            borderRadius: '8px',
                            cursor: 'pointer',
                            color: 'var(--text-secondary)'
                        }}
                    >
                        <X size={20} />
                    </button>
                </div>

                {/* Form Body - Two Column Layout */}
                <div style={{ flex: 1, overflowY: 'auto', padding: '32px' }}>

                    {/* AI Smart Assist Panel - Visible Only for Inquiry or maybe all */}
                    {ticketType === 'Inquiry' && (
                        <div style={{
                            marginBottom: '32px',
                            background: 'rgba(255, 215, 0, 0.05)',
                            border: '1px solid rgba(255, 215, 0, 0.2)',
                            borderRadius: '12px',
                            padding: '20px'
                        }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                                <Sparkles size={16} color="#FFD700" />
                                <span style={{ fontSize: '0.9rem', fontWeight: 600, color: '#FFD700' }}>AI Smart Assist</span>
                            </div>
                            <div style={{ display: 'flex', gap: '12px' }}>
                                <textarea
                                    style={{
                                        ...inputStyle,
                                        height: '60px',
                                        background: 'var(--glass-shadow)',
                                        border: '1px solid rgba(255, 215, 0, 0.1)',
                                        padding: '10px 14px',
                                        resize: 'none',
                                        fontSize: '0.85rem'
                                    }}
                                    placeholder="Paste email, chat logs, or description here to auto-fill..."
                                    value={aiInput}
                                    onChange={(e) => setAiInput(e.target.value)}
                                />
                                <button
                                    type="button"
                                    onClick={handleAiParse}
                                    disabled={aiLoading || !aiInput.trim()}
                                    style={{
                                        minWidth: '100px',
                                        height: '60px',
                                        background: '#FFD700',
                                        color: '#000',
                                        border: 'none',
                                        borderRadius: '10px',
                                        fontWeight: 600,
                                        cursor: 'pointer',
                                        display: 'flex',
                                        flexDirection: 'column',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        gap: '4px',
                                        opacity: (aiLoading || !aiInput.trim()) ? 0.5 : 1
                                    }}
                                >
                                    {aiLoading ? (
                                        <Loader2 size={18} className="animate-spin" />
                                    ) : (
                                        <>
                                            <Sparkles size={18} />
                                            <span style={{ fontSize: '0.75rem' }}>Auto-Fill</span>
                                        </>
                                    )}
                                </button>
                            </div>
                        </div>
                    )}

                    <form id="ticket-form" onSubmit={handleSubmit}>
                        <div style={{
                            display: 'grid',
                            gridTemplateColumns: 'repeat(2, 1fr)',
                            gap: '32px'
                        }}>
                            {/* Left Column */}
                            <div>
                                {/* 客户信息 */}
                                <div style={{ marginBottom: '28px' }}>
                                    <div style={sectionTitleStyle}>客户信息</div>

                                    <div style={{ marginBottom: '16px' }}>
                                        <label style={labelStyle}>{t('field.customer_name')}</label>
                                        <input
                                            type="text"
                                            style={inputStyle}
                                            value={draft.customer_name || ''}
                                            onChange={(e) => handleFieldChange('customer_name', e.target.value)}
                                            placeholder="输入客户名称..."
                                        />
                                    </div>

                                    <div>
                                        <label style={labelStyle}>{t('field.customer_contact')}</label>
                                        <input
                                            type="text"
                                            style={inputStyle}
                                            value={draft.customer_contact || ''}
                                            onChange={(e) => handleFieldChange('customer_contact', e.target.value)}
                                            placeholder="邮箱或电话..."
                                        />
                                    </div>
                                </div>

                                <div style={{ height: '1px', background: 'var(--glass-bg-light)', marginBottom: '28px' }} />

                                {/* 产品信息 */}
                                <div>
                                    <div style={sectionTitleStyle}>产品信息</div>

                                    <div style={{ marginBottom: '16px' }}>
                                        <label style={labelStyle}>{t('field.product')}</label>
                                        <select
                                            style={{ ...inputStyle, appearance: 'none', cursor: 'pointer' }}
                                            value={draft.product_id || ''}
                                            onChange={(e) => handleFieldChange('product_id', e.target.value)}
                                        >
                                            <option value="">选择产品...</option>
                                            {products.map(p => (
                                                <option key={p.id} value={p.id}>{p.name}</option>
                                            ))}
                                        </select>
                                    </div>

                                    <div>
                                        <label style={labelStyle}>{t('field.serial_number')}</label>
                                        <input
                                            type="text"
                                            style={{ ...inputStyle, fontFamily: 'monospace' }}
                                            value={draft.serial_number || ''}
                                            onChange={(e) => handleFieldChange('serial_number', e.target.value)}
                                            placeholder="S/N..."
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* Right Column */}
                            <div>
                                {/* 问题详情 */}
                                <div style={{ marginBottom: '28px' }}>
                                    <div style={sectionTitleStyle}>问题详情</div>

                                    <div>
                                        <label style={labelStyle}>
                                            {ticketType === 'Inquiry' ? t('field.problem_summary') : t('field.problem_description')}
                                        </label>
                                        <textarea
                                            style={{
                                                ...inputStyle,
                                                height: 'auto',
                                                minHeight: '140px',
                                                padding: '12px 16px',
                                                resize: 'none'
                                            }}
                                            value={ticketType === 'Inquiry' ? (draft.problem_summary || '') : (draft.problem_description || '')}
                                            onChange={(e) => handleFieldChange(ticketType === 'Inquiry' ? 'problem_summary' : 'problem_description', e.target.value)}
                                            placeholder="请详细描述问题..."
                                        />
                                    </div>
                                </div>

                                <div style={{ height: '1px', background: 'var(--glass-bg-light)', marginBottom: '28px' }} />

                                {/* 附件 */}
                                <div>
                                    <div style={sectionTitleStyle}>附件</div>

                                    <label style={{
                                        display: 'flex',
                                        flexDirection: 'column',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        height: '100px',
                                        border: '2px dashed var(--glass-bg-hover)',
                                        borderRadius: '12px',
                                        cursor: 'pointer',
                                        transition: 'all 0.2s'
                                    }}>
                                        <Upload size={22} style={{ color: 'rgba(255,255,255,0.3)', marginBottom: '8px' }} />
                                        <span style={{ fontSize: '13px', color: 'var(--text-main)' }}>点击或拖拽文件到此处</span>
                                        <span style={{ fontSize: '11px', color: 'var(--glass-border)', marginTop: '4px' }}>图片、视频、PDF (最大 50MB)</span>
                                        <input
                                            type="file"
                                            multiple
                                            style={{ display: 'none' }}
                                            onChange={handleFileSelect}
                                            accept="image/*,video/*,.pdf"
                                        />
                                    </label>

                                    {attachments.length > 0 && (
                                        <div style={{ marginTop: '12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                            {attachments.map((file, index) => (
                                                <div
                                                    key={index}
                                                    style={{
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        justifyContent: 'space-between',
                                                        padding: '10px 12px',
                                                        background: 'rgba(0,0,0,0.2)',
                                                        border: '1px solid var(--glass-border)',
                                                        borderRadius: '8px'
                                                    }}
                                                >
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
                                                        {getFileIcon(file)}
                                                        <span style={{ fontSize: '13px', color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{file.name}</span>
                                                        <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.3)' }}>
                                                            {(file.size / 1024 / 1024).toFixed(1)}MB
                                                        </span>
                                                    </div>
                                                    <button
                                                        type="button"
                                                        onClick={() => removeAttachment(index)}
                                                        style={{
                                                            padding: '6px',
                                                            background: 'transparent',
                                                            border: 'none',
                                                            borderRadius: '6px',
                                                            cursor: 'pointer',
                                                            color: 'rgba(255,255,255,0.3)'
                                                        }}
                                                    >
                                                        <Trash2 size={14} />
                                                    </button>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </form>
                </div>

                {/* Footer */}
                <div style={{
                    padding: '20px 32px',
                    borderTop: '1px solid var(--glass-border)',
                    background: 'rgba(0,0,0,0.2)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between'
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', color: 'rgba(255,255,255,0.3)' }}>
                        <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#10B981' }} />
                        草稿已自动保存
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <button
                            type="button"
                            onClick={closeModal}
                            style={{
                                padding: '0 24px',
                                height: '42px',
                                borderRadius: '10px',
                                border: '1px solid var(--glass-border)',
                                background: 'transparent',
                                color: 'var(--text-secondary)',
                                fontWeight: 500,
                                cursor: 'pointer'
                            }}
                        >
                            {t('action.cancel')}
                        </button>
                        <button
                            type="submit"
                            form="ticket-form"
                            disabled={loading}
                            style={{
                                padding: '0 32px',
                                height: '42px',
                                borderRadius: '10px',
                                border: 'none',
                                background: '#FFD200',
                                color: 'black',
                                fontWeight: 600,
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '8px',
                                opacity: loading ? 0.5 : 1
                            }}
                        >
                            {loading ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
                            {t('action.create')}
                        </button>
                    </div>
                </div>
            </div>

            <style>{`
                @keyframes modalIn {
                    from {
                        opacity: 0;
                        transform: scale(0.95) translateY(10px);
                    }
                    to {
                        opacity: 1;
                        transform: scale(1) translateY(0);
                    }
                }
            `}</style>
        </div>
    );
};

export default TicketCreationModal;
