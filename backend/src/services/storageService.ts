import path from 'path';
import { randomUUID } from 'crypto';
import fs from 'fs-extra';
import COS from 'cos-nodejs-sdk-v5';

export type StorageDriver = 'local' | 'cos';

const LOCAL_UPLOAD_DIR = path.join(__dirname, '../../uploads');
const LOCAL_RECORDS_DIR = path.join(LOCAL_UPLOAD_DIR, 'records');
const STORAGE_DRIVER = (process.env.STORAGE_DRIVER || 'local').trim().toLowerCase() as StorageDriver;

const COS_BUCKET = (process.env.COS_BUCKET || '').trim();
const COS_REGION = (process.env.COS_REGION || '').trim();
const COS_SECRET_ID = (process.env.COS_SECRET_ID || '').trim();
const COS_SECRET_KEY = (process.env.COS_SECRET_KEY || '').trim();
const COS_PUBLIC_BASE_URL = (process.env.COS_PUBLIC_BASE_URL || '').trim().replace(/\/+$/, '');
const COS_SIGNED_URL_EXPIRES = Math.max(60, Number(process.env.COS_SIGNED_URL_EXPIRES_SECONDS || 600));

fs.ensureDirSync(LOCAL_RECORDS_DIR);

let cosClient: COS | null = null;

const MIME_EXTENSION_MAP: Record<string, string> = {
    'image/jpeg': '.jpg',
    'image/jpg': '.jpg',
    'image/png': '.png',
    'image/webp': '.webp',
    'image/gif': '.gif',
    'image/bmp': '.bmp',
    'video/mp4': '.mp4',
    'video/webm': '.webm',
    'video/quicktime': '.mov',
    'video/x-matroska': '.mkv'
};

const sanitizeFilename = (input: string): string => input.replace(/[^a-zA-Z0-9._-]/g, '_');

const getFileExtension = (originalName?: string, mimeType?: string): string => {
    const extFromName = originalName ? path.extname(originalName).toLowerCase() : '';
    if (extFromName) return extFromName;
    if (mimeType && MIME_EXTENSION_MAP[mimeType.toLowerCase()]) {
        return MIME_EXTENSION_MAP[mimeType.toLowerCase()];
    }
    return '.jpg';
};

const getCosClient = (): COS => {
    if (cosClient) return cosClient;
    if (!COS_SECRET_ID || !COS_SECRET_KEY || !COS_BUCKET || !COS_REGION) {
        throw new Error('COS is not fully configured. Please set COS_BUCKET, COS_REGION, COS_SECRET_ID, COS_SECRET_KEY');
    }
    cosClient = new COS({
        SecretId: COS_SECRET_ID,
        SecretKey: COS_SECRET_KEY
    });
    return cosClient;
};

const toCosUri = (key: string): string => `cos://${COS_BUCKET}/${key}`;

const parseCosUri = (uri: string): { bucket: string; key: string } | null => {
    if (!uri.startsWith('cos://')) return null;
    const raw = uri.slice('cos://'.length);
    const firstSlash = raw.indexOf('/');
    if (firstSlash <= 0) return null;
    const bucket = raw.slice(0, firstSlash);
    const key = raw.slice(firstSlash + 1);
    if (!bucket || !key) return null;
    return { bucket, key };
};

const formatDatePath = (timestampMs: number): string => {
    const date = new Date(timestampMs);
    const yyyy = String(date.getFullYear());
    const mm = String(date.getMonth() + 1).padStart(2, '0');
    const dd = String(date.getDate()).padStart(2, '0');
    return `${yyyy}/${mm}/${dd}`;
};

export const persistTempFile = async (tempFilePath: string, options: {
    originalName?: string;
    mimeType?: string;
    category?: 'records' | 'uploads' | 'clips';
}): Promise<string> => {
    const ext = getFileExtension(options.originalName, options.mimeType);
    const now = Date.now();
    const safeName = sanitizeFilename(path.basename(options.originalName || `capture-${randomUUID()}${ext}`));
    const suffix = path.extname(safeName) ? '' : ext;
    const category = options.category || 'records';

    if (STORAGE_DRIVER === 'cos') {
        const key = `${category}/${formatDatePath(now)}/${randomUUID()}-${safeName}${suffix}`;
        const cos = getCosClient();
        await new Promise<void>((resolve, reject) => {
            cos.putObject(
                {
                    Bucket: COS_BUCKET,
                    Region: COS_REGION,
                    Key: key,
                    Body: fs.createReadStream(tempFilePath),
                    ContentType: options.mimeType || 'application/octet-stream'
                },
                (err) => {
                    if (err) reject(err);
                    else resolve();
                }
            );
        });
        return toCosUri(key);
    }

    const localName = `${now}-${randomUUID()}-${safeName}${suffix}`;
    const localCategoryDir = category === 'clips'
        ? path.join(LOCAL_UPLOAD_DIR, 'clips')
        : LOCAL_RECORDS_DIR;
    fs.ensureDirSync(localCategoryDir);
    const targetPath = path.join(localCategoryDir, localName);
    await fs.move(tempFilePath, targetPath, { overwrite: false });
    return `uploads/${category}/${localName}`;
};

export const deleteStoredFile = async (storedPath: string): Promise<void> => {
    if (!storedPath) return;
    if (storedPath.startsWith('uploads/')) {
        const relativePath = storedPath.replace(/^uploads\//, '');
        const absolutePath = path.join(LOCAL_UPLOAD_DIR, relativePath);
        await fs.remove(absolutePath);
        return;
    }
    if (storedPath.startsWith('cos://')) {
        const parsed = parseCosUri(storedPath);
        if (!parsed) return;
        const cos = getCosClient();
        await new Promise<void>((resolve, reject) => {
            cos.deleteObject(
                {
                    Bucket: parsed.bucket,
                    Region: COS_REGION,
                    Key: parsed.key
                },
                (err) => {
                    if (err) reject(err);
                    else resolve();
                }
            );
        });
    }
};

export const resolveDownloadSource = (storedPath: string): {
    type: 'httpRedirect' | 'localFile' | 'none';
    redirectUrl?: string;
    localPath?: string;
} => {
    if (!storedPath) return { type: 'none' };
    if (storedPath.startsWith('uploads/')) {
        const relativePath = storedPath.replace(/^uploads\//, '');
        return {
            type: 'localFile',
            localPath: path.join(LOCAL_UPLOAD_DIR, relativePath)
        };
    }
    if (storedPath.startsWith('cos://')) {
        const parsed = parseCosUri(storedPath);
        if (!parsed) return { type: 'none' };

        if (COS_PUBLIC_BASE_URL) {
            return {
                type: 'httpRedirect',
                redirectUrl: `${COS_PUBLIC_BASE_URL}/${parsed.key}`
            };
        }

        const cos = getCosClient();
        const signedUrl = cos.getObjectUrl({
            Bucket: parsed.bucket,
            Region: COS_REGION,
            Key: parsed.key,
            Sign: true,
            Expires: COS_SIGNED_URL_EXPIRES
        });
        return {
            type: 'httpRedirect',
            redirectUrl: signedUrl
        };
    }
    if (/^https?:\/\//i.test(storedPath)) {
        return {
            type: 'httpRedirect',
            redirectUrl: storedPath
        };
    }
    return { type: 'none' };
};

