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
import { Package, Clock, ExternalLink, AlertTriangle, ArrowLeft, Edit2, MoreHorizontal, Trash2, X, Save, FileText, Paperclip, ShieldAlert, Loader2, ArrowRight, Wrench, Calculator, CheckCircle, Shield, Search, BadgeDollarSign, ChevronRight } from 'lucide-react';
import axios from 'axios';
import { useAuthStore } from '../../store/useAuthStore';
import { useLanguage } from '../../i18n/useLanguage';
import NodeProgressBar from './NodeProgressBar';
import { ActivityTimeline, CollapsiblePanel, MediaLightbox, ActivityDetailDrawer } from './TicketDetailComponents';
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
    submitted_name?: string;
    submitted_dept?: string;
    reporter_name?: string;
    reporter_snapshot?: any;
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
        open: { label_zh: '回复并跟进', label_en: 'Reply & Follow-up', action: 'reply' },
        waiting: { label_zh: '催促客户回复', label_en: 'Nudge Customer', action: 'nudge' },
    },
    svc: {
        open: { label_zh: '回复经销商', label_en: 'Reply Dealer', action: 'reply' },
        processing: { label_zh: '查看进度', label_en: 'View Progress', action: 'view' },
    },
};

// ==============================
// Priority & Status helpers
// ==============================

const nodeLabels: Record<string, { zh: string }> = {
    draft: { zh: '草稿' },
    submitted: { zh: '已提交' },
    ms_review: { zh: '商务审核' },
    op_receiving: { zh: '待收货' },
    op_diagnosing: { zh: '诊断中' },
    op_repairing: { zh: '维修中' },
    op_qa: { zh: 'QA检测' },
    op_shipping: { zh: '打包发货' },
    op_shipping_transit: { zh: '待补外销单号' },
    ms_closing: { zh: '最终结案' },
    ge_review: { zh: '财务审核' },
    ge_closing: { zh: '财务结案' },
    resolved: { zh: '已解决' },
    closed: { zh: '已关闭' },
    waiting_customer: { zh: '待反馈' },
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
    const [docsRefreshTrigger, setDocsRefreshTrigger] = useState(0);
    const [activePIInfo, setActivePIInfo] = useState<{ id?: number; number?: string } | null>(null);
    const [activeReportInfo, setActiveReportInfo] = useState<{ id?: number, number?: string } | null>(null);
    const [hasPI, setHasPI] = useState(false);
    const [hasRepairReport, setHasRepairReport] = useState(false);
    const [piStatus, setPIStatus] = useState<string | null>(null);
    const [reportStatus, setReportStatus] = useState<string | null>(null);

    // Collapsible card states
    const [keyDeliverablesCollapsed, setKeyDeliverablesCollapsed] = useState(false);
    const [customerContextCollapsed, setCustomerContextCollapsed] = useState(false);
    const [isWarrantyRegistrationOpen, setIsWarrantyRegistrationOpen] = useState(false);

    // System settings for workflow control
    const [systemSettings, setSystemSettings] = useState<{ require_finance_confirmation?: boolean }>({});

    // PRD §7.1: 权限判断基于 acting user
    const actingDeptNorm = (actingUser.department_code || '').toUpperCase();
    const isMsLead = (actingDeptNorm === 'MS' || actingDeptNorm === '市场部') && actingUser.role === 'Lead';
    const isGlobalAdmin = actingUser.role === 'Admin' || actingUser.role === 'Exec';
    const hasPrivilege = isGlobalAdmin || isMsLead;

    // 当前节点 → 部门归属映射（用于判断哪个 Lead 能指派）
    const NODE_DEPT_MAP: Record<string, string> = {
        // MS 节点
        draft: 'MS', submitted: 'MS', ms_review: 'MS', ms_closing: 'MS', waiting_customer: 'MS',
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

    const FIELD_LABELS: Record<string, string> = {
        serial_number: '序列号',
        product_id: '产品型号',
        priority: '优先级',
        status: '状态',
        problem_summary: '问题简述',
        problem_description: '详细描述',
        repair_content: '维修内容',
        payment_amount: '金额',
        is_warranty: '保修判定',
        resolution: '处理记录'
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
            let snippetOld = dOld;
            let snippetNew = dNew;
            if (dOld.length > 20) snippetOld = dOld.substring(0, 20) + '...';
            if (dNew.length > 20) snippetNew = dNew.substring(0, 20) + '...';

            diffs.push({
                field: key,
                label: FIELD_LABELS[key] || key,
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
                                        product_id: ticket!.product_id as number
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
                setTicket(res.data.data);
                setActivities(res.data.activities || []);
                setParticipants(res.data.participants || []);
                setTicketAttachments(res.data.attachments || []);
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

    const handleAddComment = async (content: string, visibility: string, mentions: number[] = [], attachments: File[] = []) => {
        try {
            const formData = new FormData();
            formData.append('activity_type', 'comment');
            formData.append('content', content);
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
                setTicket(detailRes.data.data);
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
            await axios.patch(`/api/v1/tickets/${ticketId}`, {
                ...editForm,
                change_reason: changeReason.trim(),
                is_modal_edit: true
            }, { headers: { Authorization: `Bearer ${token}` } });
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
            if (ticket.current_node === 'open') nextNode = 'waiting';
            else if (ticket.current_node === 'waiting') nextNode = 'open';
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
            await axios.patch(`/api/v1/tickets/${ticketId}`, {
                current_node: nextNode,
                change_reason: `执行主流程动作: ${action}`
            }, { headers: { Authorization: `Bearer ${token}` } });
            fetchDetail();
        } catch (err: any) {
            alert(err.response?.data?.error || err.message);
        } finally {
            setLoading(false);
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
                {/* Hide status badge when ticket is resolved/closed */}
                {ticket.current_node !== 'resolved' && ticket.current_node !== 'closed' && ticket.current_node !== 'auto_closed' && (
                    <div style={{
                        display: 'flex', alignItems: 'center', gap: 6,
                        padding: '6px 14px', borderRadius: 10, fontSize: 14, fontWeight: 700,
                        background: 'rgba(59,130,246,0.12)', border: '1px solid rgba(59,130,246,0.2)',
                        color: '#60A5FA',
                    }}>
                        <span>
                            {(() => {
                                const node = ticket.current_node;
                                if (node === 'draft') return '草稿';
                                if (node === 'submitted') return '待收货';
                                if (node === 'ms_review') return '商务审核';
                                if (node === 'op_receiving') return '待收货';
                                if (node === 'op_diagnosing') return '诊断中';
                                if (node === 'op_repairing') return '维修中';
                                if (node === 'op_qa') return 'QA检测';
                                if (node === 'op_shipping') return '打包发货';
                                if (node === 'op_shipping_transit') return '待补外销单号';
                                if (node === 'ms_closing') return '最终结案';
                                if (node === 'ge_review') return '财务审核';
                                if (node === 'ge_closing') return '财务结案';
                                if (node === 'waiting_customer') return '待反馈';
                                return node;
                            })()}
                        </span>
                        <span style={{ opacity: 0.4 }}>·</span>
                        <span>{(() => {
                            if (ticket.department_code) return ticket.department_code as string;
                            if (ticket.assigned_dept) return ticket.assigned_dept as string;
                            const n = String(ticket.current_node || '').toLowerCase();
                            if (n.startsWith('ms_') || ['draft', 'open', 'waiting', 'waiting_customer'].includes(n)) return 'MS';
                            if (n.startsWith('op_') || ['submitted', 'shipped'].includes(n)) return 'OP';
                            if (n.startsWith('ge_')) return 'GE';
                            return '-';
                        })()}</span>
                        <span style={{ opacity: 0.4 }}>·</span>
                        {canAssign ? (
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
                            <span>{String(ticket.assigned_name)}</span>
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
                                    {/* Warranty Status Display */}
                                    {warrantyCalc?.final_warranty_status === 'warranty_unknown' ? (
                                        // Unknown warranty - show warning and register button (not for OP)
                                        <>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                                <AlertTriangle size={14} color="#F59E0B" />
                                                <span style={{ fontSize: 13, fontWeight: 600, color: '#F59E0B' }}>
                                                    保修待确认
                                                </span>
                                            </div>
                                            {/* One-click register button - hidden for OP department */}
                                            {actingDeptNorm !== 'PRODUCTION' && actingDeptNorm !== 'OP' && (
                                                <button
                                                    onClick={(e) => { e.stopPropagation(); setIsWarrantyRegistrationOpen(true); }}
                                                    style={{
                                                        padding: '4px 10px', borderRadius: 6,
                                                        background: 'rgba(255,210,0,0.15)', border: '1px solid rgba(255,210,0,0.4)',
                                                        color: '#FFD200', fontSize: 11, fontWeight: 600,
                                                        cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4,
                                                        transition: 'all 0.2s'
                                                    }}
                                                    onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,210,0,0.25)'; }}
                                                    onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,210,0,0.15)'; }}
                                                >
                                                    <Shield size={12} />
                                                    一键注册保修
                                                </button>
                                            )}
                                        </>
                                    ) : (
                                        // Normal warranty display
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                            <Shield size={14} color={(warrantyCalc?.final_warranty_status === 'warranty_valid') ? '#10B981' : '#EF4444'} />
                                            <span style={{ fontSize: 13, fontWeight: 600, color: (warrantyCalc?.final_warranty_status === 'warranty_valid') ? '#10B981' : '#EF4444' }}>
                                                {(warrantyCalc?.final_warranty_status === 'warranty_valid') ? '在保' : '过保'}
                                            </span>
                                        </div>
                                    )}
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
                                            <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: 13, minWidth: 60 }}>产品型号</span>
                                            <span style={{ fontSize: 14, color: '#fff', fontWeight: 500 }}>{String(ticket.product_name || '-')}</span>
                                        </div>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                                            <div
                                                style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}
                                                onClick={() => ticket.product_id && navigate(`/service/products/${ticket.product_id}`)}
                                            >
                                                <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: 13 }}>序列号</span>
                                                <span style={{ fontSize: 14, color: '#fff', fontWeight: 500 }}>
                                                    {String(ticket.serial_number || '-')}
                                                </span>
                                            </div>
                                            {assetData?.service_history && assetData.service_history.length > 0 && (
                                                <div
                                                    style={{
                                                        display: 'flex', alignItems: 'center', gap: 6, padding: '4px 12px', borderRadius: 8,
                                                        background: 'rgba(255, 255, 255, 0.05)', border: '1px solid rgba(255, 255, 255, 0.15)',
                                                        color: 'var(--text-secondary)', fontSize: 13, fontWeight: 500, cursor: 'pointer',
                                                        transition: 'all 0.2s'
                                                    }}
                                                    onMouseEnter={e => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)'}
                                                    onMouseLeave={e => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)'}
                                                    onClick={() => ticket.product_id && window.open(`/service/products/${ticket.product_id}`, '_blank')}
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
                                            <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: 13, minWidth: 60 }}>{t('ticket.customer') || '客户'}</span>
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
                                            <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: 13 }}>销售渠道</span>
                                            <span style={{ fontSize: 14, color: '#ccc' }}>
                                                {ticket.dealer_name ? `${ticket.dealer_name}${ticket.dealer_code ? ` (${ticket.dealer_code})` : ''}` : '直销'}
                                            </span>
                                        </div>

                                        {/* Row 4 Col 1: Created Time */}
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                            <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: 13, minWidth: 60 }}>{t('ticket.created_at') || '创建时间'}</span>
                                            <span style={{ fontSize: 14, color: '#ccc' }}>{formatDateMinute(ticket.created_at)}</span>
                                        </div>
                                        {/* Row 4 Col 2: Submitter */}
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                            <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: 13 }}>{t('ticket.submitted_by') || '提交者'}</span>
                                            <span style={{ fontSize: 14, color: '#ccc' }}>
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
                                        background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)',
                                        cursor: 'pointer', transition: 'background 0.2s', position: 'relative'
                                    }}
                                        onClick={() => setIsDescriptionDrawerOpen(true)}
                                        onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.08)'}
                                        onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.03)'}
                                    >
                                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                                            <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                                <FileText size={14} />
                                                问题概要
                                                {((ticket.problem_description?.length || 0) > 80 || (ticket.problem_summary?.length || 0) > 80) && (
                                                    <span style={{ color: '#FFD200', marginLeft: 4, textTransform: 'none', letterSpacing: 'normal' }}>· 已折叠部分</span>
                                                )}
                                            </div>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--accent-blue)', fontSize: 13, fontWeight: 600 }}>
                                                <span>更多详情</span>
                                                <ExternalLink size={14} />
                                            </div>
                                        </div>
                                        <div style={{
                                            fontSize: 14, color: '#ccc', lineHeight: 1.7,
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
                        <ActivityTimeline activities={activities} loading={false} onActivityClick={(act) => setSelectedActivity(act)} />
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
                            background: 'rgba(28, 28, 30, 0.8)',
                            backdropFilter: 'blur(20px)',
                            borderTop: '1px solid rgba(255, 255, 255, 0.08)',
                            boxShadow: '0 -4px 20px rgba(0,0,0,0.3)',
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
                                    <div style={{ fontSize: 11, color: '#666', textTransform: 'uppercase', letterSpacing: 1 }}>当前节点</div>
                                    <div style={{ fontSize: 14, fontWeight: 600, color: '#e0e0e0' }}>
                                        {({
                                            draft: '草稿', submitted: '已提交', ms_review: '商务审核',
                                            op_receiving: '待收货', op_diagnosing: '诊断中', op_repairing: '维修中',
                                            op_qa: 'QA检测', op_shipping: '打包发货', ms_closing: '待结案',
                                            ge_review: '财务审核', ge_closing: '财务结案', resolved: '已解决',
                                            closed: '已关闭', waiting_customer: '待反馈'
                                        })[ticket.current_node] || ticket.current_node} · 对接人: {ticket.assigned_name || '未对接'}
                                    </div>
                                </div>
                            </div>

                            {/* Right side: Primary Action */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                                {!isAssignedToActingUser && (isGlobalAdmin || isDeptLead) && (
                                    <span style={{ fontSize: 12, color: '#888', fontStyle: 'italic' }}>
                                        (作为主管代理执行)
                                    </span>
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
                                                setIsOpRepairReportEditorOpen(true); // Changed to OpRepairReportEditor
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
                                        background: isAssignedToActingUser ? '#FFD200' : 'rgba(255,210,0,0.15)',
                                        color: isAssignedToActingUser ? '#000' : '#FFD200',
                                        border: isAssignedToActingUser ? 'none' : '1px solid rgba(255,210,0,0.4)',
                                        fontSize: 14,
                                        fontWeight: 700,
                                        cursor: 'pointer',
                                        transition: 'all 0.2s',
                                        boxShadow: isAssignedToActingUser ? '0 4px 15px rgba(255,215,0,0.25)' : 'none'
                                    }}
                                    onMouseEnter={e => {
                                        e.currentTarget.style.transform = 'translateY(-2px)';
                                        if (isAssignedToActingUser) e.currentTarget.style.background = '#FFD200';
                                    }}
                                    onMouseLeave={e => {
                                        e.currentTarget.style.transform = 'none';
                                        if (isAssignedToActingUser) e.currentTarget.style.background = '#FFD200';
                                    }}
                                >
                                    {loading ? <Loader2 className="animate-spin" size={18} /> : <ArrowRight size={18} />}
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
                    />


                    {/* Service Document Center - Consolidated Card (macOS26 Style) - Hidden for inquiry tickets */}
                    {ticket.type !== 'inquiry' && (
                    <div style={{
                        background: 'var(--glass-border)',
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
                                color: '#fff',
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
                                <Wrench size={12} color="#fff" /> {language === 'zh' ? '关键交付内容' : 'Key Deliverables'}
                            </div>
                            <ChevronRight
                                size={16}
                                color="#888"
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
                                                background: 'rgba(255,255,255,0.02)',
                                                border: '1px solid rgba(255,255,255,0.05)',
                                                borderRadius: '10px', transition: 'all 0.2s',
                                                cursor: diagActivity ? 'pointer' : 'not-allowed',
                                                opacity: diagActivity ? 1 : 0.6
                                            }}
                                        >
                                            <Search size={14} color={diagActivity ? '#888' : '#666'} />
                                            <span style={{ fontSize: '0.75rem', fontWeight: 600, color: diagActivity ? '#ddd' : '#666' }}>
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
                                                background: 'rgba(255,255,255,0.02)',
                                                border: '1px solid rgba(255,255,255,0.05)',
                                                borderRadius: '10px', transition: 'all 0.2s',
                                                cursor: hasPassedRepair ? 'pointer' : 'not-allowed',
                                                opacity: hasPassedRepair ? 1 : 0.6
                                            }}
                                        >
                                            <Wrench size={14} color={hasPassedRepair ? '#888' : '#666'} />
                                            <span style={{ fontSize: '0.75rem', fontWeight: 600, color: hasPassedRepair ? '#ddd' : '#666' }}>
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
                                const btnBg = !isEnabled ? 'rgba(255,255,255,0.02)' : (isPublished ? 'rgba(16, 185, 129, 0.08)' : 'rgba(255, 215, 0, 0.08)');
                                const btnBorder = !isEnabled ? 'rgba(255,255,255,0.1)' : (isPublished ? 'rgba(16, 185, 129, 0.25)' : 'rgba(255, 215, 0, 0.25)');
                                const iconColor = !isEnabled ? '#666' : (isPublished ? '#10B981' : '#FFD700');
                                const textColor = !isEnabled ? '#666' : (isPublished ? '#10B981' : '#FFD700');
                                return (
                                    <button
                                        disabled={!isEnabled}
                                        onClick={() => {
                                            if (isEnabled) setIsRepairReportEditorOpen(true);
                                        }}
                                        style={{
                                            display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 12px',
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
                                                background: isPublished ? 'rgba(16,185,129,0.15)' : 'rgba(255,255,255,0.1)',
                                                color: isPublished ? '#10B981' : '#888'
                                            }}>
                                                {isPublished ? '已发布' : '草稿'}
                                            </span>
                                        ) : (
                                            <span style={{ fontSize: '0.7rem', color: isEnabled ? '#FFD700' : '#666', opacity: 0.5 }}>{language === 'zh' ? '待处理' : 'Pending'}</span>
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
                                const btnBg = !isEnabled ? 'rgba(255,255,255,0.02)' : (isPublished ? 'rgba(16, 185, 129, 0.08)' : 'rgba(255, 215, 0, 0.08)');
                                const btnBorder = !isEnabled ? 'rgba(255,255,255,0.1)' : (isPublished ? 'rgba(16, 185, 129, 0.25)' : 'rgba(255, 215, 0, 0.25)');
                                const iconColor = !isEnabled ? '#666' : (isPublished ? '#10B981' : '#FFD700');
                                const textColor = !isEnabled ? '#666' : (isPublished ? '#10B981' : '#FFD700');
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
                                                background: isPublished ? 'rgba(16,185,129,0.15)' : 'rgba(255,255,255,0.1)',
                                                color: isPublished ? '#10B981' : '#888'
                                            }}>
                                                {isPublished ? '已发布' : '草稿'}
                                            </span>
                                        ) : (
                                            <span style={{ fontSize: '0.7rem', color: isEnabled ? '#FFD700' : '#666', opacity: 0.5 }}>{language === 'zh' ? '待处理' : 'Pending'}</span>
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
                            background: 'rgba(20,20,20,0.95)', backdropFilter: 'blur(20px)',
                            borderLeft: '1px solid rgba(255,255,255,0.1)',
                            zIndex: 200, display: 'flex', flexDirection: 'column',
                            boxShadow: '-10px 0 30px rgba(0,0,0,0.5)'
                        }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', borderBottom: '1px solid rgba(255,255,255,0.1)', background: 'rgba(0,0,0,0.2)' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                    <ShieldAlert size={18} color="#FFD200" />
                                    <div>
                                        <h3 style={{ margin: 0, fontSize: 16, color: '#fff', fontWeight: 600 }}>编辑工单信息</h3>
                                        <p style={{ margin: 0, fontSize: 11, color: '#888', marginTop: 2 }}>操作受审计保护，核心变更需提供理由</p>
                                    </div>
                                </div>
                                <button onClick={() => setIsEditing(false)} style={{ background: 'none', border: 'none', color: '#888', cursor: 'pointer', padding: 4 }}>
                                    <X size={20} />
                                </button>
                            </div>
                            <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 20 }}>

                                {/* ---- 分组 1: 设备信息 (RMA/SVC 特有) ---- */}
                                {(ticket.ticket_type === 'rma' || ticket.ticket_type === 'svc') && (
                                    <div>
                                        <div style={{ fontSize: 11, color: '#555', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 12, borderBottom: '1px solid rgba(255,255,255,0.03)', paddingBottom: 6 }}>设备信息</div>
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                                            <div style={{ padding: '10px 12px', background: 'rgba(245,158,11,0.03)', border: '1px solid rgba(245,158,11,0.1)', borderRadius: 8 }}>
                                                <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#FFD200', marginBottom: 6 }}>
                                                    <ShieldAlert size={12} /> 序列号 (S/N)
                                                </label>
                                                <input
                                                    value={editForm.serial_number as string || ''}
                                                    onChange={e => setEditForm(prev => ({ ...prev, serial_number: e.target.value }))}
                                                    style={{ width: '100%', padding: '8px 10px', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(245,158,11,0.2)', color: '#fff', borderRadius: 6, fontSize: 13 }}
                                                />
                                                <p style={{ margin: '6px 0 0', fontSize: 10, color: '#777' }}>警告：修改此项将影响设备服务记录与审计体系</p>
                                            </div>
                                            <div style={{ padding: '10px 12px', background: 'rgba(245,158,11,0.03)', border: '1px solid rgba(245,158,11,0.1)', borderRadius: 8 }}>
                                                <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#FFD200', marginBottom: 6 }}>
                                                    <Package size={12} /> 产品型号
                                                </label>
                                                <select
                                                    value={editForm.product_id as number || ''}
                                                    onChange={e => setEditForm(prev => ({ ...prev, product_id: e.target.value ? Number(e.target.value) : undefined }))}
                                                    style={{ width: '100%', padding: '8px 10px', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(245,158,11,0.2)', color: '#fff', borderRadius: 6, fontSize: 13 }}
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

                                {/* ---- 分组 2: 问题描述 ---- */}
                                <div>
                                    <div style={{ fontSize: 11, color: '#555', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 12, borderBottom: '1px solid rgba(255,255,255,0.03)', paddingBottom: 6 }}>问题描述</div>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                                        <div>
                                            <label style={{ display: 'block', fontSize: 12, color: '#888', marginBottom: 6 }}>问题简述</label>
                                            <input
                                                value={editForm.problem_summary as string || ''}
                                                onChange={e => setEditForm(prev => ({ ...prev, problem_summary: e.target.value }))}
                                                style={{ width: '100%', padding: '8px 12px', background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', borderRadius: 6, fontSize: 13 }}
                                            />
                                        </div>
                                        <div>
                                            <label style={{ display: 'block', fontSize: 12, color: '#888', marginBottom: 6 }}>详细描述</label>
                                            <textarea
                                                value={editForm.problem_description as string || ''}
                                                onChange={e => setEditForm(prev => ({ ...prev, problem_description: e.target.value }))}
                                                style={{ width: '100%', padding: '8px 12px', background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', borderRadius: 6, minHeight: 80, fontSize: 13, resize: 'vertical' }}
                                            />
                                        </div>
                                    </div>
                                </div>

                                {/* ---- 分组 3: 流程控制 (仅管理员可见) ---- */}
                                {(user?.role === 'Admin' || user?.role === 'Lead') && (ticket.ticket_type === 'rma' || ticket.ticket_type === 'svc') && (
                                    <div style={{ paddingBottom: 20 }}>
                                        <div style={{ fontSize: 11, color: '#EF4444', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 12, borderBottom: '1px solid rgba(239,68,68,0.2)', paddingBottom: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
                                            <AlertTriangle size={12} /> 流程控制 (管理员)
                                        </div>
                                        <div style={{ padding: '12px', background: 'rgba(239,68,68,0.05)', border: '1px solid rgba(239,68,68,0.15)', borderRadius: 8 }}>
                                            <label style={{ display: 'block', fontSize: 12, color: '#EF4444', marginBottom: 8, fontWeight: 500 }}>强制节点回退</label>
                                            <select
                                                value={editForm.current_node as string || ''}
                                                onChange={e => setEditForm(prev => ({ ...prev, current_node: e.target.value || undefined }))}
                                                style={{ width: '100%', padding: '8px 12px', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(239,68,68,0.3)', color: '#fff', borderRadius: 6, fontSize: 13, marginBottom: 10 }}
                                            >
                                                <option value="">保持当前节点: {nodeLabels[ticket.current_node]?.zh || ticket.current_node}</option>
                                                <option value="op_receiving">待收货 (OP)</option>
                                                <option value="op_diagnosing">诊断中 (OP)</option>
                                                <option value="op_repairing">维修中 (OP)</option>
                                                <option value="ms_review">商务审核 (MS)</option>
                                                <option value="ms_closing">最终结案 (MS)</option>
                                                <option value="op_shipping">打包发货 (OP)</option>
                                            </select>
                                            <p style={{ margin: 0, fontSize: 10, color: '#EF4444', opacity: 0.8 }}>
                                                警告：强制回退将触发自动分发规则，可能变更对接人。此操作将记录在活动日志中。
                                            </p>
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* STICKY FOOTER */}
                            <div style={{ padding: '16px 20px', borderTop: '1px solid rgba(255,255,255,0.1)', background: 'rgba(30,30,30,0.8)', backdropFilter: 'blur(10px)', display: 'flex', gap: 12 }}>
                                <button onClick={() => setIsEditing(false)} style={{ flex: 1, padding: '10px', background: 'transparent', border: '1px solid rgba(255,255,255,0.2)', color: '#fff', borderRadius: 8, cursor: 'pointer', fontSize: 14 }}>取消</button>
                                <button
                                    onClick={handlePreSave}
                                    style={{ flex: 1.5, padding: '10px', background: '#FFD200', border: 'none', color: '#000', borderRadius: 8, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, fontSize: 14 }}
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
                        background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(10px)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center'
                    }}>
                        <div style={{
                            width: 500, background: '#1c1c1e', borderRadius: 16,
                            border: '1px solid #FFD200', overflow: 'hidden',
                            boxShadow: '0 20px 40px rgba(255, 215, 0, 0.15)',
                            animation: 'modalIn 0.2s ease-out'
                        }}>
                            <div style={{ padding: 24, textAlign: 'center', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                                <div style={{ width: 48, height: 48, borderRadius: '50%', background: 'rgba(255,215,0,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
                                    <AlertTriangle size={24} color="#FFD200" />
                                </div>
                                <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: '#fff', marginBottom: 8 }}>核心数据变更声明</h3>
                                <p style={{ margin: 0, fontSize: 13, color: '#aaa', lineHeight: 1.5 }}>
                                    您正在修改受审计的数据字段。<br />此操作将永久记录在工单时间轴中，请仔细核对以下变更：
                                </p>
                            </div>
                            <div style={{ padding: 24, maxHeight: 300, overflowY: 'auto', background: 'rgba(0,0,0,0.2)' }}>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                                    {auditDiffs.map((diff, index) => (
                                        <div key={index} style={{
                                            display: 'grid', gridTemplateColumns: 'minmax(80px, max-content) 1fr', gap: 12,
                                            padding: 12, borderRadius: 8,
                                            background: diff.isRisk ? 'rgba(239,68,68,0.05)' : 'rgba(255,255,255,0.03)',
                                            border: diff.isRisk ? '1px solid rgba(239,68,68,0.2)' : '1px solid rgba(255,255,255,0.05)'
                                        }}>
                                            <div style={{ fontSize: 13, color: diff.isRisk ? '#EF4444' : '#888', fontWeight: diff.isRisk ? 600 : 400, display: 'flex', flexDirection: 'column' }}>
                                                {diff.label}
                                                {diff.isRisk && <span style={{ fontSize: 10, marginTop: 4, letterSpacing: 0.5 }}>高级别审计项</span>}
                                            </div>
                                            <div style={{ fontSize: 13, color: '#ddd', display: 'flex', alignItems: 'center', gap: 8 }}>
                                                <span style={{ textDecoration: 'line-through', color: '#666' }}>{diff.oldVal}</span>
                                                <span style={{ color: '#888' }}>➔</span>
                                                <span style={{ color: diff.isRisk ? '#FFD200' : '#10B981', fontWeight: 500 }}>{diff.newVal}</span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                            <div style={{ padding: 24, borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                                <label style={{ display: 'block', fontSize: 12, color: '#888', marginBottom: 8 }}>强制录入修正理由（必填）</label>
                                <textarea
                                    value={changeReason}
                                    onChange={e => setChangeReason(e.target.value)}
                                    placeholder="例如：前期录入错误看错型号、客户凭证证明在保..."
                                    style={{ width: '100%', padding: '12px', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', borderRadius: 8, minHeight: 80, fontSize: 13, resize: 'none' }}
                                />
                            </div>
                            <div style={{ display: 'flex', borderTop: '1px solid rgba(255,255,255,0.1)' }}>
                                <button
                                    onClick={() => setIsAuditModalOpen(false)}
                                    style={{ flex: 1, padding: 16, background: 'transparent', border: 'none', color: '#888', fontSize: 14, cursor: 'pointer' }}
                                >
                                    返回修改
                                </button>
                                <div style={{ width: 1, background: 'rgba(255,255,255,0.1)' }} />
                                <button
                                    onClick={handleSaveEdit}
                                    disabled={auditCountdown > 0 || !changeReason.trim() || isSaving}
                                    style={{
                                        flex: 1, padding: 16, background: 'transparent', border: 'none',
                                        color: (auditCountdown > 0 || !changeReason.trim()) ? '#666' : '#FFD200',
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
                            background: 'rgba(28,28,30,0.98)', backdropFilter: 'blur(20px)',
                            borderLeft: '1px solid rgba(255,255,255,0.1)',
                            boxShadow: '-10px 0 40px rgba(0,0,0,0.5)',
                            display: 'flex', flexDirection: 'column',
                            animation: 'drawerSlideIn 0.3s cubic-bezier(0.16, 1, 0.3, 1)'
                        }}>
                            <div style={{ padding: '16px 24px', borderBottom: '1px solid rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'rgba(0,0,0,0.2)' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                    <div style={{ width: 32, height: 32, borderRadius: 8, background: 'rgba(255,215,0,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                        <FileText size={16} color="#FFD200" />
                                    </div>
                                    <div>
                                        <h3 style={{ margin: 0, fontSize: 16, color: '#fff', fontWeight: 600 }}>问题与诊断全景</h3>
                                        <p style={{ margin: 0, fontSize: 11, color: '#888', marginTop: 2 }}>{ticket.ticket_number}</p>
                                    </div>
                                </div>
                                <button onClick={() => setIsDescriptionDrawerOpen(false)} style={{ background: 'transparent', border: 'none', color: '#888', cursor: 'pointer', padding: 4 }}>
                                    <X size={20} />
                                </button>
                            </div>
                            <div style={{ padding: 24, flex: 1, overflowY: 'auto' }}>
                                {ticket.problem_summary && (
                                    <div style={{ marginBottom: 24 }}>
                                        <h4 style={{ fontSize: 12, color: '#555', marginBottom: 10, borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: 6 }}>摘要</h4>
                                        <div style={{
                                            fontSize: 16,
                                            color: '#fff',
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
                                        <h4 style={{ fontSize: 12, color: '#555', marginBottom: 10, borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: 6 }}>详细描述</h4>
                                        <div style={{
                                            fontSize: 16,
                                            color: (ticket.problem_summary) ? 'rgba(255,255,255,0.7)' : '#fff',
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
                                        <h4 style={{ fontSize: 12, color: '#10B981', marginBottom: 10, borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: 6 }}>处理记录</h4>
                                        <div style={{ fontSize: 13, color: '#ddd', lineHeight: 1.6, whiteSpace: 'pre-wrap', background: 'rgba(16,185,129,0.05)', padding: 12, borderRadius: 8, border: '1px solid rgba(16,185,129,0.1)' }}>
                                            {ticket.resolution}
                                        </div>
                                    </div>
                                )}
                                {Number(ticket.attachments_count || 0) > 0 && (
                                    <div>
                                        <h4 style={{ fontSize: 12, color: '#555', marginBottom: 10, borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: 6 }}>附件文件</h4>
                                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 10 }}>
                                            {ticketAttachments.map(att => (
                                                <a
                                                    key={att.id}
                                                    href={att.file_url}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    style={{
                                                        padding: '10px 12px',
                                                        background: 'rgba(255,255,255,0.03)',
                                                        border: '1px solid rgba(255,255,255,0.08)',
                                                        borderRadius: 8,
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        gap: 10,
                                                        textDecoration: 'none',
                                                        transition: 'all 0.2s'
                                                    }}
                                                    onMouseEnter={e => {
                                                        e.currentTarget.style.background = 'rgba(255,255,255,0.08)';
                                                        e.currentTarget.style.borderColor = 'rgba(255,255,255,0.2)';
                                                    }}
                                                    onMouseLeave={e => {
                                                        e.currentTarget.style.background = 'rgba(255,255,255,0.03)';
                                                        e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)';
                                                    }}
                                                    onClick={(e) => {
                                                        if (att.file_type.startsWith('image/')) {
                                                            e.preventDefault();
                                                            setLightboxMedia({ url: att.file_url + '?inline=true' + (token ? `&token=${token}` : ''), type: att.file_type?.startsWith('video/') ? 'video' : 'image' });
                                                        }
                                                    }}
                                                >
                                                    <div style={{ width: 32, height: 32, borderRadius: 4, background: 'rgba(0,0,0,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                                        {att.thumbnail_url ? (
                                                            <img src={att.thumbnail_url + (token ? `?token=${token}` : '')} style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 4 }} alt="" />
                                                        ) : (
                                                            <Paperclip size={16} color="#888" />
                                                        )}
                                                    </div>
                                                    <div style={{ flex: 1, minWidth: 0 }}>
                                                        <div style={{ fontSize: 13, color: '#ddd', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{att.file_name}</div>
                                                        <div style={{ fontSize: 10, color: '#666' }}>{(att.file_size / 1024).toFixed(1)} KB</div>
                                                    </div>
                                                </a>
                                            ))}
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
                        background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(5px)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center'
                    }}>
                        <div style={{
                            width: 440, background: '#1c1c1e', borderRadius: 16,
                            border: '1px solid #EF4444', overflow: 'hidden',
                            boxShadow: '0 20px 40px rgba(239, 68, 68, 0.15)'
                        }}>
                            <div style={{ padding: 24, textAlign: 'center' }}>
                                <div style={{ width: 48, height: 48, borderRadius: '50%', background: 'rgba(239,68,68,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
                                    <Trash2 size={24} color="#EF4444" />
                                </div>
                                <h3 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: '#fff', marginBottom: 8 }}>危险操作：废弃工单</h3>
                                <p style={{ margin: 0, fontSize: 14, color: '#aaa', lineHeight: 1.5 }}>
                                    此操作将导致工单 <b>{ticket.ticket_number}</b> 被逻辑删除并打上墓碑标记，不再显示在任何普通列表内。<br />为确保安全，必须强制输入废弃理由，并等待 {deleteCountdown > 0 ? <span style={{ color: '#EF4444', fontWeight: 600 }}>{deleteCountdown}秒</span> : '解锁'}。
                                </p>
                            </div>
                            <div style={{ padding: '0 24px 24px' }}>
                                <textarea
                                    value={deleteReason}
                                    onChange={e => setDeleteReason(e.target.value)}
                                    placeholder="输入废弃理由（必填，至少 5 个字符）..."
                                    style={{ width: '100%', padding: '12px', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', borderRadius: 8, minHeight: 80, fontSize: 14 }}
                                />
                            </div>
                            <div style={{ display: 'flex', borderTop: '1px solid rgba(255,255,255,0.1)' }}>
                                <button
                                    onClick={() => { setIsDeleteModalOpen(false); setDeleteReason(''); }}
                                    style={{ flex: 1, padding: 16, background: 'transparent', border: 'none', color: '#fff', fontSize: 15, cursor: 'pointer' }}
                                >取消操作</button>
                                <div style={{ width: 1, background: 'rgba(255,255,255,0.1)' }} />
                                <button
                                    onClick={handleDelete}
                                    disabled={deleteCountdown > 0 || deleteReason.trim().length < 5 || isDeleting}
                                    style={{
                                        flex: 1, padding: 16, background: 'transparent', border: 'none',
                                        color: (deleteCountdown > 0 || deleteReason.trim().length < 5) ? '#666' : '#EF4444',
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
                        background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(5px)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center'
                    }}>
                        <div style={{
                            width: 440, background: '#1c1c1e', borderRadius: 16,
                            border: '1px solid #10B981', overflow: 'hidden',
                            boxShadow: '0 20px 40px rgba(16, 185, 129, 0.15)'
                        }}>
                            <div style={{ padding: 24, textAlign: 'center' }}>
                                <div style={{ width: 48, height: 48, borderRadius: '50%', background: 'rgba(16,185,129,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
                                    <ExternalLink size={24} color="#10B981" />
                                </div>
                                <h3 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: '#fff', marginBottom: 8 }}>恢复工单</h3>
                                <p style={{ margin: 0, fontSize: 14, color: '#aaa', lineHeight: 1.5 }}>
                                    将工单 <b>{ticket.ticket_number}</b> 从回收站移回活跃列表。
                                </p>
                            </div>
                            <div style={{ padding: '0 24px 24px' }}>
                                <textarea
                                    value={restoreReason}
                                    onChange={e => setRestoreReason(e.target.value)}
                                    placeholder="输入恢复理由（必填）..."
                                    style={{ width: '100%', padding: '12px', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', borderRadius: 8, minHeight: 80, fontSize: 14 }}
                                />
                            </div>
                            <div style={{ display: 'flex', borderTop: '1px solid rgba(255,255,255,0.1)' }}>
                                <button
                                    onClick={() => { setIsRestoreModalOpen(false); setRestoreReason(''); }}
                                    style={{ flex: 1, padding: 16, background: 'transparent', border: 'none', color: '#fff', fontSize: 15, cursor: 'pointer' }}
                                >取消</button>
                                <div style={{ width: 1, background: 'rgba(255,255,255,0.1)' }} />
                                <button
                                    onClick={handleRestore}
                                    disabled={!restoreReason.trim() || isRestoring}
                                    style={{
                                        flex: 1, padding: 16, background: 'transparent', border: 'none',
                                        color: !restoreReason.trim() ? '#666' : '#10B981',
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
            <SubmitDiagnosticModal
                isOpen={isDiagnosticModalOpen}
                onClose={() => setIsDiagnosticModalOpen(false)}
                ticketId={ticketId}
                ticketNumber={ticket.ticket_number || ''}
                onSuccess={() => {
                    setIsDiagnosticModalOpen(false);
                    fetchDetail();
                }}
            />
            <MSReviewPanel
                isOpen={isMSReviewPanelOpen}
                onClose={() => setIsMSReviewPanelOpen(false)}
                ticketId={ticketId}
                ticketNumber={ticket.ticket_number || ''}
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
                    onClose={() => setIsOpRepairReportEditorOpen(false)}
                    ticketId={ticketId}
                    ticketNumber={ticket?.ticket_number || ''}
                    onSuccess={() => {
                        fetchDetail();
                    }}
                    warrantyCalc={warrantyCalc}
                    currentNode={ticket?.current_node}
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
                onClose={() => setIsActionBufferModalOpen(false)}
                ticket={ticket}
                nextNode={actionBufferTarget.nextNode}
                actionLabel={actionBufferTarget.label}
                onSuccess={() => {
                    fetchDetail();
                }}
            />
            <MediaLightbox url={lightboxMedia?.url || null} type={lightboxMedia?.type || null} onClose={() => setLightboxMedia(null)} />
            <ActivityDetailDrawer activity={selectedActivity} onClose={() => setSelectedActivity(null)} />

            {showCalculationModal && warrantyCalc && (
                <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(10px)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <div style={{ background: '#1c1c1e', borderRadius: 16, border: '1px solid rgba(255,255,255,0.1)', width: 500, overflow: 'hidden', boxShadow: '0 30px 60px rgba(0,0,0,0.6)' }}>
                        {/* Header */}
                        <div style={{ padding: '20px 24px', borderBottom: '1px solid rgba(255,255,255,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'rgba(255,255,255,0.02)' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                                <div style={{ width: 40, height: 40, borderRadius: 10, background: 'rgba(255, 210, 0, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                    <Calculator size={20} color="#FFD200" />
                                </div>
                                <div>
                                    <h3 style={{ margin: 0, fontSize: 18, fontWeight: 600, color: '#fff' }}>产品保修计算引擎</h3>
                                    <p style={{ margin: 0, fontSize: 12, color: '#888', marginTop: 4 }}>序列号：{ticket?.serial_number || '-'}</p>
                                </div>
                            </div>
                            <button onClick={() => setShowCalculationModal(false)} style={{ background: 'none', border: 'none', color: '#888', cursor: 'pointer' }}>
                                <X size={24} />
                            </button>
                        </div>

                        {/* Body */}
                        <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 20 }}>
                            {/* Rules Section */}
                            <div style={{ padding: '0 4px' }}>
                                <h4 style={{ margin: '0 0 12px 0', fontSize: 14, color: '#aaa', fontWeight: 600 }}>保修计算说明</h4>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 10, fontSize: 13, color: '#888' }}>
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
                                                background: isActive ? 'rgba(255, 210, 0, 0.1)' : 'transparent',
                                                borderRadius: 8,
                                                border: isActive ? '1px solid rgba(255, 210, 0, 0.3)' : '1px solid transparent'
                                            }}>
                                                <span style={{ color: '#FFD200', fontWeight: 700, whiteSpace: 'nowrap' }}>{rule.p}.</span>
                                                <div>
                                                    <span style={{ color: isActive ? '#FFD200' : '#ccc', fontWeight: 600, marginRight: 4 }}>
                                                        优先级 {rule.p} ({rule.label}):
                                                        {isActive && <span style={{ marginLeft: 8, fontSize: '0.75rem', padding: '2px 6px', background: '#FFD200', color: '#000', borderRadius: 4 }}>当前采用</span>}
                                                    </span>
                                                    <div style={{ marginTop: 2 }}>{rule.detail}</div>
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
                                                    'registration': '官网注册日期',
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
                    onRegistered={() => {
                        setIsWarrantyRegistrationOpen(false);
                        fetchDetail(); // Refresh to get updated warranty info
                        refreshWarrantyCalc(); // Also refresh warranty calculation immediately
                    }}
                />
            )}

        </div >
    );
};

// ==============================
// Sub-Components
// ==============================

export default UnifiedTicketDetail;
