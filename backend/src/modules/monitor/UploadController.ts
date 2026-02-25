import { NextFunction, Request, Response } from 'express';
import path from 'path';
import fs from 'fs-extra';
import { AppError } from '../../utils/AppError';

const UPLOAD_DIR = path.join(__dirname, '../../../uploads');
fs.ensureDirSync(UPLOAD_DIR);

export const getUploadUrl = async (req: Request, res: Response, next: NextFunction) => {
    const { filename } = req.body;
    if (!filename) {
        next(new AppError('Filename is required', 400, 'VALIDATION_ERROR'));
        return;
    }
    const uniqueFilename = `${Date.now()}-${filename}`;
    const baseUrl = process.env.PUBLIC_BASE_URL || `${req.protocol}://${req.get('host')}`;
    const uploadUrl = `${baseUrl}/api/upload/put/${uniqueFilename}`;
    const key = `uploads/${uniqueFilename}`;
    res.json({
        upload_url: uploadUrl,
        requiredHeaders: { 'Content-Type': 'application/octet-stream' },
        key
    });
};

export const handleFileUpload = async (req: Request, res: Response, next: NextFunction) => {
    const { filename } = req.params;
    if (!filename) {
        next(new AppError('Filename is required', 400, 'VALIDATION_ERROR'));
        return;
    }
    const filePath = path.join(UPLOAD_DIR, filename as string);
    const writeStream = fs.createWriteStream(filePath);
    req.pipe(writeStream);
    writeStream.on('finish', () => {
        res.json({ message: 'Upload successful', path: `uploads/${filename}` });
    });
    writeStream.on('error', (err) => {
        console.error('Upload error:', err);
        next(new AppError('Upload failed', 500, 'UPLOAD_FAILED'));
    });
};
