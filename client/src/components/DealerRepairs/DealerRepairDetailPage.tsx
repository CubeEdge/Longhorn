import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Edit2, Save, Loader2, AlertCircle, Hammer, Package, Clock } from 'lucide-react';
import axios from 'axios';
import { useAuthStore } from '../../store/useAuthStore';
import { useLanguage } from '../../i18n/useLanguage';
import { useRouteMemoryStore } from '../../store/useRouteMemoryStore';
import CustomerContextSidebar from '../Service/CustomerContextSidebar';
import DealerInfoCard from '../Service/DealerInfoCard';

interface Attachment {
    id: number;
    file_path: string;
    mime_type: string;
    size: number;
    created_at: string;
}

interface DealerRepair {
    id: number;
    ticket_number: string;
    repair_type: 'InWarranty' | 'OutOfWarranty' | 'Upgrade' | 'Maintenance';
    problem_description: string;
    status: 'Received' | 'Diagnosing' | 'AwaitingParts' | 'InRepair' | 'Completed' | 'Returned';

    // Metadata
    created_at: string;
    customer_name: string;
    customer_contact: string;
    customer_id?: number;
    technician?: {
        name: string;
    };

    // Dealer Info
    dealer?: {
        id: number;
        name: string;
        code?: string;
    };
    dealer_id?: number;
    dealer_name?: string;
    dealer_code?: string;
    dealer_contact_name?: string;
    dealer_contact_title?: string;

    // Account/Contact Info (新架构)
    account_id?: number;
    contact_id?: number;
    account?: {
        id: number;
        name: string;
        account_type?: string;
    };
    contact?: {
        id: number;
        name: string;
        email?: string;
        job_title?: string;
    };

    // Product Info
    product?: {
        name: string;
    };
    serial_number: string;
    received_condition?: string;
    accessories?: string;

    // Diagnosis & Repair
    diagnosis_result?: string;
    repair_content?: string;
    labor_hours?: number;
    labor_cost?: number;
    parts_cost?: number;
    total_cost?: number;

    // Relations
    parts_used?: Array<{
        id: number;
        part_name: string;
        part_number: string;
        quantity: number;
        total_price: number;
    }>;
    attachments?: Attachment[];
}

// Status colors aligned with Dashboard (ServiceTopBarStats)
const statusColors: Record<string, string> = {
    Received: '#f59e0b',      // 已收货 - Orange (same as Dashboard)
    Diagnosing: '#8b5cf6',    // 检测中 - Purple (same as Dashboard)
    AwaitingParts: '#f97316', // 待配件 - Orange
    InRepair: '#3b82f6',      // 维修中 - Blue (same as Dashboard)
    Completed: '#10b981',     // 已完成 - Green (same as Dashboard)
    Returned: '#8b5cf6'       // 已退回 - Purple
};

const DealerRepairDetailPage: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const getRoute = useRouteMemoryStore(state => state.getRoute);
    const { token } = useAuthStore();
    const { t } = useLanguage();

    const [repair, setRepair] = useState<DealerRepair | null>(null);
    const [loading, setLoading] = useState(true);
    const [isEditing, setIsEditing] = useState(false);
    const [saving, setSaving] = useState(false);

    // Form States
    const [diagnosisResult, setDiagnosisResult] = useState('');
    const [repairContent, setRepairContent] = useState('');
    const [laborHours, setLaborHours] = useState(0);
    const [laborCost, setLaborCost] = useState(0);
    const [status, setStatus] = useState<string>('');

    useEffect(() => {
        fetchRepair();
    }, [id]);

    const fetchRepair = async () => {
        try {
            const response = await axios.get(`/api/v1/dealer-repairs/${id}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            const data = response.data.data;
            setRepair(data);

            // Init Form
            setDiagnosisResult(data.diagnosis_result || '');
            setRepairContent(data.repair_content || '');
            setLaborHours(data.labor_hours || 0);
            setLaborCost(data.labor_cost || 0);
            setStatus(data.status);
        } catch (error) {
            console.error('Error fetching repair:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async () => {
        setSaving(true);
        try {
            await axios.put(`/api/v1/dealer-repairs/${id}`, {
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
        } catch (error) {
            console.error('Error updating repair:', error);
        } finally {
            setSaving(false);
        }
    };

    const formatDate = (dateString: string) => {
        return new Date(dateString).toLocaleString('zh-CN', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    const getStatusLabel = (s: string) => {
        const labels: Record<string, string> = {
            Received: t('dealer_repair.status.received'),
            Diagnosing: t('dealer_repair.status.diagnosing'),
            AwaitingParts: t('dealer_repair.status.awaiting_parts'),
            InRepair: t('dealer_repair.status.in_repair'),
            Completed: t('dealer_repair.status.completed'),
            Returned: t('dealer_repair.status.returned')
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
                            onClick={() => navigate(getRoute('/service/dealer-repairs'))}
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
                            {repair.ticket_number}
                        </h1>

                        <span style={{
                            padding: '4px 12px',
                            borderRadius: '100px',
                            fontSize: '0.8rem',
                            fontWeight: 600,
                            background: `${statusColors[repair.status] || '#666'}20`,
                            color: statusColors[repair.status] || '#666',
                            border: `1px solid ${statusColors[repair.status] || '#666'}40`
                        }}>
                            {getStatusLabel(repair.status)}
                        </span>

                        <div style={{ flex: 1 }} />

                        {/* Actions */}
                        <div style={{ display: 'flex', gap: '12px' }}>
                            {isEditing ? (
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
                                        {t('common.cancel') || 'Cancel'}
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
                                        {saving ? 'Saving...' : (t('common.save') || 'Save')}
                                    </button>
                                </>
                            ) : (
                                <button
                                    onClick={() => setIsEditing(true)}
                                    className="btn-kine-lowkey"
                                >
                                    <Edit2 size={16} />
                                    {t('common.edit') || 'Edit'}
                                </button>
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
                                    <div className="ticket-info-value">{formatDate(repair.created_at)}</div>
                                </div>
                                <div className="ticket-info-item">
                                    <div className="ticket-info-label">{t('ticket.contact')}</div>
                                    <div className="ticket-info-value">{repair.contact?.name || repair.customer_name || '-'}</div>
                                </div>
                                <div className="ticket-info-item">
                                    <div className="ticket-info-label">{t('ticket.product')}</div>
                                    <div className="ticket-info-value">{repair.product?.name || '-'}</div>
                                </div>
                                <div className="ticket-info-item">
                                    <div className="ticket-info-label">{t('ticket.serial_number')}</div>
                                    <div className="ticket-info-value">{repair.serial_number || '-'}</div>
                                </div>
                                <div className="ticket-info-item">
                                    <div className="ticket-info-label">{t('dealer_repair.technician')}</div>
                                    <div className="ticket-info-value">{repair.technician?.name || '-'}</div>
                                </div>
                                <div className="ticket-info-item">
                                    <div className="ticket-info-label">{t('dealer_repair.condition')}</div>
                                    <div className="ticket-info-value">{repair.received_condition || '-'}</div>
                                </div>
                                <div className="ticket-info-item">
                                    <div className="ticket-info-label">{t('dealer_repair.repair_type')}</div>
                                    <div className="ticket-info-value">{getRepairTypeLabel(repair.repair_type)}</div>
                                </div>
                                <div className="ticket-info-item">
                                    <div className="ticket-info-label">{t('dealer_repair.status')}</div>
                                    <div className="ticket-info-value">{getStatusLabel(repair.status)}</div>
                                </div>
                            </div>
                        </div>

                        {/* Problem Card - 问题描述卡片 (第二个卡片) */}
                        <div className="ticket-card">
                            <div className="ticket-card-title">
                                <AlertCircle size={14} /> {t('ticket.problem_description')}
                            </div>
                            <h2 className="ticket-section-title">{repair.problem_description}</h2>
                        </div>

                        {/* Diagnosis & Repair Card - 诊断与维修卡片 (第三个卡片) */}
                        <div className="ticket-card">
                            <div className="ticket-card-title">
                                <Hammer size={14} /> {t('dealer_repair.diagnosis_repair')}
                            </div>
                            {isEditing ? (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                                    <div>
                                        <div className="ticket-info-label" style={{ marginBottom: '8px' }}>{t('dealer_repair.diagnosis_result')}</div>
                                        <textarea
                                            value={diagnosisResult}
                                            onChange={(e) => setDiagnosisResult(e.target.value)}
                                            className="ticket-textarea"
                                            rows={3}
                                        />
                                    </div>
                                    <div>
                                        <div className="ticket-info-label" style={{ marginBottom: '8px' }}>{t('dealer_repair.repair_content')}</div>
                                        <textarea
                                            value={repairContent}
                                            onChange={(e) => setRepairContent(e.target.value)}
                                            className="ticket-textarea"
                                            rows={3}
                                        />
                                    </div>
                                    <div className="ticket-info-grid">
                                        <div>
                                            <div className="ticket-info-label" style={{ marginBottom: '8px' }}>{t('dealer_repair.labor_hours')}</div>
                                            <input type="number" value={laborHours} onChange={e => setLaborHours(parseFloat(e.target.value))} className="ticket-textarea" style={{ minHeight: '40px' }} />
                                        </div>
                                        <div>
                                            <div className="ticket-info-label" style={{ marginBottom: '8px' }}>{t('dealer_repair.labor_cost')}</div>
                                            <input type="number" value={laborCost} onChange={e => setLaborCost(parseFloat(e.target.value))} className="ticket-textarea" style={{ minHeight: '40px' }} />
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                <div style={{ display: 'grid', gap: '24px' }}>
                                    <div>
                                        <div className="ticket-info-label" style={{ marginBottom: '8px' }}>{t('dealer_repair.diagnosis_result')}</div>
                                        <div className="ticket-content-box">
                                            <p style={{ color: 'var(--text-secondary)', lineHeight: '1.6', margin: 0 }}>
                                                {repair.diagnosis_result || t('dealer_repair.pending_diagnosis')}
                                            </p>
                                        </div>
                                    </div>
                                    {repair.repair_content && (
                                        <div>
                                            <div className="ticket-info-label" style={{ marginBottom: '8px' }}>{t('dealer_repair.repair_content')}</div>
                                            <div className="ticket-content-box">
                                                <p style={{ color: 'var(--text-secondary)', lineHeight: '1.6', margin: 0 }}>
                                                    {repair.repair_content}
                                                </p>
                                            </div>
                                        </div>
                                    )}
                                    <div className="ticket-info-grid" style={{ paddingTop: '16px', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                                        <div className="ticket-info-item">
                                            <div className="ticket-info-label">{t('dealer_repair.labor_hours')}</div>
                                            <div className="ticket-info-value">{repair.labor_hours}h</div>
                                        </div>
                                        <div className="ticket-info-item">
                                            <div className="ticket-info-label">{t('dealer_repair.labor_cost')}</div>
                                            <div className="ticket-info-value">¥{repair.labor_cost}</div>
                                        </div>
                                        <div className="ticket-info-item">
                                            <div className="ticket-info-label">{t('dealer_repair.parts_cost')}</div>
                                            <div className="ticket-info-value">¥{repair.parts_cost}</div>
                                        </div>
                                        <div className="ticket-info-item">
                                            <div className="ticket-info-label">{t('dealer_repair.total_cost')}</div>
                                            <div className="ticket-info-value" style={{ color: '#FFD200' }}>¥{repair.total_cost}</div>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Parts Used Card - 配件使用卡片 */}
                        <div className="ticket-card">
                            <div className="ticket-card-title">
                                <Package size={14} /> {t('dealer_repair.parts_used')} ({repair.parts_used?.length || 0})
                            </div>
                            {repair.parts_used && repair.parts_used.length > 0 ? (
                                <table style={{ width: '100%', fontSize: '0.85rem', borderCollapse: 'collapse', color: '#ccc' }}>
                                    <thead>
                                        <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.4)' }}>
                                            <th style={{ textAlign: 'left', padding: '8px', fontWeight: 600 }}>{t('dealer_repair.part_name')}</th>
                                            <th style={{ textAlign: 'left', padding: '8px', fontWeight: 600 }}>{t('dealer_repair.part_number')}</th>
                                            <th style={{ textAlign: 'right', padding: '8px', fontWeight: 600 }}>{t('dealer_repair.quantity')}</th>
                                            <th style={{ textAlign: 'right', padding: '8px', fontWeight: 600 }}>{t('dealer_repair.price')}</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {repair.parts_used.map((part) => (
                                            <tr key={part.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                                                <td style={{ padding: '8px' }}>{part.part_name}</td>
                                                <td style={{ padding: '8px', fontFamily: 'monospace' }}>{part.part_number}</td>
                                                <td style={{ textAlign: 'right', padding: '8px' }}>{part.quantity}</td>
                                                <td style={{ textAlign: 'right', padding: '8px' }}>¥{part.total_price.toFixed(2)}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            ) : (
                                <div style={{ color: 'rgba(255,255,255,0.4)', fontStyle: 'italic' }}>{t('dealer_repair.no_parts_used')}</div>
                            )}
                        </div>

                    </div>
                </div>

                {/* Right Sidebar - Customer Context */}
                <div style={{ width: '320px', flexShrink: 0, borderLeft: '1px solid #1c1c1e', background: '#000', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                {/* Dealer Info Card */}
                <div style={{ padding: '20px', paddingBottom: 0 }}>
                    <DealerInfoCard
                        dealerId={repair.dealer_id || repair.dealer?.id}
                        dealerName={repair.dealer_name || repair.dealer?.name}
                        dealerCode={repair.dealer_code || repair.dealer?.code}
                        contactName={repair.dealer_contact_name}
                        contactTitle={repair.dealer_contact_title}
                    />
                </div>
                
                <CustomerContextSidebar
                    accountId={repair.account_id}
                    accountName={repair.account?.name}
                    customerId={repair.customer_id}
                    customerName={repair.customer_name}
                    serialNumber={repair.serial_number}
                    dealerId={repair.dealer_id || repair.dealer?.id}
                />
            </div>
        </div>
        </div>
    );
};

export default DealerRepairDetailPage;
