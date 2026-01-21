export type PlateType = 'blue' | 'yellow' | 'green' | 'white' | 'black';

export interface Rect {
    x: number;
    y: number;
    w: number;
    h: number;
}

export interface LicensePlate {
    id: string;
    number: string;
    type: PlateType;
    confidence: number;
    timestamp: number;
    imageUrl?: string; // 捕获的车牌图像的 Base64 或 URL
    location?: string; // 例如："1号摄像头 - 入口"
    rect?: Rect; // 边界框
    saved?: boolean; // 车牌是否已保存到后端
}

export interface RecognitionStats {
    total: number;
    blue: number;
    yellow: number;
    green: number;
    other: number;
}

// 为了兼容 Store 的别名
export type Plate = LicensePlate;
export type PlateStats = RecognitionStats;