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

const today = () => new Date().toISOString().split('T')[0];

export const DashboardPage: React.FC = () => {
    const { stats, setPlates, setStats } = usePlateStore();
    const [startDate, setStartDate] = useState(today());
    const [endDate, setEndDate] = useState(today());
    const [dataMode, setDataMode] = useState<'date' | 'total'>('date');
    const [selectedCategory, setSelectedCategory] = useState<{ type: string; label: string } | null>(null);
    const [statsLoaded, setStatsLoaded] = useState(false);

    const isToday = dataMode === 'date' && startDate === today() && endDate === today();
    const { data: plateGroups } = usePlateHistory({
        startDate: dataMode === 'date' ? startDate : undefined,
        endDate: dataMode === 'date' ? endDate : undefined,
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
                let startTs: number | undefined;
                let endTs: number | undefined;
                if (dataMode === 'date') {
                    startTs = new Date(startDate).setHours(0, 0, 0, 0);
                    endTs = new Date(endDate).setHours(23, 59, 59, 999);
                }
                const dashboardStats = await (dataMode === 'date'
                    ? apiClient.getDashboardStats(startTs, endTs)
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
                    setStatsLoaded(true);
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
    }, [startDate, endDate, dataMode, setStats, isToday]);

    useEffect(() => {
        setStatsLoaded(false);
    }, [startDate, endDate, dataMode]);

    const isSingleDay = startDate === endDate;
    const isCurrentDay = isSingleDay && startDate === today();
    const dateLabel = dataMode === 'total' ? '总量识别' : (isCurrentDay ? '今日识别' : (isSingleDay ? '当日识别' : '区间识别'));

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
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {!statsLoaded ? (
                    [...Array(4)].map((_, i) => (
                        <div key={i} className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 animate-pulse">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-lg bg-gray-200" />
                                <div className="flex-1">
                                    <div className="h-3 bg-gray-200 rounded w-16 mb-2" />
                                    <div className="h-6 bg-gray-200 rounded w-12" />
                                </div>
                            </div>
                        </div>
                    ))
                ) : (
                    <>
                        <StatCard label={dateLabel} value={stats.total} icon={<Activity size={20} />} color="bg-blue-500" trend={dataMode === 'total' ? undefined : (stats.trends?.total.value || '--')} trendDirection={dataMode === 'total' ? 'neutral' : (stats.trends?.total.direction || 'neutral')} />
                        <StatCard label="蓝牌车辆" value={stats.blue} icon={<ShieldCheck size={20} />} color="bg-indigo-500" trend={dataMode === 'total' ? undefined : (stats.trends?.blue.value || '--')} trendDirection={dataMode === 'total' ? 'neutral' : (stats.trends?.blue.direction || 'neutral')} />
                        <StatCard label="新能源" value={stats.green} icon={<Zap size={20} />} color="bg-green-500" trend={dataMode === 'total' ? undefined : (stats.trends?.green.value || '--')} trendDirection={dataMode === 'total' ? 'neutral' : (stats.trends?.green.direction || 'neutral')} />
                        <StatCard label="其他车辆" value={stats.yellow + stats.other} icon={<Car size={20} />} color="bg-orange-500" trend={dataMode === 'total' ? undefined : (stats.trends?.other.value || '--')} trendDirection={dataMode === 'total' ? 'neutral' : (stats.trends?.other.direction || 'neutral')} />
                    </>
                )}
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <DailyStatsChart date={dataMode === 'total' ? undefined : endDate} startDate={dataMode === 'date' ? startDate : undefined} />
                <PlateHeatmap date={dataMode === 'total' ? undefined : endDate} startDate={dataMode === 'date' ? startDate : undefined} />
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-1 h-[400px]">
                    <CategoryStats onCategoryClick={(type, label) => setSelectedCategory({ type, label })} />
                </div>
                <div className="lg:col-span-1 h-[400px]">
                    <HourlyStatsChart startDate={dataMode === 'date' ? startDate : undefined} endDate={dataMode === 'date' ? endDate : undefined} />
                </div>
                <div className="lg:col-span-1 h-[400px]">
                    <RecentPlatesList startDate={dataMode === 'date' ? startDate : undefined} endDate={dataMode === 'date' ? endDate : undefined} limit={8} />
                </div>
            </div>
            {selectedCategory && (
                <CategoryDetail type={selectedCategory.type} label={selectedCategory.label} onClose={() => setSelectedCategory(null)} date={dataMode === 'total' ? undefined : endDate} startDate={dataMode === 'date' ? startDate : undefined} endDate={dataMode === 'date' ? endDate : undefined} />
            )}
        </div>
    );
};
