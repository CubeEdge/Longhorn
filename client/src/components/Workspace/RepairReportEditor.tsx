import React, { useState, useEffect, useCallback } from 'react';
import { Wrench, AlertCircle, Save, X, Download, Send, FileText, Stethoscope, Plus, Trash2, Settings, ChevronDown, ChevronUp, DollarSign, Package } from 'lucide-react';
import axios from 'axios';
import { useAuthStore } from '../../store/useAuthStore';

import { exportToPDF } from '../../utils/pdfExport';
import ConfirmModal from '../Service/ConfirmModal';

interface RepairReportEditorProps {
    isOpen: boolean;
    onClose: () => void;
    ticketId: number;
    ticketNumber: string;
    reportId?: number | null;
    currentNode?: string;
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
    isOpen, onClose, ticketId, ticketNumber, reportId: initialReportId, currentNode, onSuccess
}) => {
    const { token, user } = useAuthStore();
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [activeTab, setActiveTab] = useState<'edit' | 'preview'>('edit');
    const [ticketInfo, setTicketInfo] = useState<any>(null);
    // Confirm modal state for publish/recall actions
    const [confirmAction, setConfirmAction] = useState<{ type: 'publish' | 'recall' | null; isOpen: boolean }>({
        type: null,
        isOpen: false
    });
    // PDF settings panel visibility
    const [showPdfSettings, setShowPdfSettings] = useState(false);
    // Local state to track report ID after creation
    const [localReportId, setLocalReportId] = useState<number | undefined>(initialReportId || undefined);
    
    // Sync with prop when it changes
    useEffect(() => {
        setLocalReportId(initialReportId || undefined);
    }, [initialReportId]);

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

    // PDF export settings - 扩展设置项
    const [pdfSettings, setPdfSettings] = useState({
        format: 'a4' as 'a4' | 'letter',
        orientation: 'portrait' as 'portrait' | 'landscape',
        language: 'original' as 'original' | 'zh-CN' | 'en-US' | 'ja-JP',
        showHeader: true,
        showFooter: true
    });

    const isReadOnly = reportData.status === 'published' || reportData.status === 'approved' || reportData.status === 'pending_review';
    const isOpMode = currentNode === 'op_repairing';
    const canEdit = !isReadOnly && (reportData.status === 'draft' || reportData.status === 'rejected');
    const canSubmit = canEdit && reportData.content.diagnosis.findings;
    const canExport = true; // 任何时候都可以导出

    // Auto-save logic - only when report exists (localReportId is set)
    useEffect(() => {
        if (!isOpen || !localReportId || isReadOnly) return;

        const debounceTimer = setTimeout(() => {
            saveDraft(true); // silent auto-save, don't close modal
        }, 5000); // 5 seconds debounce

        return () => clearTimeout(debounceTimer);
    }, [reportData.content, reportData.service_type, reportData.currency, reportData.payment_status, localReportId]);

    useEffect(() => {
        if (isOpen) {
            fetchTicketInfo();
            if (localReportId) {
                loadReport();
            } else {
                initializeFromTicket();
            }
        }
    }, [isOpen, localReportId, ticketId]);

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

    const loadReport = async () => {
        if (!localReportId) return;
        setLoading(true);
        try {
            const res = await axios.get(`/api/v1/rma-documents/repair-reports/${localReportId}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            if (res.data.success) {
                const incomingData = res.data.data;
                // Defensive merge to ensure all content structure exists
                setReportData({
                    ...incomingData,
                    content: {
                        ...DEFAULT_CONTENT,
                        ...(incomingData.content || {}),
                        header: { ...DEFAULT_CONTENT.header, ...(incomingData.content?.header || {}) },
                        device_info: { ...DEFAULT_CONTENT.device_info, ...(incomingData.content?.device_info || {}) },
                        issue_description: { ...DEFAULT_CONTENT.issue_description, ...(incomingData.content?.issue_description || {}) },
                        diagnosis: { ...DEFAULT_CONTENT.diagnosis, ...(incomingData.content?.diagnosis || {}) },
                        repair_process: { ...DEFAULT_CONTENT.repair_process, ...(incomingData.content?.repair_process || {}) },
                        logistics: { ...DEFAULT_CONTENT.logistics, ...(incomingData.content?.logistics || {}) },
                        qa_result: { ...DEFAULT_CONTENT.qa_result, ...(incomingData.content?.qa_result || {}) },
                        warranty_terms: { ...DEFAULT_CONTENT.warranty_terms, ...(incomingData.content?.warranty_terms || {}) }
                    }
                });
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
                    } catch (e) { }
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

                // Find the latest diagnostic report activity
                const activities = res.data.activities || [];
                const diagnosticActivity = activities.find((a: any) => a.activity_type === 'diagnostic_report');
                let diagnosticMetadata = null;
                if (diagnosticActivity && diagnosticActivity.metadata) {
                    diagnosticMetadata = typeof diagnosticActivity.metadata === 'string'
                        ? JSON.parse(diagnosticActivity.metadata)
                        : diagnosticActivity.metadata;
                }

                // If diagnostic data exists in activity metadata, import it as initial findings
                if (diagnosticMetadata) {
                    try {
                        if (diagnosticMetadata.diagnosis) {
                            setReportData((prev: ReportData) => ({
                                ...prev,
                                content: {
                                    ...prev.content,
                                    diagnosis: {
                                        ...prev.content.diagnosis,
                                        findings: diagnosticMetadata.diagnosis,
                                        root_cause: diagnosticMetadata.root_cause || '',
                                        troubleshooting_steps: diagnosticMetadata.troubleshooting_steps || []
                                    },
                                    repair_process: {
                                        ...prev.content.repair_process,
                                        actions_taken: diagnosticMetadata.repair_advice ? [diagnosticMetadata.repair_advice] : []
                                    }
                                }
                            }));
                        }
                    } catch (e) {
                        console.error('Failed to parse diagnostic metadata:', e);
                    }
                }

                // Find op_repair_report activity and import repair data (actions, parts, testing results, QA)
                const opRepairActivity = activities.find((a: any) => a.activity_type === 'op_repair_report');
                if (opRepairActivity && opRepairActivity.metadata) {
                    try {
                        const opRepairData = typeof opRepairActivity.metadata === 'string'
                            ? JSON.parse(opRepairActivity.metadata)
                            : opRepairActivity.metadata;
                        
                        setReportData((prev: ReportData) => {
                            const newContent = { ...prev.content };
                            
                            // Import repair process data
                            if (opRepairData.repair_process) {
                                const rp = opRepairData.repair_process;
                                // Merge actions_taken (keep existing from diagnostic, add from repair)
                                const existingActions = newContent.repair_process.actions_taken || [];
                                const repairActions = rp.actions_taken || [];
                                newContent.repair_process.actions_taken = [...existingActions, ...repairActions].filter(Boolean);
                                
                                // Import parts_replaced with unit_price default
                                if (rp.parts_replaced && rp.parts_replaced.length > 0) {
                                    newContent.repair_process.parts_replaced = rp.parts_replaced.map((part: any) => ({
                                        id: part.id || Date.now().toString() + Math.random(),
                                        name: part.name || '',
                                        part_number: part.part_number || '',
                                        quantity: part.quantity || 1,
                                        unit_price: part.unit_price || 0,  // 正式报告需要价格
                                        status: part.status || 'new'
                                    }));
                                }
                                
                                // Import testing_results
                                if (rp.testing_results) {
                                    newContent.repair_process.testing_results = rp.testing_results;
                                }
                            }
                            
                            // Import QA result
                            if (opRepairData.qa_result) {
                                newContent.qa_result = {
                                    passed: opRepairData.qa_result.passed ?? true,
                                    test_duration: opRepairData.qa_result.test_duration || '48 hours',
                                    notes: opRepairData.qa_result.notes || ''
                                };
                            }
                            
                            // Import warranty terms
                            if (opRepairData.warranty_terms) {
                                newContent.warranty_terms = {
                                    ...newContent.warranty_terms,
                                    repair_warranty_days: opRepairData.warranty_terms.repair_warranty_days || 90
                                };
                            }
                            
                            return { ...prev, content: newContent };
                        });
                    } catch (e) {
                        console.error('Failed to parse op_repair_report metadata:', e);
                    }
                }
            }
        } catch (err) {
            console.error('Failed to load ticket:', err);
        } finally {
            setLoading(false);
        }
    };

    const updateContent = (path: string, value: any) => {
        setReportData((prev: ReportData) => {
            const keys = path.split('.');
            // 深拷贝 content 以确保不可变更新
            const newContent = JSON.parse(JSON.stringify(prev.content));
            let target: any = newContent;
            for (let i = 0; i < keys.length - 1; i++) {
                target = target[keys[i]];
            }
            target[keys[keys.length - 1]] = value;
            return { ...prev, content: newContent };
        });
    };

    const addArrayItem = (path: string, defaultValue: any) => {
        setReportData((prev: ReportData) => {
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
        setReportData((prev: ReportData) => {
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
        setReportData((prev: ReportData) => {
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

    const calculateTotals = useCallback(() => {
        const partsTotal = reportData.content.repair_process.parts_replaced.reduce(
            (sum: number, part: PartUsed) => sum + (part.quantity * (part.unit_price || 0)), 0
        );
        const laborTotal = reportData.content.labor_charges.reduce(
            (sum: number, labor: LaborCharge) => sum + labor.total, 0
        );
        const shippingTotal = reportData.content.logistics.shipping_fee;
        const total = partsTotal + laborTotal + shippingTotal;

        setReportData((prev: ReportData) => ({
            ...prev,
            parts_total: partsTotal,
            labor_total: laborTotal,
            shipping_total: shippingTotal,
            total_cost: total
        }));

        return { partsTotal, laborTotal, shippingTotal, total };
    }, [reportData.content.repair_process.parts_replaced, reportData.content.labor_charges, reportData.content.logistics.shipping_fee]);

    // Real-time fee calculation when parts, labor or shipping changes
    useEffect(() => {
        calculateTotals();
    }, [reportData.content.repair_process.parts_replaced, reportData.content.labor_charges, reportData.content.logistics.shipping_fee]);

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
        const charges = reportData.content.labor_charges.filter((_: LaborCharge, i: number) => i !== index);
        updateContent('labor_charges', charges);
    };

    const saveDraft = async (silent = false) => {
        // For auto-save (silent), only proceed if we have a report ID
        if (silent && !localReportId) {
            console.log('Auto-save skipped: no report ID yet');
            return;
        }
        if (!silent) setSaving(true);
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

            if (localReportId) {
                await axios.patch(`/api/v1/rma-documents/repair-reports/${localReportId}`, payload, {
                    headers: { Authorization: `Bearer ${token}` }
                });
            } else {
                const res = await axios.post('/api/v1/rma-documents/repair-reports', payload, {
                    headers: { Authorization: `Bearer ${token}` }
                });
                // Store the new report ID for subsequent saves
                if (res.data.data?.id) {
                    setLocalReportId(res.data.data.id);
                }
            }
            // Only call onSuccess for manual saves (non-silent), not for auto-saves
            if (!silent) {
                onSuccess();
            }
        } catch (err: any) {
            if (!silent) {
                alert(err.response?.data?.error || '保存失败');
            } else {
                console.error('Auto-save failed:', err);
            }
        } finally {
            if (!silent) setSaving(false);
        }
    };

    const submitForReview = async () => {
        setSubmitting(true);
        try {
            await axios.post(`/api/v1/rma-documents/repair-reports/${localReportId}/submit`, {}, {
                headers: { Authorization: `Bearer ${token}` }
            });
            await loadReport();
            onSuccess();
        } catch (err: any) {
            alert(err.response?.data?.error || '提交审核失败');
        } finally {
            setSubmitting(false);
        }
    };



    const recallReport = async () => {
        setConfirmAction({ type: null, isOpen: false });
        setSubmitting(true);
        try {
            await axios.post(`/api/v1/rma-documents/repair-reports/${localReportId}/recall`, {}, {
                headers: { Authorization: `Bearer ${token}` }
            });
            await loadReport();
            onSuccess();
        } catch (err: any) {
            alert(err.response?.data?.error || '撤回失败');
        } finally {
            setSubmitting(false);
        }
    };

    const exportPDF = async () => {
        // 直接导出，不弹确认框
        try {
            const previewElement = document.getElementById('repair-report-preview-content');
            if (!previewElement) {
                alert('请先切换到预览模式');
                return;
            }

            await exportToPDF({
                filename: `${reportData.report_number || 'RepairReport'}.pdf`,
                element: previewElement,
                orientation: pdfSettings.orientation,
                format: pdfSettings.format
            });
        } catch (err) {
            console.error('PDF export error:', err);
            alert('PDF导出失败');
        }
    };

    if (!isOpen) return null;

    return (
        <div style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 1050,
            background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(10px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center'
        }}>
            <div style={{
                width: 900, height: '90vh', background: 'var(--bg-secondary)', borderRadius: 16,
                border: '1px solid var(--glass-border)', overflow: 'hidden',
                boxShadow: '0 30px 60px var(--glass-shadow-lg)',
                display: 'flex', flexDirection: 'column', position: 'relative'
            }}>
                {/* Header */}
                <div style={{
                    padding: '16px 24px',
                    borderBottom: '1px solid var(--glass-border)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    background: 'var(--glass-bg)'
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <div style={{ width: 36, height: 36, borderRadius: 8, background: 'rgba(59, 130, 246, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <FileText size={18} color="#3B82F6" />
                        </div>
                        <div>
                            <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600, color: 'var(--text-main)' }}>
                                {isReadOnly ? '查看 正式维修报告' : (localReportId ? '编辑 正式维修报告' : '新建 正式维修报告')}
                            </h3>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 2 }}>
                                <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>工单 {ticketNumber}</span>
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
                        {isOpMode && (
                            <span style={{ fontSize: 13, color: 'var(--text-secondary)', marginRight: 8 }}>
                                本节点修改后会自动保存
                            </span>
                        )}
                        <button
                            onClick={() => setActiveTab('edit')}
                            style={{
                                padding: '6px 16px', background: activeTab === 'edit' ? 'var(--glass-bg-hover)' : 'transparent',
                                border: 'none', color: activeTab === 'edit' ? 'var(--text-main)' : 'var(--text-secondary)', borderRadius: 6,
                                cursor: 'pointer', fontSize: 13
                            }}
                        >
                            编辑
                        </button>
                        {!isOpMode && (
                            <button
                                onClick={() => {
                                    calculateTotals();
                                    setActiveTab('preview');
                                }}
                                style={{
                                    padding: '6px 16px', background: activeTab === 'preview' ? 'var(--glass-bg-hover)' : 'transparent',
                                    border: 'none', color: activeTab === 'preview' ? 'var(--text-main)' : 'var(--text-secondary)', borderRadius: 6,
                                    cursor: 'pointer', fontSize: 13
                                }}
                            >
                                预览
                            </button>
                        )}
                        <button
                            onClick={() => setShowPdfSettings(true)}
                            title="PDF导出设置"
                            style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', marginLeft: 4 }}
                        >
                            <Settings size={18} />
                        </button>
                    </div>
                </div>

                {/* Body */}
                <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                    {loading ? (
                        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-secondary)' }}>
                            加载中...
                        </div>
                    ) : activeTab === 'edit' ? (
                        <div style={{ flex: 1, overflow: 'auto', padding: 24, display: 'flex', flexDirection: 'column', gap: 20 }}>
                            {/* Header Info Panel */}
                            {isOpMode ? (
                                <div style={{
                                    background: 'var(--glass-bg)', padding: '16px 20px',
                                    borderRadius: 12, border: '1px solid var(--glass-border)',
                                    display: 'flex', gap: 48, alignItems: 'center'
                                }}>
                                    <div>
                                        <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 4 }}>机器型号 / 序列号</div>
                                        <div style={{ fontSize: 14, color: 'var(--text-main)', fontWeight: 500 }}>
                                            {reportData.content.device_info.product_name || '-'} / {reportData.content.device_info.serial_number || '-'}
                                        </div>
                                    </div>
                                    <div style={{ width: 1, height: 24, background: 'var(--glass-border)' }} />
                                    <div>
                                        <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 4 }}>RMA建单日期</div>
                                        <div style={{ fontSize: 14, color: 'var(--text-main)' }}>
                                            {ticketInfo?.created_at ? new Date(ticketInfo.created_at).toLocaleDateString('zh-CN') : '-'}
                                        </div>
                                    </div>
                                    <div style={{ width: 1, height: 24, background: 'var(--glass-border)' }} />
                                    <div>
                                        <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 4 }}>收到日期</div>
                                        <div style={{ fontSize: 14, color: 'var(--text-main)' }}>
                                            {ticketInfo?.returned_date ? new Date(ticketInfo.returned_date).toLocaleDateString('zh-CN') : (ticketInfo?.created_at ? new Date(ticketInfo.created_at).toLocaleDateString('zh-CN') : '-')}
                                        </div>
                                    </div>
                                    <div style={{ width: 1, height: 24, background: 'var(--glass-border)' }} />
                                    <div>
                                        <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 4 }}>检测日期</div>
                                        <div style={{ fontSize: 14, color: 'var(--text-main)' }}>
                                            {new Date().toLocaleDateString('zh-CN')}
                                        </div>
                                    </div>
                                </div>
                            ) : null}

                            {saving && (
                                <div style={{ position: 'absolute', top: 120, right: 40, fontSize: 12, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: 4, background: 'var(--glass-bg-light)', padding: '4px 12px', borderRadius: 20, zIndex: 10 }}>
                                    <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--accent-gold)', animation: 'pulse 1.5s infinite' }} />
                                    草稿已自动保存
                                </div>
                            )}

                            {/* RMA基本信息Header Panel */}
                            {!isOpMode && ticketInfo && (
                                <div style={{
                                    background: 'var(--glass-bg)', padding: '16px 20px',
                                    borderRadius: 12, border: '1px solid var(--glass-border)',
                                    display: 'flex', gap: 32, alignItems: 'center', flexWrap: 'wrap',
                                    marginBottom: 20
                                }}>
                                    <div>
                                        <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 4 }}>机器型号 / 序列号</div>
                                        <div style={{ fontSize: 14, color: 'var(--text-main)', fontWeight: 500 }}>
                                            {reportData.content.device_info.product_name || '-'} / {reportData.content.device_info.serial_number || '-'}
                                        </div>
                                    </div>
                                    <div style={{ width: 1, height: 32, background: 'var(--glass-border)' }} />
                                    <div>
                                        <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 4 }}>RMA建单日期</div>
                                        <div style={{ fontSize: 14, color: 'var(--text-main)' }}>
                                            {ticketInfo.created_at ? new Date(ticketInfo.created_at).toLocaleDateString('zh-CN') : '-'}
                                        </div>
                                    </div>
                                    <div style={{ width: 1, height: 32, background: 'var(--glass-border)' }} />
                                    <div>
                                        <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 4 }}>收到日期</div>
                                        <div style={{ fontSize: 14, color: 'var(--text-main)' }}>
                                            {ticketInfo.received_date ? new Date(ticketInfo.received_date).toLocaleDateString('zh-CN') : 
                                             ticketInfo.returned_date ? new Date(ticketInfo.returned_date).toLocaleDateString('zh-CN') : '-'}
                                        </div>
                                    </div>
                                    <div style={{ width: 1, height: 32, background: 'var(--glass-border)' }} />
                                    <div>
                                        <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 4 }}>检测日期</div>
                                        <div style={{ fontSize: 14, color: 'var(--text-main)' }}>
                                            {ticketInfo.repair_started_at ? new Date(ticketInfo.repair_started_at).toLocaleDateString('zh-CN') : '-'}
                                        </div>
                                    </div>
                                    <div style={{ width: 1, height: 32, background: 'var(--glass-border)' }} />
                                    <div>
                                        <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 4 }}>维修日期</div>
                                        <div style={{ fontSize: 14, color: 'var(--text-main)' }}>
                                            {ticketInfo.repair_completed_at ? new Date(ticketInfo.repair_completed_at).toLocaleDateString('zh-CN') : 
                                             new Date().toLocaleDateString('zh-CN')}
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Device Info */}
                            {!isOpMode && (
                                <Section title="设备信息" icon={<Wrench size={16} />}>
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16 }}>
                                        <Input label="产品型号" value={reportData.content.device_info.product_name} onChange={v => updateContent('device_info.product_name', v)} disabled={!canEdit} />
                                        <Input label="序列号" value={reportData.content.device_info.serial_number} onChange={v => updateContent('device_info.serial_number', v)} disabled={!canEdit} />
                                        <Input label="固件版本" value={reportData.content.device_info.firmware_version} onChange={v => updateContent('device_info.firmware_version', v)} disabled={!canEdit} />
                                    </div>
                                </Section>
                            )}

                            {/* Issue Description */}
                            {!isOpMode && (
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
                            )}

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
                                <TextArea
                                    label="测试结果"
                                    value={reportData.content.repair_process.testing_results}
                                    onChange={v => updateContent('repair_process.testing_results', v)}
                                    disabled={!canEdit}
                                    placeholder="老化测试及功能验证结果..."
                                />
                                {/* 更换零件只读展示 - 在维修过程中展示零件信息 */}
                                {reportData.content.repair_process.parts_replaced.length > 0 && (
                                    <div style={{ marginTop: 12 }}>
                                        <label style={{ display: 'block', fontSize: 12, color: 'var(--text-secondary)', marginBottom: 8 }}>更换零件</label>
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                                            {reportData.content.repair_process.parts_replaced.map((part: PartUsed, i: number) => (
                                                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '8px 12px', background: 'rgba(255,255,255,0.03)', borderRadius: 6, border: '1px solid rgba(255,255,255,0.05)' }}>
                                                    <span style={{ flex: 1, color: 'var(--text-main)', fontSize: 13 }}>{part.name}</span>
                                                    {part.part_number && <span style={{ color: 'var(--text-tertiary)', fontSize: 12, fontFamily: 'monospace' }}>{part.part_number}</span>}
                                                    <span style={{ color: 'var(--text-main)', fontSize: 12, fontWeight: 500 }}>x{part.quantity}</span>
                                                    <span style={{ color: 'var(--text-secondary)', fontSize: 11, padding: '2px 6px', background: 'var(--glass-border)', borderRadius: 4 }}>{part.status === 'new' ? '新件' : '翻新'}</span>
                                                </div>
                                            ))}
                                        </div>
                                        <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 8 }}>* 零件费用详情请查看下方"费用明细"</div>
                                    </div>
                                )}
                            </Section>

                            {/* MS only sections */}
                            {!isOpMode && (
                                <>
                                    {/* Fee Details - Unified Section */}
                                    <Section title="费用明细" icon={<DollarSign size={16} />}>
                                        {/* Parts Sub-section */}
                                        <FeeSubSection 
                                            title="更换零件" 
                                            icon={<Package size={14} />}
                                            subtotal={reportData.parts_total}
                                            defaultOpen={true}
                                        >
                                            {canEdit && (
                                                <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 8 }}>
                                                    <button
                                                        onClick={() => addArrayItem('repair_process.parts_replaced', { id: Date.now().toString(), name: '', part_number: '', quantity: 1, unit_price: 0, status: 'new' })}
                                                        style={{ padding: '4px 12px', background: '#3B82F6', border: 'none', borderRadius: 4, color: 'var(--text-main)', fontSize: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}
                                                    >
                                                        <Plus size={14} /> 添加零件
                                                    </button>
                                                </div>
                                            )}
                                            {reportData.content.repair_process.parts_replaced.length > 0 && (
                                                <div style={{ display: 'flex', gap: 8, marginBottom: 8, padding: '8px 12px', background: 'var(--glass-bg-light)', borderRadius: 8, fontSize: 12, color: 'var(--text-tertiary)' }}>
                                                    <span style={{ flex: 1 }}>零件名称</span>
                                                    <span style={{ width: 100 }}>零件号</span>
                                                    <span style={{ width: 50, textAlign: 'center' }}>数量</span>
                                                    <span style={{ width: 80, textAlign: 'right' }}>单价</span>
                                                    <span style={{ width: 70 }}>状态</span>
                                                    <span style={{ width: 80, textAlign: 'right' }}>小计</span>
                                                    {canEdit && <span style={{ width: 36 }}></span>}
                                                </div>
                                            )}
                                            {reportData.content.repair_process.parts_replaced.map((part: PartUsed, index: number) => (
                                                <div key={part.id} style={{ display: 'flex', gap: 8, marginBottom: 8, padding: 10, background: 'rgba(255,255,255,0.03)', borderRadius: 6, alignItems: 'center' }}>
                                                    <input
                                                        type="text"
                                                        value={part.name}
                                                        onChange={e => updateArrayItem('repair_process.parts_replaced', index, { ...part, name: e.target.value })}
                                                        placeholder="零件名称"
                                                        disabled={!canEdit}
                                                        style={{ flex: 1, padding: 8, background: 'var(--glass-bg-light)', border: '1px solid var(--glass-border)', borderRadius: 4, color: 'var(--text-main)', fontSize: 13 }}
                                                    />
                                                    <input
                                                        type="text"
                                                        value={part.part_number}
                                                        onChange={e => updateArrayItem('repair_process.parts_replaced', index, { ...part, part_number: e.target.value })}
                                                        placeholder="零件号"
                                                        disabled={!canEdit}
                                                        style={{ width: 100, padding: 8, background: 'var(--glass-bg-light)', border: '1px solid var(--glass-border)', borderRadius: 4, color: 'var(--text-main)', fontSize: 13 }}
                                                    />
                                                    <input
                                                        type="number"
                                                        value={part.quantity}
                                                        onChange={e => updateArrayItem('repair_process.parts_replaced', index, { ...part, quantity: parseInt(e.target.value) || 1 })}
                                                        disabled={!canEdit}
                                                        min={1}
                                                        style={{ width: 50, padding: 8, background: 'var(--glass-bg-light)', border: '1px solid var(--glass-border)', borderRadius: 4, color: 'var(--text-main)', fontSize: 13, textAlign: 'center' }}
                                                    />
                                                    <input
                                                        type="number"
                                                        value={part.unit_price || 0}
                                                        onChange={e => updateArrayItem('repair_process.parts_replaced', index, { ...part, unit_price: parseFloat(e.target.value) || 0 })}
                                                        disabled={!canEdit}
                                                        min={0}
                                                        step={0.01}
                                                        style={{ width: 80, padding: 8, background: 'var(--glass-bg-light)', border: '1px solid var(--glass-border)', borderRadius: 4, color: 'var(--text-main)', fontSize: 13, textAlign: 'right' }}
                                                    />
                                                    <select
                                                        value={part.status}
                                                        onChange={e => updateArrayItem('repair_process.parts_replaced', index, { ...part, status: e.target.value as 'new' | 'refurbished' })}
                                                        disabled={!canEdit}
                                                        style={{ width: 70, padding: 8, background: 'var(--glass-bg-light)', border: '1px solid var(--glass-border)', borderRadius: 4, color: 'var(--text-main)', fontSize: 12 }}
                                                    >
                                                        <option value="new">新件</option>
                                                        <option value="refurbished">翻新</option>
                                                    </select>
                                                    <div style={{ width: 80, textAlign: 'right', color: 'var(--text-main)', fontWeight: 600, fontSize: 13 }}>
                                                        ¥{((part.quantity || 1) * (part.unit_price || 0)).toFixed(2)}
                                                    </div>
                                                    {canEdit && (
                                                        <button onClick={() => removeArrayItem('repair_process.parts_replaced', index)} style={{ padding: 6, background: 'rgba(239,68,68,0.2)', border: 'none', borderRadius: 4, color: '#EF4444', cursor: 'pointer' }}>
                                                            <Trash2 size={14} />
                                                        </button>
                                                    )}
                                                </div>
                                            ))}
                                            {reportData.content.repair_process.parts_replaced.length === 0 && (
                                                <div style={{ textAlign: 'center', padding: 16, color: 'var(--text-tertiary)', fontSize: 13 }}>暂无零件费用</div>
                                            )}
                                        </FeeSubSection>

                                        {/* Labor Sub-section */}
                                        <FeeSubSection 
                                            title="工时费用" 
                                            icon={<Wrench size={14} />}
                                            subtotal={reportData.labor_total}
                                            defaultOpen={true}
                                        >
                                            {canEdit && (
                                                <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 8 }}>
                                                    <button
                                                        onClick={addLaborCharge}
                                                        style={{ padding: '4px 12px', background: '#3B82F6', border: 'none', borderRadius: 4, color: 'var(--text-main)', fontSize: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}
                                                    >
                                                        <Plus size={14} /> 添加工时
                                                    </button>
                                                </div>
                                            )}
                                            {reportData.content.labor_charges.length > 0 && (
                                                <div style={{ display: 'flex', gap: 8, marginBottom: 8, padding: '8px 12px', background: 'var(--glass-bg-light)', borderRadius: 8, fontSize: 12, color: 'var(--text-tertiary)' }}>
                                                    <span style={{ flex: 1 }}>工作内容</span>
                                                    <span style={{ width: 70, textAlign: 'center' }}>工时</span>
                                                    <span style={{ width: 80, textAlign: 'right' }}>时薪</span>
                                                    <span style={{ width: 80, textAlign: 'right' }}>小计</span>
                                                    {canEdit && <span style={{ width: 36 }}></span>}
                                                </div>
                                            )}
                                            {reportData.content.labor_charges.map((charge: LaborCharge, index: number) => (
                                                <div key={index} style={{ display: 'flex', gap: 8, marginBottom: 8, padding: 10, background: 'rgba(255,255,255,0.03)', borderRadius: 6, alignItems: 'center' }}>
                                                    <input
                                                        type="text"
                                                        value={charge.description}
                                                        onChange={e => updateLaborCharge(index, 'description', e.target.value)}
                                                        placeholder="工作内容描述"
                                                        disabled={!canEdit}
                                                        style={{ flex: 1, padding: 8, background: 'var(--glass-bg-light)', border: '1px solid var(--glass-border)', borderRadius: 4, color: 'var(--text-main)', fontSize: 13 }}
                                                    />
                                                    <input
                                                        type="number"
                                                        value={charge.hours}
                                                        onChange={e => updateLaborCharge(index, 'hours', parseFloat(e.target.value) || 0)}
                                                        disabled={!canEdit}
                                                        style={{ width: 70, padding: 8, background: 'var(--glass-bg-light)', border: '1px solid var(--glass-border)', borderRadius: 4, color: 'var(--text-main)', fontSize: 13, textAlign: 'center' }}
                                                    />
                                                    <input
                                                        type="number"
                                                        value={charge.rate}
                                                        onChange={e => updateLaborCharge(index, 'rate', parseFloat(e.target.value) || 0)}
                                                        disabled={!canEdit}
                                                        style={{ width: 80, padding: 8, background: 'var(--glass-bg-light)', border: '1px solid var(--glass-border)', borderRadius: 4, color: 'var(--text-main)', fontSize: 13, textAlign: 'right' }}
                                                    />
                                                    <div style={{ width: 80, textAlign: 'right', color: 'var(--text-main)', fontWeight: 600, fontSize: 13 }}>
                                                        ¥{Number(charge.total || 0).toFixed(2)}
                                                    </div>
                                                    {canEdit && (
                                                        <button onClick={() => removeLaborCharge(index)} style={{ padding: 6, background: 'rgba(239,68,68,0.2)', border: 'none', borderRadius: 4, color: '#EF4444', cursor: 'pointer' }}>
                                                            <Trash2 size={14} />
                                                        </button>
                                                    )}
                                                </div>
                                            ))}
                                            {reportData.content.labor_charges.length === 0 && (
                                                <div style={{ textAlign: 'center', padding: 16, color: 'var(--text-tertiary)', fontSize: 13 }}>暂无工时费用</div>
                                            )}
                                        </FeeSubSection>

                                        {/* Other Charges Sub-section */}
                                        <FeeSubSection 
                                            title="其他费用" 
                                            icon={<DollarSign size={14} />}
                                            subtotal={reportData.content.logistics?.shipping_fee || 0}
                                            defaultOpen={true}
                                        >
                                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                                                <div>
                                                    <label style={{ display: 'block', fontSize: 12, color: 'var(--text-secondary)', marginBottom: 6 }}>费用金额</label>
                                                    <input
                                                        type="number"
                                                        value={reportData.content.logistics.shipping_fee}
                                                        onChange={e => updateContent('logistics.shipping_fee', parseFloat(e.target.value) || 0)}
                                                        disabled={!canEdit}
                                                        style={{ width: '100%', padding: 8, background: 'var(--glass-bg-light)', border: '1px solid var(--glass-border)', borderRadius: 4, color: 'var(--text-main)', fontSize: 13 }}
                                                    />
                                                </div>
                                                <div>
                                                    <label style={{ display: 'block', fontSize: 12, color: 'var(--text-secondary)', marginBottom: 6 }}>费用说明</label>
                                                    <input
                                                        type="text"
                                                        value={reportData.content.logistics.shipping_method}
                                                        onChange={e => updateContent('logistics.shipping_method', e.target.value)}
                                                        disabled={!canEdit}
                                                        placeholder="如：运费、包装费、检测费..."
                                                        style={{ width: '100%', padding: 8, background: 'var(--glass-bg-light)', border: '1px solid var(--glass-border)', borderRadius: 4, color: 'var(--text-main)', fontSize: 13 }}
                                                    />
                                                </div>
                                            </div>
                                        </FeeSubSection>

                                        {/* Fee Summary */}
                                        <div style={{ marginTop: 16, padding: 16, background: 'var(--glass-bg-light)', borderRadius: 8, border: '1px solid var(--glass-border)' }}>
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                                                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: 'var(--text-secondary)' }}>
                                                    <span>零件合计</span>
                                                    <span style={{ color: 'var(--text-main)', fontWeight: 500 }}>¥{Number(reportData.parts_total || 0).toFixed(2)}</span>
                                                </div>
                                                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: 'var(--text-secondary)' }}>
                                                    <span>工时合计</span>
                                                    <span style={{ color: 'var(--text-main)', fontWeight: 500 }}>¥{Number(reportData.labor_total || 0).toFixed(2)}</span>
                                                </div>
                                                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: 'var(--text-secondary)' }}>
                                                    <span>其他费用</span>
                                                    <span style={{ color: 'var(--text-main)', fontWeight: 500 }}>¥{Number(reportData.content.logistics?.shipping_fee || 0).toFixed(2)}</span>
                                                </div>
                                                <div style={{ borderTop: '1px solid var(--glass-border)', paddingTop: 10, marginTop: 4, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                                        <span style={{ color: 'var(--text-main)', fontWeight: 600, fontSize: 14 }}>总计</span>
                                                        <select
                                                            value={reportData.currency}
                                                            onChange={e => setReportData((prev: ReportData) => ({ ...prev, currency: e.target.value }))}
                                                            disabled={!canEdit}
                                                            style={{ padding: '4px 8px', background: 'var(--input-bg)', border: '1px solid var(--input-border)', borderRadius: 4, color: 'var(--text-main)', fontSize: 12 }}
                                                        >
                                                            <option value="CNY">CNY</option>
                                                            <option value="USD">USD</option>
                                                            <option value="EUR">EUR</option>
                                                        </select>
                                                    </div>
                                                    <span style={{ color: 'var(--text-main)', fontSize: 18, fontWeight: 700 }}>
                                                        {reportData.currency === 'USD' ? '$' : reportData.currency === 'EUR' ? '€' : '¥'}
                                                        {Number(reportData.total_cost || 0).toFixed(2)}
                                                    </span>
                                                </div>
                                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 4, paddingTop: 8, borderTop: '1px solid var(--glass-border)' }}>
                                                    <span style={{ color: 'var(--text-secondary)', fontSize: 13 }}>支付状态</span>
                                                    <select
                                                        value={reportData.payment_status}
                                                        onChange={e => setReportData((prev: ReportData) => ({ ...prev, payment_status: e.target.value as 'pending' | 'paid' | 'waived' }))}
                                                        disabled={!canEdit}
                                                        style={{ padding: '6px 12px', background: 'var(--input-bg)', border: '1px solid var(--input-border)', borderRadius: 4, color: 'var(--text-main)', fontSize: 13 }}
                                                    >
                                                        <option value="pending">待支付</option>
                                                        <option value="paid">已支付</option>
                                                        <option value="waived">已减免</option>
                                                    </select>
                                                </div>
                                            </div>
                                        </div>
                                    </Section>

                                    {/* 维修保修条款 - 放在报告最后 */}
                                    <div style={{ marginTop: 16, padding: 16, background: 'var(--glass-bg)', borderRadius: 8, border: '1px dashed var(--glass-border)' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                                            <span style={{ fontSize: 13, color: 'var(--text-secondary)', fontWeight: 500 }}>维修保修条款</span>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                                <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>质保期:</span>
                                                <input
                                                    type="number"
                                                    value={reportData.content.warranty_terms.repair_warranty_days}
                                                    onChange={e => updateContent('warranty_terms.repair_warranty_days', parseInt(e.target.value) || 90)}
                                                    disabled={!canEdit}
                                                    style={{ width: 50, padding: '4px 6px', background: 'var(--input-bg)', border: '1px solid var(--input-border)', borderRadius: 4, color: 'var(--text-main)', fontSize: 12, textAlign: 'center' }}
                                                />
                                                <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>天</span>
                                            </div>
                                        </div>
                                        <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.8 }}>
                                            本次维修服务自客户签收之日起享有 <strong style={{ color: 'var(--accent-blue)' }}>{reportData.content.warranty_terms.repair_warranty_days || 90}</strong> 天质保期，仅限于本次维修所涉及的部件及服务。质保不包括：人为损坏、流体侵入、擅自拆修或改装、电压异常等非正常使用导致的损坏。如有疑问，请联系售后服务。
                                        </div>
                                    </div>
                                </>
                            )}
                        </div>
                    ) : (
                        <ReportPreview reportData={reportData} ticketInfo={ticketInfo} />
                    )}
                </div>

                {/* Footer - 左侧关闭，右侧操作按钮 */}
                <div style={{ padding: '16px 24px', borderTop: '1px solid var(--glass-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--glass-bg)' }}>
                    <button onClick={onClose} style={{ padding: '8px 20px', background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', borderRadius: 6 }}>关闭</button>
                    <div style={{ display: 'flex', gap: 8 }}>
                        {canEdit && activeTab === 'edit' && (
                            <button
                                onClick={() => saveDraft(false)}
                                disabled={saving}
                                style={{ padding: '8px 20px', background: 'var(--glass-bg-hover)', border: 'none', borderRadius: 6, color: 'var(--text-main)', cursor: saving ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}
                            >
                                <Save size={16} /> {saving ? '保存中...' : '保存草稿'}
                            </button>
                        )}
                        {canSubmit && activeTab === 'edit' && (
                            <button
                                onClick={async () => {
                                    // If no reportId, save first then submit
                                    if (!localReportId) {
                                        setSaving(true);
                                        try {
                                            const payload = {
                                                ticket_id: ticketId,
                                                content: reportData.content,
                                                service_type: reportData.service_type,
                                                currency: reportData.currency,
                                                payment_status: reportData.payment_status,
                                                parts_total: reportData.parts_total,
                                                labor_total: reportData.labor_total,
                                                shipping_total: reportData.content.logistics?.shipping_fee || 0,
                                                total_cost: reportData.parts_total + reportData.labor_total + (reportData.content.logistics?.shipping_fee || 0),
                                                warranty_status: reportData.warranty_status,
                                                repair_warranty_days: reportData.content.warranty_terms?.repair_warranty_days || 90
                                            };
                                            const res = await axios.post('/api/v1/rma-documents/repair-reports', payload, {
                                                headers: { Authorization: `Bearer ${token}` }
                                            });
                                            if (res.data.data?.id) {
                                                await axios.post(`/api/v1/rma-documents/repair-reports/${res.data.data.id}/submit`, {}, {
                                                    headers: { Authorization: `Bearer ${token}` }
                                                });
                                                onSuccess();
                                            }
                                        } catch (err: any) {
                                            alert(err.response?.data?.error || '提交发布失败');
                                        } finally {
                                            setSaving(false);
                                        }
                                    } else {
                                        submitForReview();
                                    }
                                }}
                                disabled={submitting || saving}
                                style={{
                                    padding: '10px 24px', background: '#FFD200', border: 'none', borderRadius: 8,
                                    color: '#000', fontSize: 14, fontWeight: 600, cursor: (submitting || saving) ? 'not-allowed' : 'pointer',
                                    display: 'flex', alignItems: 'center', gap: 10, opacity: (submitting || saving) ? 0.6 : 1
                                }}
                            >
                                <Send size={16} /> {submitting ? '提交中...' : '提交发布'}
                            </button>
                        )}
                        {/* Export PDF only shown in preview mode */}
                        {canExport && activeTab === 'preview' && (
                            <button
                                onClick={exportPDF}
                                style={{
                                    padding: '10px 20px', background: 'var(--glass-border)',
                                    border: '1px solid var(--glass-border)', borderRadius: 8,
                                    color: 'var(--text-main)', fontSize: 14, fontWeight: 600, cursor: 'pointer',
                                    display: 'flex', alignItems: 'center', gap: 10, transition: 'all 0.2s'
                                }}
                            >
                                <Download size={16} /> 导出 PDF
                            </button>
                        )}

                        {reportData.status === 'published' && ['Lead', 'Admin'].includes(user?.role || '') && (
                            <button
                                onClick={() => setConfirmAction({ type: 'recall', isOpen: true })}
                                disabled={submitting}
                                style={{
                                    padding: '10px 24px', background: 'rgba(239,68,68,0.1)',
                                    border: '1px solid rgba(239,68,68,0.3)', borderRadius: 8,
                                    color: '#EF4444', fontSize: 14, fontWeight: 600, cursor: submitting ? 'not-allowed' : 'pointer',
                                    display: 'flex', alignItems: 'center', gap: 10, opacity: submitting ? 0.6 : 1
                                }}
                            >
                                <X size={16} /> 撤回发布
                            </button>
                        )}
                    </div>
                </div>

                {/* Confirm Recall Modal */}
                {confirmAction.isOpen && confirmAction.type === 'recall' && (
                    <ConfirmModal
                        title="确认撤回"
                        message="确认撤回维修报告为草稿状态？撤回后可重新编辑。"
                        confirmText="确认撤回"
                        cancelText="取消"
                        isDanger={true}
                        onConfirm={recallReport}
                        onCancel={() => setConfirmAction({ type: null, isOpen: false })}
                        loading={submitting}
                    />
                )}

                {/* PDF Settings Panel */}
                {showPdfSettings && (
                    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'var(--modal-overlay)', zIndex: 1100, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <div style={{ width: 440, background: 'var(--modal-bg)', borderRadius: 12, padding: 24, border: '1px solid var(--glass-border)' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                                <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600, color: 'var(--text-main)' }}>PDF导出设置</h3>
                                <button onClick={() => setShowPdfSettings(false)} style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}><X size={18} /></button>
                            </div>
                            
                            <div style={{ marginBottom: 16 }}>
                                <label style={{ display: 'block', fontSize: 13, color: 'var(--text-secondary)', marginBottom: 8 }}>纸张尺寸</label>
                                <div style={{ display: 'flex', gap: 8 }}>
                                    {[{ value: 'a4', label: 'A4' }, { value: 'letter', label: 'Letter' }].map(opt => (
                                        <button key={opt.value} onClick={() => setPdfSettings(prev => ({ ...prev, format: opt.value as any }))} style={{ flex: 1, padding: '10px', borderRadius: 8, background: pdfSettings.format === opt.value ? 'var(--accent-gold-subtle)' : 'var(--glass-bg-light)', border: `1px solid ${pdfSettings.format === opt.value ? 'var(--accent-gold-muted)' : 'var(--glass-border)'}`, color: pdfSettings.format === opt.value ? 'var(--text-main)' : 'var(--text-secondary)', fontSize: 14, fontWeight: pdfSettings.format === opt.value ? 600 : 400, cursor: 'pointer' }}>{opt.label}</button>
                                    ))}
                                </div>
                            </div>

                            <div style={{ marginBottom: 16 }}>
                                <label style={{ display: 'block', fontSize: 13, color: 'var(--text-secondary)', marginBottom: 8 }}>方向</label>
                                <div style={{ display: 'flex', gap: 8 }}>
                                    {[{ value: 'portrait', label: '纵向' }, { value: 'landscape', label: '横向' }].map(opt => (
                                        <button key={opt.value} onClick={() => setPdfSettings(prev => ({ ...prev, orientation: opt.value as any }))} style={{ flex: 1, padding: '10px', borderRadius: 8, background: pdfSettings.orientation === opt.value ? 'var(--accent-gold-subtle)' : 'var(--glass-bg-light)', border: `1px solid ${pdfSettings.orientation === opt.value ? 'var(--accent-gold-muted)' : 'var(--glass-border)'}`, color: pdfSettings.orientation === opt.value ? 'var(--text-main)' : 'var(--text-secondary)', fontSize: 14, fontWeight: pdfSettings.orientation === opt.value ? 600 : 400, cursor: 'pointer' }}>{opt.label}</button>
                                    ))}
                                </div>
                            </div>

                            <div style={{ marginBottom: 16 }}>
                                <label style={{ display: 'block', fontSize: 13, color: 'var(--text-secondary)', marginBottom: 8 }}>语言</label>
                                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                                    {[{ value: 'original', label: '原文' }, { value: 'zh-CN', label: '中文' }, { value: 'en-US', label: 'English' }, { value: 'ja-JP', label: '日本語' }].map(opt => (
                                        <button key={opt.value} onClick={() => setPdfSettings(prev => ({ ...prev, language: opt.value as any }))} style={{ padding: '8px 16px', borderRadius: 6, background: pdfSettings.language === opt.value ? 'var(--accent-gold-subtle)' : 'var(--glass-bg-light)', border: `1px solid ${pdfSettings.language === opt.value ? 'var(--accent-gold-muted)' : 'var(--glass-border)'}`, color: pdfSettings.language === opt.value ? 'var(--text-main)' : 'var(--text-secondary)', fontSize: 13, cursor: 'pointer' }}>{opt.label}</button>
                                    ))}
                                </div>
                                <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 6 }}>提示: AI翻译功能开发中...</div>
                            </div>

                            <div style={{ marginBottom: 16, display: 'flex', gap: 16 }}>
                                <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--text-secondary)', cursor: 'pointer' }}>
                                    <input type="checkbox" checked={pdfSettings.showHeader} onChange={e => setPdfSettings(prev => ({ ...prev, showHeader: e.target.checked }))} />显示页眉
                                </label>
                                <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--text-secondary)', cursor: 'pointer' }}>
                                    <input type="checkbox" checked={pdfSettings.showFooter} onChange={e => setPdfSettings(prev => ({ ...prev, showFooter: e.target.checked }))} />显示页脚
                                </label>
                            </div>

                            <div style={{ marginTop: 20, paddingTop: 16, borderTop: '1px solid var(--glass-border)', display: 'flex', justifyContent: 'flex-end' }}>
                                <button onClick={() => setShowPdfSettings(false)} style={{ padding: '10px 24px', background: 'var(--accent-gold)', border: 'none', borderRadius: 8, color: '#000', fontWeight: 600, cursor: 'pointer' }}>完成</button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

// Helper Components
const Section: React.FC<{ title: string; children: React.ReactNode; icon?: React.ReactNode }> = ({ title, children, icon }) => (
    <div style={{ background: 'var(--glass-bg)', padding: 20, borderRadius: 12, border: '1px solid var(--glass-border)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
            {icon && <span style={{ color: 'var(--accent-blue)' }}>{icon}</span>}
            <h4 style={{ margin: 0, fontSize: 14, fontWeight: 600, color: 'var(--text-main)' }}>{title}</h4>
        </div>
        {children}
    </div>
);

const Input: React.FC<{ label: string; value: string; onChange: (v: string) => void; disabled?: boolean }> = ({ label, value, onChange, disabled }) => (
    <div>
        <label style={{ display: 'block', fontSize: 12, color: 'var(--text-secondary)', marginBottom: 6 }}>{label}</label>
        <input
            type="text"
            value={value}
            onChange={e => onChange(e.target.value)}
            disabled={disabled}
            style={{ width: '100%', padding: 10, background: 'var(--glass-bg-hover)', border: '1px solid var(--glass-border)', borderRadius: 6, color: 'var(--text-main)', fontSize: 13, outline: 'none' }}
        />
    </div>
);

const TextArea: React.FC<{ label: string; value: string; onChange: (v: string) => void; disabled?: boolean; placeholder?: string }> = ({ label, value, onChange, disabled, placeholder }) => (
    <div style={{ marginBottom: 16 }}>
        <label style={{ display: 'block', fontSize: 12, color: 'var(--text-secondary)', marginBottom: 6 }}>{label}</label>
        <textarea
            value={value}
            onChange={e => onChange(e.target.value)}
            disabled={disabled}
            placeholder={placeholder}
            style={{ width: '100%', minHeight: 80, padding: 12, background: 'var(--glass-bg-hover)', border: '1px solid var(--glass-border)', borderRadius: 6, color: 'var(--text-main)', fontSize: 13, resize: 'vertical', outline: 'none' }}
        />
    </div>
);

const ArrayField: React.FC<{ label: string; items: string[]; onAdd: () => void; onRemove: (index: number) => void; onChange: (index: number, value: string) => void; disabled?: boolean; placeholder?: string }> = ({ label, items, onAdd, onRemove, onChange, disabled, placeholder }) => (
    <div style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <label style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{label}</label>
            {!disabled && (
                <button onClick={onAdd} style={{ padding: '4px 12px', background: 'var(--accent-blue)', border: 'none', borderRadius: 4, color: '#000', fontSize: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}>
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
                    style={{ flex: 1, padding: 8, background: 'var(--glass-bg-hover)', border: '1px solid var(--glass-border)', borderRadius: 4, color: 'var(--text-main)', fontSize: 13 }}
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
        'draft': { text: '草稿', color: 'var(--text-secondary)', bg: 'var(--glass-border)' },
        'pending_review': { text: '审核中', color: '#FFD200', bg: 'rgba(245,158,11,0.15)' },
        'approved': { text: '已发布', color: '#10B981', bg: 'rgba(16,185,129,0.15)' },
        'rejected': { text: '已驳回', color: '#EF4444', bg: 'rgba(239,68,68,0.15)' },
        'published': { text: '已发布', color: '#10B981', bg: 'rgba(16,185,129,0.15)' }
    };
    const config = configs[status] || configs['draft'];
    return (
        <span style={{ fontSize: 11, color: config.color, background: config.bg, padding: '2px 8px', borderRadius: 4 }}>
            {config.text}
        </span>
    );
};

const ReportPreview: React.FC<{ reportData: ReportData; ticketInfo?: any }> = ({ reportData, ticketInfo }) => (
    <div style={{ flex: 1, overflow: 'auto', padding: 40, background: '#f5f5f5' }}>
        <div id="repair-report-preview-content" style={{ maxWidth: 800, margin: '0 auto', background: '#fff', padding: 60, borderRadius: 8, boxShadow: '0 2px 8px rgba(0,0,0,0.1)', color: '#333', fontSize: 13 }}>
            {/* Header */}
            <div style={{ textAlign: 'center', marginBottom: 40, borderBottom: '3px solid #1a365d', paddingBottom: 20 }}>
                <h1 style={{ margin: 0, fontSize: 24, fontWeight: 700, color: '#1a365d' }}>维修报告</h1>
                <p style={{ margin: '8px 0 0 0', fontSize: 14, color: '#4a5568' }}>Repair Service Report</p>
            </div>

            {/* Report Info Header */}
            <div style={{ marginBottom: 30, padding: 16, background: '#f7fafc', borderRadius: 8, border: '1px solid #e2e8f0' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12, paddingBottom: 12, borderBottom: '1px solid #e2e8f0' }}>
                    <div style={{ display: 'flex', gap: 32 }}>
                        <div>
                            <div style={{ fontSize: 11, color: '#718096' }}>报告编号</div>
                            <div style={{ fontSize: 14, fontWeight: 600, color: '#1a365d' }}>{reportData.report_number || 'DRAFT'}</div>
                        </div>
                        <div>
                            <div style={{ fontSize: 11, color: '#718096' }}>服务类型</div>
                            <div style={{ fontSize: 13, fontWeight: 600, color: reportData.service_type === 'warranty' ? '#38a169' : '#d69e2e' }}>
                                {reportData.service_type === 'warranty' ? '保内服务' : '保外服务'}
                            </div>
                        </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: 11, color: '#718096' }}>报告日期</div>
                        <div style={{ fontSize: 13 }}>{new Date().toLocaleDateString('zh-CN')}</div>
                        {reportData.created_by && (
                            <div style={{ fontSize: 11, color: '#718096', marginTop: 4 }}>
                                编制: {reportData.created_by.display_name}
                            </div>
                        )}
                    </div>
                </div>
                {/* 关键日期 */}
                {ticketInfo && (
                    <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap' }}>
                        <div>
                            <div style={{ fontSize: 10, color: '#718096' }}>工单日期</div>
                            <div style={{ fontSize: 12, fontWeight: 500 }}>{ticketInfo.created_at ? new Date(ticketInfo.created_at).toLocaleDateString('zh-CN') : '-'}</div>
                        </div>
                        <div style={{ width: 1, background: '#e2e8f0' }} />
                        <div>
                            <div style={{ fontSize: 10, color: '#718096' }}>收货日期</div>
                            <div style={{ fontSize: 12, fontWeight: 500 }}>{ticketInfo.received_date ? new Date(ticketInfo.received_date).toLocaleDateString('zh-CN') : ticketInfo.returned_date ? new Date(ticketInfo.returned_date).toLocaleDateString('zh-CN') : '-'}</div>
                        </div>
                        <div style={{ width: 1, background: '#e2e8f0' }} />
                        <div>
                            <div style={{ fontSize: 10, color: '#718096' }}>诊断日期</div>
                            <div style={{ fontSize: 12, fontWeight: 500 }}>{ticketInfo.repair_started_at ? new Date(ticketInfo.repair_started_at).toLocaleDateString('zh-CN') : '-'}</div>
                        </div>
                        <div style={{ width: 1, background: '#e2e8f0' }} />
                        <div>
                            <div style={{ fontSize: 10, color: '#718096' }}>完成日期</div>
                            <div style={{ fontSize: 12, fontWeight: 500 }}>{ticketInfo.repair_completed_at ? new Date(ticketInfo.repair_completed_at).toLocaleDateString('zh-CN') : new Date().toLocaleDateString('zh-CN')}</div>
                        </div>
                    </div>
                )}
            </div>

            {/* 1. 客户信息 */}
            <SectionPreview title="1. 客户信息">
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                    <InfoRow label="客户名称" value={ticketInfo?.customer_name || ticketInfo?.account_name || '-'} />
                    <InfoRow label="联系人" value={ticketInfo?.contact_name || '-'} />
                    <InfoRow label="联系电话" value={ticketInfo?.contact_phone || '-'} />
                    <InfoRow label="联系邮箱" value={ticketInfo?.contact_email || '-'} />
                </div>
            </SectionPreview>

            {/* 2. 设备信息 */}
            <SectionPreview title="2. 设备信息">
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
                    <InfoRow label="产品型号" value={reportData.content.device_info.product_name} />
                    <InfoRow label="序列号" value={reportData.content.device_info.serial_number} />
                    <InfoRow label="固件版本" value={reportData.content.device_info.firmware_version} />
                </div>
            </SectionPreview>

            {/* 3. 问题描述 */}
            <SectionPreview title="3. 问题描述">
                <div style={{ marginBottom: 16 }}>
                    <div style={{ fontSize: 12, color: '#718096', marginBottom: 6 }}>客户报修:</div>
                    <div style={{ padding: 12, background: '#f7fafc', borderRadius: 6, fontStyle: 'italic', fontSize: 13 }}>
                        {reportData.content.issue_description.customer_reported || '[未提供]'}
                    </div>
                </div>
                {reportData.content.issue_description.symptoms.length > 0 && (
                    <div>
                        <div style={{ fontSize: 12, color: '#718096', marginBottom: 6 }}>故障现象:</div>
                        <ul style={{ margin: 0, paddingLeft: 20, fontSize: 13 }}>
                            {reportData.content.issue_description.symptoms.map((s: string, i: number) => (
                                <li key={i} style={{ marginBottom: 4 }}>{s}</li>
                            ))}
                        </ul>
                    </div>
                )}
            </SectionPreview>

            {/* 4. 技术诊断 */}
            <SectionPreview title="4. 技术诊断">
                <InfoBlock label="检测结果" value={reportData.content.diagnosis.findings} />
                <InfoBlock label="故障原因" value={reportData.content.diagnosis.root_cause} />
                {reportData.content.diagnosis.troubleshooting_steps.length > 0 && (
                    <div>
                        <div style={{ fontSize: 12, color: '#718096', marginBottom: 6 }}>排查步骤:</div>
                        <ol style={{ margin: 0, paddingLeft: 20, fontSize: 13 }}>
                            {reportData.content.diagnosis.troubleshooting_steps.map((s: string, i: number) => (
                                <li key={i} style={{ marginBottom: 4 }}>{s}</li>
                            ))}
                        </ol>
                    </div>
                )}
            </SectionPreview>

            {/* 5. 维修过程 */}
            <SectionPreview title="5. 维修过程">
                {reportData.content.repair_process.actions_taken.length > 0 && (
                    <div style={{ marginBottom: 16 }}>
                        <div style={{ fontSize: 12, color: '#718096', marginBottom: 6 }}>维修操作:</div>
                        <ul style={{ margin: 0, paddingLeft: 20, fontSize: 13 }}>
                            {reportData.content.repair_process.actions_taken.map((a: string, i: number) => (
                                <li key={i} style={{ marginBottom: 4 }}>{a}</li>
                            ))}
                        </ul>
                    </div>
                )}
                <InfoBlock label="测试结果" value={reportData.content.repair_process.testing_results} />
            </SectionPreview>

            {/* 6. 费用明细表 (合并原来的费用详情和费用汇总) */}
            <SectionPreview title="6. 费用明细">
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, marginBottom: 16 }}>
                    <thead>
                        <tr style={{ background: '#edf2f7' }}>
                            <th style={{ padding: 10, textAlign: 'left', borderBottom: '2px solid #cbd5e0', fontSize: 12 }}>项目</th>
                            <th style={{ padding: 10, textAlign: 'center', borderBottom: '2px solid #cbd5e0', fontSize: 12 }}>规格/编号</th>
                            <th style={{ padding: 10, textAlign: 'center', borderBottom: '2px solid #cbd5e0', fontSize: 12 }}>数量</th>
                            <th style={{ padding: 10, textAlign: 'right', borderBottom: '2px solid #cbd5e0', fontSize: 12 }}>单价</th>
                            <th style={{ padding: 10, textAlign: 'right', borderBottom: '2px solid #cbd5e0', fontSize: 12 }}>小计</th>
                        </tr>
                    </thead>
                    <tbody>
                        {/* 零件 */}
                        {reportData.content.repair_process.parts_replaced.map((part: PartUsed, i: number) => (
                            <tr key={`part-${i}`}>
                                <td style={{ padding: 8, borderBottom: '1px solid #e2e8f0' }}>零件: {part.name}</td>
                                <td style={{ padding: 8, borderBottom: '1px solid #e2e8f0', textAlign: 'center', fontFamily: 'monospace', fontSize: 11 }}>{part.part_number || '-'}</td>
                                <td style={{ padding: 8, borderBottom: '1px solid #e2e8f0', textAlign: 'center' }}>{part.quantity}</td>
                                <td style={{ padding: 8, borderBottom: '1px solid #e2e8f0', textAlign: 'right' }}>¥{Number(part.unit_price || 0).toFixed(2)}</td>
                                <td style={{ padding: 8, borderBottom: '1px solid #e2e8f0', textAlign: 'right', fontWeight: 600 }}>¥{((part.quantity || 1) * (part.unit_price || 0)).toFixed(2)}</td>
                            </tr>
                        ))}
                        {/* 工时 */}
                        {reportData.content.labor_charges.map((charge: LaborCharge, i: number) => (
                            <tr key={`labor-${i}`}>
                                <td style={{ padding: 8, borderBottom: '1px solid #e2e8f0' }}>工时: {charge.description}</td>
                                <td style={{ padding: 8, borderBottom: '1px solid #e2e8f0', textAlign: 'center' }}>{charge.hours}小时</td>
                                <td style={{ padding: 8, borderBottom: '1px solid #e2e8f0', textAlign: 'center' }}>1</td>
                                <td style={{ padding: 8, borderBottom: '1px solid #e2e8f0', textAlign: 'right' }}>¥{Number(charge.rate || 0).toFixed(2)}/小时</td>
                                <td style={{ padding: 8, borderBottom: '1px solid #e2e8f0', textAlign: 'right', fontWeight: 600 }}>¥{Number(charge.total || 0).toFixed(2)}</td>
                            </tr>
                        ))}
                        {/* 运费 */}
                        {(reportData.content.logistics?.shipping_fee || 0) > 0 && (
                            <tr>
                                <td style={{ padding: 8, borderBottom: '1px solid #e2e8f0' }}>运费: {reportData.content.logistics?.shipping_method || '快递'}</td>
                                <td style={{ padding: 8, borderBottom: '1px solid #e2e8f0', textAlign: 'center' }}>-</td>
                                <td style={{ padding: 8, borderBottom: '1px solid #e2e8f0', textAlign: 'center' }}>1</td>
                                <td style={{ padding: 8, borderBottom: '1px solid #e2e8f0', textAlign: 'right' }}>-</td>
                                <td style={{ padding: 8, borderBottom: '1px solid #e2e8f0', textAlign: 'right', fontWeight: 600 }}>¥{Number(reportData.content.logistics?.shipping_fee || 0).toFixed(2)}</td>
                            </tr>
                        )}
                        {/* 无费用项目时显示空行 */}
                        {reportData.content.repair_process.parts_replaced.length === 0 && 
                         reportData.content.labor_charges.length === 0 && 
                         !(reportData.content.logistics?.shipping_fee > 0) && (
                            <tr>
                                <td colSpan={5} style={{ padding: 20, textAlign: 'center', color: '#a0aec0' }}>未记录费用项目</td>
                            </tr>
                        )}
                    </tbody>
                    <tfoot>
                        <tr style={{ background: '#f7fafc' }}>
                            <td colSpan={3} style={{ padding: 10 }}></td>
                            <td style={{ padding: 10, textAlign: 'right', fontWeight: 600, color: '#718096' }}>零件小计:</td>
                            <td style={{ padding: 10, textAlign: 'right', fontWeight: 600 }}>¥{Number(reportData.parts_total || 0).toFixed(2)}</td>
                        </tr>
                        <tr style={{ background: '#f7fafc' }}>
                            <td colSpan={3} style={{ padding: 10 }}></td>
                            <td style={{ padding: 10, textAlign: 'right', fontWeight: 600, color: '#718096' }}>工时小计:</td>
                            <td style={{ padding: 10, textAlign: 'right', fontWeight: 600 }}>¥{Number(reportData.labor_total || 0).toFixed(2)}</td>
                        </tr>
                        {(reportData.content.logistics?.shipping_fee || 0) > 0 && (
                            <tr style={{ background: '#f7fafc' }}>
                                <td colSpan={3} style={{ padding: 10 }}></td>
                                <td style={{ padding: 10, textAlign: 'right', fontWeight: 600, color: '#718096' }}>运费:</td>
                                <td style={{ padding: 10, textAlign: 'right', fontWeight: 600 }}>¥{Number(reportData.content.logistics?.shipping_fee || 0).toFixed(2)}</td>
                            </tr>
                        )}
                        <tr style={{ background: '#1a365d' }}>
                            <td colSpan={3} style={{ padding: 12 }}></td>
                            <td style={{ padding: 12, textAlign: 'right', fontWeight: 700, color: 'var(--text-main)', fontSize: 14 }}>合计金额:</td>
                            <td style={{ padding: 12, textAlign: 'right', fontWeight: 700, color: 'var(--text-main)', fontSize: 14 }}>{reportData.currency} {Number(reportData.total_cost || 0).toLocaleString()}</td>
                        </tr>
                    </tfoot>
                </table>
                {reportData.service_type === 'warranty' && (
                    <div style={{ fontSize: 12, color: '#38a169', fontStyle: 'italic', textAlign: 'right' }}>
                        * 本次为保内服务，以上费用仅供记录，实际免收。
                    </div>
                )}
            </SectionPreview>

            {/* Footer - 包含保修条款 */}
            <div style={{ marginTop: 40, paddingTop: 20, borderTop: '2px solid #e2e8f0' }}>
                {/* 维修保修条款 */}
                <div style={{ padding: 14, background: '#ebf8ff', borderRadius: 8, border: '1px solid #90cdf4', marginBottom: 20 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: '#2b6cb0', marginBottom: 6 }}>
                        维修保修: {reportData.content.warranty_terms.repair_warranty_days} 天
                    </div>
                    <div style={{ fontSize: 12, color: '#4a5568' }}>
                        本保修仅适用于本次维修更换的部件，不包括:
                    </div>
                    <ul style={{ margin: '6px 0 0 0', paddingLeft: 20, fontSize: 12, color: '#4a5568' }}>
                        {reportData.content.warranty_terms.exclusions.map((e: string, i: number) => (
                            <li key={i}>{e}</li>
                        ))}
                    </ul>
                </div>
                {/* 公司信息 */}
                <div style={{ textAlign: 'center' }}>
                    <p style={{ fontSize: 12, color: '#a0aec0' }}>本报告由卓曜科技（深圳）有限公司出具 | KINEFINITY TECHNOLOGY CO., LTD.</p>
                    <p style={{ fontSize: 12, color: '#a0aec0', marginTop: 4 }}>如有疑问，请联系 service@kinefinity.com</p>
                </div>
            </div>
        </div>
    </div>
);

// Fee Sub-section Component with collapsible functionality
const FeeSubSection: React.FC<{ 
    title: string; 
    icon: React.ReactNode; 
    subtotal: number; 
    defaultOpen?: boolean; 
    children: React.ReactNode 
}> = ({ title, icon, subtotal, defaultOpen = true, children }) => {
    const [isOpen, setIsOpen] = React.useState(defaultOpen);
    
    return (
        <div style={{ marginBottom: 12, border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8, overflow: 'hidden' }}>
            <div 
                onClick={() => setIsOpen(!isOpen)}
                style={{ 
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    padding: '10px 14px', background: 'rgba(255,255,255,0.03)', cursor: 'pointer'
                }}
            >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    {isOpen ? <ChevronDown size={16} color="#888" /> : <ChevronUp size={16} color="#888" />}
                    <span style={{ color: 'var(--text-secondary)' }}>{icon}</span>
                    <span style={{ fontSize: 13, color: 'var(--text-main)', fontWeight: 500 }}>{title}</span>
                </div>
                <span style={{ fontSize: 13, color: '#FFD700', fontWeight: 600 }}>小计 ¥{Number(subtotal || 0).toFixed(2)}</span>
            </div>
            {isOpen && (
                <div style={{ padding: 12 }}>
                    {children}
                </div>
            )}
        </div>
    );
};

const SectionPreview: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
    <div style={{ marginBottom: 24 }}>
        <h3 style={{ fontSize: 15, fontWeight: 600, color: '#1a365d', borderBottom: '2px solid #e2e8f0', paddingBottom: 6, marginBottom: 12 }}>{title}</h3>
        {children}
    </div>
);

const InfoRow: React.FC<{ label: string; value: string }> = ({ label, value }) => (
    <div>
        <span style={{ fontSize: 12, color: '#718096' }}>{label}: </span>
        <span style={{ fontSize: 13, fontWeight: 500 }}>{value || '-'}</span>
    </div>
);

const InfoBlock: React.FC<{ label: string; value: string }> = ({ label, value }) => (
    <div style={{ marginBottom: 12 }}>
        <div style={{ fontSize: 12, color: '#718096', marginBottom: 4 }}>{label}:</div>
        <div style={{ padding: 10, background: '#f7fafc', borderRadius: 6, lineHeight: 1.5, fontSize: 13 }}>
            {value || <span style={{ color: '#a0aec0', fontStyle: 'italic' }}>[未提供]</span>}
        </div>
    </div>
);
