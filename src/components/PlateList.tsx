import React, { useState } from 'react';
import { usePlateStore } from '../store/plateStore';
import { Clock, MapPin, Search, Download, FileText, Loader } from 'lucide-react';
import { apiClient } from '../api/client';

interface PlateListProps {
    date?: string;
}

export const PlateList: React.FC<PlateListProps> = ({ date }) => {
    const { plates, settings } = usePlateStore();
    const [searchTerm, setSearchTerm] = useState('');
    const [isExporting, setIsExporting] = useState(false);

    // 基于搜索词和置信度阈值过滤车牌
    const filteredPlates = plates.filter(plate =>
        (plate.number.toLowerCase().includes(searchTerm.toLowerCase()) ||
            plate.location?.toLowerCase().includes(searchTerm.toLowerCase())) &&
        plate.confidence >= settings.confidenceThreshold
    );

    const handleExport = async () => {
        setIsExporting(true);
        try {
            let start, end;
            if (date) {
                start = new Date(date).setHours(0, 0, 0, 0);
                end = new Date(date).setHours(23, 59, 59, 999);
            }

            const blob = await apiClient.exportRecords(start, end, searchTerm);
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = `车牌识别记录_${date || '全部'}.csv`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);
        } catch (error) {
            console.error('Export failed:', error);
            alert('导出失败，请重试');
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
                        当前显示 {filteredPlates.length} 条
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
                {filteredPlates.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full text-gray-400 py-8">
                        <Search size={32} className="mb-2 opacity-20" />
                        <p className="text-sm">未找到相关记录</p>
                        {plates.length > 0 && (
                            <p className="text-xs text-gray-300 mt-1">
                                (已隐藏 {plates.length - filteredPlates.length} 条低置信度记录)
                            </p>
                        )}
                    </div>
                ) : (
                    filteredPlates.map((plate) => (
                        <div key={plate.id} className="p-3 rounded-lg border border-gray-100 hover:border-blue-200 hover:bg-blue-50/30 transition-all group">
                            <div className="flex justify-between items-start mb-2">
                                <span className={`text-lg font-bold font-mono px-2 py-0.5 rounded border ${plate.type === 'blue' ? 'bg-blue-600 text-white border-blue-600' :
                                    plate.type === 'green' ? 'bg-green-50 text-green-600 border-green-200' :
                                        plate.type === 'yellow' ? 'bg-yellow-500 text-white border-yellow-500' :
                                            'bg-gray-100 text-gray-700 border-gray-200'
                                    }`}>
                                    {plate.number}
                                </span>
                                <span className={`text-xs font-medium px-2 py-1 rounded-full ${plate.confidence > 0.9 ? 'text-green-600 bg-green-50' : 'text-blue-600 bg-blue-50'
                                    }`}>
                                    {(plate.confidence * 100).toFixed(0)}%
                                </span>
                            </div>

                            <div className="flex items-center justify-between text-xs text-gray-500">
                                <div className="flex items-center gap-1">
                                    <Clock size={12} />
                                    <span>{new Date(plate.timestamp).toLocaleTimeString()}</span>
                                </div>
                                <div className="flex items-center gap-1">
                                    <MapPin size={12} />
                                    <span className="max-w-[80px] truncate">{plate.location || '未知位置'}</span>
                                </div>
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
};
