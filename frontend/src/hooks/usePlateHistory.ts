import { useCallback, useEffect, useMemo, useState } from 'react';
import { apiClient } from '@/api/client';
import { PlateGroup } from '@/types/plate';

type UsePlateHistoryParams = {
    date?: string;
    type?: string;
    groupBy?: 'plate';
    autoRefresh?: boolean;
    refreshIntervalMs?: number;
};

type HistoryCacheValue = {
    ts: number;
    data: PlateGroup[];
};

const cache = new Map<string, HistoryCacheValue>();
const CACHE_TTL_MS = 4000;

function toRange(date?: string): { start?: number; end?: number } {
    if (!date) return { start: undefined, end: undefined };
    return {
        start: new Date(date).setHours(0, 0, 0, 0),
        end: new Date(date).setHours(23, 59, 59, 999)
    };
}

export function usePlateHistory(params: UsePlateHistoryParams) {
    const {
        date,
        type,
        groupBy = 'plate',
        autoRefresh = false,
        refreshIntervalMs = 5000
    } = params;
    const [data, setData] = useState<PlateGroup[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const cacheKey = useMemo(() => JSON.stringify({ date: date || '', type: type || '', groupBy }), [date, type, groupBy]);

    const load = useCallback(async (force = false, signal?: AbortSignal) => {
        const now = Date.now();
        const cached = cache.get(cacheKey);
        if (!force && cached && now - cached.ts < CACHE_TTL_MS) {
            setData(cached.data);
            setLoading(false);
            setError(null);
            return;
        }
        try {
            const { start, end } = toRange(date);
            const groups = await apiClient.getHistory(start, end, type, groupBy, { signal });
            const normalized = (Array.isArray(groups) ? groups : []) as PlateGroup[];
            setData(normalized);
            setError(null);
            cache.set(cacheKey, { ts: Date.now(), data: normalized });
        } catch (err) {
            if (!(err instanceof DOMException && err.name === 'AbortError')) {
                setError(err instanceof Error ? err.message : '加载失败');
            }
        } finally {
            setLoading(false);
        }
    }, [cacheKey, date, groupBy, type]);

    useEffect(() => {
        setLoading(true);
        const controller = new AbortController();
        void load(false, controller.signal);
        return () => controller.abort();
    }, [load]);

    useEffect(() => {
        if (!autoRefresh) return;
        const run = () => {
            if (document.hidden) return;
            void load(true);
        };
        const timer = window.setInterval(run, refreshIntervalMs);
        return () => window.clearInterval(timer);
    }, [autoRefresh, load, refreshIntervalMs]);

    return { data, loading, error, refresh: () => load(true) };
}
