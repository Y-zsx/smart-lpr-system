const runtimeOrigin = typeof window !== 'undefined' ? window.location.origin : '';
const isLocalRuntime = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(runtimeOrigin);
const CLOUD_BACKEND_URL = 'https://smartlpr.cloud';
const LOCAL_BACKEND_URL = 'http://localhost:8000';
const API_BASE_OVERRIDE_KEY = 'smart_lpr_api_base_override';
const configuredBackendUrl = (import.meta.env.VITE_API_BASE_URL || '').trim();
const TOKEN_KEY = 'smart_lpr_token';
const DEFAULT_RETRY_TIMES = Math.max(0, Number(import.meta.env.VITE_API_RETRY_TIMES || 2));
const DEFAULT_RETRY_BASE_MS = Math.max(50, Number(import.meta.env.VITE_API_RETRY_BASE_MS || 250));
const RETRYABLE_STATUS = new Set([429, 500, 502, 503, 504]);

let authFailureHandler: (() => void) | null = null;
let activeBackendUrl = resolveInitialBackendUrl();

export function registerAuthFailureHandler(handler: (() => void) | null) {
    authFailureHandler = handler;
}

function normalizeBaseUrl(url?: string): string {
    if (!url) return '';
    // 兼容把后端地址配置成 https://host/api 的场景，避免拼接出 /api/api/*
    return url.trim().replace(/\/+$/, '').replace(/\/api$/i, '');
}

function getApiBaseOverride(): string {
    if (typeof window === 'undefined') return '';
    return normalizeBaseUrl(localStorage.getItem(API_BASE_OVERRIDE_KEY) || '');
}

function resolveInitialBackendUrl(): string {
    const override = getApiBaseOverride();
    if (override) return override;
    if (configuredBackendUrl) return normalizeBaseUrl(configuredBackendUrl);
    if (isLocalRuntime) return LOCAL_BACKEND_URL;
    if (runtimeOrigin) return normalizeBaseUrl(runtimeOrigin);
    return CLOUD_BACKEND_URL;
}

function getBackendCandidates(): string[] {
    const candidates = new Set<string>();
    const override = getApiBaseOverride();
    if (override) candidates.add(override);
    if (activeBackendUrl) candidates.add(activeBackendUrl);
    if (configuredBackendUrl) candidates.add(normalizeBaseUrl(configuredBackendUrl));
    if (isLocalRuntime) {
        candidates.add(LOCAL_BACKEND_URL);
    } else {
        if (runtimeOrigin) candidates.add(normalizeBaseUrl(runtimeOrigin));
        candidates.add(CLOUD_BACKEND_URL);
    }
    return Array.from(candidates).filter(Boolean);
}

function buildApiUrl(baseUrl: string, endpoint: string): string {
    return `${normalizeBaseUrl(baseUrl)}${endpoint}`;
}

function inferFilenameFromMediaPath(path?: string): string {
    if (!path) return `media-${Date.now()}.jpg`;
    const normalized = path.split('?')[0] || path;
    const last = decodeURIComponent(normalized.split('/').pop() || '');
    const safe = last.replace(/[<>:"/\\|?*\x00-\x1F]/g, '_');
    if (!safe) return `media-${Date.now()}.jpg`;
    if (safe.includes('.')) return safe;
    return `${safe}.jpg`;
}

type ApiErrorPayload = {
    success?: boolean;
    code?: string;
    message?: string;
    details?: unknown;
};

export class ApiRequestError extends Error {
    status?: number;
    code?: string;
    details?: unknown;

    constructor(message: string, options?: { status?: number; code?: string; details?: unknown }) {
        super(message);
        this.name = 'ApiRequestError';
        this.status = options?.status;
        this.code = options?.code;
        this.details = options?.details;
    }
}

export function getApiErrorStatus(error: unknown): number | undefined {
    if (error instanceof ApiRequestError) {
        return error.status;
    }
    return undefined;
}

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

export type StreamVendor = 'hikvision' | 'dahua' | 'uniview' | 'axis' | 'custom';
export type StreamProtocol = 'rtsp' | 'http';
export type AlarmMediaStatus = 'pending' | 'processing' | 'ready' | 'failed';
export interface AlarmMedia {
    id: number;
    alarmId?: number;
    recordId?: string;
    plateNumber?: string;
    cameraId?: string;
    mediaType: 'video' | 'image';
    mediaPath?: string;
    durationSec?: number;
    sizeBytes?: number;
    status: AlarmMediaStatus;
    errorMessage?: string;
    createdAt: number;
    updatedAt: number;
}

export interface UploadedMedia {
    path: string;
    playUrl: string;
    downloadUrl: string;
}
export interface OnvifDiscoveredDevice {
    endpoint: string;
    xaddrs: string[];
    scopes: string[];
    types: string[];
    ip?: string;
    name?: string;
    location?: string;
    vendorGuess: StreamVendor;
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
    const retryTimes = options?.retryTimes ?? DEFAULT_RETRY_TIMES;
    const retryBaseMs = options?.retryBaseMs ?? DEFAULT_RETRY_BASE_MS;
    const requestWithRetry = async (url: string): Promise<T> => {
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
                        throw new ApiRequestError(payload?.message || '登录状态已过期，请重新登录', {
                            status: 401,
                            code: payload?.code,
                            details: payload?.details
                        });
                    }

                    const message = payload?.message || `请求失败 (${res.status})`;
                    const httpError = new ApiRequestError(message, {
                        status: res.status,
                        code: payload?.code,
                        details: payload?.details
                    });
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
                const status = getApiErrorStatus(error) ?? null;
                if (!shouldRetry(status, error, attempt, retryTimes)) {
                    throw error;
                }
                await sleep(retryBaseMs * Math.pow(2, attempt));
            }
        }
        throw lastError instanceof Error ? lastError : new Error('请求失败');
    };

    if (endpoint.startsWith('http')) {
        return requestWithRetry(endpoint);
    }

    const candidates = getBackendCandidates();
    let lastError: unknown;
    for (const base of candidates) {
        const url = buildApiUrl(base, endpoint);
        try {
            const result = await requestWithRetry(url);
            activeBackendUrl = base;
            return result;
        } catch (error) {
            lastError = error;
            const status = getApiErrorStatus(error);
            // 认证/参数错误不做跨后端重试，避免误导用户
            if (typeof status === 'number' && status >= 400 && status < 500 && status !== 408 && status !== 429) {
                throw error;
            }
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

    async getDashboardStats(dateOrStart?: number, end?: number): Promise<any> {
        if (dateOrStart != null && end != null) {
            return request(`/api/stats/dashboard?start=${dateOrStart}&end=${end}`);
        }
        if (dateOrStart != null) {
            return request(`/api/stats/dashboard?date=${dateOrStart}`);
        }
        return request('/api/stats/dashboard');
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

    async getAlarmMedia(params?: {
        alarmId?: number;
        recordId?: string;
        cameraId?: string;
        status?: AlarmMediaStatus;
    }) {
        const query = new URLSearchParams();
        if (typeof params?.alarmId === 'number') query.set('alarmId', String(params.alarmId));
        if (params?.recordId) query.set('recordId', params.recordId);
        if (params?.cameraId) query.set('cameraId', params.cameraId);
        if (params?.status) query.set('status', params.status);
        const suffix = query.toString() ? `?${query.toString()}` : '';
        return request<AlarmMedia[]>(`/api/alarm-media${suffix}`);
    },

    async getAlarmMediaById(id: number) {
        return request<AlarmMedia>(`/api/alarm-media/${id}`);
    },

    async createAlarmMediaCapture(payload: {
        alarmId?: number;
        recordId?: string;
        plateNumber?: string;
        cameraId?: string;
        durationSec?: number;
    }) {
        return request<{ queued: boolean; reused?: boolean; item: AlarmMedia }>(`/api/alarm-media/capture`, {
            method: 'POST',
            body: JSON.stringify(payload)
        });
    },

    async uploadVideoMedia(file: File): Promise<UploadedMedia> {
        const formData = new FormData();
        formData.append('file', file);
        const token = getStoredToken();
        const candidates = getBackendCandidates();
        let lastError: unknown;
        for (const base of candidates) {
            const url = buildApiUrl(base, '/api/media/upload-video');
            try {
                const res = await fetch(url, {
                    method: 'POST',
                    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
                    body: formData
                });
                if (!res.ok) {
                    let message = `上传失败 (${res.status})`;
                    try {
                        const payload = await res.json();
                        message = payload?.message || message;
                    } catch (_error) {
                        // ignore payload parse errors
                    }
                    throw new ApiRequestError(message, { status: res.status });
                }
                const payload = await res.json();
                activeBackendUrl = base;
                return payload as UploadedMedia;
            } catch (error) {
                lastError = error;
            }
        }
        throw lastError instanceof Error ? lastError : new Error('视频上传失败');
    },

    async updateAlarmMedia(id: number, payload: {
        status?: AlarmMediaStatus;
        durationSec?: number;
        errorMessage?: string;
    }) {
        return request<AlarmMedia>(`/api/alarm-media/${id}`, {
            method: 'PUT',
            body: JSON.stringify(payload)
        });
    },

    async deleteAlarmMedia(id: number) {
        return request<{ deleted: boolean }>(`/api/alarm-media/${id}`, {
            method: 'DELETE'
        });
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

    getCameraLiveStreamUrl(id: string) {
        const token = getStoredToken();
        const search = new URLSearchParams();
        if (token) {
            search.set('token', token);
        }
        const query = search.toString();
        const base = normalizeBaseUrl(activeBackendUrl || resolveInitialBackendUrl());
        return `${base}/api/cameras/${encodeURIComponent(id)}/live${query ? `?${query}` : ''}`;
    },

    async buildCameraStreamTemplate(payload: {
        vendor: StreamVendor;
        protocol: StreamProtocol;
        host?: string;
        port?: number;
        username?: string;
        password?: string;
        channel?: number;
        streamType?: 'main' | 'sub';
        customPath?: string;
    }) {
        return request<{ url: string; tips: string[] }>('/api/cameras/stream-template', {
            method: 'POST',
            body: JSON.stringify(payload)
        });
    },

    async testCameraStream(url: string) {
        return request<{ ok: boolean; message: string; details?: any }>('/api/cameras/test-stream', {
            method: 'POST',
            body: JSON.stringify({ url })
        });
    },

    async discoverOnvifDevices(timeoutMs = 3500) {
        return request<{ devices: OnvifDiscoveredDevice[]; elapsedMs: number; tips: string[] }>('/api/cameras/onvif-discover', {
            method: 'POST',
            body: JSON.stringify({ timeoutMs })
        });
    },

    async fetch(endpoint: string, options?: RequestInit) {
        const base = normalizeBaseUrl(activeBackendUrl || resolveInitialBackendUrl());
        const url = endpoint.startsWith('http') ? endpoint : `${base}${endpoint}`;
        return fetch(url, {
            ...options,
            headers: {
                ...(await buildHeaders(options)),
                ...(options?.headers as Record<string, string> | undefined)
            }
        });
    },

    getBackendUrl() {
        return normalizeBaseUrl(activeBackendUrl || resolveInitialBackendUrl());
    },

    setBackendUrlOverride(baseUrl: string) {
        const normalized = normalizeBaseUrl(baseUrl);
        if (!normalized) return;
        if (typeof window !== 'undefined') {
            localStorage.setItem(API_BASE_OVERRIDE_KEY, normalized);
        }
        activeBackendUrl = normalized;
    },

    clearBackendUrlOverride() {
        if (typeof window !== 'undefined') {
            localStorage.removeItem(API_BASE_OVERRIDE_KEY);
        }
        activeBackendUrl = resolveInitialBackendUrl();
    },

    getToken() {
        return getStoredToken();
    },

    getImageUrl(path?: string): string {
        if (!path) return 'https://via.placeholder.com/400x300?text=No+Image';
        if (path.startsWith('http://') || path.startsWith('https://')) return path;
        const base = normalizeBaseUrl(activeBackendUrl || resolveInitialBackendUrl());
        const token = getStoredToken();
        const tokenQuery = token ? `&token=${encodeURIComponent(token)}` : '';
        const filenameQuery = `&filename=${encodeURIComponent(inferFilenameFromMediaPath(path))}`;
        if (path.startsWith('cos://') || path.startsWith('uploads/')) {
            return `${base}/api/media/redirect?path=${encodeURIComponent(path)}${filenameQuery}${tokenQuery}`;
        }
        if (path.startsWith('data:') || path.startsWith('blob:')) {
            return path;
        }
        return `${base}/${path}`;
    },

    getMediaUrl(path?: string): string {
        if (!path) return '';
        if (path.startsWith('http://') || path.startsWith('https://')) return path;
        if (path.startsWith('blob:') || path.startsWith('data:')) return path;
        const base = normalizeBaseUrl(activeBackendUrl || resolveInitialBackendUrl());
        const token = getStoredToken();
        const tokenQuery = token ? `&token=${encodeURIComponent(token)}` : '';
        const filenameQuery = `&filename=${encodeURIComponent(inferFilenameFromMediaPath(path))}`;
        if (path.startsWith('cos://') || path.startsWith('uploads/')) {
            return `${base}/api/media/redirect?path=${encodeURIComponent(path)}${filenameQuery}${tokenQuery}`;
        }
        return `${base}/${path}`;
    },

    async downloadMedia(path: string, filename?: string): Promise<void> {
        const query = new URLSearchParams({ path });
        if (filename) query.set('filename', filename);
        const blob = await request<Blob>(`/api/media/download?${query.toString()}`, {
            method: 'GET'
        });
        const objectUrl = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = objectUrl;
        link.download = filename || `media-${Date.now()}.jpg`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(objectUrl);
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
