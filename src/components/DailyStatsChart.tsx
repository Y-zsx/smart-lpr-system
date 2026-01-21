import React, { useEffect, useState } from 'react';
import { apiClient } from '../api/client';
import { BarChart3 } from 'lucide-react';

interface DailyStat {
    date: string;
    count: number;
}

interface DailyStatsChartProps {
    date: string;
}

export const DailyStatsChart: React.FC<DailyStatsChartProps> = ({ date }) => {
    const [stats, setStats] = useState<DailyStat[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchStats = async () => {
            try {
                const endDate = new Date(date).setHours(23, 59, 59, 999);
                const data = await apiClient.getDailyStats(endDate);
                // 确保数据按日期升序排列以用于图表显示
                setStats(data.reverse());
            } catch (error) {
                console.error('加载统计数据失败', error);
            } finally {
                setLoading(false);
            }
        };

        fetchStats();
    }, [date]);

    if (loading) return <div className="h-48 flex items-center justify-center text-gray-400">加载中...</div>;
    if (stats.length === 0) return <div className="h-48 flex items-center justify-center text-gray-400">暂无数据</div>;

    const maxCount = Math.max(...stats.map(s => s.count), 1);

    return (
        <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm">
            <div className="flex items-center gap-2 mb-4">
                <BarChart3 className="text-blue-600" size={20} />
                <h3 className="font-semibold text-gray-800">每日识别趋势 (近7天)</h3>
            </div>

            <div className="h-48 flex items-end justify-between gap-2">
                {stats.map((stat) => (
                    <div key={stat.date} className="flex-1 flex flex-col items-center gap-2 group">
                        <div className="relative w-full flex justify-center items-end h-32 bg-gray-50 rounded-t-lg overflow-hidden">
                            <div
                                className="w-full mx-1 bg-blue-500 rounded-t transition-all duration-500 group-hover:bg-blue-600"
                                style={{ height: `${(stat.count / maxCount) * 100}%` }}
                            >
                                <div className="opacity-0 group-hover:opacity-100 absolute -top-8 left-1/2 transform -translate-x-1/2 bg-black text-white text-xs px-2 py-1 rounded transition-opacity">
                                    {stat.count}
                                </div>
                            </div>
                        </div>
                        <span className="text-xs text-gray-500 transform -rotate-45 origin-top-left mt-2 whitespace-nowrap">
                            {stat.date.slice(5)}
                        </span>
                    </div>
                ))}
            </div>
        </div>
    );
};
