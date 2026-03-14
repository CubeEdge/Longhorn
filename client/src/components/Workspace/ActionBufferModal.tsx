import React, { useState, useEffect } from 'react';
import { X, Save, Truck, Wrench, CreditCard, FileCheck, Loader2, Camera, PackageOpen, Paperclip, AlertCircle, ShieldAlert, ShieldCheck, Users, Package, Plane, RefreshCw } from 'lucide-react';
import axios from 'axios';
import { useAuthStore } from '../../store/useAuthStore';

// 发货方式类型
type ShippingMethod = 'express' | 'forwarder' | 'pickup' | 'combined';

interface ActionBufferModalProps {
    isOpen: boolean;
    onClose: () => void;
    ticket: any;
    nextNode: string;
    actionLabel: string;
    onSuccess: () => void;
    // 编辑模式支持（用于更正历史记录）
    editMode?: boolean;
    editData?: Record<string, unknown> | null;
    editActivityId?: number | null;
    editNodeType?: 'op_receive' | 'op_shipping' | null;  // 指定要编辑的节点类型
}

export const ActionBufferModal: React.FC<ActionBufferModalProps> = ({ 
    isOpen, onClose, ticket, nextNode, actionLabel, onSuccess,
    editMode = false, editData = null, editActivityId = null, editNodeType = null
}) => {
    const { token } = useAuthStore();
    const [submitting, setSubmitting] = useState(false);

    const [formData, setFormData] = useState<any>({});
    const [attachments, setAttachments] = useState<File[]>([]);
    const [snDiffers, setSnDiffers] = useState(false);
    const [shippingMethod, setShippingMethod] = useState<ShippingMethod>('express');

    // 编辑模式：预填数据
    useEffect(() => {
        if (editMode && editData && isOpen) {
            const data = editData as any;
            setFormData(data);
            // 恢复发货方式
            if (data.shipping_method) {
                setShippingMethod(data.shipping_method as ShippingMethod);
            }
            // 恢复序列号修正状态
            if (data.at_receipt_sn) {
                setSnDiffers(true);
            }
        } else if (!isOpen) {
            // 关闭时重置
            setFormData({});
            setAttachments([]);
            setSnDiffers(false);
            setShippingMethod('express');
        }
    }, [editMode, editData, isOpen]);

    if (!isOpen) return null;

    // 编辑模式下使用 editNodeType 指定的节点类型，否则使用当前节点
    const currentNode = editMode && editNodeType 
        ? (editNodeType === 'op_receive' ? 'op_receiving' : 'op_shipping')
        : ticket.current_node;

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
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                    {/* 发货方式选择 */}
                    <div>
                        <label style={{ display: 'block', fontSize: 13, color: 'var(--text-tertiary)', marginBottom: 10 }}>发货方式 (必选)</label>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8 }}>
                            {[
                                { value: 'express', label: '快递直发', icon: <Truck size={16} />, desc: '国内/国际快递' },
                                { value: 'forwarder', label: '货代中转', icon: <Plane size={16} />, desc: '国际货代转运' },
                                { value: 'pickup', label: '客户自提', icon: <Users size={16} />, desc: '面交/线下带走' },
                                { value: 'combined', label: '合并发货', icon: <Package size={16} />, desc: '随其他订单寄出' },
                            ].map(opt => (
                                <button
                                    key={opt.value}
                                    type="button"
                                    onClick={() => { setShippingMethod(opt.value as ShippingMethod); setFormData({}); }}
                                    style={{
                                        padding: '12px', background: shippingMethod === opt.value ? 'var(--accent-subtle)' : 'var(--card-bg-light)',
                                        border: `1px solid ${shippingMethod === opt.value ? 'var(--accent-blue)' : 'var(--card-border)'}`,
                                        borderRadius: 10, cursor: 'pointer', textAlign: 'left',
                                        display: 'flex', flexDirection: 'column', gap: 4
                                    }}
                                >
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: shippingMethod === opt.value ? 'var(--accent-blue)' : 'var(--text-main)', fontWeight: 600, fontSize: 13 }}>
                                        {opt.icon} {opt.label}
                                    </div>
                                    <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{opt.desc}</span>
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* 快递直发表单 */}
                    {shippingMethod === 'express' && (
                        <>
                            <div>
                                <label style={{ display: 'block', fontSize: 13, color: 'var(--text-tertiary)', marginBottom: 8 }}>物流快递公司 (必填)</label>
                                <select value={formData.carrier || ''} onChange={e => setFormData({ ...formData, carrier: e.target.value })} style={inputStyle}>
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
                                <input type="text" value={formData.tracking_number || ''} onChange={e => setFormData({ ...formData, tracking_number: e.target.value })} placeholder="输入运单号..." style={inputStyle} />
                            </div>
                        </>
                    )}

                    {/* 货代中转表单 */}
                    {shippingMethod === 'forwarder' && (
                        <>
                            <div style={{ padding: '10px 12px', background: 'rgba(255,200,0,0.08)', borderRadius: 8, border: '1px solid rgba(255,200,0,0.2)' }}>
                                <span style={{ fontSize: 12, color: '#ffc800' }}>📦 货代中转：提交后工单进入【待补外销单号】状态，待取得国际运单后再补充结案。</span>
                            </div>
                            <div>
                                <label style={{ display: 'block', fontSize: 13, color: 'var(--text-tertiary)', marginBottom: 8 }}>货代公司名称 (必填)</label>
                                <input type="text" value={formData.forwarder_name || ''} onChange={e => setFormData({ ...formData, forwarder_name: e.target.value })} placeholder="如：中外运、嘉里大通..." style={inputStyle} />
                            </div>
                            <div>
                                <label style={{ display: 'block', fontSize: 13, color: 'var(--text-tertiary)', marginBottom: 8 }}>发往货代的国内单号 (必填)</label>
                                <input type="text" value={formData.forwarder_domestic_tracking || ''} onChange={e => setFormData({ ...formData, forwarder_domestic_tracking: e.target.value })} placeholder="顺丰/中通等国内段运单号..." style={inputStyle} />
                            </div>
                        </>
                    )}

                    {/* 客户自提表单 */}
                    {shippingMethod === 'pickup' && (
                        <>
                            <div>
                                <label style={{ display: 'block', fontSize: 13, color: 'var(--text-tertiary)', marginBottom: 8 }}>提货人/带货人信息 (必填)</label>
                                <input type="text" value={formData.pickup_person || ''} onChange={e => setFormData({ ...formData, pickup_person: e.target.value })} placeholder="姓名、联系方式..." style={inputStyle} />
                            </div>
                            <div>
                                <label style={{ display: 'block', fontSize: 13, color: 'var(--text-tertiary)', marginBottom: 8 }}>拍照留档 (建议)</label>
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                                    <label style={{ width: 50, height: 50, borderRadius: 8, border: '1px dashed var(--card-border)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: 'var(--text-tertiary)' }}>
                                        <Camera size={20} />
                                        <input type="file" accept="image/*" multiple onChange={e => e.target.files && setAttachments(prev => [...prev, ...Array.from(e.target.files!)])} style={{ display: 'none' }} />
                                    </label>
                                    {attachments.map((_, i) => (
                                        <div key={i} style={{ width: 50, height: 50, borderRadius: 8, background: 'var(--bg-sidebar)', border: '1px solid var(--card-border)', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
                                            <Paperclip size={16} color="var(--text-tertiary)" />
                                            <button onClick={() => setAttachments(attachments.filter((__, idx) => idx !== i))} style={{ position: 'absolute', top: -5, right: -5, background: '#ef4444', border: 'none', borderRadius: '50%', width: 16, height: 16, color: '#fff', fontSize: 10, cursor: 'pointer' }}>×</button>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </>
                    )}

                    {/* 合并发货表单 */}
                    {shippingMethod === 'combined' && (
                        <>
                            <div>
                                <label style={{ display: 'block', fontSize: 13, color: 'var(--text-tertiary)', marginBottom: 8 }}>关联工单/销售单号 (必填)</label>
                                <input type="text" value={formData.associated_order_ref || ''} onChange={e => setFormData({ ...formData, associated_order_ref: e.target.value })} placeholder="RMA-xxx 或 Shopify Order ID..." style={inputStyle} />
                            </div>
                            <div>
                                <label style={{ display: 'block', fontSize: 13, color: 'var(--text-tertiary)', marginBottom: 8 }}>合单快递单号 (选填)</label>
                                <input type="text" value={formData.tracking_number || ''} onChange={e => setFormData({ ...formData, tracking_number: e.target.value })} placeholder="统一发货的总快递单号..." style={inputStyle} />
                            </div>
                        </>
                    )}
                </div>
            );
        }

        // 货代中转 - 补单结案
        if (currentNode === 'op_shipping_transit') {
            return (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                    <div style={{ padding: '10px 12px', background: 'var(--badge-success-bg)', borderRadius: 8, border: '1px solid var(--badge-success-text)' }}>
                        <span style={{ fontSize: 12, color: 'var(--badge-success-text)' }}>✅ 请补充最终国际运单号，完成后工单将正式结案。</span>
                    </div>
                    <div>
                        <label style={{ display: 'block', fontSize: 13, color: 'var(--text-tertiary)', marginBottom: 8 }}>国际运单号 (必填)</label>
                        <input type="text" value={formData.forwarder_final_tracking || ''} onChange={e => setFormData({ ...formData, forwarder_final_tracking: e.target.value })} placeholder="DHL/FedEx/UPS 等国际运单号..." style={inputStyle} />
                    </div>
                    <div>
                        <label style={{ display: 'block', fontSize: 13, color: 'var(--text-tertiary)', marginBottom: 8 }}>备注 (选填)</label>
                        <textarea value={formData.closing_comment || ''} onChange={e => setFormData({ ...formData, closing_comment: e.target.value })} placeholder="其他补充说明..." style={inputStyle} rows={2} />
                    </div>
                </div>
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
            if (shippingMethod === 'express') {
                return formData.carrier?.trim() && formData.tracking_number?.trim();
            }
            if (shippingMethod === 'forwarder') {
                return formData.forwarder_name?.trim() && formData.forwarder_domestic_tracking?.trim();
            }
            if (shippingMethod === 'pickup') {
                return formData.pickup_person?.trim();
            }
            if (shippingMethod === 'combined') {
                return formData.associated_order_ref?.trim();
            }
            return false;
        }
        if (currentNode === 'op_shipping_transit') {
            return formData.forwarder_final_tracking?.trim();
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
            // 构建活动内容
            let logContent = `执行了 ${actionLabel} 动作`;
            let activityType = 'comment';  // 默认为评论类型
            
            if (currentNode === 'op_repairing') {
                logContent = `【维修结案报告】\n内容：${formData.repair_content}\n测试结果：${formData.test_result}`;
            } else if (currentNode === 'op_shipping') {
                activityType = 'shipping_info';
                if (shippingMethod === 'express') {
                    logContent = `【快递直发】\n承运商：${formData.carrier}\n单号：${formData.tracking_number}`;
                } else if (shippingMethod === 'forwarder') {
                    logContent = `【货代中转】件已发出，待补外销单号\n货代公司：${formData.forwarder_name}\n国内段单号：${formData.forwarder_domestic_tracking}`;
                } else if (shippingMethod === 'pickup') {
                    logContent = `【自提/面交】\n经办人：${formData.pickup_person}${attachments.length > 0 ? '\n(附照片凭证)' : ''}`;
                } else if (shippingMethod === 'combined') {
                    logContent = `【合并发货】随订单 ${formData.associated_order_ref} 发出${formData.tracking_number ? `\n合单运单号：${formData.tracking_number}` : ''}`;
                }
            } else if (currentNode === 'op_shipping_transit') {
                activityType = 'shipping_info';
                logContent = `【补充外销单号】\n国际运单号：${formData.forwarder_final_tracking}${formData.closing_comment ? `\n备注：${formData.closing_comment}` : ''}`;
            } else if (currentNode === 'ms_review') {
                logContent = `【批准维修】商业方案与报价已获客户确认`;
            } else if (currentNode === 'ms_closing') {
                logContent = `【结案确认】\n备注：${formData.closing_comment || '无'}`;
            } else if (currentNode === 'ge_review') {
                logContent = `【财务收款确认】财务部已核实并确认相关款项核销到账`;
            } else if (currentNode === 'op_receiving' || currentNode === 'submitted') {
                activityType = 'receiving_info';
                logContent = `【完成收货入库】${formData.at_receipt_sn ? `\n修正序列号：${formData.at_receipt_sn}` : ''}\n备注：${formData.receipt_notes || '无'}`;
            }

            // ===== 编辑模式：更新现有活动，不推进节点 =====
            if (editMode && editActivityId) {
                // 更新现有活动
                await axios.patch(`/api/v1/tickets/${ticket.id}/activities/${editActivityId}`, {
                    content: `[已更正] ${logContent}`,
                    metadata: {
                        ...formData,
                        shipping_method: currentNode === 'op_shipping' ? shippingMethod : undefined,
                        corrected_at: new Date().toISOString()
                    }
                }, { headers: { Authorization: `Bearer ${token}` } });

                // 记录更正日志
                await axios.post(`/api/v1/tickets/${ticket.id}/activities`, {
                    activity_type: 'internal_note',
                    content: `更正了${editNodeType === 'op_receive' ? '收货信息' : '发货信息'}`,
                    visibility: 'internal'
                }, { headers: { Authorization: `Bearer ${token}` } });

                onSuccess();
                onClose();
                return;
            }

            // ===== 正常模式：创建活动并推进节点 =====
            const activityRes = await axios.post(`/api/v1/tickets/${ticket.id}/activities`, {
                activity_type: activityType,
                content: logContent,
                visibility: 'all',
                metadata: {
                    action: actionLabel,
                    node_transition: `${currentNode} -> ${nextNode}`,
                    shipping_method: currentNode === 'op_shipping' ? shippingMethod : undefined,
                    ...formData
                }
            }, { headers: { Authorization: `Bearer ${token}` } });

            const activityId = activityRes.data.id;

            // Handle file uploads if any
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

            // Perform the actual transition
            let targetNode = nextNode;
            const patchData: any = {
                change_reason: `流程推进: ${actionLabel}`
            };

            // 发货节点的字段更新
            if (currentNode === 'op_shipping') {
                patchData.shipping_method = shippingMethod;
                if (shippingMethod === 'express') {
                    targetNode = 'resolved';
                } else if (shippingMethod === 'forwarder') {
                    targetNode = 'op_shipping_transit';
                    patchData.forwarder_name = formData.forwarder_name;
                    patchData.forwarder_domestic_tracking = formData.forwarder_domestic_tracking;
                } else if (shippingMethod === 'pickup') {
                    targetNode = 'resolved';
                    patchData.pickup_person = formData.pickup_person;
                } else if (shippingMethod === 'combined') {
                    targetNode = 'resolved';
                    patchData.associated_order_ref = formData.associated_order_ref;
                }
            }

            // 货代补单节点
            if (currentNode === 'op_shipping_transit') {
                patchData.forwarder_final_tracking = formData.forwarder_final_tracking;
                targetNode = 'resolved';
            }

            // 其他节点的字段同步
            if (currentNode === 'ge_review') {
                patchData.payment_amount = formData.paid_amount;
            }
            if ((currentNode === 'op_receiving' || currentNode === 'submitted') && snDiffers && formData.at_receipt_sn) {
                patchData.serial_number = formData.at_receipt_sn;
            }

            patchData.current_node = targetNode;

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
        if (currentNode === 'op_shipping_transit') return <Plane size={24} color="#ffc800" />;
        if (currentNode === 'ms_closing') return <CreditCard size={24} color="#3B82F6" />;
        if (currentNode === 'ge_review') return <ShieldCheck size={24} color="#10B981" />;
        if (currentNode === 'op_receiving' || currentNode === 'submitted') return <PackageOpen size={24} color="#3B82F6" />;
        return <FileCheck size={24} color="#8B5CF6" />;
    };

    const getActionLabelZh = (label: string): string => {
        const labelMap: Record<string, string> = {
            'close': '结案',
            'receive': '收货入库',
            'diagnose': '提交诊断',
            'commercial_approve': '商务审核',
            'repair_complete': '维修完成',
            'settle': '最终确认',
            'finance_approve': '财务确认',
            'reply': '回复',
            'nudge': '催促',
            'view': '查看',
            'paid': '确认付款',
        };
        return labelMap[label] || label;
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
                            <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: editMode ? '#F59E0B' : 'var(--text-main)' }}>
                                {editMode ? '更正: ' : '确认执行: '}{getActionLabelZh(editMode && editNodeType ? (editNodeType === 'op_receive' ? '收货信息' : '发货信息') : actionLabel)}
                            </h3>
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
                        {submitting ? <Loader2 size={16} className="animate-spin" /> : (editMode ? <RefreshCw size={16} /> : <Save size={16} />)}
                        {editMode ? '保存更正' : '提交并推进至下个环节'}
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
