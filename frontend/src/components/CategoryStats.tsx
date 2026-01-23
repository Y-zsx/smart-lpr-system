import React from 'react';
import { usePlateStore } from '../store/plateStore';
import { ShieldCheck, Zap, Car, AlertCircle } from 'lucide-react';

interface CategoryStatsProps {
    onCategoryClick: (type: string, label: string) => void;
}

export const CategoryStats: React.FC<CategoryStatsProps> = ({ onCategoryClick }) => {
    const { stats } = usePlateStore();

    const categories = [
        {
            id: 'blue',
            label: '蓝牌车辆',
            count: stats.blue,
            icon: <ShieldCheck size={18} />,
            color: 'bg-blue-500',
            textColor: 'text-blue-600',
            bgColor: 'bg-blue-50'
        },
        {
            id: 'green',
            label: '新能源',
            count: stats.green,
            icon: <Zap size={18} />,
            color: 'bg-green-500',
            textColor: 'text-green-600',
            bgColor: 'bg-green-50'
        },
        {
            id: 'yellow',
            label: '黄牌车辆',
            count: stats.yellow,
            icon: <Car size={18} />,
            color: 'bg-yellow-500',
            textColor: 'text-yellow-600',
            bgColor: 'bg-yellow-50'
        },
        {
            id: 'other',
            label: '其他车辆',
            count: stats.other,
            icon: <AlertCircle size={18} />,
            color: 'bg-gray-500',
            textColor: 'text-gray-600',
            bgColor: 'bg-gray-50'
        }
    ];

    return (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
            <h3 className="text-lg font-semibold text-gray-800 mb-4">车辆分类详情</h3>
            <div className="space-y-3">
                {categories.map((cat) => (
                    <div
                        key={cat.id}
                        onClick={() => onCategoryClick(cat.id, cat.label)}
                        className="flex items-center justify-between p-3 rounded-lg hover:bg-gray-50 transition-colors border border-transparent hover:border-gray-100 cursor-pointer group"
                    >
                        <div className="flex items-center gap-3">
                            <div className={`p-2 rounded-lg ${cat.bgColor} ${cat.textColor} group-hover:scale-110 transition-transform`}>
                                {cat.icon}
                            </div>
                            <span className="font-medium text-gray-700">{cat.label}</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <span className="text-xl font-bold text-gray-900">{cat.count}</span>
                            <span className="text-xs text-gray-400">辆</span>
                        </div>
                    </div>
                ))}
            </div>

            <div className="mt-4 pt-4 border-t border-gray-100">
                <div className="flex justify-between items-center text-sm">
                    <span className="text-gray-500">总计</span>
                    <span className="font-bold text-gray-900">{stats.total} 辆</span>
                </div>
                <div className="mt-2 h-2 bg-gray-100 rounded-full overflow-hidden flex">
                    {stats.total > 0 && (
                        <>
                            <div style={{ width: `${(stats.blue / stats.total) * 100}%` }} className="bg-blue-500 h-full" />
                            <div style={{ width: `${(stats.green / stats.total) * 100}%` }} className="bg-green-500 h-full" />
                            <div style={{ width: `${(stats.yellow / stats.total) * 100}%` }} className="bg-yellow-500 h-full" />
                            <div style={{ width: `${(stats.other / stats.total) * 100}%` }} className="bg-gray-500 h-full" />
                        </>
                    )}
                </div>
            </div>
        </div>
    );
};
