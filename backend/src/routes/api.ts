import { Router, Request, Response } from 'express';
import multer from 'multer';
import path from 'path';
import * as PlateController from '../controllers/PlateController';
import * as StatsController from '../controllers/StatsController';
import * as UploadController from '../controllers/UploadController';
import * as BlacklistController from '../controllers/BlacklistController';
import * as AlarmController from '../controllers/AlarmController';
import * as ExportController from '../controllers/ExportController';
import * as CameraController from '../controllers/CameraController';

const router = Router();
const upload = multer({ dest: path.join(__dirname, '../../uploads/temp') });

// Plates
router.get('/plates', PlateController.getPlates);
router.post('/plates', PlateController.savePlate);
router.delete('/plates', PlateController.deletePlate);
router.delete('/plates/by-number', PlateController.deletePlatesByNumber);
router.post('/recognize', upload.single('file'), PlateController.recognizePlate);

// Upload
router.post('/upload-url', UploadController.getUploadUrl);
router.put('/upload/put/:filename', UploadController.handleFileUpload);

// Stats
router.get('/stats/daily', StatsController.getDailyStats);
router.get('/stats/dashboard', StatsController.getDashboardStats);
router.get('/stats/region', StatsController.getRegionStats);

// Export
router.get('/export-records', ExportController.exportRecords);

// Blacklist
router.get('/blacklist', BlacklistController.getBlacklist);
router.post('/blacklist', BlacklistController.addBlacklist);
router.delete('/blacklist', BlacklistController.deleteBlacklist);

// Alarms
router.use('/alarms', (req, res, next) => {
    console.log(`[API Router] Alarms route hit: ${req.method} ${req.url}`);
    next();
});
router.get('/alarms', AlarmController.getAlarms);
router.put('/alarms/:id/read', AlarmController.markAlarmAsRead);
router.delete('/alarms/:id', (req, res, next) => {
    console.log(`[API Router] DELETE /alarms/:id hit. ID: ${req.params.id}`);
    next();
}, AlarmController.deleteAlarm);
router.delete('/alarms/plate/:plateNumber', AlarmController.deleteAlarmsByPlate);

// Cameras
router.get('/cameras', CameraController.getCameras);
router.post('/cameras', CameraController.addCamera);
router.put('/cameras/:id', CameraController.updateCamera);
router.delete('/cameras', CameraController.deleteCamera);

export default router;
