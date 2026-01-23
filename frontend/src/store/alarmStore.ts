import { create } from 'zustand';
import { apiClient } from '../api/client';

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

export const useAlarmStore = create<AlarmStore>((set) => ({
    alarms: [],
    fetchAlarms: async () => {
        try {
            const alarms = await apiClient.getAlarms();
            set({ alarms });
        } catch (error) {
            console.error('Failed to fetch alarms:', error);
        }
    },
    addAlarm: (alarm) => set((state) => ({
        alarms: [alarm, ...state.alarms]
    }))
}));
