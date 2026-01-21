import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface CameraDevice {
    id: string;
    name: string;
    type: 'local' | 'stream';
    url?: string; // 远程流地址 (HTTP-FLV, HLS, MJPEG)
    status: 'online' | 'offline';
    lastActive?: number;
}

interface CameraStore {
    cameras: CameraDevice[];
    selectedCameraId: string;

    addCamera: (camera: Omit<CameraDevice, 'id' | 'status'>) => void;
    removeCamera: (id: string) => void;
    selectCamera: (id: string) => void;
    updateCameraStatus: (id: string, status: 'online' | 'offline') => void;
}

export const useCameraStore = create<CameraStore>()(
    persist(
        (set) => ({
            cameras: [
                {
                    id: 'local-1',
                    name: '本机摄像头 (默认)',
                    type: 'local',
                    status: 'online',
                    lastActive: Date.now()
                }
            ],
            selectedCameraId: 'local-1',

            addCamera: (camera) => set((state) => ({
                cameras: [
                    ...state.cameras,
                    {
                        ...camera,
                        id: `cam-${Date.now()}`,
                        status: 'offline', // 默认为离线，直到验证通过
                        lastActive: Date.now()
                    }
                ]
            })),

            removeCamera: (id) => set((state) => ({
                cameras: state.cameras.filter(c => c.id !== id),
                // 如果移除了当前选中的摄像头，回退到本地摄像头
                selectedCameraId: state.selectedCameraId === id ? 'local-1' : state.selectedCameraId
            })),

            selectCamera: (id) => set({ selectedCameraId: id }),

            updateCameraStatus: (id, status) => set((state) => ({
                cameras: state.cameras.map(c =>
                    c.id === id ? { ...c, status, lastActive: Date.now() } : c
                )
            }))
        }),
        {
            name: 'camera-storage'
        }
    )
);
