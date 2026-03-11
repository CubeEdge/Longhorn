import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuthStore } from '../../store/useAuthStore';
import { X, Save, FileText, Plus, Trash2, Stethoscope, Wrench } from 'lucide-react';

interface OpRepairReportEditorProps {
    isOpen: boolean;
    onClose: () => void;
    ticketId: string | number;
    ticketNumber: string;
    onSuccess: () => void;
    warrantyCalc?: any;
}

const DEFAULT_CONTENT = {
    device_info: {
        product_name: '',
        serial_number: '',
        firmware_version: '',
        hardware_version: ''
    },
    issue_description: {
        customer_reported: '',
        symptoms: []
    },
    diagnosis: {
        findings: '',
        root_cause: '',
        troubleshooting_steps: []
    },
    repair_process: {
        actions_taken: [],
        parts_replaced: [],
        testing_results: ''
    },
    // Keep empty definitions for DB compliance
    qa_result: {
        passed: false,
        test_duration: '',
        notes: ''
    },
    warranty_terms: {
        repair_warranty_days: 90,
        exclusions: []
    },
    labor_charges: [],
    logistics: {
        shipping_fee: 0,
        shipping_method: ''
    }
};

export const OpRepairReportEditor: React.FC<OpRepairReportEditorProps> = ({
    isOpen, onClose, ticketId, ticketNumber, onSuccess, warrantyCalc
}) => {
    const { token, user } = useAuthStore();
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [ticketInfo, setTicketInfo] = useState<any>(null);
    const [activityId, setActivityId] = useState<number | null>(null);

    const [reportData, setReportData] = useState<any>({
        status: 'draft',
        content: DEFAULT_CONTENT,
        service_type: 'paid',
        total_cost: 0,
        currency: 'CNY',
        warranty_status: '',
        repair_warranty_days: 90,
        payment_status: 'pending',
        parts_total: 0,
        labor_total: 0,
        shipping_total: 0,
        version: 1
    });

    const isAdmin = user?.role === 'Admin' || user?.role === 'Exec' || user?.department_code === 'management';
    const isOp = user?.department_code === 'production';
    const isOpRepairingNode = ticketInfo?.current_node === 'op_repairing';

    // Only Admin/Lead can edit anytime. OP can only edit if ticket is currently at 'op_repairing'. Everyone else is read-only.
    const isReadOnly = !isAdmin && !(isOp && isOpRepairingNode);

    // Auto-save logic
    useEffect(() => {
        if (!isOpen || !activityId || isReadOnly) return;
        const debounceTimer = setTimeout(() => {
            handleSave();
        }, 5000); // 5 seconds debounce
        return () => clearTimeout(debounceTimer);
    }, [reportData.content]);

    useEffect(() => {
        if (isOpen) {
            fetchTicketInfo();
            initializeOrLoadReport();
        }
    }, [isOpen, ticketId]);

    const fetchTicketInfo = async () => {
        try {
            const res = await axios.get(`/api/v1/tickets/${ticketId}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            if (res.data.success) {
                setTicketInfo(res.data.data);
            }
        } catch (err) {
            console.error('Failed to load ticket info for headers:', err);
        }
    };

    const initializeOrLoadReport = async () => {
        setLoading(true);
        try {
            // First try to load existing op_repair_report activity
            const activitiesRes = await axios.get(`/api/v1/tickets/${ticketId}/activities`, {
                params: { activity_type: 'op_repair_report' },
                headers: { Authorization: `Bearer ${token}` }
            });
            const opReportActivity = activitiesRes.data.data?.[0];

            if (opReportActivity?.metadata) {
                // If it exists, populate our form
                setActivityId(opReportActivity.id);
                setReportData((prev: any) => ({
                    ...prev,
                    content: opReportActivity.metadata
                }));
            } else {
                // If not, fetch diagnostic info to initialize from scratch
                const res = await axios.get(`/api/v1/tickets/${ticketId}`, {
                    headers: { Authorization: `Bearer ${token}` }
                });
                if (res.data.success) {
                    const ticket = res.data.data;
                    const activities = res.data.activities || [];
                    const diagnosticActivity = activities.find((a: any) => a.activity_type === 'diagnostic_report');
                    let diagnosticMetadata = null;

                    if (diagnosticActivity?.metadata) {
                        diagnosticMetadata = typeof diagnosticActivity.metadata === 'string'
                            ? JSON.parse(diagnosticActivity.metadata) : diagnosticActivity.metadata;
                    }

                    setReportData((prev: any) => ({
                        ...prev,
                        content: {
                            ...prev.content,
                            device_info: {
                                product_name: ticket.product_name || '',
                                serial_number: ticket.serial_number || '',
                                firmware_version: ticket.firmware_version || '',
                                hardware_version: ticket.hardware_version || ''
                            },
                            warranty_status: ticket.is_warranty ? 'In Warranty' : 'Out of Warranty',
                            issue_description: {
                                customer_reported: ticket.problem_description || '无报修描述',
                                symptoms: []
                            },
                            diagnosis: {
                                ...prev.content.diagnosis,
                                findings: diagnosticMetadata?.diagnosis || diagnosticMetadata?.symptom_confirmation || '暂无检测发现记录...',
                                root_cause: diagnosticMetadata?.root_cause || '',
                                troubleshooting_steps: diagnosticMetadata?.troubleshooting_steps || []
                            },
                            repair_process: {
                                ...prev.content.repair_process,
                                actions_taken: diagnosticMetadata?.repair_advice ? [diagnosticMetadata.repair_advice] : []
                            }
                        }
                    }));
                }
            }
        } catch (err) {
            console.error('Failed to load ticket:', err);
        } finally {
            setLoading(false);
        }
    };

    const updateContent = (path: string, value: any) => {
        if (isReadOnly) return;
        setReportData((prev: any) => {
            const newContent = { ...prev.content };
            const keys = path.split('.');
            let target: any = newContent;
            for (let i = 0; i < keys.length - 1; i++) {
                target = target[keys[i]];
            }
            target[keys[keys.length - 1]] = value;
            return { ...prev, content: newContent };
        });
    };

    const addArrayItem = (path: string, defaultValue: any) => {
        if (isReadOnly) return;
        setReportData((prev: any) => {
            const newContent = { ...prev.content };
            const keys = path.split('.');
            let target: any = newContent;
            for (let i = 0; i < keys.length - 1; i++) {
                target = target[keys[i]];
            }
            const array = target[keys[keys.length - 1]];
            target[keys[keys.length - 1]] = [...array, defaultValue];
            return { ...prev, content: newContent };
        });
    };

    const removeArrayItem = (path: string, index: number) => {
        if (isReadOnly) return;
        setReportData((prev: any) => {
            const newContent = { ...prev.content };
            const keys = path.split('.');
            let target: any = newContent;
            for (let i = 0; i < keys.length - 1; i++) {
                target = target[keys[i]];
            }
            const array = target[keys[keys.length - 1]];
            target[keys[keys.length - 1]] = array.filter((_: any, i: number) => i !== index);
            return { ...prev, content: newContent };
        });
    };

    const updateArrayItem = (path: string, index: number, value: any) => {
        if (isReadOnly) return;
        setReportData((prev: any) => {
            const newContent = { ...prev.content };
            const keys = path.split('.');
            let target: any = newContent;
            for (let i = 0; i < keys.length - 1; i++) {
                target = target[keys[i]];
            }
            const array = target[keys[keys.length - 1]];
            target[keys[keys.length - 1]] = array.map((item: any, i: number) => i === index ? value : item);
            return { ...prev, content: newContent };
        });
    };

    const handleSave = async (silent = true) => {
        if (!silent) setSaving(true);
        try {
            const payload = {
                activity_type: 'op_repair_report',
                content: `记录了完整的维修执行过程。`,
                metadata: reportData.content,
                visibility: 'all'
            };

            if (activityId) {
                await axios.patch(`/api/v1/tickets/${ticketId}/activities/${activityId}`, {
                    content: payload.content,
                    metadata: payload.metadata
                }, {
                    headers: { Authorization: `Bearer ${token}` }
                });
            } else {
                const res = await axios.post(`/api/v1/tickets/${ticketId}/activities`, payload, {
                    headers: { Authorization: `Bearer ${token}` }
                });
                if (res.data.data?.id) {
                    setActivityId(res.data.data.id);
                }
            }
            onSuccess();
        } catch (err: any) {
            console.error("Save Report Error:", err);
            if (!silent) alert(err.response?.data?.error?.message || '保存失败');
        } finally {
            if (!silent) setSaving(false);
        }
    };

    const handleSubmit = async () => {
        setSaving(true);
        try {
            // 1. Save the report first (not silent now)
            await handleSave(false);

            // 2. Transition to next node (ms_closing)
            await axios.patch(`/api/v1/tickets/${ticketId}`, {
                current_node: 'ms_closing',
                change_reason: 'OP 提交维修报告，自动流转至待结案'
            }, { headers: { Authorization: `Bearer ${token}` } });

            onSuccess();
            onClose();
        } catch (err: any) {
            console.error("Submit Repair Report Error:", err);
            alert(err.response?.data?.error?.message || '提交失败');
        } finally {
            setSaving(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 1000,
            background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(10px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center'
        }}>
            <div style={{
                width: 900, height: '90vh', background: '#1c1c1e', borderRadius: 16,
                border: '1px solid rgba(255,255,255,0.1)', overflow: 'hidden',
                boxShadow: '0 30px 60px rgba(0,0,0,0.6)',
                display: 'flex', flexDirection: 'column', position: 'relative'
            }}>
                {/* Header */}
                <div style={{
                    padding: '16px 24px',
                    borderBottom: '1px solid rgba(255,255,255,0.08)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    background: 'rgba(255, 210, 0, 0.05)'
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <div style={{ width: 36, height: 36, borderRadius: 8, background: 'rgba(59, 130, 246, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <FileText size={18} color="#3B82F6" />
                        </div>
                        <div>
                            <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600, color: '#fff' }}>
                                填写维修报告
                            </h3>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 2 }}>
                                <span style={{ fontSize: 12, color: '#888' }}>工单 {ticketNumber}</span>
                                {reportData.report_number && (
                                    <span style={{ fontSize: 11, color: '#3B82F6', background: 'rgba(59,130,246,0.15)', padding: '2px 8px', borderRadius: 4 }}>
                                        {reportData.report_number}
                                    </span>
                                )}
                            </div>
                        </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#888', cursor: 'pointer', marginLeft: 8 }}>
                            <X size={20} />
                        </button>
                    </div>
                </div>

                {/* Body */}
                <div style={{ flex: 1, overflow: 'auto', padding: 24, display: 'flex', flexDirection: 'column', gap: 20 }}>
                    {loading ? (
                        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#888' }}>
                            加载中...
                        </div>
                    ) : (
                        <>
                            {/* Header Info Panel */}
                            <div style={{
                                background: 'transparent', padding: '16px 20px',
                                borderRadius: 12, border: '1px solid rgba(255,255,255,0.05)',
                                display: 'flex', gap: 48, alignItems: 'center'
                            }}>
                                <div>
                                    <div style={{ fontSize: 12, color: '#888', marginBottom: 4 }}>机器型号 / 序列号</div>
                                    <div style={{ fontSize: 14, color: '#fff', fontWeight: 500 }}>
                                        {reportData.content.device_info.product_name || '-'} / <span style={{ color: '#fff' }}>{reportData.content.device_info.serial_number || '-'}</span>
                                    </div>
                                    <div style={{ marginTop: 4 }}>
                                        {/* Use calculated warranty status if available, fallback to ticket flag */}
                                        {warrantyCalc ? (
                                            warrantyCalc.final_warranty_status === 'warranty_valid' ? (
                                                <span style={{ fontSize: 11, color: '#10B981', background: 'rgba(16,185,129,0.1)', padding: '2px 6px', borderRadius: 4, border: '1px solid rgba(16,185,129,0.3)' }}>保修内</span>
                                            ) : (
                                                <span style={{ fontSize: 11, color: '#EF4444', background: 'rgba(239,68,68,0.1)', padding: '2px 6px', borderRadius: 4, border: '1px solid rgba(239,68,68,0.3)' }}>已过保</span>
                                            )
                                        ) : (
                                            ticketInfo?.is_warranty ? (
                                                <span style={{ fontSize: 11, color: '#10B981', background: 'rgba(16,185,129,0.1)', padding: '2px 6px', borderRadius: 4, border: '1px solid rgba(16,185,129,0.2)' }}>保修内</span>
                                            ) : (
                                                <span style={{ fontSize: 11, color: '#F59E0B', background: 'rgba(245,158,11,0.1)', padding: '2px 6px', borderRadius: 4, border: '1px solid rgba(245,158,11,0.2)' }}>已过保</span>
                                            )
                                        )}
                                        {ticketInfo?.original_order && (
                                            <span style={{ fontSize: 11, color: '#888', marginLeft: 8 }}>关联工单数: {ticketInfo.rma_count || 1}</span>
                                        )}
                                    </div>
                                </div>
                                <div style={{ width: 1, height: 24, background: 'rgba(255,255,255,0.1)' }} />
                                <div>
                                    <div style={{ fontSize: 12, color: '#888', marginBottom: 4 }}>RMA建单日期</div>
                                    <div style={{ fontSize: 14, color: '#fff' }}>
                                        {ticketInfo?.created_at ? new Date(ticketInfo.created_at).toLocaleDateString('zh-CN') : '-'}
                                    </div>
                                </div>
                                <div style={{ width: 1, height: 24, background: 'rgba(255,255,255,0.1)' }} />
                                <div>
                                    <div style={{ fontSize: 12, color: '#888', marginBottom: 4 }}>收到日期</div>
                                    <div style={{ fontSize: 14, color: '#fff' }}>
                                        {ticketInfo?.returned_date ? new Date(ticketInfo.returned_date).toLocaleDateString('zh-CN') : (ticketInfo?.created_at ? new Date(ticketInfo.created_at).toLocaleDateString('zh-CN') : '-')}
                                    </div>
                                </div>
                                <div style={{ width: 1, height: 24, background: 'rgba(255,255,255,0.1)' }} />
                                <div>
                                    <div style={{ fontSize: 12, color: '#888', marginBottom: 4 }}>检测日期</div>
                                    <div style={{ fontSize: 14, color: '#fff' }}>
                                        {new Date().toLocaleDateString('zh-CN')}
                                    </div>
                                </div>
                            </div>


                            {/* Diagnosis */}
                            <div style={{ marginBottom: 24 }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
                                    <Stethoscope size={20} color="#FFD200" />
                                    <h4 style={{ margin: 0, fontSize: 16, fontWeight: 600, color: '#fff' }}>检测发现与故障确认</h4>
                                </div>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                                    <TextArea
                                        label="检测确认"
                                        value={reportData.content.diagnosis.findings}
                                        onChange={v => updateContent('diagnosis.findings', v)}
                                        disabled={isReadOnly}
                                        placeholder="请详细描述检测确认过程..."
                                    />
                                    <TextArea
                                        label="故障原因"
                                        value={reportData.content.diagnosis.root_cause}
                                        onChange={v => updateContent('diagnosis.root_cause', v)}
                                        disabled={isReadOnly}
                                        placeholder="请描述故障根本原因分析..."
                                    />
                                    <ArrayField
                                        label="排故过程"
                                        items={reportData.content.diagnosis.troubleshooting_steps}
                                        onAdd={() => addArrayItem('diagnosis.troubleshooting_steps', '')}
                                        onRemove={(i) => removeArrayItem('diagnosis.troubleshooting_steps', i)}
                                        onChange={(i, v) => updateArrayItem('diagnosis.troubleshooting_steps', i, v)}
                                        disabled={isReadOnly}
                                        placeholder="记录具体的排故步骤"
                                    />
                                </div>
                            </div>

                            <div style={{ height: 1, background: 'rgba(255,255,255,0.06)', margin: '8px 0' }} />

                            {/* Repair Process */}
                            <div style={{ marginBottom: 24 }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
                                    <Wrench size={20} color="#FFD200" />
                                    <h4 style={{ margin: 0, fontSize: 16, fontWeight: 600, color: '#fff' }}>维修记录与执行</h4>
                                </div>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                                    <ArrayField
                                        label="执行操作"
                                        items={reportData.content.repair_process.actions_taken}
                                        onAdd={() => addArrayItem('repair_process.actions_taken', '')}
                                        onRemove={(i) => removeArrayItem('repair_process.actions_taken', i)}
                                        onChange={(i, v) => updateArrayItem('repair_process.actions_taken', i, v)}
                                        disabled={isReadOnly}
                                        placeholder="详细记录执行的维修动作"
                                    />

                                    {/* Parts Used */}
                                    <div>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                                            <label style={{ fontSize: 13, color: '#888' }}>更换零件</label>
                                            {!isReadOnly && (
                                                <button
                                                    onClick={() => addArrayItem('repair_process.parts_replaced', { id: Date.now().toString(), name: '', part_number: '', quantity: 1, status: 'new' })}
                                                    style={{
                                                        padding: '6px 16px', background: 'rgba(255, 210, 0, 0.15)', border: '1px solid rgba(255, 210, 0, 0.4)',
                                                        borderRadius: 6, color: '#FFD200', fontSize: 13, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, fontWeight: 600
                                                    }}
                                                >
                                                    <Plus size={16} /> 添加待更换备件
                                                </button>
                                            )}
                                        </div>
                                        {reportData.content.repair_process.parts_replaced.map((part: any, index: number) => (
                                            <div key={part.id || index} style={{ display: 'flex', gap: 8, marginBottom: 8, padding: 12, background: 'rgba(255,255,255,0.03)', borderRadius: 8, border: '1px solid rgba(255,255,255,0.05)' }}>
                                                <input
                                                    type="text"
                                                    value={part.name}
                                                    onChange={e => updateArrayItem('repair_process.parts_replaced', index, { ...part, name: e.target.value })}
                                                    placeholder="零件名称"
                                                    disabled={isReadOnly}
                                                    style={{ flex: 1, padding: '10px 12px', background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 6, color: '#fff', fontSize: 13 }}
                                                />
                                                <input
                                                    type="text"
                                                    value={part.part_number}
                                                    onChange={e => updateArrayItem('repair_process.parts_replaced', index, { ...part, part_number: e.target.value })}
                                                    placeholder="零件号"
                                                    disabled={isReadOnly}
                                                    style={{ width: 140, padding: '10px 12px', background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 6, color: '#fff', fontSize: 13 }}
                                                />
                                                <input
                                                    type="number"
                                                    value={part.quantity}
                                                    onChange={e => updateArrayItem('repair_process.parts_replaced', index, { ...part, quantity: parseInt(e.target.value) || 1 })}
                                                    placeholder="数量"
                                                    disabled={isReadOnly}
                                                    style={{ width: 70, padding: '10px 12px', background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 6, color: '#fff', fontSize: 13, textAlign: 'center' }}
                                                />
                                                <select
                                                    value={part.status}
                                                    onChange={e => updateArrayItem('repair_process.parts_replaced', index, { ...part, status: e.target.value as 'new' | 'refurbished' })}
                                                    disabled={isReadOnly}
                                                    style={{ width: 100, padding: '10px 12px', background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 6, color: '#fff', fontSize: 13, outline: 'none' }}
                                                >
                                                    <option value="new">新件</option>
                                                    <option value="refurbished">翻新件</option>
                                                </select>
                                                {!isReadOnly && (
                                                    <button onClick={() => removeArrayItem('repair_process.parts_replaced', index)} style={{ padding: '0 12px', background: 'rgba(239,68,68,0.15)', border: 'none', borderRadius: 6, color: '#EF4444', cursor: 'pointer' }}>
                                                        <Trash2 size={16} />
                                                    </button>
                                                )}
                                            </div>
                                        ))}
                                    </div>

                                    <TextArea
                                        label="测试结论"
                                        value={reportData.content.repair_process.testing_results}
                                        onChange={v => updateContent('repair_process.testing_results', v)}
                                        disabled={isReadOnly}
                                        placeholder="请记录老化测试、功能验证的结果..."
                                    />
                                </div>
                            </div>

                        </>
                    )}
                </div>

                {/* Footer Controls */}
                <div style={{
                    padding: '16px 24px',
                    borderTop: '1px solid rgba(255,255,255,0.08)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'flex-end',
                    gap: 12,
                    background: 'rgba(255,255,255,0.02)'
                }}>
                    <button onClick={onClose} style={{
                        padding: '8px 20px', background: 'transparent', border: 'none',
                        color: '#aaa', borderRadius: 6, cursor: 'pointer', fontSize: 13
                    }}>
                        关闭
                    </button>
                    {!isReadOnly && (
                        <button onClick={handleSubmit} disabled={saving} style={{
                            padding: '10px 32px', background: '#FFD200', border: 'none',
                            color: '#000', fontWeight: 600, borderRadius: 6, cursor: saving ? 'not-allowed' : 'pointer', fontSize: 14,
                            display: 'flex', alignItems: 'center', gap: 8, opacity: saving ? 0.7 : 1,
                            boxShadow: '0 4px 12px rgba(255, 210, 0, 0.2)'
                        }}>
                            <Save size={18} />
                            {saving ? '提交中...' : '提交进入下一步'}
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
};

// Internal Components


const TextArea: React.FC<{ label: string; value: string; onChange: (v: string) => void; disabled?: boolean; placeholder?: string }> = ({ label, value, onChange, disabled, placeholder }) => (
    <div>
        <label style={{ display: 'block', fontSize: 13, color: '#888', marginBottom: 8 }}>{label}</label>
        <textarea
            value={value}
            onChange={e => onChange(e.target.value)}
            disabled={disabled}
            placeholder={placeholder}
            style={{
                width: '100%', minHeight: 200, padding: 16, background: 'rgba(255,255,255,0.05)',
                border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, color: '#fff',
                fontSize: 14, resize: 'vertical', lineHeight: 1.6, fontFamily: 'inherit'
            }}
        />
    </div>
);

const ArrayField: React.FC<{ label: string; items: string[]; onAdd: () => void; onRemove: (i: number) => void; onChange: (i: number, v: string) => void; disabled?: boolean; placeholder?: string }> = ({ label, items, onAdd, onRemove, onChange, disabled, placeholder }) => (
    <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <label style={{ fontSize: 13, color: '#888' }}>{label}</label>
            {!disabled && (
                <button
                    onClick={onAdd}
                    style={{
                        padding: '8px 16px', background: 'rgba(255, 210, 0, 0.1)', border: '1px solid rgba(255, 210, 0, 0.3)',
                        borderRadius: 6, color: '#FFD200', fontSize: 13, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, fontWeight: 500
                    }}
                >
                    <Plus size={16} /> 添加
                </button>
            )}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {items.map((item, index) => (
                <div key={index} style={{ display: 'flex', gap: 12 }}>
                    <textarea
                        value={item}
                        onChange={e => onChange(index, e.target.value)}
                        disabled={disabled}
                        placeholder={placeholder}
                        style={{
                            flex: 1, padding: 12, background: 'rgba(255,255,255,0.05)',
                            border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8,
                            color: '#fff', fontSize: 14, minHeight: 100, resize: 'vertical',
                            fontFamily: 'inherit', lineHeight: 1.5
                        }}
                    />
                    {!disabled && (
                        <button onClick={() => onRemove(index)} style={{ padding: '0 12px', background: 'rgba(239,68,68,0.2)', border: 'none', borderRadius: 8, color: '#EF4444', cursor: 'pointer', height: 44 }}>
                            <Trash2 size={16} />
                        </button>
                    )}
                </div>
            ))}
        </div>
    </div>
);
