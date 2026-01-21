import React, { useEffect, useRef, useState } from 'react';
import { Camera, CameraOff, Video as VideoIcon, VideoOff, AlertTriangle } from 'lucide-react';
import { usePlateStore } from '../store/plateStore';
import { useCameraStore } from '../store/cameraStore';
import { plateService } from '../services/plateService';
import { Rect } from '../types/plate';
import { hapticFeedback } from '../utils/mobileFeatures';

export const CameraView: React.FC = () => {
    const containerRef = useRef<HTMLDivElement>(null);
    const videoRef = useRef<HTMLVideoElement>(null);
    const remoteVideoRef = useRef<HTMLImageElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [error, setError] = useState<string>('');
    const [hasPermission, setHasPermission] = useState<boolean>(false);
    const [detectedRect, setDetectedRect] = useState<Rect | null>(null);
    const [dimensions, setDimensions] = useState({ width: 0, height: 0 });

    const { isScanning, setScanning, addPlate, settings } = usePlateStore();
    const { cameras, selectedCameraId, updateCameraStatus } = useCameraStore();

    const currentCamera = cameras.find(c => c.id === selectedCameraId) || cameras[0];
    const isLocal = currentCamera.type === 'local';

    const scanIntervalRef = useRef<number | null>(null);
    const streamRef = useRef<MediaStream | null>(null);
    const lastFrameDataRef = useRef<Uint8ClampedArray | null>(null);

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

    const startCamera = async () => {
        if (!isLocal) {
            setHasPermission(true);
            setError('');
            updateCameraStatus(currentCamera.id, 'online');
            return;
        }

        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                video: { facingMode: 'environment' }
            });

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
    }, [hasPermission, isLocal, currentCamera.id]);

    const stopCamera = () => {
        if (streamRef.current) {
            streamRef.current.getTracks().forEach(track => track.stop());
            streamRef.current = null;
        }
        if (videoRef.current) {
            videoRef.current.srcObject = null;
        }
        if (isLocal) {
            setHasPermission(false);
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

    const captureAndRecognize = async () => {
        if (!isScanning) return;

        let sourceElement: HTMLVideoElement | HTMLImageElement | null = null;

        if (isLocal) {
            sourceElement = videoRef.current;
        } else {
            sourceElement = remoteVideoRef.current;
        }

        if (!sourceElement || !canvasRef.current) return;

        const canvas = canvasRef.current;
        const context = canvas.getContext('2d', { willReadFrequently: true });
        if (!context) return;

        const width = isLocal ? (sourceElement as HTMLVideoElement).videoWidth : (sourceElement as HTMLImageElement).naturalWidth;
        const height = isLocal ? (sourceElement as HTMLVideoElement).videoHeight : (sourceElement as HTMLImageElement).naturalHeight;

        if (!width || !height) return;

        if (canvas.width !== width || canvas.height !== height) {
            canvas.width = width;
            canvas.height = height;
        }

        try {
            context.drawImage(sourceElement, 0, 0, width, height);

            if (!hasMotion(context, width, height)) {
                return;
            }

            canvas.toBlob(async (blob) => {
                if (blob) {
                    try {
                        const plate = await plateService.recognizeFromFile(blob, 'stream');

                        if (plate && plate.confidence >= settings.confidenceThreshold) {
                            if (plate.rect) {
                                setDetectedRect(plate.rect);
                                setTimeout(() => setDetectedRect(null), 2000);
                            }

                            if (plate.saved) {
                                addPlate(plate);
                                if (settings.enableHaptics) hapticFeedback('heavy');
                            }
                        }
                    } catch (e) {
                        // 忽略错误
                    }
                }
            }, 'image/jpeg', 0.8);
        } catch (e) {
            console.warn("Canvas security error", e);
        }
    };

    useEffect(() => {
        return () => {
            stopCamera();
            if (scanIntervalRef.current) clearInterval(scanIntervalRef.current);
        };
    }, [currentCamera.id]);

    useEffect(() => {
        if (isScanning) {
            if (isLocal && !streamRef.current) {
                startCamera();
            } else if (!isLocal) {
                startCamera();
            }

            scanIntervalRef.current = window.setInterval(captureAndRecognize, settings.scanInterval);
        } else {
            if (scanIntervalRef.current) {
                clearInterval(scanIntervalRef.current);
                scanIntervalRef.current = null;
            }
            stopCamera();
            setDetectedRect(null);
        }
    }, [isScanning, currentCamera.id, settings.scanInterval]);

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
        } else if (!isLocal && remoteVideoRef.current) {
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
                {hasPermission ? (
                    isLocal ? (
                        <video
                            ref={videoRef}
                            autoPlay
                            playsInline
                            muted
                            className="w-full h-full object-cover"
                        />
                    ) : (
                        <div className="w-full h-full relative">
                            {currentCamera.url ? (
                                <img
                                    ref={remoteVideoRef}
                                    src={currentCamera.url}
                                    alt="Remote Stream"
                                    className="w-full h-full object-cover"
                                    crossOrigin="anonymous"
                                    onError={() => setError('无法连接到远程摄像头流')}
                                />
                            ) : (
                                <div className="flex flex-col items-center justify-center h-full text-gray-500">
                                    <AlertTriangle size={48} className="mb-4 text-yellow-500" />
                                    <p>未配置流地址</p>
                                </div>
                            )}
                        </div>
                    )
                ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center text-gray-500">
                        <VideoOff size={48} className="mb-4 opacity-50" />
                        <p>{isLocal ? '摄像头已关闭' : '远程监控已暂停'}</p>
                        <p className="text-sm mt-2">点击下方按钮开启识别</p>
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
                            <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-64 h-32 border-2 border-blue-500 rounded-lg opacity-70 transition-opacity duration-300">
                                <div className="absolute top-0 left-0 w-4 h-4 border-t-2 border-l-2 border-blue-400 -mt-1 -ml-1"></div>
                                <div className="absolute top-0 right-0 w-4 h-4 border-t-2 border-r-2 border-blue-400 -mt-1 -mr-1"></div>
                                <div className="absolute bottom-0 left-0 w-4 h-4 border-b-2 border-l-2 border-blue-400 -mb-1 -ml-1"></div>
                                <div className="absolute bottom-0 right-0 w-4 h-4 border-b-2 border-r-2 border-blue-400 -mb-1 -mr-1"></div>

                                {isScanning && (
                                    <div className="absolute top-1/2 left-0 w-full h-0.5 bg-blue-400 animate-scan opacity-50"></div>
                                )}
                            </div>
                        )}

                        {detectedRect && (
                            <div
                                className="absolute border-2 border-green-500 bg-green-500/20 rounded transition-all duration-300"
                                style={{
                                    left: `${detectedRect.x * scale + offsetX}px`,
                                    top: `${detectedRect.y * scale + offsetY}px`,
                                    width: `${detectedRect.w * scale}px`,
                                    height: `${detectedRect.h * scale}px`,
                                }}
                            >
                                <div className="absolute -top-6 left-0 bg-green-500 text-white text-xs px-2 py-0.5 rounded">
                                    已识别
                                </div>
                            </div>
                        )}

                        <div className="absolute top-4 left-4 bg-black/60 backdrop-blur-md px-3 py-1.5 rounded-full flex items-center gap-2 z-20">
                            <div className={`w-2.5 h-2.5 rounded-full ${isScanning ? 'bg-green-500 animate-pulse' : 'bg-gray-400'}`}></div>
                            <span className="text-white text-xs font-medium">
                                {isScanning ? '智能检测中...' : '已暂停'}
                            </span>
                        </div>
                    </div>
                )}
            </div>

            <div className="absolute bottom-6 left-1/2 transform -translate-x-1/2 flex gap-4 pointer-events-auto z-10">
                <button
                    onClick={toggleScanning}
                    className={`flex items-center gap-2 px-6 py-2.5 rounded-full font-medium transition-all ${isScanning
                        ? 'bg-red-500/90 hover:bg-red-600 text-white shadow-lg shadow-red-500/20'
                        : 'bg-blue-500/90 hover:bg-blue-600 text-white shadow-lg shadow-blue-500/20'
                        }`}
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
