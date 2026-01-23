import { create } from 'zustand';
import { apiClient } from '../api/client';
import { areArraysEqual } from '../utils/dataComparison';

export interface Alarm {
    id: number;
    plate_id?: string;
    blacklist_id?: number;
    timestamp: number;
    is_read: number;
    plate_number: string;
    image_path?: string;
    location?: string;
    latitude?: number; // 纬度
    longitude?: number; // 经度
    reason: string;
    severity: 'high' | 'medium' | 'low';
}

interface AlarmStore {
    alarms: Alarm[];
    fetchAlarms: () => Promise<void>;
    addAlarm: (alarm: Alarm) => void;
}

export const useAlarmStore = create<AlarmStore>((set, get) => ({
    alarms: [],
    fetchAlarms: async () => {
        try {
            const alarms = await apiClient.getAlarms();
            const currentAlarms = get().alarms;
            
            // 比较告警数据是否真的变化了（基于id和timestamp）
            const hasChanges = !areArraysEqual(
                currentAlarms,
                alarms,
                (alarm) => ({ id: alarm.id, timestamp: alarm.timestamp, is_read: alarm.is_read })
            );
            
            if (hasChanges) {
                set({ alarms });
            }
        } catch (error) {
            console.error('Failed to fetch alarms:', error);
        }
    },
    addAlarm: (alarm) => set((state) => {
        // 检查告警是否已存在
        if (state.alarms.some(a => a.id === alarm.id)) {
            return state; // 告警已存在，不更新
        }
        return {
            alarms: [alarm, ...state.alarms]
        };
    })
}));
