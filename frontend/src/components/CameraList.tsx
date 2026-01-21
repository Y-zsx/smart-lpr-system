import React, { useState } from 'react';
import { useCameraStore, CameraDevice } from '../store/cameraStore';
import { Video, Globe, Plus, Trash2, Settings, MonitorPlay } from 'lucide-react';

export const CameraList: React.FC = () => {
    const { cameras, selectedCameraId, selectCamera, addCamera, removeCamera } = useCameraStore();
    const [isAdding, setIsAdding] = useState(false);
    const [newCam, setNewCam] = useState({ name: '', url: '', type: 'stream' as const });

    const handleAdd = () => {
        if (!newCam.name) return;
        addCamera({
            name: newCam.name,
            type: 'stream',
            url: newCam.url
        });
        setIsAdding(false);
        setNewCam({ name: '', url: '', type: 'stream' });
    };

    return (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm flex flex-col h-full">
            <div className="p-4 border-b border-gray-100 flex justify-between items-center">
                <h3 className="font-semibold text-gray-800 flex items-center gap-2">
                    <MonitorPlay size={18} className="text-blue-600" />
                    摄像头管理
                </h3>
                <button
                    onClick={() => setIsAdding(true)}
                    className="p-1.5 hover:bg-blue-50 text-blue-600 rounded-lg transition-colors"
                    title="添加摄像头"
                >
                    <Plus size={18} />
                </button>
            </div>

            <div className="flex-1 overflow-y-auto p-2 space-y-2">
                {cameras.map((cam) => (
                    <div
                        key={cam.id}
                        onClick={() => selectCamera(cam.id)}
                        className={`p-3 rounded-lg cursor-pointer border transition-all group ${selectedCameraId === cam.id
                            ? 'bg-blue-50 border-blue-200 shadow-sm'
                            : 'bg-white border-transparent hover:bg-gray-50 hover:border-gray-100'
                            }`}
                    >
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className={`p-2 rounded-lg ${selectedCameraId === cam.id ? 'bg-blue-100 text-blue-600' : 'bg-gray-100 text-gray-500'
                                    }`}>
                                    {cam.type === 'local' ? <Video size={16} /> : <Globe size={16} />}
                                </div>
                                <div>
                                    <p className={`text-sm font-medium ${selectedCameraId === cam.id ? 'text-blue-900' : 'text-gray-700'
                                        }`}>
                                        {cam.name}
                                    </p>
                                    <div className="flex items-center gap-2 mt-0.5">
                                        <span className={`w-1.5 h-1.5 rounded-full ${cam.status === 'online' ? 'bg-green-500' : 'bg-gray-300'
                                            }`} />
                                        <span className="text-xs text-gray-400">
                                            {cam.type === 'local' ? '本地设备' : '网络流'}
                                        </span>
                                    </div>
                                </div>
                            </div>

                            {cam.type !== 'local' && (
                                <button
                                    onClick={(e) => { e.stopPropagation(); removeCamera(cam.id); }}
                                    className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded opacity-0 group-hover:opacity-100 transition-all"
                                >
                                    <Trash2 size={14} />
                                </button>
                            )}
                        </div>
                    </div>
                ))}
            </div>

            {/* Add Camera Modal */}
            {isAdding && (
                <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/20 backdrop-blur-sm p-4 rounded-xl">
                    <div className="bg-white p-4 rounded-xl shadow-xl w-full max-w-xs border border-gray-100">
                        <h4 className="font-bold text-gray-800 mb-3">添加网络摄像头</h4>
                        <div className="space-y-3">
                            <div>
                                <label className="text-xs text-gray-500 block mb-1">名称</label>
                                <input
                                    className="w-full px-3 py-2 bg-gray-50 rounded-lg text-sm border border-gray-200 focus:outline-none focus:border-blue-500"
                                    placeholder="例如：停车场入口"
                                    value={newCam.name}
                                    onChange={e => setNewCam({ ...newCam, name: e.target.value })}
                                />
                            </div>
                            <div>
                                <label className="text-xs text-gray-500 block mb-1">流地址 (URL)</label>
                                <input
                                    className="w-full px-3 py-2 bg-gray-50 rounded-lg text-sm border border-gray-200 focus:outline-none focus:border-blue-500"
                                    placeholder="http://..."
                                    value={newCam.url}
                                    onChange={e => setNewCam({ ...newCam, url: e.target.value })}
                                />
                            </div>
                            <div className="flex gap-2 pt-2">
                                <button
                                    onClick={() => setIsAdding(false)}
                                    className="flex-1 px-3 py-2 bg-gray-100 text-gray-600 rounded-lg text-sm font-medium hover:bg-gray-200"
                                >
                                    取消
                                </button>
                                <button
                                    onClick={handleAdd}
                                    className="flex-1 px-3 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700"
                                >
                                    添加
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
