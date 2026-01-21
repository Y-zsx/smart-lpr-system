import { Request, Response } from 'express';
import { getDb, saveDb } from '../utils/db';
import { LicensePlate, PlateType } from '../types';
import { v4 as uuidv4 } from 'uuid';

export const getPlates = async (req: Request, res: Response) => {
    try {
        const db = await getDb();
        let plates = db.plates;

        const { start, end, type } = req.query;

        if (start) {
            plates = plates.filter(p => p.timestamp >= Number(start));
        }
        if (end) {
            plates = plates.filter(p => p.timestamp <= Number(end));
        }
        if (type) {
            plates = plates.filter(p => p.type === type);
        }

        // Sort by timestamp desc
        plates.sort((a, b) => b.timestamp - a.timestamp);

        res.json(plates);
    } catch (error) {
        res.status(500).json({ message: 'Error fetching plates' });
    }
};

export const savePlate = async (req: Request, res: Response) => {
    try {
        const plateData: LicensePlate = req.body;
        const db = await getDb();

        const newPlate: LicensePlate = {
            ...plateData,
            id: plateData.id || uuidv4(),
            timestamp: plateData.timestamp || Date.now(),
            saved: true
        };

        db.plates.push(newPlate);
        
        // Check blacklist logic here could be added
        // If plate is in blacklist, create alarm
        const blacklistItem = db.blacklist.find(b => b.plate_number === newPlate.number);
        if (blacklistItem) {
            db.alarms.push({
                id: Date.now(),
                plate_id: newPlate.id,
                blacklist_id: blacklistItem.id,
                timestamp: Date.now(),
                is_read: 0,
                plate_number: newPlate.number,
                image_path: newPlate.imageUrl,
                location: newPlate.location,
                reason: `Blacklisted: ${blacklistItem.reason}`,
                severity: blacklistItem.severity
            });
        }

        await saveDb(db);
        res.json(newPlate);
    } catch (error) {
        res.status(500).json({ message: 'Error saving plate' });
    }
};

export const recognizePlate = async (req: Request, res: Response) => {
    // Mock recognition
    // In a real app, this would call an OCR service or run a local model
    try {
        const file = req.file; // From multer
        
        // Simulate processing delay
        await new Promise(resolve => setTimeout(resolve, 1000));

        const isGreen = Math.random() > 0.7;
        const mockPlate: LicensePlate = {
            id: uuidv4(),
            number: generateMockPlate(isGreen),
            type: isGreen ? 'green' : 'blue',
            confidence: 0.85 + Math.random() * 0.14,
            timestamp: Date.now(),
            rect: { x: 100, y: 100, w: 200, h: 100 },
            saved: true,
            location: 'Camera 1',
            imageUrl: file ? `uploads/${file.filename}` : ''
        };

        // Save to DB automatically? Usually recognition just returns result, user confirms save.
        // But requirement says "Save a new record" is a separate API.
        // However, usually OCR endpoint returns the result.
        
        res.json(mockPlate);
    } catch (error) {
        res.status(500).json({ message: 'Error recognizing plate' });
    }
};

function generateMockPlate(isGreen: boolean) {
    const provinces = ['京', '沪', '粤', '苏', '浙', '湘', '鄂'];
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
    const nums = '0123456789';

    const province = provinces[Math.floor(Math.random() * provinces.length)];
    const city = chars[Math.floor(Math.random() * chars.length)];

    let number = '';
    const length = isGreen ? 6 : 5;

    for (let i = 0; i < length; i++) {
        number += nums[Math.floor(Math.random() * nums.length)];
    }

    return `${province}${city}·${number}`;
}
