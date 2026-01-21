import React from 'react';

interface StatCardProps {
    label: string;
    value: number;
    icon: React.ReactNode;
    color: string;
    trend?: string;
    trendDirection?: 'up' | 'down' | 'neutral';
}

export const StatCard: React.FC<StatCardProps> = ({ label, value, icon, color, trend, trendDirection }) => (
    <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm flex flex-col justify-between transition-all hover:shadow-md active:scale-95 touch-manipulation h-full">
        <div className="flex items-center justify-between mb-2">
            <div className={`p-2.5 rounded-lg ${color} bg-opacity-10`}>
                <div className={color.replace('bg-', 'text-')}>{icon}</div>
            </div>
            {trend && (
                <div className={`flex items-center text-xs font-medium px-2 py-1 rounded-full ${
                    trendDirection === 'up' ? 'text-green-600 bg-green-50' : 
                    trendDirection === 'down' ? 'text-red-600 bg-red-50' : 'text-gray-600 bg-gray-50'
                }`}>
                    {trendDirection === 'up' ? '↑' : trendDirection === 'down' ? '↓' : '-'} {trend}
                </div>
            )}
        </div>
        <div>
            <p className="text-2xl font-bold text-gray-800 mb-1">{value}</p>
            <p className="text-sm text-gray-500">{label}</p>
        </div>
    </div>
);
