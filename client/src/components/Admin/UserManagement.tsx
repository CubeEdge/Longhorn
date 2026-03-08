import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { Plus, X, Save, UserCheck, UserX, ChevronDown, ChevronRight, Users, ShieldCheck } from 'lucide-react';
import { useAuthStore } from '../../store/useAuthStore';
import { useToast } from '../../store/useToast';

interface User {
    id: number;
    username: string;
    display_name: string;
    role: string;
    department_id: number | null;
    department_name: string | null;
    dept_code: string | null;
    is_active: boolean;
    created_at: string;
}

interface Department {
    id: number;
    name: string;
}

interface EditForm {
    display_name: string;
    username: string;
    role: string;
    department_id: string;
    password: string;
}

const ALL_ROLES = ['Admin', 'Exec', 'Lead', 'Service', 'Engineer', 'Technician', 'Operation', 'Member'];
const LEAD_EDITABLE_ROLES = ['Lead', 'Member'];

const ROLE_BADGE: Record<string, { bg: string; color: string; label: string }> = {
    Admin:      { bg: 'rgba(255,215,0,0.18)',  color: '#FFD700', label: 'Admin' },
    Exec:       { bg: 'rgba(255,215,0,0.18)',  color: '#FFD700', label: 'Exec' },
    Lead:       { bg: 'rgba(59,130,246,0.18)', color: '#3B82F6', label: 'Lead' },
    Manager:    { bg: 'rgba(59,130,246,0.18)', color: '#3B82F6', label: 'Lead' },
    Service:    { bg: 'rgba(16,185,129,0.18)', color: '#10B981', label: 'Service' },
    Engineer:   { bg: 'rgba(107,114,128,0.18)', color: 'var(--text-secondary)', label: 'Engineer' },
    Technician: { bg: 'rgba(107,114,128,0.18)', color: 'var(--text-secondary)', label: 'Technician' },
    Operation:  { bg: 'rgba(107,114,128,0.18)', color: 'var(--text-secondary)', label: 'Operation' },
    Member:     { bg: 'rgba(107,114,128,0.18)', color: 'var(--text-secondary)', label: 'Member' },
    Staff:      { bg: 'rgba(107,114,128,0.18)', color: 'var(--text-secondary)', label: 'Member' },
};

const DEPT_LABELS: Record<string, string> = {
    MS: '市场部', OP: '运营部', GE: '综合台', RD: '研发部'
};

function RoleBadge({ role }: { role: string }) {
    const style = ROLE_BADGE[role] || ROLE_BADGE['Member'];
    return (
        <span style={{
            background: style.bg, color: style.color,
            padding: '2px 8px', borderRadius: 6,
            fontSize: '0.72rem', fontWeight: 600, letterSpacing: '0.03em',
            border: `1px solid ${style.color}33`
        }}>
            {style.label}
        </span>
    );
}

function Avatar({ name, isActive }: { name: string; isActive: boolean }) {
    const letter = (name || '?').charAt(0).toUpperCase();
    return (
        <div style={{
            width: 36, height: 36, borderRadius: '50%',
            background: isActive ? 'linear-gradient(135deg, #3B82F6 0%, #10B981 100%)' : 'var(--glass-bg-hover)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '0.9rem', fontWeight: 700,
            color: isActive ? '#fff' : 'var(--text-tertiary)',
            flexShrink: 0, opacity: isActive ? 1 : 0.5,
            border: '1px solid var(--glass-border)'
        }}>
            {letter}
        </div>
    );
}

const UserManagement: React.FC = () => {
    const { token, user: currentUser } = useAuthStore();
    const { showToast } = useToast();

    const isAdminOrExec = currentUser?.role === 'Admin' || currentUser?.role === 'Exec';
    const isLead = currentUser?.role === 'Lead';

    const [users, setUsers] = useState<User[]>([]);
    const [departments, setDepartments] = useState<Department[]>([]);
    const [loading, setLoading] = useState(true);
    const [filterDept, setFilterDept] = useState<string>('all');
    const [collapsedDepts, setCollapsedDepts] = useState<Set<string>>(new Set());

    // Edit modal
    const [editingUser, setEditingUser] = useState<User | null>(null);
    const [editForm, setEditForm] = useState<EditForm>({ display_name: '', username: '', role: '', department_id: '', password: '' });
    const [saving, setSaving] = useState(false);

    // New user modal
    const [showNewUser, setShowNewUser] = useState(false);
    const [newForm, setNewForm] = useState<EditForm>({ display_name: '', username: '', role: 'Member', department_id: '', password: '' });
    const [creating, setCreating] = useState(false);

    const fetchUsers = useCallback(async () => {
        try {
            setLoading(true);
            const res = await axios.get('/api/admin/users', { headers: { Authorization: `Bearer ${token}` } });
            setUsers(res.data);
        } catch (e) {
            showToast('加载用户列表失败', 'error');
        } finally {
            setLoading(false);
        }
    }, [token]);

    const fetchDepts = useCallback(async () => {
        if (!isAdminOrExec) return;
        try {
            const res = await axios.get('/api/admin/departments', { headers: { Authorization: `Bearer ${token}` } });
            setDepartments(res.data);
        } catch (_) { /* ignore */ }
    }, [token, isAdminOrExec]);

    useEffect(() => {
        fetchUsers();
        fetchDepts();
    }, [fetchUsers, fetchDepts]);

    // Group users by department
    const grouped = React.useMemo(() => {
        const map: Record<string, { label: string; users: User[] }> = {};
        const filtered = filterDept === 'all' ? users : users.filter(u => u.dept_code === filterDept);
        filtered.forEach(u => {
            const key = u.dept_code || 'NONE';
            if (!map[key]) {
                const deptLabel = DEPT_LABELS[key] || u.department_name || '无部门';
                map[key] = { label: deptLabel, users: [] };
            }
            map[key].users.push(u);
        });
        return map;
    }, [users, filterDept]);

    const deptKeys = Object.keys(grouped);

    const toggleCollapse = (key: string) => {
        setCollapsedDepts(prev => {
            const next = new Set(prev);
            if (next.has(key)) next.delete(key); else next.add(key);
            return next;
        });
    };

    const openEdit = (u: User) => {
        setEditingUser(u);
        setEditForm({
            display_name: u.display_name || u.username,
            username: u.username,
            role: u.role,
            department_id: String(u.department_id || ''),
            password: ''
        });
    };

    const handleSave = async () => {
        if (!editingUser) return;
        setSaving(true);
        try {
            const payload: Record<string, unknown> = {};
            if (isAdminOrExec) {
                payload.display_name = editForm.display_name;
                payload.username = editForm.username;
                payload.role = editForm.role;
                payload.department_id = editForm.department_id ? Number(editForm.department_id) : null;
                if (editForm.password) payload.password = editForm.password;
            } else if (isLead) {
                payload.role = editForm.role;
            }
            await axios.put(`/api/admin/users/${editingUser.id}`, payload, { headers: { Authorization: `Bearer ${token}` } });
            showToast('保存成功', 'success');
            setEditingUser(null);
            fetchUsers();
        } catch (err: unknown) {
            const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error || '保存失败';
            showToast(msg, 'error');
        } finally {
            setSaving(false);
        }
    };

    const handleToggle = async (u: User) => {
        try {
            const res = await axios.patch(`/api/admin/users/${u.id}/toggle`, {}, { headers: { Authorization: `Bearer ${token}` } });
            const statusLabel = res.data.is_active ? '已启用' : '已禁用';
            showToast(`账户${statusLabel}：${u.display_name}`, 'success');
            fetchUsers();
        } catch (err: unknown) {
            const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error || '操作失败';
            showToast(msg, 'error');
        }
    };

    const handleCreate = async () => {
        if (!newForm.username || !newForm.password) {
            showToast('用户名和密码必填', 'error'); return;
        }
        setCreating(true);
        try {
            await axios.post('/api/admin/users', {
                username: newForm.username,
                display_name: newForm.display_name || newForm.username,
                password: newForm.password,
                role: newForm.role || 'Member',
                department_id: newForm.department_id ? Number(newForm.department_id) : null
            }, { headers: { Authorization: `Bearer ${token}` } });
            showToast('用户创建成功', 'success');
            setShowNewUser(false);
            setNewForm({ display_name: '', username: '', role: 'Member', department_id: '', password: '' });
            fetchUsers();
        } catch (err: unknown) {
            const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error || '创建失败';
            showToast(msg, 'error');
        } finally {
            setCreating(false);
        }
    };

    // Available depts for filter tabs
    const allDepts = Array.from(new Set(users.map(u => u.dept_code).filter(Boolean))) as string[];

    return (
        <div style={{ padding: 32 }}>
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
                <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
                        <Users size={20} color="#3B82F6" />
                        <h2 style={{ fontSize: '1.15rem', fontWeight: 700, color: 'var(--text-main)', margin: 0 }}>
                            人员管理
                        </h2>
                        <span style={{
                            background: 'rgba(59,130,246,0.12)', color: '#3B82F6',
                            padding: '2px 8px', borderRadius: 6, fontSize: '0.75rem', fontWeight: 600
                        }}>
                            {users.length} 人
                        </span>
                    </div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-tertiary)' }}>
                        {isAdminOrExec ? '管理全公司人员账户与权限' : '查看并管理本部门成员'}
                    </div>
                </div>
                {isAdminOrExec && (
                    <button
                        onClick={() => setShowNewUser(true)}
                        style={{
                            display: 'flex', alignItems: 'center', gap: 6,
                            background: 'var(--accent-blue)', color: '#fff',
                            border: 'none', borderRadius: 10, padding: '9px 16px',
                            fontWeight: 600, fontSize: '0.88rem', cursor: 'pointer'
                        }}
                    >
                        <Plus size={15} /> 新建用户
                    </button>
                )}
            </div>

            {/* Dept Filter Tabs */}
            {isAdminOrExec && allDepts.length > 1 && (
                <div style={{ display: 'flex', gap: 6, marginBottom: 20, flexWrap: 'wrap' }}>
                    {['all', ...allDepts].map(d => (
                        <button key={d} onClick={() => setFilterDept(d)} style={{
                            padding: '5px 14px', borderRadius: 8, border: 'none',
                            background: filterDept === d ? 'var(--accent-blue)' : 'var(--glass-bg-hover)',
                            color: filterDept === d ? '#fff' : 'var(--text-secondary)',
                            fontWeight: 500, fontSize: '0.82rem', cursor: 'pointer', transition: 'all 0.15s'
                        }}>
                            {d === 'all' ? '全部' : (DEPT_LABELS[d] || d)}
                        </button>
                    ))}
                </div>
            )}

            {/* User List */}
            {loading ? (
                <div style={{ textAlign: 'center', color: 'var(--text-tertiary)', padding: 40 }}>加载中...</div>
            ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                    {deptKeys.length === 0 && (
                        <div style={{ textAlign: 'center', color: 'var(--text-tertiary)', padding: 40 }}>暂无用户</div>
                    )}
                    {deptKeys.map(key => {
                        const { label, users: dUsers } = grouped[key];
                        const isCollapsed = collapsedDepts.has(key);
                        return (
                            <div key={key} style={{
                                background: 'var(--glass-bg-hover)', borderRadius: 14,
                                border: '1px solid var(--glass-border)', overflow: 'hidden'
                            }}>
                                {/* Section Header */}
                                <div
                                    onClick={() => toggleCollapse(key)}
                                    style={{
                                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                        padding: '12px 20px', cursor: 'pointer',
                                        borderBottom: isCollapsed ? 'none' : '1px solid var(--glass-border)'
                                    }}
                                >
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                        {isCollapsed ? <ChevronRight size={15} color="var(--text-tertiary)" /> : <ChevronDown size={15} color="var(--text-tertiary)" />}
                                        <span style={{ fontWeight: 700, fontSize: '0.88rem', color: 'var(--text-main)' }}>
                                            {key !== 'NONE' ? `${key} · ${label}` : label}
                                        </span>
                                        <span style={{
                                            background: 'rgba(59,130,246,0.1)', color: '#3B82F6',
                                            padding: '1px 7px', borderRadius: 5, fontSize: '0.72rem', fontWeight: 600
                                        }}>
                                            {dUsers.length}
                                        </span>
                                    </div>
                                    <div style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)' }}>
                                        {dUsers.filter(u => !u.is_active).length > 0 && (
                                            <span style={{ color: '#EF4444' }}>{dUsers.filter(u => !u.is_active).length} 已禁用</span>
                                        )}
                                    </div>
                                </div>

                                {/* User Rows */}
                                {!isCollapsed && (
                                    <div>
                                        {dUsers.map((u, idx) => (
                                            <div
                                                key={u.id}
                                                onClick={() => openEdit(u)}
                                                style={{
                                                    display: 'flex', alignItems: 'center', gap: 14,
                                                    padding: '12px 20px', cursor: 'pointer',
                                                    borderBottom: idx < dUsers.length - 1 ? '1px solid var(--glass-border)' : 'none',
                                                    opacity: u.is_active ? 1 : 0.5, transition: 'background 0.15s'
                                                }}
                                                onMouseEnter={e => (e.currentTarget.style.background = 'var(--glass-bg)')}
                                                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                                            >
                                                <Avatar name={u.display_name} isActive={u.is_active} />
                                                <div style={{ flex: 1, minWidth: 0 }}>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                                                        <span style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--text-main)' }}>
                                                            {u.display_name}
                                                        </span>
                                                        {u.display_name !== u.username && (
                                                            <span style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)' }}>@{u.username}</span>
                                                        )}
                                                        {!u.is_active && (
                                                            <span style={{
                                                                fontSize: '0.7rem', color: '#EF4444',
                                                                background: 'rgba(239,68,68,0.1)',
                                                                padding: '1px 6px', borderRadius: 4, fontWeight: 600
                                                            }}>已禁用</span>
                                                        )}
                                                    </div>
                                                    <div style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', marginTop: 2 }}>
                                                        {new Date(u.created_at).toLocaleDateString('zh-CN')} 加入
                                                    </div>
                                                </div>
                                                <RoleBadge role={u.role} />
                                                {isAdminOrExec && (
                                                    <button
                                                        onClick={e => { e.stopPropagation(); handleToggle(u); }}
                                                        title={u.is_active ? '禁用账户' : '启用账户'}
                                                        style={{
                                                            background: 'transparent', border: 'none',
                                                            cursor: 'pointer', padding: 6, borderRadius: 8,
                                                            color: u.is_active ? 'var(--text-tertiary)' : '#10B981',
                                                            transition: 'all 0.15s'
                                                        }}
                                                        onMouseEnter={e => { e.currentTarget.style.background = u.is_active ? 'rgba(239,68,68,0.08)' : 'rgba(16,185,129,0.08)'; e.currentTarget.style.color = u.is_active ? '#EF4444' : '#10B981'; }}
                                                        onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = u.is_active ? 'var(--text-tertiary)' : '#10B981'; }}
                                                    >
                                                        {u.is_active ? <UserX size={16} /> : <UserCheck size={16} />}
                                                    </button>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Edit User Drawer */}
            {editingUser && (
                <>
                    <div
                        onClick={() => setEditingUser(null)}
                        style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.35)', zIndex: 1000, backdropFilter: 'blur(2px)' }}
                    />
                    <div style={{
                        position: 'fixed', top: 0, right: 0, bottom: 0, width: 400,
                        background: 'var(--sidebar-bg)', borderLeft: '1px solid var(--glass-border)',
                        zIndex: 1001, display: 'flex', flexDirection: 'column',
                        boxShadow: '-8px 0 32px rgba(0,0,0,0.2)'
                    }}>
                        {/* Drawer Header */}
                        <div style={{
                            padding: '20px 24px', borderBottom: '1px solid var(--glass-border)',
                            display: 'flex', alignItems: 'center', justifyContent: 'space-between'
                        }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                                <ShieldCheck size={18} color="#3B82F6" />
                                <span style={{ fontWeight: 700, fontSize: '1rem', color: 'var(--text-main)' }}>
                                    编辑用户
                                </span>
                            </div>
                            <button onClick={() => setEditingUser(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)' }}>
                                <X size={20} />
                            </button>
                        </div>

                        {/* Drawer Body */}
                        <div style={{ flex: 1, overflow: 'auto', padding: 24, display: 'flex', flexDirection: 'column', gap: 20 }}>
                            {/* Avatar + name preview */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 16px', background: 'var(--glass-bg-hover)', borderRadius: 12 }}>
                                <Avatar name={editingUser.display_name} isActive={editingUser.is_active} />
                                <div>
                                    <div style={{ fontWeight: 700, color: 'var(--text-main)', fontSize: '0.95rem' }}>{editingUser.display_name}</div>
                                    <div style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)' }}>@{editingUser.username}</div>
                                </div>
                                {!editingUser.is_active && (
                                    <span style={{ marginLeft: 'auto', color: '#EF4444', fontSize: '0.75rem', fontWeight: 600, background: 'rgba(239,68,68,0.1)', padding: '3px 8px', borderRadius: 6 }}>已禁用</span>
                                )}
                            </div>

                            {isAdminOrExec && (
                                <>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                                        <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: 600 }}>显示名称</label>
                                        <input
                                            type="text"
                                            value={editForm.display_name}
                                            onChange={e => setEditForm(f => ({ ...f, display_name: e.target.value }))}
                                            style={{ padding: '9px 12px', borderRadius: 8, border: '1px solid var(--glass-border)', background: 'var(--glass-bg-hover)', color: 'var(--text-main)', fontSize: '0.9rem', outline: 'none' }}
                                        />
                                    </div>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                                        <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: 600 }}>登录用户名</label>
                                        <input
                                            type="text"
                                            value={editForm.username}
                                            onChange={e => setEditForm(f => ({ ...f, username: e.target.value }))}
                                            style={{ padding: '9px 12px', borderRadius: 8, border: '1px solid var(--glass-border)', background: 'var(--glass-bg-hover)', color: 'var(--text-main)', fontSize: '0.9rem', outline: 'none' }}
                                        />
                                    </div>
                                </>
                            )}

                            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                                <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: 600 }}>角色</label>
                                <select
                                    value={editForm.role}
                                    onChange={e => setEditForm(f => ({ ...f, role: e.target.value }))}
                                    style={{ padding: '9px 12px', borderRadius: 8, border: '1px solid var(--glass-border)', background: 'var(--glass-bg-hover)', color: 'var(--text-main)', fontSize: '0.9rem', outline: 'none' }}
                                >
                                    {(isAdminOrExec ? ALL_ROLES : LEAD_EDITABLE_ROLES).map(r => (
                                        <option key={r} value={r}>{r}</option>
                                    ))}
                                </select>
                            </div>

                            {isAdminOrExec && (
                                <>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                                        <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: 600 }}>所属部门</label>
                                        <select
                                            value={editForm.department_id}
                                            onChange={e => setEditForm(f => ({ ...f, department_id: e.target.value }))}
                                            style={{ padding: '9px 12px', borderRadius: 8, border: '1px solid var(--glass-border)', background: 'var(--glass-bg-hover)', color: 'var(--text-main)', fontSize: '0.9rem', outline: 'none' }}
                                        >
                                            <option value="">无部门</option>
                                            {departments.map(d => (
                                                <option key={d.id} value={d.id}>{d.name}</option>
                                            ))}
                                        </select>
                                    </div>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                                        <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: 600 }}>新密码（留空则不修改）</label>
                                        <input
                                            type="password"
                                            placeholder="输入新密码..."
                                            value={editForm.password}
                                            onChange={e => setEditForm(f => ({ ...f, password: e.target.value }))}
                                            style={{ padding: '9px 12px', borderRadius: 8, border: '1px solid var(--glass-border)', background: 'var(--glass-bg-hover)', color: 'var(--text-main)', fontSize: '0.9rem', outline: 'none' }}
                                        />
                                    </div>
                                </>
                            )}
                        </div>

                        {/* Drawer Footer */}
                        <div style={{ padding: '16px 24px', borderTop: '1px solid var(--glass-border)', display: 'flex', flexDirection: 'column', gap: 10 }}>
                            {isAdminOrExec && editingUser.id !== currentUser?.id && (
                                <button
                                    onClick={() => { handleToggle(editingUser); setEditingUser(null); }}
                                    style={{
                                        width: '100%', padding: '10px', borderRadius: 10, fontWeight: 600,
                                        background: editingUser.is_active ? 'rgba(239,68,68,0.08)' : 'rgba(16,185,129,0.08)',
                                        color: editingUser.is_active ? '#EF4444' : '#10B981',
                                        border: `1px solid ${editingUser.is_active ? 'rgba(239,68,68,0.3)' : 'rgba(16,185,129,0.3)'}`,
                                        cursor: 'pointer', fontSize: '0.88rem',
                                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8
                                    }}
                                >
                                    {editingUser.is_active ? <><UserX size={15} /> 禁用账户</> : <><UserCheck size={15} /> 启用账户</>}
                                </button>
                            )}
                            <button
                                onClick={handleSave}
                                disabled={saving}
                                style={{
                                    width: '100%', padding: '10px', borderRadius: 10, fontWeight: 600,
                                    background: 'var(--accent-blue)', color: '#fff',
                                    border: 'none', cursor: saving ? 'wait' : 'pointer', fontSize: '0.88rem',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                                    opacity: saving ? 0.7 : 1
                                }}
                            >
                                <Save size={15} /> {saving ? '保存中...' : '保存更改'}
                            </button>
                        </div>
                    </div>
                </>
            )}

            {/* New User Modal */}
            {showNewUser && (
                <>
                    <div onClick={() => setShowNewUser(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.35)', zIndex: 1000, backdropFilter: 'blur(2px)' }} />
                    <div style={{
                        position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
                        width: 420, background: 'var(--sidebar-bg)', borderRadius: 18,
                        border: '1px solid var(--glass-border)', zIndex: 1001,
                        boxShadow: '0 24px 64px rgba(0,0,0,0.25)', overflow: 'hidden'
                    }}>
                        <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--glass-border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                <Plus size={18} color="#3B82F6" />
                                <span style={{ fontWeight: 700, fontSize: '1rem', color: 'var(--text-main)' }}>新建用户</span>
                            </div>
                            <button onClick={() => setShowNewUser(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)' }}><X size={20} /></button>
                        </div>
                        <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>
                            {[
                                { label: '显示名称', key: 'display_name', type: 'text', placeholder: '如：张三' },
                                { label: '登录用户名 *', key: 'username', type: 'text', placeholder: '如：zhangsan' },
                                { label: '登录密码 *', key: 'password', type: 'password', placeholder: '至少6位' },
                            ].map(({ label, key, type, placeholder }) => (
                                <div key={key} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                                    <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: 600 }}>{label}</label>
                                    <input
                                        type={type}
                                        placeholder={placeholder}
                                        value={(newForm as unknown as Record<string, string>)[key]}
                                        onChange={e => setNewForm(f => ({ ...f, [key]: e.target.value }))}
                                        style={{ padding: '9px 12px', borderRadius: 8, border: '1px solid var(--glass-border)', background: 'var(--glass-bg-hover)', color: 'var(--text-main)', fontSize: '0.9rem', outline: 'none' }}
                                    />
                                </div>
                            ))}
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                                <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: 600 }}>角色</label>
                                <select value={newForm.role} onChange={e => setNewForm(f => ({ ...f, role: e.target.value }))}
                                    style={{ padding: '9px 12px', borderRadius: 8, border: '1px solid var(--glass-border)', background: 'var(--glass-bg-hover)', color: 'var(--text-main)', fontSize: '0.9rem', outline: 'none' }}>
                                    {ALL_ROLES.map(r => <option key={r} value={r}>{r}</option>)}
                                </select>
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                                <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: 600 }}>所属部门</label>
                                <select value={newForm.department_id} onChange={e => setNewForm(f => ({ ...f, department_id: e.target.value }))}
                                    style={{ padding: '9px 12px', borderRadius: 8, border: '1px solid var(--glass-border)', background: 'var(--glass-bg-hover)', color: 'var(--text-main)', fontSize: '0.9rem', outline: 'none' }}>
                                    <option value="">无部门</option>
                                    {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                                </select>
                            </div>
                        </div>
                        <div style={{ padding: '0 24px 24px' }}>
                            <button
                                onClick={handleCreate}
                                disabled={creating}
                                style={{
                                    width: '100%', padding: '11px', borderRadius: 10, fontWeight: 600,
                                    background: 'var(--accent-blue)', color: '#fff',
                                    border: 'none', cursor: creating ? 'wait' : 'pointer', fontSize: '0.9rem',
                                    opacity: creating ? 0.7 : 1
                                }}
                            >
                                {creating ? '创建中...' : '创建用户'}
                            </button>
                        </div>
                    </div>
                </>
            )}
        </div>
    );
};

export default UserManagement;
