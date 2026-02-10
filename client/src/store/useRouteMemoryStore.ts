import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface RouteMemoryState {
    memory: Record<string, string>; // key: module path prefix (e.g., '/service/inquiry-tickets'), value: full path with query
    saveRoute: (path: string) => void;
    getRoute: (defaultPath: string) => string;
}

const MEMORIZED_PATHS = [
    '/service/inquiry-tickets',
    '/service/rma-tickets',
    '/service/dealer-repairs',
    '/service/customers'
];

export const useRouteMemoryStore = create<RouteMemoryState>()(
    persist(
        (set, get) => ({
            memory: {},
            saveRoute: (path: string) => {
                const matchedPrefix = MEMORIZED_PATHS.find(prefix => path.startsWith(prefix));
                if (matchedPrefix) {
                    set((state) => ({
                        memory: { ...state.memory, [matchedPrefix]: path }
                    }));
                }
            },
            getRoute: (defaultPath: string) => {
                const matchedPrefix = MEMORIZED_PATHS.find(prefix => defaultPath.startsWith(prefix));
                if (matchedPrefix) {
                    return get().memory[matchedPrefix] || defaultPath;
                }
                return defaultPath;
            }
        }),
        {
            name: 'route-memory-storage',
        }
    )
);
