import { Request, Response } from 'express';
import { getDb } from '../utils/db';
import { stringify } from 'csv-stringify';

export const exportRecords = async (req: Request, res: Response) => {
    try {
        const db = await getDb();
        let plates = db.plates;
        const { start, end, search } = req.query;

        // Filter
        if (start) {
            plates = plates.filter(p => p.timestamp >= Number(start));
        }
        if (end) {
            plates = plates.filter(p => p.timestamp <= Number(end));
        }
        if (search) {
            const searchStr = String(search).toLowerCase();
            plates = plates.filter(p => p.number.toLowerCase().includes(searchStr));
        }

        // Sort
        plates.sort((a, b) => b.timestamp - a.timestamp);

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
        res.status(500).send('Error exporting records');
    }
};
