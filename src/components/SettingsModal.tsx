import React from 'react';
import { X, Sliders, Zap, Clock, Eye } from 'lucide-react';
import { usePlateStore } from '../store/plateStore';

interface SettingsModalProps {
    onClose: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({ onClose }) => {
    const { settings, updateSettings } = usePlateStore();

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in duration-200">
                <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
                    <h3 className="font-bold text-gray-800 flex items-center gap-2">
                        <Sliders size={20} className="text-blue-600" />
                        系统设置
                    </h3>
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-gray-200 rounded-full transition-colors text-gray-500"
                    >
                        <X size={20} />
                    </button>
                </div>

                <div className="p-6 space-y-6">
                    {/* Confidence Threshold */}
                    <div className="space-y-3">
                        <div className="flex justify-between items-center">
                            <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
                                <Eye size={16} className="text-blue-500" />
                                识别置信度阈值
                            </label>
                            <span className="text-sm font-bold text-blue-600">
                                {(settings.confidenceThreshold * 100).toFixed(0)}%
                            </span>
                        </div>
                        <input
                            type="range"
                            min="0.5"
                            max="0.95"
                            step="0.05"
                            value={settings.confidenceThreshold}
                            onChange={(e) => updateSettings({ confidenceThreshold: parseFloat(e.target.value) })}
                            className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
                        />
                        <p className="text-xs text-gray-500">
                            低于此置信度的识别结果将不会显示在列表中。
                        </p>
                    </div>

                    {/* Scan Interval */}
                    <div className="space-y-3">
                        <div className="flex justify-between items-center">
                            <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
                                <Clock size={16} className="text-green-500" />
                                自动扫描间隔
                            </label>
                            <span className="text-sm font-bold text-green-600">
                                {settings.scanInterval} ms
                            </span>
                        </div>
                        <input
                            type="range"
                            min="500"
                            max="5000"
                            step="100"
                            value={settings.scanInterval}
                            onChange={(e) => updateSettings({ scanInterval: parseInt(e.target.value) })}
                            className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-green-600"
                        />
                        <p className="text-xs text-gray-500">
                            调整自动抓拍识别的频率，频率越高CPU占用越高。
                        </p>
                    </div>

                    {/* Haptics Toggle */}
                    <div className="flex items-center justify-between p-3 bg-gray-50 rounded-xl border border-gray-100">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-purple-100 text-purple-600 rounded-lg">
                                <Zap size={18} />
                            </div>
                            <div>
                                <p className="text-sm font-medium text-gray-800">触感反馈</p>
                                <p className="text-xs text-gray-500">操作时的震动反馈</p>
                            </div>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer">
                            <input
                                type="checkbox"
                                checked={settings.enableHaptics}
                                onChange={(e) => updateSettings({ enableHaptics: e.target.checked })}
                                className="sr-only peer"
                            />
                            <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                        </label>
                    </div>
                </div>

                <div className="p-4 border-t border-gray-100 bg-gray-50">
                    <button
                        onClick={onClose}
                        className="w-full py-2.5 bg-blue-600 text-white rounded-xl font-medium hover:bg-blue-700 active:scale-[0.98] transition-all"
                    >
                        完成设置
                    </button>
                </div>
            </div>
        </div>
    );
};
