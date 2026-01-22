import { Request, Response } from 'express';
import { getPlates } from '../utils/db';
import { DashboardStats } from '../types';

export const getDashboardStats = async (req: Request, res: Response) => {
    try {
        const plates = await getPlates();

        const total = plates.length;
        const blue = plates.filter(p => p.type === 'blue').length;
        const green = plates.filter(p => p.type === 'green').length;
        const yellow = plates.filter(p => p.type === 'yellow').length;
        const other = total - blue - green - yellow;

        // Mock trends for now
        const stats: DashboardStats = {
            total,
            blue,
            green,
            yellow,
            other,
            trends: {
                total: { value: "+12%", direction: "up" },
                blue: { value: "-5%", direction: "down" },
                green: { value: "+8%", direction: "up" },
                other: { value: "0%", direction: "neutral" }
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
        const plates = await getPlates({
            end: end ? Number(end) : undefined
        });

        // Group by date (YYYY-MM-DD)
        const statsMap = new Map<string, number>();
        
        // Initialize last 7 days with 0
        for (let i = 6; i >= 0; i--) {
            const d = new Date();
            d.setDate(d.getDate() - i);
            const dateStr = d.toISOString().split('T')[0];
            statsMap.set(dateStr, 0);
        }

        plates.forEach(p => {
            const dateStr = new Date(p.timestamp).toISOString().split('T')[0];
            if (statsMap.has(dateStr)) {
                statsMap.set(dateStr, statsMap.get(dateStr)! + 1);
            }
        });

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
        
        // 根据 range 和 date 参数获取车牌数据
        let plates;
        if (range === 'daily' && date) {
            // 获取指定日期的数据
            const startOfDay = new Date(Number(date));
            startOfDay.setHours(0, 0, 0, 0);
            const endOfDay = new Date(Number(date));
            endOfDay.setHours(23, 59, 59, 999);
            
            plates = await getPlates({
                start: startOfDay.getTime(),
                end: endOfDay.getTime()
            });
        } else {
            // 获取所有历史数据
            plates = await getPlates();
        }

        // 按省份统计：提取车牌号码的第一个字符（省份简称）
        const provinceMap = new Map<string, number>();
        
        plates.forEach(plate => {
            if (plate.number && plate.number.length > 0) {
                // 提取第一个字符作为省份简称
                // 处理格式如 "粤R888G8" 或 "粤·R888G8"
                const firstChar = plate.number.charAt(0);
                // 如果是分隔符，取下一个字符
                const province = firstChar === '·' && plate.number.length > 1 
                    ? plate.number.charAt(1) 
                    : firstChar;
                
                if (province && /[\u4e00-\u9fa5]/.test(province)) {
                    // 确保是中文省份简称
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
