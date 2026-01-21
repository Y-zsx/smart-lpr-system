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
    blacklist_id?: number;
    timestamp: number;
    is_read: number;
    plate_number: string;
    image_path?: string;
    location?: string;
    reason: string;
    severity: 'high' | 'medium' | 'low';
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
