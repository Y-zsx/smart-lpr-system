/**
 * 数据比较工具函数，用于避免不必要的状态更新
 */

/**
 * 深度比较两个数组是否相等（基于关键字段）
 */
export function areArraysEqual<T>(
    arr1: T[],
    arr2: T[],
    keyExtractor?: (item: T) => any
): boolean {
    if (arr1.length !== arr2.length) {
        return false;
    }

    if (arr1.length === 0) {
        return true;
    }

    // 如果没有提供keyExtractor，使用JSON序列化比较（适用于简单对象）
    if (!keyExtractor) {
        return JSON.stringify(arr1) === JSON.stringify(arr2);
    }

    // 使用keyExtractor比较关键字段
    const keys1 = arr1.map(keyExtractor).sort();
    const keys2 = arr2.map(keyExtractor).sort();

    if (JSON.stringify(keys1) !== JSON.stringify(keys2)) {
        return false;
    }

    // 进一步比较每个对象的关键字段
    for (let i = 0; i < arr1.length; i++) {
        const key1 = keyExtractor(arr1[i]);
        const item2 = arr2.find(item => keyExtractor(item) === key1);
        
        if (!item2) {
            return false;
        }

        // 比较关键字段的值
        const obj1 = arr1[i] as any;
        const obj2 = item2 as any;
        
        // 比较常见的关键字段
        if (obj1.lastSeen !== obj2.lastSeen ||
            obj1.totalCount !== obj2.totalCount ||
            obj1.plateNumber !== obj2.plateNumber) {
            return false;
        }
    }

    return true;
}

/**
 * 比较两个对象是否相等（浅比较）
 */
export function areObjectsEqual<T extends Record<string, any>>(
    obj1: T,
    obj2: T
): boolean {
    if (obj1 === obj2) {
        return true;
    }

    const keys1 = Object.keys(obj1);
    const keys2 = Object.keys(obj2);

    if (keys1.length !== keys2.length) {
        return false;
    }

    for (const key of keys1) {
        if (obj1[key] !== obj2[key]) {
            return false;
        }
    }

    return true;
}

/**
 * 比较PlateGroup数组是否相等
 */
export function arePlateGroupsEqual(
    groups1: any[],
    groups2: any[]
): boolean {
    if (groups1.length !== groups2.length) {
        return false;
    }
    
    if (groups1.length === 0) {
        return true;
    }
    
    // 创建映射以便快速查找
    const map1 = new Map<string, any>();
    const map2 = new Map<string, any>();
    
    groups1.forEach(g => map1.set(g.plateNumber, g));
    groups2.forEach(g => map2.set(g.plateNumber, g));
    
    // 检查每个车牌的数据是否相同
    for (const [plateNumber, group1] of map1.entries()) {
        const group2 = map2.get(plateNumber);
        if (!group2) {
            return false;
        }
        
        // 比较关键字段
        if (group1.lastSeen !== group2.lastSeen ||
            group1.totalCount !== group2.totalCount ||
            group1.plateType !== group2.plateType) {
            return false;
        }
    }
    
    return true;
}

/**
 * 比较统计数据是否相等
 */
export function areStatsEqual(stats1: any, stats2: any): boolean {
    if (!stats1 || !stats2) {
        return stats1 === stats2;
    }

    return stats1.total === stats2.total &&
           stats1.blue === stats2.blue &&
           stats1.green === stats2.green &&
           stats1.yellow === stats2.yellow &&
           stats1.other === stats2.other;
}
