import { create } from 'zustand';
import { persist } from 'zustand/middleware';

type Theme = 'light' | 'dark' | 'system';

interface ThemeState {
    theme: Theme;
    actualTheme: 'light' | 'dark'; // The resolved theme when 'system' is selected
    setTheme: (theme: Theme) => void;
    initTheme: () => void;
}

// Helper to get system preference
const getSystemTheme = (): 'light' | 'dark' => {
    if (typeof window === 'undefined') return 'dark';
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
};

// Helper to apply theme to HTML element
const applyThemeToDOM = (actualTheme: 'light' | 'dark') => {
    if (typeof document !== 'undefined') {
        document.documentElement.setAttribute('data-theme', actualTheme);
        // document.documentElement.className = actualTheme; // Optional: if using class-based theming like tailwind's darkMode: 'class'
    }
};

export const useThemeStore = create<ThemeState>()(
    persist(
        (set, get) => ({
            theme: 'system', // Default to system
            actualTheme: getSystemTheme(),

            setTheme: (newTheme: Theme) => {
                const actualTheme = newTheme === 'system' ? getSystemTheme() : newTheme;
                applyThemeToDOM(actualTheme);
                set({ theme: newTheme, actualTheme });
            },

            initTheme: () => {
                // This is called once on app load to set up listeners and initial state
                const { theme } = get();
                const actualTheme = theme === 'system' ? getSystemTheme() : theme;
                applyThemeToDOM(actualTheme);
                set({ actualTheme });

                // Listen for system theme changes if we are in 'system' mode
                if (typeof window !== 'undefined') {
                    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');

                    const handleChange = (e: MediaQueryListEvent) => {
                        const currentStore = useThemeStore.getState();
                        if (currentStore.theme === 'system') {
                            const newActualTheme = e.matches ? 'dark' : 'light';
                            applyThemeToDOM(newActualTheme);
                            currentStore.setTheme('system'); // This triggers re-render and state update
                        }
                    };

                    // Use newer addEventListener if available, fallback to addListener
                    if (mediaQuery.addEventListener) {
                        mediaQuery.addEventListener('change', handleChange);
                    } else if (mediaQuery.addListener) {
                        // @ts-ignore - for older browsers
                        mediaQuery.addListener(handleChange);
                    }
                }
            },
        }),
        {
            name: 'kinefinity-theme-storage', // key in localStorage
            // We only want to persist the user's preference ('theme'), not the resolved 'actualTheme'
            // because actualTheme might change based on what time of day they open the app next
            partialize: (state) => ({ theme: state.theme }),
            onRehydrateStorage: () => (state) => {
                // Called after the store is rehydrated from localStorage
                if (state) {
                    // we will call initTheme manually in App.tsx or similar to setup listeners,
                    // but we can also ensure the DOM is correct right away here.
                    const actualTheme = state.theme === 'system' ? getSystemTheme() : state.theme;
                    applyThemeToDOM(actualTheme);
                }
            },
        }
    )
);
