import React, { useState, useEffect, useCallback, useRef } from 'react';
import axios from 'axios';
import { Plus, X, Save, UserCheck, UserX, Users, ShieldCheck, Search, MoreHorizontal, Edit2, ChevronUp, ChevronDown, Trash2 } from 'lucide-react';
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

// Kine brand colors
const KINE_RED = '#E63946';
const KINE_YELLOW = '#FFD700';

// Role badge colors - matching avatar: Admin/Exec = Kine Red, Lead = Kine Yellow, others = gray
const ROLE_BADGE: Record<string, { bg: string; color: string; label: string }> = {
    Admin:      { bg: 'rgba(230,57,70,0.18)',  color: KINE_RED, label: 'Admin' },
    Exec:       { bg: 'rgba(230,57,70,0.18)',  color: KINE_RED, label: 'Exec' },
    Lead:       { bg: 'rgba(255,215,0,0.18)',  color: KINE_YELLOW, label: 'Lead' },
    Manager:    { bg: 'rgba(255,215,0,0.18)',  color: KINE_YELLOW, label: 'Lead' },
    Service:    { bg: 'rgba(107,114,128,0.18)', color: 'var(--text-secondary)', label: 'Service' },
    Engineer:   { bg: 'rgba(107,114,128,0.18)', color: 'var(--text-secondary)', label: 'Engineer' },
    Technician: { bg: 'rgba(107,114,128,0.18)', color: 'var(--text-secondary)', label: 'Technician' },
    Operation:  { bg: 'rgba(107,114,128,0.18)', color: 'var(--text-secondary)', label: 'Operation' },
    Member:     { bg: 'rgba(107,114,128,0.18)', color: 'var(--text-secondary)', label: 'Member' },
    Staff:      { bg: 'rgba(107,114,128,0.18)', color: 'var(--text-secondary)', label: 'Member' },
};

const DEPT_LABELS: Record<string, string> = {
    MS: '市场部', OP: '运营部', GE: '通用台面', RD: '研发部'
};

// Top bar height constant for drawer/modal positioning
const TOP_BAR_HEIGHT = 64;

function RoleBadge({ role }: { role: string }) {
    const style = ROLE_BADGE[role] || ROLE_BADGE['Member'];
    return (
        <span style={{
            background: style.bg, color: style.color,
            padding: '3px 10px', borderRadius: 6,
            fontSize: '0.75rem', fontWeight: 600, letterSpacing: '0.02em',
            border: `1px solid ${style.color}33`
        }}>
            {style.label}
        </span>
    );
}

// Status badge with activity levels based on last login time
function StatusBadge({ user }: { user: User }) {
    if (!user.is_active) {
        return (
            <span style={{ 
                color: '#6B7280', 
                fontSize: '0.85rem',
                background: 'rgba(107,114,128,0.15)',
                padding: '3px 10px',
                borderRadius: 6,
                fontWeight: 500
            }}>禁用</span>
        );
    }
    
    // Determine activity level based on user ID (simulating different activity levels)
    // In production, this should use actual login duration data from user_sessions table
    const userIdMod = user.id % 4;
    
    if (userIdMod === 0) {
        // Super active: >4h daily, every workday
        return (
            <span style={{ 
                color: '#10B981', 
                fontSize: '0.85rem',
                background: 'rgba(16,185,129,0.15)',
                padding: '3px 10px',
                borderRadius: 6,
                fontWeight: 600
            }}>超活跃</span>
        );
    } else if (userIdMod === 1 || userIdMod === 2) {
        // Active: 1-4h, at least 3 times per week
        return (
            <span style={{ 
                color: '#3B82F6', 
                fontSize: '0.85rem',
                background: 'rgba(59,130,246,0.15)',
                padding: '3px 10px',
                borderRadius: 6,
                fontWeight: 500
            }}>活跃</span>
        );
    } else {
        // Inactive: rarely login
        return (
            <span style={{ 
                color: '#F59E0B', 
                fontSize: '0.85rem',
                background: 'rgba(245,158,11,0.15)',
                padding: '3px 10px',
                borderRadius: 6,
                fontWeight: 500
            }}>呆滞</span>
        );
    }
}

// Avatar with role-based colors: Admin/Exec = Kine Red, Lead = Kine Yellow, others = no color
// Hollow style (border only) like the admin avatar in screenshot
function Avatar({ name, isActive, role }: { name: string; isActive: boolean; role: string }) {
    const letter = (name || '?').charAt(0).toUpperCase();
    
    // Determine avatar color based on role - hollow style with colored border
    let borderColor = 'var(--glass-border)';
    let textColor = 'var(--text-tertiary)';
    let bgColor = 'transparent';
    
    if (isActive) {
        if (role === 'Admin' || role === 'Exec') {
            borderColor = KINE_RED;
            textColor = KINE_RED;
            bgColor = 'rgba(230,57,70,0.08)';
        } else if (role === 'Lead') {
            borderColor = KINE_YELLOW;
            textColor = KINE_YELLOW;
            bgColor = 'rgba(255,215,0,0.08)';
        } else {
            // Regular members - no color, use default gray
            borderColor = 'var(--glass-border)';
            textColor = 'var(--text-tertiary)';
            bgColor = 'transparent';
        }
    }
    
    return (
        <div style={{
            width: 36, height: 36, borderRadius: '50%',
            background: bgColor,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '0.9rem', fontWeight: 700,
            color: textColor,
            flexShrink: 0, opacity: isActive ? 1 : 0.5,
            border: `2px solid ${borderColor}`
        }}>
            {letter}
        </div>
    );
}

// Countdown confirmation modal
function CountdownConfirmModal({ 
    isOpen, 
    onClose, 
    onConfirm, 
    title, 
    message, 
    countdownSeconds = 5,
    confirmText = '确认',
    cancelText = '取消',
    isDanger = false
}: { 
    isOpen: boolean; 
    onClose: () => void; 
    onConfirm: () => void; 
    title: string; 
    message: string;
    countdownSeconds?: number;
    confirmText?: string;
    cancelText?: string;
    isDanger?: boolean;
}) {
    const [countdown, setCountdown] = useState(countdownSeconds);
    const [canConfirm, setCanConfirm] = useState(false);
    
    useEffect(() => {
        if (!isOpen) {
            setCountdown(countdownSeconds);
            setCanConfirm(false);
            return;
        }
        
        setCountdown(countdownSeconds);
        setCanConfirm(false);
        
        const timer = setInterval(() => {
            setCountdown(prev => {
                if (prev <= 1) {
                    setCanConfirm(true);
                    clearInterval(timer);
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);
        
        return () => clearInterval(timer);
    }, [isOpen, countdownSeconds]);
    
    if (!isOpen) return null;
    
    return (
        <>
            <div 
                onClick={onClose}
                style={{ 
                    position: 'fixed', 
                    top: TOP_BAR_HEIGHT,
                    left: 0,
                    right: 0,
                    bottom: 0, 
                    background: 'rgba(0,0,0,0.6)', 
                    zIndex: 2000
                }} 
            />
            <div style={{
                position: 'fixed',
                top: '50%',
                left: '50%',
                transform: 'translate(-50%, -50%)',
                width: 400,
                background: '#0a0a0a',
                borderRadius: 16,
                border: '1px solid var(--glass-border)',
                zIndex: 2001,
                boxShadow: '0 24px 64px rgba(0,0,0,0.5)',
                padding: 24
            }}>
                <h3 style={{ 
                    fontSize: '1.1rem', 
                    fontWeight: 700, 
                    color: isDanger ? '#EF4444' : 'var(--text-main)',
                    marginBottom: 12 
                }}>
                    {title}
                </h3>
                <p style={{ 
                    fontSize: '0.95rem', 
                    color: 'var(--text-secondary)', 
                    marginBottom: 24,
                    lineHeight: 1.5
                }}>
                    {message}
                </p>
                <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
                    <button
                        onClick={onClose}
                        style={{
                            padding: '10px 20px',
                            borderRadius: 8,
                            border: '1px solid var(--glass-border)',
                            background: 'transparent',
                            color: 'var(--text-secondary)',
                            cursor: 'pointer',
                            fontSize: '0.9rem'
                        }}
                    >
                        {cancelText}
                    </button>
                    <button
                        onClick={onConfirm}
                        disabled={!canConfirm}
                        style={{
                            padding: '10px 20px',
                            borderRadius: 8,
                            border: 'none',
                            background: isDanger ? '#EF4444' : 'var(--accent-blue)',
                            color: '#fff',
                            cursor: canConfirm ? 'pointer' : 'not-allowed',
                            fontSize: '0.9rem',
                            fontWeight: 600,
                            opacity: canConfirm ? 1 : 0.5,
                            minWidth: 100
                        }}
                    >
                        {canConfirm ? confirmText : `${confirmText} (${countdown})`}
                    </button>
                </div>
            </div>
        </>
    );
}

// Action menu dropdown for each row
function ActionMenu({ 
    user, 
    onEdit, 
    onToggle, 
    onDelete,
    canToggle,
    canDelete 
}: { 
    user: User; 
    onEdit: () => void; 
    onToggle: () => void;
    onDelete: () => void;
    canToggle: boolean;
    canDelete: boolean;
}) {
    const [isOpen, setIsOpen] = useState(false);
    const menuRef = useRef<HTMLDivElement>(null);
    
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);
    
    return (
        <div ref={menuRef} style={{ position: 'relative' }}>
            <button
                onClick={() => setIsOpen(!isOpen)}
                style={{
                    background: 'transparent',
                    border: 'none',
                    cursor: 'pointer',
                    padding: '6px 12px',
                    borderRadius: 6,
                    color: 'var(--text-secondary)',
                    fontSize: '0.85rem',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 4
                }}
            >
                <MoreHorizontal size={16} />
            </button>
            {isOpen && (
                <div style={{
                    position: 'absolute',
                    top: '100%',
                    right: 0,
                    marginTop: 4,
                    background: 'var(--bg-sidebar)',
                    border: '1px solid var(--glass-border)',
                    borderRadius: 8,
                    padding: '4px 0',
                    minWidth: 120,
                    zIndex: 100,
                    boxShadow: '0 8px 32px var(--glass-shadow)'
                }}>
                    <button
                        onClick={() => { onEdit(); setIsOpen(false); }}
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 8,
                            width: '100%',
                            padding: '10px 12px',
                            background: 'transparent',
                            border: 'none',
                            color: 'var(--text-main)',
                            fontSize: '0.9rem',
                            cursor: 'pointer',
                            textAlign: 'left'
                        }}
                    >
                        <Edit2 size={14} /> 编辑
                    </button>
                    {canToggle && (
                        <button
                            onClick={() => { onToggle(); setIsOpen(false); }}
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: 8,
                                width: '100%',
                                padding: '10px 12px',
                                background: 'transparent',
                                border: 'none',
                                color: user.is_active ? '#EF4444' : '#10B981',
                                fontSize: '0.9rem',
                                cursor: 'pointer',
                                textAlign: 'left'
                            }}
                        >
                            {user.is_active ? <><UserX size={14} /> 禁用</> : <><UserCheck size={14} /> 启用</>}
                        </button>
                    )}
                    {canDelete && (
                        <button
                            onClick={() => { onDelete(); setIsOpen(false); }}
                            disabled={user.is_active}
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: 8,
                                width: '100%',
                                padding: '10px 12px',
                                background: 'transparent',
                                border: 'none',
                                color: user.is_active ? 'var(--text-tertiary)' : '#EF4444',
                                fontSize: '0.9rem',
                                cursor: user.is_active ? 'not-allowed' : 'pointer',
                                textAlign: 'left'
                            }}
                            title={user.is_active ? '请先禁用账户再删除' : ''}
                        >
                            <Trash2 size={14} /> 删除
                        </button>
                    )}
                </div>
            )}
        </div>
    );
}

const UserManagement: React.FC = () => {
    const { token, user: currentUser } = useAuthStore();
    const { showToast } = useToast();

    const isAdminOrExec = currentUser?.role === 'Admin' || currentUser?.role === 'Exec';
    const isLead = currentUser?.role === 'Lead';
    const myDeptCode = currentUser?.department_code || '';

    const [users, setUsers] = useState<User[]>([]);
    const [departments, setDepartments] = useState<Department[]>([]);
    const [loading, setLoading] = useState(true);
    const [filterDept, setFilterDept] = useState<string>(isLead ? myDeptCode : 'all');

    // Search state
    const [searchQuery, setSearchQuery] = useState('');
    const [isSearchExpanded, setIsSearchExpanded] = useState(false);
    const searchInputRef = useRef<HTMLInputElement>(null);

    // Sort state
    const [sortBy, setSortBy] = useState<string>('created_at');
    const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

    // Edit modal - also used for creating new user
    const [editingUser, setEditingUser] = useState<User | null>(null);
    const [isCreating, setIsCreating] = useState(false);
    const [editForm, setEditForm] = useState<EditForm>({ display_name: '', username: '', role: 'Member', department_id: '', password: '' });
    const [saving, setSaving] = useState(false);

    // More dropdown state (for header)
    const [isMoreDropdownOpen, setIsMoreDropdownOpen] = useState(false);
    const moreDropdownRef = useRef<HTMLDivElement>(null);

    // Confirmation modals
    const [toggleConfirmUser, setToggleConfirmUser] = useState<User | null>(null);
    const [deleteConfirmUser, setDeleteConfirmUser] = useState<User | null>(null);

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

    // Click outside to close dropdown
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (moreDropdownRef.current && !moreDropdownRef.current.contains(event.target as Node)) {
                setIsMoreDropdownOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const openEdit = (u: User) => {
        setIsCreating(false);
        setEditingUser(u);
        setEditForm({
            display_name: u.display_name || u.username,
            username: u.username,
            role: u.role,
            department_id: String(u.department_id || ''),
            password: ''
        });
    };

    const openCreate = () => {
        setIsCreating(true);
        setEditingUser({ id: -1, username: '', display_name: '', role: 'Member', department_id: null, department_name: null, dept_code: null, is_active: true, created_at: '' } as User);
        setEditForm({ display_name: '', username: '', role: 'Member', department_id: '', password: '' });
    };

    const closeDrawer = () => {
        setEditingUser(null);
        setIsCreating(false);
        setEditForm({ display_name: '', username: '', role: 'Member', department_id: '', password: '' });
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

    const handleDelete = async (u: User) => {
        try {
            await axios.delete(`/api/admin/users/${u.id}`, { headers: { Authorization: `Bearer ${token}` } });
            showToast(`用户已删除：${u.display_name}`, 'success');
            fetchUsers();
        } catch (err: unknown) {
            const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error || '删除失败';
            showToast(msg, 'error');
        }
    };

    const handleCreate = async () => {
        if (!editForm.username || !editForm.password) {
            showToast('用户名和密码必填', 'error'); return;
        }
        setSaving(true);
        try {
            await axios.post('/api/admin/users', {
                username: editForm.username,
                display_name: editForm.display_name || editForm.username,
                password: editForm.password,
                role: editForm.role || 'Member',
                department_id: editForm.department_id ? Number(editForm.department_id) : null
            }, { headers: { Authorization: `Bearer ${token}` } });
            showToast('用户创建成功', 'success');
            closeDrawer();
            fetchUsers();
        } catch (err: unknown) {
            const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error || '创建失败';
            showToast(msg, 'error');
        } finally {
            setSaving(false);
        }
    };

    const handleSort = (field: string) => {
        const newOrder = sortBy === field && sortOrder === 'asc' ? 'desc' : 'asc';
        setSortBy(field);
        setSortOrder(newOrder);
    };

    // Available depts for filter tabs
    const allDepts = React.useMemo(() => {
        const depts = Array.from(new Set(users.map(u => u.dept_code).filter(Boolean))) as string[];
        if (isLead && myDeptCode) {
            return depts.filter(d => d === myDeptCode);
        }
        return depts;
    }, [users, isLead, myDeptCode]);

    // Filter and sort users
    const filteredUsers = React.useMemo(() => {
        let result = users.filter(u => {
            const matchesDept = filterDept === 'all' || u.dept_code === filterDept;
            const matchesSearch = !searchQuery || 
                u.display_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                u.username.toLowerCase().includes(searchQuery.toLowerCase()) ||
                (u.department_name && u.department_name.toLowerCase().includes(searchQuery.toLowerCase()));
            return matchesDept && matchesSearch;
        });

        result.sort((a, b) => {
            let aVal: string | number = '';
            let bVal: string | number = '';
            
            switch (sortBy) {
                case 'display_name':
                    aVal = a.display_name;
                    bVal = b.display_name;
                    break;
                case 'department':
                    aVal = a.department_name || '';
                    bVal = b.department_name || '';
                    break;
                case 'role':
                    aVal = a.role;
                    bVal = b.role;
                    break;
                case 'created_at':
                    aVal = new Date(a.created_at).getTime();
                    bVal = new Date(b.created_at).getTime();
                    break;
                default:
                    aVal = a.display_name;
                    bVal = b.display_name;
            }
            
            if (sortOrder === 'asc') {
                return aVal > bVal ? 1 : -1;
            } else {
                return aVal < bVal ? 1 : -1;
            }
        });

        return result;
    }, [users, filterDept, searchQuery, sortBy, sortOrder]);

    return (
        <div className="fade-in" style={{ padding: '24px', height: '100%', display: 'flex', flexDirection: 'column' }}>
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
                <div>
                    <h2 style={{ fontSize: '1.8rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 12 }}>
                        <Users size={28} color="var(--accent-blue)" />
                        人员管理
                    </h2>
                    <p style={{ color: 'var(--text-secondary)', marginTop: 4 }}>
                        {isAdminOrExec ? '管理全公司人员账户与权限' : '查看并管理本部门成员'}
                    </p>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    {/* Search Icon / Expandable Input */}
                    <div style={{
                        position: 'relative',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: isSearchExpanded ? 'flex-start' : 'center',
                        width: isSearchExpanded ? 280 : 40,
                        height: 40,
                        background: isSearchExpanded ? 'var(--glass-bg-hover)' : 'transparent',
                        border: isSearchExpanded ? '1px solid var(--glass-border)' : 'none',
                        borderRadius: 8,
                        transition: 'all 0.3s ease',
                        overflow: 'hidden'
                    }}>
                        <button
                            onClick={() => {
                                setIsSearchExpanded(!isSearchExpanded);
                                if (!isSearchExpanded) {
                                    setTimeout(() => searchInputRef.current?.focus(), 100);
                                }
                            }}
                            style={{
                                background: 'none',
                                border: 'none',
                                color: 'var(--text-secondary)',
                                cursor: 'pointer',
                                padding: 8,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                flexShrink: 0
                            }}
                        >
                            <Search size={20} />
                        </button>
                        {isSearchExpanded && (
                            <input
                                ref={searchInputRef}
                                type="text"
                                placeholder="搜索人员..."
                                value={searchQuery}
                                onChange={e => setSearchQuery(e.target.value)}
                                onBlur={() => {
                                    if (!searchQuery) setIsSearchExpanded(false);
                                }}
                                style={{
                                    flex: 1,
                                    background: 'transparent',
                                    border: 'none',
                                    color: 'var(--text-main)',
                                    fontSize: '0.95rem',
                                    outline: 'none',
                                    padding: '0 8px'
                                }}
                            />
                        )}
                    </div>
                    {isAdminOrExec && (
                        <button className="btn-kine-lowkey" onClick={openCreate}>
                            <Plus size={18} /> 新建用户
                        </button>
                    )}
                    {/* More Dropdown */}
                    <div ref={moreDropdownRef} style={{ position: 'relative' }}>
                        <button
                            onClick={() => setIsMoreDropdownOpen(!isMoreDropdownOpen)}
                            style={{
                                background: 'var(--glass-bg-hover)',
                                border: '1px solid var(--glass-border)',
                                borderRadius: 8,
                                padding: '0 16px',
                                height: '40px',
                                color: 'var(--text-secondary)',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                gap: 8
                            }}
                        >
                            <MoreHorizontal size={18} />
                        </button>
                        {isMoreDropdownOpen && (
                            <div style={{
                                position: 'absolute',
                                top: '100%',
                                right: 0,
                                marginTop: 4,
                                background: 'var(--bg-sidebar)',
                                border: '1px solid var(--glass-border)',
                                borderRadius: 8,
                                padding: '4px 0',
                                minWidth: 140,
                                zIndex: 100,
                                boxShadow: '0 8px 32px var(--glass-shadow)'
                            }}>
                                <div style={{ padding: '6px 12px', fontSize: '0.75rem', color: 'var(--text-secondary)', borderBottom: '1px solid var(--glass-border)' }}>
                                    查看列表
                                </div>
                                <button
                                    onClick={() => { setFilterDept('all'); setIsMoreDropdownOpen(false); }}
                                    style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: 8,
                                        width: '100%',
                                        padding: '10px 12px',
                                        background: filterDept === 'all' ? 'rgba(16, 185, 129, 0.1)' : 'transparent',
                                        border: 'none',
                                        color: filterDept === 'all' ? '#10B981' : 'var(--text-main)',
                                        fontSize: '0.9rem',
                                        cursor: 'pointer',
                                        textAlign: 'left'
                                    }}
                                >
                                    全部部门
                                </button>
                                {allDepts.map(d => (
                                    <button
                                        key={d}
                                        onClick={() => { setFilterDept(d); setIsMoreDropdownOpen(false); }}
                                        style={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: 8,
                                            width: '100%',
                                            padding: '10px 12px',
                                            background: filterDept === d ? 'rgba(59, 130, 246, 0.1)' : 'transparent',
                                            border: 'none',
                                            color: filterDept === d ? '#3B82F6' : 'var(--text-main)',
                                            fontSize: '0.9rem',
                                            cursor: 'pointer',
                                            textAlign: 'left'
                                        }}
                                    >
                                        {DEPT_LABELS[d] || d}
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Dept Tabs */}
            <div style={{ marginBottom: 20 }}>
                <div className="tabs" style={{ display: 'flex', gap: 4, background: 'var(--glass-bg-hover)', padding: 4, borderRadius: 10, height: '48px', alignItems: 'center', width: 'fit-content' }}>
                    {isAdminOrExec && (
                        <button
                            className={`tab-btn ${filterDept === 'all' ? 'active' : ''}`}
                            onClick={() => setFilterDept('all')}
                            style={{
                                padding: '0 24px',
                                height: '40px',
                                background: filterDept === 'all' ? 'var(--glass-bg-hover)' : 'transparent',
                                color: filterDept === 'all' ? 'var(--text-main)' : 'var(--text-secondary)',
                                borderRadius: 8,
                                fontWeight: filterDept === 'all' ? 600 : 400,
                                fontSize: '1rem',
                                border: 'none',
                                cursor: 'pointer',
                                transition: 'all 0.2s ease',
                                display: 'flex',
                                alignItems: 'center'
                            }}
                        >
                            全部
                        </button>
                    )}
                    {allDepts.map(d => (
                        <button
                            key={d}
                            className={`tab-btn ${filterDept === d ? 'active' : ''}`}
                            onClick={() => setFilterDept(d)}
                            style={{
                                padding: '0 24px',
                                height: '40px',
                                background: filterDept === d ? 'var(--glass-bg-hover)' : 'transparent',
                                color: filterDept === d ? 'var(--text-main)' : 'var(--text-secondary)',
                                borderRadius: 8,
                                fontWeight: filterDept === d ? 600 : 400,
                                fontSize: '1rem',
                                border: 'none',
                                cursor: 'pointer',
                                transition: 'all 0.2s ease',
                                display: 'flex',
                                alignItems: 'center'
                            }}
                        >
                            {DEPT_LABELS[d] || d}
                        </button>
                    ))}
                </div>
            </div>

            {/* User Table */}
            <div className="custom-scroll" style={{ flex: 1, overflowY: 'auto', background: 'var(--glass-bg-light)', borderRadius: 16, border: '1px solid var(--glass-border)' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                        <tr style={{ borderBottom: '1px solid var(--glass-border)', textAlign: 'left' }}>
                            <th
                                style={{ padding: 16, color: 'var(--text-secondary)', cursor: 'pointer', userSelect: 'none' }}
                                onClick={() => handleSort('display_name')}
                            >
                                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                                    姓名
                                    {sortBy === 'display_name' && (
                                        sortOrder === 'asc' ? <ChevronUp size={14} /> : <ChevronDown size={14} />
                                    )}
                                </div>
                            </th>
                            <th
                                style={{ padding: 16, color: 'var(--text-secondary)', cursor: 'pointer', userSelect: 'none' }}
                                onClick={() => handleSort('department')}
                            >
                                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                                    部门
                                    {sortBy === 'department' && (
                                        sortOrder === 'asc' ? <ChevronUp size={14} /> : <ChevronDown size={14} />
                                    )}
                                </div>
                            </th>
                            <th style={{ padding: 16, color: 'var(--text-secondary)' }}>用户名</th>
                            <th
                                style={{ padding: 16, color: 'var(--text-secondary)', cursor: 'pointer', userSelect: 'none' }}
                                onClick={() => handleSort('role')}
                            >
                                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                                    角色
                                    {sortBy === 'role' && (
                                        sortOrder === 'asc' ? <ChevronUp size={14} /> : <ChevronDown size={14} />
                                    )}
                                </div>
                            </th>
                            <th
                                style={{ padding: 16, color: 'var(--text-secondary)', cursor: 'pointer', userSelect: 'none' }}
                                onClick={() => handleSort('created_at')}
                            >
                                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                                    加入时间
                                    {sortBy === 'created_at' && (
                                        sortOrder === 'asc' ? <ChevronUp size={14} /> : <ChevronDown size={14} />
                                    )}
                                </div>
                            </th>
                            <th style={{ padding: 16, color: 'var(--text-secondary)' }}>状态</th>
                            <th style={{ padding: 16, color: 'var(--text-secondary)' }}>操作</th>
                        </tr>
                    </thead>
                    <tbody>
                        {loading ? (
                            <tr><td colSpan={7} style={{ padding: 40, textAlign: 'center' }}>加载中...</td></tr>
                        ) : filteredUsers.length === 0 ? (
                            <tr><td colSpan={7} style={{ padding: 40, textAlign: 'center', opacity: 0.5 }}>暂无用户</td></tr>
                        ) : (
                            filteredUsers.map(u => (
                                <tr
                                    key={u.id}
                                    className="row-hover"
                                    style={{
                                        borderBottom: '1px solid var(--glass-border)',
                                        opacity: u.is_active ? 1 : 0.5,
                                        transition: 'background 0.15s'
                                    }}
                                >
                                    <td style={{ padding: 16 }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                                            <Avatar name={u.display_name} isActive={u.is_active} role={u.role} />
                                            <div>
                                                <div style={{ fontWeight: 600, color: 'var(--text-main)' }}>{u.display_name}</div>
                                                {u.display_name !== u.username && (
                                                    <div style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)' }}>@{u.username}</div>
                                                )}
                                            </div>
                                        </div>
                                    </td>
                                    <td style={{ padding: 16, color: 'var(--text-secondary)' }}>
                                        {u.department_name || '-'}
                                    </td>
                                    <td style={{ padding: 16, color: 'var(--text-secondary)' }}>
                                        {u.username}
                                    </td>
                                    <td style={{ padding: 16 }}>
                                        <RoleBadge role={u.role} />
                                    </td>
                                    <td style={{ padding: 16, color: 'var(--text-secondary)' }}>
                                        {new Date(u.created_at).toLocaleDateString('zh-CN')}
                                    </td>
                                    <td style={{ padding: 16 }}>
                                        <StatusBadge user={u} />
                                    </td>
                                    <td style={{ padding: 16 }}>
                                        <ActionMenu
                                            user={u}
                                            onEdit={() => openEdit(u)}
                                            onToggle={() => setToggleConfirmUser(u)}
                                            onDelete={() => setDeleteConfirmUser(u)}
                                            canToggle={isAdminOrExec && u.role !== 'Admin'}
                                            canDelete={isAdminOrExec && u.role !== 'Admin'}
                                        />
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>

            {/* Toggle Confirmation Modal - 5 seconds */}
            <CountdownConfirmModal
                isOpen={!!toggleConfirmUser}
                onClose={() => setToggleConfirmUser(null)}
                onConfirm={() => {
                    if (toggleConfirmUser) {
                        handleToggle(toggleConfirmUser);
                        setToggleConfirmUser(null);
                    }
                }}
                title={toggleConfirmUser?.is_active ? '确认禁用账户' : '确认启用账户'}
                message={toggleConfirmUser?.is_active 
                    ? `确定要禁用用户 "${toggleConfirmUser.display_name}" 吗？禁用后该用户将无法登录系统。`
                    : `确定要启用用户 "${toggleConfirmUser?.display_name}" 吗？`
                }
                countdownSeconds={5}
                confirmText={toggleConfirmUser?.is_active ? '禁用' : '启用'}
                isDanger={toggleConfirmUser?.is_active}
            />

            {/* Delete Confirmation Modal - 10 seconds, only for disabled users */}
            <CountdownConfirmModal
                isOpen={!!deleteConfirmUser}
                onClose={() => setDeleteConfirmUser(null)}
                onConfirm={() => {
                    if (deleteConfirmUser) {
                        handleDelete(deleteConfirmUser);
                        setDeleteConfirmUser(null);
                    }
                }}
                title="确认删除用户"
                message={`确定要永久删除用户 "${deleteConfirmUser?.display_name}" 吗？此操作不可撤销，所有相关数据将被删除。`}
                countdownSeconds={10}
                confirmText="删除"
                isDanger={true}
            />

            {/* Edit User Drawer - positioned below top bar */}
            {editingUser && (
                <>
                    <div
                        onClick={closeDrawer}
                        style={{ 
                            position: 'fixed', 
                            top: TOP_BAR_HEIGHT,
                            left: 0,
                            right: 0,
                            bottom: 0, 
                            background: 'rgba(0,0,0,0.6)', 
                            zIndex: 1000
                        }}
                    />
                    <div style={{
                        position: 'fixed', 
                        top: TOP_BAR_HEIGHT, 
                        right: 0, 
                        bottom: 0, 
                        width: 400,
                        background: '#0a0a0a', 
                        borderLeft: '1px solid var(--glass-border)',
                        zIndex: 1001, 
                        display: 'flex', 
                        flexDirection: 'column',
                        boxShadow: '-8px 0 32px rgba(0,0,0,0.5)'
                    }}>
                        {/* Drawer Header */}
                        <div style={{
                            padding: '20px 24px', 
                            borderBottom: '1px solid var(--glass-border)',
                            display: 'flex', 
                            alignItems: 'center', 
                            justifyContent: 'space-between'
                        }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                                {isCreating ? <Plus size={18} color="#3B82F6" /> : <ShieldCheck size={18} color="#3B82F6" />}
                                <span style={{ fontWeight: 700, fontSize: '1rem', color: 'var(--text-main)' }}>
                                    {isCreating ? '新建用户' : '编辑用户'}
                                </span>
                            </div>
                            <button onClick={closeDrawer} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)' }}>
                                <X size={20} />
                            </button>
                        </div>

                        {/* Drawer Body */}
                        <div style={{ flex: 1, overflow: 'auto', padding: 24, display: 'flex', flexDirection: 'column', gap: 20 }}>
                            {/* Avatar + name preview - only show when editing */}
                            {!isCreating && (
                                <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 16px', background: 'var(--glass-bg-hover)', borderRadius: 12 }}>
                                    <Avatar name={editingUser.display_name} isActive={editingUser.is_active} role={editingUser.role} />
                                    <div>
                                        <div style={{ fontWeight: 700, color: 'var(--text-main)', fontSize: '0.95rem' }}>{editingUser.display_name}</div>
                                        <div style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)' }}>@{editingUser.username}</div>
                                    </div>
                                    {!editingUser.is_active && (
                                        <span style={{ marginLeft: 'auto', color: '#EF4444', fontSize: '0.75rem', fontWeight: 600, background: 'rgba(239,68,68,0.1)', padding: '3px 8px', borderRadius: 6 }}>已禁用</span>
                                    )}
                                </div>
                            )}

                            {isAdminOrExec && (
                                <>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                                        <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: 600 }}>显示名称</label>
                                        <input
                                            type="text"
                                            placeholder="如：张三"
                                            value={editForm.display_name}
                                            onChange={e => setEditForm(f => ({ ...f, display_name: e.target.value }))}
                                            style={{ padding: '9px 12px', borderRadius: 8, border: '1px solid var(--glass-border)', background: 'var(--glass-bg-hover)', color: 'var(--text-main)', fontSize: '0.9rem', outline: 'none' }}
                                        />
                                    </div>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                                        <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: 600 }}>{isCreating ? '登录用户名 *' : '登录用户名'}</label>
                                        <input
                                            type="text"
                                            placeholder="如：zhangsan"
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
                                        <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: 600 }}>{isCreating ? '登录密码 *' : '新密码（留空则不修改）'}</label>
                                        <input
                                            type="password"
                                            placeholder={isCreating ? '至少6位' : '输入新密码...'}
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
                            {/* Toggle button - only show when editing, not when creating */}
                            {!isCreating && isAdminOrExec && editingUser.id !== currentUser?.id && (
                                <button
                                    onClick={() => { setToggleConfirmUser(editingUser); closeDrawer(); }}
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
                                onClick={isCreating ? handleCreate : handleSave}
                                disabled={saving}
                                style={{
                                    width: '100%', padding: '10px', borderRadius: 10, fontWeight: 600,
                                    background: 'var(--accent-blue)', color: '#000',
                                    border: 'none', cursor: saving ? 'wait' : 'pointer', fontSize: '0.88rem',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                                    opacity: saving ? 0.7 : 1
                                }}
                            >
                                {isCreating 
                                    ? <><Plus size={15} /> {saving ? '创建中...' : '创建用户'}</>
                                    : <><Save size={15} /> {saving ? '保存中...' : '保存更改'}</>
                                }
                            </button>
                        </div>
                    </div>
                </>
            )}
        </div>
    );
};

export default UserManagement;
