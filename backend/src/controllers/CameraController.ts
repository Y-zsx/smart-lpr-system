import { Request, Response } from 'express';
import { getCamerasFromDb, saveCameraToDb, deleteCameraFromDb, Camera } from '../utils/db';

export const getCameras = async (req: Request, res: Response) => {
    try {
        const cameras = await getCamerasFromDb();
        res.json(cameras);
    } catch (error) {
        console.error('Error fetching cameras:', error);
        res.status(500).json({ message: 'Error fetching cameras' });
    }
};

export const addCamera = async (req: Request, res: Response) => {
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
        res.status(500).json({ message: 'Error adding camera' });
    }
};

export const updateCamera = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const cameraData: Partial<Camera> = req.body;
        
        const cameras = await getCamerasFromDb();
        const camera = cameras.find(c => c.id === id);
        
        if (!camera) {
            res.status(404).json({ message: 'Camera not found' });
            return;
        }

        const updatedCamera = { ...camera, ...cameraData };
        await saveCameraToDb(updatedCamera);
        res.json(updatedCamera);
    } catch (error) {
        console.error('Error updating camera:', error);
        res.status(500).json({ message: 'Error updating camera' });
    }
};

export const deleteCamera = async (req: Request, res: Response) => {
    try {
        const { id } = req.query;
        
        if (!id || typeof id !== 'string') {
            res.status(400).json({ message: 'Camera ID is required' });
            return;
        }

        await deleteCameraFromDb(id);
        res.json({ message: 'Camera deleted successfully' });
    } catch (error) {
        console.error('Error deleting camera:', error);
        res.status(500).json({ message: 'Error deleting camera' });
    }
};
