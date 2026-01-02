import React, { useState } from 'react';
import axios from 'axios';
import { useAuthStore } from '../store/useAuthStore';
import { Lock, User, ShieldCheck } from 'lucide-react';

const Login: React.FC = () => {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const setAuth = useAuthStore((state) => state.setAuth);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setLoading(true);
        try {
            const res = await axios.post('/api/login', { username, password });
            setAuth(res.data.user, res.data.token);
        } catch (err: any) {
            setError(err.response?.data?.error || '登录失败，请检查用户名或密码');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div style={{
            width: '100vw',
            height: '100vh',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'var(--bg-main)',
            padding: '20px'
        }}>
            <div style={{
                width: '100%',
                maxWidth: '400px',
                background: 'rgba(28, 28, 30, 0.8)',
                backdropFilter: 'blur(20px)',
                WebkitBackdropFilter: 'blur(20px)',
                padding: '40px',
                borderRadius: '24px',
                boxShadow: 'var(--shadow-md)',
                border: '1px solid var(--glass-border)',
                animation: 'scaleIn 0.5s cubic-bezier(0.16, 1, 0.3, 1)'
            }}>
                <div style={{ textAlign: 'center', marginBottom: '32px' }}>
                    <div style={{
                        width: '64px',
                        height: '64px',
                        background: 'var(--accent-blue)',
                        borderRadius: '16px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        margin: '0 auto 20px',
                        boxShadow: '0 8px 32px rgba(255, 210, 0, 0.3)',
                        transform: 'rotate(-5deg)'
                    }}>
                        <ShieldCheck size={32} color="#000" />
                    </div>
                    <h1 style={{ fontSize: '2rem', fontWeight: 900, color: 'var(--accent-blue)', letterSpacing: '-1.5px', marginBottom: '4px' }}>Longhorn</h1>
                    <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Kinefinity 内部数据管理中心</p>
                </div>

                <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    <div style={{ position: 'relative' }}>
                        <User size={18} style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)', zIndex: 10 }} />
                        <input
                            type="text"
                            placeholder="用户名"
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
                            required
                            style={{
                                width: '100%',
                                padding: '14px 16px 14px 48px',
                                borderRadius: '12px',
                                border: '1px solid var(--glass-border)',
                                background: 'rgba(255,255,255,0.05)',
                                color: 'var(--text-main)',
                                fontSize: '1rem',
                                outline: 'none',
                                transition: 'all 0.2s'
                            }}
                            className="login-input"
                        />
                    </div>

                    <div style={{ position: 'relative' }}>
                        <Lock size={18} style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)', zIndex: 10 }} />
                        <input
                            type="password"
                            placeholder="密码"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            required
                            style={{
                                width: '100%',
                                padding: '14px 16px 14px 48px',
                                borderRadius: '12px',
                                border: '1px solid var(--glass-border)',
                                background: 'rgba(255,255,255,0.05)',
                                color: 'var(--text-main)',
                                fontSize: '1rem',
                                outline: 'none',
                                transition: 'all 0.2s'
                            }}
                            className="login-input"
                        />
                    </div>

                    {error && <div style={{ color: '#FF4B4B', fontSize: '0.85rem', textAlign: 'center', background: 'rgba(255, 75, 75, 0.1)', padding: '10px', borderRadius: '8px', border: '1px solid rgba(255, 75, 75, 0.2)' }}>{error}</div>}

                    <button
                        type="submit"
                        disabled={loading}
                        className="btn-primary"
                        style={{
                            width: '100%',
                            justifyContent: 'center',
                            fontSize: '1rem',
                            padding: '14px',
                            marginTop: '12px',
                            borderRadius: '12px',
                            fontWeight: 700
                        }}
                    >
                        {loading ? '验证中...' : '即刻访问'}
                    </button>
                </form>

                <div style={{ marginTop: '32px', textAlign: 'center', fontSize: '0.8rem', color: 'var(--text-secondary)', opacity: 0.6 }}>
                    <p>© 2026 Kinefinity Inc. All rights reserved.</p>
                </div>
            </div>
            <style>{`
                @keyframes scaleIn {
                    from { opacity: 0; transform: scale(0.95); }
                    to { opacity: 1; transform: scale(1); }
                }
                .login-input:focus {
                    border-color: var(--accent-blue) !important;
                    background: rgba(255, 255, 255, 0.08) !important;
                    box-shadow: 0 0 0 4px rgba(255, 210, 0, 0.1);
                }
            `}</style>
        </div>
    );
};

export default Login;
