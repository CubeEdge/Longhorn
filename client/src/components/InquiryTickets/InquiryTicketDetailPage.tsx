import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Edit2, Save, X, ArrowUpCircle, RotateCcw, Loader2, User, Paperclip, Film, FileText, Download } from 'lucide-react';
import axios from 'axios';
import { useAuthStore } from '../../store/useAuthStore';
import { useLanguage } from '../../i18n/useLanguage';
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
    customer_contact: string;
    customer_id: number | null;
    dealer_id: number | null;
    dealer_name: string | null;
    product: { id: number; name: string } | null;
    serial_number: string;
    service_type: string;
    channel: string;
    problem_summary: string;
    communication_log: string;
    resolution: string;
    status: string;
    handler: { id: number; name: string } | null;
    created_by: { id: number; name: string } | null;
    upgraded_to: { type: string; id: number } | null;
    upgraded_at: string | null;
    first_response_at: string | null;
    resolved_at: string | null;
    reopened_at: string | null;
    created_at: string;
    updated_at: string;
    attachments?: Attachment[];
}

const statusColors: Record<string, string> = {
    InProgress: '#3b82f6',
    AwaitingFeedback: '#8b5cf6',
    Resolved: '#10b981',
    AutoClosed: '#6b7280',
    Upgraded: '#06b6d4'
};

const InquiryTicketDetailPage: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const { token } = useAuthStore();
    const { t } = useLanguage();
    const navigate = useNavigate();

    const [ticket, setTicket] = useState<InquiryTicket | null>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
    const [showContextSidebar, setShowContextSidebar] = useState(false);

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
                setResolution(data.resolution || '');
                setCommunicationLog(data.communication_log || '');
                setStatus(data.status);
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

    const handleUpgrade = async (upgradeType: 'rma' | 'svc') => {
        if (!ticket) return;
        if (!confirm(t('inquiry_ticket.confirm_upgrade', { type: upgradeType.toUpperCase() }))) return;

        try {
            await axios.post(`/api/v1/inquiry-tickets/${id}/upgrade`, {
                upgrade_type: upgradeType
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

    const formatDate = (dateStr: string | null) => {
        if (!dateStr) return '-';
        return new Date(dateStr).toLocaleString('zh-CN');
    };

    const getStatusLabel = (s: string) => {
        const labels: Record<string, string> = {
            InProgress: t('inquiry_ticket.status.in_progress'),
            AwaitingFeedback: t('inquiry_ticket.status.awaiting_feedback'),
            Resolved: t('inquiry_ticket.status.resolved'),
            AutoClosed: t('inquiry_ticket.status.auto_closed'),
            Upgraded: t('inquiry_ticket.status.upgraded')
        };
        return labels[s] || s;
    };

    if (loading) {
        return (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '400px' }}>
                <Loader2 size={32} className="animate-spin" />
            </div>
        );
    }

    if (!ticket) {
        return (
            <div style={{ padding: '24px', textAlign: 'center' }}>
                <p>{t('inquiry_ticket.not_found')}</p>
            </div>
        );
    }

    return (
        <div style={{ padding: '24px', maxWidth: '1000px', margin: '0 auto', position: 'relative' }}>
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                    <button onClick={() => navigate(-1)} className="btn btn-ghost btn-sm">
                        <ArrowLeft size={18} />
                    </button>
                    <div>
                        <h1 style={{ fontSize: '1.5rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '12px' }}>
                            {ticket.ticket_number}
                            <span
                                style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '4px',
                                    padding: '4px 12px',
                                    borderRadius: '16px',
                                    fontSize: '0.875rem',
                                    fontWeight: 500,
                                    background: `${statusColors[ticket.status] || '#6b7280'}20`,
                                    color: statusColors[ticket.status] || '#6b7280'
                                }}
                            >
                                {getStatusLabel(ticket.status)}
                            </span>
                        </h1>
                        <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
                            {t('inquiry_ticket.created_at')}: {formatDate(ticket.created_at)}
                        </p>
                    </div>
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>

                    {/* Context Sidebar Toggle */}
                    <button
                        onClick={() => setShowContextSidebar(!showContextSidebar)}
                        className={`btn ${showContextSidebar ? 'btn-primary' : 'btn-secondary'}`}
                        title="Customer Context"
                    >
                        <User size={16} />
                    </button>

                    {['Resolved', 'AutoClosed'].includes(ticket.status) && (
                        <button onClick={handleReopen} className="btn btn-secondary">
                            <RotateCcw size={16} />
                            <span style={{ marginLeft: '6px' }}>{t('inquiry_ticket.action.reopen')}</span>
                        </button>
                    )}
                    {ticket.status !== 'Upgraded' && (
                        <>
                            <button onClick={() => handleUpgrade('rma')} className="btn btn-secondary">
                                <ArrowUpCircle size={16} />
                                <span style={{ marginLeft: '6px' }}>{t('inquiry_ticket.action.upgrade_rma')}</span>
                            </button>
                            <button onClick={() => handleUpgrade('svc')} className="btn btn-secondary">
                                <ArrowUpCircle size={16} />
                                <span style={{ marginLeft: '6px' }}>{t('inquiry_ticket.action.upgrade_svc')}</span>
                            </button>
                        </>
                    )}
                    {isEditing ? (
                        <>
                            <button onClick={() => setIsEditing(false)} className="btn btn-ghost">
                                <X size={16} />
                            </button>
                            <button onClick={handleSave} className="btn btn-primary" disabled={saving}>
                                {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                                <span style={{ marginLeft: '6px' }}>{t('action.save')}</span>
                            </button>
                        </>
                    ) : (
                        <button onClick={() => setIsEditing(true)} className="btn btn-primary">
                            <Edit2 size={16} />
                            <span style={{ marginLeft: '6px' }}>编辑</span>
                        </button>
                    )}
                </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '24px' }}>
                {/* Main Content */}
                <div>
                    {/* Problem Summary */}
                    <div style={{
                        background: 'var(--bg-card)',
                        borderRadius: '12px',
                        padding: '20px',
                        marginBottom: '16px',
                        border: '1px solid var(--border-color)'
                    }}>
                        <h3 style={{ fontWeight: 600, marginBottom: '12px' }}>{t('inquiry_ticket.field.problem_summary')}</h3>
                        <p style={{ lineHeight: 1.6 }}>{ticket.problem_summary}</p>
                    </div>

                    {/* Communication Log */}
                    <div style={{
                        background: 'var(--bg-card)',
                        borderRadius: '12px',
                        padding: '20px',
                        marginBottom: '16px',
                        border: '1px solid var(--border-color)'
                    }}>
                        <h3 style={{ fontWeight: 600, marginBottom: '12px' }}>{t('inquiry_ticket.field.communication_log')}</h3>
                        {isEditing ? (
                            <textarea
                                value={communicationLog}
                                onChange={(e) => setCommunicationLog(e.target.value)}
                                className="form-control"
                                rows={6}
                            />
                        ) : (
                            <pre style={{ whiteSpace: 'pre-wrap', fontFamily: 'inherit', lineHeight: 1.6 }}>
                                {ticket.communication_log || t('inquiry_ticket.no_communication')}
                            </pre>
                        )}
                    </div>

                    {/* Resolution */}
                    <div style={{
                        background: 'var(--bg-card)',
                        borderRadius: '12px',
                        padding: '20px',
                        border: '1px solid var(--border-color)'
                    }}>
                        <h3 style={{ fontWeight: 600, marginBottom: '12px' }}>{t('inquiry_ticket.field.resolution')}</h3>
                        {isEditing ? (
                            <>
                                <textarea
                                    value={resolution}
                                    onChange={(e) => setResolution(e.target.value)}
                                    className="form-control"
                                    rows={4}
                                    placeholder={t('inquiry_ticket.placeholder.resolution')}
                                />
                                <div style={{ marginTop: '12px' }}>
                                    <label className="form-label">{t('inquiry_ticket.field.status')}</label>
                                    <select
                                        value={status}
                                        onChange={(e) => setStatus(e.target.value)}
                                        className="form-control"
                                        style={{ width: 'auto' }}
                                    >
                                        <option value="InProgress">{t('inquiry_ticket.status.in_progress')}</option>
                                        <option value="AwaitingFeedback">{t('inquiry_ticket.status.awaiting_feedback')}</option>
                                        <option value="Resolved">{t('inquiry_ticket.status.resolved')}</option>
                                    </select>
                                </div>
                            </>
                        ) : (
                            <p style={{ lineHeight: 1.6 }}>{ticket.resolution || t('inquiry_ticket.no_resolution')}</p>
                        )}
                    </div>

                    {/* Attachments Section */}
                    {ticket.attachments && ticket.attachments.length > 0 && (
                        <div style={{
                            background: 'var(--bg-card)',
                            borderRadius: '12px',
                            padding: '20px',
                            marginTop: '16px',
                            border: '1px solid var(--border-color)'
                        }}>
                            <h3 style={{ fontWeight: 600, marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <Paperclip size={18} className="text-primary" />
                                {t('section.media_attachments')} ({ticket.attachments.length})
                            </h3>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: '16px' }}>
                                {ticket.attachments.map((file) => {
                                    const isImage = file.mime_type.startsWith('image/');
                                    const isVideo = file.mime_type.startsWith('video/');
                                    const isPdf = file.mime_type === 'application/pdf';

                                    return (
                                        <div key={file.id}
                                            style={{
                                                borderRadius: '8px',
                                                overflow: 'hidden',
                                                border: '1px solid var(--border-color)',
                                                position: 'relative',
                                                background: 'var(--bg-secondary)'
                                            }}
                                            className="group"
                                        >
                                            {isImage ? (
                                                <img src={file.file_path} alt="" style={{ width: '100%', height: '100px', objectFit: 'cover' }} />
                                            ) : isVideo ? (
                                                <div style={{ width: '100%', height: '100px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#000' }}>
                                                    <Film size={24} color="#fff" />
                                                </div>
                                            ) : (
                                                <div style={{ width: '100%', height: '100px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                                    {isPdf ? <FileText size={24} /> : <Paperclip size={24} />}
                                                </div>
                                            )}
                                            <div style={{ padding: '8px' }}>
                                                <p style={{
                                                    fontSize: '0.75rem',
                                                    whiteSpace: 'nowrap',
                                                    overflow: 'hidden',
                                                    textOverflow: 'ellipsis',
                                                    color: 'var(--text-primary)',
                                                    marginBottom: '4px'
                                                }}>
                                                    {file.file_path.split('/').pop()}
                                                </p>
                                                <a
                                                    href={file.file_path}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    style={{
                                                        fontSize: '0.7rem',
                                                        color: 'var(--primary)',
                                                        textDecoration: 'none',
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        gap: '4px'
                                                    }}
                                                >
                                                    <Download size={12} />
                                                    {t('action.download')}
                                                </a>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}
                </div>

                {/* Sidebar */}
                <div>
                    {/* Customer Info */}
                    <div style={{
                        background: 'var(--bg-card)',
                        borderRadius: '12px',
                        padding: '20px',
                        marginBottom: '16px',
                        border: '1px solid var(--border-color)'
                    }}>
                        <h3 style={{ fontWeight: 600, marginBottom: '12px' }}>{t('inquiry_ticket.section.customer')}</h3>
                        <div style={{ display: 'grid', gap: '8px', fontSize: '0.875rem' }}>
                            <div><strong>{t('inquiry_ticket.field.customer_name')}:</strong> {ticket.customer_name || '-'}</div>
                            <div><strong>{t('inquiry_ticket.field.customer_contact')}:</strong> {ticket.customer_contact || '-'}</div>
                            {ticket.dealer_name && <div><strong>{t('inquiry_ticket.field.dealer')}:</strong> {ticket.dealer_name}</div>}
                        </div>
                    </div>

                    {/* Product Info */}
                    <div style={{
                        background: 'var(--bg-card)',
                        borderRadius: '12px',
                        padding: '20px',
                        marginBottom: '16px',
                        border: '1px solid var(--border-color)'
                    }}>
                        <h3 style={{ fontWeight: 600, marginBottom: '12px' }}>{t('inquiry_ticket.section.product')}</h3>
                        <div style={{ display: 'grid', gap: '8px', fontSize: '0.875rem' }}>
                            <div><strong>{t('inquiry_ticket.field.product')}:</strong> {ticket.product?.name || '-'}</div>
                            <div><strong>{t('inquiry_ticket.field.serial_number')}:</strong> {ticket.serial_number || '-'}</div>
                        </div>
                    </div>

                    {/* Service Info */}
                    <div style={{
                        background: 'var(--bg-card)',
                        borderRadius: '12px',
                        padding: '20px',
                        border: '1px solid var(--border-color)'
                    }}>
                        <h3 style={{ fontWeight: 600, marginBottom: '12px' }}>{t('inquiry_ticket.section.service')}</h3>
                        <div style={{ display: 'grid', gap: '8px', fontSize: '0.875rem' }}>
                            <div><strong>{t('inquiry_ticket.field.service_type')}:</strong> {ticket.service_type}</div>
                            <div><strong>{t('inquiry_ticket.field.channel')}:</strong> {ticket.channel || '-'}</div>
                            <div><strong>{t('inquiry_ticket.field.handler')}:</strong> {ticket.handler?.name || '-'}</div>
                            <div><strong>{t('inquiry_ticket.field.created_by')}:</strong> {ticket.created_by?.name || '-'}</div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Context Sidebar Overlay */}
            {showContextSidebar && (
                <CustomerContextSidebar
                    customerId={ticket.customer_id || undefined}
                    customerName={ticket.customer_name}
                    serialNumber={ticket.serial_number}
                    onClose={() => setShowContextSidebar(false)}
                />
            )}
        </div>
    );
};

export default InquiryTicketDetailPage;
