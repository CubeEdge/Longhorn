import React, { useState } from 'react';
import { X, Check } from 'lucide-react';
import axios from 'axios';
import { useAuthStore } from '../../store/useAuthStore';

interface ConvertIndividualModalProps {
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

const ConvertIndividualModal: React.FC<ConvertIndividualModalProps> = ({
    ticketId,
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
        account_type: 'INDIVIDUAL',
        lifecycle_stage: 'PROSPECT'
    });

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        try {
            const res = await axios.post(`/api/v1/tickets/${ticketId}/convert-to-account`, formData, {
                headers: { Authorization: `Bearer ${token}` }
            });

            if (res.data.success) {
                onSuccess();
            } else {
                alert(res.data.error || '转为个人客户失败');
            }
        } catch (err: any) {
            console.error('Convert individual error', err);
            alert(err.response?.data?.error || '网络错误');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999
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
                    <h3 style={{ margin: 0, fontSize: 16, color: '#fff' }}>添加为新客户</h3>
                    <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: '#888', cursor: 'pointer' }}>
                        <X size={20} />
                    </button>
                </div>

                <form onSubmit={handleSubmit} style={{ padding: 20 }}>
                    {/* 客户类型选择 */}
                    <div style={{ marginBottom: 16 }}>
                        <label style={{ display: 'block', fontSize: 12, color: '#aaa', marginBottom: 8 }}>客户类型</label>
                        <div style={{ display: 'flex', gap: 12 }}>
                            <label style={{
                                flex: 1, display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px',
                                background: formData.account_type === 'INDIVIDUAL' ? 'rgba(59, 130, 246, 0.1)' : 'rgba(0,0,0,0.2)',
                                border: `1px solid ${formData.account_type === 'INDIVIDUAL' ? '#3B82F6' : 'rgba(255,255,255,0.1)'}`,
                                borderRadius: 6, cursor: 'pointer', color: formData.account_type === 'INDIVIDUAL' ? '#fff' : '#aaa', fontSize: 13
                            }}>
                                <input
                                    type="radio" name="account_type" value="INDIVIDUAL" checked={formData.account_type === 'INDIVIDUAL'}
                                    onChange={() => setFormData({ ...formData, account_type: 'INDIVIDUAL' })}
                                    style={{ display: 'none' }}
                                />
                                个人散客
                            </label>
                            <label style={{
                                flex: 1, display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px',
                                background: formData.account_type === 'ORGANIZATION' ? 'rgba(59, 130, 246, 0.1)' : 'rgba(0,0,0,0.2)',
                                border: `1px solid ${formData.account_type === 'ORGANIZATION' ? '#3B82F6' : 'rgba(255,255,255,0.1)'}`,
                                borderRadius: 6, cursor: 'pointer', color: formData.account_type === 'ORGANIZATION' ? '#fff' : '#aaa', fontSize: 13
                            }}>
                                <input
                                    type="radio" name="account_type" value="ORGANIZATION" checked={formData.account_type === 'ORGANIZATION'}
                                    onChange={() => setFormData({ ...formData, account_type: 'ORGANIZATION' })}
                                    style={{ display: 'none' }}
                                />
                                机构企业
                            </label>
                        </div>
                    </div>

                    {/* 生命周期选择 */}
                    <div style={{ marginBottom: 16 }}>
                        <label style={{ display: 'block', fontSize: 12, color: '#aaa', marginBottom: 8 }}>客户身份</label>
                        <div style={{ display: 'flex', gap: 12 }}>
                            <label style={{
                                flex: 1, display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px',
                                background: formData.lifecycle_stage === 'PROSPECT' ? 'rgba(16, 185, 129, 0.1)' : 'rgba(0,0,0,0.2)',
                                border: `1px solid ${formData.lifecycle_stage === 'PROSPECT' ? '#10B981' : 'rgba(255,255,255,0.1)'}`,
                                borderRadius: 6, cursor: 'pointer', color: formData.lifecycle_stage === 'PROSPECT' ? '#fff' : '#aaa', fontSize: 13
                            }}>
                                <input
                                    type="radio" name="lifecycle_stage" value="PROSPECT" checked={formData.lifecycle_stage === 'PROSPECT'}
                                    onChange={() => setFormData({ ...formData, lifecycle_stage: 'PROSPECT' })}
                                    style={{ display: 'none' }}
                                />
                                潜在客户 (Prospect)
                            </label>
                            <label style={{
                                flex: 1, display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px',
                                background: formData.lifecycle_stage === 'ACTIVE' ? 'rgba(16, 185, 129, 0.1)' : 'rgba(0,0,0,0.2)',
                                border: `1px solid ${formData.lifecycle_stage === 'ACTIVE' ? '#10B981' : 'rgba(255,255,255,0.1)'}`,
                                borderRadius: 6, cursor: 'pointer', color: formData.lifecycle_stage === 'ACTIVE' ? '#fff' : '#aaa', fontSize: 13
                            }}>
                                <input
                                    type="radio" name="lifecycle_stage" value="ACTIVE" checked={formData.lifecycle_stage === 'ACTIVE'}
                                    onChange={() => setFormData({ ...formData, lifecycle_stage: 'ACTIVE' })}
                                    style={{ display: 'none' }}
                                />
                                正式客户 (Active)
                            </label>
                        </div>
                    </div>

                    <div style={{ marginBottom: 16 }}>
                        <label style={{ display: 'block', fontSize: 12, color: '#aaa', marginBottom: 6 }}>
                            {formData.account_type === 'ORGANIZATION' ? '机构/企业名称 *' : '姓名 *'}
                        </label>
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
                        <label style={{ display: 'block', fontSize: 12, color: '#aaa', marginBottom: 6 }}>邮箱 / Email</label>
                        <input
                            placeholder="Email"
                            type="email"
                            style={{
                                width: '100%', padding: '8px 12px', background: 'rgba(0,0,0,0.2)',
                                border: '1px solid rgba(255,255,255,0.1)', borderRadius: 6, color: '#fff', fontSize: 14
                            }}
                            value={formData.email}
                            onChange={e => setFormData({ ...formData, email: e.target.value })}
                        />
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
                            {loading ? '保存中...' : '确认入库并绑定'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default ConvertIndividualModal;
