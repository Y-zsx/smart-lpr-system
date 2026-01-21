import { Request, Response } from 'express';
import { getDb, saveDb } from '../utils/db';
import { BlacklistItem } from '../types';

export const getBlacklist = async (req: Request, res: Response) => {
    try {
        const db = await getDb();
        res.json(db.blacklist);
    } catch (error) {
        res.status(500).json({ message: 'Error fetching blacklist' });
    }
};

export const addBlacklist = async (req: Request, res: Response) => {
    try {
        const db = await getDb();
        const data = req.body;
        
        const items: BlacklistItem[] = Array.isArray(data) ? data : [data];
        const newItems = items.map(item => ({
            ...item,
            id: Date.now() + Math.floor(Math.random() * 1000),
            created_at: Date.now()
        }));

        db.blacklist.push(...newItems);
        await saveDb(db);

        res.json(Array.isArray(data) ? newItems : newItems[0]);
    } catch (error) {
        res.status(500).json({ message: 'Error adding to blacklist' });
    }
};

export const deleteBlacklist = async (req: Request, res: Response) => {
    try {
        const { id } = req.query;
        if (!id) {
            res.status(400).json({ message: 'ID is required' });
            return;
        }

        const db = await getDb();
        const initialLength = db.blacklist.length;
        db.blacklist = db.blacklist.filter(item => item.id !== Number(id));

        if (db.blacklist.length === initialLength) {
            res.status(404).json({ message: 'Item not found' });
            return;
        }

        await saveDb(db);
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ message: 'Error deleting from blacklist' });
    }
};
