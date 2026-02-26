import path from 'path';
import fs from 'fs-extra';
import { spawn } from 'child_process';
import { pool } from '../config/database';
import { RowDataPacket, ResultSetHeader } from 'mysql2';
import { deleteStoredFile, persistTempFile } from './storageService';

const ALARM_CLIP_ENABLED = (process.env.ALARM_CLIP_ENABLED || 'true').trim().toLowerCase() !== 'false';
const ALARM_CLIP_DURATION_SEC = Math.max(3, Number(process.env.ALARM_CLIP_DURATION_SEC || 12));
const ALARM_CLIP_TIMEOUT_MS = Math.max(5000, Number(process.env.ALARM_CLIP_TIMEOUT_MS || 45000));
const ALARM_CLIP_FFMPEG_BIN = (process.env.ALARM_CLIP_FFMPEG_BIN || 'ffmpeg').trim() || 'ffmpeg';
const TEMP_CLIP_DIR = path.join(__dirname, '../../uploads/temp/alarm-clips');
fs.ensureDirSync(TEMP_CLIP_DIR);

export type AlarmMediaStatus = 'pending' | 'processing' | 'ready' | 'failed';

export interface AlarmMediaItem {
    id: number;
    alarmId?: number;
    recordId?: string;
    plateNumber?: string;
    cameraId?: string;
    mediaType: 'video' | 'image';
    mediaPath?: string;
    durationSec?: number;
    sizeBytes?: number;
    status: AlarmMediaStatus;
    errorMessage?: string;
    createdAt: number;
    updatedAt: number;
}

interface CreateTaskInput {
    alarmId?: number;
    recordId?: string;
    plateNumber?: string;
    cameraId?: string;
    durationSec?: number;
}

export interface AlarmCaptureSource {
    alarmId: number;
    recordId?: string;
    plateNumber?: string;
    cameraId?: string;
}

const isRtspUrl = (url: string): boolean => /^rtsps?:\/\//i.test(url);

const runFfmpegCapture = async (streamUrl: string, outputPath: string, durationSec: number): Promise<void> => {
    const args: string[] = ['-hide_banner', '-loglevel', 'error', '-y'];
    if (isRtspUrl(streamUrl)) {
        args.push('-rtsp_transport', 'tcp');
    }
    args.push(
        '-i', streamUrl,
        '-t', String(durationSec),
        '-an',
        '-c:v', 'libx264',
        '-preset', 'veryfast',
        '-movflags', '+faststart',
        outputPath
    );

    await new Promise<void>((resolve, reject) => {
        const ffmpeg = spawn(ALARM_CLIP_FFMPEG_BIN, args, {
            stdio: ['ignore', 'ignore', 'pipe']
        });
        let stderr = '';
        let timeoutHit = false;
        const timer = setTimeout(() => {
            timeoutHit = true;
            ffmpeg.kill('SIGKILL');
        }, ALARM_CLIP_TIMEOUT_MS);

        ffmpeg.stderr.on('data', (chunk: Buffer) => {
            stderr = (stderr + chunk.toString('utf8')).slice(-2000);
        });
        ffmpeg.on('error', (error) => {
            clearTimeout(timer);
            reject(error);
        });
        ffmpeg.on('close', (code) => {
            clearTimeout(timer);
            if (timeoutHit) {
                reject(new Error(`ffmpeg timeout after ${ALARM_CLIP_TIMEOUT_MS}ms`));
                return;
            }
            if (code !== 0) {
                reject(new Error(`ffmpeg exited with code ${code}: ${stderr}`));
                return;
            }
            resolve();
        });
    });
};

const updateTaskStatus = async (
    id: number,
    patch: Partial<{
        status: AlarmMediaStatus;
        mediaPath: string | null;
        durationSec: number | null;
        sizeBytes: number | null;
        errorMessage: string | null;
    }>
) => {
    const connection = await pool.getConnection();
    try {
        await connection.execute(
            `UPDATE \`alarm_media\`
             SET \`status\` = COALESCE(?, \`status\`),
                 \`media_path\` = COALESCE(?, \`media_path\`),
                 \`duration_sec\` = COALESCE(?, \`duration_sec\`),
                 \`size_bytes\` = COALESCE(?, \`size_bytes\`),
                 \`error_message\` = ?,
                 \`updated_at\` = ?
             WHERE \`id\` = ?`,
            [
                patch.status || null,
                patch.mediaPath || null,
                typeof patch.durationSec === 'number' ? patch.durationSec : null,
                typeof patch.sizeBytes === 'number' ? patch.sizeBytes : null,
                patch.errorMessage ?? null,
                Date.now(),
                id
            ]
        );
    } finally {
        connection.release();
    }
};

const getCameraStreamUrl = async (cameraId: string): Promise<string | null> => {
    const connection = await pool.getConnection();
    try {
        const [rows] = await connection.execute<RowDataPacket[]>(
            'SELECT `url` FROM `cameras` WHERE `id` = ? LIMIT 1',
            [cameraId]
        );
        if (rows.length === 0) return null;
        return rows[0].url ? String(rows[0].url) : null;
    } catch (error: any) {
        if (error.code === 'ER_NO_SUCH_TABLE') {
            return null;
        }
        throw error;
    } finally {
        connection.release();
    }
};

const processTask = async (task: AlarmMediaItem) => {
    const durationSec = Math.max(3, task.durationSec || ALARM_CLIP_DURATION_SEC);
    if (!task.cameraId) {
        await updateTaskStatus(task.id, {
            status: 'failed',
            errorMessage: 'camera_id is required'
        });
        return;
    }
    const streamUrl = await getCameraStreamUrl(task.cameraId);
    if (!streamUrl) {
        await updateTaskStatus(task.id, {
            status: 'failed',
            errorMessage: 'camera stream url not found'
        });
        return;
    }

    await updateTaskStatus(task.id, { status: 'processing', errorMessage: null });
    const tempFilename = `alarm-${task.id}-${Date.now()}.mp4`;
    const tempPath = path.join(TEMP_CLIP_DIR, tempFilename);
    try {
        await runFfmpegCapture(streamUrl, tempPath, durationSec);
        const stat = await fs.stat(tempPath);
        const mediaPath = await persistTempFile(tempPath, {
            originalName: tempFilename,
            mimeType: 'video/mp4',
            category: 'clips'
        });
        await updateTaskStatus(task.id, {
            status: 'ready',
            mediaPath,
            durationSec,
            sizeBytes: stat.size,
            errorMessage: null
        });
    } catch (error) {
        await updateTaskStatus(task.id, {
            status: 'failed',
            errorMessage: error instanceof Error ? error.message.slice(0, 480) : 'capture failed'
        });
    } finally {
        await fs.remove(tempPath).catch(() => undefined);
    }
};

const mapRow = (row: RowDataPacket): AlarmMediaItem => ({
    id: row.id,
    alarmId: row.alarm_id ?? undefined,
    recordId: row.record_id ?? undefined,
    plateNumber: row.plate_number ?? undefined,
    cameraId: row.camera_id ?? undefined,
    mediaType: row.media_type,
    mediaPath: row.media_path ?? undefined,
    durationSec: row.duration_sec ?? undefined,
    sizeBytes: row.size_bytes ?? undefined,
    status: row.status,
    errorMessage: row.error_message ?? undefined,
    createdAt: Number(row.created_at),
    updatedAt: Number(row.updated_at)
});

export const createAlarmMediaTask = async (input: CreateTaskInput): Promise<AlarmMediaItem> => {
    const durationSec = Math.max(3, input.durationSec || ALARM_CLIP_DURATION_SEC);
    const now = Date.now();
    const connection = await pool.getConnection();
    try {
        const [result] = await connection.execute<ResultSetHeader>(
            `INSERT INTO \`alarm_media\`
            (\`alarm_id\`, \`record_id\`, \`plate_number\`, \`camera_id\`, \`media_type\`, \`status\`, \`duration_sec\`, \`created_at\`, \`updated_at\`)
            VALUES (?, ?, ?, ?, 'video', 'pending', ?, ?, ?)`,
            [
                input.alarmId || null,
                input.recordId || null,
                input.plateNumber || null,
                input.cameraId || null,
                durationSec,
                now,
                now
            ]
        );
        const item: AlarmMediaItem = {
            id: result.insertId,
            alarmId: input.alarmId,
            recordId: input.recordId,
            plateNumber: input.plateNumber,
            cameraId: input.cameraId,
            mediaType: 'video',
            status: 'pending',
            durationSec,
            createdAt: now,
            updatedAt: now
        };
        return item;
    } finally {
        connection.release();
    }
};

export const getAlarmCaptureSourceByAlarmId = async (alarmId: number): Promise<AlarmCaptureSource | null> => {
    const connection = await pool.getConnection();
    try {
        const [rows] = await connection.execute<RowDataPacket[]>(
            'SELECT `id`, `record_id`, `plate_number`, `camera_id` FROM `alarms` WHERE `id` = ? LIMIT 1',
            [alarmId]
        );
        if (rows.length === 0) return null;
        const row = rows[0];
        return {
            alarmId: Number(row.id),
            recordId: row.record_id || undefined,
            plateNumber: row.plate_number || undefined,
            cameraId: row.camera_id || undefined
        };
    } finally {
        connection.release();
    }
};

export const enqueueAlarmClipCapture = async (input: CreateTaskInput): Promise<AlarmMediaItem | null> => {
    if (!ALARM_CLIP_ENABLED) return null;
    const task = await createAlarmMediaTask(input);
    void processTask(task).catch((error) => {
        console.error('[AlarmMedia] process task failed:', error);
    });
    return task;
};

export const listAlarmMedia = async (filters?: {
    alarmId?: number;
    recordId?: string;
    cameraId?: string;
    status?: AlarmMediaStatus;
}): Promise<AlarmMediaItem[]> => {
    const connection = await pool.getConnection();
    try {
        let query = 'SELECT * FROM `alarm_media` WHERE 1=1';
        const params: any[] = [];
        if (typeof filters?.alarmId === 'number') {
            query += ' AND `alarm_id` = ?';
            params.push(filters.alarmId);
        }
        if (filters?.recordId) {
            query += ' AND `record_id` = ?';
            params.push(filters.recordId);
        }
        if (filters?.cameraId) {
            query += ' AND `camera_id` = ?';
            params.push(filters.cameraId);
        }
        if (filters?.status) {
            query += ' AND `status` = ?';
            params.push(filters.status);
        }
        query += ' ORDER BY `created_at` DESC LIMIT 500';
        const [rows] = await connection.execute<RowDataPacket[]>(query, params);
        return rows.map(mapRow);
    } finally {
        connection.release();
    }
};

export const getAlarmMediaById = async (id: number): Promise<AlarmMediaItem | null> => {
    const connection = await pool.getConnection();
    try {
        const [rows] = await connection.execute<RowDataPacket[]>(
            'SELECT * FROM `alarm_media` WHERE `id` = ? LIMIT 1',
            [id]
        );
        if (rows.length === 0) return null;
        return mapRow(rows[0]);
    } finally {
        connection.release();
    }
};

export const updateAlarmMedia = async (
    id: number,
    patch: Partial<Pick<AlarmMediaItem, 'status' | 'errorMessage' | 'durationSec'>>
): Promise<boolean> => {
    const connection = await pool.getConnection();
    try {
        const [result] = await connection.execute<ResultSetHeader>(
            `UPDATE \`alarm_media\`
             SET \`status\` = COALESCE(?, \`status\`),
                 \`duration_sec\` = COALESCE(?, \`duration_sec\`),
                 \`error_message\` = ?,
                 \`updated_at\` = ?
             WHERE \`id\` = ?`,
            [
                patch.status || null,
                typeof patch.durationSec === 'number' ? patch.durationSec : null,
                patch.errorMessage ?? null,
                Date.now(),
                id
            ]
        );
        return result.affectedRows > 0;
    } finally {
        connection.release();
    }
};

export const deleteAlarmMedia = async (id: number): Promise<boolean> => {
    const item = await getAlarmMediaById(id);
    if (!item) return false;
    const connection = await pool.getConnection();
    try {
        await connection.beginTransaction();
        await connection.execute<ResultSetHeader>('DELETE FROM `alarm_media` WHERE `id` = ?', [id]);
        if (item.mediaPath) {
            const [rows] = await connection.execute<RowDataPacket[]>(
                'SELECT COUNT(*) AS `count` FROM `alarm_media` WHERE `media_path` = ?',
                [item.mediaPath]
            );
            const refCount = Number(rows[0]?.count || 0);
            if (refCount === 0) {
                await deleteStoredFile(item.mediaPath).catch((error) => {
                    console.warn('[AlarmMedia] failed to delete media file:', error);
                });
            }
        }
        await connection.commit();
        return true;
    } catch (error) {
        await connection.rollback();
        throw error;
    } finally {
        connection.release();
    }
};

