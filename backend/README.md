# Backend Service

基于 Node.js + Express + TypeScript 构建的后端服务。

## 🚀 快速开始

### 1. 安装依赖

```bash
npm install
```

### 2. 配置数据库

创建 `.env` 文件：

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

服务运行在 `http://localhost:8000`

> 💡 首次启动会自动创建数据库和表结构

## 📁 目录结构

```
backend/
├── src/
│   ├── config/        # 配置文件
│   ├── controllers/   # 业务控制器
│   ├── routes/        # API 路由
│   ├── utils/         # 工具函数
│   └── index.ts       # 入口文件
└── uploads/           # 上传文件存储
```

## 🔌 主要 API

- `GET /api/plates` - 获取识别记录（支持分组）
- `POST /api/plates` - 保存识别记录
- `POST /api/recognize` - 图片识别（支持多车牌，返回 `{ plates: LicensePlate[] }`）
- `GET /api/stats/dashboard` - 仪表盘统计
- `GET /api/stats/daily` - 每日统计
- `GET /api/blacklist` - 黑名单管理
- `GET /api/alarms` - 告警记录
- `GET /api/cameras` - 摄像头管理

## 📚 相关文档

- [数据库配置指南](../docs/DATABASE.md)
- [数据记录说明](../docs/PLATE_RECORDS.md)
