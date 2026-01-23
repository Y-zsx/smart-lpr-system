# 数据库设置指南

## MySQL 数据库配置

本项目使用 MySQL 作为数据存储，支持自动创建数据库和表结构。

## 快速开始

### 1. 安装 MySQL

如果还没有安装 MySQL，请先安装：

- **Windows**: 下载 MySQL Installer from https://dev.mysql.com/downloads/installer/
- **macOS**: `brew install mysql` 或下载 DMG 安装包
- **Linux**: `sudo apt-get install mysql-server` (Ubuntu/Debian) 或 `sudo yum install mysql-server` (CentOS/RHEL)

### 2. 启动 MySQL 服务

- **Windows**: 在服务管理器中启动 MySQL 服务，或使用 MySQL Workbench
- **macOS**: `brew services start mysql`
- **Linux**: `sudo systemctl start mysql`

### 3. 配置数据库连接

在 `backend` 目录下创建 `.env` 文件（如果不存在）：

```bash
cd backend
cp .env.example .env
```

编辑 `.env` 文件，设置数据库连接信息：

```env
# 服务器配置
PORT=8000

# MySQL 数据库配置
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=your_password_here
DB_NAME=smart_lpr
```

### 4. 自动初始化

启动后端服务时，系统会自动：

1. 创建数据库（如果不存在）
2. 创建所有必需的表结构
3. 测试数据库连接

```bash
npm install
npm run dev
```

## 数据库结构

### plates 表（车牌记录）

存储所有识别到的车牌信息。

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

### blacklist 表（黑名单）

存储黑名单车辆信息。

| 字段 | 类型 | 说明 |
|------|------|------|
| id | INT | 主键，自增 |
| plate_number | VARCHAR(20) | 车牌号码（唯一） |
| reason | VARCHAR(500) | 加入黑名单的原因 |
| severity | ENUM | 严重程度：high, medium, low |
| created_at | BIGINT | 创建时间戳 |

### alarms 表（告警记录）

存储黑名单车辆识别告警。

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

### 连接失败

1. 检查 MySQL 服务是否运行
2. 检查 `.env` 文件中的数据库配置是否正确
3. 检查 MySQL 用户权限
4. 检查防火墙设置

### 权限错误

如果遇到权限错误，可能需要创建专用数据库用户：

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

## 数据库脚本

项目提供了多个数据库脚本，位于 `scripts/` 目录。详细使用方法如下：

### 初始化脚本

**`init_database.sql`** - 数据库初始化脚本（首次安装必执行）

```bash
mysql -u root -p < scripts/init_database.sql
# 或
mysql -u root -p
source scripts/init_database.sql;
```

功能：
- 创建 `smart_lpr` 数据库
- 创建所有必需的表结构（plates, blacklist, alarms, plate_records等）
- 包含经纬度字段和索引配置

### 迁移脚本

**`migrate_to_plate_records.sql`** - 数据迁移脚本（升级系统时执行）

```bash
mysql -u root -p < scripts/migrate_to_plate_records.sql
```

功能：
- 创建 `plate_records` 表（新的记录结构）
- 迁移现有数据到新表
- 保留原有表结构用于兼容性

### 维护脚本

**`verify_database.sql`** - 数据库验证脚本

```bash
mysql -u root -p < scripts/verify_database.sql
```

功能：
- 检查数据库和表是否存在
- 验证表结构完整性（包括经纬度字段）
- 查看数据库统计信息

**`clear_all_data.sql`** - 清空所有数据脚本（⚠️ 测试环境使用）

```bash
mysql -u root -p
USE smart_lpr;
source scripts/clear_all_data.sql;
```

⚠️ **警告**：会删除所有表的数据，执行前请先备份数据库。

**`update_historical_alarms_coordinates.sql`** - 更新历史告警坐标（可选）

```bash
mysql -u root -p
USE smart_lpr;
source scripts/update_historical_alarms_coordinates.sql;
```

功能：
- 为历史告警记录补充经纬度坐标
- 从 `plate_records` 和 `cameras` 表关联获取坐标

**注意**：需要先确保 `cameras` 表存在且有数据（在前端添加摄像头并保存会自动创建）。

### 脚本执行顺序

1. **首次安装**：执行 `init_database.sql`
2. **升级系统**：先备份，再执行 `migrate_to_plate_records.sql`
3. **验证配置**：随时可以执行 `verify_database.sql`
4. **更新历史数据**：执行 `update_historical_alarms_coordinates.sql`（可选）

### 注意事项

- **备份数据**：执行任何脚本前，建议先备份现有数据
- **权限要求**：确保MySQL用户有创建数据库和表的权限
