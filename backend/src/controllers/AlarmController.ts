import { Request, Response } from 'express';
import { getDb } from '../utils/db';

export const getAlarms = async (req: Request, res: Response) => {
    try {
        const db = await getDb();
        // Sort by timestamp desc
        const alarms = [...db.alarms].sort((a, b) => b.timestamp - a.timestamp);
        res.json(alarms);
    } catch (error) {
        res.status(500).json({ message: 'Error fetching alarms' });
    }
};
