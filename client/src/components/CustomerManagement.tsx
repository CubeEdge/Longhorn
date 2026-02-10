import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import axios from 'axios';
import { useAuthStore } from '../store/useAuthStore';
import { useLanguage } from '../i18n/useLanguage';
import { Search, Plus, MapPin, Phone, Mail, Edit2, Trash2, Users } from 'lucide-react';

// Types
interface Customer {
    id: number;
    customer_type: 'EndUser' | 'Dealer' | 'Distributor' | 'Internal';
    customer_name: string;
    contact_person?: string;
    phone?: string;
    email?: string;
    country?: string;
    province?: string;
    city?: string;
    company_name?: string;
    notes?: string;
    account_type: 'Dealer' | 'Customer'; // Logical separation
    service_tier: 'STANDARD' | 'VIP' | 'VVIP' | 'PARTNER';
    industry_tags?: string;
    parent_dealer_id?: number;
    created_at: string;
}

const CustomerManagement: React.FC = () => {
    const { token, user } = useAuthStore();
    const { t } = useLanguage();
    const isAdmin = user?.role === 'Admin';

    // State
    const [searchParams, setSearchParams] = useSearchParams();

    // State from URL with fallbacks
    const activeTab = (searchParams.get('tab') as 'Dealer' | 'Customer') || (user?.role === 'Dealer' ? 'Customer' : 'Dealer');
    const searchQuery = searchParams.get('q') || '';
    const page = parseInt(searchParams.get('page') || '1');

    const [customers, setCustomers] = useState<Customer[]>([]);
    const [loading, setLoading] = useState(false);
    // const [total, setTotal] = useState(0);

    const updateParams = (newParams: Record<string, string>) => {
        const current = Object.fromEntries(searchParams.entries());
        setSearchParams({ ...current, ...newParams });
    };

    const setActiveTab = (tab: 'Dealer' | 'Customer') => {
        updateParams({ tab, page: '1' });
    };

    const setSearchQuery = (q: string) => {
        updateParams({ q, page: '1' });
    };

    const setPage = (p: number) => {
        updateParams({ page: p.toString() });
    };

    // Modal State
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);

    // Form State
    const [formData, setFormData] = useState<Partial<Customer>>({});

    const fetchCustomers = async () => {
        setLoading(true);
        try {
            const res = await axios.get(`/api/v1/customers`, {
                params: {
                    account_type: activeTab,
                    name: searchQuery,
                    page,
                    page_size: 20
                },
                headers: { Authorization: `Bearer ${token}` }
            });
            if (res.data.success) {
                setCustomers(res.data.data.list);
                // setTotal(res.data.data.total);
            }
        } catch (err) {
            console.error('Failed to fetch customers', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (token) fetchCustomers();
    }, [token, activeTab, page, searchQuery]);

    const handleOpenModal = (customer?: Customer) => {
        if (customer) {
            setEditingCustomer(customer);
            setFormData(customer);
        } else {
            setEditingCustomer(null);
            setFormData({
                account_type: activeTab,
                customer_type: activeTab === 'Dealer' ? 'Dealer' : 'EndUser',
                service_tier: 'STANDARD'
            });
        }
        setIsModalOpen(true);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            if (editingCustomer) {
                await axios.put(`/api/v1/customers/${editingCustomer.id}`, formData, {
                    headers: { Authorization: `Bearer ${token}` }
                });
            } else {
                await axios.post('/api/v1/customers', formData, {
                    headers: { Authorization: `Bearer ${token}` }
                });
            }
            setIsModalOpen(false);
            fetchCustomers();
        } catch (err) {
            console.error('Failed to save customer', err);
            alert('Operation failed');
        }
    };

    const handleDelete = async (id: number) => {
        if (!confirm(t('common.confirm_delete'))) return;
        try {
            await axios.delete(`/api/v1/customers/${id}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            fetchCustomers();
        } catch (err) {
            console.error('Failed to delete', err);
        }
    };

    return (
        <div className="fade-in" style={{ padding: '24px', height: '100%', display: 'flex', flexDirection: 'column' }}>
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
                <div>
                    <h2 style={{ fontSize: '1.8rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 12 }}>
                        <Users size={28} color="var(--accent-blue)" />
                        {t('sidebar.archives_customers') || 'Customer Archives'}
                    </h2>
                    <p style={{ color: 'var(--text-secondary)', marginTop: 4 }}>Manage Dealers and End-Users</p>
                </div>
                <button className="btn-kine-lowkey" onClick={() => handleOpenModal()}>
                    <Plus size={18} /> {t('common.add_new')}
                </button>
            </div>

            {/* Tabs & Toolbar */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                {user?.role !== 'Dealer' ? (
                    <div className="tabs" style={{ display: 'flex', gap: 4, background: 'rgba(255,255,255,0.05)', padding: 4, borderRadius: 10 }}>
                        <button
                            className={`tab-btn ${activeTab === 'Dealer' ? 'active' : ''}`}
                            onClick={() => setActiveTab('Dealer')}
                            style={{
                                padding: '8px 24px',
                                background: activeTab === 'Dealer' ? 'rgba(255, 255, 255, 0.1)' : 'transparent',
                                color: activeTab === 'Dealer' ? 'white' : 'var(--text-secondary)',
                                borderRadius: 8,
                                fontWeight: activeTab === 'Dealer' ? 600 : 400,
                                border: 'none',
                                cursor: 'pointer',
                                transition: 'all 0.2s ease'
                            }}
                        >
                            经销商
                        </button>
                        <button
                            className={`tab-btn ${activeTab === 'Customer' ? 'active' : ''}`}
                            onClick={() => setActiveTab('Customer')}
                            style={{
                                padding: '8px 24px',
                                background: activeTab === 'Customer' ? 'rgba(255, 255, 255, 0.1)' : 'transparent',
                                color: activeTab === 'Customer' ? 'white' : 'var(--text-secondary)',
                                borderRadius: 8,
                                fontWeight: activeTab === 'Customer' ? 600 : 400,
                                border: 'none',
                                cursor: 'pointer',
                                transition: 'all 0.2s ease'
                            }}
                        >
                            终端客户
                        </button>
                    </div>
                ) : (
                    <div style={{ fontWeight: 600, fontSize: '1.2rem', color: 'var(--text-secondary)' }}>
                        终端客户
                    </div>
                )}

                <div className="search-bar" style={{ position: 'relative' }}>
                    <Search size={16} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', opacity: 0.5 }} />
                    <input
                        type="text"
                        placeholder="Search name, contact..."
                        value={searchQuery}
                        onChange={e => setSearchQuery(e.target.value)}
                        className="form-control"
                        style={{ paddingLeft: 36, width: 300, background: 'rgba(0,0,0,0.2)' }}
                    />
                </div>
            </div>

            {/* List */}
            <div className="custom-scroll" style={{ flex: 1, overflowY: 'auto', background: 'rgba(255,255,255,0.02)', borderRadius: 16, border: '1px solid var(--glass-border)' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                        <tr style={{ borderBottom: '1px solid var(--glass-border)', textAlign: 'left' }}>
                            <th style={{ padding: 16, color: 'var(--text-secondary)' }}>Name</th>
                            <th style={{ padding: 16, color: 'var(--text-secondary)' }}>Region</th>
                            <th style={{ padding: 16, color: 'var(--text-secondary)' }}>Contact</th>
                            <th style={{ padding: 16, color: 'var(--text-secondary)' }}>Tier</th>
                            <th style={{ padding: 16, color: 'var(--text-secondary)' }}>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {loading ? (
                            <tr><td colSpan={5} style={{ padding: 40, textAlign: 'center' }}>Loading...</td></tr>
                        ) : customers.length === 0 ? (
                            <tr><td colSpan={5} style={{ padding: 40, textAlign: 'center', opacity: 0.5 }}>No records found</td></tr>
                        ) : (
                            customers.map(c => (
                                <tr key={c.id} className="row-hover" style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                                    <td style={{ padding: 16 }}>
                                        <div style={{ fontWeight: 600, fontSize: '1rem' }}>{c.customer_name}</div>
                                        {c.company_name && <div style={{ fontSize: '0.8rem', opacity: 0.6 }}>{c.company_name}</div>}
                                    </td>
                                    <td style={{ padding: 16 }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                            <MapPin size={14} opacity={0.5} />
                                            {c.country || '-'} {c.city ? `/ ${c.city}` : ''}
                                        </div>
                                    </td>
                                    <td style={{ padding: 16 }}>
                                        <div style={{ fontSize: '0.9rem' }}>{c.contact_person || '-'}</div>
                                        <div style={{ fontSize: '0.8rem', opacity: 0.6, display: 'flex', gap: 8 }}>
                                            {c.phone && <span><Phone size={10} style={{ display: 'inline' }} /> {c.phone}</span>}
                                            {c.email && <span><Mail size={10} style={{ display: 'inline' }} /> {c.email}</span>}
                                        </div>
                                    </td>
                                    <td style={{ padding: 16 }}>
                                        <span className={`badge ${c.service_tier === 'VIP' ? 'badge-warning' : 'badge-default'}`} style={{ padding: '4px 8px', borderRadius: 4, background: c.service_tier === 'VIP' ? 'rgba(255,165,0,0.2)' : 'rgba(255,255,255,0.1)', color: c.service_tier === 'VIP' ? 'orange' : 'white' }}>
                                            {c.service_tier}
                                        </span>
                                    </td>
                                    <td style={{ padding: 16 }}>
                                        <button className="btn-icon" onClick={() => handleOpenModal(c)} style={{ marginRight: 8, background: 'none', border: 'none', color: 'var(--accent-blue)', cursor: 'pointer' }}>
                                            <Edit2 size={16} />
                                        </button>
                                        {isAdmin && (
                                            <button className="btn-icon" onClick={() => handleDelete(c.id)} style={{ background: 'none', border: 'none', color: '#ff4d4f', cursor: 'pointer' }}>
                                                <Trash2 size={16} />
                                            </button>
                                        )}
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>

            {/* Pagination */}
            <div className="pagination" style={{ display: 'flex', justifyContent: 'center', gap: 12, marginTop: 20, paddingBottom: 20 }}>
                <button
                    disabled={page === 1}
                    onClick={() => setPage(Math.max(1, page - 1))}
                    className="btn-secondary"
                    style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid var(--glass-border)', color: 'white', padding: '6px 12px', borderRadius: 8, cursor: page === 1 ? 'not-allowed' : 'pointer' }}
                >
                    {t('common.prev' as any) || 'Prev'}
                </button>
                <span style={{ display: 'flex', alignItems: 'center', fontSize: '0.9rem', opacity: 0.8 }}>
                    {t('common.page' as any) || 'Page'} {page}
                </span>
                <button
                    onClick={() => setPage(page + 1)}
                    className="btn-secondary"
                    style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid var(--glass-border)', color: 'white', padding: '6px 12px', borderRadius: 8, cursor: 'pointer' }}
                >
                    {t('common.next' as any) || 'Next'}
                </button>
            </div>

            {/* Modal */}
            {isModalOpen && (
                <div className="modal-overlay" onClick={() => setIsModalOpen(false)}>
                    <div className="modal-content fade-in" onClick={e => e.stopPropagation()} style={{ maxWidth: 600 }}>
                        <h3 style={{ marginBottom: 24 }}>{editingCustomer ? 'Edit Customer' : 'Add New Customer'}</h3>
                        <form onSubmit={handleSubmit} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                            <div style={{ gridColumn: '1 / -1' }}>
                                <label className="hint">Customer Name *</label>
                                <input className="form-control" required value={formData.customer_name || ''} onChange={e => setFormData({ ...formData, customer_name: e.target.value })} />
                            </div>

                            <div>
                                <label className="hint">Type</label>
                                {user?.role === 'Dealer' ? (
                                    <input className="form-control" value="End-User" disabled />
                                ) : (
                                    <select className="form-control" value={formData.customer_type} onChange={e => setFormData({ ...formData, customer_type: e.target.value as any })}>
                                        <option value="EndUser">End-User</option>
                                        <option value="Dealer">Dealer</option>
                                        <option value="Distributor">Distributor</option>
                                    </select>
                                )}
                            </div>

                            <div>
                                <label className="hint">Service Tier</label>
                                <select className="form-control" value={formData.service_tier} onChange={e => setFormData({ ...formData, service_tier: e.target.value as any })}>
                                    <option value="STANDARD">Standard</option>
                                    <option value="VIP">VIP</option>
                                    <option value="VVIP">VVIP</option>
                                    <option value="PARTNER">Partner</option>
                                </select>
                            </div>

                            <div>
                                <label className="hint">Contact Person</label>
                                <input className="form-control" value={formData.contact_person || ''} onChange={e => setFormData({ ...formData, contact_person: e.target.value })} />
                            </div>

                            <div>
                                <label className="hint">Region (Country)</label>
                                <input className="form-control" value={formData.country || ''} onChange={e => setFormData({ ...formData, country: e.target.value })} />
                            </div>

                            <div>
                                <label className="hint">Phone</label>
                                <input className="form-control" value={formData.phone || ''} onChange={e => setFormData({ ...formData, phone: e.target.value })} />
                            </div>

                            <div>
                                <label className="hint">Email</label>
                                <input className="form-control" value={formData.email || ''} onChange={e => setFormData({ ...formData, email: e.target.value })} />
                            </div>

                            <div style={{ gridColumn: '1 / -1' }}>
                                <label className="hint">Notes</label>
                                <textarea className="form-control" rows={3} value={formData.notes || ''} onChange={e => setFormData({ ...formData, notes: e.target.value })} />
                            </div>

                            <div style={{ gridColumn: '1 / -1', display: 'flex', gap: 12, marginTop: 12 }}>
                                <button type="submit" className="btn-kine-lowkey" style={{ flex: 1, justifyContent: 'center' }}>Save</button>
                                <button type="button" className="btn-glass" onClick={() => setIsModalOpen(false)} style={{ flex: 1, justifyContent: 'center' }}>Cancel</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default CustomerManagement;
