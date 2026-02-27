import { useCallback, useEffect, useMemo, useState } from 'react';
import { apiClient } from '@/api/client';
import type { PlateStats } from '@/types/plate';

type UseDashboardStatsParams = {
    dataMode: 'date' | 'total';
    startDate?: string;
    endDate?: string;
    /** 今日区间时是否定时刷新 */
    autoRefresh?: boolean;
    refreshIntervalMs?: number;
};

type CacheValue = { ts: number; data: PlateStats };

const cache = new Map<string, CacheValue>();
const CACHE_TTL_MS = 60_000;
const CACHE_STALE_MS = 120_000;

function toStats(raw: any): PlateStats {
    return {
        total: Number(raw?.total) ?? 0,
        blue: Number(raw?.blue) ?? 0,
        green: Number(raw?.green) ?? 0,
        yellow: Number(raw?.yellow) ?? 0,
        other: Number(raw?.other) ?? 0,
        trends: raw?.trends
    };
}

export function useDashboardStats(params: UseDashboardStatsParams) {
    const {
        dataMode,
        startDate = '',
        endDate = '',
        autoRefresh = false,
        refreshIntervalMs = 5000
    } = params;

    const cacheKey = useMemo(
        () => JSON.stringify({ dataMode, startDate, endDate }),
        [dataMode, startDate, endDate]
    );

    const [data, setData] = useState<PlateStats | null>(() => cache.get(cacheKey)?.data ?? null);
    const [loading, setLoading] = useState(() => !cache.has(cacheKey));
    const [error, setError] = useState<string | null>(null);

    const load = useCallback(async (force = false) => {
        const now = Date.now();
        const cached = cache.get(cacheKey);

        if (!force && cached) {
            const age = now - cached.ts;
            if (age < CACHE_TTL_MS) {
                setData(cached.data);
                setLoading(false);
                setError(null);
                return;
            }
            if (age < CACHE_STALE_MS) {
                setData(cached.data);
                setLoading(false);
                setError(null);
                let startTs: number | undefined;
                let endTs: number | undefined;
                if (dataMode === 'date' && startDate && endDate) {
                    startTs = new Date(startDate).setHours(0, 0, 0, 0);
                    endTs = new Date(endDate).setHours(23, 59, 59, 999);
                }
                const p = dataMode === 'date' && startTs != null && endTs != null
                    ? apiClient.getDashboardStats(startTs, endTs)
                    : apiClient.getDashboardStats();
                p.then((raw) => {
                    const next = toStats(raw);
                    setData(next);
                    cache.set(cacheKey, { ts: Date.now(), data: next });
                }).catch(() => { /* 保留旧数据 */ });
                return;
            }
        }

        setLoading(true);
        try {
            let startTs: number | undefined;
            let endTs: number | undefined;
            if (dataMode === 'date' && startDate && endDate) {
                startTs = new Date(startDate).setHours(0, 0, 0, 0);
                endTs = new Date(endDate).setHours(23, 59, 59, 999);
            }
            const raw = dataMode === 'date' && startTs != null && endTs != null
                ? await apiClient.getDashboardStats(startTs, endTs)
                : await apiClient.getDashboardStats();
            const next = toStats(raw);
            setData(next);
            setError(null);
            cache.set(cacheKey, { ts: Date.now(), data: next });
        } catch (e) {
            setError(e instanceof Error ? e.message : '加载失败');
        } finally {
            setLoading(false);
        }
    }, [cacheKey, dataMode, startDate, endDate]);

    useEffect(() => {
        const cached = cache.get(cacheKey);
        if (cached) {
            setData(cached.data);
            setLoading(false);
        } else {
            setData(null);
            setLoading(true);
        }
        void load(false);
    }, [load]);

    useEffect(() => {
        if (!autoRefresh) return;
        const t = window.setInterval(() => {
            if (document.hidden) return;
            void load(true);
        }, refreshIntervalMs);
        return () => window.clearInterval(t);
    }, [autoRefresh, load, refreshIntervalMs]);

    return { data, loading, error, refresh: () => load(true) };
}
