import React, { useState, useEffect } from 'react';
import { Volume2, RefreshCw, X, BookOpen, Layers } from 'lucide-react';
import { useLanguage } from '../i18n/useLanguage';
import { getSpeechLang, getAvailableLevels, type WordEntry } from '../data/dailyWords';

// 每日一词徽章 - 显示在TopBar
export const DailyWordBadge: React.FC = () => {
    const { language, t } = useLanguage();
    const [word, setWord] = useState<WordEntry | null>(null);
    const [showModal, setShowModal] = useState(false);
    const [loading, setLoading] = useState(false);

    // 从localStorage读取难度设置，默认为基础等级
    const [level, setLevel] = useState<string>(() => {
        return localStorage.getItem(`daily_word_level_${language}`) ||
            (language === 'de' ? 'A1' : language === 'ja' ? 'N5' : 'advanced');
    });

    const fetchWord = async (lang: string, lvl: string) => {
        setLoading(true);
        try {
            // Mapping for compatibility with legacy level names vs DB
            const safeLevel = lvl.charAt(0).toUpperCase() + lvl.slice(1);
            const res = await fetch(`/api/vocabulary/random?language=${lang}&level=${safeLevel}`);
            if (res.ok) {
                const data = await res.json();
                setWord(data);
            } else {
                console.warn('Failed to fetch daily word');
            }
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    // 监听语言变化，重置Word
    useEffect(() => {
        const savedLevel = localStorage.getItem(`daily_word_level_${language}`);
        const defaultLevel = language === 'de' ? 'A1' : language === 'ja' ? 'N5' : (language === 'en' ? 'advanced' : 'idioms');
        const newLevel = savedLevel || defaultLevel;
        setLevel(newLevel);
        fetchWord(language, newLevel);
    }, [language]);

    // 监听难度变化，获取新词
    useEffect(() => {
        localStorage.setItem(`daily_word_level_${language}`, level);
        fetchWord(language, level);
    }, [level]);

    if (!word && !loading) return null;

    const getLanguageLabel = () => {
        switch (language) {
            case 'de': return '🇩🇪';
            case 'ja': return '🇯🇵';
            case 'en': return '🇺🇸';
            case 'zh': return '📚';
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
                    {word?.word || '...'}
                </span>
                <span style={{ fontSize: '0.7rem' }}>{getLanguageLabel()}</span>
            </div>

            {showModal && word && (
                <DailyWordModal
                    word={word}
                    language={language}
                    currentLevel={level}
                    onClose={() => setShowModal(false)}
                    onRefresh={() => fetchWord(language, level)}
                    onLevelChange={setLevel}
                />
            )}
        </>
    );
};

// 词汇详情弹窗
interface DailyWordModalProps {
    word: WordEntry;
    language: 'zh' | 'en' | 'de' | 'ja';
    currentLevel: string;
    onClose: () => void;
    onRefresh: () => void;
    onLevelChange: (level: string) => void;
}

const DailyWordModal: React.FC<DailyWordModalProps> = ({ word, language, currentLevel, onClose, onRefresh, onLevelChange }) => {
    const { t } = useLanguage();
    const availableLevels = getAvailableLevels(language);

    const speak = () => {
        if ('speechSynthesis' in window) {
            speechSynthesis.cancel();
            const utterance = new SpeechSynthesisUtterance(word.word);
            utterance.lang = getSpeechLang(language);
            utterance.rate = 0.8;
            speechSynthesis.speak(utterance);
        } else {
            console.warn('Speech synthesis not supported');
        }
    };

    return (
        <div
            className="modal-overlay"
            onClick={onClose}
            style={{
                position: 'fixed',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                background: 'rgba(0, 0, 0, 0.7)',
                backdropFilter: 'blur(8px)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                zIndex: 3000
            }}
        >
            <div
                onClick={(e) => e.stopPropagation()}
                style={{
                    background: 'var(--glass-bg)',
                    border: '1px solid var(--glass-border)',
                    borderRadius: '16px',
                    width: '90%',
                    maxWidth: '420px',
                    maxHeight: '85vh',
                    overflow: 'auto',
                    boxShadow: '0 20px 60px rgba(0, 0, 0, 0.5)'
                }}
            >
                {/* Header */}
                <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '16px 20px',
                    borderBottom: '1px solid var(--glass-border)'
                }}>
                    <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        color: 'var(--accent-blue)',
                        fontWeight: 600
                    }}>
                        <BookOpen size={18} />
                        {t('daily_word.title')}
                        <span style={{
                            fontSize: '0.8rem',
                            background: 'rgba(255,255,255,0.1)',
                            padding: '2px 8px',
                            borderRadius: '4px',
                            color: 'var(--text-secondary)'
                        }}>
                            {currentLevel}
                        </span>
                    </div>
                    <button
                        onClick={onClose}
                        style={{
                            background: 'transparent',
                            border: 'none',
                            color: 'var(--text-secondary)',
                            cursor: 'pointer',
                            padding: '4px'
                        }}
                    >
                        <X size={20} />
                    </button>
                </div>

                {/* Content */}
                <div style={{ padding: '24px' }}>
                    {/* Word */}
                    <div style={{ textAlign: 'center', marginBottom: '24px' }}>
                        {word.image && (
                            <div style={{ fontSize: '2.5rem', marginBottom: '12px' }}>
                                {word.image}
                            </div>
                        )}
                        <div style={{
                            fontSize: '1.8rem',
                            fontWeight: 700,
                            color: 'var(--text-main)',
                            marginBottom: '8px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '12px'
                        }}>
                            {word.word}
                            <button
                                onClick={speak}
                                style={{
                                    background: 'rgba(255, 210, 0, 0.15)',
                                    border: 'none',
                                    borderRadius: '50%',
                                    width: '36px',
                                    height: '36px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    cursor: 'pointer',
                                    transition: 'all 0.2s'
                                }}
                                onMouseEnter={(e) => {
                                    e.currentTarget.style.background = 'var(--accent-blue)';
                                }}
                                onMouseLeave={(e) => {
                                    e.currentTarget.style.background = 'rgba(255, 210, 0, 0.15)';
                                }}
                                title={t('daily_word.listen')}
                            >
                                <Volume2 size={18} color="var(--accent-blue)" />
                            </button>
                        </div>
                        {word.phonetic && (
                            <div style={{
                                color: 'var(--text-secondary)',
                                fontSize: '0.95rem',
                                fontStyle: 'italic'
                            }}>
                                {word.phonetic}
                            </div>
                        )}
                        {word.partOfSpeech && (
                            <div style={{
                                color: 'var(--accent-blue)',
                                fontSize: '0.8rem',
                                marginTop: '4px',
                                opacity: 0.8
                            }}>
                                {word.partOfSpeech}
                            </div>
                        )}
                    </div>

                    {/* Meaning */}
                    <div style={{
                        background: 'rgba(255, 255, 255, 0.03)',
                        borderRadius: '12px',
                        padding: '16px',
                        marginBottom: '20px'
                    }}>
                        <div style={{
                            color: 'var(--text-secondary)',
                            fontSize: '0.8rem',
                            marginBottom: '8px',
                            fontWeight: 600
                        }}>
                            📖 {t('daily_word.meaning')}
                        </div>
                        <div style={{ color: 'var(--text-main)', marginBottom: '8px' }}>
                            {word.meaning}
                        </div>
                        <div style={{
                            color: 'var(--accent-blue)',
                            fontSize: '0.9rem',
                            borderTop: '1px solid var(--glass-border)',
                            paddingTop: '8px',
                            marginTop: '8px'
                        }}>
                            中文：{word.meaningZh}
                        </div>
                    </div>

                    {/* Examples */}
                    <div style={{
                        background: 'rgba(255, 255, 255, 0.03)',
                        borderRadius: '12px',
                        padding: '16px'
                    }}>
                        <div style={{
                            color: 'var(--text-secondary)',
                            fontSize: '0.8rem',
                            marginBottom: '12px',
                            fontWeight: 600
                        }}>
                            📚 {t('daily_word.examples')}
                        </div>
                        {word.examples.map((example, index) => (
                            <div key={index} style={{
                                marginBottom: index < word.examples.length - 1 ? '16px' : 0
                            }}>
                                <div style={{
                                    color: 'var(--text-main)',
                                    marginBottom: '4px',
                                    lineHeight: 1.5
                                }}>
                                    • {example.sentence}
                                </div>
                                <div style={{
                                    color: 'var(--text-secondary)',
                                    fontSize: '0.85rem',
                                    paddingLeft: '12px',
                                    lineHeight: 1.4
                                }}>
                                    {example.translation}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Footer Controls */}
                <div style={{
                    padding: '16px 24px',
                    borderTop: '1px solid var(--glass-border)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '16px'
                }}>
                    {/* Level Selector (Only if multiple levels available) */}
                    {availableLevels.length > 1 && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', justifyContent: 'center' }}>
                            <Layers size={16} color="var(--text-secondary)" />
                            <div style={{ display: 'flex', gap: '8px' }}>
                                {availableLevels.map(lvl => (
                                    <button
                                        key={lvl}
                                        onClick={() => onLevelChange(lvl)}
                                        style={{
                                            background: currentLevel === lvl ? 'var(--accent-blue)' : 'rgba(255,255,255,0.05)',
                                            color: currentLevel === lvl ? '#000' : 'var(--text-secondary)',
                                            border: '1px solid',
                                            borderColor: currentLevel === lvl ? 'var(--accent-blue)' : 'rgba(255,255,255,0.1)',
                                            borderRadius: '6px',
                                            padding: '4px 8px',
                                            fontSize: '0.8rem',
                                            cursor: 'pointer',
                                            fontWeight: 600,
                                            transition: 'all 0.2s'
                                        }}
                                    >
                                        {lvl}
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    <button
                        onClick={onRefresh}
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '8px',
                            padding: '10px 24px',
                            background: 'rgba(255, 210, 0, 0.1)',
                            border: '1px solid rgba(255, 210, 0, 0.2)',
                            borderRadius: '8px',
                            color: 'var(--accent-blue)',
                            fontWeight: 600,
                            cursor: 'pointer',
                            transition: 'all 0.2s',
                            width: '100%'
                        }}
                        onMouseEnter={(e) => {
                            e.currentTarget.style.background = 'var(--accent-blue)';
                            e.currentTarget.style.color = '#000';
                        }}
                        onMouseLeave={(e) => {
                            e.currentTarget.style.background = 'rgba(255, 210, 0, 0.1)';
                            e.currentTarget.style.color = 'var(--accent-blue)';
                        }}
                    >
                        <RefreshCw size={16} />
                        {t('daily_word.next')}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default DailyWordBadge;
