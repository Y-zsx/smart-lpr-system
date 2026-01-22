-- 验证数据库和表是否创建成功

USE `smart_lpr`;

-- 显示所有表
SHOW TABLES;

-- 查看 plates 表结构
DESCRIBE `plates`;

-- 查看 blacklist 表结构
DESCRIBE `blacklist`;

-- 查看 alarms 表结构
DESCRIBE `alarms`;

-- 查看数据库信息
SELECT 
    TABLE_NAME,
    TABLE_ROWS,
    DATA_LENGTH,
    INDEX_LENGTH
FROM information_schema.TABLES
WHERE TABLE_SCHEMA = 'smart_lpr';
