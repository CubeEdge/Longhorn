import React, { useState, useEffect, useRef } from 'react';
import { Search, Plus, Trash2, X, Tag, Loader2 } from 'lucide-react';
import { useLanguage } from '../../i18n/useLanguage';
import { useAuthStore } from '../../store/useAuthStore';

interface SynonymGroup {
    id: number;
    category: string;
    words: string[];
    created_by_name?: string;
    updated_at?: string;
}

interface SynonymManagerProps {
    isOpen: boolean;
    onClose: () => void;
}

// 分类颜色映射
const CATEGORY_COLORS: Record<string, string> = {
    '音频': '#60A5FA',
    '色彩': '#FB923C',
    '接口': '#4ADE80',
    '存储': '#A78BFA',
    '镜头': '#F472B6',
    '故障': '#EF4444',
    '固件': '#38BDF8',
    '电池': '#FBBF24',
    default: '#9CA3AF'
};

function getCategoryColor(category: string): string {
    for (const [key, color] of Object.entries(CATEGORY_COLORS)) {
        if (category.includes(key)) return color;
    }
    return CATEGORY_COLORS.default;
}

export const SynonymManager: React.FC<SynonymManagerProps> = ({ isOpen, onClose }) => {
    const { t } = useLanguage();
    const { token } = useAuthStore();
    const [groups, setGroups] = useState<SynonymGroup[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [totalWords, setTotalWords] = useState(0);
    const [editingGroupId, setEditingGroupId] = useState<number | null>(null);
    const [newWordInput, setNewWordInput] = useState('');
    const [showNewGroup, setShowNewGroup] = useState(false);
    const [newGroupCategory, setNewGroupCategory] = useState('');
    const [newGroupWords, setNewGroupWords] = useState('');
    const newWordRef = useRef<HTMLInputElement>(null);
    const newGroupRef = useRef<HTMLInputElement>(null);

    const API_BASE = '/api/v1/synonyms';

    // Fetch all synonym groups
    const fetchGroups = async () => {
        try {
            setLoading(true);
            const res = await fetch(API_BASE, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await res.json();
            if (data.success) {
                setGroups(data.data);
                setTotalWords(data.meta.total_words);
            }
        } catch (err) {
            console.error('[SynonymManager] Fetch error:', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (isOpen) fetchGroups();
    }, [isOpen]);

    // Add a word to an existing group
    const addWord = async (groupId: number) => {
        const word = newWordInput.trim();
        if (!word) return;
        const group = groups.find(g => g.id === groupId);
        if (!group) return;
        if (group.words.includes(word)) {
            setNewWordInput('');
            return;
        }

        const updatedWords = [...group.words, word];
        try {
            const res = await fetch(`${API_BASE}/${groupId}`, {
                method: 'PUT',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ category: group.category, words: updatedWords })
            });
            const data = await res.json();
            if (data.success) {
                setGroups(prev => prev.map(g => g.id === groupId ? { ...g, words: updatedWords } : g));
                setTotalWords(prev => prev + 1);
                setNewWordInput('');
            }
        } catch (err) {
            console.error('[SynonymManager] Add word error:', err);
        }
    };

    // Remove a word from a group
    const removeWord = async (groupId: number, word: string) => {
        const group = groups.find(g => g.id === groupId);
        if (!group) return;
        const updatedWords = group.words.filter(w => w !== word);
        if (updatedWords.length < 2) {
            // If less than 2 words, delete the entire group
            await deleteGroup(groupId);
            return;
        }

        try {
            const res = await fetch(`${API_BASE}/${groupId}`, {
                method: 'PUT',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ category: group.category, words: updatedWords })
            });
            const data = await res.json();
            if (data.success) {
                setGroups(prev => prev.map(g => g.id === groupId ? { ...g, words: updatedWords } : g));
                setTotalWords(prev => prev - 1);
            }
        } catch (err) {
            console.error('[SynonymManager] Remove word error:', err);
        }
    };

    // Delete entire group
    const deleteGroup = async (groupId: number) => {
        try {
            const res = await fetch(`${API_BASE}/${groupId}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await res.json();
            if (data.success) {
                const deleted = groups.find(g => g.id === groupId);
                setGroups(prev => prev.filter(g => g.id !== groupId));
                if (deleted) setTotalWords(prev => prev - deleted.words.length);
            }
        } catch (err) {
            console.error('[SynonymManager] Delete error:', err);
        }
    };

    // Create new group
    const createGroup = async () => {
        const category = newGroupCategory.trim();
        const words = newGroupWords.split(/[,，、\s]+/).map(w => w.trim()).filter(w => w.length > 0);
        if (!category || words.length < 2) return;

        try {
            const res = await fetch(API_BASE, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ category, words })
            });
            const data = await res.json();
            if (data.success) {
                setGroups(prev => [...prev, { id: data.data.id, category, words, created_by_name: 'me' }]);
                setTotalWords(prev => prev + words.length);
                setNewGroupCategory('');
                setNewGroupWords('');
                setShowNewGroup(false);
            }
        } catch (err) {
            console.error('[SynonymManager] Create error:', err);
        }
    };

    // Filter groups by search
    const filteredGroups = searchQuery
        ? groups.filter(g =>
            g.category.toLowerCase().includes(searchQuery.toLowerCase()) ||
            g.words.some(w => w.toLowerCase().includes(searchQuery.toLowerCase()))
        )
        : groups;

    if (!isOpen) return null;

    return (
        <div style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            background: 'var(--glass-bg-hover)', backdropFilter: 'blur(8px)',
            zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center',
            animation: 'fadeIn 0.2s ease'
        }} onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
            <div style={{
                width: '90%', maxWidth: '900px', height: '80vh',
                maxHeight: '800px',
                background: 'var(--bg-sidebar)',
                borderRadius: '16px',
                border: '1px solid var(--glass-border)',
                boxShadow: '0 24px 80px var(--glass-shadow-lg)',
                display: 'flex', flexDirection: 'column',
                overflow: 'hidden'
            }}>
                {/* Header */}
                <div style={{
                    padding: '24px 32px',
                    borderBottom: '1px solid var(--glass-border)',
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between'
                }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        <h2 style={{ fontSize: '24px', fontWeight: 700, color: 'var(--text-main)', margin: 0 }}>
                            {t('synonym.title')}
                        </h2>
                        <p style={{ fontSize: '14px', color: 'var(--text-secondary)', margin: 0 }}>
                            {t('synonym.stats', { groups: groups.length, words: totalWords })}
                        </p>
                    </div>


                    <button
                        onClick={onClose}
                        style={{
                            width: '40px',
                            height: '40px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            background: 'var(--glass-bg-hover)',
                            border: 'none',
                            borderRadius: '50%',
                            cursor: 'pointer',
                            color: 'var(--text-main)',
                            transition: 'all 0.2s'
                        }}
                        onMouseEnter={e => { e.currentTarget.style.background = 'var(--glass-bg-hover)'; }}
                        onMouseLeave={e => { e.currentTarget.style.background = 'var(--glass-bg-hover)'; }}
                    >
                        <X size={22} />
                    </button>


                </div>

                {/* Toolbar */}
                <div style={{
                    padding: '12px 24px',
                    display: 'flex', alignItems: 'center', gap: '12px',
                    borderBottom: '1px solid var(--glass-border)'
                }}>
                    <div style={{
                        flex: 1, display: 'flex', alignItems: 'center', gap: '8px',
                        background: 'var(--glass-bg-light)',
                        border: '1px solid var(--glass-border)',
                        borderRadius: '10px', padding: '8px 14px'
                    }}>
                        <Search size={16} color="#666" />
                        <input
                            value={searchQuery}
                            onChange={e => setSearchQuery(e.target.value)}
                            placeholder={t('synonym.search_placeholder')}
                            style={{
                                background: 'none', border: 'none', outline: 'none',
                                color: 'var(--text-secondary)', fontSize: '14px', width: '100%'
                            }}
                        />
                    </div>
                    <button
                        onClick={() => { setShowNewGroup(true); setTimeout(() => newGroupRef.current?.focus(), 100); }}
                        style={{
                            display: 'flex', alignItems: 'center', gap: '6px',
                            padding: '9px 16px', borderRadius: '10px',
                            background: 'rgba(255,215,0,0.08)',
                            border: '1px solid rgba(255,215,0,0.2)',
                            color: '#FFD700', fontSize: '13px', fontWeight: 500,
                            cursor: 'pointer', transition: 'all 0.15s', whiteSpace: 'nowrap'
                        }}
                        onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,215,0,0.15)'; }}
                        onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,215,0,0.08)'; }}
                    >
                        <Plus size={16} />
                        {t('synonym.add_group')}
                    </button>
                </div>

                {/* Content */}
                <div style={{ flex: 1, overflow: 'auto', padding: '16px 24px' }}>
                    {loading ? (
                        <div style={{
                            flex: 1,
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '12px',
                            color: 'var(--text-secondary)',
                            fontSize: '14px'
                        }}>
                            <Loader2 size={24} color="#FFD700" style={{ animation: 'spin 1s linear infinite' }} />
                            <span>正在加载...</span>
                        </div>
                    ) : (
                        <>
                            {/* New group form */}
                            {showNewGroup && (
                                <div style={{
                                    background: 'rgba(255,215,0,0.04)',
                                    border: '1px dashed rgba(255,215,0,0.25)',
                                    borderRadius: '12px', padding: '16px', marginBottom: '12px'
                                }}>
                                    <div style={{ display: 'flex', gap: '10px', alignItems: 'center', marginBottom: '10px' }}>
                                        <input
                                            ref={newGroupRef}
                                            value={newGroupCategory}
                                            onChange={e => setNewGroupCategory(e.target.value)}
                                            placeholder={t('synonym.category_placeholder')}
                                            style={{
                                                background: 'var(--glass-bg)', border: '1px solid rgba(255,215,0,0.15)',
                                                borderRadius: '8px', padding: '8px 12px',
                                                color: '#FFD700', fontSize: '14px', fontWeight: 600,
                                                outline: 'none', width: '120px'
                                            }}
                                        />
                                        <input
                                            value={newGroupWords}
                                            onChange={e => setNewGroupWords(e.target.value)}
                                            placeholder={t('synonym.words_placeholder')}
                                            onKeyDown={e => { if (e.key === 'Enter') createGroup(); }}
                                            style={{
                                                flex: 1, background: 'var(--glass-bg)',
                                                border: '1px solid var(--glass-border)',
                                                borderRadius: '8px', padding: '8px 12px',
                                                color: 'var(--text-secondary)', fontSize: '14px', outline: 'none'
                                            }}
                                        />
                                        <button onClick={createGroup} style={{
                                            padding: '8px 16px', borderRadius: '8px',
                                            background: '#FFD700', border: 'none',
                                            color: '#000', fontSize: '13px', fontWeight: 600,
                                            cursor: 'pointer', whiteSpace: 'nowrap'
                                        }}>
                                            {t('common.confirm')}
                                        </button>
                                        <button onClick={() => { setShowNewGroup(false); setNewGroupCategory(''); setNewGroupWords(''); }} style={{
                                            padding: '8px', borderRadius: '8px',
                                            background: 'var(--glass-bg-light)', border: 'none',
                                            color: 'var(--text-secondary)', cursor: 'pointer'
                                        }}>
                                            <X size={16} />
                                        </button>
                                    </div>
                                    <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                                        {t('synonym.words_hint')}
                                    </div>
                                </div>
                            )}

                            {/* Group cards */}
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                {filteredGroups.map(group => {
                                    const catColor = getCategoryColor(group.category);
                                    const isEditing = editingGroupId === group.id;
                                    return (
                                        <div key={group.id} style={{
                                            background: 'rgba(255,255,255,0.02)',
                                            border: '1px solid var(--glass-border)',
                                            borderRadius: '10px', padding: '12px 16px',
                                            transition: 'all 0.15s',
                                            borderColor: isEditing ? `${catColor}40` : undefined
                                        }}
                                            onMouseEnter={e => { if (!isEditing) e.currentTarget.style.borderColor = 'rgba(255,255,255,0.12)'; }}
                                            onMouseLeave={e => { if (!isEditing) e.currentTarget.style.borderColor = 'var(--glass-bg-light)'; }}
                                        >
                                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
                                                {/* Category badge + words */}
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 1, flexWrap: 'wrap' }}>
                                                    <span style={{
                                                        display: 'inline-flex', alignItems: 'center', gap: '5px',
                                                        background: `${catColor}15`, border: `1px solid ${catColor}30`,
                                                        borderRadius: '6px', padding: '3px 10px',
                                                        color: catColor, fontSize: '12px', fontWeight: 600,
                                                        whiteSpace: 'nowrap'
                                                    }}>
                                                        <Tag size={11} />
                                                        {group.category}
                                                    </span>

                                                    {/* Word chips */}
                                                    {group.words.map(word => (
                                                        <span key={word} style={{
                                                            display: 'inline-flex', alignItems: 'center', gap: '4px',
                                                            background: 'var(--glass-bg-light)',
                                                            border: '1px solid var(--glass-border)',
                                                            borderRadius: '6px', padding: '3px 8px',
                                                            fontSize: '13px', color: 'var(--text-secondary)',
                                                            transition: 'all 0.15s'
                                                        }}
                                                            onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(239,68,68,0.4)'; }}
                                                            onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--glass-bg-hover)'; }}
                                                        >
                                                            {word}
                                                            {isEditing && (
                                                                <X size={12} color="#ef4444" style={{ cursor: 'pointer', marginLeft: '2px' }}
                                                                    onClick={() => removeWord(group.id, word)} />
                                                            )}
                                                        </span>
                                                    ))}

                                                    {/* Inline add word */}
                                                    {isEditing && (
                                                        <input
                                                            ref={newWordRef}
                                                            value={newWordInput}
                                                            onChange={e => setNewWordInput(e.target.value)}
                                                            onKeyDown={e => { if (e.key === 'Enter') addWord(group.id); if (e.key === 'Escape') { setEditingGroupId(null); setNewWordInput(''); } }}
                                                            placeholder={t('synonym.add_word')}
                                                            style={{
                                                                background: 'var(--glass-bg-light)',
                                                                border: '1px dashed rgba(255,215,0,0.3)',
                                                                borderRadius: '6px', padding: '3px 8px',
                                                                fontSize: '13px', color: '#FFD700',
                                                                outline: 'none', width: '80px'
                                                            }}
                                                            autoFocus
                                                        />
                                                    )}

                                                    {!isEditing && (
                                                        <button
                                                            onClick={() => { setEditingGroupId(group.id); setNewWordInput(''); }}
                                                            style={{
                                                                display: 'inline-flex', alignItems: 'center',
                                                                background: 'none', border: '1px dashed var(--glass-border)',
                                                                borderRadius: '6px', padding: '3px 8px',
                                                                color: 'var(--text-secondary)', fontSize: '13px', cursor: 'pointer',
                                                                transition: 'all 0.15s'
                                                            }}
                                                            onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(255,215,0,0.3)'; e.currentTarget.style.color = '#FFD700'; }}
                                                            onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--glass-bg-hover)'; e.currentTarget.style.color = '#666'; }}
                                                        >
                                                            <Plus size={12} />
                                                        </button>
                                                    )}
                                                </div>

                                                {/* Actions */}
                                                <div style={{ display: 'flex', gap: '4px', flexShrink: 0 }}>
                                                    {isEditing && (
                                                        <button onClick={() => { setEditingGroupId(null); setNewWordInput(''); }} style={{
                                                            padding: '4px 10px', borderRadius: '6px',
                                                            background: 'rgba(255,215,0,0.1)', border: 'none',
                                                            color: '#FFD700', fontSize: '12px', cursor: 'pointer'
                                                        }}>
                                                            {t('synonym.done')}
                                                        </button>
                                                    )}
                                                    <button
                                                        onClick={() => { if (confirm(t('synonym.confirm_delete', { category: group.category }))) deleteGroup(group.id); }}
                                                        style={{
                                                            padding: '4px 6px', borderRadius: '6px',
                                                            background: 'none', border: 'none',
                                                            color: 'var(--text-secondary)', cursor: 'pointer', transition: 'all 0.15s'
                                                        }}
                                                        onMouseEnter={e => { e.currentTarget.style.color = '#ef4444'; }}
                                                        onMouseLeave={e => { e.currentTarget.style.color = '#555'; }}
                                                    >
                                                        <Trash2 size={14} />
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>

                            {filteredGroups.length === 0 && !loading && (
                                <div style={{
                                    textAlign: 'center', padding: '48px 0',
                                    color: 'var(--text-secondary)', fontSize: '14px'
                                }}>
                                    {searchQuery ? t('synonym.no_match') : t('synonym.empty')}
                                </div>
                            )}
                        </>
                    )}
                </div>
            </div>

            <style>{`
                @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
                @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
            `}</style>
        </div >
    );
};
