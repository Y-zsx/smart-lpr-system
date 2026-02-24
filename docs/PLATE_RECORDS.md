# 车牌识别记录数据结构

以车牌号为分组标识，每次识别创建一条新记录。

## 数据模型

**PlateRecord（单条记录）**：id、plateNumber、plateType、confidence、timestamp、cameraId、cameraName、location、imageUrl、rect、createdAt。

**PlateGroup（按车牌聚合）**：plateNumber、plateType、firstSeen、lastSeen、totalCount、records、averageConfidence、locations、cameras。

## 数据库

表 `plate_records`：id, plate_number, plate_type, confidence, timestamp, camera_id, camera_name, location, image_url, rect_x/y/w/h, created_at；索引 idx_plate_number、idx_timestamp、idx_camera_id。

迁移：`mysql -u root -p < scripts/migrate_to_plate_records.sql` 或 `SOURCE scripts/migrate_to_plate_records.sql`。

## 使用方式

- **保存**：实时监控识别时系统自动保存，一般无需手动调用。
- **按车牌分组查询**：`apiClient.getHistory(start, end, type, 'plate')`，返回 PlateGroup 数组。
- **单车牌记录**：`apiClient.getHistory(start, end, type, 'plate', '京A·12345')`。
- **兼容旧接口**：不传 `groupBy` 则返回单条记录列表。

## API 摘要

- **GET /api/plates**：参数 start、end、type、plateNumber（可选）、groupBy='plate'（按车牌分组）。示例：`?start=...&end=...&groupBy=plate`。
- **POST /api/plates**：Body 含 number、type、confidence、timestamp、cameraId、cameraName、location、imageUrl、rect；系统自动调用。

## 维护

- 清理旧数据：`DELETE FROM plate_records WHERE timestamp < ?` 或按 `plate_number` 删除。
- 备份：`mysqldump -u root -p smart_lpr plate_records > plate_records_backup.sql`。

注意：每次识别都会新增记录，注意存储与查询时使用时间范围以保障性能。
