-- 数据库验证脚本
-- 检查所有关键表的结构是否符合要求

USE `smart_lpr`;

-- ========== 1. 检查 alarms 表 ==========
SELECT '=== 检查 alarms 表结构 ===' AS '';

-- 检查 alarms 表是否存在
SELECT 
    CASE 
        WHEN COUNT(*) > 0 THEN '✓ alarms 表存在'
        ELSE '✗ alarms 表不存在'
    END AS 'alarms表状态'
FROM 
    INFORMATION_SCHEMA.TABLES
WHERE 
    TABLE_SCHEMA = 'smart_lpr' 
    AND TABLE_NAME = 'alarms';

-- 检查 latitude 字段
SELECT 
    CASE 
        WHEN COUNT(*) > 0 THEN '✓ latitude 字段存在'
        ELSE '✗ latitude 字段不存在 - 需要执行 add_alarm_coordinates.sql'
    END AS 'latitude字段状态'
FROM 
    INFORMATION_SCHEMA.COLUMNS
WHERE 
    TABLE_SCHEMA = 'smart_lpr' 
    AND TABLE_NAME = 'alarms'
    AND COLUMN_NAME = 'latitude';

-- 检查 longitude 字段
SELECT 
    CASE 
        WHEN COUNT(*) > 0 THEN '✓ longitude 字段存在'
        ELSE '✗ longitude 字段不存在 - 需要执行 add_alarm_coordinates.sql'
    END AS 'longitude字段状态'
FROM 
    INFORMATION_SCHEMA.COLUMNS
WHERE 
    TABLE_SCHEMA = 'smart_lpr' 
    AND TABLE_NAME = 'alarms'
    AND COLUMN_NAME = 'longitude';

-- 检查索引
SELECT 
    CASE 
        WHEN COUNT(*) > 0 THEN '✓ idx_alarm_location 索引存在'
        ELSE '✗ idx_alarm_location 索引不存在'
    END AS '索引状态'
FROM 
    INFORMATION_SCHEMA.STATISTICS
WHERE 
    TABLE_SCHEMA = 'smart_lpr' 
    AND TABLE_NAME = 'alarms'
    AND INDEX_NAME = 'idx_alarm_location';

-- ========== 2. 检查 cameras 表 ==========
SELECT '' AS '';
SELECT '=== 检查 cameras 表结构 ===' AS '';

-- 检查 cameras 表是否存在
SELECT 
    CASE 
        WHEN COUNT(*) > 0 THEN '✓ cameras 表存在'
        ELSE '✗ cameras 表不存在'
    END AS 'cameras表状态'
FROM 
    INFORMATION_SCHEMA.TABLES
WHERE 
    TABLE_SCHEMA = 'smart_lpr' 
    AND TABLE_NAME = 'cameras';

-- 检查 cameras 表的经纬度字段
SELECT 
    COLUMN_NAME,
    CASE 
        WHEN COUNT(*) > 0 THEN '✓ 存在'
        ELSE '✗ 不存在'
    END AS '状态'
FROM 
    INFORMATION_SCHEMA.COLUMNS
WHERE 
    TABLE_SCHEMA = 'smart_lpr' 
    AND TABLE_NAME = 'cameras'
    AND COLUMN_NAME IN ('latitude', 'longitude')
GROUP BY 
    COLUMN_NAME;

-- ========== 3. 检查数据完整性 ==========
SELECT '' AS '';
SELECT '=== 检查数据完整性 ===' AS '';

-- 统计有坐标的告警数量
SELECT 
    COUNT(*) AS '总告警数',
    COUNT(latitude) AS '有纬度的告警数',
    COUNT(longitude) AS '有经度的告警数',
    COUNT(CASE WHEN latitude IS NOT NULL AND longitude IS NOT NULL THEN 1 END) AS '有完整坐标的告警数'
FROM 
    `alarms`;

-- 统计有坐标的摄像头数量
SELECT 
    COUNT(*) AS '总摄像头数',
    COUNT(latitude) AS '有纬度的摄像头数',
    COUNT(longitude) AS '有经度的摄像头数',
    COUNT(CASE WHEN latitude IS NOT NULL AND longitude IS NOT NULL THEN 1 END) AS '有完整坐标的摄像头数'
FROM 
    `cameras`;

-- ========== 4. 显示完整的 alarms 表结构 ==========
SELECT '' AS '';
SELECT '=== alarms 表完整结构 ===' AS '';
DESCRIBE `alarms`;
