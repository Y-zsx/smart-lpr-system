import { Request, Response } from 'express';
import { getPlates } from '../utils/db';
import { stringify } from 'csv-stringify';

export const exportRecords = async (req: Request, res: Response) => {
    try {
        const { start, end, search } = req.query;
        
        let plates = await getPlates({
            start: start ? Number(start) : undefined,
            end: end ? Number(end) : undefined
        });

        // 搜索过滤（MySQL 查询中也可以实现，这里保持兼容）
        if (search) {
            const searchStr = String(search).toLowerCase();
            plates = plates.filter(p => p.number.toLowerCase().includes(searchStr));
        }

        // Format for CSV
        const data = plates.map(p => ({
            ID: p.id,
            车牌号: p.number,
            类型: p.type,
            时间: new Date(p.timestamp).toLocaleString(),
            置信度: (p.confidence * 100).toFixed(2) + '%',
            位置: p.location || '-',
            图片: p.imageUrl || '-'
        }));

        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename=plates-${Date.now()}.csv`);

        stringify(data, { header: true }).pipe(res);
    } catch (error) {
        console.error('Error exporting records:', error);
        res.status(500).send('Error exporting records');
    }
};
