import React, { useState, useEffect } from 'react';
import { X, Save, Send, FileText, Plus, Trash2, CheckCircle, Clock, AlertCircle, Download, Wrench, Shield, Stethoscope } from 'lucide-react';
import axios from 'axios';
import { useAuthStore } from '../../store/useAuthStore';
import { DocumentReviewModal } from './DocumentReviewModal';
import { exportToPDF } from '../../utils/pdfExport';

interface RepairReportEditorProps {
    isOpen: boolean;
    onClose: () => void;
    ticketId: number;
    ticketNumber: string;
    reportId?: number | null;
    onSuccess: () => void;
}

interface PartUsed {
    id: string;
    name: string;
    part_number: string;
    quantity: number;
    unit_price: number;
    status: 'new' | 'refurbished';
}

interface LaborCharge {
    description: string;
    hours: number;
    rate: number;
    total: number;
}

interface ReportContent {
    header: {
        title: string;
        subtitle: string;
    };
    device_info: {
        product_name: string;
        serial_number: string;
        firmware_version: string;
        hardware_version: string;
    };
    issue_description: {
        customer_reported: string;
        symptoms: string[];
    };
    diagnosis: {
        findings: string;
        root_cause: string;
        troubleshooting_steps: string[];
    };
    repair_process: {
        actions_taken: string[];
        parts_replaced: PartUsed[];
        testing_results: string;
    };
    labor_charges: LaborCharge[];
    logistics: {
        shipping_fee: number;
        shipping_method: string;
    };
    qa_result: {
        passed: boolean;
        test_duration: string;
        notes: string;
    };
    warranty_terms: {
        repair_warranty_days: number;
        exclusions: string[];
    };
}

interface ReportData {
    id?: number;
    report_number?: string;
    status: 'draft' | 'pending_review' | 'approved' | 'rejected' | 'published';
    content: ReportContent;
    service_type: 'warranty' | 'paid' | 'goodwill';
    total_cost: number;
    currency: string;
    warranty_status: string;
    repair_warranty_days: number;
    payment_status: 'pending' | 'paid' | 'waived';
    parts_total: number;
    labor_total: number;
    shipping_total: number;
    version: number;
    created_by?: { id: number; display_name: string };
    created_at?: string;
    updated_at?: string;
    reviewed_by?: { id: number; display_name: string };
    reviewed_at?: string;
    review_comment?: string;
}

const DEFAULT_CONTENT: ReportContent = {
    header: {
        title: 'KINEFINITY 官方维修报告',
        subtitle: 'Official Repair Report'
    },
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
    qa_result: {
        passed: true,
        test_duration: '48 hours',
        notes: ''
    },
    warranty_terms: {
        repair_warranty_days: 90,
        exclusions: ['Physical damage caused by misuse', 'Water damage', 'Unauthorized modifications']
    },
    labor_charges: [],
    logistics: {
        shipping_fee: 0,
        shipping_method: 'Express'
    }
};

export const RepairReportEditor: React.FC<RepairReportEditorProps> = ({
    isOpen, onClose, ticketId, ticketNumber, reportId, onSuccess
}) => {
    const { token, user } = useAuthStore();
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [activeTab, setActiveTab] = useState<'edit' | 'preview'>('edit');
    const [showReviewModal, setShowReviewModal] = useState(false);

    const [reportData, setReportData] = useState<ReportData>({
        status: 'draft',
        content: DEFAULT_CONTENT,
        service_type: 'warranty',
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

    useEffect(() => {
        if (isOpen) {
            if (reportId) {
                loadReport();
            } else {
                initializeFromTicket();
            }
        }
    }, [isOpen, reportId, ticketId]);

    const loadReport = async () => {
        if (!reportId) return;
        setLoading(true);
        try {
            const res = await axios.get(`/api/v1/rma-documents/repair-reports/${reportId}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            if (res.data.success) {
                setReportData(res.data.data);
            }
        } catch (err) {
            console.error('Failed to load report:', err);
            alert('加载维修报告失败');
        } finally {
            setLoading(false);
        }
    };

    const initializeFromTicket = async () => {
        setLoading(true);
        try {
            const res = await axios.get(`/api/v1/tickets/${ticketId}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            if (res.data.success) {
                const ticket = res.data.data;
                
                // Parse warranty calculation for service type
                let serviceType: 'warranty' | 'paid' | 'goodwill' = 'paid';
                if (ticket.warranty_calculation) {
                    try {
                        const warranty = JSON.parse(ticket.warranty_calculation);
                        if (warranty.final_warranty_status === 'warranty_valid') {
                            serviceType = 'warranty';
                        }
                    } catch (e) {}
                }

                setReportData(prev => ({
                    ...prev,
                    service_type: serviceType,
                    warranty_status: serviceType === 'warranty' ? 'In Warranty' : 'Out of Warranty',
                    content: {
                        ...prev.content,
                        device_info: {
                            product_name: ticket.product_name || '',
                            serial_number: ticket.serial_number || '',
                            firmware_version: ticket.firmware_version || '',
                            hardware_version: ticket.hardware_version || ''
                        },
                        issue_description: {
                            customer_reported: ticket.problem_description || '',
                            symptoms: []
                        }
                    }
                }));
            }
        } catch (err) {
            console.error('Failed to load ticket:', err);
        } finally {
            setLoading(false);
        }
    };

    const updateContent = (path: string, value: any) => {
        setReportData(prev => {
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
        setReportData(prev => {
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
        setReportData(prev => {
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
        setReportData(prev => {
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

    const calculateTotals = () => {
        const partsTotal = reportData.content.repair_process.parts_replaced.reduce(
            (sum, part) => sum + (part.quantity * (part.unit_price || 0)), 0
        );
        const laborTotal = reportData.content.labor_charges.reduce(
            (sum, labor) => sum + labor.total, 0
        );
        const shippingTotal = reportData.content.logistics.shipping_fee;
        const total = partsTotal + laborTotal + shippingTotal;

        setReportData(prev => ({
            ...prev,
            parts_total: partsTotal,
            labor_total: laborTotal,
            shipping_total: shippingTotal,
            total_cost: total
        }));

        return { partsTotal, laborTotal, shippingTotal, total };
    };

    const addLaborCharge = () => {
        const newCharge: LaborCharge = {
            description: '',
            hours: 0,
            rate: 0,
            total: 0
        };
        updateContent('labor_charges', [...reportData.content.labor_charges, newCharge]);
    };

    const updateLaborCharge = (index: number, field: keyof LaborCharge, value: any) => {
        const charges = [...reportData.content.labor_charges];
        charges[index] = { ...charges[index], [field]: value };
        if (field === 'hours' || field === 'rate') {
            charges[index].total = charges[index].hours * charges[index].rate;
        }
        updateContent('labor_charges', charges);
    };

    const removeLaborCharge = (index: number) => {
        const charges = reportData.content.labor_charges.filter((_, i) => i !== index);
        updateContent('labor_charges', charges);
    };

    const saveDraft = async () => {
        setSaving(true);
        try {
            const { total } = calculateTotals();
            const payload = {
                ticket_id: ticketId,
                content: reportData.content,
                service_type: reportData.service_type,
                total_cost: total,
                currency: reportData.currency,
                warranty_status: reportData.warranty_status,
                repair_warranty_days: reportData.repair_warranty_days,
                payment_status: reportData.payment_status,
                parts_total: reportData.parts_total,
                labor_total: reportData.labor_total,
                shipping_total: reportData.shipping_total
            };

            if (reportId) {
                await axios.patch(`/api/v1/rma-documents/repair-reports/${reportId}`, payload, {
                    headers: { Authorization: `Bearer ${token}` }
                });
            } else {
                await axios.post('/api/v1/rma-documents/repair-reports', payload, {
                    headers: { Authorization: `Bearer ${token}` }
                });
            }
            onSuccess();
        } catch (err: any) {
            alert(err.response?.data?.error || '保存失败');
        } finally {
            setSaving(false);
        }
    };

    const submitForReview = async () => {
        setSubmitting(true);
        try {
            await axios.post(`/api/v1/rma-documents/repair-reports/${reportId}/submit`, {}, {
                headers: { Authorization: `Bearer ${token}` }
            });
            onSuccess();
        } catch (err: any) {
            alert(err.response?.data?.error || '提交审核失败');
        } finally {
            setSubmitting(false);
        }
    };

    const exportPDF = async () => {
        try {
            const previewElement = document.getElementById('repair-report-preview-content');
            if (!previewElement) {
                alert('预览内容未找到');
                return;
            }

            await exportToPDF({
                filename: `${reportData.report_number || 'RepairReport'}.pdf`,
                element: previewElement,
                orientation: 'portrait',
                format: 'a4'
            });
        } catch (err) {
            console.error('PDF export error:', err);
            alert('PDF导出失败');
        }
    };

    if (!isOpen) return null;

    const isReadOnly = reportData.status === 'published' || reportData.status === 'pending_review';
    const canEdit = !isReadOnly && (reportData.status === 'draft' || reportData.status === 'rejected');
    const canSubmit = canEdit && reportData.content.diagnosis.findings;
    const canExport = reportData.status === 'published' || reportData.status === 'approved';
    const canReview = ['Admin', 'Lead'].includes(user?.role || '') && (reportData.status === 'pending_review' || reportData.status === 'approved');

    const handleReviewSuccess = () => {
        setShowReviewModal(false);
        loadReport(); // Reload to get updated status
        onSuccess();
    };

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
                display: 'flex', flexDirection: 'column'
            }}>
                {/* Header */}
                <div style={{ padding: '16px 24px', borderBottom: '1px solid rgba(255,255,255,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'rgba(255,255,255,0.02)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <div style={{ width: 36, height: 36, borderRadius: 8, background: 'rgba(59, 130, 246, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <FileText size={18} color="#3B82F6" />
                        </div>
                        <div>
                            <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600, color: '#fff' }}>
                                {reportId ? '编辑维修报告' : '新建维修报告'}
                            </h3>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 2 }}>
                                <span style={{ fontSize: 12, color: '#888' }}>工单 {ticketNumber}</span>
                                {reportData.report_number && (
                                    <span style={{ fontSize: 11, color: '#3B82F6', background: 'rgba(59,130,246,0.15)', padding: '2px 8px', borderRadius: 4 }}>
                                        {reportData.report_number}
                                    </span>
                                )}
                                <StatusBadge status={reportData.status} />
                            </div>
                        </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <button
                            onClick={() => setActiveTab('edit')}
                            style={{
                                padding: '6px 16px', background: activeTab === 'edit' ? 'rgba(255,255,255,0.1)' : 'transparent',
                                border: 'none', color: activeTab === 'edit' ? '#fff' : '#888', borderRadius: 6,
                                cursor: 'pointer', fontSize: 13
                            }}
                        >
                            编辑
                        </button>
                        <button
                            onClick={() => setActiveTab('preview')}
                            style={{
                                padding: '6px 16px', background: activeTab === 'preview' ? 'rgba(255,255,255,0.1)' : 'transparent',
                                border: 'none', color: activeTab === 'preview' ? '#fff' : '#888', borderRadius: 6,
                                cursor: 'pointer', fontSize: 13
                            }}
                        >
                            预览
                        </button>
                        <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#888', cursor: 'pointer', marginLeft: 8 }}>
                            <X size={20} />
                        </button>
                    </div>
                </div>

                {/* Body */}
                <div style={{ flex: 1, overflow: 'hidden', display: 'flex' }}>
                    {loading ? (
                        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#888' }}>
                            加载中...
                        </div>
                    ) : activeTab === 'edit' ? (
                        <div style={{ flex: 1, overflow: 'auto', padding: 24, display: 'flex', flexDirection: 'column', gap: 20 }}>
                            {/* Device Info */}
                            <Section title="设备信息" icon={<Wrench size={16} />}>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                                    <Input label="产品型号" value={reportData.content.device_info.product_name} onChange={v => updateContent('device_info.product_name', v)} disabled={!canEdit} />
                                    <Input label="序列号" value={reportData.content.device_info.serial_number} onChange={v => updateContent('device_info.serial_number', v)} disabled={!canEdit} />
                                    <Input label="固件版本" value={reportData.content.device_info.firmware_version} onChange={v => updateContent('device_info.firmware_version', v)} disabled={!canEdit} />
                                    <Input label="硬件版本" value={reportData.content.device_info.hardware_version} onChange={v => updateContent('device_info.hardware_version', v)} disabled={!canEdit} />
                                </div>
                            </Section>

                            {/* Issue Description */}
                            <Section title="故障描述" icon={<AlertCircle size={16} />}>
                                <TextArea
                                    label="客户报修描述"
                                    value={reportData.content.issue_description.customer_reported}
                                    onChange={v => updateContent('issue_description.customer_reported', v)}
                                    disabled={!canEdit}
                                    placeholder="客户原始报修描述..."
                                />
                                <ArrayField
                                    label="故障症状"
                                    items={reportData.content.issue_description.symptoms}
                                    onAdd={() => addArrayItem('issue_description.symptoms', '')}
                                    onRemove={(i) => removeArrayItem('issue_description.symptoms', i)}
                                    onChange={(i, v) => updateArrayItem('issue_description.symptoms', i, v)}
                                    disabled={!canEdit}
                                    placeholder="症状描述"
                                />
                            </Section>

                            {/* Diagnosis */}
                            <Section title="技术诊断" icon={<Stethoscope size={16} />}>
                                <TextArea
                                    label="检测发现"
                                    value={reportData.content.diagnosis.findings}
                                    onChange={v => updateContent('diagnosis.findings', v)}
                                    disabled={!canEdit}
                                    placeholder="详细的检测发现..."
                                />
                                <TextArea
                                    label="根本原因"
                                    value={reportData.content.diagnosis.root_cause}
                                    onChange={v => updateContent('diagnosis.root_cause', v)}
                                    disabled={!canEdit}
                                    placeholder="故障根本原因分析..."
                                />
                                <ArrayField
                                    label="排故步骤"
                                    items={reportData.content.diagnosis.troubleshooting_steps}
                                    onAdd={() => addArrayItem('diagnosis.troubleshooting_steps', '')}
                                    onRemove={(i) => removeArrayItem('diagnosis.troubleshooting_steps', i)}
                                    onChange={(i, v) => updateArrayItem('diagnosis.troubleshooting_steps', i, v)}
                                    disabled={!canEdit}
                                    placeholder="排故步骤"
                                />
                            </Section>

                            {/* Repair Process */}
                            <Section title="维修过程" icon={<Wrench size={16} />}>
                                <ArrayField
                                    label="执行操作"
                                    items={reportData.content.repair_process.actions_taken}
                                    onAdd={() => addArrayItem('repair_process.actions_taken', '')}
                                    onRemove={(i) => removeArrayItem('repair_process.actions_taken', i)}
                                    onChange={(i, v) => updateArrayItem('repair_process.actions_taken', i, v)}
                                    disabled={!canEdit}
                                    placeholder="维修操作描述"
                                />
                                
                                {/* Parts Used */}
                                <div style={{ marginTop: 16 }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                                        <label style={{ fontSize: 13, color: '#888' }}>更换零件</label>
                                        {canEdit && (
                                            <button
                                                onClick={() => addArrayItem('repair_process.parts_replaced', { id: Date.now().toString(), name: '', part_number: '', quantity: 1, status: 'new' })}
                                                style={{ padding: '4px 12px', background: '#3B82F6', border: 'none', borderRadius: 4, color: '#fff', fontSize: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}
                                            >
                                                <Plus size={14} /> 添加零件
                                            </button>
                                        )}
                                    </div>
                                    {reportData.content.repair_process.parts_replaced.map((part, index) => (
                                        <div key={part.id} style={{ display: 'flex', gap: 8, marginBottom: 8, padding: 12, background: 'rgba(255,255,255,0.03)', borderRadius: 8 }}>
                                            <input
                                                type="text"
                                                value={part.name}
                                                onChange={e => updateArrayItem('repair_process.parts_replaced', index, { ...part, name: e.target.value })}
                                                placeholder="零件名称"
                                                disabled={!canEdit}
                                                style={{ flex: 1, padding: 8, background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 4, color: '#fff', fontSize: 13 }}
                                            />
                                            <input
                                                type="text"
                                                value={part.part_number}
                                                onChange={e => updateArrayItem('repair_process.parts_replaced', index, { ...part, part_number: e.target.value })}
                                                placeholder="零件号"
                                                disabled={!canEdit}
                                                style={{ width: 120, padding: 8, background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 4, color: '#fff', fontSize: 13 }}
                                            />
                                            <input
                                                type="number"
                                                value={part.quantity}
                                                onChange={e => updateArrayItem('repair_process.parts_replaced', index, { ...part, quantity: parseInt(e.target.value) || 1 })}
                                                placeholder="数量"
                                                disabled={!canEdit}
                                                style={{ width: 60, padding: 8, background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 4, color: '#fff', fontSize: 13, textAlign: 'center' }}
                                            />
                                            <select
                                                value={part.status}
                                                onChange={e => updateArrayItem('repair_process.parts_replaced', index, { ...part, status: e.target.value as 'new' | 'refurbished' })}
                                                disabled={!canEdit}
                                                style={{ width: 100, padding: 8, background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 4, color: '#fff', fontSize: 13 }}
                                            >
                                                <option value="new">新件</option>
                                                <option value="refurbished">翻新件</option>
                                            </select>
                                            {canEdit && (
                                                <button onClick={() => removeArrayItem('repair_process.parts_replaced', index)} style={{ padding: 8, background: 'rgba(239,68,68,0.2)', border: 'none', borderRadius: 4, color: '#EF4444', cursor: 'pointer' }}>
                                                    <Trash2 size={16} />
                                                </button>
                                            )}
                                        </div>
                                    ))}
                                </div>

                                <TextArea
                                    label="测试结果"
                                    value={reportData.content.repair_process.testing_results}
                                    onChange={v => updateContent('repair_process.testing_results', v)}
                                    disabled={!canEdit}
                                    placeholder="老化测试及功能验证结果..."
                                />
                            </Section>

                            {/* QA Result */}
                            <Section title="质量保证" icon={<Shield size={16} />}>
                                <div style={{ display: 'flex', gap: 16, marginBottom: 16 }}>
                                    <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: canEdit ? 'pointer' : 'default' }}>
                                        <input
                                            type="checkbox"
                                            checked={reportData.content.qa_result.passed}
                                            onChange={e => updateContent('qa_result.passed', e.target.checked)}
                                            disabled={!canEdit}
                                        />
                                        <span style={{ color: '#fff' }}>质检通过</span>
                                    </label>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                        <span style={{ color: '#888' }}>测试时长:</span>
                                        <input
                                            type="text"
                                            value={reportData.content.qa_result.test_duration}
                                            onChange={e => updateContent('qa_result.test_duration', e.target.value)}
                                            disabled={!canEdit}
                                            style={{ width: 100, padding: 6, background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 4, color: '#fff', fontSize: 13 }}
                                        />
                                    </div>
                                </div>
                                <TextArea
                                    label="质检备注"
                                    value={reportData.content.qa_result.notes}
                                    onChange={v => updateContent('qa_result.notes', v)}
                                    disabled={!canEdit}
                                    placeholder="质检过程中的备注..."
                                />
                            </Section>

                            {/* Warranty Terms */}
                            <Section title="保修条款" icon={<Clock size={16} />}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
                                    <span style={{ color: '#888' }}>维修质保期 (天):</span>
                                    <input
                                        type="number"
                                        value={reportData.content.warranty_terms.repair_warranty_days}
                                        onChange={e => updateContent('warranty_terms.repair_warranty_days', parseInt(e.target.value) || 90)}
                                        disabled={!canEdit}
                                        style={{ width: 80, padding: 8, background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 4, color: '#fff', fontSize: 13 }}
                                    />
                                </div>
                                <ArrayField
                                    label="保修除外条款"
                                    items={reportData.content.warranty_terms.exclusions}
                                    onAdd={() => addArrayItem('warranty_terms.exclusions', '')}
                                    onRemove={(i) => removeArrayItem('warranty_terms.exclusions', i)}
                                    onChange={(i, v) => updateArrayItem('warranty_terms.exclusions', i, v)}
                                    disabled={!canEdit}
                                    placeholder="除外条款"
                                />
                            </Section>

                            {/* Labor Charges */}
                            <Section title="人工工时费用" icon={<Wrench size={16} />}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                                    <label style={{ fontSize: 13, color: '#888' }}>工时费用明细</label>
                                    {canEdit && (
                                        <button
                                            onClick={addLaborCharge}
                                            style={{ padding: '4px 12px', background: '#3B82F6', border: 'none', borderRadius: 4, color: '#fff', fontSize: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}
                                        >
                                            <Plus size={14} /> 添加工时
                                        </button>
                                    )}
                                </div>
                                {reportData.content.labor_charges.map((charge, index) => (
                                    <div key={index} style={{ display: 'flex', gap: 8, marginBottom: 8, padding: 12, background: 'rgba(255,255,255,0.03)', borderRadius: 8 }}>
                                        <input
                                            type="text"
                                            value={charge.description}
                                            onChange={e => updateLaborCharge(index, 'description', e.target.value)}
                                            placeholder="工作内容描述"
                                            disabled={!canEdit}
                                            style={{ flex: 1, padding: 8, background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 4, color: '#fff', fontSize: 13 }}
                                        />
                                        <input
                                            type="number"
                                            value={charge.hours}
                                            onChange={e => updateLaborCharge(index, 'hours', parseFloat(e.target.value) || 0)}
                                            placeholder="工时"
                                            disabled={!canEdit}
                                            style={{ width: 70, padding: 8, background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 4, color: '#fff', fontSize: 13, textAlign: 'center' }}
                                        />
                                        <input
                                            type="number"
                                            value={charge.rate}
                                            onChange={e => updateLaborCharge(index, 'rate', parseFloat(e.target.value) || 0)}
                                            placeholder="时薪"
                                            disabled={!canEdit}
                                            style={{ width: 90, padding: 8, background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 4, color: '#fff', fontSize: 13, textAlign: 'right' }}
                                        />
                                        <div style={{ width: 100, padding: 8, textAlign: 'right', color: '#FFD700', fontWeight: 600 }}>
                                            ¥{charge.total.toFixed(2)}
                                        </div>
                                        {canEdit && (
                                            <button onClick={() => removeLaborCharge(index)} style={{ padding: 8, background: 'rgba(239,68,68,0.2)', border: 'none', borderRadius: 4, color: '#EF4444', cursor: 'pointer' }}>
                                                <Trash2 size={16} />
                                            </button>
                                        )}
                                    </div>
                                ))}
                                {reportData.content.labor_charges.length === 0 && (
                                    <div style={{ textAlign: 'center', padding: 20, color: '#666' }}>暂无工时费用</div>
                                )}
                            </Section>

                            {/* Logistics */}
                            <Section title="物流费用" icon={<FileText size={16} />}>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                                    <div>
                                        <label style={{ display: 'block', fontSize: 12, color: '#888', marginBottom: 6 }}>运费金额</label>
                                        <input
                                            type="number"
                                            value={reportData.content.logistics.shipping_fee}
                                            onChange={e => updateContent('logistics.shipping_fee', parseFloat(e.target.value) || 0)}
                                            disabled={!canEdit}
                                            style={{ width: '100%', padding: 10, background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 6, color: '#fff', fontSize: 13 }}
                                        />
                                    </div>
                                    <div>
                                        <label style={{ display: 'block', fontSize: 12, color: '#888', marginBottom: 6 }}>运输方式</label>
                                        <select
                                            value={reportData.content.logistics.shipping_method}
                                            onChange={e => updateContent('logistics.shipping_method', e.target.value)}
                                            disabled={!canEdit}
                                            style={{ width: '100%', padding: 10, background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 6, color: '#fff', fontSize: 13 }}
                                        >
                                            <option value="Express">快递</option>
                                            <option value="Standard">标准</option>
                                            <option value="Air">空运</option>
                                            <option value="Sea">海运</option>
                                        </select>
                                    </div>
                                </div>
                            </Section>

                            {/* Financial Summary */}
                            <Section title="财务汇总" icon={<FileText size={16} />}>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 12, maxWidth: 400, marginLeft: 'auto' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', color: '#aaa' }}>
                                        <span>零件费用</span>
                                        <span>¥{reportData.parts_total.toFixed(2)}</span>
                                    </div>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', color: '#aaa' }}>
                                        <span>人工费用</span>
                                        <span>¥{reportData.labor_total.toFixed(2)}</span>
                                    </div>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', color: '#aaa' }}>
                                        <span>运费</span>
                                        <span>¥{reportData.shipping_total.toFixed(2)}</span>
                                    </div>
                                    <div style={{ borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <span style={{ color: '#FFD700', fontWeight: 600 }}>合计</span>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                                            <select
                                                value={reportData.currency}
                                                onChange={e => setReportData(prev => ({ ...prev, currency: e.target.value }))}
                                                disabled={!canEdit}
                                                style={{ padding: '4px 8px', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 4, color: '#fff', fontSize: 13 }}
                                            >
                                                <option value="CNY">CNY ¥</option>
                                                <option value="USD">USD $</option>
                                                <option value="EUR">EUR €</option>
                                            </select>
                                            <span style={{ color: '#FFD700', fontSize: 20, fontWeight: 700 }}>
                                                {reportData.currency === 'USD' ? '$' : reportData.currency === 'EUR' ? '€' : '¥'}
                                                {reportData.total_cost.toFixed(2)}
                                            </span>
                                        </div>
                                    </div>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 }}>
                                        <span style={{ color: '#888' }}>支付状态</span>
                                        <select
                                            value={reportData.payment_status}
                                            onChange={e => setReportData(prev => ({ ...prev, payment_status: e.target.value as 'pending' | 'paid' | 'waived' }))}
                                            disabled={!canEdit}
                                            style={{ padding: '6px 12px', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 4, color: '#fff', fontSize: 13 }}
                                        >
                                            <option value="pending">待支付</option>
                                            <option value="paid">已支付</option>
                                            <option value="waived">已减免</option>
                                        </select>
                                    </div>
                                </div>
                            </Section>
                        </div>
                    ) : (
                        <ReportPreview reportData={reportData} />
                    )}
                </div>

                {/* Footer */}
                <div style={{ padding: '16px 24px', borderTop: '1px solid rgba(255,255,255,0.08)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(0,0,0,0.2)' }}>
                    <div style={{ display: 'flex', gap: 8 }}>
                        {canExport && (
                            <button
                                onClick={exportPDF}
                                style={{ padding: '8px 16px', background: 'rgba(255,255,255,0.1)', border: 'none', borderRadius: 6, color: '#fff', fontSize: 13, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}
                            >
                                <Download size={16} /> 导出PDF
                            </button>
                        )}
                    </div>
                    <div style={{ display: 'flex', gap: 8 }}>
                        <button onClick={onClose} style={{ padding: '8px 20px', background: 'transparent', border: 'none', color: '#888', cursor: 'pointer', borderRadius: 6 }}>关闭</button>
                        {canEdit && (
                            <button
                                onClick={saveDraft}
                                disabled={saving}
                                style={{ padding: '8px 20px', background: 'rgba(255,255,255,0.1)', border: 'none', borderRadius: 6, color: '#fff', cursor: saving ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}
                            >
                                <Save size={16} /> {saving ? '保存中...' : '保存草稿'}
                            </button>
                        )}
                        {canSubmit && reportId && (
                            <button
                                onClick={submitForReview}
                                disabled={submitting}
                                style={{ padding: '8px 20px', background: '#3B82F6', border: 'none', borderRadius: 6, color: '#fff', cursor: submitting ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}
                            >
                                <Send size={16} /> {submitting ? '提交中...' : '提交审核'}
                            </button>
                        )}
                        {canReview && reportId && (
                            <button
                                onClick={() => setShowReviewModal(true)}
                                style={{ padding: '8px 20px', background: '#F59E0B', border: 'none', borderRadius: 6, color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}
                            >
                                <Shield size={16} /> 审核
                            </button>
                        )}
                    </div>
                </div>
            </div>

            {/* Review Modal */}
            {showReviewModal && reportId && (
                <DocumentReviewModal
                    isOpen={showReviewModal}
                    onClose={() => setShowReviewModal(false)}
                    documentType="repair_report"
                    documentId={reportId}
                    documentNumber={reportData.report_number || 'Report'}
                    onSuccess={handleReviewSuccess}
                />
            )}
        </div>
    );
};

// Helper Components
const Section: React.FC<{ title: string; children: React.ReactNode; icon?: React.ReactNode }> = ({ title, children, icon }) => (
    <div style={{ background: 'rgba(255,255,255,0.02)', padding: 20, borderRadius: 12, border: '1px solid rgba(255,255,255,0.05)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
            {icon && <span style={{ color: '#3B82F6' }}>{icon}</span>}
            <h4 style={{ margin: 0, fontSize: 14, fontWeight: 600, color: '#fff' }}>{title}</h4>
        </div>
        {children}
    </div>
);

const Input: React.FC<{ label: string; value: string; onChange: (v: string) => void; disabled?: boolean }> = ({ label, value, onChange, disabled }) => (
    <div>
        <label style={{ display: 'block', fontSize: 12, color: '#888', marginBottom: 6 }}>{label}</label>
        <input
            type="text"
            value={value}
            onChange={e => onChange(e.target.value)}
            disabled={disabled}
            style={{ width: '100%', padding: 10, background: disabled ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 6, color: '#fff', fontSize: 13, outline: 'none' }}
        />
    </div>
);

const TextArea: React.FC<{ label: string; value: string; onChange: (v: string) => void; disabled?: boolean; placeholder?: string }> = ({ label, value, onChange, disabled, placeholder }) => (
    <div style={{ marginBottom: 16 }}>
        <label style={{ display: 'block', fontSize: 12, color: '#888', marginBottom: 6 }}>{label}</label>
        <textarea
            value={value}
            onChange={e => onChange(e.target.value)}
            disabled={disabled}
            placeholder={placeholder}
            style={{ width: '100%', minHeight: 80, padding: 12, background: disabled ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 6, color: '#fff', fontSize: 13, resize: 'vertical', outline: 'none' }}
        />
    </div>
);

const ArrayField: React.FC<{ label: string; items: string[]; onAdd: () => void; onRemove: (index: number) => void; onChange: (index: number, value: string) => void; disabled?: boolean; placeholder?: string }> = ({ label, items, onAdd, onRemove, onChange, disabled, placeholder }) => (
    <div style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <label style={{ fontSize: 12, color: '#888' }}>{label}</label>
            {!disabled && (
                <button onClick={onAdd} style={{ padding: '4px 12px', background: '#3B82F6', border: 'none', borderRadius: 4, color: '#fff', fontSize: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}>
                    <Plus size={14} /> 添加
                </button>
            )}
        </div>
        {items.map((item, index) => (
            <div key={index} style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                <input
                    type="text"
                    value={item}
                    onChange={e => onChange(index, e.target.value)}
                    placeholder={placeholder}
                    disabled={disabled}
                    style={{ flex: 1, padding: 8, background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 4, color: '#fff', fontSize: 13 }}
                />
                {!disabled && (
                    <button onClick={() => onRemove(index)} style={{ padding: 8, background: 'rgba(239,68,68,0.2)', border: 'none', borderRadius: 4, color: '#EF4444', cursor: 'pointer' }}>
                        <Trash2 size={16} />
                    </button>
                )}
            </div>
        ))}
    </div>
);

const StatusBadge: React.FC<{ status: string }> = ({ status }) => {
    const configs: Record<string, { text: string; color: string; bg: string }> = {
        'draft': { text: '草稿', color: '#888', bg: 'rgba(255,255,255,0.1)' },
        'pending_review': { text: '审核中', color: '#F59E0B', bg: 'rgba(245,158,11,0.15)' },
        'approved': { text: '已批准', color: '#10B981', bg: 'rgba(16,185,129,0.15)' },
        'rejected': { text: '已驳回', color: '#EF4444', bg: 'rgba(239,68,68,0.15)' },
        'published': { text: '已发布', color: '#3B82F6', bg: 'rgba(59,130,246,0.15)' }
    };
    const config = configs[status] || configs['draft'];
    return (
        <span style={{ fontSize: 11, color: config.color, background: config.bg, padding: '2px 8px', borderRadius: 4 }}>
            {config.text}
        </span>
    );
};

const ReportPreview: React.FC<{ reportData: ReportData }> = ({ reportData }) => (
    <div style={{ flex: 1, overflow: 'auto', padding: 40, background: '#f5f5f5' }}>
        <div id="repair-report-preview-content" style={{ maxWidth: 800, margin: '0 auto', background: '#fff', padding: 60, borderRadius: 8, boxShadow: '0 2px 8px rgba(0,0,0,0.1)', color: '#333' }}>
            {/* Header */}
            <div style={{ textAlign: 'center', marginBottom: 40, borderBottom: '3px solid #1a365d', paddingBottom: 20 }}>
                <h1 style={{ margin: 0, fontSize: 28, fontWeight: 700, color: '#1a365d' }}>{reportData.content.header.title}</h1>
                <p style={{ margin: '8px 0 0 0', fontSize: 18, color: '#4a5568' }}>{reportData.content.header.subtitle}</p>
            </div>

            {/* Report Info */}
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 30, padding: 16, background: '#f7fafc', borderRadius: 8 }}>
                <div>
                    <div style={{ fontSize: 14, color: '#718096' }}>Report Number:</div>
                    <div style={{ fontSize: 16, fontWeight: 600, color: '#1a365d' }}>{reportData.report_number || 'DRAFT'}</div>
                    <div style={{ fontSize: 14, color: '#718096', marginTop: 8 }}>Service Type:</div>
                    <div style={{ fontSize: 14, fontWeight: 600, color: reportData.service_type === 'warranty' ? '#38a169' : '#d69e2e' }}>
                        {reportData.service_type === 'warranty' ? 'Warranty Service (Free)' : 'Paid Service'}
                    </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: 14, color: '#718096' }}>Date:</div>
                    <div>{new Date().toLocaleDateString()}</div>
                    {reportData.created_by && (
                        <>
                            <div style={{ fontSize: 14, color: '#718096', marginTop: 8 }}>Service Engineer:</div>
                            <div>{reportData.created_by.display_name}</div>
                        </>
                    )}
                </div>
            </div>

            {/* Device Info */}
            <SectionPreview title="1. Device Information">
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                    <InfoRow label="Product Model" value={reportData.content.device_info.product_name} />
                    <InfoRow label="Serial Number" value={reportData.content.device_info.serial_number} />
                    <InfoRow label="Firmware Version" value={reportData.content.device_info.firmware_version} />
                    <InfoRow label="Hardware Version" value={reportData.content.device_info.hardware_version} />
                </div>
            </SectionPreview>

            {/* Issue Description */}
            <SectionPreview title="2. Issue Description">
                <div style={{ marginBottom: 16 }}>
                    <div style={{ fontSize: 13, color: '#718096', marginBottom: 8 }}>Customer Reported:</div>
                    <div style={{ padding: 12, background: '#f7fafc', borderRadius: 6, fontStyle: 'italic' }}>
                        {reportData.content.issue_description.customer_reported || '[No description provided]'}
                    </div>
                </div>
                {reportData.content.issue_description.symptoms.length > 0 && (
                    <div>
                        <div style={{ fontSize: 13, color: '#718096', marginBottom: 8 }}>Symptoms:</div>
                        <ul style={{ margin: 0, paddingLeft: 20 }}>
                            {reportData.content.issue_description.symptoms.map((s, i) => (
                                <li key={i} style={{ marginBottom: 4 }}>{s}</li>
                            ))}
                        </ul>
                    </div>
                )}
            </SectionPreview>

            {/* Diagnosis */}
            <SectionPreview title="3. Technical Diagnosis">
                <InfoBlock label="Findings" value={reportData.content.diagnosis.findings} />
                <InfoBlock label="Root Cause" value={reportData.content.diagnosis.root_cause} />
                {reportData.content.diagnosis.troubleshooting_steps.length > 0 && (
                    <div>
                        <div style={{ fontSize: 13, color: '#718096', marginBottom: 8 }}>Troubleshooting Steps:</div>
                        <ol style={{ margin: 0, paddingLeft: 20 }}>
                            {reportData.content.diagnosis.troubleshooting_steps.map((s, i) => (
                                <li key={i} style={{ marginBottom: 4 }}>{s}</li>
                            ))}
                        </ol>
                    </div>
                )}
            </SectionPreview>

            {/* Repair Process */}
            <SectionPreview title="4. Repair Process">
                {reportData.content.repair_process.actions_taken.length > 0 && (
                    <div style={{ marginBottom: 16 }}>
                        <div style={{ fontSize: 13, color: '#718096', marginBottom: 8 }}>Actions Taken:</div>
                        <ul style={{ margin: 0, paddingLeft: 20 }}>
                            {reportData.content.repair_process.actions_taken.map((a, i) => (
                                <li key={i} style={{ marginBottom: 4 }}>{a}</li>
                            ))}
                        </ul>
                    </div>
                )}
                {reportData.content.repair_process.parts_replaced.length > 0 && (
                    <div style={{ marginBottom: 16 }}>
                        <div style={{ fontSize: 13, color: '#718096', marginBottom: 8 }}>Parts Replaced:</div>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
                            <thead>
                                <tr style={{ background: '#edf2f7' }}>
                                    <th style={{ padding: 10, textAlign: 'left', borderBottom: '2px solid #cbd5e0' }}>Part Name</th>
                                    <th style={{ padding: 10, textAlign: 'center', borderBottom: '2px solid #cbd5e0' }}>Part Number</th>
                                    <th style={{ padding: 10, textAlign: 'center', borderBottom: '2px solid #cbd5e0' }}>Qty</th>
                                    <th style={{ padding: 10, textAlign: 'center', borderBottom: '2px solid #cbd5e0' }}>Status</th>
                                </tr>
                            </thead>
                            <tbody>
                                {reportData.content.repair_process.parts_replaced.map((part, i) => (
                                    <tr key={i}>
                                        <td style={{ padding: 10, borderBottom: '1px solid #e2e8f0' }}>{part.name}</td>
                                        <td style={{ padding: 10, borderBottom: '1px solid #e2e8f0', textAlign: 'center', fontFamily: 'monospace' }}>{part.part_number}</td>
                                        <td style={{ padding: 10, borderBottom: '1px solid #e2e8f0', textAlign: 'center' }}>{part.quantity}</td>
                                        <td style={{ padding: 10, borderBottom: '1px solid #e2e8f0', textAlign: 'center' }}>
                                            <span style={{ padding: '2px 8px', borderRadius: 4, background: part.status === 'new' ? '#c6f6d5' : '#feebc8', color: part.status === 'new' ? '#22543d' : '#744210', fontSize: 12 }}>
                                                {part.status === 'new' ? 'New' : 'Refurbished'}
                                            </span>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
                <InfoBlock label="Testing Results" value={reportData.content.repair_process.testing_results} />
            </SectionPreview>

            {/* QA Result */}
            <SectionPreview title="5. Quality Assurance">
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
                    <span style={{ fontSize: 14, color: '#718096' }}>QA Status:</span>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 6, color: reportData.content.qa_result.passed ? '#38a169' : '#e53e3e', fontWeight: 600 }}>
                        {reportData.content.qa_result.passed ? <CheckCircle size={18} /> : <AlertCircle size={18} />}
                        {reportData.content.qa_result.passed ? 'PASSED' : 'FAILED'}
                    </span>
                    <span style={{ fontSize: 14, color: '#718096' }}>Test Duration: {reportData.content.qa_result.test_duration}</span>
                </div>
                {reportData.content.qa_result.notes && (
                    <InfoBlock label="QA Notes" value={reportData.content.qa_result.notes} />
                )}
            </SectionPreview>

            {/* Warranty Terms */}
            <SectionPreview title="6. Warranty Terms">
                <div style={{ padding: 16, background: '#ebf8ff', borderRadius: 8, border: '1px solid #90cdf4' }}>
                    <div style={{ fontSize: 14, fontWeight: 600, color: '#2b6cb0', marginBottom: 8 }}>
                        Repair Warranty: {reportData.content.warranty_terms.repair_warranty_days} Days
                    </div>
                    <div style={{ fontSize: 13, color: '#4a5568' }}>
                        This warranty covers the parts replaced during this repair service. It does not cover:
                    </div>
                    <ul style={{ margin: '8px 0 0 0', paddingLeft: 20, fontSize: 13, color: '#4a5568' }}>
                        {reportData.content.warranty_terms.exclusions.map((e, i) => (
                            <li key={i}>{e}</li>
                        ))}
                    </ul>
                </div>
            </SectionPreview>

            {/* Footer */}
            <div style={{ marginTop: 60, paddingTop: 30, borderTop: '2px solid #e2e8f0', textAlign: 'center' }}>
                <p style={{ fontSize: 12, color: '#a0aec0' }}>This is an official repair report from KINEFINITY TECHNOLOGY CO., LTD.</p>
                <p style={{ fontSize: 12, color: '#a0aec0', marginTop: 4 }}>For inquiries, please contact service@kinefinity.com</p>
            </div>
        </div>
    </div>
);

const SectionPreview: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
    <div style={{ marginBottom: 30 }}>
        <h3 style={{ fontSize: 16, fontWeight: 700, color: '#1a365d', borderBottom: '2px solid #e2e8f0', paddingBottom: 8, marginBottom: 16 }}>{title}</h3>
        {children}
    </div>
);

const InfoRow: React.FC<{ label: string; value: string }> = ({ label, value }) => (
    <div>
        <span style={{ fontSize: 13, color: '#718096' }}>{label}: </span>
        <span style={{ fontSize: 14, fontWeight: 500 }}>{value || '-'}</span>
    </div>
);

const InfoBlock: React.FC<{ label: string; value: string }> = ({ label, value }) => (
    <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 13, color: '#718096', marginBottom: 6 }}>{label}:</div>
        <div style={{ padding: 12, background: '#f7fafc', borderRadius: 6, lineHeight: 1.6 }}>
            {value || <span style={{ color: '#a0aec0', fontStyle: 'italic' }}>[No information provided]</span>}
        </div>
    </div>
);
