import React from 'react';
import { useAuth } from './AuthContext';

interface PermissionGuardProps {
    permission?: string;
    role?: string;
    fallback?: React.ReactNode;
    children: React.ReactNode;
}

export const PermissionGuard: React.FC<PermissionGuardProps> = ({ permission, role, fallback = null, children }) => {
    const auth = useAuth();

    const allowed = (() => {
        if (auth.status !== 'authenticated') return false;
        if (permission && !auth.hasPermission(permission)) return false;
        if (role && !auth.hasRole(role)) return false;
        return true;
    })();

    if (!allowed) return <>{fallback}</>;
    return <>{children}</>;
};
