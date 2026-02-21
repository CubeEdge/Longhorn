import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
    ArrowLeft, Edit2, Save, Loader2,
    AlertCircle, CheckCircle, Clock, Truck, Hammer, XCircle,
    Activity, FileText, Download
} from 'lucide-react';
import axios from 'axios';
import { useAuthStore } from '../../store/useAuthStore';
import { useRouteMemoryStore } from '../../store/useRouteMemoryStore';
import { useLanguage } from '../../i18n/useLanguage';
import CustomerContextSidebar from '../Service/CustomerContextSidebar';

interface Attachment {
    id: number;
    file_path: string;
    mime_type: string;
    size: number;
    created_at: string;
}

interface RMATicket {
    id: number;
    ticket_number: string;
    channel_code: string;
    issue_type: string;
    issue_category: string;
    issue_subcategory: string;
    severity: number;
    product: { id: number; name: string } | null;
    serial_number: string;
    firmware_version: string;
    hardware_version: string;
    problem_description: string;
    solution_for_customer: string;
    is_warranty: boolean;
    repair_content: string;
    problem_analysis: string;
    reporter_name: string;
    // 新架构字段
    account_id: number | null;
    contact_id: number | null;
    account: { id: number; name: string; account_type?: string } | null;
    contact: { id: number; name: string; email?: string; job_title?: string } | null;
    // 经销商信息
    dealer: { id: number; name: string; code?: string } | null;
    dealer_id: number | null;
    dealer_name: string | null;
    dealer_code: string | null;
    dealer_contact_name?: string | null;
    dealer_contact_title?: string | null;
    // 向后兼容字段
    customer: { id: number; name: string } | null;
    submitted_by: { id: number; name: string } | null;
    assigned_to: { id: number; name: string } | null;
    inquiry_ticket: { id: number; ticket_number: string } | null;
    payment_channel: string;
    payment_amount: number;
    payment_date: string;
    status: string;
    repair_priority: string;
    feedback_date: string;
    received_date: string;
    completed_date: string;
    approval_status: string;
    created_at: string;
    updated_at: string;
    attachments?: Attachment[];
}

// Status colors aligned with Dashboard (ServiceTopBarStats)
const statusConfig: Record<string, { color: string, icon: any }> = {
    Pending: { color: '#f59e0b', icon: Clock },      // 待处理 - Orange
    Assigned: { color: '#3b82f6', icon: Activity },  // 分配 - Blue
    InRepair: { color: '#3b82f6', icon: Hammer },   // 维修中 - Blue (same as Dashboard)
    Repaired: { color: '#10b981', icon: CheckCircle }, // 已修复 - Green
    Shipped: { color: '#06b6d4', icon: Truck },     // 已发货 - Cyan
    Returned: { color: '#10b981', icon: CheckCircle }, // 已寄回 - Green (same as Dashboard)
    Completed: { color: '#22c55e', icon: CheckCircle }, // 已完成
    Cancelled: { color: '#6b7280', icon: XCircle }  // 已取消
};

const RMATicketDetailPage: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const { token } = useAuthStore();
    const { t } = useLanguage();
    const navigate = useNavigate();
    const getRoute = useRouteMemoryStore(state => state.getRoute);

    const [ticket, setTicket] = useState<RMATicket | null>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [isEditing, setIsEditing] = useState(false);

    // Edit fields
    const [solutionForCustomer, setSolutionForCustomer] = useState('');
    const [repairContent, setRepairContent] = useState('');
    const [problemAnalysis, setProblemAnalysis] = useState('');
    const [status, setStatus] = useState('');

    useEffect(() => {
        fetchTicket();
    }, [id]);

    const fetchTicket = async () => {
        setLoading(true);
        try {
            const res = await axios.get(`/api/v1/rma-tickets/${id}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            if (res.data.success) {
                const data = res.data.data;
                setTicket(data);
                setSolutionForCustomer(data.solution_for_customer || '');
                setRepairContent(data.repair_content || '');
                setProblemAnalysis(data.problem_analysis || '');
                setStatus(data.status);
            }
        } catch (err) {
            console.error('Failed to fetch RMA ticket:', err);
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async () => {
        if (!ticket) return;
        setSaving(true);
        try {
            await axios.patch(`/api/v1/rma-tickets/${id}`, {
                solution_for_customer: solutionForCustomer,
                repair_content: repairContent,
                problem_analysis: problemAnalysis,
                status
            }, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setIsEditing(false);
            fetchTicket();
        } catch (err) {
            console.error('Failed to update RMA ticket:', err);
        } finally {
            setSaving(false);
        }
    };

    const formatDate = (dateStr: string | null) => {
        if (!dateStr) return '-';
        return new Date(dateStr).toLocaleString('zh-CN', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    const getStatusLabel = (s: string) => {
        // Convert camelCase/PascalCase to snake_case for translation keys
        const key = s.replace(/([A-Z])/g, '_$1').toLowerCase().replace(/^_/, '');
        return t(`rma_ticket.status.${key}` as any) || s;
    };

    const StatusIcon = ticket ? (statusConfig[ticket.status]?.icon || AlertCircle) : AlertCircle;
    if (loading) {
        return (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-secondary)' }}>
                <Loader2 className="animate-spin" />
            </div>
        );
    }

    if (!ticket) {
        return <div style={{ padding: '40px', textAlign: 'center' }}>{t('rma_ticket.not_found')}</div>;
    }

    return (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden', background: '#000' }}>
            <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
                {/* LEFT COLUMN: Main Content */}
                <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>

                    {/* Header Strip */}
                    <div style={{
                        padding: '20px 40px',
                        borderBottom: '1px solid rgba(255,255,255,0.08)',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '16px',
                        background: 'rgba(255,255,255,0.02)',
                        backdropFilter: 'blur(20px)'
                    }}>
                        <button
                            onClick={() => navigate(getRoute('/service/rma-tickets'))}
                            style={{
                                background: 'rgba(255,255,255,0.05)',
                                border: '1px solid rgba(255,255,255,0.1)',
                                borderRadius: '10px',
                                color: 'var(--text-secondary)',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                width: '40px',
                                height: '40px',
                                padding: 0,
                                transition: 'all 0.2s'
                            }}
                            onMouseEnter={(e) => {
                                e.currentTarget.style.background = 'rgba(255,255,255,0.1)';
                                e.currentTarget.style.color = '#fff';
                            }}
                            onMouseLeave={(e) => {
                                e.currentTarget.style.background = 'rgba(255,255,255,0.05)';
                                e.currentTarget.style.color = 'var(--text-secondary)';
                            }}
                        >
                            <ArrowLeft size={22} />
                        </button>

                        <h1 style={{ fontSize: '1.5rem', fontWeight: 800, letterSpacing: '-0.02em', margin: 0 }}>
                            {ticket.ticket_number}
                        </h1>

                        <div style={{
                            padding: '4px 12px',
                            borderRadius: '100px',
                            background: statusConfig[ticket.status]?.color ? `${statusConfig[ticket.status].color}20` : 'rgba(255,255,255,0.1)',
                            color: statusConfig[ticket.status]?.color || 'white',
                            fontWeight: 600,
                            fontSize: '0.8rem',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px',
                            border: `1px solid ${statusConfig[ticket.status]?.color ? statusConfig[ticket.status].color + '40' : 'transparent'}`
                        }}>
                            {StatusIcon && <StatusIcon size={14} />}
                            {getStatusLabel(ticket.status)}
                        </div>

                        <div style={{ flex: 1 }} />

                        {/* Actions */}
                        <div style={{ display: 'flex', gap: '12px' }}>
                            {!isEditing ? (
                                <button
                                    onClick={() => setIsEditing(true)}
                                    className="btn-kine-lowkey"
                                >
                                    <Edit2 size={16} />
                                    编辑
                                </button>
                            ) : (
                                <>
                                    <button
                                        onClick={() => setIsEditing(false)}
                                        style={{
                                            background: 'transparent',
                                            border: 'none',
                                            color: 'var(--text-secondary)',
                                            padding: '8px 16px',
                                            cursor: 'pointer'
                                        }}
                                    >
                                        {t('action.cancel') || 'Cancel'}
                                    </button>
                                    <button
                                        onClick={handleSave}
                                        style={{
                                            display: 'flex', alignItems: 'center', gap: '6px',
                                            background: 'var(--accent-blue)',
                                            border: 'none',
                                            color: '#000',
                                            padding: '8px 24px',
                                            borderRadius: '8px',
                                            fontWeight: 700,
                                            cursor: 'pointer'
                                        }}
                                        disabled={saving}
                                    >
                                        {saving ? <Loader2 className="animate-spin" size={16} /> : <Save size={16} />}
                                        {saving ? 'Saving...' : (t('action.save') || 'Save')}
                                    </button>
                                </>
                            )}
                        </div>
                    </div>

                    {/* Content Body - macOS26 Card Style */}
                    <div style={{ padding: '40px', maxWidth: '800px' }}>

                        {/* Info Card - 基本信息卡片 (第一个卡片) */}
                        <div className="ticket-card">
                            <div className="ticket-card-title">
                                <Clock size={14} /> {t('ticket.basic_info')}
                            </div>
                            <div className="ticket-info-grid">
                                <div className="ticket-info-item">
                                    <div className="ticket-info-label">{t('ticket.created_at')}</div>
                                    <div className="ticket-info-value">{formatDate(ticket.created_at)}</div>
                                </div>
                                <div className="ticket-info-item">
                                    <div className="ticket-info-label">{t('ticket.contact')}</div>
                                    <div className="ticket-info-value">{ticket.contact?.name || ticket.reporter_name || '-'}</div>
                                </div>
                                <div className="ticket-info-item">
                                    <div className="ticket-info-label">{t('ticket.product')}</div>
                                    <div className="ticket-info-value">{ticket.product?.name || '-'}</div>
                                </div>
                                <div className="ticket-info-item">
                                    <div className="ticket-info-label">{t('ticket.serial_number')}</div>
                                    <div className="ticket-info-value">{ticket.serial_number || '-'}</div>
                                </div>
                                <div className="ticket-info-item">
                                    <div className="ticket-info-label">{t('ticket.issue_type')}</div>
                                    <div className="ticket-info-value">{ticket.issue_type || '-'}</div>
                                </div>
                                <div className="ticket-info-item">
                                    <div className="ticket-info-label">{t('ticket.severity')}</div>
                                    <div className="ticket-info-value" style={{ color: ticket.severity === 1 ? '#ef4444' : undefined }}>P{ticket.severity}</div>
                                </div>
                                <div className="ticket-info-item">
                                    <div className="ticket-info-label">{t('ticket.warranty')}</div>
                                    <div className="ticket-info-value" style={{ color: ticket.is_warranty ? '#10b981' : undefined }}>
                                        {ticket.is_warranty ? t('common.yes') : t('common.no')}
                                    </div>
                                </div>
                                <div className="ticket-info-item">
                                    <div className="ticket-info-label">{t('ticket.handler')}</div>
                                    <div className="ticket-info-value">{ticket.assigned_to?.name || t('user.unassigned')}</div>
                                </div>
                            </div>
                        </div>

                        {/* Problem Card - 问题描述卡片 (第二个卡片) */}
                        <div className="ticket-card">
                            <div className="ticket-card-title">
                                <AlertCircle size={14} /> {t('ticket.problem_description')}
                            </div>
                            <h2 className="ticket-section-title">{ticket.problem_description}</h2>
                        </div>

                        {/* Customer Solution Card - 客户解决方案卡片 */}
                        <div className="ticket-card">
                            <div className="ticket-card-title">
                                <CheckCircle size={14} /> {t('ticket.solution_for_customer')}
                            </div>
                            {isEditing ? (
                                <textarea
                                    value={solutionForCustomer}
                                    onChange={(e) => setSolutionForCustomer(e.target.value)}
                                    className="ticket-textarea"
                                    placeholder={t('ticket.solution_placeholder')}
                                />
                            ) : (
                                <div className="ticket-content-box">
                                    <p style={{ color: solutionForCustomer ? 'var(--text-primary)' : 'var(--text-tertiary)', lineHeight: '1.6', margin: 0, whiteSpace: 'pre-wrap' }}>
                                        {solutionForCustomer || t('ticket.no_solution_yet')}
                                    </p>
                                </div>
                            )}
                        </div>

                        {/* Internal Tech Notes Card - 内部技术分析卡片 */}
                        <div className="ticket-card">
                            <div className="ticket-card-title">
                                <Hammer size={14} /> {t('ticket.internal_tech_notes')}
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
                                <div>
                                    <div className="ticket-info-label" style={{ marginBottom: '8px' }}>{t('ticket.problem_analysis')}</div>
                                    {isEditing ? (
                                        <textarea
                                            value={problemAnalysis}
                                            onChange={(e) => setProblemAnalysis(e.target.value)}
                                            className="ticket-textarea"
                                            style={{ minHeight: '100px' }}
                                        />
                                    ) : (
                                        <div className="ticket-content-box" style={{ minHeight: '60px' }}>
                                            <p style={{ color: 'var(--text-secondary)', lineHeight: '1.6', margin: 0, whiteSpace: 'pre-wrap' }}>
                                                {problemAnalysis || '-'}
                                            </p>
                                        </div>
                                    )}
                                </div>
                                <div>
                                    <div className="ticket-info-label" style={{ marginBottom: '8px' }}>{t('ticket.repair_actions')}</div>
                                    {isEditing ? (
                                        <textarea
                                            value={repairContent}
                                            onChange={(e) => setRepairContent(e.target.value)}
                                            className="ticket-textarea"
                                            style={{ minHeight: '100px' }}
                                        />
                                    ) : (
                                        <div className="ticket-content-box" style={{ minHeight: '60px' }}>
                                            <p style={{ color: 'var(--text-secondary)', lineHeight: '1.6', margin: 0, whiteSpace: 'pre-wrap' }}>
                                                {repairContent || '-'}
                                            </p>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Attachments */}
                        {ticket.attachments && ticket.attachments.length > 0 && (
                            <div style={{ marginTop: '16px' }}>
                                <h3 style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', marginBottom: '12px' }}>Attachments</h3>
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px' }}>
                                    {ticket.attachments.map(att => (
                                        <a
                                            key={att.id}
                                            href={`/api/uploads/${att.file_path}`}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            style={{
                                                display: 'flex', alignItems: 'center', gap: '8px',
                                                padding: '8px 12px',
                                                background: 'rgba(255,255,255,0.05)',
                                                borderRadius: '8px',
                                                textDecoration: 'none',
                                                color: 'var(--text-primary)',
                                                fontSize: '0.85rem',
                                                border: '1px solid rgba(255,255,255,0.1)'
                                            }}
                                        >
                                            <FileText size={14} />
                                            <span style={{ maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                {att.file_path.split('/').pop()}
                                            </span>
                                            <Download size={12} style={{ opacity: 0.5 }} />
                                        </a>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* RIGHT SIDEBAR: Customer Context */}
                <div style={{ width: '320px', flexShrink: 0, borderLeft: '1px solid #1c1c1e', background: '#000', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                    <CustomerContextSidebar
                        accountId={ticket.account_id ?? undefined}
                        accountName={ticket.account?.name || ticket.customer?.name}
                        serialNumber={ticket.serial_number}
                        dealerId={ticket.dealer_id ?? undefined}
                        dealerName={ticket.dealer_name ?? undefined}
                        dealerCode={ticket.dealer_code ?? undefined}
                        dealerContactName={ticket.dealer_contact_name ?? undefined}
                        dealerContactTitle={ticket.dealer_contact_title ?? undefined}
                    />
                </div>

            </div>
        </div>
    );
};

export default RMATicketDetailPage;
