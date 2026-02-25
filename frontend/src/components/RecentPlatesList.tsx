import React, { useEffect, useState, useRef } from 'react';
import { Clock, MapPin, Camera } from 'lucide-react';
import { PlateGroup } from '../types/plate';
import { usePlateStore } from '../store/plateStore';
import { arePlateGroupsEqual } from '../utils/dataComparison';
import { usePlateHistory } from '@/hooks/usePlateHistory';

interface RecentPlatesListProps {
    date?: string; // 可选的日期参数，undefined 表示总量模式
    limit?: number; // 显示的数量限制，默认10
}

export const RecentPlatesList: React.FC<RecentPlatesListProps> = React.memo(({ date, limit = 10 }) => {
    const [recentPlates, setRecentPlates] = useState<PlateGroup[]>([]);
    const [loading, setLoading] = useState(true);
    const { settings } = usePlateStore();
    const isInitialLoad = useRef(true);
    const isToday = date === new Date().toISOString().split('T')[0];
    const { data: plateGroups, loading: historyLoading } = usePlateHistory({
        date,
        groupBy: 'plate',
        autoRefresh: isToday && !settings.isDemoMode,
        refreshIntervalMs: 5000
    });

    useEffect(() => {
        const fetchRecentPlates = async () => {
            // 只在首次加载时显示loading，后续刷新静默进行
            if (isInitialLoad.current) {
                setLoading(true);
            }
            
            try {
                let newPlates: PlateGroup[] = [];
                
                if (settings.isDemoMode) {
                    // 生成模拟数据
                    newPlates = Array.from({ length: limit }, (_, i) => ({
                        plateNumber: `粤${String.fromCharCode(65 + i)}${Math.floor(Math.random() * 10000)}`,
                        plateType: ['blue', 'green', 'yellow'][Math.floor(Math.random() * 3)] as any,
                        firstSeen: Date.now() - i * 60000,
                        lastSeen: Date.now() - i * 30000,
                        totalCount: Math.floor(Math.random() * 10) + 1,
                        records: [],
                        averageConfidence: 0.8 + Math.random() * 0.2,
                        locations: ['入口A', '出口B'],
                        cameras: ['摄像头1']
                    }));
                    
                    if (isInitialLoad.current) {
                        await new Promise(resolve => setTimeout(resolve, 500));
                    }
                } else {
                    newPlates = plateGroups
                        .sort((a, b) => b.lastSeen - a.lastSeen)
                        .slice(0, limit);
                }
                
                // 只在数据真正变化时更新
                setRecentPlates(prev => {
                    if (arePlateGroupsEqual(prev, newPlates)) {
                        return prev; // 返回旧引用，避免重新渲染
                    }
                    return newPlates;
                });
            } catch (error) {
                console.error('加载最近识别记录失败', error);
                if (settings.isDemoMode || isInitialLoad.current) {
                    setRecentPlates([]);
                }
            } finally {
                if (isInitialLoad.current) {
                    setLoading(false);
                    isInitialLoad.current = false;
                }
            }
        };

        fetchRecentPlates();

        return () => {
            isInitialLoad.current = true; // 重置初始加载状态
        };
    }, [limit, settings.isDemoMode, plateGroups, historyLoading]);

    if (loading) return (
        <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm flex flex-col h-full">
            <div className="flex items-center gap-2 mb-4 shrink-0">
                <Clock className="text-blue-600" size={20} />
                <h3 className="font-semibold text-gray-800">最近识别</h3>
            </div>
            <div className="flex-1 flex items-center justify-center text-gray-400">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            </div>
        </div>
    );

    if (recentPlates.length === 0) return (
        <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm flex flex-col h-full">
            <div className="flex items-center gap-2 mb-4 shrink-0">
                <Clock className="text-blue-600" size={20} />
                <h3 className="font-semibold text-gray-800">最近识别</h3>
            </div>
            <div className="flex-1 flex items-center justify-center text-gray-400">暂无数据</div>
        </div>
    );

    return (
        <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm flex flex-col h-full">
            <div className="flex items-center gap-2 mb-4 shrink-0">
                <Clock className="text-blue-600" size={20} />
                <h3 className="font-semibold text-gray-800">最近识别</h3>
                <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded-full ml-auto">
                    {recentPlates.length} 条
                </span>
            </div>

            <div className="flex-1 overflow-y-auto space-y-3 min-h-0">
                {recentPlates.map((group, index) => {
                    const timeAgo = Date.now() - group.lastSeen;
                    const minutesAgo = Math.floor(timeAgo / 60000);
                    const hoursAgo = Math.floor(minutesAgo / 60);
                    const timeText = minutesAgo < 1 ? '刚刚' 
                        : minutesAgo < 60 ? `${minutesAgo}分钟前`
                        : hoursAgo < 24 ? `${hoursAgo}小时前`
                        : `${Math.floor(hoursAgo / 24)}天前`;

                    return (
                        <div
                            key={`${group.plateNumber}-${index}`}
                            className="p-3 rounded-lg border border-gray-100 hover:border-blue-300 hover:bg-blue-50/30 transition-all"
                        >
                            <div className="flex items-start justify-between mb-2">
                                <div className="flex items-center gap-2">
                                    <span className={`text-sm font-bold font-mono px-2 py-0.5 rounded ${
                                        group.plateType === 'blue' ? 'bg-blue-600 text-white' :
                                        group.plateType === 'green' ? 'bg-green-50 text-green-600 border border-green-200' :
                                        group.plateType === 'yellow' ? 'bg-yellow-500 text-white' :
                                        'bg-gray-100 text-gray-700'
                                    }`}>
                                        {group.plateNumber}
                                    </span>
                                    <span className="text-xs text-gray-500">
                                        {timeText}
                                    </span>
                                </div>
                                <span className="text-xs text-gray-400">
                                    #{index + 1}
                                </span>
                            </div>
                            <div className="flex items-center gap-4 text-xs text-gray-500">
                                {group.locations.length > 0 && (
                                    <div className="flex items-center gap-1 min-w-0 flex-shrink">
                                        <MapPin size={12} className="flex-shrink-0" />
                                        <span className="truncate" title={group.locations[0]}>{group.locations[0]}</span>
                                    </div>
                                )}
                                {group.cameras.length > 0 && (
                                    <div className="flex items-center gap-1 min-w-0 flex-shrink">
                                        <Camera size={12} className="flex-shrink-0" />
                                        <span className="truncate" title={group.cameras[0]}>{group.cameras[0]}</span>
                                    </div>
                                )}
                                <span className="flex-shrink-0">置信度: {(group.averageConfidence * 100).toFixed(0)}%</span>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
});
