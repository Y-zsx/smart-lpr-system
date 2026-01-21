import React from 'react';

interface StatCardProps {
    label: string;
    value: number;
    icon: React.ReactNode;
    color: string;
}

export const StatCard: React.FC<StatCardProps> = ({ label, value, icon, color }) => (
    <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm flex items-center justify-between transition-transform active:scale-95 touch-manipulation">
        <div>
            <p className="text-sm text-gray-500 mb-1">{label}</p>
            <p className="text-2xl font-bold text-gray-800">{value}</p>
        </div>
        <div className={`p-3 rounded-lg ${color} bg-opacity-10`}>
            <div className={color.replace('bg-', 'text-')}>{icon}</div>
        </div>
    </div>
);
