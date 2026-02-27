import React, { useEffect, useRef, useState } from 'react';
import { Camera, CameraOff, Video as VideoIcon, VideoOff, AlertTriangle, X, ShieldAlert } from 'lucide-react';
import { usePlateStore } from '../store/plateStore';
import { useCameraStore } from '../store/cameraStore';
import { plateService } from '../services/plateService';
import { apiClient } from '../api/client';
import { Rect, LicensePlate } from '../types/plate';
import { hapticFeedback } from '../utils/mobileFeatures';
import { isValidChinesePlateNumber } from '../utils/plateValidation';

interface RecentRecognition {
    plates: LicensePlate[];
}

/** 与“发送帧”同步的识别结果：展示的是当时送识别的画面，避免视频播放与结果不同步 */
interface RecognitionSnapshot {
    url: string;
    rect?: Rect;
    plates: LicensePlate[];
    captureWidth: number;
    captureHeight: number;
}

interface CameraViewProps {
    cameraId?: string; // 可选的摄像头ID，如果提供则使用指定的摄像头，否则使用选中的摄像头
    independentScanning?: boolean; // 是否使用独立的扫描状态（多窗口模式）
}

export const CameraView: React.FC<CameraViewProps> = ({ cameraId: propCameraId, independentScanning = false }) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const videoRef = useRef<HTMLVideoElement>(null);
    const remoteVideoRef = useRef<HTMLImageElement>(null);
    const fileVideoRef = useRef<HTMLVideoElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [error, setError] = useState<string>('');
    const [hasPermission, setHasPermission] = useState<boolean>(false);
    const [detectedRect, setDetectedRect] = useState<Rect | null>(null);
    const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
    const [recentRecognition, setRecentRecognition] = useState<RecentRecognition | null>(null);
    /** 识别结果与发送帧一致时的快照（视频文件模式下避免“车已过了才出结果”的错位感） */
    const [recognitionSnapshot, setRecognitionSnapshot] = useState<RecognitionSnapshot | null>(null);
    const [inputResolutionLabel, setInputResolutionLabel] = useState<string>('未知');
    const [blacklist, setBlacklist] = useState<Set<string>>(new Set());
    const mjpegRefreshIntervalRef = useRef<number | null>(null);
    const healthCheckIntervalRef = useRef<number | null>(null);

    // 多窗口模式：每个窗口有独立的扫描状态
    const [localScanning, setLocalScanning] = useState(false);
    const { isScanning: globalScanning, setScanning: setGlobalScanning, addPlate, settings } = usePlateStore();
    const { cameras, selectedCameraId, updateCameraStatus, localBlobUrls, setLocalBlobUrl } = useCameraStore();

    // 如果提供了 propCameraId，使用它；否则使用选中的摄像头
    const effectiveCameraId = propCameraId || selectedCameraId;
    const currentCamera = cameras.find(c => c.id === effectiveCameraId) || cameras[0];
    const isLocal = currentCamera?.type === 'local';
    const isFile = currentCamera?.type === 'file';
    const isStream = currentCamera?.type === 'stream';
    const [useDirectStreamPreview, setUseDirectStreamPreview] = useState(false);
    const proxyStreamUrl = currentCamera?.id ? apiClient.getCameraLiveStreamUrl(currentCamera.id) : '';
    const directStreamUrl = currentCamera?.url || '';
    const streamPreviewUrl = isStream
        ? (useDirectStreamPreview ? directStreamUrl : (proxyStreamUrl || directStreamUrl))
        : '';
    // 远程路径（cos/uploads）：仅用 blob 播放，避免 /api/media/redirect 长连接阻塞 AI 等请求；无 blob 时先拉取再播
    const isRemoteFileUrl = !!(currentCamera?.url && (currentCamera.url.startsWith('cos://') || currentCamera.url.startsWith('uploads/')));
    const fileVideoUrl = isFile
        ? (effectiveCameraId && localBlobUrls[effectiveCameraId]) || (!isRemoteFileUrl ? (apiClient.getMediaUrl(currentCamera?.url) || '') : '')
        : '';
    /** 远程文件正在拉取为 blob 时为 true，用于显示加载态 */
    const [fileVideoBlobLoading, setFileVideoBlobLoading] = useState(false);
    const [fileVideoBlobError, setFileVideoBlobError] = useState<string | null>(null);
    const [fileVideoBlobRetry, setFileVideoBlobRetry] = useState(0);

    // 使用独立扫描状态或全局扫描状态
    const isScanning = independentScanning ? localScanning : globalScanning;
    const setScanning = independentScanning ? setLocalScanning : setGlobalScanning;

    const scanIntervalRef = useRef<number | null>(null);
    const streamRef = useRef<MediaStream | null>(null);
    const lastFrameDataRef = useRef<Uint8ClampedArray | null>(null);
    // 同车牌防重复：key = cameraId:plateNumber, value = 最后一次保存时间
    const recentlySeenPlatesRef = useRef<Map<string, number>>(new Map());
    const retryTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const retryScheduledRef = useRef<boolean>(false);
    /** 视频文件模式：串行识别，避免多请求与快照错位 */
    const recognitionInFlightRef = useRef(false);
    const snapshotUrlToRevokeRef = useRef<string | null>(null);
    const snapshotClearTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const MIN_CAPTURE_SHORT_EDGE = 540;
    const JPEG_CAPTURE_QUALITY = 0.88;
    // 加载黑名单
    useEffect(() => {
        const loadBlacklist = async () => {
            try {
                const blacklistItems = await apiClient.getBlacklist();
                const plateNumbers = new Set<string>(blacklistItems.map((item: any) => item.plate_number));
                setBlacklist(plateNumbers);
            } catch (error) {
                console.error('加载黑名单失败:', error);
            }
        };
        loadBlacklist();
        // 每30秒刷新一次黑名单
        const interval = setInterval(loadBlacklist, 30000);
        return () => clearInterval(interval);
    }, []);

    // ResizeObserver 监听容器大小调整
    useEffect(() => {
        if (!containerRef.current) return;

        const resizeObserver = new ResizeObserver((entries) => {
            for (const entry of entries) {
                setDimensions({
                    width: entry.contentRect.width,
                    height: entry.contentRect.height
                });
            }
        });

        resizeObserver.observe(containerRef.current);
        return () => resizeObserver.disconnect();
    }, []);

    useEffect(() => {
        // 摄像头切换时恢复为代理优先，失败后再自动降级直连
        setUseDirectStreamPreview(false);
    }, [currentCamera?.id, currentCamera?.url]);

    // 远程文件型摄像头：用低优先级 fetch 拉成 blob 再播，避免 redirect 长连接占满同源导致 AI 请求被阻塞
    useEffect(() => {
        if (!isFile || !effectiveCameraId || !currentCamera?.url || !isRemoteFileUrl || localBlobUrls[effectiveCameraId]) {
            return;
        }
        const url = apiClient.getMediaUrl(currentCamera.url);
        if (!url || url.startsWith('blob:') || url.startsWith('data:')) return;

        const ac = new AbortController();
        setFileVideoBlobError(null);
        setFileVideoBlobLoading(true);

        (async () => {
            try {
                const init: RequestInit = {
                    credentials: 'include',
                    signal: ac.signal
                };
                (init as RequestInit & { priority?: string }).priority = 'low';
                const res = await fetch(url, init);
                if (!res.ok || ac.signal.aborted) return;
                const blob = await res.blob();
                if (ac.signal.aborted) return;
                const blobUrl = URL.createObjectURL(blob);
                setLocalBlobUrl(effectiveCameraId, blobUrl);
            } catch (e) {
                if ((e as Error)?.name === 'AbortError') return;
                setFileVideoBlobError('视频加载失败，请重试');
            } finally {
                if (!ac.signal.aborted) {
                    setFileVideoBlobLoading(false);
                }
            }
        })();

        return () => {
            ac.abort();
            setFileVideoBlobLoading(false);
        };
    }, [isFile, effectiveCameraId, currentCamera?.url, isRemoteFileUrl, localBlobUrls[effectiveCameraId], setLocalBlobUrl, fileVideoBlobRetry]);

    const startCamera = async () => {
        if (isFile) {
            // 视频文件模式 - 确保视频有 src 并开始播放
            if (fileVideoRef.current && fileVideoUrl) {
                const video = fileVideoRef.current;

                // 确保 src 已设置
                if (!video.src || video.src !== fileVideoUrl) {
                    console.log('设置视频 src:', fileVideoUrl.substring(0, 50));
                    video.src = fileVideoUrl;
                    video.load();
                }

                try {
                    // 如果视频已经加载，尝试播放
                    if (video.readyState >= 2) {
                        await video.play();
                        console.log('视频文件播放成功');
                        setHasPermission(true);
                        setError('');
                        updateCameraStatus(currentCamera.id, 'online');
                    } else {
                        // 视频还在加载，等待加载完成
                        console.log('视频还在加载，等待 readyState >= 2, 当前:', video.readyState);
                        const playWhenReady = () => {
                            video.play().then(() => {
                                console.log('视频加载完成后播放成功');
                                setHasPermission(true);
                                setError('');
                                updateCameraStatus(currentCamera.id, 'online');
                            }).catch(err => {
                                console.error('播放视频文件失败:', err);
                                setError('无法播放视频文件，请检查文件格式');
                                setHasPermission(false);
                            });
                        };

                        if (video.readyState >= 1) {
                            // 已经有元数据，等待可以播放
                            video.addEventListener('canplay', playWhenReady, { once: true });
                        } else {
                            // 等待元数据加载
                            video.addEventListener('loadedmetadata', () => {
                                video.addEventListener('canplay', playWhenReady, { once: true });
                            }, { once: true });
                        }
                    }
                } catch (err) {
                    console.error('播放视频文件失败:', err);
                    setError('无法播放视频文件，请检查文件格式');
                    setHasPermission(false);
                    updateCameraStatus(currentCamera.id, 'offline');
                }
            } else {
                console.warn('视频元素或 URL 未准备好:', {
                    hasRef: !!fileVideoRef.current,
                    hasUrl: !!fileVideoUrl,
                    url: fileVideoUrl?.substring(0, 50)
                });
            }
            return;
        }

        if (!isLocal) {
            // 网络流模式（统一走后端流代理，兼容 RTSP/HLS/HTTP）
            setHasPermission(true);
            setError('');
            updateCameraStatus(currentCamera.id, 'online');
            return;
        }

        // 本地摄像头模式
        try {
            const constraints: MediaStreamConstraints = {
                video: currentCamera.deviceId
                    ? {
                        deviceId: { exact: currentCamera.deviceId },
                        width: { ideal: 1280 },
                        height: { ideal: 720 },
                        frameRate: { ideal: 24, max: 30 }
                    }
                    : {
                        facingMode: 'environment',
                        width: { ideal: 1280 },
                        height: { ideal: 720 },
                        frameRate: { ideal: 24, max: 30 }
                    }
            };

            const stream = await navigator.mediaDevices.getUserMedia(constraints);

            streamRef.current = stream;
            setHasPermission(true);
            setError('');
            updateCameraStatus(currentCamera.id, 'online');
        } catch (err) {
            console.error('Error accessing camera:', err);
            setError('无法访问摄像头，请检查权限设置');
            setHasPermission(false);
            updateCameraStatus(currentCamera.id, 'offline');
        }
    };

    useEffect(() => {
        if (isLocal && hasPermission && videoRef.current && streamRef.current) {
            videoRef.current.srcObject = streamRef.current;
        }
    }, [hasPermission, isLocal, currentCamera.id, currentCamera.deviceId]);

    const stopCamera = () => {
        if (streamRef.current) {
            streamRef.current.getTracks().forEach(track => track.stop());
            streamRef.current = null;
        }
        if (videoRef.current) {
            videoRef.current.srcObject = null;
        }
        // 注意：不要清空视频文件的 src，否则会导致错误
        // 视频文件应该保持 src，只暂停播放
        if (fileVideoRef.current && !isFile) {
            // 只有在不是视频文件模式时才清空
            fileVideoRef.current.pause();
            fileVideoRef.current.src = '';
        } else if (fileVideoRef.current && isFile) {
            // 视频文件模式：只暂停，不清空 src
            fileVideoRef.current.pause();
        }
        if (mjpegRefreshIntervalRef.current) {
            clearInterval(mjpegRefreshIntervalRef.current);
            mjpegRefreshIntervalRef.current = null;
        }
        if (healthCheckIntervalRef.current) {
            clearInterval(healthCheckIntervalRef.current);
            healthCheckIntervalRef.current = null;
        }
        if (isLocal || isFile) {
            setHasPermission(false);
        }
        // 更新摄像头状态为离线
        if (currentCamera) {
            updateCameraStatus(currentCamera.id, 'offline');
        }
    };

    const hasMotion = (context: CanvasRenderingContext2D, width: number, height: number): boolean => {
        // 优化：降采样进行运动检测以提高性能
        const sampleSize = 32; // 每 32 个像素检查一次
        const imageData = context.getImageData(0, 0, width, height);
        const data = imageData.data;

        if (!lastFrameDataRef.current || lastFrameDataRef.current.length !== data.length) {
            lastFrameDataRef.current = new Uint8ClampedArray(data);
            return true;
        }

        const prevData = lastFrameDataRef.current;
        let diff = 0;
        let count = 0;

        for (let i = 0; i < data.length; i += 4 * sampleSize) {
            diff += Math.abs(data[i] - prevData[i]); // 仅使用 R 通道进行运动检测已足够
            count++;
        }

        // 更新参考帧
        lastFrameDataRef.current.set(data);

        const avgDiff = diff / count;
        return avgDiff > 5;
    };

    const captureAndRecognize = async (isRetry = false) => {
        if (!isScanning) return;

        let sourceElement: HTMLVideoElement | HTMLImageElement | null = null;

        if (isLocal || isFile) {
            sourceElement = isFile ? fileVideoRef.current : videoRef.current;
        } else {
            sourceElement = remoteVideoRef.current;
        }

        if (!sourceElement || !canvasRef.current) return;

        // 对于视频元素，确保已加载并可以播放
        if ((isLocal || isFile) && sourceElement instanceof HTMLVideoElement) {
            if (sourceElement.readyState < 2) {
                return;
            }
        }

        const canvas = canvasRef.current;
        const context = canvas.getContext('2d', { willReadFrequently: true });
        if (!context) return;

        const sourceWidth = (isLocal || isFile)
            ? (sourceElement as HTMLVideoElement).videoWidth
            : (sourceElement as HTMLImageElement).naturalWidth;
        const sourceHeight = (isLocal || isFile)
            ? (sourceElement as HTMLVideoElement).videoHeight
            : (sourceElement as HTMLImageElement).naturalHeight;

        if (!sourceWidth || !sourceHeight || sourceWidth === 0 || sourceHeight === 0) {
            setInputResolutionLabel('未知');
            return;
        }

        // 对低分辨率源做温和上采样，至少保证短边达到 540，提升远距离小车牌可识别性
        let width = sourceWidth;
        let height = sourceHeight;
        const shortEdge = Math.min(sourceWidth, sourceHeight);
        if (shortEdge < MIN_CAPTURE_SHORT_EDGE) {
            const scale = MIN_CAPTURE_SHORT_EDGE / shortEdge;
            width = Math.round(sourceWidth * scale);
            height = Math.round(sourceHeight * scale);
        }
        setInputResolutionLabel(
            width === sourceWidth && height === sourceHeight
                ? `${sourceWidth}x${sourceHeight}`
                : `${sourceWidth}x${sourceHeight} -> ${width}x${height}`
        );

        if (canvas.width !== width || canvas.height !== height) {
            canvas.width = width;
            canvas.height = height;
        }

        try {
            context.imageSmoothingEnabled = true;
            context.imageSmoothingQuality = 'high';
            context.drawImage(sourceElement, 0, 0, width, height);

            if (!hasMotion(context, width, height)) {
                return;
            }

            // 视频文件模式：串行识别，保证“结果”和“发送的那一帧”一一对应，避免错位
            if (isFile && recognitionInFlightRef.current) return;

            canvas.toBlob(async (blob) => {
                if (!blob) return;
                if (isFile) recognitionInFlightRef.current = true;
                const snapshotUrl = URL.createObjectURL(blob);
                try {
                    const { plates } = await plateService.recognizeFromFile(
                        blob, 'stream',
                        currentCamera?.id || '',
                        currentCamera?.name || '未知摄像头',
                        currentCamera?.location || currentCamera?.name || '未知位置',
                        { minConfidence: settings.confidenceThreshold }
                    );

                    const valid = (plates || []).filter(
                        p => p && p.confidence >= settings.confidenceThreshold && isValidChinesePlateNumber(p.number)
                    );

                    // 有运动但未识别到车牌：短时补拍一次，减轻漏检
                    if (valid.length === 0) {
                        if (settings.retryOnEmpty !== false && !isRetry && !retryScheduledRef.current) {
                            retryScheduledRef.current = true;
                            retryTimeoutRef.current = setTimeout(() => {
                                retryTimeoutRef.current = null;
                                retryScheduledRef.current = false;
                                captureAndRecognize(true);
                            }, 250);
                        }
                        return;
                    }

                    if (valid[0].rect) {
                        setDetectedRect(valid[0].rect);
                        setTimeout(() => setDetectedRect(null), 2000);
                    }

                    const isAnyBlacklisted = valid.some(p => blacklist.has(p.number));
                    setRecentRecognition({ plates: valid });
                    setTimeout(() => setRecentRecognition(null), isAnyBlacklisted ? 10000 : 5000);

                    // 结果与发送帧同步：用送识别的画面快照展示，避免“车已过了才出结果”
                    setRecognitionSnapshot(prev => {
                        if (prev?.url) URL.revokeObjectURL(prev.url);
                        return {
                            url: snapshotUrl,
                            rect: valid[0].rect,
                            plates: valid,
                            captureWidth: width,
                            captureHeight: height
                        };
                    });
                    snapshotUrlToRevokeRef.current = snapshotUrl;
                    if (snapshotClearTimeoutRef.current) clearTimeout(snapshotClearTimeoutRef.current);
                    snapshotClearTimeoutRef.current = setTimeout(() => {
                        snapshotClearTimeoutRef.current = null;
                        setRecognitionSnapshot(prev => {
                            if (prev?.url) URL.revokeObjectURL(prev.url);
                            snapshotUrlToRevokeRef.current = null;
                            return null;
                        });
                    }, isAnyBlacklisted ? 10000 : 5000);

                    const cooldownMs = (settings.plateCooldownSeconds ?? 30) * 1000;
                    const camKey = effectiveCameraId || 'default';
                    const map = recentlySeenPlatesRef.current;
                    let didSaveAny = false;

                    for (const plate of valid) {
                        const key = `${camKey}:${plate.number}`;
                        const last = map.get(key);
                        const now = Date.now();
                        if (last != null && now - last < cooldownMs) {
                            continue; // 防重复：冷却期内不重复保存
                        }

                        if (!plate.saved) {
                            try {
                                const plateToSave = {
                                    ...plate,
                                    cameraId: currentCamera?.id,
                                    cameraName: currentCamera?.name,
                                    location: currentCamera?.location || currentCamera?.name,
                                    saved: true
                                };
                                const savedPlate = await apiClient.savePlate(plateToSave);
                                addPlate(savedPlate);
                                didSaveAny = true;
                                map.set(key, Date.now());
                            } catch (saveError) {
                                console.error('保存识别记录失败:', saveError, plate);
                                addPlate(plate);
                                didSaveAny = true;
                                map.set(key, Date.now());
                            }
                        } else {
                            addPlate(plate);
                            didSaveAny = true;
                            map.set(key, Date.now());
                        }
                    }

                    // 限制 Map 大小，定期清理过期
                    if (map.size > 150) {
                        const cutoff = Date.now() - cooldownMs * 2;
                        for (const [k, v] of map.entries()) { if (v < cutoff) map.delete(k); }
                    }

                    if (settings.enableHaptics && (didSaveAny || isAnyBlacklisted)) {
                        hapticFeedback(isAnyBlacklisted ? 'heavy' : 'medium');
                    }
                } catch (e) {
                    // 忽略
                } finally {
                    if (isFile) recognitionInFlightRef.current = false;
                    // 若未写入 recognitionSnapshot（如 valid 为空），则释放本次快照
                    if (isFile && snapshotUrlToRevokeRef.current !== snapshotUrl) URL.revokeObjectURL(snapshotUrl);
                }
            }, 'image/jpeg', JPEG_CAPTURE_QUALITY);
        } catch (e) {
            console.warn("Canvas security error", e);
        }
    };

    useEffect(() => {
        return () => {
            stopCamera();
            if (scanIntervalRef.current) clearInterval(scanIntervalRef.current);
            if (mjpegRefreshIntervalRef.current) clearInterval(mjpegRefreshIntervalRef.current);
            if (healthCheckIntervalRef.current) clearInterval(healthCheckIntervalRef.current);
            if (retryTimeoutRef.current) clearTimeout(retryTimeoutRef.current);
            if (snapshotClearTimeoutRef.current) clearTimeout(snapshotClearTimeoutRef.current);
            setRecognitionSnapshot(prev => { if (prev?.url) URL.revokeObjectURL(prev.url); return null; });
        };
    }, [effectiveCameraId, currentCamera?.id]);

    // 摄像头切换时：取消叠加状态；仅停止本地流，不清空新摄像头的 img/video src（否则会清到刚挂上的新元素）
    useEffect(() => {
        setError('');
        setFileVideoBlobLoading(false);
        setFileVideoBlobError(null);
        setHasPermission(false);
        // 只停止本地摄像头流；remoteVideoRef/fileVideoRef 在切换后已指向新元素，不能清 src
        if (streamRef.current) {
            streamRef.current.getTracks().forEach(t => t.stop());
            streamRef.current = null;
        }
        if (videoRef.current) {
            videoRef.current.srcObject = null;
        }

        // 如果是视频文件，直接设置 src 并加载
        if (isFile && fileVideoUrl && fileVideoRef.current) {
            console.log('设置视频文件 src:', {
                name: currentCamera.name,
                url: fileVideoUrl.substring(0, 50),
                fullUrl: fileVideoUrl,
                hasRef: !!fileVideoRef.current,
                effectiveCameraId
            });

            // 直接设置 src，确保视频元素有正确的 URL
            const video = fileVideoRef.current;
            const needsReload = !video.src || video.src !== fileVideoUrl;

            if (needsReload) {
                video.src = fileVideoUrl;
                video.load(); // 强制重新加载
            }

            // 尝试自动播放
            const tryPlay = async () => {
                try {
                    await video.play();
                    console.log('视频播放成功', { cameraId: currentCamera.id });
                    setHasPermission(true);
                    setError('');
                    updateCameraStatus(currentCamera.id, 'online');
                } catch (err) {
                    console.log('自动播放被阻止（可能需要用户交互）:', err);
                    // 不设置错误，等待用户点击播放或开启识别
                    // 但设置 hasPermission 为 true，允许用户手动播放
                    setHasPermission(true);
                }
            };

            // 如果视频已经可以播放，立即播放
            if (video.readyState >= 3) {
                tryPlay();
            } else if (video.readyState >= 2) {
                // 已经有足够的数据，尝试播放
                tryPlay();
            } else if (!needsReload && video.readyState >= 1) {
                // 如果不需要重新加载且已有元数据，尝试播放
                tryPlay();
            } else {
                // 等待视频加载完成
                const onCanPlay = () => {
                    tryPlay();
                };
                const onLoadedData = () => {
                    tryPlay();
                };
                video.addEventListener('canplay', onCanPlay, { once: true });
                video.addEventListener('loadeddata', onLoadedData, { once: true });
            }

            setError('');
        } else if (!isLocal && !isFile && (currentCamera?.url || streamPreviewUrl)) {
            // 网络流不在此处设 hasPermission，等 img onLoad 收到首帧后再设，否则连不上时也会显示「可识别」
        } else if (isFile && !currentCamera?.url) {
            console.warn('视频文件摄像头没有 URL:', currentCamera);
            setError('视频文件 URL 缺失，请重新添加视频文件');
        }
    }, [effectiveCameraId, propCameraId, currentCamera?.id, currentCamera?.url, fileVideoUrl, isFile, isLocal, currentCamera?.name, streamPreviewUrl]);

    useEffect(() => {
        if (!effectiveCameraId || !currentCamera) {
            return;
        }

        if (isScanning) {
            // 确保摄像头已启动
            if ((isLocal && !streamRef.current) || (!isLocal && !isFile && !hasPermission) || (isFile && !hasPermission)) {
                startCamera();
            }

            // 启动识别扫描
            if (scanIntervalRef.current) {
                clearInterval(scanIntervalRef.current);
            }
            scanIntervalRef.current = window.setInterval(captureAndRecognize, settings.scanInterval);
        } else {
            // 停止识别扫描
            if (scanIntervalRef.current) {
                clearInterval(scanIntervalRef.current);
                scanIntervalRef.current = null;
            }
            // 视频文件模式不停止预览，只停止识别
            if (!isFile) {
                // 本地摄像头停止流，但网络流保持预览
                if (isLocal) {
                    stopCamera();
                }
            }
            setDetectedRect(null);
        }
    }, [isScanning, effectiveCameraId, currentCamera?.id, currentCamera?.deviceId, settings.scanInterval, isFile, hasPermission, isLocal]);

    const toggleScanning = () => {
        if (settings.enableHaptics) hapticFeedback('medium');
        setScanning(!isScanning);
    };

    // 计算边界框的缩放比例
    const getScale = () => {
        let sourceWidth = 1;
        let sourceHeight = 1;

        if (isLocal && videoRef.current) {
            sourceWidth = videoRef.current.videoWidth || 1;
            sourceHeight = videoRef.current.videoHeight || 1;
        } else if (isFile && fileVideoRef.current) {
            sourceWidth = fileVideoRef.current.videoWidth || 1;
            sourceHeight = fileVideoRef.current.videoHeight || 1;
        } else if (!isLocal && !isFile && remoteVideoRef.current) {
            sourceWidth = remoteVideoRef.current.naturalWidth || 1;
            sourceHeight = remoteVideoRef.current.naturalHeight || 1;
        }

        // 计算 object-cover 缩放
        const containerRatio = dimensions.width / dimensions.height;
        const sourceRatio = sourceWidth / sourceHeight;

        let scale = 1;
        let offsetX = 0;
        let offsetY = 0;

        if (containerRatio > sourceRatio) {
            scale = dimensions.width / sourceWidth;
            offsetY = (dimensions.height - sourceHeight * scale) / 2;
        } else {
            scale = dimensions.height / sourceHeight;
            offsetX = (dimensions.width - sourceWidth * scale) / 2;
        }

        return { scale, offsetX, offsetY };
    };

    const { scale, offsetX, offsetY } = getScale();

    return (
        <div ref={containerRef} className="relative w-full h-full bg-black rounded-xl overflow-hidden shadow-lg border border-gray-800 flex flex-col">
            <div className="relative flex-1 bg-black overflow-hidden group">
                {isFile ? (
                    // 视频文件模式：始终渲染，不依赖 hasPermission
                    fileVideoUrl ? (
                        <video
                            ref={fileVideoRef}
                            key={`${effectiveCameraId}-${fileVideoUrl?.substring(0, 20)}`} // 使用 effectiveCameraId 确保摄像头切换时重新渲染
                            autoPlay
                            playsInline
                            muted
                            loop
                            preload="auto"
                            className="w-full h-full object-cover"
                            onError={(e) => {
                                console.error('视频播放错误:', e);
                                const video = e.currentTarget;
                                const error = video.error;
                                let errorMsg = '无法播放视频文件';

                                if (error) {
                                    console.error('视频错误详情:', {
                                        code: error.code,
                                        message: error.message
                                    });
                                    switch (error.code) {
                                        case error.MEDIA_ERR_ABORTED:
                                            errorMsg = '视频播放被中止';
                                            break;
                                        case error.MEDIA_ERR_NETWORK:
                                            errorMsg = '网络错误，请检查文件是否有效';
                                            break;
                                        case error.MEDIA_ERR_DECODE:
                                            errorMsg = '视频解码失败，请检查文件格式';
                                            break;
                                        case error.MEDIA_ERR_SRC_NOT_SUPPORTED:
                                            errorMsg = '视频格式不支持，请使用 MP4 或 WebM 格式';
                                            break;
                                        default:
                                            errorMsg = `视频文件可能已失效 (错误码: ${error.code})，请重新选择文件`;
                                    }
                                } else {
                                    errorMsg = '无法播放视频文件，请检查文件格式或重新选择';
                                }

                                setError(errorMsg);
                                setHasPermission(false);
                                updateCameraStatus(currentCamera.id, 'offline');
                            }}
                            onLoadedMetadata={() => {
                                console.log('视频元数据加载完成', { cameraId: currentCamera?.id });
                                // 视频元数据加载完成，尝试自动播放
                                if (fileVideoRef.current && fileVideoUrl) {
                                    fileVideoRef.current.play().catch(err => {
                                        console.log('自动播放被阻止，等待用户交互:', err);
                                    });
                                    setHasPermission(true);
                                    setError('');
                                    updateCameraStatus(currentCamera.id, 'online');
                                }
                            }}
                            onCanPlay={() => {
                                console.log('视频可以播放', { cameraId: currentCamera?.id });
                                // 视频可以播放时，尝试自动播放
                                if (fileVideoRef.current && fileVideoUrl) {
                                    fileVideoRef.current.play().catch(err => {
                                        console.log('自动播放被阻止:', err);
                                    });
                                    setHasPermission(true);
                                    setError('');
                                    updateCameraStatus(currentCamera.id, 'online');
                                }
                            }}
                            onPlay={() => {
                                console.log('视频开始播放', { cameraId: currentCamera?.id });
                                setHasPermission(true);
                                setError('');
                                updateCameraStatus(currentCamera.id, 'online');
                            }}
                            onLoadStart={() => {
                                console.log('视频开始加载:', {
                                    url: fileVideoUrl?.substring(0, 50),
                                    cameraId: currentCamera.id,
                                    cameraName: currentCamera.name,
                                    hasRef: !!fileVideoRef.current,
                                    videoSrc: fileVideoRef.current?.src?.substring(0, 50)
                                });
                            }}
                            onLoadedData={() => {
                                console.log('视频数据加载完成');
                            }}
                        />
                    ) : isRemoteFileUrl && (fileVideoBlobLoading || fileVideoBlobError) ? (
                        <div className="flex flex-col items-center justify-center h-full text-gray-500">
                            {fileVideoBlobLoading ? (
                                <>
                                    <div className="animate-spin rounded-full h-10 w-10 border-2 border-blue-500 border-t-transparent mb-4" />
                                    <p className="text-sm">正在加载视频…</p>
                                    <p className="text-xs text-gray-400 mt-1">不影响识别等请求</p>
                                </>
                            ) : (
                                <>
                                    <AlertTriangle size={48} className="mb-4 text-yellow-500" />
                                    <p>{fileVideoBlobError || '视频加载失败'}</p>
                                    <button
                                        type="button"
                                        className="mt-3 px-4 py-2 rounded-lg bg-blue-500 text-white text-sm hover:bg-blue-600"
                                        onClick={() => { setFileVideoBlobError(null); setFileVideoBlobLoading(true); setFileVideoBlobRetry(r => r + 1); }}
                                    >
                                        重试
                                    </button>
                                </>
                            )}
                        </div>
                    ) : (
                        <div className="flex flex-col items-center justify-center h-full text-gray-500">
                            <AlertTriangle size={48} className="mb-4 text-yellow-500" />
                            <p>未配置视频文件</p>
                            <p className="text-sm mt-2 text-gray-400">请重新添加视频文件</p>
                        </div>
                    )
                ) : (isStream && streamPreviewUrl) ? (
                    <div className="w-full h-full relative" key={`stream-wrap-${effectiveCameraId}`}>
                        <img
                            ref={remoteVideoRef}
                            key={`stream-${effectiveCameraId}`}
                            src={streamPreviewUrl}
                            alt="Remote Stream"
                            className="w-full h-full object-cover"
                            crossOrigin="anonymous"
                            onLoad={() => {
                                setHasPermission(true);
                                setError('');
                                updateCameraStatus(currentCamera?.id ?? '', 'online');
                            }}
                            onError={() => {
                                if (!useDirectStreamPreview && directStreamUrl) {
                                    setUseDirectStreamPreview(true);
                                    setError('代理连接失败，已自动切换到摄像头直连预览');
                                    return;
                                }
                                setError('无法连接到远程摄像头流');
                            }}
                        />
                        {!hasPermission && (
                            <div className="absolute inset-0 flex items-center justify-center bg-black/60">
                                <div className="animate-spin rounded-full h-8 w-8 border-2 border-blue-500 border-t-transparent" />
                                <span className="ml-3 text-white text-sm">连接中…</span>
                            </div>
                        )}
                    </div>
                ) : hasPermission && isLocal ? (
                    <video
                        ref={videoRef}
                        autoPlay
                        playsInline
                        muted
                        className="w-full h-full object-cover"
                    />
                ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center text-gray-500">
                        <VideoOff size={48} className="mb-4 opacity-50" />
                        <p>{isLocal ? '摄像头已关闭' : isFile ? '视频文件未加载' : '远程监控已暂停'}</p>
                        {isFile && currentCamera?.url && (
                            <p className="text-sm mt-2 text-yellow-600">
                                提示：如果视频文件无法播放，可能是文件已失效，请重新添加视频文件
                            </p>
                        )}
                        {!isFile && (
                            <p className="text-sm mt-2">点击下方按钮开启识别</p>
                        )}
                    </div>
                )}
                <canvas ref={canvasRef} className="hidden" />

                {hasPermission && (
                    <div className="absolute inset-0 pointer-events-none">
                        <div className="absolute top-4 right-4 bg-black/60 backdrop-blur-md px-3 py-1.5 rounded-lg flex items-center gap-2 z-20">
                            {isLocal ? <VideoIcon size={14} className="text-white" /> : <VideoIcon size={14} className="text-blue-400" />}
                            <span className="text-white text-xs font-medium">{currentCamera.name}</span>
                        </div>

                        {!detectedRect && (
                            <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-52 h-28 sm:w-64 sm:h-32 border-2 border-blue-500 rounded-lg opacity-70 transition-opacity duration-300">
                                <div className="absolute top-0 left-0 w-4 h-4 border-t-2 border-l-2 border-blue-400 -mt-1 -ml-1"></div>
                                <div className="absolute top-0 right-0 w-4 h-4 border-t-2 border-r-2 border-blue-400 -mt-1 -mr-1"></div>
                                <div className="absolute bottom-0 left-0 w-4 h-4 border-b-2 border-l-2 border-blue-400 -mb-1 -ml-1"></div>
                                <div className="absolute bottom-0 right-0 w-4 h-4 border-b-2 border-r-2 border-blue-400 -mb-1 -mr-1"></div>

                                {isScanning && (
                                    <div className="absolute top-1/2 left-0 w-full h-0.5 bg-blue-400 animate-scan opacity-50"></div>
                                )}
                            </div>
                        )}

                        {detectedRect && recentRecognition && recentRecognition.plates[0] && (
                            (() => {
                                const isAnyBlacklisted = recentRecognition.plates.some(p => blacklist.has(p.number));
                                return (
                                    <div
                                        className={`absolute border-2 rounded transition-all duration-300 ${isAnyBlacklisted
                                                ? 'border-red-500 bg-red-500/30 animate-pulse'
                                                : 'border-green-500 bg-green-500/20'
                                            }`}
                                        style={{
                                            left: `${detectedRect.x * scale + offsetX}px`,
                                            top: `${detectedRect.y * scale + offsetY}px`,
                                            width: `${detectedRect.w * scale}px`,
                                            height: `${detectedRect.h * scale}px`,
                                        }}
                                    >
                                        <div className={`absolute -top-7 left-0 text-white text-xs px-2 py-0.5 rounded font-bold ${isAnyBlacklisted ? 'bg-red-600' : 'bg-green-500'
                                            }`}>
                                            {recentRecognition.plates[0].number}
                                            {recentRecognition.plates.length > 1 && (
                                                <span className="ml-1 opacity-90">+{recentRecognition.plates.length - 1}</span>
                                            )}
                                        </div>
                                    </div>
                                );
                            })()
                        )}

                        <div className="absolute top-4 left-4 bg-black/60 backdrop-blur-md px-3 py-1.5 rounded-full flex items-center gap-2 z-20">
                            <div className={`w-2.5 h-2.5 rounded-full ${isScanning ? 'bg-green-500 animate-pulse' : 'bg-gray-400'}`}></div>
                            <span className="text-white text-xs font-medium">
                                {isScanning ? '智能检测中...' : '已暂停'}
                            </span>
                        </div>
                        <div className="absolute top-16 left-4 bg-black/60 backdrop-blur-md px-3 py-1 rounded-md z-20">
                            <span className="text-white/90 text-xs font-medium">
                                输入分辨率: {inputResolutionLabel}
                            </span>
                        </div>
                    </div>
                )}

                {/* 识别结果卡片：优先用“送识别的画面”快照，避免视频文件模式下列车已过才出结果的错位 */}
                {(recognitionSnapshot || (recentRecognition && recentRecognition.plates.length > 0)) && (
                    (() => {
                        const snap = recognitionSnapshot;
                        const plates = snap?.plates ?? (recentRecognition!.plates);
                        const isAnyBlacklisted = plates.some(p => blacklist.has(p.number));
                        const showSnapshot = !!snap && plates.length > 0;
                        return (
                            <div className={`absolute bottom-24 left-1/2 transform -translate-x-1/2 z-30 pointer-events-auto animate-in slide-in-from-bottom-5 duration-300 px-2 sm:px-0 ${isAnyBlacklisted ? 'w-full max-w-md' : 'w-full max-w-sm'
                                }`}>
                                <div className={`rounded-xl shadow-2xl border-2 overflow-hidden overflow-y-auto max-h-[85vh] flex flex-col ${isAnyBlacklisted ? 'bg-red-50 border-red-500' : 'bg-white border-blue-200'
                                    }`}>
                                    {isAnyBlacklisted && (
                                        <div className="bg-red-600 text-white px-4 py-2 flex items-center gap-2 shrink-0">
                                            <ShieldAlert size={18} className="animate-pulse" />
                                            <span className="font-bold">⚠️ 黑名单车辆告警</span>
                                        </div>
                                    )}
                                    {/* 移动端结果在上、图片在下，避免只看到图看不到结果；桌面端保持图在上 */}
                                    <div className="p-4 shrink-0 order-1 sm:order-2">
                                        <div className="flex items-center justify-between mb-3">
                                            <div className="flex flex-wrap items-center gap-2">
                                                {plates.map((p) => (
                                                    <span
                                                        key={p.id}
                                                        className={`text-xl font-bold font-mono px-2.5 py-1 rounded border flex items-center gap-1 ${p.type === 'blue' ? 'bg-blue-600 text-white border-blue-600' :
                                                                p.type === 'green' ? 'bg-green-50 text-green-600 border-green-200' :
                                                                    p.type === 'yellow' ? 'bg-yellow-500 text-white border-yellow-500' :
                                                                        'bg-gray-100 text-gray-700 border-gray-200'
                                                            }`}
                                                    >
                                                        {p.number}
                                                        {blacklist.has(p.number) && (
                                                            <span className="text-xs bg-red-100 text-red-700 px-1.5 py-0.5 rounded">黑名单</span>
                                                        )}
                                                    </span>
                                                ))}
                                            </div>
                                            <button
                                                onClick={() => {
                                                    setRecognitionSnapshot(prev => { if (prev?.url) URL.revokeObjectURL(prev.url); return null; });
                                                    setRecentRecognition(null);
                                                }}
                                                className="text-gray-400 hover:text-gray-600 transition-colors"
                                            >
                                                <X size={18} />
                                            </button>
                                        </div>
                                        <div className="grid grid-cols-2 gap-3 text-sm">
                                            <div className="bg-gray-50 rounded-lg p-2">
                                                <div className="text-xs text-gray-500 mb-1">识别数量</div>
                                                <div className="font-semibold text-gray-800">{plates.length} 个车牌</div>
                                            </div>
                                            <div className="bg-gray-50 rounded-lg p-2">
                                                <div className="text-xs text-gray-500 mb-1">平均置信度</div>
                                                <div className="font-semibold text-gray-800">
                                                    {((plates.reduce((a, p) => a + p.confidence, 0) / plates.length) * 100).toFixed(1)}%
                                                </div>
                                            </div>
                                        </div>
                                        {plates[0].location && (
                                            <div className="mt-3 text-xs text-gray-500">位置: {plates[0].location}</div>
                                        )}
                                        <div className="mt-3 text-xs text-gray-400">
                                            {new Date(plates[0].timestamp).toLocaleString('zh-CN')}
                                        </div>
                                    </div>
                                    {showSnapshot && (
                                        <div className="relative w-full bg-black shrink-0 order-2 sm:order-1 max-h-[28vh] sm:max-h-[min(40vh,280px)]">
                                            <img
                                                src={snap!.url}
                                                alt="识别帧"
                                                className="w-full h-auto object-contain block"
                                            />
                                            {snap!.rect && snap!.captureWidth > 0 && (
                                                <div
                                                    className="absolute border-2 border-green-400 bg-green-400/20 pointer-events-none"
                                                    style={{
                                                        left: `${(snap!.rect.x / snap!.captureWidth) * 100}%`,
                                                        top: `${(snap!.rect.y / snap!.captureHeight) * 100}%`,
                                                        width: `${(snap!.rect.w / snap!.captureWidth) * 100}%`,
                                                        height: `${(snap!.rect.h / snap!.captureHeight) * 100}%`
                                                    }}
                                                />
                                            )}
                                        </div>
                                    )}
                                </div>
                            </div>
                        );
                    })()
                )}
            </div>

            <div className="absolute bottom-6 left-1/2 transform -translate-x-1/2 flex gap-4 pointer-events-auto z-10 px-2 sm:px-0">
                <button
                    onClick={toggleScanning}
                    disabled={!!error || fileVideoBlobLoading || (isStream && !hasPermission)}
                    className={`flex items-center gap-2 px-4 sm:px-6 py-2.5 rounded-full font-medium transition-all whitespace-nowrap ${isScanning
                        ? 'bg-red-500/90 hover:bg-red-600 text-white shadow-lg shadow-red-500/20'
                        : 'bg-blue-500/90 hover:bg-blue-600 text-white shadow-lg shadow-blue-500/20'
                        } disabled:opacity-50 disabled:cursor-not-allowed disabled:pointer-events-none`}
                >
                    {isScanning ? (
                        <>
                            <CameraOff size={18} />
                            <span>停止识别</span>
                        </>
                    ) : (
                        <>
                            <Camera size={18} />
                            <span>开启识别</span>
                        </>
                    )}
                </button>
            </div>

            {error && (
                <div className="absolute inset-0 flex items-center justify-center bg-gray-900/90 z-20">
                    <div className="text-center p-6">
                        <CameraOff size={48} className="mx-auto text-gray-500 mb-4" />
                        <p className="text-white font-medium mb-2">无法连接摄像头</p>
                        <p className="text-gray-400 text-sm">{error}</p>
                        <button
                            onClick={() => { setError(''); startCamera(); }}
                            className="mt-4 px-4 py-2 bg-blue-600 rounded-lg text-white text-sm"
                        >
                            重试
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};
