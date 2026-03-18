import React, { useState, useEffect } from 'react';
import {
    X, Save, Loader2, MessageSquare, ShieldCheck, Wrench,
    FileText, Sparkles, Plus, AlertTriangle, Image, Video,
    ChevronDown
} from 'lucide-react';
import axios from 'axios';
import { useTicketStore, type TicketType } from '../../store/useTicketStore';
import { useAuthStore } from '../../store/useAuthStore';
import { useLanguage } from '../../i18n/useLanguage';
import { useNavigate } from 'react-router-dom';
import { ProductWarrantyRegistrationModal } from './ProductWarrantyRegistrationModal';
import ProductModal from '../Workspace/ProductModal';

import { CRMLookup } from './CRMLookup';

// ---- Main Modal Component ----

const AttachmentThumbnail: React.FC<{ file: File; onRemove: () => void }> = ({ file, onRemove }) => {
    const isImage = file.type.startsWith('image/') || file.name.toLowerCase().endsWith('.heic') || file.name.toLowerCase().endsWith('.heif');
    const isVideo = file.type.startsWith('video/') || file.name.toLowerCase().endsWith('.h265') || file.name.toLowerCase().endsWith('.hevc');
    const isHeic = file.name.toLowerCase().endsWith('.heic') || file.name.toLowerCase().endsWith('.heif');
    const isH265 = file.name.toLowerCase().endsWith('.h265') || file.name.toLowerCase().endsWith('.hevc');
    
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);

    useEffect(() => {
        if ((isImage && !isHeic) || (isVideo && !isH265)) {
            const url = URL.createObjectURL(file);
            setPreviewUrl(url);
            return () => URL.revokeObjectURL(url);
        }
    }, [file]);

    return (
        <div style={{
            width: 80, height: 80, borderRadius: 12, background: 'var(--glass-bg)',
            border: '1px solid var(--glass-border)', display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center', position: 'relative', overflow: 'hidden'
        }}>
            {previewUrl ? (
                isImage ? <img src={previewUrl} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                : <video src={previewUrl} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            ) : (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                    {isImage ? <Image size={24} style={{ color: '#FFD200' }} />
                    : isVideo ? <Video size={24} style={{ color: '#FFD200' }} />
                    : <FileText size={24} style={{ color: 'var(--text-secondary)' }} />}
                    <div style={{ fontSize: 10, color: 'var(--text-tertiary)', width: '100%', textAlign: 'center', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', padding: '0 6px' }}>
                        {file.name}
                    </div>
                </div>
            )}
            <button onClick={onRemove} style={{ position: 'absolute', top: 4, right: 4, background: 'rgba(0,0,0,0.4)', border: 'none', borderRadius: '50%', color: '#fff', width: 20, height: 20, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                <X size={12} />
            </button>
        </div>
    );
};

const ExistingAttachmentThumbnail: React.FC<{ attachment: any; onRemove: () => void }> = ({ attachment, onRemove }) => {
    const isImage = attachment.file_type?.startsWith('image/') || attachment.filename?.toLowerCase().endsWith('.heic') || attachment.filename?.toLowerCase().endsWith('.heif');
    const isVideo = attachment.file_type?.startsWith('video/') || attachment.filename?.toLowerCase().endsWith('.h265') || attachment.filename?.toLowerCase().endsWith('.hevc');
    
    return (
        <div style={{
            width: 80, height: 80, borderRadius: 12, background: 'var(--glass-bg)',
            border: '1px solid var(--glass-border)', display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center', position: 'relative', overflow: 'hidden'
        }}>
            {isImage ? <img src={attachment.url} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            : isVideo ? <video src={attachment.url} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            : (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                    <FileText size={24} style={{ color: 'var(--text-secondary)' }} />
                    <div style={{ fontSize: 10, color: 'var(--text-tertiary)', width: '100%', textAlign: 'center', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', padding: '0 6px' }}>
                        {attachment.filename}
                    </div>
                </div>
            )}
            <div style={{ position: 'absolute', top: 4, left: 4, background: '#FFD200', color: '#000', fontSize: 8, padding: '2px 4px', borderRadius: 4, fontWeight: 800 }}>EXISTING</div>
            <button onClick={onRemove} style={{ position: 'absolute', top: 4, right: 4, background: 'rgba(0,0,0,0.4)', border: 'none', borderRadius: '50%', color: '#fff', width: 20, height: 20, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                <X size={12} />
            </button>
        </div>
    );
};

const TicketCreationModal: React.FC = () => {
    const { 
        isOpen, ticketType: initialType, drafts, closeModal, updateDraft, clearDraft, openModal,
        isCorrection, targetTicketId, correctionReason 
    } = useTicketStore();
    const { token } = useAuthStore();
    const { t, language } = useLanguage();
    const navigate = useNavigate();

    const [loading, setLoading] = useState(false);
    const [products, setProducts] = useState<any[]>([]);
    const [snLoading, setSnLoading] = useState(false);
    const [machineInfo, setMachineInfo] = useState<any>(null);
    const [existingAttachments, setExistingAttachments] = useState<any[]>([]);

    // Draft-isolated states
    const [attachmentsMap, setAttachmentsMap] = useState<Record<string, File[]>>({});
    const [ghostFieldsMap, setGhostFieldsMap] = useState<Record<string, Set<string>>>({});
    const [aiInputMap, setAiInputMap] = useState<Record<string, string>>({});
    const [aiLogMap, setAiLogMap] = useState<Record<string, string[]>>({});

    const attachments = attachmentsMap[initialType] || [];
    const setAttachments = (files: File[] | ((prev: File[]) => File[])) => {
        setAttachmentsMap(prev => {
            const curr = prev[initialType] || [];
            const next = typeof files === 'function' ? files(curr) : files;
            return { ...prev, [initialType]: next };
        });
    };
    
    const ghostFields = ghostFieldsMap[initialType] || new Set<string>();
    const setGhostFields = (updateFn: Set<string> | ((prev: Set<string>) => Set<string>)) => {
        setGhostFieldsMap(prev => {
            const curr = prev[initialType] || new Set<string>();
            const next = typeof updateFn === 'function' ? updateFn(curr) : updateFn;
            return { ...prev, [initialType]: next };
        });
    };

    const aiInput = aiInputMap[initialType] || '';
    const setAiInput = (val: string) => {
        setAiInputMap(prev => ({ ...prev, [initialType]: val }));
    };

    const aiLog = aiLogMap[initialType] || [];
    const setAiLog = (log: string[] | ((prev: string[]) => string[])) => {
        setAiLogMap(prev => {
            const curr = prev[initialType] || [];
            const next = typeof log === 'function' ? log(curr) : log;
            return { ...prev, [initialType]: next };
        });
    };

    // Warranty check state (for RMA tickets)
    const [warrantyCheckStatus, setWarrantyCheckStatus] = useState<'unchecked' | 'valid' | 'needs_registration'>('unchecked');
    const [showWarrantyModal, setShowWarrantyModal] = useState(false);
    const [showProductModal, setShowProductModal] = useState(false);
    const [, setCheckingWarranty] = useState(false);

    const [aiLoading, setAiLoading] = useState(false);

    const draft = drafts[initialType];

    // Fetch initial data
    useEffect(() => {
        if (isOpen) {
            const fetchInitialData = async () => {
                try {
                    const prodRes = await axios.get('/api/v1/system/products', { headers: { Authorization: `Bearer ${token}` } });
                    if (prodRes.data.success) setProducts(prodRes.data.data);

                    // Load existing attachments for correction
                    if (isCorrection && targetTicketId) {
                        const ticketRes = await axios.get(`/api/v1/tickets/${targetTicketId}`, { headers: { Authorization: `Bearer ${token}` } });
                        if (ticketRes.data.success) {
                            // Only count attachments that don't belong to other specific activities (or keep all ticket-level ones)
                            setExistingAttachments(ticketRes.data.attachments || []);
                        }
                    }
                } catch (err) {
                    console.error('Failed to fetch modal data:', err);
                }
            };
            fetchInitialData();
        } else {
            setExistingAttachments([]);
        }
    }, [isOpen, token, isCorrection, targetTicketId]);

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

    const removeExistingAttachment = async (attachId: number) => {
        if (!confirm('确定要删除此附件吗？此操作不可撤销。')) return;
        
        try {
            const res = await axios.delete(`/api/v1/tickets/${targetTicketId}/attachments/${attachId}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            if (res.data.success) {
                setExistingAttachments(prev => prev.filter(a => a.id !== attachId));
            }
        } catch (err) {
            console.error('Failed to delete attachment:', err);
            alert('删除附件失败');
        }
    };

    const handleAiParse = async () => {
        if (!aiInput.trim()) return;
        setAiLoading(true);
        const isZh = language === 'zh';
        setAiLog([
            isZh ? '🤖 正在分析您的输入...' : '🤖 Analyzing your input...', 
            isZh ? '🔍 正在提取关键信息...' : '🔍 Extracting key information...'
        ]);

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
                newLogs.push(isZh ? '✅ 提取完成。' : '✅ Extraction complete.');

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
                        newLogs.push(isZh ? `📦 匹配到产品: ${matchedProduct.name}` : `📦 Matched product: ${matchedProduct.name}`);
                    }
                }

                if (result.serial_number) {
                    updates.serial_number = result.serial_number;
                    fieldsToMarkGhost.push('serial_number');
                    newLogs.push(isZh ? `🔢 找到序列号: ${result.serial_number}` : `🔢 Found S/N: ${result.serial_number}`);
                }

                // Problem Description
                let summary = result.issue_summary || '';
                if (result.urgency === 'High' && !summary.startsWith('[URGENT]')) {
                    summary = `[URGENT] ${summary}`;
                }

                updates.problem_description = summary + '\n\n' + (result.communication_log || '');
                fieldsToMarkGhost.push('problem_description');

                // Apply updates
                updateDraft(initialType, updates);
                const nextGhost = new Set(ghostFields);
                fieldsToMarkGhost.forEach(f => nextGhost.add(f));
                setGhostFields(nextGhost);
                setAiLog(newLogs);
            }
        } catch (err) {
            console.error('AI Parse Failed:', err);
            setAiLog(prev => [...prev, isZh ? '❌ AI 分析失败。请手动填写。' : '❌ AI analysis failed. Please fill manually.']);
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

            // If Correction, use PATCH and add audit info
            let res;
            if (isCorrection) {
                formData.append('change_reason', correctionReason);
                formData.append('is_modal_edit', 'true');
                res = await axios.patch(`/api/v1/tickets/${targetTicketId}`, formData, {
                    headers: {
                        Authorization: `Bearer ${token}`,
                        'Content-Type': 'multipart/form-data'
                    }
                });
            } else {
                res = await axios.post('/api/v1/tickets', formData, {
                    headers: {
                        Authorization: `Bearer ${token}`,
                        'Content-Type': 'multipart/form-data'
                    }
                });
            }

            if (res.data.success) {
                if (!isCorrection) {
                    clearDraft(initialType);
                    setAttachments([]);
                    setAiInput('');
                }
                closeModal();
                navigate(`/service/tickets/${isCorrection ? targetTicketId : res.data.data.id}`, { replace: true });
                // If it's correction of current page, we might need a refresh
                if (isCorrection) window.location.reload();
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

    // --- Styling Vars ---
    const ghostStyle = (field: string): React.CSSProperties => ({
        border: ghostFields.has(field) ? '1px solid rgba(59, 130, 246, 0.6)' : '1px solid var(--glass-border)',
        boxShadow: ghostFields.has(field) ? '0 0 10px rgba(59, 130, 246, 0.2)' : 'none',
        background: ghostFields.has(field) ? 'rgba(59, 130, 246, 0.05)' : 'var(--glass-bg-light)',
        transition: 'all 0.3s'
    });

    return (
        <div style={{
            position: 'fixed', inset: 0, zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(10px)', padding: '20px'
        }}>
            <div style={{
                background: 'var(--modal-bg)', border: '1px solid var(--modal-border)', borderRadius: '24px',
                width: '100%', maxWidth: '1200px', height: '90vh', display: 'flex', flexDirection: 'column',
                boxShadow: '0 40px 100px rgba(0,0,0,0.8)', overflow: 'hidden', animation: 'modalScaleIn 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)'
            }}>
                {/* 顶部: 类型选择 & 关闭 */}
                <div style={{
                    padding: '20px 32px', borderBottom: '1px solid var(--glass-border)',
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    background: 'rgba(255,255,255,0.02)'
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                        <div style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-main)', marginRight: 8 }}>
                            {isCorrection ? (language === 'zh' ? '更正工单信息' : 'Correct Ticket') : (language === 'zh' ? '创建工单' : 'Create Ticket')}
                        </div>
                        {typeOptions.map(opt => (
                            <button
                                key={opt.key}
                                onClick={() => {
                                    if (isCorrection) return;
                                    openModal(opt.key);
                                }}
                                disabled={isCorrection}
                                style={{
                                    padding: '10px 24px', borderRadius: 12, border: 'none',
                                    background: initialType === opt.key ? opt.color : 'var(--glass-bg-light)',
                                    color: initialType === opt.key ? '#000' : 'var(--text-tertiary)',
                                    fontWeight: 700, fontSize: '14px', display: 'flex', alignItems: 'center', gap: 8,
                                    cursor: isCorrection ? 'not-allowed' : 'pointer', transition: 'all 0.3s',
                                    opacity: isCorrection && initialType !== opt.key ? 0.4 : 1
                                }}
                            >
                                <opt.icon size={18} />
                                {opt.label}
                            </button>
                        ))}
                        {isCorrection && (
                            <div style={{ padding: '6px 12px', background: 'rgba(255,165,0,0.1)', border: '1px solid rgba(255,165,0,0.3)', borderRadius: 8, color: '#FFA500', fontSize: 12, fontWeight: 600 }}>
                                {language === 'zh' ? '更正模式' : 'Correction Mode'}
                            </div>
                        )}
                    </div>
                    <button
                        onClick={closeModal}
                        style={{ background: 'transparent', border: 'none', color: 'var(--text-tertiary)', cursor: 'pointer', padding: 8 }}
                    >
                        <X size={24} />
                    </button>
                </div>

                <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '400px 1fr', overflow: 'hidden' }}>

                    {/* LEFT: AI Sandbox (智能沙盒) */}
                    <div style={{
                        background: 'var(--glass-bg-light)', borderRight: '1px solid var(--glass-border)',
                        padding: 32, display: 'flex', flexDirection: 'column', gap: 24, overflowY: 'auto'
                    }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                            <Sparkles size={20} color="#FFD700" />
                            <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600, color: 'var(--accent-blue)' }}>{t('ticket.creation.ai_sandbox') || 'Bokeh 协助'}</h3>
                        </div>

                        <div
                            style={{
                                position: 'relative',
                                border: '2px dashed var(--glass-border-accent)',
                                borderRadius: 20,
                                padding: 4,
                                background: 'var(--glass-bg-light)',
                                flex: 1,
                                display: 'flex',
                                flexDirection: 'column',
                                minHeight: 0
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
                                onPaste={(e) => {
                                    const items = e.clipboardData?.items;
                                    if (items) {
                                        for (const item of items) {
                                            const file = item.getAsFile();
                                            if (item.type.startsWith('image/') || 
                                                (file && (file.name.toLowerCase().endsWith('.heic') || file.name.toLowerCase().endsWith('.heif') || file.name.toLowerCase().endsWith('.h265') || file.name.toLowerCase().endsWith('.hevc')))) {
                                                e.preventDefault();
                                                if (file) {
                                                    setAttachments(prev => [...prev, file]);
                                                }
                                            }
                                        }
                                    }
                                }}
                                placeholder={t('ticket.creation.ai_paste_hint') || '粘贴文字、图片，或拖入文件...'}
                                style={{
                                    width: '100%', height: '100%', minHeight: 0, background: 'transparent',
                                    border: 'none', borderRadius: 20,
                                    padding: 24, color: 'var(--text-main)', fontSize: 16, outline: 'none', resize: 'none',
                                    lineHeight: 1.6,
                                    flex: 1
                                }}
                            />

                            {/* Drag & Drop Overlay Hint - simplified - Removed attachment list from here to avoid redundancy with right blueprint */}
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
                                background: 'var(--glass-bg-light)', borderRadius: 12, padding: 16,
                                border: '1px solid var(--glass-border)', fontSize: 12,
                                fontFamily: 'monospace', color: 'var(--text-tertiary)', display: 'flex',
                                flexDirection: 'column', gap: 8
                            }}>
                                {aiLog.map((log, i) => <div key={i}>{log}</div>)}
                            </div>
                        )}

                        {/* Multi-modal input section removed */}
                    </div>

                    {/* RIGHT: Formal Blueprint (结构化蓝图) */}
                    <div style={{ padding: '16px 32px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 16 }}>

                        <form id="opt-ticket-form" onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

                            {/* CRM Context Section */}
                            <section>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                                        <label style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)' }}>{t('ticket.creation.search_account') || '搜索企业 / 公司'}</label>
                                        <CRMLookup
                                            onSelect={async (acc) => {
                                                if (acc) {
                                                    handleFieldChange('account_id', acc.id);
                                                    if ((acc as any).email) handleFieldChange('customer_contact', (acc as any).email, true);
                                                    
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
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                                        <label style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)' }}>{t('ticket.creation.contact_name') || '联系人 / 客户姓名'}</label>
                                        <div style={{ position: 'relative' }}>
                                            <input
                                                type="text"
                                                value={draft.customer_name || ''}
                                                onChange={(e) => handleFieldChange('customer_name', e.target.value)}
                                                placeholder={t('ticket.creation.contact_name_placeholder') || 'XXXJacky'}
                                                style={{
                                                    width: '100%', height: 44, borderRadius: 12, padding: '0 16px',
                                                    color: 'var(--text-main)', fontSize: 15, outline: 'none',
                                                    ...ghostStyle('customer_name')
                                                }}
                                            />
                                            {ghostFields.has('customer_name') && <div style={{ position: 'absolute', right: 12, top: -10, background: '#3b82f6', color: '#fff', fontSize: 10, padding: '2px 8px', borderRadius: 6, fontWeight: 800 }}>AI FILLED</div>}
                                        </div>
                                    </div>
                                </div>
                                <div style={{ marginTop: 16 }}>
                                    <label style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 8 }}>{t('ticket.creation.contact_info') || '联系方式 (邮箱 / 电话)'}</label>
                                    <div style={{ position: 'relative' }}>
                                        <input
                                            type="text"
                                            value={draft.customer_contact || ''}
                                            onChange={(e) => handleFieldChange('customer_contact', e.target.value)}
                                            placeholder={t('ticket.creation.contact_info_placeholder') || 'example@email.com or +86...'}
                                            style={{
                                                width: '100%', height: 44, borderRadius: 12, padding: '0 16px',
                                                color: 'var(--text-main)', fontSize: 15, outline: 'none',
                                                ...ghostStyle('customer_contact')
                                            }}
                                        />
                                        {ghostFields.has('customer_contact') && <div style={{ position: 'absolute', right: 12, top: -10, background: '#3b82f6', color: '#fff', fontSize: 10, padding: '2px 8px', borderRadius: 6, fontWeight: 800 }}>AI FILLED</div>}
                                    </div>
                                </div>
                            </section>

                            {/* Product Section */}
                            <section>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                                        <label style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)' }}>{t('ticket.creation.product_model') || '产品型号'}</label>
                                        <div style={{ position: 'relative' }}>
                                            <select
                                                value={draft.product_id || ''}
                                                onChange={(e) => handleFieldChange('product_id', parseInt(e.target.value))}
                                                style={{
                                                    width: '100%', height: 44, borderRadius: 12, padding: '0 14px',
                                                    color: 'var(--text-main)', fontSize: 15, outline: 'none', appearance: 'none',
                                                    backgroundColor: 'var(--glass-bg-light)',
                                                    border: '1px solid var(--glass-border)',
                                                    ...ghostStyle('product_id')
                                                }}
                                            >
                                                <option value="" style={{ background: 'var(--glass-bg-light)', color: 'var(--text-main)' }}>{t('ticket.creation.select_product') || 'Select Catalog Product...'}</option>
                                                {products.map(p => <option key={p.id} value={p.id} style={{ background: 'var(--glass-bg-light)', color: 'var(--text-main)' }}>{p.name}</option>)}
                                            </select>
                                            <ChevronDown size={18} style={{ position: 'absolute', right: 16, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-tertiary)', pointerEvents: 'none' }} />
                                            {ghostFields.has('product_id') && <div style={{ position: 'absolute', right: 36, top: -10, background: '#3b82f6', color: '#fff', fontSize: 10, padding: '2px 8px', borderRadius: 6, fontWeight: 800 }}>AI MATCHED</div>}
                                        </div>
                                    </div>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                                        <label style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)' }}>{t('ticket.creation.serial_number') || '序列号 (S/N)'}</label>
                                        <div style={{ position: 'relative' }}>
                                            <input
                                                type="text"
                                                value={draft.serial_number || ''}
                                                onChange={(e) => handleFieldChange('serial_number', e.target.value)}
                                                placeholder={t('ticket.creation.sn_placeholder') || 'Enter Device S/N...'}
                                                style={{
                                                    width: '100%', height: 44, borderRadius: 12, padding: '0 16px',
                                                    color: 'var(--text-main)', fontSize: 15, outline: 'none', fontFamily: 'monospace',
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
                                    const bgColor = isUnregistered ? 'rgba(230, 0, 0, 0.1)' 
                                        : (needsWarrantyReg ? 'rgba(255, 215, 0, 0.1)' 
                                        : (isWarrantyExpired ? 'rgba(249, 115, 22, 0.1)' : 'rgba(16, 185, 129, 0.1)'));
                                    const borderColor = isUnregistered ? 'rgba(230, 0, 0, 0.4)' 
                                        : (needsWarrantyReg ? 'rgba(255, 215, 0, 0.4)' 
                                        : (isWarrantyExpired ? 'rgba(249, 115, 22, 0.4)' : 'rgba(16, 185, 129, 0.3)'));
                                    
                                    // 未入库时显示用户选择的型号，否则显示台账中的型号
                                    const displayModelName = isUnregistered 
                                        ? (products.find(p => p.id === draft.product_id)?.name || '待入库设备') 
                                        : (machineInfo.model_name || '未知型号');
                                    
                                    // 保修状态文字
                                    const warrantyStatusText = isWarrantyExpired ? '过保' : '在保';
                                    
                                    return (
                                        <div style={{
                                            marginTop: 12, padding: '12px 16px',
                                            background: bgColor,
                                            border: `1px solid ${borderColor}`,
                                            borderRadius: 10, display: 'flex', alignItems: 'center', gap: 12
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
                                                <div style={{ fontWeight: 600, color: 'var(--text-main)', fontSize: 15, marginBottom: 4 }}>
                                                    {displayModelName}
                                                </div>
                                                <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
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
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                                    <label style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)' }}>问题描述</label>
                                    <div style={{ position: 'relative' }}>
                                        <textarea
                                            value={draft.problem_description || ''}
                                            onChange={(e) => handleFieldChange('problem_description', e.target.value)}
                                            placeholder={t('ticket.creation.elaborate') || '请详细描述问题...'}
                                            style={{
                                                width: '100%', minHeight: 80, borderRadius: 12, padding: 12,
                                                color: 'var(--text-main)', fontSize: 15, outline: 'none', lineHeight: 1.5,
                                                background: 'var(--glass-bg-light)', border: '1px solid var(--glass-border)',
                                                resize: 'vertical',
                                                ...ghostStyle('problem_description')
                                            }}
                                        />
                                        {ghostFields.has('problem_description') && <div style={{ position: 'absolute', right: 12, top: -10, background: '#3b82f6', color: '#fff', fontSize: 10, padding: '2px 8px', borderRadius: 6, fontWeight: 800 }}>AI GENERATED</div>}
                                    </div>

                                    {/* Attachments UI */}
                                    <div style={{ marginTop: 8 }}>
                                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
                                            <label style={{
                                                width: 80, height: 80, borderRadius: 12, border: '2px dashed var(--glass-border)',
                                                display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
                                                color: 'var(--text-tertiary)', transition: 'all 0.2s', background: 'var(--glass-bg-light)'
                                            }} onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'var(--accent-blue)'; e.currentTarget.style.color = 'var(--accent-blue)'; }} onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--glass-border)'; e.currentTarget.style.color = 'var(--text-tertiary)'; }}>
                                                <Plus size={28} />
                                                <input type="file" multiple onChange={handleFileSelect} style={{ display: 'none' }} />
                                            </label>
                                            {existingAttachments.map((attach) => (
                                                <ExistingAttachmentThumbnail
                                                    key={attach.id}
                                                    attachment={attach}
                                                    onRemove={() => removeExistingAttachment(attach.id)}
                                                />
                                            ))}
                                            {attachments.map((file, i) => (
                                                <AttachmentThumbnail 
                                                    key={`new-${i}`} 
                                                    file={file} 
                                                    onRemove={() => removeAttachment(i)} 
                                                />
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
                    padding: '16px 32px', borderTop: '1px solid var(--glass-border)',
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    background: 'var(--glass-bg)'
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: 'var(--text-tertiary)', fontSize: 13 }}>
                        <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#10B981' }} />
                        {t('ticket.creation.draft_autosaved') || 'Draft auto-saved to cloud.'}
                    </div>
                    <div style={{ display: 'flex', gap: 16 }}>
                        <button
                            onClick={closeModal}
                            style={{
                                padding: '0 24px', height: 48, borderRadius: 12, border: '1px solid var(--glass-border)',
                                background: 'transparent', color: 'var(--text-main)', fontWeight: 600, fontSize: 15, cursor: 'pointer'
                            }}
                        >
                            {t('action.cancel') || '取消'}
                        </button>
                        <button
                            type="submit"
                            form="opt-ticket-form"
                            disabled={loading}
                            style={{
                                padding: '0 32px', height: 48, borderRadius: 12, border: 'none',
                                background: '#FFD700',
                                color: '#000', fontWeight: 700, fontSize: 16, cursor: 'pointer',
                                display: 'flex', alignItems: 'center', gap: 10,
                                opacity: loading ? 0.6 : 1, boxShadow: '0 8px 20px rgba(255, 215, 0, 0.3)'
                            }}
                        >
                            {loading ? <Loader2 size={20} className="animate-spin" /> : (isCorrection ? <Save size={20} /> : <Plus size={20} />)}
                            {isCorrection ? (language === 'zh' ? '提交更正' : 'Submit Correction') : (t('action.create_ticket_now') || '马上创建工单')}
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
