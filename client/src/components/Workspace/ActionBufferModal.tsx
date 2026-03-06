import React, { useState } from 'react';
import { X, Save, Truck, Wrench, CreditCard, FileCheck, Loader2, Camera, PackageOpen, Paperclip, AlertCircle, ShieldAlert, ShieldCheck } from 'lucide-react';
import axios from 'axios';
import { useAuthStore } from '../../store/useAuthStore';

interface ActionBufferModalProps {
    isOpen: boolean;
    onClose: () => void;
    ticket: any;
    nextNode: string;
    actionLabel: string;
    onSuccess: () => void;
}

export const ActionBufferModal: React.FC<ActionBufferModalProps> = ({ isOpen, onClose, ticket, nextNode, actionLabel, onSuccess }) => {
    const { token } = useAuthStore();
    const [submitting, setSubmitting] = useState(false);

    const [formData, setFormData] = useState<any>({});
    const [attachments, setAttachments] = useState<File[]>([]);
    const [snDiffers, setSnDiffers] = useState(false);

    if (!isOpen) return null;

    const currentNode = ticket.current_node;

    // Helper to render specific fields based on node
    const renderFields = () => {
        if (currentNode === 'op_repairing') {
            return (
                <>
                    <div style={{ marginBottom: 20 }}>
                        <label style={{ display: 'block', fontSize: 13, color: 'var(--text-tertiary)', marginBottom: 8 }}>维修工作详述 (必填)</label>
                        <textarea
                            value={formData.repair_content || ''}
                            onChange={e => setFormData({ ...formData, repair_content: e.target.value })}
                            placeholder="请描述具体维修操作，如：更换了右侧接口板、重新焊接了排线..."
                            style={inputStyle}
                            rows={4}
                        />
                    </div>
                    <div>
                        <label style={{ display: 'block', fontSize: 13, color: 'var(--text-tertiary)', marginBottom: 8 }}>老化/测试结论 (必填)</label>
                        <textarea
                            value={formData.test_result || ''}
                            onChange={e => setFormData({ ...formData, test_result: e.target.value })}
                            placeholder="如：烤机 24 小时未发现异常，各项功能测试通过。"
                            style={inputStyle}
                            rows={2}
                        />
                    </div>
                </>
            );
        }

        if (currentNode === 'op_shipping') {
            return (
                <>
                    <div style={{ marginBottom: 20 }}>
                        <label style={{ display: 'block', fontSize: 13, color: 'var(--text-tertiary)', marginBottom: 8 }}>物流快递公司 (必填)</label>
                        <select
                            value={formData.carrier || ''}
                            onChange={e => setFormData({ ...formData, carrier: e.target.value })}
                            style={inputStyle}
                        >
                            <option value="">选择快递...</option>
                            <option value="SF">顺丰速运 (SF Express)</option>
                            <option value="DHL">DHL</option>
                            <option value="FedEx">FedEx</option>
                            <option value="EMS">EMS</option>
                            <option value="Other">其他 (Other)</option>
                        </select>
                    </div>
                    <div>
                        <label style={{ display: 'block', fontSize: 13, color: 'var(--text-tertiary)', marginBottom: 8 }}>快递单号 (必填)</label>
                        <input
                            type="text"
                            value={formData.tracking_number || ''}
                            onChange={e => setFormData({ ...formData, tracking_number: e.target.value })}
                            placeholder="输入运单号..."
                            style={inputStyle}
                        />
                    </div>
                </>
            );
        }

        if (currentNode === 'ms_review' && !ticket.is_warranty) {
            return (
                <>
                    <div>
                        <label style={{ display: 'block', fontSize: 13, color: 'var(--text-tertiary)', marginBottom: 8 }}>报价单/PI 关联信息 (必填)</label>
                        <input
                            type="text"
                            value={formData.quote_reference || ''}
                            onChange={e => setFormData({ ...formData, quote_reference: e.target.value })}
                            placeholder="输入 PI 号或报价详情说明..."
                            style={inputStyle}
                        />
                        <p style={{ margin: '8px 0 0', fontSize: 11, color: 'var(--text-tertiary)' }}>此单为【过保付费】，必须确认客户已同意报价方案。</p>
                    </div>
                </>
            );
        }

        if (currentNode === 'ms_closing') {
            const isFirstClosing = Number(ticket.is_warranty) === 0 && (!ticket.payment_amount || Number(ticket.payment_amount) === 0);
            return (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px', background: 'var(--accent-subtle)', borderRadius: 10, border: '1px solid var(--glass-border-accent)' }}>
                        <CreditCard size={18} color="var(--accent-blue)" />
                        <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
                            {ticket.is_warranty
                                ? "此单为【保修内免费】，请确认客户信息无误后，准予发货。"
                                : (isFirstClosing
                                    ? "此单为【过保付费】，请确认客户已提供支付水单/截图，点击提交转交财务核款。"
                                    : "财务已确认收到款项，请执行最终审核，准予发货。")}
                        </span>
                    </div>
                    <div>
                        <label style={{ display: 'block', fontSize: 13, color: 'var(--text-tertiary)', marginBottom: 8 }}>补充声明/备注 (选填)</label>
                        <textarea
                            value={formData.closing_comment || ''}
                            onChange={e => setFormData({ ...formData, closing_comment: e.target.value })}
                            placeholder="如：客户收件地址已更新..."
                            style={inputStyle}
                            rows={3}
                        />
                    </div>
                </div>
            );
        }

        if (currentNode === 'ge_review') {
            return (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px', background: 'var(--badge-success-bg)', borderRadius: 10, border: '1px solid var(--badge-success-text)' }}>
                        <ShieldAlert size={18} color="var(--badge-success-text)" />
                        <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>财务核审：请核对银行/第三方平台对应流水，认领并确认到账。</span>
                    </div>
                    <div>
                        <label style={{ display: 'block', fontSize: 13, color: 'var(--text-tertiary)', marginBottom: 8 }}>本次实收金额 (¥) (必填)</label>
                        <input
                            type="number"
                            value={formData.paid_amount || ''}
                            onChange={e => setFormData({ ...formData, paid_amount: e.target.value })}
                            placeholder="0.00"
                            style={inputStyle}
                        />
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                        <div>
                            <label style={{ display: 'block', fontSize: 12, color: 'var(--text-tertiary)', marginBottom: 6 }}>收款日期</label>
                            <input
                                type="date"
                                value={formData.payment_date || new Date().toISOString().split('T')[0]}
                                onChange={e => setFormData({ ...formData, payment_date: e.target.value })}
                                style={inputStyle}
                            />
                        </div>
                        <div>
                            <label style={{ display: 'block', fontSize: 12, color: 'var(--text-tertiary)', marginBottom: 6 }}>收款渠道 (必选)</label>
                            <select
                                value={formData.payment_channel || ''}
                                onChange={e => setFormData({ ...formData, payment_channel: e.target.value })}
                                style={inputStyle}
                            >
                                <option value="">选择渠道...</option>
                                <option value="bank">银行对公</option>
                                <option value="alipay">支付宝</option>
                                <option value="wechat">微信支付</option>
                                <option value="cash">现金</option>
                                <option value="offset">对冲/其他</option>
                            </select>
                        </div>
                    </div>
                </div>
            );
        }

        if (currentNode === 'op_receiving' || currentNode === 'submitted') {
            return (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px', background: 'rgba(255,255,0,0.05)', borderRadius: 10, border: '1px solid rgba(255,255,0,0.1)' }}>
                        <AlertCircle size={16} color="#FFD700" />
                        <span style={{ fontSize: 13, color: '#ddd' }}>[OP建议] 请确认实物无误并拍照留存。</span>
                    </div>

                    <div>
                        <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: '#aaa', marginBottom: 8, cursor: 'pointer' }}>
                            <input
                                type="checkbox"
                                checked={snDiffers}
                                onChange={e => setSnDiffers(e.target.checked)}
                                style={{ accentColor: '#3B82F6' }}
                            />
                            实物序列号与报修不符？
                        </label>
                        {snDiffers && (
                            <input
                                type="text"
                                value={formData.at_receipt_sn || ''}
                                onChange={e => setFormData({ ...formData, at_receipt_sn: e.target.value })}
                                placeholder="请输入正确的实物序列号 (必填)"
                                style={{ ...inputStyle, borderColor: '#3B82F6', boxShadow: '0 0 0 2px rgba(59,130,246,0.1)' }}
                            />
                        )}
                    </div>

                    <div>
                        <label style={{ display: 'block', fontSize: 13, color: '#aaa', marginBottom: 8 }}>收货备注 / 问题初判 (可选)</label>
                        <textarea
                            value={formData.receipt_notes || ''}
                            onChange={e => setFormData({ ...formData, receipt_notes: e.target.value })}
                            placeholder="如：包装破损、缺少配件..."
                            style={inputStyle}
                            rows={2}
                        />
                    </div>

                    <div>
                        <label style={{ display: 'block', fontSize: 13, color: 'var(--text-tertiary)', marginBottom: 8 }}>上传开箱照片 (可选)</label>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                            <label style={{
                                width: 50, height: 50, borderRadius: 8, border: '1px dashed var(--card-border)',
                                display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: 'var(--text-tertiary)'
                            }}>
                                <Camera size={20} />
                                <input type="file" multiple onChange={e => e.target.files && setAttachments(prev => [...prev, ...Array.from(e.target.files!)])} style={{ display: 'none' }} />
                            </label>
                            {attachments.map((_, i) => (
                                <div key={i} style={{ width: 50, height: 50, borderRadius: 8, background: 'var(--bg-sidebar)', border: '1px solid var(--card-border)', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
                                    <Paperclip size={16} color="var(--text-tertiary)" />
                                    <button onClick={() => setAttachments(attachments.filter((_, idx) => idx !== i))} style={{ position: 'absolute', top: -5, right: -5, background: '#ef4444', border: 'none', borderRadius: '50%', width: 16, height: 16, color: '#fff', fontSize: 10, cursor: 'pointer' }}>×</button>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            );
        }

        return <div style={{ color: '#888', textAlign: 'center', padding: '20px 0' }}>确认执行此操作吗？</div>;
    };

    const validate = () => {
        if (currentNode === 'op_repairing') {
            return formData.repair_content?.trim() && formData.test_result?.trim();
        }
        if (currentNode === 'op_shipping') {
            return formData.carrier?.trim() && formData.tracking_number?.trim();
        }
        if (currentNode === 'ms_review' && !ticket.is_warranty) {
            return formData.quote_reference?.trim();
        }
        if (currentNode === 'ms_closing') {
            return true; // Simple confirmation
        }
        if (currentNode === 'ge_review') {
            return formData.paid_amount && formData.payment_channel;
        }
        if ((currentNode === 'op_receiving' || currentNode === 'submitted') && snDiffers) {
            return !!formData.at_receipt_sn?.trim();
        }
        return true;
    };

    const handleSubmit = async () => {
        if (!validate()) {
            alert('请完整填写必填项！');
            return;
        }

        setSubmitting(true);
        try {
            // 1. Create a log activity for the provided information
            let logContent = `执行了 ${actionLabel} 动作`;
            if (currentNode === 'op_repairing') {
                logContent = `【维修结案报告】\n内容：${formData.repair_content}\n测试结果：${formData.test_result}`;
            } else if (currentNode === 'op_shipping') {
                logContent = `【发货物流录入】\n承运商：${formData.carrier}\n单号：${formData.tracking_number}`;
            } else if (currentNode === 'ms_review') {
                logContent = `【批准维修】商业方案与报价已获客户确认`;
            } else if (currentNode === 'ms_closing') {
                logContent = `【结案确认】\n备注：${formData.closing_comment || '无'}`;
            } else if (currentNode === 'ge_review') {
                logContent = `【财务收款确认】财务部已核实并确认相关款项核销到账`;
            } else if (currentNode === 'op_receiving' || currentNode === 'submitted') {
                logContent = `【完成收货入库】${formData.at_receipt_sn ? `\n修正序列号：${formData.at_receipt_sn}` : ''}\n备注：${formData.receipt_notes || '无'}`;
            }

            const activityRes = await axios.post(`/api/v1/tickets/${ticket.id}/activities`, {
                activity_type: 'comment',
                content: logContent,
                visibility: 'all',
                metadata: {
                    action: actionLabel,
                    node_transition: `${currentNode} -> ${nextNode}`,
                    ...formData
                }
            }, { headers: { Authorization: `Bearer ${token}` } });

            const activityId = activityRes.data.id;

            // 2. Handle file uploads if any
            if (attachments.length > 0) {
                const formDataUpload = new FormData();
                attachments.forEach(file => formDataUpload.append('files', file));
                await axios.post(`/api/v1/tickets/${ticket.id}/attachments?activity_id=${activityId}`, formDataUpload, {
                    headers: {
                        Authorization: `Bearer ${token}`,
                        'Content-Type': 'multipart/form-data'
                    }
                });
            }

            // 3. Perform the actual transition
            // Update fields in the ticket record as well
            const patchData: any = {
                current_node: nextNode,
                change_reason: `流程推进: ${actionLabel}`
            };

            // Sync certain fields back to main ticket table if appropriate
            if (currentNode === 'op_shipping') {
                patchData.shipping_tracking_number = formData.tracking_number;
                patchData.shipping_carrier = formData.carrier;
            }
            if (currentNode === 'ge_review') {
                patchData.payment_amount = formData.paid_amount;
            }
            if ((currentNode === 'op_receiving' || currentNode === 'submitted') && snDiffers && formData.at_receipt_sn) {
                patchData.serial_number = formData.at_receipt_sn;
            }

            await axios.patch(`/api/v1/tickets/${ticket.id}`, patchData, { headers: { Authorization: `Bearer ${token}` } });

            onSuccess();
            onClose();
        } catch (err: any) {
            alert(err.response?.data?.error || err.message);
        } finally {
            setSubmitting(false);
        }
    };

    const getIcon = () => {
        if (currentNode === 'op_repairing') return <Wrench size={24} color="#3B82F6" />;
        if (currentNode === 'op_shipping') return <Truck size={24} color="#10B981" />;
        if (currentNode === 'ms_closing') return <CreditCard size={24} color="#3B82F6" />;
        if (currentNode === 'ge_review') return <ShieldCheck size={24} color="#10B981" />;
        if (currentNode === 'op_receiving' || currentNode === 'submitted') return <PackageOpen size={24} color="#3B82F6" />;
        return <FileCheck size={24} color="#8B5CF6" />;
    };

    return (
        <div style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 1100,
            background: 'var(--modal-overlay)', backdropFilter: 'var(--glass-blur)',
            display: 'flex', alignItems: 'center', justifyContent: 'center'
        }}>
            <div style={{
                width: 440, background: 'var(--modal-bg)', borderRadius: 16,
                border: '1px solid var(--card-border)', overflow: 'hidden',
                boxShadow: 'var(--glass-shadow-lg)',
                display: 'flex', flexDirection: 'column'
            }}>
                {/* Header */}
                <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--card-border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'var(--glass-bg-light)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <div style={{ width: 40, height: 40, borderRadius: 10, background: 'var(--bg-sidebar)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            {getIcon()}
                        </div>
                        <div>
                            <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: 'var(--text-main)' }}>确认执行: {actionLabel}</h3>
                            <p style={{ margin: 0, fontSize: 12, color: 'var(--text-tertiary)', marginTop: 2 }}>{ticket.ticket_number}</p>
                        </div>
                    </div>
                    <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-tertiary)', cursor: 'pointer' }}>
                        <X size={20} />
                    </button>
                </div>

                {/* Body */}
                <div style={{ padding: 24 }}>
                    {renderFields()}
                </div>

                {/* Footer */}
                <div style={{ padding: '16px 24px', borderTop: '1px solid var(--card-border)', display: 'flex', justifyContent: 'flex-end', gap: 12, background: 'var(--bg-sidebar)' }}>
                    <button onClick={onClose} style={{ padding: '10px 20px', background: 'transparent', border: 'none', color: 'var(--text-tertiary)', cursor: 'pointer', fontSize: 14 }}>取消</button>
                    <button
                        onClick={handleSubmit}
                        disabled={submitting}
                        style={{
                            padding: '10px 24px', background: 'var(--accent-blue)',
                            border: 'none', color: '#000', borderRadius: 8, fontWeight: 700,
                            cursor: submitting ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', gap: 8,
                            fontSize: 14, opacity: submitting ? 0.7 : 1,
                            boxShadow: 'var(--glass-shadow-accent)'
                        }}
                    >
                        {submitting ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                        提交并推进至下个环节
                    </button>
                </div>
            </div>
        </div>
    );
};

const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '12px',
    background: 'var(--card-bg-light)',
    border: '1px solid var(--card-border)',
    borderRadius: 8,
    color: 'var(--text-main)',
    fontSize: 14,
    outline: 'none',
    boxSizing: 'border-box'
};
