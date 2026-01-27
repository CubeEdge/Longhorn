import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface WordEntry {
    id: number;
    word: string;
    phonetic: string;
    meaning: string;
    meaning_zh: string;
    part_of_speech: string;
    examples: any[];
    image?: string;
    level: string;
    language: string;
}

interface DailyWordState {
    words: WordEntry[];
    currentIndex: number;
    loading: boolean;
    targetLang: string;
    level: string;

    // Actions
    setTargetLang: (lang: string) => void;
    setLevel: (level: string) => void;
    fetchBatch: () => Promise<void>;
    nextWord: () => void;
    prevWord: () => void;
}

const getInitialLevel = (lang: string) => {
    switch (lang) {
        case 'de': return 'A1';
        case 'ja': return 'N5';
        case 'zh': return 'Idioms';
        default: return 'Advanced';
    }
};

export const useDailyWordStore = create<DailyWordState>()(
    persist(
        (set, get) => ({
            words: [],
            currentIndex: 0,
            loading: false,
            targetLang: localStorage.getItem('daily_word_target_lang') || 'en',
            level: 'Advanced', // Initial placeholder, will be synced with lang

            setTargetLang: (lang) => {
                const newLevel = getInitialLevel(lang);
                set({ targetLang: lang, level: newLevel });
                // Trigger fetch immediately after language switch
                get().fetchBatch();
            },

            setLevel: (level) => {
                set({ level });
                get().fetchBatch();
            },

            fetchBatch: async () => {
                const { targetLang, level } = get();
                set({ loading: true });
                try {
                    // Fetch 100 words
                    const safeLevel = level.charAt(0).toUpperCase() + level.slice(1);
                    const res = await fetch(`/api/vocabulary/batch?language=${targetLang}&level=${safeLevel}&count=100`);
                    if (res.ok) {
                        const data = await res.json();
                        set({ words: data, currentIndex: 0, loading: false });
                    } else {
                        console.warn('Failed to fetch batch');
                        set({ loading: false });
                    }
                } catch (e) {
                    console.error('Batch fetch error:', e);
                    set({ loading: false });
                }
            },

            nextWord: () => {
                const { currentIndex, words } = get();
                if (words.length === 0) return;
                const nextIndex = (currentIndex + 1) % words.length;
                set({ currentIndex: nextIndex });
            },

            prevWord: () => {
                const { currentIndex, words } = get();
                if (words.length === 0) return;
                const prevIndex = (currentIndex - 1 + words.length) % words.length;
                set({ currentIndex: prevIndex });
            }
        }),
        {
            name: 'daily-word-storage',
            partialize: (state) => ({ targetLang: state.targetLang, level: state.level }), // Only persist config, not the words (freshness)
        }
    )
);
