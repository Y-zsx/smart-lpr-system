import React, { useEffect, useRef, useState } from 'react';
import { MapPin, Search, X } from 'lucide-react';
import { useToastContext } from '../contexts/ToastContext';

interface LocationPickerProps {
    value?: {
        address: string;
        lng: number;
        lat: number;
    };
    onChange: (location: { address: string; lng: number; lat: number }) => void;
    onClose?: () => void;
}

declare global {
    interface Window {
        AMap: any;
    }
}

export const LocationPicker: React.FC<LocationPickerProps> = ({ value, onChange, onClose }) => {
    const toast = useToastContext();
    const mapContainerRef = useRef<HTMLDivElement>(null);
    const mapInstanceRef = useRef<any>(null);
    const markerRef = useRef<any>(null);
    const geocoderRef = useRef<any>(null);
    const [searchKeyword, setSearchKeyword] = useState('');
    const [searchResults, setSearchResults] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [currentAddress, setCurrentAddress] = useState(value?.address || '');
    const [isSearching, setIsSearching] = useState(false);
    const placeSearchRef = useRef<any>(null);

    // 加载高德地图
    useEffect(() => {
        const amapKey = import.meta.env.VITE_AMAP_KEY;
        const amapSecurityCode = import.meta.env.VITE_AMAP_SECURITY_CODE;
        
        if (!amapKey || amapKey === 'your_amap_api_key_here') {
            toast.warning('请配置高德地图 API Key！请在 .env 文件中设置 VITE_AMAP_KEY');
            setIsLoading(false);
            return;
        }

        // 注意：安全密钥配置将在脚本加载检查之前设置

        const initMap = () => {
            if (!mapContainerRef.current) {
                console.error('地图容器未准备好');
                setIsLoading(false);
                return;
            }

            try {
                setIsLoading(true);

                // 初始化地图
                const map = new window.AMap.Map(mapContainerRef.current, {
                    zoom: 15,
                    center: value ? [value.lng, value.lat] : [116.397428, 39.90923], // 默认北京
                    mapStyle: 'amap://styles/normal',
                    viewMode: '3D' // 使用3D视图
                });

                mapInstanceRef.current = map;

                // 等待地图加载完成
                map.on('complete', () => {
                    console.log('地图加载完成');
                    
                    // 使用插件系统加载 Geocoder 和 PlaceSearch
                    window.AMap.plugin(['AMap.Geocoder', 'AMap.PlaceSearch'], () => {
                        console.log('插件加载完成');
                        
                        // 初始化地理编码
                        geocoderRef.current = new window.AMap.Geocoder();
                        
                        // 初始化地点搜索
                        placeSearchRef.current = new window.AMap.PlaceSearch({
                            city: '全国',
                            citylimit: false,
                            pageSize: 10,
                            pageIndex: 1,
                            extensions: 'all',
                            // 添加错误处理
                            map: map,
                            panel: undefined // 不使用默认面板，我们自己处理结果
                        });

                        // 创建标记
                        if (value) {
                            const marker = new window.AMap.Marker({
                                position: [value.lng, value.lat],
                                draggable: true
                            });
                            marker.setMap(map);
                            markerRef.current = marker;

                            // 标记拖拽事件
                            marker.on('dragend', () => {
                                const position = marker.getPosition();
                                reverseGeocode(position.lng, position.lat);
                            });
                        } else {
                            // 创建可拖拽标记（不自动选择位置，等待用户操作）
                            const marker = new window.AMap.Marker({
                                position: map.getCenter(),
                                draggable: true
                            });
                            marker.setMap(map);
                            markerRef.current = marker;

                            // 标记拖拽事件
                            marker.on('dragend', () => {
                                const position = marker.getPosition();
                                reverseGeocode(position.lng, position.lat);
                            });
                            
                            // 不自动调用逆地理编码，等待用户点击地图或拖拽标记
                        }

                        // 地图点击事件
                        map.on('click', (e: any) => {
                            const { lng, lat } = e.lnglat;
                            if (markerRef.current) {
                                markerRef.current.setPosition([lng, lat]);
                            } else {
                                const marker = new window.AMap.Marker({
                                    position: [lng, lat],
                                    draggable: true
                                });
                                marker.setMap(map);
                                markerRef.current = marker;
                                marker.on('dragend', () => {
                                    const position = marker.getPosition();
                                    reverseGeocode(position.lng, position.lat);
                                });
                            }
                            reverseGeocode(lng, lat);
                        });

                        setIsLoading(false);
                    });
                });

                // 地图加载错误处理
                map.on('error', (e: any) => {
                    console.error('地图加载错误:', e);
                    toast.error('地图加载失败，请检查API Key是否正确或网络连接是否正常');
                    setIsLoading(false);
                });

            } catch (error) {
                console.error('初始化地图失败:', error);
                toast.error('初始化地图失败: ' + (error as Error).message);
                setIsLoading(false);
            }
        };

        // 确保安全密钥配置在脚本加载之前设置（如果脚本还未加载）
        if (!document.querySelector(`script[src*="webapi.amap.com"]`)) {
            // 安全密钥配置必须在脚本加载之前设置
            if (amapSecurityCode && amapSecurityCode !== 'your_amap_security_code_here') {
                (window as any)._AMapSecurityConfig = {
                    securityJsCode: amapSecurityCode
                };
                console.log('高德地图安全密钥已配置');
            } else {
                console.warn('未配置高德地图安全密钥，可能会遇到INVALID_USER_SCODE错误');
            }
        }

        // 检查是否已经加载了高德地图
        if (window.AMap) {
            // 延迟一下确保DOM已准备好
            setTimeout(() => {
                initMap();
            }, 100);
        } else {
            // 检查是否已经有脚本在加载
            if (document.querySelector(`script[src*="webapi.amap.com"]`)) {
                // 如果脚本已存在，等待它加载完成
                const checkAMap = setInterval(() => {
                    if (window.AMap) {
                        clearInterval(checkAMap);
                        setTimeout(() => {
                            initMap();
                        }, 100);
                    }
                }, 100);

                // 10秒超时
                setTimeout(() => {
                    clearInterval(checkAMap);
                    if (!window.AMap) {
                        toast.error('高德地图加载超时，请检查网络连接');
                        setIsLoading(false);
                    }
                }, 10000);

                return () => clearInterval(checkAMap);
            } else {
                const script = document.createElement('script');
                script.src = `https://webapi.amap.com/maps?v=2.0&key=${amapKey}&callback=initAMap`;
                script.async = true;
                script.defer = true;
                
                // 错误处理
                script.onerror = () => {
                    console.error('加载高德地图脚本失败');
                    toast.error('加载高德地图失败，请检查API Key是否正确');
                    setIsLoading(false);
                };
                
                (window as any).initAMap = () => {
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
                    delete (window as any).initAMap;
                };
            }
        }
    }, [value]);

    // 逆地理编码：根据经纬度获取地址
    const reverseGeocode = (lng: number, lat: number) => {
        if (!geocoderRef.current) return;

        geocoderRef.current.getAddress([lng, lat], (status: string, result: any) => {
            if (status === 'complete' && result.info === 'OK') {
                const address = result.regeocode.formattedAddress;
                setCurrentAddress(address);
                onChange({
                    address,
                    lng,
                    lat
                });
            }
        });
    };

    // 搜索地点
    const handleSearch = () => {
        if (!searchKeyword.trim()) {
            setSearchResults([]);
            return;
        }

        if (!placeSearchRef.current) {
            // 如果PlaceSearch还没初始化，先加载插件
            if (!window.AMap) {
                console.warn('高德地图未加载');
                return;
            }
            
            window.AMap.plugin('AMap.PlaceSearch', () => {
                placeSearchRef.current = new window.AMap.PlaceSearch({
                    city: '全国',
                    citylimit: false,
                    pageSize: 10,
                    pageIndex: 1,
                    extensions: 'all',
                    map: mapInstanceRef.current,
                    panel: undefined
                });
                performSearch();
            });
        } else {
            performSearch();
        }
    };

    // 执行搜索
    const performSearch = () => {
        if (!placeSearchRef.current || !searchKeyword.trim()) {
            setSearchResults([]);
            return;
        }

        setIsSearching(true);
        setSearchResults([]);

        try {
            placeSearchRef.current.search(searchKeyword, (status: string, result: any) => {
                setIsSearching(false);
                console.log('搜索状态:', status, result);
                
                if (status === 'complete' && result) {
                    // 检查是否有错误信息
                    if (result.info === 'OK' && result.poiList && result.poiList.pois && result.poiList.pois.length > 0) {
                        const pois = result.poiList.pois;
                        console.log('找到', pois.length, '个结果');
                        setSearchResults(pois);
                    } else if (result.info && result.info !== 'OK') {
                        // 处理API错误
                        console.error('搜索API错误:', result.info, result.infocode);
                        if (result.info === 'INVALID_USER_SCODE') {
                            console.warn('API Key可能需要配置安全密钥，或检查API Key是否正确启用了Web服务');
                        }
                        setSearchResults([]);
                    } else {
                        console.log('未找到结果');
                        setSearchResults([]);
                    }
                } else if (status === 'error') {
                    // 处理错误状态
                    console.error('搜索失败:', status, result);
                    if (result && result.info === 'INVALID_USER_SCODE') {
                        console.warn('API Key配置问题，请检查高德地图控制台设置');
                    }
                    setSearchResults([]);
                } else {
                    console.warn('搜索失败:', status, result);
                    setSearchResults([]);
                }
            });
        } catch (error) {
            console.error('搜索出错:', error);
            setIsSearching(false);
            setSearchResults([]);
        }
    };

    // 选择搜索结果
    const selectSearchResult = (poi: any) => {
        console.log('选择POI:', poi);
        const location = poi.location;
        if (!location) {
            console.error('POI没有位置信息:', poi);
            return;
        }
        
        const lng = typeof location.lng === 'number' ? location.lng : parseFloat(location.lng);
        const lat = typeof location.lat === 'number' ? location.lat : parseFloat(location.lat);
        const name = poi.name || '';
        const address = poi.address || '';

        if (mapInstanceRef.current) {
            mapInstanceRef.current.setCenter([lng, lat]);
            mapInstanceRef.current.setZoom(16);
        }

        if (markerRef.current) {
            markerRef.current.setPosition([lng, lat]);
        } else if (mapInstanceRef.current) {
            const marker = new window.AMap.Marker({
                position: [lng, lat],
                draggable: true
            });
            marker.setMap(mapInstanceRef.current);
            markerRef.current = marker;
            marker.on('dragend', () => {
                const position = marker.getPosition();
                reverseGeocode(position.lng, position.lat);
            });
        }

        // 使用逆地理编码获取完整地址
        if (geocoderRef.current) {
            reverseGeocode(lng, lat);
        } else {
            // 如果地理编码器还没准备好，使用POI的地址
            const fullAddress = address ? `${name} - ${address}` : name;
            setCurrentAddress(fullAddress);
            onChange({
                address: fullAddress,
                lng,
                lat
            });
        }

        setSearchResults([]);
        setSearchKeyword('');
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <div className="bg-white rounded-2xl w-full max-w-4xl h-[80vh] flex flex-col shadow-2xl">
                {/* Header */}
                <div className="flex items-center justify-between p-4 border-b border-gray-100 shrink-0">
                    <h3 className="text-lg font-bold text-gray-900">选择位置</h3>
                    {onClose && (
                        <button
                            onClick={onClose}
                            className="p-2 hover:bg-gray-100 rounded-full transition-colors"
                        >
                            <X size={20} className="text-gray-500" />
                        </button>
                    )}
                </div>

                {/* Search Bar */}
                <div className="p-4 border-b border-gray-100 shrink-0">
                    <div className="flex gap-2">
                        <div className="relative flex-1">
                            <Search size={18} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                            <input
                                type="text"
                                placeholder="搜索地点..."
                                value={searchKeyword}
                                onChange={(e) => setSearchKeyword(e.target.value)}
                                onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                                className="w-full pl-10 pr-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-blue-500"
                            />
                        </div>
                        <button
                            onClick={handleSearch}
                            disabled={isSearching || !searchKeyword.trim()}
                            className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {isSearching ? '搜索中...' : '搜索'}
                        </button>
                    </div>

                    {/* Search Results */}
                    {isSearching && (
                        <div className="mt-2 p-3 text-center text-sm text-gray-500">
                            <div className="inline-flex items-center gap-2">
                                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
                                <span>搜索中...</span>
                            </div>
                        </div>
                    )}
                    {!isSearching && searchResults.length > 0 && (
                        <div className="mt-2 max-h-40 overflow-y-auto border border-gray-200 rounded-lg bg-white shadow-sm">
                            {searchResults.map((poi, index) => (
                                <div
                                    key={poi.id || `poi-${index}`}
                                    onClick={() => selectSearchResult(poi)}
                                    className="p-3 hover:bg-blue-50 cursor-pointer border-b border-gray-100 last:border-0 transition-colors"
                                >
                                    <div className="font-medium text-sm text-gray-900">{poi.name || '未知地点'}</div>
                                    {poi.address && (
                                        <div className="text-xs text-gray-500 mt-1">{poi.address}</div>
                                    )}
                                    {poi.district && (
                                        <div className="text-xs text-gray-400 mt-0.5">{poi.district}</div>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                    {!isSearching && searchKeyword.trim() && searchResults.length === 0 && (
                        <div className="mt-2 p-2 text-center text-xs text-gray-400">
                            未找到相关地点
                            {!import.meta.env.VITE_AMAP_SECURITY_CODE && (
                                <div className="mt-1 text-red-500">
                                    (提示: 如遇到INVALID_USER_SCODE错误，请在.env中配置VITE_AMAP_SECURITY_CODE)
                                </div>
                            )}
                        </div>
                    )}

                    {/* Current Address */}
                    {currentAddress && (
                        <div className="mt-2 flex items-center gap-2 text-sm text-gray-600 bg-blue-50 p-2 rounded-lg">
                            <MapPin size={16} className="text-blue-600" />
                            <span className="flex-1">{currentAddress}</span>
                        </div>
                    )}
                </div>

                {/* Map Container */}
                <div className="flex-1 relative min-h-0">
                    {isLoading && (
                        <div className="absolute inset-0 flex items-center justify-center bg-gray-100 z-10">
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                        </div>
                    )}
                    <div ref={mapContainerRef} className="w-full h-full" />
                </div>

                {/* Footer */}
                <div className="p-4 border-t border-gray-100 shrink-0 flex justify-end gap-2">
                    {onClose && (
                        <button
                            onClick={onClose}
                            className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-200"
                        >
                            取消
                        </button>
                    )}
                    <button
                        onClick={() => {
                            if (currentAddress && markerRef.current) {
                                const position = markerRef.current.getPosition();
                                onChange({
                                    address: currentAddress,
                                    lng: position.lng,
                                    lat: position.lat
                                });
                                onClose?.();
                            } else if (value) {
                                // 如果已有值，直接确认
                                onChange(value);
                                onClose?.();
                            }
                        }}
                        disabled={!currentAddress && !value}
                        className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        确认选择
                    </button>
                </div>
            </div>
        </div>
    );
};
