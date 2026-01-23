import React, { useEffect, useState } from 'react';
import ReactECharts from 'echarts-for-react';
import * as echarts from 'echarts';
import { apiClient } from '../api/client';
import { BarChart3 } from 'lucide-react';
import { usePlateStore } from '../store/plateStore';

interface DailyStat {
    date: string;
    count: number;
}

interface DailyStatsChartProps {
    date?: string; // 可选的日期参数，undefined 表示总量模式
}

export const DailyStatsChart: React.FC<DailyStatsChartProps> = React.memo(({ date }) => {
    const [stats, setStats] = useState<DailyStat[]>([]);
    const [loading, setLoading] = useState(true);
    const { settings } = usePlateStore();

    useEffect(() => {
        const fetchStats = async () => {
            setLoading(true);
            try {
                if (settings.isDemoMode) {
                    // 生成模拟数据
                    const mockStats: DailyStat[] = [];
                    for (let i = 6; i >= 0; i--) {
                        const d = new Date();
                        d.setDate(d.getDate() - i);
                        mockStats.push({
                            date: d.toISOString().split('T')[0],
                            count: Math.floor(Math.random() * 200) + 50
                        });
                    }
                    setStats(mockStats);
                    await new Promise(resolve => setTimeout(resolve, 500)); // 模拟网络延迟
                } else {
                    if (date) {
                        // 日期模式：显示近7天趋势
                        const endDate = new Date(date).setHours(23, 59, 59, 999);
                        const data = await apiClient.getDailyStats(endDate);
                        // 后端返回的数据已经是按日期升序排列（从旧到新），直接使用
                        setStats(data);
                    } else {
                        // 总量模式：显示所有历史数据的累计趋势
                        // 获取所有数据并按日期分组统计
                        const allGroups = await apiClient.getHistory(undefined, undefined, undefined, 'plate');
                        const dateMap = new Map<string, number>();
                        
                        // 按日期统计不重复车牌数
                        (allGroups as any[]).forEach((group: any) => {
                            const dateStr = new Date(group.firstSeen).toISOString().split('T')[0];
                            if (!dateMap.has(dateStr)) {
                                dateMap.set(dateStr, 0);
                            }
                            dateMap.set(dateStr, dateMap.get(dateStr)! + 1);
                        });
                        
                        // 转换为数组并按日期排序
                        const statsArray = Array.from(dateMap.entries())
                            .map(([date, count]) => ({ date, count }))
                            .sort((a, b) => a.date.localeCompare(b.date));
                        
                        // 如果数据点太多，只显示最近30天
                        if (statsArray.length > 30) {
                            setStats(statsArray.slice(-30));
                        } else {
                            setStats(statsArray);
                        }
                    }
                }
            } catch (error) {
                console.error('加载统计数据失败', error);
                // 出错时如果是演示模式，确保有兜底数据
                if (settings.isDemoMode) {
                     setStats([]);
                }
            } finally {
                setLoading(false);
            }
        };

        fetchStats();
    }, [date, settings.isDemoMode]);

    const getOption = () => {
        return {
            tooltip: {
                trigger: 'axis',
                formatter: '{b}<br/>识别数量: {c} 辆'
            },
            grid: {
                top: '15%',
                left: '3%',
                right: '4%',
                bottom: '3%',
                containLabel: true
            },
            xAxis: {
                type: 'category',
                boundaryGap: false,
                data: stats.map(s => s.date.slice(5)), // 只显示 MM-DD
                axisLine: {
                    lineStyle: {
                        color: '#9ca3af'
                    }
                },
                axisTick: {
                    show: false
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
                    name: '识别数量',
                    type: 'line',
                    smooth: true,
                    showSymbol: false,
                    symbolSize: 8,
                    data: stats.map(s => s.count),
                    itemStyle: {
                        color: '#3b82f6'
                    },
                    lineStyle: {
                        width: 3,
                        shadowColor: 'rgba(59, 130, 246, 0.3)',
                        shadowBlur: 10,
                        shadowOffsetY: 5
                    },
                    areaStyle: {
                        color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
                            {
                                offset: 0,
                                color: 'rgba(59, 130, 246, 0.3)'
                            },
                            {
                                offset: 1,
                                color: 'rgba(59, 130, 246, 0.01)'
                            }
                        ])
                    }
                }
            ]
        };
    };

    if (loading) return (
        <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm h-full flex flex-col">
            <div className="flex items-center gap-2 mb-4">
                <BarChart3 className="text-blue-600" size={20} />
                <h3 className="font-semibold text-gray-800">{date ? "每日识别趋势 (近7天)" : "历史识别趋势"}</h3>
            </div>
            <div className="flex-1 flex items-center justify-center text-gray-400 min-h-[200px]">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            </div>
        </div>
    );

    if (stats.length === 0) return (
        <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm h-full flex flex-col">
            <div className="flex items-center gap-2 mb-4">
                <BarChart3 className="text-blue-600" size={20} />
                <h3 className="font-semibold text-gray-800">{date ? "每日识别趋势 (近7天)" : "历史识别趋势"}</h3>
            </div>
            <div className="flex-1 flex items-center justify-center text-gray-400 min-h-[200px]">暂无数据</div>
        </div>
    );

    return (
        <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm h-full flex flex-col">
            <div className="flex items-center gap-2 mb-4">
                <BarChart3 className="text-blue-600" size={20} />
                <h3 className="font-semibold text-gray-800">{date ? "每日识别趋势 (近7天)" : "历史识别趋势"}</h3>
            </div>

            <div className="flex-1 min-h-[200px]">
                <ReactECharts
                    option={getOption()}
                    style={{ height: '100%', width: '100%' }}
                    opts={{ renderer: 'svg' }}
                />
            </div>
        </div>
    );
});
