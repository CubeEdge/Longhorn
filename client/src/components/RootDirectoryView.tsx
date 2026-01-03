import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { useAuthStore } from '../store/useAuthStore';
import { useNavigate } from 'react-router-dom';
import { Folder, Users } from 'lucide-react';

export const RootDirectoryView: React.FC = () => {
    const [departments, setDepartments] = useState<any[]>([]);
    const { token } = useAuthStore();
    const navigate = useNavigate();

    useEffect(() => {
        fetchDepartments();
    }, []);

    const fetchDepartments = async () => {
        try {
            const res = await axios.get('/api/user/accessible-departments', {
                headers: { Authorization: `Bearer ${token}` }
            });
            setDepartments(res.data);
        } catch (err) {
            console.error('Failed to fetch departments:', err);
        }
    };

    const deptCodeMap: { [key: string]: string } = {
        '市场部 (MS)': 'MS',
        '运营部 (OP)': 'OP',
        '研发中心 (RD)': 'RD',
        '综合管理 (GE)': 'GE'
    };

    return (
        <div style={{ padding: '32px', maxWidth: '1200px', margin: '0 auto' }}>
            <h1 style={{ fontSize: '2rem', fontWeight: 800, marginBottom: '32px' }}>
                Kinefinity 文件系统
            </h1>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: '20px' }}>
                {/* Members Folder */}
                <div
                    onClick={() => navigate('/members')}
                    style={{
                        background: 'var(--glass-bg)',
                        border: '2px solid var(--glass-border)',
                        borderRadius: '12px',
                        padding: '24px',
                        cursor: 'pointer',
                        transition: 'all 0.2s',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        gap: '12px'
                    }}
                    onMouseEnter={(e) => {
                        e.currentTarget.style.borderColor = 'var(--accent-blue)';
                        e.currentTarget.style.transform = 'translateY(-4px)';
                    }}
                    onMouseLeave={(e) => {
                        e.currentTarget.style.borderColor = 'var(--glass-border)';
                        e.currentTarget.style.transform = 'translateY(0)';
                    }}
                >
                    <Users size={48} color="var(--accent-blue)" />
                    <div style={{ fontSize: '1.1rem', fontWeight: 600, textAlign: 'center' }}>
                        Members
                    </div>
                    <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', textAlign: 'center' }}>
                        成员个人空间
                    </div>
                </div>

                {/* Department Folders */}
                {departments.map(dept => {
                    const code = deptCodeMap[dept.name];
                    return (
                        <div
                            key={dept.id}
                            onClick={() => navigate(`/dept/${code}`)}
                            style={{
                                background: 'var(--glass-bg)',
                                border: '2px solid var(--glass-border)',
                                borderRadius: '12px',
                                padding: '24px',
                                cursor: 'pointer',
                                transition: 'all 0.2s',
                                display: 'flex',
                                flexDirection: 'column',
                                alignItems: 'center',
                                gap: '12px'
                            }}
                            onMouseEnter={(e) => {
                                e.currentTarget.style.borderColor = 'var(--accent-blue)';
                                e.currentTarget.style.transform = 'translateY(-4px)';
                            }}
                            onMouseLeave={(e) => {
                                e.currentTarget.style.borderColor = 'var(--glass-border)';
                                e.currentTarget.style.transform = 'translateY(0)';
                            }}
                        >
                            <Folder size={48} color="var(--accent-blue)" />
                            <div style={{ fontSize: '1.1rem', fontWeight: 600, textAlign: 'center' }}>
                                {dept.name}
                            </div>
                            <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', textAlign: 'center' }}>
                                部门文件
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

export default RootDirectoryView;
