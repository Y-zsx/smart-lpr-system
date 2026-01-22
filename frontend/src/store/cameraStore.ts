import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface CameraDevice {
    id: string;
    name: string;
    type: 'local' | 'stream' | 'file'; // 新增 file 类型用于演示视频文件
    url?: string; // 远程流地址 (HTTP-FLV, HLS, MJPEG) 或视频文件路径
    deviceId?: string; // 本地摄像头设备ID
    status: 'online' | 'offline';
    lastActive?: number;
    location?: string; // 摄像头位置信息
}

interface CameraStore {
    cameras: CameraDevice[];
    selectedCameraId: string;
    availableDevices: MediaDeviceInfo[]; // 可用的本地摄像头设备列表

    addCamera: (camera: Omit<CameraDevice, 'id' | 'status'>) => void;
    removeCamera: (id: string) => void;
    selectCamera: (id: string) => void;
    updateCameraStatus: (id: string, status: 'online' | 'offline') => void;
    refreshDevices: () => Promise<void>; // 刷新可用设备列表
}

export const useCameraStore = create<CameraStore>()(
    persist(
        (set, get) => ({
            cameras: [
                {
                    id: 'local-default',
                    name: '本机摄像头 (默认)',
                    type: 'local',
                    status: 'online',
                    lastActive: Date.now()
                }
            ],
            selectedCameraId: 'local-default',
            availableDevices: [],

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

            removeCamera: (id) => set((state) => {
                const filtered = state.cameras.filter(c => c.id !== id);
                // 如果移除了当前选中的摄像头，回退到第一个可用摄像头
                const newSelected = state.selectedCameraId === id 
                    ? (filtered[0]?.id || 'local-default')
                    : state.selectedCameraId;
                return {
                    cameras: filtered,
                    selectedCameraId: newSelected
                };
            }),

            selectCamera: (id) => set({ selectedCameraId: id }),

            updateCameraStatus: (id, status) => set((state) => ({
                cameras: state.cameras.map(c =>
                    c.id === id ? { ...c, status, lastActive: Date.now() } : c
                )
            })),

            refreshDevices: async () => {
                try {
                    // 请求摄像头权限
                    await navigator.mediaDevices.getUserMedia({ video: true });
                    
                    const devices = await navigator.mediaDevices.enumerateDevices();
                    const videoDevices = devices.filter(device => device.kind === 'videoinput');
                    
                    set({ availableDevices: videoDevices });
                    
                    // 自动添加新发现的本地摄像头
                    const state = get();
                    const existingLocalIds = new Set(
                        state.cameras
                            .filter(c => c.type === 'local' && c.deviceId)
                            .map(c => c.deviceId)
                    );
                    
                    const newLocalCameras = videoDevices
                        .filter(device => !existingLocalIds.has(device.deviceId))
                        .map((device, index) => ({
                            id: `local-${device.deviceId}`,
                            name: device.label || `摄像头 ${index + 1}`,
                            type: 'local' as const,
                            deviceId: device.deviceId,
                            status: 'offline' as const,
                            lastActive: Date.now()
                        }));
                    
                    if (newLocalCameras.length > 0) {
                        set((state) => ({
                            cameras: [...state.cameras, ...newLocalCameras]
                        }));
                    }
                } catch (error) {
                    console.error('获取摄像头设备列表失败:', error);
                }
            }
        }),
        {
            name: 'camera-storage',
            partialize: (state) => ({ 
                cameras: state.cameras,
                selectedCameraId: state.selectedCameraId
            }) // 不持久化 availableDevices
        }
    )
);
