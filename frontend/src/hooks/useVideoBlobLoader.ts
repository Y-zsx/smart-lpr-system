import { useEffect, useRef } from 'react';
import { useCameraStore } from '@/store/cameraStore';
import { apiClient } from '@/api/client';

const isRemoteFileUrl = (url?: string) =>
    !!url && (url.startsWith('cos://') || url.startsWith('uploads/'));

/**
 * 并行预加载所有「视频文件」型摄像头的 blob，带进度；切换画面不中断其它路的加载，回来时直接用已缓存的 blob。
 */
export function useVideoBlobLoader() {
    const cameras = useCameraStore((s) => s.cameras);
    const localBlobUrls = useCameraStore((s) => s.localBlobUrls);
    const setLocalBlobUrl = useCameraStore((s) => s.setLocalBlobUrl);
    const setBlobLoadingProgress = useCameraStore((s) => s.setBlobLoadingProgress);
    const setBlobLoadError = useCameraStore((s) => s.setBlobLoadError);

    const inFlightRef = useRef<Map<string, XMLHttpRequest>>(new Map());

    useEffect(() => {
        const needLoad = cameras.filter(
            (c) =>
                c.type === 'file' &&
                c.id &&
                c.url &&
                isRemoteFileUrl(c.url) &&
                !localBlobUrls[c.id]
        );

        // 对已不在需加载列表里的进行中的请求做取消（例如摄像头被删、或已有 blob）
        inFlightRef.current.forEach((xhr, cameraId) => {
            const stillNeeded = needLoad.some((c) => c.id === cameraId);
            if (!stillNeeded) {
                xhr.abort();
                inFlightRef.current.delete(cameraId);
            }
        });

        needLoad.forEach((camera) => {
            if (inFlightRef.current.has(camera.id)) return;

            const url = apiClient.getMediaUrl(camera.url);
            if (!url || url.startsWith('blob:') || url.startsWith('data:')) return;

            setBlobLoadError(camera.id, null);
            setBlobLoadingProgress(camera.id, { loading: true, progress: -1 });

            const xhr = new XMLHttpRequest();
            xhr.withCredentials = true;
            xhr.responseType = 'blob';

            xhr.addEventListener('progress', (e) => {
                if (e.lengthComputable && e.total > 0) {
                    const progress = Math.min(99, Math.round((e.loaded / e.total) * 100));
                    setBlobLoadingProgress(camera.id, { loading: true, progress });
                }
            });

            xhr.addEventListener('load', () => {
                inFlightRef.current.delete(camera.id);
                if (xhr.status >= 200 && xhr.status < 300 && xhr.response instanceof Blob) {
                    const blobUrl = URL.createObjectURL(xhr.response);
                    setLocalBlobUrl(camera.id, blobUrl);
                } else {
                    setBlobLoadingProgress(camera.id, { loading: false, progress: 0 });
                    setBlobLoadError(camera.id, '视频加载失败，请重试');
                }
            });

            xhr.addEventListener('error', () => {
                inFlightRef.current.delete(camera.id);
                setBlobLoadingProgress(camera.id, { loading: false, progress: 0 });
                setBlobLoadError(camera.id, '网络错误，请重试');
            });

            xhr.addEventListener('abort', () => {
                inFlightRef.current.delete(camera.id);
                setBlobLoadingProgress(camera.id, { loading: false, progress: 0 });
            });

            xhr.open('GET', url);
            xhr.send();
            inFlightRef.current.set(camera.id, xhr);
        });

        return () => {
            // 不在这里 abort：切换画面时保持后台继续加载，只有摄像头被删或 blob 已存在时上面逻辑会 abort
        };
    }, [cameras, localBlobUrls, setLocalBlobUrl, setBlobLoadingProgress, setBlobLoadError]);
}
