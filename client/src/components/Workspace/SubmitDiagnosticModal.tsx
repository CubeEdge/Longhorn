import React, { useState } from 'react';
import { X, Save, FileText, Wrench, AlertTriangle, Paperclip, Loader2 } from 'lucide-react';
import axios from 'axios';
import { useAuthStore } from '../../store/useAuthStore';

interface SubmitDiagnosticModalProps {
    isOpen: boolean;
    onClose: () => void;
    ticketId: number;
    ticketNumber: string;
    onSuccess: () => void;
}

export const SubmitDiagnosticModal: React.FC<SubmitDiagnosticModalProps> = ({ isOpen, onClose, ticketId, ticketNumber, onSuccess }) => {
    const { token } = useAuthStore();
    const [submitting, setSubmitting] = useState(false);

    // Form State
    const [diagnosis, setDiagnosis] = useState('');
    const [repairAdvice, setRepairAdvice] = useState('');
    const [damageStatus, setDamageStatus] = useState<'no_damage' | 'physical_damage' | 'uncertain' | ''>('');
    const [warrantySuggestion, setWarrantySuggestion] = useState<'suggest_in_warranty' | 'suggest_out_warranty' | 'needs_verification' | ''>('');
    const [attachments, setAttachments] = useState<File[]>([]);

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
            formData.append('content', '提交了详细诊断报告与故障确认。');
            formData.append('visibility', 'all');

            // Build metadata with new technical assessment fields
            const metadata = {
                diagnosis: diagnosis.trim(),
                repair_advice: repairAdvice.trim(),
                technical_damage_status: damageStatus,
                technical_warranty_suggestion: warrantySuggestion,
                submission_type: 'technical_diagnosis'
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
                change_reason: '完成技术诊断，流向商务审核 (MS Review)'
            }, { headers: { Authorization: `Bearer ${token}` } });

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
                            <AlertTriangle size={14} color="#F59E0B" /> 故障判定 (必填)
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

                    {/* Technical Damage Assessment */}
                    <div>
                        <label style={{ display: 'block', fontSize: 13, color: '#aaa', marginBottom: 12 }}>
                            <AlertTriangle size={14} style={{ marginRight: 6, verticalAlign: 'middle', color: '#F59E0B' }} />
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
                                    border: `1px solid ${damageStatus === 'uncertain' ? '#F59E0B' : 'rgba(255,255,255,0.1)'}`,
                                    color: damageStatus === 'uncertain' ? '#F59E0B' : '#fff', borderRadius: 8, cursor: 'pointer', transition: 'all 0.2s',
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
