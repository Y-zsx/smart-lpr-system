# Backend Service

基于 Node.js + Express + TypeScript 构建的后端服务。

## 🚀 快速开始

### 1. 安装依赖

```bash
npm install
```

### 2. 配置数据库

复制并编辑环境变量：

```env
PORT=8000
JWT_SECRET=replace_with_a_strong_random_secret
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=your_password
DB_NAME=smart_lpr
AI_SERVICE_URL=http://localhost:8001
AI_RECOGNIZE_TIMEOUT_MS=5000
AI_RECOGNIZE_RETRIES=1
MAX_FILE_SIZE=10485760
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
│   ├── modules/       # 按业务域：auth、iam、records、stats、alarms、monitor
│   ├── routes/        # API 路由（从 modules 引用）
│   ├── middlewares/   # 通用中间件
│   ├── config/        # 配置与数据库
│   ├── types/         # 类型定义
│   ├── utils/         # 共享工具与数据访问
│   └── index.ts       # 入口文件
└── uploads/           # 上传文件存储
```

新功能建议放在 `src/modules/<domain>`，详见 [项目结构说明](../docs/PROJECT_STRUCTURE.md)。

## 🔌 主要 API

- **鉴权**：`POST /api/auth/login`、`GET /api/auth/me`
- **IAM**：`GET /api/iam/users|roles|permissions`，`PUT /api/iam/users/:userId/roles` 等
- **记录**：`GET /api/plates`（支持分组）、`POST /api/plates`、`POST /api/recognize`、`GET /api/export-records`
- **统计**：`GET /api/stats/dashboard`、`GET /api/stats/daily`、`GET /api/stats/region`
- **告警与黑名单**：`GET /api/alarms`、`GET /api/blacklist` 等
- **监控**：`GET /api/cameras`、`POST /api/upload-url` 等

## 📚 相关文档

- [数据库配置指南](../docs/DATABASE.md)
- [数据记录说明](../docs/PLATE_RECORDS.md)
