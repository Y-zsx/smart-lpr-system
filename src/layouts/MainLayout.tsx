import React from 'react';
import { Car, Menu, Bell } from 'lucide-react';
import { SystemStatus } from '../components/SystemStatus';

interface MainLayoutProps {
    children: React.ReactNode;
    title?: string;
    actions?: React.ReactNode;
}

export const MainLayout: React.FC<MainLayoutProps> = ({ children, title = "智能车牌识别系统", actions }) => {
    return (
        <div className="min-h-screen bg-gray-50 flex flex-col">
            {/* Mobile/Desktop Header */}
            <header className="sticky top-0 z-50 bg-white border-b border-gray-200 shadow-sm pt-[env(safe-area-inset-top)]">
                <div className="max-w-7xl mx-auto px-4 h-14 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <div className="bg-blue-600 p-1.5 rounded-lg">
                            <Car className="text-white w-5 h-5" />
                        </div>
                        <h1 className="text-lg font-bold text-gray-900 truncate hidden sm:block">{title}</h1>
                        <h1 className="text-lg font-bold text-gray-900 truncate sm:hidden">车牌识别</h1>
                    </div>

                    <div className="flex items-center gap-3">
                        <SystemStatus />
                        <div className="w-px h-6 bg-gray-200 hidden sm:block"></div>
                        {actions}
                    </div>
                </div>
            </header>

            {/* Main Content */}
            <main className="flex-1 w-full max-w-7xl mx-auto p-4 md:p-6 lg:p-8 pb-[env(safe-area-inset-bottom)] space-y-6">
                {children}
            </main>
        </div>
    );
};
