-- 智能车牌识别系统数据库初始化脚本
-- 执行方式：在 MySQL 命令行中执行 source init_database.sql; 或 mysql -u root -p < init_database.sql

-- 创建数据库
CREATE DATABASE IF NOT EXISTS `smart_lpr` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- 使用数据库
USE `smart_lpr`;

-- 创建 plates 表（车牌记录）
CREATE TABLE IF NOT EXISTS `plates` (
  `id` VARCHAR(36) PRIMARY KEY,
  `number` VARCHAR(20) NOT NULL,
  `type` ENUM('blue', 'yellow', 'green', 'white', 'black') NOT NULL,
  `confidence` DECIMAL(5,4) NOT NULL,
  `timestamp` BIGINT NOT NULL,
  `image_url` VARCHAR(500),
  `location` VARCHAR(100),
  `rect_x` INT,
  `rect_y` INT,
  `rect_w` INT,
  `rect_h` INT,
  `saved` TINYINT(1) DEFAULT 0,
  INDEX `idx_timestamp` (`timestamp`),
  INDEX `idx_number` (`number`),
  INDEX `idx_type` (`type`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 创建 blacklist 表（黑名单）
CREATE TABLE IF NOT EXISTS `blacklist` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `plate_number` VARCHAR(20) NOT NULL UNIQUE,
  `reason` VARCHAR(500) NOT NULL,
  `severity` ENUM('high', 'medium', 'low') NOT NULL DEFAULT 'medium',
  `created_at` BIGINT NOT NULL,
  INDEX `idx_plate_number` (`plate_number`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 创建 alarms 表（告警记录）
CREATE TABLE IF NOT EXISTS `alarms` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `plate_id` VARCHAR(36),
  `blacklist_id` INT,
  `timestamp` BIGINT NOT NULL,
  `is_read` TINYINT(1) DEFAULT 0,
  `plate_number` VARCHAR(20) NOT NULL,
  `image_path` VARCHAR(500),
  `location` VARCHAR(100),
  `latitude` DECIMAL(10, 8) NULL,
  `longitude` DECIMAL(11, 8) NULL,
  `reason` VARCHAR(500) NOT NULL,
  `severity` ENUM('high', 'medium', 'low') NOT NULL DEFAULT 'medium',
  INDEX `idx_timestamp` (`timestamp`),
  INDEX `idx_is_read` (`is_read`),
  INDEX `idx_plate_number` (`plate_number`),
  INDEX `idx_alarm_location` (`latitude`, `longitude`),
  FOREIGN KEY (`plate_id`) REFERENCES `plates`(`id`) ON DELETE SET NULL,
  FOREIGN KEY (`blacklist_id`) REFERENCES `blacklist`(`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 显示创建结果
SHOW TABLES;
SELECT '数据库初始化完成！' AS message;
