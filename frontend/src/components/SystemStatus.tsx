import React, { useState, useEffect } from 'react';
import { Activity, Cloud, Server, Maximize, Minimize } from 'lucide-react';
import { apiClient } from '../api/client';

export const SystemStatus: React.FC = () => {
    const [aiStatus, setAiStatus] = useState<'online' | 'offline' | 'checking'>('checking');
    const [cloudStatus, setCloudStatus] = useState<'online' | 'offline' | 'checking'>('checking');
    const [isFullscreen, setIsFullscreen] = useState(false);

    const checkHealth = async () => {
        // Check AI Backend
        try {
            const res = await fetch('http://localhost:8000/health');
            if (res.ok) setAiStatus('online');
            else setAiStatus('offline');
        } catch (e) {
            setAiStatus('offline');
        }

        // Check Cloud Backend
        try {
            await apiClient.getAlarms();
            setCloudStatus('online');
        } catch (e: any) {
            // If 401, it means we reached the server but are not logged in. 
            // This counts as "Online" for system health purposes.
            if (e.status === 401 || e.message?.includes('401')) {
                setCloudStatus('online');
            } else {
                setCloudStatus('offline');
            }
        }
    };

    useEffect(() => {
        checkHealth();
        const interval = setInterval(checkHealth, 30000); // Check every 30s
        return () => clearInterval(interval);
    }, []);

    const toggleFullscreen = () => {
        if (!document.fullscreenElement) {
            document.documentElement.requestFullscreen();
            setIsFullscreen(true);
        } else {
            if (document.exitFullscreen) {
                document.exitFullscreen();
                setIsFullscreen(false);
            }
        }
    };

    return (
        <div className="flex items-center gap-4">
            {/* Status Indicators */}
            <div className="hidden md:flex items-center gap-3 bg-gray-50 px-3 py-1.5 rounded-full border border-gray-200">
                <div className="flex items-center gap-1.5" title="AI 识别服务 (Python)">
                    <Server size={14} className={aiStatus === 'online' ? 'text-green-600' : 'text-red-500'} />
                    <span className={`text-xs font-medium ${aiStatus === 'online' ? 'text-green-700' : 'text-red-600'}`}>
                        AI: {aiStatus === 'online' ? '在线' : '离线'}
                    </span>
                </div>
                <div className="w-px h-3 bg-gray-300"></div>
                <div className="flex items-center gap-1.5" title="云端数据服务">
                    <Cloud size={14} className={cloudStatus === 'online' ? 'text-blue-600' : 'text-red-500'} />
                    <span className={`text-xs font-medium ${cloudStatus === 'online' ? 'text-blue-700' : 'text-red-600'}`}>
                        云端: {cloudStatus === 'online' ? '正常' : '异常'}
                    </span>
                </div>
            </div>

            {/* Fullscreen Toggle */}
            <button
                onClick={toggleFullscreen}
                className="p-2 text-gray-500 hover:bg-gray-100 rounded-full transition-colors hidden sm:block"
                title={isFullscreen ? "退出全屏" : "全屏模式"}
            >
                {isFullscreen ? <Minimize size={20} /> : <Maximize size={20} />}
            </button>
        </div>
    );
};
