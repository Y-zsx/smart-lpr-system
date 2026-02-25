import { Request, Response } from 'express';
import { getPlates as getPlatesFromDb, savePlateRecord, getPlateGroups, deletePlateRecord, deletePlateRecordsByNumber } from '../../utils/db';
import { LicensePlate, PlateType, PlateRecord } from '../../types';
import { v4 as uuidv4 } from 'uuid';
import axios from 'axios';
import FormData from 'form-data';
import fs from 'fs-extra';
import { AuthenticatedRequest } from '../auth';
import { filterPlateGroupsByScope } from '../../utils/dataScope';
import { isValidChinesePlateNumber } from '../../utils/plateValidation';

const AI_SERVICE_URL = (process.env.AI_SERVICE_URL || 'http://localhost:8001').trim().replace(/\/$/, '');
const AI_RECOGNIZE_TIMEOUT_MS = Math.max(500, Number(process.env.AI_RECOGNIZE_TIMEOUT_MS || 5000));
const AI_RECOGNIZE_RETRIES = Math.max(0, Number(process.env.AI_RECOGNIZE_RETRIES || 1));

const shouldRetryAiError = (error: unknown): boolean => {
    if (!axios.isAxiosError(error)) {
        return false;
    }
    // 超时、网络抖动、服务端错误做一次快速重试
    if (error.code === 'ECONNABORTED' || !error.response) {
        return true;
    }
    const status = error.response.status;
    return status >= 500 || status === 429;
};

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export const getPlates = async (req: AuthenticatedRequest, res: Response) => {
    try {
        const { start, end, type, plateNumber, groupBy } = req.query;

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

        try {
            const groups = await getPlateGroups({
                start: start ? Number(start) : undefined,
                end: end ? Number(end) : undefined,
                type: type as string | undefined,
                plateNumber: plateNumber as string | undefined
            });
            const scopedGroups = filterPlateGroupsByScope(groups, req.dataScope);

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

            records.sort((a, b) => b.timestamp - a.timestamp);
            res.json(records);
            return;
        } catch (error) {
            console.warn('从 plate_records 查询失败，尝试从 plates 表查询:', error);
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

        if (!plateData?.number?.trim()) {
            res.status(400).json({ message: '车牌号不能为空' });
            return;
        }
        if (!isValidChinesePlateNumber(plateData.number)) {
            res.status(400).json({
                message: '车牌号格式不合法，仅支持中国车牌格式（如京A·12345），非法结果将不入库',
                plateNumber: plateData.number
            });
            return;
        }

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

        const savedRecord = await savePlateRecord(record);

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
        res.status(500).json({
            message: 'Error saving plate',
            error: error instanceof Error ? error.message : String(error)
        });
    }
};

export const recognizePlate = async (req: Request, res: Response) => {
    const file = req.file;
    const requestStartedAt = Date.now();
    try {
        if (!file) {
            res.status(400).json({ message: 'No file uploaded' });
            return;
        }

        const cameraId = req.body.cameraId as string | undefined;
        const cameraName = req.body.cameraName as string | undefined;
        const location = req.body.location as string | undefined;
        const regionCode = req.body.regionCode as string | undefined;
        const minConfidenceRaw = Number(req.body.minConfidence);
        const maxPlatesRaw = Number(req.body.maxPlates);
        const minConfidence = Number.isFinite(minConfidenceRaw)
            ? Math.min(Math.max(minConfidenceRaw, 0), 1)
            : undefined;
        const maxPlates = Number.isFinite(maxPlatesRaw)
            ? Math.max(0, Math.floor(maxPlatesRaw))
            : undefined;

        try {
            const formData = new FormData();
            formData.append('file', fs.createReadStream(file.path));
            const streamKey = cameraId || cameraName || 'default';
            const recognizeUrl = `${AI_SERVICE_URL}/recognize`;
            let aiResponse: { data: { error?: string; plates?: Array<{ number: string; type: string; confidence: number; rect?: { x: number; y: number; w: number; h: number } }> } } | null = null;
            let lastError: unknown;

            for (let attempt = 0; attempt <= AI_RECOGNIZE_RETRIES; attempt++) {
                try {
                    aiResponse = await axios.post<{ error?: string; plates?: Array<{ number: string; type: string; confidence: number; rect?: { x: number; y: number; w: number; h: number } }> }>(recognizeUrl, formData, {
                        headers: { ...formData.getHeaders() },
                        params: {
                            stream_key: streamKey,
                            ...(typeof minConfidence === 'number' ? { min_confidence: minConfidence } : {}),
                            ...(typeof maxPlates === 'number' ? { max_plates: maxPlates } : {})
                        },
                        timeout: AI_RECOGNIZE_TIMEOUT_MS
                    });
                    lastError = null;
                    break;
                } catch (error) {
                    lastError = error;
                    if (attempt >= AI_RECOGNIZE_RETRIES || !shouldRetryAiError(error)) {
                        throw error;
                    }
                    await sleep(150);
                }
            }

            if (!aiResponse) {
                throw lastError || new Error('AI recognition request failed');
            }

            if (aiResponse.data.error) {
                console.error('AI Service returned error:', aiResponse.data.error);
                res.status(502).json({
                    message: 'AI recognition error',
                    error: aiResponse.data.error
                });
                return;
            }

            const aiPlates = aiResponse.data.plates || [];
            console.info(
                '[AI] recognize success',
                JSON.stringify({
                    streamKey,
                    minConfidence,
                    maxPlates,
                    count: aiPlates.length,
                    elapsedMs: Date.now() - requestStartedAt
                })
            );
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
            if (axios.isAxiosError(aiError) && aiError.code === 'ECONNABORTED') {
                res.status(504).json({ message: `AI Service timeout (${AI_RECOGNIZE_TIMEOUT_MS}ms)` });
                return;
            }
            res.status(503).json({
                message: 'AI Service unavailable. Please ensure python service is running.',
                aiServiceUrl: AI_SERVICE_URL
            });
            return;
        }
    } catch (error) {
        console.error('Recognition error:', error);
        res.status(500).json({ message: 'Error recognizing plate' });
    } finally {
        console.info('[AI] recognize request done', JSON.stringify({ elapsedMs: Date.now() - requestStartedAt }));
        if (file?.path) {
            try {
                await fs.remove(file.path);
            } catch (cleanupError) {
                console.warn('Failed to cleanup temp upload file:', file.path, cleanupError);
            }
        }
    }
};

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

export const deletePlatesByNumber = async (req: Request, res: Response) => {
    try {
        const { plateNumber } = req.query;
        if (!plateNumber || typeof plateNumber !== 'string') {
            res.status(400).json({ message: '缺少车牌号参数' });
            return;
        }
        const deletedCount = await deletePlateRecordsByNumber(plateNumber);
        res.json({ message: '删除成功', deletedCount, plateNumber });
    } catch (error) {
        console.error('Error deleting plates by number:', error);
        res.status(500).json({
            message: '删除失败',
            error: error instanceof Error ? error.message : String(error)
        });
    }
};
