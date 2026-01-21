import React, { useEffect, useState } from 'react';
import { X, Calendar, Clock, MapPin } from 'lucide-react';
import { apiClient } from '../api/client';
import { LicensePlate } from '../types/plate';

interface CategoryDetailProps {
    type: string;
    label: string;
    onClose: () => void;
}

export const CategoryDetail: React.FC<CategoryDetailProps> = ({ type, label, onClose }) => {
    const [plates, setPlates] = useState<LicensePlate[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchPlates = async () => {
            try {
                // 获取该类型的所有历史记录（后端默认限制 100 条）
                // 如果需要，我们稍后可以添加分页
                const data = await apiClient.getHistory(undefined, undefined, type);
                setPlates(data);
            } catch (error) {
                console.error("获取分类详情失败", error);
            } finally {
                setLoading(false);
            }
        };
        fetchPlates();
    }, [type]);

    const getImageUrl = (path?: string) => {
        if (!path) return 'https://via.placeholder.com/400x300?text=No+Image';
        if (path.startsWith('http')) return path;
        // 假设是 R2 公共存储桶 URL 或类似地址。
        // 由于代码中没有配置 R2 的公共域名，
        // 我们依赖 `image_path` 可能是一个 key 的事实。
        // 但是等等，`plateService` 保存的是 `imageKey`。
        // 我们需要一种方法来查看它。
        // 目前，我们假设后端返回预签名 GET URL 或我们使用公共域名。
        // 如果只是一个 key，我们可能需要另一个 API 来获取查看 URL。
        // 然而，查看 `plateService.ts`，`imageUrl` 设置为 `URL.createObjectURL(file)` 用于本地显示。
        // 但对于历史记录，我们需要远程 URL。
        // 我们暂时假设我们可以构建它或者它是一个完整的 URL。
        // 如果它是一个像 `uploads/user/timestamp-file.jpg` 的 key，我们需要公共 R2 域名。
        // 如果不是完整 URL，我们使用占位符，或者尝试获取预签名 URL？
        // 实际上，`apiClient` 有 `getUploadUrl` 但没有 `getDownloadUrl`。
        // 我们假设数据库中存储的 `image_path` 是可用的，或者我们需要修复这个问题。
        // 在 `plateService.ts` 中，`imageKey` 传递给 `savePlate`。
        // 我们假设可以通过 `http://localhost:8000/storage/<key>` 访问它（如果是公开的），
        // 或者我们需要后端端点来获取图像。
        // 对于这个 MVP，如果它看起来像 URL，我们就直接使用 key，否则显示占位符。
        return `http://localhost:8000/storage/${path}`; // 猜测公共 URL 结构或使用代理
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <div className="bg-white rounded-2xl w-full max-w-5xl h-[80vh] flex flex-col shadow-2xl animate-in fade-in zoom-in duration-200">
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b border-gray-100">
                    <div>
                        <h2 className="text-2xl font-bold text-gray-900">{label}详情</h2>
                        <p className="text-gray-500 text-sm mt-1">共找到 {plates.length} 条记录</p>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-gray-100 rounded-full transition-colors"
                    >
                        <X size={24} className="text-gray-500" />
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-6 bg-gray-50">
                    {loading ? (
                        <div className="flex items-center justify-center h-full">
                            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
                        </div>
                    ) : plates.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-full text-gray-400">
                            <div className="w-16 h-16 bg-gray-200 rounded-full mb-4"></div>
                            <p>暂无该类型车辆记录</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                            {plates.map((plate) => (
                                <div key={plate.id} className="bg-white rounded-xl overflow-hidden shadow-sm border border-gray-100 hover:shadow-md transition-shadow group">
                                    {/* Image Container */}
                                    <div className="aspect-video bg-gray-100 relative overflow-hidden">
                                        <img
                                            src={getImageUrl(plate.image_path)}
                                            alt={plate.number}
                                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                                            onError={(e) => {
                                                (e.target as HTMLImageElement).src = 'https://via.placeholder.com/400x300?text=Image+Load+Error';
                                            }}
                                        />
                                        <div className="absolute top-2 right-2 bg-black/60 text-white text-xs px-2 py-1 rounded backdrop-blur-md">
                                            {(plate.confidence * 100).toFixed(1)}%
                                        </div>
                                    </div>

                                    {/* Info */}
                                    <div className="p-4">
                                        <div className="flex items-center justify-between mb-3">
                                            <span className={`text-lg font-bold px-2 py-0.5 rounded border ${plate.type === 'blue' ? 'bg-blue-600 text-white border-blue-600' :
                                                plate.type === 'green' ? 'bg-green-50 text-green-600 border-green-200' :
                                                    plate.type === 'yellow' ? 'bg-yellow-500 text-white border-yellow-500' :
                                                        'bg-gray-100 text-gray-700 border-gray-200'
                                                }`}>
                                                {plate.number}
                                            </span>
                                        </div>

                                        <div className="space-y-2 text-sm text-gray-500">
                                            <div className="flex items-center gap-2">
                                                <Clock size={14} />
                                                <span>{new Date(plate.timestamp).toLocaleString()}</span>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <MapPin size={14} />
                                                <span>{plate.location || '未知位置'}</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
