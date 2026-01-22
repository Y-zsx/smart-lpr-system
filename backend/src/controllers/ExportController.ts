import { Request, Response } from 'express';
import { getPlates } from '../utils/db';
import { stringify } from 'csv-stringify';

export const exportRecords = async (req: Request, res: Response) => {
    try {
        const { start, end, search } = req.query;
        
        // getPlates 现在会从 plate_records 表查询并返回所有记录（已更新）
        let plates = await getPlates({
            start: start ? Number(start) : undefined,
            end: end ? Number(end) : undefined
        });

        // 搜索过滤
        if (search) {
            const searchStr = String(search).toLowerCase();
            plates = plates.filter(p => 
                p.number.toLowerCase().includes(searchStr) ||
                p.location?.toLowerCase().includes(searchStr) ||
                p.cameraName?.toLowerCase().includes(searchStr)
            );
        }

        // Format for CSV - 包含摄像头信息
        const data = plates.map(p => ({
            ID: p.id,
            车牌号: p.number,
            类型: p.type,
            时间: new Date(p.timestamp).toLocaleString('zh-CN'),
            置信度: (p.confidence * 100).toFixed(2) + '%',
            摄像头ID: p.cameraId || '-',
            摄像头名称: p.cameraName || '-',
            位置: p.location || '-',
            图片URL: p.imageUrl || '-'
        }));

        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader('Content-Disposition', `attachment; filename=车牌识别记录_${Date.now()}.csv`);

        stringify(data, { header: true }).pipe(res);
    } catch (error) {
        console.error('Error exporting records:', error);
        res.status(500).send('Error exporting records');
    }
};
