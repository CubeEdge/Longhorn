import useSWR from 'swr';
import axios from 'axios';
import { useAuthStore } from '../store/useAuthStore';

interface FileItem {
    name: string;
    isDirectory: boolean;
    size?: number;
    modified?: string;
    uploader?: string;
    accessCount?: number;
}

interface CacheOptions {
    revalidateOnFocus?: boolean;
    revalidateOnReconnect?: boolean;
    dedupingInterval?: number;
}

const fetcher = async (url: string, token: string) => {
    const res = await axios.get(url, {
        headers: { Authorization: `Bearer ${token}` }
    });
    return res.data;
};

/**
 * Cached file listing hook using SWR
 * - Automatically caches directory listings
 * - Deduplicates requests within 5 seconds
 * - Revalidates on window focus (optional)
 */
export function useCachedFiles(path: string, options: CacheOptions = {}) {
    const { token } = useAuthStore();
    const {
        revalidateOnFocus = false,
        revalidateOnReconnect = false,
        dedupingInterval = 5000
    } = options;

    const { data, error, isLoading, mutate } = useSWR<FileItem[]>(
        token ? [`/api/files?path=${encodeURIComponent(path)}`, token] : null,
        ([url, tok]) => fetcher(url, tok as string),
        {
            revalidateOnFocus,
            revalidateOnReconnect,
            dedupingInterval,
            keepPreviousData: true, // Show stale data while revalidating
        }
    );

    return {
        files: data || [],
        isLoading,
        isError: !!error,
        error,
        refresh: () => mutate(),
        prefetch: (subPath: string) => {
            // Prefetch a subdirectory without blocking
            const fullPath = path ? `${path}/${subPath}` : subPath;
            fetcher(`/api/files?path=${encodeURIComponent(fullPath)}`, token!).catch(() => { });
        }
    };
}

/**
 * Prefetch multiple directories (e.g., subdirectories)
 */
export function prefetchDirectories(paths: string[], token: string) {
    paths.forEach(p => {
        fetcher(`/api/files?path=${encodeURIComponent(p)}`, token).catch(() => { });
    });
}
