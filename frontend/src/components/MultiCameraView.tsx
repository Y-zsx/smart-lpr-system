import React, { useState, useCallback, useEffect } from 'react';
import { CameraView } from './CameraView';
import { useCameraStore } from '../store/cameraStore';
import { Plus, X, Grid } from 'lucide-react';

interface MonitorWindow {
    id: string;
    cameraId: string | null;
}

export const MultiCameraView: React.FC = () => {
    const { cameras } = useCameraStore();
    const [windows, setWindows] = useState<MonitorWindow[]>([
        { id: 'window-1', cameraId: null }
    ]);
    const [layout, setLayout] = useState<'1x1' | '2x2' | '3x3' | '4x4'>('2x2');
    const [isMobile, setIsMobile] = useState(() =>
        typeof window !== 'undefined' ? window.innerWidth < 640 : false
    );

    useEffect(() => {
        const onResize = () => setIsMobile(window.innerWidth < 640);
        window.addEventListener('resize', onResize);
        return () => window.removeEventListener('resize', onResize);
    }, []);

    const addWindow = useCallback(() => {
        const newWindow: MonitorWindow = {
            id: `window-${Date.now()}`,
            cameraId: null
        };
        setWindows(prev => [...prev, newWindow]);
    }, []);

    const removeWindow = useCallback((windowId: string) => {
        setWindows(prev => {
            const filtered = prev.filter(w => w.id !== windowId);
            // 至少保留一个窗口
            return filtered.length > 0 ? filtered : [{ id: 'window-1', cameraId: null }];
        });
    }, []);

    const setWindowCamera = useCallback((windowId: string, cameraId: string | null) => {
        setWindows(prev => prev.map(w => 
            w.id === windowId ? { ...w, cameraId } : w
        ));
    }, []);

    const getLayoutClass = () => {
        if (isMobile) {
            return layout === '2x2' ? 'grid-cols-1 grid-rows-2' : 'grid-cols-1 grid-rows-1';
        }
        switch (layout) {
            case '1x1':
                return 'grid-cols-1 grid-rows-1';
            case '2x2':
                return 'grid-cols-2 grid-rows-2';
            case '3x3':
                return 'grid-cols-3 grid-rows-3';
            case '4x4':
                return 'grid-cols-4 grid-rows-4';
            default:
                return 'grid-cols-2 grid-rows-2';
        }
    };

    const getMaxWindows = () => {
        if (isMobile) {
            return layout === '1x1' ? 1 : 2;
        }
        switch (layout) {
            case '1x1': return 1;
            case '2x2': return 4;
            case '3x3': return 9;
            case '4x4': return 16;
            default: return 4;
        }
    };

    const maxWindows = getMaxWindows();
    const displayWindows = windows.slice(0, maxWindows);
    const availableLayouts = (isMobile ? (['1x1', '2x2'] as const) : (['1x1', '2x2', '3x3', '4x4'] as const));

    useEffect(() => {
        if (isMobile && (layout === '3x3' || layout === '4x4')) {
            setLayout('2x2');
        }
    }, [isMobile, layout]);

    useEffect(() => {
        setWindows(prev => {
            if (prev.length <= maxWindows) return prev;
            return prev.slice(0, maxWindows);
        });
    }, [maxWindows]);

    return (
        <div className="w-full h-full flex flex-col bg-gray-50">
            {/* 工具栏 */}
            <div className="bg-white border-b border-gray-200 p-2 flex items-center justify-between gap-2 shrink-0">
                <div className="flex items-center gap-2 min-w-0 overflow-x-auto">
                    <span className="text-sm font-medium text-gray-700">布局:</span>
                    <div className="flex gap-1">
                        {availableLayouts.map((l) => (
                            <button
                                key={l}
                                onClick={() => {
                                    setLayout(l);
                                    // 调整窗口数量以适应新布局
                                    const max = isMobile
                                        ? (l === '1x1' ? 1 : 2)
                                        : (l === '1x1' ? 1 : l === '2x2' ? 4 : l === '3x3' ? 9 : 16);
                                    setWindows(prev => {
                                        if (prev.length > max) {
                                            return prev.slice(0, max);
                                        } else if (prev.length < max) {
                                            const newWindows: MonitorWindow[] = [...prev];
                                            for (let i = prev.length; i < max; i++) {
                                                newWindows.push({ id: `window-${Date.now()}-${i}`, cameraId: null });
                                            }
                                            return newWindows;
                                        }
                                        return prev;
                                    });
                                }}
                                className={`px-3 py-1 rounded text-xs font-medium whitespace-nowrap transition-colors ${
                                    layout === l
                                        ? 'bg-blue-600 text-white'
                                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                                }`}
                            >
                                {l}
                            </button>
                        ))}
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    {displayWindows.length < maxWindows && (
                        <button
                            onClick={addWindow}
                            className="px-3 py-1 bg-blue-600 text-white rounded text-sm font-medium hover:bg-blue-700 flex items-center gap-1 whitespace-nowrap"
                        >
                            <Plus size={14} />
                            <span className="hidden sm:inline">添加窗口</span>
                            <span className="sm:hidden">添加</span>
                        </button>
                    )}
                </div>
            </div>

            {/* 监控窗口网格 */}
            <div className={`flex-1 grid ${getLayoutClass()} gap-2 p-2 min-h-0`}>
                {displayWindows.map((window) => (
                    <MonitorWindow
                        key={window.id}
                        window={window}
                        cameras={cameras}
                        onRemove={() => removeWindow(window.id)}
                        onCameraChange={(cameraId) => setWindowCamera(window.id, cameraId)}
                    />
                ))}
            </div>
        </div>
    );
};

interface MonitorWindowProps {
    window: MonitorWindow;
    cameras: any[];
    onRemove: () => void;
    onCameraChange: (cameraId: string | null) => void;
}

const MonitorWindow: React.FC<MonitorWindowProps> = ({ window, cameras, onCameraChange, onRemove }) => {
    const [isSelecting, setIsSelecting] = useState(false);

    // 设置这个窗口的摄像头
    const handleCameraSelect = (cameraId: string) => {
        onCameraChange(cameraId);
        setIsSelecting(false);
    };

    const currentCamera = window.cameraId 
        ? cameras.find(c => c.id === window.cameraId)
        : null;

    return (
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm flex flex-col min-h-0 relative group">
            {/* 窗口头部 */}
            <div className="flex items-center justify-between p-2 border-b border-gray-100 shrink-0 bg-gray-50">
                <div className="flex items-center gap-2 flex-1 min-w-0">
                    {currentCamera ? (
                        <span className="text-xs font-medium text-gray-700 truncate">
                            {currentCamera.name}
                        </span>
                    ) : (
                        <span className="text-xs text-gray-400">未选择摄像头</span>
                    )}
                </div>
                <div className="flex items-center gap-1">
                    <button
                        onClick={() => setIsSelecting(!isSelecting)}
                        className="p-1 hover:bg-gray-200 rounded text-gray-500 hover:text-gray-700"
                        title="选择摄像头"
                    >
                        <Grid size={14} />
                    </button>
                    <button
                        onClick={onRemove}
                        className="p-1 hover:bg-red-50 rounded text-gray-500 hover:text-red-600"
                        title="关闭窗口"
                    >
                        <X size={14} />
                    </button>
                </div>
            </div>

            {/* 摄像头选择下拉菜单 */}
            {isSelecting && (
                <div className="absolute top-10 left-2 right-2 z-50 bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                    <div className="p-1">
                        {cameras.length === 0 ? (
                            <div className="p-2 text-xs text-gray-400 text-center">暂无摄像头</div>
                        ) : (
                            cameras.map((camera) => (
                                <button
                                    key={camera.id}
                                    onClick={() => handleCameraSelect(camera.id)}
                                    className={`w-full text-left px-3 py-2 text-xs rounded hover:bg-gray-100 transition-colors ${
                                        window.cameraId === camera.id ? 'bg-blue-50 text-blue-600' : 'text-gray-700'
                                    }`}
                                >
                                    <div className="font-medium">{camera.name}</div>
                                    <div className="text-gray-400 text-xs mt-0.5">
                                        {camera.type === 'local' ? '本地设备' : 
                                         camera.type === 'file' ? '视频文件' : 
                                         '网络流'}
                                    </div>
                                </button>
                            ))
                        )}
                    </div>
                </div>
            )}

            {/* 视频显示区域 */}
            <div className="flex-1 bg-black relative min-h-0 overflow-hidden">
                {window.cameraId ? (
                    <CameraViewWindow 
                        cameraId={window.cameraId} 
                        windowId={window.id}
                    />
                ) : (
                    <div className="w-full h-full flex items-center justify-center text-gray-400">
                        <div className="text-center">
                            <Grid size={32} className="mx-auto mb-2 opacity-50" />
                            <p className="text-sm">点击上方按钮选择摄像头</p>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

// 独立的 CameraView 窗口组件，支持多实例
interface CameraViewWindowProps {
    cameraId: string;
    windowId: string;
}

const CameraViewWindow: React.FC<CameraViewWindowProps> = ({ cameraId, windowId }) => {
    // 直接传递 cameraId prop，让 CameraView 使用指定的摄像头
    // 使用 independentScanning 让每个窗口有独立的扫描状态
    // 使用 windowId 作为 key 的一部分，确保窗口切换时正确重新渲染
    return (
        <div className="w-full h-full">
            <CameraView 
                cameraId={cameraId} 
                key={`${windowId}-${cameraId}`} 
                independentScanning={true}
            />
        </div>
    );
};
