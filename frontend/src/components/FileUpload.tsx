import React, { useState, useRef, useEffect } from 'react';
import { Upload, X, Image as ImageIcon, Loader2, CheckCircle, AlertCircle, Plus } from 'lucide-react';
import { plateService } from '../services/plateService';
import { usePlateStore } from '../store/plateStore';
import { LicensePlate } from '../types/plate';
import { apiClient } from '../api/client';
import { useToastContext } from '../contexts/ToastContext';
import { isValidChinesePlateNumber } from '../utils/plateValidation';

interface FileItem {
    id: string;
    file: File;
    previewUrl: string;
    status: 'pending' | 'processing' | 'success' | 'error';
    results?: LicensePlate[];  // 多车牌
    error?: string;
}

export const FileUpload: React.FC = () => {
    const toast = useToastContext();
    const [files, setFiles] = useState<FileItem[]>([]);
    const [isProcessing, setIsProcessing] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const { addPlate, settings } = usePlateStore();

    // Cleanup URLs on unmount
    useEffect(() => {
        return () => {
            files.forEach(file => URL.revokeObjectURL(file.previewUrl));
        };
    }, []);

    const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
        const newFiles = Array.from(event.target.files || []);
        if (newFiles.length > 0) {
            addFiles(newFiles);
        }
        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    const addFiles = (newFiles: File[]) => {
        const validFiles = newFiles.filter(file => file.type.startsWith('image/'));
        if (validFiles.length !== newFiles.length) {
            toast.warning('部分文件不是图片，已自动过滤');
        }

        const fileItems: FileItem[] = validFiles.map(file => ({
            id: Math.random().toString(36).substr(2, 9),
            file,
            previewUrl: URL.createObjectURL(file),
            status: 'pending'
        }));

        setFiles(prev => [...prev, ...fileItems]);
    };

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        const droppedFiles = Array.from(e.dataTransfer.files);
        if (droppedFiles.length > 0) {
            addFiles(droppedFiles);
        }
    };

    const processQueue = async () => {
        if (isProcessing) return;

        const pendingFiles = files.filter(f => f.status === 'pending');
        if (pendingFiles.length === 0) return;

        setIsProcessing(true);

        for (const item of pendingFiles) {
            setFiles(prev => prev.map(f => f.id === item.id ? { ...f, status: 'processing' } : f));

            try {
                const { plates } = await plateService.recognizeFromFile(
                    item.file,
                    'upload',
                    undefined,
                    undefined,
                    undefined,
                    { minConfidence: settings.confidenceThreshold }
                );

                if (!plates || plates.length === 0) {
                    setFiles(prev => prev.map(f => f.id === item.id ? {
                        ...f, status: 'error', error: '未识别到车牌'
                    } : f));
                    continue;
                }

                const validPlates = plates.filter(p => p?.number && isValidChinesePlateNumber(p.number));
                const toShow: LicensePlate[] = [];
                for (const p of validPlates) {
                    try {
                        const saved = await apiClient.savePlate({ ...p, saved: true });
                        addPlate(saved);
                        toShow.push(saved);
                    } catch (saveError) {
                        console.error(`Failed to save plate for file ${item.file.name}:`, saveError);
                        addPlate(p);
                        toShow.push(p);
                    }
                }
                if (validPlates.length === 0 && plates.length > 0) {
                    setFiles(prev => prev.map(f => f.id === item.id ? {
                        ...f, status: 'error', error: '识别结果均为非法车牌格式，未入库'
                    } : f));
                    continue;
                }
                setFiles(prev => prev.map(f => f.id === item.id ? {
                    ...f, status: 'success', results: toShow
                } : f));
            } catch (error) {
                console.error(`Failed to recognize file ${item.file.name}:`, error);
                setFiles(prev => prev.map(f => f.id === item.id ? {
                    ...f, status: 'error', error: '识别失败'
                } : f));
            }
        }

        setIsProcessing(false);
    };

    const clearAll = () => {
        files.forEach(file => URL.revokeObjectURL(file.previewUrl));
        setFiles([]);
    };

    const removeFile = (id: string) => {
        const fileToRemove = files.find(f => f.id === id);
        if (fileToRemove) {
            URL.revokeObjectURL(fileToRemove.previewUrl);
        }
        setFiles(prev => prev.filter(f => f.id !== id));
    };

    const pendingCount = files.filter(f => f.status === 'pending').length;

    return (
        <div className="w-full h-full bg-white rounded-xl shadow-lg border border-gray-200 p-6 flex flex-col">
            <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
                    <ImageIcon className="text-blue-500" size={20} />
                    批量图片上传识别
                </h3>
                <div className="flex gap-2">
                    {files.length > 0 && (
                        <button
                            onClick={clearAll}
                            className="text-sm text-gray-500 hover:text-red-500 transition-colors px-2 py-1"
                        >
                            清空列表
                        </button>
                    )}
                    <button
                        onClick={() => fileInputRef.current?.click()}
                        className="flex items-center gap-1 text-sm text-blue-600 hover:bg-blue-50 px-3 py-1 rounded-lg transition-colors"
                    >
                        <Plus size={16} />
                        添加图片
                    </button>
                </div>
            </div>

            {files.length === 0 ? (
                <div
                    className="flex-1 border-2 border-dashed border-gray-300 rounded-xl flex flex-col items-center justify-center p-8 cursor-pointer hover:border-blue-500 hover:bg-blue-50 transition-all"
                    onClick={() => fileInputRef.current?.click()}
                    onDragOver={handleDragOver}
                    onDrop={handleDrop}
                >
                    <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mb-4">
                        <Upload className="text-blue-600" size={32} />
                    </div>
                    <p className="text-gray-600 font-medium mb-2">点击或拖拽上传图片</p>
                    <p className="text-gray-400 text-sm">支持 JPG, PNG 格式，可批量选择</p>
                </div>
            ) : (
                <div className="flex-1 flex flex-col gap-4 overflow-hidden">
                    <div className="flex-1 overflow-y-auto space-y-2 pr-2">
                        {files.map((item) => (
                            <div key={item.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-100">
                                <div className="flex items-center gap-3 overflow-hidden">
                                    <div className="w-10 h-10 bg-gray-200 rounded overflow-hidden flex-shrink-0">
                                        <img
                                            src={item.previewUrl}
                                            alt="preview"
                                            className="w-full h-full object-cover"
                                        />
                                    </div>
                                    <div className="min-w-0">
                                        <p className="text-sm font-medium text-gray-700 truncate">{item.file.name}</p>
                                        <p className="text-xs text-gray-500">{(item.file.size / 1024).toFixed(1)} KB</p>
                                    </div>
                                </div>

                                <div className="flex items-center gap-3">
                                    {item.status === 'success' && item.results && item.results.length > 0 ? (
                                        <div className="flex items-center gap-1.5 flex-wrap max-w-[200px] justify-end">
                                            {item.results.map((r) => (
                                                <span
                                                    key={r.id}
                                                    className={`text-xs font-bold px-2 py-0.5 rounded ${
                                                        r.type === 'green' ? 'bg-green-100 text-green-700' :
                                                        r.type === 'yellow' ? 'bg-yellow-100 text-yellow-700' :
                                                        'bg-blue-100 text-blue-700'
                                                    }`}
                                                >
                                                    {r.number}
                                                </span>
                                            ))}
                                            <CheckCircle size={18} className="text-green-500 flex-shrink-0" />
                                        </div>
                                    ) : item.status === 'processing' ? (
                                        <Loader2 size={18} className="animate-spin text-blue-500" />
                                    ) : item.status === 'error' ? (
                                        <div className="flex items-center gap-1 text-red-500" title={item.error}>
                                            <AlertCircle size={18} />
                                            <span className="text-xs">失败</span>
                                        </div>
                                    ) : (
                                        <button
                                            onClick={() => removeFile(item.id)}
                                            className="text-gray-400 hover:text-red-500"
                                        >
                                            <X size={18} />
                                        </button>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>

                    <div className="flex justify-center pt-2">
                        <button
                            onClick={processQueue}
                            disabled={isProcessing || pendingCount === 0}
                            className={`flex items-center gap-2 px-8 py-3 rounded-full font-medium text-white shadow-lg transition-all ${pendingCount === 0
                                ? 'bg-gray-300 cursor-default'
                                : isProcessing
                                    ? 'bg-blue-400 cursor-not-allowed'
                                    : 'bg-blue-600 hover:bg-blue-700 hover:shadow-blue-500/30'
                                }`}
                        >
                            {isProcessing ? (
                                <>
                                    <Loader2 className="animate-spin" size={20} />
                                    正在识别...
                                </>
                            ) : (
                                <>
                                    <ImageIcon size={20} />
                                    {pendingCount > 0 ? `开始识别 (${pendingCount})` : '等待添加图片'}
                                </>
                            )}
                        </button>
                    </div>
                </div>
            )}

            <input
                type="file"
                ref={fileInputRef}
                className="hidden"
                accept="image/*"
                multiple
                onChange={handleFileSelect}
            />
        </div>
    );
};
