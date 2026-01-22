# 车牌识别记录数据结构说明

## 📋 数据结构概述

系统已重构为**以车牌号为唯一标识的集合结构**，每次识别都会创建一条新记录，所有记录按车牌号分组管理。

## 🗂️ 数据模型

### 识别记录 (PlateRecord)
每次识别创建一条记录，包含以下信息：

- **id**: 记录唯一标识
- **plateNumber**: 车牌号（分组标识）
- **plateType**: 车牌类型（蓝牌/绿牌/黄牌等）
- **confidence**: 识别置信度
- **timestamp**: 识别时间戳
- **cameraId**: 摄像头ID
- **cameraName**: 摄像头名称
- **location**: 位置信息
- **imageUrl**: 抓拍图片URL
- **rect**: 车牌在图片中的位置（坐标和尺寸）
- **createdAt**: 记录创建时间

### 车牌集合 (PlateGroup)
以车牌号为唯一标识的集合，包含：

- **plateNumber**: 车牌号（唯一标识）
- **plateType**: 车牌类型
- **firstSeen**: 首次识别时间
- **lastSeen**: 最后识别时间
- **totalCount**: 识别次数
- **records**: 识别记录列表（子集）
- **averageConfidence**: 平均置信度
- **locations**: 出现过的位置列表
- **cameras**: 出现过的摄像头列表

## 🗄️ 数据库结构

### plate_records 表

```sql
CREATE TABLE `plate_records` (
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
  INDEX `idx_camera_id` (`camera_id`)
);
```

## 🚀 使用方法

### 1. 数据库迁移

如果是现有系统，需要执行迁移脚本：

```bash
mysql -u root -p < backend/migrate_to_plate_records.sql
```

或者手动执行 SQL：

```sql
USE smart_lpr;
SOURCE backend/migrate_to_plate_records.sql;
```

### 2. 保存识别记录

系统会自动保存每次识别记录，包含：
- 识别时间
- 摄像头来源（ID和名称）
- 抓拍图片
- 位置信息
- 置信度
- 车牌位置坐标

**前端自动保存**：在实时监控识别时，系统会自动保存记录，无需手动操作。

### 3. 查询识别记录

#### 按车牌号分组查询（推荐）

```javascript
// 前端调用
const groups = await apiClient.getHistory(start, end, type, 'plate');

// 返回格式
[
  {
    plateNumber: "京A·12345",
    plateType: "blue",
    firstSeen: 1234567890,
    lastSeen: 1234567899,
    totalCount: 5,
    averageConfidence: 0.92,
    locations: ["停车场入口", "停车场出口"],
    cameras: ["摄像头1", "摄像头2"],
    records: [
      {
        id: "record-1",
        plateNumber: "京A·12345",
        timestamp: 1234567890,
        cameraName: "停车场入口",
        imageUrl: "uploads/image1.jpg",
        confidence: 0.95,
        // ...
      },
      // ... 更多记录
    ]
  }
]
```

#### 查询单个车牌的所有记录

```javascript
const groups = await apiClient.getHistory(start, end, type, 'plate', '京A·12345');
```

#### 兼容旧接口（返回单条记录列表）

```javascript
// 不传 groupBy 参数，返回旧格式
const plates = await apiClient.getHistory(start, end, type);
```

### 4. API 接口

#### GET /api/plates

查询识别记录

**参数：**
- `start`: 开始时间戳（可选）
- `end`: 结束时间戳（可选）
- `type`: 车牌类型（可选）
- `plateNumber`: 车牌号（可选，查询单个车牌）
- `groupBy`: 分组方式，传 `'plate'` 表示按车牌号分组（可选）

**示例：**
```
GET /api/plates?start=1234567890&end=1234567999&groupBy=plate
GET /api/plates?plateNumber=京A·12345&groupBy=plate
```

#### POST /api/plates

保存识别记录（系统自动调用，通常不需要手动调用）

**请求体：**
```json
{
  "number": "京A·12345",
  "type": "blue",
  "confidence": 0.95,
  "timestamp": 1234567890,
  "cameraId": "cam-123",
  "cameraName": "停车场入口",
  "location": "停车场入口",
  "imageUrl": "uploads/image.jpg",
  "rect": { "x": 100, "y": 100, "w": 200, "h": 100 }
}
```

## 📊 数据特点

### 优势

1. **完整历史记录**：每次识别都保存，不会丢失数据
2. **多维度分析**：可以分析车牌出现的时间、地点、频率
3. **轨迹追踪**：可以追踪车辆在不同摄像头间的移动
4. **统计分析**：支持按车牌号进行各种统计分析

### 数据示例

假设车牌 "京A·12345" 被识别了 5 次：

```
车牌号: 京A·12345
类型: 蓝牌
首次识别: 2024-01-01 10:00:00
最后识别: 2024-01-01 18:00:00
识别次数: 5
平均置信度: 0.92
出现位置: ["停车场入口", "停车场出口"]
出现摄像头: ["摄像头1", "摄像头2"]

识别记录:
  1. 2024-01-01 10:00:00 - 停车场入口 - 摄像头1 - 置信度: 0.95
  2. 2024-01-01 12:00:00 - 停车场入口 - 摄像头1 - 置信度: 0.90
  3. 2024-01-01 14:00:00 - 停车场出口 - 摄像头2 - 置信度: 0.93
  4. 2024-01-01 16:00:00 - 停车场入口 - 摄像头1 - 置信度: 0.91
  5. 2024-01-01 18:00:00 - 停车场出口 - 摄像头2 - 置信度: 0.89
```

## 🔄 兼容性

- **向后兼容**：保留了原有的 `plates` 表和 API 接口
- **渐进迁移**：可以逐步迁移到新结构
- **数据安全**：迁移脚本会保留原有数据

## 📝 注意事项

1. **自动保存**：实时监控识别时，系统会自动保存记录，无需手动操作
2. **摄像头信息**：确保摄像头配置正确，系统会自动记录摄像头ID和名称
3. **数据量**：每次识别都创建新记录，注意数据库存储空间
4. **查询性能**：大量数据时，建议使用时间范围查询

## 🛠️ 维护

### 清理旧数据

如果需要清理旧的识别记录：

```sql
-- 删除指定时间之前的记录
DELETE FROM plate_records WHERE timestamp < UNIX_TIMESTAMP('2024-01-01') * 1000;

-- 删除指定车牌的所有记录
DELETE FROM plate_records WHERE plate_number = '京A·12345';
```

### 数据备份

定期备份 `plate_records` 表：

```bash
mysqldump -u root -p smart_lpr plate_records > plate_records_backup.sql
```
