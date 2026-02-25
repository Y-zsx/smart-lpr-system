import React, { useEffect, useState } from 'react';
import ReactECharts from 'echarts-for-react';
import * as echarts from 'echarts';
import { Clock } from 'lucide-react';
import { usePlateStore } from '../store/plateStore';
import { usePlateHistory } from '@/hooks/usePlateHistory';

interface HourlyStatsChartProps {
    date?: string; // 可选的日期参数，undefined 表示总量模式
}

export const HourlyStatsChart: React.FC<HourlyStatsChartProps> = React.memo(({ date }) => {
    const [hourlyData, setHourlyData] = useState<number[]>(new Array(24).fill(0));
    const [loading, setLoading] = useState(true);
    const { settings } = usePlateStore();
    const { data: groups } = usePlateHistory({ date, groupBy: 'plate' });

    useEffect(() => {
        const fetchHourlyStats = async () => {
            setLoading(true);
            try {
                if (settings.isDemoMode) {
                    // 生成模拟数据
                    const mockData = Array.from({ length: 24 }, () => Math.floor(Math.random() * 50));
                    setHourlyData(mockData);
                    await new Promise(resolve => setTimeout(resolve, 500));
                } else {
                    // 按小时统计
                    const hourlyCounts = new Array(24).fill(0);
                    groups.forEach((group) => {
                        group.records.forEach((record) => {
                            const hour = new Date(record.timestamp).getHours();
                            hourlyCounts[hour]++;
                        });
                    });
                    
                    setHourlyData(hourlyCounts);
                }
            } catch (error) {
                console.error('加载小时统计数据失败', error);
                if (settings.isDemoMode) {
                    setHourlyData(new Array(24).fill(0));
                }
            } finally {
                setLoading(false);
            }
        };

        fetchHourlyStats();
    }, [date, settings.isDemoMode, groups]);

    const getOption = () => {
        const hours = Array.from({ length: 24 }, (_, i) => `${i.toString().padStart(2, '0')}:00`);
        const maxValue = Math.max(...hourlyData, 1);

        return {
            tooltip: {
                trigger: 'axis',
                formatter: '{b}<br/>识别数量: {c} 次'
            },
            grid: {
                top: '15%',
                left: '3%',
                right: '4%',
                bottom: '10%',
                containLabel: true
            },
            xAxis: {
                type: 'category',
                data: hours,
                axisLine: {
                    lineStyle: {
                        color: '#9ca3af'
                    }
                },
                axisTick: {
                    show: false
                },
                axisLabel: {
                    color: '#9ca3af',
                    fontSize: 10,
                    interval: 2 // 每2小时显示一个标签
                }
            },
            yAxis: {
                type: 'value',
                splitLine: {
                    lineStyle: {
                        color: '#f3f4f6',
                        type: 'dashed'
                    }
                },
                axisLine: {
                    show: false
                },
                axisTick: {
                    show: false
                },
                axisLabel: {
                    color: '#9ca3af'
                }
            },
            series: [
                {
                    name: '识别次数',
                    type: 'bar',
                    data: hourlyData,
                    itemStyle: {
                        color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
                            {
                                offset: 0,
                                color: '#60a5fa'
                            },
                            {
                                offset: 1,
                                color: '#3b82f6'
                            }
                        ])
                    },
                    barWidth: '60%',
                    emphasis: {
                        itemStyle: {
                            color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
                                {
                                    offset: 0,
                                    color: '#3b82f6'
                                },
                                {
                                    offset: 1,
                                    color: '#2563eb'
                                }
                            ])
                        }
                    }
                }
            ]
        };
    };

    if (loading) return (
        <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm flex flex-col h-full">
            <div className="flex items-center gap-2 mb-4 shrink-0">
                <Clock className="text-blue-600" size={20} />
                <h3 className="font-semibold text-gray-800">小时识别分布</h3>
            </div>
            <div className="flex-1 flex items-center justify-center text-gray-400">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            </div>
        </div>
    );

    return (
        <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm flex flex-col h-full">
            <div className="flex items-center gap-2 mb-4 shrink-0">
                <Clock className="text-blue-600" size={20} />
                <h3 className="font-semibold text-gray-800">{date ? "小时识别分布" : "历史小时分布"}</h3>
            </div>

            <div className="flex-1 min-h-0">
                <ReactECharts
                    option={getOption()}
                    style={{ height: '100%', width: '100%' }}
                    opts={{ renderer: 'svg' }}
                />
            </div>
        </div>
    );
});
