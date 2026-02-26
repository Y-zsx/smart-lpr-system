import { NextFunction, Request, Response } from 'express';
import {
    getCamerasFromDb,
    saveCameraToDb,
    deleteCameraFromDb,
    getCameraByIdFromDb,
    countCameraUrlReferences,
    Camera
} from '../../utils/db';
import { AuthenticatedRequest } from '../auth';
import { filterItemsByScope } from '../../utils/dataScope';
import { AppError } from '../../utils/AppError';
import { deleteStoredFile } from '../../services/storageService';

export const getCameras = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
        const cameras = await getCamerasFromDb();
        const scoped = filterItemsByScope(cameras, c => c.id, c => c.regionCode, req.dataScope);
        res.json(scoped);
    } catch (error) {
        console.error('Error fetching cameras:', error);
        next(new AppError('Error fetching cameras', 500, 'CAMERAS_FETCH_FAILED'));
    }
};

export const addCamera = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const cameraData: Omit<Camera, 'id' | 'status'> = req.body;
        const newCamera: Camera = {
            ...cameraData,
            id: `cam-${Date.now()}`,
            status: 'offline',
            lastActive: Date.now()
        };
        const savedCamera = await saveCameraToDb(newCamera);
        res.json(savedCamera);
    } catch (error) {
        console.error('Error adding camera:', error);
        next(new AppError('Error adding camera', 500, 'CAMERA_CREATE_FAILED'));
    }
};

export const updateCamera = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { id } = req.params;
        const cameraData: Partial<Camera> = req.body;
        const cameras = await getCamerasFromDb();
        const camera = cameras.find(c => c.id === id);
        if (!camera) {
            next(new AppError('Camera not found', 404, 'CAMERA_NOT_FOUND'));
            return;
        }
        const updatedCamera = { ...camera, ...cameraData };
        await saveCameraToDb(updatedCamera);
        res.json(updatedCamera);
    } catch (error) {
        console.error('Error updating camera:', error);
        next(new AppError('Error updating camera', 500, 'CAMERA_UPDATE_FAILED'));
    }
};

export const deleteCamera = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { id } = req.query;
        if (!id || typeof id !== 'string') {
            next(new AppError('Camera ID is required', 400, 'VALIDATION_ERROR'));
            return;
        }
        const camera = await getCameraByIdFromDb(id);
        await deleteCameraFromDb(id);
        if (camera?.type === 'file' && camera.url) {
            const refs = await countCameraUrlReferences(camera.url);
            if (refs === 0) {
                await deleteStoredFile(camera.url).catch((error) => {
                    console.warn('Failed to cleanup camera media file:', camera.url, error);
                });
            }
        }
        res.json({ message: 'Camera deleted successfully' });
    } catch (error) {
        console.error('Error deleting camera:', error);
        next(new AppError('Error deleting camera', 500, 'CAMERA_DELETE_FAILED'));
    }
};
