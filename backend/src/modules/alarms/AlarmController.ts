import { NextFunction, Request, Response } from 'express';
import { getAlarms as getAlarmsFromDb, updateAlarmStatus, deleteAlarm as deleteAlarmFromDb, deleteAlarmsByPlateNumber } from '../../utils/db';
import { AuthenticatedRequest } from '../auth';
import { filterItemsByScope } from '../../utils/dataScope';
import { AppError } from '../../utils/AppError';

export const getAlarms = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
        const alarms = await getAlarmsFromDb();
        const scoped = filterItemsByScope(
            alarms,
            alarm => (alarm as any).camera_id,
            alarm => (alarm as any).region_code,
            req.dataScope
        );
        res.json(scoped);
    } catch (error) {
        console.error('Error fetching alarms:', error);
        next(new AppError('Error fetching alarms', 500, 'ALARMS_FETCH_FAILED'));
    }
};

export const markAlarmAsRead = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { id } = req.params;
        if (!id || isNaN(Number(id))) {
            next(new AppError('Invalid alarm ID', 400, 'VALIDATION_ERROR'));
            return;
        }
        const success = await updateAlarmStatus(Number(id), true);
        if (success) {
            res.json({ success: true });
        } else {
            next(new AppError('Alarm not found', 404, 'ALARM_NOT_FOUND'));
        }
    } catch (error) {
        console.error('Error marking alarm as read:', error);
        next(new AppError('Error updating alarm status', 500, 'ALARM_UPDATE_FAILED'));
    }
};

export const deleteAlarm = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { id } = req.params;
        if (!id || isNaN(Number(id))) {
            next(new AppError('Invalid alarm ID', 400, 'VALIDATION_ERROR'));
            return;
        }
        const success = await deleteAlarmFromDb(Number(id));
        if (success) {
            res.json({ success: true });
        } else {
            next(new AppError('Alarm not found', 404, 'ALARM_NOT_FOUND'));
        }
    } catch (error) {
        console.error('Error deleting alarm:', error);
        next(new AppError('Error deleting alarm', 500, 'ALARM_DELETE_FAILED'));
    }
};

export const deleteAlarmsByPlate = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { plateNumber } = req.params;
        if (typeof plateNumber !== 'string') {
            next(new AppError('Invalid plate number', 400, 'VALIDATION_ERROR'));
            return;
        }
        const deletedCount = await deleteAlarmsByPlateNumber(plateNumber);
        res.json({ success: true, deletedCount });
    } catch (error) {
        console.error('Error deleting alarms by plate:', error);
        next(new AppError('Error deleting alarms', 500, 'ALARMS_DELETE_FAILED'));
    }
};
