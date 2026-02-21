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
    // Cache: key = "lang:level", value = WordEntry[]
    cache: Record<string, WordEntry[]>;

    loading: boolean;
    targetLang: string;
    level: string;

    // Actions
    setTargetLang: (lang: string) => void;
    setLevel: (level: string) => void;
    fetchBatch: (isSilent?: boolean) => Promise<void>;
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
            targetLang: 'en',
            level: 'Advanced',
            cache: {},

            setTargetLang: (lang) => {
                const { cache } = get();
                const newLevel = getInitialLevel(lang); // Reset level on lang switch
                const cacheKey = `${lang}:${newLevel}`;
                const cachedWords = cache[cacheKey];

                if (cachedWords && cachedWords.length > 0) {
                    // Cache Hit: Immediate update without loading state
                    set({ targetLang: lang, level: newLevel, words: cachedWords, currentIndex: 0, loading: false });
                } else {
                    // Cache Miss: Show loading
                    set({ targetLang: lang, level: newLevel, loading: true });
                    get().fetchBatch(false);
                }
            },

            setLevel: (level) => {
                const { cache, targetLang } = get();
                const cacheKey = `${targetLang}:${level}`;
                const cachedWords = cache[cacheKey];

                if (cachedWords && cachedWords.length > 0) {
                    set({ level, words: cachedWords, currentIndex: 0, loading: false });
                } else {
                    set({ level, loading: true });
                    get().fetchBatch(false);
                }
            },

            fetchBatch: async (isSilent = false) => {
                const { targetLang, level } = get();
                if (!isSilent) set({ loading: true });

                try {
                    // Fetch 100 words
                    const safeLevel = level.charAt(0).toUpperCase() + level.slice(1);
                    const res = await fetch(`/api/vocabulary/batch?language=${encodeURIComponent(targetLang)}&level=${encodeURIComponent(safeLevel)}&count=100`);
                    if (res.ok) {
                        const data = await res.json();
                        // Update words and Cache
                        const cacheKey = `${targetLang}:${level}`;
                        set((state) => ({
                            words: data,
                            currentIndex: 0,
                            loading: false,
                            cache: { ...state.cache, [cacheKey]: data }
                        }));
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
            name: 'daily-word-storage-v3', // Version bump to invalidate old empty cache
            partialize: (state) => ({
                targetLang: state.targetLang,
                level: state.level,
                // Persist cache so it survives reloads? users usually like that.
                cache: state.cache
            }),
        }
    )
);
