import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { format, addDays, addMonths, startOfMonth, endOfMonth, startOfWeek, endOfWeek, eachDayOfInterval, isSameMonth, isSameDay, subMonths } from 'date-fns';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/useAuthStore';
import { useToast } from '../store/useToast';
import { useConfirm } from '../store/useConfirm';
import { useLanguage } from '../i18n/useLanguage';
import {
    UserPlus,
    Shield,
    Briefcase,
    Search,
    Clock,
    Folder,
    FolderPlus,
    Trash2,
    X,
    ChevronRight,
    Unlock,
    Lock,
    Settings,
    Key,
    Save,
    UserCircle,
    Calendar as CalendarIcon,
    ChevronLeft,
    Plus
} from 'lucide-react';

const KineDatePicker: React.FC<{ value: string; onChange: (val: string) => void; t: any }> = ({ value, onChange, t }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [viewDate, setViewDate] = useState(value ? new Date(value) : new Date());

    const days = eachDayOfInterval({
        start: startOfWeek(startOfMonth(viewDate)),
        end: endOfWeek(endOfMonth(viewDate))
    });

    const handleSelect = (date: Date) => {
        onChange(format(date, 'yyyy-MM-dd'));
        setIsOpen(false);
    };

    return (
        <div style={{ position: 'relative', width: '100%' }}>
            <div
                className="form-control"
                onClick={() => setIsOpen(!isOpen)}
                style={{ display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer', border: isOpen ? '2px solid var(--accent-blue)' : '1px solid var(--glass-border)', padding: '0 20px', height: 48 }}
            >
                <CalendarIcon size={20} color="var(--accent-blue)" />
                <span style={{ fontSize: '1.2rem', fontWeight: 800, color: value ? 'var(--text-main)' : 'var(--text-tertiary)' }}>{value || t('user.select_date')}</span>
            </div>

            <AnimatePresence>
                {isOpen && (
                    <>
                        <div style={{ position: 'fixed', inset: 0, zIndex: 3000 }} onClick={() => setIsOpen(false)} />
                        <motion.div
                            initial={{ opacity: 0, y: 10, scale: 0.95 }}
                            animate={{ opacity: 1, y: 5, scale: 1 }}
                            exit={{ opacity: 0, y: 10, scale: 0.95 }}
                            style={{
                                position: 'absolute',
                                bottom: '110%',
                                left: 0,
                                width: 340,
                                background: 'var(--bg-sidebar)',
                                border: '2px solid var(--glass-border)',
                                borderRadius: 20,
                                padding: 20,
                                zIndex: 3001,
                                boxShadow: '0 -10px 40px rgba(0,0,0,0.8)'
                            }}
                        >
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                                <button type="button" onClick={() => setViewDate(subMonths(viewDate, 1))} className="btn-icon-only" style={{ background: 'var(--glass-bg-hover)' }}><ChevronLeft size={20} /></button>
                                <div style={{ fontWeight: 900, fontSize: '1.3rem', color: 'var(--accent-blue)' }}>{format(viewDate, 'yyyy-MM')}</div>
                                <button type="button" onClick={() => setViewDate(addMonths(viewDate, 1))} className="btn-icon-only" style={{ background: 'var(--glass-bg-hover)' }}><ChevronRight size={20} /></button>
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 6, textAlign: 'center', fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 12 }}>
                                {[t('user.weekday_sun'), t('user.weekday_mon'), t('user.weekday_tue'), t('user.weekday_wed'), t('user.weekday_thu'), t('user.weekday_fri'), t('user.weekday_sat')].map(d => <div key={d}>{d}</div>)}
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 6 }}>
                                {days.map(day => {
                                    const isCurrentMonth = isSameMonth(day, viewDate);
                                    const isSelected = value && isSameDay(day, new Date(value));
                                    return (
                                        <button
                                            key={day.toString()}
                                            type="button"
                                            onClick={() => handleSelect(day)}
                                            style={{
                                                height: 42,
                                                borderRadius: 10,
                                                border: 'none',
                                                background: isSelected ? 'var(--accent-blue)' : 'transparent',
                                                color: isSelected ? 'var(--bg-main)' : isCurrentMonth ? 'var(--text-main)' : 'var(--glass-bg-hover)',
                                                cursor: 'pointer',
                                                fontSize: '1rem',
                                                fontWeight: isSelected ? 900 : 500,
                                                transition: 'all 0.2s',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center'
                                            }}
                                            onMouseEnter={e => !isSelected && (e.currentTarget.style.background = 'var(--glass-bg-hover)')}
                                            onMouseLeave={e => !isSelected && (e.currentTarget.style.background = 'transparent')}
                                        >
                                            {format(day, 'd')}
                                        </button>
                                    );
                                })}
                            </div>
                            <div style={{ borderTop: '2px solid var(--glass-border)', marginTop: 16, paddingTop: 16, display: 'flex', gap: 10 }}>
                                <button type="button" className="btn-glass" style={{ flex: 1, fontSize: '0.9rem', height: 40, background: 'var(--glass-bg-hover)' }} onClick={() => handleSelect(new Date())}>{t('time.today')}</button>
                                <button type="button" className="btn-glass" style={{ flex: 1, fontSize: '0.9rem', height: 40, background: 'var(--glass-bg-hover)' }} onClick={() => { onChange(''); setIsOpen(false); }}>{t('user.clear_button')}</button>
                            </div>
                        </motion.div>
                    </>
                )}
            </AnimatePresence>
        </div>
    );
};

const UserManagement: React.FC = () => {
    const navigate = useNavigate();
    const { t } = useLanguage();
    const { showToast } = useToast();
    const { confirm } = useConfirm();
    const [users, setUsers] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [departments, setDepartments] = useState<any[]>([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [isCreating, setIsCreating] = useState(false);
    const [selectedUser, setSelectedUser] = useState<any>(null);
    const [userPermissions, setUserPermissions] = useState<any[]>([]);

    // Account Editing State
    const [isEditingInfo, setIsEditingInfo] = useState(false);
    const [editUsername, setEditUsername] = useState('');
    const [editRole, setEditRole] = useState('');
    const [editDeptId, setEditDeptId] = useState<string | number>('');
    const [editUserType, setEditUserType] = useState('Internal');
    const [editDealerId, setEditDealerId] = useState<string | number>('');
    const [newPassword, setNewPassword] = useState('');

    // Auth and folders
    const { token, user: currentUser } = useAuthStore();
    const isAdmin = currentUser?.role === 'Admin';
    const isLead = currentUser?.role === 'Lead';

    // New User Form state
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [role, setRole] = useState('Member');
    const [deptId, setDeptId] = useState('');
    const [userType, setUserType] = useState('Internal');
    const [dealerId, setDealerId] = useState('');

    // Dealers Data
    const [dealers, setDealers] = useState<any[]>([]);

    useEffect(() => {
        // Fetch Dealers (使用新的 accounts API)
        axios.get('/api/v1/accounts?account_type=DEALER&page_size=100', { headers: { Authorization: `Bearer ${token}` } })
            .then(res => {
                if (res.data.success) {
                    const accountsData = Array.isArray(res.data.data)
                        ? res.data.data
                        : (res.data.data.list || []);
                    // 映射 accounts 数据到 dealers 格式
                    setDealers(accountsData.map((acc: any) => ({
                        id: acc.id,
                        name: acc.name,
                        code: acc.dealer_code,
                        dealer_type: acc.dealer_level
                    })));
                }
            })
            .catch(err => console.error('Failed to fetch dealers', err));
    }, [token]);

    // Permission Grant Form state
    const [isGranting, setIsGranting] = useState(false);
    const [grantPath, setGrantPath] = useState('');
    const [grantType, setGrantType] = useState('Read');
    const [grantExpiry, setGrantExpiry] = useState('');
    const [isBrowserOpen, setIsBrowserOpen] = useState(false);
    const [browserFiles, setBrowserFiles] = useState<any[]>([]);
    const [browserPath, setBrowserPath] = useState('');
    const [expiryPreset, setExpiryPreset] = useState(t('user.expiry_7days'));

    const fetchData = async () => {
        try {
            setLoading(true);
            const [usersRes, departmentsRes] = await Promise.all([
                axios.get('/api/admin/users', {
                    headers: { Authorization: `Bearer ${token}` }
                }),
                axios.get('/api/admin/departments', { headers: { Authorization: `Bearer ${token}` } })
            ]);
            setUsers(usersRes.data);
            setDepartments(departmentsRes.data);
        } catch (err) {
            console.error('Failed to fetch user data', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (token) fetchData();
    }, [token]);

    const fetchPermissions = async (userId: number) => {
        try {
            const res = await axios.get(`/api/admin/users/${userId}/permissions`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setUserPermissions(res.data);
        } catch (err) {
            console.error("Failed to fetch permissions", err);
        }
    };

    const fetchBrowserFiles = async (path: string) => {
        try {
            const res = await axios.get(`/api/files?path=${path || ''}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setBrowserFiles((res.data.items || []).filter((f: any) => !f.name.startsWith('.')));
            setBrowserPath(path);
        } catch (err) {
            console.error("Failed to browse files", err);
        }
    };



    const handleUserClick = (user: any) => {
        setSelectedUser(user);
        setIsEditingInfo(false);
        setEditUsername(user.username);
        setEditRole(user.role);
        setEditDeptId(user.department_id || '');
        setEditUserType(user.user_type || 'Internal');
        setEditDealerId(user.dealer_id || '');
        setNewPassword('');
        fetchPermissions(user.id);
    };

    const handleUpdateUser = async () => {
        try {
            await axios.put(`/api/admin/users/${selectedUser.id}`, {
                username: editUsername,
                role: editRole,
                department_id: editDeptId ? parseInt(editDeptId.toString()) : null,
                user_type: editUserType,
                dealer_id: editDealerId ? parseInt(editDealerId.toString()) : null,
                password: newPassword || undefined
            }, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setIsEditingInfo(false);
            setNewPassword('');
            fetchData();
            // Refresh local selectedUser view
            const updatedUser = { ...selectedUser, username: editUsername, role: editRole, department_id: editDeptId, user_type: editUserType, dealer_id: editDealerId };
            setSelectedUser(updatedUser);
        } catch (err) {
            showToast(`${t('error.update_failed_detail', { error: (err as any).response?.data?.error || (err as any).message })}`, 'error');
        }
    };

    const handleGrantPermission = async () => {
        let finalExpiry = grantExpiry;
        if (expiryPreset === t('user.expiry_7days')) finalExpiry = format(addDays(new Date(), 7), 'yyyy-MM-dd');
        else if (expiryPreset === t('user.expiry_1month')) finalExpiry = format(addMonths(new Date(), 1), 'yyyy-MM-dd');
        else if (expiryPreset === t('user.expiry_forever')) finalExpiry = '';

        if (!grantPath) return;
        try {
            await axios.post(`/api/admin/users/${selectedUser.id}/permissions`, {
                folder_path: grantPath,
                access_type: grantType,
                expires_at: finalExpiry || null
            }, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setIsGranting(false);
            setGrantPath('');
            setExpiryPreset(t('user.expiry_7days'));
            fetchPermissions(selectedUser.id);
        } catch (err) {
            showToast(`${t('error.auth_failed_detail', { error: (err as any).response?.data?.error || (err as any).message })}`, 'error');
        }
    };

    const handleRevokePermission = async (permId: number) => {
        if (!await confirm(t('user.revoke_confirm'), t('dialog.confirm_title'))) return;
        try {
            await axios.delete(`/api/admin/permissions/${permId}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            fetchPermissions(selectedUser.id);
        } catch (err) {
            showToast(t('user.revoke_failed'), 'error');
        }
    };

    const createUser = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            await axios.post('/api/admin/users', {
                username,
                password,
                role,
                department_id: deptId ? parseInt(deptId) : null,
                user_type: userType,
                dealer_id: dealerId ? parseInt(dealerId) : null
            }, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setIsCreating(false);
            setUsername('');
            setPassword('');
            setUserType('Internal');
            setDealerId('');
            fetchData();
        } catch (err) {
            showToast(t('user.create_failed'), 'error');
        }
    };

    const filteredUsers = users.filter(u =>
        u.username.toLowerCase().includes(searchTerm.toLowerCase())
    );

    // Helper function to translate department name
    const getDeptDisplayName = (deptName: string | null) => {
        if (!deptName) return t('user.unassigned');
        // Extract department code from format like "市场部 (MS)"
        const match = deptName.match(/\(([A-Z]{2,3})\)$/);
        if (match) {
            const code = match[1];
            return t(`dept.${code}` as any);
        }
        return deptName;
    };

    if (loading) {
        return <div style={{ padding: 40, textAlign: 'center' }}>Loading...</div>;
    }

    return (
        <div className="fade-in">
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 32 }}>
                <div>
                    <h2 style={{ fontSize: '1.8rem', fontWeight: 800 }}>{t('user.management')}</h2>
                    <p className="hint">{t('user.management_desc')}</p>
                </div>
                {isAdmin && (
                    <button className="btn-primary" onClick={() => setIsCreating(true)}>
                        <UserPlus size={18} /> {t('user.new_member_button')}
                    </button>
                )}
            </div>

            {/* List Table */}
            <div style={{
                background: 'var(--glass-bg-light)',
                borderRadius: 16,
                border: '1px solid var(--glass-border)',
                overflow: 'hidden'
            }}>
                <div style={{ padding: '16px 24px', borderBottom: '1px solid var(--glass-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, background: 'var(--glass-bg-hover)', padding: '6px 16px', borderRadius: 30, width: 300 }}>
                        <Search size={16} opacity={0.5} />
                        <input
                            placeholder={t('user.search_placeholder')}
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                            style={{ background: 'transparent', border: 'none', color: 'var(--text-main)', outline: 'none', width: '100%' }}
                        />
                    </div>
                    <div className="hint" style={{ fontSize: '0.85rem' }}>{t('user.member_count', { count: filteredUsers.length })}</div>
                </div>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                        <tr style={{ background: 'var(--glass-bg-light)', textAlign: 'left' }}>
                            <th style={{ padding: '12px 24px', textAlign: 'left', fontSize: '0.75rem', fontWeight: 700, opacity: 0.6 }}>{t('user.username')}</th>
                            <th style={{ padding: '12px 24px', textAlign: 'left', fontSize: '0.75rem', fontWeight: 700, opacity: 0.6 }}>{t('user.department')}</th>
                            <th style={{ padding: '12px 24px', textAlign: 'left', fontSize: '0.75rem', fontWeight: 700, opacity: 0.6 }}>{t('user.role')}</th>
                            <th style={{ padding: '12px 24px', textAlign: 'left', fontSize: '0.75rem', fontWeight: 700, opacity: 0.6 }}>{t('user.type')}</th>
                            <th style={{ padding: '12px 24px', textAlign: 'left', fontSize: '0.75rem', fontWeight: 700, opacity: 0.6 }}>{t('user.personal_space')}</th>
                        </tr>
                    </thead>
                    <tbody>
                        {filteredUsers.map(u => (
                            <tr
                                key={u.id}
                                style={{ borderTop: '1px solid var(--glass-border)', cursor: 'pointer' }}
                                onClick={() => handleUserClick(u)}
                                className="row-hover"
                            >
                                <td style={{ padding: '16px 24px' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                                        <div style={{ width: 32, height: 32, borderRadius: 8, background: 'var(--accent-blue)', color: 'black', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: '0.8rem' }}>
                                            {u.username ? u.username[0].toUpperCase() : '?'}
                                        </div>
                                        {u.username}
                                    </div>
                                </td>
                                <td style={{ padding: '16px 24px' }}>
                                    <div className="hint" style={{ fontSize: '0.85rem' }}>{getDeptDisplayName(u.department_name)}</div>
                                </td>
                                <td style={{ padding: '16px 24px' }}>
                                    <div style={{ display: 'inline-flex', padding: '4px 12px', borderRadius: 12, background: 'var(--glass-bg)', fontSize: '0.8rem', fontWeight: 600 }}>
                                        {u.role === 'Admin' && t('user.role_admin')}
                                        {u.role === 'Lead' && t('user.role_lead')}
                                        {u.role === 'Member' && t('user.role_member')}
                                    </div>
                                </td>
                                <td style={{ padding: '16px 24px' }}>
                                    <span style={{
                                        fontSize: '0.8rem',
                                        padding: '4px 10px',
                                        borderRadius: 6,
                                        background: u.user_type === 'Internal' ? 'rgba(0, 255, 136, 0.1)' : 'rgba(var(--accent-rgb), 0.1)',
                                        color: u.user_type === 'Internal' ? '#00ff88' : '#ffd200',
                                        border: u.user_type === 'Internal' ? '1px solid rgba(0, 255, 136, 0.2)' : '1px solid rgba(var(--accent-rgb), 0.2)'
                                    }}>
                                        {u.user_type || 'Internal'}
                                    </span>
                                </td>
                                <td style={{ padding: '16px 24px' }}>
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            navigate(`/dept/members/${u.username}`);
                                        }}
                                        className="btn-glass"
                                        style={{ fontSize: '0.8rem', padding: '4px 12px', height: 'auto' }}
                                    >
                                        <Folder size={14} style={{ marginRight: 4 }} /> {t('user.view_space')}
                                    </button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* Create User Modal */}
            {
                isCreating && (
                    <div className="modal-overlay" onClick={() => setIsCreating(false)}>
                        <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: 450 }}>
                            <h3 style={{ marginBottom: 24, fontSize: '1.4rem' }}>{t('user.create_account')}</h3>
                            <form onSubmit={createUser} style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                                <div>
                                    <label className="hint" style={{ fontSize: '0.75rem', marginBottom: 4, display: 'block' }}>{t('user.username_label')}</label>
                                    <input type="text" className="form-control" value={username} onChange={e => setUsername(e.target.value)} required />
                                </div>
                                <div>
                                    <label className="hint" style={{ fontSize: '0.75rem', marginBottom: 4, display: 'block' }}>{t('user.password_label')}<span style={{ marginLeft: 8, opacity: 0.5 }}>({t('user.password_note')})</span></label>
                                    <input type="password" className="form-control" value={password} onChange={e => setPassword(e.target.value)} required />
                                </div>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                                    <div>
                                        <label className="hint" style={{ fontSize: '0.75rem', marginBottom: 4, display: 'block' }}>{t('user.department_label')}</label>
                                        <select className="form-control" value={deptId} onChange={e => setDeptId(e.target.value)}>
                                            <option value="">{t('user.unassigned')}</option>
                                            {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                                        </select>
                                    </div>
                                    <div>
                                        <label className="hint" style={{ fontSize: '0.75rem', marginBottom: 4, display: 'block' }}>{t('user.role_label')}</label>
                                        <select className="form-control" value={role} onChange={e => setRole(e.target.value as any)}>
                                            <option value="Member">{t('user.role_member')}</option>
                                            <option value="Lead">{t('user.role_lead')}</option>
                                            <option value="Admin">{t('user.role_admin')}</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label className="hint" style={{ fontSize: '0.75rem', marginBottom: 4, display: 'block' }}>{t('user.type')}</label>
                                        <select className="form-control" value={userType} onChange={e => setUserType(e.target.value)}>
                                            <option value="Internal">Internal</option>
                                            <option value="Dealer">Dealer</option>
                                            <option value="Customer">Customer</option>
                                        </select>
                                    </div>
                                </div>

                                {userType === 'Dealer' && (
                                    <div>
                                        <label className="hint" style={{ fontSize: '0.75rem', marginBottom: 4, display: 'block' }}>{t('user.select_dealer')}</label>
                                        <select className="form-control" value={dealerId} onChange={e => setDealerId(e.target.value)}>
                                            <option value="">{t('user.unassigned')}</option>
                                            {dealers.map(d => <option key={d.id} value={d.id}>{d.customer_name} ({d.contact_person || 'No Contact'})</option>)}
                                        </select>
                                    </div>
                                )}
                                <div style={{ display: 'flex', gap: 12, marginTop: 8 }}>
                                    <button type="submit" className="btn-primary" style={{ flex: 1, justifyContent: 'center' }}>{t('user.create_now')}</button>
                                    <button type="button" className="btn-glass" onClick={() => setIsCreating(false)} style={{ flex: 1, justifyContent: 'center' }}>{t('common.cancel')}</button>
                                </div>
                            </form>
                        </div>
                    </div >
                )
            }

            {/* User Details & Permissions Modal */}
            {
                selectedUser && (
                    <div className="modal-overlay" onClick={() => setSelectedUser(null)}>
                        <div className="modal-content fade-in" onClick={e => e.stopPropagation()} style={{ maxWidth: 750, maxHeight: '95vh', overflowY: 'auto' }}>
                            <div className="modal-header" style={{ marginBottom: 30 }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
                                    <div style={{ width: 48, height: 48, borderRadius: 14, background: 'var(--accent-blue)', color: 'black', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: '1.4rem' }}>
                                        {selectedUser.username ? selectedUser.username[0].toUpperCase() : '?'}
                                    </div>
                                    <div>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                                            <h3 style={{ fontSize: '1.6rem' }}>{selectedUser.username}</h3>
                                            <span style={{ fontSize: '0.75rem', background: 'var(--glass-bg-hover)', padding: '2px 8px', borderRadius: 6, color: 'var(--text-secondary)' }}>ID: {selectedUser.id}</span>
                                        </div>
                                        <div className="hint" style={{ display: 'flex', gap: 12, marginTop: 4 }}>
                                            <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><Briefcase size={14} /> {selectedUser.department_name ? getDeptDisplayName(selectedUser.department_name) : t('user.no_department')}</span>
                                            <span>•</span>
                                            <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><Shield size={14} /> {selectedUser.role}</span>
                                        </div>
                                    </div>
                                </div>
                                <div style={{ display: 'flex', gap: 12 }}>
                                    {isAdmin && (
                                        <button
                                            onClick={() => setIsEditingInfo(!isEditingInfo)}
                                            className={isEditingInfo ? 'btn-primary' : 'btn-glass'}
                                            style={{ fontSize: '0.85rem', padding: '8px 14px', whiteSpace: 'nowrap' }}
                                        >
                                            {isEditingInfo ? <><X size={16} /> {t('user.cancel_edit')}</> : <><Settings size={16} /> {t('user.edit_account')}</>}
                                        </button>
                                    )}
                                    <button onClick={() => setSelectedUser(null)} style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}><X size={24} /></button>
                                </div>
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 2fr', gap: 24 }}>
                                {/* Left Col: Info & Edit */}
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
                                    {isEditingInfo ? (
                                        <div className="fade-in" style={{ background: 'var(--glass-bg-hover)', padding: 20, borderRadius: 16, border: '1px solid var(--accent-blue)', display: 'flex', flexDirection: 'column', gap: 16 }}>
                                            <h4 style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}><UserCircle size={18} /> {t('user.account_ops')}</h4>
                                            <div>
                                                <label className="hint" style={{ fontSize: '0.75rem' }}>{t('user.edit')} {t('user.username')}</label>
                                                <input className="form-control" value={editUsername} onChange={e => setEditUsername(e.target.value)} style={{ marginTop: 6 }} />
                                            </div>
                                            <div>
                                                <label className="hint" style={{ fontSize: '0.75rem' }}>{t('user.department')}</label>
                                                <select className="form-control" value={editDeptId} onChange={e => setEditDeptId(e.target.value)} style={{ marginTop: 6 }}>
                                                    <option value="">{t('user.unassigned')}</option>
                                                    {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                                                </select>
                                            </div>
                                            <div>
                                                <label className="hint" style={{ fontSize: '0.75rem' }}>{t('user.role')}</label>
                                                <select className="form-control" value={editRole} onChange={e => setEditRole(e.target.value)} style={{ marginTop: 6 }}>
                                                    <option value="Member">{t('user.role_member')}</option>
                                                    <option value="Lead">{t('user.role_lead')}</option>
                                                    <option value="Admin">{t('user.role_admin')}</option>
                                                </select>
                                            </div>
                                            <div>
                                                <label className="hint" style={{ fontSize: '0.75rem' }}>{t('user.type')}</label>
                                                <select className="form-control" value={editUserType} onChange={e => setEditUserType(e.target.value)} style={{ marginTop: 6 }}>
                                                    <option value="Internal">Internal</option>
                                                    <option value="Dealer">Dealer</option>
                                                    <option value="Customer">Customer</option>
                                                </select>
                                            </div>

                                            {editUserType === 'Dealer' && (
                                                <div>
                                                    <label className="hint" style={{ fontSize: '0.75rem' }}>{t('user.select_dealer')}</label>
                                                    <select className="form-control" value={editDealerId} onChange={e => setEditDealerId(e.target.value)} style={{ marginTop: 6 }}>
                                                        <option value="">{t('user.unassigned')}</option>
                                                        {dealers.map(d => <option key={d.id} value={d.id}>{d.customer_name}</option>)}
                                                    </select>
                                                </div>
                                            )}
                                            <div style={{ borderTop: '1px solid var(--glass-border)', paddingTop: 16 }}>
                                                <label className="hint" style={{ fontSize: '0.75rem', color: 'var(--accent-blue)' }}>{t('user.reset_password')}</label>
                                                <div style={{ position: 'relative', marginTop: 6 }}>
                                                    <input type="password" placeholder={t('user.password_placeholder')} className="form-control" value={newPassword} onChange={e => setNewPassword(e.target.value)} />
                                                    <Key size={14} style={{ position: 'absolute', right: 12, top: 16, opacity: 0.3 }} />
                                                </div>
                                            </div>
                                            {isAdmin && (
                                                <button className="btn-glass" style={{ fontSize: '0.75rem', padding: '6px 10px' }} onClick={() => setIsGranting(true)}>
                                                    <Plus size={14} /> {t('user.add_permission')}
                                                </button>
                                            )}
                                            <button className="btn-primary" style={{ marginTop: 10, justifyContent: 'center', fontSize: '0.9rem' }} onClick={handleUpdateUser}>
                                                <Save size={16} /> {t('user.save_changes')}
                                            </button>
                                        </div>
                                    ) : (
                                        <>
                                            <div style={{ background: 'var(--glass-bg-light)', border: '1px solid var(--glass-border)', padding: 16, borderRadius: 14 }}>
                                                <div className="hint" style={{ fontSize: '0.75rem', marginBottom: 8 }}>{t('user.personal_space')} (Members/{selectedUser.username})</div>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--accent-blue)', fontWeight: 600 }}>
                                                    <Unlock size={14} /> {t('user.auto_sync_permissions')} (Full)
                                                </div>
                                            </div>
                                            <div style={{ background: 'var(--glass-bg-light)', border: '1px solid var(--glass-border)', padding: 16, borderRadius: 14 }}>
                                                <div className="hint" style={{ fontSize: '0.75rem', marginBottom: 8 }}>{t('user.join_date')}</div>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 600 }}>
                                                    <Clock size={14} opacity={0.5} /> {selectedUser.created_at && !isNaN(new Date(selectedUser.created_at).getTime()) ? format(new Date(selectedUser.created_at), 'yyyy-MM-dd') : t('user.historical_data')}
                                                </div>
                                            </div>
                                        </>
                                    )}
                                </div>

                                {/* Right Col: Permissions */}
                                <div style={{ background: 'var(--glass-bg-light)', padding: '24px', borderRadius: 20, border: '1px solid var(--glass-border)', display: 'flex', flexDirection: 'column' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                                        <h4 style={{ fontWeight: 800, fontSize: '1.1rem' }}>{t('user.dynamic_auth')}</h4>
                                        <button className="btn-primary" style={{ fontSize: '0.85rem', padding: '8px 14px' }} onClick={() => setIsGranting(true)}>
                                            <FolderPlus size={16} /> {t('user.add_auth')}
                                        </button>
                                    </div>

                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, flex: 1 }}>
                                        {userPermissions.length > 0 ? userPermissions.map(p => (
                                            <div key={p.id} className="row-hover" style={{ background: 'var(--glass-bg-light)', border: '1px solid var(--glass-border)', padding: '14px 18px', borderRadius: 14, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                <div style={{ overflow: 'hidden' }}>
                                                    <div style={{ fontWeight: 600, fontSize: '0.95rem', whiteSpace: 'nowrap', textOverflow: 'ellipsis', display: 'flex', alignItems: 'center', gap: 6 }}>
                                                        <Folder size={14} color="var(--accent-blue)" /> {p.folder_path}
                                                    </div>
                                                    <div className="hint" style={{ fontSize: '0.75rem', display: 'flex', gap: 12, marginTop: 4 }}>
                                                        <span style={{ color: p.access_type === 'Full' ? 'var(--accent-blue)' : '#aaa', fontWeight: 600 }}>
                                                            {p.access_type === 'Full' ? t('user.full_control') : t('user.read_only')}
                                                        </span>
                                                        <span>•</span>
                                                        <span>{p.expires_at ? `${t('user.expires_on')}: ${format(new Date(p.expires_at), 'yyyy-MM-dd')}` : t('user.expiry_forever')}</span>
                                                    </div>
                                                </div>
                                                <button onClick={() => handleRevokePermission(p.id)} style={{ background: 'rgba(255,59,48,0.1)', border: 'none', color: '#ff3b30', cursor: 'pointer', padding: 8, borderRadius: 8, transition: 'all 0.2s' }}>
                                                    <Trash2 size={16} />
                                                </button>
                                            </div>
                                        )) : (
                                            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', opacity: 0.3, padding: 40 }}>
                                                <Lock size={48} style={{ marginBottom: 12 }} />
                                                <p>{t('user.no_manual_auth')}</p>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                )
            }

            {/* Permission Grant Modal (Stage 2) */}
            {
                isGranting && (
                    <div className="modal-overlay" style={{ zIndex: 4000 }} onClick={() => setIsGranting(false)}>
                        <div className="modal-content scale-in" onClick={e => e.stopPropagation()} style={{ maxWidth: 460 }}>
                            <h3 style={{ marginBottom: 20, display: 'flex', alignItems: 'center', gap: 10 }}>{t('user.add_access_auth')}</h3>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                                <div>
                                    <label className="hint">{t('user.target_directory')}</label>
                                    <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
                                        <input
                                            readOnly
                                            value={grantPath}
                                            placeholder={t('user.browse_placeholder')}
                                            style={{ flex: 1, background: 'var(--glass-bg-hover)', border: '1px solid var(--glass-border)', padding: '12px 14px', borderRadius: 10, color: 'var(--text-main)' }}
                                        />
                                        <button className="btn-glass" style={{ background: 'var(--accent-blue)', color: 'black', fontWeight: 700 }} onClick={() => { setIsBrowserOpen(true); fetchBrowserFiles(isLead ? currentUser?.department_name || '' : ''); }}>{t('user.browse_button')}</button>
                                    </div>
                                </div>

                                <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 20 }}>
                                    <div>
                                        <label className="hint" style={{ marginBottom: 8, display: 'block' }}>{t('user.permission_type')}</label>
                                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px' }}>
                                            <button
                                                type="button"
                                                onClick={() => setGrantType('Read')}
                                                className="btn-glass"
                                                style={{
                                                    flex: 1,
                                                    padding: '10px 4px',
                                                    fontSize: '0.9rem',
                                                    height: 'auto',
                                                    border: '1px solid var(--glass-border)',
                                                    borderLeft: grantType === 'Read' ? '4px solid var(--accent-blue)' : '1px solid var(--glass-border)',
                                                    background: grantType === 'Read' ? 'rgba(var(--accent-rgb), 0.15)' : 'var(--glass-bg-hover)',
                                                    fontWeight: grantType === 'Read' ? 700 : 600
                                                }}
                                            >{t('permission.read_only')}</button>
                                            <button
                                                type="button"
                                                onClick={() => setGrantType('Contribute')}
                                                className="btn-glass"
                                                style={{
                                                    flex: 1,
                                                    padding: '10px 4px',
                                                    fontSize: '0.9rem',
                                                    height: 'auto',
                                                    border: '1px solid var(--glass-border)',
                                                    borderLeft: grantType === 'Contribute' ? '4px solid var(--accent-blue)' : '1px solid var(--glass-border)',
                                                    background: grantType === 'Contribute' ? 'rgba(var(--accent-rgb), 0.15)' : 'var(--glass-bg-hover)',
                                                    fontWeight: grantType === 'Contribute' ? 700 : 600
                                                }}
                                            >{t('permission.contribute')}</button>
                                            <button
                                                type="button"
                                                onClick={() => setGrantType('Full')}
                                                className="btn-glass"
                                                style={{
                                                    flex: 1,
                                                    padding: '10px 4px',
                                                    fontSize: '0.9rem',
                                                    height: 'auto',
                                                    border: '1px solid var(--glass-border)',
                                                    borderLeft: grantType === 'Full' ? '4px solid var(--accent-blue)' : '1px solid var(--glass-border)',
                                                    background: grantType === 'Full' ? 'rgba(var(--accent-rgb), 0.15)' : 'var(--glass-bg-hover)',
                                                    fontWeight: grantType === 'Full' ? 700 : 600
                                                }}
                                            >{t('permission.full')}</button>
                                        </div>
                                        <div style={{
                                            marginTop: '12px',
                                            padding: '10px 12px',
                                            background: 'rgba(var(--accent-rgb), 0.08)',
                                            border: '1px solid rgba(var(--accent-rgb), 0.2)',
                                            borderRadius: '8px',
                                            fontSize: '0.8rem',
                                            color: 'rgba(255, 255, 255, 0.8)',
                                            lineHeight: 1.5
                                        }}>
                                            <div style={{ fontWeight: 600, marginBottom: '6px', color: 'var(--accent-blue)' }}>{t('user.permission_hint')}</div>
                                            <div><strong>{t('permission.read_only')}</strong>：{t('user.permission_readonly_desc')}</div>
                                            <div><strong>{t('permission.contribute')}</strong>：{t('user.permission_contribute_desc')}</div>
                                            <div><strong>{t('permission.full')}</strong>：{t('user.permission_full_desc')}</div>
                                        </div>
                                    </div>
                                    <div>
                                        <label className="hint">{t('user.expiry')}</label>
                                        <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                                            {[t('user.expiry_7days'), t('user.expiry_1month'), t('user.expiry_forever'), t('user.expiry_custom')].map(label => (
                                                <button
                                                    key={label}
                                                    type="button"
                                                    onClick={() => {
                                                        setExpiryPreset(label);
                                                        if (label === t('user.expiry_custom') && !grantExpiry) {
                                                            setGrantExpiry(format(new Date(), 'yyyy-MM-dd'));
                                                        }
                                                    }}
                                                    className="btn-glass"
                                                    style={{
                                                        flex: 1,
                                                        padding: '8px 4px',
                                                        fontSize: '0.85rem',
                                                        height: 'auto',
                                                        border: '1px solid var(--glass-border)',
                                                        borderLeft: expiryPreset === label ? '4px solid var(--accent-blue)' : '1px solid var(--glass-border)',
                                                        background: expiryPreset === label ? 'rgba(var(--accent-rgb), 0.15)' : 'var(--glass-bg-hover)',
                                                        fontWeight: expiryPreset === label ? 700 : 600
                                                    }}
                                                >
                                                    {label}
                                                </button>
                                            ))}
                                        </div>
                                        {expiryPreset === t('user.expiry_custom') && (
                                            <div style={{ marginTop: 12 }} className="fade-in">
                                                <KineDatePicker value={grantExpiry} onChange={setGrantExpiry} t={t} />
                                                <p className="hint" style={{ marginTop: 8, fontSize: '0.85rem' }}>{t('user.select_expiry_date')}。</p>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                <div style={{ display: 'flex', gap: 12, marginTop: 10 }}>
                                    <button className="btn-primary" style={{ flex: 1, height: 48, justifyContent: 'center' }} onClick={handleGrantPermission}>{t('user.grant_permission_button')}</button>
                                    <button className="btn-glass" style={{ flex: 1, height: 48, justifyContent: 'center' }} onClick={() => setIsGranting(false)}>{t('common.back')}</button>
                                </div>
                            </div>
                        </div>
                    </div>
                )
            }

            {/* Folder Browser Modal (Inside Grant Modal) */}
            {
                isBrowserOpen && (
                    <div className="modal-overlay" style={{ zIndex: 4100 }} onClick={() => setIsBrowserOpen(false)}>
                        <div className="modal-content fade-in" onClick={e => e.stopPropagation()} style={{ maxWidth: 520, minHeight: 460 }}>
                            <div className="modal-header">
                                <h3 style={{ display: 'flex', alignItems: 'center', gap: 10 }}><Folder size={22} color="var(--accent-blue)" /> {t('user.select_folder_title')}</h3>
                                <button onClick={() => setIsBrowserOpen(false)} style={{ background: 'none', border: 'none', color: 'gray', cursor: 'pointer' }}><X size={24} /></button>
                            </div>

                            <div style={{ background: 'var(--glass-bg-hover)', padding: '10px 16px', borderRadius: 10, marginBottom: 20, fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: 8 }}>
                                <Clock size={14} opacity={0.5} /> <span className="hint">{t('common.current_path')}</span> <code style={{ color: 'var(--accent-blue)', fontWeight: 700 }}>{browserPath || '/'}</code>
                            </div>

                            <div className="custom-scroll" style={{ maxHeight: 320, overflowY: 'auto', paddingRight: 4 }}>
                                {browserPath !== (isLead ? currentUser?.department_name : '') && (
                                    <div
                                        className="row-hover"
                                        style={{ padding: '12px 16px', borderRadius: 10, display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer', marginBottom: 4 }}
                                        onClick={() => {
                                            const segments = browserPath.split('/').filter(Boolean);
                                            segments.pop();
                                            fetchBrowserFiles(segments.join('/'));
                                        }}
                                    >
                                        <ChevronRight size={18} style={{ transform: 'rotate(180deg)', opacity: 0.5 }} /> <span style={{ fontWeight: 600 }}>{t('user.back_to_parent')}</span>
                                    </div>
                                )}

                                {browserFiles.filter(f => f.isDirectory).map(f => (
                                    <div
                                        key={f.path}
                                        className="row-hover"
                                        style={{ padding: '10px 16px', borderRadius: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', marginBottom: 4 }}
                                        onClick={() => fetchBrowserFiles(f.path)}
                                    >
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                                            <Folder size={20} color="var(--accent-blue)" fill="rgba(var(--accent-rgb),0.2)" />
                                            <span style={{ fontWeight: 500 }}>{f.name}</span>
                                        </div>
                                        <button
                                            className="btn-primary"
                                            style={{ height: '32px', padding: '0 12px', fontSize: '0.8rem', borderRadius: 8 }}
                                            onClick={(e) => { e.stopPropagation(); setGrantPath(f.path); setIsBrowserOpen(false); }}
                                        >
                                            {t('user.select_folder')}
                                        </button>
                                    </div>
                                ))}
                                {browserFiles.filter(f => f.isDirectory).length === 0 && (
                                    <div style={{ textAlign: 'center', padding: 60, opacity: 0.3 }}>
                                        <FolderPlus size={40} style={{ marginBottom: 12 }} />
                                        <div>{t('user.no_subdirs')}</div>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                )
            }


            {/* Hint Section */}
            <div style={{ marginTop: 24, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 20 }}>
                <div style={{ background: 'var(--glass-bg-light)', border: '1px solid var(--glass-border)', padding: 20, borderRadius: 16 }}>
                    <h4 style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}><Shield size={18} color="var(--accent-blue)" /> {t('user.permission_help_title')}</h4>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                        <div style={{ display: 'flex', gap: 12 }}>
                            <div style={{ minWidth: 120, maxWidth: 120, fontWeight: 700, color: 'var(--accent-blue)', fontSize: '0.9rem', wordWrap: 'break-word' }}>{t('user.role_admin')}</div>
                            <div className="hint" style={{ flex: 1, fontSize: '0.85rem' }}>{t('user.permission_note_admin')}{t('user.management')}、{t('user.dept_settings')}、{t('user.global_file_access')}{t('user.etc')}。</div>
                        </div>
                        <div style={{ display: 'flex', gap: 12 }}>
                            <div style={{ minWidth: 120, maxWidth: 120, fontWeight: 700, color: 'var(--accent-blue)', fontSize: '0.9rem', wordWrap: 'break-word' }}>{t('user.role_lead')}</div>
                            <div className="hint" style={{ flex: 1, fontSize: '0.85rem' }}>{t('user.permission_note_lead')}{t('user.full_control')}{t('user.permission_note_lead_suffix')}</div>
                        </div>
                        <div style={{ display: 'flex', gap: 12 }}>
                            <div style={{ minWidth: 120, maxWidth: 120, fontWeight: 700, color: 'var(--accent-blue)', fontSize: '0.9rem', wordWrap: 'break-word' }}>{t('user.role_member')}</div>
                            <div className="hint" style={{ flex: 1, fontSize: '0.85rem' }}>{t('user.permission_note_member')}{t('user.personal_space')}{t('user.permission_note_member_suffix')}</div>
                        </div>
                    </div>
                </div>
            </div>
        </div >
    );
};

export default UserManagement;
