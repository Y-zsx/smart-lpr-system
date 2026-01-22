-- 迁移脚本：将现有数据结构改为以车牌号为唯一标识的集合结构
-- 执行方式：mysql -u root -p < migrate_to_plate_records.sql

USE `smart_lpr`;

-- 创建 plate_records 表（识别记录表）
-- 每次识别都会创建一条新记录，以车牌号为分组标识
CREATE TABLE IF NOT EXISTS `plate_records` (
  `id` VARCHAR(36) PRIMARY KEY,
  `plate_number` VARCHAR(20) NOT NULL,
  `plate_type` ENUM('blue', 'yellow', 'green', 'white', 'black') NOT NULL,
  `confidence` DECIMAL(5,4) NOT NULL,
  `timestamp` BIGINT NOT NULL,
  `camera_id` VARCHAR(100),
  `camera_name` VARCHAR(200),
  `location` VARCHAR(200),
  `image_url` VARCHAR(500),
  `rect_x` INT,
  `rect_y` INT,
  `rect_w` INT,
  `rect_h` INT,
  `created_at` BIGINT NOT NULL,
  INDEX `idx_plate_number` (`plate_number`),
  INDEX `idx_timestamp` (`timestamp`),
  INDEX `idx_camera_id` (`camera_id`),
  INDEX `idx_created_at` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 迁移现有数据（如果 plates 表有数据）
INSERT INTO `plate_records` (
  `id`, `plate_number`, `plate_type`, `confidence`, `timestamp`,
  `camera_id`, `camera_name`, `location`, `image_url`,
  `rect_x`, `rect_y`, `rect_w`, `rect_h`, `created_at`
)
SELECT 
  `id`, `number`, `type`, `confidence`, `timestamp`,
  NULL as `camera_id`, `location` as `camera_name`, `location`, `image_url`,
  `rect_x`, `rect_y`, `rect_w`, `rect_h`, `timestamp` as `created_at`
FROM `plates`
WHERE `saved` = 1;

-- 注意：保留原有的 plates 表用于兼容性，但新数据将只写入 plate_records 表
-- 如果需要完全迁移，可以删除 plates 表，但建议先备份数据

SELECT '数据迁移完成！' AS message;
SELECT COUNT(*) as total_records FROM `plate_records`;
