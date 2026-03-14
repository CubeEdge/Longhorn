import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuthStore } from '../../store/useAuthStore';
import { FileText, Plus, Trash2, Stethoscope, Wrench, X, Save, CheckCircle, Loader2, RefreshCw } from 'lucide-react';

interface OpRepairReportEditorProps {
    isOpen: boolean;
    onClose: () => void;
    ticketId: string | number;
    ticketNumber: string;
    onSuccess: () => void;
    warrantyCalc?: any;
    currentNode?: string; // Current workflow node - determines if "complete" button should show
    // 编辑模式相关 props（用于更正历史记录）
    editMode?: boolean;
    editData?: Record<string, unknown> | null;
    correctionReason?: string;
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
    isOpen, onClose, ticketId, ticketNumber, onSuccess, warrantyCalc: _warrantyCalc, currentNode,
    editMode: _editMode = false, editData: _editData = null, correctionReason: _correctionReason = ''
}) => {
    const { token, user } = useAuthStore();
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [lastSaved, setLastSaved] = useState<Date | null>(null);
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

    // 更正功能状态
    const [showCorrectionConfirm, setShowCorrectionConfirm] = useState(false);
    const [correctionReason, setCorrectionReason] = useState('');
    const [originalActorId, setOriginalActorId] = useState<number | null>(null);

    const isAdmin = user?.role === 'Admin' || user?.role === 'Exec' || user?.department_code === 'management';
    const isOp = user?.department_code === 'production' || user?.department_code === 'OP';
    const isOpLead = isOp && user?.role === 'Lead';
    // OP can edit during repair and QA phases
    const opEditableNodes = ['op_repairing', 'op_qa'];
    const isOpEditableNode = opEditableNodes.includes(ticketInfo?.current_node || '');

    // 更正权限检查：
    // - 原操作人可以更正
    // - Admin/Exec 可以更正
    // - OP Lead 可以更正（维修记录属于 OP 部门）
    const canCorrect = activityId && (
        (originalActorId && originalActorId === user?.id) ||  // 原操作人
        isAdmin ||  // Admin/Exec
        isOpLead    // OP Lead
    );

    // Admin/Lead can edit anytime. OP can edit during repair/QA phases. Everyone else is read-only.
    // 维修记录编辑权限：
    // - Admin/Exec/management: 随时可编辑
    // - OP人员: 只在 op_repairing 和 op_qa 节点可编辑
    // - 其他角色: 只读
    // Note: ticketInfo may be null initially, so we default to editable for OP until info loads
    const isReadOnly = ticketInfo ? (!isAdmin && !(isOp && isOpEditableNode)) : !isAdmin;

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

            if (opReportActivity) {
                // If it exists, populate our form
                setActivityId(opReportActivity.id);
                // 记录原操作人ID（用于更正权限检查）
                if (opReportActivity.actor?.id) {
                    setOriginalActorId(opReportActivity.actor.id);
                }
                if (opReportActivity.metadata) {
                    setReportData((prev: any) => ({
                        ...prev,
                        content: opReportActivity.metadata
                    }));
                }
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
            setLastSaved(new Date());
            onSuccess();
        } catch (err: any) {
            console.error("Save Report Error:", err);
            const errMsg = err.response?.data?.error?.message || err.response?.data?.error || err.message || '保存失败';
            if (!silent) alert(errMsg);
        } finally {
            if (!silent) setSaving(false);
        }
    };

    const handleComplete = async () => {
        // Save first, then push to next node directly
        setSaving(true);
        try {
            // Save the report
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

            // Push to next node (ms_closing)
            await axios.patch(`/api/v1/tickets/${ticketId}`, {
                current_node: 'ms_closing',
                change_reason: '维修完成，提交到MS结案审核'
            }, {
                headers: { Authorization: `Bearer ${token}` }
            });

            setLastSaved(new Date());
            onSuccess();
            onClose();
        } catch (err: any) {
            console.error("Complete Repair Error:", err);
            const errMsg = err.response?.data?.error?.message || err.response?.data?.error || err.message || '提交失败';
            alert(errMsg);
        } finally {
            setSaving(false);
        }
    };

    // 处理更正确认：关闭只读模式，进入编辑模式
    const handleCorrectionConfirm = async () => {
        if (!correctionReason.trim() || !activityId) return;
        
        try {
            // 记录更正原因到活动日志
            await axios.post(`/api/v1/tickets/${ticketId}/activities`, {
                activity_type: 'internal_note',
                content: `更正维修记录，原因：${correctionReason.trim()}`
            }, {
                headers: { Authorization: `Bearer ${token}` }
            });
            
            // 关闭确认弹窗，进入编辑模式
            setShowCorrectionConfirm(false);
            // 刷新数据以重新计算权限
            onSuccess();
        } catch (err: any) {
            console.error("Correction confirm error:", err);
            alert('操作失败: ' + (err.response?.data?.error || err.message));
        }
    };

    // Determine if we're in "editing" mode (op_repairing node) or "viewing" mode
    const isEditingMode = currentNode === 'op_repairing' || ticketInfo?.current_node === 'op_repairing';

    if (!isOpen) return null;

    return (
        <div style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 1000,
            background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(10px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center'
        }}>
            <div style={{
                width: 675, height: '90vh', background: '#1c1c1e', borderRadius: 16,
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
                                维修记录
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
                        {/* 更正按钮：只在已提交的记录且有权限时显示 */}
                        {activityId && canCorrect && isReadOnly && (
                            <button
                                onClick={() => {
                                    setCorrectionReason('');
                                    setShowCorrectionConfirm(true);
                                }}
                                style={{
                                    padding: '6px 12px', borderRadius: 6,
                                    background: 'rgba(245, 158, 11, 0.15)', border: '1px solid rgba(245, 158, 11, 0.3)',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                                    cursor: 'pointer', color: '#F59E0B', fontSize: 13, fontWeight: 500,
                                    transition: 'all 0.2s'
                                }}
                                onMouseEnter={e => { e.currentTarget.style.background = 'rgba(245, 158, 11, 0.25)'; }}
                                onMouseLeave={e => { e.currentTarget.style.background = 'rgba(245, 158, 11, 0.15)'; }}
                            >
                                <RefreshCw size={14} />
                                更正
                            </button>
                        )}
                        {/* Close button */}
                        <button
                            onClick={onClose}
                            style={{
                                width: 32, height: 32, borderRadius: 8,
                                background: 'rgba(255,255,255,0.05)', border: 'none',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                cursor: 'pointer', color: '#888', transition: 'all 0.2s'
                            }}
                            onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.1)'; e.currentTarget.style.color = '#fff'; }}
                            onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; e.currentTarget.style.color = '#888'; }}
                        >
                            <X size={18} />
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
                            <div style={{ marginBottom: 16 }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                                    <Stethoscope size={18} color="#FFD200" />
                                    <h4 style={{ margin: 0, fontSize: 15, fontWeight: 600, color: '#fff' }}>检测发现与故障确认</h4>
                                </div>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
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
                            <div style={{ marginBottom: 16 }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                                    <Wrench size={18} color="#FFD200" />
                                    <h4 style={{ margin: 0, fontSize: 15, fontWeight: 600, color: '#fff' }}>维修记录与执行</h4>
                                </div>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
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
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                                            <label style={{ fontSize: 13, color: '#888' }}>更换零件</label>
                                            {!isReadOnly && (
                                                <button
                                                    onClick={() => addArrayItem('repair_process.parts_replaced', { id: Date.now().toString(), name: '', part_number: '', quantity: 1, status: 'new' })}
                                                    style={{
                                                        padding: '4px 12px', background: 'rgba(255, 210, 0, 0.15)', border: '1px solid rgba(255, 210, 0, 0.4)',
                                                        borderRadius: 6, color: '#FFD200', fontSize: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, fontWeight: 600
                                                    }}
                                                >
                                                    <Plus size={14} /> 添加备件
                                                </button>
                                            )}
                                        </div>
                                        {reportData.content.repair_process.parts_replaced.map((part: any, index: number) => (
                                            <div key={part.id || index} style={{ display: 'flex', gap: 8, marginBottom: 6, padding: 8, background: 'rgba(255,255,255,0.03)', borderRadius: 6, border: '1px solid rgba(255,255,255,0.05)' }}>
                                                <input
                                                    type="text"
                                                    value={part.name}
                                                    onChange={e => updateArrayItem('repair_process.parts_replaced', index, { ...part, name: e.target.value })}
                                                    placeholder="零件名称"
                                                    disabled={isReadOnly}
                                                    style={{ flex: 1, padding: '8px 10px', background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 6, color: '#fff', fontSize: 13 }}
                                                />
                                                <input
                                                    type="text"
                                                    value={part.part_number}
                                                    onChange={e => updateArrayItem('repair_process.parts_replaced', index, { ...part, part_number: e.target.value })}
                                                    placeholder="零件号"
                                                    disabled={isReadOnly}
                                                    style={{ width: 120, padding: '8px 10px', background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 6, color: '#fff', fontSize: 13 }}
                                                />
                                                <input
                                                    type="number"
                                                    value={part.quantity}
                                                    onChange={e => updateArrayItem('repair_process.parts_replaced', index, { ...part, quantity: parseInt(e.target.value) || 1 })}
                                                    placeholder="数量"
                                                    disabled={isReadOnly}
                                                    style={{ width: 60, padding: '8px 10px', background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 6, color: '#fff', fontSize: 13, textAlign: 'center' }}
                                                />
                                                <select
                                                    value={part.status}
                                                    onChange={e => updateArrayItem('repair_process.parts_replaced', index, { ...part, status: e.target.value as 'new' | 'refurbished' })}
                                                    disabled={isReadOnly}
                                                    style={{ width: 80, padding: '8px 10px', background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 6, color: '#fff', fontSize: 13, outline: 'none' }}
                                                >
                                                    <option value="new">新件</option>
                                                    <option value="refurbished">翻新件</option>
                                                </select>
                                                {!isReadOnly && (
                                                    <button onClick={() => removeArrayItem('repair_process.parts_replaced', index)} style={{ padding: '0 10px', background: 'rgba(239,68,68,0.15)', border: 'none', borderRadius: 6, color: '#EF4444', cursor: 'pointer' }}>
                                                        <Trash2 size={14} />
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

                {/* Footer with Action Buttons */}
                {!isReadOnly && (
                    <div style={{
                        padding: '12px 24px',
                        borderTop: '1px solid rgba(255,255,255,0.08)',
                        background: 'rgba(0,0,0,0.2)',
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between'
                    }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: '#666' }}>
                            {saving ? (
                                <><Loader2 size={14} className="animate-spin" /> 保存中...</>
                            ) : lastSaved ? (
                                <><CheckCircle size={14} color="#10B981" /> 已自动保存 {lastSaved.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}</>
                            ) : (
                                <span>自动保存已启用</span>
                            )}
                        </div>
                        <div style={{ display: 'flex', gap: 12 }}>
                            <button
                                onClick={() => handleSave(false)}
                                disabled={saving}
                                style={{
                                    padding: '8px 20px', borderRadius: 8,
                                    background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
                                    color: '#ccc', fontSize: 13, fontWeight: 500,
                                    cursor: saving ? 'wait' : 'pointer', display: 'flex', alignItems: 'center', gap: 6
                                }}
                            >
                                <Save size={14} /> {isEditingMode ? '保存草稿' : '保存'}
                            </button>
                            {/* Only show "Complete" button in op_repairing node */}
                            {isEditingMode && (
                                <button
                                    onClick={handleComplete}
                                    disabled={saving}
                                    style={{
                                        padding: '8px 24px', borderRadius: 8,
                                        background: '#FFD200', border: 'none',
                                        color: '#000', fontSize: 13, fontWeight: 600,
                                        cursor: saving ? 'wait' : 'pointer', display: 'flex', alignItems: 'center', gap: 6
                                    }}
                                >
                                    <CheckCircle size={14} /> 完成维修并提交
                                </button>
                            )}
                        </div>
                    </div>
                )}

            </div>

            {/* 更正确认弹窗 */}
            {showCorrectionConfirm && (
                <div style={{
                    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
                    background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10
                }}>
                    <div style={{
                        width: 400, background: '#2a2a2e', borderRadius: 12,
                        border: '1px solid rgba(255,255,255,0.1)', padding: 24
                    }}>
                        <h4 style={{ margin: '0 0 16px 0', fontSize: 16, fontWeight: 600, color: '#fff' }}>
                            确认更正维修记录
                        </h4>
                        <div style={{ 
                            fontSize: 13, color: '#ccc', marginBottom: 16, padding: 12, 
                            background: 'rgba(59,130,246,0.1)', borderRadius: 8, 
                            border: '1px solid rgba(59,130,246,0.2)',
                            lineHeight: 1.6
                        }}>
                            确认后将进入编辑模式，您可以修改维修记录的详细内容。
                        </div>
                        <div style={{ marginBottom: 16 }}>
                            <label style={{ display: 'block', fontSize: 13, color: '#888', marginBottom: 6 }}>
                                更正原因 <span style={{ color: '#EF4444' }}>*</span>
                            </label>
                            <textarea
                                value={correctionReason}
                                onChange={e => setCorrectionReason(e.target.value)}
                                placeholder="请填写更正原因..."
                                style={{
                                    width: '100%', minHeight: 80, padding: 12, background: 'rgba(255,255,255,0.05)',
                                    border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, color: '#fff',
                                    fontSize: 13, resize: 'vertical', fontFamily: 'inherit'
                                }}
                            />
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12 }}>
                            <button
                                onClick={() => setShowCorrectionConfirm(false)}
                                style={{
                                    padding: '8px 16px', borderRadius: 6, background: 'rgba(255,255,255,0.1)',
                                    border: 'none', color: '#fff', cursor: 'pointer', fontSize: 13
                                }}
                            >
                                取消
                            </button>
                            <button
                                onClick={handleCorrectionConfirm}
                                disabled={!correctionReason.trim()}
                                style={{
                                    padding: '8px 16px', borderRadius: 6,
                                    background: correctionReason.trim() ? '#F59E0B' : 'rgba(245,158,11,0.3)',
                                    border: 'none', color: correctionReason.trim() ? '#000' : '#888',
                                    cursor: correctionReason.trim() ? 'pointer' : 'not-allowed', fontSize: 13, fontWeight: 500
                                }}
                            >
                                确认并编辑
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

// Internal Components


const TextArea: React.FC<{ label: string; value: string; onChange: (v: string) => void; disabled?: boolean; placeholder?: string }> = ({ label, value, onChange, disabled, placeholder }) => (
    <div>
        <label style={{ display: 'block', fontSize: 13, color: '#888', marginBottom: 6 }}>{label}</label>
        <textarea
            value={value}
            onChange={e => onChange(e.target.value)}
            disabled={disabled}
            placeholder={placeholder}
            style={{
                width: '100%', minHeight: 80, padding: 12, background: 'rgba(255,255,255,0.05)',
                border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, color: '#fff',
                fontSize: 13, resize: 'vertical', lineHeight: 1.5, fontFamily: 'inherit'
            }}
        />
    </div>
);

const ArrayField: React.FC<{ label: string; items: string[]; onAdd: () => void; onRemove: (i: number) => void; onChange: (i: number, v: string) => void; disabled?: boolean; placeholder?: string }> = ({ label, items, onAdd, onRemove, onChange, disabled, placeholder }) => (
    <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
            <label style={{ fontSize: 13, color: '#888' }}>{label}</label>
            {!disabled && (
                <button
                    onClick={onAdd}
                    style={{
                        padding: '4px 12px', background: 'rgba(255, 210, 0, 0.1)', border: '1px solid rgba(255, 210, 0, 0.3)',
                        borderRadius: 6, color: '#FFD200', fontSize: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, fontWeight: 500
                    }}
                >
                    <Plus size={14} /> 添加
                </button>
            )}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {items.map((item, index) => (
                <div key={index} style={{ display: 'flex', gap: 8 }}>
                    <textarea
                        value={item}
                        onChange={e => onChange(index, e.target.value)}
                        disabled={disabled}
                        placeholder={placeholder}
                        style={{
                            flex: 1, padding: 10, background: 'rgba(255,255,255,0.05)',
                            border: '1px solid rgba(255,255,255,0.1)', borderRadius: 6,
                            color: '#fff', fontSize: 13, minHeight: 60, resize: 'vertical',
                            fontFamily: 'inherit', lineHeight: 1.4
                        }}
                    />
                    {!disabled && (
                        <button onClick={() => onRemove(index)} style={{ padding: '0 10px', background: 'rgba(239,68,68,0.2)', border: 'none', borderRadius: 6, color: '#EF4444', cursor: 'pointer', height: 36 }}>
                            <Trash2 size={14} />
                        </button>
                    )}
                </div>
            ))}
        </div>
    </div>
);
