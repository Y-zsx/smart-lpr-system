import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import rateLimit from 'express-rate-limit';
import * as PlateController from '../modules/records/PlateController';
import * as ExportController from '../modules/records/ExportController';
import * as StatsController from '../modules/stats/controller';
import * as UploadController from '../modules/monitor/UploadController';
import * as BlacklistController from '../modules/alarms/BlacklistController';
import * as AlarmController from '../modules/alarms/AlarmController';
import * as CameraController from '../modules/monitor/CameraController';
import * as AuthController from '../modules/auth/controller';
import * as IamController from '../modules/iam/controller';
import { applyDataScope, requireAuth, requirePermission } from '../modules/auth';

const router = Router();
const MAX_FILE_SIZE = Math.max(1024 * 1024, Number(process.env.MAX_FILE_SIZE || 10 * 1024 * 1024));
const authLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: Number(process.env.AUTH_RATE_LIMIT_PER_MINUTE || 12),
    standardHeaders: true,
    legacyHeaders: false
});
const recognizeLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: Number(process.env.RECOGNIZE_RATE_LIMIT_PER_MINUTE || 60),
    standardHeaders: true,
    legacyHeaders: false
});
const uploadLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: Number(process.env.UPLOAD_RATE_LIMIT_PER_MINUTE || 40),
    standardHeaders: true,
    legacyHeaders: false
});
const upload = multer({
    dest: path.join(__dirname, '../../uploads/temp'),
    limits: {
        fileSize: MAX_FILE_SIZE,
        files: 1
    },
    fileFilter: (_req, file, cb) => {
        const isImage = file.mimetype.startsWith('image/');
        if (!isImage) {
            cb(new Error('Only image files are allowed'));
            return;
        }
        cb(null, true);
    }
});

// Auth
router.post('/auth/login', authLimiter, AuthController.login);
router.get('/auth/me', requireAuth, AuthController.me);
router.get('/iam/users', requireAuth, requirePermission('iam.manage'), IamController.getUsers);
router.get('/iam/roles', requireAuth, requirePermission('iam.manage'), IamController.getRoles);
router.get('/iam/permissions', requireAuth, requirePermission('iam.manage'), IamController.getPermissions);
router.put('/iam/users/:userId/roles', requireAuth, requirePermission('iam.manage'), IamController.setUserRoles);
router.put('/iam/roles/:roleKey/permissions', requireAuth, requirePermission('iam.manage'), IamController.setRolePermissions);
router.put('/iam/roles/:roleKey/data-scope', requireAuth, requirePermission('iam.manage'), IamController.setRoleDataScope);

// Plates
router.get('/plates', requireAuth, requirePermission('records.view'), applyDataScope(), PlateController.getPlates);
router.post('/plates', requireAuth, requirePermission('plate.manage'), PlateController.savePlate);
router.delete('/plates', requireAuth, requirePermission('plate.manage'), PlateController.deletePlate);
router.delete('/plates/by-number', requireAuth, requirePermission('plate.manage'), PlateController.deletePlatesByNumber);
router.post('/recognize', recognizeLimiter, requireAuth, requirePermission('monitor.view'), requirePermission('plate.manage'), upload.single('file'), PlateController.recognizePlate);

// Upload
router.post('/upload-url', uploadLimiter, requireAuth, requirePermission('plate.manage'), UploadController.getUploadUrl);
router.put('/upload/put/:filename', uploadLimiter, requireAuth, requirePermission('plate.manage'), UploadController.handleFileUpload);

// Stats
router.get('/stats/daily', requireAuth, requirePermission('dashboard.view'), applyDataScope(), StatsController.getDailyStats);
router.get('/stats/dashboard', requireAuth, requirePermission('dashboard.view'), applyDataScope(), StatsController.getDashboardStats);
router.get('/stats/region', requireAuth, requirePermission('dashboard.view'), applyDataScope(), StatsController.getRegionStats);

// Export
router.get('/export-records', requireAuth, requirePermission('records.view'), applyDataScope(), ExportController.exportRecords);

// Blacklist
router.get('/blacklist', requireAuth, requirePermission('alarms.view'), BlacklistController.getBlacklist);
router.post('/blacklist', requireAuth, requirePermission('blacklist.manage'), BlacklistController.addBlacklist);
router.delete('/blacklist', requireAuth, requirePermission('blacklist.manage'), BlacklistController.deleteBlacklist);

// Alarms
router.get('/alarms', requireAuth, requirePermission('alarms.view'), applyDataScope(), AlarmController.getAlarms);
router.put('/alarms/:id/read', requireAuth, requirePermission('alarm.manage'), AlarmController.markAlarmAsRead);
router.delete('/alarms/:id', requireAuth, requirePermission('alarm.manage'), AlarmController.deleteAlarm);
router.delete('/alarms/plate/:plateNumber', requireAuth, requirePermission('alarm.manage'), AlarmController.deleteAlarmsByPlate);

// Cameras
router.get('/cameras', requireAuth, requirePermission('monitor.view'), applyDataScope(), CameraController.getCameras);
router.post('/cameras', requireAuth, requirePermission('camera.manage'), CameraController.addCamera);
router.put('/cameras/:id', requireAuth, requirePermission('camera.manage'), CameraController.updateCamera);
router.delete('/cameras', requireAuth, requirePermission('camera.manage'), CameraController.deleteCamera);

export default router;
