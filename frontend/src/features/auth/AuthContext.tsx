import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { apiClient, AuthRole, AuthSnapshot, AuthUser, getApiErrorStatus, registerAuthFailureHandler } from '@/api/client';

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
const unauthenticatedState: AuthState = {
    status: 'unauthenticated',
    user: null,
    roles: [],
    permissions: [],
    dataScope: defaultDataScope
};

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
        if (!apiClient.getToken()) {
            setState(unauthenticatedState);
            return;
        }
        try {
            const snapshot = await apiClient.getUserInfo();
            setState({
                status: 'authenticated',
                user: snapshot.user,
                roles: snapshot.roles || [],
                permissions: snapshot.permissions || [],
                dataScope: snapshot.dataScope || defaultDataScope
            });
        } catch (error) {
            const status = getApiErrorStatus(error);
            if (status === 401) {
                setState(unauthenticatedState);
                return;
            }
            setState(prev => (prev.status === 'authenticated' ? prev : unauthenticatedState));
        }
    }, []);

    useEffect(() => {
        refresh();
    }, [refresh]);

    useEffect(() => {
        registerAuthFailureHandler(() => {
            setState(unauthenticatedState);
        });
        return () => registerAuthFailureHandler(null);
    }, []);

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
        setState(unauthenticatedState);
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
