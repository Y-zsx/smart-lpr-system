# 📋 数据库脚本

数据库相关的 SQL 脚本文件。

## 📝 脚本列表

| 脚本 | 用途 | 使用场景 |
|------|------|----------|
| `init_database.sql` | 初始化数据库和表结构 | 首次安装系统 |
| `migrate_to_plate_records.sql` | 迁移到新的记录结构 | 系统升级 |
| `verify_database.sql` | 验证数据库配置 | 检查数据库状态 |
| `clear_all_data.sql` | 清空所有数据 | 测试环境重置 |
| `update_historical_alarms_coordinates.sql` | 更新历史告警坐标 | 可选，补充历史数据 |

## 🚀 快速使用

### 首次安装

```bash
mysql -u root -p < scripts/init_database.sql
```

### 验证数据库

```bash
mysql -u root -p < scripts/verify_database.sql
```

### 清空测试数据

```bash
mysql -u root -p
USE smart_lpr;
source scripts/clear_all_data.sql;
```

## ⚠️ 注意事项

- 执行脚本前请备份数据库
- `clear_all_data.sql` 会删除所有数据，仅用于测试环境
- 详细说明请查看 [数据库配置指南](../docs/DATABASE.md)
