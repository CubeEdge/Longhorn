import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Edit2, Save, X, Loader2 } from 'lucide-react';
import axios from 'axios';
import { useAuthStore } from '../../store/useAuthStore';
import { useLanguage } from '../../i18n/useLanguage';

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
    dealer: { id: number; name: string } | null;
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
}

const statusColors: Record<string, string> = {
    Pending: '#f59e0b',
    Assigned: '#3b82f6',
    InRepair: '#8b5cf6',
    Repaired: '#10b981',
    Shipped: '#06b6d4',
    Completed: '#22c55e',
    Cancelled: '#6b7280'
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
        return new Date(dateStr).toLocaleString('zh-CN');
    };

    const getStatusLabel = (s: string) => {
        const labels: Record<string, string> = {
            Pending: t('rma_ticket.status.pending'),
            Assigned: t('rma_ticket.status.assigned'),
            InRepair: t('rma_ticket.status.in_repair'),
            Repaired: t('rma_ticket.status.repaired'),
            Shipped: t('rma_ticket.status.shipped'),
            Completed: t('rma_ticket.status.completed'),
            Cancelled: t('rma_ticket.status.cancelled')
        };
        return labels[s] || s;
    };

    const getChannelLabel = (code: string) => {
        const labels: Record<string, string> = {
            D: t('rma_ticket.channel.dealer'),
            C: t('rma_ticket.channel.customer'),
            I: t('rma_ticket.channel.internal')
        };
        return labels[code] || code;
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
                <p>{t('rma_ticket.not_found')}</p>
            </div>
        );
    }

    return (
        <div style={{ padding: '24px', maxWidth: '1000px', margin: '0 auto' }}>
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                    <button onClick={() => navigate(-1)} className="btn btn-ghost btn-sm">
                        <ArrowLeft size={18} />
                    </button>
                    <div>
                        <h1 style={{ fontSize: '1.5rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '12px' }}>
                            {ticket.ticket_number}
                            <span style={{
                                padding: '2px 8px',
                                borderRadius: '4px',
                                fontSize: '0.75rem',
                                fontWeight: 600,
                                background: '#e5e7eb',
                                color: '#374151'
                            }}>
                                {getChannelLabel(ticket.channel_code)}
                            </span>
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
                            {t('rma_ticket.created_at')}: {formatDate(ticket.created_at)}
                        </p>
                    </div>
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
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
                    {/* Problem Description */}
                    <div style={{
                        background: 'var(--bg-card)',
                        borderRadius: '12px',
                        padding: '20px',
                        marginBottom: '16px',
                        border: '1px solid var(--border-color)'
                    }}>
                        <h3 style={{ fontWeight: 600, marginBottom: '12px' }}>{t('rma_ticket.field.problem_description')}</h3>
                        <p style={{ lineHeight: 1.6 }}>{ticket.problem_description}</p>
                    </div>

                    {/* Solution for Customer */}
                    <div style={{
                        background: 'var(--bg-card)',
                        borderRadius: '12px',
                        padding: '20px',
                        marginBottom: '16px',
                        border: '1px solid var(--border-color)'
                    }}>
                        <h3 style={{ fontWeight: 600, marginBottom: '12px' }}>{t('rma_ticket.field.solution_for_customer')}</h3>
                        {isEditing ? (
                            <textarea
                                value={solutionForCustomer}
                                onChange={(e) => setSolutionForCustomer(e.target.value)}
                                className="form-control"
                                rows={3}
                            />
                        ) : (
                            <p style={{ lineHeight: 1.6 }}>{ticket.solution_for_customer || '-'}</p>
                        )}
                    </div>

                    {/* Repair Info */}
                    <div style={{
                        background: 'var(--bg-card)',
                        borderRadius: '12px',
                        padding: '20px',
                        border: '1px solid var(--border-color)'
                    }}>
                        <h3 style={{ fontWeight: 600, marginBottom: '12px' }}>{t('rma_ticket.section.repair')}</h3>
                        {isEditing ? (
                            <>
                                <div style={{ marginBottom: '12px' }}>
                                    <label className="form-label">{t('rma_ticket.field.repair_content')}</label>
                                    <textarea
                                        value={repairContent}
                                        onChange={(e) => setRepairContent(e.target.value)}
                                        className="form-control"
                                        rows={2}
                                    />
                                </div>
                                <div style={{ marginBottom: '12px' }}>
                                    <label className="form-label">{t('rma_ticket.field.problem_analysis')}</label>
                                    <textarea
                                        value={problemAnalysis}
                                        onChange={(e) => setProblemAnalysis(e.target.value)}
                                        className="form-control"
                                        rows={2}
                                    />
                                </div>
                                <div>
                                    <label className="form-label">{t('rma_ticket.field.status')}</label>
                                    <select
                                        value={status}
                                        onChange={(e) => setStatus(e.target.value)}
                                        className="form-control"
                                        style={{ width: 'auto' }}
                                    >
                                        <option value="Pending">{t('rma_ticket.status.pending')}</option>
                                        <option value="Assigned">{t('rma_ticket.status.assigned')}</option>
                                        <option value="InRepair">{t('rma_ticket.status.in_repair')}</option>
                                        <option value="Repaired">{t('rma_ticket.status.repaired')}</option>
                                        <option value="Shipped">{t('rma_ticket.status.shipped')}</option>
                                        <option value="Completed">{t('rma_ticket.status.completed')}</option>
                                    </select>
                                </div>
                            </>
                        ) : (
                            <div style={{ display: 'grid', gap: '8px', fontSize: '0.875rem' }}>
                                <div><strong>{t('rma_ticket.field.repair_content')}:</strong> {ticket.repair_content || '-'}</div>
                                <div><strong>{t('rma_ticket.field.problem_analysis')}:</strong> {ticket.problem_analysis || '-'}</div>
                            </div>
                        )}
                    </div>
                </div>

                {/* Sidebar */}
                <div>
                    {/* Classification */}
                    <div style={{
                        background: 'var(--bg-card)',
                        borderRadius: '12px',
                        padding: '20px',
                        marginBottom: '16px',
                        border: '1px solid var(--border-color)'
                    }}>
                        <h3 style={{ fontWeight: 600, marginBottom: '12px' }}>{t('rma_ticket.section.classification')}</h3>
                        <div style={{ display: 'grid', gap: '8px', fontSize: '0.875rem' }}>
                            <div><strong>{t('rma_ticket.field.issue_type')}:</strong> {ticket.issue_type}</div>
                            <div><strong>{t('rma_ticket.field.issue_category')}:</strong> {ticket.issue_category || '-'}</div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                <strong>{t('rma_ticket.field.severity')}:</strong>
                                <span style={{ color: ticket.severity === 1 ? '#ef4444' : ticket.severity === 2 ? '#f59e0b' : '#6b7280' }}>
                                    P{ticket.severity}
                                </span>
                            </div>
                            <div><strong>{t('rma_ticket.field.is_warranty')}:</strong> {ticket.is_warranty ? '✅' : '❌'}</div>
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
                        <h3 style={{ fontWeight: 600, marginBottom: '12px' }}>{t('rma_ticket.section.product')}</h3>
                        <div style={{ display: 'grid', gap: '8px', fontSize: '0.875rem' }}>
                            <div><strong>{t('rma_ticket.field.product')}:</strong> {ticket.product?.name || '-'}</div>
                            <div><strong>{t('rma_ticket.field.serial_number')}:</strong> {ticket.serial_number || '-'}</div>
                            <div><strong>{t('rma_ticket.field.firmware_version')}:</strong> {ticket.firmware_version || '-'}</div>
                        </div>
                    </div>

                    {/* People */}
                    <div style={{
                        background: 'var(--bg-card)',
                        borderRadius: '12px',
                        padding: '20px',
                        border: '1px solid var(--border-color)'
                    }}>
                        <h3 style={{ fontWeight: 600, marginBottom: '12px' }}>{t('rma_ticket.section.people')}</h3>
                        <div style={{ display: 'grid', gap: '8px', fontSize: '0.875rem' }}>
                            <div><strong>{t('rma_ticket.field.reporter_name')}:</strong> {ticket.reporter_name || '-'}</div>
                            {ticket.dealer && <div><strong>{t('rma_ticket.field.dealer')}:</strong> {ticket.dealer.name}</div>}
                            <div><strong>{t('rma_ticket.field.submitted_by')}:</strong> {ticket.submitted_by?.name || '-'}</div>
                            <div><strong>{t('rma_ticket.field.assigned_to')}:</strong> {ticket.assigned_to?.name || '-'}</div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default RMATicketDetailPage;
