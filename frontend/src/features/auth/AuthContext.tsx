import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { apiClient, AuthRole, AuthSnapshot, AuthUser } from '@/api/client';

interface AuthState {
    status: 'checking' | 'authenticated' | 'unauthenticated';
    user: AuthUser | null;
    roles: string[];
    permissions: string[];
    dataScope: AuthSnapshot['dataScope'];
}

interface AuthContextType extends AuthState {
    login: (username: string, password: string) => Promise<void>;
    logout: () => void;
    refresh: () => Promise<void>;
    hasPermission: (permission: string) => boolean;
    hasRole: (roleKey: string) => boolean;
    isAdmin: () => boolean;
}

const defaultDataScope = { all: false, cameraIds: [], regionCodes: [] };

const AuthContext = createContext<AuthContextType | null>(null);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [state, setState] = useState<AuthState>({
        status: 'checking',
        user: null,
        roles: [],
        permissions: [],
        dataScope: defaultDataScope
    });

    const refresh = useCallback(async () => {
        try {
            const snapshot = await apiClient.getUserInfo();
            setState({
                status: 'authenticated',
                user: snapshot.user,
                roles: snapshot.roles || [],
                permissions: snapshot.permissions || [],
                dataScope: snapshot.dataScope || defaultDataScope
            });
        } catch (_error) {
            setState({
                status: 'unauthenticated',
                user: null,
                roles: [],
                permissions: [],
                dataScope: defaultDataScope
            });
        }
    }, []);

    useEffect(() => {
        refresh();
    }, [refresh]);

    const login = useCallback(async (username: string, password: string) => {
        const payload = await apiClient.login(username, password);
        const snapshot = payload.data;
        setState({
            status: 'authenticated',
            user: snapshot.user,
            roles: snapshot.roles || [],
            permissions: snapshot.permissions || [],
            dataScope: snapshot.dataScope || defaultDataScope
        });
    }, []);

    const logout = useCallback(() => {
        apiClient.logout();
        setState({
            status: 'unauthenticated',
            user: null,
            roles: [],
            permissions: [],
            dataScope: defaultDataScope
        });
    }, []);

    const value = useMemo<AuthContextType>(() => ({
        ...state,
        login,
        logout,
        refresh,
        hasPermission: (permission: string) => state.permissions.includes(permission),
        hasRole: (roleKey: string) => state.roles.includes(roleKey),
        isAdmin: () => state.roles.includes('admin') || state.user?.role === ('admin' as AuthRole)
    }), [state, login, logout, refresh]);

    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error('useAuth must be used within AuthProvider');
    }
    return context;
};
