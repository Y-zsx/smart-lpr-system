import React, { useState, useEffect } from 'react';
import { useCameraStore, CameraDevice } from '../store/cameraStore';
import { Video, Globe, Plus, Trash2, Settings, MonitorPlay, FileVideo, RefreshCw, MapPin, X, Edit2 } from 'lucide-react';
import { LocationPicker } from './LocationPicker';
import { apiClient, OnvifDiscoveredDevice, StreamProtocol, StreamVendor } from '../api/client';
import { useToastContext } from '../contexts/ToastContext';
import { useConfirmContext } from '../contexts/ConfirmContext';

interface CameraListProps {
    canManage?: boolean;
}

export const CameraList: React.FC<CameraListProps> = ({ canManage = true }) => {
    const { cameras, selectedCameraId, selectCamera, addCamera, updateCamera, removeCamera, refreshDevices, availableDevices } = useCameraStore();
    const toast = useToastContext();
    const { confirm } = useConfirmContext();
    const [isAdding, setIsAdding] = useState(false);
    const [editingCamera, setEditingCamera] = useState<CameraDevice | null>(null);
    const [addType, setAddType] = useState<'stream' | 'file'>('stream');
    const [newCam, setNewCam] = useState({ 
        name: '', 
        url: '' as string, 
        type: 'stream' as const,
        regionCode: '',
        location: undefined as { address: string; lng: number; lat: number } | undefined
    });
    const [editCam, setEditCam] = useState({ 
        name: '', 
        url: '' as string, 
        type: 'stream' as const,
        regionCode: '',
        location: undefined as { address: string; lng: number; lat: number } | undefined
    });
    const [showLocationPicker, setShowLocationPicker] = useState(false);
    const [locationPickerFor, setLocationPickerFor] = useState<'add' | 'edit'>('add');
    const [streamTemplate, setStreamTemplate] = useState({
        vendor: 'hikvision' as StreamVendor,
        protocol: 'rtsp' as StreamProtocol,
        host: '',
        port: 554,
        username: '',
        password: '',
        channel: 1,
        streamType: 'main' as 'main' | 'sub',
        customPath: ''
    });
    const [isBuildingTemplate, setIsBuildingTemplate] = useState(false);
    const [isTestingStream, setIsTestingStream] = useState(false);
    const [isDiscoveringOnvif, setIsDiscoveringOnvif] = useState(false);
    const [onvifDevices, setOnvifDevices] = useState<OnvifDiscoveredDevice[]>([]);

    // 移除自动刷新设备列表，避免自动请求摄像头权限
    // 用户需要时可以手动点击刷新按钮

    const handleAdd = async () => {
        if (!newCam.name) {
            toast.warning('请输入摄像头名称');
            return;
        }
        if (addType === 'stream' && !newCam.url) {
            toast.warning('请输入流地址');
            return;
        }
        if (addType === 'file' && !newCam.url) {
            toast.warning('请选择视频文件');
            return;
        }
        
        try {
            // 先调用 API 添加到后端
            const savedCamera = await apiClient.addCamera({
                name: newCam.name,
                type: addType,
                url: newCam.url,
                regionCode: newCam.regionCode || undefined,
                location: newCam.location?.address,
                latitude: newCam.location?.lat,
                longitude: newCam.location?.lng
            });

            // 然后更新本地 store（使用后端返回的完整摄像头对象，包括 ID）
            addCamera(savedCamera);

            setIsAdding(false);
            setNewCam({ name: '', url: '', type: 'stream', regionCode: '', location: undefined });
            setAddType('stream');
            toast.success('摄像头添加成功');
        } catch (error) {
            console.error('添加摄像头失败:', error);
            toast.error('添加失败，请重试');
        }
    };

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            const url = URL.createObjectURL(file);
            if (locationPickerFor === 'add') {
                setNewCam({ ...newCam, url, name: newCam.name || file.name });
            } else {
                setEditCam({ ...editCam, url, name: editCam.name || file.name });
            }
        }
    };

    const handleEdit = (camera: CameraDevice) => {
        setEditingCamera(camera);
        setEditCam({
            name: camera.name,
            url: camera.url || '',
            type: camera.type === 'local' ? 'stream' : camera.type,
            regionCode: camera.regionCode || '',
            location: camera.latitude && camera.longitude ? {
                address: camera.location || '',
                lat: camera.latitude,
                lng: camera.longitude
            } : undefined
        });
        setAddType(camera.type === 'local' ? 'stream' : camera.type);
    };

    const handleSaveEdit = async () => {
        if (!editingCamera) return;
        
        if (!editCam.name) {
            toast.warning('请输入摄像头名称');
            return;
        }
        if (addType === 'stream' && !editCam.url) {
            toast.warning('请输入流地址');
            return;
        }
        if (addType === 'file' && !editCam.url) {
            toast.warning('请选择视频文件');
            return;
        }

        try {
            // 更新到后端
            await apiClient.updateCamera(editingCamera.id, {
                name: editCam.name,
                type: addType,
                url: editCam.url,
                regionCode: editCam.regionCode || undefined,
                location: editCam.location?.address,
                latitude: editCam.location?.lat,
                longitude: editCam.location?.lng
            });

            // 更新本地 store
            updateCamera(editingCamera.id, {
                name: editCam.name,
                type: addType,
                url: editCam.url,
                regionCode: editCam.regionCode || undefined,
                location: editCam.location?.address,
                latitude: editCam.location?.lat,
                longitude: editCam.location?.lng
            });

            setEditingCamera(null);
            setEditCam({ name: '', url: '', type: 'stream', regionCode: '', location: undefined });
            setAddType('stream');
            toast.success('摄像头更新成功');
        } catch (error) {
            console.error('更新摄像头失败:', error);
            toast.error('更新失败，请重试');
        }
    };

    const buildTemplateFor = async (target: 'add' | 'edit') => {
        try {
            setIsBuildingTemplate(true);
            const result = await apiClient.buildCameraStreamTemplate(streamTemplate);
            if (target === 'add') {
                setNewCam(prev => ({ ...prev, url: result.url }));
            } else {
                setEditCam(prev => ({ ...prev, url: result.url }));
            }
            toast.success('已生成并填入流地址');
        } catch (error) {
            console.error('生成流地址失败:', error);
            toast.error(error instanceof Error ? error.message : '生成流地址失败');
        } finally {
            setIsBuildingTemplate(false);
        }
    };

    const testStream = async (url: string) => {
        const streamUrl = (url || '').trim();
        if (!streamUrl) {
            toast.warning('请先填写流地址');
            return;
        }
        try {
            setIsTestingStream(true);
            const result = await apiClient.testCameraStream(streamUrl);
            if (result.ok) {
                const info = result.details
                    ? `${result.details.codec || 'unknown'} ${result.details.width || '?'}x${result.details.height || '?'}`
                    : '';
                toast.success(info ? `连通成功：${info}` : '连通成功');
            } else {
                toast.error(result.message || '连通失败');
            }
        } catch (error) {
            console.error('连通性测试失败:', error);
            toast.error(error instanceof Error ? error.message : '连通性测试失败');
        } finally {
            setIsTestingStream(false);
        }
    };

    const discoverOnvifDevices = async () => {
        try {
            setIsDiscoveringOnvif(true);
            const result = await apiClient.discoverOnvifDevices(3500);
            setOnvifDevices(result.devices || []);
            if ((result.devices || []).length === 0) {
                toast.info('未发现 ONVIF 设备，请确认摄像头与服务端处于同一局域网且开启 ONVIF');
            } else {
                toast.success(`发现 ${(result.devices || []).length} 个设备`);
            }
        } catch (error) {
            console.error('ONVIF 发现失败:', error);
            toast.error(error instanceof Error ? error.message : 'ONVIF 发现失败');
        } finally {
            setIsDiscoveringOnvif(false);
        }
    };

    const applyDiscoveredDevice = (device: OnvifDiscoveredDevice, target: 'add' | 'edit') => {
        setStreamTemplate(prev => ({
            ...prev,
            vendor: device.vendorGuess || 'custom',
            protocol: 'rtsp',
            host: device.ip || prev.host
        }));
        if (target === 'add') {
            setNewCam(prev => ({
                ...prev,
                name: prev.name || device.name || `摄像头-${device.ip || 'ONVIF'}`
            }));
        } else {
            setEditCam(prev => ({
                ...prev,
                name: prev.name || device.name || `摄像头-${device.ip || 'ONVIF'}`
            }));
        }
        toast.success('已回填设备信息，请继续生成流地址');
    };

    return (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm flex flex-col h-full">
            <div className="p-4 border-b border-gray-100 flex justify-between items-center">
                <h3 className="font-semibold text-gray-800 flex items-center gap-2">
                    <MonitorPlay size={18} className="text-blue-600" />
                    摄像头管理
                </h3>
                <div className="flex gap-2">
                    <button
                        onClick={() => refreshDevices()}
                        className="p-1.5 hover:bg-blue-50 text-blue-600 rounded-lg transition-colors"
                        title="刷新设备列表"
                    >
                        <RefreshCw size={18} />
                    </button>
                    {canManage && (
                        <button
                            onClick={() => setIsAdding(true)}
                            className="p-1.5 hover:bg-blue-50 text-blue-600 rounded-lg transition-colors"
                            title="添加摄像头"
                        >
                            <Plus size={18} />
                        </button>
                    )}
                </div>
            </div>

            <div className="flex-1 overflow-y-auto p-2 space-y-2">
                {cameras.map((cam) => (
                    <div
                        key={cam.id}
                        onClick={() => selectCamera(cam.id)}
                        className={`p-3 rounded-lg cursor-pointer border transition-all group ${selectedCameraId === cam.id
                            ? 'bg-blue-50 border-blue-200 shadow-sm'
                            : 'bg-white border-transparent hover:bg-gray-50 hover:border-gray-100'
                            }`}
                    >
                        <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-3 flex-1 min-w-0">
                                <div className={`p-2 rounded-lg flex-shrink-0 ${selectedCameraId === cam.id ? 'bg-blue-100 text-blue-600' : 'bg-gray-100 text-gray-500'
                                    }`}>
                                    {cam.type === 'local' ? <Video size={16} /> : 
                                     cam.type === 'file' ? <FileVideo size={16} /> : 
                                     <Globe size={16} />}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className={`text-sm font-medium truncate ${selectedCameraId === cam.id ? 'text-blue-900' : 'text-gray-700'
                                        }`}>
                                        {cam.name}
                                    </p>
                                    <div className="flex items-center gap-2 mt-0.5">
                                        <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${cam.status === 'online' ? 'bg-green-500' : 'bg-gray-300'
                                            }`} />
                                        <span className="text-xs text-gray-400 flex-shrink-0">
                                            {cam.type === 'local' ? '本地设备' : 
                                             cam.type === 'file' ? '视频文件' : 
                                             '网络流'}
                                        </span>
                                    </div>
                                    {cam.location && (
                                        <div className="flex items-center gap-1 mt-1 text-xs text-gray-500 min-w-0">
                                            <MapPin size={12} className="flex-shrink-0" />
                                            <span className="truncate">{cam.location}</span>
                                        </div>
                                    )}
                                </div>
                            </div>

                            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all flex-shrink-0">
                                {canManage && cam.type !== 'local' && (
                                    <>
                                        <button
                                            onClick={(e) => { 
                                                e.stopPropagation(); 
                                                handleEdit(cam); 
                                            }}
                                            className="p-1.5 text-gray-400 hover:text-blue-500 hover:bg-blue-50 rounded transition-all"
                                            title="编辑"
                                        >
                                            <Edit2 size={14} />
                                        </button>
                                        <button
                                            onClick={async (e) => { 
                                                e.stopPropagation(); 
                                                e.preventDefault();
                                                try {
                                                    const result = await confirm({
                                                        title: '删除摄像头',
                                                        message: `确定要删除摄像头 "${cam.name}" 吗？`,
                                                        type: 'danger'
                                                    });
                                                    if (result) {
                                                        // 先调用 API 删除后端数据
                                                        await apiClient.deleteCamera(cam.id);
                                                        // 然后更新本地 store
                                                        removeCamera(cam.id);
                                                        toast.success('摄像头已删除');
                                                    }
                                                } catch (error) {
                                                    console.error('删除摄像头失败:', error);
                                                    toast.error('删除失败，请重试');
                                                }
                                            }}
                                            className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded transition-all"
                                            title="删除"
                                        >
                                            <Trash2 size={14} />
                                        </button>
                                    </>
                                )}
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            {/* Add Camera Modal */}
            {isAdding && (
                <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/20 backdrop-blur-sm p-4 rounded-xl">
                    <div className="bg-white p-4 rounded-xl shadow-xl w-full max-w-xs border border-gray-100">
                        <h4 className="font-bold text-gray-800 mb-3">添加摄像头</h4>
                        <div className="space-y-3">
                            {/* 类型选择 */}
                            <div>
                                <label className="text-xs text-gray-500 block mb-1">类型</label>
                                <div className="flex gap-2">
                                    <button
                                        onClick={() => setAddType('stream')}
                                        className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                                            addType === 'stream' 
                                                ? 'bg-blue-600 text-white' 
                                                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                                        }`}
                                    >
                                        网络流
                                    </button>
                                    <button
                                        onClick={() => setAddType('file')}
                                        className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                                            addType === 'file' 
                                                ? 'bg-blue-600 text-white' 
                                                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                                        }`}
                                    >
                                        视频文件
                                    </button>
                                </div>
                            </div>
                            <div>
                                <label className="text-xs text-gray-500 block mb-1">名称</label>
                                    <input
                                        className="w-full px-3 py-2 bg-gray-50 rounded-lg text-sm border border-gray-200 focus:outline-none focus:border-blue-500"
                                        placeholder={addType === 'stream' ? '例如：停车场入口' : '例如：演示视频'}
                                        value={newCam.name || ''}
                                        onChange={e => setNewCam({ ...newCam, name: e.target.value })}
                                    />
                            </div>
                            {addType === 'stream' ? (
                                <div>
                                    <label className="text-xs text-gray-500 block mb-1">流地址 (URL)</label>
                                    <input
                                        className="w-full px-3 py-2 bg-gray-50 rounded-lg text-sm border border-gray-200 focus:outline-none focus:border-blue-500"
                                        placeholder="http://... 或 rtsp://..."
                                        value={newCam.url || ''}
                                        onChange={e => setNewCam({ ...newCam, url: e.target.value })}
                                    />
                                    <p className="text-xs text-gray-400 mt-1">支持 MJPEG、HLS 等格式</p>
                                    <div className="mt-2 rounded-lg border border-gray-200 bg-gray-50 p-2 space-y-2">
                                        <div className="text-xs font-medium text-gray-700">智能接入助手</div>
                                        <p className="text-[11px] text-gray-500">推荐流程：先自动发现设备，再生成播放地址，最后测试连接。</p>
                                        <button
                                            type="button"
                                            onClick={discoverOnvifDevices}
                                            disabled={isDiscoveringOnvif}
                                            className="w-full px-2 py-1.5 text-xs rounded bg-sky-600 text-white hover:bg-sky-700 disabled:opacity-60"
                                        >
                                            {isDiscoveringOnvif ? '正在发现设备...' : '自动发现摄像头（局域网）'}
                                        </button>
                                        {onvifDevices.length > 0 && (
                                            <div className="max-h-28 overflow-y-auto rounded border border-gray-200 bg-white">
                                                {onvifDevices.map((device, idx) => (
                                                    <button
                                                        key={`${device.endpoint || device.ip || 'dev'}-${idx}`}
                                                        type="button"
                                                        onClick={() => applyDiscoveredDevice(device, 'add')}
                                                        className="w-full text-left px-2 py-1.5 border-b border-gray-100 last:border-b-0 hover:bg-blue-50"
                                                    >
                                                        <div className="text-xs font-medium text-gray-700">
                                                            {device.name || '未命名设备'} {device.ip ? `(${device.ip})` : ''}
                                                        </div>
                                                        <div className="text-[11px] text-gray-500">
                                                            厂商: {device.vendorGuess} {device.location ? `| 位置: ${device.location}` : ''}
                                                        </div>
                                                    </button>
                                                ))}
                                            </div>
                                        )}
                                        <div className="grid grid-cols-2 gap-2">
                                            <select
                                                className="px-2 py-1.5 text-xs rounded border border-gray-200 bg-white"
                                                value={streamTemplate.vendor}
                                                onChange={(e) => setStreamTemplate(prev => ({ ...prev, vendor: e.target.value as StreamVendor }))}
                                            >
                                                <option value="hikvision">海康</option>
                                                <option value="dahua">大华</option>
                                                <option value="uniview">宇视</option>
                                                <option value="axis">Axis</option>
                                                <option value="custom">自定义</option>
                                            </select>
                                            <select
                                                className="px-2 py-1.5 text-xs rounded border border-gray-200 bg-white"
                                                value={streamTemplate.protocol}
                                                onChange={(e) => setStreamTemplate(prev => ({ ...prev, protocol: e.target.value as StreamProtocol }))}
                                            >
                                                <option value="rtsp">RTSP</option>
                                                <option value="http">HTTP</option>
                                            </select>
                                        </div>
                                        <input
                                            className="w-full px-2 py-1.5 text-xs rounded border border-gray-200 bg-white"
                                            placeholder="设备IP或域名，例如 192.168.1.64"
                                            value={streamTemplate.host}
                                            onChange={(e) => setStreamTemplate(prev => ({ ...prev, host: e.target.value }))}
                                        />
                                        <div className="grid grid-cols-3 gap-2">
                                            <input
                                                className="px-2 py-1.5 text-xs rounded border border-gray-200 bg-white"
                                                placeholder="端口"
                                                type="number"
                                                value={streamTemplate.port}
                                                onChange={(e) => setStreamTemplate(prev => ({ ...prev, port: Number(e.target.value) || 0 }))}
                                            />
                                            <input
                                                className="px-2 py-1.5 text-xs rounded border border-gray-200 bg-white"
                                                placeholder="通道"
                                                type="number"
                                                value={streamTemplate.channel}
                                                onChange={(e) => setStreamTemplate(prev => ({ ...prev, channel: Number(e.target.value) || 1 }))}
                                            />
                                            <select
                                                className="px-2 py-1.5 text-xs rounded border border-gray-200 bg-white"
                                                value={streamTemplate.streamType}
                                                onChange={(e) => setStreamTemplate(prev => ({ ...prev, streamType: e.target.value as 'main' | 'sub' }))}
                                            >
                                                <option value="main">主码流</option>
                                                <option value="sub">子码流</option>
                                            </select>
                                        </div>
                                        <div className="grid grid-cols-2 gap-2">
                                            <input
                                                className="px-2 py-1.5 text-xs rounded border border-gray-200 bg-white"
                                                placeholder="用户名"
                                                value={streamTemplate.username}
                                                onChange={(e) => setStreamTemplate(prev => ({ ...prev, username: e.target.value }))}
                                            />
                                            <input
                                                className="px-2 py-1.5 text-xs rounded border border-gray-200 bg-white"
                                                placeholder="密码"
                                                type="password"
                                                value={streamTemplate.password}
                                                onChange={(e) => setStreamTemplate(prev => ({ ...prev, password: e.target.value }))}
                                            />
                                        </div>
                                        {streamTemplate.vendor === 'custom' && (
                                            <input
                                                className="w-full px-2 py-1.5 text-xs rounded border border-gray-200 bg-white"
                                                placeholder="/your/path 或完整 URL"
                                                value={streamTemplate.customPath}
                                                onChange={(e) => setStreamTemplate(prev => ({ ...prev, customPath: e.target.value }))}
                                            />
                                        )}
                                        <div className="grid grid-cols-2 gap-2">
                                            <button
                                                type="button"
                                                onClick={() => buildTemplateFor('add')}
                                                disabled={isBuildingTemplate}
                                                className="px-2 py-1.5 text-xs rounded bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-60"
                                            >
                                                {isBuildingTemplate ? '生成中...' : '生成播放地址'}
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => testStream(newCam.url)}
                                                disabled={isTestingStream}
                                                className="px-2 py-1.5 text-xs rounded bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-60"
                                            >
                                                {isTestingStream ? '测试中...' : '测试连接'}
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                <div>
                                    <label className="text-xs text-gray-500 block mb-1">视频文件</label>
                                    <input
                                        type="file"
                                        accept="video/*"
                                        onChange={handleFileSelect}
                                        className="w-full px-3 py-2 bg-gray-50 rounded-lg text-sm border border-gray-200 focus:outline-none focus:border-blue-500"
                                    />
                                    {newCam.url && (
                                        <p className="text-xs text-green-600 mt-1">✓ 文件已选择</p>
                                    )}
                                </div>
                            )}
                            <div>
                                <label className="text-xs text-gray-500 block mb-1">区域编码（可选）</label>
                                <input
                                    className="w-full px-3 py-2 bg-gray-50 rounded-lg text-sm border border-gray-200 focus:outline-none focus:border-blue-500"
                                    placeholder="例如：zone-east"
                                    value={newCam.regionCode}
                                    onChange={e => setNewCam({ ...newCam, regionCode: e.target.value })}
                                />
                            </div>
                            {/* 位置选择 */}
                            <div>
                                <label className="text-xs text-gray-500 block mb-1">位置</label>
                                <button
                                    type="button"
                                    onClick={() => {
                                        setLocationPickerFor('add');
                                        setShowLocationPicker(true);
                                    }}
                                    className="w-full px-3 py-2 bg-gray-50 rounded-lg text-sm border border-gray-200 focus:outline-none focus:border-blue-500 flex items-center gap-2 hover:bg-gray-100"
                                >
                                    <MapPin size={16} className="text-gray-400" />
                                    <span className="flex-1 text-left">
                                        {newCam.location ? newCam.location.address : '点击选择位置'}
                                    </span>
                                    {newCam.location && (
                                        <button
                                            type="button"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                setNewCam({ ...newCam, location: undefined });
                                            }}
                                            className="text-gray-400 hover:text-red-500"
                                        >
                                            <X size={16} />
                                        </button>
                                    )}
                                </button>
                                {newCam.location && (
                                    <p className="text-xs text-green-600 mt-1">✓ 位置已选择</p>
                                )}
                            </div>
                            <div className="flex gap-2 pt-2">
                                <button
                                    onClick={() => {
                                        setIsAdding(false);
                                        setNewCam({ name: '', url: '', type: 'stream', regionCode: '', location: undefined });
                                        setAddType('stream');
                                    }}
                                    className="flex-1 px-3 py-2 bg-gray-100 text-gray-600 rounded-lg text-sm font-medium hover:bg-gray-200"
                                >
                                    取消
                                </button>
                                <button
                                    onClick={handleAdd}
                                    className="flex-1 px-3 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700"
                                >
                                    添加
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Edit Camera Modal */}
            {editingCamera && (
                <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/20 backdrop-blur-sm p-4 rounded-xl">
                    <div className="bg-white p-4 rounded-xl shadow-xl w-full max-w-xs border border-gray-100">
                        <h4 className="font-bold text-gray-800 mb-3">编辑摄像头</h4>
                        <div className="space-y-3">
                            {/* 类型选择 */}
                            <div>
                                <label className="text-xs text-gray-500 block mb-1">类型</label>
                                <div className="flex gap-2">
                                    <button
                                        onClick={() => setAddType('stream')}
                                        className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                                            addType === 'stream' 
                                                ? 'bg-blue-600 text-white' 
                                                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                                        }`}
                                    >
                                        网络流
                                    </button>
                                    <button
                                        onClick={() => setAddType('file')}
                                        className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                                            addType === 'file' 
                                                ? 'bg-blue-600 text-white' 
                                                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                                        }`}
                                    >
                                        视频文件
                                    </button>
                                </div>
                            </div>
                            <div>
                                <label className="text-xs text-gray-500 block mb-1">名称</label>
                                <input
                                    className="w-full px-3 py-2 bg-gray-50 rounded-lg text-sm border border-gray-200 focus:outline-none focus:border-blue-500"
                                    placeholder={addType === 'stream' ? '例如：停车场入口' : '例如：演示视频'}
                                    value={editCam.name || ''}
                                    onChange={e => setEditCam({ ...editCam, name: e.target.value })}
                                />
                            </div>
                            {addType === 'stream' ? (
                                <div>
                                    <label className="text-xs text-gray-500 block mb-1">流地址 (URL)</label>
                                    <input
                                        className="w-full px-3 py-2 bg-gray-50 rounded-lg text-sm border border-gray-200 focus:outline-none focus:border-blue-500"
                                        placeholder="http://... 或 rtsp://..."
                                        value={editCam.url || ''}
                                        onChange={e => setEditCam({ ...editCam, url: e.target.value })}
                                    />
                                    <p className="text-xs text-gray-400 mt-1">支持 MJPEG、HLS 等格式</p>
                                    <div className="mt-2 rounded-lg border border-gray-200 bg-gray-50 p-2 space-y-2">
                                        <div className="text-xs font-medium text-gray-700">智能接入助手</div>
                                        <p className="text-[11px] text-gray-500">可先发现设备并回填，再一键生成地址和测试连接。</p>
                                        <button
                                            type="button"
                                            onClick={discoverOnvifDevices}
                                            disabled={isDiscoveringOnvif}
                                            className="w-full px-2 py-1.5 text-xs rounded bg-sky-600 text-white hover:bg-sky-700 disabled:opacity-60"
                                        >
                                            {isDiscoveringOnvif ? '正在发现设备...' : '自动发现摄像头（局域网）'}
                                        </button>
                                        {onvifDevices.length > 0 && (
                                            <div className="max-h-24 overflow-y-auto rounded border border-gray-200 bg-white">
                                                {onvifDevices.map((device, idx) => (
                                                    <button
                                                        key={`${device.endpoint || device.ip || 'dev'}-edit-${idx}`}
                                                        type="button"
                                                        onClick={() => applyDiscoveredDevice(device, 'edit')}
                                                        className="w-full text-left px-2 py-1.5 border-b border-gray-100 last:border-b-0 hover:bg-blue-50"
                                                    >
                                                        <div className="text-xs font-medium text-gray-700">
                                                            {device.name || '未命名设备'} {device.ip ? `(${device.ip})` : ''}
                                                        </div>
                                                    </button>
                                                ))}
                                            </div>
                                        )}
                                        <div className="grid grid-cols-2 gap-2">
                                            <button
                                                type="button"
                                                onClick={() => buildTemplateFor('edit')}
                                                disabled={isBuildingTemplate}
                                                className="px-2 py-1.5 text-xs rounded bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-60"
                                            >
                                                {isBuildingTemplate ? '生成中...' : '生成播放地址'}
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => testStream(editCam.url)}
                                                disabled={isTestingStream}
                                                className="px-2 py-1.5 text-xs rounded bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-60"
                                            >
                                                {isTestingStream ? '测试中...' : '测试连接'}
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                <div>
                                    <label className="text-xs text-gray-500 block mb-1">视频文件</label>
                                    <input
                                        type="file"
                                        accept="video/*"
                                        onChange={handleFileSelect}
                                        className="w-full px-3 py-2 bg-gray-50 rounded-lg text-sm border border-gray-200 focus:outline-none focus:border-blue-500"
                                    />
                                    {editCam.url && (
                                        <p className="text-xs text-green-600 mt-1">✓ 文件已选择</p>
                                    )}
                                </div>
                            )}
                            <div>
                                <label className="text-xs text-gray-500 block mb-1">区域编码（可选）</label>
                                <input
                                    className="w-full px-3 py-2 bg-gray-50 rounded-lg text-sm border border-gray-200 focus:outline-none focus:border-blue-500"
                                    placeholder="例如：zone-east"
                                    value={editCam.regionCode}
                                    onChange={e => setEditCam({ ...editCam, regionCode: e.target.value })}
                                />
                            </div>
                            {/* 位置选择 */}
                            <div>
                                <label className="text-xs text-gray-500 block mb-1">位置</label>
                                <button
                                    type="button"
                                    onClick={() => {
                                        setLocationPickerFor('edit');
                                        setShowLocationPicker(true);
                                    }}
                                    className="w-full px-3 py-2 bg-gray-50 rounded-lg text-sm border border-gray-200 focus:outline-none focus:border-blue-500 flex items-center gap-2 hover:bg-gray-100"
                                >
                                    <MapPin size={16} className="text-gray-400" />
                                    <span className="flex-1 text-left">
                                        {editCam.location ? editCam.location.address : '点击选择位置'}
                                    </span>
                                    {editCam.location && (
                                        <button
                                            type="button"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                setEditCam({ ...editCam, location: undefined });
                                            }}
                                            className="text-gray-400 hover:text-red-500"
                                        >
                                            <X size={16} />
                                        </button>
                                    )}
                                </button>
                                {editCam.location && (
                                    <p className="text-xs text-green-600 mt-1">✓ 位置已选择</p>
                                )}
                            </div>
                            <div className="flex gap-2 pt-2">
                                <button
                                    onClick={() => {
                                        setEditingCamera(null);
                                        setEditCam({ name: '', url: '', type: 'stream', regionCode: '', location: undefined });
                                        setAddType('stream');
                                    }}
                                    className="flex-1 px-3 py-2 bg-gray-100 text-gray-600 rounded-lg text-sm font-medium hover:bg-gray-200"
                                >
                                    取消
                                </button>
                                <button
                                    onClick={handleSaveEdit}
                                    className="flex-1 px-3 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700"
                                >
                                    保存
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Location Picker Modal */}
            {showLocationPicker && (
                <LocationPicker
                    value={locationPickerFor === 'add' ? newCam.location : editCam.location}
                    onChange={(location) => {
                        if (locationPickerFor === 'add') {
                            setNewCam({ ...newCam, location });
                        } else {
                            setEditCam({ ...editCam, location });
                        }
                        setShowLocationPicker(false);
                    }}
                    onClose={() => setShowLocationPicker(false)}
                />
            )}
        </div>
    );
};
