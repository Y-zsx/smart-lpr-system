import React, { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { MainLayout } from './layouts/MainLayout';
import { DashboardPage } from './pages/DashboardPage';
import { LiveMonitorPage } from './pages/LiveMonitorPage';
import { RecordsPage } from './pages/RecordsPage';
import { AlarmsPage } from './pages/AlarmsPage';
import { SettingsPage } from './pages/SettingsPage';
import { SettingsModal } from './components/SettingsModal';
import { usePlateStore } from './store/plateStore';
import { simulationService } from './services/simulationService';
import { Settings } from 'lucide-react';
import { hapticFeedback } from './utils/mobileFeatures';

function App() {
    const { settings } = usePlateStore();
    const [showSettings, setShowSettings] = React.useState(false);

    // Global Simulation Service Management
    useEffect(() => {
        if (settings.isDemoMode) {
            simulationService.start();
        } else {
            simulationService.stop();
        }
        return () => simulationService.stop();
    }, [settings.isDemoMode]);

    // Common Header Actions (Settings only)
    const headerActions = (
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
    );

    return (
        <Router>
            <MainLayout actions={headerActions}>
                <Routes>
                    <Route path="/" element={<DashboardPage />} />
                    <Route path="/monitor" element={<LiveMonitorPage />} />
                    <Route path="/records" element={<RecordsPage />} />
                    <Route path="/alarms" element={<AlarmsPage />} />
                    <Route path="/settings" element={<SettingsPage />} />
                    <Route path="*" element={<Navigate to="/" replace />} />
                </Routes>
                
                {showSettings && (
                    <SettingsModal onClose={() => setShowSettings(false)} />
                )}
            </MainLayout>
        </Router>
    );
}

export default App;
