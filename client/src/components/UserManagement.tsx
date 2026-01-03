import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { format, addDays, addMonths, startOfMonth, endOfMonth, startOfWeek, endOfWeek, eachDayOfInterval, isSameMonth, isSameDay, subMonths } from 'date-fns';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuthStore } from '../store/useAuthStore';
import {
    UserPlus,
    CheckCircle,
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
    ChevronLeft
} from 'lucide-react';

const KineDatePicker: React.FC<{ value: string; onChange: (val: string) => void }> = ({ value, onChange }) => {
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
                <span style={{ fontSize: '1.2rem', fontWeight: 800, color: value ? '#fff' : 'rgba(255,255,255,0.3)' }}>{value || '请选择 YYYY-MM-DD'}</span>
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
                                background: '#1C1C1E',
                                border: '2px solid var(--glass-border)',
                                borderRadius: 20,
                                padding: 20,
                                zIndex: 3001,
                                boxShadow: '0 -10px 40px rgba(0,0,0,0.8)'
                            }}
                        >
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                                <button type="button" onClick={() => setViewDate(subMonths(viewDate, 1))} className="btn-icon-only" style={{ background: 'rgba(255,255,255,0.05)' }}><ChevronLeft size={20} /></button>
                                <div style={{ fontWeight: 900, fontSize: '1.3rem', color: 'var(--accent-blue)' }}>{format(viewDate, 'yyyy-MM')}</div>
                                <button type="button" onClick={() => setViewDate(addMonths(viewDate, 1))} className="btn-icon-only" style={{ background: 'rgba(255,255,255,0.05)' }}><ChevronRight size={20} /></button>
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 6, textAlign: 'center', fontSize: '0.85rem', fontWeight: 700, color: 'rgba(255,255,255,0.5)', marginBottom: 12 }}>
                                {['日', '一', '二', '三', '四', '五', '六'].map(d => <div key={d}>{d}</div>)}
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
                                                color: isSelected ? '#000' : isCurrentMonth ? 'white' : 'rgba(255,255,255,0.15)',
                                                cursor: 'pointer',
                                                fontSize: '1rem',
                                                fontWeight: isSelected ? 900 : 500,
                                                transition: 'all 0.2s',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center'
                                            }}
                                            onMouseEnter={e => !isSelected && (e.currentTarget.style.background = 'rgba(255,255,255,0.1)')}
                                            onMouseLeave={e => !isSelected && (e.currentTarget.style.background = 'transparent')}
                                        >
                                            {format(day, 'd')}
                                        </button>
                                    );
                                })}
                            </div>
                            <div style={{ borderTop: '2px solid var(--glass-border)', marginTop: 16, paddingTop: 16, display: 'flex', gap: 10 }}>
                                <button type="button" className="btn-glass" style={{ flex: 1, fontSize: '0.9rem', height: 40, background: 'rgba(255,255,255,0.05)' }} onClick={() => handleSelect(new Date())}>今天</button>
                                <button type="button" className="btn-glass" style={{ flex: 1, fontSize: '0.9rem', height: 40, background: 'rgba(255,255,255,0.05)' }} onClick={() => { onChange(''); setIsOpen(false); }}>清除</button>
                            </div>
                        </motion.div>
                    </>
                )}
            </AnimatePresence>
        </div>
    );
};

const UserManagement: React.FC = () => {
    const [users, setUsers] = useState<any[]>([]);
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

    // Permission Grant Form state
    const [isGranting, setIsGranting] = useState(false);
    const [grantPath, setGrantPath] = useState('');
    const [grantType, setGrantType] = useState('Read');
    const [grantExpiry, setGrantExpiry] = useState('');
    const [isBrowserOpen, setIsBrowserOpen] = useState(false);
    const [browserFiles, setBrowserFiles] = useState<any[]>([]);
    const [browserPath, setBrowserPath] = useState('');
    const [expiryPreset, setExpiryPreset] = useState('7天');

    const fetchData = async () => {
        const headers = { Authorization: `Bearer ${token}` };
        try {
            const [uRes, dRes] = await Promise.all([
                axios.get('/api/admin/users', { headers }),
                axios.get('/api/admin/departments', { headers })
            ]);
            setUsers(uRes.data);
            setDepartments(dRes.data);
        } catch (err) {
            console.error("Failed to fetch user data", err);
        }
    };

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
            setBrowserFiles(res.data.items || []);
            setBrowserPath(path);
        } catch (err) {
            console.error("Failed to browse files", err);
        }
    };

    useEffect(() => {
        fetchData();
    }, [token]);

    const handleUserClick = (user: any) => {
        setSelectedUser(user);
        setIsEditingInfo(false);
        setEditUsername(user.username);
        setEditRole(user.role);
        setEditDeptId(user.department_id || '');
        setNewPassword('');
        fetchPermissions(user.id);
    };

    const handleUpdateUser = async () => {
        try {
            await axios.put(`/api/admin/users/${selectedUser.id}`, {
                username: editUsername,
                role: editRole,
                department_id: editDeptId ? parseInt(editDeptId.toString()) : null,
                password: newPassword || undefined
            }, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setIsEditingInfo(false);
            setNewPassword('');
            fetchData();
            // Refresh local selectedUser view
            const updatedUser = { ...selectedUser, username: editUsername, role: editRole, department_id: editDeptId };
            setSelectedUser(updatedUser);
        } catch (err) {
            alert(`更新失败: ${(err as any).response?.data?.error || (err as any).message}`);
        }
    };

    const handleGrantPermission = async () => {
        let finalExpiry = grantExpiry;
        if (expiryPreset === '7天') finalExpiry = format(addDays(new Date(), 7), 'yyyy-MM-dd');
        else if (expiryPreset === '1个月') finalExpiry = format(addMonths(new Date(), 1), 'yyyy-MM-dd');
        else if (expiryPreset === '永久') finalExpiry = '';

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
            setExpiryPreset('7天');
            fetchPermissions(selectedUser.id);
        } catch (err) {
            alert(`授权失败: ${(err as any).response?.data?.error || (err as any).message}`);
        }
    };

    const handleRevokePermission = async (permId: number) => {
        if (!window.confirm("确定要撤销此权限吗？")) return;
        try {
            await axios.delete(`/api/admin/permissions/${permId}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            fetchPermissions(selectedUser.id);
        } catch (err) {
            alert("撤销失败");
        }
    };

    const createUser = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            await axios.post('/api/admin/users', {
                username,
                password,
                role,
                department_id: deptId ? parseInt(deptId) : null
            }, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setIsCreating(false);
            setUsername('');
            setPassword('');
            fetchData();
        } catch (err) {
            alert("创建失败");
        }
    };

    const filteredUsers = users.filter(u =>
        u.username.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div className="fade-in">
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 32 }}>
                <div>
                    <h2 style={{ fontSize: '1.8rem', fontWeight: 800 }}>用户管理</h2>
                    <p className="hint">管理全系统的访问权限、所属部门以及职能角色。</p>
                </div>
                {isAdmin && (
                    <button className="btn-primary" onClick={() => setIsCreating(true)}>
                        <UserPlus size={18} /> 新增成员
                    </button>
                )}
            </div>

            {/* List Table */}
            <div style={{
                background: 'rgba(255,255,255,0.03)',
                borderRadius: 16,
                border: '1px solid var(--glass-border)',
                overflow: 'hidden'
            }}>
                <div style={{ padding: '16px 24px', borderBottom: '1px solid var(--glass-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, background: 'rgba(255,255,255,0.05)', padding: '6px 16px', borderRadius: 30, width: 300 }}>
                        <Search size={16} opacity={0.5} />
                        <input
                            placeholder="搜索用户名..."
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                            style={{ background: 'transparent', border: 'none', color: 'white', outline: 'none', width: '100%' }}
                        />
                    </div>
                    <div className="hint">{filteredUsers.length} 位成员</div>
                </div>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                        <tr style={{ background: 'rgba(255,255,255,0.02)', textAlign: 'left' }}>
                            <th style={{ padding: '16px 24px' }}>用户名</th>
                            <th style={{ padding: '16px 24px' }}>所属部门</th>
                            <th style={{ padding: '16px 24px' }}>角色</th>
                            <th style={{ padding: '16px 24px' }}>创建于</th>
                            <th style={{ padding: '16px 24px' }}>状态</th>
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
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                        <Briefcase size={14} opacity={0.5} color="var(--accent-blue)" />
                                        {u.department_name || '未分配'}
                                    </div>
                                </td>
                                <td style={{ padding: '16px 24px' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                        <Shield size={14} opacity={0.5} color="var(--accent-blue)" />
                                        {u.role === 'Admin' ? '系统管理员' : u.role === 'Lead' ? '部门主管' : '普通成员'}
                                    </div>
                                </td>
                                <td style={{ padding: '16px 24px' }} className="hint">
                                    {u.created_at ? format(new Date(u.created_at), 'yyyy-MM-dd') : '--'}
                                </td>
                                <td style={{ padding: '16px 24px' }}>
                                    <span style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#34c759', fontSize: '0.85rem' }}>
                                        <CheckCircle size={14} /> 活跃
                                    </span>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* Create User Modal */}
            {isCreating && (
                <div className="modal-overlay" onClick={() => setIsCreating(false)}>
                    <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: 450 }}>
                        <h3 style={{ marginBottom: 24, fontSize: '1.4rem' }}>创建新账号</h3>
                        <form onSubmit={createUser} style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                            <div>
                                <label className="hint">用户名</label>
                                <input type="text" className="form-control" value={username} onChange={e => setUsername(e.target.value)} required />
                            </div>
                            <div>
                                <label className="hint">初始密码</label>
                                <input type="password" className="form-control" value={password} onChange={e => setPassword(e.target.value)} required />
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                                <div>
                                    <label className="hint">所属部门</label>
                                    <select className="form-control" value={deptId} onChange={e => setDeptId(e.target.value)}>
                                        <option value="">未分配</option>
                                        {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label className="hint">角色</label>
                                    <select className="form-control" value={role} onChange={e => setRole(e.target.value)}>
                                        <option value="Member">Member</option>
                                        <option value="Lead">Lead</option>
                                        <option value="Admin">Admin</option>
                                    </select>
                                </div>
                            </div>
                            <div style={{ display: 'flex', gap: 12, marginTop: 12 }}>
                                <button type="submit" className="btn-primary" style={{ flex: 1, justifyContent: 'center' }}>立即创建</button>
                                <button type="button" className="btn-glass" onClick={() => setIsCreating(false)} style={{ flex: 1, justifyContent: 'center' }}>取消</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* User Details & Permissions Modal */}
            {selectedUser && (
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
                                        <span style={{ fontSize: '0.75rem', background: 'rgba(255,255,255,0.1)', padding: '2px 8px', borderRadius: 6, color: 'var(--text-secondary)' }}>ID: {selectedUser.id}</span>
                                    </div>
                                    <div className="hint" style={{ display: 'flex', gap: 12, marginTop: 4 }}>
                                        <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><Briefcase size={14} /> {selectedUser.department_name || '无部门'}</span>
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
                                    >
                                        {isEditingInfo ? <><X size={18} /> 取消编辑</> : <><Settings size={18} /> 编辑账户</>}
                                    </button>
                                )}
                                <button onClick={() => setSelectedUser(null)} style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}><X size={24} /></button>
                            </div>
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 2fr', gap: 24 }}>
                            {/* Left Col: Info & Edit */}
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
                                {isEditingInfo ? (
                                    <div className="fade-in" style={{ background: 'rgba(255,255,255,0.05)', padding: 20, borderRadius: 16, border: '1px solid var(--accent-blue)', display: 'flex', flexDirection: 'column', gap: 16 }}>
                                        <h4 style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}><UserCircle size={18} /> 账户运维</h4>
                                        <div>
                                            <label className="hint" style={{ fontSize: '0.75rem' }}>修改用户名</label>
                                            <input className="form-control" value={editUsername} onChange={e => setEditUsername(e.target.value)} style={{ marginTop: 6 }} />
                                        </div>
                                        <div>
                                            <label className="hint" style={{ fontSize: '0.75rem' }}>所属部门</label>
                                            <select className="form-control" value={editDeptId} onChange={e => setEditDeptId(e.target.value)} style={{ marginTop: 6 }}>
                                                <option value="">未分配</option>
                                                {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                                            </select>
                                        </div>
                                        <div>
                                            <label className="hint" style={{ fontSize: '0.75rem' }}>职能角色</label>
                                            <select className="form-control" value={editRole} onChange={e => setEditRole(e.target.value)} style={{ marginTop: 6 }}>
                                                <option value="Member">Member</option>
                                                <option value="Lead">Lead</option>
                                                <option value="Admin">Admin</option>
                                            </select>
                                        </div>
                                        <div style={{ borderTop: '1px solid var(--glass-border)', paddingTop: 16 }}>
                                            <label className="hint" style={{ fontSize: '0.75rem', color: 'var(--accent-blue)' }}>重置登录密码</label>
                                            <div style={{ position: 'relative', marginTop: 6 }}>
                                                <input type="password" placeholder="留空则不修改" className="form-control" value={newPassword} onChange={e => setNewPassword(e.target.value)} />
                                                <Key size={14} style={{ position: 'absolute', right: 12, top: 16, opacity: 0.3 }} />
                                            </div>
                                        </div>
                                        <button className="btn-primary" style={{ marginTop: 10, justifyContent: 'center' }} onClick={handleUpdateUser}>
                                            <Save size={18} /> 保存更改
                                        </button>
                                    </div>
                                ) : (
                                    <>
                                        <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid var(--glass-border)', padding: 16, borderRadius: 14 }}>
                                            <div className="hint" style={{ fontSize: '0.75rem', marginBottom: 8 }}>个人空间 (Members/{selectedUser.username})</div>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--accent-blue)', fontWeight: 600 }}>
                                                <Unlock size={14} /> 自动同步授权 (Full)
                                            </div>
                                        </div>
                                        <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid var(--glass-border)', padding: 16, borderRadius: 14 }}>
                                            <div className="hint" style={{ fontSize: '0.75rem', marginBottom: 8 }}>加入时间</div>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 600 }}>
                                                <Clock size={14} opacity={0.5} /> {selectedUser.created_at && !isNaN(new Date(selectedUser.created_at).getTime()) ? format(new Date(selectedUser.created_at), 'yyyy-MM-dd') : '历史数据'}
                                            </div>
                                        </div>
                                    </>
                                )}
                            </div>

                            {/* Right Col: Permissions */}
                            <div style={{ background: 'rgba(0,0,0,0.2)', padding: '24px', borderRadius: 20, border: '1px solid var(--glass-border)', display: 'flex', flexDirection: 'column' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                                    <h4 style={{ fontWeight: 800, fontSize: '1.1rem' }}>动态目录授权</h4>
                                    <button className="btn-primary" onClick={() => setIsGranting(true)}>
                                        <FolderPlus size={16} /> 增加授权
                                    </button>
                                </div>

                                <div style={{ display: 'flex', flexDirection: 'column', gap: 12, flex: 1 }}>
                                    {userPermissions.length > 0 ? userPermissions.map(p => (
                                        <div key={p.id} className="row-hover" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid var(--glass-border)', padding: '14px 18px', borderRadius: 14, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                            <div style={{ overflow: 'hidden' }}>
                                                <div style={{ fontWeight: 600, fontSize: '0.95rem', whiteSpace: 'nowrap', textOverflow: 'ellipsis', display: 'flex', alignItems: 'center', gap: 6 }}>
                                                    <Folder size={14} color="var(--accent-blue)" /> {p.folder_path}
                                                </div>
                                                <div className="hint" style={{ fontSize: '0.75rem', display: 'flex', gap: 12, marginTop: 4 }}>
                                                    <span style={{ color: p.access_type === 'Full' ? 'var(--accent-blue)' : '#aaa', fontWeight: 600 }}>
                                                        {p.access_type === 'Full' ? '完全控制' : '只读访问'}
                                                    </span>
                                                    <span>•</span>
                                                    <span>{p.expires_at ? `到期: ${format(new Date(p.expires_at), 'yyyy-MM-dd')}` : '永久'}</span>
                                                </div>
                                            </div>
                                            <button onClick={() => handleRevokePermission(p.id)} style={{ background: 'rgba(255,59,48,0.1)', border: 'none', color: '#ff3b30', cursor: 'pointer', padding: 8, borderRadius: 8, transition: 'all 0.2s' }}>
                                                <Trash2 size={16} />
                                            </button>
                                        </div>
                                    )) : (
                                        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', opacity: 0.3, padding: 40 }}>
                                            <Lock size={48} style={{ marginBottom: 12 }} />
                                            <p>暂无手动授权项目</p>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Permission Grant Modal (Stage 2) */}
            {isGranting && (
                <div className="modal-overlay" style={{ zIndex: 2100 }} onClick={() => setIsGranting(false)}>
                    <div className="modal-content scale-in" onClick={e => e.stopPropagation()} style={{ maxWidth: 460 }}>
                        <h3 style={{ marginBottom: 20, display: 'flex', alignItems: 'center', gap: 10 }}>新增访问授权</h3>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                            <div>
                                <label className="hint">目标目录</label>
                                <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
                                    <input
                                        readOnly
                                        value={grantPath}
                                        placeholder="点击右侧浏览目录..."
                                        style={{ flex: 1, background: 'rgba(255,255,255,0.05)', border: '1px solid var(--glass-border)', padding: '12px 14px', borderRadius: 10, color: 'white' }}
                                    />
                                    <button className="btn-glass" style={{ background: 'var(--accent-blue)', color: 'black', fontWeight: 700 }} onClick={() => { setIsBrowserOpen(true); fetchBrowserFiles(isLead ? currentUser?.department_name || '' : ''); }}>浏览</button>
                                </div>
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 20 }}>
                                <div>
                                    <label className="hint">权限等级</label>
                                    <select className="form-control" value={grantType} onChange={e => setGrantType(e.target.value)}>
                                        <option value="Read">只读浏览 (Read)</option>
                                        <option value="Full">完全控制 (Full)</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="hint">有效期</label>
                                    <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                                        {['7天', '1个月', '永久', '自定义'].map(label => (
                                            <button
                                                key={label}
                                                type="button"
                                                onClick={() => {
                                                    setExpiryPreset(label);
                                                    if (label === '自定义' && !grantExpiry) {
                                                        setGrantExpiry(format(new Date(), 'yyyy-MM-dd'));
                                                    }
                                                }}
                                                className={expiryPreset === label ? 'btn-primary' : 'btn-glass'}
                                                style={{ flex: 1, padding: '8px 4px', fontSize: '0.85rem', height: 'auto', border: expiryPreset === label ? '1px solid var(--accent-blue)' : '1px solid var(--glass-border)' }}
                                            >
                                                {label}
                                            </button>
                                        ))}
                                    </div>
                                    {expiryPreset === '自定义' && (
                                        <div style={{ marginTop: 12 }} className="fade-in">
                                            <KineDatePicker value={grantExpiry} onChange={setGrantExpiry} />
                                            <p className="hint" style={{ marginTop: 8, fontSize: '0.85rem' }}>请选择授权失效的具体日期。</p>
                                        </div>
                                    )}
                                </div>
                            </div>

                            <div style={{ display: 'flex', gap: 12, marginTop: 10 }}>
                                <button className="btn-primary" style={{ flex: 1, height: 48, justifyContent: 'center' }} onClick={handleGrantPermission}>授权生效</button>
                                <button className="btn-glass" style={{ flex: 1, height: 48, justifyContent: 'center' }} onClick={() => setIsGranting(false)}>返回</button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Folder Browser Modal (Inside Grant Modal) */}
            {isBrowserOpen && (
                <div className="modal-overlay" style={{ zIndex: 2200 }} onClick={() => setIsBrowserOpen(false)}>
                    <div className="modal-content fade-in" onClick={e => e.stopPropagation()} style={{ maxWidth: 520, minHeight: 460 }}>
                        <div className="modal-header">
                            <h3 style={{ display: 'flex', alignItems: 'center', gap: 10 }}><Folder size={22} color="var(--accent-blue)" /> 选择授权文件夹</h3>
                            <button onClick={() => setIsBrowserOpen(false)} style={{ background: 'none', border: 'none', color: 'gray', cursor: 'pointer' }}><X size={24} /></button>
                        </div>

                        <div style={{ background: 'rgba(255,255,255,0.05)', padding: '10px 16px', borderRadius: 10, marginBottom: 20, fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: 8 }}>
                            <Clock size={14} opacity={0.5} /> <span className="hint">当前路径:</span> <code style={{ color: 'var(--accent-blue)', fontWeight: 700 }}>{browserPath || '/'}</code>
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
                                    <ChevronRight size={18} style={{ transform: 'rotate(180deg)', opacity: 0.5 }} /> <span style={{ fontWeight: 600 }}>返回上级...</span>
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
                                        <Folder size={20} color="var(--accent-blue)" fill="rgba(255,210,0,0.2)" />
                                        <span style={{ fontWeight: 500 }}>{f.name}</span>
                                    </div>
                                    <button
                                        className="btn-primary"
                                        style={{ height: '32px', padding: '0 12px', fontSize: '0.8rem', borderRadius: 8 }}
                                        onClick={(e) => { e.stopPropagation(); setGrantPath(f.path); setIsBrowserOpen(false); }}
                                    >
                                        选定
                                    </button>
                                </div>
                            ))}
                            {browserFiles.filter(f => f.isDirectory).length === 0 && (
                                <div style={{ textAlign: 'center', padding: 60, opacity: 0.3 }}>
                                    <FolderPlus size={40} style={{ marginBottom: 12 }} />
                                    <div>该目录下无可用子目录</div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}


            {/* Hint Section */}
            <div style={{ marginTop: 24, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 20 }}>
                <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid var(--glass-border)', padding: 20, borderRadius: 16 }}>
                    <h4 style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}><Shield size={18} color="var(--accent-blue)" /> 权限说明</h4>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                        <div style={{ display: 'flex', gap: 12 }}>
                            <div style={{ width: 80, fontWeight: 700, color: 'var(--accent-blue)', fontSize: '0.9rem' }}>系统管理员</div>
                            <div className="hint" style={{ flex: 1, fontSize: '0.85rem' }}>拥有系统所有权限，包括用户管理、部门设置、全局文件访问等。</div>
                        </div>
                        <div style={{ display: 'flex', gap: 12 }}>
                            <div style={{ width: 80, fontWeight: 700, color: 'var(--accent-blue)', fontSize: '0.9rem' }}>部门主管</div>
                            <div className="hint" style={{ flex: 1, fontSize: '0.85rem' }}>拥有所辖部门文件夹的完全控制权，可查看本部门成员列表。</div>
                        </div>
                        <div style={{ display: 'flex', gap: 12 }}>
                            <div style={{ width: 80, fontWeight: 700, color: 'var(--accent-blue)', fontSize: '0.9rem' }}>普通成员</div>
                            <div className="hint" style={{ flex: 1, fontSize: '0.85rem' }}>仅拥有个人空间和被授权文件夹的访问权限。</div>
                        </div>
                    </div>
                </div>
            </div>
        </div >
    );
};

export default UserManagement;
