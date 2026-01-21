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

export const Dashboard: React.FC = () => {
    const { stats, setPlates, settings } = usePlateStore();
    const [mode, setMode] = useState<'camera' | 'upload'>('camera');
    const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
    const [selectedCategory, setSelectedCategory] = useState<{ type: string, label: string } | null>(null);
    const [showBlacklist, setShowBlacklist] = useState(false);
    const [showSettings, setShowSettings] = useState(false);

    useEffect(() => {
        const fetchData = async () => {
            if (document.hidden) return; // Skip if hidden

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
    }, [selectedDate, setPlates]);

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
            {/* Stats Grid - Mobile Optimized */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
                <StatCard
                    label="今日识别"
                    value={stats.total}
                    icon={<Activity size={20} />}
                    color="bg-blue-500"
                />
                <StatCard
                    label="蓝牌车辆"
                    value={stats.blue}
                    icon={<ShieldCheck size={20} />}
                    color="bg-indigo-500"
                />
                <StatCard
                    label="新能源"
                    value={stats.green}
                    icon={<Zap size={20} />}
                    color="bg-green-500"
                />
                <StatCard
                    label="其他车辆"
                    value={stats.yellow + stats.other}
                    icon={<Car size={20} />}
                    color="bg-orange-500"
                />
            </div>

            {/* Main Content Area */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Left Column: Primary Actions & Visuals */}
                <div className="lg:col-span-2 space-y-6">
                    {/* Mode Switcher & Camera/Upload Area */}
                    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                        <div className="flex border-b border-gray-100">
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

                        <div className="h-[300px] md:h-[400px] lg:h-[500px] bg-black relative">
                            {mode === 'camera' ? <CameraView /> : <FileUpload />}
                        </div>
                    </div>

                    {/* Charts Section */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <DailyStatsChart date={selectedDate} />
                        <PlateHeatmap date={selectedDate} />
                    </div>
                </div>

                {/* Right Column: Lists & Secondary Stats */}
                <div className="space-y-6">
                    <AlarmList />

                    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4">
                        <h3 className="text-lg font-semibold text-gray-800 mb-4">摄像头列表</h3>
                        <div className="h-[200px]">
                            <CameraList />
                        </div>
                    </div>

                    <CategoryStats onCategoryClick={(type, label) => setSelectedCategory({ type, label })} />

                    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 flex flex-col h-[500px]">
                        <h3 className="text-lg font-semibold text-gray-800 mb-4">识别记录</h3>
                        <div className="flex-1 min-h-0">
                            <PlateList date={selectedDate} />
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
