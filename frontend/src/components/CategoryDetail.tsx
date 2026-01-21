import React, { useEffect, useState } from 'react';
import { X, Clock, MapPin } from 'lucide-react';
import { apiClient } from '../api/client';
import { LicensePlate } from '../types/plate';

interface CategoryDetailProps {
    type: string;
    label: string;
    onClose: () => void;
}

export const CategoryDetail: React.FC<CategoryDetailProps> = ({ type, label, onClose }) => {
    const [plates, setPlates] = useState<LicensePlate[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchPlates = async () => {
            try {
                // 确保我们使用当前选择的日期（如果有）或者默认获取最近的记录
                // 这里我们可能需要从父组件传递日期，或者默认获取所有历史
                // 为了简单起见，我们先获取该类型的所有记录
                const data = await apiClient.getHistory(undefined, undefined, type);
                setPlates(data);
            } catch (error) {
                console.error("获取分类详情失败", error);
            } finally {
                setLoading(false);
            }
        };
        fetchPlates();
    }, [type]);

    const getImageUrl = (path?: string) => {
        if (!path) return 'https://via.placeholder.com/400x300?text=No+Image';
        if (path.startsWith('http')) return path;
        return path; // 如果是 base64 或 blob url
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <div className="bg-white rounded-2xl w-full max-w-5xl h-[80vh] flex flex-col shadow-2xl animate-in fade-in zoom-in duration-200">
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b border-gray-100">
                    <div>
                        <h2 className="text-2xl font-bold text-gray-900">{label}详情</h2>
                        <p className="text-gray-500 text-sm mt-1">共找到 {plates.length} 条记录</p>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-gray-100 rounded-full transition-colors"
                    >
                        <X size={24} className="text-gray-500" />
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-6 bg-gray-50">
                    {loading ? (
                        <div className="flex items-center justify-center h-full">
                            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
                        </div>
                    ) : plates.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-full text-gray-400">
                            <div className="w-16 h-16 bg-gray-200 rounded-full mb-4"></div>
                            <p>暂无该类型车辆记录</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                            {plates.map((plate) => (
                                <div key={plate.id} className="bg-white rounded-xl overflow-hidden shadow-sm border border-gray-100 hover:shadow-md transition-shadow group">
                                    {/* Image Container */}
                                    <div className="aspect-video bg-gray-100 relative overflow-hidden">
                                        <img
                                            src={getImageUrl(plate.image_path)}
                                            alt={plate.number}
                                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                                            onError={(e) => {
                                                (e.target as HTMLImageElement).src = 'https://via.placeholder.com/400x300?text=Image+Load+Error';
                                            }}
                                        />
                                        <div className="absolute top-2 right-2 bg-black/60 text-white text-xs px-2 py-1 rounded backdrop-blur-md">
                                            {(plate.confidence * 100).toFixed(1)}%
                                        </div>
                                    </div>

                                    {/* Info */}
                                    <div className="p-4">
                                        <div className="flex items-center justify-between mb-3">
                                            <span className={`text-lg font-bold px-2 py-0.5 rounded border ${plate.type === 'blue' ? 'bg-blue-600 text-white border-blue-600' :
                                                plate.type === 'green' ? 'bg-green-50 text-green-600 border-green-200' :
                                                    plate.type === 'yellow' ? 'bg-yellow-500 text-white border-yellow-500' :
                                                        'bg-gray-100 text-gray-700 border-gray-200'
                                                }`}>
                                                {plate.number}
                                            </span>
                                        </div>

                                        <div className="space-y-2 text-sm text-gray-500">
                                            <div className="flex items-center gap-2">
                                                <Clock size={14} />
                                                <span>{new Date(plate.timestamp).toLocaleString()}</span>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <MapPin size={14} />
                                                <span>{plate.location || '未知位置'}</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
