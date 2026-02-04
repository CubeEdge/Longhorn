import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Edit2, Save, Loader2 } from 'lucide-react';
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

const statusColors: Record<string, string> = {
    Received: '#6b7280',      // Gray
    Diagnosing: '#eab308',    // Yellow
    AwaitingParts: '#f97316', // Orange
    InRepair: '#3b82f6',      // Blue
    Completed: '#22c55e',     // Green
    Returned: '#8b5cf6'       // Purple
};

const DealerRepairDetailPage: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
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
            const data = response.data;
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
            await axios.put(`/api/dealer-repairs/${id}`, {
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
        <div style={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>
            {/* Main Content Area */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '40px', background: '#000' }}>
                <div style={{ maxWidth: '800px', margin: '0 auto' }}>
                    {/* Header */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '40px' }}>
                        <div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
                                <button onClick={() => navigate(-1)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#666', padding: 0 }}>
                                    <ArrowLeft size={24} />
                                </button>
                                <h1 style={{ fontSize: '1.5rem', fontWeight: 800, letterSpacing: '-0.02em', margin: 0 }}>
                                    {repair.ticket_number}
                                </h1>
                                <span style={{
                                    padding: '4px 12px',
                                    borderRadius: '100px',
                                    fontSize: '0.8rem',
                                    fontWeight: 600,
                                    background: '#dbeafe',
                                    color: '#1d4ed8',
                                    border: '1px solid #1d4ed840'
                                }}>
                                    {getRepairTypeLabel(repair.repair_type)}
                                </span>
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
                            </div>
                            <div style={{ display: 'flex', gap: '16px', fontSize: '0.85rem', color: '#666' }}>
                                <span>Created {formatDate(repair.created_at)}</span>
                                <span>•</span>
                                <span>{repair.customer_name}</span>
                            </div>
                        </div>

                        <div style={{ display: 'flex', gap: '12px' }}>
                            {isEditing ? (
                                <>
                                    <button onClick={() => setIsEditing(false)} className="btn btn-ghost">
                                        取消
                                    </button>
                                    <button onClick={handleSave} className="btn btn-primary" disabled={saving}>
                                        {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                                        <span style={{ marginLeft: '6px' }}>保存</span>
                                    </button>
                                </>
                            ) : (
                                <button onClick={() => setIsEditing(true)} className="btn btn-secondary">
                                    <Edit2 size={16} />
                                    <span style={{ marginLeft: '6px' }}>编辑</span>
                                </button>
                            )}
                        </div>
                    </div>

                    {/* Repair Body */}
                    <div className="ticket-body">
                        {/* Problem Description */}
                        <section style={{ marginBottom: '40px' }}>
                            <h2 style={{ fontSize: '1.1rem', fontWeight: 600, lineHeight: '1.4', marginBottom: '24px', color: '#fff' }}>
                                {repair.problem_description}
                            </h2>
                        </section>

                        {/* Diagnosis / Repair Section */}
                        <section style={{ marginBottom: '40px', padding: '24px', background: 'rgba(255,255,255,0.03)', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.05)' }}>
                            <h3 style={{ fontSize: '0.9rem', fontWeight: 600, color: '#888', textTransform: 'uppercase', marginBottom: '16px', letterSpacing: '0.05em' }}>
                                诊断与维修
                            </h3>

                            {isEditing ? (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                                    <div>
                                        <label className="form-label">Diagnosis Result</label>
                                        <textarea
                                            value={diagnosisResult}
                                            onChange={(e) => setDiagnosisResult(e.target.value)}
                                            className="form-control"
                                            rows={3}
                                        />
                                    </div>
                                    <div>
                                        <label className="form-label">Repair Content</label>
                                        <textarea
                                            value={repairContent}
                                            onChange={(e) => setRepairContent(e.target.value)}
                                            className="form-control"
                                            rows={3}
                                        />
                                    </div>
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                                        <div>
                                            <label className="form-label">Labor Hours</label>
                                            <input type="number" value={laborHours} onChange={e => setLaborHours(parseFloat(e.target.value))} className="form-control" />
                                        </div>
                                        <div>
                                            <label className="form-label">Labor Cost</label>
                                            <input type="number" value={laborCost} onChange={e => setLaborCost(parseFloat(e.target.value))} className="form-control" />
                                        </div>
                                    </div>
                                    <div>
                                        <label className="form-label">Status</label>
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
                                </div>
                            ) : (
                                <div style={{ display: 'grid', gap: '24px' }}>
                                    <div>
                                        <div style={{ fontSize: '0.8rem', color: '#666', marginBottom: '8px' }}>Diagnosis</div>
                                        <div style={{ lineHeight: '1.6', color: '#ccc' }}>{repair.diagnosis_result || 'Pending diagnosis'}</div>
                                    </div>
                                    {repair.repair_content && (
                                        <div>
                                            <div style={{ fontSize: '0.8rem', color: '#666', marginBottom: '8px' }}>Repair Content</div>
                                            <div style={{ lineHeight: '1.6', color: '#ccc' }}>{repair.repair_content}</div>
                                        </div>
                                    )}
                                    <div style={{ display: 'flex', gap: '24px', paddingTop: '16px', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                                        <div>
                                            <div style={{ fontSize: '0.8rem', color: '#666', marginBottom: '4px' }}>Hours</div>
                                            <div>{repair.labor_hours}h</div>
                                        </div>
                                        <div>
                                            <div style={{ fontSize: '0.8rem', color: '#666', marginBottom: '4px' }}>Labor</div>
                                            <div>¥{repair.labor_cost}</div>
                                        </div>
                                        <div>
                                            <div style={{ fontSize: '0.8rem', color: '#666', marginBottom: '4px' }}>Parts</div>
                                            <div>¥{repair.parts_cost}</div>
                                        </div>
                                        <div>
                                            <div style={{ fontSize: '0.8rem', color: '#666', marginBottom: '4px' }}>Total</div>
                                            <div style={{ color: '#FFD200', fontWeight: 600 }}>¥{repair.total_cost}</div>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </section>

                        {/* Parts Used Table */}
                        <section style={{ marginBottom: '40px' }}>
                            <h3 style={{ fontSize: '0.9rem', fontWeight: 600, color: '#888', textTransform: 'uppercase', marginBottom: '16px', letterSpacing: '0.05em' }}>
                                配件使用 ({repair.parts_used?.length || 0})
                            </h3>
                            {repair.parts_used && repair.parts_used.length > 0 ? (
                                <table style={{ width: '100%', fontSize: '0.85rem', borderCollapse: 'collapse', color: '#ccc' }}>
                                    <thead>
                                        <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.1)', color: '#666' }}>
                                            <th style={{ textAlign: 'left', padding: '8px' }}>Name</th>
                                            <th style={{ textAlign: 'left', padding: '8px' }}>P/N</th>
                                            <th style={{ textAlign: 'right', padding: '8px' }}>Qty</th>
                                            <th style={{ textAlign: 'right', padding: '8px' }}>Price</th>
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
                                <div style={{ color: '#666', fontStyle: 'italic' }}>No parts used.</div>
                            )}
                        </section>

                        {/* Metadata Grid */}
                        <section style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '24px', paddingTop: '24px', borderTop: '1px solid rgba(255,255,255,0.1)' }}>
                            <div>
                                <div style={{ fontSize: '0.8rem', color: '#666', marginBottom: '4px' }}>Customer</div>
                                <div>{repair.customer_name}</div>
                                <div style={{ fontSize: '0.8rem', color: '#666' }}>{repair.customer_contact}</div>
                            </div>
                            <div>
                                <div style={{ fontSize: '0.8rem', color: '#666', marginBottom: '4px' }}>Technician</div>
                                <div>{repair.technician?.name || '-'}</div>
                            </div>
                            <div>
                                <div style={{ fontSize: '0.8rem', color: '#666', marginBottom: '4px' }}>Condition</div>
                                <div>{repair.received_condition || '-'}</div>
                            </div>
                        </section>
                    </div>
                </div>
            </div>

            {/* Right Sidebar - Customer Context */}
            <div style={{ width: '320px', flexShrink: 0, borderLeft: '1px solid #1c1c1e', background: '#000', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                <CustomerContextSidebar
                    customerId={repair.customer_id}
                    customerName={repair.customer_name}
                    serialNumber={repair.serial_number}
                />
            </div>
        </div>
    );
};

export default DealerRepairDetailPage;
