import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Search, User, Loader2, X } from 'lucide-react';
import axios from 'axios';
import { useAuthStore } from '../../store/useAuthStore';
import { useLanguage } from '../../i18n/useLanguage';

interface Account {
    id: number;
    name: string;
    account_number: string;
    account_type: string;
    city?: string;
    primary_contact_name?: string;
}

interface CommonCRMLookupProps {
    onSelect: (account: Account | null) => void;
    currentAccountId?: number;
    placeholder?: string;
    style?: React.CSSProperties;
}

/**
 * 通用 CRM 客户搜索组件
 */
export const CRMLookup: React.FC<CommonCRMLookupProps> = ({ 
    onSelect, 
    currentAccountId, 
    placeholder,
    style 
}) => {
    const { token } = useAuthStore();
    const { t } = useLanguage();
    const [query, setQuery] = useState('');
    const [results, setResults] = useState<Account[]>([]);
    const [searching, setSearching] = useState(false);
    const [showResults, setShowResults] = useState(false);
    const [selectedAccount, setSelectedAccount] = useState<Account | null>(null);
    const containerRef = useRef<HTMLDivElement>(null);

    const handleSearch = useCallback(async (q: string) => {
        if (!q.trim()) {
            setResults([]);
            return;
        }
        setSearching(true);
        try {
            const res = await axios.get(`/api/v1/accounts?search=${encodeURIComponent(q)}&page_size=10`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            if (res.data.success) {
                setResults(res.data.data);
            }
        } catch (err) {
            console.error('CRM search failed:', err);
        } finally {
            setSearching(false);
        }
    }, [token]);

    useEffect(() => {
        const timer = setTimeout(() => {
            if (query) handleSearch(query);
        }, 300);
        return () => clearTimeout(timer);
    }, [query, handleSearch]);

    // 监听外部传入的 AccountId 变化，用于同步选中状态或清空
    useEffect(() => {
        if (currentAccountId) {
            if (!selectedAccount || selectedAccount.id !== currentAccountId) {
                axios.get(`/api/v1/accounts/${currentAccountId}`, {
                    headers: { Authorization: `Bearer ${token}` }
                }).then(res => {
                    if (res.data.success) setSelectedAccount(res.data.data);
                }).catch(() => { });
            }
        } else {
            // 如果外部传入 ID 变为空，则清空内部选中
            setSelectedAccount(null);
            setQuery('');
        }
    }, [currentAccountId, token]); // 移除 selectedAccount 依赖以避免闭环，由内部逻辑判断

    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
                setShowResults(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    return (
        <div ref={containerRef} style={{ position: 'relative', width: '100%', ...style }}>
            {!selectedAccount ? (
                <div style={{ position: 'relative' }}>
                    <Search
                        size={16}
                        style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-tertiary)' }}
                    />
                    <input
                        type="text"
                        placeholder={placeholder || t('account.searchPlaceholder') || 'Search Customer Account/Company...'}
                        value={query}
                        onChange={(e) => {
                            setQuery(e.target.value);
                            setShowResults(true);
                        }}
                        onFocus={() => setShowResults(true)}
                        style={{
                            width: '100%', height: '44px', background: 'var(--input-bg, var(--glass-bg-light))',
                            border: '1px solid var(--input-border, var(--glass-border))', borderRadius: '12px',
                            padding: '0 12px 0 40px', color: 'var(--text-main)', fontSize: '14px', outline: 'none'
                        }}
                    />
                    {searching && (
                        <Loader2
                            size={16}
                            className="animate-spin"
                            style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--accent-blue)' }}
                        />
                    )}

                    {showResults && results.length > 0 && (
                        <div style={{
                            position: 'absolute', top: '100%', left: 0, right: 0, marginTop: 4,
                            background: 'var(--modal-bg)', border: '1px solid var(--modal-border)',
                            borderRadius: 12, boxShadow: '0 10px 30px rgba(0,0,0,0.5)', zIndex: 10000,
                            maxHeight: 300, overflowY: 'auto', padding: '6px'
                        }}>
                            {results.map(account => (
                                <div
                                    key={account.id}
                                    onClick={() => {
                                        setSelectedAccount(account);
                                        setShowResults(false);
                                        onSelect(account);
                                    }}
                                    style={{
                                        padding: '10px 12px', borderRadius: 8, cursor: 'pointer',
                                        display: 'flex', flexDirection: 'column', gap: 2,
                                        transition: 'background 0.2s'
                                    }}
                                    onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.05)'}
                                    onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                                >
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                        <span style={{ fontWeight: 600, color: 'var(--text-main)', fontSize: '13px' }}>{account.name}</span>
                                        <span style={{
                                            fontSize: 9, padding: '1px 5px', borderRadius: 4,
                                            background: account.account_type === 'DEALER' ? 'rgba(168,85,247,0.15)' : 'rgba(59,130,246,0.15)',
                                            color: account.account_type === 'DEALER' ? '#a855f7' : '#3b82f6',
                                            border: `1px solid var(--glass-border)`
                                        }}>
                                            {account.account_type}
                                        </span>
                                    </div>
                                    <div style={{ fontSize: 10, color: 'var(--text-tertiary)', display: 'flex', gap: 8 }}>
                                        <span>#{account.account_number}</span>
                                        {account.city && <span>📍 {account.city}</span>}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            ) : (
                <div style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '6px 12px', background: 'rgba(59,130,246,0.08)', border: '1px solid rgba(59,130,246,0.25)',
                    borderRadius: 10, width: '100%', height: 44
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                        <div style={{
                            width: 28, height: 28, borderRadius: 8, background: 'rgba(59,130,246,0.15)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#3b82f6', flexShrink: 0
                        }}>
                            <User size={16} />
                        </div>
                        <div style={{ overflow: 'hidden' }}>
                            <div style={{ fontWeight: 600, color: 'var(--text-main)', fontSize: '13px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{selectedAccount.name}</div>
                            <div style={{ fontSize: 10, color: 'var(--text-secondary)' }}>
                                {selectedAccount.account_number} · {selectedAccount.account_type}
                            </div>
                        </div>
                    </div>
                    <button
                        onClick={() => {
                            setSelectedAccount(null);
                            onSelect(null);
                            setQuery('');
                        }}
                        style={{ background: 'transparent', border: 'none', color: 'var(--text-tertiary)', cursor: 'pointer', padding: 4 }}
                    >
                        <X size={14} />
                    </button>
                </div>
            )}
        </div>
    );
};
