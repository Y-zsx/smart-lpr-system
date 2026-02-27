import React, { useState } from 'react';
import { PlateList } from '@/components/PlateList';
import { Calendar, Database } from 'lucide-react';

const today = () => new Date().toISOString().split('T')[0];

export const RecordsPage: React.FC = () => {
    const [startDate, setStartDate] = useState(today());
    const [endDate, setEndDate] = useState(today());
    const [dataMode, setDataMode] = useState<'date' | 'total'>('date');
    return (
        <div className="flex flex-col min-h-[calc(100dvh-8.5rem)] lg:h-[calc(100dvh-8.5rem)] space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-4 rounded-xl border border-gray-100 shadow-sm shrink-0">
                <div>
                    <h2 className="text-xl font-bold text-gray-800">识别记录</h2>
                    <p className="text-sm text-gray-500">查询和导出历史车牌识别记录</p>
                </div>
                <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                    <div className="flex bg-gray-100 rounded-lg p-1">
                        <button onClick={() => setDataMode('date')} className={`px-3 py-1.5 text-sm rounded-md transition-all flex items-center gap-1.5 ${dataMode === 'date' ? 'bg-white text-blue-600 shadow-sm font-medium' : 'text-gray-500 hover:text-gray-700'}`} title="按日期查看">
                            <Calendar size={16} /><span className="hidden sm:inline">日期</span>
                        </button>
                        <button onClick={() => setDataMode('total')} className={`px-3 py-1.5 text-sm rounded-md transition-all flex items-center gap-1.5 ${dataMode === 'total' ? 'bg-white text-blue-600 shadow-sm font-medium' : 'text-gray-500 hover:text-gray-700'}`} title="查看总量">
                            <Database size={16} /><span className="hidden sm:inline">总量</span>
                        </button>
                    </div>
                    {dataMode === 'date' && (
                        <div className="flex flex-wrap items-center gap-2">
                            <div className="flex items-center gap-2 bg-gray-50 p-1 rounded-lg border border-gray-200">
                                <span className="text-xs text-gray-500 px-1">开始</span>
                                <input
                                    type="date"
                                    value={startDate}
                                    max={endDate}
                                    onChange={(e) => {
                                        const v = e.target.value;
                                        setStartDate(v);
                                        if (v > endDate) setEndDate(v);
                                    }}
                                    className="bg-transparent border-none text-sm text-gray-700 focus:ring-0 cursor-pointer min-w-0"
                                />
                            </div>
                            <span className="text-gray-400">至</span>
                            <div className="flex items-center gap-2 bg-gray-50 p-1 rounded-lg border border-gray-200">
                                <span className="text-xs text-gray-500 px-1">结束</span>
                                <input
                                    type="date"
                                    value={endDate}
                                    min={startDate}
                                    onChange={(e) => {
                                        const v = e.target.value;
                                        setEndDate(v);
                                        if (v < startDate) setStartDate(v);
                                    }}
                                    className="bg-transparent border-none text-sm text-gray-700 focus:ring-0 cursor-pointer min-w-0"
                                />
                            </div>
                            <span className="text-sm text-gray-600">
                                {startDate === endDate ? startDate : `${startDate} 至 ${endDate}`}
                            </span>
                        </div>
                    )}
                </div>
            </div>
            <div className="flex-1 min-h-0">
                <PlateList
                    startDate={dataMode === 'date' ? startDate : undefined}
                    endDate={dataMode === 'date' ? endDate : undefined}
                />
            </div>
        </div>
    );
};
