import { Request, Response } from 'express';
import { getPlates, getPlateGroups } from '../utils/db';
import { DashboardStats } from '../types';

export const getDashboardStats = async (req: Request, res: Response) => {
    try {
        // 获取日期参数，如果未提供则使用今天
        const { date } = req.query;
        const selectedDate = date ? new Date(Number(date)) : new Date();
        
        // 计算所选日期的开始和结束时间
        const selectedStart = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), selectedDate.getDate(), 0, 0, 0, 0);
        const selectedEnd = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), selectedDate.getDate(), 23, 59, 59, 999);
        
        // 获取所选日期的数据（不重复车牌）
        const selectedGroups = await getPlateGroups({
            start: selectedStart.getTime(),
            end: selectedEnd.getTime()
        });
        
        // 计算所选日期的统计数据（不重复的车牌数）
        const total = selectedGroups.length;
        const blue = selectedGroups.filter(g => g.plateType === 'blue').length;
        const green = selectedGroups.filter(g => g.plateType === 'green').length;
        const yellow = selectedGroups.filter(g => g.plateType === 'yellow').length;
        const other = total - blue - green - yellow;

        // 计算趋势：比较所选日期和前一天的数据
        const previousDayStart = new Date(selectedStart);
        previousDayStart.setDate(previousDayStart.getDate() - 1);
        const previousDayEnd = new Date(selectedEnd);
        previousDayEnd.setDate(previousDayEnd.getDate() - 1);

        // 获取所选日期的数据（不重复车牌）
        const selectedDayTotal = total;
        const selectedDayBlue = blue;
        const selectedDayGreen = green;
        const selectedDayYellow = yellow;
        const selectedDayOther = other;

        // 获取前一天的数据（不重复车牌）
        const previousDayGroups = await getPlateGroups({
            start: previousDayStart.getTime(),
            end: previousDayEnd.getTime()
        });
        const previousDayTotal = previousDayGroups.length;
        const previousDayBlue = previousDayGroups.filter(g => g.plateType === 'blue').length;
        const previousDayGreen = previousDayGroups.filter(g => g.plateType === 'green').length;
        const previousDayYellow = previousDayGroups.filter(g => g.plateType === 'yellow').length;
        const previousDayOther = previousDayTotal - previousDayBlue - previousDayGreen - previousDayYellow;

        // 计算趋势百分比
        const calculateTrend = (current: number, previous: number): { value: string, direction: "up" | "down" | "neutral" } => {
            if (previous === 0) {
                if (current === 0) {
                    return { value: "0%", direction: "neutral" };
                } else {
                    return { value: "+100%", direction: "up" };
                }
            }
            const change = ((current - previous) / previous) * 100;
            const rounded = Math.round(change);
            if (rounded > 0) {
                return { value: `+${rounded}%`, direction: "up" };
            } else if (rounded < 0) {
                return { value: `${rounded}%`, direction: "down" };
            } else {
                return { value: "0%", direction: "neutral" };
            }
        };

        const stats: DashboardStats = {
            total,
            blue,
            green,
            yellow,
            other,
            trends: {
                total: calculateTrend(selectedDayTotal, previousDayTotal),
                blue: calculateTrend(selectedDayBlue, previousDayBlue),
                green: calculateTrend(selectedDayGreen, previousDayGreen),
                other: calculateTrend(selectedDayOther + selectedDayYellow, previousDayOther + previousDayYellow)
            }
        };

        res.json(stats);
    } catch (error) {
        console.error('Error fetching dashboard stats:', error);
        res.status(500).json({ message: 'Error fetching dashboard stats' });
    }
};

export const getDailyStats = async (req: Request, res: Response) => {
    try {
        const { end } = req.query;
        
        // 获取最近7天的分组数据
        const endDate = end ? new Date(Number(end)) : new Date();
        const statsMap = new Map<string, number>();
        
        // Initialize last 7 days with 0
        for (let i = 6; i >= 0; i--) {
            const d = new Date(endDate);
            d.setDate(d.getDate() - i);
            const dateStr = d.toISOString().split('T')[0];
            statsMap.set(dateStr, 0);
            
            // 获取当天的分组数据（不重复车牌数）
            const dayStart = new Date(d);
            dayStart.setHours(0, 0, 0, 0);
            const dayEnd = new Date(d);
            dayEnd.setHours(23, 59, 59, 999);
            
            try {
                const dayGroups = await getPlateGroups({
                    start: dayStart.getTime(),
                    end: dayEnd.getTime()
                });
                statsMap.set(dateStr, dayGroups.length);
            } catch (error) {
                console.warn(`获取 ${dateStr} 的数据失败:`, error);
            }
        }

        const result = Array.from(statsMap.entries()).map(([date, count]) => ({ date, count }));
        res.json(result);
    } catch (error) {
        console.error('Error fetching daily stats:', error);
        res.status(500).json({ message: 'Error fetching daily stats' });
    }
};

export const getRegionStats = async (req: Request, res: Response) => {
    try {
        const { range, date } = req.query;
        
        // 根据 range 和 date 参数获取车牌分组数据
        let groups;
        if (range === 'daily' && date) {
            // 获取指定日期的数据
            const startOfDay = new Date(Number(date));
            startOfDay.setHours(0, 0, 0, 0);
            const endOfDay = new Date(Number(date));
            endOfDay.setHours(23, 59, 59, 999);
            
            groups = await getPlateGroups({
                start: startOfDay.getTime(),
                end: endOfDay.getTime()
            });
        } else {
            // 获取所有历史数据
            groups = await getPlateGroups();
        }

        // 按省份统计：提取车牌号码的第一个字符（省份简称）
        // 使用分组数据，每个车牌号只统计一次（不重复）
        const provinceMap = new Map<string, number>();
        
        groups.forEach(group => {
            if (group.plateNumber && group.plateNumber.length > 0) {
                // 提取第一个字符作为省份简称
                // 处理格式如 "粤R888G8" 或 "粤·R888G8"
                const firstChar = group.plateNumber.charAt(0);
                // 如果是分隔符，取下一个字符
                const province = firstChar === '·' && group.plateNumber.length > 1 
                    ? group.plateNumber.charAt(1) 
                    : firstChar;
                
                if (province && /[\u4e00-\u9fa5]/.test(province)) {
                    // 确保是中文省份简称
                    // 每个车牌号只计数一次（不重复）
                    const count = provinceMap.get(province) || 0;
                    provinceMap.set(province, count + 1);
                }
            }
        });

        // 转换为前端期望的格式
        const stats = Array.from(provinceMap.entries()).map(([province, count]) => ({
            province,
            count
        }));

        res.json(stats);
    } catch (error) {
        console.error('Error fetching region stats:', error);
        res.status(500).json({ message: 'Error fetching region stats' });
    }
};
