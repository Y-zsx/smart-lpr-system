import React, { useEffect } from 'react';
import { useAlarmStore } from '../store/alarmStore';
import { AlertTriangle, Clock, MapPin, BellOff } from 'lucide-react';

export const AlarmList: React.FC = () => {
    const { alarms, fetchAlarms } = useAlarmStore();

    useEffect(() => {
        fetchAlarms();
        const interval = setInterval(fetchAlarms, 5000); // Poll every 5s
        return () => clearInterval(interval);
    }, [fetchAlarms]);

    // 移除 if (alarms.length === 0) return null; 以便显示空状态

    return (
        <div className="bg-white rounded-xl border border-red-100 shadow-sm overflow-hidden h-full flex flex-col">
            <div className="p-4 border-b border-red-100 bg-red-50 flex justify-between items-center shrink-0">
                <h3 className="font-semibold text-red-800 flex items-center gap-2">
                    <AlertTriangle size={18} className="text-red-600" />
                    实时告警
                </h3>
                {alarms.length > 0 && (
                    <span className="text-xs text-red-600 bg-white px-2 py-1 rounded-full border border-red-200">
                        {alarms.length} 未处理
                    </span>
                )}
            </div>
            
            <div className="flex-1 overflow-y-auto p-4 space-y-3 min-h-[300px]">
                {alarms.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full text-gray-400 py-12">
                        <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mb-3">
                            <BellOff size={32} className="opacity-20 text-gray-500" />
                        </div>
                        <p className="text-sm font-medium text-gray-500">暂无告警信息</p>
                        <p className="text-xs text-gray-400 mt-1">系统运行正常，未发现异常车辆</p>
                    </div>
                ) : (
                    alarms.map((alarm) => (
                        <div key={alarm.id} className="p-4 rounded-lg border border-red-100 bg-white hover:bg-red-50 transition-colors shadow-sm">
                            <div className="flex justify-between items-start mb-2">
                                <span className="text-lg font-bold font-mono text-gray-800">{alarm.plate_number}</span>
                                <span className={`text-xs px-2.5 py-1 rounded-full border font-medium ${
                                    alarm.severity === 'high' ? 'bg-red-100 text-red-700 border-red-200' :
                                    alarm.severity === 'medium' ? 'bg-orange-100 text-orange-700 border-orange-200' :
                                    'bg-yellow-100 text-yellow-700 border-yellow-200'
                                }`}>
                                    {alarm.severity === 'high' ? '严重' : alarm.severity === 'medium' ? '警告' : '提示'}
                                </span>
                            </div>
                            <p className="text-sm text-red-600 mb-3 font-medium bg-red-50/50 p-2 rounded">{alarm.reason}</p>
                            <div className="flex items-center justify-between text-xs text-gray-500">
                                <div className="flex items-center gap-1.5">
                                    <Clock size={14} className="text-gray-400" />
                                    <span>{new Date(alarm.timestamp).toLocaleString()}</span>
                                </div>
                                <div className="flex items-center gap-1.5">
                                    <MapPin size={14} className="text-gray-400" />
                                    <span className="max-w-[150px] truncate">{alarm.location || '未知位置'}</span>
                                </div>
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
};
