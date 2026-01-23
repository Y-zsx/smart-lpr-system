-- 清空所有数据脚本
-- ⚠️ 警告：此脚本会删除所有表的数据，请谨慎使用！
-- 建议：执行前先备份数据库

USE `smart_lpr`;

-- 禁用外键检查
SET FOREIGN_KEY_CHECKS = 0;

-- 清空所有表的数据
TRUNCATE TABLE `alarms`;
TRUNCATE TABLE `plate_records`;
TRUNCATE TABLE `plates`;
TRUNCATE TABLE `blacklist`;

-- 如果 cameras 表存在，也清空
SET @table_exists = (
    SELECT COUNT(*) 
    FROM INFORMATION_SCHEMA.TABLES 
    WHERE TABLE_SCHEMA = 'smart_lpr' 
    AND TABLE_NAME = 'cameras'
);

SET @sql = IF(@table_exists > 0, 
    'TRUNCATE TABLE `cameras`', 
    'SELECT "cameras 表不存在，跳过" AS "状态"'
);

PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- 恢复外键检查
SET FOREIGN_KEY_CHECKS = 1;

SELECT '✅ 所有数据已清空！' AS '完成';
