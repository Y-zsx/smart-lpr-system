const BACKEND_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';
const TOKEN_KEY = 'smart_lpr_token';
const DEFAULT_RETRY_TIMES = Math.max(0, Number(import.meta.env.VITE_API_RETRY_TIMES || 2));
const DEFAULT_RETRY_BASE_MS = Math.max(50, Number(import.meta.env.VITE_API_RETRY_BASE_MS || 250));
const RETRYABLE_STATUS = new Set([429, 500, 502, 503, 504]);

let authFailureHandler: (() => void) | null = null;

export function registerAuthFailureHandler(handler: (() => void) | null) {
    authFailureHandler = handler;
}

type ApiErrorPayload = {
    success?: boolean;
    code?: string;
    message?: string;
    details?: unknown;
};

export type AuthRole = 'admin' | 'viewer' | 'operator';

export interface AuthUser {
    id: string;
    username: string;
    role: AuthRole;
    displayName?: string;
}

export interface DataScope {
    all: boolean;
    cameraIds: string[];
    regionCodes: string[];
}

export interface AuthSnapshot {
    user: AuthUser;
    roles: string[];
    permissions: string[];
    dataScope: DataScope;
}

type RequestOptions = RequestInit & {
    retryTimes?: number;
    retryBaseMs?: number;
    skipAuthFailureHandler?: boolean;
};

function getStoredToken(): string | null {
    return localStorage.getItem(TOKEN_KEY);
}

function setStoredToken(token: string) {
    localStorage.setItem(TOKEN_KEY, token);
}

function clearStoredToken() {
    localStorage.removeItem(TOKEN_KEY);
}

async function buildHeaders(options?: RequestInit): Promise<Record<string, string>> {
    const headers: Record<string, string> = {
        'Content-Type': 'application/json'
    };
    const token = getStoredToken();
    if (token) {
        headers.Authorization = `Bearer ${token}`;
    }
    return {
        ...headers,
        ...(options?.headers as Record<string, string> | undefined)
    };
}

function sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function shouldRetry(status: number | null, error: unknown, attempt: number, retryTimes: number): boolean {
    if (attempt >= retryTimes) return false;
    if (status !== null) return RETRYABLE_STATUS.has(status);
    if (error instanceof DOMException && error.name === 'AbortError') return false;
    return true;
}

async function request<T = any>(endpoint: string, options?: RequestOptions): Promise<T> {
    const url = endpoint.startsWith('http') ? endpoint : `${BACKEND_URL}${endpoint}`;
    const retryTimes = options?.retryTimes ?? DEFAULT_RETRY_TIMES;
    const retryBaseMs = options?.retryBaseMs ?? DEFAULT_RETRY_BASE_MS;
    let lastError: unknown;

    for (let attempt = 0; attempt <= retryTimes; attempt++) {
        try {
            const res = await fetch(url, {
                ...options,
                headers: await buildHeaders(options)
            });

            if (!res.ok) {
                let payload: ApiErrorPayload | null = null;
                try {
                    payload = await res.json();
                } catch (_err) {
                    payload = null;
                }

                if (res.status === 401) {
                    clearStoredToken();
                    if (!options?.skipAuthFailureHandler && authFailureHandler) {
                        authFailureHandler();
                    }
                    throw new Error(payload?.message || '登录状态已过期，请重新登录');
                }

                const message = payload?.message || `请求失败 (${res.status})`;
                const httpError = new Error(message);
                if (!shouldRetry(res.status, httpError, attempt, retryTimes)) {
                    throw httpError;
                }
                await sleep(retryBaseMs * Math.pow(2, attempt));
                continue;
            }

            const contentType = res.headers.get('content-type') || '';
            if (contentType.includes('application/json')) {
                return res.json();
            }
            return (res.blob() as unknown) as T;
        } catch (error) {
            lastError = error;
            if (!shouldRetry(null, error, attempt, retryTimes)) {
                throw error;
            }
            await sleep(retryBaseMs * Math.pow(2, attempt));
        }
    }
    throw lastError instanceof Error ? lastError : new Error('请求失败');
}

// 获取带认证信息的请求头辅助函数（兼容旧调用）
export const getHeaders = () => {
    const headers: Record<string, string> = {
        'Content-Type': 'application/json'
    };
    const token = getStoredToken();
    if (token) {
        headers.Authorization = `Bearer ${token}`;
    }
    return headers;
};

export const apiClient = {
    async login(username: string, password: string) {
        const payload = await request<{ success: boolean; data: { token: string } & AuthSnapshot }>('/api/auth/login', {
            method: 'POST',
            body: JSON.stringify({ username, password })
        });
        if (payload?.data?.token) {
            setStoredToken(payload.data.token);
        }
        return payload;
    },

    logout() {
        clearStoredToken();
    },

    async getUserInfo() {
        const payload = await request<{ success: boolean; data: AuthSnapshot }>('/api/auth/me', {
            method: 'GET'
        });
        return payload.data;
    },

    async getHistory(start?: number, end?: number, type?: string, groupBy?: string, options?: RequestOptions) {
        let url = '/api/plates';
        const params = new URLSearchParams();
        if (start && end) {
            params.append('start', start.toString());
            params.append('end', end.toString());
        }
        if (type) params.append('type', type);
        if (groupBy) params.append('groupBy', groupBy);
        const queryString = params.toString();
        if (queryString) url += `?${queryString}`;
        return request(url, options);
    },

    async savePlate(plate: any) {
        return request('/api/plates', {
            method: 'POST',
            body: JSON.stringify(plate)
        });
    },

    async deletePlate(id: string) {
        return request(`/api/plates?id=${encodeURIComponent(id)}`, { method: 'DELETE' });
    },

    async deletePlatesByNumber(plateNumber: string) {
        return request(`/api/plates/by-number?plateNumber=${encodeURIComponent(plateNumber)}`, { method: 'DELETE' });
    },

    async getUploadUrl(filename: string) {
        return request<{ upload_url: string; requiredHeaders: Record<string, string>; key: string }>('/api/upload-url', {
            method: 'POST',
            body: JSON.stringify({ filename })
        });
    },

    async uploadFile(file: File) {
        const { upload_url, requiredHeaders, key } = await this.getUploadUrl(file.name);
        await fetch(upload_url, {
            method: 'PUT',
            headers: requiredHeaders,
            body: file
        });
        return key;
    },

    async getDailyStats(endDate?: number) {
        const url = endDate ? `/api/stats/daily?end=${endDate}` : '/api/stats/daily';
        return request(url);
    },

    async getDashboardStats(date?: number): Promise<any> {
        const url = date ? `/api/stats/dashboard?date=${date}` : '/api/stats/dashboard';
        return request(url);
    },

    async getRegionStats(range: 'daily' | 'total' = 'total', date?: number) {
        const url = date ? `/api/stats/region?range=${range}&date=${date}` : `/api/stats/region?range=${range}`;
        return request(url);
    },

    async exportRecords(start?: number, end?: number, search?: string) {
        let url = '/api/export-records';
        const params = new URLSearchParams();
        if (start && end) {
            params.append('start', start.toString());
            params.append('end', end.toString());
        }
        if (search) params.append('search', search);
        const queryString = params.toString();
        if (queryString) url += `?${queryString}`;
        return request<Blob>(url);
    },

    async getBlacklist() {
        return request('/api/blacklist');
    },

    async addBlacklist(data: any | any[]) {
        return request('/api/blacklist', {
            method: 'POST',
            body: JSON.stringify(data)
        });
    },

    async deleteBlacklist(id: number) {
        return request(`/api/blacklist?id=${id}`, {
            method: 'DELETE'
        });
    },

    async getAlarms(options?: RequestOptions) {
        return request('/api/alarms', options);
    },

    async markAlarmAsRead(id: number) {
        return request(`/api/alarms/${id}/read`, {
            method: 'PUT'
        });
    },

    async deleteAlarm(id: number) {
        return request(`/api/alarms/${id}`, {
            method: 'DELETE'
        });
    },

    async deleteAlarmsByPlate(plateNumber: string) {
        return request(`/api/alarms/plate/${encodeURIComponent(plateNumber)}`, {
            method: 'DELETE'
        });
    },

    async getCameras() {
        return request('/api/cameras');
    },

    async addCamera(data: any) {
        return request('/api/cameras', {
            method: 'POST',
            body: JSON.stringify(data)
        });
    },

    async updateCamera(id: string, data: any) {
        return request(`/api/cameras/${encodeURIComponent(id)}`, {
            method: 'PUT',
            body: JSON.stringify(data)
        });
    },

    async deleteCamera(id: string) {
        return request(`/api/cameras?id=${encodeURIComponent(id)}`, {
            method: 'DELETE'
        });
    },

    async fetch(endpoint: string, options?: RequestInit) {
        const url = endpoint.startsWith('http') ? endpoint : `${BACKEND_URL}${endpoint}`;
        return fetch(url, {
            ...options,
            headers: {
                ...(await buildHeaders(options)),
                ...(options?.headers as Record<string, string> | undefined)
            }
        });
    },

    getBackendUrl() {
        return BACKEND_URL;
    },

    getToken() {
        return getStoredToken();
    },

    getImageUrl(path?: string): string {
        if (!path) return 'https://via.placeholder.com/400x300?text=No+Image';
        if (path.startsWith('http://') || path.startsWith('https://')) return path;
        if (path.startsWith('uploads/')) {
            return `${BACKEND_URL}/${path}`;
        }
        if (path.startsWith('data:') || path.startsWith('blob:')) {
            return path;
        }
        return `${BACKEND_URL}/${path}`;
    },

    async getIamUsers() {
        return request<Array<{ id: string; username: string; displayName: string; status: string; roles: string[] }>>('/api/iam/users');
    },

    async getIamRoles() {
        return request<Array<{ id: string; roleKey: string; roleName: string; description?: string; permissions: string[]; dataScope: DataScope }>>('/api/iam/roles');
    },

    async getIamPermissions() {
        return request<Array<{ id: string; key: string; name: string; group: string }>>('/api/iam/permissions');
    },

    async setUserRoles(userId: string, roleKeys: string[]) {
        return request('/api/iam/users/' + encodeURIComponent(userId) + '/roles', {
            method: 'PUT',
            body: JSON.stringify({ roleKeys })
        });
    },

    async setRolePermissions(roleKey: string, permissionKeys: string[]) {
        return request('/api/iam/roles/' + encodeURIComponent(roleKey) + '/permissions', {
            method: 'PUT',
            body: JSON.stringify({ permissionKeys })
        });
    },

    async setRoleDataScope(roleKey: string, dataScope: DataScope) {
        return request('/api/iam/roles/' + encodeURIComponent(roleKey) + '/data-scope', {
            method: 'PUT',
            body: JSON.stringify(dataScope)
        });
    }
};
