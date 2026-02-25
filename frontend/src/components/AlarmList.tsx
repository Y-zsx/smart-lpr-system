import React, { useEffect, useMemo, useState } from 'react';
import { useAlarmStore, Alarm } from '../store/alarmStore';
import { AlertTriangle, Clock, MapPin, BellOff, ChevronRight } from 'lucide-react';
import { AlarmDetail } from './AlarmDetail';

interface AlarmGroup {
    plateNumber: string;
    alarms: Alarm[];
    latestTimestamp: number;
    unreadCount: number;
    severityCounts: {
        high: number;
        medium: number;
        low: number;
    };
}

export const AlarmList: React.FC = React.memo(() => {
    const { alarms, fetchAlarms } = useAlarmStore();
    const [selectedPlate, setSelectedPlate] = useState<string | null>(null);

    useEffect(() => {
        let stopped = false;
        let timer: number | undefined;
        let failureCount = 0;
        const run = async () => {
            if (stopped || document.hidden) return;
            try {
                await fetchAlarms();
                failureCount = 0;
            } catch (_error) {
                failureCount += 1;
            } finally {
                if (stopped) return;
                const delay = Math.min(30000, 5000 * Math.max(1, failureCount));
                timer = window.setTimeout(run, delay);
            }
        };
        void run();
        const onVisible = () => {
            if (!document.hidden) {
                void fetchAlarms();
            }
        };
        document.addEventListener('visibilitychange', onVisible);
        return () => {
            stopped = true;
            if (timer) window.clearTimeout(timer);
            document.removeEventListener('visibilitychange', onVisible);
        };
    }, [fetchAlarms]);

    // 按车牌号码分组
    const alarmGroups = useMemo(() => {
        const groupsMap = new Map<string, Alarm[]>();
        
        alarms.forEach(alarm => {
            const plate = alarm.plate_number;
            if (!groupsMap.has(plate)) {
                groupsMap.set(plate, []);
            }
            groupsMap.get(plate)!.push(alarm);
        });

        const groups: AlarmGroup[] = Array.from(groupsMap.entries()).map(([plateNumber, alarmList]) => {
            const sorted = [...alarmList].sort((a, b) => b.timestamp - a.timestamp);
            return {
                plateNumber,
                alarms: sorted,
                latestTimestamp: sorted[0]?.timestamp || 0,
                unreadCount: alarmList.filter(a => !a.is_read).length,
                severityCounts: {
                    high: alarmList.filter(a => a.severity === 'high').length,
                    medium: alarmList.filter(a => a.severity === 'medium').length,
                    low: alarmList.filter(a => a.severity === 'low').length,
                }
            };
        });

        // 按最新告警时间排序
        return groups.sort((a, b) => b.latestTimestamp - a.latestTimestamp);
    }, [alarms]);

    // 格式化告警原因，去掉 "Blacklisted: " 前缀
    const formatReason = (reason: string): string => {
        if (reason.startsWith('Blacklisted: ')) {
            return reason.substring('Blacklisted: '.length);
        }
        return reason;
    };

    // 过滤未读告警
    const unreadAlarms = alarms.filter(alarm => !alarm.is_read);
    const hasUnread = unreadAlarms.length > 0;

    return (
        <div className="bg-white rounded-xl border border-red-100 shadow-sm overflow-hidden h-full flex flex-col">
            <div className="p-4 border-b border-red-100 bg-red-50 flex justify-between items-center shrink-0">
                <h3 className="font-semibold text-red-800 flex items-center gap-2">
                    <AlertTriangle size={18} className="text-red-600" />
                    实时告警
                </h3>
                <div className="flex items-center gap-2">
                    {hasUnread && (
                        <span className="text-xs text-red-600 bg-white px-2 py-1 rounded-full border border-red-200">
                            {unreadAlarms.length} 未处理
                        </span>
                    )}
                    <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded-full">
                        {alarmGroups.length} 个车牌
                    </span>
                </div>
            </div>
            
            <div className="flex-1 overflow-y-auto p-4 space-y-3 min-h-[300px]">
                {alarmGroups.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full text-gray-400 py-12">
                        <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mb-3">
                            <BellOff size={32} className="opacity-20 text-gray-500" />
                        </div>
                        <p className="text-sm font-medium text-gray-500">暂无告警信息</p>
                        <p className="text-xs text-gray-400 mt-1">系统运行正常，未发现异常车辆</p>
                    </div>
                ) : (
                    alarmGroups.map((group) => {
                        const latestAlarm = group.alarms[0];
                        const hasHighSeverity = group.severityCounts.high > 0;
                        
                        return (
                            <div
                                key={group.plateNumber}
                                onClick={() => setSelectedPlate(group.plateNumber)}
                                className={`p-4 rounded-lg border transition-all shadow-sm cursor-pointer group ${
                                    hasHighSeverity 
                                        ? 'border-red-200 bg-red-50/50 hover:bg-red-100 hover:border-red-300' 
                                        : 'border-red-100 bg-white hover:bg-red-50'
                                }`}
                            >
                                <div className="flex justify-between items-start mb-2">
                                    <div className="flex-1">
                                        <span className="text-lg font-bold font-mono text-gray-800">{group.plateNumber}</span>
                                        {group.unreadCount > 0 && (
                                            <span className="ml-2 text-xs bg-red-500 text-white px-2 py-0.5 rounded-full">
                                                {group.unreadCount} 未处理
                                            </span>
                                        )}
                                    </div>
                                    <ChevronRight size={20} className="text-gray-400 group-hover:text-red-600 transition-colors flex-shrink-0" />
                                </div>
                                
                                <div className="flex items-center gap-2 mb-2 flex-wrap">
                                    {group.severityCounts.high > 0 && (
                                        <span className="text-xs px-2 py-0.5 rounded-full bg-red-100 text-red-700 border border-red-200">
                                            严重 {group.severityCounts.high}
                                        </span>
                                    )}
                                    {group.severityCounts.medium > 0 && (
                                        <span className="text-xs px-2 py-0.5 rounded-full bg-orange-100 text-orange-700 border border-orange-200">
                                            警告 {group.severityCounts.medium}
                                        </span>
                                    )}
                                    {group.severityCounts.low > 0 && (
                                        <span className="text-xs px-2 py-0.5 rounded-full bg-yellow-100 text-yellow-700 border border-yellow-200">
                                            提示 {group.severityCounts.low}
                                        </span>
                                    )}
                                    <span className="text-xs text-gray-500">
                                        共 {group.alarms.length} 条
                                    </span>
                                </div>

                                {latestAlarm && (
                                    <>
                                        <p className="text-sm text-red-600 mb-2 font-medium bg-red-50/50 p-2 rounded line-clamp-2">
                                            告警原因: {formatReason(latestAlarm.reason)}
                                        </p>
                                        <div className="flex items-center justify-between text-xs text-gray-500">
                                            <div className="flex items-center gap-1.5">
                                                <Clock size={14} className="text-gray-400" />
                                                <span>最新: {new Date(latestAlarm.timestamp).toLocaleString('zh-CN')}</span>
                                            </div>
                                            {latestAlarm.location && (
                                                <div className="flex items-center gap-1.5">
                                                    <MapPin size={14} className="text-gray-400" />
                                                    <span className="max-w-[150px] truncate">{latestAlarm.location}</span>
                                                </div>
                                            )}
                                        </div>
                                    </>
                                )}
                            </div>
                        );
                    })
                )}
            </div>

            {/* 告警详情弹窗 */}
            {selectedPlate && (
                <AlarmDetail
                    plateNumber={selectedPlate}
                    alarms={alarmGroups.find(g => g.plateNumber === selectedPlate)?.alarms || []}
                    onClose={() => setSelectedPlate(null)}
                />
            )}
        </div>
    );
});
