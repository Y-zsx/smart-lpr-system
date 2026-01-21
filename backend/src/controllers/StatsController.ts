import { Request, Response } from 'express';
import { getDb } from '../utils/db';
import { DashboardStats } from '../types';

export const getDashboardStats = async (req: Request, res: Response) => {
    try {
        const db = await getDb();
        const plates = db.plates;

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
        res.status(500).json({ message: 'Error fetching dashboard stats' });
    }
};

export const getDailyStats = async (req: Request, res: Response) => {
    try {
        const db = await getDb();
        const { end } = req.query;
        let plates = db.plates;

        if (end) {
            plates = plates.filter(p => p.timestamp <= Number(end));
        }

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
        res.status(500).json({ message: 'Error fetching daily stats' });
    }
};

export const getRegionStats = async (req: Request, res: Response) => {
    try {
        const db = await getDb();
        const { range, date } = req.query;
        
        // Mock region stats based on location field
        // In real app, we would aggregate by location
        const locations = ['Main Gate', 'Parking Lot A', 'Parking Lot B', 'Exit'];
        const stats = locations.map(loc => ({
            name: loc,
            value: Math.floor(Math.random() * 100)
        }));

        res.json(stats);
    } catch (error) {
        res.status(500).json({ message: 'Error fetching region stats' });
    }
};
