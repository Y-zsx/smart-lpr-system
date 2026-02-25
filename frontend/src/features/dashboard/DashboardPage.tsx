import React, { useState, useEffect } from 'react';
import { DailyStatsChart } from '@/components/DailyStatsChart';
import { CategoryStats } from '@/components/CategoryStats';
import { PlateHeatmap } from '@/components/PlateHeatmap';
import { HourlyStatsChart } from '@/components/HourlyStatsChart';
import { RecentPlatesList } from '@/components/RecentPlatesList';
import { StatCard } from '@/components/StatCard';
import { usePlateStore } from '@/store/plateStore';
import { Activity, ShieldCheck, Zap, Car, Calendar, Database } from 'lucide-react';
import { CategoryDetail } from '@/components/CategoryDetail';
import { apiClient } from '@/api/client';
import { usePlateHistory } from '@/hooks/usePlateHistory';

export const DashboardPage: React.FC = () => {
    const { stats, setPlates, setStats } = usePlateStore();
    const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
    const [dataMode, setDataMode] = useState<'date' | 'total'>('date');
    const [selectedCategory, setSelectedCategory] = useState<{ type: string; label: string } | null>(null);

    const isToday = dataMode === 'date' && selectedDate === new Date().toISOString().split('T')[0];
    const { data: plateGroups } = usePlateHistory({
        date: dataMode === 'date' ? selectedDate : undefined,
        groupBy: 'plate',
        autoRefresh: isToday,
        refreshIntervalMs: 5000
    });

    useEffect(() => {
        setPlates(plateGroups);
    }, [plateGroups, setPlates]);

    useEffect(() => {
        let timer: number | undefined;
        let stopped = false;
        let failureCount = 0;
        const fetchStats = async () => {
            if (document.hidden || stopped) return;
            try {
                let start: number | undefined;
                if (dataMode === 'date') {
                    start = new Date(selectedDate).setHours(0, 0, 0, 0);
                }
                const dashboardStats = await (dataMode === 'date'
                    ? apiClient.getDashboardStats(start)
                    : apiClient.getDashboardStats());
                if (dashboardStats) {
                    setStats({
                        total: dashboardStats.total,
                        blue: dashboardStats.blue,
                        green: dashboardStats.green,
                        yellow: dashboardStats.yellow,
                        other: dashboardStats.other,
                        trends: dashboardStats.trends
                    });
                }
                failureCount = 0;
            } catch (e) {
                console.error('Failed to fetch history:', e);
                failureCount += 1;
            } finally {
                if (!isToday || stopped) return;
                const delay = Math.min(30000, 5000 * Math.max(1, failureCount));
                timer = window.setTimeout(fetchStats, delay);
            }
        };

        void fetchStats();
        return () => {
            stopped = true;
            if (timer) window.clearTimeout(timer);
        };
    }, [selectedDate, dataMode, setStats, isToday]);

    const isCurrentDay = selectedDate === new Date().toISOString().split('T')[0];
    const dateLabel = dataMode === 'total' ? '总量识别' : (isCurrentDay ? '今日识别' : '当日识别');

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-4 rounded-xl border border-gray-100 shadow-sm">
                <div>
                    <h2 className="text-xl font-bold text-gray-800">仪表盘</h2>
                    <p className="text-sm text-gray-500">查看实时数据统计和趋势分析</p>
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
                        <div className="flex items-center gap-2 bg-gray-50 p-1 rounded-lg border border-gray-200">
                            <div className="p-2 text-gray-500"><Calendar size={18} /></div>
                            <input type="date" value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)} className="bg-transparent border-none text-sm text-gray-700 focus:ring-0 cursor-pointer" />
                        </div>
                    )}
                </div>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <StatCard label={dateLabel} value={stats.total} icon={<Activity size={20} />} color="bg-blue-500" trend={dataMode === 'total' ? undefined : (stats.trends?.total.value || '--')} trendDirection={dataMode === 'total' ? 'neutral' : (stats.trends?.total.direction || 'neutral')} />
                <StatCard label="蓝牌车辆" value={stats.blue} icon={<ShieldCheck size={20} />} color="bg-indigo-500" trend={dataMode === 'total' ? undefined : (stats.trends?.blue.value || '--')} trendDirection={dataMode === 'total' ? 'neutral' : (stats.trends?.blue.direction || 'neutral')} />
                <StatCard label="新能源" value={stats.green} icon={<Zap size={20} />} color="bg-green-500" trend={dataMode === 'total' ? undefined : (stats.trends?.green.value || '--')} trendDirection={dataMode === 'total' ? 'neutral' : (stats.trends?.green.direction || 'neutral')} />
                <StatCard label="其他车辆" value={stats.yellow + stats.other} icon={<Car size={20} />} color="bg-orange-500" trend={dataMode === 'total' ? undefined : (stats.trends?.other.value || '--')} trendDirection={dataMode === 'total' ? 'neutral' : (stats.trends?.other.direction || 'neutral')} />
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <DailyStatsChart date={dataMode === 'total' ? undefined : selectedDate} />
                <PlateHeatmap date={dataMode === 'total' ? undefined : selectedDate} />
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-1 h-[400px]">
                    <CategoryStats onCategoryClick={(type, label) => setSelectedCategory({ type, label })} />
                </div>
                <div className="lg:col-span-1 h-[400px]">
                    <HourlyStatsChart date={dataMode === 'total' ? undefined : selectedDate} />
                </div>
                <div className="lg:col-span-1 h-[400px]">
                    <RecentPlatesList date={dataMode === 'total' ? undefined : selectedDate} limit={8} />
                </div>
            </div>
            {selectedCategory && (
                <CategoryDetail type={selectedCategory.type} label={selectedCategory.label} onClose={() => setSelectedCategory(null)} date={dataMode === 'total' ? undefined : selectedDate} />
            )}
        </div>
    );
};
