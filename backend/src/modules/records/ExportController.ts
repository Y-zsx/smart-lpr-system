import { NextFunction, Response } from 'express';
import { getAllPlateRecords } from '../../utils/db';
import { stringify } from 'csv-stringify';
import { AuthenticatedRequest } from '../auth';
import { filterItemsByScope } from '../../utils/dataScope';
import { AppError } from '../../utils/AppError';

export const exportRecords = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
        const { start, end, search } = req.query;

        let records = await getAllPlateRecords({
            start: start ? Number(start) : undefined,
            end: end ? Number(end) : undefined
        });

        records = filterItemsByScope(records, r => r.cameraId, r => r.regionCode, req.dataScope);

        if (search) {
            const searchStr = String(search).toLowerCase();
            records = records.filter(r =>
                r.plateNumber.toLowerCase().includes(searchStr) ||
                r.location?.toLowerCase().includes(searchStr) ||
                r.cameraName?.toLowerCase().includes(searchStr)
            );
        }

        const data = records.map(r => ({
            ID: r.id,
            车牌号: r.plateNumber,
            类型: r.plateType,
            时间: new Date(r.timestamp).toLocaleString('zh-CN'),
            置信度: (r.confidence * 100).toFixed(2) + '%',
            摄像头ID: r.cameraId || '-',
            摄像头名称: r.cameraName || '-',
            位置: r.location || '-',
            图片URL: r.imageUrl || '-'
        }));

        const filename = encodeURIComponent(`车牌识别记录_${Date.now()}.csv`);
        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${filename}`);
        res.write('\ufeff');
        stringify(data, { header: true, bom: false }).pipe(res);
    } catch (error) {
        console.error('Error exporting records:', error);
        next(new AppError('Error exporting records', 500, 'EXPORT_FAILED'));
    }
};
