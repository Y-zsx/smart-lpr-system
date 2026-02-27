import { useCallback, useEffect, useMemo, useState } from 'react';
import { apiClient } from '@/api/client';
import { PlateGroup } from '@/types/plate';

type UsePlateHistoryParams = {
    date?: string;
    /** 日期区间：与 date 二选一，同时存在时优先用区间 */
    startDate?: string;
    endDate?: string;
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
const inFlight = new Map<string, Promise<PlateGroup[]>>();
/** 缓存有效期：此时间内直接用缓存，不请求 */
const CACHE_TTL_MS = 60_000;
/** 过期后仍先展示缓存再后台刷新的最大时长，超过则显示 loading */
const CACHE_STALE_MS = 120_000;

function toRange(params: { date?: string; startDate?: string; endDate?: string }): { start?: number; end?: number } {
    const { date, startDate, endDate } = params;
    if (startDate != null && endDate != null && startDate !== '' && endDate !== '') {
        const start = new Date(startDate).setHours(0, 0, 0, 0);
        const end = new Date(endDate).setHours(23, 59, 59, 999);
        if (!Number.isNaN(start) && !Number.isNaN(end)) return { start, end };
    }
    if (!date) return { start: undefined, end: undefined };
    return {
        start: new Date(date).setHours(0, 0, 0, 0),
        end: new Date(date).setHours(23, 59, 59, 999)
    };
}

export function usePlateHistory(params: UsePlateHistoryParams) {
    const {
        date,
        startDate,
        endDate,
        type,
        groupBy = 'plate',
        autoRefresh = false,
        refreshIntervalMs = 5000
    } = params;
    const [data, setData] = useState<PlateGroup[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const cacheKey = useMemo(
        () => JSON.stringify({ date: date || '', startDate: startDate || '', endDate: endDate || '', type: type || '', groupBy }),
        [date, startDate, endDate, type, groupBy]
    );

    const load = useCallback(async (force = false, signal?: AbortSignal) => {
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
            // 过期但在“可接受陈旧”时间内：先展示缓存，再后台刷新，避免切换回来又转圈
            if (age < CACHE_STALE_MS) {
                setData(cached.data);
                setLoading(false);
                setError(null);
                const { start, end } = toRange({ date, startDate, endDate });
                apiClient.getHistory(start, end, type, groupBy)
                    .then((groups) => {
                        const normalized = (Array.isArray(groups) ? groups : []) as PlateGroup[];
                        setData(normalized);
                        cache.set(cacheKey, { ts: Date.now(), data: normalized });
                    })
                    .catch(() => { /* 保留旧数据 */ });
                return;
            }
        }
        let promise = inFlight.get(cacheKey);
        if (promise) {
            try {
                const normalized = await promise;
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
            return;
        }
        promise = (async () => {
            const { start, end } = toRange({ date, startDate, endDate });
            const groups = await apiClient.getHistory(start, end, type, groupBy, { signal });
            return (Array.isArray(groups) ? groups : []) as PlateGroup[];
        })();
        inFlight.set(cacheKey, promise);
        try {
            const normalized = await promise;
            setData(normalized);
            setError(null);
            cache.set(cacheKey, { ts: Date.now(), data: normalized });
        } catch (err) {
            if (!(err instanceof DOMException && err.name === 'AbortError')) {
                setError(err instanceof Error ? err.message : '加载失败');
            }
        } finally {
            inFlight.delete(cacheKey);
            setLoading(false);
        }
    }, [cacheKey, date, startDate, endDate, groupBy, type]);

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
