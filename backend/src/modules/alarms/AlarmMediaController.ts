import { NextFunction, Request, Response } from 'express';
import { AppError } from '../../utils/AppError';
import {
    createAlarmMediaTask,
    deleteAlarmMedia,
    enqueueAlarmClipCapture,
    getAlarmCaptureSourceByAlarmId,
    getAlarmMediaById,
    listAlarmMedia,
    updateAlarmMedia
} from '../../services/alarmMediaService';

const parseOptionalNumber = (value: unknown): number | undefined => {
    if (value === undefined || value === null || value === '') return undefined;
    const num = Number(value);
    if (!Number.isFinite(num)) return undefined;
    return num;
};

const toMediaOutput = (item: any, req: Request) => {
    if (!item?.mediaPath) return item;
    const base = (process.env.PUBLIC_BASE_URL || `${req.protocol}://${req.get('host')}`).replace(/\/+$/, '');
    return {
        ...item,
        playUrl: `${base}/api/media/redirect?path=${encodeURIComponent(item.mediaPath)}`,
        downloadUrl: `${base}/api/media/download?path=${encodeURIComponent(item.mediaPath)}`
    };
};

export const getAlarmMediaList = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const alarmId = parseOptionalNumber(req.query.alarmId);
        const filters = {
            alarmId,
            recordId: typeof req.query.recordId === 'string' ? req.query.recordId : undefined,
            cameraId: typeof req.query.cameraId === 'string' ? req.query.cameraId : undefined,
            status: typeof req.query.status === 'string' ? req.query.status as any : undefined
        };
        const items = await listAlarmMedia(filters);
        res.json(items.map((item) => toMediaOutput(item, req)));
    } catch (error) {
        next(new AppError('获取告警媒体失败', 500, 'ALARM_MEDIA_LIST_FAILED'));
    }
};

export const getAlarmMediaDetail = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const id = Number(req.params.id);
        if (!Number.isFinite(id)) {
            next(new AppError('无效的媒体ID', 400, 'VALIDATION_ERROR'));
            return;
        }
        const item = await getAlarmMediaById(id);
        if (!item) {
            next(new AppError('媒体记录不存在', 404, 'ALARM_MEDIA_NOT_FOUND'));
            return;
        }
        res.json(toMediaOutput(item, req));
    } catch (error) {
        next(new AppError('获取媒体详情失败', 500, 'ALARM_MEDIA_GET_FAILED'));
    }
};

export const createAlarmMediaCapture = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const alarmId = parseOptionalNumber(req.body?.alarmId);
        const durationSec = parseOptionalNumber(req.body?.durationSec);
        let recordId = typeof req.body?.recordId === 'string' ? req.body.recordId : undefined;
        let cameraId = typeof req.body?.cameraId === 'string' ? req.body.cameraId : undefined;
        let plateNumber = typeof req.body?.plateNumber === 'string' ? req.body.plateNumber : undefined;
        if (!cameraId && !alarmId) {
            next(new AppError('alarmId 或 cameraId 至少提供一个', 400, 'VALIDATION_ERROR'));
            return;
        }
        if (alarmId && (!cameraId || !recordId || !plateNumber)) {
            const source = await getAlarmCaptureSourceByAlarmId(alarmId);
            if (source) {
                cameraId = cameraId || source.cameraId;
                recordId = recordId || source.recordId;
                plateNumber = plateNumber || source.plateNumber;
            }
        }
        if (alarmId && !cameraId) {
            next(new AppError('告警未关联摄像头，无法触发视频切片', 400, 'ALARM_CAMERA_REQUIRED'));
            return;
        }
        const task = await enqueueAlarmClipCapture({
            alarmId,
            recordId,
            plateNumber,
            cameraId,
            durationSec
        });
        if (!task) {
            const pending = await createAlarmMediaTask({
                alarmId,
                recordId,
                plateNumber,
                cameraId,
                durationSec
            });
            res.json({ queued: false, item: toMediaOutput(pending, req) });
            return;
        }
        res.json({ queued: true, item: toMediaOutput(task, req) });
    } catch (error) {
        next(new AppError('创建告警视频任务失败', 500, 'ALARM_MEDIA_CREATE_FAILED'));
    }
};

export const patchAlarmMedia = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const id = Number(req.params.id);
        if (!Number.isFinite(id)) {
            next(new AppError('无效的媒体ID', 400, 'VALIDATION_ERROR'));
            return;
        }
        const ok = await updateAlarmMedia(id, {
            status: typeof req.body?.status === 'string' ? req.body.status : undefined,
            durationSec: parseOptionalNumber(req.body?.durationSec),
            errorMessage: typeof req.body?.errorMessage === 'string' ? req.body.errorMessage : undefined
        });
        if (!ok) {
            next(new AppError('媒体记录不存在', 404, 'ALARM_MEDIA_NOT_FOUND'));
            return;
        }
        const item = await getAlarmMediaById(id);
        res.json(item ? toMediaOutput(item, req) : item);
    } catch (error) {
        next(new AppError('更新告警媒体失败', 500, 'ALARM_MEDIA_UPDATE_FAILED'));
    }
};

export const removeAlarmMedia = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const id = Number(req.params.id);
        if (!Number.isFinite(id)) {
            next(new AppError('无效的媒体ID', 400, 'VALIDATION_ERROR'));
            return;
        }
        const ok = await deleteAlarmMedia(id);
        if (!ok) {
            next(new AppError('媒体记录不存在', 404, 'ALARM_MEDIA_NOT_FOUND'));
            return;
        }
        res.json({ deleted: true });
    } catch (error) {
        next(new AppError('删除告警媒体失败', 500, 'ALARM_MEDIA_DELETE_FAILED'));
    }
};

