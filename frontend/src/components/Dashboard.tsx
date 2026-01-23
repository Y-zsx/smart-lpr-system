import React, { useState, useEffect } from 'react';
import { CameraView } from './CameraView';
import { PlateList } from './PlateList';
import { FileUpload } from './FileUpload';
import { DailyStatsChart } from './DailyStatsChart';
import { CategoryStats } from './CategoryStats';
import { CategoryDetail } from './CategoryDetail';
import { PlateHeatmap } from './PlateHeatmap';
import { CameraList } from './CameraList';
import { AlarmList } from './AlarmList';
import { BlacklistManager } from './BlacklistManager';
import { StatCard } from './StatCard';
import { SettingsModal } from './SettingsModal';
import { MainLayout } from '../layouts/MainLayout';
import { usePlateStore } from '../store/plateStore';
import { Activity, ShieldCheck, Zap, Car, Camera, Upload, Calendar, AlertOctagon, Settings } from 'lucide-react';
import { apiClient } from '../api/client';
import { hapticFeedback } from '../utils/mobileFeatures';
import { simulationService } from '../services/simulationService';

export const Dashboard: React.FC = () => {
    const { stats, setPlates, setTrends, setStats, settings } = usePlateStore();
    const [mode, setMode] = useState<'camera' | 'upload'>('camera');
    const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
    const [selectedCategory, setSelectedCategory] = useState<{ type: string, label: string } | null>(null);
    const [showBlacklist, setShowBlacklist] = useState(false);
    const [showSettings, setShowSettings] = useState(false);

    // Handle Simulation Mode
    useEffect(() => {
        if (settings.isDemoMode) {
            simulationService.start();
        } else {
            simulationService.stop();
        }
        return () => simulationService.stop();
    }, [settings.isDemoMode]);

    useEffect(() => {
        const fetchData = async () => {
            if (document.hidden) return; // Skip if hidden

            try {
                const start = new Date(selectedDate).setHours(0, 0, 0, 0);
                const end = new Date(selectedDate).setHours(23, 59, 59, 999);
                
                // 并行请求历史记录和趋势数据，传递所选日期
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

        // Visibility change handler
        const handleVisibilityChange = () => {
            if (!document.hidden && isToday) {
                fetchData(); // Fetch immediately on resume
            }
        };
        document.addEventListener('visibilitychange', handleVisibilityChange);

        return () => {
            if (interval) clearInterval(interval);
            document.removeEventListener('visibilitychange', handleVisibilityChange);
        };
    }, [selectedDate, setPlates, setStats]);

    const handleModeChange = (newMode: 'camera' | 'upload') => {
        if (settings.enableHaptics) hapticFeedback('light');
        setMode(newMode);
    };

    // Header Actions
    const headerActions = (
        <div className="flex items-center gap-2">
            <button
                onClick={() => {
                    if (settings.enableHaptics) hapticFeedback('medium');
                    setShowSettings(true);
                }}
                className="p-2 text-gray-600 bg-gray-100 rounded-full hover:bg-gray-200 transition-colors"
                title="系统设置"
            >
                <Settings size={20} />
            </button>
            <button
                onClick={() => {
                    if (settings.enableHaptics) hapticFeedback('medium');
                    setShowBlacklist(true);
                }}
                className="p-2 text-red-600 bg-red-50 rounded-full hover:bg-red-100 transition-colors"
                title="黑名单管理"
            >
                <AlertOctagon size={20} />
            </button>
            <div className="relative">
                <input
                    type="date"
                    value={selectedDate}
                    onChange={(e) => setSelectedDate(e.target.value)}
                    className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                />
                <button className="p-2 text-gray-600 bg-gray-100 rounded-full hover:bg-gray-200 transition-colors">
                    <Calendar size={20} />
                </button>
            </div>
        </div>
    );

    return (
        <MainLayout actions={headerActions}>
            {/* 1. Stat Cards Row */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                <StatCard
                    label={selectedDate === new Date().toISOString().split('T')[0] ? "今日识别" : "当日识别"}
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

            {/* 2. Main Bento Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                
                {/* Left Column: Camera (8) + Charts (8) */}
                <div className="lg:col-span-8 flex flex-col gap-6">
                    {/* Camera Section */}
                    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden h-[500px] relative flex flex-col">
                        <div className="flex border-b border-gray-100 shrink-0">
                            <button
                                onClick={() => handleModeChange('camera')}
                                className={`flex-1 py-3 text-sm font-medium flex items-center justify-center gap-2 transition-colors ${mode === 'camera'
                                    ? 'bg-blue-50 text-blue-600 border-b-2 border-blue-600'
                                    : 'text-gray-500 hover:bg-gray-50'
                                    }`}
                            >
                                <Camera size={18} />
                                实时监控
                            </button>
                            <button
                                onClick={() => handleModeChange('upload')}
                                className={`flex-1 py-3 text-sm font-medium flex items-center justify-center gap-2 transition-colors ${mode === 'upload'
                                    ? 'bg-blue-50 text-blue-600 border-b-2 border-blue-600'
                                    : 'text-gray-500 hover:bg-gray-50'
                                    }`}
                            >
                                <Upload size={18} />
                                图片上传
                            </button>
                        </div>

                        <div className="flex-1 bg-black relative min-h-0">
                            {mode === 'camera' ? <CameraView /> : <FileUpload />}
                        </div>
                    </div>
                    
                    {/* Charts Row */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 h-[350px]">
                         <DailyStatsChart date={selectedDate} />
                         <PlateHeatmap date={selectedDate} />
                    </div>
                </div>

                {/* Right Column: Sidebar (4) */}
                <div className="lg:col-span-4 flex flex-col gap-6">
                     {/* Alarm List - Auto Height */}
                     <AlarmList />

                     {/* Plate List - Flex Grow to fill space */}
                     <div className="flex-1 min-h-[400px] max-h-[600px] bg-white rounded-2xl shadow-sm border border-gray-100 p-4 flex flex-col">
                        <div className="flex-1 min-h-0 overflow-y-auto">
                            <PlateList date={selectedDate} />
                        </div>
                     </div>

                     {/* Bottom Row of Sidebar */}
                     <div className="grid grid-cols-2 gap-4 h-[200px]">
                        <CategoryStats onCategoryClick={(type, label) => setSelectedCategory({ type, label })} />
                        <div className="h-full">
                            <CameraList />
                        </div>
                     </div>
                </div>
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

            {showBlacklist && (
                <BlacklistManager onClose={() => setShowBlacklist(false)} />
            )}

            {showSettings && (
                <SettingsModal onClose={() => setShowSettings(false)} />
            )}
        </MainLayout>
    );
};
