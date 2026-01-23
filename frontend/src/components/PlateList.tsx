import React, { useState, useEffect } from 'react';
import { usePlateStore } from '../store/plateStore';
import { Clock, MapPin, Search, Download, FileText, Loader, ChevronRight } from 'lucide-react';
import { apiClient } from '../api/client';
import { PlateGroup } from '../types/plate';
import { PlateDetail } from './PlateDetail';
import { useToastContext } from '../contexts/ToastContext';

interface PlateListProps {
    date?: string; // 可选的日期参数，undefined 表示总量模式
}

export const PlateList: React.FC<PlateListProps> = ({ date }) => {
    const { settings } = usePlateStore();
    const toast = useToastContext();
    const [searchTerm, setSearchTerm] = useState('');
    const [isExporting, setIsExporting] = useState(false);
    const [plateGroups, setPlateGroups] = useState<PlateGroup[]>([]);
    const [selectedGroup, setSelectedGroup] = useState<PlateGroup | null>(null);
    const [loading, setLoading] = useState(true);

    // 从 API 获取分组数据
    useEffect(() => {
        const fetchGroups = async () => {
            setLoading(true);
            try {
                const start = date ? new Date(date).setHours(0, 0, 0, 0) : undefined;
                const end = date ? new Date(date).setHours(23, 59, 59, 999) : undefined;
                
                const groups = await apiClient.getHistory(start, end, undefined, 'plate');
                setPlateGroups(Array.isArray(groups) ? groups : []);
            } catch (error) {
                console.error('获取车牌分组数据失败:', error);
                setPlateGroups([]);
            } finally {
                setLoading(false);
            }
        };

        fetchGroups();
        
        // 如果是今天，每5秒刷新一次
        const isToday = date === new Date().toISOString().split('T')[0];
        let interval: number;
        if (isToday) {
            interval = window.setInterval(fetchGroups, 5000);
        }

        return () => {
            if (interval) clearInterval(interval);
        };
    }, [date]);

    // 基于搜索词和置信度阈值过滤车牌
    const filteredGroups = plateGroups.filter(group =>
        group.plateNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
        group.locations.some(loc => loc.toLowerCase().includes(searchTerm.toLowerCase())) ||
        group.cameras.some(cam => cam.toLowerCase().includes(searchTerm.toLowerCase()))
    ).filter(group => group.averageConfidence >= settings.confidenceThreshold);

    const handleExport = async () => {
        setIsExporting(true);
        try {
            let start, end;
            if (date) {
                start = new Date(date).setHours(0, 0, 0, 0);
                end = new Date(date).setHours(23, 59, 59, 999);
            }

            // 导出所有记录（包括重复的识别记录）
            const blob = await apiClient.exportRecords(start, end, searchTerm);
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = `车牌识别记录_${date || '全部'}.csv`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);
            toast.success('导出成功');
        } catch (error) {
            console.error('Export failed:', error);
            toast.error('导出失败，请重试');
        } finally {
            setIsExporting(false);
        }
    };

    return (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm h-full flex flex-col">
            <div className="p-4 border-b border-gray-100 flex flex-col gap-3">
                <div className="flex justify-between items-center">
                    <h3 className="font-semibold text-gray-800 flex items-center gap-2">
                        <FileText size={18} className="text-blue-600" />
                        识别记录
                    </h3>
                    <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded-full">
                        当前显示 {filteredGroups.length} 个车牌
                    </span>
                </div>

                <div className="flex gap-2">
                    <div className="relative flex-1">
                        <Search size={16} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                        <input
                            type="text"
                            placeholder="搜索车牌号..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pl-9 pr-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-blue-500 transition-colors"
                        />
                    </div>
                    <button
                        onClick={handleExport}
                        disabled={isExporting}
                        className="px-3 py-2 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                        title="导出 CSV"
                    >
                        {isExporting ? <Loader size={18} className="animate-spin" /> : <Download size={18} />}
                        <span className="hidden sm:inline">导出</span>
                    </button>
                </div>
            </div>

            <div className="flex-1 overflow-y-auto p-2 space-y-2">
                {loading ? (
                    <div className="flex flex-col items-center justify-center h-full text-gray-400 py-8">
                        <Loader size={32} className="mb-2 animate-spin text-blue-600" />
                        <p className="text-sm">加载中...</p>
                    </div>
                ) : filteredGroups.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full text-gray-400 py-8">
                        <Search size={32} className="mb-2 opacity-20" />
                        <p className="text-sm">未找到相关记录</p>
                    </div>
                ) : (
                    filteredGroups.map((group) => (
                        <div
                            key={group.plateNumber}
                            onClick={() => setSelectedGroup(group)}
                            className="p-4 rounded-lg border border-gray-100 hover:border-blue-300 hover:bg-blue-50/30 transition-all cursor-pointer group"
                        >
                            <div className="flex justify-between items-start mb-3">
                                <div className="flex-1">
                                    <span className={`text-xl font-bold font-mono px-3 py-1 rounded border inline-block ${group.plateType === 'blue' ? 'bg-blue-600 text-white border-blue-600' :
                                        group.plateType === 'green' ? 'bg-green-50 text-green-600 border-green-200' :
                                            group.plateType === 'yellow' ? 'bg-yellow-500 text-white border-yellow-500' :
                                                'bg-gray-100 text-gray-700 border-gray-200'
                                        }`}>
                                        {group.plateNumber}
                                    </span>
                                </div>
                                <ChevronRight size={20} className="text-gray-400 group-hover:text-blue-600 transition-colors" />
                            </div>

                            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs text-gray-600 mb-2">
                                <div className="flex items-center gap-1">
                                    <Clock size={12} />
                                    <span>识别 {group.totalCount} 次</span>
                                </div>
                                <div className="flex items-center gap-1">
                                    <span className="font-medium">置信度: {(group.averageConfidence * 100).toFixed(1)}%</span>
                                </div>
                                <div className="flex items-center gap-1">
                                    <MapPin size={12} />
                                    <span>{group.locations.length} 个位置</span>
                                </div>
                                <div className="flex items-center gap-1">
                                    <span>最后: {new Date(group.lastSeen).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}</span>
                                </div>
                            </div>

                            {group.locations.length > 0 && (
                                <div className="flex flex-wrap gap-1 mt-2">
                                    {group.locations.slice(0, 3).map((location, idx) => (
                                        <span key={idx} className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded">
                                            {location}
                                        </span>
                                    ))}
                                    {group.locations.length > 3 && (
                                        <span className="text-xs text-gray-400 px-2 py-0.5">
                                            +{group.locations.length - 3}
                                        </span>
                                    )}
                                </div>
                            )}
                        </div>
                    ))
                )}
            </div>

            {/* 车牌详情弹窗 */}
            {selectedGroup && (
                <PlateDetail
                    group={selectedGroup}
                    onClose={() => setSelectedGroup(null)}
                    onDeleted={() => {
                        setSelectedGroup(null);
                        // 刷新列表数据
                        const fetchGroups = async () => {
                            try {
                                const start = date ? new Date(date).setHours(0, 0, 0, 0) : undefined;
                                const end = date ? new Date(date).setHours(23, 59, 59, 999) : undefined;
                                
                                const groups = await apiClient.getHistory(start, end, undefined, 'plate');
                                setPlateGroups(Array.isArray(groups) ? groups : []);
                            } catch (error) {
                                console.error('获取车牌分组数据失败:', error);
                            }
                        };
                        fetchGroups();
                    }}
                />
            )}
        </div>
    );
};
