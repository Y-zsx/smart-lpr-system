import { create } from 'zustand';
import { Plate, PlateStats } from '../types/plate';

interface PlateStore {
    plates: Plate[];
    stats: PlateStats;
    isScanning: boolean;
    settings: {
        confidenceThreshold: number; // 0-1
        scanInterval: number; // ms
        enableHaptics: boolean;
    };
    setPlates: (plates: Plate[]) => void;
    addPlate: (plate: Plate) => void;
    setScanning: (isScanning: boolean) => void;
    updateSettings: (settings: Partial<PlateStore['settings']>) => void;
}

export const usePlateStore = create<PlateStore>((set) => ({
    plates: [],
    stats: { total: 0, blue: 0, green: 0, yellow: 0, other: 0 },
    isScanning: false,
    settings: {
        confidenceThreshold: 0.7,
        scanInterval: 2000,
        enableHaptics: true,
    },
    setPlates: (plates) => set((state) => {
        const stats = plates.reduce((acc, plate) => {
            acc.total++;
            if (plate.type === 'blue') acc.blue++;
            else if (plate.type === 'green') acc.green++;
            else if (plate.type === 'yellow') acc.yellow++;
            else acc.other++;
            return acc;
        }, { total: 0, blue: 0, green: 0, yellow: 0, other: 0 });

        return { plates, stats };
    }),
    addPlate: (plate) => set((state) => {
        const newPlates = [plate, ...state.plates];
        const newStats = { ...state.stats };
        newStats.total++;
        if (plate.type === 'blue') newStats.blue++;
        else if (plate.type === 'green') newStats.green++;
        else if (plate.type === 'yellow') newStats.yellow++;
        else newStats.other++;

        return { plates: newPlates, stats: newStats };
    }),
    setScanning: (isScanning) => set({ isScanning }),
    updateSettings: (newSettings) => set((state) => ({
        settings: { ...state.settings, ...newSettings }
    })),
}));
