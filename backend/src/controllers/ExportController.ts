import { Request, Response } from 'express';
import { getAllPlateRecords } from '../utils/db';
import { stringify } from 'csv-stringify';

export const exportRecords = async (req: Request, res: Response) => {
    try {
        const { start, end, search } = req.query;
        
        // 直接从 plate_records 表获取所有记录（不分组）
        let records = await getAllPlateRecords({
            start: start ? Number(start) : undefined,
            end: end ? Number(end) : undefined
        });

        // 搜索过滤
        if (search) {
            const searchStr = String(search).toLowerCase();
            records = records.filter(r => 
                r.plateNumber.toLowerCase().includes(searchStr) ||
                r.location?.toLowerCase().includes(searchStr) ||
                r.cameraName?.toLowerCase().includes(searchStr)
            );
        }

        // Format for CSV - 包含摄像头信息
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

        // 设置响应头
        const filename = encodeURIComponent(`车牌识别记录_${Date.now()}.csv`);
        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${filename}`);
        
        // 添加 UTF-8 BOM 头，确保 Excel 正确显示中文
        res.write('\ufeff');
        
        // 即使没有数据也导出表头
        stringify(data, { 
            header: true,
            bom: false // 手动添加 BOM，所以这里设为 false
        }).pipe(res);
    } catch (error) {
        console.error('Error exporting records:', error);
        res.status(500).json({ 
            message: 'Error exporting records',
            error: error instanceof Error ? error.message : String(error)
        });
    }
};
