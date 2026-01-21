import React, { useState, useEffect } from 'react';
import { PlateList } from '../components/PlateList';
import { Calendar } from 'lucide-react';
import { usePlateStore } from '../store/plateStore';
import { apiClient } from '../api/client';

export const RecordsPage: React.FC = () => {
    const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
    const { setPlates } = usePlateStore();

    useEffect(() => {
        const fetchData = async () => {
            try {
                const start = new Date(selectedDate).setHours(0, 0, 0, 0);
                const end = new Date(selectedDate).setHours(23, 59, 59, 999);
                
                const plates = await apiClient.getHistory(start, end);
                setPlates(plates);
            } catch (e) {
                console.error("Failed to fetch history:", e);
            }
        };

        fetchData();
        const isToday = selectedDate === new Date().toISOString().split('T')[0];
        let interval: number;

        if (isToday) {
            interval = window.setInterval(fetchData, 5000);
        }

        return () => {
            if (interval) clearInterval(interval);
        };
    }, [selectedDate, setPlates]);

    return (
        <div className="flex flex-col h-[calc(100vh-140px)] space-y-4">
             {/* Page Header with Date Picker */}
             <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-4 rounded-xl border border-gray-100 shadow-sm shrink-0">
                <div>
                    <h2 className="text-xl font-bold text-gray-800">识别记录</h2>
                    <p className="text-sm text-gray-500">查询和导出历史车牌识别记录</p>
                </div>
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
            </div>

            <div className="flex-1 min-h-0">
                <PlateList date={selectedDate} />
            </div>
        </div>
    );
};
