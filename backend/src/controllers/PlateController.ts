import { Request, Response } from 'express';
import { getDb, saveDb } from '../utils/db';
import { LicensePlate, PlateType } from '../types';
import { v4 as uuidv4 } from 'uuid';
import axios from 'axios';
import FormData from 'form-data';
import fs from 'fs-extra';

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
    try {
        const file = req.file; // From multer
        if (!file) {
             res.status(400).json({ message: 'No file uploaded' });
             return;
        }

        // Call Python AI Service
        try {
            const formData = new FormData();
            formData.append('file', fs.createReadStream(file.path));

            const aiResponse = await axios.post('http://localhost:8001/recognize', formData, {
                headers: {
                    ...formData.getHeaders()
                }
            });

            const aiPlates = aiResponse.data.plates;
            
            if (aiPlates && aiPlates.length > 0) {
                // Use the first detected plate
                const bestPlate = aiPlates[0];
                
                const plate: LicensePlate = {
                    id: uuidv4(),
                    number: bestPlate.number,
                    type: bestPlate.type as PlateType,
                    confidence: bestPlate.confidence,
                    timestamp: Date.now(),
                    rect: bestPlate.rect,
                    saved: false, // Not saved to DB yet, just recognized
                    location: 'Camera 1', // Default
                    imageUrl: `uploads/${file.filename}`
                };
                
                res.json(plate);
                return;
            } else {
                 // No plates found by AI
                 res.status(404).json({ message: 'No license plate detected' });
                 return;
            }

        } catch (aiError) {
            console.error('AI Service Error:', aiError);
            res.status(503).json({ message: 'AI Service unavailable. Please ensure python service is running on port 8001.' });
            return;
        }

    } catch (error) {
        console.error('Recognition error:', error);
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
