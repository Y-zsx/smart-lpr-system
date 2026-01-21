# Smart LPR System - Backend

基于 Node.js + Express + TypeScript 构建的智能车牌识别系统后端服务。

## 功能特性

- **RESTful API**：提供标准的 REST 接口供前端调用。
- **本地存储**：使用 JSON 文件作为轻量级数据库，无需安装额外数据库软件。
- **文件服务**：支持图片上传和静态资源访问。
- **模拟识别**：内置模拟 OCR 识别逻辑，方便开发测试。
- **数据导出**：支持将识别记录导出为 CSV 文件。

## API 接口

- `GET /api/plates`: 获取识别记录
- `POST /api/plates`: 保存识别记录
- `POST /api/recognize`: 图片识别接口
- `GET /api/stats/dashboard`: 仪表盘统计数据
- `GET /api/stats/daily`: 每日流量统计
- `GET /api/blacklist`: 黑名单管理
- `GET /api/alarms`: 告警记录

## 开发指南

### 安装依赖

```bash
npm install
```

### 启动开发服务器

```bash
npm run dev
```

### 构建生产版本

```bash
npm run build
npm start
```

## 数据存储

- 数据文件位置：`backend/data/db.json`
- 上传文件位置：`backend/uploads/`
