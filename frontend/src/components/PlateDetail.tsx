import React from 'react';
import { PlateGroup } from '../types/plate';
import { Clock, MapPin, Camera, X, Image as ImageIcon } from 'lucide-react';
import { apiClient } from '../api/client';

interface PlateDetailProps {
    group: PlateGroup;
    onClose: () => void;
}

export const PlateDetail: React.FC<PlateDetailProps> = ({ group, onClose }) => {
    const [selectedImage, setSelectedImage] = React.useState<string | null>(null);

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
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                    >
                        <X size={20} className="text-gray-500" />
                    </button>
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
                                    {record.imageUrl && (
                                        <button
                                            onClick={() => {
                                                // 构建完整的图片URL
                                                const imageUrl = record.imageUrl?.startsWith('http') 
                                                    ? record.imageUrl 
                                                    : `${apiClient.getBackendUrl()}/${record.imageUrl}`;
                                                setSelectedImage(imageUrl);
                                            }}
                                            className="p-2 bg-white hover:bg-blue-50 rounded-lg border border-gray-200 transition-colors"
                                            title="查看图片"
                                        >
                                            <ImageIcon size={18} className="text-gray-600" />
                                        </button>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Image Modal */}
                {selectedImage && (
                    <div
                        className="fixed inset-0 z-60 flex items-center justify-center bg-black/80 p-4"
                        onClick={() => setSelectedImage(null)}
                    >
                        <div className="relative max-w-4xl max-h-[90vh]">
                            <img
                                src={selectedImage}
                                alt="车牌识别图片"
                                className="max-w-full max-h-[90vh] object-contain rounded-lg"
                                onClick={(e) => e.stopPropagation()}
                            />
                            <button
                                onClick={() => setSelectedImage(null)}
                                className="absolute top-4 right-4 p-2 bg-white/90 hover:bg-white rounded-full transition-colors"
                            >
                                <X size={20} className="text-gray-800" />
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};
