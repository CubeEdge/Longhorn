import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuthStore } from '../store/useAuthStore';
import {
    ShieldCheck,
    Clock,
    Plus,
    Tag,
    FolderPlus
} from 'lucide-react';
import FolderTreeSelector from './FolderTreeSelector';

const DepartmentManagement: React.FC = () => {
    const [departments, setDepartments] = useState<any[]>([]);
    const [users, setUsers] = useState<any[]>([]);
    const [newDeptName, setNewDeptName] = useState('');

    // Grant state
    const [grantUserId, setGrantUserId] = useState('');
    const [grantPath, setGrantPath] = useState('');
    const [grantType, setGrantType] = useState('Read');
    const [grantExpiry, setGrantExpiry] = useState('permanent');
    const [isFolderSelectorOpen, setIsFolderSelectorOpen] = useState(false);

    const { token } = useAuthStore();

    const fetchData = async () => {
        const headers = { Authorization: `Bearer ${token}` };
        const [uRes, dRes] = await Promise.all([
            axios.get('/api/admin/users', { headers }),
            axios.get('/api/admin/departments', { headers })
        ]);
        setUsers(uRes.data);
        setDepartments(dRes.data);
    };

    useEffect(() => {
        fetchData();
    }, [token]);

    const createDept = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newDeptName) return;
        await axios.post('/api/admin/departments', { name: newDeptName }, {
            headers: { Authorization: `Bearer ${token}` }
        });
        setNewDeptName('');
        fetchData();
    };

    const grantPermission = async (e: React.FormEvent) => {
        e.preventDefault();
        await axios.post('/api/admin/permissions', {
            user_id: parseInt(grantUserId),
            folder_path: grantPath,
            access_type: grantType,
            expiry_option: grantExpiry
        }, {
            headers: { Authorization: `Bearer ${token}` }
        });
        setGrantPath('');
        alert("授权成功");
    };

    return (

        <div className="fade-in">
            <div style={{ marginBottom: 24 }}>
                <h2 style={{ fontSize: '1.8rem', fontWeight: 800 }}>部门和权限</h2>
                <p className="hint">管理公司组织架构及文件访问权限。</p>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: 24 }}>
                {/* Authorization */}
                <div style={{ background: 'var(--glass-bg)', borderRadius: 20, border: '1px solid var(--glass-border)', padding: 32 }}>
                    <h3 style={{ marginBottom: 24, display: 'flex', alignItems: 'center', gap: 12 }}>
                        <ShieldCheck size={20} color="var(--accent-blue)" /> 文件夹授权
                    </h3>
                    <form onSubmit={grantPermission} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                        <div>
                            <label className="hint" style={{ fontSize: '0.8rem', marginBottom: 4, display: 'block' }}>目标用户</label>
                            <select
                                value={grantUserId}
                                onChange={e => setGrantUserId(e.target.value)}
                                style={{ width: '100%', background: 'rgba(0,0,0,0.2)', border: '1px solid var(--glass-border)', padding: '10px 14px', borderRadius: 8, color: 'white' }}
                                required
                            >
                                <option value="">选择用户...</option>
                                {users.map(u => <option key={u.id} value={u.id}>{u.username}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="hint" style={{ fontSize: '0.8rem', marginBottom: 4, display: 'block' }}>目标文件夹</label>
                            <div
                                onClick={() => setIsFolderSelectorOpen(true)}
                                style={{
                                    width: '100%',
                                    background: 'rgba(0,0,0,0.2)',
                                    border: '1px solid var(--glass-border)',
                                    padding: '10px 14px',
                                    borderRadius: 8,
                                    color: grantPath ? 'white' : 'var(--text-secondary)',
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'space-between'
                                }}
                            >
                                <span>{grantPath || '点击选择文件夹...'}</span>
                                <FolderPlus size={16} color="var(--accent-blue)" />
                            </div>
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                            <div>
                                <label className="hint" style={{ fontSize: '0.8rem', marginBottom: 4, display: 'block' }}>权限</label>
                                <select
                                    value={grantType}
                                    onChange={e => setGrantType(e.target.value)}
                                    style={{ width: '100%', background: 'rgba(0,0,0,0.2)', border: '1px solid var(--glass-border)', padding: '10px 14px', borderRadius: 8, color: 'white' }}
                                >
                                    <option value="Read">只读</option>
                                    <option value="Full">读写</option>
                                </select>
                            </div>
                            <div>
                                <label className="hint" style={{ fontSize: '0.8rem', marginBottom: 4, display: 'block' }}>有效期</label>
                                <select
                                    value={grantExpiry}
                                    onChange={e => setGrantExpiry(e.target.value)}
                                    style={{ width: '100%', background: 'rgba(0,0,0,0.2)', border: '1px solid var(--glass-border)', padding: '10px 14px', borderRadius: 8, color: 'white' }}
                                >
                                    <option value="permanent">永久</option>
                                    <option value="7days">7 天</option>
                                    <option value="1month">1 月</option>
                                </select>
                            </div>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 8 }}>
                            <button type="submit" className="btn-primary" style={{ padding: '10px 24px', borderRadius: 8 }}>执行授权</button>
                        </div>
                    </form>
                </div>

                {/* Department Management */}
                <div style={{ background: 'var(--glass-bg)', borderRadius: 20, border: '1px solid var(--glass-border)', padding: 32 }}>
                    <h3 style={{ marginBottom: 24, display: 'flex', alignItems: 'center', gap: 12 }}>
                        <Plus size={20} color="var(--accent-blue)" /> 新增部门
                    </h3>
                    <form onSubmit={createDept} style={{ display: 'flex', gap: 16, marginBottom: 24 }}>
                        <input
                            type="text"
                            placeholder="部门名称..."
                            value={newDeptName}
                            onChange={e => setNewDeptName(e.target.value)}
                            style={{ flex: 1, background: 'rgba(0,0,0,0.2)', border: '1px solid var(--glass-border)', padding: '12px 16px', borderRadius: 10, color: 'white' }}
                        />
                        <button type="submit" className="btn-primary" style={{ flexShrink: 0 }}>添加</button>
                    </form>

                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
                        {departments.map(d => (
                            <div key={d.id} style={{
                                background: 'rgba(255,210,0,0.1)',
                                border: '1px solid rgba(255,210,0,0.2)',
                                padding: '8px 16px',
                                borderRadius: 8,
                                fontSize: '0.9rem',
                                color: 'var(--accent-blue)',
                                display: 'flex',
                                alignItems: 'center',
                                gap: 8,
                                fontWeight: 500
                            }}>
                                <Tag size={14} /> {d.name}
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* Folder Selector Modal */}
            {isFolderSelectorOpen && (
                <FolderTreeSelector
                    token={token || ''}
                    currentPath={grantPath}
                    onSelect={(path) => {
                        setGrantPath(path);
                        setIsFolderSelectorOpen(false);
                    }}
                    onClose={() => setIsFolderSelectorOpen(false)}
                />
            )}

            {/* Hint Section - Moved to Bottom & Compact */}
            <div style={{ marginTop: 24, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 20 }}>
                <div style={{ background: 'rgba(255,255,255,0.02)', borderRadius: 12, padding: 20, border: '1px solid rgba(255,255,255,0.05)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                        <FolderPlus size={18} color="var(--text-secondary)" />
                        <h4 style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>核心规则</h4>
                    </div>
                    <ul className="hint" style={{ fontSize: '0.8rem', lineHeight: 1.5, paddingLeft: 16, margin: 0 }}>
                        <li>Lead 自动拥有部门根目录 Full 权限，Member 拥有 Read 权限。</li>
                        <li>用户在 /Members/用户名 下拥有 Full 权限。</li>
                        <li>权限冲突时，高权限优先 (Full &gt; Read)。</li>
                    </ul>
                </div>
                <div style={{ background: 'rgba(255,255,255,0.02)', borderRadius: 12, padding: 20, border: '1px solid rgba(255,255,255,0.05)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                        <Clock size={18} color="var(--text-secondary)" />
                        <h4 style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>审计说明</h4>
                    </div>
                    <p className="hint" style={{ fontSize: '0.8rem', margin: 0 }}>
                        临时授权到期后系统将自动回收。建议定期审计跨部门权限。
                    </p>
                </div>
            </div>
        </div>
    );
};

export default DepartmentManagement;
