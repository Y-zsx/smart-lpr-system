import React, { useEffect } from 'react';
import { useAlarmStore } from '../store/alarmStore';
import { AlertTriangle, Clock, MapPin } from 'lucide-react';

export const AlarmList: React.FC = () => {
    const { alarms, fetchAlarms } = useAlarmStore();

    useEffect(() => {
        fetchAlarms();
        const interval = setInterval(fetchAlarms, 5000); // Poll every 5s
        return () => clearInterval(interval);
    }, [fetchAlarms]);

    if (alarms.length === 0) return null;

    return (
        <div className="bg-white rounded-xl border border-red-100 shadow-sm overflow-hidden">
            <div className="p-4 border-b border-red-100 bg-red-50 flex justify-between items-center">
                <h3 className="font-semibold text-red-800 flex items-center gap-2">
                    <AlertTriangle size={18} className="text-red-600" />
                    实时告警
                </h3>
                <span className="text-xs text-red-600 bg-white px-2 py-1 rounded-full border border-red-200">
                    {alarms.length} 未处理
                </span>
            </div>
            <div className="max-h-[300px] overflow-y-auto p-2 space-y-2">
                {alarms.map((alarm) => (
                    <div key={alarm.id} className="p-3 rounded-lg border border-red-100 bg-white hover:bg-red-50 transition-colors">
                        <div className="flex justify-between items-start mb-1">
                            <span className="text-lg font-bold font-mono text-gray-800">{alarm.plate_number}</span>
                            <span className={`text-xs px-2 py-0.5 rounded-full border ${alarm.severity === 'high' ? 'bg-red-100 text-red-700 border-red-200' :
                                alarm.severity === 'medium' ? 'bg-orange-100 text-orange-700 border-orange-200' :
                                    'bg-yellow-100 text-yellow-700 border-yellow-200'
                                }`}>
                                {alarm.severity === 'high' ? '严重' : alarm.severity === 'medium' ? '警告' : '提示'}
                            </span>
                        </div>
                        <p className="text-sm text-red-600 mb-2 font-medium">{alarm.reason}</p>
                        <div className="flex items-center justify-between text-xs text-gray-500">
                            <div className="flex items-center gap-1">
                                <Clock size={12} />
                                <span>{new Date(alarm.timestamp).toLocaleTimeString()}</span>
                            </div>
                            <div className="flex items-center gap-1">
                                <MapPin size={12} />
                                <span className="max-w-[100px] truncate">{alarm.location || '未知位置'}</span>
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};
