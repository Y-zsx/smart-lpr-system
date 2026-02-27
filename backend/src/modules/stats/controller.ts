import { NextFunction, Response } from 'express';
import { getPlateGroups } from '../../utils/db';
import { DashboardStats } from '../../types';
import { AuthenticatedRequest } from '../auth';
import { filterPlateGroupsByScope } from '../../utils/dataScope';
import { AppError } from '../../utils/AppError';

const parseNum = (v: unknown): number | undefined => {
    if (v == null) return undefined;
    const n = typeof v === 'number' ? v : Number(String(Array.isArray(v) ? v[0] : v));
    return Number.isFinite(n) ? n : undefined;
};

const calculateTrend = (current: number, previous: number): { value: string; direction: 'up' | 'down' | 'neutral' } => {
    if (previous === 0) {
        if (current === 0) return { value: '0%', direction: 'neutral' };
        return { value: '+100%', direction: 'up' };
    }
    const change = ((current - previous) / previous) * 100;
    const rounded = Math.round(change);
    if (rounded > 0) return { value: `+${rounded}%`, direction: 'up' };
    if (rounded < 0) return { value: `${rounded}%`, direction: 'down' };
    return { value: '0%', direction: 'neutral' };
};

export const getDashboardStats = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
        const { date, start: startQ, end: endQ } = req.query;
        let selectedGroups;
        let total, blue, green, yellow, other;
        let trends;

        const rangeStart = parseNum(startQ);
        const rangeEnd = parseNum(endQ);
        const useRange = rangeStart != null && rangeEnd != null && rangeStart <= rangeEnd;

        if (useRange) {
            selectedGroups = await getPlateGroups({ start: rangeStart, end: rangeEnd });
            selectedGroups = filterPlateGroupsByScope(selectedGroups, req.dataScope);
            total = selectedGroups.length;
            blue = selectedGroups.filter(g => g.plateType === 'blue').length;
            green = selectedGroups.filter(g => g.plateType === 'green').length;
            yellow = selectedGroups.filter(g => g.plateType === 'yellow').length;
            other = total - blue - green - yellow;
            const periodMs = rangeEnd - rangeStart + 1;
            const prevEnd = rangeStart - 1;
            const prevStart = prevEnd - periodMs + 1;
            let previousGroups = await getPlateGroups({ start: prevStart, end: prevEnd });
            previousGroups = filterPlateGroupsByScope(previousGroups, req.dataScope);
            const prevTotal = previousGroups.length;
            const prevBlue = previousGroups.filter(g => g.plateType === 'blue').length;
            const prevGreen = previousGroups.filter(g => g.plateType === 'green').length;
            const prevYellow = previousGroups.filter(g => g.plateType === 'yellow').length;
            const prevOther = prevTotal - prevBlue - prevGreen - prevYellow;
            trends = {
                total: calculateTrend(total, prevTotal),
                blue: calculateTrend(blue, prevBlue),
                green: calculateTrend(green, prevGreen),
                other: calculateTrend(other + yellow, prevOther + prevYellow)
            };
        } else if (date) {
            let dateTimestamp: number;
            if (typeof date === 'string') {
                dateTimestamp = Number(date);
            } else if (typeof date === 'number') {
                dateTimestamp = date;
            } else if (Array.isArray(date) && date.length > 0) {
                dateTimestamp = Number(String(date[0]));
            } else {
                dateTimestamp = Number(String(date));
            }

            const selectedDate = new Date(dateTimestamp);
            if (isNaN(selectedDate.getTime()) || isNaN(dateTimestamp)) {
                return res.status(400).json({ message: 'Invalid date parameter' });
            }

            const selectedStart = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), selectedDate.getDate(), 0, 0, 0, 0);
            const selectedEnd = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), selectedDate.getDate(), 23, 59, 59, 999);

            selectedGroups = await getPlateGroups({
                start: selectedStart.getTime(),
                end: selectedEnd.getTime()
            });
            selectedGroups = filterPlateGroupsByScope(selectedGroups, req.dataScope);

            total = selectedGroups.length;
            blue = selectedGroups.filter(g => g.plateType === 'blue').length;
            green = selectedGroups.filter(g => g.plateType === 'green').length;
            yellow = selectedGroups.filter(g => g.plateType === 'yellow').length;
            other = total - blue - green - yellow;

            const previousDayStart = new Date(selectedStart);
            previousDayStart.setDate(previousDayStart.getDate() - 1);
            const previousDayEnd = new Date(selectedEnd);
            previousDayEnd.setDate(previousDayEnd.getDate() - 1);

            let previousDayGroups = await getPlateGroups({
                start: previousDayStart.getTime(),
                end: previousDayEnd.getTime()
            });
            previousDayGroups = filterPlateGroupsByScope(previousDayGroups, req.dataScope);
            const previousDayTotal = previousDayGroups.length;
            const previousDayBlue = previousDayGroups.filter(g => g.plateType === 'blue').length;
            const previousDayGreen = previousDayGroups.filter(g => g.plateType === 'green').length;
            const previousDayYellow = previousDayGroups.filter(g => g.plateType === 'yellow').length;
            const previousDayOther = previousDayTotal - previousDayBlue - previousDayGreen - previousDayYellow;

            trends = {
                total: calculateTrend(total, previousDayTotal),
                blue: calculateTrend(blue, previousDayBlue),
                green: calculateTrend(green, previousDayGreen),
                other: calculateTrend(other + yellow, previousDayOther + previousDayYellow)
            };
        } else {
            selectedGroups = await getPlateGroups();
            selectedGroups = filterPlateGroupsByScope(selectedGroups, req.dataScope);
            total = selectedGroups.length;
            blue = selectedGroups.filter(g => g.plateType === 'blue').length;
            green = selectedGroups.filter(g => g.plateType === 'green').length;
            yellow = selectedGroups.filter(g => g.plateType === 'yellow').length;
            other = total - blue - green - yellow;
            trends = {
                total: { value: '--', direction: 'neutral' as const },
                blue: { value: '--', direction: 'neutral' as const },
                green: { value: '--', direction: 'neutral' as const },
                other: { value: '--', direction: 'neutral' as const }
            };
        }

        const stats: DashboardStats = {
            total,
            blue,
            green,
            yellow,
            other,
            trends: trends || {
                total: { value: '--', direction: 'neutral' as const },
                blue: { value: '--', direction: 'neutral' as const },
                green: { value: '--', direction: 'neutral' as const },
                other: { value: '--', direction: 'neutral' as const }
            }
        };
        res.json(stats);
    } catch (error) {
        console.error('Error fetching dashboard stats:', error);
        next(new AppError('Error fetching dashboard stats', 500, 'DASHBOARD_STATS_FAILED'));
    }
};

export const getDailyStats = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
        const { end } = req.query;
        const endDate = end ? new Date(Number(end)) : new Date();
        const statsMap = new Map<string, number>();

        for (let i = 6; i >= 0; i--) {
            const d = new Date(endDate);
            d.setDate(d.getDate() - i);
            const dateStr = d.toISOString().split('T')[0];
            statsMap.set(dateStr, 0);
            const dayStart = new Date(d);
            dayStart.setHours(0, 0, 0, 0);
            const dayEnd = new Date(d);
            dayEnd.setHours(23, 59, 59, 999);
            try {
                let dayGroups = await getPlateGroups({
                    start: dayStart.getTime(),
                    end: dayEnd.getTime()
                });
                dayGroups = filterPlateGroupsByScope(dayGroups, req.dataScope);
                statsMap.set(dateStr, dayGroups.length);
            } catch (error) {
                console.warn(`获取 ${dateStr} 的数据失败:`, error);
            }
        }

        const result = Array.from(statsMap.entries()).map(([date, count]) => ({ date, count }));
        res.json(result);
    } catch (error) {
        console.error('Error fetching daily stats:', error);
        next(new AppError('Error fetching daily stats', 500, 'DAILY_STATS_FAILED'));
    }
};

export const getRegionStats = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
        const { range, date } = req.query;
        let groups;
        if (range === 'daily' && date) {
            const startOfDay = new Date(Number(date));
            startOfDay.setHours(0, 0, 0, 0);
            const endOfDay = new Date(Number(date));
            endOfDay.setHours(23, 59, 59, 999);
            groups = await getPlateGroups({
                start: startOfDay.getTime(),
                end: endOfDay.getTime()
            });
            groups = filterPlateGroupsByScope(groups, req.dataScope);
        } else {
            groups = await getPlateGroups();
            groups = filterPlateGroupsByScope(groups, req.dataScope);
        }

        const provinceMap = new Map<string, number>();
        groups.forEach(group => {
            if (group.plateNumber && group.plateNumber.length > 0) {
                const firstChar = group.plateNumber.charAt(0);
                const province = firstChar === '·' && group.plateNumber.length > 1
                    ? group.plateNumber.charAt(1)
                    : firstChar;
                if (province && /[\u4e00-\u9fa5]/.test(province)) {
                    const count = provinceMap.get(province) || 0;
                    provinceMap.set(province, count + 1);
                }
            }
        });

        const stats = Array.from(provinceMap.entries()).map(([province, count]) => ({ province, count }));
        res.json(stats);
    } catch (error) {
        console.error('Error fetching region stats:', error);
        next(new AppError('Error fetching region stats', 500, 'REGION_STATS_FAILED'));
    }
};
