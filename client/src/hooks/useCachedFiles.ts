import useSWR, { mutate as globalMutate } from 'swr';
import axios from 'axios';
import { useAuthStore } from '../store/useAuthStore';

interface FileItem {
    name: string;
    isDirectory: boolean;
    path: string;
    size: number;
    mtime: string;
    accessCount?: number;
    uploader?: string;
}

interface FilesResponse {
    items: FileItem[];
    userCanWrite: boolean;
}

interface CacheOptions {
    revalidateOnFocus?: boolean;
    revalidateOnReconnect?: boolean;
    dedupingInterval?: number;
    refreshInterval?: number;
}

const fetcher = async (url: string, token: string): Promise<FilesResponse> => {
    const res = await axios.get(url, {
        headers: { Authorization: `Bearer ${token}` }
    });
    return res.data;
};

/**
 * Cached file listing hook using SWR
 * - Automatically caches directory listings
 * - Deduplicates requests within 10 seconds
 * - Shows stale data while revalidating (instant navigation feel)
 */
export function useCachedFiles(path: string, mode: 'all' | 'recent' | 'starred' | 'personal' = 'all', options: CacheOptions = {}) {
    const { token } = useAuthStore();
    const {
        revalidateOnFocus = false,
        revalidateOnReconnect = true,
        dedupingInterval = 2000,
        refreshInterval = 0     // Disabled auto-refresh (was 5000ms)
    } = options;

    // Build URL based on mode
    const url = mode === 'recent'
        ? '/api/files/recent'
        : mode === 'starred'
            ? '/api/files/starred'
            : `/api/files?path=${encodeURIComponent(path)}`;

    const cacheKey = token ? [url, token] : null;

    const { data, error, isLoading, mutate } = useSWR<FilesResponse>(
        cacheKey,
        ([url, tok]) => fetcher(url, tok as string),
        {
            revalidateOnFocus,
            revalidateOnReconnect,
            dedupingInterval,
            refreshInterval,
            keepPreviousData: true,
            // Smart Polling: Only trigger update if data actually changed
            compare: (a, b) => {
                // Return true if equal (no change) -> no re-render
                // Return false if different -> trigger update
                return JSON.stringify(a) === JSON.stringify(b);
            }
        }
    );

    return {
        files: data?.items || [],
        userCanWrite: data?.userCanWrite || false,
        isLoading,
        isError: !!error,
        error,
        refresh: () => mutate(),
        // Prefetch a subdirectory without blocking
        prefetch: (subPath: string) => {
            if (!token) return;
            const fullPath = path ? `${path}/${subPath}` : subPath;
            const prefetchUrl = `/api/files?path=${encodeURIComponent(fullPath)}`;
            // Warm the cache
            globalMutate([prefetchUrl, token], fetcher(prefetchUrl, token), { revalidate: false });
        }
    };
}

/**
 * Prefetch multiple directories (NOT a hook - can be called anywhere)
 * Call this to pre-warm cache for folders user might click
 */
export function prefetchDirectories(directories: string[], parentPath: string, token: string | null) {
    if (!token || directories.length === 0) return;

    directories.forEach(dir => {
        const fullPath = parentPath ? `${parentPath}/${dir}` : dir;
        const url = `/api/files?path=${encodeURIComponent(fullPath)}`;
        // Pre-warm cache without triggering re-render
        globalMutate([url, token], fetcher(url, token).catch(() => null), { revalidate: false });
    });
}
