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

const DepartmentManagement: React.FC = () => {
    const [departments, setDepartments] = useState<any[]>([]);
    const [users, setUsers] = useState<any[]>([]);
    const [newDeptName, setNewDeptName] = useState('');

    // Grant state
    const [grantUserId, setGrantUserId] = useState('');
    const [grantPath, setGrantPath] = useState('');
    const [grantType, setGrantType] = useState('Read');
    const [grantExpiry, setGrantExpiry] = useState('permanent');

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
        <div className="fade-in" style={{ display: 'grid', gridTemplateColumns: '1fr 380px', gap: 32 }}>
            <div>
                <div style={{ marginBottom: 32 }}>
                    <h2 style={{ fontSize: '1.8rem', fontWeight: 800 }}>组织架构</h2>
                    <p className="hint">定义公司部门，并管理跨部门或临时的文件访问权限。</p>
                </div>

                <div style={{ background: 'rgba(255,255,255,0.03)', borderRadius: 20, border: '1px solid var(--glass-border)', padding: 32, marginBottom: 32 }}>
                    <h3 style={{ marginBottom: 24, display: 'flex', alignItems: 'center', gap: 12 }}>
                        <Plus size={20} color="var(--accent-blue)" /> 新增部门
                    </h3>
                    <form onSubmit={createDept} style={{ display: 'flex', gap: 16 }}>
                        <input
                            type="text"
                            placeholder="请输入部门名称（如：研发部、市场部）"
                            value={newDeptName}
                            onChange={e => setNewDeptName(e.target.value)}
                            style={{ flex: 1, background: 'rgba(0,0,0,0.2)', border: '1px solid var(--glass-border)', padding: '12px 16px', borderRadius: 10, color: 'white' }}
                        />
                        <button type="submit" className="btn-primary" style={{ width: 120, justifyContent: 'center' }}>添加</button>
                    </form>
                    <div style={{ marginTop: 24, display: 'flex', flexWrap: 'wrap', gap: 12 }}>
                        {departments.map(d => (
                            <div key={d.id} style={{
                                background: 'rgba(255,210,0,0.1)',
                                border: '1px solid rgba(255,210,0,0.2)',
                                padding: '8px 16px',
                                borderRadius: 30,
                                fontSize: '0.9rem',
                                color: 'var(--accent-blue)',
                                display: 'flex',
                                alignItems: 'center',
                                gap: 8
                            }}>
                                <Tag size={14} /> {d.name}
                            </div>
                        ))}
                    </div>
                </div>

                <div style={{ background: 'rgba(255,255,255,0.03)', borderRadius: 20, border: '1px solid var(--glass-border)', padding: 32 }}>
                    <h3 style={{ marginBottom: 24, display: 'flex', alignItems: 'center', gap: 12 }}>
                        <FolderPlus size={20} color="var(--accent-blue)" /> 文件夹动态授权
                    </h3>
                    <form onSubmit={grantPermission} style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                            <div>
                                <label className="hint">目标用户</label>
                                <select
                                    value={grantUserId}
                                    onChange={e => setGrantUserId(e.target.value)}
                                    style={{ width: '100%', background: 'rgba(0,0,0,0.2)', border: '1px solid var(--glass-border)', padding: '12px 16px', borderRadius: 10, color: 'white', marginTop: 8 }}
                                    required
                                >
                                    <option value="">请选择用户</option>
                                    {users.map(u => <option key={u.id} value={u.id}>{u.username}</option>)}
                                </select>
                            </div>
                            <div>
                                <label className="hint">文件夹路径</label>
                                <input
                                    type="text"
                                    placeholder="相对路径（如：RD/Shared/ProjA）"
                                    value={grantPath}
                                    onChange={e => setGrantPath(e.target.value)}
                                    style={{ width: '100%', background: 'rgba(0,0,0,0.2)', border: '1px solid var(--glass-border)', padding: '12px 16px', borderRadius: 10, color: 'white', marginTop: 8 }}
                                    required
                                />
                            </div>
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                            <div>
                                <label className="hint">权限级别</label>
                                <select
                                    value={grantType}
                                    onChange={e => setGrantType(e.target.value)}
                                    style={{ width: '100%', background: 'rgba(0,0,0,0.2)', border: '1px solid var(--glass-border)', padding: '12px 16px', borderRadius: 10, color: 'white', marginTop: 8 }}
                                >
                                    <option value="Read">只读权限 (Read-only)</option>
                                    <option value="Full">完全控制 (Full-control)</option>
                                </select>
                            </div>
                            <div>
                                <label className="hint">有效期</label>
                                <select
                                    value={grantExpiry}
                                    onChange={e => setGrantExpiry(e.target.value)}
                                    style={{ width: '100%', background: 'rgba(0,0,0,0.2)', border: '1px solid var(--glass-border)', padding: '12px 16px', borderRadius: 10, color: 'white', marginTop: 8 }}
                                >
                                    <option value="permanent">永久有效</option>
                                    <option value="7days">7 天短期授权</option>
                                    <option value="1month">1 个月中期授权</option>
                                </select>
                            </div>
                        </div>
                        <button type="submit" className="btn-primary" style={{ marginTop: 8, justifyContent: 'center', height: 48 }}>执行授权</button>
                    </form>
                </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
                <div style={{ background: 'rgba(255,255,255,0.05)', borderRadius: 20, padding: 24, border: '1px solid var(--glass-border)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
                        <ShieldCheck size={20} color="var(--accent-blue)" />
                        <h4 style={{ fontWeight: 700 }}>权限设计规范</h4>
                    </div>
                    <ul className="hint" style={{ fontSize: '0.85rem', lineHeight: 1.6, paddingLeft: 16 }}>
                        <li>管理员拥有最高权限，不受任何规则限制。</li>
                        <li>Lead 自动拥有其部门根目录的 Full 权限。</li>
                        <li>Member 对所属部门根目录具有 Read 权限。</li>
                        <li>所有用户在 /Members/用户名 下具有 Full 权限。</li>
                        <li>授权冲突时，以更高的权限级别为准。</li>
                    </ul>
                </div>
                <div style={{ background: 'rgba(255,255,255,0.05)', borderRadius: 20, padding: 24, border: '1px solid var(--glass-border)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
                        <Clock size={20} color="var(--accent-blue)" />
                        <h4 style={{ fontWeight: 700 }}>过期审计</h4>
                    </div>
                    <p className="hint" style={{ fontSize: '0.85rem' }}>临时授权到期后，系统将自动回收访问链接。建议定期执行权限审计，清理冗余的跨部门访问。</p>
                </div>
            </div>
        </div>
    );
};

export default DepartmentManagement;
