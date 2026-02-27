import React, { useEffect, useState } from 'react';
import { X, Clock, MapPin, ChevronRight } from 'lucide-react';
import { apiClient } from '../api/client';
import { PlateGroup } from '../types/plate';
import { PlateDetail } from './PlateDetail';
import { usePlateHistory } from '@/hooks/usePlateHistory';

interface CategoryDetailProps {
    type: string;
    label: string;
    onClose: () => void;
    date?: string; // 可选的日期参数，格式：YYYY-MM-DD
}

export const CategoryDetail: React.FC<CategoryDetailProps> = ({ type, label, onClose, date }) => {
    const [groups, setGroups] = useState<PlateGroup[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedGroup, setSelectedGroup] = useState<PlateGroup | null>(null);
    const { data: historyGroups, loading: historyLoading, refresh } = usePlateHistory({
        date,
        type,
        groupBy: 'plate'
    });

    useEffect(() => {
        setGroups(historyGroups);
        setLoading(historyLoading);
    }, [historyGroups, historyLoading]);

    // 删除记录后刷新，并同步详情弹窗（若该车牌还有记录则更新 group，否则关闭弹窗）
    useEffect(() => {
        if (!selectedGroup) return;
        const next = historyGroups.find(g => g.plateNumber === selectedGroup.plateNumber);
        if (!next || next.records.length === 0) {
            setSelectedGroup(null);
        } else if (next !== selectedGroup) {
            setSelectedGroup(next);
        }
    }, [historyGroups]);

    const getImageUrl = (path?: string) => {
        return apiClient.getImageUrl(path);
    };

    return (
        <>
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
                <div className="bg-white rounded-2xl w-full max-w-5xl h-[80vh] flex flex-col shadow-2xl animate-in fade-in zoom-in duration-200">
                    {/* Header */}
                    <div className="flex items-center justify-between p-6 border-b border-gray-100">
                        <div>
                            <h2 className="text-2xl font-bold text-gray-900">{label}详情</h2>
                            <p className="text-gray-500 text-sm mt-1">共找到 {groups.length} 个不重复车牌</p>
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
                        ) : groups.length === 0 ? (
                            <div className="flex flex-col items-center justify-center h-full text-gray-400">
                                <div className="w-16 h-16 bg-gray-200 rounded-full mb-4"></div>
                                <p>暂无该类型车辆记录</p>
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                                {groups.map((group) => {
                                    // 使用最后一条记录的图片作为缩略图
                                    const latestRecord = group.records[0];
                                    const thumbnailUrl = latestRecord?.imageUrl;
                                    
                                    return (
                                        <div
                                            key={group.plateNumber}
                                            onClick={() => setSelectedGroup(group)}
                                            className="bg-white rounded-xl overflow-hidden shadow-sm border border-gray-100 hover:shadow-md hover:border-blue-300 transition-all group cursor-pointer"
                                        >
                                            {/* Image Container */}
                                            <div className="aspect-video bg-gray-100 relative overflow-hidden">
                                                {thumbnailUrl ? (
                                                    <img
                                                        src={getImageUrl(thumbnailUrl)}
                                                        alt={group.plateNumber}
                                                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                                                        onError={(e) => {
                                                            (e.target as HTMLImageElement).src = 'https://via.placeholder.com/400x300?text=Image+Load+Error';
                                                        }}
                                                    />
                                                ) : (
                                                    <div className="w-full h-full flex items-center justify-center bg-gray-200 text-gray-400">
                                                        <span>无图片</span>
                                                    </div>
                                                )}
                                                <div className="absolute top-2 right-2 bg-black/60 text-white text-xs px-2 py-1 rounded backdrop-blur-md">
                                                    {(group.averageConfidence * 100).toFixed(1)}%
                                                </div>
                                                <div className="absolute bottom-2 left-2 bg-black/60 text-white text-xs px-2 py-1 rounded backdrop-blur-md">
                                                    {group.totalCount} 次
                                                </div>
                                            </div>

                                            {/* Info */}
                                            <div className="p-4">
                                                <div className="flex items-center justify-between mb-3">
                                                    <span className={`text-lg font-bold font-mono px-2 py-0.5 rounded border ${group.plateType === 'blue' ? 'bg-blue-600 text-white border-blue-600' :
                                                        group.plateType === 'green' ? 'bg-green-50 text-green-600 border-green-200' :
                                                            group.plateType === 'yellow' ? 'bg-yellow-500 text-white border-yellow-500' :
                                                                'bg-gray-100 text-gray-700 border-gray-200'
                                                        }`}>
                                                        {group.plateNumber}
                                                    </span>
                                                    <ChevronRight size={18} className="text-gray-400 group-hover:text-blue-600 transition-colors" />
                                                </div>

                                                <div className="space-y-2 text-sm text-gray-500">
                                                    <div className="flex items-center gap-2">
                                                        <Clock size={14} />
                                                        <span>最后: {new Date(group.lastSeen).toLocaleString('zh-CN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                                                    </div>
                                                    <div className="flex items-center gap-2">
                                                        <MapPin size={14} />
                                                        <span>{group.locations.length > 0 ? group.locations[0] : '未知位置'}</span>
                                                        {group.locations.length > 1 && (
                                                            <span className="text-xs text-gray-400">+{group.locations.length - 1}</span>
                                                        )}
                                                    </div>
                                                    {group.cameras.length > 0 && (
                                                        <div className="text-xs text-gray-400">
                                                            摄像头: {group.cameras.join(', ')}
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* 车牌详情弹窗 */}
            {selectedGroup && (
                <PlateDetail
                    group={selectedGroup}
                    onClose={() => setSelectedGroup(null)}
                    onDeleted={() => void refresh()}
                />
            )}
        </>
    );
};
