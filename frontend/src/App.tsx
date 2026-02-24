import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { MainLayout } from './layouts/MainLayout';
import { DashboardPage } from '@/features/dashboard';
import { LiveMonitorPage } from '@/features/monitor';
import { RecordsPage } from '@/features/records';
import { AlarmsPage } from '@/features/alarms';
import { SettingsPage } from './pages/SettingsPage';
import { IamPage } from '@/features/iam';
import { SettingsModal } from './components/SettingsModal';
import { usePlateStore } from './store/plateStore';
import { simulationService } from './services/simulationService';
import { AlertTriangle, FileText, LayoutDashboard, LogIn, LogOut, MonitorPlay, Settings, ShieldAlert, ShieldCheck, Users } from 'lucide-react';
import { hapticFeedback } from './utils/mobileFeatures';
import { ToastProvider } from './contexts/ToastContext';
import { ConfirmProvider } from './contexts/ConfirmContext';
import { useToastContext } from './contexts/ToastContext';
import { AuthProvider, useAuth, PermissionGuard } from '@/features/auth';

function AppContent() {
    const { settings } = usePlateStore();
    const toast = useToastContext();
    const auth = useAuth();
    const [showSettings, setShowSettings] = useState(false);
    const [showLoginModal, setShowLoginModal] = useState(false);
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [isLoggingIn, setIsLoggingIn] = useState(false);

    useEffect(() => {
        if (settings.isDemoMode) {
            simulationService.start();
        } else {
            simulationService.stop();
        }
        return () => simulationService.stop();
    }, [settings.isDemoMode]);

    const handleLogin = async () => {
        if (!username.trim() || !password.trim()) {
            toast.warning('请输入账号和密码');
            return;
        }
        try {
            setIsLoggingIn(true);
            await auth.login(username.trim(), password);
            toast.success('鉴权成功，已登录');
            setPassword('');
            setShowLoginModal(false);
        } catch (error) {
            toast.error(error instanceof Error ? error.message : '登录失败');
        } finally {
            setIsLoggingIn(false);
        }
    };

    const handleLogout = () => {
        auth.logout();
        toast.info('已退出登录');
    };

    const roleDesc = useMemo(() => {
        if (!auth.user?.role) return '访客';
        if (auth.user.role === 'admin') return '管理员';
        if (auth.user.role === 'operator') return '值班员';
        return '只读用户';
    }, [auth.user?.role]);

    const navItems = useMemo(() => {
        const items = [];
        if (auth.hasPermission('monitor.view')) items.push({ path: '/monitor', label: '实时监控', icon: <MonitorPlay size={20} /> });
        if (auth.hasPermission('dashboard.view')) items.push({ path: '/', label: '仪表盘', icon: <LayoutDashboard size={20} /> });
        if (auth.hasPermission('records.view')) items.push({ path: '/records', label: '识别记录', icon: <FileText size={20} /> });
        if (auth.hasPermission('alarms.view')) items.push({ path: '/alarms', label: '告警中心', icon: <AlertTriangle size={20} /> });
        if (auth.hasPermission('iam.manage')) items.push({ path: '/iam', label: '权限管理', icon: <Users size={20} /> });
        return items;
    }, [auth]);

    const unauthorizedFallback = (
        <div className="bg-white rounded-xl border border-gray-100 p-8 text-center">
            <h3 className="text-lg font-semibold text-gray-800">当前账号没有访问权限</h3>
            <p className="text-sm text-gray-500 mt-2">请使用具备对应权限的账号登录。</p>
            <button
                onClick={() => setShowLoginModal(true)}
                className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
                去登录
            </button>
        </div>
    );

    const authBadge = auth.status === 'authenticated'
        ? {
            text: '已认证',
            className: 'text-emerald-700 bg-emerald-100',
            icon: <ShieldCheck size={14} />
        }
        : auth.status === 'checking'
            ? {
                text: '鉴权检查中',
                className: 'text-amber-700 bg-amber-100',
                icon: <ShieldAlert size={14} />
            }
            : {
                text: '未认证',
                className: 'text-rose-700 bg-rose-100',
                icon: <ShieldAlert size={14} />
            };

    const headerActions = (
        <>
            <div className={`hidden md:flex items-center gap-1.5 px-2.5 py-1.5 rounded-full text-xs font-medium ${authBadge.className}`}>
                {authBadge.icon}
                <span>{authBadge.text}</span>
            </div>
            <div className="hidden md:block text-xs text-gray-500">
                {auth.user?.username ? `${auth.user.username} (${roleDesc})` : '未登录用户'}
            </div>
            {auth.status === 'authenticated' ? (
                <button
                    onClick={handleLogout}
                    className="p-2 text-gray-600 bg-gray-100 rounded-full hover:bg-gray-200 transition-colors"
                    title="退出登录"
                >
                    <LogOut size={18} />
                </button>
            ) : (
                <button
                    onClick={() => setShowLoginModal(true)}
                    className="p-2 text-gray-600 bg-gray-100 rounded-full hover:bg-gray-200 transition-colors"
                    title="登录"
                >
                    <LogIn size={18} />
                </button>
            )}
            <button
                onClick={() => {
                    if (settings.enableHaptics) hapticFeedback('medium');
                    setShowSettings(true);
                }}
                className="p-2 text-gray-600 bg-gray-100 rounded-full hover:bg-gray-200 transition-colors"
                title="系统设置"
            >
                <Settings size={20} />
            </button>
        </>
    );

    return (
        <Router>
            <MainLayout actions={headerActions} navItems={navItems}>
                <Routes>
                    <Route path="/" element={<PermissionGuard permission="dashboard.view" fallback={unauthorizedFallback}><DashboardPage /></PermissionGuard>} />
                    <Route path="/monitor" element={<PermissionGuard permission="monitor.view" fallback={unauthorizedFallback}><LiveMonitorPage canManageCamera={auth.hasPermission('camera.manage')} /></PermissionGuard>} />
                    <Route path="/records" element={<PermissionGuard permission="records.view" fallback={unauthorizedFallback}><RecordsPage /></PermissionGuard>} />
                    <Route path="/alarms" element={<PermissionGuard permission="alarms.view" fallback={unauthorizedFallback}><AlarmsPage canManageBlacklist={auth.hasPermission('blacklist.manage')} /></PermissionGuard>} />
                    <Route path="/iam" element={<PermissionGuard permission="iam.manage" fallback={unauthorizedFallback}><IamPage /></PermissionGuard>} />
                    <Route path="/settings" element={<SettingsPage />} />
                    <Route path="*" element={<Navigate to="/" replace />} />
                </Routes>

                {showSettings && (
                    <SettingsModal onClose={() => setShowSettings(false)} />
                )}

                {showLoginModal && (
                    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
                        <div className="w-full max-w-sm bg-white rounded-xl shadow-xl border border-gray-100 p-5">
                            <h3 className="text-lg font-bold text-gray-800">账号登录</h3>
                            <p className="text-sm text-gray-500 mt-1">
                                管理员可执行增删改，viewer 账号仅可查看数据。
                            </p>
                            <div className="mt-4 space-y-3">
                                <div>
                                    <label className="text-xs text-gray-500 block mb-1">账号</label>
                                    <input
                                        value={username}
                                        onChange={(e) => setUsername(e.target.value)}
                                        className="w-full px-3 py-2 rounded-lg border border-gray-200 focus:outline-none focus:border-blue-500"
                                        placeholder="admin / viewer"
                                    />
                                </div>
                                <div>
                                    <label className="text-xs text-gray-500 block mb-1">密码</label>
                                    <input
                                        type="password"
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        className="w-full px-3 py-2 rounded-lg border border-gray-200 focus:outline-none focus:border-blue-500"
                                        placeholder="请输入密码"
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter') handleLogin();
                                        }}
                                    />
                                </div>
                            </div>
                            <div className="flex gap-2 mt-5">
                                <button
                                    onClick={() => setShowLoginModal(false)}
                                    className="flex-1 px-3 py-2 rounded-lg bg-gray-100 text-gray-600 hover:bg-gray-200"
                                >
                                    取消
                                </button>
                                <button
                                    onClick={handleLogin}
                                    disabled={isLoggingIn}
                                    className="flex-1 px-3 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-60"
                                >
                                    {isLoggingIn ? '登录中...' : '登录'}
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </MainLayout>
        </Router>
    );
}

function App() {
    return (
        <ToastProvider>
            <ConfirmProvider>
                <AuthProvider>
                    <AppContent />
                </AuthProvider>
            </ConfirmProvider>
        </ToastProvider>
    );
}

export default App;
