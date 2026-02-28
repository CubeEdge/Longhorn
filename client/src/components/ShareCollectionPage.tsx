
import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import axios from 'axios';
import {
    Download,
    File,
    Folder,
    Lock,
    AlertCircle,
    Package
} from 'lucide-react';
import { format } from 'date-fns';
import { useLanguage } from '../i18n/useLanguage';

interface ShareItem {
    path: string;
    name: string;
    isDirectory: boolean;
    size: number;
}

interface ShareData {
    name: string;
    items: ShareItem[];
    createdAt: string;
    accessCount: number;
    language?: string;
}

const ShareCollectionPage: React.FC = () => {
    const { token } = useParams<{ token: string }>();
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [needsPassword, setNeedsPassword] = useState(false);
    const [password, setPassword] = useState('');
    const [data, setData] = useState<ShareData | null>(null);

    // Hooks
    const { t, language: currentLanguage, setLanguage } = useLanguage();

    const fetchShare = async (pwd?: string) => {
        try {
            setLoading(true);
            setError(null);
            const res = await axios.get(`/api/share-collection/${token}`, {
                params: { password: pwd }
            });
            setData(res.data);
            setNeedsPassword(false);

            // Set initial language from data if available
            if (res.data.language) {
                setLanguage(res.data.language as any);
            }
        } catch (err: any) {
            if (err.response?.status === 401 && err.response?.data?.needsPassword) {
                setNeedsPassword(true);
            } else {
                setError(err.response?.data?.error || t('share_page.load_error'));
            }
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchShare();
    }, [token]);

    const handlePasswordSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        fetchShare(password);
    };

    const formatSize = (bytes: number) => {
        if (bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    };

    const downloadCollection = () => {
        const url = `/api/share-collection/${token}/download?password=${encodeURIComponent(password)}`;
        window.open(url, '_blank');
    };

    if (loading && !needsPassword) {
        return (
            <div className="share-page-container flex-center">
                <div className="spinner"></div>
            </div>
        );
    }

    if (needsPassword) {
        return (
            <div className="share-page-container flex-center">
                <div className="password-card fade-in">
                    <div className="icon-wrapper">
                        <Lock size={48} color="var(--accent-blue)" />
                    </div>
                    <h2>{t('share_page.password_required')}</h2>
                    <p>{t('share_page.enter_password')}</p>
                    <form onSubmit={handlePasswordSubmit}>
                        <input
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            placeholder={t('auth.password')}
                            autoFocus
                        />
                        <button type="submit" className="btn-primary">
                            {t('action.unlock')}
                        </button>
                    </form>
                    {error && <div className="error-msg">{error}</div>}
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="share-page-container flex-center">
                <div className="error-card fade-in">
                    <AlertCircle size={48} color="var(--accent-red)" />
                    <h2>{t('share_page.access_failed')}</h2>
                    <p>{error}</p>
                </div>
            </div>
        );
    }

    if (!data) return null;

    return (
        <div className="share-page-container fade-in">
            <header className="share-header">
                <div className="header-content">
                    <div className="logo">
                        <Package size={28} color="var(--accent-blue)" />
                        <h1>Longhorn Share</h1>
                    </div>
                    <div className="share-info">
                        <h2>{data.name}</h2>
                        <span>{t('share_page.items', { count: data.items.length })} • {format(new Date(data.createdAt), 'yyyy-MM-dd')}</span>
                    </div>
                </div>
                <button onClick={downloadCollection} className="btn-primary download-btn">
                    <Download size={20} />
                    {t('action.download_all')}
                </button>
            </header>

            {/* Language Switcher - Top Right */}
            <div style={{ position: 'absolute', top: 20, right: 20, zIndex: 100 }}>
                <select
                    value={currentLanguage}
                    onChange={(e) => setLanguage(e.target.value as any)}
                    style={{
                        background: 'rgba(255, 255, 255, 0.1)',
                        color: 'var(--text-main)',
                        border: '1px solid rgba(255, 255, 255, 0.2)',
                        borderRadius: '8px',
                        padding: '6px 12px',
                        fontSize: '0.9rem',
                        cursor: 'pointer',
                        outline: 'none',
                        backdropFilter: 'blur(10px)'
                    }}
                >
                    <option value="zh">🇨🇳 中文</option>
                    <option value="en">🇺🇸 English</option>
                    <option value="de">🇩🇪 Deutsch</option>
                    <option value="ja">🇯🇵 日本語</option>
                </select>
            </div>

            <main className="share-content">
                <div className="file-list-container">
                    <div className="file-list-header">
                        <div className="col-name">{t('share.name')}</div>
                        <div className="col-size">Size</div>
                        <div className="col-action">{t('action.download')}</div>
                    </div>
                    <div className="file-list-body">
                        {data.items.map((item, index) => (
                            <div key={index} className="file-item">
                                <div className="col-name">
                                    {item.isDirectory ? (
                                        <Folder size={20} color="var(--accent-blue)" fill="rgba(88, 166, 255, 0.1)" />
                                    ) : (
                                        <File size={20} color="var(--text-secondary)" />
                                    )}
                                    <span>{item.name}</span>
                                </div>
                                <div className="col-size">
                                    {item.isDirectory ? '-' : formatSize(item.size)}
                                </div>
                                <div className="col-action">
                                    {!item.isDirectory && (
                                        <button
                                            className="icon-btn"
                                            title="下载"
                                            onClick={() => {
                                                // Individual download not supported for collections - use Download All
                                            }}
                                        >
                                            <Download size={18} />
                                        </button>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </main>

            <style>{`
                .share-page-container {
                    min-height: 100vh;
                    background: var(--bg-main);
                    color: var(--text-main);
                    display: flex;
                    flex-direction: column;
                }
                .flex-center {
                    align-items: center;
                    justify-content: center;
                }
                .password-card, .error-card {
                    background: var(--bg-secondary);
                    padding: 40px;
                    border-radius: 16px;
                    text-align: center;
                    width: 100%;
                    max-width: 400px;
                    border: 1px solid var(--border-color);
                    box-shadow: 0 4px 24px rgba(0,0,0,0.2);
                }
                .password-card h2 { margin: 16px 0 8px; }
                .password-card p { color: var(--text-secondary); margin-bottom: 24px; }
                .password-card input {
                    width: 100%;
                    padding: 12px;
                    background: var(--bg-input);
                    border: 1px solid var(--border-color);
                    border-radius: 8px;
                    color: var(--text-main);
                    margin-bottom: 16px;
                    font-size: 1rem;
                }
                .share-header {
                    background: var(--bg-secondary);
                    border-bottom: 1px solid var(--border-color);
                    padding: 20px 40px;
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                }
                .header-content .logo {
                    display: flex;
                    align-items: center;
                    gap: 12px;
                    margin-bottom: 4px;
                    color: var(--accent-blue);
                    font-weight: 700;
                }
                .share-info h2 { font-size: 1.5rem; margin: 0; }
                .share-info span { color: var(--text-secondary); font-size: 0.9rem; }
                .share-content {
                    flex: 1;
                    padding: 40px;
                    max-width: 1000px;
                    margin: 0 auto;
                    width: 100%;
                }
                .file-list-container {
                    background: var(--bg-secondary);
                    border-radius: 12px;
                    border: 1px solid var(--border-color);
                    overflow: hidden;
                }
                .file-list-header {
                    display: flex;
                    padding: 16px 24px;
                    background: rgba(255,255,255,0.02);
                    border-bottom: 1px solid var(--border-color);
                    color: var(--text-secondary);
                    font-size: 0.9rem;
                    font-weight: 600;
                }
                .file-list-body .file-item {
                    display: flex;
                    padding: 16px 24px;
                    border-bottom: 1px solid var(--border-color);
                    align-items: center;
                    transition: background 0.2s;
                }
                .file-item:last-child { border-bottom: none; }
                .file-item:hover { background: rgba(255,255,255,0.03); }
                .col-name { flex: 1; display: flex; align-items: center; gap: 12px; }
                .col-size { width: 120px; color: var(--text-secondary); text-align: right; }
                .col-action { width: 80px; display: flex; justify-content: flex-end; }
                .icon-btn {
                    background: none;
                    border: none;
                    color: var(--text-secondary);
                    cursor: pointer;
                    padding: 4px;
                    border-radius: 4px;
                    transition: all 0.2s;
                }
                .icon-btn:hover { background: rgba(255,255,255,0.1); color: var(--text-main); }
                .error-msg { color: var(--accent-red); margin-top: 12px; }
            `}</style>
        </div>
    );
};

export default ShareCollectionPage;
