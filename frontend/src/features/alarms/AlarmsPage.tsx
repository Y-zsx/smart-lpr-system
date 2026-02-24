import React, { useState } from 'react';
import { AlarmList } from '@/components/AlarmList';
import { BlacklistManager } from '@/components/BlacklistManager';
import { AlertOctagon } from 'lucide-react';

interface AlarmsPageProps {
    canManageBlacklist?: boolean;
}

export const AlarmsPage: React.FC<AlarmsPageProps> = ({ canManageBlacklist = true }) => {
    const [showBlacklist, setShowBlacklist] = useState(false);

    return (
        <div className="space-y-6 h-full">
            {canManageBlacklist && (
                <div className="flex justify-end">
                    <button onClick={() => setShowBlacklist(true)} className="flex items-center gap-2 px-4 py-2 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition-colors">
                        <AlertOctagon size={18} />
                        黑名单管理
                    </button>
                </div>
            )}
            <div className="grid grid-cols-1 gap-6">
                <AlarmList />
            </div>
            {showBlacklist && <BlacklistManager onClose={() => setShowBlacklist(false)} />}
        </div>
    );
};
