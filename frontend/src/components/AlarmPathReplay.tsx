import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Alarm } from '../store/alarmStore';
import { useCameraStore } from '../store/cameraStore';
import { apiClient } from '../api/client';
import { X, MapPin, Clock, Play, Pause } from 'lucide-react';

declare global {
    interface Window {
        AMap: any;
    }
}

interface AlarmPathReplayProps {
    plateNumber: string;
    alarms: Alarm[];
    onClose: () => void;
}

interface PathPoint {
    lng: number;
    lat: number;
    address: string;
    timestamp: number;
    alarmId: number;
    severity: 'high' | 'medium' | 'low';
}

export const AlarmPathReplay: React.FC<AlarmPathReplayProps> = ({ plateNumber, alarms, onClose }) => {
    const mapContainerRef = useRef<HTMLDivElement>(null);
    const mapInstanceRef = useRef<any>(null);
    const markersRef = useRef<any[]>([]);
    const polylineRef = useRef<any>(null);
    const geocoderRef = useRef<any>(null);
    const mapInitializedRef = useRef<boolean>(false);
    const processingRef = useRef<boolean>(false);
    const { cameras } = useCameraStore();
    const [allCameras, setAllCameras] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [pathPoints, setPathPoints] = useState<PathPoint[]>([]);
    const [isPlaying, setIsPlaying] = useState(false);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [mapError, setMapError] = useState<string | null>(null);

    // 防抖算法：处理相同地点多次出现的情况
    const deduplicatePathPoints = useCallback((points: PathPoint[]): PathPoint[] => {
        if (points.length === 0) return [];

        const result: PathPoint[] = [];
        const TIME_WINDOW = 10 * 60 * 1000; // 10分钟时间窗口
        const DISTANCE_THRESHOLD = 0.001; // 约100米的经纬度差值

        for (let i = 0; i < points.length; i++) {
            const currentPoint = points[i];
            
            // 检查是否与上一个点太近（时间和距离）
            if (result.length > 0) {
                const lastPoint = result[result.length - 1];
                const timeDiff = currentPoint.timestamp - lastPoint.timestamp;
                const distance = Math.sqrt(
                    Math.pow(currentPoint.lng - lastPoint.lng, 2) + 
                    Math.pow(currentPoint.lat - lastPoint.lat, 2)
                );

                // 如果时间间隔小于10分钟且距离小于阈值，跳过这个点
                if (timeDiff < TIME_WINDOW && distance < DISTANCE_THRESHOLD) {
                    continue;
                }
            }

            result.push(currentPoint);
        }

        return result;
    }, []);

    // 解析位置信息：支持多种格式
    const parseLocation = useCallback(async (location: string): Promise<{ lng: number; lat: number } | null> => {
        if (!location) return null;

        // 1. 检查是否是坐标格式（"lng,lat" 或 "lat,lng"）
        const coordMatch = location.match(/^([+-]?\d+\.?\d*),([+-]?\d+\.?\d*)$/);
        if (coordMatch) {
            const coord1 = Number(parseFloat(coordMatch[1]));
            const coord2 = Number(parseFloat(coordMatch[2]));
            // 判断是 "lng,lat" 还是 "lat,lng"（中国范围内，经度通常 > 纬度）
            if (!isNaN(coord1) && !isNaN(coord2) && isFinite(coord1) && isFinite(coord2)) {
                if (coord1 > 70 && coord1 < 140 && coord2 > 10 && coord2 < 60) {
                    return { lng: coord1, lat: coord2 };
                } else if (coord2 > 70 && coord2 < 140 && coord1 > 10 && coord1 < 60) {
                    return { lng: coord2, lat: coord1 };
                }
            }
        }

        // 2. 尝试从摄像头信息中匹配（通过位置文本匹配）
        // 优先精确匹配
        let matchedCamera = allCameras.find(cam => 
            cam.location && cam.location === location && 
            cam.latitude && cam.longitude
        );
        
        // 如果没有精确匹配，尝试部分匹配（包含关系）
        if (!matchedCamera) {
            matchedCamera = allCameras.find(cam => 
                cam.location && location.includes(cam.location) && 
                cam.latitude && cam.longitude
            );
        }
        
        // 如果还是没有，尝试反向匹配（摄像头位置包含告警位置）
        if (!matchedCamera) {
            matchedCamera = allCameras.find(cam => 
                cam.location && cam.location.includes(location) && 
                cam.latitude && cam.longitude
            );
        }
        
        if (matchedCamera && matchedCamera.longitude && matchedCamera.latitude) {
            const lng = Number(matchedCamera.longitude);
            const lat = Number(matchedCamera.latitude);
            if (!isNaN(lng) && !isNaN(lat) && isFinite(lng) && isFinite(lat) &&
                lng >= -180 && lng <= 180 && lat >= -90 && lat <= 90) {
                console.log(`从摄像头匹配到位置: ${location} -> (${lng}, ${lat})`);
                return { lng: lng, lat: lat };
            }
        }

        // 3. 如果都没有，进行地理编码
        if (!window.AMap) {
            console.warn('高德地图未加载');
            return null;
        }

        return new Promise((resolve) => {
            try {
                // 使用 PlaceSearch 进行地点搜索（更可靠）
                if (!window.AMap.PlaceSearch) {
                    // 如果 PlaceSearch 未加载，使用 Geocoder
                    if (!geocoderRef.current) {
                        console.warn('地理编码器未初始化');
                        resolve(null);
                        return;
                    }

                    // 使用 Geocoder 的地理编码方法
                    geocoderRef.current.getLocation(location, (status: string, result: any) => {
                        if (status === 'complete' && result && result.geocodes && result.geocodes.length > 0) {
                            const loc = result.geocodes[0].location;
                            const lng = Number(loc.lng);
                            const lat = Number(loc.lat);
                            // 验证坐标有效性
                            if (!isNaN(lng) && !isNaN(lat) && isFinite(lng) && isFinite(lat) &&
                                lng >= -180 && lng <= 180 && lat >= -90 && lat <= 90) {
                                resolve({ lng: lng, lat: lat });
                            } else {
                                console.warn(`地理编码返回无效坐标: ${location}`, { lng, lat });
                                resolve(null);
                            }
                        } else {
                            console.warn(`地理编码失败: ${location}`, status);
                            resolve(null);
                        }
                    });
                } else {
                    // 使用 PlaceSearch 搜索地点
                    const placeSearch = new window.AMap.PlaceSearch({
                        city: '全国',
                        citylimit: false,
                        pageSize: 1
                    });

                    placeSearch.search(location, (status: string, result: any) => {
                        if (status === 'complete' && result && result.poiList && result.poiList.pois && result.poiList.pois.length > 0) {
                            const poi = result.poiList.pois[0];
                            const lng = Number(poi.location.lng);
                            const lat = Number(poi.location.lat);
                            // 验证坐标有效性
                            if (!isNaN(lng) && !isNaN(lat) && isFinite(lng) && isFinite(lat) &&
                                lng >= -180 && lng <= 180 && lat >= -90 && lat <= 90) {
                                resolve({ lng: lng, lat: lat });
                            } else {
                                console.warn(`地点搜索返回无效坐标: ${location}`, { lng, lat });
                                resolve(null);
                            }
                        } else {
                            console.warn(`地点搜索失败: ${location}`, status);
                            resolve(null);
                        }
                    });
                }
            } catch (error) {
                console.error('地理编码异常:', error);
                resolve(null);
            }
        });
    }, [allCameras]);

    // 处理告警数据，提取路径点
    const processAlarms = useCallback(async () => {
        // 防止重复处理
        if (processingRef.current) {
            console.log('正在处理中，跳过重复调用');
            return;
        }
        processingRef.current = true;
        
        try {
            // 1. 按时间排序（从早到晚），并过滤有效位置信息
            const sortedAlarms = [...alarms]
            .filter(alarm => {
                // 过滤掉无效的位置信息
                if (!alarm.location) return false;
                // 过滤掉文件名（包含 .mp4, .jpg 等扩展名）
                if (/\.(mp4|jpg|jpeg|png|gif|bmp|webp|avi|mov|wmv|flv|mkv)$/i.test(alarm.location)) {
                    return false;
                }
                // 过滤掉纯数字或过短的位置信息
                if (/^\d+$/.test(alarm.location) || alarm.location.length < 3) {
                    return false;
                }
                return true;
            })
            .sort((a, b) => a.timestamp - b.timestamp);

        if (sortedAlarms.length === 0) {
            setMapError('没有包含位置信息的告警记录');
            setIsLoading(false);
            return;
        }

        // 2. 解析所有位置
        const points: PathPoint[] = [];
        let successCount = 0;
        let failCount = 0;
        
        for (const alarm of sortedAlarms) {
            let location: { lng: number; lat: number } | null = null;
            
            // 优先使用告警表中保存的经纬度
            if (alarm.longitude !== undefined && alarm.latitude !== undefined) {
                const lng = Number(alarm.longitude);
                const lat = Number(alarm.latitude);
                if (!isNaN(lng) && !isNaN(lat) &&
                    isFinite(lng) && isFinite(lat) &&
                    lng >= -180 && lng <= 180 &&
                    lat >= -90 && lat <= 90) {
                    location = { lng: lng, lat: lat };
                    console.log(`使用告警表中的坐标: (${lng}, ${lat})`);
                }
            } 
            // 如果没有保存的坐标，尝试解析位置文本
            else if (alarm.location) {
                location = await parseLocation(alarm.location);
            }
            
            // 验证坐标是否有效（不是 NaN 且在合理范围内），并确保是数字类型
            if (location) {
                const lng = Number(location.lng);
                const lat = Number(location.lat);
                
                if (!isNaN(lng) && !isNaN(lat) &&
                    isFinite(lng) && isFinite(lat) &&
                    lng >= -180 && lng <= 180 &&
                    lat >= -90 && lat <= 90) {
                    points.push({
                        lng: lng,  // 确保是数字类型
                        lat: lat,  // 确保是数字类型
                        address: alarm.location || '未知位置',
                        timestamp: alarm.timestamp,
                        alarmId: alarm.id,
                        severity: alarm.severity
                    });
                    successCount++;
                } else {
                    failCount++;
                    console.warn(`无法解析位置: ${alarm.location || '无位置信息'}`, { lng, lat, original: location });
                }
            } else {
                failCount++;
                console.warn(`无法解析位置: ${alarm.location || '无位置信息'}`);
            }
        }
        
        console.log(`位置解析完成: 成功 ${successCount} 个, 失败 ${failCount} 个`);

        if (points.length === 0) {
            setMapError('无法解析任何位置信息');
            setIsLoading(false);
            return;
        }

            // 3. 应用防抖算法
            const deduplicatedPoints = deduplicatePathPoints(points);
            setPathPoints(deduplicatedPoints);
            setIsLoading(false);
        } finally {
            processingRef.current = false;
        }
    }, [alarms, parseLocation, deduplicatePathPoints]);

    // 加载摄像头列表（用于匹配位置）
    useEffect(() => {
        const fetchCameras = async () => {
            try {
                const response = await apiClient.fetch('/api/cameras');
                if (response.ok) {
                    const camerasList = await response.json();
                    setAllCameras(camerasList);
                } else {
                    // 如果API失败，使用本地存储的摄像头信息
                    setAllCameras(cameras);
                }
            } catch (error) {
                console.warn('获取摄像头列表失败，将使用本地存储的摄像头信息:', error);
                // 如果API失败，使用本地存储的摄像头信息
                setAllCameras(cameras);
            }
        };
        fetchCameras();
    }, [cameras]);

    // 加载高德地图
    useEffect(() => {
        const amapKey = import.meta.env.VITE_AMAP_KEY;
        const amapSecurityCode = import.meta.env.VITE_AMAP_SECURITY_CODE;

        if (!amapKey || amapKey === 'your_amap_api_key_here') {
            setMapError('请配置高德地图 API Key');
            setIsLoading(false);
            return;
        }

        if (amapSecurityCode && amapSecurityCode !== 'your_amap_security_code_here') {
            (window as any)._AMapSecurityConfig = {
                securityJsCode: amapSecurityCode
            };
        }

        const initMap = () => {
            if (!mapContainerRef.current) return;
            
            // 防止重复初始化
            if (mapInitializedRef.current) {
                console.log('地图已初始化，跳过重复初始化');
                return;
            }

            try {
                // 初始化地图（先创建地图实例）
                const map = new window.AMap.Map(mapContainerRef.current, {
                    zoom: 13,
                    center: [116.397428, 39.90923], // 默认北京，后续会根据路径点调整
                    mapStyle: 'amap://styles/normal',
                    viewMode: '3D'
                });

                mapInstanceRef.current = map;
                mapInitializedRef.current = true;
                
                // 等待地图完全加载
                const onMapReady = () => {
                    console.log('地图加载完成');
                    // 加载地理编码和地点搜索插件
                    window.AMap.plugin(['AMap.Geocoder', 'AMap.PlaceSearch'], () => {
                        try {
                            // 初始化地理编码器（用于备用）
                            geocoderRef.current = new window.AMap.Geocoder({
                                city: '全国',
                                timeout: 5000
                            });
                            
                            // 插件加载完成后处理数据（只处理一次）
                            if (!processingRef.current) {
                                setTimeout(() => {
                                    processAlarms();
                                }, 500);
                            }
                        } catch (error) {
                            console.error('创建地理编码器失败:', error);
                            setMapError('创建地理编码器失败');
                            setIsLoading(false);
                        }
                    });
                };
                
                // 监听地图加载完成事件
                map.on('complete', onMapReady);
                
                // 如果地图已经加载完成，直接执行
                setTimeout(() => {
                    try {
                        const size = map.getSize();
                        if (size && size.width > 0 && size.height > 0) {
                            console.log('地图已就绪');
                            onMapReady();
                        }
                    } catch (e) {
                        // 如果检查失败，等待 complete 事件
                        console.log('等待地图 complete 事件');
                    }
                }, 100);
            } catch (error) {
                console.error('初始化地图失败:', error);
                setMapError('初始化地图失败');
                setIsLoading(false);
            }
        };

        // 检查是否已经加载了高德地图
        if (window.AMap) {
            setTimeout(() => {
                initMap();
            }, 100);
        } else {
            if (document.querySelector(`script[src*="webapi.amap.com"]`)) {
                const checkAMap = setInterval(() => {
                    if (window.AMap) {
                        clearInterval(checkAMap);
                        setTimeout(() => {
                            initMap();
                        }, 100);
                    }
                }, 100);

                setTimeout(() => {
                    clearInterval(checkAMap);
                    if (!window.AMap) {
                        setMapError('高德地图加载超时');
                        setIsLoading(false);
                    }
                }, 10000);

                return () => clearInterval(checkAMap);
            } else {
                const script = document.createElement('script');
                script.src = `https://webapi.amap.com/maps?v=2.0&key=${amapKey}&callback=initPathReplayMap`;
                script.async = true;
                script.defer = true;

                script.onerror = () => {
                    console.error('加载高德地图脚本失败');
                    setMapError('加载高德地图失败');
                    setIsLoading(false);
                };

                (window as any).initPathReplayMap = () => {
                    console.log('高德地图脚本加载完成');
                    setTimeout(() => {
                        initMap();
                    }, 100);
                };

                document.head.appendChild(script);

                return () => {
                    if (document.head.contains(script)) {
                        document.head.removeChild(script);
                    }
                    delete (window as any).initPathReplayMap;
                    mapInitializedRef.current = false;
                    mapInstanceRef.current = null;
                };
            }
        }
    }, []); // 移除 processAlarms 依赖，避免重复初始化

    // 绘制路径
    const drawPath = useCallback(() => {
        if (!mapInstanceRef.current || !window.AMap || pathPoints.length === 0) {
            console.warn('地图未初始化或没有路径点');
            return;
        }
        
        // 检查地图是否完全加载
        if (!mapInstanceRef.current.getSize || !mapInstanceRef.current.getSize()) {
            console.warn('地图容器尺寸未就绪，延迟绘制');
            setTimeout(() => drawPath(), 100);
            return;
        }

        // 验证所有坐标点是否有效，并确保是数字类型
        const validPoints = pathPoints
            .map(p => ({
                ...p,
                lng: typeof p.lng === 'number' ? p.lng : parseFloat(String(p.lng)),
                lat: typeof p.lat === 'number' ? p.lat : parseFloat(String(p.lat))
            }))
            .filter(p => {
                const lng = Number(p.lng);
                const lat = Number(p.lat);
                return !isNaN(lng) && !isNaN(lat) &&
                    isFinite(lng) && isFinite(lat) &&
                    lng >= -180 && lng <= 180 &&
                    lat >= -90 && lat <= 90;
            })
            .map(p => ({
                ...p,
                lng: Number(p.lng),
                lat: Number(p.lat)
            }));

        if (validPoints.length === 0) {
            console.warn('没有有效的路径点');
            setMapError('没有有效的路径点可以显示');
            return;
        }
        
        console.log(`准备绘制 ${validPoints.length} 个有效路径点`);

        // 清除之前的标记和路径
        markersRef.current.forEach(marker => marker.setMap(null));
        markersRef.current = [];
        if (polylineRef.current) {
            polylineRef.current.setMap(null);
        }

        // 绘制路径线 - 确保坐标是数字数组，并再次严格验证
        const path: [number, number][] = [];
        for (const p of validPoints) {
            const lng = Number(p.lng);
            const lat = Number(p.lat);
            // 最终验证：必须是有效数字且在合理范围内
            if (typeof lng === 'number' && typeof lat === 'number' &&
                !isNaN(lng) && !isNaN(lat) &&
                isFinite(lng) && isFinite(lat) &&
                lng >= -180 && lng <= 180 &&
                lat >= -90 && lat <= 90) {
                path.push([lng, lat]);
            } else {
                console.error('路径点坐标无效，跳过:', { lng, lat, original: p });
            }
        }
        
        if (path.length === 0) {
            console.error('没有有效的路径坐标');
            setMapError('无法绘制路径：所有坐标都无效');
            return;
        }
        
        // 验证 path 数组中的每个坐标
        const finalPath = path.filter((coord) => {
            const [lng, lat] = coord;
            const isValid = typeof lng === 'number' && typeof lat === 'number' &&
                !isNaN(lng) && !isNaN(lat) &&
                isFinite(lng) && isFinite(lat);
            if (!isValid) {
                console.error('路径坐标验证失败:', coord);
            }
            return isValid;
        }) as [number, number][];
        
        if (finalPath.length === 0) {
            console.error('最终验证后没有有效的路径坐标');
            setMapError('无法绘制路径：所有坐标都无效');
            return;
        }
        
        console.log(`准备创建路径线，包含 ${finalPath.length} 个有效坐标点`);
        
        // 创建标记的函数（带重试次数限制）
        const createMarkers = (points: typeof validPoints, retryCount = 0) => {
            const MAX_RETRIES = 5; // 最多重试5次
            
            if (!mapInstanceRef.current || points.length === 0) {
                console.warn('地图未初始化或没有有效点');
                return;
            }
            
            // 检查重试次数
            if (retryCount >= MAX_RETRIES) {
                console.error('创建标记失败：已达到最大重试次数');
                return;
            }
            
            // 检查地图是否就绪（不依赖 getCenter，而是检查地图尺寸和容器）
            try {
                const mapSize = mapInstanceRef.current.getSize();
                if (!mapSize || mapSize.width === 0 || mapSize.height === 0) {
                    console.warn('地图尺寸未就绪，延迟创建标记');
                    setTimeout(() => createMarkers(points, retryCount + 1), 300);
                    return;
                }
                
                // 尝试获取中心点，但不依赖它
                try {
                    const center = mapInstanceRef.current.getCenter();
                    if (center) {
                        const centerLng = center.getLng();
                        const centerLat = center.getLat();
                        // 如果中心点有效，说明地图已就绪
                        if (!isNaN(centerLng) && !isNaN(centerLat) && 
                            isFinite(centerLng) && isFinite(centerLat)) {
                            console.log('地图已就绪，开始创建标记');
                        } else {
                            // 中心点无效，但地图尺寸有效，继续创建标记
                            console.warn('地图中心点无效，但地图尺寸有效，继续创建标记');
                        }
                    }
                } catch (e) {
                    // getCenter 失败，但地图尺寸有效，继续创建标记
                    console.warn('无法获取地图中心点，但地图尺寸有效，继续创建标记');
                }
            } catch (e) {
                console.warn('检查地图状态失败，延迟创建标记:', e);
                setTimeout(() => createMarkers(points, retryCount + 1), 300);
                return;
            }
            
            // 添加起点和终点标记
            if (points.length > 0) {
                // 起点
                const startPoint = points[0];
                // 再次验证起点坐标，确保是数字
                const startLng = Number(startPoint.lng);
                const startLat = Number(startPoint.lat);
                if (isNaN(startLng) || isNaN(startLat) || 
                    !isFinite(startLng) || !isFinite(startLat) ||
                    startLng < -180 || startLng > 180 ||
                    startLat < -90 || startLat > 90) {
                    console.error('起点坐标无效:', { lng: startLng, lat: startLat, original: startPoint });
                    return;
                }
                
                try {
                    const startMarker = new window.AMap.Marker({
                        position: [startLng, startLat],
                        icon: new window.AMap.Icon({
                    size: new window.AMap.Size(32, 32),
                    image: 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(`
                        <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32">
                            <circle cx="16" cy="16" r="12" fill="#00ff00" stroke="#fff" stroke-width="2"/>
                            <text x="16" y="20" font-size="12" fill="#fff" text-anchor="middle" font-weight="bold">起</text>
                        </svg>
                    `),
                            imageSize: new window.AMap.Size(32, 32)
                        }),
                        title: `起点: ${points[0].address}`
                    });
                    startMarker.setMap(mapInstanceRef.current);
                    markersRef.current.push(startMarker);
                } catch (error) {
                    console.error('创建起点标记失败:', error, { lng: startLng, lat: startLat });
                    return;
                }

                // 终点
                if (points.length > 1) {
                    const endPoint = points[points.length - 1];
                    // 再次验证终点坐标，确保是数字
                    const endLng = Number(endPoint.lng);
                    const endLat = Number(endPoint.lat);
                    if (isNaN(endLng) || isNaN(endLat) ||
                        !isFinite(endLng) || !isFinite(endLat) ||
                        endLng < -180 || endLng > 180 ||
                        endLat < -90 || endLat > 90) {
                        console.error('终点坐标无效:', { lng: endLng, lat: endLat, original: endPoint });
                    } else {
                        try {
                            const endMarker = new window.AMap.Marker({
                                position: [endLng, endLat],
                                icon: new window.AMap.Icon({
                        size: new window.AMap.Size(32, 32),
                        image: 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(`
                            <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32">
                                <circle cx="16" cy="16" r="12" fill="#ff0000" stroke="#fff" stroke-width="2"/>
                                <text x="16" y="20" font-size="12" fill="#fff" text-anchor="middle" font-weight="bold">终</text>
                            </svg>
                        `),
                                imageSize: new window.AMap.Size(32, 32)
                            }),
                                title: `终点: ${endPoint.address}`
                            });
                            endMarker.setMap(mapInstanceRef.current);
                            markersRef.current.push(endMarker);
                        } catch (error) {
                            console.error('创建终点标记失败:', error, { lng: endLng, lat: endLat });
                        }
                    }
                }

                // 添加中间点标记
                for (let i = 1; i < points.length - 1; i++) {
                    const point = points[i];
                    // 再次验证中间点坐标，确保是数字
                    const pointLng = Number(point.lng);
                    const pointLat = Number(point.lat);
                    if (isNaN(pointLng) || isNaN(pointLat) ||
                        !isFinite(pointLng) || !isFinite(pointLat) ||
                        pointLng < -180 || pointLng > 180 ||
                        pointLat < -90 || pointLat > 90) {
                        console.warn('中间点坐标无效，跳过:', { lng: pointLng, lat: pointLat, original: point });
                        continue;
                    }
                    const severityColor = point.severity === 'high' ? '#ff0000' : point.severity === 'medium' ? '#ff8800' : '#ffaa00';
                    
                    try {
                        const marker = new window.AMap.Marker({
                            position: [pointLng, pointLat],
                            icon: new window.AMap.Icon({
                        size: new window.AMap.Size(24, 24),
                        image: 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(`
                            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24">
                                <circle cx="12" cy="12" r="8" fill="${severityColor}" stroke="#fff" stroke-width="2"/>
                            </svg>
                        `),
                            imageSize: new window.AMap.Size(24, 24)
                        }),
                            title: `${point.address}\n时间: ${new Date(point.timestamp).toLocaleString('zh-CN')}`
                        });
                        marker.setMap(mapInstanceRef.current);
                        markersRef.current.push(marker);
                    } catch (error) {
                        console.error('创建中间点标记失败:', error, { lng: pointLng, lat: pointLat });
                        continue;
                    }
                }

                // 调整地图视野以包含所有点
                try {
                    const validCoords: [number, number][] = [];
                    points.forEach(point => {
                        // 再次验证坐标有效性，确保是数字
                        const lng = Number(point.lng);
                        const lat = Number(point.lat);
                        if (!isNaN(lng) && !isNaN(lat) &&
                            isFinite(lng) && isFinite(lat) &&
                            lng >= -180 && lng <= 180 &&
                            lat >= -90 && lat <= 90) {
                            validCoords.push([lng, lat]);
                        }
                    });
                    
                    if (validCoords.length > 0) {
                        const bounds = new window.AMap.Bounds();
                        validCoords.forEach(coord => {
                            bounds.extend(coord);
                        });
                        
                        // 验证 bounds 是否有效
                        const sw = bounds.getSouthWest();
                        const ne = bounds.getNorthEast();
                        if (sw && ne && 
                            !isNaN(sw.getLng()) && !isNaN(sw.getLat()) &&
                            !isNaN(ne.getLng()) && !isNaN(ne.getLat())) {
                            mapInstanceRef.current.setBounds(bounds, false, [50, 50, 50, 50]);
                        } else {
                            // 如果 bounds 无效，使用第一个有效点作为中心
                            const center = validCoords[0];
                            mapInstanceRef.current.setCenter(center);
                            mapInstanceRef.current.setZoom(15);
                        }
                    } else if (points.length > 0) {
                        // 如果所有坐标都无效，至少尝试设置第一个点
                        const center = points[0];
                        const centerLng = Number(center.lng);
                        const centerLat = Number(center.lat);
                        if (!isNaN(centerLng) && !isNaN(centerLat) &&
                            isFinite(centerLng) && isFinite(centerLat)) {
                            mapInstanceRef.current.setCenter([centerLng, centerLat]);
                            mapInstanceRef.current.setZoom(15);
                        }
                    }
                } catch (error) {
                    console.error('设置地图视野失败:', error);
                    // 如果设置 bounds 失败，至少设置中心点和缩放级别
                    if (points.length > 0) {
                        const center = points[0];
                        const centerLng = Number(center.lng);
                        const centerLat = Number(center.lat);
                        if (!isNaN(centerLng) && !isNaN(centerLat) &&
                            isFinite(centerLng) && isFinite(centerLat)) {
                            mapInstanceRef.current.setCenter([centerLng, centerLat]);
                            mapInstanceRef.current.setZoom(15);
                        }
                    }
                }
            }
        }; // 结束 createMarkers 函数
        
        try {
            // 确保地图实例有效
            if (!mapInstanceRef.current) {
                console.error('地图实例不存在');
                return;
            }
            
            polylineRef.current = new window.AMap.Polyline({
                path: finalPath,
                isOutline: true,
                outlineColor: '#ffeeff',
                borderWeight: 3,
                strokeColor: '#3366FF',
                strokeOpacity: 0.8,
                strokeWeight: 4,
                lineJoin: 'round',
                lineCap: 'round',
                zIndex: 50
            });

            // 先设置地图中心点和视野，确保地图投影系统就绪
            if (finalPath.length > 0) {
                try {
                    // 计算所有点的边界
                    const lngs = finalPath.map(p => p[0]);
                    const lats = finalPath.map(p => p[1]);
                    const minLng = Math.min(...lngs);
                    const maxLng = Math.max(...lngs);
                    const minLat = Math.min(...lats);
                    const maxLat = Math.max(...lats);
                    
                    // 设置地图中心为所有点的中心
                    const centerLng = (minLng + maxLng) / 2;
                    const centerLat = (minLat + maxLat) / 2;
                    
                    // 验证中心点坐标有效性
                    if (isNaN(centerLng) || isNaN(centerLat) || 
                        !isFinite(centerLng) || !isFinite(centerLat) ||
                        centerLng < -180 || centerLng > 180 ||
                        centerLat < -90 || centerLat > 90) {
                        console.error('计算的地图中心点无效:', { centerLng, centerLat });
                        // 使用第一个有效点作为中心
                        if (finalPath.length > 0) {
                            const firstPoint = finalPath[0];
                            mapInstanceRef.current.setCenter([firstPoint[0], firstPoint[1]]);
                        }
                    } else {
                        // 先设置地图中心，确保投影系统就绪
                        mapInstanceRef.current.setCenter([centerLng, centerLat]);
                    }
                    
                    // 等待地图投影系统就绪
                    setTimeout(() => {
                        try {
                            // 设置路径线
                            if (polylineRef.current && mapInstanceRef.current) {
                                polylineRef.current.setMap(mapInstanceRef.current);
                                console.log('路径线设置成功');
                            }
                            
                            // 再等待一下，确保路径线渲染完成后再创建标记
                            setTimeout(() => {
                                createMarkers(validPoints, 0);
                            }, 500);
                        } catch (error) {
                            console.error('设置路径线失败:', error);
                        }
                    }, 300);
                } catch (error) {
                    console.error('设置地图中心失败:', error);
                }
            }
        } catch (error) {
            console.error('创建路径线失败:', error);
            setMapError('创建路径线失败');
            return;
        }
    }, [pathPoints]);

    // 当路径点更新时重新绘制
    useEffect(() => {
        if (pathPoints.length > 0 && mapInstanceRef.current && window.AMap && geocoderRef.current) {
            // 验证路径点是否有效
            const hasValidPoints = pathPoints.some(p => 
                !isNaN(p.lng) && !isNaN(p.lat) &&
                p.lng >= -180 && p.lng <= 180 &&
                p.lat >= -90 && p.lat <= 90
            );
            if (hasValidPoints) {
                drawPath();
            }
        }
    }, [pathPoints, drawPath]);

    // 播放路径动画
    const playPath = useCallback(() => {
        if (pathPoints.length === 0 || !mapInstanceRef.current) return;

        // 过滤出有效的路径点
        const validPoints = pathPoints.filter(p => 
            !isNaN(p.lng) && !isNaN(p.lat) &&
            p.lng >= -180 && p.lng <= 180 &&
            p.lat >= -90 && p.lat <= 90
        );

        if (validPoints.length === 0) {
            console.warn('没有有效的路径点可以播放');
            return;
        }

        setIsPlaying(true);
        let index = 0;

        const playNext = () => {
            if (index >= validPoints.length) {
                setIsPlaying(false);
                setCurrentIndex(0);
                return;
            }

            const point = validPoints[index];
            mapInstanceRef.current.setCenter([point.lng, point.lat]);
            mapInstanceRef.current.setZoom(15);

            setCurrentIndex(index);
            index++;

            setTimeout(playNext, 2000); // 每2秒移动到下一个点
        };

        playNext();
    }, [pathPoints]);

    const pausePath = useCallback(() => {
        setIsPlaying(false);
    }, []);


    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-2 sm:p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-6xl max-h-[92dvh] sm:max-h-[90vh] flex flex-col">
                {/* Header */}
                <div className="p-4 sm:p-6 border-b border-gray-200 flex items-center justify-between shrink-0 gap-3">
                    <div>
                        <h2 className="text-xl sm:text-2xl font-bold text-gray-800 font-mono break-all">
                            {plateNumber} - 路径重现
                        </h2>
                        <p className="text-sm text-gray-500 mt-1">
                            共 {pathPoints.length} 个路径点（已去重）
                        </p>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                    >
                        <X size={20} className="text-gray-500" />
                    </button>
                </div>

                {/* Controls */}
                <div className="p-3 sm:p-4 border-b border-gray-200 flex items-center gap-3 flex-wrap shrink-0">
                    <button
                        onClick={isPlaying ? pausePath : playPath}
                        disabled={pathPoints.length === 0}
                        className="flex items-center gap-2 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {isPlaying ? <Pause size={18} /> : <Play size={18} />}
                        {isPlaying ? '暂停' : '播放'}
                    </button>
                    {isPlaying && (
                        <div className="flex items-center gap-2 text-sm text-gray-600">
                            <Clock size={16} />
                            <span>当前: {currentIndex + 1} / {pathPoints.length}</span>
                        </div>
                    )}
                </div>

                {/* Map Container */}
                <div className="flex-1 relative min-h-[280px] sm:min-h-[400px]">
                    {isLoading && (
                        <div className="absolute inset-0 flex items-center justify-center bg-gray-50 z-10">
                            <div className="text-center">
                                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
                                <p className="text-gray-600">正在加载地图和路径...</p>
                            </div>
                        </div>
                    )}
                    {mapError && (
                        <div className="absolute inset-0 flex items-center justify-center bg-gray-50 z-10">
                            <div className="text-center text-red-600">
                                <MapPin size={48} className="mx-auto mb-4 opacity-50" />
                                <p>{mapError}</p>
                            </div>
                        </div>
                    )}
                    <div ref={mapContainerRef} className="w-full h-full" style={{ minHeight: '280px' }} />
                </div>

                {/* Path Info */}
                {pathPoints.length > 0 && (
                    <div className="p-3 sm:p-4 border-t border-gray-200 shrink-0 max-h-40 overflow-y-auto">
                        <div className="flex items-center gap-2 mb-2">
                            <MapPin size={16} className="text-gray-500" />
                            <span className="text-sm font-semibold text-gray-700">路径信息</span>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2 text-xs text-gray-600">
                            <div>
                                <span className="text-gray-500">起点:</span> {pathPoints[0].address}
                            </div>
                            {pathPoints.length > 1 && (
                                <div>
                                    <span className="text-gray-500">终点:</span> {pathPoints[pathPoints.length - 1].address}
                                </div>
                            )}
                            <div>
                                <span className="text-gray-500">总点数:</span> {pathPoints.length}
                            </div>
                            <div>
                                <span className="text-gray-500">时间跨度:</span>{' '}
                                {new Date(pathPoints[0].timestamp).toLocaleDateString('zh-CN')} -{' '}
                                {new Date(pathPoints[pathPoints.length - 1].timestamp).toLocaleDateString('zh-CN')}
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};
