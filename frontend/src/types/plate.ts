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

export interface TrendData {
    value: string;
    direction: 'up' | 'down' | 'neutral';
}

export interface RecognitionStats {
    total: number;
    blue: number;
    yellow: number;
    green: number;
    other: number;
    trends?: {
        total: TrendData;
        blue: TrendData;
        green: TrendData;
        other: TrendData;
    };
}

// 为了兼容 Store 的别名
export type Plate = LicensePlate;
export type PlateStats = RecognitionStats;

// 识别记录（每次识别的一条记录）
export interface PlateRecord {
    id: string;
    plateNumber: string;
    plateType: PlateType;
    confidence: number;
    timestamp: number;
    cameraId?: string;
    cameraName?: string;
    location?: string;
    imageUrl?: string;
    rect?: Rect;
    createdAt: number;
}

// 车牌号集合（以车牌号为唯一标识，包含多条识别记录）
export interface PlateGroup {
    plateNumber: string;
    plateType: PlateType;
    firstSeen: number; // 首次识别时间
    lastSeen: number; // 最后识别时间
    totalCount: number; // 识别次数
    records: PlateRecord[]; // 识别记录列表
    averageConfidence: number; // 平均置信度
    locations: string[]; // 出现过的位置列表
    cameras: string[]; // 出现过的摄像头列表
}