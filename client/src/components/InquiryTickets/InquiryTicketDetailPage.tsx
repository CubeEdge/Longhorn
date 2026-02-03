import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Edit2, Save, X, ArrowUpCircle, RotateCcw, Loader2, Paperclip, Film, FileText, Download } from 'lucide-react';
import axios from 'axios';
import { useAuthStore } from '../../store/useAuthStore';
import { useConfirm } from '../../store/useConfirm';
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
    const confirm = useConfirm();

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
            <div className="flex justify-center items-center h-full">
                <Loader2 size={32} className="animate-spin text-white/20" />
            </div>
        );
    }

    if (!ticket) {
        return (
            <div className="flex flex-col items-center justify-center h-full text-white/30 space-y-4">
                <div className="text-lg">{t('inquiry_ticket.not_found')}</div>
                <button onClick={() => navigate(-1)} className="text-sm hover:text-white transition-colors">
                    {t('common.back')}
                </button>
            </div>
        );
    }

    return (
        <div className="flex h-full w-full overflow-hidden bg-black">
            {/* Left Column: Ticket Details (Scrollable) */}
            <div className="flex-1 flex flex-col min-w-0 h-full overflow-y-auto custom-scrollbar">
                {/* Header */}
                <div className="sticky top-0 z-10 bg-black/80 backdrop-blur-xl border-b border-white/5 px-8 py-5 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <button
                            onClick={() => navigate(-1)}
                            className="w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center transition-colors"
                        >
                            <ArrowLeft size={16} className="text-white/70" />
                        </button>

                        <div>
                            <div className="flex items-center gap-3">
                                <h1 className="text-xl font-bold tracking-tight text-white font-display">
                                    {ticket.ticket_number}
                                </h1>
                                <span
                                    className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border"
                                    style={{
                                        borderColor: `${statusColors[ticket.status]}30`,
                                        backgroundColor: `${statusColors[ticket.status]}10`,
                                        color: statusColors[ticket.status]
                                    }}
                                >
                                    {getStatusLabel(ticket.status)}
                                </span>
                            </div>
                            <div className="text-xs text-white/40 mt-0.5 font-mono">
                                {t('inquiry_ticket.created_at')}: {formatDate(ticket.created_at)}
                            </div>
                        </div>
                    </div>

                    <div className="flex gap-3">
                        {['Resolved', 'AutoClosed'].includes(ticket.status) && (
                            <button onClick={handleReopen} className="btn-secondary">
                                <RotateCcw size={14} className="mr-2" />
                                {t('inquiry_ticket.action.reopen')}
                            </button>
                        )}

                        {ticket.status !== 'Upgraded' && (
                            <button
                                onClick={handleUpgrade}
                                className="px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-medium text-white transition-all flex items-center gap-2"
                            >
                                <ArrowUpCircle size={14} className="text-kine-yellow" />
                                {t('inquiry_ticket.action.upgrade_rma')}
                            </button>
                        )}

                        {isEditing ? (
                            <>
                                <button onClick={() => setIsEditing(false)} className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-white/5">
                                    <X size={16} />
                                </button>
                                <button
                                    onClick={handleSave}
                                    className="px-3 py-1.5 rounded-lg bg-white text-black text-xs font-bold hover:bg-white/90 disabled:opacity-50 flex items-center gap-2"
                                    disabled={saving}
                                >
                                    {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                                    {t('action.save')}
                                </button>
                            </>
                        ) : (
                            <button
                                onClick={() => setIsEditing(true)}
                                className="w-8 h-8 rounded-lg bg-kine-yellow/10 text-kine-yellow hover:bg-kine-yellow/20 flex items-center justify-center transition-colors"
                            >
                                <Edit2 size={16} />
                            </button>
                        )}
                    </div>
                </div>

                {/* Content Body */}
                <div className="p-8 space-y-8 max-w-4xl">

                    {/* Problem Section */}
                    <div className="space-y-3 animate-slide-up" style={{ animationDelay: '0.1s' }}>
                        <h3 className="text-xs font-bold text-white/40 uppercase tracking-wider">
                            {t('inquiry_ticket.field.problem_summary')}
                        </h3>
                        <div className="p-5 rounded-2xl bg-white/5 border border-white/5 text-sm leading-relaxed text-white/90">
                            {ticket.problem_summary}
                        </div>
                    </div>

                    {/* Communication Log */}
                    <div className="space-y-3 animate-slide-up" style={{ animationDelay: '0.2s' }}>
                        <h3 className="text-xs font-bold text-white/40 uppercase tracking-wider">
                            {t('inquiry_ticket.field.communication_log')}
                        </h3>
                        {isEditing ? (
                            <textarea
                                value={communicationLog}
                                onChange={(e) => setCommunicationLog(e.target.value)}
                                className="w-full bg-black/20 border border-white/10 rounded-xl p-4 text-sm text-white focus:outline-none focus:border-white/30 transition-colors"
                                rows={8}
                            />
                        ) : (
                            <div className="p-5 rounded-2xl bg-white/[0.02] border border-white/5 font-mono text-xs leading-relaxed text-white/70 whitespace-pre-wrap">
                                {ticket.communication_log || t('inquiry_ticket.no_communication')}
                            </div>
                        )}
                    </div>

                    {/* Resolution */}
                    <div className="space-y-3 animate-slide-up" style={{ animationDelay: '0.3s' }}>
                        <h3 className="text-xs font-bold text-white/40 uppercase tracking-wider">
                            {t('inquiry_ticket.field.resolution')}
                        </h3>
                        {isEditing ? (
                            <div className="space-y-4">
                                <textarea
                                    value={resolution}
                                    onChange={(e) => setResolution(e.target.value)}
                                    className="w-full bg-black/20 border border-white/10 rounded-xl p-4 text-sm text-white focus:outline-none focus:border-white/30 transition-colors"
                                    rows={4}
                                    placeholder={t('inquiry_ticket.placeholder.resolution')}
                                />
                                <div className="flex items-center gap-3">
                                    <label className="text-xs text-white/50">{t('inquiry_ticket.field.status')}</label>
                                    <select
                                        value={status}
                                        onChange={(e) => setStatus(e.target.value)}
                                        className="bg-black/20 border border-white/10 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none"
                                    >
                                        <option value="InProgress">{t('inquiry_ticket.status.in_progress')}</option>
                                        <option value="AwaitingFeedback">{t('inquiry_ticket.status.awaiting_feedback')}</option>
                                        <option value="Resolved">{t('inquiry_ticket.status.resolved')}</option>
                                    </select>
                                </div>
                            </div>
                        ) : (
                            <div className="p-5 rounded-2xl bg-white/5 border border-white/5 text-sm leading-relaxed text-white/90">
                                {ticket.resolution || t('inquiry_ticket.no_resolution')}
                            </div>
                        )}
                    </div>

                    {/* Attachments */}
                    {ticket.attachments && ticket.attachments.length > 0 && (
                        <div className="space-y-3 animate-slide-up" style={{ animationDelay: '0.4s' }}>
                            <h3 className="text-xs font-bold text-white/40 uppercase tracking-wider flex items-center gap-2">
                                <Paperclip size={12} />
                                {t('section.media_attachments')}
                            </h3>
                            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
                                {ticket.attachments.map((file) => {
                                    const isImage = file.mime_type.startsWith('image/');
                                    const isVideo = file.mime_type.startsWith('video/');
                                    const isPdf = file.mime_type === 'application/pdf';

                                    return (
                                        <div key={file.id} className="group relative aspect-square rounded-xl overflow-hidden bg-white/5 border border-white/5 hover:border-white/20 transition-all">
                                            {isImage ? (
                                                <img src={file.file_path} alt="" className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity" />
                                            ) : (
                                                <div className="w-full h-full flex flex-col items-center justify-center gap-2 text-white/20 group-hover:text-white/50 transition-colors">
                                                    {isVideo ? <Film size={24} /> : isPdf ? <FileText size={24} /> : <Paperclip size={24} />}
                                                </div>
                                            )}

                                            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-end p-3">
                                                <div className="text-[10px] text-white/90 truncate font-medium">
                                                    {file.file_path.split('/').pop()}
                                                </div>
                                                <a
                                                    href={file.file_path}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="mt-1 flex items-center gap-1.5 text-[10px] text-kine-yellow hover:underline"
                                                >
                                                    <Download size={10} />
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
            </div>

            {/* Right Column: Customer Inspector (Fixed Width) */}
            <div className="w-[320px] h-full flex-shrink-0 border-l border-white/10 bg-[#1A1A1A]">
                <CustomerContextSidebar
                    customerId={ticket.customer_id || undefined}
                    customerName={ticket.customer_name}
                    serialNumber={ticket.serial_number}
                />
            </div>
        </div>
    );
};

export default InquiryTicketDetailPage;
