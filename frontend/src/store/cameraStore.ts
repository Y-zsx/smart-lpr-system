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
    location?: string; // 摄像头位置信息（地址文本）
    regionCode?: string;
    latitude?: number; // 纬度
    longitude?: number; // 经度
}

/** 单个摄像头的 blob 加载状态，progress 0-100，无总大小时为 -1（不确定） */
export type BlobLoadProgress = { loading: boolean; progress: number };

interface CameraStore {
    cameras: CameraDevice[];
    selectedCameraId: string;
    availableDevices: MediaDeviceInfo[]; // 可用的本地摄像头设备列表
    /** 本会话内「视频文件」摄像头的本地 blob 播放地址，避免从服务器拉流卡顿（不持久化） */
    localBlobUrls: Record<string, string>;
    /** 各摄像头视频 blob 加载进度与状态（不持久化） */
    blobLoadingProgress: Record<string, BlobLoadProgress>;
    /** 各摄像头 blob 加载失败时的错误信息（不持久化） */
    blobLoadError: Record<string, string | null>;

    addCamera: (camera: Omit<CameraDevice, 'id' | 'status'> | CameraDevice) => void;
    updateCamera: (id: string, camera: Partial<Omit<CameraDevice, 'id'>>) => void;
    removeCamera: (id: string) => void;
    selectCamera: (id: string) => void;
    updateCameraStatus: (id: string, status: 'online' | 'offline') => void;
    setLocalBlobUrl: (cameraId: string, blobUrl: string) => void;
    /** 清除某路 blob 并撤销 URL，用于重试加载 */
    clearBlobUrl: (cameraId: string) => void;
    setBlobLoadingProgress: (cameraId: string, value: BlobLoadProgress) => void;
    setBlobLoadError: (cameraId: string, error: string | null) => void;
    /** 从服务端拉取摄像头列表并写入 store，多设备同步以服务端为准 */
    setCamerasFromServer: (serverCameras: CameraDevice[]) => void;
    refreshDevices: () => Promise<void>;
}

const LOCAL_DEFAULT_CAMERA: CameraDevice = {
    id: 'local-default',
    name: '本机摄像头',
    type: 'local',
    status: 'offline',
    lastActive: Date.now()
};

export const useCameraStore = create<CameraStore>()(
    persist(
        (set, get) => ({
            cameras: [LOCAL_DEFAULT_CAMERA],
            selectedCameraId: 'local-default',
            availableDevices: [],
            localBlobUrls: {},
            blobLoadingProgress: {},
            blobLoadError: {},

            addCamera: (camera) => set((state) => {
                // 如果已经包含 id，直接使用；否则生成新的 id
                const cameraToAdd: CameraDevice = 'id' in camera ? camera : {
                    ...camera,
                    id: `cam-${Date.now()}`,
                    status: 'offline', // 默认为离线，直到验证通过
                    lastActive: Date.now()
                };
                return {
                    cameras: [...state.cameras, cameraToAdd]
                };
            }),

            updateCamera: (id, camera) => set((state) => ({
                cameras: state.cameras.map(c =>
                    c.id === id ? { ...c, ...camera } : c
                )
            })),

            removeCamera: (id) => set((state) => {
                const prevBlob = state.localBlobUrls[id];
                if (prevBlob) try { URL.revokeObjectURL(prevBlob); } catch (_) {}
                const nextBlobUrls = { ...state.localBlobUrls };
                delete nextBlobUrls[id];
                const nextProgress = { ...state.blobLoadingProgress };
                delete nextProgress[id];
                const nextError = { ...state.blobLoadError };
                delete nextError[id];
                const filtered = state.cameras.filter(c => c.id !== id);
                const newSelected = state.selectedCameraId === id
                    ? (filtered[0]?.id || 'local-default')
                    : state.selectedCameraId;
                return {
                    cameras: filtered,
                    selectedCameraId: newSelected,
                    localBlobUrls: nextBlobUrls,
                    blobLoadingProgress: nextProgress,
                    blobLoadError: nextError
                };
            }),

            setLocalBlobUrl: (cameraId, blobUrl) => set((state) => {
                const prev = state.localBlobUrls[cameraId];
                if (prev && prev !== blobUrl) try { URL.revokeObjectURL(prev); } catch (_) {}
                const nextProgress = { ...state.blobLoadingProgress };
                delete nextProgress[cameraId];
                const nextError = { ...state.blobLoadError };
                delete nextError[cameraId];
                return {
                    localBlobUrls: { ...state.localBlobUrls, [cameraId]: blobUrl },
                    blobLoadingProgress: nextProgress,
                    blobLoadError: nextError
                };
            }),

            clearBlobUrl: (cameraId) => set((state) => {
                const prev = state.localBlobUrls[cameraId];
                if (prev) try { URL.revokeObjectURL(prev); } catch (_) {}
                const next = { ...state.localBlobUrls };
                delete next[cameraId];
                return { localBlobUrls: next };
            }),

            setBlobLoadingProgress: (cameraId, value) => set((state) => ({
                blobLoadingProgress: { ...state.blobLoadingProgress, [cameraId]: value }
            })),

            setBlobLoadError: (cameraId, error) => set((state) => ({
                blobLoadError: { ...state.blobLoadError, [cameraId]: error }
            })),

            setCamerasFromServer: (serverCameras) => set((state) => {
                const list = Array.isArray(serverCameras) ? serverCameras : [];
                const merged = [LOCAL_DEFAULT_CAMERA, ...list.filter(c => c.id !== LOCAL_DEFAULT_CAMERA.id)];
                const keepSelected = merged.some(c => c.id === state.selectedCameraId);
                return {
                    cameras: merged,
                    selectedCameraId: keepSelected ? state.selectedCameraId : (merged[0]?.id ?? 'local-default')
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
                    
                    // 不自动添加新发现的本地摄像头，只更新设备列表
                    // 用户可以通过其他方式添加摄像头
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
            }) // 不持久化 availableDevices、localBlobUrls（会话内本地播放用）
        }
    )
);
