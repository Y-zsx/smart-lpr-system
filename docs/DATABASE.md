# 数据库配置

MySQL 存储，支持启动时自动建库建表。

## 快速开始

1. **安装与启动**：Windows 用 [MySQL Installer](https://dev.mysql.com/downloads/installer/)；macOS `brew install mysql` 且 `brew services start mysql`；Linux `apt-get install mysql-server` 或 `yum install mysql-server`，`systemctl start mysql`。
2. **连接配置**：`backend` 下 `cp .env.example .env`，编辑：
   - PORT=8000；DB_HOST、DB_PORT、DB_USER、DB_PASSWORD、DB_NAME=smart_lpr
3. **自动初始化**：`cd backend && npm install && npm run dev`，将自动创建数据库与表。

## 表结构

### plates（车牌记录）

| 字段 | 类型 | 说明 |
|------|------|------|
| id | VARCHAR(36) | 主键，UUID |
| number | VARCHAR(20) | 车牌号码 |
| type | ENUM | 车牌类型：blue, yellow, green, white, black |
| confidence | DECIMAL(5,4) | 识别置信度 (0-1) |
| timestamp | BIGINT | 识别时间戳 |
| image_url | VARCHAR(500) | 图片路径 |
| location | VARCHAR(100) | 识别位置 |
| rect_x, rect_y, rect_w, rect_h | INT | 车牌在图片中的位置 |
| saved | TINYINT(1) | 是否已保存 |

### blacklist（黑名单）

| 字段 | 类型 | 说明 |
|------|------|------|
| id | INT | 主键，自增 |
| plate_number | VARCHAR(20) | 车牌号码（唯一） |
| reason | VARCHAR(500) | 加入黑名单的原因 |
| severity | ENUM | 严重程度：high, medium, low |
| created_at | BIGINT | 创建时间戳 |

### alarms（告警记录）

| 字段 | 类型 | 说明 |
|------|------|------|
| id | INT | 主键，自增 |
| plate_id | VARCHAR(36) | 关联的车牌记录 ID |
| blacklist_id | INT | 关联的黑名单 ID |
| timestamp | BIGINT | 告警时间戳 |
| is_read | TINYINT(1) | 是否已读 |
| plate_number | VARCHAR(20) | 车牌号码 |
| image_path | VARCHAR(500) | 图片路径 |
| location | VARCHAR(100) | 识别位置 |
| latitude | DECIMAL(10,8) | 纬度坐标 |
| longitude | DECIMAL(11,8) | 经度坐标 |
| reason | VARCHAR(500) | 告警原因 |
| severity | ENUM | 严重程度 |

## 手动初始化（可选）

如果需要手动创建数据库和表，可以使用以下 SQL：

```sql
CREATE DATABASE IF NOT EXISTS `smart_lpr` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

USE `smart_lpr`;

-- 创建 plates 表
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

-- 创建 blacklist 表
CREATE TABLE IF NOT EXISTS `blacklist` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `plate_number` VARCHAR(20) NOT NULL UNIQUE,
  `reason` VARCHAR(500) NOT NULL,
  `severity` ENUM('high', 'medium', 'low') NOT NULL DEFAULT 'medium',
  `created_at` BIGINT NOT NULL,
  INDEX `idx_plate_number` (`plate_number`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 创建 alarms 表
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
```

## 故障排除

- **连接失败**：确认 MySQL 已启动、`.env` 配置正确、用户权限与防火墙。
- **权限错误**：可创建专用用户：

```sql
CREATE USER 'smart_lpr_user'@'localhost' IDENTIFIED BY 'your_password';
GRANT ALL PRIVILEGES ON smart_lpr.* TO 'smart_lpr_user'@'localhost';
FLUSH PRIVILEGES;
```

然后在 `.env` 文件中使用新用户：

```env
DB_USER=smart_lpr_user
DB_PASSWORD=your_password
```

## 脚本（scripts/）

### init_database.sql（首次必执行）

```bash
mysql -u root -p < scripts/init_database.sql
# 或
mysql -u root -p
source scripts/init_database.sql;
```

创建库与表（含 plate_records、经纬度等）。

### migrate_to_plate_records.sql（升级时执行）

```bash
mysql -u root -p < scripts/migrate_to_plate_records.sql
```

创建 plate_records 并迁移数据，保留原表兼容。

### verify_database.sql

```bash
mysql -u root -p < scripts/verify_database.sql
```

检查库表存在与结构、统计信息。

### clear_all_data.sql（仅测试环境）

```bash
mysql -u root -p
USE smart_lpr;
source scripts/clear_all_data.sql;
```

会清空所有表数据，执行前务必备份。

### update_historical_alarms_coordinates.sql（可选）

```bash
mysql -u root -p
USE smart_lpr;
source scripts/update_historical_alarms_coordinates.sql;
```

为历史告警补经纬度（从 plate_records、cameras 关联）；需 cameras 有数据（前端添加摄像头即会写入）。

**顺序**：首次 `init_database.sql` → 升级前备份再 `migrate_to_plate_records.sql` → 随时 `verify_database.sql` → 可选 `update_historical_alarms_coordinates.sql`。执行前备份，并确保 MySQL 用户有建库建表权限。
