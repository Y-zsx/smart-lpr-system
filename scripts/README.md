# 数据库脚本说明

本目录包含数据库相关的SQL脚本文件。

## 📋 脚本列表

### 初始化脚本
- **`init_database.sql`** - 数据库初始化脚本
  - 创建 `smart_lpr` 数据库
  - 创建所有必需的表结构（plates, blacklist, alarms等）
  - 设置字符集和索引

### 迁移脚本
- **`migrate_to_plate_records.sql`** - 数据迁移脚本
  - 创建 `plate_records` 表（新的记录结构）
  - 迁移现有数据到新表
  - 保留原有表结构用于兼容性

### 验证脚本
- **`verify_database.sql`** - 数据库验证脚本
  - 检查数据库和表是否存在
  - 查看表结构
  - 查看数据库统计信息

## 🚀 使用方法

### 初始化数据库

```bash
# 方式1：命令行执行
mysql -u root -p < scripts/init_database.sql

# 方式2：MySQL命令行中执行
mysql -u root -p
source scripts/init_database.sql;
```

### 数据迁移

```bash
# 方式1：命令行执行
mysql -u root -p < scripts/migrate_to_plate_records.sql

# 方式2：MySQL命令行中执行
mysql -u root -p
USE smart_lpr;
source scripts/migrate_to_plate_records.sql;
```

### 验证数据库

```bash
# 方式1：命令行执行
mysql -u root -p < scripts/verify_database.sql

# 方式2：MySQL命令行中执行
mysql -u root -p
source scripts/verify_database.sql;
```

## ⚠️ 注意事项

1. **备份数据**：执行任何脚本前，建议先备份现有数据
2. **权限要求**：确保MySQL用户有创建数据库和表的权限
3. **执行顺序**：
   - 首次安装：执行 `init_database.sql`
   - 升级系统：先备份，再执行 `migrate_to_plate_records.sql`
   - 验证配置：随时可以执行 `verify_database.sql`

## 📚 相关文档

- [数据库配置指南](../docs/DATABASE.md) - 详细的数据库配置说明
- [数据记录说明](../docs/PLATE_RECORDS.md) - 数据结构和使用方法
