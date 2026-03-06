import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { useAuthStore } from '../../store/useAuthStore';
import { ChevronDown, Search, Loader2, AlertTriangle, ShieldAlert } from 'lucide-react';

interface UserOption {
    id: number;
    name: string;
    department?: string;
    department_name?: string;
    role?: string;
}

interface AssigneeSelectorProps {
    ticketId: number;
    currentAssigneeId?: number | null;
    currentAssigneeName?: string | null;
    currentAssigneeDept?: string | null;
    currentNode: string;
    ticketType: string;
    onUpdate: () => void;
}

export const AssigneeSelector: React.FC<AssigneeSelectorProps> = ({
    ticketId,
    currentAssigneeId,
    currentAssigneeName,
    currentAssigneeDept,
    currentNode,
    onUpdate
}) => {
    const { token, user: authUser } = useAuthStore();
    const [isOpen, setIsOpen] = useState(false);
    const [users, setUsers] = useState<UserOption[]>([]);
    const [loading, setLoading] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [confirmModal, setConfirmModal] = useState<{ isOpen: boolean; targetUser: UserOption | null; reason: string; countdown: number }>({
        isOpen: false,
        targetUser: null,
        reason: '',
        countdown: 5
    });
    const dropdownRef = useRef<HTMLDivElement>(null);

    // Normalize department name to code for comparison
    const getDeptCode = (name?: string) => {
        if (!name) return null;

        // Try to extract code in parentheses: "Operations (OP)" -> "OP"
        const match = name.match(/\(([A-Z]{2,3})\)/);
        if (match) return match[1].toUpperCase();

        const map: Record<string, string> = {
            '市场部': 'MS', '生产运营部': 'OP', '运营部': 'OP',
            '研发部': 'RD', '通用台面': 'GE', '综合部': 'GE', '管理层': 'GE'
        };
        const upper = name.toUpperCase();
        if (/^[A-Z]{2,3}$/.test(upper)) return upper;
        return map[name] || name;
    };

    const isAdmin = authUser?.role === 'Admin' || authUser?.role === 'Exec';

    useEffect(() => {
        if (!isOpen) return;
        const fetchUsers = async () => {
            setLoading(true);
            try {
                const res = await axios.get('/api/v1/system/users', {
                    headers: { Authorization: `Bearer ${token}` }
                });
                if (res.data.success) {
                    setUsers(res.data.data);
                }
            } catch (e) {
                console.error('Failed to fetch users', e);
            } finally {
                setLoading(false);
            }
        };
        if (users.length === 0) {
            fetchUsers();
        }
    }, [isOpen, token, users.length]);

    useEffect(() => {
        const handler = (e: MouseEvent) => {
            if (isOpen && dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
                setIsOpen(false);
                setSearchQuery('');
            }
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, [isOpen]);

    useEffect(() => {
        let timer: ReturnType<typeof setTimeout>;
        if (confirmModal.isOpen && confirmModal.countdown > 0) {
            timer = setTimeout(() => {
                setConfirmModal(prev => ({ ...prev, countdown: prev.countdown - 1 }));
            }, 1000);
        }
        return () => clearTimeout(timer);
    }, [confirmModal.isOpen, confirmModal.countdown]);

    const handlePreAssign = (u: UserOption) => {
        setIsOpen(false);
        setConfirmModal({
            isOpen: true,
            targetUser: u,
            reason: '',
            countdown: 5
        });
    };

    const handleConfirmAssign = async () => {
        if (!confirmModal.targetUser || confirmModal.countdown > 0) return;
        try {
            await axios.patch(`/api/v1/tickets/${ticketId}`, {
                assigned_to: confirmModal.targetUser.id,
                change_reason: `指派流转: 指派给 ${confirmModal.targetUser.name}。理由: ${confirmModal.reason}`
            }, {
                headers: { Authorization: `Bearer ${token}` }
            });
            onUpdate();
            setConfirmModal({ isOpen: false, targetUser: null, reason: '', countdown: 5 });
            setSearchQuery('');
        } catch (e: any) {
            alert(e.response?.data?.error || '配置指派人失败');
        }
    };

    const buildGroups = () => {
        const query = searchQuery.toLowerCase();
        let filteredUsers = users;

        // Requirement: Only show users of the target department computed from currentNode
        const getTargetDeptCode = (node: string) => {
            if (!node) return null;
            const n = node.toLowerCase();
            if (n.startsWith('ms_')) return 'MS';
            if (n.startsWith('op_')) return 'OP';
            if (n.startsWith('ge_')) return 'GE';
            if (['draft', 'open', 'waiting', 'resolved', 'closed'].includes(n)) return 'MS';
            if (['submitted', 'shipped'].includes(n)) return 'OP';
            return null;
        };

        const targetDeptCode = getTargetDeptCode(currentNode);

        if (targetDeptCode && !isAdmin) {
            filteredUsers = users.filter(u => {
                const uDeptCode = getDeptCode(u.department_name || u.department);
                return uDeptCode === targetDeptCode;
            });
        }

        const available = filteredUsers.filter(u =>
            u.name.toLowerCase().includes(query) ||
            (u.department_name && u.department_name.toLowerCase().includes(query))
        );

        const groups: Record<string, UserOption[]> = {};
        available.forEach(u => {
            const dept = u.department_name || u.department || '其他';
            if (!groups[dept]) groups[dept] = [];
            groups[dept].push(u);
        });

        return Object.entries(groups).sort((a, b) => a[0].localeCompare(b[0]));
    };

    return (
        <div style={{ position: 'relative' }}>
            <button
                onClick={() => setIsOpen(!isOpen)}
                style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 6,
                    padding: '6px 12px',
                    borderRadius: 8,
                    // Requirement 2: Prominent styling for Unassigned when actionable
                    background: !currentAssigneeName ? 'rgba(255, 68, 68, 0.1)' : 'rgba(255,255,255,0.06)',
                    border: !currentAssigneeName ? '1.5px solid #EF4444' : '1px solid rgba(255,255,255,0.1)',
                    color: !currentAssigneeName ? '#EF4444' : '#e0e0e0',
                    fontWeight: !currentAssigneeName ? 700 : 400,
                    fontSize: 12,
                    cursor: 'pointer',
                    transition: 'all 0.15s',
                    boxShadow: !currentAssigneeName ? '0 0 10px rgba(239, 68, 68, 0.2)' : 'none',
                    minWidth: 80
                }}
                onMouseEnter={e => {
                    e.currentTarget.style.background = !currentAssigneeName ? 'rgba(255, 68, 68, 0.2)' : 'rgba(255,255,255,0.1)';
                    if (!currentAssigneeName) e.currentTarget.style.boxShadow = '0 0 15px rgba(239, 68, 68, 0.3)';
                }}
                onMouseLeave={e => {
                    e.currentTarget.style.background = !currentAssigneeName ? 'rgba(255, 68, 68, 0.1)' : 'rgba(255,255,255,0.06)';
                    e.currentTarget.style.boxShadow = !currentAssigneeName ? '0 0 10px rgba(239, 68, 68, 0.2)' : 'none';
                }}
            >
                {!currentAssigneeName && <AlertTriangle size={12} />}
                {currentAssigneeName ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        {currentAssigneeDept && <span style={{ color: '#888', fontSize: 11 }}>[{currentAssigneeDept}]</span>}
                        {currentAssigneeName}
                    </div>
                ) : '未指派'}
                <ChevronDown size={14} color={!currentAssigneeName ? '#EF4444' : '#888'} />
            </button>

            {isOpen && (
                <div ref={dropdownRef} style={{
                    position: 'absolute', top: '100%', left: 0, marginTop: 4,
                    zIndex: 2000, background: '#1e1e1e',
                    border: '1px solid rgba(255,255,255,0.15)',
                    borderRadius: 10, boxShadow: '0 12px 40px rgba(0,0,0,0.6)',
                    width: 240, maxHeight: 400, display: 'flex', flexDirection: 'column'
                }}>
                    <div style={{ padding: '8px 10px', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'rgba(255,255,255,0.06)', borderRadius: 6, padding: '4px 8px' }}>
                            <Search size={12} color="#888" />
                            <input
                                type="text"
                                autoFocus
                                value={searchQuery}
                                onChange={e => setSearchQuery(e.target.value)}
                                placeholder="搜索人员或部门..."
                                style={{ flex: 1, border: 'none', background: 'transparent', outline: 'none', color: '#fff', fontSize: 12 }}
                            />
                        </div>
                    </div>

                    <div style={{ flex: 1, overflowY: 'auto', padding: '4px 0' }}>
                        {loading && (
                            <div style={{ padding: 20, textAlign: 'center' }}>
                                <Loader2 size={16} className="animate-spin" color="#666" style={{ margin: '0 auto' }} />
                            </div>
                        )}
                        {!loading && buildGroups().map(([dept, usrs]) => (
                            <div key={dept}>
                                <div style={{ fontSize: 10, fontWeight: 600, color: '#888', padding: '4px 12px', background: 'rgba(255,255,255,0.02)' }}>
                                    {dept}
                                </div>
                                {usrs.map(u => (
                                    <button
                                        key={u.id}
                                        onClick={() => handlePreAssign(u)}
                                        style={{
                                            width: '100%', textAlign: 'left', padding: '6px 16px', border: 'none',
                                            background: currentAssigneeId === u.id ? 'rgba(59,130,246,0.15)' : 'transparent',
                                            color: currentAssigneeId === u.id ? '#3B82F6' : '#e0e0e0',
                                            fontSize: 12, cursor: 'pointer', display: 'flex', justifyContent: 'space-between'
                                        }}
                                        onMouseEnter={e => {
                                            if (currentAssigneeId !== u.id) e.currentTarget.style.background = 'rgba(255,255,255,0.05)';
                                        }}
                                        onMouseLeave={e => {
                                            if (currentAssigneeId !== u.id) e.currentTarget.style.background = 'transparent';
                                        }}
                                    >
                                        <span>{u.name}</span>
                                        {currentAssigneeId === u.id && <span>✓</span>}
                                    </button>
                                ))}
                            </div>
                        ))}
                        {!loading && users.length > 0 && buildGroups().length === 0 && (
                            <div style={{ padding: 16, textAlign: 'center', fontSize: 11, color: '#888' }}>
                                无匹配人员
                            </div>
                        )}
                    </div>
                </div>
            )}

            {confirmModal.isOpen && confirmModal.targetUser && (
                <div style={{
                    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                    background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(10px)',
                    zIndex: 3000, display: 'flex', alignItems: 'center', justifyContent: 'center'
                }}>
                    <div style={{
                        background: '#1e1e1e', border: '1px solid rgba(255,255,255,0.1)',
                        borderRadius: 12, width: 400, overflow: 'hidden',
                        boxShadow: '0 20px 50px rgba(0,0,0,0.5)'
                    }}>
                        <div style={{ padding: '16px 20px', borderBottom: '1px solid rgba(255,255,255,0.1)', display: 'flex', gap: 10, alignItems: 'center', background: 'rgba(255, 215, 0, 0.1)' }}>
                            <ShieldAlert size={20} color="#FFD700" />
                            <h3 style={{ margin: 0, fontSize: 16, color: '#fff', fontWeight: 600 }}>核心操作转移球权</h3>
                        </div>
                        <div style={{ padding: '20px' }}>
                            <p style={{ fontSize: 14, color: '#ddd', marginBottom: 16, lineHeight: 1.5 }}>
                                将工单 <span style={{ color: '#3B82F6', fontWeight: 600 }}>重新指派</span> 给：<br />
                                <span style={{ fontSize: 16, fontWeight: 700, color: '#fff' }}>[{getDeptCode(confirmModal.targetUser.department_name || confirmModal.targetUser.department)}] {confirmModal.targetUser.name}</span>
                            </p>
                            <label style={{ display: 'block', fontSize: 12, color: '#888', marginBottom: 6 }}>变更理由 (必填项)</label>
                            <textarea
                                value={confirmModal.reason}
                                onChange={e => setConfirmModal(prev => ({ ...prev, reason: e.target.value }))}
                                placeholder="输入为什么修改指派人..."
                                style={{
                                    width: '100%', padding: '10px 12px', background: 'rgba(0,0,0,0.3)',
                                    border: '1px solid rgba(255,255,255,0.1)', color: '#fff', borderRadius: 6, minHeight: 80, fontSize: 13, resize: 'vertical'
                                }}
                            />
                        </div>
                        <div style={{ padding: '16px 20px', background: 'rgba(0,0,0,0.2)', display: 'flex', gap: 12 }}>
                            <button
                                onClick={() => setConfirmModal({ isOpen: false, targetUser: null, reason: '', countdown: 5 })}
                                style={{ flex: 1, padding: '10px', background: 'transparent', border: '1px solid rgba(255,255,255,0.2)', color: '#fff', borderRadius: 8, cursor: 'pointer', fontSize: 14 }}
                            >
                                取消
                            </button>
                            <button
                                onClick={handleConfirmAssign}
                                disabled={!confirmModal.reason.trim() || confirmModal.countdown > 0}
                                style={{
                                    flex: 1.5, padding: '10px',
                                    background: (!confirmModal.reason.trim() || confirmModal.countdown > 0) ? 'rgba(255,215,0,0.3)' : '#FFD700',
                                    border: 'none', color: (!confirmModal.reason.trim() || confirmModal.countdown > 0) ? '#aaa' : '#000', borderRadius: 8, fontWeight: 700,
                                    cursor: (!confirmModal.reason.trim() || confirmModal.countdown > 0) ? 'not-allowed' : 'pointer',
                                    fontSize: 14, transition: 'all 0.2s',
                                    boxShadow: (!confirmModal.reason.trim() || confirmModal.countdown > 0) ? 'none' : '0 4px 15px rgba(255,215,0,0.25)'
                                }}
                            >
                                {confirmModal.countdown > 0 ? `确认指派 (${confirmModal.countdown}s)` : '确认指派'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
