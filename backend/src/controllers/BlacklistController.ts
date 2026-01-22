import { Request, Response } from 'express';
import { getBlacklist as getBlacklistFromDb, addBlacklist as addBlacklistToDb, deleteBlacklist as deleteBlacklistFromDb } from '../utils/db';
import { BlacklistItem } from '../types';

export const getBlacklist = async (req: Request, res: Response) => {
    try {
        const blacklist = await getBlacklistFromDb();
        res.json(blacklist);
    } catch (error) {
        console.error('Error fetching blacklist:', error);
        res.status(500).json({ message: 'Error fetching blacklist' });
    }
};

export const addBlacklist = async (req: Request, res: Response) => {
    try {
        const data = req.body;
        
        const items: Omit<BlacklistItem, 'id' | 'created_at'>[] = Array.isArray(data) ? data : [data];
        const newItems = await Promise.all(
            items.map(item => addBlacklistToDb({
                plate_number: item.plate_number,
                reason: item.reason,
                severity: item.severity
            }))
        );

        res.json(Array.isArray(data) ? newItems : newItems[0]);
    } catch (error) {
        console.error('Error adding to blacklist:', error);
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

        const deleted = await deleteBlacklistFromDb(Number(id));
        if (!deleted) {
            res.status(404).json({ message: 'Item not found' });
            return;
        }

        res.json({ success: true });
    } catch (error) {
        console.error('Error deleting from blacklist:', error);
        res.status(500).json({ message: 'Error deleting from blacklist' });
    }
};
