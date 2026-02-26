import { create } from 'zustand';
import { apiClient } from '../api/client';
import { areArraysEqual } from '../utils/dataComparison';
import { type PlateType } from '../types/plate';

export interface Alarm {
    id: number;
    plate_id?: string;
    record_id?: string;
    blacklist_id?: number;
    timestamp: number;
    is_read: number;
    plate_number: string;
    camera_id?: string;
    image_path?: string;
    plate_type?: PlateType;
    rect?: { x: number; y: number; w: number; h: number };
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
    markAsRead: (id: number) => Promise<void>;
    deleteAlarm: (id: number) => Promise<void>;
    deleteAlarmsByPlate: (plateNumber: string) => Promise<void>;
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
            throw error;
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
    }),
    markAsRead: async (id) => {
        try {
            await apiClient.markAlarmAsRead(id);
            set((state) => ({
                alarms: state.alarms.map(a => 
                    a.id === id ? { ...a, is_read: 1 } : a
                )
            }));
        } catch (error) {
            console.error('Failed to mark alarm as read:', error);
        }
    },
    deleteAlarm: async (id) => {
        try {
            await apiClient.deleteAlarm(id);
            set((state) => ({
                alarms: state.alarms.filter(a => a.id !== id)
            }));
        } catch (error) {
            console.error('Failed to delete alarm:', error);
        }
    },
    deleteAlarmsByPlate: async (plateNumber) => {
        try {
            await apiClient.deleteAlarmsByPlate(plateNumber);
            set((state) => ({
                alarms: state.alarms.filter(a => a.plate_number !== plateNumber)
            }));
        } catch (error) {
            console.error('Failed to delete alarms by plate:', error);
        }
    }
}));
