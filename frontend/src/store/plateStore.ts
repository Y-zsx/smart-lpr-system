import { create } from 'zustand';
import { Plate, PlateStats } from '../types/plate';
import { arePlateGroupsEqual, areStatsEqual } from '../utils/dataComparison';

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

export const usePlateStore = create<PlateStore>((set, get) => ({
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
        // 检查数据是否真的变化了
        const isGroupData = Array.isArray(plates) && plates.length > 0 && 'plateNumber' in plates[0] && 'records' in plates[0];
        
        // 如果是分组数据，比较关键字段
        if (isGroupData && arePlateGroupsEqual(state.plates as any[], plates as any[])) {
            return state; // 数据没有变化，不更新状态
        }
        
        // 如果不是分组数据，简单比较长度和引用
        if (!isGroupData && state.plates.length === plates.length && state.plates === plates) {
            return state; // 数据没有变化，不更新状态
        }
        
        // 检查是否是分组数据（PlateGroup[]）
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
        const newStats = {
            ...baseStats,
            trends: state.stats.trends
        };

        // 如果统计数据也没有变化，只更新plates
        if (areStatsEqual(state.stats, newStats)) {
            return { plates };
        }

        return { plates, stats: newStats };
    }),
    setStats: (stats) => set((state) => {
        // 比较统计数据是否真的变化了
        if (areStatsEqual(state.stats, stats)) {
            return state; // 数据没有变化，不更新状态
        }
        return { stats };
    }),
    setTrends: (trends) => set((state) => {
        // 比较trends是否真的变化了
        if (JSON.stringify(state.stats.trends) === JSON.stringify(trends)) {
            return state; // 数据没有变化，不更新状态
        }
        return {
            stats: { ...state.stats, trends }
        };
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
    setScanning: (isScanning) => set((state) => {
        if (state.isScanning === isScanning) {
            return state; // 状态没有变化，不更新
        }
        return { isScanning };
    }),
    updateSettings: (newSettings) => set((state) => {
        // 检查设置是否真的变化了
        const hasChanges = Object.keys(newSettings).some(
            key => state.settings[key as keyof typeof state.settings] !== newSettings[key as keyof typeof newSettings]
        );
        
        if (!hasChanges) {
            return state; // 设置没有变化，不更新状态
        }
        
        return {
            settings: { ...state.settings, ...newSettings }
        };
    }),
}));
