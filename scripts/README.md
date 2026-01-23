# 数据库脚本快速参考

本目录包含数据库相关的SQL脚本文件。详细说明请参考 [数据库配置指南](../docs/DATABASE.md)。

## 📋 脚本列表

| 脚本 | 用途 | 执行时机 |
|------|------|----------|
| `init_database.sql` | 初始化数据库和表结构 | 首次安装 |
| `migrate_to_plate_records.sql` | 迁移到新的记录结构 | 升级系统 |
| `verify_database.sql` | 验证数据库配置 | 随时验证 |
| `clear_all_data.sql` | 清空所有数据 | 测试环境 |
| `update_historical_alarms_coordinates.sql` | 更新历史告警坐标 | 可选 |

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

## 📚 详细文档

更多详细信息、使用方法和注意事项，请查看 [数据库配置指南](../docs/DATABASE.md)。
