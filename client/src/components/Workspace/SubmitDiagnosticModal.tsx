import React, { useState } from 'react';
import { X, Save, FileText, Wrench, AlertTriangle, Paperclip, Loader2, Search, Trash2, Package } from 'lucide-react';
import axios from 'axios';
import { useAuthStore } from '../../store/useAuthStore';

interface PartOption {
    id: number;
    sku: string;
    name: string;
    category: string;
    price_cny: number;
}

interface EstimatedPart {
    part_id: number;
    name: string;
    sku: string;
    quantity: number;
    price: number;
}

interface SubmitDiagnosticModalProps {
    isOpen: boolean;
    onClose: () => void;
    ticketId: number;
    ticketNumber: string;
    onSuccess: () => void;
    // 编辑模式相关 props（用于更正历史记录）
    editMode?: boolean;
    editData?: Record<string, unknown> | null;
    correctionReason?: string;
}

export const SubmitDiagnosticModal: React.FC<SubmitDiagnosticModalProps> = ({ 
    isOpen, onClose, ticketId, ticketNumber, onSuccess,
    editMode = false, editData = null, correctionReason: _correctionReason = ''
}) => {
    const { token } = useAuthStore();
    const [submitting, setSubmitting] = useState(false);

    // Form State
    const [diagnosis, setDiagnosis] = useState('');
    const [repairAdvice, setRepairAdvice] = useState('');
    const [damageStatus, setDamageStatus] = useState<'no_damage' | 'physical_damage' | 'uncertain' | ''>('');
    const [warrantySuggestion, setWarrantySuggestion] = useState<'suggest_in_warranty' | 'suggest_out_warranty' | 'needs_verification' | ''>('');
    const [attachments, setAttachments] = useState<File[]>([]);

    // Estimated Parts & Labor
    const [estimatedLaborHours, setEstimatedLaborHours] = useState<number>(0);
    const [estimatedParts, setEstimatedParts] = useState<EstimatedPart[]>([]);
    const [partSearchTerm, setPartSearchTerm] = useState('');
    const [partOptions, setPartOptions] = useState<PartOption[]>([]);

    // 编辑模式：预填数据
    React.useEffect(() => {
        if (editMode && editData && isOpen) {
            const data = editData as any;
            if (data.diagnosis) setDiagnosis(data.diagnosis);
            if (data.repair_advice) setRepairAdvice(data.repair_advice);
            if (data.technical_damage_status) setDamageStatus(data.technical_damage_status);
            if (data.technical_warranty_suggestion) setWarrantySuggestion(data.technical_warranty_suggestion);
            if (data.estimated_labor_hours) setEstimatedLaborHours(data.estimated_labor_hours);
            if (data.estimated_parts) setEstimatedParts(data.estimated_parts);
        }
    }, [editMode, editData, isOpen]);

    if (!isOpen) return null;

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files) {
            const files = Array.from(e.target.files);
            setAttachments(prev => [...prev, ...files]);
        }
    };

    const removeFile = (index: number) => {
        setAttachments(prev => prev.filter((_, i) => i !== index));
    };

    const searchParts = async (term: string) => {
        if (!term || term.length < 2) {
            setPartOptions([]);
            return;
        }
        try {
            const res = await axios.get('/api/v1/parts-master', {
                headers: { Authorization: `Bearer ${token}` },
                params: { search: term, status: 'active', page_size: 10 }
            });
            if (res.data?.success) {
                setPartOptions(res.data.data);
            }
        } catch (err) {
            console.error('Failed to search parts', err);
        }
    };

    const addPart = (part: PartOption) => {
        const existing = estimatedParts.find(p => p.part_id === part.id);
        if (existing) {
            setEstimatedParts(prev => prev.map(p => p.part_id === part.id ? { ...p, quantity: p.quantity + 1 } : p));
        } else {
            setEstimatedParts(prev => [...prev, {
                part_id: part.id,
                name: part.name,
                sku: part.sku,
                quantity: 1,
                price: part.price_cny
            }]);
        }
        setPartSearchTerm('');
        setPartOptions([]);
    };

    const removePart = (partId: number) => {
        setEstimatedParts(prev => prev.filter(p => p.part_id !== partId));
    };

    const updatePartQuantity = (partId: number, qty: number) => {
        setEstimatedParts(prev => prev.map(p => p.part_id === partId ? { ...p, quantity: Math.max(1, qty) } : p));
    };

    const handleSubmit = async () => {
        if (!diagnosis.trim() || !repairAdvice.trim() || !damageStatus) {
            alert('请完善必填的诊断结论与技术损坏判定！');
            return;
        }

        setSubmitting(true);
        try {
            // 1. Add Diagnostic Activity with attachments
            const formData = new FormData();
            formData.append('activity_type', 'diagnostic_report');
            formData.append('content', '提交了诊断结果与故障确认。');
            formData.append('visibility', 'all');

            // Build metadata with new technical assessment fields
            const metadata = {
                diagnosis: diagnosis.trim(),
                repair_advice: repairAdvice.trim(),
                technical_damage_status: damageStatus,
                technical_warranty_suggestion: warrantySuggestion,
                submission_type: 'technical_diagnosis',
                estimated_labor_hours: estimatedLaborHours,
                estimated_parts: estimatedParts
            };
            formData.append('metadata', JSON.stringify(metadata));

            for (const file of attachments) {
                formData.append('attachments', file);
            }

            await axios.post(`/api/v1/tickets/${ticketId}/activities`, formData, {
                headers: {
                    Authorization: `Bearer ${token}`,
                    'Content-Type': 'multipart/form-data'
                }
            });

            // 2. Perform Flow Transition to MS Review + update ticket technical assessment
            await axios.patch(`/api/v1/tickets/${ticketId}`, {
                current_node: 'ms_review',
                technical_damage_status: damageStatus,
                technical_warranty_suggestion: warrantySuggestion || null,
                estimated_labor_hours: estimatedLaborHours,
                estimated_parts_json: JSON.stringify(estimatedParts), // Store as well for easy access
                change_reason: '完成技术诊断，流向商务审核 (MS Review)'
            }, { headers: { Authorization: `Bearer ${token}` } });

            // 3. Create pre-consumption records marked as 'estimated'
            if (estimatedParts.length > 0) {
                const promises = estimatedParts.map(part =>
                    axios.post('/api/v1/parts-consumption', {
                        ticket_id: ticketId,
                        part_id: part.part_id,
                        quantity: part.quantity,
                        source_type: 'hq_inventory',
                        notes: `[诊断预估] ${diagnosis.substring(0, 20)}...`
                    }, { headers: { Authorization: `Bearer ${token}` } })
                );
                await Promise.allSettled(promises);
            }

            onSuccess();
        } catch (err: any) {
            alert(err.response?.data?.error || err.message);
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 1000,
            background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(10px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center'
        }}>
            <div style={{
                width: 600, background: '#1c1c1e', borderRadius: 16,
                border: '1px solid rgba(255,255,255,0.1)', overflow: 'hidden',
                boxShadow: '0 30px 60px rgba(0,0,0,0.6)',
                display: 'flex', flexDirection: 'column', maxHeight: '90vh',
                position: 'relative'
            }}>
                {/* Global Loading Overlay for large uploads */}
                {submitting && (
                    <div style={{
                        position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
                        background: 'rgba(0,0,0,0.8)', zIndex: 10,
                        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                        gap: 20, backdropFilter: 'blur(4px)'
                    }}>
                        <div className="upload-spinner" style={{
                            width: 60, height: 60, border: '4px solid rgba(255,215,0,0.1)',
                            borderTop: '4px solid #FFD700', borderRadius: '50%',
                            animation: 'spin 1s linear infinite'
                        }} />
                        <div style={{ textAlign: 'center' }}>
                            <div style={{ color: '#FFD700', fontSize: 18, fontWeight: 700, marginBottom: 8 }}>正在提交诊断报告...</div>
                            <div style={{ color: '#888', fontSize: 13 }}>如果附件较大，请耐心等待，请勿关闭或刷新页面</div>
                        </div>
                        <style>{`
                            @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
                        `}</style>
                    </div>
                )}

                {/* Header */}
                <div style={{ padding: '20px 24px', borderBottom: '1px solid rgba(255,255,255,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'rgba(255,255,255,0.02)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <div style={{ width: 40, height: 40, borderRadius: 10, background: 'rgba(59, 130, 246, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <Wrench size={20} color="#3B82F6" />
                        </div>
                        <div>
                            <h3 style={{ margin: 0, fontSize: 18, fontWeight: 600, color: '#fff' }}>提交诊断报告</h3>
                            <p style={{ margin: 0, fontSize: 12, color: '#888', marginTop: 4 }}>工单 {ticketNumber}</p>
                        </div>
                    </div>
                    <button onClick={onClose} disabled={submitting} style={{ background: 'none', border: 'none', color: '#888', cursor: 'pointer', opacity: submitting ? 0.5 : 1 }}>
                        <X size={24} />
                    </button>
                </div>

                {/* Form Body */}
                <div style={{ padding: 24, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 20 }}>
                    {/* Diagnosis Conclusion */}
                    <div>
                        <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: '#aaa', marginBottom: 8 }}>
                            <AlertTriangle size={14} color="#FFD200" /> 故障判定 (必填)
                        </label>
                        <textarea
                            value={diagnosis}
                            onChange={e => setDiagnosis(e.target.value)}
                            placeholder="请详细描述检测到的硬件问题、损坏状态（如：主板进水短路，外力导致CMOS碎裂等）"
                            style={{
                                width: '100%', minHeight: 100, padding: 12, background: 'rgba(0,0,0,0.3)',
                                border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, color: '#fff',
                                fontSize: 14, resize: 'vertical', outline: 'none'
                            }}
                            onFocus={e => e.target.style.borderColor = '#3B82F6'}
                            onBlur={e => e.target.style.borderColor = 'rgba(255,255,255,0.1)'}
                        />
                    </div>

                    {/* Repair Advice */}
                    <div>
                        <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: '#aaa', marginBottom: 8 }}>
                            <Wrench size={14} color="#10B981" /> 维修方案 / 建议 (必填)
                        </label>
                        <textarea
                            value={repairAdvice}
                            onChange={e => setRepairAdvice(e.target.value)}
                            placeholder="建议更换的部件、所需工时或返厂处理..."
                            style={{
                                width: '100%', minHeight: 80, padding: 12, background: 'rgba(0,0,0,0.3)',
                                border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, color: '#fff',
                                fontSize: 14, resize: 'vertical', outline: 'none'
                            }}
                            onFocus={e => e.target.style.borderColor = '#3B82F6'}
                            onBlur={e => e.target.style.borderColor = 'rgba(255,255,255,0.1)'}
                        />
                    </div>

                    {/* Estimated Parts & Labor */}
                    <div style={{ background: 'rgba(59, 130, 246, 0.05)', border: '1px solid rgba(59, 130, 246, 0.1)', borderRadius: 12, padding: 16 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: '#3B82F6', fontWeight: 600, marginBottom: 12 }}>
                            <Package size={14} /> 配件与工时预估 (Estimate)
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: '120px 1fr', gap: 16, marginBottom: 16 }}>
                            <div>
                                <label style={{ display: 'block', fontSize: 11, color: '#888', marginBottom: 6 }}>预估工时 (小时)</label>
                                <input
                                    type="number"
                                    step="0.5"
                                    min="0"
                                    value={estimatedLaborHours}
                                    onChange={e => setEstimatedLaborHours(parseFloat(e.target.value) || 0)}
                                    style={{ width: '100%', padding: '8px 12px', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 6, color: '#fff', fontSize: 14 }}
                                />
                            </div>
                            <div>
                                <label style={{ display: 'block', fontSize: 11, color: '#888', marginBottom: 6 }}>添加预估配件</label>
                                <div style={{ position: 'relative' }}>
                                    <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#666' }} />
                                    <input
                                        type="text"
                                        placeholder="输入型号或 SKU..."
                                        value={partSearchTerm}
                                        onChange={e => {
                                            setPartSearchTerm(e.target.value);
                                            searchParts(e.target.value);
                                        }}
                                        style={{ width: '100%', padding: '8px 12px 8px 32px', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 6, color: '#fff', fontSize: 13 }}
                                    />
                                    {partOptions.length > 0 && (
                                        <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: '#2c2c2e', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, marginTop: 4, zIndex: 100, maxHeight: 150, overflowY: 'auto', boxShadow: '0 10px 20px rgba(0,0,0,0.5)' }}>
                                            {partOptions.map(p => (
                                                <div
                                                    key={p.id}
                                                    onClick={() => addPart(p)}
                                                    style={{ padding: '8px 12px', cursor: 'pointer', borderBottom: '1px solid rgba(255,255,255,0.05)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
                                                    onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.05)'}
                                                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                                                >
                                                    <div>
                                                        <div style={{ fontSize: 12, color: '#eee' }}>{p.name}</div>
                                                        <div style={{ fontSize: 10, color: '#888' }}>{p.sku}</div>
                                                    </div>
                                                    <div style={{ fontSize: 11, color: '#3B82F6' }}>¥{p.price_cny}</div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>

                        {estimatedParts.length > 0 && (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                                {estimatedParts.map(p => (
                                    <div key={p.part_id} style={{ display: 'flex', alignItems: 'center', gap: 10, background: 'rgba(255,255,255,0.03)', padding: '8px 12px', borderRadius: 8 }}>
                                        <div style={{ flex: 1 }}>
                                            <div style={{ fontSize: 12, color: '#eee' }}>{p.name}</div>
                                            <div style={{ fontSize: 10, color: '#666' }}>{p.sku}</div>
                                        </div>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                            <span style={{ fontSize: 11, color: '#888' }}>x</span>
                                            <input
                                                type="number"
                                                min="1"
                                                value={p.quantity}
                                                onChange={e => updatePartQuantity(p.part_id, parseInt(e.target.value) || 1)}
                                                style={{ width: 44, padding: '2px 4px', background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 4, color: '#FFD700', textAlign: 'center', fontSize: 12 }}
                                            />
                                        </div>
                                        <button onClick={() => removePart(p.part_id)} style={{ background: 'none', border: 'none', color: '#EF4444', cursor: 'pointer', padding: 4 }}>
                                            <Trash2 size={14} />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Technical Damage Assessment */}
                    <div>
                        <label style={{ display: 'block', fontSize: 13, color: '#aaa', marginBottom: 12 }}>
                            <AlertTriangle size={14} style={{ marginRight: 6, verticalAlign: 'middle', color: '#FFD200' }} />
                            技术损坏判定 (必填)
                        </label>
                        <div style={{ display: 'flex', gap: 12 }}>
                            <button
                                onClick={() => setDamageStatus('no_damage')}
                                style={{
                                    flex: 1, padding: '12px', background: damageStatus === 'no_damage' ? 'rgba(16,185,129,0.15)' : 'rgba(255,255,255,0.03)',
                                    border: `1px solid ${damageStatus === 'no_damage' ? '#10B981' : 'rgba(255,255,255,0.1)'}`,
                                    color: damageStatus === 'no_damage' ? '#10B981' : '#fff', borderRadius: 8, cursor: 'pointer', transition: 'all 0.2s',
                                    fontWeight: damageStatus === 'no_damage' ? 600 : 400
                                }}
                            >无人为损坏 / 正常故障</button>
                            <button
                                onClick={() => setDamageStatus('physical_damage')}
                                style={{
                                    flex: 1, padding: '12px', background: damageStatus === 'physical_damage' ? 'rgba(239,68,68,0.15)' : 'rgba(255,255,255,0.03)',
                                    border: `1px solid ${damageStatus === 'physical_damage' ? '#EF4444' : 'rgba(255,255,255,0.1)'}`,
                                    color: damageStatus === 'physical_damage' ? '#EF4444' : '#fff', borderRadius: 8, cursor: 'pointer', transition: 'all 0.2s',
                                    fontWeight: damageStatus === 'physical_damage' ? 600 : 400
                                }}
                            >人为损坏 / 物理损伤</button>
                            <button
                                onClick={() => setDamageStatus('uncertain')}
                                style={{
                                    flex: 1, padding: '12px', background: damageStatus === 'uncertain' ? 'rgba(245,158,11,0.15)' : 'rgba(255,255,255,0.03)',
                                    border: `1px solid ${damageStatus === 'uncertain' ? '#FFD200' : 'rgba(255,255,255,0.1)'}`,
                                    color: damageStatus === 'uncertain' ? '#FFD200' : '#fff', borderRadius: 8, cursor: 'pointer', transition: 'all 0.2s',
                                    fontWeight: damageStatus === 'uncertain' ? 600 : 400
                                }}
                            >无法判定</button>
                        </div>
                    </div>

                    {/* Warranty Suggestion (Optional) */}
                    <div>
                        <label style={{ display: 'block', fontSize: 13, color: '#aaa', marginBottom: 12 }}>
                            保修建议 (选填，供商务参考)
                        </label>
                        <div style={{ display: 'flex', gap: 12 }}>
                            <button
                                onClick={() => setWarrantySuggestion('suggest_in_warranty')}
                                style={{
                                    flex: 1, padding: '12px', background: warrantySuggestion === 'suggest_in_warranty' ? 'rgba(16,185,129,0.15)' : 'rgba(255,255,255,0.03)',
                                    border: `1px solid ${warrantySuggestion === 'suggest_in_warranty' ? '#10B981' : 'rgba(255,255,255,0.1)'}`,
                                    color: warrantySuggestion === 'suggest_in_warranty' ? '#10B981' : '#fff', borderRadius: 8, cursor: 'pointer', transition: 'all 0.2s',
                                    fontWeight: warrantySuggestion === 'suggest_in_warranty' ? 600 : 400
                                }}
                            >建议保内</button>
                            <button
                                onClick={() => setWarrantySuggestion('suggest_out_warranty')}
                                style={{
                                    flex: 1, padding: '12px', background: warrantySuggestion === 'suggest_out_warranty' ? 'rgba(255,215,0,0.15)' : 'rgba(255,255,255,0.03)',
                                    border: `1px solid ${warrantySuggestion === 'suggest_out_warranty' ? '#FFD700' : 'rgba(255,255,255,0.1)'}`,
                                    color: warrantySuggestion === 'suggest_out_warranty' ? '#FFD700' : '#fff', borderRadius: 8, cursor: 'pointer', transition: 'all 0.2s',
                                    fontWeight: warrantySuggestion === 'suggest_out_warranty' ? 600 : 400
                                }}
                            >建议保外</button>
                            <button
                                onClick={() => setWarrantySuggestion('needs_verification')}
                                style={{
                                    flex: 1, padding: '12px', background: warrantySuggestion === 'needs_verification' ? 'rgba(59,130,246,0.15)' : 'rgba(255,255,255,0.03)',
                                    border: `1px solid ${warrantySuggestion === 'needs_verification' ? '#3B82F6' : 'rgba(255,255,255,0.1)'}`,
                                    color: warrantySuggestion === 'needs_verification' ? '#3B82F6' : '#fff', borderRadius: 8, cursor: 'pointer', transition: 'all 0.2s',
                                    fontWeight: warrantySuggestion === 'needs_verification' ? 600 : 400
                                }}
                            >需进一步核实</button>
                        </div>
                    </div>

                    {/* Media attachments */}
                    <div>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                            <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: '#aaa' }}>
                                <FileText size={14} /> 上传拆机判定照片/视频
                            </label>

                            <label style={{
                                padding: '6px 14px', fontSize: 13, display: 'flex', alignItems: 'center', gap: 6,
                                cursor: 'pointer', background: 'rgba(255,255,255,0.06)', borderRadius: 20, color: '#ccc', transition: 'background 0.2s'
                            }} onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.1)'} onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.06)'}>
                                <Paperclip size={14} /> 添加附件
                                <input type="file" multiple onChange={handleFileChange} style={{ display: 'none' }} />
                            </label>
                        </div>

                        {attachments.length > 0 && (
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginTop: 12 }}>
                                {attachments.map((file, idx) => (
                                    <div key={idx} style={{
                                        position: 'relative', background: 'rgba(255,255,255,0.03)',
                                        padding: '8px 12px', borderRadius: 8, fontSize: 12,
                                        color: '#ccc', border: '1px solid rgba(255,255,255,0.1)',
                                        display: 'flex', alignItems: 'center', gap: 6, maxWidth: '100%'
                                    }}>
                                        <Paperclip size={14} color="#666" />
                                        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 120 }}>{file.name}</span>
                                        <div style={{ color: '#666', fontSize: 10 }}>{(file.size / 1024 / 1024).toFixed(1)}MB</div>
                                        <button onClick={() => removeFile(idx)} style={{ background: 'none', border: 'none', padding: 0, marginLeft: 8, cursor: 'pointer', color: '#888' }}><X size={14} /></button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                {/* Footer Actions */}
                <div style={{ padding: '20px 24px', borderTop: '1px solid rgba(255,255,255,0.08)', display: 'flex', justifyContent: 'flex-end', gap: 12, background: 'rgba(0,0,0,0.2)' }}>
                    <button onClick={onClose} disabled={submitting} style={{ padding: '10px 20px', background: 'transparent', border: 'none', color: '#888', cursor: 'pointer', borderRadius: 8 }}>取消</button>
                    <button
                        onClick={handleSubmit}
                        disabled={submitting}
                        style={{
                            padding: '10px 24px', background: '#FFD700',
                            border: 'none', color: '#000', borderRadius: 8, fontWeight: 700,
                            cursor: submitting ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', gap: 8,
                            opacity: submitting ? 0.7 : 1
                        }}
                    >
                        {submitting ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                        提交报告并传给客服
                    </button>
                </div>
            </div>

            {/* Full Modal Loading Overlay (Matches MentionCommentInput exactly) */}
            {submitting && (
                <div style={{
                    position: 'absolute', inset: 0, zIndex: 999,
                    background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    flexDirection: 'column', gap: 12, borderRadius: 16,
                    border: '1px solid rgba(255,215,0,0.2)'
                }}>
                    <div className="animate-spin" style={{
                        width: 32, height: 32, border: '3px solid rgba(255,215,0,0.1)',
                        borderTopColor: '#FFD700', borderRadius: '50%'
                    }} />
                    <div style={{ fontSize: 13, color: '#FFD700', fontWeight: 600, textAlign: 'center' }}>
                        {attachments.length > 0 ? (
                            <>正在上传大文件...<br /><span style={{ fontSize: 11, opacity: 0.8 }}>请勿刷新或关闭页面</span></>
                        ) : '请稍候...'}
                    </div>
                </div>
            )}
        </div>
    );
};
