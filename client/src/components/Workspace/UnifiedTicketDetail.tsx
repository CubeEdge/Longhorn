/**
 * UnifiedTicketDetail (统一工单详情视图)
 * PRD P2 Section 6.3.C - Detail View
 * 左主右辅双栏布局，macOS26 风格
 *
 * 左栏 (70%): 基本信息(可折叠) → 节点进度条(RMA/SVC) → Activity 时间轴(可折叠) → 评论框
 * 右栏 (30%): 协作者 → 客户上下文
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Package, Clock, ExternalLink, AlertTriangle, ArrowLeft, Edit2, MoreHorizontal, Trash2, X, Save, FileText, Paperclip, ShieldAlert, Loader2, ArrowRight, Wrench, Calculator, CheckCircle, Shield, Search, BadgeDollarSign, ChevronRight, Zap, MessageSquare, RefreshCcw, ArrowUpCircle } from 'lucide-react';
import axios from 'axios';
import { useAuthStore } from '../../store/useAuthStore';
import { useLanguage } from '../../i18n/useLanguage';
import NodeProgressBar from './NodeProgressBar';
import { ActivityTimeline, CollapsiblePanel, MediaLightbox, ActivityDetailDrawer } from './TicketDetailComponents';
import type { CorrectionRequest } from './TicketDetailComponents';
import { CRMLookup } from '../Service/CRMLookup';
import { MentionCommentInput } from './MentionCommentInput';
import { ActionBufferModal } from './ActionBufferModal';
import { SubmitDiagnosticModal } from './SubmitDiagnosticModal';
import { MSReviewPanel } from './MSReviewPanel';
import { FinalSettlementModal } from './FinalSettlementModal';
import CustomerContextSidebar from '../Service/CustomerContextSidebar';
import { ParticipantsSidebar } from './ParticipantsSidebar';
import { AssigneeSelector } from './AssigneeSelector';
import { useViewAs } from './ViewAsComponents';
import { useUIStore } from '../../store/useUIStore';
import { RepairReportEditor } from './RepairReportEditor';
import { OpRepairReportEditor } from './OpRepairReportEditor';
import { PIEditor } from './PIEditor';
import { ClosingHandoverModal } from './ClosingHandoverModal';
import ProductWarrantyRegistrationModal from '../Service/ProductWarrantyRegistrationModal';
import ProductModal from './ProductModal';
import { CustomDatePicker } from '../UI/CustomDatePicker';
// Types
// ==============================

interface TicketDetail {
    id: number;
    ticket_number: string;
    ticket_type: string;
    current_node: string;
    status: string;
    priority: string;
    sla_status: string;
    sla_due_at: string | null;
    sla_remaining_hours?: number;
    account_name?: string;
    contact_name?: string;
    dealer_name?: string;
    dealer_code?: string;
    product_name?: string;
    serial_number?: string;
    assigned_name?: string;
    assigned_dept?: string;
    assigned_to?: number;
    submitted_name?: string;
    submitted_dept?: string;
    reporter_name?: string;
    reporter_snapshot?: any;
    account_id?: number;
    dealer_id?: number;
    product_id?: number;
    channel?: string;
    problem_summary?: string;
    problem_description?: string;
    is_warranty?: boolean;
    created_at: string;
    updated_at: string;
    parent_ticket_number?: string;
    resolution?: string;
    account_service_tier?: string;
    [key: string]: unknown;
}


type ViewContext = 'my_tasks' | 'team_queue' | 'mentioned' | 'search' | 'archive';

interface Props {
    ticketId: number;
    onBack: () => void;
    viewContext?: ViewContext;
}

// 节点主动作映射 (ticket_type → current_node → action object)
const NODE_ACTION_MAP: Record<string, Record<string, { label_zh: string; label_en: string; action: string }>> = {
    rma: {
        submitted: { label_zh: '确认收货入库', label_en: 'Confirm Receipt', action: 'receive' },
        op_receiving: { label_zh: '确认收货入库', label_en: 'Confirm Receipt', action: 'receive' },
        op_diagnosing: { label_zh: '提交诊断报告', label_en: 'Submit Diagnosis', action: 'diagnose' },
        ms_review: { label_zh: '审核报价方案', label_en: 'Approve Quote', action: 'commercial_approve' },
        op_repairing: { label_zh: '标记维修完成', label_en: 'Complete Repair', action: 'repair_complete' },
        ms_closing: { label_zh: '最终确认', label_en: 'Final Confirm', action: 'settle' },
        ge_review: { label_zh: '财务确认收款', label_en: 'Confirm Payment', action: 'finance_approve' },
        op_shipping: { label_zh: '打包发货并结案', label_en: 'Ship & Close', action: 'close' },
        op_shipping_transit: { label_zh: '补充外销单号并结案', label_en: 'Add Tracking & Close', action: 'close' },
        waiting_customer: { label_zh: '客户已付款', label_en: 'Customer Paid', action: 'paid' },
    },
    inquiry: {
        handling: { label_zh: '回复并等待客户', label_en: 'Reply & Wait', action: 'reply_to_customer' },
        awaiting_customer: { label_zh: '处理客户反馈', label_en: 'Process Feedback', action: 'process_feedback' },
        resolved: { label_zh: '重新开启工单', label_en: 'Reopen', action: 'reopen' },
    },
    svc: {
        open: { label_zh: '回复经销商', label_en: 'Reply Dealer', action: 'reply' },
        processing: { label_zh: '查看进度', label_en: 'View Progress', action: 'view' },
    },
};

// ==============================
// Priority & Status helpers
// ==============================

const nodeLabels: Record<string, { zh: string; en: string }> = {
    draft: { zh: '草稿', en: 'Draft' },
    handling: { zh: '处理中', en: 'Handling' },
    awaiting_customer: { zh: '等待客户', en: 'Awaiting Customer' },
    submitted: { zh: '已提交', en: 'Submitted' },
    ms_review: { zh: '商务审核', en: 'MS Review' },
    op_receiving: { zh: '待收货', en: 'Receiving' },
    op_diagnosing: { zh: '诊断中', en: 'Diagnosing' },
    op_repairing: { zh: '维修中', en: 'Repairing' },
    op_qa: { zh: 'QA检测', en: 'QA Inspection' },
    op_shipping: { zh: '打包发货', en: 'Shipping' },
    op_shipping_transit: { zh: '待补外销单号', en: 'Transit Info' },
    ms_closing: { zh: '最终结案', en: 'MS Closing' },
    ge_review: { zh: '财务审核', en: 'Finance Review' },
    ge_closing: { zh: '财务结案', en: 'Finance Closing' },
    resolved: { zh: '已解决', en: 'Resolved' },
    closed: { zh: '已关闭', en: 'Closed' },
    auto_closed: { zh: '超时关闭', en: 'Auto Closed' },
    converted: { zh: '已升级/转换', en: 'Converted' },
    cancelled: { zh: '已废弃', en: 'Cancelled' },
    waiting_customer: { zh: '待反馈', en: 'Awaiting Feedback' },
};

// Format date to minutes precision
function formatDateMinute(dateStr: string): string {
    if (!dateStr) return '-';
    const d = new Date(dateStr);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const h = String(d.getHours()).padStart(2, '0');
    const min = String(d.getMinutes()).padStart(2, '0');
    return `${y}/${m}/${day} ${h}:${min}`;
}

// ==============================
// Main Component
// ==============================

const UnifiedTicketDetail: React.FC<Props> = ({ ticketId, onBack, viewContext }) => {
    const { token, user } = useAuthStore();
    const { language, t } = useLanguage();
    const navigate = useNavigate();
    const lang = language === 'zh' || language === 'ja' ? 'zh' : 'en';
    const { setContextLabel } = useUIStore();

    // PRD §7.1: View As 权限降级 — 基于 acting user 判断权限
    const { viewingAs } = useViewAs();
    const actingUser = viewingAs ? {
        id: viewingAs.id,
        role: viewingAs.role,
        department_code: viewingAs.department_code || '',
    } : {
        id: (user as any)?.id,
        role: (user as any)?.role,
        department_code: (user as any)?.department_code || '',
    };

    const [ticket, setTicket] = useState<TicketDetail | null>(null);
    const [activities, setActivities] = useState<any[]>([]);
    const [participants, setParticipants] = useState<any[]>([]);
    const [ticketAttachments, setTicketAttachments] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [lightboxMedia, setLightboxMedia] = useState<{ url: string, type: 'image' | 'video' } | null>(null);
    const [selectedActivity, setSelectedActivity] = useState<any | null>(null);
    const [warrantyCalc, setWarrantyCalc] = useState<any>(null);
    const [showCalculationModal, setShowCalculationModal] = useState(false);

    // Edit logic
    const [isEditing, setIsEditing] = useState(false);
    const [editForm, setEditForm] = useState<Partial<TicketDetail>>({});
    const [changeReason, setChangeReason] = useState('');
    const [isSaving, setIsSaving] = useState(false);

    // Context Menu & Delete Logic
    const [showMoreMenu, setShowMoreMenu] = useState(false);
    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
    const [isRestoreModalOpen, setIsRestoreModalOpen] = useState(false);
    const [deleteReason, setDeleteReason] = useState('');
    const [restoreReason, setRestoreReason] = useState('');
    const [deleteCountdown, setDeleteCountdown] = useState(10);
    const [isDeleting, setIsDeleting] = useState(false);
    const [isRestoring, setIsRestoring] = useState(false);
    const [isDiagnosticModalOpen, setIsDiagnosticModalOpen] = useState(false);
    const [isMSReviewPanelOpen, setIsMSReviewPanelOpen] = useState(false);
    const [isFinalSettlementOpen, setIsFinalSettlementOpen] = useState(false);
    const [isActionBufferModalOpen, setIsActionBufferModalOpen] = useState(false);
    const [actionBufferTarget, setActionBufferTarget] = useState({ nextNode: '', label: '' });
    const [isRepairReportEditorOpen, setIsRepairReportEditorOpen] = useState(false);
    const [isOpRepairReportEditorOpen, setIsOpRepairReportEditorOpen] = useState(false);
    const [isPIEditorOpen, setIsPIEditorOpen] = useState(false);
    const [isClosingHandoverOpen, setIsClosingHandoverOpen] = useState(false);
    const [isReplyModalOpen, setIsReplyModalOpen] = useState(false);
    const [isFeedbackModalOpen, setIsFeedbackModalOpen] = useState(false);
    const [autoCloseDate, setAutoCloseDate] = useState('');
    const [nodeSlaHours, setNodeSlaHours] = useState(24);
    const [docsRefreshTrigger, setDocsRefreshTrigger] = useState(0);
    const [activePIInfo, setActivePIInfo] = useState<{ id?: number; number?: string } | null>(null);
    const [activeReportInfo, setActiveReportInfo] = useState<{ id?: number, number?: string } | null>(null);
    const [hasPI, setHasPI] = useState(false);
    const [hasRepairReport, setHasRepairReport] = useState(false);
    const [piStatus, setPIStatus] = useState<string | null>(null);
    const [reportStatus, setReportStatus] = useState<string | null>(null);
    const [isReopenModalOpen, setIsReopenModalOpen] = useState(false);
    const [reopenReason, setReopenReason] = useState('');
    const [reopenCountdown, setReopenCountdown] = useState(9);
    const [isReopening, setIsReopening] = useState(false);
    const [feedbackView, setFeedbackView] = useState<'options' | 'input' | 'resolve_input'>('options');
    
    // 升级为RMA弹窗状态
    const [isUpgradeRmaModalOpen, setIsUpgradeRmaModalOpen] = useState(false);
    const [upgradeRmaReason, setUpgradeRmaReason] = useState('');
    const [upgradeRmaCountdown, setUpgradeRmaCountdown] = useState(5);
    const [isUpgradingRma, setIsUpgradingRma] = useState(false);
    
    // 关键节点编辑模式状态
    const [keyNodeEditMode, setKeyNodeEditMode] = useState<'op_receive' | 'op_shipping' | null>(null);
    const [keyNodeEditData, setKeyNodeEditData] = useState<Record<string, unknown> | null>(null);
    const [keyNodeEditActivityId, setKeyNodeEditActivityId] = useState<number | null>(null);

    // 正规回复与代录反馈的受控状态
    const [replyContent, setReplyContent] = useState('');
    const [replyFiles, setReplyFiles] = useState<File[]>([]);
    const [feedbackContent, setFeedbackContent] = useState('');
    const [feedbackFiles, setFeedbackFiles] = useState<File[]>([]);

    const renderFilePreviews = (files: File[], setFiles: React.Dispatch<React.SetStateAction<File[]>>) => {
        if (files.length === 0) return null;
        return (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 8 }}>
                {files.map((file, i) => (
                    <div key={i} style={{ position: 'relative', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--glass-border)', borderRadius: 8, padding: '6px 10px', display: 'flex', alignItems: 'center', gap: 6 }}>
                        <Paperclip size={14} color="#888" />
                        <span style={{ fontSize: 12, color: 'var(--text-main)', maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{file.name}</span>
                        <div onClick={() => setFiles(files.filter((_, idx) => idx !== i))} style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', marginLeft: 4 }}>
                            <X size={14} color="#EF4444" />
                        </div>
                    </div>
                ))}
            </div>
        );
    };

    // Collapsible card states
    const [keyDeliverablesCollapsed, setKeyDeliverablesCollapsed] = useState(false);
    const [customerContextCollapsed, setCustomerContextCollapsed] = useState(false);
    const [isWarrantyRegistrationOpen, setIsWarrantyRegistrationOpen] = useState(false);
    const [isProductModalOpen, setIsProductModalOpen] = useState(false);

    // 更正请求状态：用于打开完整编辑器进行更正
    const [pendingCorrectionRequest, setPendingCorrectionRequest] = useState<CorrectionRequest | null>(null);
    // 诊断报告编辑模式：当为 true 时，SubmitDiagnosticModal 会预填数据
    const [diagnosticEditMode, setDiagnosticEditMode] = useState(false);
    const [diagnosticEditData, setDiagnosticEditData] = useState<Record<string, unknown> | null>(null);
    // 维修记录编辑模式
    const [repairEditMode, setRepairEditMode] = useState(false);
    const [repairEditData, setRepairEditData] = useState<Record<string, unknown> | null>(null);

    // System settings for workflow control
    const [systemSettings, setSystemSettings] = useState<Record<string, any>>({});

    // PRD §7.1: 权限判断基于 acting user
    const actingDeptNorm = (actingUser.department_code || '').toUpperCase();
    const isMsLead = (actingDeptNorm === 'MS' || actingDeptNorm === '市场部') && actingUser.role === 'Lead';
    const isGlobalAdmin = actingUser.role === 'Admin' || actingUser.role === 'Exec';
    const hasPrivilege = isGlobalAdmin || isMsLead;

    // 当前节点 → 部门归属映射（用于判断哪个 Lead 能指派）
    const NODE_DEPT_MAP: Record<string, string> = {
        // MS 节点
        draft: 'MS', submitted: 'MS', ms_review: 'MS', ms_closing: 'MS', waiting_customer: 'MS', 
        handling: 'MS', awaiting_customer: 'MS',
        // OP 节点
        op_receiving: 'OP', op_diagnosing: 'OP', op_repairing: 'OP', op_shipping: 'OP', op_shipping_transit: 'OP',
        // GE 节点
        ge_review: 'GE', ge_closing: 'GE',
        // RD 节点
        rd_consulting: 'RD', rd_resolved: 'RD',
    };
    const nodeOwnerDept = ticket ? (
        (ticket.current_node === 'submitted' && ticket.ticket_type.toLowerCase() === 'rma')
            ? 'OP'
            : (NODE_DEPT_MAP[ticket.current_node] || '')
    ) : '';
    // !! 空值守卫：nodeOwnerDept 为空时禁止任何人通过 isDeptLead 匹配（防止 '' === '' 误判）
    const isDeptLead = !!nodeOwnerDept && actingUser.role === 'Lead' && actingDeptNorm === nodeOwnerDept;
    const isDeptMember = !!nodeOwnerDept && actingDeptNorm === nodeOwnerDept;

    // canAssign 改良逻辑：
    // 1. 全局管理员/执行官 随时可指派
    // 2. 部门主管在工单处于本部门节点时，可指派或"改派"（即使已有对接人）
    // 3. 部门成员在工单处于本部门节点且未指派时，可认领/指派
    // 4. 当前对接人可转派
    // 5. 工单已结束时（resolved/closed等）禁止指派
    const isTicketFinalized = ['resolved', 'closed', 'auto_closed', 'converted', 'cancelled'].includes(String(ticket?.current_node || ''));
    const canAssign = !isTicketFinalized && (
        isGlobalAdmin ||
        (isDeptLead && !!nodeOwnerDept) ||
        (isDeptMember && !ticket?.assigned_to) ||
        (ticket?.assigned_to === actingUser.id)
    );

    const [products, setProducts] = useState<any[]>([]);
    const [isAuditModalOpen, setIsAuditModalOpen] = useState(false);
    const [auditDiffs, setAuditDiffs] = useState<any[]>([]);
    const [auditCountdown, setAuditCountdown] = useState(0);
    const [isDescriptionDrawerOpen, setIsDescriptionDrawerOpen] = useState(false);
    const [assetData, setAssetData] = useState<any>(null);

    // Fetch Asset data (Warranty, History) when SN is available
    useEffect(() => {
        if (ticket?.serial_number) {
            axios.get(`/api/v1/context/by-serial-number?serial_number=${ticket.serial_number}`, {
                headers: { Authorization: `Bearer ${token}` }
            }).then(res => {
                if (res.data.success) {
                    setAssetData(res.data.data);
                }
            }).catch(err => console.error('[AssetFetch] Failed', err));
        }
    }, [ticket?.serial_number, token]);

    useEffect(() => {
        if (ticket?.id) {
            refreshWarrantyCalc();
        }
    }, [ticket?.id, token]);

    // 辅助函数：计算工作日 (跳过周末)
    const addWorkingDays = (startDate: Date, days: number) => {
        let result = new Date(startDate);
        let addedDays = 0;
        while (addedDays < days) {
            result.setDate(result.getDate() + 1);
            if (result.getDay() !== 0 && result.getDay() !== 6) {
                addedDays++;
            }
        }
        return result.toISOString().split('T')[0];
    };

    // Function to refresh warranty calculation - can be called after warranty registration
    const refreshWarrantyCalc = useCallback(() => {
        if (!ticket?.id) return;
        // Fetch true warranty engine calculation
        axios.post('/api/v1/warranty/calculate', {
            ticket_id: ticket.id,
            technical_damage_status: 'no_damage' // default assumption until MS Review changes it
        }, {
            headers: { Authorization: `Bearer ${token}` }
        }).then(res => {
            if (res.data.success) {
                setWarrantyCalc(res.data.data);
            }
        }).catch(err => console.error('[WarrantyFetch] Failed', err));
    }, [ticket?.id, token]);

    // Fetch products when editing starts
    useEffect(() => {
        if ((isEditing || isAuditModalOpen) && products.length === 0) {
            axios.get('/api/v1/system/products', { headers: { Authorization: `Bearer ${token}` } })
                .then(res => { if (res.data.success) setProducts(res.data.data); })
                .catch(err => console.error(err));
        }
    }, [isEditing, isAuditModalOpen, token, products.length]);

    const handleQuickFixProduct = async (correctModelName: string) => {
        if (!ticket || !assetData?.device?.id) {
            alert("无法获取实物设备的系统关联 ID，修正失败。");
            return;
        }

        // 直接使用 assetData 中的确切物理设备 ID
        const finalProductId = assetData.device.id;

        const newForm = {
            ...editForm,
            product_id: finalProductId,
            product_name: correctModelName // This is for display in diff
        };
        setEditForm(newForm);

        const diffs = [
            {
                field: 'product_id',
                label: '产品型号',
                oldVal: ticket.product_name || '(空)',
                newVal: correctModelName,
                isRisk: true
            }
        ];

        setAuditDiffs(diffs);
        setChangeReason('一键修正：根据实物 SN 关联的系统型号进行修正。');
        setAuditCountdown(3);
        setIsAuditModalOpen(true);
    };

    // 字段标签映射 - 使用多语言翻译
    const getFieldLabel = (key: string): string => {
        const labelMap: Record<string, string> = {
            serial_number: t('audit.field.serial_number') || '序列号',
            product_id: t('audit.field.product_id') || '产品型号',
            priority: t('audit.field.priority') || '优先级',
            status: t('audit.field.status') || '状态',
            problem_summary: t('audit.field.problem_summary') || '问题简述',
            problem_description: t('audit.field.problem_description') || '详细描述',
            repair_content: t('audit.field.repair_content') || '维修内容',
            payment_amount: t('audit.field.payment_amount') || '金额',
            is_warranty: t('audit.field.is_warranty') || '保修判定',
            resolution: t('audit.field.resolution') || '处理记录',
            current_node: t('audit.field.current_node') || '当前节点'
        };
        return labelMap[key] || key;
    };

    // 节点名称映射 - 使用多语言翻译
    const getNodeLabel = (nodeKey: string): string => {
        const nodeMap: Record<string, string> = {
            draft: t('audit.node.draft') || '草稿',
            submitted: t('audit.node.submitted') || '已提交',
            ms_review: t('audit.node.ms_review') || '商务审核',
            op_receiving: t('audit.node.op_receiving') || '待收货',
            op_diagnosing: t('audit.node.op_diagnosing') || '诊断中',
            op_repairing: t('audit.node.op_repairing') || '维修中',
            op_qa: t('audit.node.op_qa') || 'QA检测',
            op_shipping: t('audit.node.op_shipping') || '打包发货',
            ms_closing: t('audit.node.ms_closing') || '结案确认',
            ge_review: t('audit.node.ge_review') || '财务审核',
            ge_closing: t('audit.node.ge_closing') || '财务结案',
            resolved: t('audit.node.resolved') || '已解决',
            closed: t('audit.node.closed') || '已关闭'
        };
        return nodeMap[nodeKey] || nodeKey;
    };

    const getChangedDiff = () => {
        if (!ticket) return [];
        const diffs: { field: string, label: string, oldVal: string, newVal: string, isRisk: boolean }[] = [];
        // Normalize: treat null, undefined, '' as equivalent empty
        const normalize = (v: any) => (v === null || v === undefined || v === '') ? '' : v;
        Object.keys(editForm).forEach(key => {
            const oldVal = ticket[key as keyof TicketDetail];
            const newVal = editForm[key as keyof TicketDetail];
            if (newVal === undefined) return;
            // Skip if both normalize to the same value (prevents 空→空)
            if (normalize(oldVal) === normalize(newVal)) return;
            // Also skip if stringified values are the same (handles type coercion like number vs string)
            if (String(normalize(oldVal)) === String(normalize(newVal))) return;

            let dOld = String(oldVal ?? '') || '(空)';
            let dNew = String(newVal ?? '') || '(空)';
            if (key === 'is_warranty') {
                dOld = oldVal === true || oldVal === 1 ? '保修内' : oldVal === false || oldVal === 0 ? '过保' : '(空)';
                dNew = newVal === true || (newVal as any) === 1 ? '保修内' : newVal === false || (newVal as any) === 0 ? '过保' : '(空)';
            }
            if (key === 'product_id') {
                dOld = ticket.product_name || dOld;
                dNew = products.find(p => p.id === newVal)?.name || dNew;
            }
            // 对 current_node 进行多语言翻译
            if (key === 'current_node') {
                dOld = getNodeLabel(dOld);
                dNew = getNodeLabel(dNew);
            }
            let snippetOld = dOld;
            let snippetNew = dNew;
            if (dOld.length > 20) snippetOld = dOld.substring(0, 20) + '...';
            if (dNew.length > 20) snippetNew = dNew.substring(0, 20) + '...';

            diffs.push({
                field: key,
                label: getFieldLabel(key),
                oldVal: snippetOld,
                newVal: snippetNew,
                isRisk: ['serial_number', 'product_id'].includes(key)
            });
        });
        return diffs;
    };

    // 更多菜单渲染 helper（包含编辑和删除功能）
    const renderMoreMenu = (showEdit: boolean) => (
        <>
            <button
                className="btn-glass"
                onClick={() => setShowMoreMenu(!showMoreMenu)}
                style={{
                    width: 36, height: 36, borderRadius: '50%', padding: 0,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    border: '1.5px solid var(--glass-border)',
                    background: 'var(--bg-card)',
                    boxShadow: '0 2px 10px rgba(0,0,0,0.25)',
                    cursor: 'pointer',
                    transition: 'border-color 0.15s'
                }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--text-secondary)'; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--glass-border)'; }}
            >
                <MoreHorizontal size={16} />
            </button>
            {showMoreMenu && (
                <>
                    <div
                        style={{ position: 'fixed', inset: 0, zIndex: 99 }}
                        onClick={() => setShowMoreMenu(false)}
                    />
                    <div style={{
                        position: 'absolute', top: '100%', right: 0, marginTop: 4,
                        background: 'var(--modal-bg)', backdropFilter: 'var(--glass-blur)',
                        border: '1px solid var(--card-border)', borderRadius: 8,
                        padding: 4, minWidth: 160, zIndex: 100,
                        boxShadow: 'var(--glass-shadow-lg)'
                    }}>
                        {/* 升级为RMA工单 (Inquiry Only) - 排在第一个 */}
                        {ticket?.ticket_type?.toLowerCase() === 'inquiry' && !['resolved', 'closed', 'auto_closed'].includes(ticket?.current_node as string) && ((ticket as any)?.assigned_to === actingUser.id || hasPrivilege) && (
                            <button
                                onClick={() => {
                                    setShowMoreMenu(false);
                                    setIsUpgradeRmaModalOpen(true);
                                    setUpgradeRmaCountdown(5);
                                    setUpgradeRmaReason('');
                                }}
                                style={{
                                    width: '100%', padding: '8px 12px',
                                    display: 'flex', alignItems: 'center', gap: 8,
                                    background: 'transparent', border: 'none', color: '#F59E0B',
                                    fontSize: 13, cursor: 'pointer', textAlign: 'left', borderRadius: 4
                                }}
                                onMouseEnter={e => e.currentTarget.style.background = 'rgba(245,158,11,0.1)'}
                                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                            >
                                <ArrowUpCircle size={14} /> 升级为RMA工单
                            </button>
                        )}
                        {/* 编辑工单 */}
                        {showEdit && ticket && (
                            <button
                                onClick={() => {
                                    setShowMoreMenu(false);
                                    setEditForm({
                                        priority: ticket!.priority,
                                        status: ticket!.status,
                                        problem_summary: ticket!.problem_summary,
                                        problem_description: ticket!.problem_description,
                                        resolution: ticket!.resolution,
                                        serial_number: ticket!.serial_number,
                                        repair_content: ticket!.repair_content,
                                        payment_amount: ticket!.payment_amount,
                                        is_warranty: ticket!.is_warranty,
                                        product_id: ticket!.product_id as number,
                                        account_name: ticket!.account_name,
                                        contact_name: ticket!.contact_name,
                                        dealer_name: ticket!.dealer_name
                                    });
                                    setIsEditing(true);
                                }}
                                style={{
                                    width: '100%', padding: '8px 12px', display: 'flex', alignItems: 'center', gap: 8,
                                    background: 'transparent', border: 'none', color: 'var(--text-main)',
                                    fontSize: 13, cursor: 'pointer', textAlign: 'left', borderRadius: 4
                                }}
                                onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.05)'}
                                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                            >
                                <Edit2 size={14} /> 编辑工单
                            </button>
                        )}
                        {/* 删除工单 */}
                        <button
                            onClick={() => {
                                setShowMoreMenu(false);
                                setIsDeleteModalOpen(true);
                                setDeleteCountdown(10);
                                setDeleteReason('');
                            }}
                            style={{
                                width: '100%', padding: '8px 12px', display: 'flex', alignItems: 'center', gap: 8,
                                background: 'transparent', border: 'none', color: '#EF4444',
                                fontSize: 13, cursor: 'pointer', textAlign: 'left', borderRadius: 4
                            }}
                            onMouseEnter={e => e.currentTarget.style.background = 'rgba(239,68,68,0.1)'}
                            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                        >
                            <Trash2 size={14} /> 废弃/删除工单
                        </button>

                        {/* 重新激活工单 (Inquiry Only) */}
                        {ticket?.ticket_type?.toLowerCase() === 'inquiry' && ['resolved', 'closed', 'auto_closed'].includes(ticket?.current_node as string) && ((ticket as any)?.assigned_to === actingUser.id || hasPrivilege) && (
                            <button
                                onClick={() => {
                                    setShowMoreMenu(false);
                                    setIsReopenModalOpen(true);
                                    setReopenCountdown(5);
                                    setReopenReason('');
                                }}
                                style={{
                                    width: '100%', padding: '8px 12px', borderTop: '1px solid var(--glass-border)', marginTop: 4,
                                    display: 'flex', alignItems: 'center', gap: 8,
                                    background: 'transparent', border: 'none', color: 'var(--accent-blue)',
                                    fontSize: 13, cursor: 'pointer', textAlign: 'left', borderRadius: 0
                                }}
                                onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,210,0,0.1)'}
                                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                            >
                                <RefreshCcw size={14} /> 重新激活本工单
                            </button>
                        )}
                    </div>
                </>
            )}
        </>
    );

    useEffect(() => {
        let timer: any;
        if (isDeleteModalOpen && deleteCountdown > 0) {
            timer = setInterval(() => setDeleteCountdown(prev => prev - 1), 1000);
        }
        return () => clearInterval(timer);
    }, [isDeleteModalOpen, deleteCountdown]);

    useEffect(() => {
        let timer: any;
        if (isAuditModalOpen && auditCountdown > 0) {
            timer = setInterval(() => setAuditCountdown(prev => prev - 1), 1000);
        }
        return () => clearInterval(timer);
    }, [isAuditModalOpen, auditCountdown]);

    useEffect(() => {
        let timer: any;
        if (isReopenModalOpen && reopenCountdown > 0) {
            timer = setInterval(() => setReopenCountdown(prev => prev - 1), 1000);
        }
        return () => clearInterval(timer);
    }, [isReopenModalOpen, reopenCountdown]);

    // 升级为RMA倒计时
    useEffect(() => {
        let timer: any;
        if (isUpgradeRmaModalOpen && upgradeRmaCountdown > 0) {
            timer = setInterval(() => setUpgradeRmaCountdown(prev => prev - 1), 1000);
        }
        return () => clearInterval(timer);
    }, [isUpgradeRmaModalOpen, upgradeRmaCountdown]);

    // 处理更正请求：打开对应的完整编辑器
    const handleCorrectionRequest = useCallback((request: CorrectionRequest) => {
        setPendingCorrectionRequest(request);
        
        if (request.activityType === 'op_repair_report') {
            // 打开维修记录编辑器
            setRepairEditMode(true);
            setRepairEditData(request.metadata || null);
            setIsOpRepairReportEditorOpen(true);
        } else if (request.activityType === 'diagnostic_report') {
            // 打开诊断报告编辑器
            setDiagnosticEditMode(true);
            setDiagnosticEditData(request.metadata || null);
            setIsDiagnosticModalOpen(true);
        } else if (request.activityType === 'ticket_creation' && ticket) {
            // Jihua: 现在几乎直接用 drawer 修改工单的基本信息
            setEditForm({
                account_name: ticket.account_name,
                contact_name: ticket.contact_name || ticket.reporter_name,
                product_id: ticket.product_id,
                serial_number: ticket.serial_number,
                problem_description: ticket.problem_description,
                dealer_id: ticket.dealer_id,
                dealer_name: ticket.dealer_name,
                ticket_type: ticket.ticket_type as any
            });
            setChangeReason(request.reason);
            setIsEditing(true);
        }
    }, [ticket]);

    // 关键节点点击处理：打开对应的编辑器
    useEffect(() => {
        let timer: ReturnType<typeof setTimeout>;
        if (isReopenModalOpen && reopenCountdown > 0) {
            timer = setTimeout(() => {
                setReopenCountdown(prev => prev - 1);
            }, 1000);
        }
        return () => clearTimeout(timer);
    }, [isReopenModalOpen, reopenCountdown]);

    const handleKeyNodeClick = useCallback((nodeType: 'op_receive' | 'op_shipping' | 'ms_review' | 'ms_closing') => {
        switch (nodeType) {
            case 'op_receive': {
                // 查找收货信息活动
                const receiveActivity = activities.find(a => a.activity_type === 'receiving_info');
                setKeyNodeEditMode('op_receive');
                setKeyNodeEditData(receiveActivity?.metadata || null);
                setKeyNodeEditActivityId(receiveActivity?.id || null);
                setActionBufferTarget({ nextNode: 'op_diagnosing', label: '收货入库' });
                setIsActionBufferModalOpen(true);
                break;
            }
            case 'op_shipping': {
                // 查找发货信息活动
                const shippingActivity = activities.find(a => a.activity_type === 'shipping_info');
                setKeyNodeEditMode('op_shipping');
                setKeyNodeEditData(shippingActivity?.metadata || null);
                setKeyNodeEditActivityId(shippingActivity?.id || null);
                setActionBufferTarget({ nextNode: 'resolved', label: '发货信息' });
                setIsActionBufferModalOpen(true);
                break;
            }
            case 'ms_review':
                // 打开商务审核编辑窗口
                setIsMSReviewPanelOpen(true);
                break;
            case 'ms_closing':
                // 打开结案确认编辑窗口
                setIsClosingHandoverOpen(true);
                break;
        }
    }, [activities]);

    // 关键节点更正请求处理：从详情面板中点击"更正"按钮后触发
    const handleKeyNodeCorrectionRequest = useCallback((nodeType: 'op_receive' | 'op_shipping' | 'ms_review' | 'ms_closing', reason: string) => {
        // 先记录更正原因（暂存），然后调用相应的编辑器
        // 实际的更正记录会在编辑保存时提交
        console.log('Key node correction requested:', nodeType, 'reason:', reason);
        
        // 关闭详情面板
        setSelectedActivity(null);
        
        // 打开对应的编辑器
        handleKeyNodeClick(nodeType);
    }, [handleKeyNodeClick]);

    const fetchDetail = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            // Parallel fetch: ticket detail + system settings + document exists checks
            const [res, settingsRes, piRes, rrRes] = await Promise.all([
                axios.get(`/api/v1/tickets/${ticketId}`, { headers: { Authorization: `Bearer ${token}` } }),
                axios.get('/api/v1/system/public-settings').catch(() => ({ data: { success: false } })),
                axios.get(`/api/v1/rma-documents/pi?ticket_id=${ticketId}`, { headers: { Authorization: `Bearer ${token}` } }).catch(() => ({ data: { success: false } })),
                axios.get(`/api/v1/rma-documents/repair-reports?ticket_id=${ticketId}`, { headers: { Authorization: `Bearer ${token}` } }).catch(() => ({ data: { success: false } }))
            ]);
            if (res.data.success) {
                const acts = res.data.activities || [];
                const atts = res.data.attachments || [];
                // 自动绑定附件列表至每一个活动下，打通详情显示
                const activitiesWithAttachments = acts.map((act: any) => ({
                    ...act,
                    attachments: atts.filter((a: any) => a.activity_id === act.id)
                }));
                // 将account数据合并到ticket中，以便子组件访问
                setTicket({
                    ...res.data.data,
                    account: res.data.account
                });
                setActivities(activitiesWithAttachments);
                setParticipants(res.data.participants || []);
                setTicketAttachments(atts);
            }
            if (settingsRes.data.success) {
                setSystemSettings(settingsRes.data.data || {});
            }
            const pRes = piRes.data.success && piRes.data.data ? piRes.data.data : [];
            const rRes = rrRes.data.success && rrRes.data.data ? rrRes.data.data : [];

            if (pRes.length > 0) {
                setActivePIInfo({ id: pRes[0].id, number: pRes[0].pi_number });
                setPIStatus(pRes[0].status);
            } else {
                setActivePIInfo(null);
                setPIStatus(null);
            }

            if (rRes.length > 0) {
                setActiveReportInfo({ id: rRes[0].id, number: rRes[0].report_number });
                setReportStatus(rRes[0].status);
            } else {
                setActiveReportInfo(null);
                setReportStatus(null);
            }

            setHasPI(pRes.length > 0);
            setHasRepairReport(rRes.length > 0);
        } catch (err: any) {
            setError(err.response?.data?.error || err.message);
        } finally {
            setLoading(false);
        }
    }, [ticketId, token]);

    // 生命周期：管理全局 Context Label
    useEffect(() => {
        if (!ticket) {
            setContextLabel(null);
            return;
        }

        // 动态生成标签文字
        let text = '';
        let color = '#555';
        let pulsing = false;

        const typeMap: Record<string, string> = { rma: 'RMA返厂', inquiry: '咨询工单', svc: '经销商维修' };
        const labelType = typeMap[ticket.ticket_type?.toLowerCase()] || '工单';

        switch (viewContext) {
            case 'my_tasks':
                text = `工作空间 › 我的任务`;
                color = '#FFD200';
                pulsing = true;
                break;
            case 'team_queue':
                text = `工作空间 › 部门工单`;
                color = '#60A5FA';
                pulsing = true;
                break;
            case 'mentioned':
                text = `工作空间 › 协作请求`;
                color = '#60A5FA'; // 颜色收敛为蓝色
                pulsing = true;
                break;
            case 'archive':
                const year = ticket.created_at ? new Date(ticket.created_at).getFullYear() : '';
                text = `业务档案 › ${year}年档案`;
                color = '#888';
                break;
            default: // search 或其他
                text = `业务查询 › ${labelType}`;
                color = '#888';
        }

        setContextLabel({ text, color, pulsing });

        // Unmount 时清空
        return () => setContextLabel(null);
    }, [ticket, viewContext, setContextLabel]);

    useEffect(() => { fetchDetail(); }, [fetchDetail]);

    const handleAddComment = async (content: string, visibility: string, mentions: number[] = [], attachments: File[] = [], activityType: string = 'comment') => {
        try {
            let finalContent = content;
            if (isDeptLead && !isAssignedToActingUser && ticket?.assigned_name) {
                const proxyLabel = language === 'zh' ? `(主管代理 ${ticket.assigned_name} 执行)` : `(Acting for ${ticket.assigned_name})`;
                if (content.includes('】')) {
                    const lastBracket = content.lastIndexOf('】');
                    finalContent = content.slice(0, lastBracket + 1) + ' ' + proxyLabel + ' ' + content.slice(lastBracket + 1);
                } else {
                    finalContent = proxyLabel + ' ' + content;
                }
            }

            const formData = new FormData();
            formData.append('activity_type', activityType);
            formData.append('content', finalContent);
            formData.append('visibility', visibility);
            formData.append('mentions', JSON.stringify(mentions));

            attachments.forEach(file => {
                formData.append('attachments', file);
            });

            await axios.post(`/api/v1/tickets/${ticketId}/activities`, formData, {
                headers: {
                    Authorization: `Bearer ${token}`,
                    'Content-Type': 'multipart/form-data'
                }
            });
            // Refresh activities and participants
            const [activitiesRes, detailRes] = await Promise.all([
                axios.get(`/api/v1/tickets/${ticketId}/activities`, {
                    headers: { Authorization: `Bearer ${token}` }
                }),
                axios.get(`/api/v1/tickets/${ticketId}`, {
                    headers: { Authorization: `Bearer ${token}` }
                })
            ]);
            if (activitiesRes.data.success) {
                setActivities(activitiesRes.data.data || []);
            }
            if (detailRes.data.success) {
                // 将account数据合并到ticket中，以便子组件访问
                setTicket({
                    ...detailRes.data.data,
                    account: detailRes.data.account
                });
                setParticipants(detailRes.data.participants || []);
                setTicketAttachments(detailRes.data.attachments || []);
            }
        } catch (err) {
            console.error('[UnifiedDetail] Failed to add comment', err);
        }
    };

    const handlePreSave = () => {
        const diffs = getChangedDiff();
        if (diffs.length === 0) {
            setIsEditing(false); // No changes made
            return;
        }
        setAuditDiffs(diffs);
        setChangeReason('');
        setAuditCountdown(5);
        setIsAuditModalOpen(true);
    };

    const handleSaveEdit = async () => {
        if (!changeReason.trim()) return;
        setIsSaving(true);
        try {
            // 1. 保存工单基本信息（排除附件相关字段）
            const { _attachmentsToDelete, _newAttachments, ...ticketData } = editForm;
            await axios.patch(`/api/v1/tickets/${ticketId}`, {
                ...ticketData,
                change_reason: changeReason.trim(),
                is_modal_edit: true
            }, { headers: { Authorization: `Bearer ${token}` } });

            // 2. 删除标记的附件
            const attachmentsToDelete = (_attachmentsToDelete as number[]) || [];
            for (const attachId of attachmentsToDelete) {
                try {
                    await axios.delete(`/api/v1/tickets/${ticketId}/attachments/${attachId}`, {
                        headers: { Authorization: `Bearer ${token}` }
                    });
                } catch (err: any) {
                    console.error(`Failed to delete attachment ${attachId}:`, err);
                }
            }

            // 3. 上传新附件
            const newAttachments = (_newAttachments as File[]) || [];
            for (const file of newAttachments) {
                try {
                    const formData = new FormData();
                    formData.append('file', file);
                    await axios.post(`/api/v1/tickets/${ticketId}/attachments`, formData, {
                        headers: { Authorization: `Bearer ${token}` }
                    });
                } catch (err: any) {
                    console.error(`Failed to upload attachment ${file.name}:`, err);
                }
            }

            setIsEditing(false);
            setIsAuditModalOpen(false);
            setChangeReason('');
            fetchDetail();
        } catch (err: any) {
            alert(err.response?.data?.error || err.message);
        } finally {
            setIsSaving(false);
        }
    };

    const handleDelete = async () => {
        if (!deleteReason.trim() || deleteCountdown > 0) return;
        setIsDeleting(true);
        try {
            await axios.delete(`/api/v1/tickets/${ticketId}`, {
                data: { delete_reason: deleteReason.trim() },
                headers: { Authorization: `Bearer ${token}` }
            });
            onBack();
        } catch (err: any) {
            alert(err.response?.data?.error || err.message);
            setIsDeleting(false);
        }
    };

    const handleRestore = async () => {
        if (!restoreReason.trim()) return;
        setIsRestoring(true);
        try {
            await axios.post(`/api/v1/tickets/${ticketId}/restore`, {
                restore_reason: restoreReason.trim()
            }, { headers: { Authorization: `Bearer ${token}` } });
            setIsRestoreModalOpen(false);
            setRestoreReason('');
            fetchDetail();
        } catch (err: any) {
            alert(err.response?.data?.error || err.message);
        } finally {
            setIsRestoring(false);
        }
    };


    const handleUpgrade = async (type: 'rma' | 'svc', reason?: string) => {
        try {
            const res = await axios.post(`/api/v1/tickets/${ticketId}/convert`, {
                target_type: type,
                reason: reason
            }, { headers: { Authorization: `Bearer ${token}` } });
            if (res.data.success) {
                navigate(`/service/tickets/${res.data.data.new_ticket_id}`);
            }
        } catch (err: any) {
            alert(err.response?.data?.error || err.message);
        }
    };

    /**
     * Handle Node Action (Transition)
     */
    const handleAction = async (action: string) => {
        if (!ticket || loading) return;

        // Logic to determine next node based on current node and ticket type
        let nextNode = ticket.current_node;
        const type = ticket.ticket_type.toLowerCase();

        // Simple transition logic for MVP
        if (type === 'rma') {
            const rmaFlow = ['submitted', 'op_receiving', 'op_diagnosing', 'ms_review', 'op_repairing', 'ms_closing', 'op_shipping', 'resolved'];
            let idx = rmaFlow.indexOf(ticket.current_node);
            if (ticket.current_node === 'submitted' || ticket.current_node === 'op_receiving') {
                nextNode = 'op_diagnosing';
            } else if (idx >= 0 && idx < rmaFlow.length - 1) {
                nextNode = rmaFlow[idx + 1];
            }

            // High-priority override for finance flow
            // 根据系统设置决定是否需要财务确认
            const requireFinance = systemSettings.require_finance_confirmation !== false;
            if (ticket.current_node === 'ms_closing') {
                if (requireFinance && Number(ticket.is_warranty) === 0 && (!ticket.payment_amount || Number(ticket.payment_amount) === 0)) {
                    nextNode = 'ge_review';  // 需要财务确认
                }
                // 如果不需要财务确认或已有金额，则走默认流程到 op_shipping
            }
            if (ticket.current_node === 'ge_review') {
                nextNode = 'ms_closing';
            }
        } else if (type === 'inquiry') {
            if (ticket.current_node === 'handling') nextNode = 'awaiting_customer';
            else if (['awaiting_customer', 'resolved', 'closed', 'auto_closed'].includes(ticket.current_node)) {
                if (action === 'resolve') nextNode = 'resolved';
                else if (action === 'reopen' || action === 'continue') nextNode = 'handling';
                else nextNode = 'awaiting_customer';
            }
        }

        // Check if we need to open Buffer Modal instead of direct patch
        const mandatoryNodes = ['op_receiving', 'submitted', 'op_repairing', 'op_shipping', 'op_shipping_transit', 'ms_review', 'ms_closing', 'ge_review'];
        if (mandatoryNodes.includes(ticket.current_node)) {
            // For ms_review and ms_closing, only mandatory if NOT warranty
            if (['ms_review'].includes(ticket.current_node) && ticket.is_warranty) {
                // Keep direct patch for warranty
            } else if (ticket.current_node === 'ms_closing' && ticket.is_warranty) {
                // For ms_closing, warranty means we still want a confirmation to push to OP Shipping cleanly
                setActionBufferTarget({ nextNode, label: action });
                setIsActionBufferModalOpen(true);
                return;
            } else {
                setActionBufferTarget({ nextNode, label: action });
                setIsActionBufferModalOpen(true);
                return;
            }
        }

        try {
            setLoading(true);
            const proxyReason = (isDeptLead && !isAssignedToActingUser) 
                ? ` [主管代理执行] ${language === 'zh' ? `(代理自 ${ticket?.assigned_name || '未分配'})` : `(Acting for ${ticket?.assigned_name || 'Unassigned'})`}`
                : '';
            await axios.patch(`/api/v1/tickets/${ticketId}`, {
                current_node: nextNode,
                change_reason: `执行主流程动作: ${action}${proxyReason}`
            }, { headers: { Authorization: `Bearer ${token}` } });
            fetchDetail();
        } catch (err: any) {
            alert(err.response?.data?.error || err.message);
        } finally {
            setLoading(false);
        }
    };

    const handleReopen = async () => {
        if (!reopenReason.trim() || reopenReason.trim().length < 5) {
            alert(language === 'zh' ? '请输入至少 5 个字符的重新激活理由' : 'Please enter at least 5 characters for re-opening reason.');
            return;
        }
        try {
            setIsReopening(true);
            await handleAddComment(`${language === 'zh' ? '【重新激活工单】理由：' : '[Ticket Reopened] Reason: '} ${reopenReason}`, 'all', []);
            await handleAction('reopen');
            setIsReopenModalOpen(false);
            setReopenReason('');
        } catch (err: any) {
            alert(err.response?.data?.error || err.message);
        } finally {
            setIsReopening(false);
        }
    };

    // ==============================
    // Loading / Error
    // ==============================

    if (loading) {
        return (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 400, color: '#888' }}>
                <Clock size={20} style={{ animation: 'spin 1s linear infinite', marginRight: 8 }} />
                {t('status.processing') || '加载中...'}
                <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
            </div>
        );
    }

    if (error || !ticket) {
        return (
            <div style={{ padding: 32, textAlign: 'center' }}>
                <AlertTriangle size={32} color="#EF4444" />
                <p style={{ color: '#EF4444', marginTop: 12 }}>{error || '工单不存在'}</p>
                <button onClick={onBack} style={{
                    marginTop: 16, padding: '8px 20px', borderRadius: 8,
                    border: '1px solid var(--card-border)', background: 'transparent',
                    color: 'var(--text-main)', cursor: 'pointer'
                }}>
                    {t('action.back') || '返回'}
                </button>
            </div>
        );
    }

    const isRmaOrSvc = ['rma', 'svc'].includes(ticket.ticket_type?.toLowerCase());

    // Determine if the action footer should be shown and if the user can execute actions
    const isAssignedToActingUser = ticket.assigned_to === actingUser.id;
    const canExecuteAction = (isAssignedToActingUser || isGlobalAdmin || isDeptLead) && (NODE_ACTION_MAP[ticket.ticket_type?.toLowerCase()] || {})[ticket.current_node];

    const footerAction = ticket
        ? (NODE_ACTION_MAP[ticket.ticket_type?.toLowerCase()] || {})[ticket.current_node] || null
        : null;

    return (
        <div style={{ padding: 0, paddingBottom: canExecuteAction ? 72 : 0, position: 'relative' }}>

            {/* ====== Header Bar ====== */}
            <div style={{
                display: 'flex', alignItems: 'center', gap: 12,
                padding: '12px 0', marginBottom: 16,
                borderBottom: '1px solid var(--card-border)',
            }}>
                <button
                    onClick={onBack}
                    style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        width: 36, height: 36,
                        borderRadius: '50%',
                        border: '1px solid var(--card-border)',
                        background: 'var(--card-bg-light)',
                        color: 'var(--text-main)',
                        cursor: 'pointer',
                        transition: 'all 0.15s',
                        padding: 0,
                    }}
                    onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.08)'; }}
                    onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.04)'; }}
                >
                    <ArrowLeft size={18} />
                </button>

                <span style={{
                    fontSize: 22,
                    fontWeight: 700,
                    color: (viewContext === 'archive' || viewContext === 'search') ? 'var(--text-tertiary)' : 'var(--text-main)',
                    letterSpacing: '-0.02em'
                }}>
                    {ticket.ticket_number}
                </span>

                {/* Context Status Badge: [ Node · Dept · Assignee / Claim ] */}
                {/* Hide status badge only for non-inquiry when resolved/closed. Inquiry shows static info. */}
                {(!['resolved', 'closed', 'auto_closed', 'converted', 'cancelled'].includes(ticket?.current_node || '')) && (
                    <div style={{
                        display: 'flex', alignItems: 'center', gap: 6,
                        padding: '6px 14px', borderRadius: 10, fontSize: 14, fontWeight: 700,
                        background: 'rgba(255,215,0,0.15)', border: '1px solid rgba(255,215,0,0.3)',
                        color: 'var(--accent-yellow-dark, #B45309)',
                    }}>
                        <span>
                            {nodeLabels[ticket.current_node]?.[lang === 'zh' ? 'zh' : 'en'] || nodeLabels[ticket.current_node]?.zh || ticket.current_node}
                        </span>
                        <span style={{ opacity: 0.4 }}>·</span>
                        <span>{(() => {
                            if (ticket.department_code) return ticket.department_code as string;
                            if (ticket.assigned_dept) return ticket.assigned_dept as string;
                            const n = String(ticket.current_node || '').toLowerCase();
                            if (n.startsWith('ms_') || ['draft', 'handling', 'awaiting_customer', 'open', 'waiting', 'waiting_customer'].includes(n)) return 'MS';
                            if (n.startsWith('op_') || ['submitted', 'shipped'].includes(n)) return 'OP';
                            if (n.startsWith('ge_')) return 'GE';
                            return '-';
                        })()}</span>
                        <span style={{ opacity: 0.4 }}>·</span>
                        {canAssign && ticket?.ticket_type?.toLowerCase() !== 'inquiry' ? (
                            <div style={{ marginTop: '-1px' }}>
                                <AssigneeSelector
                                    ticketId={ticket.id}
                                    currentAssigneeId={ticket.assigned_to as number | null}
                                    currentAssigneeName={ticket.assigned_name}
                                    currentAssigneeDept={ticket.assigned_dept}
                                    currentNode={ticket.current_node}
                                    ticketType={ticket.ticket_type}
                                    onUpdate={fetchDetail}
                                />
                            </div>
                        ) : ticket.assigned_name ? (
                            <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                <span>{String(ticket.assigned_name)}</span>
                                {ticket.assigned_dept && (
                                    <span style={{ fontSize: 11, opacity: 0.6, padding: '0 4px', background: 'rgba(0,0,0,0.1)', borderRadius: 3, fontWeight: 500 }}>
                                        {ticket.assigned_dept}
                                    </span>
                                )}
                            </span>
                        ) : (
                            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                                <span style={{ color: '#888' }}>未认领</span>
                            </div>
                        )}
                    </div>
                )}

                {/* SLA indicator */}
                {ticket.sla_status === 'breached' && (
                    <span style={{
                        display: 'inline-flex', alignItems: 'center', gap: 4,
                        padding: '3px 10px', borderRadius: 6, fontSize: 11, fontWeight: 600,
                        background: 'rgba(239,68,68,0.15)', color: '#EF4444',
                    }}>
                        <AlertTriangle size={13} /> SLA Breached
                    </span>
                )}
                {ticket.sla_status === 'warning' && (
                    <span style={{
                        display: 'inline-flex', alignItems: 'center', gap: 4,
                        padding: '3px 10px', borderRadius: 6, fontSize: 11, fontWeight: 600,
                        background: 'rgba(245,158,11,0.15)', color: '#FFD200',
                    }}>
                        <AlertTriangle size={13} /> SLA Warning
                    </span>
                )}

                <div style={{ flex: 1 }} />

                {/* Edit & More Actions — PRD §7.1 阶梯式权限守卫 */}
                {!ticket.is_deleted ? (
                    <>
                        {/* 更多菜单（编辑+删除）可见性守卫 */}
                        <div style={{ position: 'relative' }}>
                            {(() => {
                                const isFinalized = ['resolved', 'closed', 'auto_closed', 'converted', 'cancelled'].includes(ticket.current_node);
                                // 特权用户(MS Lead/Admin)：始终显示更多菜单，包含编辑功能
                                if (hasPrivilege) {
                                    return renderMoreMenu(true);
                                }
                                // 检查编辑权限
                                const isRelated = ticket.assigned_to === actingUser.id
                                    || (ticket as any).created_by === actingUser.id
                                    || (ticket as any).submitted_by === actingUser.id
                                    || (ticket.participants as any[])?.some?.((p: any) => (p.user_id || p.id || p) === actingUser.id);
                                const canEdit = !isFinalized && isRelated;
                                // 检查删除权限
                                const isOwner = (ticket as any).created_by === actingUser.id
                                    || (ticket as any).submitted_by === actingUser.id;
                                const canDelete = ['draft', 'submitted'].includes(ticket.current_node) && isOwner;
                                // 两个权限都没有，不显示菜单
                                if (!canEdit && !canDelete) return null;
                                // 只有编辑权限或两个都有，显示带编辑的菜单
                                if (canEdit) return renderMoreMenu(true);
                                // 只有删除权限，显示不带编辑的菜单
                                return renderMoreMenu(false);
                            })()}
                        </div>
                    </>
                ) : (
                    hasPrivilege && (
                        <button
                            className="btn-glass"
                            onClick={() => setIsRestoreModalOpen(true)}
                            style={{ padding: '6px 12px', display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: '#10B981' }}
                        >
                            <ExternalLink size={14} /> 恢复工单
                        </button>
                    )
                )}
            </div>

            {/* ====== Two Column Layout ====== */}
            <div style={{ display: 'flex', gap: 20, alignItems: 'flex-start' }}>

                {/* ====== LEFT COLUMN (Main) ====== */}
                <div style={{ flex: '1 1 70%', minWidth: 0, overflow: 'visible' }}>

                    {/* Basic Info Card - Collapsible, elevated z-index for dropdown */}
                    <div style={{ position: 'relative', zIndex: 10 }}>
                        <CollapsiblePanel
                            title={
                                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                    <span>{t('ticket.basic_info') || '基本信息'}</span>
                                </div>
                            }
                            icon={
                                <span style={{
                                    padding: '2px 8px', borderRadius: 4, fontSize: 11, fontWeight: 900,
                                    background: ticket.priority === 'P0' ? '#EF4444' : ticket.priority === 'P1' ? '#FFD200' : '#FFFFFF',
                                    color: (ticket.priority === 'P1' || ticket.priority === 'P2') ? '#000' : '#fff',
                                    boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
                                    border: ticket.priority === 'P2' ? '1px solid rgba(0,0,0,0.1)' : 'none'
                                }}>
                                    {ticket.priority}
                                </span>
                            }
                            headerRight={
                                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                    {/* Header 不显示保修状态，所有保修信息在序列号区域显示 */}
                                </div>
                            }
                            defaultOpen={true}
                        >
                            <div style={{ padding: '20px 24px 24px' }}>
                                {/* New Layout per Fig2 */}
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

                                    {/* Row 1: Product Model (left) + Serial Number + History (right) */}
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 32px', alignItems: 'center' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                            <span style={{ color: 'var(--text-secondary)', fontSize: 13, minWidth: 60 }}>产品型号</span>
                                            <span style={{ fontSize: 14, color: 'var(--text-main)', fontWeight: 500 }}>{String(ticket.product_name || '-')}</span>
                                        </div>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                                            {/* SN 链接：使用 assetData 查询结果的 device.id，而非工单存储的 product_id */}
                                            {(() => {
                                                const realDeviceId = assetData?.device?.id;
                                                const isUnregistered = assetData?.device?.is_unregistered;
                                                const canNavigate = realDeviceId && !isUnregistered;
                                                // 场景判断：B=已入库但无保修, C=未入库
                                                const warrantyStatus = warrantyCalc?.final_warranty_status;
                                                const isScenarioC = isUnregistered; // 未入库
                                                const isScenarioB = !isUnregistered && realDeviceId && warrantyStatus === 'warranty_unknown'; // 已入库但无保修
                                                // 权限：MS 部门可操作入库/注册
                                                const canOperate = actingDeptNorm === 'MS' || isGlobalAdmin;
                                                
                                                return (
                                                    <>
                                                        <div
                                                            style={{ 
                                                                display: 'flex', alignItems: 'center', gap: 8, 
                                                                cursor: canNavigate ? 'pointer' : 'default',
                                                                opacity: isUnregistered ? 0.7 : 1
                                                            }}
                                                            onClick={() => canNavigate && navigate(`/service/products/${realDeviceId}`)}
                                                            title={isUnregistered ? '设备未入库，无法查看详情' : undefined}
                                                        >
                                                            {/* 序列号标签颜色与销售渠道一致 */}
                                                            <span style={{ color: 'var(--text-secondary)', fontSize: 13 }}>序列号</span>
                                                            <span style={{ 
                                                                fontSize: 14, 
                                                                color: canNavigate ? 'var(--text-main)' : 'var(--text-secondary)', 
                                                                fontWeight: 500
                                                            }}>
                                                                {String(ticket.serial_number || '-')}
                                                            </span>
                                                        </div>

                                                        {/* 场景 C: 未入库 - 显示产品入库按钮 (红色) */}
                                                        {isScenarioC && canOperate && (
                                                            <button
                                                                onClick={(e) => { e.stopPropagation(); setIsProductModalOpen(true); }}
                                                                style={{
                                                                    padding: '6px 12px', fontSize: 13, fontWeight: 600,
                                                                    background: 'rgba(230, 0, 0, 0.15)', border: '1px solid rgba(230, 0, 0, 0.4)',
                                                                    borderRadius: 4, color: '#E60000', cursor: 'pointer',
                                                                    transition: 'all 0.2s',
                                                                    display: 'flex', alignItems: 'center', gap: 6,
                                                                    flexShrink: 0
                                                                }}
                                                                onMouseEnter={e => e.currentTarget.style.background = 'rgba(230, 0, 0, 0.25)'}
                                                                onMouseLeave={e => e.currentTarget.style.background = 'rgba(230, 0, 0, 0.15)'}
                                                            >
                                                                <AlertTriangle size={16} />
                                                                产品入库
                                                            </button>
                                                        )}

                                                        {/* 场景 B: 已入库但未注册保修 - 显示注册保修按钮 (红色) */}
                                                        {isScenarioB && canOperate && (
                                                            <button
                                                                onClick={(e) => { e.stopPropagation(); setIsWarrantyRegistrationOpen(true); }}
                                                                style={{
                                                                    padding: '6px 12px', fontSize: 13, fontWeight: 600,
                                                                    background: 'rgba(230, 0, 0, 0.15)', border: '1px solid rgba(230, 0, 0, 0.4)',
                                                                    borderRadius: 4, color: '#E60000', cursor: 'pointer',
                                                                    transition: 'all 0.2s',
                                                                    display: 'flex', alignItems: 'center', gap: 6,
                                                                    flexShrink: 0
                                                                }}
                                                                onMouseEnter={e => e.currentTarget.style.background = 'rgba(230, 0, 0, 0.25)'}
                                                                onMouseLeave={e => e.currentTarget.style.background = 'rgba(230, 0, 0, 0.15)'}
                                                            >
                                                                <AlertTriangle size={16} />
                                                                注册保修
                                                            </button>
                                                        )}

                                                        {/* 场景 A: 已入库且在保 - 显示在保 (绿色) */}
                                                        {assetData?.device && !assetData.device.is_unregistered && warrantyCalc?.final_warranty_status === 'warranty_valid' && (
                                                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                                                                <Shield size={16} color="#10B981" />
                                                                <span style={{ fontSize: 14, fontWeight: 600, color: '#10B981' }}>
                                                                    在保
                                                                </span>
                                                            </div>
                                                        )}

                                                        {/* 场景 A: 已入库但过保 - 显示过保 (橙色) */}
                                                        {assetData?.device && !assetData.device.is_unregistered && warrantyCalc?.final_warranty_status === 'warranty_expired' && (
                                                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                                                                <Shield size={16} color="#F59E0B" />
                                                                <span style={{ fontSize: 14, fontWeight: 600, color: '#F59E0B' }}>
                                                                    过保
                                                                </span>
                                                            </div>
                                                        )}
                                                    </>
                                                );
                                            })()}
                                            {assetData?.service_history && assetData.service_history.length > 0 && !assetData?.device?.is_unregistered && (
                                                <div
                                                    style={{
                                                        display: 'flex', alignItems: 'center', gap: 6, padding: '4px 12px', borderRadius: 8,
                                                        background: 'rgba(255, 255, 255, 0.05)', border: '1px solid rgba(255, 255, 255, 0.15)',
                                                        color: 'var(--text-secondary)', fontSize: 13, fontWeight: 500, cursor: 'pointer',
                                                        transition: 'all 0.2s'
                                                    }}
                                                    onMouseEnter={e => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)'}
                                                    onMouseLeave={e => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)'}
                                                    onClick={() => assetData?.device?.id && window.open(`/service/products/${assetData.device.id}`, '_blank')}
                                                >
                                                    <Clock size={13} style={{ opacity: 0.6 }} />
                                                    <span>关联工单数: {assetData.service_history.length}</span>
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    {/* Row 2: Mismatch Warning (full width, only if mismatch exists) */}
                                    {assetData?.device && !assetData.device.is_unregistered && ticket.product_name !== assetData.device.model_name && (
                                        <div style={{
                                            display: 'flex', alignItems: 'center', gap: 10, padding: '6px 12px',
                                            background: 'rgba(245, 158, 11, 0.1)', border: '1px solid rgba(245, 158, 11, 0.2)',
                                            borderRadius: 8
                                        }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: '#FFD200', fontWeight: 600 }}>
                                                <AlertTriangle size={14} />
                                                声明型号 ({ticket.product_name}) 与实物 ({assetData.device.model_name}) 不符
                                            </div>
                                            <button
                                                onClick={() => handleQuickFixProduct(assetData.device.model_name)}
                                                style={{
                                                    padding: '2px 10px', background: 'rgba(245, 158, 11, 0.15)', border: '1px solid rgba(245, 158, 11, 0.3)',
                                                    borderRadius: 4, color: '#FFD200', fontSize: 11, fontWeight: 700, cursor: 'pointer'
                                                }}
                                            >
                                                一键修正
                                            </button>
                                        </div>
                                    )}

                                    {/* Row 3-4: 2-column grid */}
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px 32px', alignItems: 'start' }}>
                                        {/* Row 3 Col 1: Customer */}
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                            <span style={{ color: 'var(--text-secondary)', fontSize: 13, minWidth: 60 }}>{t('ticket.customer') || '客户'}</span>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 14, fontWeight: 600 }}>
                                                {(() => {
                                                    const acc = String(ticket.account_name || '--') || '';
                                                    const rep = String(ticket.contact_name || ticket.reporter_snapshot?.name || ticket.reporter_name || '') || '';
                                                    let text = acc;
                                                    if (rep && rep !== acc && rep !== '-') {
                                                        text += ` · ${rep}`;
                                                    }
                                                    return text;
                                                })()}
                                                {ticket.account_service_tier && (
                                                    <span style={{
                                                        fontSize: 10, padding: '1px 6px', borderRadius: 4,
                                                        background: (ticket.account_service_tier as string) === 'DIAMOND' ? 'linear-gradient(135deg, #b9f2ff, #29abe2)' : 'rgba(255,255,255,0.1)',
                                                        color: (ticket.account_service_tier as string) === 'DIAMOND' ? '#000' : '#888',
                                                        fontWeight: 800
                                                    }}>
                                                        {String(ticket.account_service_tier)}
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                        {/* Row 3 Col 2: Channel */}
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                            <span style={{ color: 'var(--text-secondary)', fontSize: 13 }}>销售渠道</span>
                                            <span style={{ fontSize: 14, color: 'var(--text-main)' }}>
                                                {ticket.dealer_name ? `${ticket.dealer_name}${ticket.dealer_code ? ` (${ticket.dealer_code})` : ''}` : '直销'}
                                            </span>
                                        </div>

                                        {/* Row 4 Col 1: Created Time */}
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                            <span style={{ color: 'var(--text-secondary)', fontSize: 13, minWidth: 60 }}>{t('ticket.created_at') || '创建时间'}</span>
                                            <span style={{ fontSize: 14, color: 'var(--text-main)' }}>{formatDateMinute(ticket.created_at)}</span>
                                        </div>
                                        {/* Row 4 Col 2: Submitter */}
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                            <span style={{ color: 'var(--text-secondary)', fontSize: 13 }}>{t('ticket.submitted_by') || '提交者'}</span>
                                            <span style={{ fontSize: 14, color: 'var(--text-main)' }}>
                                                {ticket.submitted_name ? (
                                                    <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                                        {ticket.submitted_dept && <span style={{ color: '#666', fontSize: 11 }}>[{ticket.submitted_dept}]</span>}
                                                        {ticket.submitted_name}
                                                    </span>
                                                ) : '-'}
                                            </span>
                                        </div>
                                    </div>
                                </div>

                                {/* Problem summary */}
                                {(ticket.problem_summary || ticket.problem_description) && (
                                    <div style={{
                                        marginTop: 14, padding: '14px 16px', borderRadius: 8,
                                        background: 'var(--glass-bg)', border: '1px solid var(--glass-border)',
                                        cursor: 'pointer', transition: 'background 0.2s', position: 'relative'
                                    }}
                                        onClick={() => setIsDescriptionDrawerOpen(true)}
                                        onMouseEnter={e => e.currentTarget.style.background = 'var(--glass-bg-hover)'}
                                        onMouseLeave={e => e.currentTarget.style.background = 'var(--glass-bg)'}
                                    >
                                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                                            <div style={{ fontSize: 13, color: 'var(--text-secondary)', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                                <FileText size={14} />
                                                问题描述
                                                {((ticket.problem_description?.length || 0) > 80 || (ticket.problem_summary?.length || 0) > 80) && (
                                                    <span style={{ color: '#FFD200', marginLeft: 4, textTransform: 'none', letterSpacing: 'normal' }}>· 已折叠部分</span>
                                                )}
                                                {/* 附件标志：仅计算没有 activity_id 的创单附件 */}
                                                {ticketAttachments.filter((a: any) => !a.activity_id).length > 0 && (
                                                    <span style={{ display: 'flex', alignItems: 'center', gap: 4, color: '#888', marginLeft: 4, textTransform: 'none', letterSpacing: 'normal' }}>
                                                        · <Paperclip size={12} /> {ticketAttachments.filter((a: any) => !a.activity_id).length}
                                                    </span>
                                                )}
                                            </div>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--accent-blue)', fontSize: 13, fontWeight: 600 }}>
                                                <span>更多详情</span>
                                                <ExternalLink size={14} />
                                            </div>
                                        </div>
                                        <div style={{
                                            fontSize: 14, color: 'var(--text-main)', lineHeight: 1.7,
                                            display: '-webkit-box', WebkitLineClamp: 4, WebkitBoxOrient: 'vertical', overflow: 'hidden',
                                            fontWeight: 500
                                        }}>
                                            {(ticket.problem_summary as string) || (ticket.problem_description as string)}
                                        </div>
                                    </div>
                                )}

                                {/* Resolution */}
                                {ticket.resolution && (
                                    <div style={{
                                        marginTop: 10, padding: 12, borderRadius: 8,
                                        background: 'rgba(16, 185, 129, 0.05)', border: '1px solid rgba(16, 185, 129, 0.1)',
                                    }}>
                                        <div style={{ fontSize: 11, color: '#10B981', marginBottom: 4 }}>
                                            处理结果
                                        </div>
                                        <div style={{ fontSize: 16, color: '#ddd', lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>
                                            {ticket.resolution || '暂无详细处理记录'}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </CollapsiblePanel>
                    </div>

                    {/* Node Progress Bar (RMA / SVC only) */}
                    {isRmaOrSvc && (
                        <NodeProgressBar
                            ticketType={ticket.ticket_type}
                            currentNode={ticket.current_node}
                            assignedName={ticket.assigned_name}
                            assignedDept={ticket.assigned_dept}
                        />
                    )}

                    {/* Activity Timeline - Collapsible */}
                    <CollapsiblePanel
                        title={t('ticket.activity_timeline') || '活动时间轴'}
                        icon={<Clock size={14} color="#FFD200" />}
                        count={activities.filter(a => a.activity_type !== 'mention').length}
                        defaultOpen={true}
                    >
                        <ActivityTimeline activities={activities} loading={false} onActivityClick={(act) => setSelectedActivity(act)} ticket={ticket} onKeyNodeClick={handleKeyNodeClick} />
                    </CollapsiblePanel>

                    {/* Comment Input */}
                    <div style={{
                        borderRadius: 12,
                        background: 'rgba(30,30,30,0.5)', backdropFilter: 'blur(12px)',
                        border: '1px solid rgba(255,255,255,0.06)',
                        position: 'relative',
                    }}>
                        <MentionCommentInput onSubmit={handleAddComment} />
                    </div>

                    {/* Sticky Action Bar (Bottom) - Fixed at the bottom of the left column area */}
                    {canExecuteAction && (
                        <div style={{
                            position: 'sticky',
                            bottom: 0,
                            margin: '24px 0 -24px 0',
                            padding: '12px 24px',
                            background: 'var(--glass-bg)',
                            backdropFilter: 'blur(20px)',
                            borderTop: '1px solid var(--glass-border)',
                            boxShadow: 'var(--glass-shadow-lg)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            zIndex: 100,
                            borderRadius: '12px 12px 0 0', // Optional: rounded top corners since it's now inside
                        }}>
                            {/* Left side: Node Info */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                                <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#3B82F6', boxShadow: '0 0 10px rgba(59,130,246,0.6)' }} />
                                <div>
                                    <div style={{ fontSize: 11, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: 1 }}>当前节点</div>
                                    <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-main)' }}>
                                        {({
                                            draft: '草稿', submitted: '已提交', ms_review: '商务审核',
                                            op_receiving: '待收货', op_diagnosing: '诊断中', op_repairing: '维修中',
                                            op_qa: 'QA检测', op_shipping: '打包发货', ms_closing: '待结案',
                                            ge_review: language === 'zh' ? '财务审核' : 'Finance Review', 
                                            ge_closing: language === 'zh' ? '财务结案' : 'Finance Closed', 
                                            resolved: language === 'zh' ? '已解决' : 'Resolved',
                                            closed: language === 'zh' ? '已关闭' : 'Closed', 
                                            waiting_customer: language === 'zh' ? '待客户反馈' : 'Awaiting Reply',
                                            awaiting_customer: language === 'zh' ? '待客户反馈' : 'Awaiting Reply',
                                            handling: language === 'zh' ? '处理中' : 'Handling',
                                            auto_closed: language === 'zh' ? '超时结案' : 'Auto Closed'
                                        })[ticket.current_node] || ticket.current_node} · {language === 'zh' ? '对接人' : 'Assignee'}: {ticket.assigned_name || (language === 'zh' ? '未对接' : 'Unassigned')}
                                        {ticket.assigned_to && (
                                            <span style={{ marginLeft: 6, fontSize: 12, opacity: 0.7, fontWeight: 400 }}>
                                                ({`${participants.find(p => p.role === 'assignee')?.department_name || participants.find(p => p.role === 'assignee')?.department || '-'}`})
                                            </span>
                                        )}
                                    </div>
                                </div>
                            </div>

                            {/* Right side: Primary Action */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                                {isDeptLead && !isAssignedToActingUser && (
                                    <div style={{ fontSize: 13, color: 'var(--text-tertiary)', fontStyle: 'italic', marginRight: -8 }}>
                                        {language === 'zh' ? '(作为主管代理执行)' : '(Acting as Department Lead)'}
                                    </div>
                                )}
                                <button
                                    onClick={() => {
                                        if (footerAction) {
                                            if (ticket.current_node === 'op_diagnosing') {
                                                setIsDiagnosticModalOpen(true);
                                            } else if (ticket.current_node === 'ms_review') {
                                                setIsMSReviewPanelOpen(true);
                                            } else if (ticket.current_node === 'ms_closing') {
                                                setIsClosingHandoverOpen(true);
                                            } else if (ticket.current_node === 'op_repairing') {
                                                setIsOpRepairReportEditorOpen(true);
                                            } else if (ticket.ticket_type?.toLowerCase() === 'inquiry' && footerAction.action === 'reply_to_customer') {
                                                if (!autoCloseDate) {
                                                    const tType = ticket.ticket_type?.toLowerCase() || 'inquiry';
                                                    const days = systemSettings?.[`${tType}_auto_close_days`] || (tType === 'inquiry' ? 5 : 7);
                                                    const hours = systemSettings?.[`${tType}_sla_hours`] || 24;
                                                    
                                                    const defaultDate = addWorkingDays(new Date(), days);
                                                    setAutoCloseDate(ticket.auto_close_at ? new Date(ticket.auto_close_at as any).toISOString().split('T')[0] : defaultDate);
                                                    setNodeSlaHours(hours);
                                                }
                                                setIsReplyModalOpen(true);
                                            } else if (ticket.ticket_type?.toLowerCase() === 'inquiry' && footerAction.action === 'process_feedback') {
                                                setIsFeedbackModalOpen(true);
                                            } else {
                                                handleAction(footerAction.action);
                                            }
                                        }
                                    }}
                                    disabled={loading || !footerAction}
                                    style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: 8,
                                        padding: '10px 24px',
                                        borderRadius: 10,
                                        background: footerAction?.action === 'reopen' 
                                            ? 'transparent' 
                                            : ((isAssignedToActingUser || isGlobalAdmin || isDeptLead) ? '#FFD200' : 'rgba(255,210,0,0.15)'),
                                        color: footerAction?.action === 'reopen'
                                            ? 'var(--text-tertiary)'
                                            : ((isAssignedToActingUser || isGlobalAdmin || isDeptLead) ? '#000' : '#FFD200'),
                                        border: footerAction?.action === 'reopen'
                                            ? '1px solid var(--glass-border)'
                                            : ((isAssignedToActingUser || isGlobalAdmin || isDeptLead) ? 'none' : '1px solid rgba(255,210,0,0.4)'),
                                        fontSize: 14,
                                        fontWeight: footerAction?.action === 'reopen' ? 400 : 700,
                                        cursor: 'pointer',
                                        transition: 'all 0.2s',
                                        boxShadow: (footerAction?.action !== 'reopen' && (isAssignedToActingUser || isGlobalAdmin || isDeptLead)) ? '0 4px 15px rgba(255,215,0,0.25)' : 'none'
                                    }}
                                    onMouseEnter={e => {
                                        e.currentTarget.style.transform = 'translateY(-2px)';
                                    }}
                                    onMouseLeave={e => {
                                        e.currentTarget.style.transform = 'none';
                                    }}
                                >
                                    {loading ? <Loader2 className="animate-spin" size={18} /> : (footerAction?.action === 'reopen' ? <RefreshCcw size={18} /> : <ArrowRight size={18} />)}
                                    {footerAction ? (lang === 'zh' ? footerAction.label_zh : footerAction.label_en) : '未知操作'}
                                </button>
                            </div>
                        </div>
                    )}
                </div>

                {/* ====== RIGHT COLUMN (Context) ====== */}
                <div style={{ flex: '0 0 320px', minWidth: 280, position: 'sticky', top: 16, height: 'calc(100vh - 100px)', overflowY: 'auto', paddingRight: 4 }}>
                    <ParticipantsSidebar
                        ticketId={ticketId}
                        participants={participants}
                        onUpdate={fetchDetail}
                        isAdmin={isGlobalAdmin}
                        isMsLead={isMsLead}
                        ticketType={ticket?.ticket_type}
                    />



                    {/* Service Document Center - Consolidated Card (macOS26 Style) - Hidden for inquiry tickets */}
                    {ticket?.ticket_type?.toLowerCase() !== 'inquiry' && (
                    <div style={{
                        background: 'var(--glass-bg-light)',
                        borderRadius: '12px',
                        padding: keyDeliverablesCollapsed ? '16px' : '16px',
                        border: '1px solid var(--glass-border)',
                        marginBottom: '12px',
                        marginTop: '4px'
                    }}>
                        <div
                            onClick={() => setKeyDeliverablesCollapsed(!keyDeliverablesCollapsed)}
                            style={{
                                fontSize: '0.8rem',
                                textTransform: 'uppercase',
                                letterSpacing: '0.08em',
                                color: 'var(--text-main)',
                                marginBottom: keyDeliverablesCollapsed ? 0 : '16px',
                                fontWeight: 700,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                gap: '6px',
                                cursor: 'pointer',
                                userSelect: 'none'
                            }}
                        >
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <Wrench size={12} color="var(--text-main)" /> {language === 'zh' ? '交付' : 'Deliverables'}
                            </div>
                            <ChevronRight
                                size={16}
                                color="var(--text-secondary)"
                                style={{
                                    transform: keyDeliverablesCollapsed ? 'rotate(90deg)' : 'rotate(0deg)',
                                    transition: 'transform 0.2s'
                                }}
                            />
                        </div>

                        {!keyDeliverablesCollapsed && (<>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                            {/* Row 1: Technical Details (Parallel) */}
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                                {(() => {
                                    const diagActivity = activities.find(a => a.activity_type === 'diagnostic_report');
                                    return (
                                        <button
                                            disabled={!diagActivity}
                                            onClick={() => diagActivity && setSelectedActivity(diagActivity)}
                                            style={{
                                                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', padding: '10px',
                                                background: 'var(--glass-bg)',
                                                border: '1px solid var(--glass-border)',
                                                borderRadius: '10px', transition: 'all 0.2s',
                                                cursor: diagActivity ? 'pointer' : 'not-allowed',
                                                opacity: diagActivity ? 1 : 0.6
                                            }}
                                        >
                                            <Search size={14} color={diagActivity ? 'var(--text-secondary)' : 'var(--text-tertiary)'} />
                                            <span style={{ fontSize: '0.75rem', fontWeight: 600, color: diagActivity ? 'var(--text-main)' : 'var(--text-tertiary)' }}>
                                                {language === 'zh' ? '诊断结果' : 'Diagnostics'}
                                            </span>
                                        </button>
                                    );
                                })()}

                                {(() => {
                                    // OP维修记录：需要工单已过op_repairing节点才可查看
                                    const repairNodes = ['op_repairing', 'op_qa', 'op_shipping', 'op_shipping_transit', 'ms_closing', 'ge_review', 'ge_closing', 'resolved', 'closed', 'auto_closed', 'converted', 'cancelled'];
                                    const hasPassedRepair = repairNodes.includes(ticket.current_node) || activities.some(a => {
                                        if (a.activity_type === 'op_repair_completed') return true;
                                        if (a.activity_type === 'status_change' && a.metadata) {
                                            const meta = typeof a.metadata === 'string' ? JSON.parse(a.metadata) : a.metadata;
                                            return meta.from_node === 'op_repairing' || meta.to_node === 'op_qa';
                                        }
                                        return false;
                                    });
                                    return (
                                        <button
                                            disabled={!hasPassedRepair}
                                            onClick={() => hasPassedRepair && setIsOpRepairReportEditorOpen(true)}
                                            style={{
                                                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', padding: '10px',
                                                background: 'var(--glass-bg)',
                                                border: '1px solid var(--glass-border)',
                                                borderRadius: '10px', transition: 'all 0.2s',
                                                cursor: hasPassedRepair ? 'pointer' : 'not-allowed',
                                                opacity: hasPassedRepair ? 1 : 0.6
                                            }}
                                        >
                                            <Wrench size={14} color={hasPassedRepair ? 'var(--text-secondary)' : 'var(--text-tertiary)'} />
                                            <span style={{ fontSize: '0.75rem', fontWeight: 600, color: hasPassedRepair ? 'var(--text-main)' : 'var(--text-tertiary)' }}>
                                                {language === 'zh' ? '维修记录' : 'Repair Record'}
                                            </span>
                                        </button>
                                    );
                                })()}
                            </div>

                            {/* Row 2: Repair Report Action (MS/Admin/Exec only) */}
                            {hasPrivilege && (() => {
                                // 维修报告和PI需要到达 ms_closing 节点才能操作
                                const closingNodes = ['ms_closing', 'ge_review', 'ge_closing', 'resolved', 'closed', 'auto_closed', 'converted', 'cancelled'];
                                const canGenerateDocuments = closingNodes.includes(ticket.current_node);
                                const isEnabled = canGenerateDocuments || hasRepairReport;
                                const isPublished = reportStatus === 'published' || reportStatus === 'approved';
                                // 禁用时显示灰色，启用时显示黄色/绿色
                                const btnBg = !isEnabled ? 'var(--glass-bg-light)' : (isPublished ? 'rgba(16, 185, 129, 0.12)' : 'rgba(245, 158, 11, 0.12)');
                                const btnBorder = !isEnabled ? 'var(--glass-border)' : (isPublished ? 'rgba(16, 185, 129, 0.35)' : 'rgba(245, 158, 11, 0.35)');
                                const iconColor = !isEnabled ? 'var(--text-tertiary)' : (isPublished ? '#10B981' : '#F59E0B');
                                const textColor = !isEnabled ? 'var(--text-tertiary)' : (isPublished ? '#10B981' : '#F59E0B');
                                return (
                                    <button
                                        disabled={!isEnabled}
                                        onClick={() => {
                                            if (isEnabled) setIsRepairReportEditorOpen(true);
                                        }}
                                        style={{
                                            display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 12px',
                                            width: '100%',
                                            background: btnBg,
                                            border: `1px solid ${btnBorder}`,
                                            borderRadius: '8px',
                                            cursor: isEnabled ? 'pointer' : 'not-allowed',
                                            opacity: isEnabled ? 1 : 0.6,
                                            transition: 'all 0.2s'
                                        }}
                                    >
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                            <FileText size={14} color={iconColor} />
                                            <span style={{ fontSize: '0.8rem', fontWeight: 500, color: textColor }}>
                                                {hasRepairReport ? (language === 'zh' ? '维修报告' : 'Repair Report') : (language === 'zh' ? '生成维修报告' : 'Create Report')}
                                            </span>
                                        </div>
                                        {hasRepairReport ? (
                                            <span style={{
                                                fontSize: '0.65rem', fontWeight: 600,
                                                padding: '2px 6px', borderRadius: 4,
                                                background: isPublished ? 'rgba(16,185,129,0.15)' : 'var(--glass-bg-hover)',
                                                color: isPublished ? '#10B981' : 'var(--text-tertiary)'
                                            }}>
                                                {isPublished ? '已发布' : '草稿'}
                                            </span>
                                        ) : (
                                            <span style={{ fontSize: '0.7rem', color: isEnabled ? '#F59E0B' : 'var(--text-tertiary)', opacity: 0.7 }}>{language === 'zh' ? '待处理' : 'Pending'}</span>
                                        )}
                                    </button>
                                );
                            })()}

                            {/* Row 3: PI Action (MS/Admin/Exec only) */}
                            {hasPrivilege && (() => {
                                const closingNodes = ['ms_closing', 'ge_review', 'ge_closing', 'resolved', 'closed', 'auto_closed', 'converted', 'cancelled'];
                                const canGenerateDocuments = closingNodes.includes(ticket.current_node);
                                const isEnabled = canGenerateDocuments || hasPI;
                                const isPublished = piStatus === 'published' || piStatus === 'approved';
                                // 禁用时显示灰色，启用时显示黄色/绿色
                                const btnBg = !isEnabled ? 'var(--glass-bg-light)' : (isPublished ? 'rgba(16, 185, 129, 0.12)' : 'rgba(245, 158, 11, 0.12)');
                                const btnBorder = !isEnabled ? 'var(--glass-border)' : (isPublished ? 'rgba(16, 185, 129, 0.35)' : 'rgba(245, 158, 11, 0.35)');
                                const iconColor = !isEnabled ? 'var(--text-tertiary)' : (isPublished ? '#10B981' : '#F59E0B');
                                const textColor = !isEnabled ? 'var(--text-tertiary)' : (isPublished ? '#10B981' : '#F59E0B');
                                return (
                                    <button
                                        disabled={!isEnabled}
                                        onClick={async () => {
                                            if (!isEnabled) return;
                                            if (!hasPI) {
                                                setIsPIEditorOpen(true);
                                                return;
                                            }
                                            try {
                                                const res = await axios.get(`/api/v1/rma-documents/pi?ticket_id=${ticket.id}`, { headers: { Authorization: `Bearer ${token}` } });
                                                if (res.data.success && res.data.data.length > 0) {
                                                    const pi = res.data.data[0];
                                                    setActivePIInfo({ id: pi.id });
                                                    setIsPIEditorOpen(true);
                                                }
                                            } catch (err) { console.error('Failed to fetch PI', err); }
                                        }}
                                        style={{
                                            display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 12px',
                                            width: '100%',
                                            background: btnBg,
                                            border: `1px solid ${btnBorder}`,
                                            borderRadius: '8px',
                                            cursor: isEnabled ? 'pointer' : 'not-allowed',
                                            opacity: isEnabled ? 1 : 0.6,
                                            transition: 'all 0.2s'
                                        }}
                                    >
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                            <BadgeDollarSign size={14} color={iconColor} />
                                            <span style={{ fontSize: '0.8rem', fontWeight: 500, color: textColor }}>
                                                {hasPI ? 'PI' : (language === 'zh' ? '生成 PI' : 'Create PI')}
                                            </span>
                                        </div>
                                        {hasPI ? (
                                            <span style={{
                                                fontSize: '0.65rem', fontWeight: 600,
                                                padding: '2px 6px', borderRadius: 4,
                                                background: isPublished ? 'rgba(16,185,129,0.15)' : 'var(--glass-bg-hover)',
                                                color: isPublished ? '#10B981' : 'var(--text-tertiary)'
                                            }}>
                                                {isPublished ? '已发布' : '草稿'}
                                            </span>
                                        ) : (
                                            <span style={{ fontSize: '0.7rem', color: isEnabled ? '#F59E0B' : 'var(--text-tertiary)', opacity: 0.7 }}>{language === 'zh' ? '待处理' : 'Pending'}</span>
                                        )}
                                    </button>
                                );
                            })()}
                        </div>
                        </>)}
                    </div>
                    )}

                    {/* CustomerContextSidebar (Linked Asset Card) */}
                    <CustomerContextSidebar
                        ticketId={ticket.id}
                        accountId={ticket.account_id as number | undefined}
                        contactId={ticket.contact_id as number | undefined}
                        reporterSnapshot={ticket.reporter_snapshot}
                        serialNumber={ticket.serial_number}
                        customerName={ticket.account_name}
                        contactName={ticket.contact_name || ticket.reporter_name}
                        dealerId={ticket.dealer_id as number | undefined}
                        dealerName={ticket.dealer_name}
                        dealerCode={ticket.dealer_code}
                        dealerContactName={ticket.contact_name}
                        dealerContactTitle={ticket.reporter_name}
                        onCleanComplete={fetchDetail}
                        ticketProductName={ticket.product_name}
                        onRequestEdit={handleQuickFixProduct}
                        hideDeviceCard={true}
                        collapsed={customerContextCollapsed}
                        onToggleCollapse={() => setCustomerContextCollapsed(!customerContextCollapsed)}
                    />
                </div>
            </div>


            {
                isEditing && (
                    <>
                        {/* Overlay - click to close */}
                        <div
                            onClick={() => setIsEditing(false)}
                            style={{
                                position: 'fixed', top: 60, left: 0, right: 0, bottom: 0,
                                background: 'rgba(0,0,0,0.4)', zIndex: 199
                            }}
                        />
                        <div style={{
                            position: 'fixed', top: 60, right: 0, bottom: 0, width: 400,
                            background: 'var(--drawer-bg)', backdropFilter: 'blur(20px)',
                            borderLeft: '1px solid var(--drawer-border)',
                            zIndex: 200, display: 'flex', flexDirection: 'column',
                            boxShadow: 'var(--glass-shadow-lg)'
                        }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', borderBottom: '1px solid var(--drawer-border)', background: 'var(--drawer-header-bg)' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                    <ShieldAlert size={18} color="var(--accent-blue)" />
                                    <div>
                                        <h3 style={{ margin: 0, fontSize: 16, color: 'var(--text-main)', fontWeight: 600 }}>编辑工单信息</h3>
                                        <p style={{ margin: 0, fontSize: 11, color: 'var(--text-secondary)', marginTop: 2 }}>操作受审计保护，核心变更需提供理由</p>
                                    </div>
                                </div>
                                <button onClick={() => setIsEditing(false)} style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', padding: 4 }}>
                                    <X size={20} />
                                </button>
                            </div>
                            <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 20 }}>

                                {/* ---- 分组 1: 流程控制 (仅Admin/Exec可见，放最前面) ---- */}
                                {(user?.role === 'Admin' || user?.role === 'Exec') && (ticket.ticket_type === 'rma' || ticket.ticket_type === 'svc') && (
                                    <div style={{ paddingBottom: 20 }}>
                                        <div style={{ fontSize: 11, color: 'var(--status-red)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 12, borderBottom: '1px solid var(--status-red-subtle)', paddingBottom: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
                                            <AlertTriangle size={12} /> 流程控制 (Admin/Exec)
                                        </div>
                                        <div style={{ padding: '12px', background: 'var(--status-red-subtle)', border: '1px solid var(--status-red-subtle)', borderRadius: 8 }}>
                                            <label style={{ display: 'block', fontSize: 12, color: 'var(--status-red)', marginBottom: 8, fontWeight: 500 }}>强制节点回退</label>
                                            <select
                                                value={editForm.current_node as string || ''}
                                                onChange={e => setEditForm(prev => ({ ...prev, current_node: e.target.value || undefined }))}
                                                style={{ width: '100%', padding: '8px 12px', background: 'var(--input-bg)', border: '1px solid var(--input-border)', color: 'var(--text-main)', borderRadius: 6, fontSize: 13, marginBottom: 10 }}
                                            >
                                                <option value="">保持当前节点: {nodeLabels[ticket.current_node]?.zh || ticket.current_node}</option>
                                                <option value="op_receiving">待收货 (OP)</option>
                                                <option value="op_diagnosing">诊断中 (OP)</option>
                                                <option value="op_repairing">维修中 (OP)</option>
                                                <option value="ms_review">商务审核 (MS)</option>
                                                <option value="ms_closing">最终结案 (MS)</option>
                                                <option value="op_shipping">打包发货 (OP)</option>
                                            </select>
                                            <p style={{ margin: 0, fontSize: 10, color: 'var(--status-red)', opacity: 0.8 }}>
                                                警告：强制回退将触发自动分发规则，可能变更对接人。此操作将记录在活动日志中。
                                            </p>
                                        </div>
                                    </div>
                                )}

                                <div>
                                    <div style={{ fontSize: 11, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 12, borderBottom: '1px solid var(--glass-border)', paddingBottom: 6 }}>客户信息</div>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                                        <div>
                                            <label style={{ display: 'block', fontSize: 12, color: 'var(--text-secondary)', marginBottom: 6 }}>客户名称</label>
                                            <CRMLookup 
                                                currentAccountId={editForm.account_id as number || undefined}
                                                onSelect={(acc: any) => {
                                                    if (acc) {
                                                        setEditForm(prev => ({ 
                                                            ...prev, 
                                                            account_id: acc.id,
                                                            account_name: acc.name,
                                                            // 根据主联系人自动联想（如果未填写）
                                                            contact_name: prev.contact_name || acc.primary_contact_name || undefined
                                                        }));
                                                    } else {
                                                        setEditForm(prev => ({ ...prev, account_id: undefined, account_name: undefined }));
                                                    }
                                                }}
                                                placeholder={ticket.account_name}
                                                style={{ height: 'auto' }}
                                            />
                                        </div>
                                        <div>
                                            <label style={{ display: 'block', fontSize: 12, color: 'var(--text-secondary)', marginBottom: 6 }}>联系人</label>
                                            <input
                                                value={editForm.contact_name as string || ''}
                                                onChange={e => setEditForm(prev => ({ ...prev, contact_name: e.target.value }))}
                                                style={{ width: '100%', padding: '8px 12px', background: 'var(--input-bg)', border: '1px solid var(--input-border)', color: 'var(--text-main)', borderRadius: 6, fontSize: 13 }}
                                                placeholder="联系人姓名"
                                            />
                                        </div>
                                        <div>
                                            <label style={{ display: 'block', fontSize: 12, color: 'var(--text-secondary)', marginBottom: 6 }}>经销商</label>
                                            <CRMLookup 
                                                currentAccountId={editForm.dealer_id as number || undefined}
                                                onSelect={(acc: any) => {
                                                    if (acc) {
                                                        setEditForm(prev => ({ ...prev, dealer_id: acc.id, dealer_name: acc.name }));
                                                    } else {
                                                        setEditForm(prev => ({ ...prev, dealer_id: undefined, dealer_name: undefined }));
                                                    }
                                                }}
                                                placeholder={ticket.dealer_name || "搜索并选择经销商..."}
                                                style={{ height: 'auto' }}
                                            />
                                        </div>
                                    </div>
                                </div>

                                {/* ---- 分组 3: 设备信息 (RMA/SVC 特有) ---- */}
                                {(ticket.ticket_type === 'rma' || ticket.ticket_type === 'svc') && (
                                    <div>
                                        <div style={{ fontSize: 11, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 12, borderBottom: '1px solid var(--glass-border)', paddingBottom: 6 }}>设备信息</div>
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                                            <div style={{ padding: '10px 12px', background: 'var(--glass-bg-light)', border: '1px solid var(--glass-border)', borderRadius: 8 }}>
                                                <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--accent-blue)', marginBottom: 6 }}>
                                                    <ShieldAlert size={12} /> 序列号 (S/N)
                                                </label>
                                                <input
                                                    value={editForm.serial_number as string || ''}
                                                    onChange={e => setEditForm(prev => ({ ...prev, serial_number: e.target.value }))}
                                                    style={{ width: '100%', padding: '8px 10px', background: 'var(--input-bg)', border: '1px solid var(--input-border)', color: 'var(--text-main)', borderRadius: 6, fontSize: 13 }}
                                                />
                                                <p style={{ margin: '6px 0 0', fontSize: 10, color: 'var(--text-tertiary)' }}>警告：修改此项将影响设备服务记录与审计体系</p>
                                            </div>
                                            <div style={{ padding: '10px 12px', background: 'var(--glass-bg-light)', border: '1px solid var(--glass-border)', borderRadius: 8 }}>
                                                <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--accent-blue)', marginBottom: 6 }}>
                                                    <Package size={12} /> 产品型号
                                                </label>
                                                <select
                                                    value={editForm.product_id as number || ''}
                                                    onChange={e => setEditForm(prev => ({ ...prev, product_id: e.target.value ? Number(e.target.value) : undefined }))}
                                                    style={{ width: '100%', padding: '8px 10px', background: 'var(--input-bg)', border: '1px solid var(--input-border)', color: 'var(--text-main)', borderRadius: 6, fontSize: 13 }}
                                                >
                                                    <option value="">{ticket.product_name || '选择型号...'}</option>
                                                    {products.map(p => (
                                                        <option key={p.id} value={p.id}>{p.name}</option>
                                                    ))}
                                                </select>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {/* ---- 分组 4: 问题描述 ---- */}
                                <div>
                                    <div style={{ fontSize: 11, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 12, borderBottom: '1px solid var(--glass-border)', paddingBottom: 6 }}>问题描述</div>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                                        <textarea
                                            value={editForm.problem_description as string || ''}
                                            onChange={e => setEditForm(prev => ({ ...prev, problem_description: e.target.value }))}
                                            style={{ width: '100%', padding: '8px 12px', background: 'var(--input-bg)', border: '1px solid var(--input-border)', color: 'var(--text-main)', borderRadius: 6, minHeight: 120, fontSize: 13, resize: 'vertical' }}
                                        />
                                    </div>
                                </div>

                                {/* ---- 分组 5: 附件管理 ---- */}
                                <div>
                                    <div style={{ fontSize: 11, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 12, borderBottom: '1px solid var(--glass-border)', paddingBottom: 6 }}>附件管理</div>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                                        {/* 当前附件列表 */}
                                        {ticketAttachments.filter(a => !a.activity_id).length > 0 && (
                                            <div>
                                                <label style={{ display: 'block', fontSize: 12, color: 'var(--text-secondary)', marginBottom: 8 }}>当前附件</label>
                                                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                                                    {ticketAttachments.filter(att => !att.activity_id).map(att => (
                                                        <div
                                                            key={att.id}
                                                            style={{
                                                                display: 'flex', alignItems: 'center', gap: 10,
                                                                padding: '10px 12px', background: 'var(--glass-bg)',
                                                                border: '1px solid var(--glass-border)', borderRadius: 8
                                                            }}
                                                        >
                                                            <div style={{ width: 32, height: 32, borderRadius: 4, background: 'var(--glass-bg-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                                                {att.thumbnail_url ? (
                                                                    <img src={att.thumbnail_url + (token ? `?token=${token}` : '')} style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 4 }} alt="" />
                                                                ) : (
                                                                    <Paperclip size={16} color="var(--text-tertiary)" />
                                                                )}
                                                            </div>
                                                            <div style={{ flex: 1, minWidth: 0 }}>
                                                                <div style={{ fontSize: 13, color: 'var(--text-main)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{att.file_name}</div>
                                                                <div style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>{(att.file_size / 1024).toFixed(1)} KB</div>
                                                            </div>
                                                            <button
                                                                onClick={() => {
                                                                    // 标记为删除
                                                                    setTicketAttachments(prev => prev.filter(a => a.id !== att.id));
                                                                    setEditForm((prev: any) => ({
                                                                        ...prev,
                                                                        _attachmentsToDelete: [...(prev._attachmentsToDelete || []), att.id]
                                                                    }));
                                                                }}
                                                                style={{
                                                                    padding: '4px 8px', fontSize: 11, color: '#EF4444',
                                                                    background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)',
                                                                    borderRadius: 4, cursor: 'pointer'
                                                                }}
                                                            >
                                                                删除
                                                            </button>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        )}

                                        {/* 新增附件上传 */}
                                        <div>
                                            <label style={{ display: 'block', fontSize: 12, color: 'var(--text-secondary)', marginBottom: 8 }}>添加新附件</label>
                                            <div
                                                                                onClick={() => document.getElementById('edit-attachment-input')?.click()}
                                                                                style={{
                                                                                    padding: '20px', border: '2px dashed var(--glass-border)',
                                                                                    borderRadius: 8, textAlign: 'center', cursor: 'pointer',
                                                                                    background: 'var(--glass-bg)'
                                                                                }}
                                                                            >
                                                                                <Paperclip size={24} color="var(--text-tertiary)" style={{ marginBottom: 8 }} />
                                                                                <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>点击上传文件</div>
                                                                                <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 4 }}>支持图片、文档等多种格式</div>
                                                                                <input
                                                                                    id="edit-attachment-input"
                                                                                    type="file"
                                                                                    multiple
                                                                                    hidden
                                                                                    onChange={(e) => {
                                                                                        const files = Array.from(e.target.files || []);
                                                                                        setEditForm((prev: any) => ({
                                                                                            ...prev,
                                                                                            _newAttachments: [...(prev._newAttachments || []), ...files]
                                                                                        }));
                                                                                        // 清空input以便可以再次选择相同文件
                                                                                        e.target.value = '';
                                                                                    }}
                                                                                />
                                                                            </div>
                                                                            
                                                                            {/* 待上传的新附件列表 */}
                                                                            {(editForm._newAttachments as File[] || []).length > 0 && (
                                                                                <div style={{ marginTop: 12 }}>
                                                                                    <label style={{ display: 'block', fontSize: 12, color: 'var(--text-secondary)', marginBottom: 8 }}>待上传附件</label>
                                                                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                                                                                        {(editForm._newAttachments as File[]).map((file, idx) => (
                                                                                            <div
                                                                                                key={idx}
                                                                                                style={{
                                                                                                    display: 'flex', alignItems: 'center', gap: 10,
                                                                                                    padding: '10px 12px', background: 'rgba(16,185,129,0.05)',
                                                                                                    border: '1px solid rgba(16,185,129,0.2)', borderRadius: 8
                                                                                                }}
                                                                                            >
                                                                                                <Paperclip size={16} color="#10B981" />
                                                                                                <div style={{ flex: 1, minWidth: 0 }}>
                                                                                                    <div style={{ fontSize: 13, color: 'var(--text-main)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{file.name}</div>
                                                                                                    <div style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>{(file.size / 1024).toFixed(1)} KB</div>
                                                                                                </div>
                                                                                                <button
                                                                                                    onClick={() => {
                                                                                                        setEditForm((prev: any) => ({
                                                                                                            ...prev,
                                                                                                            _newAttachments: (prev._newAttachments as File[] || []).filter((_: any, i: number) => i !== idx)
                                                                                                        }));
                                                                                                    }}
                                                                                                    style={{
                                                                                                        padding: '4px 8px', fontSize: 11, color: '#EF4444',
                                                                                                        background: 'transparent', border: 'none',
                                                                                                        cursor: 'pointer'
                                                                                                    }}
                                                                                                >
                                                                                                    移除
                                                                                                </button>
                                                                                            </div>
                                                                                        ))}
                                                                                    </div>
                                                                                </div>
                                                                            )}
                                                                        </div>
                                                                    </div>
                                                                </div>
                            </div>

                            {/* STICKY FOOTER */}
                            <div style={{ padding: '16px 20px', borderTop: '1px solid var(--glass-border)', background: 'var(--drawer-header-bg)', backdropFilter: 'blur(10px)', display: 'flex', gap: 12 }}>
                                <button onClick={() => setIsEditing(false)} style={{ flex: 1, padding: '10px', background: 'transparent', border: '1px solid var(--glass-border)', color: 'var(--text-main)', borderRadius: 8, cursor: 'pointer', fontSize: 14 }}>取消</button>
                                <button
                                    onClick={handlePreSave}
                                    style={{ flex: 1.5, padding: '10px', background: 'var(--accent-blue)', border: 'none', color: '#000', borderRadius: 8, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, fontSize: 14 }}
                                >
                                    <Save size={16} /> 保存变更
                                </button>
                            </div>
                        </div>
                    </>
                )
            }

            {/* ====== Audit Barrier Modal ====== */}
            {
                isAuditModalOpen && (
                    <div style={{
                        position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 400,
                        background: 'var(--modal-overlay)', backdropFilter: 'blur(10px)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center'
                    }}>
                        <div style={{
                            width: 500, background: 'var(--modal-bg)', borderRadius: 16,
                            border: '1px solid var(--glass-border-accent)', overflow: 'hidden',
                            boxShadow: 'var(--glass-shadow-lg)',
                            animation: 'modalIn 0.2s ease-out'
                        }}>
                            <div style={{ padding: 24, textAlign: 'center', borderBottom: '1px solid var(--glass-border)' }}>
                                <div style={{ width: 48, height: 48, borderRadius: '50%', background: 'var(--accent-gold-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
                                    <AlertTriangle size={24} color="var(--accent-gold)" />
                                </div>
                                <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: 'var(--text-main)', marginBottom: 8 }}>核心数据变更声明</h3>
                                <p style={{ margin: 0, fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                                    您正在修改受审计的数据字段。<br />此操作将永久记录在工单时间轴中，请仔细核对以下变更：
                                </p>
                            </div>
                            <div style={{ padding: 24, maxHeight: 300, overflowY: 'auto', background: 'var(--glass-bg-light)' }}>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                                    {auditDiffs.map((diff, index) => (
                                        <div key={index} style={{
                                            display: 'grid', gridTemplateColumns: 'minmax(80px, max-content) 1fr', gap: 12,
                                            padding: 12, borderRadius: 8,
                                            background: diff.isRisk ? 'var(--status-red-subtle)' : 'var(--glass-bg-light)',
                                            border: diff.isRisk ? '1px solid var(--status-red-subtle)' : '1px solid var(--glass-border)'
                                        }}>
                                            <div style={{ fontSize: 13, color: diff.isRisk ? 'var(--status-red)' : 'var(--text-secondary)', fontWeight: diff.isRisk ? 600 : 400, display: 'flex', flexDirection: 'column' }}>
                                                {diff.label}
                                                {diff.isRisk && <span style={{ fontSize: 10, marginTop: 4, letterSpacing: 0.5 }}>高级别审计项</span>}
                                            </div>
                                            <div style={{ fontSize: 13, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: 8 }}>
                                                <span style={{ textDecoration: 'line-through', color: 'var(--text-tertiary)' }}>{diff.oldVal}</span>
                                                <span style={{ color: 'var(--text-secondary)' }}>➔</span>
                                                <span style={{ color: diff.isRisk ? 'var(--accent-gold)' : 'var(--accent-green)', fontWeight: 500 }}>{diff.newVal}</span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                            <div style={{ padding: 24, borderTop: '1px solid var(--glass-border)' }}>
                                <label style={{ display: 'block', fontSize: 12, color: 'var(--text-secondary)', marginBottom: 8 }}>强制录入修正理由（必填）</label>
                                <textarea
                                    value={changeReason}
                                    onChange={e => setChangeReason(e.target.value)}
                                    placeholder="例如：前期录入错误看错型号、客户凭证证明在保..."
                                    style={{ width: '100%', padding: '12px', background: 'var(--input-bg)', border: '1px solid var(--input-border)', color: 'var(--text-main)', borderRadius: 8, minHeight: 80, fontSize: 13, resize: 'none' }}
                                />
                            </div>
                            <div style={{ display: 'flex', borderTop: '1px solid var(--glass-border)' }}>
                                <button
                                    onClick={() => setIsAuditModalOpen(false)}
                                    style={{ flex: 1, padding: 16, background: 'transparent', border: 'none', color: 'var(--text-secondary)', fontSize: 14, cursor: 'pointer' }}
                                >
                                    返回修改
                                </button>
                                <div style={{ width: 1, background: 'var(--glass-border)' }} />
                                <button
                                    onClick={handleSaveEdit}
                                    disabled={auditCountdown > 0 || !changeReason.trim() || isSaving}
                                    style={{
                                        flex: 1, padding: 16, background: 'transparent', border: 'none',
                                        color: (auditCountdown > 0 || !changeReason.trim()) ? 'var(--text-tertiary)' : 'var(--accent-gold)',
                                        fontSize: 14, fontWeight: 600,
                                        cursor: (auditCountdown > 0 || !changeReason.trim()) ? 'not-allowed' : 'pointer'
                                    }}
                                >
                                    {auditCountdown > 0 ? `确认并提交 (${auditCountdown}s)` : '确认并提交'}
                                </button>
                            </div>
                        </div>
                    </div>
                )
            }


            {/* ====== Details Drawer ====== */}
            {
                isDescriptionDrawerOpen && (
                    <>
                        {/* Overlay - click to close */}
                        <div
                            onClick={() => setIsDescriptionDrawerOpen(false)}
                            style={{
                                position: 'fixed', top: 60, left: 0, right: 0, bottom: 0,
                                background: 'rgba(0,0,0,0.4)', zIndex: 299
                            }}
                        />
                        <div style={{
                            position: 'fixed', top: 60, right: 0, bottom: 0, width: 400, zIndex: 300,
                            background: 'var(--drawer-bg)', backdropFilter: 'blur(20px)',
                            borderLeft: '1px solid var(--drawer-border)',
                            boxShadow: 'var(--glass-shadow-lg)',
                            display: 'flex', flexDirection: 'column',
                            animation: 'drawerSlideIn 0.3s cubic-bezier(0.16, 1, 0.3, 1)'
                        }}>
                            <div style={{ padding: '16px 24px', borderBottom: '1px solid var(--drawer-border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'var(--drawer-header-bg)' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                    <div style={{ width: 32, height: 32, borderRadius: 8, background: 'rgba(255,215,0,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                        <FileText size={16} color="#FFD200" />
                                    </div>
                                    <div>
                                        <h3 style={{ margin: 0, fontSize: 16, color: 'var(--text-main)', fontWeight: 600 }}>问题与诊断全景</h3>
                                        <p style={{ margin: 0, fontSize: 11, color: 'var(--text-tertiary)', marginTop: 2 }}>{ticket.ticket_number}</p>
                                    </div>
                                </div>
                                <button onClick={() => setIsDescriptionDrawerOpen(false)} style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', padding: 4 }}>
                                    <X size={20} />
                                </button>
                            </div>
                            <div style={{ padding: 24, flex: 1, overflowY: 'auto' }}>
                                {ticket.problem_summary && (
                                    <div style={{ marginBottom: 24 }}>
                                        <h4 style={{ fontSize: 12, color: 'var(--text-tertiary)', marginBottom: 10, borderBottom: '1px solid var(--glass-border)', paddingBottom: 6 }}>摘要</h4>
                                        <div style={{
                                            fontSize: 16,
                                            color: 'var(--text-main)',
                                            lineHeight: 1.6,
                                            whiteSpace: 'pre-wrap',
                                            wordBreak: 'break-word',
                                            letterSpacing: '0.01em'
                                        }}>
                                            {ticket.problem_summary}
                                        </div>
                                    </div>
                                )}
                                {ticket.problem_description && (
                                    <div style={{ marginBottom: 24 }}>
                                        <h4 style={{ fontSize: 12, color: 'var(--text-tertiary)', marginBottom: 10, borderBottom: '1px solid var(--glass-border)', paddingBottom: 6 }}>详细描述</h4>
                                        <div style={{
                                            fontSize: 16,
                                            color: 'var(--text-main)',
                                            lineHeight: 1.6,
                                            whiteSpace: 'pre-wrap',
                                            wordBreak: 'break-word',
                                            marginTop: (ticket.problem_summary) ? 16 : 0,
                                            letterSpacing: '0.01em'
                                        }}>
                                            {ticket.problem_description}
                                        </div>
                                    </div>
                                )}
                                {ticket.resolution && (
                                    <div style={{ marginBottom: 24 }}>
                                        <h4 style={{ fontSize: 12, color: 'var(--status-green)', marginBottom: 10, borderBottom: '1px solid var(--glass-border)', paddingBottom: 6 }}>处理记录</h4>
                                        <div style={{ fontSize: 13, color: 'var(--text-main)', lineHeight: 1.6, whiteSpace: 'pre-wrap', background: 'rgba(16,185,129,0.05)', padding: 12, borderRadius: 8, border: '1px solid rgba(16,185,129,0.1)' }}>
                                            {ticket.resolution}
                                        </div>
                                    </div>
                                )}
                                {(ticketAttachments.filter(a => !a.activity_id || activities.some(act => act.id === a.activity_id && act.activity_type === 'system_event' && (act.metadata as any)?.event_type === 'creation')).length > 0) && (
                                    <div>
                                        <h4 style={{ fontSize: 12, color: 'var(--text-tertiary)', marginBottom: 10, borderBottom: '1px solid var(--glass-border)', paddingBottom: 6 }}>附件文件</h4>
                                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 10 }}>
                                            {ticketAttachments.filter(a => !a.activity_id || activities.some(act => act.id === a.activity_id && act.activity_type === 'system_event' && (act.metadata as any)?.event_type === 'creation')).map(att => {
                                                const isImage = att.file_type?.startsWith('image/');
                                                const isHeic = att.file_name?.toLowerCase().endsWith('.heic') || att.file_name?.toLowerCase().endsWith('.heif');
                                                const mediaUrl = (isImage && isHeic) 
                                                    ? `/api/v1/system/attachments/${att.id}/thumbnail?size=preview` + (token ? `&token=${token}` : '')
                                                    : att.file_url + '?inline=true' + (token ? `&token=${token}` : '');
                                                const thumbUrl = (att.thumbnail_url || att.file_url) + (token ? `?token=${token}` : '');

                                                return (
                                                    <div key={att.id}
                                                        onClick={() => isImage ? setLightboxMedia({ url: mediaUrl, type: 'image' }) : window.open(mediaUrl)}
                                                        style={{
                                                            padding: isImage ? 0 : '10px 12px',
                                                            background: 'rgba(255,255,255,0.03)',
                                                            border: '1px solid rgba(255,255,255,0.08)',
                                                            borderRadius: 8,
                                                            display: 'flex',
                                                            flexDirection: isImage ? 'column' : 'row',
                                                            alignItems: isImage ? 'stretch' : 'center',
                                                            gap: isImage ? 0 : 10,
                                                            textDecoration: 'none',
                                                            transition: 'all 0.2s',
                                                            cursor: 'pointer',
                                                            overflow: 'hidden',
                                                            aspectRatio: isImage ? '4/3' : 'auto'
                                                        }}
                                                        onMouseEnter={e => {
                                                            e.currentTarget.style.background = 'rgba(255,255,255,0.08)';
                                                            e.currentTarget.style.borderColor = 'rgba(255,255,255,0.2)';
                                                        }}
                                                        onMouseLeave={e => {
                                                            e.currentTarget.style.background = 'rgba(255,255,255,0.03)';
                                                            e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)';
                                                        }}
                                                    >
                                                        {isImage ? (
                                                            <div style={{ width: '100%', height: '100%', position: 'relative', background: '#222' }}>
                                                                <img src={thumbUrl} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="" />
                                                            </div>
                                                        ) : (
                                                            <>
                                                                <div style={{ width: 32, height: 32, borderRadius: 4, background: 'rgba(0,0,0,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                                                    <Paperclip size={16} color="#888" />
                                                                </div>
                                                                <div style={{ flex: 1, minWidth: 0 }}>
                                                                    <div style={{ fontSize: 13, color: '#ddd', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{att.file_name}</div>
                                                                    <div style={{ fontSize: 10, color: '#666' }}>{(att.file_size / 1024).toFixed(1)} KB</div>
                                                                </div>
                                                            </>
                                                        )}
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    </>
                )
            }

            {/* ====== Delete Modal ====== */}
            {
                isDeleteModalOpen && (
                    <div style={{
                        position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 300,
                        background: 'var(--modal-overlay)', backdropFilter: 'blur(5px)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center'
                    }}>
                        <div style={{
                            width: 440, background: 'var(--modal-bg)', borderRadius: 16,
                            border: '1px solid var(--status-red)', overflow: 'hidden',
                            boxShadow: '0 20px 40px rgba(239, 68, 68, 0.15)'
                        }}>
                            <div style={{ padding: 24, textAlign: 'center' }}>
                                <div style={{ width: 48, height: 48, borderRadius: '50%', background: 'var(--status-red-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
                                    <Trash2 size={24} color="var(--status-red)" />
                                </div>
                                <h3 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: 'var(--text-main)', marginBottom: 8 }}>危险操作：废弃工单</h3>
                                <p style={{ margin: 0, fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                                    此操作将导致工单 <b>{ticket.ticket_number}</b> 被逻辑删除并打上墓碑标记，不再显示在任何普通列表内。<br />为确保安全，必须强制输入废弃理由，并等待 {deleteCountdown > 0 ? <span style={{ color: '#EF4444', fontWeight: 600 }}>{deleteCountdown}秒</span> : '解锁'}。
                                </p>
                            </div>
                            <div style={{ padding: '0 24px 24px' }}>
                                <textarea
                                    value={deleteReason}
                                    onChange={e => setDeleteReason(e.target.value)}
                                    placeholder="输入废弃理由（必填，至少 5 个字符）..."
                                    style={{ width: '100%', padding: '12px', background: 'var(--input-bg)', border: '1px solid var(--input-border)', color: 'var(--text-main)', borderRadius: 8, minHeight: 80, fontSize: 14 }}
                                />
                            </div>
                            <div style={{ display: 'flex', borderTop: '1px solid var(--glass-border)' }}>
                                <button
                                    onClick={() => { setIsDeleteModalOpen(false); setDeleteReason(''); }}
                                    style={{ flex: 1, padding: 16, background: 'transparent', border: 'none', color: 'var(--text-main)', fontSize: 15, cursor: 'pointer' }}
                                >取消操作</button>
                                <div style={{ width: 1, background: 'var(--glass-border)' }} />
                                <button
                                    onClick={handleDelete}
                                    disabled={deleteCountdown > 0 || deleteReason.trim().length < 5 || isDeleting}
                                    style={{
                                        flex: 1, padding: 16, background: 'transparent', border: 'none',
                                        color: (deleteCountdown > 0 || deleteReason.trim().length < 5) ? 'var(--text-tertiary)' : 'var(--status-red)',
                                        fontSize: 15, fontWeight: 600,
                                        cursor: (deleteCountdown > 0 || deleteReason.trim().length < 5) ? 'not-allowed' : 'pointer',
                                        transition: 'all 0.2s'
                                    }}
                                >
                                    {deleteCountdown > 0 ? `确认废弃 (${deleteCountdown}s)` : '确认废弃'}
                                </button>
                            </div>
                        </div>
                    </div>
                )
            }

            {/* ====== Restore Modal ====== */}
            {
                isRestoreModalOpen && (
                    <div style={{
                        position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 300,
                        background: 'var(--modal-overlay)', backdropFilter: 'blur(5px)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center'
                    }}>
                        <div style={{
                            width: 440, background: 'var(--modal-bg)', borderRadius: 16,
                            border: '1px solid var(--accent-green)', overflow: 'hidden',
                            boxShadow: '0 20px 40px rgba(16, 185, 129, 0.15)'
                        }}>
                            <div style={{ padding: 24, textAlign: 'center' }}>
                                <div style={{ width: 48, height: 48, borderRadius: '50%', background: 'var(--accent-green-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
                                    <ExternalLink size={24} color="var(--accent-green)" />
                                </div>
                                <h3 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: 'var(--text-main)', marginBottom: 8 }}>恢复工单</h3>
                                <p style={{ margin: 0, fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                                    将工单 <b>{ticket.ticket_number}</b> 从回收站移回活跃列表。
                                </p>
                            </div>
                            <div style={{ padding: '0 24px 24px' }}>
                                <textarea
                                    value={restoreReason}
                                    onChange={e => setRestoreReason(e.target.value)}
                                    placeholder="输入恢复理由（必填）..."
                                    style={{ width: '100%', padding: '12px', background: 'var(--input-bg)', border: '1px solid var(--input-border)', color: 'var(--text-main)', borderRadius: 8, minHeight: 80, fontSize: 14 }}
                                />
                            </div>
                            <div style={{ display: 'flex', borderTop: '1px solid var(--glass-border)' }}>
                                <button
                                    onClick={() => { setIsRestoreModalOpen(false); setRestoreReason(''); }}
                                    style={{ flex: 1, padding: 16, background: 'transparent', border: 'none', color: 'var(--text-main)', fontSize: 15, cursor: 'pointer' }}
                                >取消</button>
                                <div style={{ width: 1, background: 'var(--glass-border)' }} />
                                <button
                                    onClick={handleRestore}
                                    disabled={!restoreReason.trim() || isRestoring}
                                    style={{
                                        flex: 1, padding: 16, background: 'transparent', border: 'none',
                                        color: !restoreReason.trim() ? 'var(--text-tertiary)' : 'var(--accent-green)',
                                        fontSize: 15, fontWeight: 600,
                                        cursor: !restoreReason.trim() ? 'not-allowed' : 'pointer'
                                    }}
                                >
                                    确认恢复
                                </button>
                            </div>
                        </div>
                    </div>
                )
            }

            {/* ====== Upgrade to RMA Modal ====== */}
            {
                isUpgradeRmaModalOpen && (
                    <div style={{
                        position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 300,
                        background: 'var(--modal-overlay)', backdropFilter: 'blur(5px)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center'
                    }}>
                        <div style={{
                            width: 440, background: 'var(--modal-bg)', borderRadius: 16,
                            border: '1px solid #F59E0B', overflow: 'hidden',
                            boxShadow: '0 20px 40px rgba(245, 158, 11, 0.15)'
                        }}>
                            <div style={{ padding: 24, textAlign: 'center' }}>
                                <div style={{ width: 48, height: 48, borderRadius: '50%', background: 'rgba(245, 158, 11, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
                                    <ArrowUpCircle size={24} color="#F59E0B" />
                                </div>
                                <h3 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: 'var(--text-main)', marginBottom: 8 }}>升级为RMA工单</h3>
                                <p style={{ margin: 0, fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                                    此操作将把咨询工单 <b>{ticket.ticket_number}</b> 升级为RMA维修工单。<br />此操作<b>不可逆</b>，升级后工单将进入维修流程。
                                    <br /><br />
                                    请确认以下条件：
                                </p>
                                <ul style={{ textAlign: 'left', fontSize: 13, color: 'var(--text-secondary)', margin: '12px 0', paddingLeft: 24 }}>
                                    <li>客户已确认需要维修服务</li>
                                    <li>已核实产品在保修期内或客户接受付费维修</li>
                                    <li>已获取产品序列号</li>
                                </ul>
                                <p style={{ margin: '8px 0 0', fontSize: 13, color: '#F59E0B' }}>
                                    等待 {upgradeRmaCountdown > 0 ? <span style={{ fontWeight: 600 }}>{upgradeRmaCountdown}秒</span> : '解锁'}
                                </p>
                            </div>
                            <div style={{ padding: '0 24px 24px' }}>
                                <textarea
                                    value={upgradeRmaReason}
                                    onChange={e => setUpgradeRmaReason(e.target.value)}
                                    placeholder="输入升级理由（必填，至少10个字符）..."
                                    style={{ width: '100%', padding: '12px', background: 'var(--input-bg)', border: '1px solid var(--input-border)', color: 'var(--text-main)', borderRadius: 8, minHeight: 80, fontSize: 14 }}
                                />
                            </div>
                            <div style={{ display: 'flex', borderTop: '1px solid var(--glass-border)' }}>
                                <button
                                    onClick={() => { setIsUpgradeRmaModalOpen(false); setUpgradeRmaReason(''); }}
                                    style={{ flex: 1, padding: 16, background: 'transparent', border: 'none', color: 'var(--text-main)', fontSize: 15, cursor: 'pointer' }}
                                >取消</button>
                                <div style={{ width: 1, background: 'var(--glass-border)' }} />
                                <button
                                    onClick={async () => {
                                        setIsUpgradingRma(true);
                                        await handleUpgrade('rma', upgradeRmaReason);
                                        setIsUpgradingRma(false);
                                        setIsUpgradeRmaModalOpen(false);
                                        setUpgradeRmaReason('');
                                    }}
                                    disabled={upgradeRmaCountdown > 0 || upgradeRmaReason.trim().length < 10 || isUpgradingRma}
                                    style={{
                                        flex: 1, padding: 16, background: 'transparent', border: 'none',
                                        color: (upgradeRmaCountdown > 0 || upgradeRmaReason.trim().length < 10) ? 'var(--text-tertiary)' : '#F59E0B',
                                        fontSize: 15, fontWeight: 600,
                                        cursor: (upgradeRmaCountdown > 0 || upgradeRmaReason.trim().length < 10) ? 'not-allowed' : 'pointer',
                                        transition: 'all 0.2s'
                                    }}
                                >
                                    {upgradeRmaCountdown > 0 ? `确认升级 (${upgradeRmaCountdown}s)` : isUpgradingRma ? '升级中...' : '确认升级'}
                                </button>
                            </div>
                        </div>
                    </div>
                )
            }

            <SubmitDiagnosticModal
                isOpen={isDiagnosticModalOpen}
                onClose={() => {
                    setIsDiagnosticModalOpen(false);
                    // 重置编辑模式状态
                    setDiagnosticEditMode(false);
                    setDiagnosticEditData(null);
                    setPendingCorrectionRequest(null);
                }}
                ticketId={ticketId}
                ticketNumber={ticket.ticket_number || ''}
                onSuccess={() => {
                    setIsDiagnosticModalOpen(false);
                    fetchDetail();
                    // 重置编辑模式状态
                    setDiagnosticEditMode(false);
                    setDiagnosticEditData(null);
                    setPendingCorrectionRequest(null);
                }}
                editMode={diagnosticEditMode}
                editData={diagnosticEditData}
                correctionReason={pendingCorrectionRequest?.reason}
            />
            <MSReviewPanel
                isOpen={isMSReviewPanelOpen}
                onClose={() => setIsMSReviewPanelOpen(false)}
                ticketId={ticketId}
                ticketNumber={ticket.ticket_number || ''}
                currentNode={ticket.current_node}
                onSuccess={() => {
                    setIsMSReviewPanelOpen(false);
                    fetchDetail();
                }}
            />
            <FinalSettlementModal
                isOpen={isFinalSettlementOpen}
                onClose={() => setIsFinalSettlementOpen(false)}
                ticketId={ticketId}
                ticketNumber={ticket.ticket_number || ''}
                onSuccess={() => {
                    setIsFinalSettlementOpen(false);
                    fetchDetail();
                }}
            />
            {isOpRepairReportEditorOpen && (
                <OpRepairReportEditor
                    isOpen={isOpRepairReportEditorOpen}
                    onClose={() => {
                        setIsOpRepairReportEditorOpen(false);
                        // 重置编辑模式状态
                        setRepairEditMode(false);
                        setRepairEditData(null);
                        setPendingCorrectionRequest(null);
                    }}
                    ticketId={ticketId}
                    ticketNumber={ticket?.ticket_number || ''}
                    onSuccess={() => {
                        fetchDetail();
                        // 重置编辑模式状态
                        setRepairEditMode(false);
                        setRepairEditData(null);
                        setPendingCorrectionRequest(null);
                    }}
                    warrantyCalc={warrantyCalc}
                    currentNode={ticket?.current_node}
                    editMode={repairEditMode}
                    editData={repairEditData}
                    correctionReason={pendingCorrectionRequest?.reason}
                />
            )}

            {isRepairReportEditorOpen && (
                <RepairReportEditor
                    isOpen={isRepairReportEditorOpen}
                    onClose={() => setIsRepairReportEditorOpen(false)}
                    ticketId={ticketId}
                    ticketNumber={ticket?.ticket_number || ''}
                    reportId={activeReportInfo?.id}
                    currentNode={ticket?.current_node || ''}
                    onSuccess={() => {
                        setIsRepairReportEditorOpen(false);
                        fetchDetail();
                        // Trigger docs refresh in closing handover modal
                        setDocsRefreshTrigger(prev => prev + 1);
                    }}
                />
            )}

            {isPIEditorOpen && (
                <PIEditor
                    isOpen={isPIEditorOpen}
                    onClose={() => setIsPIEditorOpen(false)}
                    ticketId={ticketId}
                    ticketNumber={ticket?.ticket_number || ''}
                    piId={activePIInfo?.id}
                    onSuccess={() => {
                        setIsPIEditorOpen(false);
                        fetchDetail();
                        // Trigger docs refresh in closing handover modal
                        setDocsRefreshTrigger(prev => prev + 1);
                    }}
                />
            )}

            {isClosingHandoverOpen && ticket && (
                <ClosingHandoverModal
                    isOpen={isClosingHandoverOpen}
                    onClose={() => setIsClosingHandoverOpen(false)}
                    ticket={ticket}
                    onSuccess={() => {
                        setIsClosingHandoverOpen(false);
                        fetchDetail();
                    }}
                    onOpenRepairReport={() => {
                        // Don't close handover modal, just open editor on top
                        setIsRepairReportEditorOpen(true);
                    }}
                    onOpenPI={() => {
                        // Don't close handover modal, just open editor on top
                        setIsPIEditorOpen(true);
                    }}
                    refreshTrigger={docsRefreshTrigger}
                />
            )}
            <ActionBufferModal
                isOpen={isActionBufferModalOpen}
                onClose={() => {
                    setIsActionBufferModalOpen(false);
                    // 重置编辑模式状态
                    setKeyNodeEditMode(null);
                    setKeyNodeEditData(null);
                    setKeyNodeEditActivityId(null);
                }}
                ticket={ticket}
                nextNode={actionBufferTarget.nextNode}
                actionLabel={actionBufferTarget.label}
                onSuccess={() => {
                    fetchDetail();
                    // 重置编辑模式状态
                    setKeyNodeEditMode(null);
                    setKeyNodeEditData(null);
                    setKeyNodeEditActivityId(null);
                }}
                // 编辑模式 props
                editMode={!!keyNodeEditMode}
                editData={keyNodeEditData}
                editActivityId={keyNodeEditActivityId}
                editNodeType={keyNodeEditMode}
            />
            <MediaLightbox url={lightboxMedia?.url || null} type={lightboxMedia?.type || null} onClose={() => setLightboxMedia(null)} />
            <ActivityDetailDrawer 
                            activity={selectedActivity} 
                            onClose={() => setSelectedActivity(null)} 
                            ticketId={ticket?.id}
                            ticket={ticket}
                            onRefresh={fetchDetail}
                            onCorrectionRequest={handleCorrectionRequest}
                            onKeyNodeCorrectionRequest={handleKeyNodeCorrectionRequest}
                        />

            {showCalculationModal && warrantyCalc && (
                <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(10px)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <div style={{ background: 'var(--modal-bg, #1c1c1e)', borderRadius: 20, border: '1px solid var(--glass-border)', width: 500, overflow: 'hidden', boxShadow: 'var(--glass-shadow-lg, 0 30px 60px rgba(0,0,0,0.6))' }}>
                        {/* Header */}
                        <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--glass-border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'var(--glass-bg-light)' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                                <div style={{ width: 40, height: 40, borderRadius: 10, background: 'rgba(255, 210, 0, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                    <Calculator size={20} color="#FFD200" />
                                </div>
                                <div>
                                    <h3 style={{ margin: 0, fontSize: 18, fontWeight: 600, color: 'var(--text-main)' }}>产品保修计算引擎</h3>
                                    <p style={{ margin: 0, fontSize: 12, color: 'var(--text-tertiary)', marginTop: 4 }}>序列号：{ticket?.serial_number || '-'}</p>
                                </div>
                            </div>
                            <button onClick={() => setShowCalculationModal(false)} style={{ background: 'none', border: 'none', color: 'var(--text-tertiary)', cursor: 'pointer' }}>
                                <X size={24} />
                            </button>
                        </div>

                        {/* Body */}
                        <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 20 }}>
                            {/* Rules Section */}
                            <div style={{ padding: '0 4px' }}>
                                <h4 style={{ margin: '0 0 12px 0', fontSize: 14, color: 'var(--text-secondary)', fontWeight: 600 }}>保修计算说明</h4>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 10, fontSize: 13, color: 'var(--text-tertiary)' }}>
                                    {[
                                        { p: 1, basis: 'IOT_ACTIVATION', label: 'IoT', detail: '若 activation_date 存在，以此为准' },
                                        { p: 2, basis: 'INVOICE_PROOF', label: '人工', detail: '若 sales_invoice_date 存在（有发票），以此为准' },
                                        { p: 3, basis: 'REGISTRATION', label: '注册', detail: '若 registration_date 存在，以此为准' },
                                        { p: 4, basis: 'DIRECT_SHIPMENT', label: '直销', detail: '若为 DIRECT，按 ship_date + 7 天' },
                                        { p: 5, basis: 'DEALER_FALLBACK', label: '兜底', detail: '按 ship_to_dealer_date + 90 天' }
                                    ].map((rule) => {
                                        const isActive = warrantyCalc?.calculation_basis?.toUpperCase() === rule.basis;
                                        return (
                                            <div key={rule.p} style={{
                                                display: 'flex',
                                                alignItems: 'flex-start',
                                                gap: 8,
                                                padding: '8px 12px',
                                                background: isActive ? 'rgba(255, 210, 0, 0.1)' : 'var(--glass-bg-light)',
                                                borderRadius: 8,
                                                border: isActive ? '1px solid rgba(255, 210, 0, 0.3)' : '1px solid var(--glass-border)'
                                            }}>
                                                <span style={{ color: '#FFD200', fontWeight: 700, whiteSpace: 'nowrap' }}>{rule.p}.</span>
                                                <div>
                                                    <span style={{ color: isActive ? '#FFD200' : 'var(--text-main)', fontWeight: 600, marginRight: 4 }}>
                                                        优先级 {rule.p} ({rule.label}):
                                                        {isActive && <span style={{ marginLeft: 8, fontSize: '0.75rem', padding: '2px 6px', background: '#FFD200', color: '#000', borderRadius: 4 }}>当前采用</span>}
                                                    </span>
                                                    <div style={{ marginTop: 2, color: 'var(--text-secondary)' }}>{rule.detail}</div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>

                            <div style={{ height: 1, background: 'rgba(255,255,255,0.05)', margin: '4px 0' }} />

                            {/* Result Section */}
                            <div style={{
                                padding: 16, borderRadius: 12,
                                background: warrantyCalc.final_warranty_status === 'warranty_valid' ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)',
                                border: `1px solid ${warrantyCalc.final_warranty_status === 'warranty_valid' ? '#10B981' : '#EF4444'}`,
                                display: 'flex', flexDirection: 'column', gap: 12
                            }}>
                                <h4 style={{ margin: 0, fontSize: 12, color: warrantyCalc.final_warranty_status === 'warranty_valid' ? '#10B981' : '#EF4444', opacity: 0.8, textTransform: 'uppercase', letterSpacing: 0.5 }}>本机计算结果</h4>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                    {warrantyCalc.final_warranty_status === 'warranty_valid'
                                        ? <CheckCircle size={22} color="#10B981" />
                                        : <AlertTriangle size={22} color="#EF4444" />}
                                    <span style={{ fontSize: 18, fontWeight: 700, color: warrantyCalc.final_warranty_status === 'warranty_valid' ? '#10B981' : '#EF4444' }}>
                                        {warrantyCalc.final_warranty_status === 'warranty_valid' ? '在保期内 - 免费维修' : '已过保 - 付费维修'}
                                    </span>
                                </div>
                                <div style={{ height: 1, background: 'rgba(255,255,255,0.05)' }} />
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px 24px' }}>
                                    {[
                                        { label: '生效日期', value: warrantyCalc.start_date || '-' },
                                        { label: '截止日期', value: warrantyCalc.end_date || '-' },
                                        {
                                            label: '计算依据', value: (
                                                {
                                                    'iot_activation': 'IoT激活日期',
                                                    'invoice': '销售发票日期',
                                                    'registration': '人工注册日期',
                                                    'direct_ship': '直销发货日期+7天',
                                                    'dealer_fallback': '经销商发货日期+90天',
                                                    'damage_void': '人为损坏（保修失效）',
                                                    'unknown': '保修依据缺失'
                                                } as any
                                            )[warrantyCalc.calculation_basis] || warrantyCalc.calculation_basis || '-', fullWidth: true
                                        }
                                    ].map((item, idx) => (
                                        <div key={idx} style={{ gridColumn: item.fullWidth ? '1/-1' : 'span 1' }}>
                                            <div style={{ fontSize: 12, color: '#888', marginBottom: 4 }}>{item.label}</div>
                                            <div style={{ fontSize: 14, color: '#fff', fontWeight: 500 }}>{item.value}</div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>

                        {/* Footer */}
                        <div style={{ padding: '16px 24px', background: 'rgba(255,255,255,0.02)', borderTop: '1px solid rgba(255,255,255,0.08)', textAlign: 'right' }}>
                            <button
                                onClick={() => setShowCalculationModal(false)}
                                style={{
                                    padding: '10px 24px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.1)',
                                    background: 'rgba(255,255,255,0.05)', color: '#fff', cursor: 'pointer', fontWeight: 600,
                                    transition: 'all 0.2s'
                                }}
                                onMouseOver={e => e.currentTarget.style.background = 'rgba(255,255,255,0.1)'}
                                onMouseOut={e => e.currentTarget.style.background = 'rgba(255,255,255,0.05)'}
                            >
                                确认关闭
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Warranty Registration Modal */}
            {isWarrantyRegistrationOpen && ticket && (
                <ProductWarrantyRegistrationModal
                    isOpen={isWarrantyRegistrationOpen}
                    onClose={() => setIsWarrantyRegistrationOpen(false)}
                    serialNumber={ticket.serial_number || ''}
                    productName={ticket.product_name || ''}
                    isNewProduct={assetData?.device?.is_unregistered === true}
                    onRegistered={async (result) => {
                        setIsWarrantyRegistrationOpen(false);
                        
                        // 类型判断：number 为 productId，object 为暂存的保修数据（不应在此场景出现）
                        const newProductId = typeof result === 'number' ? result : undefined;
                        
                        // 入库成功后自动关联工单 product_id
                        if (newProductId && !ticket.product_id) {
                            try {
                                await axios.patch(`/api/v1/tickets/${ticket.id}`, {
                                    product_id: newProductId,
                                    change_reason: '入库新设备后自动关联'
                                }, { headers: { Authorization: `Bearer ${token}` } });
                            } catch (err) {
                                console.error('[AutoLink] Failed to link product_id:', err);
                            }
                        }
                        
                        fetchDetail(); // Refresh to get updated warranty info
                        refreshWarrantyCalc(); // Also refresh warranty calculation immediately
                        
                        // 刷新 assetData（SN 查询结果）
                        if (ticket.serial_number) {
                            axios.get(`/api/v1/context/by-serial-number?serial_number=${ticket.serial_number}`, {
                                headers: { Authorization: `Bearer ${token}` }
                            }).then(res => {
                                if (res.data.success) {
                                    setAssetData(res.data.data);
                                }
                            }).catch(err => console.error('[AssetRefresh] Failed', err));
                        }
                    }}
                />
            )}

            {/* Product Modal (产品入库) */}
            {isProductModalOpen && ticket && (
                <ProductModal
                    isOpen={isProductModalOpen}
                    onClose={() => setIsProductModalOpen(false)}
                    editingProduct={null}
                    prefillSerialNumber={ticket.serial_number || ''}
                    prefillProductName={ticket.product_name || ''}
                    onSuccess={async (newProduct) => {
                        setIsProductModalOpen(false);
                        
                        // 入库成功后自动关联工单 product_id
                        if (newProduct?.id && !ticket.product_id) {
                            try {
                                await axios.patch(`/api/v1/tickets/${ticket.id}`, {
                                    product_id: newProduct.id,
                                    change_reason: '入库新设备后自动关联'
                                }, { headers: { Authorization: `Bearer ${token}` } });
                            } catch (err) {
                                console.error('[AutoLink] Failed to link product_id:', err);
                            }
                        }
                        
                        fetchDetail();
                        refreshWarrantyCalc();
                        
                        // 刷新 assetData
                        if (ticket.serial_number) {
                            axios.get(`/api/v1/context/by-serial-number?serial_number=${ticket.serial_number}`, {
                                headers: { Authorization: `Bearer ${token}` }
                            }).then(res => {
                                if (res.data.success) {
                                    setAssetData(res.data.data);
                                }
                            }).catch(err => console.error('[AssetRefresh] Failed', err));
                        }
                    }}
                />
            )}
            {/* 1. Reply Modal (Handling Node) */}
            {isReplyModalOpen && (
                <div style={{ position: 'fixed', inset: 0, zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(8px)' }}>
                    <div style={{ width: 620, background: 'var(--modal-bg)', borderRadius: 16, border: '1px solid var(--glass-border)', boxShadow: '0 20px 50px rgba(0,0,0,0.3)', overflow: 'hidden', display: 'flex', flexDirection: 'column', maxHeight: '90vh' }}>
                        {/* Header */}
                        <div style={{ padding: '18px 24px', borderBottom: '1px solid var(--glass-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                <div style={{ width: 32, height: 32, borderRadius: 8, background: 'rgba(59,130,246,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                    <MessageSquare size={18} color="var(--accent-blue)" />
                                </div>
                                <span style={{ fontWeight: 700, fontSize: 16, color: 'var(--text-main)' }}>{language === 'zh' ? '回复客户并等待反馈' : 'Reply & Wait'}</span>
                            </div>
                            <div onClick={() => setIsReplyModalOpen(false)} style={{ width: 30, height: 30, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', background: 'var(--glass-bg-light)' }}>
                                <X size={18} color="var(--text-secondary)" />
                            </div>
                        </div>

                        {/* Body */}
                        <div style={{ padding: '24px', flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 20 }}>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                                <textarea 
                                    value={replyContent}
                                    onChange={e => setReplyContent(e.target.value)}
                                    placeholder={language === 'zh' ? '请输入正式回复客户的内容...' : 'Enter formal reply...'}
                                    style={{ 
                                        width: '100%', minHeight: 140, 
                                        background: 'var(--card-bg-light)', border: '1px solid var(--glass-border)', 
                                        borderRadius: 12, padding: '12px 16px', color: 'var(--text-main)', 
                                        fontSize: 14, resize: 'vertical', outline: 'none', lineHeight: 1.5
                                    }}
                                />
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 4 }}>
                                    <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: 13, color: 'var(--text-secondary)' }}>
                                        <Paperclip size={16} color="var(--text-secondary)" />
                                        <span>{language === 'zh' ? '添加附件' : 'Add Attachment'}</span>
                                        <input 
                                            type="file" 
                                            multiple 
                                            onChange={e => e.target.files && setReplyFiles([...replyFiles, ...Array.from(e.target.files)])} 
                                            style={{ display: 'none' }} 
                                        />
                                    </label>
                                    <button 
                                        onClick={async () => {
                                            if (!replyContent.trim() && replyFiles.length === 0) return;
                                            try {
                                                setIsSubmitting(true);
                                                // 添加前缀以在前端识别为重要节点，同时使用 'comment' 绕过 SQLite Constraint
                                                const prefix = language === 'zh' ? '【正式回复】' : '[Official Reply] ';
                                                const fullContent = replyContent.startsWith('【正式回复】') || replyContent.startsWith('[Official Reply]') 
                                                    ? replyContent 
                                                    : `${prefix}${replyContent}`;
                                                    
                                                await handleAddComment(fullContent, 'all', [], replyFiles, 'comment');
                                                if (autoCloseDate) {
                                                    await axios.patch(`/api/v1/tickets/${ticketId}/auto-close`, {
                                                        auto_close_at: new Date(autoCloseDate).toISOString(),
                                                        reason: language === 'zh' ? '回复并顺延' : 'Reply & Postpone',
                                                        node_sla_hours: nodeSlaHours
                                                    }, { headers: { Authorization: `Bearer ${token}` } });
                                                }
                                                await handleAction('reply_to_customer');
                                                setReplyContent('');
                                                setReplyFiles([]);
                                                setIsReplyModalOpen(false);
                                            } catch (err: any) {
                                                alert(err.message || '回复失败');
                                            } finally {
                                                setIsSubmitting(false);
                                            }
                                        }}
                                        disabled={isSubmitting || (!replyContent.trim() && replyFiles.length === 0)}
                                        style={{ 
                                            padding: '10px 24px', borderRadius: 8, 
                                            background: 'var(--accent-blue)', color: '#fff', 
                                            fontSize: 14, fontWeight: 600, border: 'none', 
                                            cursor: isSubmitting ? 'not-allowed' : 'pointer',
                                            opacity: (isSubmitting || (!replyContent.trim() && replyFiles.length === 0)) ? 0.6 : 1
                                        }}
                                    >
                                        {isSubmitting ? (language === 'zh' ? '提交中...' : 'Submitting...') : (language === 'zh' ? '确认输出回复' : 'Confirm')}
                                    </button>
                                </div>
                                {renderFilePreviews(replyFiles, setReplyFiles)}
                            </div>

                             {/* Auto Close & SLA Config 下沉展示 */}
                             {systemSettings?.[`${ticket?.ticket_type?.toLowerCase()}_sla_enabled`] !== false && (
                                <div style={{ 
                                    padding: '16px', background: 'rgba(255,255,255,0.03)', border: '1px solid var(--glass-border)', borderRadius: 12,
                                    display: 'flex', flexDirection: 'column', gap: 12
                                }}>
                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                            <Clock size={14} color="#FFD200" />
                                            <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-main)' }}>{language === 'zh' ? '时效管理设置' : 'SLA & Auto-close'}</span>
                                        </div>
                                        <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>
                                            {language === 'zh' ? '规则：客户未回复则结案' : 'Rule: Auto-close if no customer reply'}
                                        </div>
                                    </div>
                                    
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                                        <CustomDatePicker
                                            label={language === 'zh' ? '预设结案日期' : 'Auto-close Date'}
                                            value={autoCloseDate}
                                            onChange={(val) => setAutoCloseDate(val)}
                                        />
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                                            <label style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{language === 'zh' ? '节点处理时限 (小时)' : 'Node SLA (Hours)'}</label>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                                <input 
                                                    type="number" 
                                                    min={1}
                                                    max={120}
                                                    value={nodeSlaHours} 
                                                    onChange={(e) => setNodeSlaHours(parseInt(e.target.value))}
                                                    style={{ flex: 1, background: 'var(--card-bg-light)', border: '1px solid var(--glass-border)', borderRadius: 6, padding: '6px 10px', color: 'var(--text-main)', fontSize: 13 }}
                                                />
                                                <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>h</span>
                                            </div>
                                        </div>
                                    </div>
                                    <div style={{ fontSize: 11, color: 'var(--text-tertiary)', fontStyle: 'italic', background: 'rgba(255,210,0,0.05)', padding: '6px 10px', borderRadius: 4 }}>
                                        {language === 'zh' 
                                            ? `注：默认结案期为 ${systemSettings?.[`${ticket?.ticket_type?.toLowerCase()}_auto_close_days`] || (ticket?.ticket_type?.toLowerCase() === 'inquiry' ? 5 : 7)} 个工作日；节点时限 ${systemSettings?.[`${ticket?.ticket_type?.toLowerCase()}_sla_hours`] || 24} 小时。` 
                                            : `Note: Default ${systemSettings?.[`${ticket?.ticket_type?.toLowerCase()}_auto_close_days`] || (ticket?.ticket_type?.toLowerCase() === 'inquiry' ? 5 : 7)} working days for auto-close; ${systemSettings?.[`${ticket?.ticket_type?.toLowerCase()}_sla_hours`] || 24}h for node SLA.`}
                                    </div>
                                </div>
                             )}
                        </div>

                        {/* Footer / Upgrade Shortcut */}
                        <div style={{ padding: '16px 24px', background: 'rgba(0,0,0,0.1)', borderTop: '1px solid var(--glass-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                <AlertTriangle size={12} color="var(--text-tertiary)" />
                                <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{language === 'zh' ? '发现是硬件故障？' : 'Hardware issue?'}</span>
                                <button 
                                    onClick={() => {
                                        setIsReplyModalOpen(false);
                                        setIsUpgradeRmaModalOpen(true);
                                        setUpgradeRmaCountdown(5);
                                        setUpgradeRmaReason('');
                                    }}
                                    style={{ 
                                        background: 'rgba(245, 158, 11, 0.15)', 
                                        border: '1px solid rgba(245, 158, 11, 0.3)', 
                                        color: '#F59E0B', 
                                        fontSize: 11, 
                                        fontWeight: 600, 
                                        cursor: 'pointer', 
                                        padding: '4px 10px',
                                        borderRadius: 4,
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: 4,
                                        transition: 'all 0.2s'
                                    }}
                                    onMouseEnter={e => {
                                        e.currentTarget.style.background = 'rgba(245, 158, 11, 0.25)';
                                        e.currentTarget.style.borderColor = 'rgba(245, 158, 11, 0.5)';
                                    }}
                                    onMouseLeave={e => {
                                        e.currentTarget.style.background = 'rgba(245, 158, 11, 0.15)';
                                        e.currentTarget.style.borderColor = 'rgba(245, 158, 11, 0.3)';
                                    }}
                                >
                                    <ArrowUpCircle size={12} />
                                    {language === 'zh' ? '升级为 RMA' : 'Upgrade to RMA'}
                                </button>
                            </div>

                        </div>
                    </div>
                </div>
            )}

            {/* 2. Process Feedback Modal (Awaiting Customer Node) */}
            {isFeedbackModalOpen && (
                <div style={{ position: 'fixed', inset: 0, zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(8px)' }}>
                    <div style={{ width: 500, background: 'var(--modal-bg)', borderRadius: 16, border: '1px solid var(--glass-border)', boxShadow: '0 20px 50px rgba(0,0,0,0.3)', overflow: 'hidden' }}>
                        <div style={{ padding: '18px 24px', borderBottom: '1px solid var(--glass-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ fontWeight: 700, fontSize: 16, color: 'var(--text-main)' }}>
                                {feedbackView === 'options' ? (language === 'zh' ? '处理客户反馈' : 'Process Feedback') : 
                                 feedbackView === 'resolve_input' ? (language === 'zh' ? '确认解决并归档建议' : 'Confirm Resolution') : 
                                 (language === 'zh' ? '代录客户反馈' : 'Log Feedback')}
                            </span>
                            <div onClick={() => { setIsFeedbackModalOpen(false); setFeedbackView('options'); }} style={{ width: 30, height: 30, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', background: 'var(--glass-bg-light)' }}>
                                <X size={18} color="var(--text-secondary)" />
                            </div>
                        </div>

                        <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: 16 }}>
                            {feedbackView === 'options' ? (<>
                                {/* Option 1: Resolved */}
                                <button 
                                    onClick={() => setFeedbackView('resolve_input')}
                                    style={{ 
                                        padding: '16px', borderRadius: 12, background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.2)', 
                                        display: 'flex', alignItems: 'center', gap: 16, cursor: 'pointer', textAlign: 'left', transition: 'all 0.2s', width: '100%'
                                    }}
                                >
                                    <div style={{ width: 40, height: 40, borderRadius: 10, background: '#22C55E', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                        <CheckCircle size={24} color="#fff" />
                                    </div>
                                    <div style={{ flex: 1 }}>
                                        <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-main)' }}>{language === 'zh' ? '确认解决 (申请结案)' : 'Resolved'}</div>
                                        <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 2 }}>{language === 'zh' ? '客户反馈良好，问题已彻底搞定' : 'Issue solved completely'}</div>
                                    </div>
                                    <ChevronRight size={18} color="var(--text-tertiary)" />
                                </button>

                                {/* Option 2: Continuing (Megaphone Mode) */}
                                <button 
                                    onClick={() => setFeedbackView('input')}
                                    style={{ 
                                        padding: '16px', borderRadius: 12, background: 'rgba(59,130,246,0.1)', border: '1px solid rgba(59,130,246,0.2)', 
                                        display: 'flex', alignItems: 'center', gap: 16, cursor: 'pointer', textAlign: 'left', transition: 'all 0.2s', width: '100%'
                                    }}
                                >
                                    <div style={{ width: 40, height: 40, borderRadius: 10, background: '#3B82F6', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                        <Zap size={20} color="#fff" />
                                    </div>
                                    <div style={{ flex: 1 }}>
                                        <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-main)' }}>{language === 'zh' ? '未解决 (继续乒乓)' : 'Still Processing'}</div>
                                        <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 2 }}>{language === 'zh' ? '客户仍有疑问，代录其反馈并继续' : 'Log customer feedback & continue'}</div>
                                    </div>
                                    <ChevronRight size={18} color="var(--text-tertiary)" />
                                </button>
                            </>) : feedbackView === 'resolve_input' ? (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                                    <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
                                        {language === 'zh' ? '确认已经解决？您可以代录任何心得或客户的建议：' : 'Confirmed Solved? Log resolution details or suggestions:'}
                                    </div>
                                    <textarea 
                                        value={feedbackContent}
                                        onChange={e => setFeedbackContent(e.target.value)}
                                        placeholder={language === 'zh' ? '请输入内容... (可选，若为空则记为确认解决)' : 'Enter details... (Optional)'}
                                        style={{ 
                                            width: '100%', minHeight: 120, 
                                            background: 'var(--card-bg-light)', border: '1px solid var(--glass-border)', 
                                            borderRadius: 12, padding: '12px 16px', color: 'var(--text-main)', 
                                            fontSize: 14, resize: 'vertical', outline: 'none', lineHeight: 1.5
                                        }}
                                    />
                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 4 }}>
                                        <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: 13, color: 'var(--text-secondary)' }}>
                                            <Paperclip size={16} color="var(--text-secondary)" />
                                            <span>{language === 'zh' ? '添加附件' : 'Add Attachment'}</span>
                                            <input 
                                                type="file" 
                                                multiple 
                                                onChange={e => e.target.files && setFeedbackFiles([...feedbackFiles, ...Array.from(e.target.files)])} 
                                                style={{ display: 'none' }} 
                                            />
                                        </label>
                                        <button 
                                            onClick={async () => {
                                                try {
                                                    setIsSubmitting(true);
                                                    const text = feedbackContent.trim() || (language === 'zh' ? '问题已解决' : 'Issue resolved.');
                                                    // 标注：确认解决往往包含客户心声，自动打上【客户反馈】标签
                                                    await handleAddComment(`${language === 'zh' ? '【确认解决】【客户反馈】' : '[Resolved][Customer Feedback]'} ${text}`, 'all', [], feedbackFiles, 'comment');
                                                    await handleAction('resolve');
                                                    setFeedbackContent('');
                                                    setFeedbackFiles([]);
                                                    setIsFeedbackModalOpen(false);
                                                    setFeedbackView('options');
                                                } catch (err: any) {
                                                    alert(err.message || '记录失败');
                                                } finally {
                                                    setIsSubmitting(false);
                                                }
                                            }}
                                            disabled={isSubmitting}
                                            style={{ 
                                                padding: '10px 24px', borderRadius: 8, 
                                                background: 'rgba(34,197,94,0.9)', color: '#fff', 
                                                fontSize: 14, fontWeight: 600, border: 'none', 
                                                cursor: isSubmitting ? 'not-allowed' : 'pointer',
                                                opacity: isSubmitting ? 0.6 : 1
                                            }}
                                        >
                                            {isSubmitting ? (language === 'zh' ? '处理中...' : 'Processing...') : (language === 'zh' ? '确认解决' : 'Confirm')}
                                        </button>
                                    </div>
                                    {renderFilePreviews(feedbackFiles, setFeedbackFiles)}
                                    <div style={{ display: 'flex', gap: 8, marginTop: -4 }}>
                                        <button onClick={() => { setFeedbackView('options'); }} style={{ flex: 1, padding: '10px', borderRadius: 8, background: 'transparent', border: '1px solid var(--glass-border)', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: 13 }}>
                                            {language === 'zh' ? '返回' : 'Back'}
                                        </button>
                                    </div>
                                </div>
                            ) : (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                                    <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
                                        {language === 'zh' ? '代录客户通过电话/微信等反馈的内容：' : 'Log customer feedback from external channels:'}
                                    </div>
                                    <textarea 
                                        value={feedbackContent}
                                        onChange={e => setFeedbackContent(e.target.value)}
                                        placeholder={language === 'zh' ? '请输入反馈内容...' : 'Enter feedback...'}
                                        style={{ 
                                            width: '100%', minHeight: 120, 
                                            background: 'var(--card-bg-light)', border: '1px solid var(--glass-border)', 
                                            borderRadius: 12, padding: '12px 16px', color: 'var(--text-main)', 
                                            fontSize: 14, resize: 'vertical', outline: 'none', lineHeight: 1.5
                                        }}
                                    />
                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 4 }}>
                                        <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: 13, color: 'var(--text-secondary)' }}>
                                            <Paperclip size={16} color="var(--text-secondary)" />
                                            <span>{language === 'zh' ? '添加附件' : 'Add Attachment'}</span>
                                            <input 
                                                type="file" 
                                                multiple 
                                                onChange={e => e.target.files && setFeedbackFiles([...feedbackFiles, ...Array.from(e.target.files)])} 
                                                style={{ display: 'none' }} 
                                            />
                                        </label>
                                        <button 
                                            onClick={async () => {
                                                if (!feedbackContent.trim() && feedbackFiles.length === 0) return;
                                                try {
                                                    setIsSubmitting(true);
                                                    const prefix = language === 'zh' ? '【客户反馈】(由 ' : '[Customer Feedback] (via ';
                                                    const actingName = (actingUser as any).name || (actingUser as any).username || 'MS';
                                                    const suffix = language === 'zh' ? ' 代录)：' : '): ';
                                                    const fullContent = `${prefix}${actingName}${suffix} ${feedbackContent}`;
                                                    
                                                    await handleAddComment(fullContent, 'all', [], feedbackFiles, 'comment');
                                                    await handleAction('continue');
                                                    setFeedbackContent('');
                                                    setFeedbackFiles([]);
                                                    setIsFeedbackModalOpen(false);
                                                    setFeedbackView('options');
                                                } catch (err: any) {
                                                    alert(err.message || '反馈记录失败');
                                                } finally {
                                                    setIsSubmitting(false);
                                                }
                                            }}
                                            disabled={isSubmitting || (!feedbackContent.trim() && feedbackFiles.length === 0)}
                                            style={{ 
                                                padding: '10px 24px', borderRadius: 8, 
                                                background: 'var(--accent-blue)', color: '#fff', 
                                                fontSize: 14, fontWeight: 600, border: 'none', 
                                                cursor: isSubmitting ? 'not-allowed' : 'pointer',
                                                opacity: (isSubmitting || (!feedbackContent.trim() && feedbackFiles.length === 0)) ? 0.6 : 1
                                            }}
                                        >
                                            {isSubmitting ? (language === 'zh' ? '提交中...' : 'Submitting...') : (language === 'zh' ? '提交反馈' : 'Submit')}
                                        </button>
                                    </div>
                                    {renderFilePreviews(feedbackFiles, setFeedbackFiles)}
                                    <div style={{ display: 'flex', gap: 8, marginTop: -4 }}>
                                        <button onClick={() => { setFeedbackView('options'); }} style={{ flex: 1, padding: '10px', borderRadius: 8, background: 'transparent', border: '1px solid var(--glass-border)', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: 13 }}>
                                            {language === 'zh' ? '返回' : 'Back'}
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* Reopen Confirm Modal (High Security) */}
            {isReopenModalOpen && (
                <div style={{ position: 'fixed', inset: 0, zIndex: 3000, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(10px)' }}>
                    <div style={{ width: 450, background: 'var(--modal-bg)', borderRadius: 20, border: '2px solid #EF4444', boxShadow: '0 0 50px rgba(239, 68, 68, 0.3)', overflow: 'hidden', animation: 'shake 0.5s cubic-bezier(.36,.07,.19,.97) both' }}>
                        <div style={{ padding: '24px', textAlign: 'center', background: 'rgba(239, 68, 68, 0.1)', borderBottom: '1px solid rgba(239, 68, 68, 0.2)' }}>
                            <div style={{ width: 60, height: 60, borderRadius: '50%', background: '#EF4444', margin: '0 auto 16px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff' }}>
                                <AlertTriangle size={32} />
                            </div>
                            <h3 style={{ margin: 0, fontSize: 18, color: '#EF4444', fontWeight: 800 }}>{language === 'zh' ? '重新激活工单' : 'Reopen Ticket'}</h3>
                        </div>
                        
                        <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: 16 }}>
                            <p style={{ margin: 0, fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6, textAlign: 'center' }}>
                                {language === 'zh' ? '您正在尝试重新打开一个已经终结的咨询工单。此操作将使工单返回“处理中”节点，请务必输入充分的理由。' : 'You are attempting to reopen a finalized ticket. This will move the ticket back to Handling. Please provide a reason.'}
                            </p>
                            
                            <textarea
                                value={reopenReason}
                                onChange={e => setReopenReason(e.target.value)}
                                placeholder={language === 'zh' ? '请输入重新激活的理由 (至少 5 个字符)...' : 'Reason for reopening (min 5 chars)...'}
                                style={{ width: '100%', minHeight: 80, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 12, padding: 12, color: 'var(--text-main)', fontSize: 13, outline: 'none', resize: 'none' }}
                            />
                            
                            <div style={{ display: 'flex', gap: 12, marginTop: 8 }}>
                                <button onClick={() => setIsReopenModalOpen(false)} style={{ flex: 1, padding: '12px', borderRadius: 10, background: 'transparent', border: '1px solid var(--glass-border)', color: 'var(--text-secondary)', fontWeight: 600, cursor: 'pointer' }}>
                                    {language === 'zh' ? '取消' : 'Cancel'}
                                </button>
                                <button 
                                    disabled={reopenCountdown > 0 || !reopenReason.trim() || reopenReason.trim().length < 5 || isReopening}
                                    onClick={handleReopen}
                                    style={{ 
                                        flex: 2, padding: '12px', borderRadius: 10, border: 'none', 
                                        background: (reopenCountdown > 0 || reopenReason.trim().length < 5) ? 'var(--text-tertiary)' : '#EF4444', 
                                        color: '#fff', fontWeight: 800, cursor: (reopenCountdown > 0 || reopenReason.trim().length < 5) ? 'not-allowed' : 'pointer',
                                        transition: 'all 0.3s'
                                    }}
                                >
                                    {isReopening ? '...' : (reopenCountdown > 0 ? `${language === 'zh' ? '强制等待' : 'Hold'} (${reopenCountdown}s)` : (language === 'zh' ? '确认重新激活' : 'Confirm Reopen'))}
                                </button>
                            </div>
                        </div>
                    </div>
                    <style>{`
                        @keyframes shake {
                            10%, 90% { transform: translate3d(-1px, 0, 0); }
                            20%, 80% { transform: translate3d(2px, 0, 0); }
                            30%, 50%, 70% { transform: translate3d(-4px, 0, 0); }
                            40%, 60% { transform: translate3d(4px, 0, 0); }
                        }
                    `}</style>
                </div>
            )}

        </div >
    );
};

// ==============================
// Sub-Components
// ==============================

export default UnifiedTicketDetail;
