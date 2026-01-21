import { Router, Request, Response } from 'express';
import multer from 'multer';
import path from 'path';
import * as PlateController from '../controllers/PlateController';
import * as StatsController from '../controllers/StatsController';
import * as UploadController from '../controllers/UploadController';
import * as BlacklistController from '../controllers/BlacklistController';
import * as AlarmController from '../controllers/AlarmController';

const router = Router();
const upload = multer({ dest: path.join(__dirname, '../../uploads/temp') });

// Plates
router.get('/plates', PlateController.getPlates);
router.post('/plates', PlateController.savePlate);
router.post('/recognize', upload.single('file'), PlateController.recognizePlate);

// Upload
router.post('/upload-url', UploadController.getUploadUrl);
router.put('/upload/put/:filename', UploadController.handleFileUpload);

// Stats
router.get('/stats/daily', StatsController.getDailyStats);
router.get('/stats/dashboard', StatsController.getDashboardStats);
router.get('/stats/region', StatsController.getRegionStats);

// Export
router.get('/export-records', (req: Request, res: Response) => {
    // TODO: Implement export records logic with csv-stringify
    res.status(501).send('Not Implemented');
});

// Blacklist
router.get('/blacklist', BlacklistController.getBlacklist);
router.post('/blacklist', BlacklistController.addBlacklist);
router.delete('/blacklist', BlacklistController.deleteBlacklist);

// Alarms
router.get('/alarms', AlarmController.getAlarms);

export default router;
