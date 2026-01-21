import React, { useState } from 'react';
import { CameraView } from '../components/CameraView';
import { CameraList } from '../components/CameraList';
import { FileUpload } from '../components/FileUpload';
import { Camera, Upload } from 'lucide-react';

export const LiveMonitorPage: React.FC = () => {
    const [mode, setMode] = useState<'camera' | 'upload'>('camera');

    return (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 h-[calc(100vh-140px)]">
            {/* Left Column: Main View (8) */}
            <div className="lg:col-span-8 flex flex-col gap-4 h-full">
                <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden flex flex-col h-full">
                    <div className="flex border-b border-gray-100 shrink-0">
                        <button
                            onClick={() => setMode('camera')}
                            className={`flex-1 py-3 text-sm font-medium flex items-center justify-center gap-2 transition-colors ${mode === 'camera'
                                ? 'bg-blue-50 text-blue-600 border-b-2 border-blue-600'
                                : 'text-gray-500 hover:bg-gray-50'
                                }`}
                        >
                            <Camera size={18} />
                            实时监控
                        </button>
                        <button
                            onClick={() => setMode('upload')}
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
            </div>

            {/* Right Column: Camera List (4) */}
            <div className="lg:col-span-4 h-full">
                <CameraList />
            </div>
        </div>
    );
};
