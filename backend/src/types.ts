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
    imageUrl?: string;
    location?: string;
    rect?: Rect;
    saved?: boolean;
    cameraId?: string; // 摄像头ID
    cameraName?: string; // 摄像头名称
}

// 识别记录（每次识别的一条记录）
export interface PlateRecord {
    id: string;
    plateNumber: string;
    plateType: PlateType;
    confidence: number;
    timestamp: number;
    cameraId?: string;
    cameraName?: string;
    regionCode?: string;
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

export interface BlacklistItem {
    id: number;
    plate_number: string;
    reason: string;
    severity: 'high' | 'medium' | 'low';
    created_at?: number;
}

export interface Alarm {
    id: number;
    plate_id?: string;
    record_id?: string;
    blacklist_id?: number;
    timestamp: number;
    is_read: number;
    plate_number: string;
    camera_id?: string;
    region_code?: string;
    image_path?: string;
    plate_type?: PlateType;
    rect?: Rect;
    location?: string;
    latitude?: number; // 纬度
    longitude?: number; // 经度
    reason: string;
    severity: 'high' | 'medium' | 'low';
}

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
    status: 'pending' | 'processing' | 'ready' | 'failed';
    errorMessage?: string;
    createdAt: number;
    updatedAt: number;
}

export interface DailyStat {
    date: string;
    count: number;
}

export interface DashboardStats {
    total: number;
    blue: number;
    green: number;
    yellow: number;
    other: number;
    trends: {
        total: { value: string; direction: 'up' | 'down' | 'neutral' };
        blue: { value: string; direction: 'up' | 'down' | 'neutral' };
        green: { value: string; direction: 'up' | 'down' | 'neutral' };
        other: { value: string; direction: 'up' | 'down' | 'neutral' };
    };
}
