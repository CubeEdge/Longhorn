import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { useAuthStore } from '../../store/useAuthStore';
import { ChevronDown, Search, Loader2, AlertTriangle } from 'lucide-react';

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
    onUpdate: () => void;
}

export const AssigneeSelector: React.FC<AssigneeSelectorProps> = ({
    ticketId,
    currentAssigneeId,
    currentAssigneeName,
    currentAssigneeDept,
    onUpdate
}) => {
    const { token, user: authUser } = useAuthStore();
    const [isOpen, setIsOpen] = useState(false);
    const [users, setUsers] = useState<UserOption[]>([]);
    const [loading, setLoading] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
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
    const isLead = authUser?.role === 'Lead';
    const myDeptCode = getDeptCode(authUser?.department_code || authUser?.department_name);

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

    const handleAssign = async (userId: number, userName: string) => {
        try {
            await axios.patch(`/api/v1/tickets/${ticketId}`, {
                assigned_to: userId,
                change_reason: `指派给 ${userName} 处理`
            }, {
                headers: { Authorization: `Bearer ${token}` }
            });
            onUpdate();
            setIsOpen(false);
            setSearchQuery('');
        } catch (e) {
            console.error('Assignment failed', e);
        }
    };

    const buildGroups = () => {
        const query = searchQuery.toLowerCase();
        let filteredUsers = users;

        // Requirement 1: Leads can only assign to their own department members
        if (isLead && !isAdmin && myDeptCode) {
            filteredUsers = users.filter(u => {
                const uDeptCode = getDeptCode(u.department_name || u.department);
                return uDeptCode === myDeptCode;
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
                                        onClick={() => handleAssign(u.id, u.name)}
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
        </div>
    );
};
