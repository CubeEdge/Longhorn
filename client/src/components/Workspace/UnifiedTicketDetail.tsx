/**
 * UnifiedTicketDetail (统一工单详情视图)
 * PRD P2 Section 6.3.C - Detail View
 * 左主右辅双栏布局，macOS26 风格
 *
 * 左栏 (70%): 基本信息(可折叠) → 节点进度条(RMA/SVC) → Activity 时间轴(可折叠) → 评论框
 * 右栏 (30%): 协作者 → 客户上下文
 */

import React, { useState, useEffect, useCallback } from 'react';
import { Calendar, User, Package, Tag, MessageSquare, Building, Clock, ExternalLink, Store, AlertTriangle, ArrowLeft, Edit2, MoreVertical, Trash2, X, Save } from 'lucide-react';
import axios from 'axios';
import { useAuthStore } from '../../store/useAuthStore';
import { useLanguage } from '../../i18n/useLanguage';
import NodeProgressBar from './NodeProgressBar';
import { ActivityTimeline, CollapsiblePanel } from './TicketDetailComponents';
import { MentionCommentInput } from './MentionCommentInput';
import CustomerContextSidebar from '../Service/CustomerContextSidebar';
import { ParticipantsSidebar } from './ParticipantsSidebar';
import { useViewAs } from './ViewAsComponents';

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
    submitted_name?: string;
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


interface Props {
    ticketId: number;
    onBack: () => void;
}

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

const UnifiedTicketDetail: React.FC<Props> = ({ ticketId, onBack }) => {
    const { token, user } = useAuthStore();
    const { t, language } = useLanguage();
    const lang = language === 'zh' || language === 'ja' ? 'zh' : 'en';

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
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

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

    // PRD §7.1: 权限判断基于 acting user
    const actingDeptNorm = (actingUser.department_code || '').toUpperCase();
    const isMsLead = (actingDeptNorm === 'MS' || actingDeptNorm === '市场部') && actingUser.role === 'Lead';
    const isGlobalAdmin = actingUser.role === 'Admin' || actingUser.role === 'Exec';
    const hasPrivilege = isGlobalAdmin || isMsLead;

    const AUDIT_WHITELIST = [
        'serial_number', 'product_id', 'account_id', 'contact_id',
        'dealer_id', 'problem_summary', 'problem_description',
        'repair_content', 'is_warranty', 'payment_amount',
        'priority', 'sla_due_at', 'status'
    ];

    const hasCoreFieldChanges = () => {
        if (!ticket) return false;
        return AUDIT_WHITELIST.some(field =>
            editForm[field] !== undefined && editForm[field] !== ticket[field]
        );
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
                        is_warranty: ticket.is_warranty
                    });
                    setChangeReason('');
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
            }
        } catch (err: any) {
            setError(err.response?.data?.error || err.message);
        } finally {
            setLoading(false);
        }
    }, [ticketId, token]);

    useEffect(() => { fetchDetail(); }, [fetchDetail]);

    const handleAddComment = async (content: string, visibility: string, mentions: number[] = []) => {
        try {
            await axios.post(`/api/v1/tickets/${ticketId}/activities`, {
                activity_type: 'comment',
                content,
                visibility,
                mentions
            }, { headers: { Authorization: `Bearer ${token}` } });
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
                setParticipants(detailRes.data.participants || []);
            }
        } catch (err) {
            console.error('[UnifiedDetail] Failed to add comment', err);
        }
    };

    const handleSaveEdit = async () => {
        if (hasCoreFieldChanges() && !changeReason.trim()) return;
        setIsSaving(true);
        try {
            await axios.patch(`/api/v1/tickets/${ticketId}`, {
                ...editForm,
                change_reason: changeReason.trim() ? changeReason.trim() : undefined
            }, { headers: { Authorization: `Bearer ${token}` } });
            setIsEditing(false);
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

    return (
        <div style={{ padding: 0 }}>
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

                <span style={{ fontSize: 18, fontWeight: 700, color: '#fff' }}>
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
                                    value={ticket.assigned_name || '-'} />
                                <InfoRow icon={Package} label={t('ticket.product') || '产品型号'}
                                    value={ticket.product_name || '-'} />
                                <InfoRow icon={Tag} label={t('ticket.serial') || '序列号'}
                                    value={ticket.serial_number || '-'} />
                                <InfoRow icon={Building} label={t('ticket.customer') || '客户'}
                                    value={ticket.account_name || '-- (待确认)'} />
                                <InfoRow icon={User} label={t('ticket.reporter') || '报告人'}
                                    value={ticket.contact_name ? ticket.contact_name : (ticket.reporter_snapshot?.name || ticket.reporter_name ? `${ticket.reporter_snapshot?.name || ticket.reporter_name}` : '-')} />
                                <InfoRow icon={MessageSquare} label={t('ticket.submitted_by') || '提交者'}
                                    value={ticket.submitted_name || '-'} />
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
                                    marginTop: 14, padding: 12, borderRadius: 8,
                                    background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)',
                                }}>
                                    <div style={{ fontSize: 11, color: '#888', marginBottom: 4 }}>
                                        {t('ticket.problem_desc') || '问题描述'}
                                    </div>
                                    <div style={{ fontSize: 13, color: '#ddd', lineHeight: 1.6 }}>
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
                        />
                    )}

                    {/* Activity Timeline - Collapsible */}
                    <CollapsiblePanel
                        title={t('ticket.activity_timeline') || '活动时间轴'}
                        icon={<Clock size={14} color="#FFD700" />}
                        count={activities.filter(a => a.activity_type !== 'mention').length}
                        defaultOpen={true}
                    >
                        <ActivityTimeline activities={activities} loading={false} />
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

            {/* ====== Edit Drawer ====== */}
            {isEditing && (
                <div style={{
                    position: 'fixed', top: 0, right: 0, bottom: 0, width: 400,
                    background: 'rgba(20,20,20,0.95)', backdropFilter: 'blur(20px)',
                    borderLeft: '1px solid rgba(255,255,255,0.1)',
                    zIndex: 200, display: 'flex', flexDirection: 'column',
                    boxShadow: '-10px 0 30px rgba(0,0,0,0.5)'
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: 20, borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
                        <h3 style={{ margin: 0, fontSize: 16, color: '#fff' }}>编辑工单信息</h3>
                        <button onClick={() => setIsEditing(false)} style={{ background: 'none', border: 'none', color: '#888', cursor: 'pointer' }}>
                            <X size={20} />
                        </button>
                    </div>
                    <div style={{ flex: 1, overflowY: 'auto', padding: 20, display: 'flex', flexDirection: 'column', gap: 16 }}>

                        {/* ---- 分组 1: 时效与状态 ---- */}
                        <div style={{ fontSize: 11, color: '#888', textTransform: 'uppercase', letterSpacing: 1, marginBottom: -8 }}>时效与状态</div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                            <div>
                                <label style={{ display: 'block', fontSize: 12, color: '#888', marginBottom: 6 }}>优先级 (Priority)</label>
                                <select
                                    value={editForm.priority as string || ''}
                                    onChange={e => setEditForm(prev => ({ ...prev, priority: e.target.value }))}
                                    style={{ width: '100%', padding: '8px 12px', background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', borderRadius: 6 }}
                                >
                                    <option value="P0">P0</option><option value="P1">P1</option><option value="P2">P2</option>
                                </select>
                            </div>
                            <div>
                                <label style={{ display: 'block', fontSize: 12, color: '#888', marginBottom: 6 }}>状态 (Status)</label>
                                <select
                                    value={editForm.status as string || ''}
                                    onChange={e => setEditForm(prev => ({ ...prev, status: e.target.value }))}
                                    style={{ width: '100%', padding: '8px 12px', background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', borderRadius: 6 }}
                                >
                                    {Object.keys(statusLabels).map(k => <option key={k} value={k}>{statusLabels[k].zh}</option>)}
                                </select>
                            </div>
                        </div>

                        {/* ---- 分组 2: 内容与诊断 ---- */}
                        <div style={{ fontSize: 11, color: '#888', textTransform: 'uppercase', letterSpacing: 1, marginTop: 8, marginBottom: -8 }}>内容与诊断</div>
                        <div>
                            <label style={{ display: 'block', fontSize: 12, color: '#888', marginBottom: 6 }}>问题简述 (Summary)</label>
                            <input
                                value={editForm.problem_summary as string || ''}
                                onChange={e => setEditForm(prev => ({ ...prev, problem_summary: e.target.value }))}
                                style={{ width: '100%', padding: '8px 12px', background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', borderRadius: 6 }}
                            />
                        </div>
                        <div>
                            <label style={{ display: 'block', fontSize: 12, color: '#888', marginBottom: 6 }}>详细描述 (Description)</label>
                            <textarea
                                value={editForm.problem_description as string || ''}
                                onChange={e => setEditForm(prev => ({ ...prev, problem_description: e.target.value }))}
                                style={{ width: '100%', padding: '8px 12px', background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', borderRadius: 6, minHeight: 80 }}
                            />
                        </div>
                        <div>
                            <label style={{ display: 'block', fontSize: 12, color: '#888', marginBottom: 6 }}>处理结果 / 记录 (Resolution)</label>
                            <textarea
                                value={editForm.resolution as string || ''}
                                onChange={e => setEditForm(prev => ({ ...prev, resolution: e.target.value }))}
                                style={{ width: '100%', padding: '8px 12px', background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', borderRadius: 6, minHeight: 80 }}
                            />
                        </div>

                        {/* ---- 分组 3: 设备标识 (RMA/SVC 特有) ---- */}
                        {(ticket.ticket_type === 'rma' || ticket.ticket_type === 'svc') && (
                            <>
                                <div style={{ fontSize: 11, color: '#888', textTransform: 'uppercase', letterSpacing: 1, marginTop: 8, marginBottom: -8 }}>设备标识</div>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                                    <div>
                                        <label style={{ display: 'block', fontSize: 12, color: '#888', marginBottom: 6 }}>序列号 (S/N)</label>
                                        <input
                                            value={editForm.serial_number as string || ''}
                                            onChange={e => setEditForm(prev => ({ ...prev, serial_number: e.target.value }))}
                                            style={{ width: '100%', padding: '8px 12px', background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', borderRadius: 6 }}
                                        />
                                    </div>
                                    <div>
                                        <label style={{ display: 'block', fontSize: 12, color: '#888', marginBottom: 6 }}>产品型号 (Product)</label>
                                        <input
                                            value={editForm.product_name as string || ticket.product_name || ''}
                                            disabled
                                            title="产品型号需通过序列号关联修改"
                                            style={{ width: '100%', padding: '8px 12px', background: 'rgba(0,0,0,0.1)', border: '1px solid rgba(255,255,255,0.05)', color: '#666', borderRadius: 6 }}
                                        />
                                    </div>
                                </div>
                            </>
                        )}

                        {/* ---- 分组 4: 核心判定 (RMA/SVC 特有) ---- */}
                        {(ticket.ticket_type === 'rma' || ticket.ticket_type === 'svc') && (
                            <>
                                <div style={{ fontSize: 11, color: '#888', textTransform: 'uppercase', letterSpacing: 1, marginTop: 8, marginBottom: -8 }}>核心判定</div>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                                    <div>
                                        <label style={{ display: 'block', fontSize: 12, color: '#888', marginBottom: 6 }}>保修判定 (Warranty)</label>
                                        <select
                                            value={editForm.is_warranty !== undefined ? String(editForm.is_warranty) : (ticket.is_warranty !== undefined ? String(ticket.is_warranty) : '')}
                                            onChange={e => setEditForm(prev => ({ ...prev, is_warranty: e.target.value === 'true' ? true : e.target.value === 'false' ? false : undefined }))}
                                            style={{ width: '100%', padding: '8px 12px', background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', borderRadius: 6 }}
                                        >
                                            <option value="">未判定</option>
                                            <option value="true">保修期内 (Warranty)</option>
                                            <option value="false">保修期外 (Non-Warranty)</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label style={{ display: 'block', fontSize: 12, color: '#888', marginBottom: 6 }}>金额 (Amount)</label>
                                        <input
                                            type="number"
                                            value={editForm.payment_amount as number || ''}
                                            onChange={e => setEditForm(prev => ({ ...prev, payment_amount: e.target.value ? Number(e.target.value) : undefined }))}
                                            placeholder="0.00"
                                            style={{ width: '100%', padding: '8px 12px', background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', borderRadius: 6 }}
                                        />
                                    </div>
                                </div>
                                <div>
                                    <label style={{ display: 'block', fontSize: 12, color: '#888', marginBottom: 6 }}>维修内容 (Repair Content)</label>
                                    <textarea
                                        value={editForm.repair_content as string || ''}
                                        onChange={e => setEditForm(prev => ({ ...prev, repair_content: e.target.value }))}
                                        placeholder="零件更换、调整项目等..."
                                        style={{ width: '100%', padding: '8px 12px', background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', borderRadius: 6, minHeight: 60 }}
                                    />
                                </div>
                            </>
                        )}

                        {/* ---- 审计理由区域 ---- */}
                        {hasCoreFieldChanges() && (
                            <div style={{ marginTop: 12, padding: 16, background: 'rgba(255,215,0,0.1)', borderRadius: 8, border: '1px solid rgba(255,215,0,0.3)' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#FFD700', fontSize: 12, fontWeight: 600, marginBottom: 8 }}>
                                    <AlertTriangle size={14} /> 核心字段已修改，必须填写理由
                                </div>
                                <textarea
                                    value={changeReason}
                                    onChange={e => setChangeReason(e.target.value)}
                                    placeholder="请输入修改理由..."
                                    style={{ width: '100%', padding: '8px 12px', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,215,0,0.2)', color: '#fff', borderRadius: 6, minHeight: 60, fontSize: 13 }}
                                />
                            </div>
                        )}
                    </div>
                    <div style={{ padding: 20, borderTop: '1px solid rgba(255,255,255,0.1)', display: 'flex', gap: 12 }}>
                        <button onClick={() => setIsEditing(false)} style={{ flex: 1, padding: '10px', background: 'transparent', border: '1px solid rgba(255,255,255,0.2)', color: '#fff', borderRadius: 8, cursor: 'pointer' }}>取消</button>
                        <button
                            onClick={handleSaveEdit}
                            disabled={hasCoreFieldChanges() && !changeReason.trim() || isSaving}
                            style={{ flex: 1, padding: '10px', background: '#FFD700', border: 'none', color: '#000', borderRadius: 8, fontWeight: 600, cursor: (hasCoreFieldChanges() && !changeReason.trim()) ? 'not-allowed' : 'pointer', opacity: (hasCoreFieldChanges() && !changeReason.trim()) ? 0.5 : 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
                        >
                            <Save size={16} /> 保存
                        </button>
                    </div>
                </div>
            )}

            {/* ====== Delete Modal ====== */}
            {isDeleteModalOpen && (
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
            )}

            {/* ====== Restore Modal ====== */}
            {isRestoreModalOpen && (
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
            )}
        </div>
    );
};

// ==============================
// Sub-Components
// ==============================

const InfoRow: React.FC<{ icon: any; label: string; value: string }> = ({ icon: Icon, label, value }) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <Icon size={13} color="#666" />
        <span style={{ fontSize: 12, color: '#888', minWidth: 50 }}>{label}:</span>
        <span style={{ fontSize: 13, color: '#ccc', fontWeight: 500 }}>{value}</span>
    </div>
);

export default UnifiedTicketDetail;
