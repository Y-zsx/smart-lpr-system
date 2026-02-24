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
  `record_id` VARCHAR(36),
  `blacklist_id` INT,
  `timestamp` BIGINT NOT NULL,
  `is_read` TINYINT(1) DEFAULT 0,
  `is_deleted` TINYINT(1) DEFAULT 0,
  `plate_number` VARCHAR(20) NOT NULL,
  `camera_id` VARCHAR(255),
  `region_code` VARCHAR(100),
  `image_path` VARCHAR(500),
  `location` VARCHAR(100),
  `latitude` DECIMAL(10, 8) NULL,
  `longitude` DECIMAL(11, 8) NULL,
  `reason` VARCHAR(500) NOT NULL,
  `severity` ENUM('high', 'medium', 'low') NOT NULL DEFAULT 'medium',
  INDEX `idx_timestamp` (`timestamp`),
  INDEX `idx_is_read` (`is_read`),
  INDEX `idx_is_deleted` (`is_deleted`),
  INDEX `idx_plate_number` (`plate_number`),
  INDEX `idx_camera_id` (`camera_id`),
  INDEX `idx_region_code` (`region_code`),
  INDEX `idx_alarm_location` (`latitude`, `longitude`),
  FOREIGN KEY (`plate_id`) REFERENCES `plates`(`id`) ON DELETE SET NULL,
  FOREIGN KEY (`blacklist_id`) REFERENCES `blacklist`(`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 创建 plate_records 表（识别记录）
CREATE TABLE IF NOT EXISTS `plate_records` (
  `id` VARCHAR(36) PRIMARY KEY,
  `plate_number` VARCHAR(20) NOT NULL,
  `plate_type` ENUM('blue', 'yellow', 'green', 'white', 'black') NOT NULL,
  `confidence` DECIMAL(5,4) NOT NULL,
  `timestamp` BIGINT NOT NULL,
  `camera_id` VARCHAR(100),
  `camera_name` VARCHAR(200),
  `region_code` VARCHAR(100),
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
  INDEX `idx_region_code` (`region_code`),
  INDEX `idx_created_at` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- IAM 表
CREATE TABLE IF NOT EXISTS `iam_users` (
  `id` VARCHAR(64) PRIMARY KEY,
  `username` VARCHAR(100) NOT NULL UNIQUE,
  `password` VARCHAR(255) NOT NULL,
  `display_name` VARCHAR(100) NOT NULL,
  `status` ENUM('active', 'disabled') NOT NULL DEFAULT 'active',
  `created_at` BIGINT NOT NULL,
  `updated_at` BIGINT NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `iam_roles` (
  `id` VARCHAR(64) PRIMARY KEY,
  `role_key` VARCHAR(100) NOT NULL UNIQUE,
  `role_name` VARCHAR(100) NOT NULL,
  `description` VARCHAR(255),
  `created_at` BIGINT NOT NULL,
  `updated_at` BIGINT NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `iam_permissions` (
  `id` VARCHAR(100) PRIMARY KEY,
  `permission_key` VARCHAR(100) NOT NULL UNIQUE,
  `permission_name` VARCHAR(200) NOT NULL,
  `group_key` VARCHAR(100) NOT NULL,
  `created_at` BIGINT NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `iam_role_permissions` (
  `role_id` VARCHAR(64) NOT NULL,
  `permission_id` VARCHAR(100) NOT NULL,
  PRIMARY KEY (`role_id`, `permission_id`),
  FOREIGN KEY (`role_id`) REFERENCES `iam_roles`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`permission_id`) REFERENCES `iam_permissions`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `iam_user_roles` (
  `user_id` VARCHAR(64) NOT NULL,
  `role_id` VARCHAR(64) NOT NULL,
  PRIMARY KEY (`user_id`, `role_id`),
  FOREIGN KEY (`user_id`) REFERENCES `iam_users`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`role_id`) REFERENCES `iam_roles`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `iam_role_data_scopes` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `role_id` VARCHAR(64) NOT NULL,
  `scope_type` ENUM('all', 'camera', 'region') NOT NULL,
  `scope_value` VARCHAR(255) NOT NULL,
  INDEX `idx_role_scope` (`role_id`, `scope_type`),
  FOREIGN KEY (`role_id`) REFERENCES `iam_roles`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- IAM 种子数据（默认口令仅供本地演示）
SET @now_ms = UNIX_TIMESTAMP(NOW(3)) * 1000;

INSERT INTO `iam_roles` (`id`, `role_key`, `role_name`, `description`, `created_at`, `updated_at`)
VALUES
('role_admin', 'admin', '系统管理员', '全量管理权限', @now_ms, @now_ms),
('role_operator', 'operator', '值班员', '业务操作权限', @now_ms, @now_ms),
('role_viewer', 'viewer', '只读用户', '仅查看数据', @now_ms, @now_ms)
ON DUPLICATE KEY UPDATE `role_name`=VALUES(`role_name`), `description`=VALUES(`description`), `updated_at`=VALUES(`updated_at`);

INSERT INTO `iam_permissions` (`id`, `permission_key`, `permission_name`, `group_key`, `created_at`)
VALUES
('perm_dashboard_view', 'dashboard.view', '查看仪表盘', 'dashboard', @now_ms),
('perm_monitor_view', 'monitor.view', '查看实时监控', 'monitor', @now_ms),
('perm_records_view', 'records.view', '查看识别记录', 'records', @now_ms),
('perm_alarms_view', 'alarms.view', '查看告警', 'alarms', @now_ms),
('perm_plate_manage', 'plate.manage', '管理识别记录', 'records', @now_ms),
('perm_alarm_manage', 'alarm.manage', '处理告警', 'alarms', @now_ms),
('perm_blacklist_manage', 'blacklist.manage', '管理黑名单', 'alarms', @now_ms),
('perm_camera_manage', 'camera.manage', '管理摄像头', 'monitor', @now_ms),
('perm_iam_manage', 'iam.manage', '管理权限配置', 'iam', @now_ms)
ON DUPLICATE KEY UPDATE `permission_name`=VALUES(`permission_name`), `group_key`=VALUES(`group_key`);

INSERT INTO `iam_users` (`id`, `username`, `password`, `display_name`, `status`, `created_at`, `updated_at`)
VALUES
('user_admin', 'admin', 'admin123', '系统管理员', 'active', @now_ms, @now_ms),
('user_operator', 'operator', 'operator123', '值班员', 'active', @now_ms, @now_ms),
('user_viewer', 'viewer', 'viewer123', '访客', 'active', @now_ms, @now_ms)
ON DUPLICATE KEY UPDATE `password`=VALUES(`password`), `display_name`=VALUES(`display_name`), `status`=VALUES(`status`), `updated_at`=VALUES(`updated_at`);

INSERT IGNORE INTO `iam_user_roles` (`user_id`, `role_id`) VALUES
('user_admin', 'role_admin'),
('user_operator', 'role_operator'),
('user_viewer', 'role_viewer');

INSERT IGNORE INTO `iam_role_permissions` (`role_id`, `permission_id`) VALUES
('role_admin', 'perm_dashboard_view'),
('role_admin', 'perm_monitor_view'),
('role_admin', 'perm_records_view'),
('role_admin', 'perm_alarms_view'),
('role_admin', 'perm_plate_manage'),
('role_admin', 'perm_alarm_manage'),
('role_admin', 'perm_blacklist_manage'),
('role_admin', 'perm_camera_manage'),
('role_admin', 'perm_iam_manage'),
('role_operator', 'perm_dashboard_view'),
('role_operator', 'perm_monitor_view'),
('role_operator', 'perm_records_view'),
('role_operator', 'perm_alarms_view'),
('role_operator', 'perm_plate_manage'),
('role_operator', 'perm_alarm_manage'),
('role_operator', 'perm_blacklist_manage'),
('role_operator', 'perm_camera_manage'),
('role_viewer', 'perm_dashboard_view'),
('role_viewer', 'perm_monitor_view'),
('role_viewer', 'perm_records_view'),
('role_viewer', 'perm_alarms_view');

INSERT IGNORE INTO `iam_role_data_scopes` (`role_id`, `scope_type`, `scope_value`) VALUES
('role_admin', 'all', '*'),
('role_operator', 'all', '*');

-- 显示创建结果
SHOW TABLES;
SELECT '数据库初始化完成！' AS message;
