import React, { useState, useEffect } from 'react';
import { CameraView } from '@/components/CameraView';
import { MultiCameraView } from '@/components/MultiCameraView';
import { CameraList } from '@/components/CameraList';
import { CameraMap } from '@/components/CameraMap';
import { FileUpload } from '@/components/FileUpload';
import { Camera, Upload, Map, List, Grid } from 'lucide-react';
import { useCameraStore } from '@/store/cameraStore';
import { apiClient } from '@/api/client';

interface LiveMonitorPageProps {
    canManageCamera?: boolean;
}

export const LiveMonitorPage: React.FC<LiveMonitorPageProps> = ({ canManageCamera = true }) => {
    const [mode, setMode] = useState<'camera' | 'upload' | 'multi'>('camera');
    const [rightView, setRightView] = useState<'list' | 'map'>('list');
    const setCamerasFromServer = useCameraStore((s) => s.setCamerasFromServer);

    useEffect(() => {
        apiClient.getCameras()
            .then((list: any) => {
                const arr = Array.isArray(list) ? list : [];
                setCamerasFromServer(arr.map((c: any) => ({
                    id: c.id,
                    name: c.name,
                    type: c.type || 'stream',
                    url: c.url,
                    deviceId: c.deviceId,
                    status: c.status || 'offline',
                    lastActive: c.lastActive,
                    location: c.location,
                    regionCode: c.regionCode,
                    latitude: c.latitude,
                    longitude: c.longitude
                })));
            })
            .catch(() => {});
    }, [setCamerasFromServer]);

    return (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 md:gap-6 min-h-[calc(100dvh-8.5rem)] lg:h-[calc(100dvh-8.5rem)]">
            <div className="lg:col-span-8 flex flex-col gap-4 min-h-0">
                <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden flex flex-col h-full">
                    <div className="flex border-b border-gray-100 shrink-0 overflow-x-auto">
                        <button onClick={() => setMode('camera')} className={`min-w-[108px] sm:min-w-0 flex-1 py-3 text-sm font-medium flex items-center justify-center gap-2 transition-colors ${mode === 'camera' ? 'bg-blue-50 text-blue-600 border-b-2 border-blue-600' : 'text-gray-500 hover:bg-gray-50'}`}>
                            <Camera size={18} /><span className="whitespace-nowrap">单窗口</span>
                        </button>
                        <button onClick={() => setMode('multi')} className={`min-w-[108px] sm:min-w-0 flex-1 py-3 text-sm font-medium flex items-center justify-center gap-2 transition-colors ${mode === 'multi' ? 'bg-blue-50 text-blue-600 border-b-2 border-blue-600' : 'text-gray-500 hover:bg-gray-50'}`}>
                            <Grid size={18} /><span className="whitespace-nowrap">多窗口</span>
                        </button>
                        <button onClick={() => setMode('upload')} className={`min-w-[116px] sm:min-w-0 flex-1 py-3 text-sm font-medium flex items-center justify-center gap-2 transition-colors ${mode === 'upload' ? 'bg-blue-50 text-blue-600 border-b-2 border-blue-600' : 'text-gray-500 hover:bg-gray-50'}`}>
                            <Upload size={18} /><span className="whitespace-nowrap">图片上传</span>
                        </button>
                    </div>
                    <div className={`flex-1 relative min-h-0 ${mode === 'upload' ? 'bg-gray-50' : 'bg-black'}`}>
                        {mode === 'camera' ? <CameraView /> : mode === 'multi' ? <MultiCameraView /> : <FileUpload />}
                    </div>
                </div>
            </div>
            <div className="lg:col-span-4 min-h-0 flex flex-col gap-4">
                <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-2 flex flex-col sm:flex-row gap-2">
                    <button onClick={() => setRightView('list')} className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium flex items-center justify-center gap-2 transition-colors ${rightView === 'list' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
                        <List size={16} />摄像头列表
                    </button>
                    <button onClick={() => setRightView('map')} className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium flex items-center justify-center gap-2 transition-colors ${rightView === 'map' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
                        <Map size={16} />地图分布
                    </button>
                </div>
                <div className="flex-1 min-h-0">
                    {rightView === 'list' ? (
                        <CameraList canManage={canManageCamera} />
                    ) : (
                        <div className="bg-white rounded-xl border border-gray-100 shadow-sm h-full p-4">
                            <h3 className="font-semibold text-gray-800 mb-3 flex items-center gap-2">
                                <Map size={18} className="text-blue-600" />摄像头位置分布
                            </h3>
                            <div className="h-[280px] sm:h-[320px] lg:h-[calc(100%-3rem)]">
                                <CameraMap />
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
