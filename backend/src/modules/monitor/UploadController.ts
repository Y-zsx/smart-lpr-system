import { Request, Response } from 'express';
import path from 'path';
import fs from 'fs-extra';

const UPLOAD_DIR = path.join(__dirname, '../../../uploads');
fs.ensureDirSync(UPLOAD_DIR);

export const getUploadUrl = async (req: Request, res: Response) => {
    const { filename } = req.body;
    if (!filename) {
        res.status(400).json({ message: 'Filename is required' });
        return;
    }
    const uniqueFilename = `${Date.now()}-${filename}`;
    const uploadUrl = `http://localhost:${process.env.PORT || 8000}/api/upload/put/${uniqueFilename}`;
    const key = `uploads/${uniqueFilename}`;
    res.json({
        upload_url: uploadUrl,
        requiredHeaders: { 'Content-Type': 'application/octet-stream' },
        key
    });
};

export const handleFileUpload = async (req: Request, res: Response) => {
    const { filename } = req.params;
    if (!filename) {
        res.status(400).json({ message: 'Filename is required' });
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
        res.status(500).json({ message: 'Upload failed' });
    });
};
