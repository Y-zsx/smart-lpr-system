import React, { useState, useEffect } from 'react';
import { apiClient } from '../api/client';
import { X, Upload, Plus, Trash2, AlertOctagon } from 'lucide-react';
import { useToastContext } from '../contexts/ToastContext';
import { useConfirmContext } from '../contexts/ConfirmContext';
import { useAlarmStore } from '../store/alarmStore';

interface BlacklistItem {
    id: number;
    plate_number: string;
    reason: string;
    severity: string;
}

export const BlacklistManager: React.FC<{ onClose: () => void }> = ({ onClose }) => {
    const toast = useToastContext();
    const { confirm } = useConfirmContext();
    const [items, setItems] = useState<BlacklistItem[]>([]);
    const [newItem, setNewItem] = useState({ plate_number: '', reason: '', severity: 'high' });

    const fetchList = async () => {
        try {
            const res = await apiClient.getBlacklist();
            setItems(res);
        } catch (e) {
            console.error(e);
        }
    };

    useEffect(() => { fetchList(); }, []);

    const handleAdd = async () => {
        if (!newItem.plate_number) return;
        await apiClient.addBlacklist(newItem);
        setNewItem({ plate_number: '', reason: '', severity: 'high' });
        fetchList();
        // 刷新告警列表
        void useAlarmStore.getState().fetchAlarms().catch(() => undefined);
    };

    const handleDelete = async (id: number) => {
        const result = await confirm({
            title: '删除黑名单',
            message: '确定要删除这条黑名单记录吗？',
            type: 'danger'
        });
        if (!result) return;
        await apiClient.deleteBlacklist(id);
        fetchList();
        toast.success('黑名单已删除');
        // 立即刷新告警列表
        void useAlarmStore.getState().fetchAlarms().catch(() => undefined);
    };

    const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = async (event) => {
            const text = event.target?.result as string;
            const lines = text.split('\n').slice(1); // Skip header
            const data = lines.map(line => {
                const [plate_number, reason, severity] = line.split(',');
                if (plate_number) return { plate_number: plate_number.trim(), reason: reason?.trim(), severity: severity?.trim() || 'high' };
                return null;
            }).filter(Boolean);

            if (data.length > 0) {
                await apiClient.addBlacklist(data);
                fetchList();
                toast.success(`成功导入 ${data.length} 条黑名单记录`);
                // 刷新告警列表
                void useAlarmStore.getState().fetchAlarms().catch(() => undefined);
            }
        };
        reader.readAsText(file);
    };

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
            <div className="bg-white rounded-xl w-full max-w-2xl max-h-[90dvh] sm:max-h-[80vh] flex flex-col shadow-2xl">
                <div className="p-3 sm:p-4 border-b flex justify-between items-center">
                    <h2 className="text-lg font-bold flex items-center gap-2 text-gray-800">
                        <AlertOctagon className="text-red-600" /> 黑名单管理
                    </h2>
                    <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded-full"><X size={20} /></button>
                </div>

                <div className="p-3 sm:p-4 border-b bg-gray-50 grid grid-cols-1 sm:grid-cols-6 gap-2 items-center">
                    <input
                        placeholder="车牌号"
                        className="border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500 sm:col-span-1"
                        value={newItem.plate_number}
                        onChange={e => setNewItem({ ...newItem, plate_number: e.target.value })}
                    />
                    <input
                        placeholder="原因"
                        className="border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500 sm:col-span-2"
                        value={newItem.reason}
                        onChange={e => setNewItem({ ...newItem, reason: e.target.value })}
                    />
                    <select
                        className="border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500 bg-white sm:col-span-1"
                        value={newItem.severity}
                        onChange={e => setNewItem({ ...newItem, severity: e.target.value })}
                    >
                        <option value="high">严重</option>
                        <option value="medium">警告</option>
                        <option value="low">提示</option>
                    </select>
                    <button onClick={handleAdd} className="bg-blue-600 text-white px-4 py-2 rounded-lg flex items-center justify-center gap-1 hover:bg-blue-700 transition-colors text-sm font-medium sm:col-span-1">
                        <Plus size={16} /> 添加
                    </button>

                    <label className="bg-green-600 text-white px-4 py-2 rounded-lg flex items-center justify-center gap-1 cursor-pointer hover:bg-green-700 transition-colors text-sm font-medium sm:col-span-1">
                        <Upload size={16} /> 导入CSV
                        <input type="file" accept=".csv" hidden onChange={handleImport} />
                    </label>
                </div>

                <div className="flex-1 overflow-y-auto p-0">
                    <div className="overflow-x-auto">
                        <table className="w-full min-w-[640px] text-sm text-left">
                        <thead className="text-gray-500 bg-gray-50 sticky top-0">
                            <tr>
                                <th className="p-3 font-medium">车牌</th>
                                <th className="p-3 font-medium">原因</th>
                                <th className="p-3 font-medium">等级</th>
                                <th className="p-3 font-medium text-right">操作</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {items.length === 0 ? (
                                <tr>
                                    <td colSpan={4} className="p-8 text-center text-gray-400">暂无黑名单记录</td>
                                </tr>
                            ) : items.map(item => (
                                <tr key={item.id} className="hover:bg-gray-50">
                                    <td className="p-3 font-mono font-bold text-gray-800">{item.plate_number}</td>
                                    <td className="p-3 text-gray-600">{item.reason}</td>
                                    <td className="p-3">
                                        <span className={`px-2 py-1 rounded text-xs font-medium ${item.severity === 'high' ? 'bg-red-100 text-red-700' :
                                            item.severity === 'medium' ? 'bg-orange-100 text-orange-700' : 'bg-yellow-100 text-yellow-700'
                                            }`}>
                                            {item.severity === 'high' ? '严重' : item.severity === 'medium' ? '警告' : '提示'}
                                        </span>
                                    </td>
                                    <td className="p-3 text-right">
                                        <button onClick={() => handleDelete(item.id)} className="text-gray-400 hover:text-red-500 transition-colors p-1">
                                            <Trash2 size={16} />
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    );
};
