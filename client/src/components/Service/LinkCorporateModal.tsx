import React, { useState } from 'react';
import { X, Check } from 'lucide-react';
import axios from 'axios';
import { useAuthStore } from '../../store/useAuthStore';
import AccountContactSelector from '../AccountContactSelector';

interface LinkCorporateModalProps {
    ticketId: number;
    reporterSnapshot: {
        name?: string;
        phone?: string;
        email?: string;
        [key: string]: any;
    };
    onClose: () => void;
    onSuccess: () => void;
}

const LinkCorporateModal: React.FC<LinkCorporateModalProps> = ({
    ticketId,
    reporterSnapshot,
    onClose,
    onSuccess
}) => {
    const { token } = useAuthStore();
    const [loading, setLoading] = useState(false);
    const [selection, setSelection] = useState<{
        account_id?: number;
        contact_id?: number;
        reporter_name?: string;
    }>({});

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!selection.account_id) {
            alert('请先选择要关联的企业/客户');
            return;
        }

        setLoading(true);
        try {
            // Use the standard update ticket API
            const res = await axios.put(`/api/v1/tickets/${ticketId}`, {
                account_id: selection.account_id,
                contact_id: selection.contact_id || null, // Allow null for temporary corporate contacts
                reporter_name: selection.reporter_name || reporterSnapshot?.name || undefined
            }, {
                headers: { Authorization: `Bearer ${token}` }
            });

            if (res.data.success) {
                onSuccess();
            } else {
                alert(res.data.error || '关联失败');
            }
        } catch (err: any) {
            console.error('Link corporate error', err);
            alert(err.response?.data?.error || '网络错误');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000
        }}>
            <div style={{
                background: '#1E1E1E', width: 500, borderRadius: 12,
                boxShadow: '0 20px 40px rgba(0,0,0,0.4)',
                border: '1px solid rgba(255,255,255,0.1)',
                display: 'flex', flexDirection: 'column',
                maxHeight: '90vh'
            }}>
                <div style={{
                    padding: '16px 20px', borderBottom: '1px solid rgba(255,255,255,0.1)',
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    flexShrink: 0
                }}>
                    <h3 style={{ margin: 0, fontSize: 16, color: '#fff' }}>关联到企业客户</h3>
                    <button type="button" onClick={onClose} style={{ background: 'transparent', border: 'none', color: '#888', cursor: 'pointer' }}>
                        <X size={20} />
                    </button>
                </div>

                <div style={{ padding: 20, overflowY: 'auto' }}>
                    <div style={{ marginBottom: 16 }}>
                        <div style={{ fontSize: 13, color: '#aaa', marginBottom: 12, lineHeight: 1.5 }}>
                            选择现有的客户档案进行关联。如果该联络人未建档，您可以留空联系人，作为该公司的「临时对接人」(状态 2)。
                        </div>
                        {reporterSnapshot?.name && (
                            <div style={{
                                padding: '8px 12px', background: 'rgba(255, 255, 255, 0.05)',
                                border: '1px solid rgba(255, 255, 255, 0.1)', borderRadius: 6,
                                fontSize: 13, color: '#ddd', marginBottom: 16
                            }}>
                                <strong>当前访客快照：</strong> {reporterSnapshot.name} {reporterSnapshot.email ? `<${reporterSnapshot.email}>` : ''} {reporterSnapshot.phone || ''}
                            </div>
                        )}
                    </div>

                    {/* Dark Mode Overrides for AccountContactSelector */}
                    <div className="account-contact-selector-wrapper" style={{ minHeight: 150 }}>
                        <style>{`
                            .account-contact-selector-wrapper input {
                                background: rgba(0,0,0,0.2) !important;
                                border: 1px solid rgba(255,255,255,0.1) !important;
                                color: #fff !important;
                            }
                            .account-contact-selector-wrapper label {
                                color: #ccc !important;
                            }
                            .account-contact-selector-wrapper .bg-white {
                                background: #2A2A2A !important;
                                border-color: rgba(255,255,255,0.1) !important;
                            }
                            .account-contact-selector-wrapper .hover\\:bg-gray-50:hover {
                                background: rgba(255,255,255,0.05) !important;
                            }
                            .account-contact-selector-wrapper .text-gray-900 {
                                color: #fff !important;
                            }
                            .account-contact-selector-wrapper .text-gray-500 {
                                color: #aaa !important;
                            }
                            .account-contact-selector-wrapper .border-gray-100 {
                                border-color: rgba(255,255,255,0.1) !important;
                            }
                            .account-contact-selector-wrapper .bg-gray-50 {
                                background: rgba(255,255,255,0.05) !important;
                            }
                            .account-contact-selector-wrapper .border-gray-200 {
                                border-color: rgba(255,255,255,0.2) !important;
                            }
                            .account-contact-selector-wrapper .text-gray-700 {
                                color: #ddd !important;
                            }
                        `}</style>
                        <AccountContactSelector
                            value={selection}
                            onChange={setSelection}
                            disabled={loading}
                        />
                    </div>
                </div>

                <div style={{ padding: '16px 20px', borderTop: '1px solid rgba(255,255,255,0.1)', display: 'flex', justifyContent: 'flex-end', gap: 12, flexShrink: 0 }}>
                    <button type="button" onClick={onClose} style={{
                        padding: '8px 16px', background: 'transparent',
                        border: '1px solid rgba(255,255,255,0.2)', borderRadius: 6, color: '#ccc', cursor: 'pointer'
                    }}>取消</button>
                    <button onClick={handleSubmit} disabled={loading || !selection.account_id} style={{
                        padding: '8px 16px', background: 'var(--accent-blue)', display: 'flex', alignItems: 'center', gap: 6,
                        border: 'none', borderRadius: 6, color: '#fff', cursor: (loading || !selection.account_id) ? 'not-allowed' : 'pointer', fontWeight: 600,
                        opacity: (!selection.account_id) ? 0.5 : 1
                    }}>
                        <Check size={16} />
                        {loading ? '处理中...' : '确认关联'}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default LinkCorporateModal;
