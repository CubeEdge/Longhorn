import React, { useEffect } from 'react';
import axios from 'axios';
import { Volume2, RefreshCw, X, BookOpen, Layers, ArrowRight, ArrowLeft, MoreVertical, Trash2 } from 'lucide-react';
import { useLanguage } from '../i18n/useLanguage';
import { getSpeechLang, getAvailableLevels } from '../data/dailyWords';
import { useDailyWordStore } from '../store/useDailyWordStore';

// Supported languages for Daily Word
const SUPPORTED_LANGS = ['en', 'de', 'ja', 'zh'];

// 每日一词徽章 - 显示在TopBar，受通用设置控制
export const DailyWordBadge: React.FC = () => {
    const { t } = useLanguage();
    const [showModal, setShowModal] = React.useState(false);
    const [visible, setVisible] = React.useState(false);

    // Fetch visibility from system settings
    React.useEffect(() => {
        const fetchSettings = async () => {
            try {
                const res = await axios.get('/api/v1/system/public-settings');
                if (res.data.success) {
                    setVisible(res.data.data.show_daily_word);
                }
            } catch (e) {
                console.error('[DailyWord] Failed to fetch settings', e);
            }
        };
        fetchSettings();

        // Listen for setting changes
        window.addEventListener('system-settings-updated', fetchSettings);
        return () => window.removeEventListener('system-settings-updated', fetchSettings);
    }, []);

    // Use Store
    const {
        words, currentIndex, loading, targetLang,
        fetchBatch
    } = useDailyWordStore();

    // Initial Fetch if empty
    useEffect(() => {
        if (words.length === 0) {
            fetchBatch();
        }
    }, [words.length, fetchBatch]);

    const currentWord = words[currentIndex] || null;

    // Respect admin settings
    if (!visible) return null;

    const getLanguageLabel = (lang: string) => {
        switch (lang) {
            case 'de': return '🇩🇪';
            case 'ja': return '🇯🇵';
            case 'en': return '🇺🇸';
            case 'zh': return '🇨🇳';
            default: return '📖';
        }
    };

    return (
        <>
            <div
                onClick={() => setShowModal(true)}
                style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '4px 10px',
                    background: 'rgba(255, 210, 0, 0.08)',
                    border: '1px solid rgba(255, 210, 0, 0.15)',
                    borderRadius: '16px',
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                    fontSize: '0.8rem',
                    color: 'var(--text-secondary)',
                    opacity: loading ? 0.7 : 1
                }}
                onMouseEnter={(e) => {
                    e.currentTarget.style.background = 'rgba(255, 210, 0, 0.15)';
                    e.currentTarget.style.color = 'var(--accent-blue)';
                }}
                onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'rgba(255, 210, 0, 0.08)';
                    e.currentTarget.style.color = 'var(--text-secondary)';
                }}
                title={t('daily_word.title')}
            >
                <BookOpen size={14} />
                <span style={{
                    maxWidth: '120px',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    fontWeight: 500
                }}>
                    {currentWord?.word || (loading ? 'Loading...' : t('daily_word.title'))}
                </span>

                {/* Counter Display */}
                {words.length > 0 && (
                    <span style={{ fontSize: '0.7rem', opacity: 0.7, marginLeft: '4px' }}>
                        {currentIndex + 1}/{words.length}
                    </span>
                )}

                <span style={{ fontSize: '0.7rem' }}>{getLanguageLabel(targetLang)}</span>
            </div>

            {showModal && (
                <DailyWordModal
                    onClose={() => setShowModal(false)}
                />
            )}
        </>
    );
};

// 词汇详情弹窗
interface DailyWordModalProps {
    onClose: () => void;
}

const DailyWordModal: React.FC<DailyWordModalProps> = ({ onClose }) => {
    const { t } = useLanguage();
    const {
        words, currentIndex, loading, targetLang, level,
        fetchBatch, setTargetLang, setLevel, nextWord, prevWord
    } = useDailyWordStore();

    const [showMoreMenu, setShowMoreMenu] = React.useState(false);
    const menuRef = React.useRef<HTMLDivElement>(null);

    const safeLang = targetLang as 'en' | 'de' | 'ja' | 'zh';
    const availableLevels = getAvailableLevels(safeLang);
    const word = words[currentIndex] || null;

    // Close menu when clicking outside
    React.useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
                setShowMoreMenu(false);
            }
        };

        if (showMoreMenu) {
            document.addEventListener('mousedown', handleClickOutside);
        }

        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [showMoreMenu]);

    // Guard against empty state or loading error
    if (!word && !loading) {
        return (
            <div className="modal-overlay" onClick={onClose} style={{
                position: 'fixed', inset: 0, background: 'var(--glass-shadow-lg)', backdropFilter: 'blur(8px)', zIndex: 3000, display: 'flex', alignItems: 'center', justifyContent: 'center'
            }}>
                <div onClick={e => e.stopPropagation()} style={{ background: 'var(--bg-sidebar)', padding: '24px', borderRadius: '16px', textAlign: 'center' }}>
                    <p style={{ marginBottom: 16 }}>No words loaded. Try refreshing.</p>
                    <button onClick={() => fetchBatch()} style={{ padding: '8px 16px', background: 'var(--accent-blue)', border: 'none', borderRadius: '8px', cursor: 'pointer' }}>Retry</button>
                    <button onClick={onClose} style={{ padding: '8px 16px', background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', marginLeft: 8 }}>Close</button>
                </div>
            </div>
        )
    }

    const speak = () => {
        if ('speechSynthesis' in window && word) {
            speechSynthesis.cancel();
            const utterance = new SpeechSynthesisUtterance(word.word);
            utterance.lang = getSpeechLang(safeLang);
            utterance.rate = 0.8;
            speechSynthesis.speak(utterance);
        }
    };

    const getLanguageName = (lang: string) => {
        switch (lang) {
            case 'de': return 'Deutsch';
            case 'ja': return '日本語';
            case 'en': return 'English';
            case 'zh': return '中文';
            default: return lang;
        }
    };

    return (
        <div
            className="modal-overlay"
            onClick={onClose}
            style={{
                position: 'fixed', inset: 0, background: 'var(--glass-shadow-lg)', backdropFilter: 'blur(8px)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 3000
            }}
        >
            <div
                onClick={(e) => e.stopPropagation()}
                style={{
                    background: 'var(--glass-bg)', border: '1px solid var(--glass-border)', borderRadius: '16px',
                    width: '90%', maxWidth: '420px', maxHeight: '85vh',
                    display: 'flex', flexDirection: 'column', // Flex layout for sticky footer
                    boxShadow: '0 20px 60px var(--glass-shadow)'
                }}
            >
                {/* Header */}
                <div style={{
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    padding: '16px 20px', borderBottom: '1px solid var(--glass-border)'
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--accent-blue)', fontWeight: 600 }}>
                        <BookOpen size={18} />
                        {t('daily_word.title')}
                        {/* Counter in Modal Header */}
                        {words.length > 0 && (
                            <span style={{ fontSize: '0.75rem', background: 'rgba(255,210,0,0.2)', padding: '2px 6px', borderRadius: '4px', color: 'var(--accent-blue)', fontWeight: 500 }}>
                                {currentIndex + 1} / {words.length}
                            </span>
                        )}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        {/* More Menu */}
                        <div style={{ position: 'relative' }} ref={menuRef}>
                            <button
                                onClick={() => setShowMoreMenu(!showMoreMenu)}
                                style={{
                                    background: 'var(--glass-bg-light)',
                                    border: 'none',
                                    borderRadius: '50%',
                                    width: '32px',
                                    height: '32px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    color: 'var(--text-secondary)',
                                    cursor: 'pointer',
                                    transition: 'all 0.2s'
                                }}
                                onMouseEnter={(e) => e.currentTarget.style.background = 'var(--glass-bg-hover)'}
                                onMouseLeave={(e) => e.currentTarget.style.background = 'var(--glass-bg-light)'}
                            >
                                <MoreVertical size={18} />
                            </button>

                            {/* Dropdown Menu */}
                            {showMoreMenu && (
                                <div style={{
                                    position: 'absolute',
                                    top: '40px',
                                    right: 0,
                                    background: '#2c2c2e',
                                    border: '1px solid var(--glass-border)',
                                    borderRadius: '12px',
                                    minWidth: '180px',
                                    boxShadow: '0 8px 24px var(--glass-shadow)',
                                    zIndex: 1000,
                                    overflow: 'hidden'
                                }}>
                                    {/* Level Selection */}
                                    {availableLevels.length > 1 && (
                                        <>
                                            <div style={{ padding: '8px 12px', fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 600, textTransform: 'uppercase' }}>
                                                <Layers size={12} style={{ display: 'inline', marginRight: '4px' }} />
                                                Level
                                            </div>
                                            {availableLevels.map(lvl => (
                                                <button
                                                    key={lvl}
                                                    onClick={() => {
                                                        setLevel(lvl);
                                                        setShowMoreMenu(false);
                                                    }}
                                                    style={{
                                                        width: '100%',
                                                        padding: '10px 16px',
                                                        background: level === lvl ? 'rgba(255, 210, 0, 0.1)' : 'transparent',
                                                        border: 'none',
                                                        textAlign: 'left',
                                                        color: level === lvl ? 'var(--accent-blue)' : 'var(--text-main)',
                                                        cursor: 'pointer',
                                                        fontSize: '0.9rem',
                                                        fontWeight: level === lvl ? 600 : 400,
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        justifyContent: 'space-between',
                                                        transition: 'all 0.2s'
                                                    }}
                                                    onMouseEnter={(e) => e.currentTarget.style.background = 'var(--glass-bg-light)'}
                                                    onMouseLeave={(e) => e.currentTarget.style.background = level === lvl ? 'rgba(255, 210, 0, 0.1)' : 'transparent'}
                                                >
                                                    {lvl}
                                                    {level === lvl && <span style={{ fontSize: '0.8rem' }}>✓</span>}
                                                </button>
                                            ))}
                                            <div style={{ height: '1px', background: 'var(--glass-bg-hover)', margin: '4px 0' }} />
                                        </>
                                    )}

                                    {/* New Batch */}
                                    <button
                                        onClick={() => {
                                            fetchBatch();
                                            setShowMoreMenu(false);
                                        }}
                                        style={{
                                            width: '100%',
                                            padding: '10px 16px',
                                            background: 'transparent',
                                            border: 'none',
                                            textAlign: 'left',
                                            color: 'var(--accent-blue)',
                                            cursor: 'pointer',
                                            fontSize: '0.9rem',
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '8px',
                                            transition: 'all 0.2s'
                                        }}
                                        onMouseEnter={(e) => e.currentTarget.style.background = 'var(--glass-bg-light)'}
                                        onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                                    >
                                        <RefreshCw size={14} />
                                        New Batch
                                    </button>

                                    <button
                                        onClick={() => {
                                            if (confirm('Clear all vocabulary cache?')) {
                                                useDailyWordStore.persist.clearStorage();
                                                window.location.reload();
                                            }
                                        }}
                                        style={{
                                            width: '100%',
                                            padding: '10px 16px',
                                            background: 'transparent',
                                            border: 'none',
                                            textAlign: 'left',
                                            color: '#ff9f0a',
                                            fontSize: '0.9rem',
                                            cursor: 'pointer',
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '8px',
                                            transition: 'background 0.2s'
                                        }}
                                        onMouseEnter={(e) => e.currentTarget.style.background = 'var(--glass-bg-light)'}
                                        onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                                    >
                                        <Trash2 size={14} />
                                        Reset Cache
                                    </button>

                                    <div style={{ height: '1px', background: 'var(--glass-bg-hover)', margin: '4px 0' }} />

                                    {/* Close */}
                                    <button
                                        onClick={() => {
                                            setShowMoreMenu(false);
                                            onClose();
                                        }}
                                        style={{
                                            width: '100%',
                                            padding: '10px 16px',
                                            background: 'transparent',
                                            border: 'none',
                                            textAlign: 'left',
                                            color: '#ff453a',
                                            cursor: 'pointer',
                                            fontSize: '0.9rem',
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '8px',
                                            transition: 'all 0.2s'
                                        }}
                                        onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255, 69, 58, 0.1)'}
                                        onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                                    >
                                        <X size={14} />
                                        Close
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Content */}
                <div style={{ padding: '24px', flex: 1, overflowY: 'auto' }}>
                    {/* Language Selector */}
                    <div style={{ background: 'rgba(0, 0, 0, 0.2)', padding: '4px', borderRadius: '8px', display: 'flex', position: 'relative', marginBottom: '24px' }}>
                        {SUPPORTED_LANGS.map(lang => {
                            const isSelected = targetLang === lang;
                            return (
                                <button
                                    key={lang}
                                    onClick={() => setTargetLang(lang)}
                                    style={{
                                        flex: 1, position: 'relative', zIndex: 1,
                                        background: isSelected ? 'var(--accent-button-bg, #FFD60A)' : 'transparent',
                                        color: isSelected ? '#000' : 'rgba(255, 255, 255, 0.6)',
                                        border: 'none', borderRadius: '6px', padding: '6px 0', fontSize: '0.9rem', fontWeight: 500, cursor: 'pointer',
                                        transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                                        boxShadow: isSelected ? '0 2px 8px rgba(0,0,0,0.2)' : 'none'
                                    }}
                                >
                                    {getLanguageName(lang)}
                                </button>
                            );
                        })}
                    </div>

                    {loading ? (
                        <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-secondary)' }}>
                            <RefreshCw className="spin" size={32} style={{ marginBottom: 16 }} />
                            <p>Fetching {level} words...</p>
                        </div>
                    ) : word ? (
                        <>
                            {/* Word */}
                            <div style={{ textAlign: 'center', marginBottom: '24px' }}>
                                {word.image && (
                                    <div style={{ fontSize: '2.5rem', marginBottom: '12px' }}>
                                        {word.image}
                                    </div>
                                )}
                                <div style={{ fontSize: '1.8rem', fontWeight: 700, color: 'var(--text-main)', marginBottom: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '12px' }}>
                                    {word.word.replace(/\s*\(\d+\)$/, '').replace(/\s*\[.*?\]$/, '')}
                                    <button onClick={speak} style={{ background: 'rgba(255, 210, 0, 0.15)', border: 'none', borderRadius: '50%', width: '36px', height: '36px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', transition: 'all 0.2s' }} title={t('daily_word.listen')}>
                                        <Volume2 size={18} color="var(--accent-blue)" />
                                    </button>
                                </div>
                                {word.phonetic && <div style={{ color: 'var(--text-secondary)', fontSize: '0.95rem', fontStyle: 'italic' }}>{word.phonetic}</div>}
                                {word.part_of_speech && <div style={{ color: 'var(--accent-blue)', fontSize: '0.8rem', marginTop: '4px', opacity: 0.8 }}>{word.part_of_speech}</div>}
                            </div>

                            {/* Meaning */}
                            <div style={{ background: 'var(--glass-bg-light)', borderRadius: '12px', padding: '16px', marginBottom: '20px' }}>
                                <div style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', marginBottom: '8px', fontWeight: 600 }}>📖 {t('daily_word.meaning')}</div>
                                <div style={{ color: 'var(--text-main)', marginBottom: '8px' }}>{word.meaning}</div>
                                <div style={{ color: 'var(--accent-blue)', fontSize: '0.9rem', borderTop: '1px solid var(--glass-border)', paddingTop: '8px', marginTop: '8px' }}>中文：{word.meaning_zh}</div>
                            </div>

                            {/* Examples */}
                            {word.examples && word.examples.length > 0 && (
                                <div style={{ background: 'var(--glass-bg-light)', borderRadius: '12px', padding: '16px' }}>
                                    <div style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', marginBottom: '12px', fontWeight: 600 }}>📚 {t('daily_word.examples')}</div>
                                    {word.examples.slice(0, 2).map((example: any, index: number) => (
                                        <div key={index} style={{ marginBottom: index < word.examples.length - 1 ? '16px' : 0 }}>
                                            <div style={{ color: 'var(--text-main)', marginBottom: '4px', lineHeight: 1.5 }}>• {example.sentence}</div>
                                            <div style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', paddingLeft: '12px', lineHeight: 1.4 }}>{example.translation}</div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </>
                    ) : null}
                </div>

                {/* Footer Controls */}
                <div style={{ padding: '16px 24px 32px 24px', borderTop: '1px solid var(--glass-border)', display: 'flex', gap: '12px', flexShrink: 0 }}>
                    {/* Navigation Actions */}
                    <button
                        onClick={prevWord}
                        style={{
                            flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                            padding: '10px', background: 'var(--glass-bg-light)', border: 'none', borderRadius: '8px',
                            color: 'var(--text-main)', fontWeight: 600, cursor: 'pointer'
                        }}
                    >
                        <ArrowLeft size={16} /> Prev
                    </button>

                    <button
                        onClick={nextWord}
                        style={{
                            flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                            padding: '10px', background: 'var(--accent-blue)', border: 'none', borderRadius: '8px',
                            color: '#000', fontWeight: 600, cursor: 'pointer'
                        }}
                    >
                        Next <ArrowRight size={16} />
                    </button>
                </div>
            </div>
        </div>
    );
};

export default DailyWordBadge;
