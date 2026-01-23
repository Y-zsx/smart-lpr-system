// 高德地图类型声明
declare global {
    interface Window {
        AMap: any;
        initAMap?: () => void;
    }
}

export {};
