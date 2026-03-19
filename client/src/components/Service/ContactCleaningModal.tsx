import React, { useState } from 'react';
import { X, Check } from 'lucide-react';
import axios from 'axios';
import { useAuthStore } from '../../store/useAuthStore';

interface ContactCleaningModalProps {
    ticketId: number;
    accountId: number;
    accountName: string;
    reporterSnapshot: {
        name?: string;
        phone?: string;
        email?: string;
        [key: string]: any;
    };
    onClose: () => void;
    onSuccess: () => void;
}

const ContactCleaningModal: React.FC<ContactCleaningModalProps> = ({
    ticketId,
    accountId,
    accountName,
    reporterSnapshot,
    onClose,
    onSuccess
}) => {
    const { token } = useAuthStore();
    const [loading, setLoading] = useState(false);
    const [formData, setFormData] = useState({
        name: reporterSnapshot?.name || '',
        phone: reporterSnapshot?.phone || '',
        email: reporterSnapshot?.email || '',
        job_title: ''
    });

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        try {
            const res = await axios.post(`/api/v1/tickets/${ticketId}/clean-contact`, {
                account_id: accountId,
                ...formData
            }, {
                headers: { Authorization: `Bearer ${token}` }
            });

            if (res.data.success) {
                onSuccess();
            } else {
                alert(res.data.error || '清理失败');
            }
        } catch (err: any) {
            console.error('Clean contact error', err);
            alert(err.response?.data?.error || '网络错误');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 3000
        }}>
            <div style={{
                background: '#1E1E1E', width: 400, borderRadius: 12,
                boxShadow: '0 20px 40px rgba(0,0,0,0.4)',
                border: '1px solid rgba(255,255,255,0.1)'
            }}>
                <div style={{
                    padding: '16px 20px', borderBottom: '1px solid rgba(255,255,255,0.1)',
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between'
                }}>
                    <h3 style={{ margin: 0, fontSize: 16, color: '#fff' }}>新建联系人并清洗</h3>
                    <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: '#888', cursor: 'pointer' }}>
                        <X size={20} />
                    </button>
                </div>

                <form onSubmit={handleSubmit} style={{ padding: 20 }}>
                    <div style={{ marginBottom: 16 }}>
                        <label style={{ display: 'block', fontSize: 12, color: '#aaa', marginBottom: 6 }}>挂靠公司</label>
                        <div style={{
                            padding: '8px 12px', background: 'rgba(255,255,255,0.05)',
                            borderRadius: 6, color: '#888', fontSize: 14
                        }}>
                            {accountName} (自动绑定本工单)
                        </div>
                    </div>

                    <div style={{ marginBottom: 16 }}>
                        <label style={{ display: 'block', fontSize: 12, color: '#aaa', marginBottom: 6 }}>姓名 *</label>
                        <input
                            required
                            style={{
                                width: '100%', padding: '8px 12px', background: 'rgba(0,0,0,0.2)',
                                border: '1px solid rgba(255,255,255,0.1)', borderRadius: 6, color: '#fff', fontSize: 14
                            }}
                            value={formData.name}
                            onChange={e => setFormData({ ...formData, name: e.target.value })}
                        />
                    </div>

                    <div style={{ marginBottom: 16 }}>
                        <label style={{ display: 'block', fontSize: 12, color: '#aaa', marginBottom: 6 }}>电话</label>
                        <input
                            style={{
                                width: '100%', padding: '8px 12px', background: 'rgba(0,0,0,0.2)',
                                border: '1px solid rgba(255,255,255,0.1)', borderRadius: 6, color: '#fff', fontSize: 14
                            }}
                            value={formData.phone}
                            onChange={e => setFormData({ ...formData, phone: e.target.value })}
                        />
                    </div>

                    <div style={{ marginBottom: 16 }}>
                        <label style={{ display: 'block', fontSize: 12, color: '#aaa', marginBottom: 6 }}>邮箱 / 职位</label>
                        <div style={{ display: 'flex', gap: 12 }}>
                            <input
                                placeholder="Email"
                                style={{
                                    flex: 1, padding: '8px 12px', background: 'rgba(0,0,0,0.2)',
                                    border: '1px solid rgba(255,255,255,0.1)', borderRadius: 6, color: '#fff', fontSize: 14
                                }}
                                value={formData.email}
                                onChange={e => setFormData({ ...formData, email: e.target.value })}
                            />
                            <input
                                placeholder="职位 (Job Title)"
                                style={{
                                    flex: 1, padding: '8px 12px', background: 'rgba(0,0,0,0.2)',
                                    border: '1px solid rgba(255,255,255,0.1)', borderRadius: 6, color: '#fff', fontSize: 14
                                }}
                                value={formData.job_title}
                                onChange={e => setFormData({ ...formData, job_title: e.target.value })}
                            />
                        </div>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, marginTop: 24 }}>
                        <button type="button" onClick={onClose} style={{
                            padding: '8px 16px', background: 'transparent',
                            border: '1px solid rgba(255,255,255,0.2)', borderRadius: 6, color: '#ccc', cursor: 'pointer'
                        }}>取消</button>
                        <button type="submit" disabled={loading} style={{
                            padding: '8px 16px', background: 'var(--accent-blue)', display: 'flex', alignItems: 'center', gap: 6,
                            border: 'none', borderRadius: 6, color: '#fff', cursor: loading ? 'wait' : 'pointer', fontWeight: 600
                        }}>
                            <Check size={16} />
                            {loading ? '保存中...' : '确认入库并关联'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default ContactCleaningModal;
