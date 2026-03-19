import React, { useState, useEffect, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X, Check, Plus, Search, MapPin, User } from 'lucide-react';
import axios from 'axios';
import { useAuthStore } from '../../store/useAuthStore';
import UnifiedCustomerModal from './UnifiedCustomerModal';

// 账户类型定义
interface Account {
    id: number;
    account_number: string;
    name: string;
    account_type: 'DEALER' | 'ORGANIZATION' | 'INDIVIDUAL';
    email?: string;
    phone?: string;
    country?: string;
    city?: string;
    service_tier?: string;
    primary_contact_name?: string;
    primary_contact_phone?: string;
}

interface Contact {
    id: number;
    name: string;
    email?: string;
    phone?: string;
    job_title?: string;
    is_primary: boolean;
}

interface LinkCorporateModalProps {
    ticketId: number;
    reporterSnapshot: {
        name?: string;
        phone?: string;
        email?: string;
        [key: string]: any;
    };
    onClose: () => void;
    onSuccess: () => void;
}

// 账户类型图标
const ACCOUNT_TYPE_ICONS: Record<string, string> = {
    INDIVIDUAL: '👤',
    ORGANIZATION: '🏢',
    DEALER: '🏪'
};

const LinkCorporateModal: React.FC<LinkCorporateModalProps> = ({
    ticketId,
    reporterSnapshot,
    onClose,
    onSuccess
}) => {
    const { token } = useAuthStore();
    const [loading, setLoading] = useState(false);
    const [showAddCustomer, setShowAddCustomer] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [accounts, setAccounts] = useState<Account[]>([]);
    const [contacts, setContacts] = useState<Contact[]>([]);
    const [selectedAccount, setSelectedAccount] = useState<Account | null>(null);
    const [selectedContact, setSelectedContact] = useState<Contact | null>(null);
    const [searching, setSearching] = useState(false);
    const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    // 搜索账户
    const searchAccounts = useCallback(async (query: string) => {
        if (!query.trim()) {
            // 如果没有搜索词，加载最近的20个客户
            await loadRecentAccounts();
            return;
        }
        setSearching(true);
        try {
            const params = new URLSearchParams();
            params.append('search', query);
            params.append('page_size', '20');
            const response = await axios.get(`/api/v1/accounts?${params.toString()}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            if (response.data?.success) {
                setAccounts(response.data.data || []);
            }
        } catch (error) {
            console.error('Failed to search accounts:', error);
        } finally {
            setSearching(false);
        }
    }, [token]);
    
    // 加载最近的客户列表
    const loadRecentAccounts = useCallback(async () => {
        setSearching(true);
        try {
            const params = new URLSearchParams();
            params.append('page_size', '20');
            params.append('sort', '-updated_at'); // 按最近更新时间排序
            const response = await axios.get(`/api/v1/accounts?${params.toString()}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            if (response.data?.success) {
                setAccounts(response.data.data || []);
            }
        } catch (error) {
            console.error('Failed to load recent accounts:', error);
        } finally {
            setSearching(false);
        }
    }, [token]);

    // 加载联系人
    const loadContacts = useCallback(async (accountId: number) => {
        try {
            const response = await axios.get(`/api/v1/accounts/${accountId}/contacts`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            if (response.data?.success) {
                const contactList = response.data.data || [];
                setContacts(contactList);
                // 自动选中主联系人
                const primary = contactList.find((c: Contact) => c.is_primary);
                if (primary) {
                    setSelectedContact(primary);
                }
            }
        } catch (error) {
            console.error('Failed to load contacts:', error);
        }
    }, [token]);

    // 搜索防抖
    useEffect(() => {
        if (searchTimeoutRef.current) {
            clearTimeout(searchTimeoutRef.current);
        }
        searchTimeoutRef.current = setTimeout(() => {
            searchAccounts(searchQuery);
        }, 300);
        return () => {
            if (searchTimeoutRef.current) {
                clearTimeout(searchTimeoutRef.current);
            }
        };
    }, [searchQuery, searchAccounts]);
    
    // 组件挂载时加载最近的客户
    useEffect(() => {
        loadRecentAccounts();
    }, [loadRecentAccounts]);

    // 选择账户
    const handleSelectAccount = async (account: Account) => {
        setSelectedAccount(account);
        await loadContacts(account.id);
    };

    // 选择联系人
    const handleSelectContact = (contact: Contact) => {
        setSelectedContact(contact);
    };

    // 清除选择
    const handleClear = () => {
        setSelectedAccount(null);
        setSelectedContact(null);
        setContacts([]);
    };

    // 提交
    const handleSubmit = async () => {
        if (!selectedAccount) {
            alert('请先选择要关联的客户');
            return;
        }
        setLoading(true);
        try {
            await axios.patch(`/api/v1/tickets/${ticketId}`, {
                account_id: selectedAccount.id,
                contact_id: selectedContact?.id || null,
                reporter_name: selectedContact?.name || reporterSnapshot?.name || undefined,
                change_reason: `关联客户: ${selectedAccount.name}`
            }, {
                headers: { Authorization: `Bearer ${token}` }
            });
            onSuccess();
        } catch (err: any) {
            console.error('Link corporate error', err);
            alert(err.response?.data?.error || '网络错误');
        } finally {
            setLoading(false);
        }
    };

    return createPortal(
        <div style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            background: 'var(--modal-overlay)', backdropFilter: 'blur(8px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999
        }}>
            <div style={{
                background: 'var(--modal-bg)', width: 480, height: 640, borderRadius: 16,
                boxShadow: 'var(--glass-shadow-lg)',
                border: '1px solid var(--glass-border)',
                display: 'flex', flexDirection: 'column',
                overflow: 'hidden'
            }}>
                {/* Header */}
                <div style={{
                    padding: '20px 24px', borderBottom: '1px solid var(--glass-border)',
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    flexShrink: 0
                }}>
                    <h3 style={{ margin: 0, fontSize: 17, fontWeight: 600, color: 'var(--text-main)' }}>关联到已知客户</h3>
                    <button type="button" onClick={onClose} style={{ 
                        background: 'transparent', border: 'none', color: 'var(--text-tertiary)', cursor: 'pointer',
                        padding: 4, borderRadius: 6, transition: 'all 0.2s',
                        display: 'flex', alignItems: 'center', justifyContent: 'center'
                    }} onMouseEnter={e => (e.currentTarget.style.color = 'var(--text-secondary)')} onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-tertiary)')}>
                        <X size={20} />
                    </button>
                </div>

                {/* Content */}
                <div style={{ padding: '20px 24px', overflowY: 'auto', flex: 1 }}>
                    {/* 搜索框 - 置顶 */}
                    <div style={{ position: 'relative', marginBottom: 16 }}>
                        <div style={{
                            position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)',
                            color: 'var(--text-tertiary)', pointerEvents: 'none'
                        }}>
                            <Search size={18} />
                        </div>
                        <input
                            type="text"
                            value={searchQuery}
                            onChange={(e) => {
                                setSearchQuery(e.target.value);
                                if (selectedAccount) handleClear();
                            }}
                            placeholder="搜索客户名称、编号..."
                            autoFocus
                            style={{
                                width: '100%', padding: '12px 16px 12px 44px',
                                background: 'var(--input-bg)', border: '1px solid var(--input-border)',
                                borderRadius: 10, color: 'var(--text-main)', fontSize: 15,
                                outline: 'none', transition: 'all 0.2s',
                                boxSizing: 'border-box'
                            }}
                            onFocus={(e) => e.target.style.borderColor = 'var(--accent-blue)'}
                            onBlur={(e) => e.target.style.borderColor = 'var(--input-border)'}
                        />
                        {searching && (
                            <div style={{
                                position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%)'
                            }}>
                                <div style={{
                                    width: 16, height: 16, border: '2px solid var(--accent-subtle)',
                                    borderTopColor: 'var(--accent-blue)', borderRadius: '50%',
                                    animation: 'spin 1s linear infinite'
                                }} />
                            </div>
                        )}
                    </div>

                    {/* 访客快照 - 标签式 */}
                    {reporterSnapshot?.name && (
                        <div style={{
                            display: 'inline-flex', alignItems: 'center', gap: 8,
                            padding: '8px 14px', background: 'var(--accent-blue-subtle)',
                            border: '1px solid var(--accent-blue-border)', borderRadius: 20,
                            fontSize: 13, color: 'var(--accent-blue)', marginBottom: 20
                        }}>
                            <User size={14} />
                            <span>当前访客: <strong>{reporterSnapshot.name}</strong></span>
                        </div>
                    )}

                    {/* 搜索结果区域 */}
                    {!selectedAccount ? (
                        <div>
                            {/* 搜索结果标题 */}
                            {accounts.length > 0 && (
                                <div style={{
                                    fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)',
                                    textTransform: 'uppercase', letterSpacing: '0.5px',
                                    marginBottom: 12, paddingLeft: 4
                                }}>
                                    搜索结果 ({accounts.length})
                                </div>
                            )}

                            {/* 账户卡片列表 */}
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                                {accounts.map((account) => (
                                    <div
                                        key={account.id}
                                        onClick={() => handleSelectAccount(account)}
                                        style={{
                                            padding: 16, background: 'var(--glass-bg-light)',
                                            border: '1px solid var(--glass-border)', borderRadius: 12,
                                            cursor: 'pointer', transition: 'all 0.2s',
                                            display: 'flex', alignItems: 'flex-start', gap: 12
                                        }}
                                        onMouseEnter={(e) => {
                                            e.currentTarget.style.background = 'var(--glass-bg-hover)';
                                            e.currentTarget.style.borderColor = 'var(--glass-border-accent)';
                                        }}
                                        onMouseLeave={(e) => {
                                            e.currentTarget.style.background = 'var(--glass-bg-light)';
                                            e.currentTarget.style.borderColor = 'var(--glass-border)';
                                        }}
                                    >
                                        {/* 图标 */}
                                        <div style={{
                                            width: 40, height: 40, borderRadius: 10,
                                            background: account.account_type === 'ORGANIZATION' ? 'rgba(59, 130, 246, 0.15)' :
                                                account.account_type === 'DEALER' ? 'rgba(168, 85, 247, 0.15)' : 'rgba(34, 197, 94, 0.15)',
                                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                                            fontSize: 20, flexShrink: 0
                                        }}>
                                            {ACCOUNT_TYPE_ICONS[account.account_type]}
                                        </div>

                                        {/* 信息 */}
                                        <div style={{ flex: 1, minWidth: 0 }}>
                                            <div style={{
                                                fontSize: 15, fontWeight: 600, color: 'var(--text-main)',
                                                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'
                                            }}>
                                                {account.name}
                                            </div>
                                            <div style={{
                                                fontSize: 12, color: 'var(--text-secondary)', marginTop: 4,
                                                display: 'flex', alignItems: 'center', gap: 8
                                            }}>
                                                {account.city && (
                                                    <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                                                        <MapPin size={12} /> {account.city}
                                                    </span>
                                                )}
                                                {account.primary_contact_name && (
                                                    <span>· {account.primary_contact_name}</span>
                                                )}
                                            </div>
                                        </div>

                                        {/* 箭头 */}
                                        <div style={{ color: 'var(--text-tertiary)', fontSize: 18 }}>›</div>
                                    </div>
                                ))}
                            </div>

                            {/* 空状态 */}
                            {searchQuery && !searching && accounts.length === 0 && (
                                <div style={{
                                    textAlign: 'center', padding: '40px 20px', color: 'var(--text-secondary)'
                                }}>
                                    <div style={{ fontSize: 32, marginBottom: 12 }}>🔍</div>
                                    <div style={{ fontSize: 14 }}>未找到匹配的客户</div>
                                    <div style={{ fontSize: 12, marginTop: 4, opacity: 0.7 }}>尝试其他关键词搜索</div>
                                </div>
                            )}

                            {/* 提示 */}
                            {!searchQuery && (
                                <div style={{
                                    textAlign: 'center', padding: '40px 20px', color: 'var(--text-secondary)'
                                }}>
                                    <div style={{ fontSize: 28, marginBottom: 12 }}>👆</div>
                                    <div style={{ fontSize: 14 }}>输入关键词开始搜索</div>
                                </div>
                            )}
                        </div>
                    ) : (
                        /* 已选择账户 - 显示联系人 */
                        <div>
                            {/* 已选账户卡片 */}
                            <div style={{
                                padding: 16, background: 'var(--accent-subtle)',
                                border: '1px solid var(--glass-border-accent)', borderRadius: 12,
                                marginBottom: 20, position: 'relative'
                            }}>
                                <button
                                    onClick={handleClear}
                                    style={{
                                        position: 'absolute', top: 12, right: 12,
                                        background: 'transparent', border: 'none', color: 'var(--text-secondary)',
                                        cursor: 'pointer', padding: 4, borderRadius: 4,
                                        display: 'flex', alignItems: 'center', justifyContent: 'center'
                                    }}
                                    title="重新选择"
                                >
                                    <X size={16} />
                                </button>

                                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                                    <div style={{
                                        width: 44, height: 44, borderRadius: 12,
                                        background: selectedAccount.account_type === 'ORGANIZATION' ? 'rgba(59, 130, 246, 0.2)' :
                                            selectedAccount.account_type === 'DEALER' ? 'rgba(168, 85, 247, 0.2)' : 'rgba(34, 197, 94, 0.2)',
                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        fontSize: 22
                                    }}>
                                        {ACCOUNT_TYPE_ICONS[selectedAccount.account_type]}
                                    </div>
                                    <div>
                                        <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--accent-blue)' }}>
                                            {selectedAccount.name}
                                        </div>
                                        <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>
                                            {selectedAccount.city || '未设置地区'}
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* 联系人选择 */}
                            <div style={{ marginBottom: 16 }}>
                                <div style={{
                                    fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)',
                                    textTransform: 'uppercase', letterSpacing: '0.5px',
                                    marginBottom: 12, paddingLeft: 4
                                }}>
                                    选择联系人
                                </div>

                                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                                    {contacts.map((contact) => (
                                        <div
                                            key={contact.id}
                                            onClick={() => handleSelectContact(contact)}
                                            style={{
                                                padding: 14, background: selectedContact?.id === contact.id
                                                    ? 'var(--accent-green-subtle)' : 'var(--glass-bg-light)',
                                                border: `1px solid ${selectedContact?.id === contact.id ? 'var(--accent-green-border)' : 'var(--glass-border)'}`,
                                                borderRadius: 10, cursor: 'pointer',
                                                transition: 'all 0.2s', display: 'flex', alignItems: 'center', gap: 12
                                            }}
                                        >
                                            <input
                                                type="radio"
                                                checked={selectedContact?.id === contact.id}
                                                onChange={() => {}}
                                                style={{
                                                    width: 18, height: 18, accentColor: 'var(--accent-green)',
                                                    cursor: 'pointer'
                                                }}
                                            />
                                            <div style={{ flex: 1 }}>
                                                <div style={{
                                                    fontSize: 14, fontWeight: 500, color: 'var(--text-main)',
                                                    display: 'flex', alignItems: 'center', gap: 8
                                                }}>
                                                    {contact.name}
                                                    {contact.is_primary && (
                                                        <span style={{
                                                            fontSize: 10, padding: '2px 8px',
                                                            background: 'var(--accent-subtle)', color: 'var(--accent-blue)',
                                                            borderRadius: 4, fontWeight: 600
                                                        }}>主要</span>
                                                    )}
                                                </div>
                                                {(contact.job_title || contact.phone) && (
                                                    <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>
                                                        {contact.job_title} {contact.phone && `· ${contact.phone}`}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    ))}

                                    {/* 临时对接人选项 */}
                                    <div
                                        onClick={() => setSelectedContact(null)}
                                        style={{
                                            padding: 14, background: !selectedContact
                                                ? 'var(--accent-blue-subtle)' : 'var(--glass-bg-light)',
                                            border: `1px solid ${!selectedContact ? 'var(--accent-blue-border)' : 'var(--glass-border)'}`,
                                            borderRadius: 10, cursor: 'pointer',
                                            transition: 'all 0.2s', display: 'flex', alignItems: 'center', gap: 12
                                        }}
                                    >
                                        <input
                                            type="radio"
                                            checked={!selectedContact}
                                            onChange={() => {}}
                                            style={{
                                                width: 18, height: 18, accentColor: 'var(--accent-blue)',
                                                cursor: 'pointer'
                                            }}
                                        />
                                        <div>
                                            <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--accent-blue)' }}>
                                                临时对接人
                                            </div>
                                            <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>
                                                不关联具体联系人，使用访客信息
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div style={{
                    padding: '16px 24px', borderTop: '1px solid var(--glass-border)',
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    flexShrink: 0
                }}>
                    {/* 添加新客户链接 */}
                    <button
                        type="button"
                        onClick={() => setShowAddCustomer(true)}
                        style={{
                            display: 'flex', alignItems: 'center', gap: 6,
                            background: 'transparent', border: 'none', color: 'var(--text-secondary)',
                            cursor: 'pointer', fontSize: 13, fontWeight: 500,
                            padding: '8px 12px', borderRadius: 8, transition: 'all 0.2s'
                        }}
                        onMouseEnter={(e) => {
                            e.currentTarget.style.color = 'var(--accent-gold)';
                            e.currentTarget.style.background = 'var(--accent-gold-subtle)';
                        }}
                        onMouseLeave={(e) => {
                            e.currentTarget.style.color = 'var(--text-secondary)';
                            e.currentTarget.style.background = 'transparent';
                        }}
                    >
                        <Plus size={16} />
                        添加新客户
                    </button>

                    {/* 操作按钮 */}
                    <div style={{ display: 'flex', gap: 12 }}>
                        <button
                            type="button"
                            onClick={onClose}
                            style={{
                                padding: '10px 20px', background: 'transparent',
                                border: '1px solid var(--glass-border)', borderRadius: 10,
                                color: 'var(--text-secondary)', cursor: 'pointer', fontSize: 14, fontWeight: 500,
                                transition: 'all 0.2s'
                            }}
                            onMouseEnter={(e) => {
                                e.currentTarget.style.borderColor = 'var(--glass-border-accent)';
                                e.currentTarget.style.color = 'var(--text-main)';
                            }}
                            onMouseLeave={(e) => {
                                e.currentTarget.style.borderColor = 'var(--glass-border)';
                                e.currentTarget.style.color = 'var(--text-secondary)';
                            }}
                        >
                            取消
                        </button>
                        <button
                            onClick={handleSubmit}
                            disabled={loading || !selectedAccount}
                            style={{
                                padding: '10px 24px', background: selectedAccount ? 'var(--accent-gold)' : 'var(--accent-gold-muted)',
                                border: 'none', borderRadius: 10, color: '#000',
                                cursor: (loading || !selectedAccount) ? 'not-allowed' : 'pointer',
                                fontSize: 14, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8,
                                transition: 'all 0.2s', opacity: selectedAccount ? 1 : 0.5
                            }}
                        >
                            {loading ? (
                                <>
                                    <div style={{
                                        width: 14, height: 14,
                                        border: '2px solid var(--text-tertiary)',
                                        borderTopColor: 'var(--text-main)', borderRadius: '50%',
                                        animation: 'spin 1s linear infinite'
                                    }} />
                                    处理中...
                                </>
                            ) : (
                                <>
                                    <Check size={16} />
                                    确认关联
                                </>
                            )}
                        </button>
                    </div>
                </div>
            </div>

            {/* 添加新客户弹窗 */}
            <UnifiedCustomerModal
                isOpen={showAddCustomer}
                onClose={() => setShowAddCustomer(false)}
                onSuccess={() => {
                    setShowAddCustomer(false);
                    onSuccess();
                }}
                ticketId={ticketId}
                prefillData={{
                    name: reporterSnapshot?.name,
                    email: reporterSnapshot?.email,
                    phone: reporterSnapshot?.phone
                }}
                defaultLifecycleStage="ACTIVE"
            />
        </div>,
        document.body
    );
};

export default LinkCorporateModal;
