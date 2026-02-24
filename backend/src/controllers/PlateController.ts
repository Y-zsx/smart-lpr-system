import { Request, Response } from 'express';
import { getPlates as getPlatesFromDb, savePlate as savePlateToDb, savePlateRecord, getPlateGroups, deletePlateRecord, deletePlateRecordsByNumber } from '../utils/db';
import { LicensePlate, PlateType, PlateRecord } from '../types';
import { v4 as uuidv4 } from 'uuid';
import axios from 'axios';
import FormData from 'form-data';
import fs from 'fs-extra';
import { AuthenticatedRequest } from '../middlewares/auth';
import { filterPlateGroupsByScope } from '../utils/dataScope';

export const getPlates = async (req: AuthenticatedRequest, res: Response) => {
    try {
        const { start, end, type, plateNumber, groupBy } = req.query;

        // 如果指定了 groupBy=plate，使用新的分组查询
        if (groupBy === 'plate') {
            const groups = await getPlateGroups({
                start: start ? Number(start) : undefined,
                end: end ? Number(end) : undefined,
                type: type as string | undefined,
                plateNumber: plateNumber as string | undefined
            });
            res.json(filterPlateGroupsByScope(groups, req.dataScope));
            return;
        }

        // 默认从 plate_records 表查询（新数据）
        // 同时兼容查询旧的 plates 表
        try {
            // 先尝试从 plate_records 表查询
            const groups = await getPlateGroups({
                start: start ? Number(start) : undefined,
                end: end ? Number(end) : undefined,
                type: type as string | undefined,
                plateNumber: plateNumber as string | undefined
            });
            const scopedGroups = filterPlateGroupsByScope(groups, req.dataScope);

            // 将分组数据转换为单条记录列表（兼容旧接口）
            const records: LicensePlate[] = [];
            for (const group of scopedGroups) {
                for (const record of group.records) {
                    records.push({
                        id: record.id,
                        number: record.plateNumber,
                        type: record.plateType,
                        confidence: record.confidence,
                        timestamp: record.timestamp,
                        imageUrl: record.imageUrl,
                        location: record.location,
                        rect: record.rect,
                        saved: true,
                        cameraId: record.cameraId,
                        cameraName: record.cameraName
                    });
                }
            }

            // 按时间倒序排序
            records.sort((a, b) => b.timestamp - a.timestamp);

            res.json(records);
            return;
        } catch (error) {
            console.warn('从 plate_records 查询失败，尝试从 plates 表查询:', error);
            // 如果失败，回退到旧的 plates 表
            const plates = await getPlatesFromDb({
                start: start ? Number(start) : undefined,
                end: end ? Number(end) : undefined,
                type: type as string | undefined
            });
            res.json(plates);
        }
    } catch (error) {
        console.error('Error fetching plates:', error);
        res.status(500).json({ message: 'Error fetching plates' });
    }
};

export const savePlate = async (req: Request, res: Response) => {
    try {
        const plateData: LicensePlate = req.body;

        console.log('收到保存请求:', {
            plateNumber: plateData.number,
            timestamp: plateData.timestamp,
            cameraId: plateData.cameraId,
            cameraName: plateData.cameraName
        });

        // 转换为 PlateRecord 格式并保存
        const record: PlateRecord = {
            id: plateData.id || uuidv4(),
            plateNumber: plateData.number,
            plateType: plateData.type,
            confidence: plateData.confidence,
            timestamp: plateData.timestamp || Date.now(),
            cameraId: plateData.cameraId,
            cameraName: plateData.cameraName || plateData.location,
            regionCode: (plateData as any).regionCode,
            location: plateData.location,
            imageUrl: plateData.imageUrl,
            rect: plateData.rect,
            createdAt: Date.now()
        };

        console.log('准备保存记录:', record);

        // savePlateRecord 会自动检查黑名单并创建告警
        const savedRecord = await savePlateRecord(record);

        console.log('保存成功:', savedRecord);

        // 返回兼容格式
        const response: LicensePlate = {
            id: savedRecord.id,
            number: savedRecord.plateNumber,
            type: savedRecord.plateType,
            confidence: savedRecord.confidence,
            timestamp: savedRecord.timestamp,
            imageUrl: savedRecord.imageUrl,
            location: savedRecord.location,
            rect: savedRecord.rect,
            saved: true,
            cameraId: savedRecord.cameraId,
            cameraName: savedRecord.cameraName
        };

        res.json(response);
    } catch (error) {
        console.error('Error saving plate:', error);
        console.error('错误堆栈:', error instanceof Error ? error.stack : '无堆栈信息');
        res.status(500).json({
            message: 'Error saving plate',
            error: error instanceof Error ? error.message : String(error)
        });
    }
};

export const recognizePlate = async (req: Request, res: Response) => {
    try {
        const file = req.file; // From multer
        if (!file) {
            res.status(400).json({ message: 'No file uploaded' });
            return;
        }

        // 从 FormData 中获取摄像头信息（multer 会将非文件字段放在 req.body 中）
        const cameraId = req.body.cameraId as string | undefined;
        const cameraName = req.body.cameraName as string | undefined;
        const location = req.body.location as string | undefined;
        const regionCode = req.body.regionCode as string | undefined;

        // Call Python AI Service
        try {
            const formData = new FormData();
            formData.append('file', fs.createReadStream(file.path));

            const aiResponse = await axios.post('http://localhost:8001/recognize', formData, {
                headers: {
                    ...formData.getHeaders()
                }
            });

            // 检查是否有错误
            if (aiResponse.data.error) {
                console.error('AI Service returned error:', aiResponse.data.error);
                res.status(500).json({
                    message: 'AI recognition error',
                    error: aiResponse.data.error
                });
                return;
            }

            const aiPlates = aiResponse.data.plates || [];
            console.log('AI Service response:', {
                platesCount: aiPlates.length,
                plates: aiPlates
            });

            const plates: LicensePlate[] = aiPlates.map((p: { number: string; type: string; confidence: number; rect?: { x: number; y: number; w: number; h: number } }) => ({
                id: uuidv4(),
                number: p.number,
                type: p.type as PlateType,
                confidence: p.confidence,
                timestamp: Date.now(),
                rect: p.rect,
                saved: false,
                location: location || cameraName || '未知位置',
                regionCode,
                imageUrl: `uploads/temp/${file.filename}`,
                cameraId: cameraId,
                cameraName: cameraName || '未知摄像头'
            }));

            res.json({ plates });

        } catch (aiError) {
            console.error('AI Service Error:', aiError);
            res.status(503).json({ message: 'AI Service unavailable. Please ensure python service is running on port 8001.' });
            return;
        }

    } catch (error) {
        console.error('Recognition error:', error);
        res.status(500).json({ message: 'Error recognizing plate' });
    }
};

// 删除单条识别记录
export const deletePlate = async (req: Request, res: Response) => {
    try {
        const { id } = req.query;
        
        if (!id || typeof id !== 'string') {
            res.status(400).json({ message: '缺少记录ID参数' });
            return;
        }

        const deleted = await deletePlateRecord(id);
        
        if (deleted) {
            res.json({ message: '删除成功', deleted: true });
        } else {
            res.status(404).json({ message: '记录不存在', deleted: false });
        }
    } catch (error) {
        console.error('Error deleting plate record:', error);
        res.status(500).json({ 
            message: '删除失败',
            error: error instanceof Error ? error.message : String(error)
        });
    }
};

// 删除指定车牌号的所有记录
export const deletePlatesByNumber = async (req: Request, res: Response) => {
    try {
        const { plateNumber } = req.query;
        
        if (!plateNumber || typeof plateNumber !== 'string') {
            res.status(400).json({ message: '缺少车牌号参数' });
            return;
        }

        const deletedCount = await deletePlateRecordsByNumber(plateNumber);
        
        res.json({ 
            message: '删除成功', 
            deletedCount,
            plateNumber 
        });
    } catch (error) {
        console.error('Error deleting plates by number:', error);
        res.status(500).json({ 
            message: '删除失败',
            error: error instanceof Error ? error.message : String(error)
        });
    }
};

function generateMockPlate(isGreen: boolean) {
    const provinces = ['京', '沪', '粤', '苏', '浙', '湘', '鄂'];
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
    const nums = '0123456789';

    const province = provinces[Math.floor(Math.random() * provinces.length)];
    const city = chars[Math.floor(Math.random() * chars.length)];

    let number = '';
    const length = isGreen ? 6 : 5;

    for (let i = 0; i < length; i++) {
        number += nums[Math.floor(Math.random() * nums.length)];
    }

    return `${province}${city}·${number}`;
}
