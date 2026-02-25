import React, { useState } from 'react';
import { Alarm, useAlarmStore } from '../store/alarmStore';
import { Clock, MapPin, X, Image as ImageIcon, Route, CheckCircle, Archive, ZoomIn, ZoomOut, RotateCcw } from 'lucide-react';
import { apiClient } from '../api/client';
import { AlarmPathReplay } from './AlarmPathReplay';
import { useConfirmContext } from '../contexts/ConfirmContext';
import { useToastContext } from '../contexts/ToastContext';
import { useAuth } from '../contexts/AuthContext';
import { type PlateType } from '../types/plate';

interface AlarmDetailProps {
    plateNumber: string;
    alarms: Alarm[];
    onClose: () => void;
}

interface AlarmRect {
    x: number;
    y: number;
    w: number;
    h: number;
}

interface AlarmImageState {
    imageUrl: string;
    rect?: AlarmRect;
    plateNumber: string;
    plateType: PlateType;
}

interface AnnotatedPlateImageProps {
    imageUrl: string;
    rect?: AlarmRect;
    plateNumber: string;
    plateType?: PlateType;
    className?: string;
}

const PLATE_TYPE_COLORS: Record<PlateType, { stroke: string; fill: string; text: string }> = {
    blue: { stroke: '#2563eb', fill: '#2563eb', text: '#ffffff' },
    green: { stroke: '#16a34a', fill: '#16a34a', text: '#ffffff' },
    yellow: { stroke: '#ca8a04', fill: '#ca8a04', text: '#ffffff' },
    white: { stroke: '#64748b', fill: '#64748b', text: '#ffffff' },
    black: { stroke: '#1e293b', fill: '#1e293b', text: '#ffffff' },
};

const isPlateType = (value: unknown): value is PlateType =>
    value === 'blue' || value === 'green' || value === 'yellow' || value === 'white' || value === 'black';

const extractAlarmRect = (alarm: Alarm): AlarmRect | undefined => {
    const extra = alarm as Alarm & {
        rect?: AlarmRect;
        rect_x?: number;
        rect_y?: number;
        rect_w?: number;
        rect_h?: number;
    };
    if (extra.rect && extra.rect.w > 0 && extra.rect.h > 0) {
        return extra.rect;
    }
    if (
        typeof extra.rect_x === 'number' &&
        typeof extra.rect_y === 'number' &&
        typeof extra.rect_w === 'number' &&
        typeof extra.rect_h === 'number' &&
        extra.rect_w > 0 &&
        extra.rect_h > 0
    ) {
        return { x: extra.rect_x, y: extra.rect_y, w: extra.rect_w, h: extra.rect_h };
    }
    return undefined;
};

const extractAlarmPlateType = (alarm: Alarm): PlateType => {
    const extra = alarm as Alarm & {
        plate_type?: unknown;
        plateType?: unknown;
    };
    if (isPlateType(extra.plate_type)) return extra.plate_type;
    if (isPlateType(extra.plateType)) return extra.plateType;
    return 'blue';
};

const AnnotatedPlateImage: React.FC<AnnotatedPlateImageProps> = ({ imageUrl, rect, plateNumber, plateType = 'blue', className }) => {
    const [imageSize, setImageSize] = React.useState<{ w: number; h: number }>({ w: 0, h: 0 });
    const colors = PLATE_TYPE_COLORS[plateType] ?? PLATE_TYPE_COLORS.blue;

    React.useEffect(() => {
        const img = new Image();
        img.onload = () => {
            setImageSize({
                w: img.naturalWidth || 1,
                h: img.naturalHeight || 1
            });
        };
        img.src = imageUrl;
    }, [imageUrl]);

    if (!imageSize.w || !imageSize.h) {
        return <div className={`bg-gray-200 animate-pulse ${className || ''}`} />;
    }

    const safeRect = rect && rect.w > 0 && rect.h > 0 ? rect : null;
    const labelHeight = Math.max(18, Math.round(imageSize.h * 0.04));
    const labelY = safeRect ? Math.max(0, safeRect.y - labelHeight - 2) : 0;

    return (
        <svg
            viewBox={`0 0 ${imageSize.w} ${imageSize.h}`}
            className={className}
            preserveAspectRatio="xMidYMid meet"
        >
            <image href={imageUrl} x="0" y="0" width={imageSize.w} height={imageSize.h} />
            {safeRect && (
                <>
                    <rect
                        x={safeRect.x}
                        y={safeRect.y}
                        width={safeRect.w}
                        height={safeRect.h}
                        fill="none"
                        stroke={colors.stroke}
                        strokeWidth={Math.max(2, Math.round(imageSize.w * 0.003))}
                    />
                    <rect
                        x={safeRect.x}
                        y={labelY}
                        width={Math.max(safeRect.w, plateNumber.length * labelHeight * 0.6)}
                        height={labelHeight}
                        fill={colors.fill}
                        opacity="0.95"
                        rx={Math.max(2, Math.round(labelHeight * 0.2))}
                    />
                    <text
                        x={safeRect.x + 6}
                        y={labelY + labelHeight * 0.72}
                        fill={colors.text}
                        fontSize={Math.max(12, Math.round(labelHeight * 0.6))}
                        fontWeight="700"
                    >
                        {plateNumber}
                    </text>
                </>
            )}
        </svg>
    );
};

export const AlarmDetail: React.FC<AlarmDetailProps> = ({ plateNumber, alarms, onClose }) => {
    const [selectedImage, setSelectedImage] = React.useState<AlarmImageState | null>(null);
    const [showAnnotatedImage, setShowAnnotatedImage] = React.useState(true);
    const [imageScale, setImageScale] = React.useState(1);
    const [imageOffset, setImageOffset] = React.useState({ x: 0, y: 0 });
    const [isDraggingImage, setIsDraggingImage] = React.useState(false);
    const dragStartRef = React.useRef({ x: 0, y: 0 });
    const dragOffsetStartRef = React.useRef({ x: 0, y: 0 });
    const [showPathReplay, setShowPathReplay] = useState(false);
    const { markAsRead, deleteAlarm, deleteAlarmsByPlate } = useAlarmStore();
    const { confirm } = useConfirmContext();
    const toast = useToastContext();
    const auth = useAuth();
    const canManageAlarm = auth.hasPermission('alarm.manage');

    // 格式化告警原因，去掉 "Blacklisted: " 前缀
    const formatReason = (reason: string): string => {
        if (reason.startsWith('Blacklisted: ')) {
            return reason.substring('Blacklisted: '.length);
        }
        return reason;
    };

    // 按时间排序（最新的在前）
    const sortedAlarms = [...alarms].sort((a, b) => b.timestamp - a.timestamp);

    // 统计信息
    const totalCount = alarms.length;
    const unreadCount = alarms.filter(a => !a.is_read).length;
    const severityCounts = {
        high: alarms.filter(a => a.severity === 'high').length,
        medium: alarms.filter(a => a.severity === 'medium').length,
        low: alarms.filter(a => a.severity === 'low').length,
    };
    const latestAlarm = sortedAlarms[0];

    // 检查是否有位置信息的告警
    const hasLocationData = alarms.some(alarm => alarm.location);

    const resetImageView = React.useCallback(() => {
        setImageScale(1);
        setImageOffset({ x: 0, y: 0 });
        setIsDraggingImage(false);
    }, []);

    const closeImageModal = React.useCallback(() => {
        setSelectedImage(null);
        setShowAnnotatedImage(true);
        resetImageView();
    }, [resetImageView]);

    const clampScale = (nextScale: number) => Math.min(4, Math.max(1, nextScale));
    const zoomBy = (delta: number) => {
        setImageScale(prev => clampScale(prev + delta));
    };

    const handleMarkAsRead = async (id: number) => {
        try {
            await markAsRead(id);
            toast.success('已标记为已处理');
        } catch (error) {
            console.error('Failed to mark as read:', error);
            toast.error('标记失败');
        }
    };

    const handleDelete = async (id: number) => {
        const result = await confirm({
            title: '归档告警',
            message: '确定要归档这条告警记录吗？归档后该告警将不再显示，但原始识别记录仍会保留。',
            type: 'info'
        });
        if (result) {
            await deleteAlarm(id);
            toast.success('告警记录已归档');
            // 如果删除了最后一条告警，关闭弹窗
            if (alarms.length <= 1) {
                onClose();
            }
        }
    };

    const handleDeleteAll = async () => {
        const result = await confirm({
            title: '清空告警',
            message: `确定要归档车牌 ${plateNumber} 的所有告警记录吗？原始识别记录仍会保留。`,
            type: 'info'
        });
        if (result) {
            await deleteAlarmsByPlate(plateNumber);
            toast.success('所有告警记录已归档');
            onClose();
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col">
                {/* Header */}
                <div className="p-6 border-b border-gray-200 flex items-center justify-between shrink-0">
                    <div>
                        <h2 className="text-2xl font-bold text-gray-800 font-mono">
                            {plateNumber}
                        </h2>
                        <p className="text-sm text-gray-500 mt-1">
                            共 {totalCount} 条告警记录 {unreadCount > 0 && `| ${unreadCount} 条未处理`}
                        </p>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                    >
                        <X size={20} className="text-gray-500" />
                    </button>
                </div>

                {/* Action Buttons */}
                <div className="p-4 border-b border-gray-200 shrink-0 flex gap-3">
                    {hasLocationData && (
                        <button
                            onClick={() => setShowPathReplay(true)}
                            className="flex items-center gap-2 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
                        >
                            <Route size={18} />
                            查看路径重现
                        </button>
                    )}
                    {canManageAlarm && (
                        <button
                            onClick={handleDeleteAll}
                            className="flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-600 rounded-lg hover:bg-gray-200 transition-colors ml-auto"
                        >
                            <Archive size={18} />
                            归档所有告警
                        </button>
                    )}
                </div>

                {/* Info Cards */}
                <div className="p-6 grid grid-cols-2 md:grid-cols-4 gap-4 shrink-0 border-b border-gray-200">
                    <div className="bg-red-50 p-4 rounded-lg">
                        <p className="text-xs text-gray-500 mb-1">严重告警</p>
                        <p className="text-lg font-bold text-red-600">
                            {severityCounts.high}
                        </p>
                    </div>
                    <div className="bg-orange-50 p-4 rounded-lg">
                        <p className="text-xs text-gray-500 mb-1">警告告警</p>
                        <p className="text-lg font-bold text-orange-600">
                            {severityCounts.medium}
                        </p>
                    </div>
                    <div className="bg-yellow-50 p-4 rounded-lg">
                        <p className="text-xs text-gray-500 mb-1">提示告警</p>
                        <p className="text-lg font-bold text-yellow-600">
                            {severityCounts.low}
                        </p>
                    </div>
                    <div className="bg-blue-50 p-4 rounded-lg">
                        <p className="text-xs text-gray-500 mb-1">最新告警</p>
                        <p className="text-sm font-medium text-gray-800">
                            {latestAlarm ? new Date(latestAlarm.timestamp).toLocaleString('zh-CN') : '无'}
                        </p>
                    </div>
                </div>

                {/* Alarms List */}
                <div className="flex-1 overflow-y-auto p-6">
                    <h3 className="text-lg font-semibold text-gray-800 mb-4">告警记录（按时间排序）</h3>
                    <div className="space-y-3">
                        {sortedAlarms.map((alarm) => (
                            <div
                                key={alarm.id}
                                className={`p-4 rounded-lg border transition-all ${
                                    alarm.severity === 'high' ? 'bg-red-50 border-red-200 hover:border-red-300' :
                                    alarm.severity === 'medium' ? 'bg-orange-50 border-orange-200 hover:border-orange-300' :
                                    'bg-yellow-50 border-yellow-200 hover:border-yellow-300'
                                }`}
                            >
                                <div className="flex items-start justify-between gap-4">
                                    <div className="flex-1">
                                        <div className="flex items-center gap-3 mb-2">
                                            <span className={`text-xs px-2.5 py-1 rounded-full border font-medium ${
                                                alarm.severity === 'high' ? 'bg-red-100 text-red-700 border-red-200' :
                                                alarm.severity === 'medium' ? 'bg-orange-100 text-orange-700 border-orange-200' :
                                                'bg-yellow-100 text-yellow-700 border-yellow-200'
                                            }`}>
                                                {alarm.severity === 'high' ? '严重' : alarm.severity === 'medium' ? '警告' : '提示'}
                                            </span>
                                            {alarm.is_read === 0 ? (
                                                <span className="text-xs bg-red-500 text-white px-2 py-0.5 rounded-full">
                                                    未处理
                                                </span>
                                            ) : (
                                                <span className="text-xs bg-green-500 text-white px-2 py-0.5 rounded-full flex items-center gap-1">
                                                    <CheckCircle size={10} /> 已处理
                                                </span>
                                            )}
                                            <div className="flex items-center gap-1 text-xs text-gray-500">
                                                <Clock size={12} />
                                                <span>{new Date(alarm.timestamp).toLocaleString('zh-CN')}</span>
                                            </div>
                                        </div>
                                        <p className={`text-sm font-medium mb-2 ${
                                            alarm.severity === 'high' ? 'text-red-700' :
                                            alarm.severity === 'medium' ? 'text-orange-700' :
                                            'text-yellow-700'
                                        }`}>
                                            告警原因: {formatReason(alarm.reason)}
                                        </p>
                                        {alarm.location && (
                                            <div className="flex items-center gap-1 text-xs text-gray-600">
                                                <MapPin size={12} />
                                                <span>{alarm.location}</span>
                                            </div>
                                        )}
                                    </div>
                                    
                                    <div className="flex items-center gap-2">
                                        {canManageAlarm && alarm.is_read === 0 && (
                                            <button
                                                onClick={() => handleMarkAsRead(alarm.id)}
                                                className="p-2 bg-white hover:bg-green-50 text-green-600 rounded-lg border border-gray-200 transition-colors flex-shrink-0"
                                                title="标记为已处理"
                                            >
                                                <CheckCircle size={18} />
                                            </button>
                                        )}
                                        
                                        {alarm.image_path && (
                                            <button
                                                onClick={() => {
                                                    const imageUrl = apiClient.getImageUrl(alarm.image_path);
                                                    const rect = extractAlarmRect(alarm);
                                                    const nextImage = {
                                                        imageUrl,
                                                        rect,
                                                        plateNumber: alarm.plate_number,
                                                        plateType: extractAlarmPlateType(alarm),
                                                    };
                                                    resetImageView();
                                                    setSelectedImage(nextImage);
                                                    setShowAnnotatedImage(Boolean(rect));
                                                }}
                                                className="p-2 bg-white hover:bg-blue-50 text-blue-600 rounded-lg border border-gray-200 transition-colors flex-shrink-0"
                                                title="查看图片"
                                            >
                                                <ImageIcon size={18} />
                                            </button>
                                        )}
                                        
                                        {canManageAlarm && (
                                            <button
                                                onClick={() => handleDelete(alarm.id)}
                                                className="p-2 bg-white hover:bg-gray-100 text-gray-600 rounded-lg border border-gray-200 transition-colors flex-shrink-0"
                                                title="归档记录"
                                            >
                                                <Archive size={18} />
                                            </button>
                                        )}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Image Modal */}
                {selectedImage && (
                    <div
                        className="fixed inset-0 z-60 flex items-center justify-center bg-black/80 p-4"
                        onClick={closeImageModal}
                    >
                        <div className="relative max-w-5xl w-full max-h-[90vh]" onClick={(e) => e.stopPropagation()}>
                            <div className="absolute top-4 left-4 z-10 flex items-center gap-2 bg-black/55 backdrop-blur-sm rounded-lg p-2">
                                <div className="mr-2 flex items-center gap-1 rounded-md bg-white/95 p-1">
                                    <button
                                        onClick={() => setShowAnnotatedImage(false)}
                                        className={`px-2 py-1 text-xs rounded transition-colors ${
                                            !showAnnotatedImage ? 'bg-blue-600 text-white' : 'text-gray-700 hover:bg-gray-100'
                                        }`}
                                        title="显示原图"
                                    >
                                        原图
                                    </button>
                                    <button
                                        onClick={() => setShowAnnotatedImage(true)}
                                        className={`px-2 py-1 text-xs rounded transition-colors ${
                                            showAnnotatedImage ? 'bg-blue-600 text-white' : 'text-gray-700 hover:bg-gray-100'
                                        }`}
                                        title={selectedImage.rect ? '显示标注图' : '暂无标注数据，回退原图显示'}
                                    >
                                        标注图
                                    </button>
                                </div>
                                <button
                                    onClick={() => zoomBy(-0.2)}
                                    disabled={imageScale <= 1}
                                    className="p-2 bg-white/95 hover:bg-white rounded-lg transition-colors disabled:opacity-50"
                                    title="缩小"
                                >
                                    <ZoomOut size={18} className="text-gray-800" />
                                </button>
                                <button
                                    onClick={() => zoomBy(0.2)}
                                    disabled={imageScale >= 4}
                                    className="p-2 bg-white/95 hover:bg-white rounded-lg transition-colors disabled:opacity-50"
                                    title="放大"
                                >
                                    <ZoomIn size={18} className="text-gray-800" />
                                </button>
                                <button
                                    onClick={resetImageView}
                                    className="p-2 bg-white/95 hover:bg-white rounded-lg transition-colors"
                                    title="复位"
                                >
                                    <RotateCcw size={18} className="text-gray-800" />
                                </button>
                                <span className="text-xs text-white px-2">{Math.round(imageScale * 100)}%</span>
                            </div>

                            <div
                                className="w-full h-[80vh] overflow-hidden rounded-lg cursor-grab active:cursor-grabbing select-none"
                                onWheel={(e) => {
                                    e.preventDefault();
                                    zoomBy(e.deltaY > 0 ? -0.1 : 0.1);
                                }}
                                onMouseDown={(e) => {
                                    if (imageScale <= 1) return;
                                    setIsDraggingImage(true);
                                    dragStartRef.current = { x: e.clientX, y: e.clientY };
                                    dragOffsetStartRef.current = imageOffset;
                                }}
                                onMouseMove={(e) => {
                                    if (!isDraggingImage || imageScale <= 1) return;
                                    const dx = e.clientX - dragStartRef.current.x;
                                    const dy = e.clientY - dragStartRef.current.y;
                                    setImageOffset({
                                        x: dragOffsetStartRef.current.x + dx,
                                        y: dragOffsetStartRef.current.y + dy,
                                    });
                                }}
                                onMouseUp={() => setIsDraggingImage(false)}
                                onMouseLeave={() => setIsDraggingImage(false)}
                            >
                                <div
                                    className="w-full h-full transition-transform duration-100"
                                    onDoubleClick={() => {
                                        setImageOffset({ x: 0, y: 0 });
                                        setImageScale(prev => (prev <= 1.05 ? 2 : 1));
                                    }}
                                    style={{
                                        transform: `translate(${imageOffset.x}px, ${imageOffset.y}px) scale(${imageScale})`,
                                        transformOrigin: 'center center',
                                    }}
                                >
                                    <div className="relative w-full h-full">
                                        <img
                                            src={selectedImage.imageUrl}
                                            alt="告警图片原图"
                                            draggable={false}
                                            className="absolute inset-0 w-full h-full object-contain rounded-lg"
                                            style={{
                                                visibility: showAnnotatedImage && selectedImage.rect ? 'hidden' : 'visible',
                                                pointerEvents: showAnnotatedImage && selectedImage.rect ? 'none' : 'auto'
                                            }}
                                        />
                                        <div
                                            className="absolute inset-0 w-full h-full"
                                            style={{
                                                visibility: showAnnotatedImage && selectedImage.rect ? 'visible' : 'hidden',
                                                pointerEvents: showAnnotatedImage && selectedImage.rect ? 'auto' : 'none'
                                            }}
                                        >
                                            <AnnotatedPlateImage
                                                imageUrl={selectedImage.imageUrl}
                                                rect={selectedImage.rect}
                                                plateNumber={selectedImage.plateNumber}
                                                plateType={selectedImage.plateType}
                                                className="w-full h-full object-contain rounded-lg"
                                            />
                                        </div>
                                    </div>
                                </div>
                            </div>
                            <button
                                onClick={closeImageModal}
                                className="absolute top-4 right-4 p-2 bg-white/90 hover:bg-white rounded-full transition-colors"
                            >
                                <X size={20} className="text-gray-800" />
                            </button>
                        </div>
                    </div>
                )}

                {/* Path Replay Modal */}
                {showPathReplay && (
                    <AlarmPathReplay
                        plateNumber={plateNumber}
                        alarms={alarms}
                        onClose={() => setShowPathReplay(false)}
                    />
                )}
            </div>
        </div>
    );
};
