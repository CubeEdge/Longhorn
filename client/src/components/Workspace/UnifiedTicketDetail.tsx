/**
 * UnifiedTicketDetail (统一工单详情视图)
 * PRD P2 Section 6.3.C - Detail View
 * 左主右辅双栏布局，macOS26 风格
 *
 * 左栏 (70%): 基本信息(可折叠) → 节点进度条(RMA/SVC) → Activity 时间轴(可折叠) → 评论框
 * 右栏 (30%): 协作者 → 客户上下文
 */

import React, { useState, useEffect, useCallback } from 'react';
import { Calendar, User, Package, Tag, MessageSquare, Building, Clock, ExternalLink, Store, AlertTriangle, ArrowLeft, Edit2, MoreVertical, Trash2, X, Save, FileText, Paperclip, ShieldAlert, Loader2, ArrowRight } from 'lucide-react';
import axios from 'axios';
import { useAuthStore } from '../../store/useAuthStore';
import { useLanguage } from '../../i18n/useLanguage';
import NodeProgressBar from './NodeProgressBar';
import { ActivityTimeline, CollapsiblePanel, MediaLightbox, ActivityDetailDrawer } from './TicketDetailComponents';
import { MentionCommentInput } from './MentionCommentInput';
import { ActionBufferModal } from './ActionBufferModal';
import { SubmitDiagnosticModal } from './SubmitDiagnosticModal';
import CustomerContextSidebar from '../Service/CustomerContextSidebar';
import { ParticipantsSidebar } from './ParticipantsSidebar';
import { AssigneeSelector } from './AssigneeSelector';
import { useViewAs } from './ViewAsComponents';
import { useUIStore } from '../../store/useUIStore';

// ==============================
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

const priorityColors: Record<string, string> = {
    P0: '#EF4444', P1: '#FFD700', P2: '#3B82F6',
};

const statusLabels: Record<string, { zh: string; en: string; color: string }> = {
    draft: { zh: '草稿', en: 'Draft', color: '#666' },
    in_progress: { zh: '处理中', en: 'In Progress', color: '#3B82F6' },
    waiting: { zh: '等待中', en: 'Waiting', color: '#F59E0B' },
    resolved: { zh: '已解决', en: 'Resolved', color: '#10B981' },
    closed: { zh: '已关闭', en: 'Closed', color: '#666' },
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
    const [isActionBufferModalOpen, setIsActionBufferModalOpen] = useState(false);
    const [actionBufferTarget, setActionBufferTarget] = useState({ nextNode: '', label: '' });

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
        op_receiving: 'OP', op_diagnosing: 'OP', op_repairing: 'OP', op_shipping: 'OP',
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
    // 2. 部门主管在工单处于本部门节点时，可指派或“改派”（即使已有负责人）
    // 3. 部门成员在工单处于本部门节点且未指派时，可认领/指派
    // 4. 当前指派人可转派
    const canAssign = isGlobalAdmin ||
        (isDeptLead && !!nodeOwnerDept) ||
        (isDeptMember && !ticket?.assigned_to) ||
        (ticket?.assigned_to === actingUser.id);

    const [products, setProducts] = useState<any[]>([]);
    const [isAuditModalOpen, setIsAuditModalOpen] = useState(false);
    const [auditDiffs, setAuditDiffs] = useState<any[]>([]);
    const [auditCountdown, setAuditCountdown] = useState(0);
    const [isDescriptionDrawerOpen, setIsDescriptionDrawerOpen] = useState(false);

    // Fetch products when editing starts
    useEffect(() => {
        if (isEditing && products.length === 0) {
            axios.get('/api/v1/system/products', { headers: { Authorization: `Bearer ${token}` } })
                .then(res => { if (res.data.success) setProducts(res.data.data); })
                .catch(err => console.error(err));
        }
    }, [isEditing, token, products.length]);

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

    // 编辑按钮渲染 helper
    const renderEditButton = () => {
        if (!ticket) return null;
        return (
            <button
                className="btn-glass"
                onClick={() => {
                    setEditForm({
                        priority: ticket.priority,
                        status: ticket.status,
                        problem_summary: ticket.problem_summary,
                        problem_description: ticket.problem_description,
                        resolution: ticket.resolution,
                        serial_number: ticket.serial_number,
                        repair_content: ticket.repair_content,
                        payment_amount: ticket.payment_amount,
                        is_warranty: ticket.is_warranty,
                        product_id: ticket.product_id as number
                    });
                    setIsEditing(true);
                }}
                style={{ padding: '6px 12px', display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}
            >
                <Edit2 size={14} /> 编辑
            </button>
        );
    };

    // 删除菜单渲染 helper
    const renderDeleteMenu = () => (
        <>
            <button
                className="btn-glass"
                onClick={() => setShowMoreMenu(!showMoreMenu)}
                style={{ padding: '6px', display: 'flex', alignItems: 'center' }}
            >
                <MoreVertical size={16} />
            </button>
            {showMoreMenu && (
                <div style={{
                    position: 'absolute', top: '100%', right: 0, marginTop: 4,
                    background: 'rgba(30,30,30,0.95)', backdropFilter: 'blur(10px)',
                    border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8,
                    padding: 4, minWidth: 160, zIndex: 100,
                    boxShadow: '0 4px 20px rgba(0,0,0,0.5)'
                }}>
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
            const res = await axios.get(`/api/v1/tickets/${ticketId}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            if (res.data.success) {
                setTicket(res.data.data);
                setActivities(res.data.activities || []);
                setParticipants(res.data.participants || []);
                setTicketAttachments(res.data.attachments || []);
            }
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
                color = '#FFD700';
                pulsing = true;
                break;
            case 'team_queue':
                text = `工作空间 › ${ticket.department_code || '部门'} - ${ticket.current_node || '任务'}`;
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
    const handleAction = async (actionLabel: string) => {
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
            if (ticket.current_node === 'ms_closing' && Number(ticket.is_warranty) === 0 && (!ticket.payment_amount || Number(ticket.payment_amount) === 0)) {
                nextNode = 'ge_review';
            }
            if (ticket.current_node === 'ge_review') {
                nextNode = 'ms_closing';
            }
        } else if (type === 'inquiry') {
            if (ticket.current_node === 'open') nextNode = 'waiting';
            else if (ticket.current_node === 'waiting') nextNode = 'open';
        }

        // Check if we need to open Buffer Modal instead of direct patch
        const mandatoryNodes = ['op_receiving', 'submitted', 'op_repairing', 'op_shipping', 'ms_review', 'ms_closing', 'ge_review'];
        if (mandatoryNodes.includes(ticket.current_node)) {
            // For ms_review and ms_closing, only mandatory if NOT warranty
            if (['ms_review'].includes(ticket.current_node) && ticket.is_warranty) {
                // Keep direct patch for warranty
            } else if (ticket.current_node === 'ms_closing' && ticket.is_warranty) {
                // For ms_closing, warranty means we still want a confirmation to push to OP Shipping cleanly
                setActionBufferTarget({ nextNode, label: actionLabel });
                setIsActionBufferModalOpen(true);
                return;
            } else {
                setActionBufferTarget({ nextNode, label: actionLabel });
                setIsActionBufferModalOpen(true);
                return;
            }
        }

        try {
            setLoading(true);
            await axios.patch(`/api/v1/tickets/${ticketId}`, {
                current_node: nextNode,
                change_reason: `执行主流程动作: ${actionLabel}`
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
                    border: '1px solid rgba(255,255,255,0.15)', background: 'transparent',
                    color: '#fff', cursor: 'pointer'
                }}>
                    {t('action.back') || '返回'}
                </button>
            </div>
        );
    }

    const statusInfo = statusLabels[ticket.status] || { zh: ticket.status, en: ticket.status, color: '#666' };
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
                borderBottom: '1px solid rgba(255,255,255,0.06)',
            }}>
                <button
                    onClick={onBack}
                    style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        width: 36, height: 36,
                        borderRadius: '50%',
                        border: '1px solid rgba(255,255,255,0.12)',
                        background: 'rgba(255,255,255,0.04)',
                        color: '#fff',
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
                    fontSize: 18,
                    fontWeight: 700,
                    color: (viewContext === 'archive' || viewContext === 'search') ? '#aaa' : '#fff'
                }}>
                    {ticket.ticket_number}
                </span>

                {/* Status badge */}
                <span style={{
                    padding: '3px 10px', borderRadius: 6, fontSize: 12, fontWeight: 600,
                    background: ticket.is_deleted ? 'rgba(239,68,68,0.2)' : `${statusInfo.color}20`,
                    color: ticket.is_deleted ? '#EF4444' : statusInfo.color,
                }}>
                    {ticket.is_deleted ? '已删除/回收站' : (lang === 'zh' ? statusInfo.zh : statusInfo.en)}
                </span>

                {/* Priority badge */}
                <span style={{
                    padding: '3px 8px', borderRadius: 4, fontSize: 11, fontWeight: 700,
                    background: `${priorityColors[ticket.priority] || '#3B82F6'}20`,
                    color: priorityColors[ticket.priority] || '#3B82F6',
                }}>
                    {ticket.priority}
                </span>

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
                        background: 'rgba(245,158,11,0.15)', color: '#F59E0B',
                    }}>
                        <AlertTriangle size={13} /> SLA Warning
                    </span>
                )}

                <div style={{ flex: 1 }} />

                {/* Edit & More Actions — PRD §7.1 阶梯式权限守卫 */}
                {!ticket.is_deleted ? (
                    <>
                        {/* 编辑按钮可见性守卫 */}
                        {(() => {
                            const isFinalized = ['resolved', 'closed', 'auto_closed', 'converted', 'cancelled'].includes(ticket.current_node);
                            // 特权用户(MS Lead/Admin)：始终可编辑
                            if (hasPrivilege) {
                                return renderEditButton();
                            }
                            // 终结期：非特权用户不可编辑
                            if (isFinalized) return null;
                            // 活跃期：仅工单相关人员可编辑（负责人/创建者/提交者/参与者）
                            const isRelated = ticket.assigned_to === actingUser.id
                                || (ticket as any).created_by === actingUser.id
                                || (ticket as any).submitted_by === actingUser.id
                                || (ticket.participants as any[])?.some?.((p: any) => (p.user_id || p.id || p) === actingUser.id);
                            if (!isRelated) return null;
                            return renderEditButton();
                        })()}

                        {/* 删除按钮可见性守卫 */}
                        <div style={{ position: 'relative' }}>
                            {(() => {
                                // 特权用户(MS Lead/Admin)：始终可删除
                                if (hasPrivilege) return renderDeleteMenu();
                                // 非特权：仅 draft/submitted 且是创建者/提交者
                                if (!['draft', 'submitted'].includes(ticket.current_node)) return null;
                                const isOwner = (ticket as any).created_by === actingUser.id
                                    || (ticket as any).submitted_by === actingUser.id;
                                if (!isOwner) return null;
                                return renderDeleteMenu();
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
                <div style={{ flex: '1 1 70%', minWidth: 0 }}>

                    {/* Basic Info Card - Collapsible */}
                    <CollapsiblePanel
                        title={t('ticket.basic_info') || '基本信息'}
                        icon={<Tag size={14} color="#FFD700" />}
                        defaultOpen={true}
                    >
                        <div style={{ padding: '12px 20px 16px' }}>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                                <InfoRow icon={Calendar} label={t('ticket.created_at') || '创建时间'}
                                    value={formatDateMinute(ticket.created_at)} />
                                <InfoRow icon={User} label={t('ticket.assignee') || '指派给'}
                                    value={canAssign ? (
                                        <AssigneeSelector
                                            ticketId={ticket.id}
                                            currentAssigneeId={ticket.assigned_to as number | null}
                                            currentAssigneeName={ticket.assigned_name}
                                            currentAssigneeDept={ticket.assigned_dept}
                                            currentNode={ticket.current_node}
                                            ticketType={ticket.ticket_type}
                                            onUpdate={fetchDetail}
                                        />
                                    ) : (
                                        ticket.assigned_name ? (
                                            <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                                {ticket.assigned_dept && <span style={{ color: '#888', fontSize: 11 }}>[{ticket.assigned_dept}]</span>}
                                                {ticket.assigned_name}
                                            </span>
                                        ) : '-'
                                    )} />
                                <InfoRow icon={Package} label={t('ticket.product') || '产品型号'}
                                    value={ticket.product_name || '-'} />
                                <InfoRow icon={Tag} label={t('ticket.serial') || '序列号'}
                                    value={ticket.serial_number || '-'} />
                                <InfoRow icon={Building} label={t('ticket.customer') || '客户'}
                                    value={ticket.account_name || '-- (待确认)'} />
                                <InfoRow icon={User} label={t('ticket.reporter') || '报告人'}
                                    value={ticket.contact_name ? ticket.contact_name : (ticket.reporter_snapshot?.name || ticket.reporter_name ? `${ticket.reporter_snapshot?.name || ticket.reporter_name}` : '-')} />
                                <InfoRow icon={MessageSquare} label={t('ticket.submitted_by') || '提交者'}
                                    value={ticket.submitted_name ? (
                                        <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                            {ticket.submitted_dept && <span style={{ color: '#888', fontSize: 11 }}>[{ticket.submitted_dept}]</span>}
                                            {ticket.submitted_name}
                                        </span>
                                    ) : '-'} />
                                {ticket.dealer_name && (
                                    <InfoRow icon={Store} label={t('ticket.dealer') || '经销商'}
                                        value={`${ticket.dealer_name}${ticket.dealer_code ? ` (${ticket.dealer_code})` : ''}`} />
                                )}
                                {ticket.parent_ticket_number && (
                                    <InfoRow icon={ExternalLink} label={t('ticket.parent') || '关联工单'}
                                        value={ticket.parent_ticket_number} />
                                )}
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
                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                                        <div style={{ fontSize: 11, color: '#888', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}>
                                            <FileText size={12} />
                                            问题概要
                                            {((ticket.problem_description?.length || 0) > 80 || (ticket.problem_summary?.length || 0) > 80) && (
                                                <span style={{ color: '#FFD700', marginLeft: 4 }}>· 已折叠部分</span>
                                            )}
                                        </div>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 4, color: '#888', fontSize: 11 }}>
                                            <span>更多详情和附件</span>
                                            <ExternalLink size={13} />
                                        </div>
                                    </div>
                                    <div style={{
                                        fontSize: 13, color: '#ddd', lineHeight: 1.6,
                                        display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden'
                                    }}>
                                        {ticket.problem_summary || ticket.problem_description}
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
                                    <div style={{ fontSize: 13, color: '#ddd', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>
                                        {ticket.resolution}
                                    </div>
                                </div>
                            )}
                        </div>
                    </CollapsiblePanel>

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
                        icon={<Clock size={14} color="#FFD700" />}
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
                        overflow: 'hidden',
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
                                        {ticket.current_node} · 负责人: {ticket.assigned_name || '未指派'}
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
                                        background: isAssignedToActingUser ? '#FFD700' : 'rgba(255,215,0,0.15)',
                                        color: isAssignedToActingUser ? '#000' : '#FFD700',
                                        border: isAssignedToActingUser ? 'none' : '1px solid rgba(255,215,0,0.4)',
                                        fontSize: 14,
                                        fontWeight: 700,
                                        cursor: 'pointer',
                                        transition: 'all 0.2s',
                                        boxShadow: isAssignedToActingUser ? '0 4px 15px rgba(255,215,0,0.25)' : 'none'
                                    }}
                                    onMouseEnter={e => {
                                        e.currentTarget.style.transform = 'translateY(-2px)';
                                        if (isAssignedToActingUser) e.currentTarget.style.background = '#ffdf33';
                                    }}
                                    onMouseLeave={e => {
                                        e.currentTarget.style.transform = 'none';
                                        if (isAssignedToActingUser) e.currentTarget.style.background = '#FFD700';
                                    }}
                                >
                                    {loading ? <Loader2 className="animate-spin" size={18} /> : <ArrowRight size={18} />}
                                    {footerAction ? (lang === 'zh' ? footerAction.label_zh : footerAction.label_en) : '未知操作'}
                                    {isAssignedToActingUser ? '' : ' (强制)'}
                                </button>
                            </div>
                        </div>
                    )}
                </div>

                {/* ====== RIGHT COLUMN (Context) ====== */}
                <div style={{ flex: '0 0 300px', minWidth: 280, position: 'sticky', top: 16 }}>
                    <ParticipantsSidebar
                        ticketId={ticketId}
                        participants={participants}
                        onUpdate={fetchDetail}
                    />

                    {/* CustomerContextSidebar — 与「所有工单」详情页完全一致 */}
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
                    />
                </div>
            </div>


            {
                isEditing && (
                    <div style={{
                        position: 'fixed', top: 0, right: 0, bottom: 0, width: 400,
                        background: 'rgba(20,20,20,0.95)', backdropFilter: 'blur(20px)',
                        borderLeft: '1px solid rgba(255,255,255,0.1)',
                        zIndex: 200, display: 'flex', flexDirection: 'column',
                        boxShadow: '-10px 0 30px rgba(0,0,0,0.5)'
                    }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', borderBottom: '1px solid rgba(255,255,255,0.1)', background: 'rgba(0,0,0,0.2)' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                <ShieldAlert size={18} color="#FFD700" />
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

                            {/* ---- 分组 1: 时效与状态 ---- */}
                            <div>
                                <div style={{ fontSize: 11, color: '#555', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 12, borderBottom: '1px solid rgba(255,255,255,0.03)', paddingBottom: 6 }}>时效与状态</div>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                                    <div>
                                        <label style={{ display: 'block', fontSize: 12, color: '#888', marginBottom: 6 }}>优先级</label>
                                        <select
                                            value={editForm.priority as string || ''}
                                            onChange={e => setEditForm(prev => ({ ...prev, priority: e.target.value }))}
                                            style={{ width: '100%', padding: '8px 12px', background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', borderRadius: 6, fontSize: 13 }}
                                        >
                                            <option value="P0">P0</option><option value="P1">P1</option><option value="P2">P2</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label style={{ display: 'block', fontSize: 12, color: '#888', marginBottom: 6 }}>状态</label>
                                        <select
                                            value={editForm.status as string || ''}
                                            onChange={e => setEditForm(prev => ({ ...prev, status: e.target.value }))}
                                            style={{ width: '100%', padding: '8px 12px', background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', borderRadius: 6, fontSize: 13 }}
                                        >
                                            {Object.keys(statusLabels).map(k => <option key={k} value={k}>{statusLabels[k].zh}</option>)}
                                        </select>
                                    </div>
                                </div>
                            </div>

                            {/* ---- 分组 2: 内容与诊断 ---- */}
                            <div>
                                <div style={{ fontSize: 11, color: '#555', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 12, borderBottom: '1px solid rgba(255,255,255,0.03)', paddingBottom: 6 }}>内容与诊断</div>
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

                            {/* ---- 分组 3: 设备标识 (RMA/SVC 特有) ---- */}
                            {(ticket.ticket_type === 'rma' || ticket.ticket_type === 'svc') && (
                                <div>
                                    <div style={{ fontSize: 11, color: '#555', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 12, borderBottom: '1px solid rgba(255,255,255,0.03)', paddingBottom: 6 }}>核心资产标识</div>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                                        <div style={{ padding: '10px 12px', background: 'rgba(245,158,11,0.03)', border: '1px solid rgba(245,158,11,0.1)', borderRadius: 8 }}>
                                            <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#F59E0B', marginBottom: 6 }}>
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
                                            <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#F59E0B', marginBottom: 6 }}>
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

                            {/* ---- 分组 4: 核心判定 (RMA/SVC 特有) ---- */}
                            {(ticket.ticket_type === 'rma' || ticket.ticket_type === 'svc') && (
                                <div style={{ paddingBottom: 20 }}>
                                    <div style={{ fontSize: 11, color: '#555', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 12, borderBottom: '1px solid rgba(255,255,255,0.03)', paddingBottom: 6 }}>服务判定</div>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                                            <div>
                                                <label style={{ display: 'block', fontSize: 12, color: '#888', marginBottom: 6 }}>保修判定</label>
                                                <select
                                                    value={editForm.is_warranty !== undefined ? String(editForm.is_warranty) : (ticket.is_warranty !== undefined ? String(ticket.is_warranty) : '')}
                                                    onChange={e => setEditForm(prev => ({ ...prev, is_warranty: e.target.value === 'true' ? true : e.target.value === 'false' ? false : undefined }))}
                                                    style={{ width: '100%', padding: '8px 12px', background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', borderRadius: 6, fontSize: 13 }}
                                                >
                                                    <option value="">未判定</option>
                                                    <option value="true">在保</option>
                                                    <option value="false">过保</option>
                                                </select>
                                            </div>
                                            <div>
                                                <label style={{ display: 'block', fontSize: 12, color: '#888', marginBottom: 6 }}>金额 (¥)</label>
                                                <input
                                                    type="number"
                                                    value={editForm.payment_amount as number || ''}
                                                    onChange={e => setEditForm(prev => ({ ...prev, payment_amount: e.target.value ? Number(e.target.value) : undefined }))}
                                                    placeholder="0.00"
                                                    style={{ width: '100%', padding: '8px 12px', background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', borderRadius: 6, fontSize: 13 }}
                                                />
                                            </div>
                                        </div>
                                        <div>
                                            <label style={{ display: 'block', fontSize: 12, color: '#888', marginBottom: 6 }}>维修内容</label>
                                            <textarea
                                                value={editForm.repair_content as string || ''}
                                                onChange={e => setEditForm(prev => ({ ...prev, repair_content: e.target.value }))}
                                                placeholder="更换零件、固件升级、压力测试等细节..."
                                                style={{ width: '100%', padding: '8px 12px', background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', borderRadius: 6, minHeight: 80, fontSize: 13, resize: 'vertical' }}
                                            />
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* STICKY FOOTER */}
                        <div style={{ padding: '16px 20px', borderTop: '1px solid rgba(255,255,255,0.1)', background: 'rgba(30,30,30,0.8)', backdropFilter: 'blur(10px)', display: 'flex', gap: 12 }}>
                            <button onClick={() => setIsEditing(false)} style={{ flex: 1, padding: '10px', background: 'transparent', border: '1px solid rgba(255,255,255,0.2)', color: '#fff', borderRadius: 8, cursor: 'pointer', fontSize: 14 }}>取消</button>
                            <button
                                onClick={handlePreSave}
                                style={{ flex: 1.5, padding: '10px', background: '#FFD700', border: 'none', color: '#000', borderRadius: 8, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, fontSize: 14 }}
                            >
                                <Save size={16} /> 保存变更
                            </button>
                        </div>
                    </div>
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
                            border: '1px solid #FFD700', overflow: 'hidden',
                            boxShadow: '0 20px 40px rgba(255, 215, 0, 0.15)',
                            animation: 'modalIn 0.2s ease-out'
                        }}>
                            <div style={{ padding: 24, textAlign: 'center', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                                <div style={{ width: 48, height: 48, borderRadius: '50%', background: 'rgba(255,215,0,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
                                    <AlertTriangle size={24} color="#FFD700" />
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
                                                <span style={{ color: diff.isRisk ? '#FFD700' : '#10B981', fontWeight: 500 }}>{diff.newVal}</span>
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
                                        color: (auditCountdown > 0 || !changeReason.trim()) ? '#666' : '#FFD700',
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
                    <div style={{
                        position: 'fixed', top: 0, right: 0, bottom: 0, width: 400, zIndex: 300,
                        background: 'rgba(28,28,30,0.98)', backdropFilter: 'blur(20px)',
                        borderLeft: '1px solid rgba(255,255,255,0.1)',
                        boxShadow: '-10px 0 40px rgba(0,0,0,0.5)',
                        display: 'flex', flexDirection: 'column',
                        animation: 'drawerSlideIn 0.3s cubic-bezier(0.16, 1, 0.3, 1)'
                    }}>
                        <div style={{ padding: '16px 24px', borderBottom: '1px solid rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'rgba(0,0,0,0.2)' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                <div style={{ width: 32, height: 32, borderRadius: 8, background: 'rgba(255,215,0,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                    <FileText size={16} color="#FFD700" />
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
                                    <div style={{ fontSize: 14, color: '#fff', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>
                                        {ticket.problem_summary}
                                    </div>
                                </div>
                            )}
                            {ticket.problem_description && (
                                <div style={{ marginBottom: 24 }}>
                                    <h4 style={{ fontSize: 12, color: '#555', marginBottom: 10, borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: 6 }}>详细描述</h4>
                                    <div style={{ fontSize: 14, color: '#ccc', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>
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
        </div >
    );
};

// ==============================
// Sub-Components
// ==============================

const InfoRow: React.FC<{ icon: any; label: string; value: React.ReactNode }> = ({ icon: Icon, label, value }) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <Icon size={13} color="#666" />
        <span style={{ fontSize: 12, color: '#888', minWidth: 50 }}>{label}:</span>
        <span style={{ fontSize: 13, color: '#ccc', fontWeight: 500, display: 'flex', alignItems: 'center', gap: 4 }}>{value}</span>
    </div>
);

export default UnifiedTicketDetail;
