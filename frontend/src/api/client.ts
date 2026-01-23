const BACKEND_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';

// 获取带认证信息的请求头辅助函数
export const getHeaders = () => {
    const headers: Record<string, string> = {
        'Content-Type': 'application/json'
    };

    // 1. 尝试平台注入 (iframe)
    // 注意：在本地开发环境中，这些可能不存在

    // 2. 尝试本地开发环境变量
    const localUserId = import.meta.env.VITE_USER_ID;
    if (localUserId) {
        headers['X-Encrypted-Yw-ID'] = localUserId;
        headers['X-Is-Login'] = '1';
    }

    return headers;
};

export const apiClient = {
    async getUserInfo() {
        const res = await fetch(`${BACKEND_URL}/__user_info__`, {
            headers: getHeaders()
        });
        return res.json();
    },

    async getHistory(start?: number, end?: number, type?: string, groupBy?: string) {
        let url = `${BACKEND_URL}/api/plates`;
        const params = new URLSearchParams();

        if (start && end) {
            params.append('start', start.toString());
            params.append('end', end.toString());
        }

        if (type) {
            params.append('type', type);
        }

        if (groupBy) {
            params.append('groupBy', groupBy);
        }

        const queryString = params.toString();
        if (queryString) {
            url += `?${queryString}`;
        }

        const res = await fetch(url, {
            headers: getHeaders()
        });
        if (!res.ok) throw new Error('Failed to fetch history');
        return res.json();
    },

    async savePlate(plate: any) {
        const res = await fetch(`${BACKEND_URL}/api/plates`, {
            method: 'POST',
            headers: getHeaders(),
            body: JSON.stringify(plate)
        });
        if (!res.ok) throw new Error('Failed to save plate');
        return res.json();
    },

    async getUploadUrl(filename: string) {
        const res = await fetch(`${BACKEND_URL}/api/upload-url`, {
            method: 'POST',
            headers: getHeaders(),
            body: JSON.stringify({ filename })
        });
        if (!res.ok) throw new Error('Failed to get upload URL');
        return res.json();
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
        let url = `${BACKEND_URL}/api/stats/daily`;
        if (endDate) {
            url += `?end=${endDate}`;
        }
        const res = await fetch(url, {
            headers: getHeaders()
        });
        if (!res.ok) throw new Error('Failed to fetch stats');
        return res.json();
    },

    async getDashboardStats(date?: number): Promise<any> {
        let url = `${BACKEND_URL}/api/stats/dashboard`;
        if (date) {
            url += `?date=${date}`;
        }
        const res = await fetch(url, {
            headers: getHeaders()
        });
        if (!res.ok) throw new Error('Failed to fetch dashboard stats');
        return res.json();
    },

    async getRegionStats(range: 'daily' | 'total' = 'total', date?: number) {
        let url = `${BACKEND_URL}/api/stats/region?range=${range}`;
        if (date) {
            url += `&date=${date}`;
        }
        const res = await fetch(url, {
            headers: getHeaders()
        });
        if (!res.ok) throw new Error('Failed to fetch region stats');
        return res.json();
    },

    async exportRecords(start?: number, end?: number, search?: string) {
        let url = `${BACKEND_URL}/api/export-records`;
        const params = new URLSearchParams();

        if (start && end) {
            params.append('start', start.toString());
            params.append('end', end.toString());
        }

        if (search) {
            params.append('search', search);
        }

        const queryString = params.toString();
        if (queryString) {
            url += `?${queryString}`;
        }

        const res = await fetch(url, {
            headers: getHeaders()
        });

        if (!res.ok) throw new Error('Failed to export records');
        return res.blob();
    },

    async getBlacklist() {
        const res = await fetch(`${BACKEND_URL}/api/blacklist`, { headers: getHeaders() });
        if (!res.ok) throw new Error('Failed to fetch blacklist');
        return res.json();
    },

    async addBlacklist(data: any | any[]) {
        const res = await fetch(`${BACKEND_URL}/api/blacklist`, {
            method: 'POST',
            headers: getHeaders(),
            body: JSON.stringify(data)
        });
        if (!res.ok) throw new Error('Failed to add blacklist');
        return res.json();
    },

    async deleteBlacklist(id: number) {
        const res = await fetch(`${BACKEND_URL}/api/blacklist?id=${id}`, {
            method: 'DELETE',
            headers: getHeaders()
        });
        if (!res.ok) throw new Error('Failed to delete blacklist');
        return res.json();
    },

    async getAlarms() {
        const res = await fetch(`${BACKEND_URL}/api/alarms`, { headers: getHeaders() });
        if (!res.ok) throw new Error('Failed to fetch alarms');
        return res.json();
    },

    // 添加通用的 fetch 方法供其他服务使用
    async fetch(endpoint: string, options?: RequestInit) {
        const url = endpoint.startsWith('http') ? endpoint : `${BACKEND_URL}${endpoint}`;
        return fetch(url, {
            ...options,
            headers: {
                ...getHeaders(),
                ...options?.headers
            }
        });
    },

    getBackendUrl() {
        return BACKEND_URL;
    },

    /**
     * 构建完整的图片URL
     * @param path 图片路径（可能是相对路径或完整URL）
     * @returns 完整的图片URL
     */
    getImageUrl(path?: string): string {
        if (!path) return 'https://via.placeholder.com/400x300?text=No+Image';
        if (path.startsWith('http://') || path.startsWith('https://')) return path;
        // 如果是相对路径（uploads/开头），构建完整URL
        if (path.startsWith('uploads/')) {
            return `${BACKEND_URL}/${path}`;
        }
        // 如果是 base64 或 blob url，直接返回
        if (path.startsWith('data:') || path.startsWith('blob:')) {
            return path;
        }
        // 其他情况，尝试构建完整URL
        return `${BACKEND_URL}/${path}`;
    }
};
