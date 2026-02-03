import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Edit2, Save, X, Plus, Loader2 } from 'lucide-react';
import axios from 'axios';
import { useAuthStore } from '../../store/useAuthStore';
import { useLanguage } from '../../i18n/useLanguage';

interface DealerRepair {
    id: number;
    ticket_number: string;
    repair_type: string;
    product: { id: number; name: string } | null;
    serial_number: string;
    customer_name: string;
    customer_contact: string;
    problem_description: string;
    diagnosis_result: string;
    repair_content: string;
    received_condition: string;
    accessories: string;
    labor_hours: number;
    labor_cost: number;
    parts_cost: number;
    total_cost: number;
    status: string;
    technician: { id: number; name: string } | null;
    created_by: { id: number; name: string } | null;
    inquiry_ticket: { id: number; ticket_number: string } | null;
    received_at: string;
    diagnosed_at: string;
    completed_at: string;
    returned_at: string;
    created_at: string;
    updated_at: string;
    parts_used: Array<{
        id: number;
        part_name: string;
        part_number: string;
        quantity: number;
        unit_price: number;
        total_price: number;
    }>;
}

const statusColors: Record<string, string> = {
    Received: '#f59e0b',
    Diagnosing: '#3b82f6',
    AwaitingParts: '#8b5cf6',
    InRepair: '#06b6d4',
    Completed: '#22c55e',
    Returned: '#10b981',
    Cancelled: '#6b7280'
};

const DealerRepairDetailPage: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const { token } = useAuthStore();
    const { t } = useLanguage();
    const navigate = useNavigate();

    const [repair, setRepair] = useState<DealerRepair | null>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [isEditing, setIsEditing] = useState(false);

    // Edit fields
    const [diagnosisResult, setDiagnosisResult] = useState('');
    const [repairContent, setRepairContent] = useState('');
    const [laborHours, setLaborHours] = useState(0);
    const [laborCost, setLaborCost] = useState(0);
    const [status, setStatus] = useState('');

    useEffect(() => {
        fetchRepair();
    }, [id]);

    const fetchRepair = async () => {
        setLoading(true);
        try {
            const res = await axios.get(`/api/v1/dealer-repairs/${id}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            if (res.data.success) {
                const data = res.data.data;
                setRepair(data);
                setDiagnosisResult(data.diagnosis_result || '');
                setRepairContent(data.repair_content || '');
                setLaborHours(data.labor_hours || 0);
                setLaborCost(data.labor_cost || 0);
                setStatus(data.status);
            }
        } catch (err) {
            console.error('Failed to fetch dealer repair:', err);
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async () => {
        if (!repair) return;
        setSaving(true);
        try {
            await axios.patch(`/api/v1/dealer-repairs/${id}`, {
                diagnosis_result: diagnosisResult,
                repair_content: repairContent,
                labor_hours: laborHours,
                labor_cost: laborCost,
                status
            }, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setIsEditing(false);
            fetchRepair();
        } catch (err) {
            console.error('Failed to update dealer repair:', err);
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
            Received: t('dealer_repair.status.received'),
            Diagnosing: t('dealer_repair.status.diagnosing'),
            AwaitingParts: t('dealer_repair.status.awaiting_parts'),
            InRepair: t('dealer_repair.status.in_repair'),
            Completed: t('dealer_repair.status.completed'),
            Returned: t('dealer_repair.status.returned'),
            Cancelled: t('dealer_repair.status.cancelled')
        };
        return labels[s] || s;
    };

    const getRepairTypeLabel = (type: string) => {
        const labels: Record<string, string> = {
            InWarranty: t('dealer_repair.type.in_warranty'),
            OutOfWarranty: t('dealer_repair.type.out_of_warranty'),
            Upgrade: t('dealer_repair.type.upgrade'),
            Maintenance: t('dealer_repair.type.maintenance')
        };
        return labels[type] || type;
    };

    if (loading) {
        return (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '400px' }}>
                <Loader2 size={32} className="animate-spin" />
            </div>
        );
    }

    if (!repair) {
        return (
            <div style={{ padding: '24px', textAlign: 'center' }}>
                <p>{t('dealer_repair.not_found')}</p>
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
                            {repair.ticket_number}
                            <span style={{
                                padding: '2px 8px',
                                borderRadius: '4px',
                                fontSize: '0.75rem',
                                fontWeight: 600,
                                background: '#dbeafe',
                                color: '#1d4ed8'
                            }}>
                                {getRepairTypeLabel(repair.repair_type)}
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
                                    background: `${statusColors[repair.status] || '#6b7280'}20`,
                                    color: statusColors[repair.status] || '#6b7280'
                                }}
                            >
                                {getStatusLabel(repair.status)}
                            </span>
                        </h1>
                        <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
                            {t('dealer_repair.created_at')}: {formatDate(repair.created_at)}
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
                            <span style={{ marginLeft: '6px' }}>{t('action.edit')}</span>
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
                        <h3 style={{ fontWeight: 600, marginBottom: '12px' }}>{t('dealer_repair.field.problem_description')}</h3>
                        <p style={{ lineHeight: 1.6 }}>{repair.problem_description}</p>
                    </div>

                    {/* Diagnosis & Repair */}
                    <div style={{
                        background: 'var(--bg-card)',
                        borderRadius: '12px',
                        padding: '20px',
                        marginBottom: '16px',
                        border: '1px solid var(--border-color)'
                    }}>
                        <h3 style={{ fontWeight: 600, marginBottom: '12px' }}>{t('dealer_repair.section.diagnosis_repair')}</h3>
                        {isEditing ? (
                            <>
                                <div style={{ marginBottom: '12px' }}>
                                    <label className="form-label">{t('dealer_repair.field.diagnosis_result')}</label>
                                    <textarea
                                        value={diagnosisResult}
                                        onChange={(e) => setDiagnosisResult(e.target.value)}
                                        className="form-control"
                                        rows={3}
                                    />
                                </div>
                                <div style={{ marginBottom: '12px' }}>
                                    <label className="form-label">{t('dealer_repair.field.repair_content')}</label>
                                    <textarea
                                        value={repairContent}
                                        onChange={(e) => setRepairContent(e.target.value)}
                                        className="form-control"
                                        rows={3}
                                    />
                                </div>
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '12px', marginBottom: '12px' }}>
                                    <div>
                                        <label className="form-label">{t('dealer_repair.field.labor_hours')}</label>
                                        <input
                                            type="number"
                                            value={laborHours}
                                            onChange={(e) => setLaborHours(parseFloat(e.target.value) || 0)}
                                            className="form-control"
                                            step="0.5"
                                        />
                                    </div>
                                    <div>
                                        <label className="form-label">{t('dealer_repair.field.labor_cost')}</label>
                                        <input
                                            type="number"
                                            value={laborCost}
                                            onChange={(e) => setLaborCost(parseFloat(e.target.value) || 0)}
                                            className="form-control"
                                            step="0.01"
                                        />
                                    </div>
                                </div>
                                <div>
                                    <label className="form-label">{t('dealer_repair.field.status')}</label>
                                    <select
                                        value={status}
                                        onChange={(e) => setStatus(e.target.value)}
                                        className="form-control"
                                        style={{ width: 'auto' }}
                                    >
                                        <option value="Received">{t('dealer_repair.status.received')}</option>
                                        <option value="Diagnosing">{t('dealer_repair.status.diagnosing')}</option>
                                        <option value="AwaitingParts">{t('dealer_repair.status.awaiting_parts')}</option>
                                        <option value="InRepair">{t('dealer_repair.status.in_repair')}</option>
                                        <option value="Completed">{t('dealer_repair.status.completed')}</option>
                                        <option value="Returned">{t('dealer_repair.status.returned')}</option>
                                    </select>
                                </div>
                            </>
                        ) : (
                            <div style={{ display: 'grid', gap: '12px', fontSize: '0.875rem' }}>
                                <div>
                                    <strong>{t('dealer_repair.field.diagnosis_result')}:</strong>
                                    <p style={{ marginTop: '4px', lineHeight: 1.5 }}>{repair.diagnosis_result || '-'}</p>
                                </div>
                                <div>
                                    <strong>{t('dealer_repair.field.repair_content')}:</strong>
                                    <p style={{ marginTop: '4px', lineHeight: 1.5 }}>{repair.repair_content || '-'}</p>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Parts Used */}
                    <div style={{
                        background: 'var(--bg-card)',
                        borderRadius: '12px',
                        padding: '20px',
                        border: '1px solid var(--border-color)'
                    }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                            <h3 style={{ fontWeight: 600 }}>{t('dealer_repair.section.parts_used')}</h3>
                        </div>
                        {repair.parts_used && repair.parts_used.length > 0 ? (
                            <table style={{ width: '100%', fontSize: '0.875rem', borderCollapse: 'collapse' }}>
                                <thead>
                                    <tr style={{ borderBottom: '1px solid var(--border-color)' }}>
                                        <th style={{ textAlign: 'left', padding: '8px 4px' }}>{t('dealer_repair.part.name')}</th>
                                        <th style={{ textAlign: 'left', padding: '8px 4px' }}>{t('dealer_repair.part.number')}</th>
                                        <th style={{ textAlign: 'right', padding: '8px 4px' }}>{t('dealer_repair.part.qty')}</th>
                                        <th style={{ textAlign: 'right', padding: '8px 4px' }}>{t('dealer_repair.part.price')}</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {repair.parts_used.map((part) => (
                                        <tr key={part.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                                            <td style={{ padding: '8px 4px' }}>{part.part_name}</td>
                                            <td style={{ padding: '8px 4px' }}>{part.part_number}</td>
                                            <td style={{ textAlign: 'right', padding: '8px 4px' }}>{part.quantity}</td>
                                            <td style={{ textAlign: 'right', padding: '8px 4px' }}>¥{part.total_price.toFixed(2)}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        ) : (
                            <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>{t('dealer_repair.no_parts')}</p>
                        )}
                    </div>
                </div>

                {/* Sidebar */}
                <div>
                    {/* Product Info */}
                    <div style={{
                        background: 'var(--bg-card)',
                        borderRadius: '12px',
                        padding: '20px',
                        marginBottom: '16px',
                        border: '1px solid var(--border-color)'
                    }}>
                        <h3 style={{ fontWeight: 600, marginBottom: '12px' }}>{t('dealer_repair.section.product')}</h3>
                        <div style={{ display: 'grid', gap: '8px', fontSize: '0.875rem' }}>
                            <div><strong>{t('dealer_repair.field.product')}:</strong> {repair.product?.name || '-'}</div>
                            <div><strong>{t('dealer_repair.field.serial_number')}:</strong> {repair.serial_number || '-'}</div>
                            <div><strong>{t('dealer_repair.field.received_condition')}:</strong> {repair.received_condition || '-'}</div>
                            <div><strong>{t('dealer_repair.field.accessories')}:</strong> {repair.accessories || '-'}</div>
                        </div>
                    </div>

                    {/* Customer Info */}
                    <div style={{
                        background: 'var(--bg-card)',
                        borderRadius: '12px',
                        padding: '20px',
                        marginBottom: '16px',
                        border: '1px solid var(--border-color)'
                    }}>
                        <h3 style={{ fontWeight: 600, marginBottom: '12px' }}>{t('dealer_repair.section.customer')}</h3>
                        <div style={{ display: 'grid', gap: '8px', fontSize: '0.875rem' }}>
                            <div><strong>{t('dealer_repair.field.customer_name')}:</strong> {repair.customer_name || '-'}</div>
                            <div><strong>{t('dealer_repair.field.customer_contact')}:</strong> {repair.customer_contact || '-'}</div>
                        </div>
                    </div>

                    {/* Cost Summary */}
                    <div style={{
                        background: 'var(--bg-card)',
                        borderRadius: '12px',
                        padding: '20px',
                        border: '1px solid var(--border-color)'
                    }}>
                        <h3 style={{ fontWeight: 600, marginBottom: '12px' }}>{t('dealer_repair.section.cost')}</h3>
                        <div style={{ display: 'grid', gap: '8px', fontSize: '0.875rem' }}>
                            <div><strong>{t('dealer_repair.field.labor_hours')}:</strong> {repair.labor_hours || 0}</div>
                            <div><strong>{t('dealer_repair.field.labor_cost')}:</strong> ¥{(repair.labor_cost || 0).toFixed(2)}</div>
                            <div><strong>{t('dealer_repair.field.parts_cost')}:</strong> ¥{(repair.parts_cost || 0).toFixed(2)}</div>
                            <div style={{ paddingTop: '8px', borderTop: '1px solid var(--border-color)', fontWeight: 600 }}>
                                <strong>{t('dealer_repair.field.total_cost')}:</strong> ¥{(repair.total_cost || 0).toFixed(2)}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default DealerRepairDetailPage;
