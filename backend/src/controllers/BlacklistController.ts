import { Request, Response } from 'express';
import { getBlacklist as getBlacklistFromDb, addBlacklist as addBlacklistToDb, deleteBlacklist as deleteBlacklistFromDb, getAllPlateRecords, createAlarmForBlacklist, getPlates } from '../utils/db';
import { BlacklistItem, PlateRecord } from '../types';

export const getBlacklist = async (req: Request, res: Response) => {
    try {
        const blacklist = await getBlacklistFromDb();
        res.json(blacklist);
    } catch (error) {
        console.error('Error fetching blacklist:', error);
        res.status(500).json({ message: 'Error fetching blacklist' });
    }
};

export const addBlacklist = async (req: Request, res: Response) => {
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
                
                // 检查历史记录，为匹配的车牌创建告警
                try {
                    // 1. 检查 plate_records 表中的所有记录
                    const records = await getAllPlateRecords({
                        plateNumber: item.plate_number
                    });
                    
                    let createdCount = 0;
                    // 为所有记录创建告警
                    for (const record of records) {
                        await createAlarmForBlacklist(record, newItem);
                        createdCount++;
                    }
                    
                    // 2. 检查 plates 表中的记录（兼容旧数据）
                    const oldPlates = await getPlates();
                    const matchingPlates = oldPlates.filter(plate => plate.number === item.plate_number);
                    
                    for (const plate of matchingPlates) {
                        // 将 plates 表的记录转换为 PlateRecord 格式
                        const record: PlateRecord = {
                            id: plate.id,
                            plateNumber: plate.number,
                            plateType: plate.type,
                            confidence: plate.confidence,
                            timestamp: plate.timestamp,
                            cameraId: undefined,
                            cameraName: plate.location,
                            location: plate.location,
                            imageUrl: plate.imageUrl,
                            rect: plate.rect,
                            createdAt: plate.timestamp
                        };
                        await createAlarmForBlacklist(record, newItem);
                        createdCount++;
                    }
                    
                    if (createdCount > 0) {
                        console.log(`为黑名单车牌 ${item.plate_number} 创建了 ${createdCount} 条告警（plate_records: ${records.length} 条，plates: ${matchingPlates.length} 条）`);
                    }
                } catch (error) {
                    console.error('创建告警失败:', error);
                    // 不阻止黑名单添加，只记录错误
                }
                
                return newItem;
            })
        );

        res.json(Array.isArray(data) ? newItems : newItems[0]);
    } catch (error) {
        console.error('Error adding to blacklist:', error);
        res.status(500).json({ message: 'Error adding to blacklist' });
    }
};

export const deleteBlacklist = async (req: Request, res: Response) => {
    try {
        const { id } = req.query;
        if (!id) {
            res.status(400).json({ message: 'ID is required' });
            return;
        }

        const deleted = await deleteBlacklistFromDb(Number(id));
        if (!deleted) {
            res.status(404).json({ message: 'Item not found' });
            return;
        }

        res.json({ success: true });
    } catch (error) {
        console.error('Error deleting from blacklist:', error);
        res.status(500).json({ message: 'Error deleting from blacklist' });
    }
};
