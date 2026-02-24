import React from 'react';
import { PlateGroup } from '../types/plate';
import { Clock, MapPin, Camera, X, Image as ImageIcon, Trash2, Loader, AlertTriangle, ZoomIn, ZoomOut, RotateCcw } from 'lucide-react';
import { apiClient } from '../api/client';
import { useToastContext } from '../contexts/ToastContext';

interface PlateDetailProps {
    group: PlateGroup;
    onClose: () => void;
    onDeleted?: () => void; // 删除后的回调，用于刷新列表
}

export const PlateDetail: React.FC<PlateDetailProps> = ({ group, onClose, onDeleted }) => {
    const toast = useToastContext();
    const [selectedImage, setSelectedImage] = React.useState<string | null>(null);
    const [imageScale, setImageScale] = React.useState(1);
    const [imageOffset, setImageOffset] = React.useState({ x: 0, y: 0 });
    const [isDraggingImage, setIsDraggingImage] = React.useState(false);
    const [deletingRecordId, setDeletingRecordId] = React.useState<string | null>(null);
    const [showDeleteConfirm, setShowDeleteConfirm] = React.useState<{ type: 'record' | 'all', recordId?: string } | null>(null);
    const [isDeleting, setIsDeleting] = React.useState(false);
    const dragStartRef = React.useRef({ x: 0, y: 0 });
    const dragOffsetStartRef = React.useRef({ x: 0, y: 0 });

    const resetImageView = React.useCallback(() => {
        setImageScale(1);
        setImageOffset({ x: 0, y: 0 });
        setIsDraggingImage(false);
    }, []);

    const closeImageModal = React.useCallback(() => {
        setSelectedImage(null);
        resetImageView();
    }, [resetImageView]);

    const clampScale = (nextScale: number) => Math.min(4, Math.max(1, nextScale));
    const zoomBy = (delta: number) => {
        setImageScale(prev => clampScale(prev + delta));
    };

    const handleDeleteRecord = async (recordId: string) => {
        setIsDeleting(true);
        setDeletingRecordId(recordId);
        try {
            await apiClient.deletePlate(recordId);
            setShowDeleteConfirm(null);
            // 通知父组件刷新数据
            if (onDeleted) {
                onDeleted();
            } else {
                // 如果没有回调，直接关闭弹窗
                onClose();
            }
            toast.success('记录已删除');
        } catch (error) {
            console.error('删除记录失败:', error);
            toast.error('删除失败，请重试');
        } finally {
            setIsDeleting(false);
            setDeletingRecordId(null);
        }
    };

    const handleDeleteAll = async () => {
        setIsDeleting(true);
        try {
            await apiClient.deletePlatesByNumber(group.plateNumber);
            setShowDeleteConfirm(null);
            // 通知父组件刷新数据
            if (onDeleted) {
                onDeleted();
            } else {
                // 如果没有回调，直接关闭弹窗
                onClose();
            }
            toast.success('所有记录已删除');
        } catch (error) {
            console.error('删除所有记录失败:', error);
            toast.error('删除失败，请重试');
        } finally {
            setIsDeleting(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col">
                {/* Header */}
                <div className="p-6 border-b border-gray-200 flex items-center justify-between shrink-0">
                    <div>
                        <h2 className="text-2xl font-bold text-gray-800 font-mono">
                            {group.plateNumber}
                        </h2>
                        <p className="text-sm text-gray-500 mt-1">
                            共识别 {group.totalCount} 次 | 平均置信度 {(group.averageConfidence * 100).toFixed(1)}%
                        </p>
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => setShowDeleteConfirm({ type: 'all' })}
                            className="p-2 hover:bg-red-50 text-red-600 rounded-lg transition-colors"
                            title="删除所有记录"
                        >
                            <Trash2 size={18} />
                        </button>
                        <button
                            onClick={onClose}
                            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                        >
                            <X size={20} className="text-gray-500" />
                        </button>
                    </div>
                </div>

                {/* Info Cards */}
                <div className="p-6 grid grid-cols-2 md:grid-cols-4 gap-4 shrink-0 border-b border-gray-200">
                    <div className="bg-blue-50 p-4 rounded-lg">
                        <p className="text-xs text-gray-500 mb-1">首次识别</p>
                        <p className="text-sm font-medium text-gray-800">
                            {new Date(group.firstSeen).toLocaleString('zh-CN')}
                        </p>
                    </div>
                    <div className="bg-green-50 p-4 rounded-lg">
                        <p className="text-xs text-gray-500 mb-1">最后识别</p>
                        <p className="text-sm font-medium text-gray-800">
                            {new Date(group.lastSeen).toLocaleString('zh-CN')}
                        </p>
                    </div>
                    <div className="bg-purple-50 p-4 rounded-lg">
                        <p className="text-xs text-gray-500 mb-1">出现位置</p>
                        <p className="text-sm font-medium text-gray-800">
                            {group.locations.length} 个位置
                        </p>
                    </div>
                    <div className="bg-orange-50 p-4 rounded-lg">
                        <p className="text-xs text-gray-500 mb-1">摄像头</p>
                        <p className="text-sm font-medium text-gray-800">
                            {group.cameras.length} 个摄像头
                        </p>
                    </div>
                </div>

                {/* Records List */}
                <div className="flex-1 overflow-y-auto p-6">
                    <h3 className="text-lg font-semibold text-gray-800 mb-4">识别记录</h3>
                    <div className="space-y-3">
                        {group.records.map((record) => (
                            <div
                                key={record.id}
                                className="p-4 bg-gray-50 rounded-lg border border-gray-200 hover:border-blue-300 hover:bg-blue-50/30 transition-all"
                            >
                                <div className="flex items-start justify-between gap-4">
                                    <div className="flex-1">
                                        <div className="flex items-center gap-3 mb-2">
                                            <span className="text-xs font-medium text-gray-500 bg-white px-2 py-1 rounded">
                                                {(record.confidence * 100).toFixed(1)}%
                                            </span>
                                            <div className="flex items-center gap-1 text-xs text-gray-500">
                                                <Clock size={12} />
                                                <span>{new Date(record.timestamp).toLocaleString('zh-CN')}</span>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-4 text-sm text-gray-600">
                                            {record.cameraName && (
                                                <div className="flex items-center gap-1">
                                                    <Camera size={14} />
                                                    <span>{record.cameraName}</span>
                                                </div>
                                            )}
                                            {record.location && (
                                                <div className="flex items-center gap-1">
                                                    <MapPin size={14} />
                                                    <span>{record.location}</span>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        {record.imageUrl && (
                                            <button
                                                onClick={() => {
                                                    // 使用统一的图片URL构建方法
                                                    const imageUrl = apiClient.getImageUrl(record.imageUrl);
                                                    resetImageView();
                                                    setSelectedImage(imageUrl);
                                                }}
                                                className="p-2 bg-white hover:bg-blue-50 rounded-lg border border-gray-200 transition-colors"
                                                title="查看图片"
                                            >
                                                <ImageIcon size={18} className="text-gray-600" />
                                            </button>
                                        )}
                                        <button
                                            onClick={() => setShowDeleteConfirm({ type: 'record', recordId: record.id })}
                                            disabled={isDeleting && deletingRecordId === record.id}
                                            className="p-2 bg-white hover:bg-red-50 text-red-600 rounded-lg border border-gray-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                            title="删除此记录"
                                        >
                                            {isDeleting && deletingRecordId === record.id ? (
                                                <Loader size={18} className="animate-spin" />
                                            ) : (
                                                <Trash2 size={18} />
                                            )}
                                        </button>
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
                                <img
                                    src={selectedImage}
                                    alt="车牌识别图片"
                                    draggable={false}
                                    className="w-full h-full object-contain rounded-lg transition-transform duration-100"
                                    onDoubleClick={() => {
                                        setImageOffset({ x: 0, y: 0 });
                                        setImageScale(prev => (prev <= 1.05 ? 2 : 1));
                                    }}
                                    style={{
                                        transform: `translate(${imageOffset.x}px, ${imageOffset.y}px) scale(${imageScale})`,
                                        transformOrigin: 'center center',
                                    }}
                                />
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

                {/* Delete Confirmation Modal */}
                {showDeleteConfirm && (
                    <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
                        <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6">
                            <div className="flex items-start gap-4 mb-4">
                                <div className="p-3 bg-red-100 rounded-full">
                                    <AlertTriangle size={24} className="text-red-600" />
                                </div>
                                <div className="flex-1">
                                    <h3 className="text-lg font-semibold text-gray-800 mb-2">
                                        {showDeleteConfirm.type === 'all' ? '删除所有记录' : '删除记录'}
                                    </h3>
                                    <p className="text-sm text-gray-600">
                                        {showDeleteConfirm.type === 'all' 
                                            ? `确定要删除车牌 "${group.plateNumber}" 的所有 ${group.totalCount} 条识别记录吗？此操作不可恢复。`
                                            : '确定要删除这条识别记录吗？此操作不可恢复。'}
                                    </p>
                                </div>
                            </div>
                            <div className="flex justify-end gap-3">
                                <button
                                    onClick={() => setShowDeleteConfirm(null)}
                                    disabled={isDeleting}
                                    className="px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors disabled:opacity-50"
                                >
                                    取消
                                </button>
                                <button
                                    onClick={() => {
                                        if (showDeleteConfirm.type === 'all') {
                                            handleDeleteAll();
                                        } else if (showDeleteConfirm.recordId) {
                                            handleDeleteRecord(showDeleteConfirm.recordId);
                                        }
                                    }}
                                    disabled={isDeleting}
                                    className="px-4 py-2 bg-red-600 text-white hover:bg-red-700 rounded-lg transition-colors disabled:opacity-50 flex items-center gap-2"
                                >
                                    {isDeleting && <Loader size={16} className="animate-spin" />}
                                    确认删除
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};
