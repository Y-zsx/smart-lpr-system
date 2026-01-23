-- 更新历史告警的坐标数据
-- 从 plate_records 表关联摄像头信息，更新 alarms 表的经纬度
-- 注意：需要先确保 cameras 表存在且有数据（在前端添加摄像头并保存会自动创建）

USE `smart_lpr`;

-- 检查 cameras 表是否存在
SET @cameras_table_exists = (
    SELECT COUNT(*) 
    FROM INFORMATION_SCHEMA.TABLES 
    WHERE TABLE_SCHEMA = 'smart_lpr' 
    AND TABLE_NAME = 'cameras'
);

-- 更新坐标（仅在 cameras 表存在时执行）
UPDATE `alarms` a
INNER JOIN `plate_records` pr ON a.plate_number = pr.plate_number 
    AND a.timestamp = pr.timestamp
INNER JOIN `cameras` c ON pr.camera_id = c.id
SET 
    a.latitude = c.latitude,
    a.longitude = c.longitude
WHERE 
    a.latitude IS NULL 
    AND a.longitude IS NULL
    AND c.latitude IS NOT NULL 
    AND c.longitude IS NOT NULL;

-- 显示更新结果
SELECT 
    COUNT(*) AS '已更新告警数'
FROM `alarms`
WHERE latitude IS NOT NULL AND longitude IS NOT NULL;
