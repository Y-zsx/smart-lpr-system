import React from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { Car, LayoutDashboard, MonitorPlay, FileText, AlertTriangle, Settings, Menu, X } from 'lucide-react';
import { SystemStatus } from '../components/SystemStatus';
import { useState } from 'react';

interface MainLayoutProps {
    children: React.ReactNode;
    actions?: React.ReactNode;
}

export const MainLayout: React.FC<MainLayoutProps> = ({ children, actions }) => {
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
    const location = useLocation();

    const navItems = [
        { path: '/', label: '仪表盘', icon: <LayoutDashboard size={20} /> },
        { path: '/monitor', label: '实时监控', icon: <MonitorPlay size={20} /> },
        { path: '/records', label: '识别记录', icon: <FileText size={20} /> },
        { path: '/alarms', label: '告警中心', icon: <AlertTriangle size={20} /> },
    ];

    return (
        <div className="min-h-screen bg-gray-50 flex">
            {/* Sidebar (Desktop) */}
            <aside className="hidden md:flex flex-col w-64 bg-white border-r border-gray-200 fixed h-full z-30">
                <div className="h-16 flex items-center px-6 border-b border-gray-200">
                    <div className="bg-blue-600 p-1.5 rounded-lg mr-3">
                        <Car className="text-white w-5 h-5" />
                    </div>
                    <h1 className="text-lg font-bold text-gray-900">智能车牌识别</h1>
                </div>

                <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
                    {navItems.map((item) => (
                        <NavLink
                            key={item.path}
                            to={item.path}
                            className={({ isActive }) =>
                                `flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${isActive
                                    ? 'bg-blue-50 text-blue-600 font-medium'
                                    : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                                }`
                            }
                        >
                            {item.icon}
                            <span>{item.label}</span>
                        </NavLink>
                    ))}
                </nav>

                <div className="p-4 border-t border-gray-200">
                    <div className="flex items-center gap-3 px-4 py-3 text-gray-500">
                        <SystemStatus />
                    </div>
                </div>
            </aside>

            {/* Mobile Sidebar Overlay */}
            {isMobileMenuOpen && (
                <div 
                    className="fixed inset-0 bg-black/50 z-40 md:hidden"
                    onClick={() => setIsMobileMenuOpen(false)}
                />
            )}

            {/* Sidebar (Mobile) */}
            <aside className={`fixed inset-y-0 left-0 z-50 w-64 bg-white border-r border-gray-200 transform transition-transform duration-200 ease-in-out md:hidden ${
                isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'
            }`}>
                <div className="h-16 flex items-center justify-between px-6 border-b border-gray-200">
                    <div className="flex items-center">
                        <div className="bg-blue-600 p-1.5 rounded-lg mr-3">
                            <Car className="text-white w-5 h-5" />
                        </div>
                        <h1 className="text-lg font-bold text-gray-900">车牌识别</h1>
                    </div>
                    <button onClick={() => setIsMobileMenuOpen(false)} className="text-gray-500">
                        <X size={24} />
                    </button>
                </div>
                <nav className="flex-1 p-4 space-y-1">
                    {navItems.map((item) => (
                        <NavLink
                            key={item.path}
                            to={item.path}
                            onClick={() => setIsMobileMenuOpen(false)}
                            className={({ isActive }) =>
                                `flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${isActive
                                    ? 'bg-blue-50 text-blue-600 font-medium'
                                    : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                                }`
                            }
                        >
                            {item.icon}
                            <span>{item.label}</span>
                        </NavLink>
                    ))}
                </nav>
            </aside>

            {/* Main Content Area */}
            <div className="flex-1 flex flex-col md:pl-64 min-h-screen transition-all duration-200">
                {/* Header */}
                <header className="sticky top-0 z-20 bg-white/80 backdrop-blur-md border-b border-gray-200 h-16 px-4 md:px-8 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <button 
                            className="md:hidden p-2 -ml-2 text-gray-600 hover:bg-gray-100 rounded-lg"
                            onClick={() => setIsMobileMenuOpen(true)}
                        >
                            <Menu size={24} />
                        </button>
                        <h2 className="text-xl font-semibold text-gray-800">
                            {navItems.find(i => i.path === location.pathname)?.label || '系统'}
                        </h2>
                    </div>
                    
                    <div className="flex items-center gap-3">
                        {actions}
                    </div>
                </header>

                {/* Page Content */}
                <main className="flex-1 p-4 md:p-8 overflow-x-hidden">
                    {children}
                </main>
            </div>
        </div>
    );
};
