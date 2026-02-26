import { NextFunction, Request, Response } from 'express';
import {
    savePlateRecord,
    getPlateGroups,
    deletePlateRecord,
    deletePlateRecordsByNumber,
    getPlateRecordImageUrlById,
    getPlateRecordImageUrlsByNumber,
    countMediaPathReferences
} from '../../utils/db';
import { LicensePlate, PlateType, PlateRecord } from '../../types';
import { v4 as uuidv4 } from 'uuid';
import axios from 'axios';
import FormData from 'form-data';
import fs from 'fs-extra';
import { AuthenticatedRequest } from '../auth';
import { filterPlateGroupsByScope } from '../../utils/dataScope';
import { isValidChinesePlateNumber } from '../../utils/plateValidation';
import { AppError } from '../../utils/AppError';
import { deleteStoredFile, persistTempFile } from '../../services/storageService';

const AI_SERVICE_URL = (process.env.AI_SERVICE_URL || 'http://localhost:8001').trim().replace(/\/$/, '');
const AI_RECOGNIZE_TIMEOUT_MS = Math.max(500, Number(process.env.AI_RECOGNIZE_TIMEOUT_MS || 5000));
const AI_RECOGNIZE_RETRIES = Math.max(0, Number(process.env.AI_RECOGNIZE_RETRIES || 1));
const AI_FAILURE_MODE = (process.env.AI_FAILURE_MODE || 'structured').trim().toLowerCase();

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

const cleanupMediaIfUnused = async (mediaPath?: string | null) => {
    const normalized = typeof mediaPath === 'string' ? mediaPath.trim() : '';
    if (!normalized) return;
    try {
        const refs = await countMediaPathReferences(normalized);
        if (refs === 0) {
            await deleteStoredFile(normalized);
        }
    } catch (error) {
        console.warn('Failed to cleanup media file:', normalized, error);
    }
};

export const getPlates = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
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
    } catch (error) {
        console.error('Error fetching plates:', error);
        next(new AppError('Error fetching plates', 500, 'PLATES_FETCH_FAILED'));
    }
};

export const savePlate = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const plateData: LicensePlate = req.body;

        if (!plateData?.number?.trim()) {
            next(new AppError('车牌号不能为空', 400, 'VALIDATION_ERROR'));
            return;
        }
        if (!isValidChinesePlateNumber(plateData.number)) {
            next(new AppError('车牌号格式不合法，仅支持中国车牌格式（如京A·12345），非法结果将不入库', 400, 'INVALID_PLATE_NUMBER', {
                plateNumber: plateData.number
            }));
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
        next(new AppError('Error saving plate', 500, 'PLATE_SAVE_FAILED'));
    }
};

export const recognizePlate = async (req: Request, res: Response, next: NextFunction) => {
    const file = req.file;
    const requestStartedAt = Date.now();
    let shouldCleanupTempFile = true;
    try {
        if (!file) {
            next(new AppError('No file uploaded', 400, 'VALIDATION_ERROR'));
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
                next(new AppError('AI recognition error', 502, 'AI_RECOGNITION_ERROR', {
                    reason: aiResponse.data.error
                }));
                return;
            }

            const aiPlates = aiResponse.data.plates || [];
            let persistedImageUrl = `uploads/temp/${file.filename}`;
            if (aiPlates.length > 0 && file?.path) {
                try {
                    persistedImageUrl = await persistTempFile(file.path, {
                        originalName: file.originalname,
                        mimeType: file.mimetype,
                        category: 'records'
                    });
                } catch (persistError) {
                    // 兜底：转存失败时保留 temp 文件，避免记录中的图片地址失效
                    shouldCleanupTempFile = false;
                    console.warn('Failed to persist recognized image to records dir, fallback to temp path:', persistError);
                }
            }
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
                imageUrl: persistedImageUrl,
                cameraId: cameraId,
                cameraName: cameraName || '未知摄像头'
            }));

            res.json({ plates });
        } catch (aiError) {
            console.error('AI Service Error:', aiError);
            if (axios.isAxiosError(aiError) && aiError.code === 'ECONNABORTED') {
                next(new AppError(`AI Service timeout (${AI_RECOGNIZE_TIMEOUT_MS}ms)`, 504, 'AI_TIMEOUT'));
                return;
            }
            if (AI_FAILURE_MODE === 'degrade') {
                res.status(200).json({
                    plates: [],
                    degraded: true,
                    code: 'AI_UNAVAILABLE',
                    message: 'AI 服务暂不可用，已按降级策略返回空识别结果'
                });
                return;
            }
            next(new AppError('AI Service unavailable. Please ensure python service is running.', 503, 'AI_UNAVAILABLE', {
                aiServiceUrl: AI_SERVICE_URL
            }));
            return;
        }
    } catch (error) {
        console.error('Recognition error:', error);
        next(new AppError('Error recognizing plate', 500, 'PLATE_RECOGNIZE_FAILED'));
    } finally {
        console.info('[AI] recognize request done', JSON.stringify({ elapsedMs: Date.now() - requestStartedAt }));
        if (file?.path && shouldCleanupTempFile) {
            try {
                await fs.remove(file.path);
            } catch (cleanupError) {
                console.warn('Failed to cleanup temp upload file:', file.path, cleanupError);
            }
        }
    }
};

export const deletePlate = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { id } = req.query;
        if (!id || typeof id !== 'string') {
            next(new AppError('缺少记录ID参数', 400, 'VALIDATION_ERROR'));
            return;
        }
        const mediaPath = await getPlateRecordImageUrlById(id);
        const deleted = await deletePlateRecord(id);
        if (deleted) {
            await cleanupMediaIfUnused(mediaPath);
            res.json({ message: '删除成功', deleted: true });
        } else {
            res.status(404).json({ message: '记录不存在', deleted: false });
        }
    } catch (error) {
        console.error('Error deleting plate record:', error);
        next(new AppError('删除失败', 500, 'PLATE_DELETE_FAILED'));
    }
};

export const deletePlatesByNumber = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { plateNumber } = req.query;
        if (!plateNumber || typeof plateNumber !== 'string') {
            next(new AppError('缺少车牌号参数', 400, 'VALIDATION_ERROR'));
            return;
        }
        const mediaPaths = await getPlateRecordImageUrlsByNumber(plateNumber);
        const deletedCount = await deletePlateRecordsByNumber(plateNumber);
        for (const mediaPath of mediaPaths) {
            await cleanupMediaIfUnused(mediaPath);
        }
        res.json({ message: '删除成功', deletedCount, plateNumber });
    } catch (error) {
        console.error('Error deleting plates by number:', error);
        next(new AppError('删除失败', 500, 'PLATE_DELETE_BY_NUMBER_FAILED'));
    }
};
