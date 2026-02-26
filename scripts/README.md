# 📋 脚本说明

数据库脚本与本地健康检查脚本。

## 📝 脚本列表

| 脚本 | 用途 | 使用场景 |
|------|------|----------|
| `smoke-check.ps1` | 后端与登录接口健康检查 | 启动服务后快速验证（Windows PowerShell） |
| `deploy-frontend.sh` | 一键发布前端到 Nginx 静态目录 | 线上快速发布（Linux） |
| `deploy-backend.sh` | 一键发布后端并重启 PM2 | 线上快速发布后端（Linux） |
| `deploy-ai.sh` | 一键发布 AI 服务并重启 PM2 | 线上快速发布 AI（Linux） |
| `deploy.sh` | 统一发布入口（fe/be/ai/all） | 一条命令发布指定模块（Linux） |
| `init_database.sql` | 初始化数据库和表结构 | 首次安装系统 |
| `migrate_to_plate_records.sql` | 迁移到新的记录结构 | 系统升级 |
| `verify_database.sql` | 验证数据库配置 | 检查数据库状态 |
| `clear_all_data.sql` | 清空所有数据 | 测试环境重置 |
| `update_historical_alarms_coordinates.sql` | 更新历史告警坐标 | 可选，补充历史数据 |

### 地址与坐标规范（路径重现不依赖“地址反查”）

- **来源**：地址文案和经纬度都可以来自高德，但高德不同接口用途不同：
  - **地理编码（Geocoder）**：地址字符串 → 坐标，适合完整地址。
  - **逆地理**：坐标 → 地址文案（选点后展示的“北京市东城区…”）。
  - **PlaceSearch（POI 关键词）**：用关键词搜 POI，**不是**按完整地址字符串查坐标，长地址或带括号的地址经常搜不到或返回 error。
- **规范**：  
  - 在能拿到坐标的场景（如添加摄像头时用地图选点、告警关联摄像头），**一律落库并返回 `latitude` / `longitude`**，路径重现优先用坐标，不再用地址反查。  
  - 仅当告警/摄像头没有经纬度时，才用“地址 → 坐标”（前端先 PlaceSearch，失败再用 Geocoder 兜底）。  
- **历史数据**：若告警表有 `location` 无 `latitude`/`longitude`，可用 `update_historical_alarms_coordinates.sql` 从关联摄像头补全坐标，补全后路径重现更稳定。

### 健康检查用法

先启动后端（及可选 AI 服务），在项目根目录执行：

```powershell
.\scripts\smoke-check.ps1
```

通过则退出码为 0，否则为 1。完整功能测试见 [docs/TESTING.md](../docs/TESTING.md)。

### 前端一键发布（Linux）

默认发布到 `/var/www/smart-lpr` 并重载 Nginx：

```bash
chmod +x ./scripts/deploy-frontend.sh
./scripts/deploy-frontend.sh
```

可选参数通过环境变量覆盖：

```bash
# 首次部署时顺便安装依赖
INSTALL_DEPS=1 ./scripts/deploy-frontend.sh

# 自定义发布目录或站点 URL
DEPLOY_ROOT=/var/www/smart-lpr SITE_URL=https://smartlpr.cloud ./scripts/deploy-frontend.sh
```

### 后端一键发布（Linux）

```bash
chmod +x ./scripts/deploy-backend.sh
./scripts/deploy-backend.sh
```

可选参数：

```bash
# 首次部署顺便安装依赖
INSTALL_DEPS=1 ./scripts/deploy-backend.sh

# 自定义 PM2 进程名 / 健康检查地址
PM2_APP_NAME=smart-lpr-backend BACKEND_HEALTH_URL=http://localhost:8000/api/health ./scripts/deploy-backend.sh

# 调整健康检查重试（默认 15 次，每次间隔 2 秒）
HEALTH_RETRY_MAX=20 HEALTH_RETRY_INTERVAL=3 ./scripts/deploy-backend.sh
```

### AI 一键发布（Linux）

```bash
chmod +x ./scripts/deploy-ai.sh
./scripts/deploy-ai.sh
```

可选参数：

```bash
# 自动创建 venv（默认开启）并安装依赖（默认开启）
AUTO_CREATE_VENV=1 INSTALL_DEPS=1 ./scripts/deploy-ai.sh

# 自定义 PM2 进程名 / 健康检查地址
PM2_APP_NAME=smart-lpr-ai AI_HEALTH_URL=http://localhost:8001/health ./scripts/deploy-ai.sh

# 调整健康检查重试（默认 15 次，每次间隔 2 秒）
HEALTH_RETRY_MAX=20 HEALTH_RETRY_INTERVAL=3 ./scripts/deploy-ai.sh
```

### 统一发布入口（Linux）

```bash
chmod +x ./scripts/deploy.sh

# 仅前端
./scripts/deploy.sh fe

# 仅后端
./scripts/deploy.sh be

# 仅 AI
./scripts/deploy.sh ai

# 全量（backend -> ai -> frontend）
./scripts/deploy.sh all
```

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
