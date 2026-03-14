import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
    X, Save, Loader2, MessageSquare, ShieldCheck, Wrench, Upload,
    Image as ImageIcon, FileText, Sparkles, Search, User,
    ChevronDown, Plus, AlertTriangle
} from 'lucide-react';
import axios from 'axios';
import { useTicketStore, type TicketType } from '../../store/useTicketStore';
import { useAuthStore } from '../../store/useAuthStore';
import { useLanguage } from '../../i18n/useLanguage';
import { useNavigate } from 'react-router-dom';
import { ProductWarrantyRegistrationModal } from './ProductWarrantyRegistrationModal';
import ProductModal from '../Workspace/ProductModal';

// ---- Internal Components ----

/**
 * CRM Search Component for Accounts/Contacts
 */
const CRMLookup: React.FC<{
    onSelect: (account: any, contact?: any) => void;
    currentAccountId?: number;
    currentContactId?: number;
}> = ({ onSelect, currentAccountId, currentContactId }) => {
    const { token } = useAuthStore();
    const { t } = useLanguage();
    const [query, setQuery] = useState('');
    const [results, setResults] = useState<any[]>([]);
    const [searching, setSearching] = useState(false);
    const [showResults, setShowResults] = useState(false);
    const [selectedAccount, setSelectedAccount] = useState<any>(null);
    const [selectedContact, setSelectedContact] = useState<any>(null);
    const containerRef = useRef<HTMLDivElement>(null);

    const handleSearch = useCallback(async (q: string) => {
        if (!q.trim()) {
            setResults([]);
            return;
        }
        setSearching(true);
        try {
            const res = await axios.get(`/api/v1/accounts?search=${encodeURIComponent(q)}&page_size=10`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            if (res.data.success) {
                setResults(res.data.data);
            }
        } catch (err) {
            console.error('CRM search failed:', err);
        } finally {
            setSearching(false);
        }
    }, [token]);

    useEffect(() => {
        const timer = setTimeout(() => {
            if (query) handleSearch(query);
        }, 300);
        return () => clearTimeout(timer);
    }, [query, handleSearch]);

    // Handle initial state if IDs are provided
    useEffect(() => {
        if (currentAccountId && !selectedAccount) {
            // Fetch account details
            axios.get(`/api/v1/accounts/${currentAccountId}`, {
                headers: { Authorization: `Bearer ${token}` }
            }).then(res => {
                if (res.data.success) setSelectedAccount(res.data.data);
            }).catch(() => { });
        }
        if (currentContactId && !selectedContact) {
            axios.get(`/api/v1/contacts/${currentContactId}`, {
                headers: { Authorization: `Bearer ${token}` }
            }).then(res => {
                if (res.data.success) setSelectedContact(res.data.data);
            }).catch(() => { });
        }
    }, [currentAccountId, currentContactId, token]);

    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
                setShowResults(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    return (
        <div ref={containerRef} style={{ position: 'relative', width: '100%' }}>
            {!selectedAccount ? (
                <div style={{ position: 'relative' }}>
                    <Search
                        size={16}
                        style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'rgba(255,255,255,0.4)' }}
                    />
                    <input
                        type="text"
                        placeholder={t('account.searchPlaceholder') || 'Search Customer Account/Company...'}
                        value={query}
                        onChange={(e) => {
                            setQuery(e.target.value);
                            setShowResults(true);
                        }}
                        onFocus={() => setShowResults(true)}
                        style={{
                            width: '100%', height: '52px', background: 'rgba(0,0,0,0.3)',
                            border: '1px solid rgba(255,255,255,0.1)', borderRadius: '14px',
                            padding: '0 12px 0 42px', color: '#fff', fontSize: '16px', outline: 'none'
                        }}
                    />
                    {searching && (
                        <Loader2
                            size={16}
                            className="animate-spin"
                            style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--accent-blue)' }}
                        />
                    )}

                    {showResults && results.length > 0 && (
                        <div style={{
                            position: 'absolute', top: '100%', left: 0, right: 0, marginTop: 4,
                            background: '#1c1c1e', border: '1px solid rgba(255,255,255,0.1)',
                            borderRadius: 12, boxShadow: '0 10px 30px rgba(0,0,0,0.5)', zIndex: 10000,
                            maxHeight: 300, overflowY: 'auto', padding: '6px'
                        }}>
                            {results.map(account => (
                                <div
                                    key={account.id}
                                    onClick={() => {
                                        setSelectedAccount(account);
                                        setShowResults(false);
                                        onSelect(account);
                                    }}
                                    style={{
                                        padding: '10px 12px', borderRadius: 8, cursor: 'pointer',
                                        display: 'flex', flexDirection: 'column', gap: 2,
                                        transition: 'background 0.2s'
                                    }}
                                    onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.05)'}
                                    onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                                >
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                        <span style={{ fontWeight: 600, color: '#fff', fontSize: '14px' }}>{account.name}</span>
                                        <span style={{
                                            fontSize: 10, padding: '1px 6px', borderRadius: 4,
                                            background: account.account_type === 'DEALER' ? 'rgba(168,85,247,0.2)' : 'rgba(59,130,246,0.2)',
                                            color: account.account_type === 'DEALER' ? '#a855f7' : '#3b82f6',
                                            border: `1px solid ${account.account_type === 'DEALER' ? 'rgba(168,85,247,0.3)' : 'rgba(59,130,246,0.3)'}`
                                        }}>
                                            {account.account_type}
                                        </span>
                                    </div>
                                    <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', display: 'flex', gap: 8 }}>
                                        <span>#{account.account_number}</span>
                                        {account.city && <span>📍 {account.city}</span>}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            ) : (
                <div style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '8px 12px', background: 'rgba(59,130,246,0.1)', border: '1px solid rgba(59,130,246,0.3)',
                    borderRadius: 10, width: '100%'
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{
                            width: 32, height: 32, borderRadius: 8, background: 'rgba(59,130,246,0.2)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#3b82f6'
                        }}>
                            <User size={18} />
                        </div>
                        <div>
                            <div style={{ fontWeight: 600, color: '#fff', fontSize: '14px' }}>{selectedAccount.name}</div>
                            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.6)' }}>
                                {selectedAccount.account_number} · {selectedAccount.account_type}
                            </div>
                        </div>
                    </div>
                    <button
                        onClick={() => {
                            setSelectedAccount(null);
                            setSelectedContact(null);
                            onSelect(null);
                        }}
                        style={{ background: 'transparent', border: 'none', color: 'rgba(255,255,255,0.3)', cursor: 'pointer' }}
                    >
                        <X size={16} />
                    </button>
                </div>
            )}
        </div>
    );
};

// ---- Main Modal Component ----

const TicketCreationModal: React.FC = () => {
    const { isOpen, ticketType: initialType, drafts, closeModal, updateDraft, clearDraft, openModal } = useTicketStore();
    const { token } = useAuthStore();
    const { t } = useLanguage();
    const navigate = useNavigate();

    const [loading, setLoading] = useState(false);
    const [products, setProducts] = useState<any[]>([]);
    const [attachments, setAttachments] = useState<File[]>([]);
    const [ghostFields, setGhostFields] = useState<Set<string>>(new Set());
    const [snLoading, setSnLoading] = useState(false);
    const [machineInfo, setMachineInfo] = useState<any>(null);

    // Warranty check state (for RMA tickets)
    const [warrantyCheckStatus, setWarrantyCheckStatus] = useState<'unchecked' | 'valid' | 'needs_registration'>('unchecked');
    const [showWarrantyModal, setShowWarrantyModal] = useState(false);
    const [showProductModal, setShowProductModal] = useState(false);
    const [, setCheckingWarranty] = useState(false);

    // AI Assist State
    const [aiInput, setAiInput] = useState('');
    const [aiLoading, setAiLoading] = useState(false);
    const [aiLog, setAiLog] = useState<string[]>([]);

    const draft = drafts[initialType];

    // Fetch initial data
    useEffect(() => {
        if (isOpen) {
            const fetchInitialData = async () => {
                try {
                    const prodRes = await axios.get('/api/v1/system/products', { headers: { Authorization: `Bearer ${token}` } });
                    if (prodRes.data.success) setProducts(prodRes.data.data);
                } catch (err) {
                    console.error('Failed to fetch modal data:', err);
                }
            };
            fetchInitialData();
        }
    }, [isOpen, token]);

    const handleFieldChange = (field: string, value: any, isAi = false) => {
        updateDraft(initialType, { [field]: value });
        if (isAi) {
            setGhostFields(prev => new Set(prev).add(field));
        } else {
            setGhostFields(prev => {
                const next = new Set(prev);
                next.delete(field);
                return next;
            });
        }
    };

    // S/N Validation Logic
    useEffect(() => {
        const validateSN = async () => {
            if (!draft.serial_number || draft.serial_number.length < 5) {
                setMachineInfo(null);
                setWarrantyCheckStatus('unchecked');
                return;
            }
            setSnLoading(true);
            try {
                const res = await axios.get(`/api/v1/context/by-serial-number?serial_number=${encodeURIComponent(draft.serial_number)}`, {
                    headers: { Authorization: `Bearer ${token}` }
                });
                if (res.data.success) {
                    const device = res.data.data.device;
                    setMachineInfo(device);
                    
                    // 根据 SN 查询结果设置 product_id
                    if (device.product_id && !device.is_unregistered) {
                        // SN 在台账中：使用设备的 product_id（产品型号ID）
                        handleFieldChange('product_id', device.product_id, true);
                    }
                    // 注意：SN 不在台账时，保留用户已选的产品型号，不清空
                } else {
                    setMachineInfo(null);
                    // 查询失败不清空 product_id，保留用户已选的型号
                }
            } catch (err) {
                setMachineInfo(null);
            } finally {
                setSnLoading(false);
            }
        };

        const timer = setTimeout(validateSN, 1000);
        return () => clearTimeout(timer);
    }, [draft.serial_number, token, products]);

    // Warranty Check Logic (for RMA tickets only)
    useEffect(() => {
        const checkWarranty = async () => {
            // Only check warranty for RMA tickets
            if (initialType !== 'RMA' || !draft.serial_number || draft.serial_number.length < 5) {
                setWarrantyCheckStatus('unchecked');
                return;
            }

            setCheckingWarranty(true);
            try {
                const res = await axios.get(`/api/v1/products/check-warranty?serial_number=${encodeURIComponent(draft.serial_number)}`, {
                    headers: { Authorization: `Bearer ${token}` }
                });

                if (res.data.success) {
                    const { has_warranty_basis, needs_registration } = res.data.data;
                    setWarrantyCheckStatus(has_warranty_basis ? 'valid' : 'needs_registration');

                    // Show registration modal if needed
                    if (needs_registration) {
                        setShowWarrantyModal(true);
                    }
                }
            } catch (err) {
                console.error('Failed to check warranty:', err);
            } finally {
                setCheckingWarranty(false);
            }
        };

        const timer = setTimeout(checkWarranty, 500);
        return () => clearTimeout(timer);
    }, [draft.serial_number, token, initialType]);

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files) {
            const newFiles = Array.from(e.target.files);
            setAttachments(prev => [...prev, ...newFiles]);
        }
    };

    const removeAttachment = (index: number) => {
        setAttachments(prev => prev.filter((_, i) => i !== index));
    };

    const handleAiParse = async () => {
        if (!aiInput.trim()) return;
        setAiLoading(true);
        setAiLog(['🤖 Analyzing your input...', '🔍 Extracting key information...']);

        try {
            const res = await axios.post('/api/ai/ticket_parse', {
                text: aiInput,
                strictness: 'High'
            }, {
                headers: { Authorization: `Bearer ${token}` }
            });

            if (res.data.success) {
                const result = res.data.data;
                const newLogs = [...aiLog];
                newLogs.push('✅ Extraction complete.');

                const updates: any = {};
                const fieldsToMarkGhost: string[] = [];

                if (result.customer_name) {
                    updates.customer_name = result.customer_name;
                    fieldsToMarkGhost.push('customer_name');
                }
                if (result.contact_info) {
                    updates.customer_contact = result.contact_info;
                    fieldsToMarkGhost.push('customer_contact');
                }

                // Match Product
                if (result.product_model) {
                    const matchedProduct = products.find(p =>
                        p.name.toLowerCase().includes(result.product_model.toLowerCase()) ||
                        result.product_model.toLowerCase().includes(p.name.toLowerCase())
                    );
                    if (matchedProduct) {
                        updates.product_id = matchedProduct.id;
                        fieldsToMarkGhost.push('product_id');
                        newLogs.push(`📦 Matched product: ${matchedProduct.name}`);
                    }
                }

                if (result.serial_number) {
                    updates.serial_number = result.serial_number;
                    fieldsToMarkGhost.push('serial_number');
                    newLogs.push(`🔢 Found S/N: ${result.serial_number}`);
                }

                // Problem Summary & Description
                let summary = result.issue_summary || '';
                if (result.urgency === 'High' && !summary.startsWith('[URGENT]')) {
                    summary = `[URGENT] ${summary}`;
                }

                if (initialType === 'Inquiry') {
                    updates.problem_summary = summary;
                    fieldsToMarkGhost.push('problem_summary');
                } else {
                    updates.problem_description = summary + '\n\n' + (result.communication_log || '');
                    fieldsToMarkGhost.push('problem_description');
                }

                // Apply updates
                updateDraft(initialType, updates);
                const nextGhost = new Set(ghostFields);
                fieldsToMarkGhost.forEach(f => nextGhost.add(f));
                setGhostFields(nextGhost);
                setAiLog(newLogs);
            }
        } catch (err) {
            console.error('AI Parse Failed:', err);
            setAiLog(prev => [...prev, '❌ AI analysis failed. Please fill manually.']);
        } finally {
            setAiLoading(false);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);

        try {
            const formData = new FormData();

            // Build reporter_snapshot if account_id is not set but customer info exists
            // This follows PRD §5.7 - Dual Identity Model
            let reporterSnapshot = null;
            if (!draft.account_id && (draft.customer_name || draft.customer_contact)) {
                reporterSnapshot = {
                    name: draft.customer_name || '',
                    contact: draft.customer_contact || '',
                    type: 'individual',
                    source: 'manual_entry',
                    created_at: new Date().toISOString()
                };
            }

            // Append all draft fields
            Object.keys(draft).forEach(key => {
                if (draft[key] !== undefined && draft[key] !== null) {
                    formData.append(key, draft[key]);
                }
            });

            // Append reporter_snapshot as JSON string if exists
            if (reporterSnapshot) {
                formData.append('reporter_snapshot', JSON.stringify(reporterSnapshot));
            }

            attachments.forEach(file => {
                formData.append('attachments', file);
            });

            const typeMap: Record<string, string> = {
                'Inquiry': 'inquiry',
                'RMA': 'rma',
                'DealerRepair': 'svc'
            };
            formData.append('ticket_type', typeMap[initialType]);

            const res = await axios.post('/api/v1/tickets', formData, {
                headers: {
                    Authorization: `Bearer ${token}`,
                    'Content-Type': 'multipart/form-data'
                }
            });

            if (res.data.success) {
                clearDraft(initialType);
                setAttachments([]);
                setAiInput('');
                closeModal();
                navigate(`/service/tickets/${res.data.data.id}`);
            }
        } catch (err: any) {
            console.error('Failed to create ticket:', err);
            alert(err.response?.data?.error?.message || t('common.error'));
        } finally {
            setLoading(false);
        }
    };

    if (!isOpen) return null;

    const typeOptions: { key: TicketType, icon: any, label: string, color: string }[] = [
        { key: 'Inquiry', icon: MessageSquare, label: t('ticket.type.inquiry') || 'Inquiry', color: '#3b82f6' },
        { key: 'RMA', icon: ShieldCheck, label: t('ticket.type.rma') || 'RMA', color: '#FFD700' },
        { key: 'DealerRepair', icon: Wrench, label: t('ticket.type.svc') || 'SVC', color: '#10B981' }
    ];

    const currentTypeOption = typeOptions.find(o => o.key === initialType)!;

    // --- Styling Vars ---
    const ghostStyle = (field: string): React.CSSProperties => ({
        border: ghostFields.has(field) ? '1px solid rgba(59, 130, 246, 0.6)' : '1px solid rgba(255,255,255,0.1)',
        boxShadow: ghostFields.has(field) ? '0 0 10px rgba(59, 130, 246, 0.2)' : 'none',
        background: ghostFields.has(field) ? 'rgba(59, 130, 246, 0.05)' : 'rgba(0,0,0,0.3)',
        transition: 'all 0.3s'
    });

    return (
        <div style={{
            position: 'fixed', inset: 0, zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(10px)', padding: '20px'
        }}>
            <div style={{
                background: '#16161a', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '24px',
                width: '100%', maxWidth: '1200px', height: '90vh', display: 'flex', flexDirection: 'column',
                boxShadow: '0 40px 100px rgba(0,0,0,0.8)', overflow: 'hidden', animation: 'modalScaleIn 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)'
            }}>
                {/* 顶部: 类型选择 & 关闭 */}
                <div style={{
                    padding: '20px 32px', borderBottom: '1px solid rgba(255,255,255,0.06)',
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    background: 'rgba(255,255,255,0.02)'
                }}>
                    <div style={{ display: 'flex', gap: 16 }}>
                        {typeOptions.map(opt => (
                            <button
                                key={opt.key}
                                onClick={() => {
                                    // PRD §4.3: Carry over core fields when switching type
                                    const currentDraft = drafts[initialType];
                                    const sharedFields = ['customer_name', 'customer_contact', 'account_id', 'contact_id', 'product_id', 'serial_number', 'problem_summary', 'problem_description'];
                                    const updates: any = {};
                                    sharedFields.forEach(f => {
                                        if (currentDraft[f] !== undefined) updates[f] = currentDraft[f];
                                    });
                                    updateDraft(opt.key, updates);
                                    openModal(opt.key);
                                }}
                                style={{
                                    padding: '12px 28px', borderRadius: 16, border: 'none',
                                    background: initialType === opt.key ? opt.color : 'rgba(255,255,255,0.04)',
                                    color: initialType === opt.key ? '#000' : 'rgba(255,255,255,0.5)',
                                    fontWeight: 700, fontSize: '15px', display: 'flex', alignItems: 'center', gap: 10,
                                    cursor: 'pointer', transition: 'all 0.3s'
                                }}
                            >
                                <opt.icon size={20} />
                                {opt.label}
                            </button>
                        ))}
                    </div>
                    <button
                        onClick={closeModal}
                        style={{ background: 'transparent', border: 'none', color: '#666', cursor: 'pointer', padding: 8 }}
                    >
                        <X size={24} />
                    </button>
                </div>

                <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '400px 1fr', overflow: 'hidden' }}>

                    {/* LEFT: AI Sandbox (智能沙盒) */}
                    <div style={{
                        background: 'rgba(255,255,255,0.02)', borderRight: '1px solid rgba(255,255,255,0.06)',
                        padding: 32, display: 'flex', flexDirection: 'column', gap: 24, overflowY: 'auto'
                    }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                            <Sparkles size={20} color="#FFD700" />
                            <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600, color: '#FFD700' }}>{t('ticket.creation.ai_sandbox') || 'AI Sandbox'}</h3>
                        </div>

                        <div
                            style={{
                                position: 'relative',
                                border: '2px dashed rgba(255,215,0,0.2)',
                                borderRadius: 20,
                                padding: 4,
                                background: 'rgba(0,0,0,0.2)'
                            }}
                            onDragOver={(e) => {
                                e.preventDefault();
                                e.currentTarget.style.borderColor = '#FFD700';
                            }}
                            onDragLeave={(e) => {
                                e.preventDefault();
                                e.currentTarget.style.borderColor = 'rgba(255,215,0,0.2)';
                            }}
                            onDrop={(e) => {
                                e.preventDefault();
                                e.currentTarget.style.borderColor = 'rgba(255,215,0,0.2)';
                                if (e.dataTransfer.files) {
                                    setAttachments(prev => [...prev, ...Array.from(e.dataTransfer.files)]);
                                }
                            }}
                        >
                            <textarea
                                value={aiInput}
                                onChange={(e) => setAiInput(e.target.value)}
                                placeholder={t('ticket.creation.ai_paste_hint') || 'Paste raw message, log, or drag images here...'}
                                style={{
                                    width: '100%', height: 320, background: 'transparent',
                                    border: 'none', borderRadius: 20,
                                    padding: 24, color: '#fff', fontSize: 16, outline: 'none', resize: 'none',
                                    lineHeight: 1.6
                                }}
                            />

                            {/* Drag & Drop Overlay Hint */}
                            {!aiInput && !aiLoading && (
                                <div style={{
                                    position: 'absolute', inset: 0, pointerEvents: 'none',
                                    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                                    gap: 16, color: 'rgba(255,215,0,0.2)'
                                }}>
                                    <div style={{ padding: 20, borderRadius: '50%', background: 'rgba(255,215,0,0.05)', border: '2px dashed rgba(255,215,0,0.2)' }}>
                                        <Upload size={48} />
                                    </div>
                                    <div style={{ fontSize: 16, fontWeight: 600 }}>{t('ticket.creation.drop_images') || '拖入图片以解析'}</div>
                                </div>
                            )}

                            <div style={{
                                position: 'absolute', bottom: 16, left: 24,
                                display: 'flex', alignItems: 'center', gap: 8,
                                color: 'rgba(255,255,255,0.3)', fontSize: 13
                            }}>
                                <ImageIcon size={16} />
                                {t('ticket.creation.images_supported') || '支持图片解析'}
                            </div>
                            <button
                                onClick={handleAiParse}
                                disabled={aiLoading || !aiInput.trim()}
                                style={{
                                    position: 'absolute', bottom: 16, right: 16,
                                    padding: '12px 24px', borderRadius: 14, border: 'none',
                                    background: '#FFD700', color: '#000', fontWeight: 800, fontSize: 14,
                                    display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer',
                                    opacity: (aiLoading || !aiInput.trim()) ? 0.5 : 1,
                                    boxShadow: '0 8px 24px rgba(255, 215, 0, 0.3)',
                                    transition: 'all 0.2s'
                                }}
                            >
                                {aiLoading ? <Loader2 size={18} className="animate-spin" /> : <Sparkles size={18} />}
                                {t('action.autofill') || '智能填充'}
                            </button>
                        </div>

                        {/* AI Log Output */}
                        {aiLog.length > 0 && (
                            <div style={{
                                background: 'rgba(0,0,0,0.3)', borderRadius: 12, padding: 16,
                                border: '1px solid rgba(255,255,255,0.05)', fontSize: 12,
                                fontFamily: 'monospace', color: 'rgba(255,255,255,0.5)', display: 'flex',
                                flexDirection: 'column', gap: 8
                            }}>
                                {aiLog.map((log, i) => <div key={i}>{log}</div>)}
                            </div>
                        )}

                        <div style={{ marginTop: 'auto' }}>
                            <div style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.2)', textTransform: 'uppercase', marginBottom: 12, letterSpacing: 1 }}>
                                {t('ticket.creation.multimodal') || 'Multi-modal input'}
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                                <div style={{ padding: 12, background: 'rgba(255,255,255,0.03)', borderRadius: 12, border: '1px solid rgba(255,255,255,0.05)', textAlign: 'center' }}>
                                    <ImageIcon size={18} style={{ color: '#FFD700', marginBottom: 4 }} />
                                    <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.5)' }}>{t('ticket.creation.screen_ocr') || 'Screen OCR'}</div>
                                </div>
                                <div style={{ padding: 12, background: 'rgba(255,255,255,0.03)', borderRadius: 12, border: '1px solid rgba(255,255,255,0.05)', textAlign: 'center' }}>
                                    <FileText size={18} style={{ color: 'rgba(255,255,255,0.5)', marginBottom: 4 }} />
                                    <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.5)' }}>{t('ticket.creation.pdf_parse') || 'PDF Parse'}</div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* RIGHT: Formal Blueprint (结构化蓝图) */}
                    <div style={{ padding: '40px 60px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 32 }}>

                        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                            <div style={{
                                padding: 14, borderRadius: 16, background: `${currentTypeOption.color}20`,
                                border: `2px solid ${currentTypeOption.color}40`, color: currentTypeOption.color
                            }}>
                                <currentTypeOption.icon size={32} />
                            </div>
                            <div>
                                <h2 style={{ margin: 0, fontSize: 32, fontWeight: 800, color: '#fff', letterSpacing: '-0.03em' }}>{t('ticket.type.' + initialType.toLowerCase()) || currentTypeOption.label} {t('ticket.creation.draft') || '草稿'}</h2>
                                <p style={{ margin: 0, fontSize: 15, color: 'rgba(255,255,255,0.4)', marginTop: 4 }}>{t('ticket.creation.validated_structure') || '已通过系统结构化验证。'}</p>
                            </div>
                        </div>

                        <form id="opt-ticket-form" onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 32 }}>

                            {/* CRM Context Section */}
                            <section>
                                <div style={{ fontSize: 12, fontWeight: 800, color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', marginBottom: 20, borderBottom: '1px solid rgba(255,255,255,0.06)', paddingBottom: 10, letterSpacing: 1.5 }}>
                                    {t('ticket.creation.customer_crm') || '客户关系 (CRM)'}
                                </div>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 32 }}>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                                        <label style={{ fontSize: 15, fontWeight: 700, color: 'rgba(255,255,255,0.6)' }}>{t('ticket.creation.search_account') || '搜索企业 / 公司'}</label>
                                        <CRMLookup
                                            onSelect={async (acc) => {
                                                if (acc) {
                                                    handleFieldChange('account_id', acc.id);
                                                    if (acc.email) handleFieldChange('customer_contact', acc.email, true);
                                                    
                                                    // 加载该账户的联系人，查找主联系人
                                                    try {
                                                        const contactsRes = await axios.get(`/api/v1/accounts/${acc.id}/contacts`, {
                                                            headers: { Authorization: `Bearer ${token}` }
                                                        });
                                                        if (contactsRes.data?.success && contactsRes.data.data?.length > 0) {
                                                            // 查找主联系人
                                                            const primaryContact = contactsRes.data.data.find(
                                                                (c: any) => c.status === 'PRIMARY' || c.is_primary
                                                            );
                                                            if (primaryContact) {
                                                                handleFieldChange('customer_name', primaryContact.name);
                                                                if (primaryContact.email) handleFieldChange('customer_contact', primaryContact.email, true);
                                                            } else {
                                                                // 没有主联系人时使用第一个联系人或账户的primary_contact_name
                                                                const firstContact = contactsRes.data.data[0];
                                                                handleFieldChange('customer_name', firstContact?.name || acc.primary_contact_name || acc.name);
                                                            }
                                                        } else {
                                                            // 没有联系人时使用账户的primary_contact_name或账户名称
                                                            handleFieldChange('customer_name', acc.primary_contact_name || acc.name);
                                                        }
                                                    } catch (err) {
                                                        console.error('Failed to load contacts:', err);
                                                        handleFieldChange('customer_name', acc.primary_contact_name || acc.name);
                                                    }
                                                } else {
                                                    handleFieldChange('account_id', null);
                                                }
                                            }}
                                            currentAccountId={draft.account_id}
                                        />
                                    </div>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                                        <label style={{ fontSize: 15, fontWeight: 700, color: 'rgba(255,255,255,0.6)' }}>{t('ticket.creation.contact_name') || '联系人 / 客户姓名'}</label>
                                        <div style={{ position: 'relative' }}>
                                            <input
                                                type="text"
                                                value={draft.customer_name || ''}
                                                onChange={(e) => handleFieldChange('customer_name', e.target.value)}
                                                placeholder={t('ticket.creation.contact_name_placeholder') || 'XXXJacky'}
                                                style={{
                                                    width: '100%', height: 52, borderRadius: 14, padding: '0 20px',
                                                    color: '#fff', fontSize: 16, outline: 'none',
                                                    ...ghostStyle('customer_name')
                                                }}
                                            />
                                            {ghostFields.has('customer_name') && <div style={{ position: 'absolute', right: 12, top: -10, background: '#3b82f6', color: '#fff', fontSize: 10, padding: '2px 8px', borderRadius: 6, fontWeight: 800 }}>AI FILLED</div>}
                                        </div>
                                    </div>
                                </div>
                                <div style={{ marginTop: 24 }}>
                                    <label style={{ fontSize: 15, fontWeight: 700, color: 'rgba(255,255,255,0.6)', display: 'block', marginBottom: 12 }}>{t('ticket.creation.contact_info') || '联系方式 (邮箱 / 电话)'}</label>
                                    <div style={{ position: 'relative' }}>
                                        <input
                                            type="text"
                                            value={draft.customer_contact || ''}
                                            onChange={(e) => handleFieldChange('customer_contact', e.target.value)}
                                            placeholder={t('ticket.creation.contact_info_placeholder') || 'example@email.com or +86...'}
                                            style={{
                                                width: '100%', height: 52, borderRadius: 14, padding: '0 20px',
                                                color: '#fff', fontSize: 16, outline: 'none',
                                                ...ghostStyle('customer_contact')
                                            }}
                                        />
                                        {ghostFields.has('customer_contact') && <div style={{ position: 'absolute', right: 12, top: -10, background: '#3b82f6', color: '#fff', fontSize: 10, padding: '2px 8px', borderRadius: 6, fontWeight: 800 }}>AI FILLED</div>}
                                    </div>
                                </div>
                            </section>

                            {/* Product Section */}
                            <section>
                                <div style={{ fontSize: 12, fontWeight: 800, color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', marginBottom: 20, borderBottom: '1px solid rgba(255,255,255,0.06)', paddingBottom: 10, letterSpacing: 1.5 }}>
                                    {t('ticket.creation.hardware_context') || '硬件信息'}
                                </div>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 32 }}>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                                        <label style={{ fontSize: 15, fontWeight: 700, color: 'rgba(255,255,255,0.6)' }}>{t('ticket.creation.product_model') || '产品型号'}</label>
                                        <div style={{ position: 'relative' }}>
                                            <select
                                                value={draft.product_id || ''}
                                                onChange={(e) => handleFieldChange('product_id', parseInt(e.target.value))}
                                                style={{
                                                    width: '100%', height: 52, borderRadius: 14, padding: '0 16px',
                                                    color: '#fff', fontSize: 16, outline: 'none', appearance: 'none',
                                                    ...ghostStyle('product_id')
                                                }}
                                            >
                                                <option value="">{t('ticket.creation.select_product') || 'Select Catalog Product...'}</option>
                                                {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                                            </select>
                                            <ChevronDown size={18} style={{ position: 'absolute', right: 16, top: '50%', transform: 'translateY(-50%)', color: 'rgba(255,255,255,0.3)', pointerEvents: 'none' }} />
                                            {ghostFields.has('product_id') && <div style={{ position: 'absolute', right: 36, top: -10, background: '#3b82f6', color: '#fff', fontSize: 10, padding: '2px 8px', borderRadius: 6, fontWeight: 800 }}>AI MATCHED</div>}
                                        </div>
                                    </div>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                                        <label style={{ fontSize: 15, fontWeight: 700, color: 'rgba(255,255,255,0.6)' }}>{t('ticket.creation.serial_number') || '序列号 (S/N)'}</label>
                                        <div style={{ position: 'relative' }}>
                                            <input
                                                type="text"
                                                value={draft.serial_number || ''}
                                                onChange={(e) => handleFieldChange('serial_number', e.target.value)}
                                                placeholder={t('ticket.creation.sn_placeholder') || 'Enter Device S/N...'}
                                                style={{
                                                    width: '100%', height: 52, borderRadius: 14, padding: '0 20px',
                                                    color: '#fff', fontSize: 16, outline: 'none', fontFamily: 'monospace',
                                                    ...ghostStyle('serial_number')
                                                }}
                                            />
                                            {snLoading && <Loader2 size={18} className="animate-spin" style={{ position: 'absolute', right: 16, top: '50%', transform: 'translateY(-50%)', color: '#3b82f6' }} />}
                                            {ghostFields.has('serial_number') && <div style={{ position: 'absolute', right: 16, top: -10, background: '#3b82f6', color: '#fff', fontSize: 10, padding: '2px 8px', borderRadius: 6, fontWeight: 800 }}>AUTO DETECTED</div>}
                                        </div>
                                    </div>
                                </div>

                                {/* Machine Detail Card - 简化版：未入库(红)/需注册保修(黄)/过保(橙)/有效(绿) */}
                                {machineInfo && (() => {
                                    const isUnregistered = machineInfo.is_unregistered;
                                    const needsWarrantyReg = !isUnregistered && warrantyCheckStatus === 'needs_registration';
                                    
                                    // 计算实际保修状态
                                    let isWarrantyExpired = false;
                                    if (!isUnregistered && !needsWarrantyReg && machineInfo.warranty_start_date) {
                                        const startDate = new Date(machineInfo.warranty_start_date);
                                        const warrantyMonths = machineInfo.warranty_months || 24;
                                        const endDate = new Date(startDate);
                                        endDate.setMonth(endDate.getMonth() + warrantyMonths);
                                        isWarrantyExpired = new Date() > endDate;
                                    }
                                    
                                    // 颜色映射：未入库(红) / 需注册(黄) / 过保(橙) / 有效(绿)
                                    const statusColor = isUnregistered ? '#E60000' 
                                        : (needsWarrantyReg ? '#FFD700' 
                                        : (isWarrantyExpired ? '#F97316' : '#10B981'));
                                    const bgColor = isUnregistered ? 'rgba(230, 0, 0, 0.05)' 
                                        : (needsWarrantyReg ? 'rgba(255, 215, 0, 0.05)' 
                                        : (isWarrantyExpired ? 'rgba(249, 115, 22, 0.05)' : 'rgba(16, 185, 129, 0.05)'));
                                    const borderColor = isUnregistered ? 'rgba(230, 0, 0, 0.3)' 
                                        : (needsWarrantyReg ? 'rgba(255, 215, 0, 0.3)' 
                                        : (isWarrantyExpired ? 'rgba(249, 115, 22, 0.3)' : 'rgba(16, 185, 129, 0.2)'));
                                    
                                    // 未入库时显示用户选择的型号，否则显示台账中的型号
                                    const displayModelName = isUnregistered 
                                        ? (products.find(p => p.id === draft.product_id)?.name || '待入库设备') 
                                        : (machineInfo.model_name || '未知型号');
                                    
                                    // 保修状态文字
                                    const warrantyStatusText = isWarrantyExpired ? '过保' : '在保';
                                    
                                    return (
                                        <div style={{
                                            marginTop: 20, padding: '16px 20px',
                                            background: bgColor,
                                            border: `1px solid ${borderColor}`,
                                            borderRadius: 12, display: 'flex', alignItems: 'center', gap: 14
                                        }}>
                                            <div style={{
                                                padding: 10, borderRadius: 10,
                                                background: `${statusColor}15`,
                                                color: statusColor,
                                                flexShrink: 0
                                            }}>
                                                {isUnregistered ? <AlertTriangle size={22} /> : <ShieldCheck size={22} />}
                                            </div>
                                            <div style={{ flex: 1, minWidth: 0 }}>
                                                <div style={{ fontWeight: 600, color: '#fff', fontSize: 15, marginBottom: 4 }}>
                                                    {displayModelName}
                                                </div>
                                                <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)' }}>
                                                    {isUnregistered 
                                                        ? '该序列号尚未录入产品台账' 
                                                        : (needsWarrantyReg 
                                                            ? '设备已入库，但未注册保修信息' 
                                                            : `配置: ${machineInfo.config || '标准版'} · 保修状态: ${warrantyStatusText}`)}
                                                </div>
                                            </div>
                                            {/* 右侧操作按钮 */}
                                            {isUnregistered && (
                                                <button
                                                    type="button"
                                                    onClick={() => setShowProductModal(true)}
                                                    style={{
                                                        padding: '8px 16px', borderRadius: 8,
                                                        background: 'rgba(230, 0, 0, 0.15)', border: '1px solid rgba(230, 0, 0, 0.4)',
                                                        color: '#E60000', fontSize: 13, fontWeight: 600,
                                                        cursor: 'pointer', flexShrink: 0,
                                                        transition: 'all 0.2s'
                                                    }}
                                                    onMouseEnter={e => e.currentTarget.style.background = 'rgba(230, 0, 0, 0.25)'}
                                                    onMouseLeave={e => e.currentTarget.style.background = 'rgba(230, 0, 0, 0.15)'}
                                                >
                                                    立即入库
                                                </button>
                                            )}
                                            {needsWarrantyReg && (
                                                <button
                                                    type="button"
                                                    onClick={() => setShowWarrantyModal(true)}
                                                    style={{
                                                        padding: '8px 16px', borderRadius: 8,
                                                        background: 'rgba(255, 215, 0, 0.15)', border: '1px solid rgba(255, 215, 0, 0.4)',
                                                        color: '#FFD700', fontSize: 13, fontWeight: 600,
                                                        cursor: 'pointer', flexShrink: 0,
                                                        transition: 'all 0.2s'
                                                    }}
                                                    onMouseEnter={e => e.currentTarget.style.background = 'rgba(255, 215, 0, 0.25)'}
                                                    onMouseLeave={e => e.currentTarget.style.background = 'rgba(255, 215, 0, 0.15)'}
                                                >
                                                    注册保修
                                                </button>
                                            )}
                                        </div>
                                    );
                                })()}
                            </section>

                            {/* Details Section */}
                            <section>
                                <div style={{ fontSize: 12, fontWeight: 800, color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', marginBottom: 20, borderBottom: '1px solid rgba(255,255,255,0.06)', paddingBottom: 10, letterSpacing: 1.5 }}>
                                    {t('ticket.creation.problem_spec') || '问题细则'}
                                </div>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                                    {initialType === 'Inquiry' ? (
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                                            <label style={{ fontSize: 15, fontWeight: 700, color: 'rgba(255,255,255,0.6)' }}>{t('ticket.creation.issue_summary') || '问题概述'}</label>
                                            <div style={{ position: 'relative' }}>
                                                <input
                                                    type="text"
                                                    value={draft.problem_summary || ''}
                                                    onChange={(e) => handleFieldChange('problem_summary', e.target.value)}
                                                    placeholder={t('ticket.creation.brief_input') || '请输入简短的问题描述...'}
                                                    style={{
                                                        width: '100%', height: 52, borderRadius: 14, padding: '0 20px',
                                                        color: '#fff', fontSize: 16, outline: 'none',
                                                        ...ghostStyle('problem_summary')
                                                    }}
                                                />
                                                {ghostFields.has('problem_summary') && <div style={{ position: 'absolute', right: 12, top: -10, background: '#3b82f6', color: '#fff', fontSize: 10, padding: '2px 8px', borderRadius: 6, fontWeight: 800 }}>AI GENERATED</div>}
                                            </div>
                                        </div>
                                    ) : (
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                                            <label style={{ fontSize: 15, fontWeight: 700, color: 'rgba(255,255,255,0.6)' }}>{t('ticket.creation.detailed_desc') || '详细描述'}</label>
                                            <div style={{ position: 'relative' }}>
                                                <textarea
                                                    value={draft.problem_description || ''}
                                                    onChange={(e) => handleFieldChange('problem_description', e.target.value)}
                                                    placeholder={t('ticket.creation.elaborate') || '请详细描述故障现象、操作过程等...'}
                                                    style={{
                                                        width: '100%', minHeight: 180, borderRadius: 16, padding: 20,
                                                        color: '#fff', fontSize: 16, outline: 'none', lineHeight: 1.6,
                                                        background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)',
                                                        resize: 'none',
                                                        ...ghostStyle('problem_description')
                                                    }}
                                                />
                                                {ghostFields.has('problem_description') && <div style={{ position: 'absolute', right: 12, top: -10, background: '#3b82f6', color: '#fff', fontSize: 10, padding: '2px 8px', borderRadius: 6, fontWeight: 800 }}>AI RECOMPILED</div>}
                                            </div>
                                        </div>
                                    )}

                                    {/* Attachments UI */}
                                    <div style={{ marginTop: 12 }}>
                                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16 }}>
                                            <label style={{
                                                width: 100, height: 100, borderRadius: 16, border: '2px dashed rgba(255,255,255,0.1)',
                                                display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
                                                color: 'rgba(255,255,255,0.2)', transition: 'all 0.2s', background: 'rgba(255,255,255,0.02)'
                                            }} onMouseEnter={(e) => e.currentTarget.style.borderColor = 'rgba(255,255,255,0.3)'} onMouseLeave={(e) => e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)'}>
                                                <Plus size={32} />
                                                <input type="file" multiple onChange={handleFileSelect} style={{ display: 'none' }} />
                                            </label>
                                            {attachments.map((file, i) => (
                                                <div key={i} style={{
                                                    width: 100, height: 100, borderRadius: 16, background: 'rgba(255,255,255,0.05)',
                                                    border: '1px solid rgba(255,255,255,0.1)', display: 'flex', flexDirection: 'column',
                                                    alignItems: 'center', justifyContent: 'center', position: 'relative', overflow: 'hidden'
                                                }}>
                                                    <FileText size={28} style={{ color: 'rgba(255,255,255,0.4)' }} />
                                                    <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', marginTop: 6, width: '100%', textAlign: 'center', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', padding: '0 8px' }}>
                                                        {file.name}
                                                    </div>
                                                    <button onClick={() => removeAttachment(i)} style={{ position: 'absolute', top: 6, right: 6, background: 'rgba(0,0,0,0.5)', border: 'none', borderRadius: '50%', color: '#fff', width: 20, height: 20, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                                                        <X size={12} />
                                                    </button>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            </section>
                        </form>
                    </div>
                </div>

                {/* Footer */}
                <div style={{
                    padding: '24px 40px', borderTop: '1px solid rgba(255,255,255,0.06)',
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    background: 'rgba(0,0,0,0.4)'
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: 'rgba(255,255,255,0.3)', fontSize: 13 }}>
                        <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#10B981' }} />
                        {t('ticket.creation.draft_autosaved') || 'Draft auto-saved to cloud.'}
                    </div>
                    <div style={{ display: 'flex', gap: 16 }}>
                        <button
                            onClick={closeModal}
                            style={{
                                padding: '0 32px', height: 56, borderRadius: 16, border: '1px solid rgba(255,255,255,0.1)',
                                background: 'transparent', color: '#fff', fontWeight: 600, fontSize: 16, cursor: 'pointer'
                            }}
                        >
                            {t('action.cancel') || '取消'}
                        </button>
                        <button
                            type="submit"
                            form="opt-ticket-form"
                            disabled={loading}
                            style={{
                                padding: '0 48px', height: 56, borderRadius: 16, border: 'none',
                                background: '#FFD700',
                                color: '#000', fontWeight: 800, fontSize: 18, cursor: 'pointer',
                                display: 'flex', alignItems: 'center', gap: 12,
                                opacity: loading ? 0.6 : 1, boxShadow: '0 12px 24px rgba(255, 215, 0, 0.3)'
                            }}
                        >
                            {loading ? <Loader2 size={24} className="animate-spin" /> : <Save size={24} />}
                            {t('action.create_ticket_now') || '马上创建工单'}
                        </button>
                    </div>
                </div>
            </div>

            {/* Full-Page Loading Overlay */}
            {loading && (
                <div style={{
                    position: 'absolute', inset: 0, zIndex: 10001,
                    background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    flexDirection: 'column', gap: 16, color: '#fff'
                }}>
                    <Loader2 size={48} className="animate-spin" style={{ color: '#FFD700' }} />
                    <div style={{ fontSize: 18, fontWeight: 700, letterSpacing: 0.5 }}>
                        {t('status.processing_ticket') || 'Initializing Workflow...'}
                    </div>
                </div>
            )}

            {/* Warranty Registration Modal (for RMA tickets) */}
            {initialType === 'RMA' && (
                <ProductWarrantyRegistrationModal
                    isOpen={showWarrantyModal}
                    onClose={() => setShowWarrantyModal(false)}
                    serialNumber={draft.serial_number || ''}
                    productName={products.find(p => p.id === draft.product_id)?.name}
                    onRegistered={() => {
                        setShowWarrantyModal(false);
                        setWarrantyCheckStatus('valid');
                    }}
                />
            )}

            {/* Product Modal - 入库未注册产品 */}
            <ProductModal
                isOpen={showProductModal}
                onClose={() => setShowProductModal(false)}
                editingProduct={null}
                prefillSerialNumber={draft.serial_number || ''}
                prefillProductName={products.find(p => p.id === draft.product_id)?.name || ''}
                onSuccess={async () => {
                    setShowProductModal(false);
                    // 刷新产品信息 - 使用正确的 API
                    if (draft.serial_number) {
                        try {
                            const res = await axios.get(`/api/v1/context/by-serial-number?serial_number=${encodeURIComponent(draft.serial_number)}`, {
                                headers: { Authorization: `Bearer ${token}` }
                            });
                            if (res.data.success && res.data.data.device) {
                                const device = res.data.data.device;
                                setMachineInfo(device);
                                // 更新 product_id - 使用设备的 product_id（产品型号ID），而非 device.id（设备实例ID）
                                if (device.product_id && !device.is_unregistered) {
                                    handleFieldChange('product_id', device.product_id, true);
                                }
                                // 检查是否需要注册保修
                                if (!device.warranty_start_date) {
                                    setWarrantyCheckStatus('needs_registration');
                                } else {
                                    setWarrantyCheckStatus('valid');
                                }
                            }
                        } catch (err) {
                            console.error('Failed to refresh product info:', err);
                        }
                    }
                }}
            />

            <style>{`
                @keyframes modalScaleIn {
                    from { opacity: 0; transform: scale(0.9) translateY(20px); }
                    to { opacity: 1; transform: scale(1) translateY(0); }
                }
                .animate-spin {
                    animation: spin 1s linear infinite;
                }
                @keyframes spin {
                    from { transform: rotate(0deg); }
                    to { transform: rotate(360deg); }
                }
            `}</style>
        </div>
    );
};

export default TicketCreationModal;
