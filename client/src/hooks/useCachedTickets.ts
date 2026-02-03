import useSWR, { mutate as globalMutate } from 'swr';
import axios from 'axios';
import { useAuthStore } from '../store/useAuthStore';

interface TicketMeta {
    total: number;
    page: number;
    pageSize: number;
}

interface TicketResponse<T> {
    success: boolean;
    data: T[];
    meta: TicketMeta;
}

interface CacheOptions {
    revalidateOnFocus?: boolean;
    revalidateOnReconnect?: boolean;
    dedupingInterval?: number;
    refreshInterval?: number;
}

type TicketType = 'inquiry' | 'rma' | 'dealer';

const endpoints: Record<TicketType, string> = {
    inquiry: '/api/v1/inquiry-tickets',
    rma: '/api/v1/rma-tickets',
    dealer: '/api/v1/dealer-repairs'
};

const fetcher = async <T>(url: string, token: string): Promise<TicketResponse<T>> => {
    const res = await axios.get(url, {
        headers: { Authorization: `Bearer ${token}` }
    });
    return res.data;
};

/**
 * Cached ticket listing hook using SWR
 * - Automatically caches ticket listings
 * - Deduplicates requests within 2 seconds
 * - Shows stale data while revalidating (instant navigation feel)
 * - Avoids full-screen loading spinner on filter changes
 */
export function useCachedTickets<T = any>(
    ticketType: TicketType,
    params: Record<string, string | number | undefined> = {},
    options: CacheOptions = {}
) {
    const { token } = useAuthStore();
    const {
        revalidateOnFocus = false,
        revalidateOnReconnect = true,
        dedupingInterval = 2000,
        refreshInterval = 0
    } = options;

    // Build URL with query params
    const baseUrl = endpoints[ticketType];
    const searchParams = new URLSearchParams();

    Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== '') {
            searchParams.append(key, String(value));
        }
    });

    const queryString = searchParams.toString();
    const url = queryString ? `${baseUrl}?${queryString}` : baseUrl;
    const cacheKey = token ? [url, token] : null;

    const { data, error, isLoading, isValidating, mutate } = useSWR<TicketResponse<T>>(
        cacheKey,
        ([url, tok]) => fetcher<T>(url, tok as string),
        {
            revalidateOnFocus,
            revalidateOnReconnect,
            dedupingInterval,
            refreshInterval,
            keepPreviousData: true,
            compare: (a, b) => JSON.stringify(a) === JSON.stringify(b)
        }
    );

    return {
        tickets: data?.data || [],
        meta: data?.meta || { total: 0, page: 1, pageSize: 50 },
        isLoading,      // True only on first load (no cached data)
        isValidating,   // True when revalidating in background (has cached data)
        isError: !!error,
        error,
        refresh: () => mutate()
    };
}

/**
 * Prefetch tickets for a specific type (NOT a hook)
 * Call to pre-warm cache before user navigates
 */
export function prefetchTickets<T = any>(
    ticketType: TicketType,
    params: Record<string, string | number | undefined>,
    token: string | null
) {
    if (!token) return;

    const baseUrl = endpoints[ticketType];
    const searchParams = new URLSearchParams();

    Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== '') {
            searchParams.append(key, String(value));
        }
    });

    const queryString = searchParams.toString();
    const url = queryString ? `${baseUrl}?${queryString}` : baseUrl;

    globalMutate([url, token], fetcher<T>(url, token).catch(() => null), { revalidate: false });
}

/**
 * Invalidate all cached ticket data for a specific type
 * Call after creating/updating/deleting a ticket
 */
export function invalidateTicketCache(ticketType: TicketType) {
    const baseUrl = endpoints[ticketType];
    // Invalidate all cache entries that start with this base URL
    globalMutate(
        key => Array.isArray(key) && typeof key[0] === 'string' && key[0].startsWith(baseUrl),
        undefined,
        { revalidate: true }
    );
}
