import { NextFunction, Request, Response } from 'express';
import { getBlacklist as getBlacklistFromDb, addBlacklist as addBlacklistToDb, deleteBlacklist as deleteBlacklistFromDb, getAllPlateRecords, createAlarmForBlacklist, deleteAlarmsByBlacklistId, getBlacklistItem, deleteAlarmsByPlateNumber } from '../../utils/db';
import { BlacklistItem } from '../../types';
import { AppError } from '../../utils/AppError';

export const getBlacklist = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const blacklist = await getBlacklistFromDb();
        res.json(blacklist);
    } catch (error) {
        console.error('Error fetching blacklist:', error);
        next(new AppError('Error fetching blacklist', 500, 'BLACKLIST_FETCH_FAILED'));
    }
};

export const addBlacklist = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const data = req.body;
        const items: Omit<BlacklistItem, 'id' | 'created_at'>[] = Array.isArray(data) ? data : [data];
        const newItems = await Promise.all(
            items.map(async (item) => {
                const newItem = await addBlacklistToDb({
                    plate_number: item.plate_number,
                    reason: item.reason,
                    severity: item.severity
                });
                try {
                    const records = await getAllPlateRecords({ plateNumber: item.plate_number });
                    let createdCount = 0;
                    for (const record of records) {
                        await createAlarmForBlacklist(record, newItem);
                        createdCount++;
                    }
                    if (createdCount > 0) {
                        console.log(`为黑名单车牌 ${item.plate_number} 创建了 ${createdCount} 条告警`);
                    }
                } catch (error) {
                    console.error('创建告警失败:', error);
                }
                return newItem;
            })
        );
        res.json(Array.isArray(data) ? newItems : newItems[0]);
    } catch (error) {
        console.error('Error adding to blacklist:', error);
        next(new AppError('Error adding to blacklist', 500, 'BLACKLIST_ADD_FAILED'));
    }
};

export const deleteBlacklist = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { id } = req.query;
        if (!id) {
            next(new AppError('ID is required', 400, 'VALIDATION_ERROR'));
            return;
        }
        const blacklistId = Number(id);
        const item = await getBlacklistItem(blacklistId);
        await deleteAlarmsByBlacklistId(blacklistId);
        if (item) {
            await deleteAlarmsByPlateNumber(item.plate_number);
        }
        const deleted = await deleteBlacklistFromDb(blacklistId);
        if (!deleted) {
            next(new AppError('Item not found', 404, 'BLACKLIST_NOT_FOUND'));
            return;
        }
        res.json({ success: true });
    } catch (error) {
        console.error('Error deleting from blacklist:', error);
        next(new AppError('Error deleting from blacklist', 500, 'BLACKLIST_DELETE_FAILED'));
    }
};
