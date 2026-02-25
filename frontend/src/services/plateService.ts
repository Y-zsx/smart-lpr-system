import { apiClient, getHeaders } from '../api/client';
import { LicensePlate } from '../types/plate';

const BACKEND_URL = apiClient.getBackendUrl();

export interface RecognizeResult {
    plates: LicensePlate[];
}

export interface RecognizeOptions {
    minConfidence?: number;
    maxPlates?: number;
}

export const plateService = {
    /**
     * 上传图片文件或 Blob 对象进行车牌识别（支持多车牌）
     * @param file 要识别的图片文件或 Blob 对象
     * @param source 图片来源 ('stream' | 'upload')
     * @param cameraId 摄像头ID（可选）
     * @param cameraName 摄像头名称（可选）
     * @param location 位置信息（可选）
     * @returns 返回 { plates: LicensePlate[] }
     */
    recognizeFromFile: async (
        file: Blob, 
        source: string,
        cameraId?: string,
        cameraName?: string,
        location?: string,
        options?: RecognizeOptions
    ): Promise<RecognizeResult> => {
        // 根据环境变量判断是否使用模拟数据
        if (import.meta.env.VITE_USE_MOCK === 'true') {
            console.log('正在使用模拟识别服务 (VITE_USE_MOCK=true)');
            return mockRecognize();
        }

        const formData = new FormData();
        formData.append('file', file);
        formData.append('source', source);
        if (cameraId) formData.append('cameraId', cameraId);
        if (cameraName) formData.append('cameraName', cameraName);
        if (location) formData.append('location', location);
        if (typeof options?.minConfidence === 'number') {
            formData.append('minConfidence', String(options.minConfidence));
        }
        if (typeof options?.maxPlates === 'number') {
            formData.append('maxPlates', String(options.maxPlates));
        }

        try {
            const headers = getHeaders();
            // Remove Content-Type to let browser set it with boundary for FormData
            delete headers['Content-Type'];

            const res = await fetch(`${BACKEND_URL}/api/recognize`, {
                method: 'POST',
                headers: headers,
                body: formData
            });

            if (!res.ok) {
                throw new Error(`识别失败: ${res.statusText}`);
            }

            const data = await res.json();
            return { plates: data.plates ?? [] };
        } catch (error) {
            console.error('识别服务出错:', error);
            throw error; // 将错误抛给 UI 层处理，而不是静默失败
        }
    }
};

// 当后端不可用时使用的模拟函数（仅用于演示，支持多车牌）
const mockRecognize = (): Promise<RecognizeResult> => {
    return new Promise((resolve) => {
        setTimeout(() => {
            const isGreen = Math.random() > 0.7;
            const plates: LicensePlate[] = [{
                id: Math.random().toString(36).substr(2, 9),
                number: generateMockPlate(isGreen),
                type: isGreen ? 'green' : 'blue',
                confidence: 0.85 + Math.random() * 0.14,
                timestamp: Date.now(),
                rect: { x: 100, y: 100, w: 200, h: 100 },
                saved: true,
                location: 'Camera 1',
                imageUrl: ''
            }];
            resolve({ plates });
        }, 800 + Math.random() * 1000);
    });
};

function generateMockPlate(isGreen: boolean) {
    const provinces = ['京', '沪', '粤', '苏', '浙', '湘', '鄂'];
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
    const nums = '0123456789';

    const province = provinces[Math.floor(Math.random() * provinces.length)];
    const city = chars[Math.floor(Math.random() * chars.length)];

    let number = '';
    const length = isGreen ? 6 : 5;

    for (let i = 0; i < length; i++) {
        number += nums[Math.floor(Math.random() * nums.length)];
    }

    return `${province}${city}·${number}`;
}
