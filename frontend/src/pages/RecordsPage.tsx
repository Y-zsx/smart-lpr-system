import React, { useState, useEffect } from 'react';
import { PlateList } from '../components/PlateList';
import { Calendar, Database } from 'lucide-react';
import { usePlateStore } from '../store/plateStore';
import { apiClient } from '../api/client';

export const RecordsPage: React.FC = () => {
    const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
    const [dataMode, setDataMode] = useState<'date' | 'total'>('date'); // 数据模式：日期模式或总量模式
    const { setPlates } = usePlateStore();

    // 注意：RecordsPage 不再需要 setPlates，因为 PlateList 组件会自己获取数据
    // 保留这个 useEffect 用于兼容性，但不再使用
    useEffect(() => {
        // PlateList 组件会自己获取分组数据
        // 这里可以留空或用于其他用途
    }, [selectedDate]);

    return (
        <div className="flex flex-col h-[calc(100vh-140px)] space-y-4">
             {/* Page Header with Date Picker */}
             <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-4 rounded-xl border border-gray-100 shadow-sm shrink-0">
                <div>
                    <h2 className="text-xl font-bold text-gray-800">识别记录</h2>
                    <p className="text-sm text-gray-500">查询和导出历史车牌识别记录</p>
                </div>
                <div className="flex items-center gap-2">
                    {/* 数据模式切换 */}
                    <div className="flex bg-gray-100 rounded-lg p-1">
                        <button
                            onClick={() => setDataMode('date')}
                            className={`px-3 py-1.5 text-sm rounded-md transition-all flex items-center gap-1.5 ${
                                dataMode === 'date'
                                    ? 'bg-white text-blue-600 shadow-sm font-medium'
                                    : 'text-gray-500 hover:text-gray-700'
                            }`}
                            title="按日期查看"
                        >
                            <Calendar size={16} />
                            <span className="hidden sm:inline">日期</span>
                        </button>
                        <button
                            onClick={() => setDataMode('total')}
                            className={`px-3 py-1.5 text-sm rounded-md transition-all flex items-center gap-1.5 ${
                                dataMode === 'total'
                                    ? 'bg-white text-blue-600 shadow-sm font-medium'
                                    : 'text-gray-500 hover:text-gray-700'
                            }`}
                            title="查看总量"
                        >
                            <Database size={16} />
                            <span className="hidden sm:inline">总量</span>
                        </button>
                    </div>
                    {/* 日期选择器 - 只在日期模式下显示 */}
                    {dataMode === 'date' && (
                        <div className="flex items-center gap-2 bg-gray-50 p-1 rounded-lg border border-gray-200">
                            <div className="p-2 text-gray-500">
                                <Calendar size={18} />
                            </div>
                            <input
                                type="date"
                                value={selectedDate}
                                onChange={(e) => setSelectedDate(e.target.value)}
                                className="bg-transparent border-none text-sm text-gray-700 focus:ring-0 cursor-pointer"
                            />
                        </div>
                    )}
                </div>
            </div>

            <div className="flex-1 min-h-0">
                <PlateList date={dataMode === 'total' ? undefined : selectedDate} />
            </div>
        </div>
    );
};
