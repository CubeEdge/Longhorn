import React, { useState } from 'react';
import { X, Save, Truck, Wrench, CreditCard, FileCheck, Loader2 } from 'lucide-react';
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

    // Form states
    const [formData, setFormData] = useState<any>({});

    if (!isOpen) return null;

    const currentNode = ticket.current_node;

    // Helper to render specific fields based on node
    const renderFields = () => {
        if (currentNode === 'op_repairing') {
            return (
                <>
                    <div style={{ marginBottom: 20 }}>
                        <label style={{ display: 'block', fontSize: 13, color: '#aaa', marginBottom: 8 }}>维修工作详述 (必填)</label>
                        <textarea
                            value={formData.repair_content || ''}
                            onChange={e => setFormData({ ...formData, repair_content: e.target.value })}
                            placeholder="请描述具体维修操作，如：更换了右侧接口板、重新焊接了排线..."
                            style={inputStyle}
                            rows={4}
                        />
                    </div>
                    <div>
                        <label style={{ display: 'block', fontSize: 13, color: '#aaa', marginBottom: 8 }}>老化/测试结论 (必填)</label>
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
                        <label style={{ display: 'block', fontSize: 13, color: '#aaa', marginBottom: 8 }}>物流快递公司 (必填)</label>
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
                        <label style={{ display: 'block', fontSize: 13, color: '#aaa', marginBottom: 8 }}>快递单号 (必填)</label>
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
                        <label style={{ display: 'block', fontSize: 13, color: '#aaa', marginBottom: 8 }}>报价单/PI 关联信息 (必填)</label>
                        <input
                            type="text"
                            value={formData.quote_reference || ''}
                            onChange={e => setFormData({ ...formData, quote_reference: e.target.value })}
                            placeholder="输入 PI 号或报价详情说明..."
                            style={inputStyle}
                        />
                        <p style={{ margin: '8px 0 0', fontSize: 11, color: '#777' }}>此单为【过保付费】，必须确认客户已同意报价方案。</p>
                    </div>
                </>
            );
        }

        if (currentNode === 'ms_closing' && !ticket.is_warranty) {
            return (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                    <div>
                        <label style={{ display: 'block', fontSize: 13, color: '#aaa', marginBottom: 8 }}>本次实收金额 (¥)</label>
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
                            <label style={{ display: 'block', fontSize: 12, color: '#888', marginBottom: 6 }}>收款日期</label>
                            <input
                                type="date"
                                value={formData.payment_date || new Date().toISOString().split('T')[0]}
                                onChange={e => setFormData({ ...formData, payment_date: e.target.value })}
                                style={inputStyle}
                            />
                        </div>
                        <div>
                            <label style={{ display: 'block', fontSize: 12, color: '#888', marginBottom: 6 }}>收款渠道</label>
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
        if (currentNode === 'ms_closing' && !ticket.is_warranty) {
            return formData.paid_amount && formData.payment_channel;
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
                logContent = `【批准维修】\n报价单/PI：${formData.quote_reference || '保修内单'}`;
            } else if (currentNode === 'ms_closing') {
                logContent = `【确认收款】\n金额：¥${formData.paid_amount}\n日期：${formData.payment_date}\n渠道：${formData.payment_channel}`;
            }

            await axios.post(`/api/v1/tickets/${ticket.id}/activities`, {
                activity_type: 'comment',
                content: logContent,
                visibility: 'all',
                metadata: {
                    action: actionLabel,
                    node_transition: `${currentNode} -> ${nextNode}`,
                    ...formData
                }
            }, { headers: { Authorization: `Bearer ${token}` } });

            // 2. Perform the actual transition
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
            if (currentNode === 'ms_closing') {
                patchData.payment_amount = formData.paid_amount;
                // Add more sync fields if backend supports them later
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
        if (currentNode === 'ms_closing') return <CreditCard size={24} color="#10B981" />;
        return <FileCheck size={24} color="#8B5CF6" />;
    };

    return (
        <div style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 1100,
            background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(8px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center'
        }}>
            <div style={{
                width: 440, background: '#1c1c1e', borderRadius: 16,
                border: '1px solid rgba(255,255,255,0.1)', overflow: 'hidden',
                boxShadow: '0 40px 80px rgba(0,0,0,0.8)',
                display: 'flex', flexDirection: 'column'
            }}>
                {/* Header */}
                <div style={{ padding: '20px 24px', borderBottom: '1px solid rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'rgba(255,255,255,0.01)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <div style={{ width: 40, height: 40, borderRadius: 10, background: 'rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            {getIcon()}
                        </div>
                        <div>
                            <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: '#fff' }}>确认执行: {actionLabel}</h3>
                            <p style={{ margin: 0, fontSize: 12, color: '#666', marginTop: 2 }}>{ticket.ticket_number}</p>
                        </div>
                    </div>
                    <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#666', cursor: 'pointer' }}>
                        <X size={20} />
                    </button>
                </div>

                {/* Body */}
                <div style={{ padding: 24 }}>
                    {renderFields()}
                </div>

                {/* Footer */}
                <div style={{ padding: '16px 24px', borderTop: '1px solid rgba(255,255,255,0.06)', display: 'flex', justifyContent: 'flex-end', gap: 12, background: 'rgba(0,0,0,0.2)' }}>
                    <button onClick={onClose} style={{ padding: '10px 20px', background: 'transparent', border: 'none', color: '#888', cursor: 'pointer', fontSize: 14 }}>取消</button>
                    <button
                        onClick={handleSubmit}
                        disabled={submitting}
                        style={{
                            padding: '10px 24px', background: currentNode === 'op_shipping' || currentNode === 'ms_closing' ? '#10B981' : '#3B82F6',
                            border: 'none', color: '#fff', borderRadius: 8, fontWeight: 700,
                            cursor: submitting ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', gap: 8,
                            fontSize: 14, opacity: submitting ? 0.7 : 1
                        }}
                    >
                        {submitting ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                        提交并结案
                    </button>
                </div>
            </div>
        </div>
    );
};

const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '12px',
    background: 'rgba(0,0,0,0.3)',
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: 8,
    color: '#fff',
    fontSize: 14,
    outline: 'none',
    boxSizing: 'border-box'
};
