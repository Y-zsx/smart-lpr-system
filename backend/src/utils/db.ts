import fs from 'fs-extra';
import path from 'path';
import { LicensePlate, BlacklistItem, Alarm } from '../types';

const DATA_DIR = path.join(__dirname, '../../data');
const DB_FILE = path.join(DATA_DIR, 'db.json');

interface Database {
    plates: LicensePlate[];
    blacklist: BlacklistItem[];
    alarms: Alarm[];
}

const defaultDb: Database = {
    plates: [],
    blacklist: [],
    alarms: []
};

// Ensure data directory exists
fs.ensureDirSync(DATA_DIR);

// Initialize DB if not exists
if (!fs.existsSync(DB_FILE)) {
    fs.writeJsonSync(DB_FILE, defaultDb, { spaces: 2 });
}

export const getDb = async (): Promise<Database> => {
    return fs.readJson(DB_FILE);
};

export const saveDb = async (db: Database): Promise<void> => {
    return fs.writeJson(DB_FILE, db, { spaces: 2 });
};
