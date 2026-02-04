import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
    ArrowLeft, Edit2, Save, Loader2,
    AlertCircle, CheckCircle, Clock, Truck, Hammer, XCircle,
    Activity, FileText, Download
} from 'lucide-react';
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
    customer: { id: number; name: string } | null;
    customer_id: number | null;
    dealer: { id: number; name: string } | null;
    dealer_id: number | null;
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

const statusConfig: Record<string, { color: string, icon: any }> = {
    Pending: { color: '#f59e0b', icon: Clock },
    Assigned: { color: '#3b82f6', icon: Activity },
    InRepair: { color: '#8b5cf6', icon: Hammer },
    Repaired: { color: '#10b981', icon: CheckCircle },
    Shipped: { color: '#06b6d4', icon: Truck },
    Completed: { color: '#22c55e', icon: CheckCircle },
    Cancelled: { color: '#6b7280', icon: XCircle }
};

const RMATicketDetailPage: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const { token } = useAuthStore();
    const { t } = useLanguage();
    const navigate = useNavigate();

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
        return t(`rma_ticket.status.${s.toLowerCase()}` as any) || s;
    };

    const getChannelLabel = (code: string) => {
        const labels: Record<string, string> = {
            D: t('rma_ticket.channel.dealer'),
            C: t('rma_ticket.channel.customer'),
            I: t('rma_ticket.channel.internal')
        };
        return labels[code] || code;
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
                            onClick={() => navigate('/service/rma-tickets')}
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

                        <div style={{ display: 'flex', gap: '16px', fontSize: '0.85rem', color: 'var(--text-secondary)', marginLeft: '12px' }}>
                            <span>{formatDate(ticket.created_at)}</span>
                            <span style={{ color: 'var(--glass-border)' }}>|</span>
                            <span>{getChannelLabel(ticket.channel_code)}</span>
                        </div>

                        <div style={{ flex: 1 }} />

                        {/* Actions */}
                        <div style={{ display: 'flex', gap: '12px' }}>
                            {!isEditing ? (
                                <button
                                    onClick={() => setIsEditing(true)}
                                    style={{
                                        display: 'flex', alignItems: 'center', gap: '6px',
                                        background: '#fff',
                                        border: 'none',
                                        color: '#000',
                                        padding: '8px 24px',
                                        borderRadius: '8px',
                                        fontWeight: 600,
                                        cursor: 'pointer'
                                    }}
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

                    {/* Content Body */}
                    <div style={{ padding: '40px', maxWidth: '1000px', margin: '0 auto', width: '100%' }}>
                        {/* Problem Description Hero */}
                        <div style={{ marginBottom: '40px' }}>
                            <h2 style={{
                                fontSize: '1.5rem', fontWeight: 800, lineHeight: '1.3',
                                color: '#fff', marginBottom: '24px', letterSpacing: '-0.01em'
                            }}>
                                {ticket.problem_description}
                            </h2>

                            {/* Meta Grid */}
                            <div style={{
                                display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '16px',
                                background: 'rgba(255,255,255,0.03)', padding: '20px', borderRadius: '16px',
                                border: '1px solid rgba(255,255,255,0.08)'
                            }}>
                                <div>
                                    <div style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', textTransform: 'uppercase', marginBottom: '6px', fontWeight: 600 }}>Issue Type</div>
                                    <div style={{ color: 'var(--text-main)', fontWeight: 500 }}>{ticket.issue_type}</div>
                                </div>
                                <div>
                                    <div style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', textTransform: 'uppercase', marginBottom: '6px', fontWeight: 600 }}>Severity</div>
                                    <div style={{ color: ticket.severity === 1 ? '#ef4444' : 'var(--text-main)', fontWeight: 700 }}>P{ticket.severity}</div>
                                </div>
                                <div>
                                    <div style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', textTransform: 'uppercase', marginBottom: '6px', fontWeight: 600 }}>Warranty</div>
                                    <div style={{ color: ticket.is_warranty ? '#10b981' : 'var(--text-tertiary)', fontWeight: 500 }}>
                                        {ticket.is_warranty ? 'Yes' : 'No'}
                                    </div>
                                </div>
                                <div>
                                    <div style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', textTransform: 'uppercase', marginBottom: '6px', fontWeight: 600 }}>Reporter</div>
                                    <div style={{ color: 'var(--text-main)', fontWeight: 500 }}>{ticket.reporter_name}</div>
                                </div>
                            </div>
                        </div>

                        <div style={{ display: 'grid', gap: '32px' }}>
                            {/* Customer Solution */}
                            <div className="glass-panel" style={{
                                padding: '24px',
                                borderRadius: '16px',
                                background: 'rgba(30, 30, 30, 0.6)',
                                border: '1px solid rgba(255, 255, 255, 0.08)'
                            }}>
                                <h3 style={{
                                    fontSize: '1.1rem', fontWeight: 600, marginBottom: '20px',
                                    display: 'flex', alignItems: 'center', gap: '8px', color: '#fff'
                                }}>
                                    <CheckCircle size={18} className="text-primary" />
                                    {t('ticket.solution_for_customer' as any)}
                                </h3>
                                {isEditing ? (
                                    <textarea
                                        value={solutionForCustomer}
                                        onChange={(e) => setSolutionForCustomer(e.target.value)}
                                        placeholder="Enter solution visible to customer..."
                                        style={{
                                            width: '100%', minHeight: '120px', padding: '16px',
                                            borderRadius: '8px', background: 'rgba(0,0,0,0.3)',
                                            border: '1px solid rgba(255,255,255,0.1)', color: '#fff',
                                            fontSize: '0.95rem', lineHeight: 1.6, resize: 'vertical'
                                        }}
                                    />
                                ) : (
                                    <div style={{
                                        color: solutionForCustomer ? 'var(--text-primary)' : 'var(--text-tertiary)',
                                        whiteSpace: 'pre-wrap', lineHeight: 1.6, fontSize: '0.95rem',
                                        padding: '16px', background: 'rgba(0,0,0,0.2)', borderRadius: '8px'
                                    }}>
                                        {solutionForCustomer || 'No solution provided yet.'}
                                    </div>
                                )}
                            </div>

                            {/* Internal Tech Notes */}
                            <div className="glass-panel" style={{
                                padding: '24px',
                                borderRadius: '16px',
                                background: 'rgba(30, 30, 30, 0.4)',
                                border: '1px solid rgba(255, 255, 255, 0.08)'
                            }}>
                                <h3 style={{
                                    fontSize: '1rem', fontWeight: 600, marginBottom: '20px',
                                    display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-secondary)'
                                }}>
                                    <Hammer size={16} />
                                    Internal Tech Notes & Analysis
                                </h3>

                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
                                    <div>
                                        <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-tertiary)', marginBottom: '8px' }}>
                                            Problem Analysis
                                        </label>
                                        {isEditing ? (
                                            <textarea
                                                value={problemAnalysis}
                                                onChange={(e) => setProblemAnalysis(e.target.value)}
                                                placeholder="Internal analysis..."
                                                style={{
                                                    width: '100%', minHeight: '150px', padding: '12px',
                                                    borderRadius: '8px', background: 'rgba(0,0,0,0.3)',
                                                    border: '1px solid rgba(255,255,255,0.1)', color: '#fff',
                                                    fontSize: '0.9rem', resize: 'vertical'
                                                }}
                                            />
                                        ) : (
                                            <div style={{
                                                fontSize: '0.9rem', color: 'var(--text-secondary)',
                                                whiteSpace: 'pre-wrap', padding: '12px', background: 'rgba(0,0,0,0.2)', borderRadius: '8px', minHeight: '60px'
                                            }}>
                                                {problemAnalysis || '-'}
                                            </div>
                                        )}
                                    </div>
                                    <div>
                                        <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-tertiary)', marginBottom: '8px' }}>
                                            Repair Actions
                                        </label>
                                        {isEditing ? (
                                            <textarea
                                                value={repairContent}
                                                onChange={(e) => setRepairContent(e.target.value)}
                                                placeholder="Repair steps taken..."
                                                style={{
                                                    width: '100%', minHeight: '150px', padding: '12px',
                                                    borderRadius: '8px', background: 'rgba(0,0,0,0.3)',
                                                    border: '1px solid rgba(255,255,255,0.1)', color: '#fff',
                                                    fontSize: '0.9rem', resize: 'vertical'
                                                }}
                                            />
                                        ) : (
                                            <div style={{
                                                fontSize: '0.9rem', color: 'var(--text-secondary)',
                                                whiteSpace: 'pre-wrap', padding: '12px', background: 'rgba(0,0,0,0.2)', borderRadius: '8px', minHeight: '60px'
                                            }}>
                                                {repairContent || '-'}
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
                </div>

                {/* RIGHT SIDEBAR: Customer Context */}
                {/* RIGHT SIDEBAR: Customer Context */}
                <div style={{ width: '320px', flexShrink: 0, borderLeft: '1px solid #1c1c1e', background: '#000', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                    <CustomerContextSidebar
                        customerId={ticket.customer_id ?? undefined}
                        customerName={ticket.customer?.name}
                        serialNumber={ticket.serial_number}
                        // @ts-ignore
                        dealerId={ticket.dealer_id ?? undefined}
                    />
                </div>

            </div>
        </div>
    );
};

export default RMATicketDetailPage;
