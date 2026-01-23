import React, { useState, useEffect } from 'react';
import { DailyStatsChart } from '../components/DailyStatsChart';
import { CategoryStats } from '../components/CategoryStats';
import { PlateHeatmap } from '../components/PlateHeatmap';
import { StatCard } from '../components/StatCard';
import { usePlateStore } from '../store/plateStore';
import { Activity, ShieldCheck, Zap, Car, Calendar } from 'lucide-react';
import { CategoryDetail } from '../components/CategoryDetail';
import { apiClient } from '../api/client';

export const DashboardPage: React.FC = () => {
    const { stats, setPlates, setTrends, setStats } = usePlateStore();
    const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
    const [selectedCategory, setSelectedCategory] = useState<{ type: string, label: string } | null>(null);

    useEffect(() => {
        const fetchData = async () => {
            if (document.hidden) return;
            try {
                const start = new Date(selectedDate).setHours(0, 0, 0, 0);
                const end = new Date(selectedDate).setHours(23, 59, 59, 999);
                
                const [groups, dashboardStats] = await Promise.all([
                    apiClient.getHistory(start, end, undefined, 'plate'), // 使用分组查询
                    apiClient.getDashboardStats(start).catch(err => {
                        console.warn("Failed to fetch dashboard stats:", err);
                        return null;
                    })
                ]);

                // setPlates 现在可以处理分组数据
                setPlates(groups);
                if (dashboardStats) {
                    // 更新统计数据和趋势
                    setStats({
                        total: dashboardStats.total,
                        blue: dashboardStats.blue,
                        green: dashboardStats.green,
                        yellow: dashboardStats.yellow,
                        other: dashboardStats.other,
                        trends: dashboardStats.trends
                    });
                }
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
    }, [selectedDate, setPlates, setStats]);

    const isToday = selectedDate === new Date().toISOString().split('T')[0];
    const dateLabel = isToday ? "今日识别" : "当日识别";

    return (
        <div className="space-y-6">
            {/* Page Header with Date Picker */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-4 rounded-xl border border-gray-100 shadow-sm">
                <div>
                    <h2 className="text-xl font-bold text-gray-800">仪表盘</h2>
                    <p className="text-sm text-gray-500">查看实时数据统计和趋势分析</p>
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

            {/* 1. Stat Cards Row */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <StatCard
                    label={dateLabel}
                    value={stats.total}
                    icon={<Activity size={20} />}
                    color="bg-blue-500"
                    trend={stats.trends?.total.value || "--"}
                    trendDirection={stats.trends?.total.direction || "neutral"}
                />
                <StatCard
                    label="蓝牌车辆"
                    value={stats.blue}
                    icon={<ShieldCheck size={20} />}
                    color="bg-indigo-500"
                    trend={stats.trends?.blue.value || "--"}
                    trendDirection={stats.trends?.blue.direction || "neutral"}
                />
                <StatCard
                    label="新能源"
                    value={stats.green}
                    icon={<Zap size={20} />}
                    color="bg-green-500"
                    trend={stats.trends?.green.value || "--"}
                    trendDirection={stats.trends?.green.direction || "neutral"}
                />
                <StatCard
                    label="其他车辆"
                    value={stats.yellow + stats.other}
                    icon={<Car size={20} />}
                    color="bg-orange-500"
                    trend={stats.trends?.other.value || "--"}
                    trendDirection={stats.trends?.other.direction || "neutral"}
                />
            </div>

            {/* 2. Charts Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <DailyStatsChart date={selectedDate} />
                <PlateHeatmap date={selectedDate} />
            </div>

            {/* 3. Category Stats */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-1">
                    <CategoryStats onCategoryClick={(type, label) => setSelectedCategory({ type, label })} />
                </div>
                {/* 这里可以放一些其他的统计或者留空，或者把上面的图表拉下来 */}
            </div>

            {/* Modals */}
            {selectedCategory && (
                <CategoryDetail
                    type={selectedCategory.type}
                    label={selectedCategory.label}
                    onClose={() => setSelectedCategory(null)}
                    date={selectedDate}
                />
            )}
        </div>
    );
};
