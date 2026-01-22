import { Request, Response } from 'express';
import { getAlarms as getAlarmsFromDb } from '../utils/db';

export const getAlarms = async (req: Request, res: Response) => {
    try {
        const alarms = await getAlarmsFromDb();
        res.json(alarms);
    } catch (error) {
        console.error('Error fetching alarms:', error);
        res.status(500).json({ message: 'Error fetching alarms' });
    }
};
