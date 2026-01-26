import { Request, Response } from 'express';
import { getAlarms as getAlarmsFromDb, updateAlarmStatus, deleteAlarm as deleteAlarmFromDb, deleteAlarmsByPlateNumber } from '../utils/db';

export const getAlarms = async (req: Request, res: Response) => {
    try {
        const alarms = await getAlarmsFromDb();
        res.json(alarms);
    } catch (error) {
        console.error('Error fetching alarms:', error);
        res.status(500).json({ message: 'Error fetching alarms' });
    }
};

export const markAlarmAsRead = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        console.log(`[AlarmController] Marking alarm as read: id=${id}, type=${typeof id}`);
        
        if (!id || isNaN(Number(id))) {
            console.error(`[AlarmController] Invalid alarm ID: ${id}`);
            res.status(400).json({ message: 'Invalid alarm ID' });
            return;
        }

        const success = await updateAlarmStatus(Number(id), true);
        console.log(`[AlarmController] Mark as read result: ${success}`);
        
        if (success) {
            res.json({ success: true });
        } else {
            res.status(404).json({ message: 'Alarm not found' });
        }
    } catch (error) {
        console.error('Error marking alarm as read:', error);
        res.status(500).json({ message: 'Error updating alarm status' });
    }
};

export const deleteAlarm = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        console.log(`[AlarmController] Deleting alarm: id=${id}, type=${typeof id}`);

        if (!id || isNaN(Number(id))) {
            console.error(`[AlarmController] Invalid alarm ID: ${id}`);
            res.status(400).json({ message: 'Invalid alarm ID' });
            return;
        }

        const success = await deleteAlarmFromDb(Number(id));
        console.log(`[AlarmController] Delete result: ${success}`);

        if (success) {
            res.json({ success: true });
        } else {
            res.status(404).json({ message: 'Alarm not found' });
        }
    } catch (error) {
        console.error('Error deleting alarm:', error);
        res.status(500).json({ message: 'Error deleting alarm' });
    }
};

export const deleteAlarmsByPlate = async (req: Request, res: Response) => {
    try {
        const { plateNumber } = req.params;
        if (typeof plateNumber !== 'string') {
            res.status(400).json({ message: 'Invalid plate number' });
            return;
        }
        const deletedCount = await deleteAlarmsByPlateNumber(plateNumber);
        res.json({ success: true, deletedCount });
    } catch (error) {
        console.error('Error deleting alarms by plate:', error);
        res.status(500).json({ message: 'Error deleting alarms' });
    }
};
