import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useCameraStore } from '../store/cameraStore';
import { MapPin, Monitor } from 'lucide-react';

declare global {
    interface Window {
        AMap: any;
    }
}

export const CameraMap: React.FC = () => {
    const mapContainerRef = useRef<HTMLDivElement>(null);
    const mapInstanceRef = useRef<any>(null);
    const markersRef = useRef<any[]>([]);
    const { cameras, selectedCameraId, selectCamera } = useCameraStore();
    const [isLoading, setIsLoading] = useState(true);
    const [mapError, setMapError] = useState<string | null>(null);

    // 加载高德地图
    useEffect(() => {
        const amapKey = import.meta.env.VITE_AMAP_KEY;
        const amapSecurityCode = import.meta.env.VITE_AMAP_SECURITY_CODE;

        if (!amapKey || amapKey === 'your_amap_api_key_here') {
            setMapError('请配置高德地图 API Key');
            setIsLoading(false);
            return;
        }

        // 配置安全密钥（如果提供）
        if (amapSecurityCode && amapSecurityCode !== 'your_amap_security_code_here') {
            (window as any)._AMapSecurityConfig = {
                securityJsCode: amapSecurityCode
            };
        }

        const initMap = () => {
            if (!mapContainerRef.current) {
                console.error('地图容器未准备好');
                setIsLoading(false);
                return;
            }

            try {
                setIsLoading(true);
                setMapError(null);

                // 计算所有摄像头位置的中心点和合适的缩放级别
                let center: [number, number] = [116.397428, 39.90923]; // 默认北京
                let zoom = 10;

                // 获取有位置信息的摄像头，并验证经纬度有效性
                const camerasWithLocation = cameras.filter(cam => {
                    if (cam.latitude === undefined || cam.longitude === undefined) return false;
                    const lat = Number(cam.latitude);
                    const lng = Number(cam.longitude);
                    // 严格验证：检查是否为有效数字且在合理范围内
                    return (
                        !isNaN(lat) && !isNaN(lng) && 
                        isFinite(lat) && isFinite(lng) &&
                        lng >= -180 && lng <= 180 &&
                        lat >= -90 && lat <= 90
                    );
                });

                if (camerasWithLocation.length > 0) {
                    const lngs = camerasWithLocation.map(c => Number(c.longitude!));
                    const lats = camerasWithLocation.map(c => Number(c.latitude!));
                    const centerLng = (Math.max(...lngs) + Math.min(...lngs)) / 2;
                    const centerLat = (Math.max(...lats) + Math.min(...lats)) / 2;
                    center = [centerLng, centerLat];

                    // 根据位置范围计算合适的缩放级别
                    const lngRange = Math.max(...lngs) - Math.min(...lngs);
                    const latRange = Math.max(...lats) - Math.min(...lats);
                    const maxRange = Math.max(lngRange, latRange);
                    
                    if (maxRange > 1) zoom = 6;
                    else if (maxRange > 0.5) zoom = 8;
                    else if (maxRange > 0.1) zoom = 10;
                    else if (maxRange > 0.05) zoom = 12;
                    else zoom = 14;
                }

                // 初始化地图
                const map = new window.AMap.Map(mapContainerRef.current, {
                    zoom: zoom,
                    center: center,
                    mapStyle: 'amap://styles/normal',
                    viewMode: '2D'
                });

                mapInstanceRef.current = map;

                // 等待地图加载完成
                map.on('complete', () => {
                    console.log('地图加载完成');
                    setIsLoading(false);
                    // 延迟一下再更新标记，确保地图完全加载
                    setTimeout(() => {
                        if (mapInstanceRef.current && window.AMap && mapContainerRef.current) {
                            // 确保地图容器有尺寸
                            const rect = mapContainerRef.current.getBoundingClientRect();
                            if (rect.width > 0 && rect.height > 0) {
                                updateMarkers();
                            } else {
                                console.warn('地图容器尺寸无效，延迟更新标记');
                                setTimeout(() => updateMarkers(), 200);
                            }
                        }
                    }, 200);
                });

                // 地图加载错误处理
                map.on('error', (e: any) => {
                    console.error('地图加载错误:', e);
                    setMapError('地图加载失败，请检查API Key配置');
                    setIsLoading(false);
                });

            } catch (error) {
                console.error('初始化地图失败:', error);
                setMapError('初始化地图失败: ' + (error as Error).message);
                setIsLoading(false);
            }
        };

        // 检查是否已经加载了高德地图
        if (window.AMap) {
            setTimeout(() => {
                initMap();
            }, 100);
        } else {
            // 检查是否已经有脚本在加载
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
                script.src = `https://webapi.amap.com/maps?v=2.0&key=${amapKey}&callback=initCameraMap`;
                script.async = true;
                script.defer = true;

                script.onerror = () => {
                    console.error('加载高德地图脚本失败');
                    setMapError('加载高德地图失败');
                    setIsLoading(false);
                };

                (window as any).initCameraMap = () => {
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
                    delete (window as any).initCameraMap;
                };
            }
        }
    }, []);

    // 更新地图标记
    const updateMarkers = useCallback(() => {
        if (!mapInstanceRef.current || !window.AMap) return;

        // 获取当前有位置信息的摄像头，并验证经纬度有效性
        const camerasWithLocation = cameras.filter(cam => {
            if (cam.latitude === undefined || cam.longitude === undefined) return false;
            const lat = Number(cam.latitude);
            const lng = Number(cam.longitude);
            // 严格验证：检查是否为有效数字且在合理范围内
            return (
                !isNaN(lat) && !isNaN(lng) && 
                isFinite(lat) && isFinite(lng) &&
                lng >= -180 && lng <= 180 &&
                lat >= -90 && lat <= 90
            );
        });

        // 清除现有标记
        markersRef.current.forEach(marker => {
            marker.setMap(null);
        });
        markersRef.current = [];

        // 为每个有位置的摄像头创建标记
        camerasWithLocation.forEach(camera => {
            // 验证经纬度是否有效
            const lng = Number(camera.longitude);
            const lat = Number(camera.latitude);
            
            // 严格验证：检查是否为有效数字且在合理范围内
            if (
                isNaN(lng) || isNaN(lat) || 
                !isFinite(lng) || !isFinite(lat) ||
                lng < -180 || lng > 180 ||
                lat < -90 || lat > 90
            ) {
                console.warn(`摄像头 ${camera.name} 的经纬度无效:`, camera.longitude, camera.latitude);
                return;
            }
            
            const isSelected = camera.id === selectedCameraId;
            
            // 创建自定义标记内容
            const markerContent = document.createElement('div');
            markerContent.style.cssText = `
                display: flex;
                flex-direction: column;
                align-items: center;
                cursor: pointer;
            `;
            
            const iconDiv = document.createElement('div');
            iconDiv.style.cssText = `
                width: 40px;
                height: 40px;
                border-radius: 50%;
                display: flex;
                align-items: center;
                justify-content: center;
                background-color: ${isSelected ? '#2563eb' : camera.status === 'online' ? '#10b981' : '#9ca3af'};
                box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
                border: 2px solid white;
                position: relative;
            `;
            
            // 创建SVG图标
            const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
            svg.setAttribute('width', '20');
            svg.setAttribute('height', '20');
            svg.setAttribute('viewBox', '0 0 24 24');
            const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
            path.setAttribute('d', 'M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z');
            path.setAttribute('fill', 'white');
            svg.appendChild(path);
            iconDiv.appendChild(svg);
            
            // 选中状态指示器
            if (isSelected) {
                const indicator = document.createElement('div');
                indicator.style.cssText = `
                    position: absolute;
                    top: -4px;
                    right: -4px;
                    width: 16px;
                    height: 16px;
                    background-color: #2563eb;
                    border-radius: 50%;
                    border: 2px solid white;
                `;
                iconDiv.appendChild(indicator);
            }
            
            markerContent.appendChild(iconDiv);
            
            // 名称标签
            const labelDiv = document.createElement('div');
            labelDiv.textContent = camera.name;
            labelDiv.style.cssText = `
                margin-top: 4px;
                padding: 2px 8px;
                background-color: white;
                border-radius: 4px;
                box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
                font-size: 12px;
                font-weight: 500;
                color: #374151;
                white-space: nowrap;
                max-width: 120px;
                overflow: hidden;
                text-overflow: ellipsis;
            `;
            markerContent.appendChild(labelDiv);

            // 创建标记
            try {
                // 再次验证经纬度（防止在创建过程中变成无效值）
                if (isNaN(lng) || isNaN(lat) || !isFinite(lng) || !isFinite(lat)) {
                    console.warn(`摄像头 ${camera.name} 的经纬度在创建标记时无效`);
                    return;
                }

                const marker = new window.AMap.Marker({
                    position: [lng, lat],
                    content: markerContent,
                    // 移除 offset 参数，使用默认值，避免 NaN 错误
                    zIndex: isSelected ? 100 : 10
                });

                // 添加点击事件
                marker.on('click', () => {
                    selectCamera(camera.id);
                });

                marker.setMap(mapInstanceRef.current);
                markersRef.current.push(marker);
            } catch (error) {
                console.error(`创建摄像头 ${camera.name} 的标记失败:`, error, {
                    lng,
                    lat,
                    camera: camera.name
                });
            }
        });

        // 如果有摄像头，调整地图视野以包含所有标记
        if (camerasWithLocation.length > 0 && mapInstanceRef.current) {
            try {
                const bounds = new window.AMap.Bounds();
                let validCount = 0;
                
                camerasWithLocation.forEach(camera => {
                    const lng = Number(camera.longitude!);
                    const lat = Number(camera.latitude!);
                    // 严格验证经纬度
                    if (
                        !isNaN(lng) && !isNaN(lat) && 
                        isFinite(lng) && isFinite(lat) &&
                        lng >= -180 && lng <= 180 &&
                        lat >= -90 && lat <= 90
                    ) {
                        bounds.extend([lng, lat]);
                        validCount++;
                    }
                });
                
                // 只有当有有效位置时才调整视野
                if (validCount > 0 && bounds.getSouthWest() && bounds.getNorthEast()) {
                    const sw = bounds.getSouthWest();
                    const ne = bounds.getNorthEast();
                    // 再次验证边界点是否有效
                    if (sw && ne && 
                        !isNaN(sw.lng) && !isNaN(sw.lat) && 
                        !isNaN(ne.lng) && !isNaN(ne.lat)) {
                        mapInstanceRef.current.setBounds(bounds, false, [20, 20, 20, 20]);
                    }
                }
            } catch (error) {
                console.error('调整地图视野失败:', error);
            }
        }
    }, [cameras, selectedCameraId, selectCamera]);

    // 当摄像头列表或选中状态变化时更新标记
    useEffect(() => {
        if (mapInstanceRef.current && window.AMap && !isLoading) {
            updateMarkers();
        }
    }, [updateMarkers, isLoading]);

    if (mapError) {
        return (
            <div className="w-full h-full flex items-center justify-center bg-gray-50 rounded-lg">
                <div className="text-center text-gray-500">
                    <MapPin size={32} className="mx-auto mb-2 text-gray-400" />
                    <p className="text-sm">{mapError}</p>
                </div>
            </div>
        );
    }

    // 获取有位置信息的摄像头，并验证经纬度有效性
    const camerasWithLocation = cameras.filter(cam => {
        if (cam.latitude === undefined || cam.longitude === undefined) return false;
        const lat = Number(cam.latitude);
        const lng = Number(cam.longitude);
        // 严格验证：检查是否为有效数字且在合理范围内
        return (
            !isNaN(lat) && !isNaN(lng) && 
            isFinite(lat) && isFinite(lng) &&
            lng >= -180 && lng <= 180 &&
            lat >= -90 && lat <= 90
        );
    });

    if (camerasWithLocation.length === 0) {
        return (
            <div className="w-full h-full flex items-center justify-center bg-gray-50 rounded-lg">
                <div className="text-center text-gray-500">
                    <Monitor size={32} className="mx-auto mb-2 text-gray-400" />
                    <p className="text-sm">暂无摄像头位置信息</p>
                    <p className="text-xs text-gray-400 mt-1">请为摄像头设置位置信息</p>
                </div>
            </div>
        );
    }

    return (
        <div className="w-full h-full relative rounded-lg overflow-hidden border border-gray-200">
            {isLoading && (
                <div className="absolute inset-0 flex items-center justify-center bg-gray-100 z-10">
                    <div className="text-center">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2"></div>
                        <p className="text-sm text-gray-500">地图加载中...</p>
                    </div>
                </div>
            )}
            <div ref={mapContainerRef} className="w-full h-full" />
            
            {/* 图例 */}
            <div className="absolute bottom-4 left-4 bg-white rounded-lg shadow-lg p-3 text-xs border border-gray-200 z-10">
                <div className="font-medium text-gray-700 mb-2">图例</div>
                <div className="space-y-1">
                    <div className="flex items-center gap-2">
                        <div className="w-4 h-4 rounded-full bg-green-500"></div>
                        <span>在线</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="w-4 h-4 rounded-full bg-gray-400"></div>
                        <span>离线</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="w-4 h-4 rounded-full bg-blue-600"></div>
                        <span>当前选中</span>
                    </div>
                </div>
            </div>
        </div>
    );
};
