import { NextFunction, Request, Response } from 'express';
import fs from 'fs-extra';
import path from 'path';
import { Readable } from 'stream';
import { AppError } from '../../utils/AppError';
import { resolveDownloadSource } from '../../services/storageService';

const sanitizeDownloadFilename = (filename?: string): string => {
    const raw = (filename || '').trim();
    if (!raw) return `media-${Date.now()}.jpg`;
    return raw.replace(/[<>:"/\\|?*\x00-\x1F]/g, '_');
};

const tryDetectContentType = (filename: string): string => {
    const ext = path.extname(filename).toLowerCase();
    if (ext === '.png') return 'image/png';
    if (ext === '.webp') return 'image/webp';
    if (ext === '.gif') return 'image/gif';
    if (ext === '.bmp') return 'image/bmp';
    return 'image/jpeg';
};

export const redirectMedia = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const sourcePath = typeof req.query.path === 'string' ? req.query.path.trim() : '';
        if (!sourcePath) {
            next(new AppError('缺少 path 参数', 400, 'VALIDATION_ERROR'));
            return;
        }
        const source = resolveDownloadSource(sourcePath);
        if (source.type === 'none') {
            next(new AppError('无效的媒体路径', 400, 'INVALID_MEDIA_PATH'));
            return;
        }
        if (source.type === 'httpRedirect' && source.redirectUrl) {
            res.redirect(source.redirectUrl);
            return;
        }
        if (source.type === 'localFile' && source.localPath) {
            const exists = await fs.pathExists(source.localPath);
            if (!exists) {
                next(new AppError('媒体文件不存在', 404, 'MEDIA_NOT_FOUND'));
                return;
            }
            res.sendFile(source.localPath);
            return;
        }
        next(new AppError('不支持的媒体路径', 400, 'INVALID_MEDIA_PATH'));
    } catch (error) {
        next(error);
    }
};

export const downloadMedia = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const sourcePath = typeof req.query.path === 'string' ? req.query.path.trim() : '';
        const filename = sanitizeDownloadFilename(
            typeof req.query.filename === 'string' ? req.query.filename : undefined
        );
        if (!sourcePath) {
            next(new AppError('缺少 path 参数', 400, 'VALIDATION_ERROR'));
            return;
        }
        const source = resolveDownloadSource(sourcePath);
        if (source.type === 'none') {
            next(new AppError('无效的媒体路径', 400, 'INVALID_MEDIA_PATH'));
            return;
        }
        if (source.type === 'httpRedirect' && source.redirectUrl) {
            const upstream = await fetch(source.redirectUrl);
            if (!upstream.ok || !upstream.body) {
                next(new AppError('媒体文件不存在', 404, 'MEDIA_NOT_FOUND'));
                return;
            }
            const contentType = upstream.headers.get('content-type') || tryDetectContentType(filename);
            res.setHeader('Content-Type', contentType);
            res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`);
            Readable.fromWeb(upstream.body as any).pipe(res);
            return;
        }
        if (source.type === 'localFile' && source.localPath) {
            const exists = await fs.pathExists(source.localPath);
            if (!exists) {
                next(new AppError('媒体文件不存在', 404, 'MEDIA_NOT_FOUND'));
                return;
            }
            res.setHeader('Content-Type', tryDetectContentType(filename));
            res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`);
            res.sendFile(source.localPath);
            return;
        }
        next(new AppError('不支持的媒体路径', 400, 'INVALID_MEDIA_PATH'));
    } catch (error) {
        next(error);
    }
};

