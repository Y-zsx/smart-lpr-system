# Backend Service (后端服务)

基于 Node.js + Express + TypeScript 构建的智能车牌识别系统后端服务。

## 功能特性

- **RESTful API**：提供标准的 REST 接口供前端调用
- **MySQL 数据库**：使用 MySQL 存储识别记录、黑名单和告警信息
- **文件服务**：支持图片上传和静态资源访问
- **数据导出**：支持将识别记录导出为 CSV 文件
- **摄像头管理**：支持多摄像头配置和管理

## 快速开始

### 1. 安装依赖

```bash
npm install
```

### 2. 配置数据库

创建 `.env` 文件并配置数据库连接信息：

```env
PORT=8000
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=your_password
DB_NAME=smart_lpr
```

### 3. 启动服务

```bash
# 开发模式
npm run dev

# 生产模式
npm run build
npm start
```

服务将在 `http://localhost:8000` 启动。

## 主要 API 接口

- `GET /api/plates` - 获取识别记录（支持分组查询）
- `POST /api/plates` - 保存识别记录
- `POST /api/recognize` - 图片识别接口
- `GET /api/stats/dashboard` - 仪表盘统计数据
- `GET /api/stats/daily` - 每日流量统计
- `GET /api/blacklist` - 黑名单管理
- `GET /api/alarms` - 告警记录
- `GET /api/cameras` - 摄像头管理

## 目录结构

```
backend/
├── src/
│   ├── config/        # 配置文件（数据库配置等）
│   ├── controllers/   # 控制器（业务逻辑）
│   ├── routes/        # 路由定义
│   ├── utils/         # 工具函数
│   └── index.ts       # 入口文件
├── package.json
└── tsconfig.json
```

## 数据存储

- **数据库**: MySQL (自动创建数据库和表结构)
- **上传文件**: `backend/uploads/` (图片等静态资源)

## 相关文档

- [数据库配置指南](../docs/DATABASE.md) - 详细的数据库配置说明
- [数据记录说明](../docs/PLATE_RECORDS.md) - 数据结构和使用方法
