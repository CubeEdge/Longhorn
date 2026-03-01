/**
 * UnifiedTicketDetail (统一工单详情视图)
 * PRD P2 Section 6.3.C - Detail View
 * 左主右辅双栏布局，macOS26 风格
 *
 * 左栏 (70%): 基本信息 → 节点进度条(RMA/SVC) → Activity 时间轴 → 评论框
 * 右栏 (30%): 客户 Card → 设备 Card
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
    ArrowLeft, Clock, User, Tag, Package, Calendar, AlertTriangle,
    Building, MessageSquare, ExternalLink
} from 'lucide-react';
import axios from 'axios';
import { useAuthStore } from '../../store/useAuthStore';
import { useLanguage } from '../../i18n/useLanguage';
import NodeProgressBar from './NodeProgressBar';
import { ActivityTimeline, CommentInput } from './TicketDetailComponents';
import CustomerContextSidebar from '../Service/CustomerContextSidebar';
import { ParticipantsSidebar } from './ParticipantsSidebar';

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
    problem_summary?: string;
    problem_description?: string;
    is_warranty?: boolean;
    created_at: string;
    updated_at: string;
    parent_ticket_number?: string;
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

// ==============================
// Main Component
// ==============================

const UnifiedTicketDetail: React.FC<Props> = ({ ticketId, onBack }) => {
    const { token } = useAuthStore();
    const { t, language } = useLanguage();
    const lang = language === 'zh' || language === 'ja' ? 'zh' : 'en';

    const [ticket, setTicket] = useState<TicketDetail | null>(null);
    const [activities, setActivities] = useState<any[]>([]);
    const [participants, setParticipants] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

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
            fetchDetail();
        } catch (err) {
            console.error('[UnifiedDetail] Failed to add comment', err);
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
                        display: 'inline-flex', alignItems: 'center', gap: 6,
                        padding: '6px 14px', borderRadius: 8,
                        border: '1px solid rgba(255,255,255,0.12)', background: 'rgba(255,255,255,0.04)',
                        color: '#ccc', cursor: 'pointer', fontSize: 13, fontWeight: 500,
                        transition: 'all 0.15s',
                    }}
                    onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.08)'; }}
                    onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.04)'; }}
                >
                    <ArrowLeft size={16} />
                    {t('action.back') || '返回'}
                </button>

                <span style={{ fontSize: 18, fontWeight: 700, color: '#fff', fontFamily: 'monospace' }}>
                    {ticket.ticket_number}
                </span>

                {/* Status badge */}
                <span style={{
                    padding: '3px 10px', borderRadius: 6, fontSize: 12, fontWeight: 600,
                    background: `${statusInfo.color}20`, color: statusInfo.color,
                }}>
                    {lang === 'zh' ? statusInfo.zh : statusInfo.en}
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
            </div>

            {/* ====== Two Column Layout ====== */}
            <div style={{ display: 'flex', gap: 20, alignItems: 'flex-start' }}>

                {/* ====== LEFT COLUMN (Main) ====== */}
                <div style={{ flex: '1 1 70%', minWidth: 0 }}>

                    {/* Basic Info Card */}
                    <div style={{
                        padding: 20, borderRadius: 12, marginBottom: 16,
                        background: 'rgba(30,30,30,0.5)', backdropFilter: 'blur(12px)',
                        border: '1px solid rgba(255,255,255,0.06)',
                    }}>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                            <InfoRow icon={Calendar} label={t('ticket.created_at') || '创建时间'}
                                value={new Date(ticket.created_at).toLocaleString('zh-CN')} />
                            <InfoRow icon={User} label={t('ticket.assignee') || '指派给'}
                                value={ticket.assigned_name || '-'} />
                            <InfoRow icon={Package} label={t('ticket.product') || '产品'}
                                value={ticket.product_name || '-'} />
                            <InfoRow icon={Tag} label={t('ticket.serial') || '序列号'}
                                value={ticket.serial_number || '-'} />
                            <InfoRow icon={User} label={t('ticket.customer') || '客户'}
                                value={(() => {
                                    const acc = ticket.account_name;
                                    const person = ticket.contact_name || ticket.reporter_name;
                                    if (acc && person && acc !== person && acc.toLowerCase() !== person.toLowerCase()) {
                                        return `${acc} · ${person}`;
                                    }
                                    return acc || person || '-';
                                })()} />
                            <InfoRow icon={MessageSquare} label={t('ticket.submitted_by') || '提交者'}
                                value={ticket.submitted_name || '-'} />
                            {ticket.dealer_name && (
                                <InfoRow icon={Building} label={t('ticket.dealer') || '经销商'}
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
                                marginTop: 16, padding: 14, borderRadius: 8,
                                background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)',
                            }}>
                                <div style={{ fontSize: 12, color: '#888', marginBottom: 6 }}>
                                    {t('ticket.problem_desc') || '问题描述'}
                                </div>
                                <div style={{ fontSize: 14, color: '#ddd', lineHeight: 1.6 }}>
                                    {ticket.problem_summary || ticket.problem_description}
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Node Progress Bar (RMA / SVC only) */}
                    {isRmaOrSvc && (
                        <NodeProgressBar
                            ticketType={ticket.ticket_type}
                            currentNode={ticket.current_node}
                        />
                    )}

                    {/* Activity Timeline */}
                    <div style={{
                        borderRadius: 12, marginBottom: 16,
                        background: 'rgba(30,30,30,0.5)', backdropFilter: 'blur(12px)',
                        border: '1px solid rgba(255,255,255,0.06)',
                        overflow: 'hidden',
                    }}>
                        <div style={{
                            padding: '14px 20px', borderBottom: '1px solid rgba(255,255,255,0.06)',
                            display: 'flex', alignItems: 'center', gap: 8,
                        }}>
                            <Clock size={16} color="#FFD700" />
                            <span style={{ fontSize: 14, fontWeight: 600, color: '#fff' }}>
                                {t('ticket.activity_timeline') || '活动时间轴'}
                            </span>
                            <span style={{ fontSize: 12, color: '#666', marginLeft: 'auto' }}>
                                {activities.length} {lang === 'zh' ? '条记录' : 'entries'}
                            </span>
                        </div>

                        <div style={{ padding: '0 20px 16px' }}>
                            <ActivityTimeline activities={activities} loading={false} />
                        </div>
                    </div>

                    {/* Comment Input */}
                    <div style={{
                        borderRadius: 12,
                        background: 'rgba(30,30,30,0.5)', backdropFilter: 'blur(12px)',
                        border: '1px solid rgba(255,255,255,0.06)',
                        padding: 16,
                    }}>
                        <CommentInput onSubmit={handleAddComment} />
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
                        accountId={ticket.account_id as number | undefined}
                        accountName={ticket.account_name}
                        serialNumber={ticket.serial_number}
                        dealerId={ticket.dealer_id as number | undefined}
                        dealerName={ticket.dealer_name}
                        dealerCode={ticket.dealer_code}
                    />
                </div>
            </div>
        </div>
    );
};

// ==============================
// Sub-Components
// ==============================

const InfoRow: React.FC<{ icon: any; label: string; value: string }> = ({ icon: Icon, label, value }) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <Icon size={14} color="#666" />
        <span style={{ fontSize: 12, color: '#888', minWidth: 56 }}>{label}:</span>
        <span style={{ fontSize: 13, color: '#ccc', fontWeight: 500 }}>{value}</span>
    </div>
);

export default UnifiedTicketDetail;
