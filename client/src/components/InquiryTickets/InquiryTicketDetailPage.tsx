import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Edit2, Save, ArrowUpCircle, RotateCcw, Loader2, Paperclip, Film, FileText, Download, MessageSquare, CheckCircle } from 'lucide-react';
import axios from 'axios';
import { useAuthStore } from '../../store/useAuthStore';
import { useConfirm } from '../../store/useConfirm';
import { useLanguage } from '../../i18n/useLanguage';
import { useRouteMemoryStore } from '../../store/useRouteMemoryStore';
import CustomerContextSidebar from '../Service/CustomerContextSidebar';

interface Attachment {
    id: number;
    file_path: string;
    mime_type: string;
    size: number;
    created_at: string;
}

interface InquiryTicket {
    id: number;
    ticket_number: string;
    customer_name: string;
    customer_contact?: string;
    customer_id: number | null;
    dealer_id: number | null;
    dealer_name: string | null;
    product: { id: number; name: string } | null;
    serial_number: string;
    product_family: string | null;
    service_type: string;
    channel: string;
    problem_summary: string;
    communication_log: string;
    resolution: string;
    status: string;
    handler: { id: number; name: string } | null;
    created_by: { id: number; name: string } | null;
    upgraded_to?: { type: string; id: number } | null;
    upgraded_at?: string | null;
    first_response_at?: string | null;
    resolved_at?: string | null;
    reopened_at?: string | null;
    created_at: string;
    updated_at: string;
    attachments?: Attachment[];
}

const statusColors: Record<string, { bg: string; text: string; border: string }> = {
    InProgress: { bg: 'rgba(59, 130, 246, 0.1)', text: '#60a5fa', border: 'transparent' },
    AwaitingFeedback: { bg: 'rgba(192, 132, 252, 0.1)', text: '#c084fc', border: 'transparent' },
    Resolved: { bg: 'rgba(52, 211, 153, 0.1)', text: '#34d399', border: 'transparent' },
    AutoClosed: { bg: 'rgba(156, 163, 175, 0.1)', text: '#9ca3af', border: 'transparent' },
    Upgraded: { bg: 'rgba(34, 211, 238, 0.1)', text: '#22d3ee', border: 'transparent' }
};

const InquiryTicketDetailPage: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const { token } = useAuthStore();
    const { t } = useLanguage();
    const navigate = useNavigate();
    const confirm = useConfirm();
    const getRoute = useRouteMemoryStore(state => state.getRoute);

    const [ticket, setTicket] = useState<InquiryTicket | null>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [isEditing, setIsEditing] = useState(false);

    // Edit fields
    const [resolution, setResolution] = useState('');
    const [communicationLog, setCommunicationLog] = useState('');
    const [status, setStatus] = useState('');

    useEffect(() => {
        fetchTicket();
    }, [id]);

    const fetchTicket = async () => {
        setLoading(true);
        try {
            const res = await axios.get(`/api/v1/inquiry-tickets/${id}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            if (res.data.success) {
                const data = res.data.data;
                setTicket(data);
                if (!isEditing) {
                    setResolution(data.resolution || '');
                    setCommunicationLog(data.communication_log || '');
                    setStatus(data.status);
                }
            }
        } catch (err) {
            console.error('Failed to fetch inquiry ticket:', err);
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async () => {
        if (!ticket) return;
        setSaving(true);
        try {
            await axios.patch(`/api/v1/inquiry-tickets/${id}`, {
                resolution,
                communication_log: communicationLog,
                status
            }, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setIsEditing(false);
            fetchTicket();
        } catch (err) {
            console.error('Failed to update inquiry ticket:', err);
        } finally {
            setSaving(false);
        }
    };

    const handleUpgrade = async () => {
        if (!ticket) return;

        const confirmed = await confirm.confirm(
            t('inquiry_ticket.confirm_upgrade', { type: 'RMA' }),
            t('inquiry_ticket.action.upgrade_rma'),
            'Upgrade to RMA',
            t('common.cancel')
        );

        if (!confirmed) return;

        try {
            await axios.post(`/api/v1/inquiry-tickets/${id}/upgrade`, {
                upgrade_type: 'rma'
            }, {
                headers: { Authorization: `Bearer ${token}` }
            });
            fetchTicket();
        } catch (err) {
            console.error('Failed to upgrade ticket:', err);
        }
    };

    const handleReopen = async () => {
        if (!ticket) return;
        try {
            await axios.post(`/api/v1/inquiry-tickets/${id}/reopen`, {}, {
                headers: { Authorization: `Bearer ${token}` }
            });
            fetchTicket();
        } catch (err) {
            console.error('Failed to reopen ticket:', err);
        }
    };

    if (loading) {
        return (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-secondary)' }}>
                <Loader2 className="animate-spin" />
            </div>
        );
    }

    if (!ticket) {
        return <div style={{ padding: '40px', textAlign: 'center' }}>{t('inquiry_ticket.not_found')}</div>;
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
                            onClick={() => navigate(getRoute('/service/inquiry-tickets'))}
                            style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}
                        >
                            <ArrowLeft size={18} />
                        </button>

                        <h1 style={{ fontSize: '1.5rem', fontWeight: 800, letterSpacing: '-0.02em', margin: 0 }}>
                            {ticket.ticket_number}
                        </h1>

                        <div style={{
                            padding: '4px 12px',
                            borderRadius: '100px',
                            background: statusColors[ticket.status]?.bg || 'rgba(255,255,255,0.1)',
                            color: statusColors[ticket.status]?.text || 'white',
                            fontWeight: 600,
                            fontSize: '0.8rem',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px'
                        }}>
                            {statusColors[ticket.status]?.border !== 'transparent' && <div style={{ width: 6, height: 6, borderRadius: '50%', background: statusColors[ticket.status]?.text || '#fff' }} />}
                            {t(`inquiry_ticket.status.${ticket.status.replace(/([A-Z])/g, '_$1').toLowerCase().slice(1)}` as any) || ticket.status}
                        </div>

                        <div style={{ flex: 1 }} />

                        {/* Actions */}
                        {ticket.status === 'Resolved' || ticket.status === 'AutoClosed' ? (
                            <button
                                onClick={handleReopen}
                                style={{
                                    display: 'flex', alignItems: 'center', gap: '6px',
                                    background: 'rgba(255,255,255,0.1)',
                                    border: 'none',
                                    color: '#fff',
                                    padding: '8px 16px',
                                    borderRadius: '8px',
                                    cursor: 'pointer'
                                }}
                            >
                                <RotateCcw size={16} />
                                重新打开
                            </button>
                        ) : (
                            !isEditing ? (
                                <>
                                    <button
                                        onClick={handleUpgrade}
                                        style={{
                                            display: 'flex', alignItems: 'center', gap: '6px',
                                            background: 'transparent',
                                            border: '1px solid rgba(255,255,255,0.15)',
                                            color: 'var(--text-secondary)',
                                            padding: '8px 16px',
                                            borderRadius: '8px',
                                            cursor: 'pointer',
                                            fontSize: '0.85rem'
                                        }}
                                    >
                                        <ArrowUpCircle size={16} color="#FFD200" />
                                        升级为 RMA
                                    </button>
                                    <button
                                        onClick={() => setIsEditing(true)}
                                        className="btn-kine-lowkey"
                                    >
                                        <Edit2 size={16} />
                                        编辑
                                    </button>
                                </>
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
                                        取消
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
                                    >
                                        {saving ? <Loader2 className="animate-spin" size={16} /> : <Save size={16} />}
                                        {saving ? 'Saving...' : '保存'}
                                    </button>
                                </>
                            )
                        )}
                    </div>

                    {/* Content Body */}
                    <div style={{ padding: '40px', maxWidth: '800px' }}>

                        {/* Meta Grid */}
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '24px', marginBottom: '40px' }}>
                            <div>
                                <div style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--text-tertiary)', letterSpacing: '0.05em', marginBottom: '4px' }}>
                                    创建时间
                                </div>
                                <div style={{ fontSize: '1rem', fontWeight: 500 }}>
                                    {new Date(ticket.created_at).toLocaleString()}
                                </div>
                            </div>
                            <div>
                                <div style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--text-tertiary)', letterSpacing: '0.05em', marginBottom: '4px' }}>
                                    处理人
                                </div>
                                <div style={{ fontSize: '1rem', fontWeight: 500 }}>
                                    {ticket.handler?.name || t('user.unassigned')}
                                </div>
                            </div>
                            <div>
                                <div style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--text-tertiary)', letterSpacing: '0.05em', marginBottom: '4px' }}>
                                    产品型号
                                </div>
                                <div style={{ fontSize: '1rem', fontWeight: 500 }}>
                                    {ticket.product?.name || '-'}
                                </div>
                            </div>
                            <div>
                                <div style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--text-tertiary)', letterSpacing: '0.05em', marginBottom: '4px' }}>
                                    服务类型
                                </div>
                                <div style={{ fontSize: '1rem', fontWeight: 500 }}>
                                    {ticket.service_type}
                                </div>
                            </div>
                        </div>

                        {/* Complaint / Summary */}
                        <section style={{ marginBottom: '40px' }}>
                            <div style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--text-tertiary)', letterSpacing: '0.05em', marginBottom: '12px' }}>
                                {ticket.service_type}
                            </div>
                            <h2 style={{ fontSize: '1.1rem', fontWeight: 600, lineHeight: '1.4', marginBottom: '24px', color: '#fff' }}>
                                {ticket.problem_summary}
                            </h2>

                            <div style={{ background: 'rgba(255,255,255,0.03)', borderRadius: '12px', padding: '24px' }}>
                                <div style={{ fontSize: '0.85rem', textTransform: 'uppercase', fontWeight: 700, marginBottom: '12px', color: 'rgba(255,255,255,0.5)', letterSpacing: '0.05em' }}>
                                    问题描述
                                </div>
                                <p style={{ color: 'var(--text-secondary)', lineHeight: '1.6' }}>
                                    {ticket.problem_summary}
                                </p>
                            </div>
                        </section>

                        {/* Communication Log */}
                        <section style={{ marginBottom: '40px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
                                <MessageSquare size={18} color="var(--text-secondary)" />
                                <h3 style={{ fontSize: '1.1rem', fontWeight: 600 }}>{t('inquiry_ticket.field.communication_log')}</h3>
                            </div>
                            {isEditing ? (
                                <textarea
                                    value={communicationLog}
                                    onChange={e => setCommunicationLog(e.target.value)}
                                    style={{
                                        width: '100%', minHeight: '150px',
                                        background: 'rgba(0,0,0,0.3)',
                                        border: '1px solid rgba(255,255,255,0.1)',
                                        borderRadius: '12px',
                                        padding: '16px',
                                        color: '#fff',
                                        fontSize: '0.95rem',
                                        lineHeight: '1.6',
                                        resize: 'vertical'
                                    }}
                                    placeholder={t('inquiry_ticket.placeholder.communication_log')}
                                />
                            ) : (
                                <div style={{ whiteSpace: 'pre-wrap', color: 'var(--text-secondary)', lineHeight: '1.6', fontSize: '0.95rem', paddingLeft: '26px' }}>
                                    {ticket.communication_log?.replace(/\\n/g, '\n') || <span style={{ opacity: 0.5, fontStyle: 'italic' }}>{t('inquiry_ticket.no_communication')}</span>}
                                </div>
                            )}
                        </section>

                        {/* Resolution */}
                        <section style={{ marginBottom: '40px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px', color: ticket.status === 'Resolved' ? '#10b981' : 'inherit' }}>
                                <CheckCircle size={18} />
                                <h3 style={{ fontSize: '1.1rem', fontWeight: 600 }}>{t('inquiry_ticket.field.resolution')}</h3>
                            </div>
                            {isEditing ? (
                                <textarea
                                    value={resolution}
                                    onChange={e => setResolution(e.target.value)}
                                    style={{
                                        width: '100%', minHeight: '100px',
                                        background: 'rgba(0,0,0,0.3)',
                                        border: '1px solid rgba(255,255,255,0.1)',
                                        borderRadius: '12px',
                                        padding: '16px',
                                        color: '#fff',
                                        fontSize: '0.95rem',
                                        lineHeight: '1.6'
                                    }}
                                    placeholder={t('inquiry_ticket.placeholder.resolution')}
                                />
                            ) : (
                                <div style={{ whiteSpace: 'pre-wrap', color: 'var(--text-secondary)', lineHeight: '1.6', fontSize: '0.95rem', paddingLeft: '26px' }}>
                                    {ticket.resolution || <span style={{ opacity: 0.5, fontStyle: 'italic' }}>{t('inquiry_ticket.no_resolution')}</span>}
                                </div>
                            )}
                        </section>

                        {/* Attachments */}
                        {ticket.attachments && ticket.attachments.length > 0 && (
                            <section>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
                                    <Paperclip size={18} color="var(--text-secondary)" />
                                    <h3 style={{ fontSize: '1.1rem', fontWeight: 600 }}>Attachments ({ticket.attachments.length})</h3>
                                </div>
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '12px' }}>
                                    {ticket.attachments.map(att => (
                                        <div key={att.id} style={{
                                            background: 'rgba(255,255,255,0.05)',
                                            borderRadius: '8px',
                                            padding: '12px',
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '10px'
                                        }}>
                                            {att.mime_type.startsWith('video') ? <Film size={20} color="#3b82f6" /> : <FileText size={20} />}
                                            <div style={{ flex: 1, overflow: 'hidden' }}>
                                                <div style={{ fontSize: '0.85rem', fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                                    {att.file_path.split('/').pop()}
                                                </div>
                                                <div style={{ fontSize: '0.7rem', color: 'var(--text-tertiary)' }}>
                                                    {(att.size / 1024 / 1024).toFixed(2)} MB
                                                </div>
                                            </div>
                                            <a
                                                href={`/api/v1/inquiry-tickets/attachments/${att.id}/download`}
                                                target="_blank"
                                                rel="noreferrer"
                                                style={{ color: 'var(--text-secondary)', padding: '4px' }}
                                            >
                                                <Download size={16} />
                                            </a>
                                        </div>
                                    ))}
                                </div>
                            </section>
                        )}

                    </div>
                </div>

                {/* RIGHT COLUMN: Customer Context */}
                <div style={{ width: '320px', flexShrink: 0, borderLeft: '1px solid #1c1c1e', background: '#000', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                    <CustomerContextSidebar
                        customerId={ticket.customer_id ?? undefined}
                        customerName={ticket.customer_name}
                        serialNumber={ticket.serial_number}
                    />
                </div>
            </div>
        </div>
    );
};

export default InquiryTicketDetailPage;
