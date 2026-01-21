import React, { useEffect, useState } from 'react';
import ReactECharts from 'echarts-for-react';
import * as echarts from 'echarts';
import { apiClient } from '../api/client';
import { Map, Calendar, Database } from 'lucide-react';

const PROVINCE_MAP: Record<string, string> = {
    '京': '北京市', '津': '天津市', '沪': '上海市', '渝': '重庆市',
    '冀': '河北省', '豫': '河南省', '云': '云南省', '辽': '辽宁省',
    '黑': '黑龙江省', '湘': '湖南省', '皖': '安徽省', '鲁': '山东省',
    '新': '新疆维吾尔自治区', '苏': '江苏省', '浙': '浙江省', '赣': '江西省',
    '鄂': '湖北省', '桂': '广西壮族自治区', '甘': '甘肃省', '晋': '山西省',
    '蒙': '内蒙古自治区', '陕': '陕西省', '吉': '吉林省', '闽': '福建省',
    '贵': '贵州省', '粤': '广东省', '青': '青海省', '藏': '西藏自治区',
    '川': '四川省', '宁': '宁夏回族自治区', '琼': '海南省'
};

interface PlateHeatmapProps {
    date: string;
}

export const PlateHeatmap: React.FC<PlateHeatmapProps> = ({ date }) => {
    const [viewMode, setViewMode] = useState<'daily' | 'total'>('total');
    const [mapData, setMapData] = useState<{ name: string, value: number }[]>([]);
    const [loading, setLoading] = useState(true);
    const [geoJsonLoaded, setGeoJsonLoaded] = useState(false);

    useEffect(() => {
        // 加载中国地图 GeoJSON
        const loadMap = async () => {
            try {
                if (!echarts.getMap('china')) {
                    const response = await fetch('https://geo.datav.aliyun.com/areas_v3/bound/100000_full.json');
                    const geoJson = await response.json();
                    echarts.registerMap('china', geoJson);
                    setGeoJsonLoaded(true);
                } else {
                    setGeoJsonLoaded(true);
                }
            } catch (error) {
                console.error("加载地图数据失败", error);
            }
        };
        loadMap();
    }, []);

    useEffect(() => {
        const fetchData = async () => {
            try {
                setLoading(true);
                const timestamp = new Date(date).getTime();
                const stats = await apiClient.getRegionStats(viewMode, timestamp);
                // stats 格式为 [{province: '苏', count: 10}, ...]

                const formattedData = stats.map((item: any) => ({
                    name: PROVINCE_MAP[item.province] || item.province,
                    value: item.count
                }));

                setMapData(formattedData);
            } catch (error) {
                console.error("获取区域统计失败", error);
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, [viewMode, date]);

    const getOption = () => {
        const maxVal = Math.max(...mapData.map(d => d.value), 10); // 如果为空，默认最大值为 10

        return {
            tooltip: {
                trigger: 'item',
                formatter: '{b}<br/>识别数量: {c} 辆'
            },
            visualMap: {
                min: 0,
                max: maxVal,
                left: 'left',
                top: 'bottom',
                text: ['高', '低'],
                calculable: true,
                inRange: {
                    color: ['#e0f3f8', '#ffffbf', '#fee090', '#fdae61', '#f46d43', '#d73027', '#a50026']
                }
            },
            series: [
                {
                    name: '车牌归属地',
                    type: 'map',
                    map: 'china',
                    roam: true,
                    emphasis: {
                        label: {
                            show: true
                        },
                        itemStyle: {
                            areaColor: '#fbbf24' // 悬停时显示黄色
                        }
                    },
                    data: mapData,
                    itemStyle: {
                        areaColor: '#f3f4f6',
                        borderColor: '#9ca3af'
                    }
                }
            ]
        };
    };

    return (
        <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm h-full flex flex-col">
            <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
                    <Map size={20} className="text-blue-600" />
                    车牌归属地热力图
                </h3>
                <div className="flex bg-gray-100 p-1 rounded-lg">
                    <button
                        onClick={() => setViewMode('daily')}
                        className={`px-3 py-1 text-sm rounded-md transition-all flex items-center gap-1 ${viewMode === 'daily'
                            ? 'bg-white text-blue-600 shadow-sm font-medium'
                            : 'text-gray-500 hover:text-gray-700'
                            }`}
                    >
                        <Calendar size={14} />
                        {date === new Date().toISOString().split('T')[0] ? '今日数据' : '选中日数据'}
                    </button>
                    <button
                        onClick={() => setViewMode('total')}
                        className={`px-3 py-1 text-sm rounded-md transition-all flex items-center gap-1 ${viewMode === 'total'
                            ? 'bg-white text-blue-600 shadow-sm font-medium'
                            : 'text-gray-500 hover:text-gray-700'
                            }`}
                    >
                        <Database size={14} />
                        历史总量
                    </button>
                </div>
            </div>

            <div className="flex-1 min-h-[400px] relative">
                {loading || !geoJsonLoaded ? (
                    <div className="absolute inset-0 flex items-center justify-center bg-gray-50/50">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                    </div>
                ) : (
                    <ReactECharts
                        option={getOption()}
                        style={{ height: '100%', width: '100%' }}
                        opts={{ renderer: 'svg' }}
                    />
                )}
            </div>
        </div>
    );
};
