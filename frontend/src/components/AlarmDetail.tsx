import React from 'react';
import { Alarm } from '../store/alarmStore';
import { Clock, MapPin, X, Image as ImageIcon, AlertTriangle } from 'lucide-react';
import { apiClient } from '../api/client';

interface AlarmDetailProps {
    plateNumber: string;
    alarms: Alarm[];
    onClose: () => void;
}

export const AlarmDetail: React.FC<AlarmDetailProps> = ({ plateNumber, alarms, onClose }) => {
    const [selectedImage, setSelectedImage] = React.useState<string | null>(null);

    // 格式化告警原因，去掉 "Blacklisted: " 前缀
    const formatReason = (reason: string): string => {
        if (reason.startsWith('Blacklisted: ')) {
            return reason.substring('Blacklisted: '.length);
        }
        return reason;
    };

    // 按时间排序（最新的在前）
    const sortedAlarms = [...alarms].sort((a, b) => b.timestamp - a.timestamp);

    // 统计信息
    const totalCount = alarms.length;
    const unreadCount = alarms.filter(a => !a.is_read).length;
    const severityCounts = {
        high: alarms.filter(a => a.severity === 'high').length,
        medium: alarms.filter(a => a.severity === 'medium').length,
        low: alarms.filter(a => a.severity === 'low').length,
    };
    const latestAlarm = sortedAlarms[0];

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col">
                {/* Header */}
                <div className="p-6 border-b border-gray-200 flex items-center justify-between shrink-0">
                    <div>
                        <h2 className="text-2xl font-bold text-gray-800 font-mono">
                            {plateNumber}
                        </h2>
                        <p className="text-sm text-gray-500 mt-1">
                            共 {totalCount} 条告警记录 {unreadCount > 0 && `| ${unreadCount} 条未处理`}
                        </p>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                    >
                        <X size={20} className="text-gray-500" />
                    </button>
                </div>

                {/* Info Cards */}
                <div className="p-6 grid grid-cols-2 md:grid-cols-4 gap-4 shrink-0 border-b border-gray-200">
                    <div className="bg-red-50 p-4 rounded-lg">
                        <p className="text-xs text-gray-500 mb-1">严重告警</p>
                        <p className="text-lg font-bold text-red-600">
                            {severityCounts.high}
                        </p>
                    </div>
                    <div className="bg-orange-50 p-4 rounded-lg">
                        <p className="text-xs text-gray-500 mb-1">警告告警</p>
                        <p className="text-lg font-bold text-orange-600">
                            {severityCounts.medium}
                        </p>
                    </div>
                    <div className="bg-yellow-50 p-4 rounded-lg">
                        <p className="text-xs text-gray-500 mb-1">提示告警</p>
                        <p className="text-lg font-bold text-yellow-600">
                            {severityCounts.low}
                        </p>
                    </div>
                    <div className="bg-blue-50 p-4 rounded-lg">
                        <p className="text-xs text-gray-500 mb-1">最新告警</p>
                        <p className="text-sm font-medium text-gray-800">
                            {latestAlarm ? new Date(latestAlarm.timestamp).toLocaleString('zh-CN') : '无'}
                        </p>
                    </div>
                </div>

                {/* Alarms List */}
                <div className="flex-1 overflow-y-auto p-6">
                    <h3 className="text-lg font-semibold text-gray-800 mb-4">告警记录（按时间排序）</h3>
                    <div className="space-y-3">
                        {sortedAlarms.map((alarm) => (
                            <div
                                key={alarm.id}
                                className={`p-4 rounded-lg border transition-all ${
                                    alarm.severity === 'high' ? 'bg-red-50 border-red-200 hover:border-red-300' :
                                    alarm.severity === 'medium' ? 'bg-orange-50 border-orange-200 hover:border-orange-300' :
                                    'bg-yellow-50 border-yellow-200 hover:border-yellow-300'
                                }`}
                            >
                                <div className="flex items-start justify-between gap-4">
                                    <div className="flex-1">
                                        <div className="flex items-center gap-3 mb-2">
                                            <span className={`text-xs px-2.5 py-1 rounded-full border font-medium ${
                                                alarm.severity === 'high' ? 'bg-red-100 text-red-700 border-red-200' :
                                                alarm.severity === 'medium' ? 'bg-orange-100 text-orange-700 border-orange-200' :
                                                'bg-yellow-100 text-yellow-700 border-yellow-200'
                                            }`}>
                                                {alarm.severity === 'high' ? '严重' : alarm.severity === 'medium' ? '警告' : '提示'}
                                            </span>
                                            {!alarm.is_read && (
                                                <span className="text-xs bg-red-500 text-white px-2 py-0.5 rounded-full">
                                                    未处理
                                                </span>
                                            )}
                                            <div className="flex items-center gap-1 text-xs text-gray-500">
                                                <Clock size={12} />
                                                <span>{new Date(alarm.timestamp).toLocaleString('zh-CN')}</span>
                                            </div>
                                        </div>
                                        <p className={`text-sm font-medium mb-2 ${
                                            alarm.severity === 'high' ? 'text-red-700' :
                                            alarm.severity === 'medium' ? 'text-orange-700' :
                                            'text-yellow-700'
                                        }`}>
                                            告警原因: {formatReason(alarm.reason)}
                                        </p>
                                        {alarm.location && (
                                            <div className="flex items-center gap-1 text-xs text-gray-600">
                                                <MapPin size={12} />
                                                <span>{alarm.location}</span>
                                            </div>
                                        )}
                                    </div>
                                    {alarm.image_path && (
                                        <button
                                            onClick={() => {
                                                const imageUrl = apiClient.getImageUrl(alarm.image_path);
                                                setSelectedImage(imageUrl);
                                            }}
                                            className="p-2 bg-white hover:bg-blue-50 rounded-lg border border-gray-200 transition-colors flex-shrink-0"
                                            title="查看图片"
                                        >
                                            <ImageIcon size={18} className="text-gray-600" />
                                        </button>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Image Modal */}
                {selectedImage && (
                    <div
                        className="fixed inset-0 z-60 flex items-center justify-center bg-black/80 p-4"
                        onClick={() => setSelectedImage(null)}
                    >
                        <div className="relative max-w-4xl max-h-[90vh]">
                            <img
                                src={selectedImage}
                                alt="告警图片"
                                className="max-w-full max-h-[90vh] object-contain rounded-lg"
                                onClick={(e) => e.stopPropagation()}
                            />
                            <button
                                onClick={() => setSelectedImage(null)}
                                className="absolute top-4 right-4 p-2 bg-white/90 hover:bg-white rounded-full transition-colors"
                            >
                                <X size={20} className="text-gray-800" />
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};
