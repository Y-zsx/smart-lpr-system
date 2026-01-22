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
        isDemoMode: boolean;
    };
    setPlates: (plates: Plate[]) => void;
    setStats: (stats: PlateStats) => void;
    setTrends: (trends: any) => void;
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
        isDemoMode: false,
    },
    setPlates: (plates) => set((state) => {
        // 检查是否是分组数据（PlateGroup[]）
        const isGroupData = Array.isArray(plates) && plates.length > 0 && 'plateNumber' in plates[0] && 'records' in plates[0];
        
        let baseStats;
        if (isGroupData) {
            // 从分组数据计算统计（不重复车牌数）
            baseStats = (plates as any[]).reduce((acc, group) => {
                acc.total++;
                if (group.plateType === 'blue') acc.blue++;
                else if (group.plateType === 'green') acc.green++;
                else if (group.plateType === 'yellow') acc.yellow++;
                else acc.other++;
                return acc;
            }, { total: 0, blue: 0, green: 0, yellow: 0, other: 0 });
        } else {
            // 从单条记录计算统计（兼容旧数据）
            baseStats = (plates as any[]).reduce((acc, plate) => {
                acc.total++;
                if (plate.type === 'blue') acc.blue++;
                else if (plate.type === 'green') acc.green++;
                else if (plate.type === 'yellow') acc.yellow++;
                else acc.other++;
                return acc;
            }, { total: 0, blue: 0, green: 0, yellow: 0, other: 0 });
        }

        // 保留现有的 trends 数据
        const stats = {
            ...baseStats,
            trends: state.stats.trends
        };

        return { plates, stats };
    }),
    setStats: (stats) => set({ stats }),
    setTrends: (trends) => set((state) => ({
        stats: { ...state.stats, trends }
    })),
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
